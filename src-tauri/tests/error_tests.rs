use app_lib::error::{EnvSyncError, Result};
use std::io;
use serde_json;

// ============================================================================
// Error Display Tests
// ============================================================================

#[test]
fn test_encryption_error_display() {
    let error = EnvSyncError::Encryption("failed to encrypt data".to_string());
    assert_eq!(error.to_string(), "Encryption error: failed to encrypt data");
}

#[test]
fn test_decryption_error_display() {
    let error = EnvSyncError::Decryption("invalid ciphertext".to_string());
    assert_eq!(error.to_string(), "Decryption error: invalid ciphertext");
}

#[test]
fn test_invalid_password_display() {
    let error = EnvSyncError::InvalidPassword;
    assert_eq!(error.to_string(), "Invalid password");
}

#[test]
fn test_vault_locked_display() {
    let error = EnvSyncError::VaultLocked;
    assert_eq!(error.to_string(), "Vault is locked");
}

#[test]
fn test_project_not_found_display() {
    let error = EnvSyncError::ProjectNotFound("my-project".to_string());
    assert_eq!(error.to_string(), "Project not found: my-project");
}

#[test]
fn test_environment_not_found_display() {
    let error = EnvSyncError::EnvironmentNotFound("production".to_string());
    assert_eq!(error.to_string(), "Environment not found: production");
}

#[test]
fn test_variable_not_found_display() {
    let error = EnvSyncError::VariableNotFound("API_KEY".to_string());
    assert_eq!(error.to_string(), "Variable not found: API_KEY");
}

#[test]
fn test_http_error_display() {
    let error = EnvSyncError::Http("404 Not Found".to_string());
    assert_eq!(error.to_string(), "HTTP error: 404 Not Found");
}

#[test]
fn test_invalid_config_display() {
    let error = EnvSyncError::InvalidConfig("missing required field".to_string());
    assert_eq!(error.to_string(), "Invalid configuration: missing required field");
}

#[test]
fn test_not_authenticated_display() {
    let error = EnvSyncError::NotAuthenticated;
    assert_eq!(error.to_string(), "Not authenticated: please log in");
}

#[test]
fn test_token_expired_display() {
    let error = EnvSyncError::TokenExpired;
    assert_eq!(error.to_string(), "Authentication token expired: please log in again");
}

#[test]
fn test_network_error_display() {
    let error = EnvSyncError::Network("connection timeout".to_string());
    assert_eq!(error.to_string(), "Network error: connection timeout");
}

#[test]
fn test_api_error_display() {
    let error = EnvSyncError::Api("rate limit exceeded".to_string());
    assert_eq!(error.to_string(), "API error: rate limit exceeded");
}

#[test]
fn test_not_found_display() {
    let error = EnvSyncError::NotFound("resource".to_string());
    assert_eq!(error.to_string(), "Not found: resource");
}

#[test]
fn test_sync_conflict_display() {
    let error = EnvSyncError::SyncConflict("local and remote versions differ".to_string());
    assert_eq!(error.to_string(), "Sync conflict: local and remote versions differ");
}

#[test]
fn test_sync_error_display() {
    let error = EnvSyncError::SyncError("failed to push changes".to_string());
    assert_eq!(error.to_string(), "Sync error: failed to push changes");
}

#[test]
fn test_team_not_found_display() {
    let error = EnvSyncError::TeamNotFound("engineering".to_string());
    assert_eq!(error.to_string(), "Team not found: engineering");
}

#[test]
fn test_member_not_found_display() {
    let error = EnvSyncError::MemberNotFound("user@example.com".to_string());
    assert_eq!(error.to_string(), "Team member not found: user@example.com");
}

#[test]
fn test_invite_not_found_display() {
    let error = EnvSyncError::InviteNotFound("invite-123".to_string());
    assert_eq!(error.to_string(), "Invite not found or expired: invite-123");
}

#[test]
fn test_permission_denied_display() {
    let error = EnvSyncError::PermissionDenied("cannot delete team".to_string());
    assert_eq!(error.to_string(), "Permission denied: cannot delete team");
}

#[test]
fn test_invalid_threshold_display() {
    let error = EnvSyncError::InvalidThreshold("threshold must be <= total shares".to_string());
    assert_eq!(error.to_string(), "Invalid threshold parameters: threshold must be <= total shares");
}

#[test]
fn test_insufficient_shares_display() {
    let error = EnvSyncError::InsufficientShares(3, 2);
    assert_eq!(error.to_string(), "Insufficient key shares: need 3, have 2");
}

#[test]
fn test_key_reconstruction_failed_display() {
    let error = EnvSyncError::KeyReconstructionFailed("invalid share format".to_string());
    assert_eq!(error.to_string(), "Key reconstruction failed: invalid share format");
}

// ============================================================================
// Error Serialization Tests (for Tauri IPC)
// ============================================================================

#[test]
fn test_serialize_encryption_error() {
    let error = EnvSyncError::Encryption("test error".to_string());
    let serialized = serde_json::to_string(&error).unwrap();
    assert_eq!(serialized, "\"Encryption error: test error\"");
}

#[test]
fn test_serialize_invalid_password() {
    let error = EnvSyncError::InvalidPassword;
    let serialized = serde_json::to_string(&error).unwrap();
    assert_eq!(serialized, "\"Invalid password\"");
}

#[test]
fn test_serialize_not_authenticated() {
    let error = EnvSyncError::NotAuthenticated;
    let serialized = serde_json::to_string(&error).unwrap();
    assert_eq!(serialized, "\"Not authenticated: please log in\"");
}

#[test]
fn test_serialize_insufficient_shares() {
    let error = EnvSyncError::InsufficientShares(5, 3);
    let serialized = serde_json::to_string(&error).unwrap();
    assert_eq!(serialized, "\"Insufficient key shares: need 5, have 3\"");
}

#[test]
fn test_serialize_sync_conflict() {
    let error = EnvSyncError::SyncConflict("merge conflict".to_string());
    let serialized = serde_json::to_string(&error).unwrap();
    assert_eq!(serialized, "\"Sync conflict: merge conflict\"");
}

// ============================================================================
// From Trait Implementation Tests
// ============================================================================

#[test]
fn test_from_io_error() {
    let io_error = io::Error::new(io::ErrorKind::NotFound, "file not found");
    let envsync_error: EnvSyncError = io_error.into();

    // The error message should contain "IO error:"
    let error_string = envsync_error.to_string();
    assert!(error_string.starts_with("IO error:"));
    assert!(error_string.contains("file not found"));
}

#[test]
fn test_from_serde_json_error() {
    let result: std::result::Result<serde_json::Value, serde_json::Error> =
        serde_json::from_str("{ invalid json }");

    let json_error = result.unwrap_err();
    let envsync_error: EnvSyncError = json_error.into();

    let error_string = envsync_error.to_string();
    assert!(error_string.starts_with("Serialization error:"));
}

// ============================================================================
// Result Type Alias Tests
// ============================================================================

#[test]
fn test_result_type_ok() {
    let result: Result<i32> = Ok(42);
    assert!(result.is_ok());
    assert_eq!(result.unwrap(), 42);
}

#[test]
fn test_result_type_err() {
    let result: Result<i32> = Err(EnvSyncError::VaultLocked);
    assert!(result.is_err());
    assert_eq!(result.unwrap_err().to_string(), "Vault is locked");
}

#[test]
fn test_result_propagation() {
    fn returns_error() -> Result<String> {
        Err(EnvSyncError::InvalidPassword)
    }

    fn calls_returns_error() -> Result<String> {
        let _value = returns_error()?;
        Ok("success".to_string())
    }

    let result = calls_returns_error();
    assert!(result.is_err());
    assert_eq!(result.unwrap_err().to_string(), "Invalid password");
}

// ============================================================================
// Error Variant Creation Tests
// ============================================================================

#[test]
fn test_create_encryption_error_with_empty_message() {
    let error = EnvSyncError::Encryption(String::new());
    assert_eq!(error.to_string(), "Encryption error: ");
}

#[test]
fn test_create_project_not_found_with_special_chars() {
    let error = EnvSyncError::ProjectNotFound("my-project_123!@#".to_string());
    assert_eq!(error.to_string(), "Project not found: my-project_123!@#");
}

#[test]
fn test_create_insufficient_shares_zero_values() {
    let error = EnvSyncError::InsufficientShares(0, 0);
    assert_eq!(error.to_string(), "Insufficient key shares: need 0, have 0");
}

#[test]
fn test_create_insufficient_shares_large_values() {
    let error = EnvSyncError::InsufficientShares(255, 200);
    assert_eq!(error.to_string(), "Insufficient key shares: need 255, have 200");
}

// ============================================================================
// Error Message Formatting Tests
// ============================================================================

#[test]
fn test_error_message_with_newlines() {
    let error = EnvSyncError::Api("Error:\nLine 1\nLine 2".to_string());
    let message = error.to_string();
    assert!(message.contains("Line 1"));
    assert!(message.contains("Line 2"));
}

#[test]
fn test_error_message_with_unicode() {
    let error = EnvSyncError::Network("Connection failed: 网络错误".to_string());
    assert_eq!(error.to_string(), "Network error: Connection failed: 网络错误");
}

#[test]
fn test_error_message_with_long_text() {
    let long_message = "x".repeat(1000);
    let error = EnvSyncError::SyncError(long_message.clone());
    let expected = format!("Sync error: {}", long_message);
    assert_eq!(error.to_string(), expected);
}

// ============================================================================
// Debug Trait Tests
// ============================================================================

#[test]
fn test_debug_format_simple_variant() {
    let error = EnvSyncError::InvalidPassword;
    let debug_str = format!("{:?}", error);
    assert_eq!(debug_str, "InvalidPassword");
}

#[test]
fn test_debug_format_string_variant() {
    let error = EnvSyncError::Encryption("test".to_string());
    let debug_str = format!("{:?}", error);
    assert!(debug_str.contains("Encryption"));
    assert!(debug_str.contains("test"));
}

#[test]
fn test_debug_format_tuple_variant() {
    let error = EnvSyncError::InsufficientShares(3, 2);
    let debug_str = format!("{:?}", error);
    assert!(debug_str.contains("InsufficientShares"));
    assert!(debug_str.contains("3"));
    assert!(debug_str.contains("2"));
}

// ============================================================================
// Error Conversion Chain Tests
// ============================================================================

#[test]
fn test_io_error_conversion_chain() {
    fn read_file() -> Result<String> {
        std::fs::read_to_string("/nonexistent/path/to/file.txt")?;
        Ok("content".to_string())
    }

    let result = read_file();
    assert!(result.is_err());
    let error = result.unwrap_err();
    assert!(error.to_string().starts_with("IO error:"));
}

#[test]
fn test_json_error_conversion_chain() {
    fn parse_json() -> Result<serde_json::Value> {
        let value = serde_json::from_str("{ invalid")?;
        Ok(value)
    }

    let result = parse_json();
    assert!(result.is_err());
    let error = result.unwrap_err();
    assert!(error.to_string().starts_with("Serialization error:"));
}

// ============================================================================
// Edge Case Tests
// ============================================================================

#[test]
fn test_error_equality_through_display() {
    let error1 = EnvSyncError::VaultLocked;
    let error2 = EnvSyncError::VaultLocked;
    assert_eq!(error1.to_string(), error2.to_string());
}

#[test]
fn test_different_errors_have_different_messages() {
    let error1 = EnvSyncError::InvalidPassword;
    let error2 = EnvSyncError::VaultLocked;
    assert_ne!(error1.to_string(), error2.to_string());
}

#[test]
fn test_parameterized_errors_with_same_type_different_params() {
    let error1 = EnvSyncError::ProjectNotFound("project-a".to_string());
    let error2 = EnvSyncError::ProjectNotFound("project-b".to_string());
    assert_ne!(error1.to_string(), error2.to_string());
}

#[test]
fn test_insufficient_shares_different_combinations() {
    let error1 = EnvSyncError::InsufficientShares(3, 2);
    let error2 = EnvSyncError::InsufficientShares(5, 3);
    assert_ne!(error1.to_string(), error2.to_string());
    assert!(error1.to_string().contains("need 3, have 2"));
    assert!(error2.to_string().contains("need 5, have 3"));
}

// ============================================================================
// Real-world Usage Scenario Tests
// ============================================================================

#[test]
fn test_vault_workflow_errors() {
    // Simulate a vault workflow that encounters multiple errors
    fn unlock_vault(password: &str) -> Result<()> {
        if password.is_empty() {
            return Err(EnvSyncError::InvalidPassword);
        }
        Ok(())
    }

    fn access_project(vault_locked: bool, project_exists: bool) -> Result<String> {
        if vault_locked {
            return Err(EnvSyncError::VaultLocked);
        }
        if !project_exists {
            return Err(EnvSyncError::ProjectNotFound("my-project".to_string()));
        }
        Ok("project-data".to_string())
    }

    // Test invalid password
    let result = unlock_vault("");
    assert!(result.is_err());
    assert_eq!(result.unwrap_err().to_string(), "Invalid password");

    // Test vault locked
    let result = access_project(true, true);
    assert!(result.is_err());
    assert_eq!(result.unwrap_err().to_string(), "Vault is locked");

    // Test project not found
    let result = access_project(false, false);
    assert!(result.is_err());
    assert_eq!(result.unwrap_err().to_string(), "Project not found: my-project");
}

#[test]
fn test_team_workflow_errors() {
    fn check_team_access(has_permission: bool, team_exists: bool, member_exists: bool) -> Result<()> {
        if !team_exists {
            return Err(EnvSyncError::TeamNotFound("engineering".to_string()));
        }
        if !member_exists {
            return Err(EnvSyncError::MemberNotFound("user@example.com".to_string()));
        }
        if !has_permission {
            return Err(EnvSyncError::PermissionDenied("admin role required".to_string()));
        }
        Ok(())
    }

    // Test team not found
    let result = check_team_access(true, false, true);
    assert!(result.is_err());
    assert_eq!(result.unwrap_err().to_string(), "Team not found: engineering");

    // Test member not found
    let result = check_team_access(true, true, false);
    assert!(result.is_err());
    assert_eq!(result.unwrap_err().to_string(), "Team member not found: user@example.com");

    // Test permission denied
    let result = check_team_access(false, true, true);
    assert!(result.is_err());
    assert_eq!(result.unwrap_err().to_string(), "Permission denied: admin role required");
}

#[test]
fn test_sync_workflow_errors() {
    fn sync_data(is_authenticated: bool, has_network: bool, has_conflict: bool) -> Result<()> {
        if !is_authenticated {
            return Err(EnvSyncError::NotAuthenticated);
        }
        if !has_network {
            return Err(EnvSyncError::Network("connection failed".to_string()));
        }
        if has_conflict {
            return Err(EnvSyncError::SyncConflict("local changes conflict with remote".to_string()));
        }
        Ok(())
    }

    // Test not authenticated
    let result = sync_data(false, true, false);
    assert!(result.is_err());
    assert_eq!(result.unwrap_err().to_string(), "Not authenticated: please log in");

    // Test network error
    let result = sync_data(true, false, false);
    assert!(result.is_err());
    assert!(result.unwrap_err().to_string().starts_with("Network error:"));

    // Test sync conflict
    let result = sync_data(true, true, true);
    assert!(result.is_err());
    assert!(result.unwrap_err().to_string().starts_with("Sync conflict:"));
}
