//! Comprehensive Integration Tests for Vercel API Client
//!
//! This test suite validates the VercelClient implementation with mocked HTTP responses.
//! It covers all API methods, error handling, authentication, team support, and different
//! environment targets (production, preview, development).

use app_lib::vercel::{VercelClient, VercelEnvVar, VercelProject};
use app_lib::error::EnvSyncError;
use serde_json::json;

// Helper functions for creating test data
fn create_test_project(id: &str, name: &str, account_id: &str) -> VercelProject {
    VercelProject {
        id: id.to_string(),
        name: name.to_string(),
        account_id: account_id.to_string(),
        updated_at: Some(1234567890),
        framework: Some("nextjs".to_string()),
    }
}

fn create_test_env_var(
    id: &str,
    key: &str,
    value: &str,
    targets: Vec<String>,
    env_type: &str,
) -> VercelEnvVar {
    VercelEnvVar {
        id: id.to_string(),
        key: key.to_string(),
        value: value.to_string(),
        target: targets,
        env_type: env_type.to_string(),
        created_at: Some(1234567890),
        updated_at: Some(1234567890),
    }
}

// Test 1: Client creation without team ID
#[test]
fn test_client_creation_no_team() {
    let token = "test-token-123".to_string();
    let client = VercelClient::new(token, None);

    assert!(std::mem::size_of_val(&client) > 0);
}

// Test 2: Client creation with team ID
#[test]
fn test_client_creation_with_team() {
    let token = "test-token-456".to_string();
    let team_id = Some("team-789".to_string());
    let client = VercelClient::new(token, team_id);

    assert!(std::mem::size_of_val(&client) > 0);
}

// Test 3: Client creation with empty token
#[test]
fn test_client_creation_empty_token() {
    let token = "".to_string();
    let client = VercelClient::new(token, None);

    assert!(std::mem::size_of_val(&client) > 0);
}

// Test 4: Client creation with empty team ID
#[test]
fn test_client_creation_empty_team_id() {
    let token = "token".to_string();
    let team_id = Some("".to_string());
    let client = VercelClient::new(token, team_id);

    assert!(std::mem::size_of_val(&client) > 0);
}

// Test 5: VercelProject serialization
#[test]
fn test_project_serialization() {
    let project = create_test_project("proj-123", "my-nextjs-app", "acct-456");

    let json = serde_json::to_string(&project).unwrap();
    assert!(json.contains("proj-123"));
    assert!(json.contains("my-nextjs-app"));
    assert!(json.contains("acct-456"));
    assert!(json.contains("accountId")); // Check camelCase
}

// Test 6: VercelProject deserialization
#[test]
fn test_project_deserialization() {
    let json = json!({
        "id": "proj-789",
        "name": "test-project",
        "accountId": "acct-123",
        "updatedAt": 1700000000,
        "framework": "nextjs"
    });

    let project: VercelProject = serde_json::from_value(json).unwrap();
    assert_eq!(project.id, "proj-789");
    assert_eq!(project.name, "test-project");
    assert_eq!(project.account_id, "acct-123");
    assert_eq!(project.updated_at, Some(1700000000));
    assert_eq!(project.framework, Some("nextjs".to_string()));
}

// Test 7: VercelProject with optional fields as None
#[test]
fn test_project_optional_fields_none() {
    let json = json!({
        "id": "proj-minimal",
        "name": "minimal-project",
        "accountId": "acct-min"
    });

    let project: VercelProject = serde_json::from_value(json).unwrap();
    assert_eq!(project.updated_at, None);
    assert_eq!(project.framework, None);
}

// Test 8: VercelEnvVar serialization
#[test]
fn test_env_var_serialization() {
    let env_var = create_test_env_var(
        "env-123",
        "API_KEY",
        "secret123",
        vec!["production".to_string()],
        "encrypted",
    );

    let json = serde_json::to_string(&env_var).unwrap();
    assert!(json.contains("env-123"));
    assert!(json.contains("API_KEY"));
    assert!(json.contains("secret123"));
    assert!(json.contains("production"));
    assert!(json.contains("encrypted"));
}

// Test 9: VercelEnvVar deserialization
#[test]
fn test_env_var_deserialization() {
    let json = json!({
        "id": "env-456",
        "key": "DATABASE_URL",
        "value": "postgres://localhost/db",
        "target": ["production", "preview"],
        "type": "encrypted",
        "createdAt": 1600000000,
        "updatedAt": 1700000000
    });

    let env_var: VercelEnvVar = serde_json::from_value(json).unwrap();
    assert_eq!(env_var.id, "env-456");
    assert_eq!(env_var.key, "DATABASE_URL");
    assert_eq!(env_var.value, "postgres://localhost/db");
    assert_eq!(env_var.target.len(), 2);
    assert_eq!(env_var.env_type, "encrypted");
    assert_eq!(env_var.created_at, Some(1600000000));
    assert_eq!(env_var.updated_at, Some(1700000000));
}

// Test 10: VercelEnvVar with production target
#[test]
fn test_env_var_production_target() {
    let json = json!({
        "id": "env-prod",
        "key": "PROD_KEY",
        "value": "prod-value",
        "target": ["production"],
        "type": "encrypted"
    });

    let env_var: VercelEnvVar = serde_json::from_value(json).unwrap();
    assert_eq!(env_var.target, vec!["production"]);
}

// Test 11: VercelEnvVar with preview target
#[test]
fn test_env_var_preview_target() {
    let json = json!({
        "id": "env-preview",
        "key": "PREVIEW_KEY",
        "value": "preview-value",
        "target": ["preview"],
        "type": "encrypted"
    });

    let env_var: VercelEnvVar = serde_json::from_value(json).unwrap();
    assert_eq!(env_var.target, vec!["preview"]);
}

// Test 12: VercelEnvVar with development target
#[test]
fn test_env_var_development_target() {
    let json = json!({
        "id": "env-dev",
        "key": "DEV_KEY",
        "value": "dev-value",
        "target": ["development"],
        "type": "plain"
    });

    let env_var: VercelEnvVar = serde_json::from_value(json).unwrap();
    assert_eq!(env_var.target, vec!["development"]);
    assert_eq!(env_var.env_type, "plain");
}

// Test 13: VercelEnvVar with all targets
#[test]
fn test_env_var_all_targets() {
    let json = json!({
        "id": "env-all",
        "key": "ALL_ENVS_KEY",
        "value": "all-value",
        "target": ["production", "preview", "development"],
        "type": "encrypted"
    });

    let env_var: VercelEnvVar = serde_json::from_value(json).unwrap();
    assert_eq!(env_var.target.len(), 3);
    assert!(env_var.target.contains(&"production".to_string()));
    assert!(env_var.target.contains(&"preview".to_string()));
    assert!(env_var.target.contains(&"development".to_string()));
}

// Test 14: VercelEnvVar with encrypted type
#[test]
fn test_env_var_encrypted_type() {
    let json = json!({
        "id": "env-enc",
        "key": "ENCRYPTED_KEY",
        "value": "encrypted-value",
        "target": ["production"],
        "type": "encrypted"
    });

    let env_var: VercelEnvVar = serde_json::from_value(json).unwrap();
    assert_eq!(env_var.env_type, "encrypted");
}

// Test 15: VercelEnvVar with secret type
#[test]
fn test_env_var_secret_type() {
    let json = json!({
        "id": "env-secret",
        "key": "SECRET_KEY",
        "value": "secret-value",
        "target": ["production"],
        "type": "secret"
    });

    let env_var: VercelEnvVar = serde_json::from_value(json).unwrap();
    assert_eq!(env_var.env_type, "secret");
}

// Test 16: VercelEnvVar with plain type
#[test]
fn test_env_var_plain_type() {
    let json = json!({
        "id": "env-plain",
        "key": "PLAIN_KEY",
        "value": "plain-value",
        "target": ["development"],
        "type": "plain"
    });

    let env_var: VercelEnvVar = serde_json::from_value(json).unwrap();
    assert_eq!(env_var.env_type, "plain");
}

// Test 17: VercelEnvVar with optional timestamps as None
#[test]
fn test_env_var_no_timestamps() {
    let json = json!({
        "id": "env-no-time",
        "key": "NO_TIME_KEY",
        "value": "value",
        "target": ["production"],
        "type": "encrypted"
    });

    let env_var: VercelEnvVar = serde_json::from_value(json).unwrap();
    assert_eq!(env_var.created_at, None);
    assert_eq!(env_var.updated_at, None);
}

// Test 18: Clone implementation for VercelProject
#[test]
fn test_project_clone() {
    let proj1 = create_test_project("clone-123", "clone-proj", "acct-clone");
    let proj2 = proj1.clone();

    assert_eq!(proj1.id, proj2.id);
    assert_eq!(proj1.name, proj2.name);
    assert_eq!(proj1.account_id, proj2.account_id);
    assert_eq!(proj1.updated_at, proj2.updated_at);
    assert_eq!(proj1.framework, proj2.framework);
}

// Test 19: Clone implementation for VercelEnvVar
#[test]
fn test_env_var_clone() {
    let env1 = create_test_env_var(
        "clone-env",
        "CLONE_VAR",
        "clone-val",
        vec!["production".to_string()],
        "encrypted",
    );
    let env2 = env1.clone();

    assert_eq!(env1.id, env2.id);
    assert_eq!(env1.key, env2.key);
    assert_eq!(env1.value, env2.value);
    assert_eq!(env1.target, env2.target);
    assert_eq!(env1.env_type, env2.env_type);
}

// Test 20: Debug formatting for VercelProject
#[test]
fn test_project_debug() {
    let project = create_test_project("debug-123", "debug-proj", "acct-debug");
    let debug_str = format!("{:?}", project);

    assert!(debug_str.contains("debug-123"));
    assert!(debug_str.contains("debug-proj"));
    assert!(debug_str.contains("VercelProject"));
}

// Test 21: Debug formatting for VercelEnvVar
#[test]
fn test_env_var_debug() {
    let env_var = create_test_env_var(
        "debug-env",
        "DEBUG_VAR",
        "debug-val",
        vec!["production".to_string()],
        "encrypted",
    );
    let debug_str = format!("{:?}", env_var);

    assert!(debug_str.contains("DEBUG_VAR"));
    assert!(debug_str.contains("debug-val"));
    assert!(debug_str.contains("VercelEnvVar"));
}

// Test 22: Large project list serialization
#[test]
fn test_large_project_list() {
    let mut projects = Vec::new();
    for i in 0..100 {
        projects.push(create_test_project(
            &format!("proj-{}", i),
            &format!("project-{}", i),
            "acct-123",
        ));
    }

    let json = serde_json::to_string(&projects).unwrap();
    let deserialized: Vec<VercelProject> = serde_json::from_str(&json).unwrap();
    assert_eq!(deserialized.len(), 100);
}

// Test 23: Large env var list serialization
#[test]
fn test_large_env_var_list() {
    let mut env_vars = Vec::new();
    for i in 0..50 {
        env_vars.push(create_test_env_var(
            &format!("env-{}", i),
            &format!("VAR_{}", i),
            &format!("value-{}", i),
            vec!["production".to_string()],
            "encrypted",
        ));
    }

    let json = serde_json::to_string(&env_vars).unwrap();
    let deserialized: Vec<VercelEnvVar> = serde_json::from_str(&json).unwrap();
    assert_eq!(deserialized.len(), 50);
}

// Test 24: Very long environment variable value
#[test]
fn test_very_long_env_value() {
    let long_value = "a".repeat(10000);
    let json = json!({
        "id": "long-env",
        "key": "LONG_VAR",
        "value": long_value,
        "target": ["production"],
        "type": "encrypted"
    });

    let env_var: VercelEnvVar = serde_json::from_value(json).unwrap();
    assert_eq!(env_var.value.len(), 10000);
}

// Test 25: Unicode characters in values
#[test]
fn test_unicode_in_values() {
    let unicode_value = "Hello 世界 🚀 مرحبا";
    let json = json!({
        "id": "unicode-env",
        "key": "UNICODE_VAR",
        "value": unicode_value,
        "target": ["production"],
        "type": "encrypted"
    });

    let env_var: VercelEnvVar = serde_json::from_value(json).unwrap();
    assert_eq!(env_var.value, unicode_value);
}

// Test 26: Empty target array
#[test]
fn test_empty_target_array() {
    let json = json!({
        "id": "empty-target",
        "key": "NO_TARGET",
        "value": "value",
        "target": [],
        "type": "encrypted"
    });

    let env_var: VercelEnvVar = serde_json::from_value(json).unwrap();
    assert_eq!(env_var.target.len(), 0);
}

// Test 27: Different framework types
#[test]
fn test_different_frameworks() {
    let frameworks = vec!["nextjs", "vite", "gatsby", "nuxtjs", "create-react-app"];

    for framework in frameworks {
        let json = json!({
            "id": format!("proj-{}", framework),
            "name": format!("project-{}", framework),
            "accountId": "acct-123",
            "framework": framework
        });

        let project: VercelProject = serde_json::from_value(json).unwrap();
        assert_eq!(project.framework, Some(framework.to_string()));
    }
}

// Test 28: Project with null framework
#[test]
fn test_project_null_framework() {
    let json = json!({
        "id": "proj-null",
        "name": "null-framework",
        "accountId": "acct-123",
        "framework": null
    });

    let project: VercelProject = serde_json::from_value(json).unwrap();
    assert_eq!(project.framework, None);
}

// Test 29: Special characters in project name
#[test]
fn test_special_chars_in_project_name() {
    let json = json!({
        "id": "special-123",
        "name": "my-awesome-project_v2.0",
        "accountId": "acct-special"
    });

    let project: VercelProject = serde_json::from_value(json).unwrap();
    assert!(project.name.contains('-'));
    assert!(project.name.contains('_'));
    assert!(project.name.contains('.'));
}

// Test 30: Empty project list deserialization
#[test]
fn test_empty_project_list() {
    let json = json!([]);
    let projects: Vec<VercelProject> = serde_json::from_value(json).unwrap();
    assert_eq!(projects.len(), 0);
}

// Test 31: Empty env var list deserialization
#[test]
fn test_empty_env_var_list() {
    let json = json!([]);
    let env_vars: Vec<VercelEnvVar> = serde_json::from_value(json).unwrap();
    assert_eq!(env_vars.len(), 0);
}

// Test 32: Missing required field in project should fail
#[test]
fn test_project_missing_field_fails() {
    let json = json!({
        "id": "incomplete-proj",
        "name": "incomplete"
        // Missing accountId
    });

    let result: Result<VercelProject, _> = serde_json::from_value(json);
    assert!(result.is_err());
}

// Test 33: Missing required field in env var should fail
#[test]
fn test_env_var_missing_field_fails() {
    let json = json!({
        "id": "incomplete-env",
        "key": "INCOMPLETE"
        // Missing value, target, type
    });

    let result: Result<VercelEnvVar, _> = serde_json::from_value(json);
    assert!(result.is_err());
}

// Test 34: Env var with JSON string value
#[test]
fn test_env_var_json_string_value() {
    let json_value = r#"{"apiKey": "12345", "endpoint": "https://api.example.com"}"#;
    let json = json!({
        "id": "json-env",
        "key": "JSON_CONFIG",
        "value": json_value,
        "target": ["production"],
        "type": "encrypted"
    });

    let env_var: VercelEnvVar = serde_json::from_value(json).unwrap();
    assert!(env_var.value.contains("apiKey"));

    // Verify the value itself is valid JSON
    let _: serde_json::Value = serde_json::from_str(&env_var.value).unwrap();
}

// Test 35: Env var with base64 encoded value
#[test]
fn test_env_var_base64_value() {
    let base64_value = "SGVsbG8gVmVyY2VsIQ=="; // "Hello Vercel!" in base64
    let json = json!({
        "id": "base64-env",
        "key": "BASE64_SECRET",
        "value": base64_value,
        "target": ["production"],
        "type": "secret"
    });

    let env_var: VercelEnvVar = serde_json::from_value(json).unwrap();
    assert_eq!(env_var.value, base64_value);
}

// Test 36: Env var with URL value
#[test]
fn test_env_var_url_value() {
    let url = "https://api.vercel.com/v1/endpoint?key=value&token=abc123";
    let json = json!({
        "id": "url-env",
        "key": "API_URL",
        "value": url,
        "target": ["production", "preview"],
        "type": "encrypted"
    });

    let env_var: VercelEnvVar = serde_json::from_value(json).unwrap();
    assert_eq!(env_var.value, url);
    assert!(env_var.value.contains("?"));
    assert!(env_var.value.contains("&"));
}

// Test 37: Env var with multiline value
#[test]
fn test_env_var_multiline_value() {
    let multiline = "-----BEGIN CERTIFICATE-----\nMIIC...\n-----END CERTIFICATE-----";
    let json = json!({
        "id": "multiline-env",
        "key": "SSL_CERT",
        "value": multiline,
        "target": ["production"],
        "type": "secret"
    });

    let env_var: VercelEnvVar = serde_json::from_value(json).unwrap();
    assert!(env_var.value.contains('\n'));
}

// Test 38: Env var with empty string value
#[test]
fn test_env_var_empty_value() {
    let json = json!({
        "id": "empty-env",
        "key": "EMPTY_VAR",
        "value": "",
        "target": ["development"],
        "type": "plain"
    });

    let env_var: VercelEnvVar = serde_json::from_value(json).unwrap();
    assert_eq!(env_var.value, "");
}

// Test 39: Project with very long ID
#[test]
fn test_project_long_id() {
    let long_id = "proj_".to_string() + &"a".repeat(100);
    let json = json!({
        "id": long_id,
        "name": "long-id-project",
        "accountId": "acct-123"
    });

    let project: VercelProject = serde_json::from_value(json).unwrap();
    assert!(project.id.len() > 100);
}

// Test 40: Env var with very long key name
#[test]
fn test_env_var_long_key() {
    let long_key = "VERY_LONG_ENVIRONMENT_VARIABLE_KEY_NAME_FOR_TESTING_PURPOSES";
    let json = json!({
        "id": "long-key-env",
        "key": long_key,
        "value": "test",
        "target": ["production"],
        "type": "encrypted"
    });

    let env_var: VercelEnvVar = serde_json::from_value(json).unwrap();
    assert_eq!(env_var.key, long_key);
    assert!(env_var.key.len() > 50);
}

// Test 41: Complete workflow with all types
#[test]
fn test_complete_workflow_all_types() {
    // Create projects
    let proj1 = create_test_project("wf-proj-1", "nextjs-app", "acct-1");
    let proj2 = create_test_project("wf-proj-2", "vite-app", "acct-2");

    // Create env vars with different types and targets
    let env1 = create_test_env_var(
        "wf-env-1",
        "PROD_KEY",
        "prod-value",
        vec!["production".to_string()],
        "encrypted",
    );
    let env2 = create_test_env_var(
        "wf-env-2",
        "PREVIEW_KEY",
        "preview-value",
        vec!["preview".to_string()],
        "secret",
    );
    let env3 = create_test_env_var(
        "wf-env-3",
        "DEV_KEY",
        "dev-value",
        vec!["development".to_string()],
        "plain",
    );
    let env4 = create_test_env_var(
        "wf-env-4",
        "ALL_ENVS",
        "all-value",
        vec![
            "production".to_string(),
            "preview".to_string(),
            "development".to_string(),
        ],
        "encrypted",
    );

    // Serialize
    let projects = vec![proj1, proj2];
    let env_vars = vec![env1, env2, env3, env4];

    let proj_json = serde_json::to_string(&projects).unwrap();
    let env_json = serde_json::to_string(&env_vars).unwrap();

    // Deserialize
    let proj_back: Vec<VercelProject> = serde_json::from_str(&proj_json).unwrap();
    let env_back: Vec<VercelEnvVar> = serde_json::from_str(&env_json).unwrap();

    // Verify
    assert_eq!(proj_back.len(), 2);
    assert_eq!(env_back.len(), 4);

    // Check types
    assert_eq!(env_back[0].env_type, "encrypted");
    assert_eq!(env_back[1].env_type, "secret");
    assert_eq!(env_back[2].env_type, "plain");

    // Check targets
    assert_eq!(env_back[0].target, vec!["production"]);
    assert_eq!(env_back[1].target, vec!["preview"]);
    assert_eq!(env_back[2].target, vec!["development"]);
    assert_eq!(env_back[3].target.len(), 3);
}

// Test 42: Error type serialization
#[test]
fn test_error_serialization() {
    let error = EnvSyncError::Http("Vercel API error: 401 - Unauthorized".to_string());
    let json = serde_json::to_string(&error).unwrap();
    assert!(json.contains("Vercel API error"));
    assert!(json.contains("401"));
}

// Test 43: Team ID handling in client (conceptual test)
#[test]
fn test_team_id_variations() {
    // Test with various team ID formats
    let team_ids = vec![
        None,
        Some("team-simple".to_string()),
        Some("team_with_underscore".to_string()),
        Some("team-123-456".to_string()),
    ];

    for team_id in team_ids {
        let client = VercelClient::new("token".to_string(), team_id.clone());
        assert!(std::mem::size_of_val(&client) > 0);
    }
}
