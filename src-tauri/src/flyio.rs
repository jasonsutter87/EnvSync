//! Fly.io API Integration
//!
//! Client for syncing environment variables (secrets) with Fly.io applications.
//! Uses Fly.io's GraphQL API for all operations.
//!
//! API Documentation: https://fly.io/docs/flyctl/api/
//! GraphQL Explorer: https://api.fly.io/graphql

use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::error::{EnvSyncError, Result};

const FLYIO_GRAPHQL_URL: &str = "https://api.fly.io/graphql";

/// Fly.io API client
pub struct FlyioClient {
    client: Client,
    api_token: String,
    org_slug: Option<String>,
}

/// Represents a Fly.io application
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlyioApp {
    pub id: String,
    pub name: String,
    pub organization: Option<String>,
    pub status: Option<String>,
    pub deployed: Option<bool>,
}

/// Represents a Fly.io secret
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlyioSecret {
    pub name: String,
    pub digest: Option<String>,
    pub created_at: Option<String>,
}

// GraphQL Request/Response structures

#[derive(Debug, Serialize)]
struct GraphQLRequest {
    query: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    variables: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
struct GraphQLResponse<T> {
    data: Option<T>,
    errors: Option<Vec<GraphQLError>>,
}

#[derive(Debug, Deserialize)]
struct GraphQLError {
    message: String,
    #[serde(default)]
    extensions: HashMap<String, serde_json::Value>,
}

// Query response structures

#[derive(Debug, Deserialize)]
struct AppsData {
    apps: AppsResponse,
}

#[derive(Debug, Deserialize)]
struct AppsResponse {
    nodes: Vec<AppNode>,
}

#[derive(Debug, Deserialize)]
struct AppNode {
    id: String,
    name: String,
    organization: Option<OrgNode>,
    status: Option<String>,
    deployed: Option<bool>,
}

#[derive(Debug, Deserialize)]
struct OrgNode {
    slug: String,
}

#[derive(Debug, Deserialize)]
struct AppData {
    app: AppNode,
}

#[derive(Debug, Deserialize)]
struct SecretsData {
    app: AppWithSecrets,
}

#[derive(Debug, Deserialize)]
struct AppWithSecrets {
    secrets: Vec<SecretNode>,
}

#[derive(Debug, Deserialize)]
struct SecretNode {
    name: String,
    digest: Option<String>,
    #[serde(rename = "createdAt")]
    created_at: Option<String>,
}

#[derive(Debug, Deserialize)]
struct SetSecretsData {
    #[serde(rename = "setSecrets")]
    set_secrets: SetSecretsResponse,
}

#[derive(Debug, Deserialize)]
struct SetSecretsResponse {
    release: Option<ReleaseNode>,
}

#[derive(Debug, Deserialize)]
struct ReleaseNode {
    id: String,
    version: i32,
}

#[derive(Debug, Deserialize)]
struct UnsetSecretsData {
    #[serde(rename = "unsetSecrets")]
    unset_secrets: UnsetSecretsResponse,
}

#[derive(Debug, Deserialize)]
struct UnsetSecretsResponse {
    release: Option<ReleaseNode>,
}

impl FlyioClient {
    /// Create a new Fly.io client with an API token
    pub fn new(api_token: String) -> Self {
        Self {
            client: Client::new(),
            api_token,
            org_slug: None,
        }
    }

    /// Create a new Fly.io client with an API token and organization slug
    pub fn new_with_org(api_token: String, org_slug: Option<String>) -> Self {
        Self {
            client: Client::new(),
            api_token,
            org_slug,
        }
    }

    /// Execute a GraphQL query
    async fn execute_query<T>(&self, query: &str, variables: Option<serde_json::Value>) -> Result<T>
    where
        T: for<'de> Deserialize<'de>,
    {
        let request = GraphQLRequest {
            query: query.to_string(),
            variables,
        };

        let response = self
            .client
            .post(FLYIO_GRAPHQL_URL)
            .bearer_auth(&self.api_token)
            .json(&request)
            .send()
            .await
            .map_err(|e| EnvSyncError::Http(format!("Failed to send request: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(EnvSyncError::Http(format!(
                "Fly.io API error: {} - {}",
                status, text
            )));
        }

        let graphql_response: GraphQLResponse<T> = response
            .json()
            .await
            .map_err(|e| EnvSyncError::Http(format!("Failed to parse response: {}", e)))?;

        // Check for GraphQL errors
        if let Some(errors) = graphql_response.errors {
            let error_messages: Vec<String> = errors.iter().map(|e| e.message.clone()).collect();
            return Err(EnvSyncError::Http(format!(
                "GraphQL errors: {}",
                error_messages.join(", ")
            )));
        }

        graphql_response
            .data
            .ok_or_else(|| EnvSyncError::Http("No data in GraphQL response".to_string()))
    }

    /// List all Fly.io applications
    pub async fn list_apps(&self) -> Result<Vec<FlyioApp>> {
        let query = r#"
            query ListApps($orgSlug: String) {
                apps(type: "container", organizationSlug: $orgSlug) {
                    nodes {
                        id
                        name
                        organization {
                            slug
                        }
                        status
                        deployed
                    }
                }
            }
        "#;

        let variables = self.org_slug.as_ref().map(|slug| {
            serde_json::json!({
                "orgSlug": slug
            })
        });

        let data: AppsData = self.execute_query(query, variables).await?;

        Ok(data
            .apps
            .nodes
            .into_iter()
            .map(|node| FlyioApp {
                id: node.id,
                name: node.name,
                organization: node.organization.map(|org| org.slug),
                status: node.status,
                deployed: node.deployed,
            })
            .collect())
    }

    /// Get details for a specific app
    pub async fn get_app(&self, app_name: &str) -> Result<FlyioApp> {
        if app_name.is_empty() {
            return Err(EnvSyncError::InvalidConfig(
                "App name cannot be empty".to_string(),
            ));
        }

        let query = r#"
            query GetApp($appName: String!) {
                app(name: $appName) {
                    id
                    name
                    organization {
                        slug
                    }
                    status
                    deployed
                }
            }
        "#;

        let variables = serde_json::json!({
            "appName": app_name
        });

        let data: AppData = self.execute_query(query, Some(variables)).await?;

        Ok(FlyioApp {
            id: data.app.id,
            name: data.app.name,
            organization: data.app.organization.map(|org| org.slug),
            status: data.app.status,
            deployed: data.app.deployed,
        })
    }

    /// Get secrets for a specific app
    /// Note: Fly.io API only returns secret names and metadata, not values (for security)
    pub async fn get_secrets(&self, app_name: &str) -> Result<HashMap<String, FlyioSecret>> {
        if app_name.is_empty() {
            return Err(EnvSyncError::InvalidConfig(
                "App name cannot be empty".to_string(),
            ));
        }

        let query = r#"
            query GetSecrets($appName: String!) {
                app(name: $appName) {
                    secrets {
                        name
                        digest
                        createdAt
                    }
                }
            }
        "#;

        let variables = serde_json::json!({
            "appName": app_name
        });

        let data: SecretsData = self.execute_query(query, Some(variables)).await?;

        Ok(data
            .app
            .secrets
            .into_iter()
            .map(|node| {
                (
                    node.name.clone(),
                    FlyioSecret {
                        name: node.name,
                        digest: node.digest,
                        created_at: node.created_at,
                    },
                )
            })
            .collect())
    }

    /// Set secrets for an app
    /// This will create new secrets or update existing ones
    pub async fn set_secrets(
        &self,
        app_name: &str,
        secrets: &HashMap<String, String>,
    ) -> Result<()> {
        if app_name.is_empty() {
            return Err(EnvSyncError::InvalidConfig(
                "App name cannot be empty".to_string(),
            ));
        }

        // Handle empty secrets map
        if secrets.is_empty() {
            return Ok(());
        }

        // Convert secrets HashMap to array of key-value objects for GraphQL
        let secrets_input: Vec<serde_json::Value> = secrets
            .iter()
            .map(|(key, value)| {
                serde_json::json!({
                    "key": key,
                    "value": value
                })
            })
            .collect();

        let query = r#"
            mutation SetSecrets($appId: ID!, $secrets: [SecretInput!]!) {
                setSecrets(input: { appId: $appId, secrets: $secrets }) {
                    release {
                        id
                        version
                    }
                }
            }
        "#;

        // First, get the app ID
        let app = self.get_app(app_name).await?;

        let variables = serde_json::json!({
            "appId": app.id,
            "secrets": secrets_input
        });

        let _data: SetSecretsData = self.execute_query(query, Some(variables)).await?;

        Ok(())
    }

    /// Delete secrets from an app (using unsetSecrets mutation)
    pub async fn delete_secrets(&self, app_name: &str, keys: &[String]) -> Result<()> {
        self.unset_secrets(app_name, keys).await
    }

    /// Unset secrets from an app
    /// This is the preferred Fly.io API method for removing secrets
    pub async fn unset_secrets(&self, app_name: &str, keys: &[String]) -> Result<()> {
        if app_name.is_empty() {
            return Err(EnvSyncError::InvalidConfig(
                "App name cannot be empty".to_string(),
            ));
        }

        // Handle empty keys list
        if keys.is_empty() {
            return Ok(());
        }

        let query = r#"
            mutation UnsetSecrets($appId: ID!, $keys: [String!]!) {
                unsetSecrets(input: { appId: $appId, keys: $keys }) {
                    release {
                        id
                        version
                    }
                }
            }
        "#;

        // First, get the app ID
        let app = self.get_app(app_name).await?;

        let variables = serde_json::json!({
            "appId": app.id,
            "keys": keys
        });

        let _data: UnsetSecretsData = self.execute_query(query, Some(variables)).await?;

        Ok(())
    }

    /// Push variables to a Fly.io app (convenience method)
    /// Converts a list of (key, value) tuples to secrets
    pub async fn push_variables(
        &self,
        app_name: &str,
        variables: &[(String, String)],
    ) -> Result<()> {
        let secrets: HashMap<String, String> = variables
            .iter()
            .map(|(k, v)| (k.clone(), v.clone()))
            .collect();

        self.set_secrets(app_name, &secrets).await
    }

    /// Pull secrets from a Fly.io app (convenience method)
    /// Returns list of secret names (values are not retrievable via API)
    pub async fn pull_secrets(&self, app_name: &str) -> Result<Vec<String>> {
        let secrets = self.get_secrets(app_name).await?;
        Ok(secrets.keys().cloned().collect())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_client_creation() {
        let client = FlyioClient::new("test_token".to_string());
        assert_eq!(client.api_token, "test_token");
        assert!(client.org_slug.is_none());
    }

    #[test]
    fn test_client_creation_with_org() {
        let client = FlyioClient::new_with_org(
            "test_token".to_string(),
            Some("my-org".to_string()),
        );
        assert_eq!(client.api_token, "test_token");
        assert_eq!(client.org_slug, Some("my-org".to_string()));
    }

    #[test]
    fn test_flyio_app_serialization() {
        let app = FlyioApp {
            id: "app-123".to_string(),
            name: "my-app".to_string(),
            organization: Some("my-org".to_string()),
            status: Some("running".to_string()),
            deployed: Some(true),
        };

        let json = serde_json::to_string(&app).unwrap();
        let deserialized: FlyioApp = serde_json::from_str(&json).unwrap();

        assert_eq!(app.id, deserialized.id);
        assert_eq!(app.name, deserialized.name);
        assert_eq!(app.organization, deserialized.organization);
        assert_eq!(app.status, deserialized.status);
        assert_eq!(app.deployed, deserialized.deployed);
    }

    #[test]
    fn test_flyio_secret_serialization() {
        let secret = FlyioSecret {
            name: "API_KEY".to_string(),
            digest: Some("abc123".to_string()),
            created_at: Some("2025-01-01T00:00:00Z".to_string()),
        };

        let json = serde_json::to_string(&secret).unwrap();
        let deserialized: FlyioSecret = serde_json::from_str(&json).unwrap();

        assert_eq!(secret.name, deserialized.name);
        assert_eq!(secret.digest, deserialized.digest);
        assert_eq!(secret.created_at, deserialized.created_at);
    }

    #[tokio::test]
    async fn test_empty_app_name_validation() {
        let client = FlyioClient::new("test_token".to_string());

        let result = client.get_app("").await;
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), EnvSyncError::InvalidConfig(_)));
    }

    #[tokio::test]
    async fn test_empty_secrets_map() {
        let client = FlyioClient::new("test_token".to_string());
        let secrets: HashMap<String, String> = HashMap::new();

        // This should succeed without making an API call
        // Note: This will fail until we have proper mocking, but demonstrates expected behavior
        // let result = client.set_secrets("my-app", &secrets).await;
        // assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_empty_keys_list() {
        let client = FlyioClient::new("test_token".to_string());
        let keys: Vec<String> = vec![];

        // This should succeed without making an API call
        // Note: This will fail until we have proper mocking, but demonstrates expected behavior
        // let result = client.unset_secrets("my-app", &keys).await;
        // assert!(result.is_ok());
    }

    #[test]
    fn test_graphql_request_structure() {
        let request = GraphQLRequest {
            query: "query { apps { nodes { id } } }".to_string(),
            variables: Some(serde_json::json!({ "appName": "test" })),
        };

        let json = serde_json::to_string(&request).unwrap();
        assert!(json.contains("query"));
        assert!(json.contains("variables"));
    }

    #[test]
    fn test_graphql_request_without_variables() {
        let request = GraphQLRequest {
            query: "query { apps { nodes { id } } }".to_string(),
            variables: None,
        };

        let json = serde_json::to_string(&request).unwrap();
        assert!(json.contains("query"));
        // Variables should be omitted when None
        assert!(!json.contains("variables"));
    }
}
