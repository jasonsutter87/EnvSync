use chrono::{DateTime, Duration, Utc};
use app_lib::models::*;

// ========== Project Tests ==========

#[test]
fn test_project_new_creates_valid_project() {
    let project = Project::new("My Project".to_string(), None);

    assert!(!project.id.is_empty());
    assert_eq!(project.name, "My Project");
    assert!(project.description.is_none());
    assert!(project.created_at <= Utc::now());
    assert_eq!(project.created_at, project.updated_at);
}

#[test]
fn test_project_new_with_description() {
    let description = Some("A test project".to_string());
    let project = Project::new("Test".to_string(), description.clone());

    assert_eq!(project.description, description);
}

#[test]
fn test_project_new_generates_unique_ids() {
    let project1 = Project::new("Project 1".to_string(), None);
    let project2 = Project::new("Project 2".to_string(), None);

    assert_ne!(project1.id, project2.id);
}

#[test]
fn test_project_serialization() {
    let project = Project::new("Serialization Test".to_string(), Some("Description".to_string()));

    let json = serde_json::to_string(&project).expect("Failed to serialize");
    let deserialized: Project = serde_json::from_str(&json).expect("Failed to deserialize");

    assert_eq!(project.id, deserialized.id);
    assert_eq!(project.name, deserialized.name);
    assert_eq!(project.description, deserialized.description);
}

// ========== Environment Tests ==========

#[test]
fn test_environment_new_with_development_type() {
    let env = Environment::new(
        "project-123".to_string(),
        "Development".to_string(),
        EnvironmentType::Development,
    );

    assert!(!env.id.is_empty());
    assert_eq!(env.project_id, "project-123");
    assert_eq!(env.name, "Development");
    assert_eq!(env.env_type, EnvironmentType::Development);
}

#[test]
fn test_environment_new_with_staging_type() {
    let env = Environment::new(
        "project-456".to_string(),
        "Staging".to_string(),
        EnvironmentType::Staging,
    );

    assert_eq!(env.env_type, EnvironmentType::Staging);
}

#[test]
fn test_environment_new_with_production_type() {
    let env = Environment::new(
        "project-789".to_string(),
        "Production".to_string(),
        EnvironmentType::Production,
    );

    assert_eq!(env.env_type, EnvironmentType::Production);
}

#[test]
fn test_environment_new_with_custom_type() {
    let env = Environment::new(
        "project-abc".to_string(),
        "Testing".to_string(),
        EnvironmentType::Custom("testing".to_string()),
    );

    assert_eq!(env.env_type, EnvironmentType::Custom("testing".to_string()));
}

#[test]
fn test_environment_generates_unique_ids() {
    let env1 = Environment::new("proj-1".to_string(), "Dev".to_string(), EnvironmentType::Development);
    let env2 = Environment::new("proj-1".to_string(), "Staging".to_string(), EnvironmentType::Staging);

    assert_ne!(env1.id, env2.id);
}

#[test]
fn test_environment_serialization() {
    let env = Environment::new(
        "project-123".to_string(),
        "Staging".to_string(),
        EnvironmentType::Staging,
    );

    let json = serde_json::to_string(&env).expect("Failed to serialize");
    let deserialized: Environment = serde_json::from_str(&json).expect("Failed to deserialize");

    assert_eq!(env.id, deserialized.id);
    assert_eq!(env.env_type, deserialized.env_type);
}

// ========== EnvironmentType Tests ==========

#[test]
fn test_environment_type_as_str_development() {
    assert_eq!(EnvironmentType::Development.as_str(), "development");
}

#[test]
fn test_environment_type_as_str_staging() {
    assert_eq!(EnvironmentType::Staging.as_str(), "staging");
}

#[test]
fn test_environment_type_as_str_production() {
    assert_eq!(EnvironmentType::Production.as_str(), "production");
}

#[test]
fn test_environment_type_as_str_custom() {
    let custom = EnvironmentType::Custom("qa".to_string());
    assert_eq!(custom.as_str(), "qa");
}

#[test]
fn test_environment_type_from_str_development() {
    assert_eq!(EnvironmentType::from_str("development"), EnvironmentType::Development);
    assert_eq!(EnvironmentType::from_str("Development"), EnvironmentType::Development);
    assert_eq!(EnvironmentType::from_str("dev"), EnvironmentType::Development);
    assert_eq!(EnvironmentType::from_str("DEV"), EnvironmentType::Development);
}

#[test]
fn test_environment_type_from_str_staging() {
    assert_eq!(EnvironmentType::from_str("staging"), EnvironmentType::Staging);
    assert_eq!(EnvironmentType::from_str("Staging"), EnvironmentType::Staging);
    assert_eq!(EnvironmentType::from_str("STAGING"), EnvironmentType::Staging);
}

#[test]
fn test_environment_type_from_str_production() {
    assert_eq!(EnvironmentType::from_str("production"), EnvironmentType::Production);
    assert_eq!(EnvironmentType::from_str("Production"), EnvironmentType::Production);
    assert_eq!(EnvironmentType::from_str("prod"), EnvironmentType::Production);
    assert_eq!(EnvironmentType::from_str("PROD"), EnvironmentType::Production);
}

#[test]
fn test_environment_type_from_str_custom() {
    assert_eq!(
        EnvironmentType::from_str("qa"),
        EnvironmentType::Custom("qa".to_string())
    );
    assert_eq!(
        EnvironmentType::from_str("Testing"),
        EnvironmentType::Custom("testing".to_string())
    );
}

// ========== Variable Tests ==========

#[test]
fn test_variable_new_with_secret() {
    let var = Variable::new(
        "env-123".to_string(),
        "API_KEY".to_string(),
        "secret-value".to_string(),
        true,
    );

    assert!(!var.id.is_empty());
    assert_eq!(var.environment_id, "env-123");
    assert_eq!(var.key, "API_KEY");
    assert_eq!(var.value, "secret-value");
    assert!(var.is_secret);
}

#[test]
fn test_variable_new_with_non_secret() {
    let var = Variable::new(
        "env-456".to_string(),
        "APP_NAME".to_string(),
        "MyApp".to_string(),
        false,
    );

    assert_eq!(var.key, "APP_NAME");
    assert_eq!(var.value, "MyApp");
    assert!(!var.is_secret);
}

#[test]
fn test_variable_generates_unique_ids() {
    let var1 = Variable::new("env-1".to_string(), "KEY1".to_string(), "val1".to_string(), false);
    let var2 = Variable::new("env-1".to_string(), "KEY2".to_string(), "val2".to_string(), false);

    assert_ne!(var1.id, var2.id);
}

#[test]
fn test_variable_serialization() {
    let var = Variable::new(
        "env-789".to_string(),
        "DB_PASSWORD".to_string(),
        "supersecret".to_string(),
        true,
    );

    let json = serde_json::to_string(&var).expect("Failed to serialize");
    let deserialized: Variable = serde_json::from_str(&json).expect("Failed to deserialize");

    assert_eq!(var.id, deserialized.id);
    assert_eq!(var.key, deserialized.key);
    assert_eq!(var.is_secret, deserialized.is_secret);
}

// ========== TeamRole Tests ==========

#[test]
fn test_team_role_as_str() {
    assert_eq!(TeamRole::Admin.as_str(), "admin");
    assert_eq!(TeamRole::Member.as_str(), "member");
    assert_eq!(TeamRole::Viewer.as_str(), "viewer");
}

#[test]
fn test_team_role_from_str() {
    assert_eq!(TeamRole::from_str("admin"), TeamRole::Admin);
    assert_eq!(TeamRole::from_str("Admin"), TeamRole::Admin);
    assert_eq!(TeamRole::from_str("ADMIN"), TeamRole::Admin);

    assert_eq!(TeamRole::from_str("member"), TeamRole::Member);
    assert_eq!(TeamRole::from_str("Member"), TeamRole::Member);

    assert_eq!(TeamRole::from_str("viewer"), TeamRole::Viewer);
    assert_eq!(TeamRole::from_str("Viewer"), TeamRole::Viewer);
}

#[test]
fn test_team_role_from_str_invalid_defaults_to_viewer() {
    assert_eq!(TeamRole::from_str("unknown"), TeamRole::Viewer);
    assert_eq!(TeamRole::from_str(""), TeamRole::Viewer);
    assert_eq!(TeamRole::from_str("owner"), TeamRole::Viewer);
}

#[test]
fn test_team_role_can_write_admin() {
    assert!(TeamRole::Admin.can_write());
}

#[test]
fn test_team_role_can_write_member() {
    assert!(TeamRole::Member.can_write());
}

#[test]
fn test_team_role_can_write_viewer() {
    assert!(!TeamRole::Viewer.can_write());
}

#[test]
fn test_team_role_can_admin_admin() {
    assert!(TeamRole::Admin.can_admin());
}

#[test]
fn test_team_role_can_admin_member() {
    assert!(!TeamRole::Member.can_admin());
}

#[test]
fn test_team_role_can_admin_viewer() {
    assert!(!TeamRole::Viewer.can_admin());
}

// ========== SyncState Tests ==========

#[test]
fn test_sync_state_default() {
    let state: SyncState = Default::default();
    assert_eq!(state, SyncState::Disconnected);
}

#[test]
fn test_sync_state_variants() {
    let states = vec![
        SyncState::Disconnected,
        SyncState::Idle,
        SyncState::Syncing,
        SyncState::Error("test error".to_string()),
        SyncState::Conflict,
    ];

    for state in states {
        let json = serde_json::to_string(&state).expect("Failed to serialize");
        let _: SyncState = serde_json::from_str(&json).expect("Failed to deserialize");
    }
}

#[test]
fn test_sync_state_equality() {
    assert_eq!(SyncState::Disconnected, SyncState::Disconnected);
    assert_eq!(SyncState::Idle, SyncState::Idle);
    assert_ne!(SyncState::Idle, SyncState::Disconnected);
}

#[test]
fn test_sync_state_error_with_message() {
    let state = SyncState::Error("Connection failed".to_string());
    match state {
        SyncState::Error(msg) => assert_eq!(msg, "Connection failed"),
        _ => panic!("Expected Error variant"),
    }
}

// ========== SyncMetadata Tests ==========

#[test]
fn test_sync_metadata_default() {
    let metadata: SyncMetadata = Default::default();

    assert!(metadata.remote_id.is_none());
    assert_eq!(metadata.local_version, 1);
    assert!(metadata.remote_version.is_none());
    assert!(metadata.last_synced_at.is_none());
    assert!(!metadata.is_dirty);
    assert!(metadata.sync_enabled);
}

#[test]
fn test_sync_metadata_serialization() {
    let metadata = SyncMetadata {
        remote_id: Some("remote-123".to_string()),
        local_version: 5,
        remote_version: Some(4),
        last_synced_at: Some(Utc::now()),
        is_dirty: true,
        sync_enabled: false,
    };

    let json = serde_json::to_string(&metadata).expect("Failed to serialize");
    let deserialized: SyncMetadata = serde_json::from_str(&json).expect("Failed to deserialize");

    assert_eq!(metadata.remote_id, deserialized.remote_id);
    assert_eq!(metadata.local_version, deserialized.local_version);
    assert_eq!(metadata.is_dirty, deserialized.is_dirty);
}

// ========== SyncStatus Tests ==========

#[test]
fn test_sync_status_default() {
    let status: SyncStatus = Default::default();

    assert_eq!(status.state, SyncState::Disconnected);
    assert!(status.last_sync.is_none());
    assert_eq!(status.pending_changes, 0);
    assert!(status.user.is_none());
}

#[test]
fn test_sync_status_with_user() {
    let user = User {
        id: "user-123".to_string(),
        email: "test@example.com".to_string(),
        name: Some("Test User".to_string()),
        created_at: Utc::now(),
    };

    let status = SyncStatus {
        state: SyncState::Idle,
        last_sync: Some(Utc::now()),
        pending_changes: 3,
        user: Some(user.clone()),
    };

    assert_eq!(status.state, SyncState::Idle);
    assert_eq!(status.pending_changes, 3);
    assert!(status.user.is_some());
    assert_eq!(status.user.unwrap().email, user.email);
}

// ========== TeamInvite Tests ==========

#[test]
fn test_team_invite_new() {
    let invite = TeamInvite::new(
        "team-123".to_string(),
        "test@example.com".to_string(),
        TeamRole::Member,
        "user-456".to_string(),
        7,
    );

    assert!(!invite.id.is_empty());
    assert_eq!(invite.team_id, "team-123");
    assert_eq!(invite.email, "test@example.com");
    assert_eq!(invite.role, TeamRole::Member);
    assert_eq!(invite.status, InviteStatus::Pending);
    assert_eq!(invite.invited_by, "user-456");
    assert!(!invite.token.is_empty());
}

#[test]
fn test_team_invite_expires_in_days() {
    let invite = TeamInvite::new(
        "team-123".to_string(),
        "test@example.com".to_string(),
        TeamRole::Viewer,
        "user-456".to_string(),
        7,
    );

    let expected_expiry = Utc::now() + Duration::days(7);
    let diff = (invite.expires_at - expected_expiry).num_seconds().abs();

    // Allow 1 second tolerance for test execution time
    assert!(diff < 1);
}

#[test]
fn test_team_invite_is_valid_when_pending_and_not_expired() {
    let invite = TeamInvite::new(
        "team-123".to_string(),
        "test@example.com".to_string(),
        TeamRole::Member,
        "user-456".to_string(),
        7,
    );

    assert!(invite.is_valid());
}

#[test]
fn test_team_invite_is_invalid_when_expired() {
    let mut invite = TeamInvite::new(
        "team-123".to_string(),
        "test@example.com".to_string(),
        TeamRole::Member,
        "user-456".to_string(),
        7,
    );

    // Set expiry to the past
    invite.expires_at = Utc::now() - Duration::days(1);

    assert!(!invite.is_valid());
}

#[test]
fn test_team_invite_is_invalid_when_accepted() {
    let mut invite = TeamInvite::new(
        "team-123".to_string(),
        "test@example.com".to_string(),
        TeamRole::Member,
        "user-456".to_string(),
        7,
    );

    invite.status = InviteStatus::Accepted;

    assert!(!invite.is_valid());
}

#[test]
fn test_team_invite_is_invalid_when_revoked() {
    let mut invite = TeamInvite::new(
        "team-123".to_string(),
        "test@example.com".to_string(),
        TeamRole::Member,
        "user-456".to_string(),
        7,
    );

    invite.status = InviteStatus::Revoked;

    assert!(!invite.is_valid());
}

// ========== InviteStatus Tests ==========

#[test]
fn test_invite_status_as_str() {
    assert_eq!(InviteStatus::Pending.as_str(), "pending");
    assert_eq!(InviteStatus::Accepted.as_str(), "accepted");
    assert_eq!(InviteStatus::Declined.as_str(), "declined");
    assert_eq!(InviteStatus::Expired.as_str(), "expired");
    assert_eq!(InviteStatus::Revoked.as_str(), "revoked");
}

#[test]
fn test_invite_status_from_str() {
    assert_eq!(InviteStatus::from_str("pending"), InviteStatus::Pending);
    assert_eq!(InviteStatus::from_str("accepted"), InviteStatus::Accepted);
    assert_eq!(InviteStatus::from_str("declined"), InviteStatus::Declined);
    assert_eq!(InviteStatus::from_str("expired"), InviteStatus::Expired);
    assert_eq!(InviteStatus::from_str("revoked"), InviteStatus::Revoked);
}

#[test]
fn test_invite_status_from_str_case_insensitive() {
    assert_eq!(InviteStatus::from_str("Pending"), InviteStatus::Pending);
    assert_eq!(InviteStatus::from_str("ACCEPTED"), InviteStatus::Accepted);
}

#[test]
fn test_invite_status_from_str_invalid_defaults_to_pending() {
    assert_eq!(InviteStatus::from_str("unknown"), InviteStatus::Pending);
    assert_eq!(InviteStatus::from_str(""), InviteStatus::Pending);
}

// ========== AuditEvent Tests ==========

#[test]
fn test_audit_event_new() {
    let event = AuditEvent::new(
        AuditEventType::SecretRead,
        "user-123".to_string(),
        Some("user@example.com".to_string()),
    );

    assert!(!event.id.is_empty());
    assert_eq!(event.event_type, AuditEventType::SecretRead);
    assert_eq!(event.actor_id, "user-123");
    assert_eq!(event.actor_email, Some("user@example.com".to_string()));
    assert!(!event.hash.is_empty());
}

#[test]
fn test_audit_event_new_generates_hash() {
    let event = AuditEvent::new(
        AuditEventType::Login,
        "user-456".to_string(),
        None,
    );

    // Hash should be SHA-256 hex string (64 characters)
    assert_eq!(event.hash.len(), 64);
}

#[test]
fn test_audit_event_new_generates_unique_ids() {
    let event1 = AuditEvent::new(
        AuditEventType::SecretRead,
        "user-1".to_string(),
        None,
    );
    let event2 = AuditEvent::new(
        AuditEventType::SecretRead,
        "user-1".to_string(),
        None,
    );

    assert_ne!(event1.id, event2.id);
    assert_ne!(event1.hash, event2.hash);
}

#[test]
fn test_audit_event_with_team() {
    let event = AuditEvent::new(
        AuditEventType::TeamCreated,
        "user-123".to_string(),
        None,
    ).with_team("team-456".to_string());

    assert_eq!(event.team_id, Some("team-456".to_string()));
}

#[test]
fn test_audit_event_with_project() {
    let event = AuditEvent::new(
        AuditEventType::ProjectShared,
        "user-123".to_string(),
        None,
    ).with_project("project-789".to_string());

    assert_eq!(event.project_id, Some("project-789".to_string()));
}

#[test]
fn test_audit_event_with_environment() {
    let event = AuditEvent::new(
        AuditEventType::SecretWrite,
        "user-123".to_string(),
        None,
    ).with_environment("env-abc".to_string());

    assert_eq!(event.environment_id, Some("env-abc".to_string()));
}

#[test]
fn test_audit_event_with_variable() {
    let event = AuditEvent::new(
        AuditEventType::SecretRead,
        "user-123".to_string(),
        None,
    ).with_variable("API_KEY".to_string());

    assert_eq!(event.variable_key, Some("API_KEY".to_string()));
}

#[test]
fn test_audit_event_with_target_user() {
    let event = AuditEvent::new(
        AuditEventType::MemberInvited,
        "user-123".to_string(),
        None,
    ).with_target_user("user-456".to_string());

    assert_eq!(event.target_user_id, Some("user-456".to_string()));
}

#[test]
fn test_audit_event_with_details() {
    let event = AuditEvent::new(
        AuditEventType::SecretExport,
        "user-123".to_string(),
        None,
    ).with_details("{\"format\":\"env\"}".to_string());

    assert_eq!(event.details, Some("{\"format\":\"env\"}".to_string()));
}

#[test]
fn test_audit_event_with_previous_hash() {
    let event = AuditEvent::new(
        AuditEventType::SecretWrite,
        "user-123".to_string(),
        None,
    ).with_previous_hash("abcd1234".to_string());

    assert_eq!(event.previous_hash, Some("abcd1234".to_string()));
    // Hash should be recalculated with previous hash included (SHA-256 = 64 chars)
    assert_eq!(event.hash.len(), 64);
}

#[test]
fn test_audit_event_builder_chain() {
    let event = AuditEvent::new(
        AuditEventType::SecretWrite,
        "user-123".to_string(),
        Some("user@example.com".to_string()),
    )
    .with_team("team-1".to_string())
    .with_project("proj-2".to_string())
    .with_environment("env-3".to_string())
    .with_variable("DB_PASSWORD".to_string())
    .with_details("{\"action\":\"update\"}".to_string());

    assert_eq!(event.team_id, Some("team-1".to_string()));
    assert_eq!(event.project_id, Some("proj-2".to_string()));
    assert_eq!(event.environment_id, Some("env-3".to_string()));
    assert_eq!(event.variable_key, Some("DB_PASSWORD".to_string()));
    assert_eq!(event.details, Some("{\"action\":\"update\"}".to_string()));
}

// ========== AuditEventType Tests ==========

#[test]
fn test_audit_event_type_as_str_secret_operations() {
    assert_eq!(AuditEventType::SecretRead.as_str(), "secret.read");
    assert_eq!(AuditEventType::SecretWrite.as_str(), "secret.write");
    assert_eq!(AuditEventType::SecretDelete.as_str(), "secret.delete");
    assert_eq!(AuditEventType::SecretExport.as_str(), "secret.export");
    assert_eq!(AuditEventType::SecretImport.as_str(), "secret.import");
}

#[test]
fn test_audit_event_type_as_str_team_operations() {
    assert_eq!(AuditEventType::TeamCreated.as_str(), "team.created");
    assert_eq!(AuditEventType::TeamUpdated.as_str(), "team.updated");
    assert_eq!(AuditEventType::TeamDeleted.as_str(), "team.deleted");
}

#[test]
fn test_audit_event_type_as_str_member_operations() {
    assert_eq!(AuditEventType::MemberInvited.as_str(), "member.invited");
    assert_eq!(AuditEventType::MemberJoined.as_str(), "member.joined");
    assert_eq!(AuditEventType::MemberRemoved.as_str(), "member.removed");
    assert_eq!(AuditEventType::MemberRoleChanged.as_str(), "member.role_changed");
}

#[test]
fn test_audit_event_type_as_str_access_operations() {
    assert_eq!(AuditEventType::ProjectShared.as_str(), "project.shared");
    assert_eq!(AuditEventType::ProjectUnshared.as_str(), "project.unshared");
    assert_eq!(AuditEventType::AccessGranted.as_str(), "access.granted");
    assert_eq!(AuditEventType::AccessRevoked.as_str(), "access.revoked");
}

#[test]
fn test_audit_event_type_as_str_auth_operations() {
    assert_eq!(AuditEventType::Login.as_str(), "auth.login");
    assert_eq!(AuditEventType::Logout.as_str(), "auth.logout");
    assert_eq!(AuditEventType::SessionRestored.as_str(), "auth.session_restored");
}

#[test]
fn test_audit_event_type_as_str_sync_operations() {
    assert_eq!(AuditEventType::SyncPush.as_str(), "sync.push");
    assert_eq!(AuditEventType::SyncPull.as_str(), "sync.pull");
    assert_eq!(AuditEventType::ConflictResolved.as_str(), "sync.conflict_resolved");
}

#[test]
fn test_audit_event_type_as_str_threshold_operations() {
    assert_eq!(AuditEventType::KeyShareDistributed.as_str(), "key.share_distributed");
    assert_eq!(AuditEventType::KeyReconstructionRequested.as_str(), "key.reconstruction_requested");
    assert_eq!(AuditEventType::KeyReconstructionApproved.as_str(), "key.reconstruction_approved");
    assert_eq!(AuditEventType::KeyReconstructed.as_str(), "key.reconstructed");
}

#[test]
fn test_audit_event_type_from_str_secret_operations() {
    assert_eq!(AuditEventType::from_str("secret.read"), AuditEventType::SecretRead);
    assert_eq!(AuditEventType::from_str("secret.write"), AuditEventType::SecretWrite);
    assert_eq!(AuditEventType::from_str("secret.delete"), AuditEventType::SecretDelete);
}

#[test]
fn test_audit_event_type_from_str_team_operations() {
    assert_eq!(AuditEventType::from_str("team.created"), AuditEventType::TeamCreated);
    assert_eq!(AuditEventType::from_str("team.updated"), AuditEventType::TeamUpdated);
    assert_eq!(AuditEventType::from_str("team.deleted"), AuditEventType::TeamDeleted);
}

#[test]
fn test_audit_event_type_from_str_invalid_defaults_to_secret_read() {
    assert_eq!(AuditEventType::from_str("unknown"), AuditEventType::SecretRead);
    assert_eq!(AuditEventType::from_str(""), AuditEventType::SecretRead);
}

#[test]
fn test_audit_event_type_round_trip() {
    let types = vec![
        AuditEventType::SecretRead,
        AuditEventType::TeamCreated,
        AuditEventType::MemberInvited,
        AuditEventType::Login,
        AuditEventType::SyncPush,
    ];

    for event_type in types {
        let str_repr = event_type.as_str();
        let parsed = AuditEventType::from_str(str_repr);
        assert_eq!(event_type, parsed);
    }
}

// ========== Team Tests ==========

#[test]
fn test_team_new() {
    let team = Team::new(
        "Engineering".to_string(),
        Some("Dev team".to_string()),
        "user-123".to_string(),
        3,
        5,
    );

    assert!(!team.id.is_empty());
    assert_eq!(team.name, "Engineering");
    assert_eq!(team.description, Some("Dev team".to_string()));
    assert_eq!(team.owner_id, "user-123");
    assert_eq!(team.threshold, 3);
    assert_eq!(team.total_shares, 5);
}

#[test]
fn test_team_generates_unique_ids() {
    let team1 = Team::new("Team 1".to_string(), None, "user-1".to_string(), 2, 3);
    let team2 = Team::new("Team 2".to_string(), None, "user-2".to_string(), 2, 3);

    assert_ne!(team1.id, team2.id);
}

// ========== TeamMember Tests ==========

#[test]
fn test_team_member_new() {
    let member = TeamMember::new(
        "team-123".to_string(),
        "user-456".to_string(),
        "member@example.com".to_string(),
        Some("John Doe".to_string()),
        TeamRole::Member,
        "user-789".to_string(),
    );

    assert!(!member.id.is_empty());
    assert_eq!(member.team_id, "team-123");
    assert_eq!(member.user_id, "user-456");
    assert_eq!(member.email, "member@example.com");
    assert_eq!(member.name, Some("John Doe".to_string()));
    assert_eq!(member.role, TeamRole::Member);
    assert!(member.share_index.is_none());
    assert_eq!(member.invited_by, "user-789");
}

// ========== SyncEvent Tests ==========

#[test]
fn test_sync_event_new() {
    let event = SyncEvent::new(
        SyncEventType::Push,
        Some("project-123".to_string()),
        Some("env-456".to_string()),
        Some("API_KEY".to_string()),
        Some("Pushed to cloud".to_string()),
    );

    assert!(!event.id.is_empty());
    assert_eq!(event.event_type, SyncEventType::Push);
    assert_eq!(event.project_id, Some("project-123".to_string()));
    assert_eq!(event.environment_id, Some("env-456".to_string()));
    assert_eq!(event.variable_key, Some("API_KEY".to_string()));
    assert_eq!(event.details, Some("Pushed to cloud".to_string()));
}

// ========== KeyShare Tests ==========

#[test]
fn test_key_share_new() {
    let share = KeyShare::new(
        "team-123".to_string(),
        1,
        "encrypted_share_data".to_string(),
        "user-456".to_string(),
    );

    assert!(!share.id.is_empty());
    assert_eq!(share.team_id, "team-123");
    assert_eq!(share.share_index, 1);
    assert_eq!(share.encrypted_share, "encrypted_share_data");
    assert_eq!(share.user_id, "user-456");
}

// ========== ProjectTeamAccess Tests ==========

#[test]
fn test_project_team_access_new() {
    let access = ProjectTeamAccess::new(
        "project-123".to_string(),
        "team-456".to_string(),
        "user-789".to_string(),
    );

    assert!(!access.id.is_empty());
    assert_eq!(access.project_id, "project-123");
    assert_eq!(access.team_id, "team-456");
    assert_eq!(access.granted_by, "user-789");
}

// ========== Complex Serialization Tests ==========

#[test]
fn test_project_with_environments_serialization() {
    let project = Project::new("Test Project".to_string(), None);
    let env1 = Environment::new(project.id.clone(), "Dev".to_string(), EnvironmentType::Development);
    let env2 = Environment::new(project.id.clone(), "Prod".to_string(), EnvironmentType::Production);

    let pwe = ProjectWithEnvironments {
        project: project.clone(),
        environments: vec![env1, env2],
    };

    let json = serde_json::to_string(&pwe).expect("Failed to serialize");
    let deserialized: ProjectWithEnvironments = serde_json::from_str(&json).expect("Failed to deserialize");

    assert_eq!(deserialized.project.id, project.id);
    assert_eq!(deserialized.environments.len(), 2);
}

#[test]
fn test_environment_with_variables_serialization() {
    let env = Environment::new("proj-1".to_string(), "Dev".to_string(), EnvironmentType::Development);
    let var1 = Variable::new(env.id.clone(), "KEY1".to_string(), "val1".to_string(), false);
    let var2 = Variable::new(env.id.clone(), "KEY2".to_string(), "val2".to_string(), true);

    let ewv = EnvironmentWithVariables {
        environment: env.clone(),
        variables: vec![var1, var2],
    };

    let json = serde_json::to_string(&ewv).expect("Failed to serialize");
    let deserialized: EnvironmentWithVariables = serde_json::from_str(&json).expect("Failed to deserialize");

    assert_eq!(deserialized.environment.id, env.id);
    assert_eq!(deserialized.variables.len(), 2);
}

#[test]
fn test_synced_project_serialization() {
    let project = Project::new("Synced Project".to_string(), None);
    let sync = SyncMetadata {
        remote_id: Some("remote-123".to_string()),
        local_version: 3,
        remote_version: Some(3),
        last_synced_at: Some(Utc::now()),
        is_dirty: false,
        sync_enabled: true,
    };

    let synced = SyncedProject {
        project,
        sync,
    };

    let json = serde_json::to_string(&synced).expect("Failed to serialize");
    let deserialized: SyncedProject = serde_json::from_str(&json).expect("Failed to deserialize");

    assert_eq!(deserialized.sync.remote_id, Some("remote-123".to_string()));
    assert_eq!(deserialized.sync.local_version, 3);
}

#[test]
fn test_conflict_resolution_variants() {
    let resolutions = vec![
        ConflictResolution::KeepLocal,
        ConflictResolution::KeepRemote,
        ConflictResolution::KeepBoth,
        ConflictResolution::Merge,
    ];

    for resolution in resolutions {
        let json = serde_json::to_string(&resolution).expect("Failed to serialize");
        let _: ConflictResolution = serde_json::from_str(&json).expect("Failed to deserialize");
    }
}

#[test]
fn test_audit_event_serialization_full() {
    let event = AuditEvent::new(
        AuditEventType::SecretWrite,
        "user-123".to_string(),
        Some("user@example.com".to_string()),
    )
    .with_team("team-1".to_string())
    .with_project("proj-2".to_string())
    .with_environment("env-3".to_string())
    .with_variable("DB_PASSWORD".to_string())
    .with_target_user("user-456".to_string())
    .with_details("{\"action\":\"create\"}".to_string())
    .with_previous_hash("prev-hash-123".to_string());

    let json = serde_json::to_string(&event).expect("Failed to serialize");
    let deserialized: AuditEvent = serde_json::from_str(&json).expect("Failed to deserialize");

    assert_eq!(deserialized.id, event.id);
    assert_eq!(deserialized.event_type, event.event_type);
    assert_eq!(deserialized.team_id, event.team_id);
    assert_eq!(deserialized.project_id, event.project_id);
    assert_eq!(deserialized.environment_id, event.environment_id);
    assert_eq!(deserialized.variable_key, event.variable_key);
    assert_eq!(deserialized.hash, event.hash);
}
