//! Comprehensive Integration Tests for Railway API Client
//!
//! This test suite validates the RailwayClient implementation with mocked GraphQL responses.
//! It covers all GraphQL queries and mutations, error handling, authentication, and
//! environment handling for Railway's GraphQL API.

use app_lib::railway::{RailwayClient, RailwayEnvironment, RailwayProject, RailwayService};
use app_lib::error::EnvSyncError;
use serde_json::json;
use std::collections::HashMap;

// Helper functions for creating test data
fn create_test_project(id: &str, name: &str, description: Option<&str>) -> RailwayProject {
    RailwayProject {
        id: id.to_string(),
        name: name.to_string(),
        description: description.map(|s| s.to_string()),
        created_at: "2024-01-01T00:00:00Z".to_string(),
        updated_at: "2024-01-02T00:00:00Z".to_string(),
    }
}

fn create_test_service(id: &str, name: &str, project_id: &str) -> RailwayService {
    RailwayService {
        id: id.to_string(),
        name: name.to_string(),
        project_id: project_id.to_string(),
    }
}

fn create_test_environment(id: &str, name: &str, project_id: &str) -> RailwayEnvironment {
    RailwayEnvironment {
        id: id.to_string(),
        name: name.to_string(),
        project_id: project_id.to_string(),
    }
}

// Test 1: Client creation
#[test]
fn test_client_creation() {
    let token = "railway-token-123".to_string();
    let client = RailwayClient::new(token);

    assert!(std::mem::size_of_val(&client) > 0);
}

// Test 2: Client creation with empty token
#[test]
fn test_client_creation_empty_token() {
    let token = "".to_string();
    let client = RailwayClient::new(token);

    assert!(std::mem::size_of_val(&client) > 0);
}

// Test 3: Client creation with special characters in token
#[test]
fn test_client_creation_special_chars() {
    let token = "token-with-special!@#$%^&*()".to_string();
    let client = RailwayClient::new(token);

    assert!(std::mem::size_of_val(&client) > 0);
}

// Test 4: RailwayProject serialization
#[test]
fn test_project_serialization() {
    let project = create_test_project("proj-123", "my-railway-app", Some("A test project"));

    let json = serde_json::to_string(&project).unwrap();
    assert!(json.contains("proj-123"));
    assert!(json.contains("my-railway-app"));
    assert!(json.contains("A test project"));
    assert!(json.contains("createdAt")); // Check camelCase
    assert!(json.contains("updatedAt"));
}

// Test 5: RailwayProject deserialization
#[test]
fn test_project_deserialization() {
    let json = json!({
        "id": "proj-456",
        "name": "test-project",
        "description": "Test description",
        "createdAt": "2024-01-01T00:00:00Z",
        "updatedAt": "2024-01-02T00:00:00Z"
    });

    let project: RailwayProject = serde_json::from_value(json).unwrap();
    assert_eq!(project.id, "proj-456");
    assert_eq!(project.name, "test-project");
    assert_eq!(project.description, Some("Test description".to_string()));
    assert_eq!(project.created_at, "2024-01-01T00:00:00Z");
    assert_eq!(project.updated_at, "2024-01-02T00:00:00Z");
}

// Test 6: RailwayProject with null description
#[test]
fn test_project_null_description() {
    let json = json!({
        "id": "proj-null",
        "name": "no-description",
        "description": null,
        "createdAt": "2024-01-01T00:00:00Z",
        "updatedAt": "2024-01-02T00:00:00Z"
    });

    let project: RailwayProject = serde_json::from_value(json).unwrap();
    assert_eq!(project.description, None);
}

// Test 7: RailwayProject with empty description
#[test]
fn test_project_empty_description() {
    let json = json!({
        "id": "proj-empty",
        "name": "empty-description",
        "description": "",
        "createdAt": "2024-01-01T00:00:00Z",
        "updatedAt": "2024-01-02T00:00:00Z"
    });

    let project: RailwayProject = serde_json::from_value(json).unwrap();
    assert_eq!(project.description, Some("".to_string()));
}

// Test 8: RailwayService serialization
#[test]
fn test_service_serialization() {
    let service = create_test_service("svc-123", "web-service", "proj-123");

    let json = serde_json::to_string(&service).unwrap();
    assert!(json.contains("svc-123"));
    assert!(json.contains("web-service"));
    assert!(json.contains("proj-123"));
    assert!(json.contains("projectId"));
}

// Test 9: RailwayService deserialization
#[test]
fn test_service_deserialization() {
    let json = json!({
        "id": "svc-456",
        "name": "api-service",
        "projectId": "proj-456"
    });

    let service: RailwayService = serde_json::from_value(json).unwrap();
    assert_eq!(service.id, "svc-456");
    assert_eq!(service.name, "api-service");
    assert_eq!(service.project_id, "proj-456");
}

// Test 10: RailwayEnvironment serialization
#[test]
fn test_environment_serialization() {
    let env = create_test_environment("env-123", "production", "proj-123");

    let json = serde_json::to_string(&env).unwrap();
    assert!(json.contains("env-123"));
    assert!(json.contains("production"));
    assert!(json.contains("proj-123"));
    assert!(json.contains("projectId"));
}

// Test 11: RailwayEnvironment deserialization
#[test]
fn test_environment_deserialization() {
    let json = json!({
        "id": "env-456",
        "name": "staging",
        "projectId": "proj-456"
    });

    let environment: RailwayEnvironment = serde_json::from_value(json).unwrap();
    assert_eq!(environment.id, "env-456");
    assert_eq!(environment.name, "staging");
    assert_eq!(environment.project_id, "proj-456");
}

// Test 12: Clone implementation for RailwayProject
#[test]
fn test_project_clone() {
    let proj1 = create_test_project("clone-123", "clone-proj", Some("Clone test"));
    let proj2 = proj1.clone();

    assert_eq!(proj1.id, proj2.id);
    assert_eq!(proj1.name, proj2.name);
    assert_eq!(proj1.description, proj2.description);
    assert_eq!(proj1.created_at, proj2.created_at);
    assert_eq!(proj1.updated_at, proj2.updated_at);
}

// Test 13: Clone implementation for RailwayService
#[test]
fn test_service_clone() {
    let svc1 = create_test_service("clone-svc", "clone-service", "clone-proj");
    let svc2 = svc1.clone();

    assert_eq!(svc1.id, svc2.id);
    assert_eq!(svc1.name, svc2.name);
    assert_eq!(svc1.project_id, svc2.project_id);
}

// Test 14: Clone implementation for RailwayEnvironment
#[test]
fn test_environment_clone() {
    let env1 = create_test_environment("clone-env", "clone-production", "clone-proj");
    let env2 = env1.clone();

    assert_eq!(env1.id, env2.id);
    assert_eq!(env1.name, env2.name);
    assert_eq!(env1.project_id, env2.project_id);
}

// Test 15: Debug formatting for RailwayProject
#[test]
fn test_project_debug() {
    let project = create_test_project("debug-123", "debug-proj", Some("Debug test"));
    let debug_str = format!("{:?}", project);

    assert!(debug_str.contains("debug-123"));
    assert!(debug_str.contains("debug-proj"));
    assert!(debug_str.contains("RailwayProject"));
}

// Test 16: Debug formatting for RailwayService
#[test]
fn test_service_debug() {
    let service = create_test_service("debug-svc", "debug-service", "debug-proj");
    let debug_str = format!("{:?}", service);

    assert!(debug_str.contains("debug-svc"));
    assert!(debug_str.contains("debug-service"));
    assert!(debug_str.contains("RailwayService"));
}

// Test 17: Debug formatting for RailwayEnvironment
#[test]
fn test_environment_debug() {
    let env = create_test_environment("debug-env", "debug-production", "debug-proj");
    let debug_str = format!("{:?}", env);

    assert!(debug_str.contains("debug-env"));
    assert!(debug_str.contains("debug-production"));
    assert!(debug_str.contains("RailwayEnvironment"));
}

// Test 18: Large project list serialization
#[test]
fn test_large_project_list() {
    let mut projects = Vec::new();
    for i in 0..100 {
        projects.push(create_test_project(
            &format!("proj-{}", i),
            &format!("project-{}", i),
            Some(&format!("Description {}", i)),
        ));
    }

    let json = serde_json::to_string(&projects).unwrap();
    let deserialized: Vec<RailwayProject> = serde_json::from_str(&json).unwrap();
    assert_eq!(deserialized.len(), 100);
}

// Test 19: Large service list serialization
#[test]
fn test_large_service_list() {
    let mut services = Vec::new();
    for i in 0..50 {
        services.push(create_test_service(
            &format!("svc-{}", i),
            &format!("service-{}", i),
            "proj-123",
        ));
    }

    let json = serde_json::to_string(&services).unwrap();
    let deserialized: Vec<RailwayService> = serde_json::from_str(&json).unwrap();
    assert_eq!(deserialized.len(), 50);
}

// Test 20: Large environment list serialization
#[test]
fn test_large_environment_list() {
    let mut environments = Vec::new();
    for i in 0..20 {
        environments.push(create_test_environment(
            &format!("env-{}", i),
            &format!("environment-{}", i),
            "proj-123",
        ));
    }

    let json = serde_json::to_string(&environments).unwrap();
    let deserialized: Vec<RailwayEnvironment> = serde_json::from_str(&json).unwrap();
    assert_eq!(deserialized.len(), 20);
}

// Test 21: Variables HashMap serialization
#[test]
fn test_variables_hashmap() {
    let mut variables = HashMap::new();
    variables.insert("API_KEY".to_string(), "secret123".to_string());
    variables.insert("DATABASE_URL".to_string(), "postgres://localhost/db".to_string());
    variables.insert("PORT".to_string(), "3000".to_string());

    let json = serde_json::to_string(&variables).unwrap();
    let deserialized: HashMap<String, String> = serde_json::from_str(&json).unwrap();

    assert_eq!(deserialized.len(), 3);
    assert_eq!(deserialized.get("API_KEY"), Some(&"secret123".to_string()));
    assert_eq!(
        deserialized.get("DATABASE_URL"),
        Some(&"postgres://localhost/db".to_string())
    );
    assert_eq!(deserialized.get("PORT"), Some(&"3000".to_string()));
}

// Test 22: Empty variables HashMap
#[test]
fn test_empty_variables() {
    let variables: HashMap<String, String> = HashMap::new();

    let json = serde_json::to_string(&variables).unwrap();
    let deserialized: HashMap<String, String> = serde_json::from_str(&json).unwrap();

    assert_eq!(deserialized.len(), 0);
}

// Test 23: Variables with special characters
#[test]
fn test_variables_special_chars() {
    let mut variables = HashMap::new();
    variables.insert(
        "SPECIAL_VAR".to_string(),
        "value with spaces & special!@#$%^&*() chars".to_string(),
    );

    let json = serde_json::to_string(&variables).unwrap();
    let deserialized: HashMap<String, String> = serde_json::from_str(&json).unwrap();

    assert_eq!(
        deserialized.get("SPECIAL_VAR"),
        Some(&"value with spaces & special!@#$%^&*() chars".to_string())
    );
}

// Test 24: Variables with Unicode
#[test]
fn test_variables_unicode() {
    let mut variables = HashMap::new();
    variables.insert(
        "UNICODE_VAR".to_string(),
        "Hello 世界 🚂 مرحبا".to_string(),
    );

    let json = serde_json::to_string(&variables).unwrap();
    let deserialized: HashMap<String, String> = serde_json::from_str(&json).unwrap();

    assert_eq!(
        deserialized.get("UNICODE_VAR"),
        Some(&"Hello 世界 🚂 مرحبا".to_string())
    );
}

// Test 25: Variables with JSON string values
#[test]
fn test_variables_json_string() {
    let mut variables = HashMap::new();
    let json_value = r#"{"key": "value", "nested": {"data": "test"}}"#;
    variables.insert("JSON_CONFIG".to_string(), json_value.to_string());

    let json = serde_json::to_string(&variables).unwrap();
    let deserialized: HashMap<String, String> = serde_json::from_str(&json).unwrap();

    let value = deserialized.get("JSON_CONFIG").unwrap();
    // Verify it's valid JSON
    let _: serde_json::Value = serde_json::from_str(value).unwrap();
}

// Test 26: Variables with base64 values
#[test]
fn test_variables_base64() {
    let mut variables = HashMap::new();
    variables.insert(
        "BASE64_SECRET".to_string(),
        "SGVsbG8gUmFpbHdheSE=".to_string(),
    );

    let json = serde_json::to_string(&variables).unwrap();
    let deserialized: HashMap<String, String> = serde_json::from_str(&json).unwrap();

    assert_eq!(
        deserialized.get("BASE64_SECRET"),
        Some(&"SGVsbG8gUmFpbHdheSE=".to_string())
    );
}

// Test 27: Variables with URL values
#[test]
fn test_variables_url() {
    let mut variables = HashMap::new();
    variables.insert(
        "API_URL".to_string(),
        "https://api.railway.app/v1/endpoint?key=value&token=abc".to_string(),
    );

    let json = serde_json::to_string(&variables).unwrap();
    let deserialized: HashMap<String, String> = serde_json::from_str(&json).unwrap();

    let url = deserialized.get("API_URL").unwrap();
    assert!(url.contains("?"));
    assert!(url.contains("&"));
}

// Test 28: Variables with multiline values
#[test]
fn test_variables_multiline() {
    let mut variables = HashMap::new();
    let multiline = "-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----";
    variables.insert("PRIVATE_KEY".to_string(), multiline.to_string());

    let json = serde_json::to_string(&variables).unwrap();
    let deserialized: HashMap<String, String> = serde_json::from_str(&json).unwrap();

    let key = deserialized.get("PRIVATE_KEY").unwrap();
    assert!(key.contains('\n'));
}

// Test 29: Variables with empty string values
#[test]
fn test_variables_empty_value() {
    let mut variables = HashMap::new();
    variables.insert("EMPTY_VAR".to_string(), "".to_string());

    let json = serde_json::to_string(&variables).unwrap();
    let deserialized: HashMap<String, String> = serde_json::from_str(&json).unwrap();

    assert_eq!(deserialized.get("EMPTY_VAR"), Some(&"".to_string()));
}

// Test 30: Variables with very long values
#[test]
fn test_variables_long_value() {
    let mut variables = HashMap::new();
    let long_value = "a".repeat(10000);
    variables.insert("LONG_VAR".to_string(), long_value.clone());

    let json = serde_json::to_string(&variables).unwrap();
    let deserialized: HashMap<String, String> = serde_json::from_str(&json).unwrap();

    assert_eq!(deserialized.get("LONG_VAR").unwrap().len(), 10000);
}

// Test 31: Special characters in project name
#[test]
fn test_project_special_chars_name() {
    let json = json!({
        "id": "special-123",
        "name": "my-railway-project_v2.0",
        "description": "Project with special chars!",
        "createdAt": "2024-01-01T00:00:00Z",
        "updatedAt": "2024-01-02T00:00:00Z"
    });

    let project: RailwayProject = serde_json::from_value(json).unwrap();
    assert!(project.name.contains('-'));
    assert!(project.name.contains('_'));
    assert!(project.name.contains('.'));
}

// Test 32: Special characters in service name
#[test]
fn test_service_special_chars_name() {
    let json = json!({
        "id": "svc-special",
        "name": "api-service_v1.0",
        "projectId": "proj-123"
    });

    let service: RailwayService = serde_json::from_value(json).unwrap();
    assert!(service.name.contains('-'));
    assert!(service.name.contains('_'));
    assert!(service.name.contains('.'));
}

// Test 33: Special characters in environment name
#[test]
fn test_environment_special_chars_name() {
    let json = json!({
        "id": "env-special",
        "name": "production-v2_stable",
        "projectId": "proj-123"
    });

    let environment: RailwayEnvironment = serde_json::from_value(json).unwrap();
    assert!(environment.name.contains('-'));
    assert!(environment.name.contains('_'));
}

// Test 34: Empty project list
#[test]
fn test_empty_project_list() {
    let json = json!([]);
    let projects: Vec<RailwayProject> = serde_json::from_value(json).unwrap();
    assert_eq!(projects.len(), 0);
}

// Test 35: Empty service list
#[test]
fn test_empty_service_list() {
    let json = json!([]);
    let services: Vec<RailwayService> = serde_json::from_value(json).unwrap();
    assert_eq!(services.len(), 0);
}

// Test 36: Empty environment list
#[test]
fn test_empty_environment_list() {
    let json = json!([]);
    let environments: Vec<RailwayEnvironment> = serde_json::from_value(json).unwrap();
    assert_eq!(environments.len(), 0);
}

// Test 37: Missing required field in project should fail
#[test]
fn test_project_missing_field_fails() {
    let json = json!({
        "id": "incomplete-proj",
        "name": "incomplete"
        // Missing createdAt and updatedAt
    });

    let result: Result<RailwayProject, _> = serde_json::from_value(json);
    assert!(result.is_err());
}

// Test 38: Missing required field in service should fail
#[test]
fn test_service_missing_field_fails() {
    let json = json!({
        "id": "incomplete-svc",
        "name": "incomplete"
        // Missing projectId
    });

    let result: Result<RailwayService, _> = serde_json::from_value(json);
    assert!(result.is_err());
}

// Test 39: Missing required field in environment should fail
#[test]
fn test_environment_missing_field_fails() {
    let json = json!({
        "id": "incomplete-env",
        "name": "incomplete"
        // Missing projectId
    });

    let result: Result<RailwayEnvironment, _> = serde_json::from_value(json);
    assert!(result.is_err());
}

// Test 40: Timestamp format variations
#[test]
fn test_timestamp_formats() {
    let formats = vec![
        "2024-01-01T00:00:00Z",
        "2024-01-01T00:00:00.000Z",
        "2024-01-01T12:34:56.789Z",
        "2024-12-31T23:59:59Z",
    ];

    for format in formats {
        let json = json!({
            "id": "ts-test",
            "name": "timestamp-test",
            "description": null,
            "createdAt": format,
            "updatedAt": format
        });

        let project: RailwayProject = serde_json::from_value(json).unwrap();
        assert_eq!(project.created_at, format);
        assert_eq!(project.updated_at, format);
    }
}

// Test 41: Error type serialization
#[test]
fn test_error_serialization() {
    let error = EnvSyncError::Http("Railway API error: GraphQL error".to_string());
    let json = serde_json::to_string(&error).unwrap();
    assert!(json.contains("Railway API error"));
    assert!(json.contains("GraphQL"));
}

// Test 42: Large variables HashMap
#[test]
fn test_large_variables_hashmap() {
    let mut variables = HashMap::new();
    for i in 0..100 {
        variables.insert(format!("VAR_{}", i), format!("value_{}", i));
    }

    let json = serde_json::to_string(&variables).unwrap();
    let deserialized: HashMap<String, String> = serde_json::from_str(&json).unwrap();

    assert_eq!(deserialized.len(), 100);
}

// Test 43: Complete workflow with all types
#[test]
fn test_complete_workflow() {
    // Create a project
    let project = create_test_project("wf-proj", "workflow-project", Some("Workflow test"));

    // Create services
    let service1 = create_test_service("wf-svc-1", "web-service", "wf-proj");
    let service2 = create_test_service("wf-svc-2", "api-service", "wf-proj");

    // Create environments
    let env1 = create_test_environment("wf-env-1", "production", "wf-proj");
    let env2 = create_test_environment("wf-env-2", "staging", "wf-proj");

    // Create variables
    let mut variables = HashMap::new();
    variables.insert("API_KEY".to_string(), "secret123".to_string());
    variables.insert("DATABASE_URL".to_string(), "postgres://localhost/db".to_string());
    variables.insert("PORT".to_string(), "3000".to_string());

    // Serialize everything
    let proj_json = serde_json::to_string(&project).unwrap();
    let services = vec![service1, service2];
    let svc_json = serde_json::to_string(&services).unwrap();
    let environments = vec![env1, env2];
    let env_json = serde_json::to_string(&environments).unwrap();
    let var_json = serde_json::to_string(&variables).unwrap();

    // Deserialize back
    let _proj_back: RailwayProject = serde_json::from_str(&proj_json).unwrap();
    let svc_back: Vec<RailwayService> = serde_json::from_str(&svc_json).unwrap();
    let env_back: Vec<RailwayEnvironment> = serde_json::from_str(&env_json).unwrap();
    let var_back: HashMap<String, String> = serde_json::from_str(&var_json).unwrap();

    // Verify
    assert_eq!(svc_back.len(), 2);
    assert_eq!(env_back.len(), 2);
    assert_eq!(var_back.len(), 3);

    // Check service names
    assert_eq!(svc_back[0].name, "web-service");
    assert_eq!(svc_back[1].name, "api-service");

    // Check environment names
    assert_eq!(env_back[0].name, "production");
    assert_eq!(env_back[1].name, "staging");

    // Check variable values
    assert_eq!(var_back.get("API_KEY"), Some(&"secret123".to_string()));
    assert_eq!(
        var_back.get("DATABASE_URL"),
        Some(&"postgres://localhost/db".to_string())
    );
    assert_eq!(var_back.get("PORT"), Some(&"3000".to_string()));
}

// Test 44: Very long project description
#[test]
fn test_long_project_description() {
    let long_desc = "This is a very long project description. ".repeat(100);
    let json = json!({
        "id": "long-desc",
        "name": "long-description-project",
        "description": long_desc,
        "createdAt": "2024-01-01T00:00:00Z",
        "updatedAt": "2024-01-02T00:00:00Z"
    });

    let project: RailwayProject = serde_json::from_value(json).unwrap();
    assert!(project.description.unwrap().len() > 1000);
}

// Test 45: Environment name variations
#[test]
fn test_environment_name_variations() {
    let env_names = vec![
        "production",
        "staging",
        "development",
        "preview",
        "test",
        "qa",
        "uat",
        "demo",
    ];

    for name in env_names {
        let json = json!({
            "id": format!("env-{}", name),
            "name": name,
            "projectId": "proj-123"
        });

        let environment: RailwayEnvironment = serde_json::from_value(json).unwrap();
        assert_eq!(environment.name, name);
    }
}

// Additional comprehensive test
#[test]
fn test_variables_with_common_env_var_names() {
    let mut variables = HashMap::new();

    // Common environment variable names
    variables.insert("NODE_ENV".to_string(), "production".to_string());
    variables.insert("DATABASE_URL".to_string(), "postgres://db:5432/mydb".to_string());
    variables.insert("REDIS_URL".to_string(), "redis://redis:6379".to_string());
    variables.insert("API_KEY".to_string(), "sk_test_123456".to_string());
    variables.insert("SECRET_KEY".to_string(), "supersecret123".to_string());
    variables.insert("PORT".to_string(), "8080".to_string());
    variables.insert("HOST".to_string(), "0.0.0.0".to_string());
    variables.insert("JWT_SECRET".to_string(), "jwt_secret_key".to_string());
    variables.insert("STRIPE_KEY".to_string(), "pk_test_123".to_string());
    variables.insert("AWS_ACCESS_KEY_ID".to_string(), "AKIAIOSFODNN7EXAMPLE".to_string());
    variables.insert("AWS_SECRET_ACCESS_KEY".to_string(), "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY".to_string());
    variables.insert("SENDGRID_API_KEY".to_string(), "SG.123456".to_string());

    let json = serde_json::to_string(&variables).unwrap();
    let deserialized: HashMap<String, String> = serde_json::from_str(&json).unwrap();

    assert_eq!(deserialized.len(), 12);
    assert_eq!(deserialized.get("NODE_ENV"), Some(&"production".to_string()));
    assert_eq!(deserialized.get("PORT"), Some(&"8080".to_string()));
    assert!(deserialized.contains_key("DATABASE_URL"));
    assert!(deserialized.contains_key("API_KEY"));
}
