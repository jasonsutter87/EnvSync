//! Sync Engine for EnvSync
//!
//! Handles synchronization between local SQLite storage and VeilCloud.
//! All data is encrypted client-side before being sent to the cloud.
//!
//! Updated to use VeilCloud's /v1/storage/:projectId/:envName API.

use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use chrono::Utc;
use sha2::{Digest, Sha256};
use std::sync::{Arc, RwLock};

use crate::crypto::{decrypt_bytes, encrypt_bytes};
use crate::db::Database;
use crate::error::{Error, Result};
use crate::models::{
    AuthTokens, ConflictInfo, ConflictResolution, EncryptedBlob, Project, SyncEvent,
    SyncEventType, SyncState, SyncStatus, User,
};
use crate::veilcloud::{BlobListEntry, VeilCloudClient, VeilCloudConfig};

/// Environment name used for storing full project data in VeilCloud
const SYNC_ENV_NAME: &str = "_sync";

/// Sync engine manages synchronization between local and cloud storage
pub struct SyncEngine {
    db: Arc<Database>,
    cloud: VeilCloudClient,
    status: RwLock<SyncStatus>,
    sync_history: RwLock<Vec<SyncEvent>>,
    conflicts: RwLock<Vec<ConflictInfo>>,
}

/// Result of a sync operation
#[derive(Debug, Clone, serde::Serialize)]
pub struct SyncResult {
    pub pushed: u32,
    pub pulled: u32,
    pub conflicts: u32,
    pub errors: Vec<String>,
}

impl SyncEngine {
    /// Create a new sync engine
    pub fn new(db: Arc<Database>) -> Self {
        Self {
            db,
            cloud: VeilCloudClient::new(),
            status: RwLock::new(SyncStatus::default()),
            sync_history: RwLock::new(Vec::new()),
            conflicts: RwLock::new(Vec::new()),
        }
    }

    /// Create with custom VeilCloud config (e.g., for local development)
    pub fn with_config(db: Arc<Database>, config: VeilCloudConfig) -> Self {
        Self {
            db,
            cloud: VeilCloudClient::with_config(config),
            status: RwLock::new(SyncStatus::default()),
            sync_history: RwLock::new(Vec::new()),
            conflicts: RwLock::new(Vec::new()),
        }
    }

    // ========== Status & State ==========

    /// Get current sync status
    pub fn get_status(&self) -> SyncStatus {
        self.status.read().unwrap().clone()
    }

    /// Check if connected to cloud
    pub fn is_connected(&self) -> bool {
        self.cloud.is_authenticated()
    }

    /// Get current user
    pub fn current_user(&self) -> Option<User> {
        self.cloud.current_user()
    }

    /// Get sync history
    pub fn get_history(&self, limit: usize) -> Vec<SyncEvent> {
        let history = self.sync_history.read().unwrap();
        history.iter().rev().take(limit).cloned().collect()
    }

    /// Get unresolved conflicts
    pub fn get_conflicts(&self) -> Vec<ConflictInfo> {
        self.conflicts.read().unwrap().clone()
    }

    fn update_status(&self, state: SyncState) {
        let mut status = self.status.write().unwrap();
        status.state = state;
        status.user = self.cloud.current_user();
    }

    fn add_event(&self, event: SyncEvent) {
        let mut history = self.sync_history.write().unwrap();
        history.push(event);
        // Keep last 1000 events
        if history.len() > 1000 {
            history.remove(0);
        }
    }

    // ========== Authentication ==========

    /// Sign up for VeilCloud
    pub async fn signup(&self, email: &str, password: &str, name: Option<&str>) -> Result<User> {
        let user = self.cloud.signup(email, password, name).await?;
        self.update_status(SyncState::Idle);
        self.add_event(SyncEvent::new(
            SyncEventType::Created,
            None,
            None,
            None,
            Some(format!("Account created: {}", email)),
        ));
        Ok(user)
    }

    /// Log in to VeilCloud
    pub async fn login(&self, email: &str, password: &str) -> Result<User> {
        let user = self.cloud.login(email, password).await?;
        self.update_status(SyncState::Idle);
        self.add_event(SyncEvent::new(
            SyncEventType::Pull,
            None,
            None,
            None,
            Some(format!("Logged in as: {}", email)),
        ));
        Ok(user)
    }

    /// Log out from VeilCloud
    pub fn logout(&self) {
        self.cloud.logout();
        self.update_status(SyncState::Disconnected);
        self.add_event(SyncEvent::new(
            SyncEventType::Updated,
            None,
            None,
            None,
            Some("Logged out".to_string()),
        ));
    }

    /// Restore session from saved tokens
    pub fn restore_session(&self, tokens: AuthTokens, user: User) {
        self.cloud.restore_session(tokens, user);
        self.update_status(SyncState::Idle);
    }

    /// Get current auth tokens (to persist them)
    pub fn get_tokens(&self) -> Option<AuthTokens> {
        self.cloud.get_tokens()
    }

    // ========== Sync Operations ==========

    /// Perform a full sync (push local changes, pull remote changes)
    pub async fn sync(&self) -> Result<SyncResult> {
        if !self.is_connected() {
            return Err(Error::NotAuthenticated);
        }

        self.update_status(SyncState::Syncing);

        let mut result = SyncResult {
            pushed: 0,
            pulled: 0,
            conflicts: 0,
            errors: Vec::new(),
        };

        // Get the encryption key from the database
        let key = self.db.get_sync_key()?;

        // Push local changes
        match self.push_changes(&key).await {
            Ok(count) => result.pushed = count,
            Err(e) => result.errors.push(format!("Push failed: {}", e)),
        }

        // Pull remote changes
        match self.pull_changes(&key).await {
            Ok((pulled, conflicts)) => {
                result.pulled = pulled;
                result.conflicts = conflicts;
            }
            Err(e) => result.errors.push(format!("Pull failed: {}", e)),
        }

        // Update status
        {
            let mut status = self.status.write().unwrap();
            status.last_sync = Some(Utc::now());
            status.pending_changes = 0;
            status.state = if result.conflicts > 0 {
                SyncState::Conflict
            } else if result.errors.is_empty() {
                SyncState::Idle
            } else {
                SyncState::Error(result.errors.join("; "))
            };
        }

        Ok(result)
    }

    /// Push local changes to cloud
    async fn push_changes(&self, key: &[u8]) -> Result<u32> {
        let projects = self.db.get_projects()?;
        let mut pushed = 0;

        for project in projects {
            // Check if project needs syncing
            let sync_meta = self.db.get_sync_metadata(&project.id)?;
            if !sync_meta.is_dirty {
                continue;
            }

            // Serialize project data
            let project_data = self.serialize_project(&project.id)?;

            // Encrypt the data
            let encrypted = self.encrypt_data(key, &project_data)?;

            // Upload to VeilCloud using new API: PUT /v1/storage/:projectId/:envName
            // We store nonce in metadata field
            match self
                .cloud
                .storage_put(
                    &project.id,
                    SYNC_ENV_NAME,
                    &encrypted.ciphertext,
                    Some(&encrypted.nonce),
                )
                .await
            {
                Ok(blob_info) => {
                    // Update sync metadata
                    self.db.update_sync_metadata(
                        &project.id,
                        Some(&blob_info.key),
                        sync_meta.local_version,
                        Some(sync_meta.local_version), // Use local version as remote version
                        false,
                    )?;

                    self.add_event(SyncEvent::new(
                        SyncEventType::Push,
                        Some(project.id.clone()),
                        None,
                        None,
                        Some(format!("Pushed project: {}", project.name)),
                    ));

                    pushed += 1;
                }
                Err(e) => {
                    log::error!("Failed to push project {}: {}", project.id, e);
                }
            }
        }

        Ok(pushed)
    }

    /// Pull remote changes from cloud
    ///
    /// Currently pulls changes for projects that exist locally.
    /// TODO: Add discovery of new remote projects via VeilCloud projects API.
    async fn pull_changes(&self, key: &[u8]) -> Result<(u32, u32)> {
        let local_projects = self.db.get_projects()?;
        let mut pulled = 0;
        let mut conflicts = 0;

        for project in local_projects {
            // Check if project has sync enabled
            let sync_meta = match self.db.get_sync_metadata(&project.id) {
                Ok(meta) => meta,
                Err(_) => continue, // No sync metadata, skip
            };

            if !sync_meta.sync_enabled {
                continue;
            }

            // Check if remote blob exists using HEAD request
            let remote_entry = match self.cloud.storage_head(&project.id, SYNC_ENV_NAME).await {
                Ok(Some(entry)) => entry,
                Ok(None) => continue, // Remote doesn't exist, nothing to pull
                Err(e) => {
                    log::warn!("Failed to check remote for project {}: {}", project.id, e);
                    continue;
                }
            };

            // Compare with local state
            if sync_meta.is_dirty {
                // We have local changes - check for conflict
                // Use hash comparison to detect if remote changed
                if sync_meta.remote_id.as_deref() != Some(&remote_entry.hash) {
                    // Conflict: both local and remote have changes
                    self.handle_conflict(&project.id, &remote_entry, key).await?;
                    conflicts += 1;
                }
                // If remote hash matches, our push will handle it
            } else if sync_meta.remote_id.as_deref() != Some(&remote_entry.hash) {
                // Remote is newer, pull it
                self.pull_project(&project.id, key).await?;
                pulled += 1;
            }
        }

        Ok((pulled, conflicts))
    }

    /// Pull a single project from remote
    async fn pull_project(&self, project_id: &str, key: &[u8]) -> Result<()> {
        // Get the blob from VeilCloud storage
        let blob = self.cloud.storage_get(project_id, SYNC_ENV_NAME).await?;

        // Decrypt the data (nonce is stored in metadata field)
        let decrypted = self.decrypt_data(
            key,
            &EncryptedBlob {
                ciphertext: blob.data,
                nonce: blob.metadata.unwrap_or_default(),
                version: blob.version,
            },
        )?;

        // Deserialize and import
        self.import_project_data(project_id, &decrypted)?;

        // Update sync metadata with the hash as remote_id for change detection
        let checksum = self.compute_checksum(decrypted.as_bytes());
        self.db.update_sync_metadata(
            project_id,
            Some(&checksum),
            blob.version,
            Some(blob.version),
            false,
        )?;

        self.add_event(SyncEvent::new(
            SyncEventType::Pull,
            Some(project_id.to_string()),
            None,
            None,
            Some(format!("Pulled project: {}", project_id)),
        ));

        Ok(())
    }

    /// Handle a sync conflict
    async fn handle_conflict(
        &self,
        project_id: &str,
        remote_entry: &BlobListEntry,
        key: &[u8],
    ) -> Result<()> {
        // Get local data
        let local_data = self.serialize_project(project_id)?;

        // Get remote data from VeilCloud storage
        let remote_blob = self.cloud.storage_get(project_id, SYNC_ENV_NAME).await?;
        let remote_decrypted = self.decrypt_data(
            key,
            &EncryptedBlob {
                ciphertext: remote_blob.data,
                nonce: remote_blob.metadata.unwrap_or_default(),
                version: remote_blob.version,
            },
        )?;

        // Record the conflict
        let conflict = ConflictInfo {
            project_id: project_id.to_string(),
            environment_id: None,
            variable_key: None,
            local_value: local_data,
            remote_value: remote_decrypted,
            local_modified: Utc::now(),
            remote_modified: remote_entry.updated_at,
        };

        self.conflicts.write().unwrap().push(conflict);

        self.add_event(SyncEvent::new(
            SyncEventType::Conflict,
            Some(project_id.to_string()),
            None,
            None,
            Some("Sync conflict detected".to_string()),
        ));

        Ok(())
    }

    /// Resolve a conflict
    pub async fn resolve_conflict(
        &self,
        project_id: &str,
        resolution: ConflictResolution,
    ) -> Result<()> {
        let key = self.db.get_sync_key()?;

        // Find and remove the conflict
        let conflict = {
            let mut conflicts = self.conflicts.write().unwrap();
            let idx = conflicts
                .iter()
                .position(|c| c.project_id == project_id)
                .ok_or_else(|| Error::NotFound("Conflict not found".to_string()))?;
            conflicts.remove(idx)
        };

        match resolution {
            ConflictResolution::KeepLocal => {
                // Re-push local version
                let sync_meta = self.db.get_sync_metadata(project_id)?;
                let encrypted = self.encrypt_data(&key, &conflict.local_value)?;

                let blob_info = self
                    .cloud
                    .storage_put(
                        project_id,
                        SYNC_ENV_NAME,
                        &encrypted.ciphertext,
                        Some(&encrypted.nonce),
                    )
                    .await?;

                self.db.update_sync_metadata(
                    project_id,
                    Some(&blob_info.hash),
                    sync_meta.local_version + 1,
                    Some(sync_meta.local_version + 1),
                    false,
                )?;
            }
            ConflictResolution::KeepRemote => {
                // Import remote version
                self.import_project_data(project_id, &conflict.remote_value)?;
            }
            ConflictResolution::KeepBoth => {
                // Create a copy of the local version with a new ID
                // Then import remote
                let new_id = uuid::Uuid::new_v4().to_string();
                self.import_project_data(&new_id, &conflict.local_value)?;
                self.import_project_data(project_id, &conflict.remote_value)?;
            }
            ConflictResolution::Merge => {
                // Merge is complex - for now, just keep local
                // Future: implement smart merge for variables
                let sync_meta = self.db.get_sync_metadata(project_id)?;
                let encrypted = self.encrypt_data(&key, &conflict.local_value)?;

                let blob_info = self
                    .cloud
                    .storage_put(
                        project_id,
                        SYNC_ENV_NAME,
                        &encrypted.ciphertext,
                        Some(&encrypted.nonce),
                    )
                    .await?;

                self.db.update_sync_metadata(
                    project_id,
                    Some(&blob_info.hash),
                    sync_meta.local_version + 1,
                    Some(sync_meta.local_version + 1),
                    false,
                )?;
            }
        }

        self.add_event(SyncEvent::new(
            SyncEventType::Resolved,
            Some(project_id.to_string()),
            None,
            None,
            Some(format!("Conflict resolved: {:?}", resolution)),
        ));

        // Update status if no more conflicts
        if self.conflicts.read().unwrap().is_empty() {
            self.update_status(SyncState::Idle);
        }

        Ok(())
    }

    // ========== Encryption Helpers ==========

    /// Encrypt data for cloud storage
    fn encrypt_data(&self, key: &[u8], data: &str) -> Result<EncryptedBlob> {
        let (ciphertext, nonce) = encrypt_bytes(data.as_bytes(), key)?;
        Ok(EncryptedBlob {
            ciphertext: BASE64.encode(&ciphertext),
            nonce: BASE64.encode(&nonce),
            version: 1,
        })
    }

    /// Decrypt data from cloud storage
    fn decrypt_data(&self, key: &[u8], blob: &EncryptedBlob) -> Result<String> {
        let ciphertext = BASE64
            .decode(&blob.ciphertext)
            .map_err(|e| Error::Decryption(format!("Invalid base64: {}", e)))?;
        let nonce = BASE64
            .decode(&blob.nonce)
            .map_err(|e| Error::Decryption(format!("Invalid nonce: {}", e)))?;

        let plaintext = decrypt_bytes(&ciphertext, &nonce, key)?;
        String::from_utf8(plaintext)
            .map_err(|e| Error::Decryption(format!("Invalid UTF-8: {}", e)))
    }

    /// Compute checksum for data
    fn compute_checksum(&self, data: &[u8]) -> String {
        let mut hasher = Sha256::new();
        hasher.update(data);
        let result = hasher.finalize();
        hex::encode(result)
    }

    // ========== Serialization Helpers ==========

    /// Serialize a project with all its environments and variables
    fn serialize_project(&self, project_id: &str) -> Result<String> {
        let project = self.db.get_project(project_id)?;
        let environments = self.db.get_environments(project_id)?;

        let mut env_data = Vec::new();
        for env in &environments {
            let variables = self.db.get_variables(&env.id)?;
            env_data.push(serde_json::json!({
                "environment": env,
                "variables": variables,
            }));
        }

        let data = serde_json::json!({
            "project": project,
            "environments": env_data,
        });

        serde_json::to_string(&data).map_err(|e| Error::Serialization(e))
    }

    /// Import project data from serialized JSON
    fn import_project_data(&self, project_id: &str, data: &str) -> Result<()> {
        let parsed: serde_json::Value =
            serde_json::from_str(data).map_err(|e| Error::Serialization(e))?;

        // Extract project
        let project: Project = serde_json::from_value(parsed["project"].clone())
            .map_err(|e| Error::Serialization(e))?;

        // Create or update project
        if self.db.get_project(project_id).is_ok() {
            self.db.update_project(
                project_id,
                &project.name,
                project.description.as_deref(),
            )?;
        } else {
            self.db
                .create_project(&project.name, project.description.as_deref())?;
        }

        // Import environments and variables
        if let Some(envs) = parsed["environments"].as_array() {
            for env_data in envs {
                // Import environment
                if let Ok(env) =
                    serde_json::from_value::<crate::models::Environment>(env_data["environment"].clone())
                {
                    // Check if environment exists
                    if self.db.get_environment(&env.id).is_err() {
                        self.db.create_environment(
                            project_id,
                            &env.name,
                            env.env_type.clone(),
                        )?;
                    }

                    // Import variables
                    if let Some(vars) = env_data["variables"].as_array() {
                        for var_data in vars {
                            if let Ok(var) =
                                serde_json::from_value::<crate::models::Variable>(var_data.clone())
                            {
                                // Check if variable exists
                                if self.db.get_variable(&var.id).is_err() {
                                    self.db.create_variable(
                                        &env.id,
                                        &var.key,
                                        &var.value,
                                        var.is_secret,
                                    )?;
                                } else {
                                    self.db.update_variable(
                                        &var.id,
                                        &var.key,
                                        &var.value,
                                        var.is_secret,
                                    )?;
                                }
                            }
                        }
                    }
                }
            }
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sync_status_default() {
        let status = SyncStatus::default();
        assert_eq!(status.state, SyncState::Disconnected);
        assert!(status.last_sync.is_none());
        assert_eq!(status.pending_changes, 0);
    }
}
