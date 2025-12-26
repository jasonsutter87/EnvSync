use serde::Serialize;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum EnvSyncError {
    #[error("Database error: {0}")]
    Database(#[from] rusqlite::Error),

    #[error("Encryption error: {0}")]
    Encryption(String),

    #[error("Decryption error: {0}")]
    Decryption(String),

    #[error("Invalid password")]
    InvalidPassword,

    #[error("Vault is locked")]
    VaultLocked,

    #[error("Project not found: {0}")]
    ProjectNotFound(String),

    #[error("Environment not found: {0}")]
    EnvironmentNotFound(String),

    #[error("Variable not found: {0}")]
    VariableNotFound(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("HTTP error: {0}")]
    Http(String),

    #[error("Invalid configuration: {0}")]
    InvalidConfig(String),

    // VeilCloud sync errors
    #[error("Not authenticated: please log in")]
    NotAuthenticated,

    #[error("Authentication token expired: please log in again")]
    TokenExpired,

    #[error("Network error: {0}")]
    Network(String),

    #[error("API error: {0}")]
    Api(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Sync conflict: {0}")]
    SyncConflict(String),

    #[error("Sync error: {0}")]
    SyncError(String),

    // Phase 3: Team errors
    #[error("Team not found: {0}")]
    TeamNotFound(String),

    #[error("Team member not found: {0}")]
    MemberNotFound(String),

    #[error("Invite not found or expired: {0}")]
    InviteNotFound(String),

    #[error("Permission denied: {0}")]
    PermissionDenied(String),

    #[error("Invalid threshold parameters: {0}")]
    InvalidThreshold(String),

    #[error("Insufficient key shares: need {0}, have {1}")]
    InsufficientShares(u8, u8),

    #[error("Key reconstruction failed: {0}")]
    KeyReconstructionFailed(String),
}

// Convenience type alias for the full error type
pub type Error = EnvSyncError;

// Make the error serializable for Tauri
impl Serialize for EnvSyncError {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

pub type Result<T> = std::result::Result<T, EnvSyncError>;
