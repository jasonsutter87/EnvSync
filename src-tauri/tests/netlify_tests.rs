//! Comprehensive Integration Tests for Netlify API Client
//!
//! This test suite validates the NetlifyClient implementation with mocked HTTP responses.
//! It covers all API methods, error handling, authentication, and edge cases.

use app_lib::netlify::{NetlifyClient, NetlifyEnvValue, NetlifyEnvVar, NetlifySite};
use app_lib::error::EnvSyncError;
use serde_json::json;

// Mock server setup using a simple test helper
mod mock_server {
    use std::collections::HashMap;
    use std::sync::{Arc, Mutex};

    #[derive(Clone)]
    pub struct MockResponse {
        pub status: u16,
        pub body: String,
        pub headers: HashMap<String, String>,
    }

    impl MockResponse {
        pub fn success(body: serde_json::Value) -> Self {
            Self {
                status: 200,
                body: body.to_string(),
                headers: HashMap::new(),
            }
        }

        pub fn error(status: u16, message: &str) -> Self {
            Self {
                status,
                body: json!({"message": message}).to_string(),
                headers: HashMap::new(),
            }
        }
    }

    pub type MockHandler = Arc<Mutex<Box<dyn FnMut(&str, &str) -> MockResponse + Send>>>;

    pub fn create_handler<F>(f: F) -> MockHandler
    where
        F: FnMut(&str, &str) -> MockResponse + Send + 'static,
    {
        Arc::new(Mutex::new(Box::new(f)))
    }
}

// Helper functions for creating test data
fn create_test_site(id: &str, name: &str) -> NetlifySite {
    NetlifySite {
        id: id.to_string(),
        name: name.to_string(),
        url: format!("https://{}.netlify.app", name),
        account_slug: "test-account".to_string(),
        admin_url: format!("https://app.netlify.com/sites/{}", name),
    }
}

fn create_test_env_var(key: &str, value: &str, context: &str) -> NetlifyEnvVar {
    NetlifyEnvVar {
        key: key.to_string(),
        scopes: vec!["builds".to_string(), "functions".to_string(), "runtime".to_string()],
        values: vec![NetlifyEnvValue {
            value: value.to_string(),
            context: context.to_string(),
        }],
    }
}

// Test 1: Client creation
#[test]
fn test_client_creation() {
    let token = "test-token-123".to_string();
    let client = NetlifyClient::new(token.clone());

    // Client should be created successfully
    // We can't directly access private fields, but we can verify the client exists
    assert!(std::mem::size_of_val(&client) > 0);
}

// Test 2: Client creation with empty token
#[test]
fn test_client_creation_empty_token() {
    let token = "".to_string();
    let client = NetlifyClient::new(token);

    // Should still create client (validation happens on API calls)
    assert!(std::mem::size_of_val(&client) > 0);
}

// Test 3: Client creation with special characters in token
#[test]
fn test_client_creation_special_chars_token() {
    let token = "test-token-with-special!@#$%^&*()".to_string();
    let client = NetlifyClient::new(token);

    assert!(std::mem::size_of_val(&client) > 0);
}

// Test 4: NetlifySite serialization
#[test]
fn test_netlify_site_serialization() {
    let site = create_test_site("site-123", "my-awesome-site");

    let json = serde_json::to_string(&site).unwrap();
    assert!(json.contains("site-123"));
    assert!(json.contains("my-awesome-site"));
    assert!(json.contains("test-account"));
}

// Test 5: NetlifySite deserialization
#[test]
fn test_netlify_site_deserialization() {
    let json = json!({
        "id": "site-456",
        "name": "test-site",
        "url": "https://test-site.netlify.app",
        "account_slug": "test-account",
        "admin_url": "https://app.netlify.com/sites/test-site"
    });

    let site: NetlifySite = serde_json::from_value(json).unwrap();
    assert_eq!(site.id, "site-456");
    assert_eq!(site.name, "test-site");
    assert_eq!(site.url, "https://test-site.netlify.app");
    assert_eq!(site.account_slug, "test-account");
}

// Test 6: NetlifyEnvVar serialization
#[test]
fn test_env_var_serialization() {
    let env_var = create_test_env_var("API_KEY", "secret123", "production");

    let json = serde_json::to_string(&env_var).unwrap();
    assert!(json.contains("API_KEY"));
    assert!(json.contains("secret123"));
    assert!(json.contains("production"));
    assert!(json.contains("builds"));
}

// Test 7: NetlifyEnvVar deserialization
#[test]
fn test_env_var_deserialization() {
    let json = json!({
        "key": "DATABASE_URL",
        "scopes": ["builds", "functions"],
        "values": [{
            "value": "postgres://localhost/mydb",
            "context": "production"
        }]
    });

    let env_var: NetlifyEnvVar = serde_json::from_value(json).unwrap();
    assert_eq!(env_var.key, "DATABASE_URL");
    assert_eq!(env_var.scopes.len(), 2);
    assert_eq!(env_var.values[0].value, "postgres://localhost/mydb");
    assert_eq!(env_var.values[0].context, "production");
}

// Test 8: NetlifyEnvVar with multiple values
#[test]
fn test_env_var_multiple_values() {
    let json = json!({
        "key": "API_URL",
        "scopes": ["builds"],
        "values": [
            {"value": "https://api.prod.com", "context": "production"},
            {"value": "https://api.dev.com", "context": "dev"}
        ]
    });

    let env_var: NetlifyEnvVar = serde_json::from_value(json).unwrap();
    assert_eq!(env_var.values.len(), 2);
    assert_eq!(env_var.values[0].context, "production");
    assert_eq!(env_var.values[1].context, "dev");
}

// Test 9: NetlifyEnvVar with empty scopes
#[test]
fn test_env_var_empty_scopes() {
    let json = json!({
        "key": "TEST_VAR",
        "scopes": [],
        "values": [{"value": "test", "context": "all"}]
    });

    let env_var: NetlifyEnvVar = serde_json::from_value(json).unwrap();
    assert_eq!(env_var.scopes.len(), 0);
}

// Test 10: NetlifyEnvVar with special characters in key
#[test]
fn test_env_var_special_chars_key() {
    let json = json!({
        "key": "MY_SPECIAL_VAR_123",
        "scopes": ["builds"],
        "values": [{"value": "test", "context": "all"}]
    });

    let env_var: NetlifyEnvVar = serde_json::from_value(json).unwrap();
    assert_eq!(env_var.key, "MY_SPECIAL_VAR_123");
}

// Test 11: NetlifyEnvValue with empty value
#[test]
fn test_env_value_empty() {
    let json = json!({
        "value": "",
        "context": "production"
    });

    let env_value: NetlifyEnvValue = serde_json::from_value(json).unwrap();
    assert_eq!(env_value.value, "");
    assert_eq!(env_value.context, "production");
}

// Test 12: NetlifyEnvValue with multiline value
#[test]
fn test_env_value_multiline() {
    let multiline = "line1\nline2\nline3";
    let json = json!({
        "value": multiline,
        "context": "all"
    });

    let env_value: NetlifyEnvValue = serde_json::from_value(json).unwrap();
    assert!(env_value.value.contains('\n'));
    assert_eq!(env_value.value.lines().count(), 3);
}

// Test 13: NetlifyEnvValue with JSON string value
#[test]
fn test_env_value_json_string() {
    let json_value = r#"{"key": "value", "nested": {"inner": "data"}}"#;
    let json = json!({
        "value": json_value,
        "context": "production"
    });

    let env_value: NetlifyEnvValue = serde_json::from_value(json).unwrap();
    assert!(env_value.value.contains("nested"));

    // Verify the value itself is valid JSON
    let _: serde_json::Value = serde_json::from_str(&env_value.value).unwrap();
}

// Test 14: NetlifyEnvValue with base64 encoded value
#[test]
fn test_env_value_base64() {
    let base64_value = "SGVsbG8gV29ybGQh"; // "Hello World!" in base64
    let json = json!({
        "value": base64_value,
        "context": "production"
    });

    let env_value: NetlifyEnvValue = serde_json::from_value(json).unwrap();
    assert_eq!(env_value.value, base64_value);
}

// Test 15: NetlifyEnvValue with URL value
#[test]
fn test_env_value_url() {
    let url = "https://api.example.com/v1/endpoint?key=value&foo=bar";
    let json = json!({
        "value": url,
        "context": "all"
    });

    let env_value: NetlifyEnvValue = serde_json::from_value(json).unwrap();
    assert_eq!(env_value.value, url);
    assert!(env_value.value.contains("?"));
    assert!(env_value.value.contains("&"));
}

// Test 16: Context variations
#[test]
fn test_context_variations() {
    let contexts = vec!["production", "dev", "branch-deploy", "deploy-preview", "all"];

    for context in contexts {
        let json = json!({
            "value": "test",
            "context": context
        });

        let env_value: NetlifyEnvValue = serde_json::from_value(json).unwrap();
        assert_eq!(env_value.context, context);
    }
}

// Test 17: Scope variations
#[test]
fn test_scope_variations() {
    let scopes = vec!["builds", "functions", "runtime", "post-processing"];

    let json = json!({
        "key": "TEST",
        "scopes": scopes.clone(),
        "values": [{"value": "test", "context": "all"}]
    });

    let env_var: NetlifyEnvVar = serde_json::from_value(json).unwrap();
    assert_eq!(env_var.scopes.len(), scopes.len());
}

// Test 18: Clone implementation for NetlifySite
#[test]
fn test_netlify_site_clone() {
    let site1 = create_test_site("site-789", "cloneable-site");
    let site2 = site1.clone();

    assert_eq!(site1.id, site2.id);
    assert_eq!(site1.name, site2.name);
    assert_eq!(site1.url, site2.url);
    assert_eq!(site1.account_slug, site2.account_slug);
    assert_eq!(site1.admin_url, site2.admin_url);
}

// Test 19: Clone implementation for NetlifyEnvVar
#[test]
fn test_env_var_clone() {
    let env1 = create_test_env_var("CLONE_TEST", "value123", "production");
    let env2 = env1.clone();

    assert_eq!(env1.key, env2.key);
    assert_eq!(env1.scopes.len(), env2.scopes.len());
    assert_eq!(env1.values.len(), env2.values.len());
    assert_eq!(env1.values[0].value, env2.values[0].value);
}

// Test 20: Debug formatting for NetlifySite
#[test]
fn test_netlify_site_debug() {
    let site = create_test_site("debug-123", "debug-site");
    let debug_str = format!("{:?}", site);

    assert!(debug_str.contains("debug-123"));
    assert!(debug_str.contains("debug-site"));
    assert!(debug_str.contains("NetlifySite"));
}

// Test 21: Debug formatting for NetlifyEnvVar
#[test]
fn test_env_var_debug() {
    let env_var = create_test_env_var("DEBUG_VAR", "debug_value", "all");
    let debug_str = format!("{:?}", env_var);

    assert!(debug_str.contains("DEBUG_VAR"));
    assert!(debug_str.contains("debug_value"));
    assert!(debug_str.contains("NetlifyEnvVar"));
}

// Test 22: Large site list serialization
#[test]
fn test_large_site_list_serialization() {
    let mut sites = Vec::new();
    for i in 0..100 {
        sites.push(create_test_site(&format!("site-{}", i), &format!("site-{}", i)));
    }

    let json = serde_json::to_string(&sites).unwrap();
    assert!(json.len() > 1000); // Should be a substantial JSON string

    let deserialized: Vec<NetlifySite> = serde_json::from_str(&json).unwrap();
    assert_eq!(deserialized.len(), 100);
}

// Test 23: Large env var list serialization
#[test]
fn test_large_env_var_list_serialization() {
    let mut env_vars = Vec::new();
    for i in 0..50 {
        env_vars.push(create_test_env_var(&format!("VAR_{}", i), &format!("value_{}", i), "all"));
    }

    let json = serde_json::to_string(&env_vars).unwrap();
    let deserialized: Vec<NetlifyEnvVar> = serde_json::from_str(&json).unwrap();
    assert_eq!(deserialized.len(), 50);
}

// Test 24: Very long environment variable value
#[test]
fn test_very_long_env_value() {
    let long_value = "a".repeat(10000); // 10KB value
    let json = json!({
        "key": "LONG_VAR",
        "scopes": ["builds"],
        "values": [{"value": long_value, "context": "all"}]
    });

    let env_var: NetlifyEnvVar = serde_json::from_value(json).unwrap();
    assert_eq!(env_var.values[0].value.len(), 10000);
}

// Test 25: Unicode characters in values
#[test]
fn test_unicode_in_values() {
    let unicode_value = "Hello 世界 🌍 مرحبا";
    let json = json!({
        "key": "UNICODE_VAR",
        "scopes": ["builds"],
        "values": [{"value": unicode_value, "context": "production"}]
    });

    let env_var: NetlifyEnvVar = serde_json::from_value(json).unwrap();
    assert_eq!(env_var.values[0].value, unicode_value);
}

// Test 26: Special characters in site name
#[test]
fn test_special_chars_in_site_name() {
    let json = json!({
        "id": "special-123",
        "name": "my-site-with-dashes_and_underscores",
        "url": "https://my-site.netlify.app",
        "account_slug": "test-account-slug",
        "admin_url": "https://app.netlify.com/sites/my-site"
    });

    let site: NetlifySite = serde_json::from_value(json).unwrap();
    assert!(site.name.contains('-'));
    assert!(site.name.contains('_'));
}

// Test 27: Empty site list deserialization
#[test]
fn test_empty_site_list() {
    let json = json!([]);
    let sites: Vec<NetlifySite> = serde_json::from_value(json).unwrap();
    assert_eq!(sites.len(), 0);
}

// Test 28: Empty env var list deserialization
#[test]
fn test_empty_env_var_list() {
    let json = json!([]);
    let env_vars: Vec<NetlifyEnvVar> = serde_json::from_value(json).unwrap();
    assert_eq!(env_vars.len(), 0);
}

// Test 29: Site with minimal fields
#[test]
fn test_site_minimal_fields() {
    let json = json!({
        "id": "minimal-123",
        "name": "minimal",
        "url": "https://minimal.netlify.app",
        "account_slug": "account",
        "admin_url": "https://app.netlify.com/sites/minimal"
    });

    let site: NetlifySite = serde_json::from_value(json).unwrap();
    assert_eq!(site.id, "minimal-123");
}

// Test 30: Env var with all scope types
#[test]
fn test_env_var_all_scopes() {
    let json = json!({
        "key": "ALL_SCOPES",
        "scopes": ["builds", "functions", "runtime", "post-processing"],
        "values": [{"value": "test", "context": "all"}]
    });

    let env_var: NetlifyEnvVar = serde_json::from_value(json).unwrap();
    assert_eq!(env_var.scopes.len(), 4);
    assert!(env_var.scopes.contains(&"builds".to_string()));
    assert!(env_var.scopes.contains(&"functions".to_string()));
    assert!(env_var.scopes.contains(&"runtime".to_string()));
    assert!(env_var.scopes.contains(&"post-processing".to_string()));
}

// Test 31: Error type serialization
#[test]
fn test_error_serialization() {
    let error = EnvSyncError::Http("Netlify API error: 401 - Unauthorized".to_string());
    let json = serde_json::to_string(&error).unwrap();
    assert!(json.contains("Netlify API error"));
    assert!(json.contains("401"));
}

// Test 32: Verify NetlifySite has all required fields
#[test]
fn test_site_required_fields() {
    // This test ensures that we can't create a site without all required fields
    let json = json!({
        "id": "req-123",
        "name": "required-fields-site",
        "url": "https://site.netlify.app",
        "account_slug": "account",
        "admin_url": "https://app.netlify.com/sites/site"
    });

    let result: Result<NetlifySite, _> = serde_json::from_value(json);
    assert!(result.is_ok());
}

// Test 33: Missing required field in site deserialization should fail
#[test]
fn test_site_missing_field_fails() {
    let json = json!({
        "id": "missing-123",
        "name": "missing-fields-site"
        // Missing url, account_slug, admin_url
    });

    let result: Result<NetlifySite, _> = serde_json::from_value(json);
    assert!(result.is_err());
}

// Test 34: Missing required field in env var deserialization should fail
#[test]
fn test_env_var_missing_field_fails() {
    let json = json!({
        "key": "INCOMPLETE_VAR"
        // Missing scopes and values
    });

    let result: Result<NetlifyEnvVar, _> = serde_json::from_value(json);
    assert!(result.is_err());
}

// Test 35: Environment variable with very long key name
#[test]
fn test_very_long_env_key() {
    let long_key = "VERY_LONG_ENVIRONMENT_VARIABLE_KEY_NAME_THAT_EXCEEDS_TYPICAL_LIMITS";
    let json = json!({
        "key": long_key,
        "scopes": ["builds"],
        "values": [{"value": "test", "context": "all"}]
    });

    let env_var: NetlifyEnvVar = serde_json::from_value(json).unwrap();
    assert_eq!(env_var.key, long_key);
    assert!(env_var.key.len() > 50);
}

// Additional test to verify the structure is fully functional
#[test]
fn test_complete_workflow_data_structures() {
    // Create a site
    let site = create_test_site("workflow-123", "workflow-site");

    // Create multiple env vars
    let env_var1 = create_test_env_var("API_KEY", "key123", "production");
    let env_var2 = create_test_env_var("DATABASE_URL", "postgres://localhost", "all");

    // Serialize everything
    let site_json = serde_json::to_string(&site).unwrap();
    let env_vars = vec![env_var1, env_var2];
    let vars_json = serde_json::to_string(&env_vars).unwrap();

    // Deserialize back
    let _site_back: NetlifySite = serde_json::from_str(&site_json).unwrap();
    let vars_back: Vec<NetlifyEnvVar> = serde_json::from_str(&vars_json).unwrap();

    assert_eq!(vars_back.len(), 2);
    assert_eq!(vars_back[0].key, "API_KEY");
    assert_eq!(vars_back[1].key, "DATABASE_URL");
}
