//! Vercel API Integration
//!
//! Client for syncing environment variables with Vercel projects.

use reqwest::Client;
use serde::{Deserialize, Serialize};

use crate::error::{EnvSyncError, Result};

const VERCEL_API_URL: &str = "https://api.vercel.com";

pub struct VercelClient {
    client: Client,
    access_token: String,
    team_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VercelProject {
    pub id: String,
    pub name: String,
    #[serde(rename = "accountId")]
    pub account_id: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: Option<u64>,
    pub framework: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VercelEnvVar {
    pub id: String,
    pub key: String,
    pub value: String,
    pub target: Vec<String>,            // "production", "preview", "development"
    #[serde(rename = "type")]
    pub env_type: String,               // "encrypted", "plain", "secret"
    #[serde(rename = "createdAt")]
    pub created_at: Option<u64>,
    #[serde(rename = "updatedAt")]
    pub updated_at: Option<u64>,
}

#[derive(Debug, Serialize)]
struct CreateEnvVarRequest {
    key: String,
    value: String,
    target: Vec<String>,
    #[serde(rename = "type")]
    env_type: String,
}

#[derive(Debug, Serialize)]
struct UpdateEnvVarRequest {
    value: String,
    target: Vec<String>,
    #[serde(rename = "type")]
    env_type: String,
}

#[derive(Debug, Deserialize)]
struct ProjectsResponse {
    projects: Vec<VercelProject>,
}

#[derive(Debug, Deserialize)]
struct EnvVarsResponse {
    envs: Vec<VercelEnvVar>,
}

impl VercelClient {
    pub fn new(access_token: String, team_id: Option<String>) -> Self {
        Self {
            client: Client::new(),
            access_token,
            team_id,
        }
    }

    fn add_team_param(&self, url: &str) -> String {
        if let Some(team_id) = &self.team_id {
            if url.contains('?') {
                format!("{}&teamId={}", url, team_id)
            } else {
                format!("{}?teamId={}", url, team_id)
            }
        } else {
            url.to_string()
        }
    }

    /// List all Vercel projects
    pub async fn list_projects(&self) -> Result<Vec<VercelProject>> {
        let url = self.add_team_param(&format!("{}/v9/projects", VERCEL_API_URL));

        let response = self
            .client
            .get(&url)
            .bearer_auth(&self.access_token)
            .send()
            .await
            .map_err(|e| EnvSyncError::Http(e.to_string()))?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(EnvSyncError::Http(format!(
                "Vercel API error: {} - {}",
                status, text
            )));
        }

        let resp: ProjectsResponse = response
            .json()
            .await
            .map_err(|e| EnvSyncError::Http(e.to_string()))?;

        Ok(resp.projects)
    }

    /// Get environment variables for a project
    pub async fn get_env_vars(&self, project_id: &str) -> Result<Vec<VercelEnvVar>> {
        let url = self.add_team_param(&format!(
            "{}/v9/projects/{}/env",
            VERCEL_API_URL, project_id
        ));

        let response = self
            .client
            .get(&url)
            .bearer_auth(&self.access_token)
            .send()
            .await
            .map_err(|e| EnvSyncError::Http(e.to_string()))?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(EnvSyncError::Http(format!(
                "Vercel API error: {} - {}",
                status, text
            )));
        }

        let resp: EnvVarsResponse = response
            .json()
            .await
            .map_err(|e| EnvSyncError::Http(e.to_string()))?;

        Ok(resp.envs)
    }

    /// Create an environment variable
    pub async fn create_env_var(
        &self,
        project_id: &str,
        key: &str,
        value: &str,
        targets: &[&str],
        is_secret: bool,
    ) -> Result<VercelEnvVar> {
        let url = self.add_team_param(&format!(
            "{}/v10/projects/{}/env",
            VERCEL_API_URL, project_id
        ));

        let request = CreateEnvVarRequest {
            key: key.to_string(),
            value: value.to_string(),
            target: targets.iter().map(|s| s.to_string()).collect(),
            env_type: if is_secret { "secret" } else { "encrypted" }.to_string(),
        };

        let response = self
            .client
            .post(&url)
            .bearer_auth(&self.access_token)
            .json(&request)
            .send()
            .await
            .map_err(|e| EnvSyncError::Http(e.to_string()))?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(EnvSyncError::Http(format!(
                "Vercel API error: {} - {}",
                status, text
            )));
        }

        response
            .json()
            .await
            .map_err(|e| EnvSyncError::Http(e.to_string()))
    }

    /// Update an existing environment variable
    pub async fn update_env_var(
        &self,
        project_id: &str,
        env_id: &str,
        value: &str,
        targets: &[&str],
        is_secret: bool,
    ) -> Result<VercelEnvVar> {
        let url = self.add_team_param(&format!(
            "{}/v9/projects/{}/env/{}",
            VERCEL_API_URL, project_id, env_id
        ));

        let request = UpdateEnvVarRequest {
            value: value.to_string(),
            target: targets.iter().map(|s| s.to_string()).collect(),
            env_type: if is_secret { "secret" } else { "encrypted" }.to_string(),
        };

        let response = self
            .client
            .patch(&url)
            .bearer_auth(&self.access_token)
            .json(&request)
            .send()
            .await
            .map_err(|e| EnvSyncError::Http(e.to_string()))?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(EnvSyncError::Http(format!(
                "Vercel API error: {} - {}",
                status, text
            )));
        }

        response
            .json()
            .await
            .map_err(|e| EnvSyncError::Http(e.to_string()))
    }

    /// Delete an environment variable
    pub async fn delete_env_var(&self, project_id: &str, env_id: &str) -> Result<()> {
        let url = self.add_team_param(&format!(
            "{}/v9/projects/{}/env/{}",
            VERCEL_API_URL, project_id, env_id
        ));

        let response = self
            .client
            .delete(&url)
            .bearer_auth(&self.access_token)
            .send()
            .await
            .map_err(|e| EnvSyncError::Http(e.to_string()))?;

        if !response.status().is_success() && response.status() != reqwest::StatusCode::NOT_FOUND {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(EnvSyncError::Http(format!(
                "Vercel API error: {} - {}",
                status, text
            )));
        }

        Ok(())
    }

    /// Push variables to a Vercel project (upsert)
    pub async fn push_variables(
        &self,
        project_id: &str,
        variables: &[(String, String, bool)], // (key, value, is_secret)
        targets: &[&str],
    ) -> Result<()> {
        // Get existing vars to check for updates vs creates
        let existing = self.get_env_vars(project_id).await?;
        let existing_map: std::collections::HashMap<_, _> = existing
            .iter()
            .map(|v| (v.key.clone(), v.id.clone()))
            .collect();

        for (key, value, is_secret) in variables {
            if let Some(env_id) = existing_map.get(key) {
                self.update_env_var(project_id, env_id, value, targets, *is_secret)
                    .await?;
            } else {
                self.create_env_var(project_id, key, value, targets, *is_secret)
                    .await?;
            }
        }

        Ok(())
    }
}
