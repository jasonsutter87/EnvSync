//! VeilCloud Client SDK
//!
//! Client for VeilCloud zero-knowledge storage and services.
//! All encryption happens client-side - VeilCloud never sees plaintext.
//!
//! Updated to match actual VeilCloud API from VeilSuite project.

use chrono::{DateTime, Utc};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::sync::RwLock;

use crate::error::{Error, Result};
use crate::models::{AuthTokens, EncryptedBlob, StorageEntry, StorageMetadata, User};

/// VeilCloud API configuration
#[derive(Debug, Clone)]
pub struct VeilCloudConfig {
    pub api_url: String,
}

impl Default for VeilCloudConfig {
    fn default() -> Self {
        Self {
            api_url: "https://api.veilcloud.io".to_string(),
        }
    }
}

impl VeilCloudConfig {
    pub fn local() -> Self {
        Self {
            api_url: "http://localhost:3000".to_string(),
        }
    }

    pub fn with_url(url: &str) -> Self {
        Self {
            api_url: url.to_string(),
        }
    }
}

/// VeilCloud client for authentication and zero-knowledge storage
pub struct VeilCloudClient {
    http: Client,
    config: VeilCloudConfig,
    auth: RwLock<Option<AuthState>>,
}

#[derive(Debug, Clone)]
struct AuthState {
    tokens: AuthTokens,
    user: User,
}

// ========== API Request/Response Types (matching VeilCloud API) ==========

#[derive(Debug, Serialize)]
struct RegisterRequest {
    email: String,
    password: String,
}

#[derive(Debug, Serialize)]
struct LoginRequest {
    email: String,
    password: String,
}

#[derive(Debug, Deserialize)]
struct AuthResponse {
    user: UserResponse,
    credential: Option<CredentialResponse>,
}

#[derive(Debug, Deserialize)]
struct UserResponse {
    id: String,
    email: String,
    #[serde(rename = "createdAt")]
    created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
struct CredentialResponse {
    credential: String,
    signature: String,
    #[serde(rename = "expiresAt")]
    expires_at: DateTime<Utc>,
}

impl From<UserResponse> for User {
    fn from(r: UserResponse) -> Self {
        User {
            id: r.id,
            email: r.email,
            name: None,
            created_at: r.created_at.unwrap_or_else(Utc::now),
        }
    }
}

#[derive(Debug, Deserialize)]
struct RefreshResponse {
    credential: String,
    signature: String,
    #[serde(rename = "expiresAt")]
    expires_at: DateTime<Utc>,
}

/// Storage put request (matches VeilCloud /v1/storage API)
#[derive(Debug, Serialize)]
pub struct StoragePutRequest {
    pub data: String,           // Base64 encoded encrypted data
    pub metadata: Option<String>, // Optional encrypted metadata
    #[serde(rename = "contentType")]
    pub content_type: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct StoragePutResponse {
    pub success: bool,
    pub blob: BlobInfo,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct BlobInfo {
    pub key: String,
    pub size: u64,
    pub hash: String,
    #[serde(rename = "createdAt")]
    pub created_at: DateTime<Utc>,
    #[serde(rename = "updatedAt")]
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct StorageGetResponse {
    pub data: String,           // Base64 encoded encrypted data
    pub metadata: Option<String>,
    #[serde(rename = "contentType")]
    pub content_type: String,
    pub size: u64,
    pub version: u64,
}

#[derive(Debug, Deserialize)]
pub struct StorageListResponse {
    pub blobs: Vec<BlobListEntry>,
    #[serde(rename = "continuationToken")]
    pub continuation_token: Option<String>,
    #[serde(rename = "hasMore")]
    pub has_more: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct BlobListEntry {
    pub key: String,
    pub size: u64,
    pub hash: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: DateTime<Utc>,
}

impl VeilCloudClient {
    /// Create a new VeilCloud client with default config
    pub fn new() -> Self {
        Self::with_config(VeilCloudConfig::default())
    }

    /// Create a client with custom config
    pub fn with_config(config: VeilCloudConfig) -> Self {
        Self {
            http: Client::new(),
            config,
            auth: RwLock::new(None),
        }
    }

    /// Check if the client is authenticated
    pub fn is_authenticated(&self) -> bool {
        self.auth.read().unwrap().is_some()
    }

    /// Get the current user if authenticated
    pub fn current_user(&self) -> Option<User> {
        self.auth.read().unwrap().as_ref().map(|s| s.user.clone())
    }

    /// Get current auth tokens
    pub fn get_tokens(&self) -> Option<AuthTokens> {
        self.auth.read().unwrap().as_ref().map(|s| s.tokens.clone())
    }

    /// Restore session from saved tokens
    pub fn restore_session(&self, tokens: AuthTokens, user: User) {
        *self.auth.write().unwrap() = Some(AuthState { tokens, user });
    }

    /// Clear the session
    pub fn clear_session(&self) {
        *self.auth.write().unwrap() = None;
    }

    // ========== Authentication ==========

    /// Register for a new VeilCloud account
    pub async fn signup(&self, email: &str, password: &str, _name: Option<&str>) -> Result<User> {
        let request = RegisterRequest {
            email: email.to_string(),
            password: password.to_string(),
        };

        let response = self
            .http
            .post(format!("{}/v1/auth/register", self.config.api_url))
            .json(&request)
            .send()
            .await
            .map_err(|e| Error::Network(e.to_string()))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(Error::Api(format!("Register failed ({}): {}", status, body)));
        }

        let auth: AuthResponse = response
            .json()
            .await
            .map_err(|e| Error::Api(format!("Invalid response: {}", e)))?;

        let user: User = auth.user.into();

        // Store auth state if credential was returned
        if let Some(cred) = auth.credential {
            let tokens = AuthTokens {
                credential: cred.credential,
                signature: cred.signature,
                expires_at: cred.expires_at,
            };

            *self.auth.write().unwrap() = Some(AuthState {
                tokens,
                user: user.clone(),
            });
        }

        Ok(user)
    }

    /// Log in to an existing VeilCloud account
    pub async fn login(&self, email: &str, password: &str) -> Result<User> {
        let request = LoginRequest {
            email: email.to_string(),
            password: password.to_string(),
        };

        let response = self
            .http
            .post(format!("{}/v1/auth/login", self.config.api_url))
            .json(&request)
            .send()
            .await
            .map_err(|e| Error::Network(e.to_string()))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(Error::Api(format!("Login failed ({}): {}", status, body)));
        }

        let auth: AuthResponse = response
            .json()
            .await
            .map_err(|e| Error::Api(format!("Invalid response: {}", e)))?;

        let user: User = auth.user.into();

        // Store auth state if credential was returned
        if let Some(cred) = auth.credential {
            let tokens = AuthTokens {
                credential: cred.credential,
                signature: cred.signature,
                expires_at: cred.expires_at,
            };

            *self.auth.write().unwrap() = Some(AuthState {
                tokens,
                user: user.clone(),
            });
        }

        Ok(user)
    }

    /// Log out and clear tokens
    pub fn logout(&self) {
        self.clear_session();
    }

    /// Refresh the credential
    pub async fn refresh_credential(&self) -> Result<()> {
        let auth_headers = self.get_auth_headers()?;

        let response = self
            .http
            .post(format!("{}/v1/auth/refresh", self.config.api_url))
            .header("X-VeilCloud-Credential", &auth_headers.0)
            .header("X-VeilCloud-Signature", &auth_headers.1)
            .send()
            .await
            .map_err(|e| Error::Network(e.to_string()))?;

        if !response.status().is_success() {
            self.logout();
            return Err(Error::TokenExpired);
        }

        let refresh: RefreshResponse = response
            .json()
            .await
            .map_err(|e| Error::Api(format!("Invalid response: {}", e)))?;

        let mut auth = self.auth.write().unwrap();
        if let Some(state) = auth.as_mut() {
            state.tokens.credential = refresh.credential;
            state.tokens.signature = refresh.signature;
            state.tokens.expires_at = refresh.expires_at;
        }

        Ok(())
    }

    /// Get auth headers, refreshing if needed
    fn get_auth_headers(&self) -> Result<(String, String)> {
        let auth = self.auth.read().unwrap();
        match &*auth {
            Some(state) => Ok((state.tokens.credential.clone(), state.tokens.signature.clone())),
            None => Err(Error::NotAuthenticated),
        }
    }

    /// Get auth headers, refreshing credential if near expiry
    async fn get_auth_headers_with_refresh(&self) -> Result<(String, String)> {
        {
            let auth = self.auth.read().unwrap();
            match &*auth {
                Some(state) => {
                    if !state.tokens.is_near_expiry() {
                        return Ok((state.tokens.credential.clone(), state.tokens.signature.clone()));
                    }
                }
                None => return Err(Error::NotAuthenticated),
            }
        }

        // Refresh needed
        self.refresh_credential().await?;

        let auth = self.auth.read().unwrap();
        match &*auth {
            Some(state) => Ok((state.tokens.credential.clone(), state.tokens.signature.clone())),
            None => Err(Error::NotAuthenticated),
        }
    }

    // ========== Storage API (/v1/storage/:projectId/:envName) ==========

    /// Store encrypted data for a project/environment
    pub async fn storage_put(
        &self,
        project_id: &str,
        env_name: &str,
        data: &str,
        metadata: Option<&str>,
    ) -> Result<BlobInfo> {
        let (cred, sig) = self.get_auth_headers_with_refresh().await?;

        let request = StoragePutRequest {
            data: data.to_string(),
            metadata: metadata.map(String::from),
            content_type: Some("application/octet-stream".to_string()),
        };

        let response = self
            .http
            .put(format!(
                "{}/v1/storage/{}/{}",
                self.config.api_url,
                urlencoding::encode(project_id),
                urlencoding::encode(env_name)
            ))
            .header("X-VeilCloud-Credential", cred)
            .header("X-VeilCloud-Signature", sig)
            .json(&request)
            .send()
            .await
            .map_err(|e| Error::Network(e.to_string()))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(Error::Api(format!("Storage put failed ({}): {}", status, body)));
        }

        let result: StoragePutResponse = response
            .json()
            .await
            .map_err(|e| Error::Api(format!("Invalid response: {}", e)))?;

        Ok(result.blob)
    }

    /// Get encrypted data for a project/environment
    pub async fn storage_get(&self, project_id: &str, env_name: &str) -> Result<StorageGetResponse> {
        let (cred, sig) = self.get_auth_headers_with_refresh().await?;

        let response = self
            .http
            .get(format!(
                "{}/v1/storage/{}/{}",
                self.config.api_url,
                urlencoding::encode(project_id),
                urlencoding::encode(env_name)
            ))
            .header("X-VeilCloud-Credential", cred)
            .header("X-VeilCloud-Signature", sig)
            .send()
            .await
            .map_err(|e| Error::Network(e.to_string()))?;

        if response.status() == reqwest::StatusCode::NOT_FOUND {
            return Err(Error::NotFound(format!(
                "Blob not found: {}/{}",
                project_id, env_name
            )));
        }

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(Error::Api(format!("Storage get failed ({}): {}", status, body)));
        }

        response
            .json()
            .await
            .map_err(|e| Error::Api(format!("Invalid response: {}", e)))
    }

    /// Delete encrypted data for a project/environment
    pub async fn storage_delete(&self, project_id: &str, env_name: &str) -> Result<()> {
        let (cred, sig) = self.get_auth_headers_with_refresh().await?;

        let response = self
            .http
            .delete(format!(
                "{}/v1/storage/{}/{}",
                self.config.api_url,
                urlencoding::encode(project_id),
                urlencoding::encode(env_name)
            ))
            .header("X-VeilCloud-Credential", cred)
            .header("X-VeilCloud-Signature", sig)
            .send()
            .await
            .map_err(|e| Error::Network(e.to_string()))?;

        if !response.status().is_success() && response.status() != reqwest::StatusCode::NOT_FOUND {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(Error::Api(format!("Storage delete failed ({}): {}", status, body)));
        }

        Ok(())
    }

    /// List all blobs for a project
    pub async fn storage_list(&self, project_id: &str) -> Result<Vec<BlobListEntry>> {
        let (cred, sig) = self.get_auth_headers_with_refresh().await?;
        let mut all_blobs = Vec::new();
        let mut continuation_token: Option<String> = None;

        loop {
            let mut url = format!(
                "{}/v1/storage/{}",
                self.config.api_url,
                urlencoding::encode(project_id)
            );

            if let Some(token) = &continuation_token {
                url.push_str(&format!("?continuationToken={}", urlencoding::encode(token)));
            }

            let response = self
                .http
                .get(&url)
                .header("X-VeilCloud-Credential", &cred)
                .header("X-VeilCloud-Signature", &sig)
                .send()
                .await
                .map_err(|e| Error::Network(e.to_string()))?;

            if !response.status().is_success() {
                let status = response.status();
                let body = response.text().await.unwrap_or_default();
                return Err(Error::Api(format!("Storage list failed ({}): {}", status, body)));
            }

            let list: StorageListResponse = response
                .json()
                .await
                .map_err(|e| Error::Api(format!("Invalid response: {}", e)))?;

            all_blobs.extend(list.blobs);

            if list.has_more {
                continuation_token = list.continuation_token;
            } else {
                break;
            }
        }

        Ok(all_blobs)
    }

    /// Check if blob exists and get metadata
    pub async fn storage_head(&self, project_id: &str, env_name: &str) -> Result<Option<BlobListEntry>> {
        let (cred, sig) = self.get_auth_headers_with_refresh().await?;

        let response = self
            .http
            .head(format!(
                "{}/v1/storage/{}/{}",
                self.config.api_url,
                urlencoding::encode(project_id),
                urlencoding::encode(env_name)
            ))
            .header("X-VeilCloud-Credential", cred)
            .header("X-VeilCloud-Signature", sig)
            .send()
            .await
            .map_err(|e| Error::Network(e.to_string()))?;

        if response.status() == reqwest::StatusCode::NOT_FOUND {
            return Ok(None);
        }

        if !response.status().is_success() {
            let status = response.status();
            return Err(Error::Api(format!("Storage head failed: {}", status)));
        }

        // Parse metadata from headers
        let entry = BlobListEntry {
            key: format!("{}/{}", project_id, env_name),
            size: response
                .headers()
                .get("X-VeilCloud-Size")
                .and_then(|v| v.to_str().ok())
                .and_then(|s| s.parse().ok())
                .unwrap_or(0),
            hash: response
                .headers()
                .get("X-VeilCloud-Hash")
                .and_then(|v| v.to_str().ok())
                .unwrap_or("")
                .to_string(),
            updated_at: Utc::now(),
        };

        Ok(Some(entry))
    }

    /// Health check
    pub async fn health(&self) -> Result<HealthResponse> {
        let response = self
            .http
            .get(format!("{}/health", self.config.api_url))
            .send()
            .await
            .map_err(|e| Error::Network(e.to_string()))?;

        if !response.status().is_success() {
            return Err(Error::Api("Health check failed".to_string()));
        }

        response
            .json()
            .await
            .map_err(|e| Error::Api(format!("Invalid response: {}", e)))
    }
}

#[derive(Debug, Deserialize)]
pub struct HealthResponse {
    pub status: String,
    pub service: String,
    pub version: String,
}

impl Default for VeilCloudClient {
    fn default() -> Self {
        Self::new()
    }
}

// ========== Helper: Convert to internal types ==========

impl From<StorageGetResponse> for StorageEntry {
    fn from(r: StorageGetResponse) -> Self {
        StorageEntry {
            key: String::new(), // Key is derived from project/env
            blob: EncryptedBlob {
                ciphertext: r.data,
                nonce: r.metadata.unwrap_or_default(), // Nonce stored in metadata
                version: r.version,
            },
            metadata: StorageMetadata {
                created_at: Utc::now(),
                updated_at: Utc::now(),
                size_bytes: r.size,
                checksum: String::new(),
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_client_creation() {
        let client = VeilCloudClient::new();
        assert!(!client.is_authenticated());
        assert!(client.current_user().is_none());
    }

    #[test]
    fn test_local_config() {
        let config = VeilCloudConfig::local();
        assert_eq!(config.api_url, "http://localhost:3000");
    }

    #[test]
    fn test_session_restore() {
        let client = VeilCloudClient::new();

        let tokens = AuthTokens {
            credential: "test_credential".to_string(),
            signature: "test_signature".to_string(),
            expires_at: Utc::now() + chrono::Duration::hours(1),
        };

        let user = User {
            id: "user_123".to_string(),
            email: "test@example.com".to_string(),
            name: Some("Test User".to_string()),
            created_at: Utc::now(),
        };

        client.restore_session(tokens, user.clone());

        assert!(client.is_authenticated());
        assert_eq!(client.current_user().unwrap().email, "test@example.com");
    }

    #[test]
    fn test_token_expiry() {
        let tokens = AuthTokens {
            credential: "test".to_string(),
            signature: "test".to_string(),
            expires_at: Utc::now() - chrono::Duration::hours(1),
        };
        assert!(tokens.is_expired());

        let valid_tokens = AuthTokens {
            credential: "test".to_string(),
            signature: "test".to_string(),
            expires_at: Utc::now() + chrono::Duration::hours(1),
        };
        assert!(!valid_tokens.is_expired());
    }
}
