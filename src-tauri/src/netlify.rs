use reqwest::Client;
use serde::{Deserialize, Serialize};

use crate::error::{EnvSyncError, Result};

const NETLIFY_API_URL: &str = "https://api.netlify.com/api/v1";

pub struct NetlifyClient {
    client: Client,
    access_token: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetlifySite {
    pub id: String,
    pub name: String,
    pub url: String,
    pub account_slug: String,
    pub admin_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetlifyEnvVar {
    pub key: String,
    pub scopes: Vec<String>,
    pub values: Vec<NetlifyEnvValue>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetlifyEnvValue {
    pub value: String,
    pub context: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SetEnvVarRequest {
    key: String,
    scopes: Vec<String>,
    values: Vec<NetlifyEnvValue>,
}

impl NetlifyClient {
    pub fn new(access_token: String) -> Self {
        Self {
            client: Client::new(),
            access_token,
        }
    }

    /// Get list of Netlify sites
    pub async fn list_sites(&self) -> Result<Vec<NetlifySite>> {
        let response = self
            .client
            .get(format!("{}/sites", NETLIFY_API_URL))
            .bearer_auth(&self.access_token)
            .send()
            .await
            .map_err(|e| EnvSyncError::Http(e.to_string()))?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(EnvSyncError::Http(format!(
                "Netlify API error: {} - {}",
                status, text
            )));
        }

        response
            .json::<Vec<NetlifySite>>()
            .await
            .map_err(|e| EnvSyncError::Http(e.to_string()))
    }

    /// Get environment variables for a site
    pub async fn get_env_vars(&self, site_id: &str) -> Result<Vec<NetlifyEnvVar>> {
        let response = self
            .client
            .get(format!("{}/sites/{}/env", NETLIFY_API_URL, site_id))
            .bearer_auth(&self.access_token)
            .send()
            .await
            .map_err(|e| EnvSyncError::Http(e.to_string()))?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(EnvSyncError::Http(format!(
                "Netlify API error: {} - {}",
                status, text
            )));
        }

        response
            .json::<Vec<NetlifyEnvVar>>()
            .await
            .map_err(|e| EnvSyncError::Http(e.to_string()))
    }

    /// Set an environment variable for a site
    pub async fn set_env_var(
        &self,
        site_id: &str,
        key: &str,
        value: &str,
        context: &str,
    ) -> Result<NetlifyEnvVar> {
        // First, try to delete the existing var (if it exists)
        let _ = self.delete_env_var(site_id, key).await;

        let request = SetEnvVarRequest {
            key: key.to_string(),
            scopes: vec!["builds".to_string(), "functions".to_string(), "runtime".to_string()],
            values: vec![NetlifyEnvValue {
                value: value.to_string(),
                context: context.to_string(),
            }],
        };

        let response = self
            .client
            .post(format!("{}/sites/{}/env", NETLIFY_API_URL, site_id))
            .bearer_auth(&self.access_token)
            .json(&vec![request])
            .send()
            .await
            .map_err(|e| EnvSyncError::Http(e.to_string()))?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(EnvSyncError::Http(format!(
                "Netlify API error: {} - {}",
                status, text
            )));
        }

        let vars: Vec<NetlifyEnvVar> = response
            .json()
            .await
            .map_err(|e| EnvSyncError::Http(e.to_string()))?;

        vars.into_iter()
            .next()
            .ok_or_else(|| EnvSyncError::Http("No env var returned".to_string()))
    }

    /// Delete an environment variable for a site
    pub async fn delete_env_var(&self, site_id: &str, key: &str) -> Result<()> {
        let response = self
            .client
            .delete(format!("{}/sites/{}/env/{}", NETLIFY_API_URL, site_id, key))
            .bearer_auth(&self.access_token)
            .send()
            .await
            .map_err(|e| EnvSyncError::Http(e.to_string()))?;

        // 404 is OK - the var might not exist
        if !response.status().is_success() && response.status() != reqwest::StatusCode::NOT_FOUND {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(EnvSyncError::Http(format!(
                "Netlify API error: {} - {}",
                status, text
            )));
        }

        Ok(())
    }

    /// Push all variables from an environment to a Netlify site
    pub async fn push_variables(
        &self,
        site_id: &str,
        variables: &[(String, String)],
        context: &str,
    ) -> Result<()> {
        for (key, value) in variables {
            self.set_env_var(site_id, key, value, context).await?;
        }
        Ok(())
    }
}
