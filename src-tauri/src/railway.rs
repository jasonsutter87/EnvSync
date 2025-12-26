//! Railway API Integration
//!
//! Client for syncing environment variables with Railway services.
//! Railway uses GraphQL for their API.

use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::error::{EnvSyncError, Result};

const RAILWAY_API_URL: &str = "https://backboard.railway.app/graphql/v2";

pub struct RailwayClient {
    client: Client,
    access_token: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RailwayProject {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RailwayService {
    pub id: String,
    pub name: String,
    #[serde(rename = "projectId")]
    pub project_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RailwayEnvironment {
    pub id: String,
    pub name: String,
    #[serde(rename = "projectId")]
    pub project_id: String,
}

// GraphQL response types
#[derive(Debug, Deserialize)]
struct GraphQLResponse<T> {
    data: Option<T>,
    errors: Option<Vec<GraphQLError>>,
}

#[derive(Debug, Deserialize)]
struct GraphQLError {
    message: String,
}

#[derive(Debug, Deserialize)]
struct ProjectsData {
    projects: ProjectsEdges,
}

#[derive(Debug, Deserialize)]
struct ProjectsEdges {
    edges: Vec<ProjectEdge>,
}

#[derive(Debug, Deserialize)]
struct ProjectEdge {
    node: RailwayProject,
}

#[derive(Debug, Deserialize)]
struct ProjectData {
    project: ProjectDetails,
}

#[derive(Debug, Deserialize)]
struct ProjectDetails {
    services: ServicesEdges,
    environments: EnvironmentsEdges,
}

#[derive(Debug, Deserialize)]
struct ServicesEdges {
    edges: Vec<ServiceEdge>,
}

#[derive(Debug, Deserialize)]
struct ServiceEdge {
    node: RailwayService,
}

#[derive(Debug, Deserialize)]
struct EnvironmentsEdges {
    edges: Vec<EnvironmentEdge>,
}

#[derive(Debug, Deserialize)]
struct EnvironmentEdge {
    node: RailwayEnvironment,
}

#[derive(Debug, Deserialize)]
struct VariablesData {
    variables: std::collections::HashMap<String, String>,
}

impl RailwayClient {
    pub fn new(access_token: String) -> Self {
        Self {
            client: Client::new(),
            access_token,
        }
    }

    async fn graphql<T: for<'de> Deserialize<'de>>(
        &self,
        query: &str,
        variables: serde_json::Value,
    ) -> Result<T> {
        let body = json!({
            "query": query,
            "variables": variables,
        });

        let response = self
            .client
            .post(RAILWAY_API_URL)
            .bearer_auth(&self.access_token)
            .json(&body)
            .send()
            .await
            .map_err(|e| EnvSyncError::Http(e.to_string()))?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(EnvSyncError::Http(format!(
                "Railway API error: {} - {}",
                status, text
            )));
        }

        let result: GraphQLResponse<T> = response
            .json()
            .await
            .map_err(|e| EnvSyncError::Http(e.to_string()))?;

        if let Some(errors) = result.errors {
            let messages: Vec<_> = errors.iter().map(|e| e.message.clone()).collect();
            return Err(EnvSyncError::Http(format!(
                "Railway GraphQL errors: {}",
                messages.join(", ")
            )));
        }

        result
            .data
            .ok_or_else(|| EnvSyncError::Http("No data in response".to_string()))
    }

    /// List all Railway projects
    pub async fn list_projects(&self) -> Result<Vec<RailwayProject>> {
        let query = r#"
            query {
                projects {
                    edges {
                        node {
                            id
                            name
                            description
                            createdAt
                            updatedAt
                        }
                    }
                }
            }
        "#;

        let data: ProjectsData = self.graphql(query, json!({})).await?;
        Ok(data.projects.edges.into_iter().map(|e| e.node).collect())
    }

    /// Get services for a project
    pub async fn get_services(&self, project_id: &str) -> Result<Vec<RailwayService>> {
        let query = r#"
            query($projectId: String!) {
                project(id: $projectId) {
                    services {
                        edges {
                            node {
                                id
                                name
                            }
                        }
                    }
                    environments {
                        edges {
                            node {
                                id
                                name
                            }
                        }
                    }
                }
            }
        "#;

        let data: ProjectData = self
            .graphql(
                query,
                json!({
                    "projectId": project_id,
                }),
            )
            .await?;

        Ok(data
            .project
            .services
            .edges
            .into_iter()
            .map(|e| RailwayService {
                id: e.node.id,
                name: e.node.name,
                project_id: project_id.to_string(),
            })
            .collect())
    }

    /// Get environments for a project
    pub async fn get_environments(&self, project_id: &str) -> Result<Vec<RailwayEnvironment>> {
        let query = r#"
            query($projectId: String!) {
                project(id: $projectId) {
                    environments {
                        edges {
                            node {
                                id
                                name
                            }
                        }
                    }
                }
            }
        "#;

        let data: ProjectData = self
            .graphql(
                query,
                json!({
                    "projectId": project_id,
                }),
            )
            .await?;

        Ok(data
            .project
            .environments
            .edges
            .into_iter()
            .map(|e| RailwayEnvironment {
                id: e.node.id,
                name: e.node.name,
                project_id: project_id.to_string(),
            })
            .collect())
    }

    /// Get environment variables for a service in an environment
    pub async fn get_variables(
        &self,
        project_id: &str,
        environment_id: &str,
        service_id: &str,
    ) -> Result<std::collections::HashMap<String, String>> {
        let query = r#"
            query($projectId: String!, $environmentId: String!, $serviceId: String!) {
                variables(projectId: $projectId, environmentId: $environmentId, serviceId: $serviceId)
            }
        "#;

        let data: VariablesData = self
            .graphql(
                query,
                json!({
                    "projectId": project_id,
                    "environmentId": environment_id,
                    "serviceId": service_id,
                }),
            )
            .await?;

        Ok(data.variables)
    }

    /// Set an environment variable
    pub async fn set_variable(
        &self,
        project_id: &str,
        environment_id: &str,
        service_id: &str,
        name: &str,
        value: &str,
    ) -> Result<()> {
        let query = r#"
            mutation($input: VariableUpsertInput!) {
                variableUpsert(input: $input)
            }
        "#;

        let _: serde_json::Value = self
            .graphql(
                query,
                json!({
                    "input": {
                        "projectId": project_id,
                        "environmentId": environment_id,
                        "serviceId": service_id,
                        "name": name,
                        "value": value,
                    }
                }),
            )
            .await?;

        Ok(())
    }

    /// Delete an environment variable
    pub async fn delete_variable(
        &self,
        project_id: &str,
        environment_id: &str,
        service_id: &str,
        name: &str,
    ) -> Result<()> {
        let query = r#"
            mutation($input: VariableDeleteInput!) {
                variableDelete(input: $input)
            }
        "#;

        let _: serde_json::Value = self
            .graphql(
                query,
                json!({
                    "input": {
                        "projectId": project_id,
                        "environmentId": environment_id,
                        "serviceId": service_id,
                        "name": name,
                    }
                }),
            )
            .await?;

        Ok(())
    }

    /// Push variables to a Railway service (upsert)
    pub async fn push_variables(
        &self,
        project_id: &str,
        environment_id: &str,
        service_id: &str,
        variables: &[(String, String)],
    ) -> Result<()> {
        for (key, value) in variables {
            self.set_variable(project_id, environment_id, service_id, key, value)
                .await?;
        }
        Ok(())
    }
}
