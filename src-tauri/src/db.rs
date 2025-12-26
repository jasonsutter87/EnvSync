use chrono::{DateTime, Utc};
use rusqlite::{params, Connection, OptionalExtension};
use std::path::PathBuf;
use std::sync::Mutex;

use crate::crypto::{decrypt, derive_key, encrypt, generate_salt, hash_password, verify_password};
use crate::error::{EnvSyncError, Result};
use crate::models::{Environment, EnvironmentType, Project, Variable, VaultStatus};

/// Auto-lock timeout in seconds (5 minutes)
const AUTO_LOCK_TIMEOUT_SECS: i64 = 300;

pub struct Database {
    conn: Mutex<Option<Connection>>,
    encryption_key: Mutex<Option<[u8; 32]>>,
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

        // Set SQLCipher key
        let key_hex: String = key.iter().map(|b| format!("{:02x}", b)).collect();
        conn.execute_batch(&format!("PRAGMA key = \"x'{}'\"", key_hex))?;

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

        // Try to open with the derived key
        let key_hex: String = key.iter().map(|b| format!("{:02x}", b)).collect();
        temp_conn.execute_batch(&format!("PRAGMA key = \"x'{}'\"", key_hex))?;

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

    /// Get the encryption key, returns error if vault is locked
    fn get_key(&self) -> Result<[u8; 32]> {
        let guard = self.encryption_key.lock().unwrap();
        guard.ok_or(EnvSyncError::VaultLocked)
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
}
