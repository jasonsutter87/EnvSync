use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use sodiumoxide::crypto::box_::PublicKey;
use sodiumoxide::crypto::sealedbox;

use crate::error::{EnvSyncError, Result};

const GITHUB_API_URL: &str = "https://api.github.com";
const USER_AGENT: &str = "EnvSync/1.0";

/// GitHub API client for managing Actions secrets
pub struct GitHubClient {
    client: Client,
    access_token: String,
}

/// Represents a GitHub repository
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubRepo {
    pub id: u64,
    pub name: String,
    pub full_name: String,
    pub owner: GitHubOwner,
    pub private: bool,
    pub html_url: String,
    pub description: Option<String>,
    pub permissions: Option<GitHubPermissions>,
}

/// Repository owner information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubOwner {
    pub login: String,
    #[serde(rename = "type")]
    pub owner_type: String, // "User" or "Organization"
}

/// Repository permissions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubPermissions {
    pub admin: bool,
    pub push: bool,
    pub pull: bool,
}

/// Repository secret metadata (values are never returned)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubSecret {
    pub name: String,
    pub created_at: String,
    pub updated_at: String,
}

/// List of repository secrets
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubSecretsList {
    pub total_count: u32,
    pub secrets: Vec<GitHubSecret>,
}

/// Public key for encrypting secrets
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubPublicKey {
    pub key_id: String,
    pub key: String, // Base64-encoded public key
}

/// Organization secret metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubOrgSecret {
    pub name: String,
    pub created_at: String,
    pub updated_at: String,
    pub visibility: String, // "all", "private", "selected"
    pub selected_repositories_url: Option<String>,
}

/// List of organization secrets
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubOrgSecretsList {
    pub total_count: u32,
    pub secrets: Vec<GitHubOrgSecret>,
}

/// Secret visibility for organization secrets
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SecretVisibility {
    All,      // All repositories
    Private,  // Private repositories only
    Selected, // Selected repositories only
}

/// Request body for creating/updating a secret
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateSecretRequest {
    pub encrypted_value: String,
    pub key_id: String,
}

/// Request body for creating/updating an org secret
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateOrgSecretRequest {
    pub encrypted_value: String,
    pub key_id: String,
    pub visibility: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub selected_repository_ids: Option<Vec<u64>>,
}

impl GitHubClient {
    /// Create a new GitHub API client
    pub fn new(access_token: String) -> Self {
        // Initialize sodiumoxide
        sodiumoxide::init().expect("Failed to initialize sodiumoxide");

        Self {
            client: Client::new(),
            access_token,
        }
    }

    /// Get the access token (for testing)
    pub fn token(&self) -> &str {
        &self.access_token
    }

    /// List all repositories accessible to the authenticated user
    pub async fn list_repos(&self) -> Result<Vec<GitHubRepo>> {
        let mut all_repos = Vec::new();
        let mut page = 1;
        let per_page = 100;

        loop {
            let url = format!(
                "{}/user/repos?per_page={}&page={}&sort=updated&direction=desc",
                GITHUB_API_URL, per_page, page
            );

            let response = self
                .client
                .get(&url)
                .header("User-Agent", USER_AGENT)
                .header("Accept", "application/vnd.github+json")
                .header("X-GitHub-Api-Version", "2022-11-28")
                .bearer_auth(&self.access_token)
                .send()
                .await
                .map_err(|e| EnvSyncError::Network(e.to_string()))?;

            if !response.status().is_success() {
                let status = response.status();
                let text = response.text().await.unwrap_or_default();
                return Err(self.handle_error(status.as_u16(), &text));
            }

            let repos: Vec<GitHubRepo> = response
                .json()
                .await
                .map_err(|e| EnvSyncError::Http(format!("Failed to parse response: {}", e)))?;

            if repos.is_empty() {
                break;
            }

            all_repos.extend(repos);

            // If we got less than per_page, we're on the last page
            if all_repos.len() % per_page != 0 {
                break;
            }

            page += 1;
        }

        Ok(all_repos)
    }

    /// List secrets for a repository
    pub async fn list_secrets(&self, owner: &str, repo: &str) -> Result<Vec<GitHubSecret>> {
        self.validate_repo_params(owner, repo)?;

        let url = format!(
            "{}/repos/{}/{}/actions/secrets",
            GITHUB_API_URL, owner, repo
        );

        let response = self
            .client
            .get(&url)
            .header("User-Agent", USER_AGENT)
            .header("Accept", "application/vnd.github+json")
            .header("X-GitHub-Api-Version", "2022-11-28")
            .bearer_auth(&self.access_token)
            .send()
            .await
            .map_err(|e| EnvSyncError::Network(e.to_string()))?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(self.handle_error(status.as_u16(), &text));
        }

        let secrets_list: GitHubSecretsList = response
            .json()
            .await
            .map_err(|e| EnvSyncError::Http(format!("Failed to parse response: {}", e)))?;

        Ok(secrets_list.secrets)
    }

    /// Get repository's public key for encrypting secrets
    pub async fn get_public_key(&self, owner: &str, repo: &str) -> Result<GitHubPublicKey> {
        self.validate_repo_params(owner, repo)?;

        let url = format!(
            "{}/repos/{}/{}/actions/secrets/public-key",
            GITHUB_API_URL, owner, repo
        );

        let response = self
            .client
            .get(&url)
            .header("User-Agent", USER_AGENT)
            .header("Accept", "application/vnd.github+json")
            .header("X-GitHub-Api-Version", "2022-11-28")
            .bearer_auth(&self.access_token)
            .send()
            .await
            .map_err(|e| EnvSyncError::Network(e.to_string()))?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(self.handle_error(status.as_u16(), &text));
        }

        let public_key: GitHubPublicKey = response
            .json()
            .await
            .map_err(|e| EnvSyncError::Http(format!("Failed to parse response: {}", e)))?;

        Ok(public_key)
    }

    /// Create or update a repository secret
    pub async fn set_secret(
        &self,
        owner: &str,
        repo: &str,
        name: &str,
        value: &str,
    ) -> Result<()> {
        self.validate_repo_params(owner, repo)?;
        self.validate_secret_name(name)?;

        // Get the repository's public key
        let public_key = self.get_public_key(owner, repo).await?;

        // Encrypt the secret value
        let encrypted_value = self.encrypt_secret(value, &public_key.key)?;

        // Create the request body
        let request_body = CreateSecretRequest {
            encrypted_value,
            key_id: public_key.key_id,
        };

        let url = format!(
            "{}/repos/{}/{}/actions/secrets/{}",
            GITHUB_API_URL, owner, repo, name
        );

        let response = self
            .client
            .put(&url)
            .header("User-Agent", USER_AGENT)
            .header("Accept", "application/vnd.github+json")
            .header("X-GitHub-Api-Version", "2022-11-28")
            .bearer_auth(&self.access_token)
            .json(&request_body)
            .send()
            .await
            .map_err(|e| EnvSyncError::Network(e.to_string()))?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(self.handle_error(status.as_u16(), &text));
        }

        Ok(())
    }

    /// Delete a repository secret
    pub async fn delete_secret(&self, owner: &str, repo: &str, name: &str) -> Result<()> {
        self.validate_repo_params(owner, repo)?;
        self.validate_secret_name(name)?;

        let url = format!(
            "{}/repos/{}/{}/actions/secrets/{}",
            GITHUB_API_URL, owner, repo, name
        );

        let response = self
            .client
            .delete(&url)
            .header("User-Agent", USER_AGENT)
            .header("Accept", "application/vnd.github+json")
            .header("X-GitHub-Api-Version", "2022-11-28")
            .bearer_auth(&self.access_token)
            .send()
            .await
            .map_err(|e| EnvSyncError::Network(e.to_string()))?;

        // 204 No Content = success, 404 Not Found = already deleted (idempotent)
        if !response.status().is_success() && response.status().as_u16() != 404 {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(self.handle_error(status.as_u16(), &text));
        }

        Ok(())
    }

    /// List organization secrets
    pub async fn list_org_secrets(&self, org: &str) -> Result<Vec<GitHubOrgSecret>> {
        self.validate_org_name(org)?;

        let url = format!("{}/orgs/{}/actions/secrets", GITHUB_API_URL, org);

        let response = self
            .client
            .get(&url)
            .header("User-Agent", USER_AGENT)
            .header("Accept", "application/vnd.github+json")
            .header("X-GitHub-Api-Version", "2022-11-28")
            .bearer_auth(&self.access_token)
            .send()
            .await
            .map_err(|e| EnvSyncError::Network(e.to_string()))?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(self.handle_error(status.as_u16(), &text));
        }

        let secrets_list: GitHubOrgSecretsList = response
            .json()
            .await
            .map_err(|e| EnvSyncError::Http(format!("Failed to parse response: {}", e)))?;

        Ok(secrets_list.secrets)
    }

    /// Get organization's public key for encrypting secrets
    pub async fn get_org_public_key(&self, org: &str) -> Result<GitHubPublicKey> {
        self.validate_org_name(org)?;

        let url = format!(
            "{}/orgs/{}/actions/secrets/public-key",
            GITHUB_API_URL, org
        );

        let response = self
            .client
            .get(&url)
            .header("User-Agent", USER_AGENT)
            .header("Accept", "application/vnd.github+json")
            .header("X-GitHub-Api-Version", "2022-11-28")
            .bearer_auth(&self.access_token)
            .send()
            .await
            .map_err(|e| EnvSyncError::Network(e.to_string()))?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(self.handle_error(status.as_u16(), &text));
        }

        let public_key: GitHubPublicKey = response
            .json()
            .await
            .map_err(|e| EnvSyncError::Http(format!("Failed to parse response: {}", e)))?;

        Ok(public_key)
    }

    /// Create or update an organization secret with visibility setting
    pub async fn set_org_secret(
        &self,
        org: &str,
        name: &str,
        value: &str,
        visibility: SecretVisibility,
    ) -> Result<()> {
        self.validate_org_name(org)?;
        self.validate_secret_name(name)?;

        // Get the organization's public key
        let public_key = self.get_org_public_key(org).await?;

        // Encrypt the secret value
        let encrypted_value = self.encrypt_secret(value, &public_key.key)?;

        // Create the request body
        let visibility_str = match visibility {
            SecretVisibility::All => "all",
            SecretVisibility::Private => "private",
            SecretVisibility::Selected => "selected",
        };

        let request_body = CreateOrgSecretRequest {
            encrypted_value,
            key_id: public_key.key_id,
            visibility: visibility_str.to_string(),
            selected_repository_ids: None,
        };

        let url = format!(
            "{}/orgs/{}/actions/secrets/{}",
            GITHUB_API_URL, org, name
        );

        let response = self
            .client
            .put(&url)
            .header("User-Agent", USER_AGENT)
            .header("Accept", "application/vnd.github+json")
            .header("X-GitHub-Api-Version", "2022-11-28")
            .bearer_auth(&self.access_token)
            .json(&request_body)
            .send()
            .await
            .map_err(|e| EnvSyncError::Network(e.to_string()))?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(self.handle_error(status.as_u16(), &text));
        }

        Ok(())
    }

    /// Create or update an organization secret for selected repositories
    pub async fn set_org_secret_selected(
        &self,
        org: &str,
        name: &str,
        value: &str,
        selected_repository_ids: Vec<u64>,
    ) -> Result<()> {
        self.validate_org_name(org)?;
        self.validate_secret_name(name)?;

        // Get the organization's public key
        let public_key = self.get_org_public_key(org).await?;

        // Encrypt the secret value
        let encrypted_value = self.encrypt_secret(value, &public_key.key)?;

        // Create the request body
        let request_body = CreateOrgSecretRequest {
            encrypted_value,
            key_id: public_key.key_id,
            visibility: "selected".to_string(),
            selected_repository_ids: Some(selected_repository_ids),
        };

        let url = format!(
            "{}/orgs/{}/actions/secrets/{}",
            GITHUB_API_URL, org, name
        );

        let response = self
            .client
            .put(&url)
            .header("User-Agent", USER_AGENT)
            .header("Accept", "application/vnd.github+json")
            .header("X-GitHub-Api-Version", "2022-11-28")
            .bearer_auth(&self.access_token)
            .json(&request_body)
            .send()
            .await
            .map_err(|e| EnvSyncError::Network(e.to_string()))?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(self.handle_error(status.as_u16(), &text));
        }

        Ok(())
    }

    /// Delete an organization secret
    pub async fn delete_org_secret(&self, org: &str, name: &str) -> Result<()> {
        self.validate_org_name(org)?;
        self.validate_secret_name(name)?;

        let url = format!(
            "{}/orgs/{}/actions/secrets/{}",
            GITHUB_API_URL, org, name
        );

        let response = self
            .client
            .delete(&url)
            .header("User-Agent", USER_AGENT)
            .header("Accept", "application/vnd.github+json")
            .header("X-GitHub-Api-Version", "2022-11-28")
            .bearer_auth(&self.access_token)
            .send()
            .await
            .map_err(|e| EnvSyncError::Network(e.to_string()))?;

        // 204 No Content = success, 404 Not Found = already deleted (idempotent)
        if !response.status().is_success() && response.status().as_u16() != 404 {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(self.handle_error(status.as_u16(), &text));
        }

        Ok(())
    }

    // =================================================================================
    // Private Helper Methods
    // =================================================================================

    /// Encrypt a secret value using libsodium sealed box
    /// This uses the repository's public key for encryption
    fn encrypt_secret(&self, value: &str, public_key_base64: &str) -> Result<String> {
        // Decode the base64 public key
        let public_key_bytes = BASE64
            .decode(public_key_base64)
            .map_err(|e| EnvSyncError::Encryption(format!("Invalid public key: {}", e)))?;

        // Convert to libsodium PublicKey
        let public_key = PublicKey::from_slice(&public_key_bytes).ok_or_else(|| {
            EnvSyncError::Encryption("Invalid public key length (expected 32 bytes)".to_string())
        })?;

        // Encrypt using sealed box (anonymous encryption)
        let encrypted = sealedbox::seal(value.as_bytes(), &public_key);

        // Encode to base64
        Ok(BASE64.encode(&encrypted))
    }

    /// Validate repository owner and name parameters
    fn validate_repo_params(&self, owner: &str, repo: &str) -> Result<()> {
        if owner.is_empty() {
            return Err(EnvSyncError::InvalidConfig(
                "Repository owner cannot be empty".to_string(),
            ));
        }

        if repo.is_empty() {
            return Err(EnvSyncError::InvalidConfig(
                "Repository name cannot be empty".to_string(),
            ));
        }

        // Validate owner/repo names don't contain invalid characters
        if owner.contains('@') || owner.contains('/') {
            return Err(EnvSyncError::InvalidConfig(format!(
                "Invalid repository owner: {}",
                owner
            )));
        }

        if repo.contains('@') || repo.contains('/') {
            return Err(EnvSyncError::InvalidConfig(format!(
                "Invalid repository name: {}",
                repo
            )));
        }

        Ok(())
    }

    /// Validate organization name
    fn validate_org_name(&self, org: &str) -> Result<()> {
        if org.is_empty() {
            return Err(EnvSyncError::InvalidConfig(
                "Organization name cannot be empty".to_string(),
            ));
        }

        if org.contains('@') || org.contains('/') {
            return Err(EnvSyncError::InvalidConfig(format!(
                "Invalid organization name: {}",
                org
            )));
        }

        Ok(())
    }

    /// Validate secret name
    fn validate_secret_name(&self, name: &str) -> Result<()> {
        if name.is_empty() {
            return Err(EnvSyncError::InvalidConfig(
                "Secret name cannot be empty".to_string(),
            ));
        }

        Ok(())
    }

    /// Handle GitHub API errors
    fn handle_error(&self, status: u16, body: &str) -> EnvSyncError {
        match status {
            401 => EnvSyncError::NotAuthenticated,
            403 => {
                if body.contains("rate limit") {
                    EnvSyncError::Api("Rate limit exceeded".to_string())
                } else {
                    EnvSyncError::PermissionDenied(
                        "Access forbidden - check token permissions".to_string(),
                    )
                }
            }
            404 => EnvSyncError::NotFound("Repository or resource not found".to_string()),
            422 => EnvSyncError::InvalidConfig(format!("Validation failed: {}", body)),
            _ => EnvSyncError::Api(format!("GitHub API error {}: {}", status, body)),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_client_creation() {
        let token = "test_token".to_string();
        let client = GitHubClient::new(token.clone());
        assert_eq!(client.token(), &token);
    }

    #[test]
    fn test_encrypt_secret() {
        let client = GitHubClient::new("test".to_string());

        // Real GitHub public key format (base64-encoded 32-byte key)
        let public_key = "U4EqFg7hJKbeVJFu3AdCFzGcfVWHYKHkTXH4qlG4C2Y=";
        let secret_value = "my_secret_value";

        let encrypted = client.encrypt_secret(secret_value, public_key).unwrap();

        // Should be base64 encoded
        assert!(BASE64.decode(&encrypted).is_ok());

        // Should not be the same as original
        assert_ne!(encrypted, secret_value);

        // Encrypted value should be longer than original (due to sealed box overhead)
        assert!(encrypted.len() > secret_value.len());
    }

    #[test]
    fn test_encrypt_secret_empty_value() {
        let client = GitHubClient::new("test".to_string());
        let public_key = "U4EqFg7hJKbeVJFu3AdCFzGcfVWHYKHkTXH4qlG4C2Y=";

        let encrypted = client.encrypt_secret("", public_key).unwrap();
        assert!(!encrypted.is_empty());
    }

    #[test]
    fn test_encrypt_secret_invalid_key() {
        let client = GitHubClient::new("test".to_string());
        let invalid_key = "not_valid_base64!@#";

        let result = client.encrypt_secret("value", invalid_key);
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_repo_params() {
        let client = GitHubClient::new("test".to_string());

        assert!(client.validate_repo_params("owner", "repo").is_ok());
        assert!(client.validate_repo_params("", "repo").is_err());
        assert!(client.validate_repo_params("owner", "").is_err());
        assert!(client.validate_repo_params("owner@invalid", "repo").is_err());
        assert!(client.validate_repo_params("owner/invalid", "repo").is_err());
    }

    #[test]
    fn test_validate_secret_name() {
        let client = GitHubClient::new("test".to_string());

        assert!(client.validate_secret_name("MY_SECRET").is_ok());
        assert!(client.validate_secret_name("MY_API_KEY").is_ok());
        assert!(client.validate_secret_name("").is_err());
    }

    #[test]
    fn test_encryption_nonce_randomness() {
        let client = GitHubClient::new("test".to_string());
        let public_key = "U4EqFg7hJKbeVJFu3AdCFzGcfVWHYKHkTXH4qlG4C2Y=";
        let secret_value = "my_secret_value";

        // Encrypt the same value twice
        let encrypted1 = client.encrypt_secret(secret_value, public_key).unwrap();
        let encrypted2 = client.encrypt_secret(secret_value, public_key).unwrap();

        // Should produce different ciphertexts due to random nonce
        assert_ne!(encrypted1, encrypted2);
    }
}
