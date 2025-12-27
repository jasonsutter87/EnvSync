use chrono::{DateTime, Utc};
use rusqlite::{params, Connection, OptionalExtension};
use std::path::PathBuf;
use std::sync::Mutex;
use zeroize::Zeroize;

use crate::crypto::{decrypt, derive_key, encrypt, generate_salt, hash_password, verify_password, SecureKey};
use crate::error::{EnvSyncError, Result};
use crate::models::{
    AuditEvent, AuditEventType, AuditQuery, Environment, EnvironmentType, InviteStatus,
    KeyShare, Project, ProjectTeamAccess, SyncMetadata, Team, TeamInvite, TeamMember,
    TeamRole, TeamWithMembers, Variable, VaultStatus,
};

/// Auto-lock timeout in seconds (5 minutes)
const AUTO_LOCK_TIMEOUT_SECS: i64 = 300;

pub struct Database {
    conn: Mutex<Option<Connection>>,
    encryption_key: Mutex<Option<SecureKey>>,
    db_path: PathBuf,
    last_activity: Mutex<Option<DateTime<Utc>>>,
}

impl Database {
    pub fn new(db_path: PathBuf) -> Self {
        Self {
            conn: Mutex::new(None),
            encryption_key: Mutex::new(None),
            db_path,
            last_activity: Mutex::new(None),
        }
    }

    /// Update the last activity timestamp
    pub fn touch(&self) {
        *self.last_activity.lock().unwrap() = Some(Utc::now());
    }

    /// Check if the vault should auto-lock due to inactivity
    pub fn should_auto_lock(&self) -> bool {
        if !self.is_unlocked() {
            return false;
        }

        let last = self.last_activity.lock().unwrap();
        match *last {
            Some(time) => {
                let elapsed = Utc::now().signed_duration_since(time);
                elapsed.num_seconds() > AUTO_LOCK_TIMEOUT_SECS
            }
            None => false,
        }
    }

    /// Auto-lock if inactive
    pub fn auto_lock_if_inactive(&self) -> bool {
        if self.should_auto_lock() {
            self.lock();
            true
        } else {
            false
        }
    }

    /// Check if the vault has been initialized
    pub fn is_initialized(&self) -> bool {
        self.db_path.exists()
    }

    /// Check if the vault is currently unlocked
    pub fn is_unlocked(&self) -> bool {
        self.conn.lock().unwrap().is_some()
    }

    /// Get vault status
    pub fn get_status(&self) -> VaultStatus {
        VaultStatus {
            is_initialized: self.is_initialized(),
            is_unlocked: self.is_unlocked(),
            last_activity: *self.last_activity.lock().unwrap(),
        }
    }

    /// Initialize a new vault with a master password
    pub fn initialize(&self, master_password: &str) -> Result<()> {
        if self.is_initialized() {
            return Err(EnvSyncError::InvalidConfig(
                "Vault already initialized".to_string(),
            ));
        }

        // Create parent directory if it doesn't exist
        if let Some(parent) = self.db_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        // Generate salt and derive encryption key
        let salt = generate_salt();
        let key = derive_key(master_password, &salt)?;

        // Hash the password for verification
        let password_hash = hash_password(master_password)?;

        // Open encrypted database
        let conn = Connection::open(&self.db_path)?;

        // Set SQLCipher key - zeroize the hex string after use to prevent key leakage
        let mut key_hex: String = key.as_bytes().iter().map(|b| format!("{:02x}", b)).collect();
        let result = conn.execute_batch(&format!("PRAGMA key = \"x'{}'\"", key_hex));
        key_hex.zeroize(); // Clear the key from memory immediately
        result.map_err(|_| EnvSyncError::Encryption("Failed to set database encryption key".to_string()))?;

        // Create tables
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS metadata (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS environments (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                name TEXT NOT NULL,
                env_type TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS variables (
                id TEXT PRIMARY KEY,
                environment_id TEXT NOT NULL,
                key TEXT NOT NULL,
                value TEXT NOT NULL,
                is_secret INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (environment_id) REFERENCES environments(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_environments_project ON environments(project_id);
            CREATE INDEX IF NOT EXISTS idx_variables_environment ON variables(environment_id);
            CREATE UNIQUE INDEX IF NOT EXISTS idx_variables_key ON variables(environment_id, key);

            -- Sync metadata table for cloud sync
            CREATE TABLE IF NOT EXISTS sync_metadata (
                project_id TEXT PRIMARY KEY,
                remote_id TEXT,
                local_version INTEGER NOT NULL DEFAULT 1,
                remote_version INTEGER,
                last_synced_at TEXT,
                is_dirty INTEGER NOT NULL DEFAULT 0,
                sync_enabled INTEGER NOT NULL DEFAULT 1,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            );

            -- Sync history/events table
            CREATE TABLE IF NOT EXISTS sync_events (
                id TEXT PRIMARY KEY,
                event_type TEXT NOT NULL,
                project_id TEXT,
                environment_id TEXT,
                variable_key TEXT,
                details TEXT,
                timestamp TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_sync_events_timestamp ON sync_events(timestamp DESC);
            CREATE INDEX IF NOT EXISTS idx_sync_events_project ON sync_events(project_id);

            -- Phase 3: Teams table
            CREATE TABLE IF NOT EXISTS teams (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                owner_id TEXT NOT NULL,
                threshold INTEGER NOT NULL DEFAULT 2,
                total_shares INTEGER NOT NULL DEFAULT 3,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            -- Phase 3: Team members table
            CREATE TABLE IF NOT EXISTS team_members (
                id TEXT PRIMARY KEY,
                team_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                email TEXT NOT NULL,
                name TEXT,
                role TEXT NOT NULL DEFAULT 'viewer',
                share_index INTEGER,
                joined_at TEXT NOT NULL,
                invited_by TEXT NOT NULL,
                FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
                UNIQUE(team_id, user_id)
            );

            CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
            CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);

            -- Phase 3: Team invitations table
            CREATE TABLE IF NOT EXISTS team_invites (
                id TEXT PRIMARY KEY,
                team_id TEXT NOT NULL,
                email TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'viewer',
                status TEXT NOT NULL DEFAULT 'pending',
                invited_by TEXT NOT NULL,
                token TEXT NOT NULL UNIQUE,
                expires_at TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_team_invites_team ON team_invites(team_id);
            CREATE INDEX IF NOT EXISTS idx_team_invites_email ON team_invites(email);
            CREATE INDEX IF NOT EXISTS idx_team_invites_token ON team_invites(token);

            -- Phase 3: Project team access table
            CREATE TABLE IF NOT EXISTS project_team_access (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                team_id TEXT NOT NULL,
                granted_at TEXT NOT NULL,
                granted_by TEXT NOT NULL,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
                FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
                UNIQUE(project_id, team_id)
            );

            CREATE INDEX IF NOT EXISTS idx_project_team_access_project ON project_team_access(project_id);
            CREATE INDEX IF NOT EXISTS idx_project_team_access_team ON project_team_access(team_id);

            -- Phase 3: VeilKey key shares table
            CREATE TABLE IF NOT EXISTS key_shares (
                id TEXT PRIMARY KEY,
                team_id TEXT NOT NULL,
                share_index INTEGER NOT NULL,
                encrypted_share TEXT NOT NULL,
                user_id TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
                UNIQUE(team_id, share_index)
            );

            CREATE INDEX IF NOT EXISTS idx_key_shares_team ON key_shares(team_id);
            CREATE INDEX IF NOT EXISTS idx_key_shares_user ON key_shares(user_id);

            -- Phase 3: VeilChain audit log table
            CREATE TABLE IF NOT EXISTS audit_log (
                id TEXT PRIMARY KEY,
                event_type TEXT NOT NULL,
                actor_id TEXT NOT NULL,
                actor_email TEXT,
                team_id TEXT,
                project_id TEXT,
                environment_id TEXT,
                variable_key TEXT,
                target_user_id TEXT,
                ip_address TEXT,
                user_agent TEXT,
                details TEXT,
                previous_hash TEXT,
                hash TEXT NOT NULL,
                timestamp TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp DESC);
            CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor_id);
            CREATE INDEX IF NOT EXISTS idx_audit_log_team ON audit_log(team_id);
            CREATE INDEX IF NOT EXISTS idx_audit_log_project ON audit_log(project_id);
            CREATE INDEX IF NOT EXISTS idx_audit_log_event_type ON audit_log(event_type);

            -- Phase 5: Variable history table
            CREATE TABLE IF NOT EXISTS variable_history (
                id TEXT PRIMARY KEY,
                variable_id TEXT NOT NULL,
                environment_id TEXT NOT NULL,
                project_id TEXT NOT NULL,
                variable_key TEXT NOT NULL,
                old_value TEXT,
                new_value TEXT,
                changed_by TEXT NOT NULL,
                changed_by_id TEXT NOT NULL,
                change_type TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                ip_address TEXT,
                user_agent TEXT,
                FOREIGN KEY (environment_id) REFERENCES environments(id) ON DELETE CASCADE,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_variable_history_timestamp ON variable_history(timestamp DESC);
            CREATE INDEX IF NOT EXISTS idx_variable_history_variable ON variable_history(variable_id);
            CREATE INDEX IF NOT EXISTS idx_variable_history_environment ON variable_history(environment_id);
            CREATE INDEX IF NOT EXISTS idx_variable_history_project ON variable_history(project_id);
            CREATE INDEX IF NOT EXISTS idx_variable_history_changed_by ON variable_history(changed_by_id);
            CREATE INDEX IF NOT EXISTS idx_variable_history_variable_key ON variable_history(variable_key);
            ",
        )?;

        // Store metadata in database
        let salt_b64 = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &salt);
        conn.execute(
            "INSERT INTO metadata (key, value) VALUES ('salt', ?1), ('password_hash', ?2)",
            params![salt_b64, password_hash],
        )?;

        // Also write salt to external file for unlock to work
        // (SQLCipher needs the key before we can read the DB)
        let salt_path = self.db_path.with_extension("salt");
        std::fs::write(&salt_path, &salt_b64)?;

        // Store connection and key
        *self.conn.lock().unwrap() = Some(conn);
        *self.encryption_key.lock().unwrap() = Some(key);

        Ok(())
    }

    /// Unlock the vault with the master password
    pub fn unlock(&self, master_password: &str) -> Result<()> {
        if !self.is_initialized() {
            return Err(EnvSyncError::InvalidConfig("Vault not initialized".to_string()));
        }

        if self.is_unlocked() {
            return Ok(()); // Already unlocked
        }

        // Open the database to read metadata
        let temp_conn = Connection::open(&self.db_path)?;

        // Try to derive key and verify - we need to try all possible keys
        // First, read salt from metadata (need to guess the key first)
        // This is a chicken-and-egg problem - we'll use a fixed key for metadata access

        // Actually, with SQLCipher, we need to try the password directly
        // Let's derive a key from password with a known salt stored alongside the db

        // Read salt from a separate unencrypted file
        let salt_path = self.db_path.with_extension("salt");
        if !salt_path.exists() {
            // Legacy: salt might be inside the DB (requires unlocking first)
            // For new DBs, we store salt externally
            return Err(EnvSyncError::InvalidConfig(
                "Salt file not found. Database may be corrupted.".to_string(),
            ));
        }

        let salt_b64 = std::fs::read_to_string(&salt_path)?;
        let salt = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, salt_b64.trim())
            .map_err(|e| EnvSyncError::InvalidConfig(format!("Invalid salt: {}", e)))?;

        let key = derive_key(master_password, &salt)?;

        // Try to open with the derived key - zeroize hex string after use
        let mut key_hex: String = key.as_bytes().iter().map(|b| format!("{:02x}", b)).collect();
        let result = temp_conn.execute_batch(&format!("PRAGMA key = \"x'{}'\"", key_hex));
        key_hex.zeroize(); // Clear the key from memory immediately
        result.map_err(|_| EnvSyncError::InvalidPassword)?;

        // Verify by trying to read from the database
        temp_conn
            .query_row("SELECT count(*) FROM metadata", [], |_| Ok(()))
            .map_err(|_| EnvSyncError::InvalidPassword)?;

        // Verify password hash
        let stored_hash: String = temp_conn.query_row(
            "SELECT value FROM metadata WHERE key = 'password_hash'",
            [],
            |row| row.get(0),
        )?;

        if !verify_password(master_password, &stored_hash)? {
            return Err(EnvSyncError::InvalidPassword);
        }

        *self.conn.lock().unwrap() = Some(temp_conn);
        *self.encryption_key.lock().unwrap() = Some(key);
        self.touch(); // Start activity tracking

        Ok(())
    }

    /// Lock the vault
    pub fn lock(&self) {
        *self.conn.lock().unwrap() = None;
        *self.encryption_key.lock().unwrap() = None;
        *self.last_activity.lock().unwrap() = None;
    }

    /// Get a reference to the connection, returns error if vault is locked
    fn get_conn(&self) -> Result<std::sync::MutexGuard<'_, Option<Connection>>> {
        let guard = self.conn.lock().unwrap();
        if guard.is_none() {
            return Err(EnvSyncError::VaultLocked);
        }
        self.touch(); // Update activity on each DB access
        Ok(guard)
    }

    /// Get the encryption key, returns error if vault is locked.
    /// Returns a copy of the key bytes for encryption/decryption operations.
    fn get_key(&self) -> Result<[u8; 32]> {
        let guard = self.encryption_key.lock().unwrap();
        match guard.as_ref() {
            Some(key) => Ok(*key.as_bytes()),
            None => Err(EnvSyncError::VaultLocked),
        }
    }

    // ========== Project Operations ==========

    pub fn create_project(&self, name: &str, description: Option<&str>) -> Result<Project> {
        let project = Project::new(name.to_string(), description.map(String::from));
        let guard = self.get_conn()?;
        let conn = guard.as_ref().unwrap();

        conn.execute(
            "INSERT INTO projects (id, name, description, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                project.id,
                project.name,
                project.description,
                project.created_at.to_rfc3339(),
                project.updated_at.to_rfc3339()
            ],
        )?;

        // Create default environments
        self.create_environment_internal(conn, &project.id, "Development", EnvironmentType::Development)?;
        self.create_environment_internal(conn, &project.id, "Staging", EnvironmentType::Staging)?;
        self.create_environment_internal(conn, &project.id, "Production", EnvironmentType::Production)?;

        Ok(project)
    }

    pub fn get_projects(&self) -> Result<Vec<Project>> {
        let guard = self.get_conn()?;
        let conn = guard.as_ref().unwrap();

        let mut stmt = conn.prepare(
            "SELECT id, name, description, created_at, updated_at FROM projects ORDER BY name",
        )?;

        let projects = stmt
            .query_map([], |row| {
                Ok(Project {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    description: row.get(2)?,
                    created_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(3)?)
                        .unwrap()
                        .with_timezone(&chrono::Utc),
                    updated_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(4)?)
                        .unwrap()
                        .with_timezone(&chrono::Utc),
                })
            })?
            .collect::<std::result::Result<Vec<_>, _>>()?;

        Ok(projects)
    }

    pub fn get_project(&self, id: &str) -> Result<Project> {
        let guard = self.get_conn()?;
        let conn = guard.as_ref().unwrap();

        conn.query_row(
            "SELECT id, name, description, created_at, updated_at FROM projects WHERE id = ?1",
            params![id],
            |row| {
                Ok(Project {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    description: row.get(2)?,
                    created_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(3)?)
                        .unwrap()
                        .with_timezone(&chrono::Utc),
                    updated_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(4)?)
                        .unwrap()
                        .with_timezone(&chrono::Utc),
                })
            },
        )
        .optional()?
        .ok_or_else(|| EnvSyncError::ProjectNotFound(id.to_string()))
    }

    pub fn update_project(&self, id: &str, name: &str, description: Option<&str>) -> Result<Project> {
        let guard = self.get_conn()?;
        let conn = guard.as_ref().unwrap();
        let now = chrono::Utc::now();

        conn.execute(
            "UPDATE projects SET name = ?1, description = ?2, updated_at = ?3 WHERE id = ?4",
            params![name, description, now.to_rfc3339(), id],
        )?;

        self.get_project(id)
    }

    pub fn delete_project(&self, id: &str) -> Result<()> {
        let guard = self.get_conn()?;
        let conn = guard.as_ref().unwrap();

        conn.execute("DELETE FROM projects WHERE id = ?1", params![id])?;
        Ok(())
    }

    // ========== Environment Operations ==========

    fn create_environment_internal(
        &self,
        conn: &Connection,
        project_id: &str,
        name: &str,
        env_type: EnvironmentType,
    ) -> Result<Environment> {
        let env = Environment::new(project_id.to_string(), name.to_string(), env_type);

        conn.execute(
            "INSERT INTO environments (id, project_id, name, env_type, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                env.id,
                env.project_id,
                env.name,
                env.env_type.as_str(),
                env.created_at.to_rfc3339(),
                env.updated_at.to_rfc3339()
            ],
        )?;

        Ok(env)
    }

    pub fn create_environment(
        &self,
        project_id: &str,
        name: &str,
        env_type: EnvironmentType,
    ) -> Result<Environment> {
        let guard = self.get_conn()?;
        let conn = guard.as_ref().unwrap();
        self.create_environment_internal(conn, project_id, name, env_type)
    }

    pub fn get_environments(&self, project_id: &str) -> Result<Vec<Environment>> {
        let guard = self.get_conn()?;
        let conn = guard.as_ref().unwrap();

        let mut stmt = conn.prepare(
            "SELECT id, project_id, name, env_type, created_at, updated_at FROM environments WHERE project_id = ?1 ORDER BY
             CASE env_type
                WHEN 'development' THEN 1
                WHEN 'staging' THEN 2
                WHEN 'production' THEN 3
                ELSE 4
             END",
        )?;

        let envs = stmt
            .query_map(params![project_id], |row| {
                Ok(Environment {
                    id: row.get(0)?,
                    project_id: row.get(1)?,
                    name: row.get(2)?,
                    env_type: EnvironmentType::from_str(&row.get::<_, String>(3)?),
                    created_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(4)?)
                        .unwrap()
                        .with_timezone(&chrono::Utc),
                    updated_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(5)?)
                        .unwrap()
                        .with_timezone(&chrono::Utc),
                })
            })?
            .collect::<std::result::Result<Vec<_>, _>>()?;

        Ok(envs)
    }

    pub fn get_environment(&self, id: &str) -> Result<Environment> {
        let guard = self.get_conn()?;
        let conn = guard.as_ref().unwrap();

        conn.query_row(
            "SELECT id, project_id, name, env_type, created_at, updated_at FROM environments WHERE id = ?1",
            params![id],
            |row| {
                Ok(Environment {
                    id: row.get(0)?,
                    project_id: row.get(1)?,
                    name: row.get(2)?,
                    env_type: EnvironmentType::from_str(&row.get::<_, String>(3)?),
                    created_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(4)?)
                        .unwrap()
                        .with_timezone(&chrono::Utc),
                    updated_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(5)?)
                        .unwrap()
                        .with_timezone(&chrono::Utc),
                })
            },
        )
        .optional()?
        .ok_or_else(|| EnvSyncError::EnvironmentNotFound(id.to_string()))
    }

    pub fn delete_environment(&self, id: &str) -> Result<()> {
        let guard = self.get_conn()?;
        let conn = guard.as_ref().unwrap();

        conn.execute("DELETE FROM environments WHERE id = ?1", params![id])?;
        Ok(())
    }

    // ========== Variable Operations ==========

    pub fn create_variable(
        &self,
        environment_id: &str,
        key: &str,
        value: &str,
        is_secret: bool,
    ) -> Result<Variable> {
        let encryption_key = self.get_key()?;
        let encrypted_value = encrypt(value, &encryption_key)?;

        let var = Variable::new(
            environment_id.to_string(),
            key.to_string(),
            value.to_string(), // In-memory value is plaintext
            is_secret,
        );

        let guard = self.get_conn()?;
        let conn = guard.as_ref().unwrap();

        conn.execute(
            "INSERT INTO variables (id, environment_id, key, value, is_secret, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                var.id,
                var.environment_id,
                var.key,
                encrypted_value, // Store encrypted
                var.is_secret as i32,
                var.created_at.to_rfc3339(),
                var.updated_at.to_rfc3339()
            ],
        )?;

        Ok(var)
    }

    pub fn get_variables(&self, environment_id: &str) -> Result<Vec<Variable>> {
        let encryption_key = self.get_key()?;
        let guard = self.get_conn()?;
        let conn = guard.as_ref().unwrap();

        let mut stmt = conn.prepare(
            "SELECT id, environment_id, key, value, is_secret, created_at, updated_at FROM variables WHERE environment_id = ?1 ORDER BY key",
        )?;

        let vars = stmt
            .query_map(params![environment_id], |row| {
                let encrypted_value: String = row.get(3)?;
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    encrypted_value,
                    row.get::<_, i32>(4)? != 0,
                    row.get::<_, String>(5)?,
                    row.get::<_, String>(6)?,
                ))
            })?
            .collect::<std::result::Result<Vec<_>, _>>()?;

        let mut result = Vec::new();
        for (id, env_id, key, encrypted_value, is_secret, created_at, updated_at) in vars {
            let value = decrypt(&encrypted_value, &encryption_key)?;
            result.push(Variable {
                id,
                environment_id: env_id,
                key,
                value,
                is_secret,
                created_at: chrono::DateTime::parse_from_rfc3339(&created_at)
                    .unwrap()
                    .with_timezone(&chrono::Utc),
                updated_at: chrono::DateTime::parse_from_rfc3339(&updated_at)
                    .unwrap()
                    .with_timezone(&chrono::Utc),
            });
        }

        Ok(result)
    }

    pub fn get_variable(&self, id: &str) -> Result<Variable> {
        let encryption_key = self.get_key()?;
        let guard = self.get_conn()?;
        let conn = guard.as_ref().unwrap();

        let (id, env_id, key, encrypted_value, is_secret, created_at, updated_at): (
            String,
            String,
            String,
            String,
            i32,
            String,
            String,
        ) = conn
            .query_row(
                "SELECT id, environment_id, key, value, is_secret, created_at, updated_at FROM variables WHERE id = ?1",
                params![id],
                |row| {
                    Ok((
                        row.get(0)?,
                        row.get(1)?,
                        row.get(2)?,
                        row.get(3)?,
                        row.get(4)?,
                        row.get(5)?,
                        row.get(6)?,
                    ))
                },
            )
            .optional()?
            .ok_or_else(|| EnvSyncError::VariableNotFound(id.to_string()))?;

        let value = decrypt(&encrypted_value, &encryption_key)?;

        Ok(Variable {
            id,
            environment_id: env_id,
            key,
            value,
            is_secret: is_secret != 0,
            created_at: chrono::DateTime::parse_from_rfc3339(&created_at)
                .unwrap()
                .with_timezone(&chrono::Utc),
            updated_at: chrono::DateTime::parse_from_rfc3339(&updated_at)
                .unwrap()
                .with_timezone(&chrono::Utc),
        })
    }

    pub fn update_variable(&self, id: &str, key: &str, value: &str, is_secret: bool) -> Result<Variable> {
        let encryption_key = self.get_key()?;
        let encrypted_value = encrypt(value, &encryption_key)?;
        let now = chrono::Utc::now();

        let guard = self.get_conn()?;
        let conn = guard.as_ref().unwrap();

        conn.execute(
            "UPDATE variables SET key = ?1, value = ?2, is_secret = ?3, updated_at = ?4 WHERE id = ?5",
            params![key, encrypted_value, is_secret as i32, now.to_rfc3339(), id],
        )?;

        drop(guard); // Release the lock before calling get_variable
        self.get_variable(id)
    }

    pub fn delete_variable(&self, id: &str) -> Result<()> {
        let guard = self.get_conn()?;
        let conn = guard.as_ref().unwrap();

        conn.execute("DELETE FROM variables WHERE id = ?1", params![id])?;
        Ok(())
    }

    // ========== Search ==========

    pub fn search_variables(&self, query: &str) -> Result<Vec<(Project, Environment, Variable)>> {
        let encryption_key = self.get_key()?;
        let guard = self.get_conn()?;
        let conn = guard.as_ref().unwrap();

        let search_pattern = format!("%{}%", query);

        let mut stmt = conn.prepare(
            "SELECT
                p.id, p.name, p.description, p.created_at, p.updated_at,
                e.id, e.project_id, e.name, e.env_type, e.created_at, e.updated_at,
                v.id, v.environment_id, v.key, v.value, v.is_secret, v.created_at, v.updated_at
             FROM variables v
             JOIN environments e ON v.environment_id = e.id
             JOIN projects p ON e.project_id = p.id
             WHERE v.key LIKE ?1
             ORDER BY p.name, e.name, v.key",
        )?;

        let rows = stmt
            .query_map(params![search_pattern], |row| {
                Ok((
                    // Project fields
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, Option<String>>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, String>(4)?,
                    // Environment fields
                    row.get::<_, String>(5)?,
                    row.get::<_, String>(6)?,
                    row.get::<_, String>(7)?,
                    row.get::<_, String>(8)?,
                    row.get::<_, String>(9)?,
                    row.get::<_, String>(10)?,
                    // Variable fields
                    row.get::<_, String>(11)?,
                    row.get::<_, String>(12)?,
                    row.get::<_, String>(13)?,
                    row.get::<_, String>(14)?,
                    row.get::<_, i32>(15)?,
                    row.get::<_, String>(16)?,
                    row.get::<_, String>(17)?,
                ))
            })?
            .collect::<std::result::Result<Vec<_>, _>>()?;

        let mut result = Vec::new();
        for row in rows {
            let project = Project {
                id: row.0,
                name: row.1,
                description: row.2,
                created_at: chrono::DateTime::parse_from_rfc3339(&row.3)
                    .unwrap()
                    .with_timezone(&chrono::Utc),
                updated_at: chrono::DateTime::parse_from_rfc3339(&row.4)
                    .unwrap()
                    .with_timezone(&chrono::Utc),
            };

            let environment = Environment {
                id: row.5,
                project_id: row.6,
                name: row.7,
                env_type: EnvironmentType::from_str(&row.8),
                created_at: chrono::DateTime::parse_from_rfc3339(&row.9)
                    .unwrap()
                    .with_timezone(&chrono::Utc),
                updated_at: chrono::DateTime::parse_from_rfc3339(&row.10)
                    .unwrap()
                    .with_timezone(&chrono::Utc),
            };

            let value = decrypt(&row.14, &encryption_key)?;
            let variable = Variable {
                id: row.11,
                environment_id: row.12,
                key: row.13,
                value,
                is_secret: row.15 != 0,
                created_at: chrono::DateTime::parse_from_rfc3339(&row.16)
                    .unwrap()
                    .with_timezone(&chrono::Utc),
                updated_at: chrono::DateTime::parse_from_rfc3339(&row.17)
                    .unwrap()
                    .with_timezone(&chrono::Utc),
            };

            result.push((project, environment, variable));
        }

        Ok(result)
    }

    // ========== Sync Metadata Operations ==========

    /// Get the sync encryption key (same as vault key)
    pub fn get_sync_key(&self) -> Result<[u8; 32]> {
        self.get_key()
    }

    /// Get sync metadata for a project
    pub fn get_sync_metadata(&self, project_id: &str) -> Result<SyncMetadata> {
        let guard = self.get_conn()?;
        let conn = guard.as_ref().unwrap();

        conn.query_row(
            "SELECT remote_id, local_version, remote_version, last_synced_at, is_dirty, sync_enabled
             FROM sync_metadata WHERE project_id = ?1",
            params![project_id],
            |row| {
                Ok(SyncMetadata {
                    remote_id: row.get(0)?,
                    local_version: row.get::<_, i64>(1)? as u64,
                    remote_version: row.get::<_, Option<i64>>(2)?.map(|v| v as u64),
                    last_synced_at: row.get::<_, Option<String>>(3)?
                        .and_then(|s| chrono::DateTime::parse_from_rfc3339(&s).ok())
                        .map(|dt| dt.with_timezone(&chrono::Utc)),
                    is_dirty: row.get::<_, i32>(4)? != 0,
                    sync_enabled: row.get::<_, i32>(5)? != 0,
                })
            },
        )
        .optional()?
        .ok_or_else(|| {
            // Return default metadata if not found
            Ok::<SyncMetadata, EnvSyncError>(SyncMetadata::default())
        })
        .unwrap_or_else(|_| SyncMetadata::default())
        .pipe(Ok)
    }

    /// Update sync metadata for a project
    pub fn update_sync_metadata(
        &self,
        project_id: &str,
        remote_id: Option<&str>,
        local_version: u64,
        remote_version: Option<u64>,
        is_dirty: bool,
    ) -> Result<()> {
        let guard = self.get_conn()?;
        let conn = guard.as_ref().unwrap();
        let now = chrono::Utc::now();

        conn.execute(
            "INSERT INTO sync_metadata (project_id, remote_id, local_version, remote_version, last_synced_at, is_dirty, sync_enabled)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1)
             ON CONFLICT(project_id) DO UPDATE SET
                remote_id = excluded.remote_id,
                local_version = excluded.local_version,
                remote_version = excluded.remote_version,
                last_synced_at = excluded.last_synced_at,
                is_dirty = excluded.is_dirty",
            params![
                project_id,
                remote_id,
                local_version as i64,
                remote_version.map(|v| v as i64),
                now.to_rfc3339(),
                is_dirty as i32
            ],
        )?;

        Ok(())
    }

    /// Mark a project as dirty (has local changes)
    pub fn mark_project_dirty(&self, project_id: &str) -> Result<()> {
        let guard = self.get_conn()?;
        let conn = guard.as_ref().unwrap();

        // First check if sync_metadata exists for this project
        let exists: bool = conn.query_row(
            "SELECT COUNT(*) > 0 FROM sync_metadata WHERE project_id = ?1",
            params![project_id],
            |row| row.get(0),
        )?;

        if exists {
            conn.execute(
                "UPDATE sync_metadata SET is_dirty = 1, local_version = local_version + 1 WHERE project_id = ?1",
                params![project_id],
            )?;
        } else {
            conn.execute(
                "INSERT INTO sync_metadata (project_id, is_dirty, local_version, sync_enabled) VALUES (?1, 1, 1, 1)",
                params![project_id],
            )?;
        }

        Ok(())
    }

    /// Get all projects that need syncing
    pub fn get_dirty_projects(&self) -> Result<Vec<String>> {
        let guard = self.get_conn()?;
        let conn = guard.as_ref().unwrap();

        let mut stmt = conn.prepare(
            "SELECT project_id FROM sync_metadata WHERE is_dirty = 1 AND sync_enabled = 1",
        )?;

        let ids = stmt
            .query_map([], |row| row.get(0))?
            .collect::<std::result::Result<Vec<String>, _>>()?;

        Ok(ids)
    }

    /// Enable or disable sync for a project
    pub fn set_sync_enabled(&self, project_id: &str, enabled: bool) -> Result<()> {
        let guard = self.get_conn()?;
        let conn = guard.as_ref().unwrap();

        conn.execute(
            "INSERT INTO sync_metadata (project_id, sync_enabled, local_version, is_dirty)
             VALUES (?1, ?2, 1, 0)
             ON CONFLICT(project_id) DO UPDATE SET sync_enabled = excluded.sync_enabled",
            params![project_id, enabled as i32],
        )?;

        Ok(())
    }

    // ========== Phase 3: Team Operations ==========

    pub fn create_team(&self, team: &Team) -> Result<Team> {
        let guard = self.get_conn()?;
        let conn = guard.as_ref().unwrap();

        conn.execute(
            "INSERT INTO teams (id, name, description, owner_id, threshold, total_shares, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                team.id,
                team.name,
                team.description,
                team.owner_id,
                team.threshold as i32,
                team.total_shares as i32,
                team.created_at.to_rfc3339(),
                team.updated_at.to_rfc3339()
            ],
        )?;

        Ok(team.clone())
    }

    pub fn get_team(&self, id: &str) -> Result<Team> {
        let guard = self.get_conn()?;
        let conn = guard.as_ref().unwrap();

        conn.query_row(
            "SELECT id, name, description, owner_id, threshold, total_shares, created_at, updated_at
             FROM teams WHERE id = ?1",
            params![id],
            |row| {
                Ok(Team {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    description: row.get(2)?,
                    owner_id: row.get(3)?,
                    threshold: row.get::<_, i32>(4)? as u8,
                    total_shares: row.get::<_, i32>(5)? as u8,
                    created_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(6)?)
                        .unwrap()
                        .with_timezone(&chrono::Utc),
                    updated_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(7)?)
                        .unwrap()
                        .with_timezone(&chrono::Utc),
                })
            },
        )
        .optional()?
        .ok_or_else(|| EnvSyncError::TeamNotFound(id.to_string()))
    }

    pub fn get_teams_for_user(&self, user_id: &str) -> Result<Vec<Team>> {
        let guard = self.get_conn()?;
        let conn = guard.as_ref().unwrap();

        let mut stmt = conn.prepare(
            "SELECT DISTINCT t.id, t.name, t.description, t.owner_id, t.threshold, t.total_shares, t.created_at, t.updated_at
             FROM teams t
             LEFT JOIN team_members tm ON t.id = tm.team_id
             WHERE t.owner_id = ?1 OR tm.user_id = ?1
             ORDER BY t.name",
        )?;

        let teams = stmt
            .query_map(params![user_id], |row| {
                Ok(Team {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    description: row.get(2)?,
                    owner_id: row.get(3)?,
                    threshold: row.get::<_, i32>(4)? as u8,
                    total_shares: row.get::<_, i32>(5)? as u8,
                    created_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(6)?)
                        .unwrap()
                        .with_timezone(&chrono::Utc),
                    updated_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(7)?)
                        .unwrap()
                        .with_timezone(&chrono::Utc),
                })
            })?
            .collect::<std::result::Result<Vec<_>, _>>()?;

        Ok(teams)
    }

    pub fn update_team(&self, id: &str, name: &str, description: Option<&str>) -> Result<Team> {
        let guard = self.get_conn()?;
        let conn = guard.as_ref().unwrap();
        let now = chrono::Utc::now();

        conn.execute(
            "UPDATE teams SET name = ?1, description = ?2, updated_at = ?3 WHERE id = ?4",
            params![name, description, now.to_rfc3339(), id],
        )?;

        drop(guard);
        self.get_team(id)
    }

    pub fn delete_team(&self, id: &str) -> Result<()> {
        let guard = self.get_conn()?;
        let conn = guard.as_ref().unwrap();

        conn.execute("DELETE FROM teams WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn get_team_with_members(&self, team_id: &str) -> Result<TeamWithMembers> {
        let team = self.get_team(team_id)?;
        let members = self.get_team_members(team_id)?;
        let pending_invites = self.get_team_pending_invites(team_id)?;

        Ok(TeamWithMembers {
            team,
            members,
            pending_invites,
        })
    }

    // ========== Team Member Operations ==========

    pub fn add_team_member(&self, member: &TeamMember) -> Result<TeamMember> {
        let guard = self.get_conn()?;
        let conn = guard.as_ref().unwrap();

        conn.execute(
            "INSERT INTO team_members (id, team_id, user_id, email, name, role, share_index, joined_at, invited_by)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                member.id,
                member.team_id,
                member.user_id,
                member.email,
                member.name,
                member.role.as_str(),
                member.share_index.map(|i| i as i32),
                member.joined_at.to_rfc3339(),
                member.invited_by
            ],
        )?;

        Ok(member.clone())
    }

    pub fn get_team_members(&self, team_id: &str) -> Result<Vec<TeamMember>> {
        let guard = self.get_conn()?;
        let conn = guard.as_ref().unwrap();

        let mut stmt = conn.prepare(
            "SELECT id, team_id, user_id, email, name, role, share_index, joined_at, invited_by
             FROM team_members WHERE team_id = ?1 ORDER BY joined_at",
        )?;

        let members = stmt
            .query_map(params![team_id], |row| {
                Ok(TeamMember {
                    id: row.get(0)?,
                    team_id: row.get(1)?,
                    user_id: row.get(2)?,
                    email: row.get(3)?,
                    name: row.get(4)?,
                    role: TeamRole::from_str(&row.get::<_, String>(5)?),
                    share_index: row.get::<_, Option<i32>>(6)?.map(|i| i as u8),
                    joined_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(7)?)
                        .unwrap()
                        .with_timezone(&chrono::Utc),
                    invited_by: row.get(8)?,
                })
            })?
            .collect::<std::result::Result<Vec<_>, _>>()?;

        Ok(members)
    }

    pub fn get_team_member(&self, team_id: &str, user_id: &str) -> Result<Option<TeamMember>> {
        let guard = self.get_conn()?;
        let conn = guard.as_ref().unwrap();

        conn.query_row(
            "SELECT id, team_id, user_id, email, name, role, share_index, joined_at, invited_by
             FROM team_members WHERE team_id = ?1 AND user_id = ?2",
            params![team_id, user_id],
            |row| {
                Ok(TeamMember {
                    id: row.get(0)?,
                    team_id: row.get(1)?,
                    user_id: row.get(2)?,
                    email: row.get(3)?,
                    name: row.get(4)?,
                    role: TeamRole::from_str(&row.get::<_, String>(5)?),
                    share_index: row.get::<_, Option<i32>>(6)?.map(|i| i as u8),
                    joined_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(7)?)
                        .unwrap()
                        .with_timezone(&chrono::Utc),
                    invited_by: row.get(8)?,
                })
            },
        )
        .optional()
        .map_err(EnvSyncError::from)
    }

    pub fn update_member_role(&self, team_id: &str, user_id: &str, role: TeamRole) -> Result<()> {
        let guard = self.get_conn()?;
        let conn = guard.as_ref().unwrap();

        conn.execute(
            "UPDATE team_members SET role = ?1 WHERE team_id = ?2 AND user_id = ?3",
            params![role.as_str(), team_id, user_id],
        )?;

        Ok(())
    }

    pub fn remove_team_member(&self, team_id: &str, user_id: &str) -> Result<()> {
        let guard = self.get_conn()?;
        let conn = guard.as_ref().unwrap();

        conn.execute(
            "DELETE FROM team_members WHERE team_id = ?1 AND user_id = ?2",
            params![team_id, user_id],
        )?;

        Ok(())
    }

    pub fn update_member_share_index(&self, team_id: &str, user_id: &str, share_index: u8) -> Result<()> {
        let guard = self.get_conn()?;
        let conn = guard.as_ref().unwrap();

        conn.execute(
            "UPDATE team_members SET share_index = ?1 WHERE team_id = ?2 AND user_id = ?3",
            params![share_index as i32, team_id, user_id],
        )?;

        Ok(())
    }

    // ========== Team Invite Operations ==========

    pub fn create_invite(&self, invite: &TeamInvite) -> Result<TeamInvite> {
        let guard = self.get_conn()?;
        let conn = guard.as_ref().unwrap();

        conn.execute(
            "INSERT INTO team_invites (id, team_id, email, role, status, invited_by, token, expires_at, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                invite.id,
                invite.team_id,
                invite.email,
                invite.role.as_str(),
                invite.status.as_str(),
                invite.invited_by,
                invite.token,
                invite.expires_at.to_rfc3339(),
                invite.created_at.to_rfc3339()
            ],
        )?;

        Ok(invite.clone())
    }

    pub fn get_invite_by_token(&self, token: &str) -> Result<Option<TeamInvite>> {
        let guard = self.get_conn()?;
        let conn = guard.as_ref().unwrap();

        conn.query_row(
            "SELECT id, team_id, email, role, status, invited_by, token, expires_at, created_at
             FROM team_invites WHERE token = ?1",
            params![token],
            |row| {
                Ok(TeamInvite {
                    id: row.get(0)?,
                    team_id: row.get(1)?,
                    email: row.get(2)?,
                    role: TeamRole::from_str(&row.get::<_, String>(3)?),
                    status: InviteStatus::from_str(&row.get::<_, String>(4)?),
                    invited_by: row.get(5)?,
                    token: row.get(6)?,
                    expires_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(7)?)
                        .unwrap()
                        .with_timezone(&chrono::Utc),
                    created_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(8)?)
                        .unwrap()
                        .with_timezone(&chrono::Utc),
                })
            },
        )
        .optional()
        .map_err(EnvSyncError::from)
    }

    pub fn get_team_pending_invites(&self, team_id: &str) -> Result<Vec<TeamInvite>> {
        let guard = self.get_conn()?;
        let conn = guard.as_ref().unwrap();

        let mut stmt = conn.prepare(
            "SELECT id, team_id, email, role, status, invited_by, token, expires_at, created_at
             FROM team_invites WHERE team_id = ?1 AND status = 'pending' ORDER BY created_at DESC",
        )?;

        let invites = stmt
            .query_map(params![team_id], |row| {
                Ok(TeamInvite {
                    id: row.get(0)?,
                    team_id: row.get(1)?,
                    email: row.get(2)?,
                    role: TeamRole::from_str(&row.get::<_, String>(3)?),
                    status: InviteStatus::from_str(&row.get::<_, String>(4)?),
                    invited_by: row.get(5)?,
                    token: row.get(6)?,
                    expires_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(7)?)
                        .unwrap()
                        .with_timezone(&chrono::Utc),
                    created_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(8)?)
                        .unwrap()
                        .with_timezone(&chrono::Utc),
                })
            })?
            .collect::<std::result::Result<Vec<_>, _>>()?;

        Ok(invites)
    }

    pub fn update_invite_status(&self, id: &str, status: InviteStatus) -> Result<()> {
        let guard = self.get_conn()?;
        let conn = guard.as_ref().unwrap();

        conn.execute(
            "UPDATE team_invites SET status = ?1 WHERE id = ?2",
            params![status.as_str(), id],
        )?;

        Ok(())
    }

    pub fn revoke_invite(&self, id: &str) -> Result<()> {
        self.update_invite_status(id, InviteStatus::Revoked)
    }

    // ========== Project Team Access Operations ==========

    pub fn share_project_with_team(&self, access: &ProjectTeamAccess) -> Result<ProjectTeamAccess> {
        let guard = self.get_conn()?;
        let conn = guard.as_ref().unwrap();

        conn.execute(
            "INSERT INTO project_team_access (id, project_id, team_id, granted_at, granted_by)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                access.id,
                access.project_id,
                access.team_id,
                access.granted_at.to_rfc3339(),
                access.granted_by
            ],
        )?;

        Ok(access.clone())
    }

    pub fn unshare_project_from_team(&self, project_id: &str, team_id: &str) -> Result<()> {
        let guard = self.get_conn()?;
        let conn = guard.as_ref().unwrap();

        conn.execute(
            "DELETE FROM project_team_access WHERE project_id = ?1 AND team_id = ?2",
            params![project_id, team_id],
        )?;

        Ok(())
    }

    pub fn get_project_teams(&self, project_id: &str) -> Result<Vec<Team>> {
        let guard = self.get_conn()?;
        let conn = guard.as_ref().unwrap();

        let mut stmt = conn.prepare(
            "SELECT t.id, t.name, t.description, t.owner_id, t.threshold, t.total_shares, t.created_at, t.updated_at
             FROM teams t
             INNER JOIN project_team_access pta ON t.id = pta.team_id
             WHERE pta.project_id = ?1
             ORDER BY t.name",
        )?;

        let teams = stmt
            .query_map(params![project_id], |row| {
                Ok(Team {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    description: row.get(2)?,
                    owner_id: row.get(3)?,
                    threshold: row.get::<_, i32>(4)? as u8,
                    total_shares: row.get::<_, i32>(5)? as u8,
                    created_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(6)?)
                        .unwrap()
                        .with_timezone(&chrono::Utc),
                    updated_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(7)?)
                        .unwrap()
                        .with_timezone(&chrono::Utc),
                })
            })?
            .collect::<std::result::Result<Vec<_>, _>>()?;

        Ok(teams)
    }

    pub fn get_team_projects(&self, team_id: &str) -> Result<Vec<Project>> {
        let guard = self.get_conn()?;
        let conn = guard.as_ref().unwrap();

        let mut stmt = conn.prepare(
            "SELECT p.id, p.name, p.description, p.created_at, p.updated_at
             FROM projects p
             INNER JOIN project_team_access pta ON p.id = pta.project_id
             WHERE pta.team_id = ?1
             ORDER BY p.name",
        )?;

        let projects = stmt
            .query_map(params![team_id], |row| {
                Ok(Project {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    description: row.get(2)?,
                    created_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(3)?)
                        .unwrap()
                        .with_timezone(&chrono::Utc),
                    updated_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(4)?)
                        .unwrap()
                        .with_timezone(&chrono::Utc),
                })
            })?
            .collect::<std::result::Result<Vec<_>, _>>()?;

        Ok(projects)
    }

    pub fn user_can_access_project(&self, user_id: &str, project_id: &str) -> Result<Option<TeamRole>> {
        let guard = self.get_conn()?;
        let conn = guard.as_ref().unwrap();

        // Check if user is owner or member of any team with access to this project
        let role: Option<String> = conn.query_row(
            "SELECT tm.role
             FROM team_members tm
             INNER JOIN project_team_access pta ON tm.team_id = pta.team_id
             WHERE tm.user_id = ?1 AND pta.project_id = ?2
             UNION
             SELECT 'admin' as role
             FROM teams t
             INNER JOIN project_team_access pta ON t.id = pta.team_id
             WHERE t.owner_id = ?1 AND pta.project_id = ?2
             ORDER BY CASE role WHEN 'admin' THEN 1 WHEN 'member' THEN 2 ELSE 3 END
             LIMIT 1",
            params![user_id, project_id],
            |row| row.get(0),
        ).optional()?;

        Ok(role.map(|r| TeamRole::from_str(&r)))
    }

    // ========== VeilKey Key Share Operations ==========

    pub fn store_key_share(&self, share: &KeyShare) -> Result<KeyShare> {
        let guard = self.get_conn()?;
        let conn = guard.as_ref().unwrap();

        conn.execute(
            "INSERT INTO key_shares (id, team_id, share_index, encrypted_share, user_id, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)
             ON CONFLICT(team_id, share_index) DO UPDATE SET
                encrypted_share = excluded.encrypted_share,
                user_id = excluded.user_id",
            params![
                share.id,
                share.team_id,
                share.share_index as i32,
                share.encrypted_share,
                share.user_id,
                share.created_at.to_rfc3339()
            ],
        )?;

        Ok(share.clone())
    }

    pub fn get_team_key_shares(&self, team_id: &str) -> Result<Vec<KeyShare>> {
        let guard = self.get_conn()?;
        let conn = guard.as_ref().unwrap();

        let mut stmt = conn.prepare(
            "SELECT id, team_id, share_index, encrypted_share, user_id, created_at
             FROM key_shares WHERE team_id = ?1 ORDER BY share_index",
        )?;

        let shares = stmt
            .query_map(params![team_id], |row| {
                Ok(KeyShare {
                    id: row.get(0)?,
                    team_id: row.get(1)?,
                    share_index: row.get::<_, i32>(2)? as u8,
                    encrypted_share: row.get(3)?,
                    user_id: row.get(4)?,
                    created_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(5)?)
                        .unwrap()
                        .with_timezone(&chrono::Utc),
                })
            })?
            .collect::<std::result::Result<Vec<_>, _>>()?;

        Ok(shares)
    }

    pub fn get_user_key_share(&self, team_id: &str, user_id: &str) -> Result<Option<KeyShare>> {
        let guard = self.get_conn()?;
        let conn = guard.as_ref().unwrap();

        conn.query_row(
            "SELECT id, team_id, share_index, encrypted_share, user_id, created_at
             FROM key_shares WHERE team_id = ?1 AND user_id = ?2",
            params![team_id, user_id],
            |row| {
                Ok(KeyShare {
                    id: row.get(0)?,
                    team_id: row.get(1)?,
                    share_index: row.get::<_, i32>(2)? as u8,
                    encrypted_share: row.get(3)?,
                    user_id: row.get(4)?,
                    created_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(5)?)
                        .unwrap()
                        .with_timezone(&chrono::Utc),
                })
            },
        )
        .optional()
        .map_err(EnvSyncError::from)
    }

    // ========== VeilChain Audit Log Operations ==========

    pub fn log_audit_event(&self, event: &AuditEvent) -> Result<()> {
        let guard = self.get_conn()?;
        let conn = guard.as_ref().unwrap();

        conn.execute(
            "INSERT INTO audit_log (id, event_type, actor_id, actor_email, team_id, project_id,
             environment_id, variable_key, target_user_id, ip_address, user_agent, details,
             previous_hash, hash, timestamp)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
            params![
                event.id,
                event.event_type.as_str(),
                event.actor_id,
                event.actor_email,
                event.team_id,
                event.project_id,
                event.environment_id,
                event.variable_key,
                event.target_user_id,
                event.ip_address,
                event.user_agent,
                event.details,
                event.previous_hash,
                event.hash,
                event.timestamp.to_rfc3339()
            ],
        )?;

        Ok(())
    }

    pub fn get_latest_audit_hash(&self) -> Result<Option<String>> {
        let guard = self.get_conn()?;
        let conn = guard.as_ref().unwrap();

        conn.query_row(
            "SELECT hash FROM audit_log ORDER BY timestamp DESC LIMIT 1",
            [],
            |row| row.get(0),
        )
        .optional()
        .map_err(EnvSyncError::from)
    }

    pub fn query_audit_log(&self, query: &AuditQuery) -> Result<Vec<AuditEvent>> {
        let guard = self.get_conn()?;
        let conn = guard.as_ref().unwrap();

        let mut sql = String::from(
            "SELECT id, event_type, actor_id, actor_email, team_id, project_id,
             environment_id, variable_key, target_user_id, ip_address, user_agent,
             details, previous_hash, hash, timestamp
             FROM audit_log WHERE 1=1"
        );

        let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        if let Some(ref actor_id) = query.actor_id {
            sql.push_str(" AND actor_id = ?");
            params_vec.push(Box::new(actor_id.clone()));
        }

        if let Some(ref team_id) = query.team_id {
            sql.push_str(" AND team_id = ?");
            params_vec.push(Box::new(team_id.clone()));
        }

        if let Some(ref project_id) = query.project_id {
            sql.push_str(" AND project_id = ?");
            params_vec.push(Box::new(project_id.clone()));
        }

        if let Some(ref from_date) = query.from_date {
            sql.push_str(" AND timestamp >= ?");
            params_vec.push(Box::new(from_date.to_rfc3339()));
        }

        if let Some(ref to_date) = query.to_date {
            sql.push_str(" AND timestamp <= ?");
            params_vec.push(Box::new(to_date.to_rfc3339()));
        }

        sql.push_str(" ORDER BY timestamp DESC");

        // Use parameterized queries to prevent SQL injection
        if query.limit.is_some() {
            sql.push_str(" LIMIT ?");
            params_vec.push(Box::new(query.limit.unwrap() as i64));
        }

        if query.offset.is_some() {
            sql.push_str(" OFFSET ?");
            params_vec.push(Box::new(query.offset.unwrap() as i64));
        }

        let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|b| b.as_ref()).collect();

        let mut stmt = conn.prepare(&sql)?;

        let events = stmt
            .query_map(params_refs.as_slice(), |row| {
                Ok(AuditEvent {
                    id: row.get(0)?,
                    event_type: AuditEventType::from_str(&row.get::<_, String>(1)?),
                    actor_id: row.get(2)?,
                    actor_email: row.get(3)?,
                    team_id: row.get(4)?,
                    project_id: row.get(5)?,
                    environment_id: row.get(6)?,
                    variable_key: row.get(7)?,
                    target_user_id: row.get(8)?,
                    ip_address: row.get(9)?,
                    user_agent: row.get(10)?,
                    details: row.get(11)?,
                    previous_hash: row.get(12)?,
                    hash: row.get(13)?,
                    timestamp: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(14)?)
                        .unwrap()
                        .with_timezone(&chrono::Utc),
                })
            })?
            .collect::<std::result::Result<Vec<_>, _>>()?;

        Ok(events)
    }

    pub fn get_project_audit_log(&self, project_id: &str, limit: Option<u32>) -> Result<Vec<AuditEvent>> {
        self.query_audit_log(&AuditQuery {
            project_id: Some(project_id.to_string()),
            limit,
            ..Default::default()
        })
    }

    pub fn get_team_audit_log(&self, team_id: &str, limit: Option<u32>) -> Result<Vec<AuditEvent>> {
        self.query_audit_log(&AuditQuery {
            team_id: Some(team_id.to_string()),
            limit,
            ..Default::default()
        })
    }

    // ========== Phase 5: Variable History Operations ==========

    /// Save a variable history entry
    pub fn save_variable_history(
        &self,
        variable_id: &str,
        environment_id: &str,
        project_id: &str,
        variable_key: &str,
        old_value: Option<&str>,
        new_value: Option<&str>,
        changed_by: &str,
        changed_by_id: &str,
        change_type: &str,
        ip_address: Option<&str>,
        user_agent: Option<&str>,
    ) -> Result<String> {
        let guard = self.get_conn()?;
        let conn = guard.as_ref().unwrap();

        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now();

        conn.execute(
            "INSERT INTO variable_history (
                id, variable_id, environment_id, project_id, variable_key,
                old_value, new_value, changed_by, changed_by_id, change_type,
                timestamp, ip_address, user_agent
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
            params![
                id,
                variable_id,
                environment_id,
                project_id,
                variable_key,
                old_value,
                new_value,
                changed_by,
                changed_by_id,
                change_type,
                now.to_rfc3339(),
                ip_address,
                user_agent
            ],
        )?;

        Ok(id)
    }

    /// Get variable history with filtering and pagination
    pub fn get_variable_history(
        &self,
        project_id: Option<&str>,
        environment_id: Option<&str>,
        variable_key: Option<&str>,
        changed_by: Option<&str>,
        from_date: Option<&str>,
        to_date: Option<&str>,
        limit: Option<u32>,
        offset: Option<u32>,
    ) -> Result<(Vec<VariableHistoryEntry>, u32)> {
        let guard = self.get_conn()?;
        let conn = guard.as_ref().unwrap();

        // Build the WHERE clause
        let mut where_clauses = Vec::new();
        let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        if let Some(pid) = project_id {
            where_clauses.push("project_id = ?");
            params_vec.push(Box::new(pid.to_string()));
        }

        if let Some(eid) = environment_id {
            where_clauses.push("environment_id = ?");
            params_vec.push(Box::new(eid.to_string()));
        }

        if let Some(key) = variable_key {
            where_clauses.push("variable_key = ?");
            params_vec.push(Box::new(key.to_string()));
        }

        if let Some(user) = changed_by {
            where_clauses.push("changed_by = ?");
            params_vec.push(Box::new(user.to_string()));
        }

        if let Some(from) = from_date {
            where_clauses.push("timestamp >= ?");
            params_vec.push(Box::new(from.to_string()));
        }

        if let Some(to) = to_date {
            where_clauses.push("timestamp <= ?");
            params_vec.push(Box::new(to.to_string()));
        }

        let where_clause = if where_clauses.is_empty() {
            String::new()
        } else {
            format!("WHERE {}", where_clauses.join(" AND "))
        };

        // Get total count
        let count_sql = format!(
            "SELECT COUNT(*) FROM variable_history {}",
            where_clause
        );

        let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|b| b.as_ref()).collect();
        let total_count: u32 = conn.query_row(&count_sql, params_refs.as_slice(), |row| row.get(0))?;

        // Get paginated results
        let mut sql = format!(
            "SELECT id, variable_id, environment_id, project_id, variable_key,
                    old_value, new_value, changed_by, changed_by_id, change_type,
                    timestamp, ip_address, user_agent
             FROM variable_history
             {}
             ORDER BY timestamp DESC",
            where_clause
        );

        // Use parameterized queries to prevent SQL injection
        if limit.is_some() {
            sql.push_str(" LIMIT ?");
            params_vec.push(Box::new(limit.unwrap() as i64));
        }

        if offset.is_some() {
            sql.push_str(" OFFSET ?");
            params_vec.push(Box::new(offset.unwrap() as i64));
        }

        // Rebuild params_refs after adding limit/offset
        let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|b| b.as_ref()).collect();

        let mut stmt = conn.prepare(&sql)?;

        let entries = stmt
            .query_map(params_refs.as_slice(), |row| {
                Ok(VariableHistoryEntry {
                    id: row.get(0)?,
                    variable_id: row.get(1)?,
                    environment_id: row.get(2)?,
                    project_id: row.get(3)?,
                    variable_key: row.get(4)?,
                    old_value: row.get(5)?,
                    new_value: row.get(6)?,
                    changed_by: row.get(7)?,
                    changed_by_id: row.get(8)?,
                    change_type: row.get(9)?,
                    timestamp: row.get(10)?,
                    ip_address: row.get(11)?,
                    user_agent: row.get(12)?,
                })
            })?
            .collect::<std::result::Result<Vec<_>, _>>()?;

        Ok((entries, total_count))
    }

    /// Get history for a specific variable
    pub fn get_variable_history_by_id(&self, variable_id: &str, limit: Option<u32>) -> Result<Vec<VariableHistoryEntry>> {
        let guard = self.get_conn()?;
        let conn = guard.as_ref().unwrap();

        let mut sql = String::from(
            "SELECT id, variable_id, environment_id, project_id, variable_key,
                    old_value, new_value, changed_by, changed_by_id, change_type,
                    timestamp, ip_address, user_agent
             FROM variable_history
             WHERE variable_id = ?1
             ORDER BY timestamp DESC"
        );

        // Use parameterized query to prevent SQL injection
        if let Some(lim) = limit {
            sql.push_str(" LIMIT ?2");
            let mut stmt = conn.prepare(&sql)?;
            let entries = stmt.query_map(params![variable_id, lim as i64], |row| {
                Ok(VariableHistoryEntry {
                    id: row.get(0)?,
                    variable_id: row.get(1)?,
                    environment_id: row.get(2)?,
                    project_id: row.get(3)?,
                    variable_key: row.get(4)?,
                    old_value: row.get(5)?,
                    new_value: row.get(6)?,
                    changed_by: row.get(7)?,
                    changed_by_id: row.get(8)?,
                    change_type: row.get(9)?,
                    timestamp: row.get(10)?,
                    ip_address: row.get(11)?,
                    user_agent: row.get(12)?,
                })
            })?
            .collect::<std::result::Result<Vec<_>, _>>()?;
            Ok(entries)
        } else {
            let mut stmt = conn.prepare(&sql)?;
            let entries = stmt.query_map(params![variable_id], |row| {
                Ok(VariableHistoryEntry {
                    id: row.get(0)?,
                    variable_id: row.get(1)?,
                    environment_id: row.get(2)?,
                    project_id: row.get(3)?,
                    variable_key: row.get(4)?,
                    old_value: row.get(5)?,
                    new_value: row.get(6)?,
                    changed_by: row.get(7)?,
                    changed_by_id: row.get(8)?,
                    change_type: row.get(9)?,
                    timestamp: row.get(10)?,
                    ip_address: row.get(11)?,
                    user_agent: row.get(12)?,
                })
            })?
            .collect::<std::result::Result<Vec<_>, _>>()?;
            Ok(entries)
        }
    }

    /// Get a specific history entry by ID
    pub fn get_history_entry(&self, id: &str) -> Result<Option<VariableHistoryEntry>> {
        let guard = self.get_conn()?;
        let conn = guard.as_ref().unwrap();

        conn.query_row(
            "SELECT id, variable_id, environment_id, project_id, variable_key,
                    old_value, new_value, changed_by, changed_by_id, change_type,
                    timestamp, ip_address, user_agent
             FROM variable_history
             WHERE id = ?1",
            params![id],
            |row| {
                Ok(VariableHistoryEntry {
                    id: row.get(0)?,
                    variable_id: row.get(1)?,
                    environment_id: row.get(2)?,
                    project_id: row.get(3)?,
                    variable_key: row.get(4)?,
                    old_value: row.get(5)?,
                    new_value: row.get(6)?,
                    changed_by: row.get(7)?,
                    changed_by_id: row.get(8)?,
                    change_type: row.get(9)?,
                    timestamp: row.get(10)?,
                    ip_address: row.get(11)?,
                    user_agent: row.get(12)?,
                })
            },
        )
        .optional()
        .map_err(EnvSyncError::from)
    }
}

// ========== Phase 5: Variable History Model ==========

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct VariableHistoryEntry {
    pub id: String,
    pub variable_id: String,
    pub environment_id: String,
    pub project_id: String,
    pub variable_key: String,
    pub old_value: Option<String>,
    pub new_value: Option<String>,
    pub changed_by: String,
    pub changed_by_id: String,
    pub change_type: String,
    pub timestamp: String,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
}

// Helper trait for pipe syntax
trait Pipe: Sized {
    fn pipe<F, R>(self, f: F) -> R
    where
        F: FnOnce(Self) -> R,
    {
        f(self)
    }
}

impl Pipe for SyncMetadata {}
