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

// ========== Phase 3: Team Sharing & Collaboration ==========

/// Team role with different permission levels
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum TeamRole {
    Admin,   // Full access, can invite/revoke members
    Member,  // Can read/write secrets
    Viewer,  // Read-only access
}

impl TeamRole {
    pub fn as_str(&self) -> &str {
        match self {
            Self::Admin => "admin",
            Self::Member => "member",
            Self::Viewer => "viewer",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "admin" => Self::Admin,
            "member" => Self::Member,
            "viewer" => Self::Viewer,
            _ => Self::Viewer, // Default to lowest privilege
        }
    }

    pub fn can_write(&self) -> bool {
        matches!(self, Self::Admin | Self::Member)
    }

    pub fn can_admin(&self) -> bool {
        matches!(self, Self::Admin)
    }
}

/// Team for sharing secrets
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Team {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub owner_id: String,        // User ID who created the team
    pub threshold: u8,           // t in t-of-n threshold scheme
    pub total_shares: u8,        // n in t-of-n threshold scheme
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Team {
    pub fn new(name: String, description: Option<String>, owner_id: String, threshold: u8, total_shares: u8) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4().to_string(),
            name,
            description,
            owner_id,
            threshold,
            total_shares,
            created_at: now,
            updated_at: now,
        }
    }
}

/// Team member with their role
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TeamMember {
    pub id: String,
    pub team_id: String,
    pub user_id: String,
    pub email: String,
    pub name: Option<String>,
    pub role: TeamRole,
    pub share_index: Option<u8>,  // VeilKey share index if distributed
    pub joined_at: DateTime<Utc>,
    pub invited_by: String,       // User ID who invited this member
}

impl TeamMember {
    pub fn new(team_id: String, user_id: String, email: String, name: Option<String>, role: TeamRole, invited_by: String) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            team_id,
            user_id,
            email,
            name,
            role,
            share_index: None,
            joined_at: Utc::now(),
            invited_by,
        }
    }
}

/// Project-team assignment for sharing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectTeamAccess {
    pub id: String,
    pub project_id: String,
    pub team_id: String,
    pub granted_at: DateTime<Utc>,
    pub granted_by: String,  // User ID who granted access
}

impl ProjectTeamAccess {
    pub fn new(project_id: String, team_id: String, granted_by: String) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            project_id,
            team_id,
            granted_at: Utc::now(),
            granted_by,
        }
    }
}

/// Invite status for pending team invitations
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum InviteStatus {
    Pending,
    Accepted,
    Declined,
    Expired,
    Revoked,
}

impl InviteStatus {
    pub fn as_str(&self) -> &str {
        match self {
            Self::Pending => "pending",
            Self::Accepted => "accepted",
            Self::Declined => "declined",
            Self::Expired => "expired",
            Self::Revoked => "revoked",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "pending" => Self::Pending,
            "accepted" => Self::Accepted,
            "declined" => Self::Declined,
            "expired" => Self::Expired,
            "revoked" => Self::Revoked,
            _ => Self::Pending,
        }
    }
}

/// Team invitation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TeamInvite {
    pub id: String,
    pub team_id: String,
    pub email: String,
    pub role: TeamRole,
    pub status: InviteStatus,
    pub invited_by: String,
    pub token: String,           // Secret token for accepting invite
    pub expires_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}

impl TeamInvite {
    pub fn new(team_id: String, email: String, role: TeamRole, invited_by: String, expires_in_days: i64) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4().to_string(),
            team_id,
            email,
            role,
            status: InviteStatus::Pending,
            invited_by,
            token: Uuid::new_v4().to_string(), // Random token
            expires_at: now + chrono::Duration::days(expires_in_days),
            created_at: now,
        }
    }

    pub fn is_valid(&self) -> bool {
        self.status == InviteStatus::Pending && Utc::now() < self.expires_at
    }
}

// ========== VeilKey Threshold Cryptography ==========

/// Encrypted key share for threshold cryptography
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyShare {
    pub id: String,
    pub team_id: String,
    pub share_index: u8,
    pub encrypted_share: String,  // Base64 encoded, encrypted with user's key
    pub user_id: String,
    pub created_at: DateTime<Utc>,
}

impl KeyShare {
    pub fn new(team_id: String, share_index: u8, encrypted_share: String, user_id: String) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            team_id,
            share_index,
            encrypted_share,
            user_id,
            created_at: Utc::now(),
        }
    }
}

/// Key reconstruction request for threshold access
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyReconstructionRequest {
    pub id: String,
    pub team_id: String,
    pub project_id: String,
    pub requester_id: String,
    pub shares_collected: Vec<String>,  // Share indices collected
    pub status: KeyRequestStatus,
    pub created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum KeyRequestStatus {
    Pending,
    Approved,
    Denied,
    Expired,
    Completed,
}

// ========== VeilChain Audit Trail ==========

/// Types of auditable events
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum AuditEventType {
    // Secret operations
    SecretRead,
    SecretWrite,
    SecretDelete,
    SecretExport,
    SecretImport,
    // Team operations
    TeamCreated,
    TeamUpdated,
    TeamDeleted,
    // Member operations
    MemberInvited,
    MemberJoined,
    MemberRemoved,
    MemberRoleChanged,
    // Access operations
    ProjectShared,
    ProjectUnshared,
    AccessGranted,
    AccessRevoked,
    // Auth operations
    Login,
    Logout,
    SessionRestored,
    // Sync operations
    SyncPush,
    SyncPull,
    ConflictResolved,
    // Threshold operations
    KeyShareDistributed,
    KeyReconstructionRequested,
    KeyReconstructionApproved,
    KeyReconstructed,
}

impl AuditEventType {
    pub fn as_str(&self) -> &str {
        match self {
            Self::SecretRead => "secret.read",
            Self::SecretWrite => "secret.write",
            Self::SecretDelete => "secret.delete",
            Self::SecretExport => "secret.export",
            Self::SecretImport => "secret.import",
            Self::TeamCreated => "team.created",
            Self::TeamUpdated => "team.updated",
            Self::TeamDeleted => "team.deleted",
            Self::MemberInvited => "member.invited",
            Self::MemberJoined => "member.joined",
            Self::MemberRemoved => "member.removed",
            Self::MemberRoleChanged => "member.role_changed",
            Self::ProjectShared => "project.shared",
            Self::ProjectUnshared => "project.unshared",
            Self::AccessGranted => "access.granted",
            Self::AccessRevoked => "access.revoked",
            Self::Login => "auth.login",
            Self::Logout => "auth.logout",
            Self::SessionRestored => "auth.session_restored",
            Self::SyncPush => "sync.push",
            Self::SyncPull => "sync.pull",
            Self::ConflictResolved => "sync.conflict_resolved",
            Self::KeyShareDistributed => "key.share_distributed",
            Self::KeyReconstructionRequested => "key.reconstruction_requested",
            Self::KeyReconstructionApproved => "key.reconstruction_approved",
            Self::KeyReconstructed => "key.reconstructed",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "secret.read" => Self::SecretRead,
            "secret.write" => Self::SecretWrite,
            "secret.delete" => Self::SecretDelete,
            "secret.export" => Self::SecretExport,
            "secret.import" => Self::SecretImport,
            "team.created" => Self::TeamCreated,
            "team.updated" => Self::TeamUpdated,
            "team.deleted" => Self::TeamDeleted,
            "member.invited" => Self::MemberInvited,
            "member.joined" => Self::MemberJoined,
            "member.removed" => Self::MemberRemoved,
            "member.role_changed" => Self::MemberRoleChanged,
            "project.shared" => Self::ProjectShared,
            "project.unshared" => Self::ProjectUnshared,
            "access.granted" => Self::AccessGranted,
            "access.revoked" => Self::AccessRevoked,
            "auth.login" => Self::Login,
            "auth.logout" => Self::Logout,
            "auth.session_restored" => Self::SessionRestored,
            "sync.push" => Self::SyncPush,
            "sync.pull" => Self::SyncPull,
            "sync.conflict_resolved" => Self::ConflictResolved,
            "key.share_distributed" => Self::KeyShareDistributed,
            "key.reconstruction_requested" => Self::KeyReconstructionRequested,
            "key.reconstruction_approved" => Self::KeyReconstructionApproved,
            "key.reconstructed" => Self::KeyReconstructed,
            _ => Self::SecretRead, // Default
        }
    }
}

/// Immutable audit log entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEvent {
    pub id: String,
    pub event_type: AuditEventType,
    pub actor_id: String,           // User who performed the action
    pub actor_email: Option<String>,
    pub team_id: Option<String>,
    pub project_id: Option<String>,
    pub environment_id: Option<String>,
    pub variable_key: Option<String>,
    pub target_user_id: Option<String>,  // For member operations
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub details: Option<String>,         // JSON metadata
    pub previous_hash: Option<String>,   // For chain integrity
    pub hash: String,                    // SHA-256 of event data
    pub timestamp: DateTime<Utc>,
}

impl AuditEvent {
    pub fn new(
        event_type: AuditEventType,
        actor_id: String,
        actor_email: Option<String>,
    ) -> Self {
        let id = Uuid::new_v4().to_string();
        let timestamp = Utc::now();

        // Create preliminary event to calculate hash
        let hash_input = format!(
            "{}:{}:{}:{}",
            id,
            event_type.as_str(),
            actor_id,
            timestamp.to_rfc3339()
        );
        let hash = format!("{:x}", md5::compute(hash_input.as_bytes()));

        Self {
            id,
            event_type,
            actor_id,
            actor_email,
            team_id: None,
            project_id: None,
            environment_id: None,
            variable_key: None,
            target_user_id: None,
            ip_address: None,
            user_agent: None,
            details: None,
            previous_hash: None,
            hash,
            timestamp,
        }
    }

    pub fn with_team(mut self, team_id: String) -> Self {
        self.team_id = Some(team_id);
        self
    }

    pub fn with_project(mut self, project_id: String) -> Self {
        self.project_id = Some(project_id);
        self
    }

    pub fn with_environment(mut self, environment_id: String) -> Self {
        self.environment_id = Some(environment_id);
        self
    }

    pub fn with_variable(mut self, variable_key: String) -> Self {
        self.variable_key = Some(variable_key);
        self
    }

    pub fn with_target_user(mut self, user_id: String) -> Self {
        self.target_user_id = Some(user_id);
        self
    }

    pub fn with_details(mut self, details: String) -> Self {
        self.details = Some(details);
        self
    }

    pub fn with_previous_hash(mut self, previous_hash: String) -> Self {
        self.previous_hash = Some(previous_hash);
        self.recalculate_hash();
        self
    }

    fn recalculate_hash(&mut self) {
        let hash_input = format!(
            "{}:{}:{}:{}:{}",
            self.id,
            self.event_type.as_str(),
            self.actor_id,
            self.previous_hash.as_deref().unwrap_or("genesis"),
            self.timestamp.to_rfc3339()
        );
        self.hash = format!("{:x}", md5::compute(hash_input.as_bytes()));
    }
}

/// Audit log query filters
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AuditQuery {
    pub event_types: Option<Vec<AuditEventType>>,
    pub actor_id: Option<String>,
    pub team_id: Option<String>,
    pub project_id: Option<String>,
    pub from_date: Option<DateTime<Utc>>,
    pub to_date: Option<DateTime<Utc>>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

/// Team with members for display
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TeamWithMembers {
    #[serde(flatten)]
    pub team: Team,
    pub members: Vec<TeamMember>,
    pub pending_invites: Vec<TeamInvite>,
}
