use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Project {
    pub fn new(name: String, description: Option<String>) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4().to_string(),
            name,
            description,
            created_at: now,
            updated_at: now,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum EnvironmentType {
    Development,
    Staging,
    Production,
    Custom(String),
}

impl EnvironmentType {
    pub fn as_str(&self) -> &str {
        match self {
            Self::Development => "development",
            Self::Staging => "staging",
            Self::Production => "production",
            Self::Custom(s) => s,
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "development" | "dev" => Self::Development,
            "staging" => Self::Staging,
            "production" | "prod" => Self::Production,
            other => Self::Custom(other.to_string()),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Environment {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub env_type: EnvironmentType,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Environment {
    pub fn new(project_id: String, name: String, env_type: EnvironmentType) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4().to_string(),
            project_id,
            name,
            env_type,
            created_at: now,
            updated_at: now,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Variable {
    pub id: String,
    pub environment_id: String,
    pub key: String,
    pub value: String, // Stored encrypted in DB, decrypted in memory
    pub is_secret: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Variable {
    pub fn new(environment_id: String, key: String, value: String, is_secret: bool) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4().to_string(),
            environment_id,
            key,
            value,
            is_secret,
            created_at: now,
            updated_at: now,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultStatus {
    pub is_initialized: bool,
    pub is_unlocked: bool,
    pub last_activity: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectWithEnvironments {
    pub project: Project,
    pub environments: Vec<Environment>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvironmentWithVariables {
    pub environment: Environment,
    pub variables: Vec<Variable>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportFormat {
    pub project: Project,
    pub environments: Vec<EnvironmentWithVariables>,
}

// Service integration types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetlifyAccount {
    pub id: String,
    pub name: String,
    pub slug: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetlifySite {
    pub id: String,
    pub name: String,
    pub url: String,
    pub account_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetlifyEnvVar {
    pub key: String,
    pub values: Vec<NetlifyEnvValue>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetlifyEnvValue {
    pub value: String,
    pub context: String, // "all", "production", "deploy-preview", "branch-deploy", "dev"
}

// ========== VeilCloud Sync Types ==========

/// User account information from VeilCloud
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: String,
    pub email: String,
    pub name: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// Authentication tokens from VeilCloud
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthTokens {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_at: DateTime<Utc>,
}

/// Current sync status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum SyncState {
    Disconnected,   // Not logged in
    Idle,           // Connected, no pending changes
    Syncing,        // Currently syncing
    Error(String),  // Sync failed
    Conflict,       // Has unresolved conflicts
}

impl Default for SyncState {
    fn default() -> Self {
        Self::Disconnected
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncStatus {
    pub state: SyncState,
    pub last_sync: Option<DateTime<Utc>>,
    pub pending_changes: u32,
    pub user: Option<User>,
}

impl Default for SyncStatus {
    fn default() -> Self {
        Self {
            state: SyncState::Disconnected,
            last_sync: None,
            pending_changes: 0,
            user: None,
        }
    }
}

/// Sync event for history tracking
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncEvent {
    pub id: String,
    pub event_type: SyncEventType,
    pub project_id: Option<String>,
    pub environment_id: Option<String>,
    pub variable_key: Option<String>,
    pub details: Option<String>,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum SyncEventType {
    Push,
    Pull,
    Conflict,
    Resolved,
    Created,
    Updated,
    Deleted,
}

impl SyncEvent {
    pub fn new(
        event_type: SyncEventType,
        project_id: Option<String>,
        environment_id: Option<String>,
        variable_key: Option<String>,
        details: Option<String>,
    ) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            event_type,
            project_id,
            environment_id,
            variable_key,
            details,
            timestamp: Utc::now(),
        }
    }
}

/// Version info for a synced entity
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionInfo {
    pub version: u64,
    pub last_modified: DateTime<Utc>,
    pub modified_by: Option<String>,
    pub checksum: String,
}

/// Sync metadata attached to projects
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncMetadata {
    pub remote_id: Option<String>,       // VeilCloud storage ID
    pub local_version: u64,
    pub remote_version: Option<u64>,
    pub last_synced_at: Option<DateTime<Utc>>,
    pub is_dirty: bool,                  // Has local changes not pushed
    pub sync_enabled: bool,
}

impl Default for SyncMetadata {
    fn default() -> Self {
        Self {
            remote_id: None,
            local_version: 1,
            remote_version: None,
            last_synced_at: None,
            is_dirty: false,
            sync_enabled: true,
        }
    }
}

/// Project with sync metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncedProject {
    #[serde(flatten)]
    pub project: Project,
    pub sync: SyncMetadata,
}

/// Conflict information when local and remote diverge
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConflictInfo {
    pub project_id: String,
    pub environment_id: Option<String>,
    pub variable_key: Option<String>,
    pub local_value: String,
    pub remote_value: String,
    pub local_modified: DateTime<Utc>,
    pub remote_modified: DateTime<Utc>,
}

/// Resolution strategy for conflicts
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum ConflictResolution {
    KeepLocal,
    KeepRemote,
    KeepBoth,  // Creates a copy
    Merge,     // For variables, not typically used
}

/// Encrypted blob for VeilCloud storage
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptedBlob {
    pub ciphertext: String,  // Base64 encoded
    pub nonce: String,       // Base64 encoded
    pub version: u64,
}

/// VeilCloud storage entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageEntry {
    pub key: String,
    pub blob: EncryptedBlob,
    pub metadata: StorageMetadata,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageMetadata {
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub size_bytes: u64,
    pub checksum: String,
}
