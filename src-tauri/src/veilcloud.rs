//! VeilCloud Client SDK
//!
//! Client for VeilCloud zero-knowledge storage and services.
//! All encryption happens client-side - VeilCloud never sees plaintext.
//!
//! Based on VeilCloud API design from the VeilSuite project.

use chrono::{DateTime, Duration, Utc};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::sync::RwLock;

use crate::error::{Error, Result};
use crate::models::{AuthTokens, EncryptedBlob, StorageEntry, StorageMetadata, User};

/// VeilCloud API configuration
#[derive(Debug, Clone)]
pub struct VeilCloudConfig {
    pub api_url: String,
    pub api_key: Option<String>,
}

impl Default for VeilCloudConfig {
    fn default() -> Self {
        Self {
            api_url: "https://api.veilcloud.io/v1".to_string(),
            api_key: None,
        }
    }
}

impl VeilCloudConfig {
    pub fn local() -> Self {
        Self {
            api_url: "http://localhost:8000/v1".to_string(),
            api_key: None,
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

// ========== API Request/Response Types ==========

#[derive(Debug, Serialize)]
struct SignupRequest {
    email: String,
    password: String,
    name: Option<String>,
}

#[derive(Debug, Serialize)]
struct LoginRequest {
    email: String,
    password: String,
}

#[derive(Debug, Deserialize)]
struct AuthResponse {
    user: UserResponse,
    access_token: String,
    refresh_token: String,
    expires_in: i64,
}

#[derive(Debug, Deserialize)]
struct UserResponse {
    id: String,
    email: String,
    name: Option<String>,
    created_at: DateTime<Utc>,
}

impl From<UserResponse> for User {
    fn from(r: UserResponse) -> Self {
        User {
            id: r.id,
            email: r.email,
            name: r.name,
            created_at: r.created_at,
        }
    }
}

#[derive(Debug, Serialize)]
struct RefreshRequest {
    refresh_token: String,
}

#[derive(Debug, Deserialize)]
struct RefreshResponse {
    access_token: String,
    refresh_token: String,
    expires_in: i64,
}

/// Blob upload request (matches VeilCloud API)
#[derive(Debug, Serialize)]
pub struct BlobPutRequest {
    pub key: String,
    pub data: String,      // Base64 encoded ciphertext
    pub nonce: String,     // Base64 encoded nonce
    pub version: u64,
    pub metadata: Option<BlobMetadataRequest>,
}

#[derive(Debug, Serialize)]
pub struct BlobMetadataRequest {
    pub content_type: Option<String>,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct BlobResponse {
    pub id: String,
    pub key: String,
    pub version: u64,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub size_bytes: u64,
    pub checksum: String,
}

#[derive(Debug, Deserialize)]
pub struct BlobGetResponse {
    pub id: String,
    pub key: String,
    pub data: String,      // Base64 encoded ciphertext
    pub nonce: String,     // Base64 encoded nonce
    pub version: u64,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub size_bytes: u64,
    pub checksum: String,
}

#[derive(Debug, Deserialize)]
pub struct BlobListResponse {
    pub blobs: Vec<BlobListEntry>,
    pub next_cursor: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct BlobListEntry {
    pub id: String,
    pub key: String,
    pub version: u64,
    pub updated_at: DateTime<Utc>,
    pub size_bytes: u64,
    pub checksum: String,
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

    /// Sign up for a new VeilCloud account
    pub async fn signup(&self, email: &str, password: &str, name: Option<&str>) -> Result<User> {
        let request = SignupRequest {
            email: email.to_string(),
            password: password.to_string(),
            name: name.map(String::from),
        };

        let response = self
            .http
            .post(format!("{}/auth/signup", self.config.api_url))
            .json(&request)
            .send()
            .await
            .map_err(|e| Error::Network(e.to_string()))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(Error::Api(format!("Signup failed ({}): {}", status, body)));
        }

        let auth: AuthResponse = response
            .json()
            .await
            .map_err(|e| Error::Api(format!("Invalid response: {}", e)))?;

        let user: User = auth.user.into();
        let tokens = AuthTokens {
            access_token: auth.access_token,
            refresh_token: auth.refresh_token,
            expires_at: Utc::now() + Duration::seconds(auth.expires_in),
        };

        *self.auth.write().unwrap() = Some(AuthState {
            tokens,
            user: user.clone(),
        });

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
            .post(format!("{}/auth/login", self.config.api_url))
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
        let tokens = AuthTokens {
            access_token: auth.access_token,
            refresh_token: auth.refresh_token,
            expires_at: Utc::now() + Duration::seconds(auth.expires_in),
        };

        *self.auth.write().unwrap() = Some(AuthState {
            tokens,
            user: user.clone(),
        });

        Ok(user)
    }

    /// Log out and clear tokens
    pub fn logout(&self) {
        self.clear_session();
    }

    /// Refresh the access token
    pub async fn refresh_token(&self) -> Result<()> {
        let refresh_token = {
            let auth = self.auth.read().unwrap();
            match &*auth {
                Some(state) => state.tokens.refresh_token.clone(),
                None => return Err(Error::NotAuthenticated),
            }
        };

        let request = RefreshRequest { refresh_token };

        let response = self
            .http
            .post(format!("{}/auth/refresh", self.config.api_url))
            .json(&request)
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
            state.tokens.access_token = refresh.access_token;
            state.tokens.refresh_token = refresh.refresh_token;
            state.tokens.expires_at = Utc::now() + Duration::seconds(refresh.expires_in);
        }

        Ok(())
    }

    /// Get authorization header, refreshing token if needed
    async fn get_auth_header(&self) -> Result<String> {
        {
            let auth = self.auth.read().unwrap();
            match &*auth {
                Some(state) => {
                    if state.tokens.expires_at > Utc::now() + Duration::minutes(5) {
                        return Ok(format!("Bearer {}", state.tokens.access_token));
                    }
                }
                None => return Err(Error::NotAuthenticated),
            }
        }

        self.refresh_token().await?;

        let auth = self.auth.read().unwrap();
        match &*auth {
            Some(state) => Ok(format!("Bearer {}", state.tokens.access_token)),
            None => Err(Error::NotAuthenticated),
        }
    }

    // ========== Blob Storage (ZK Storage) ==========
    // Based on VeilCloud API: POST /v1/blobs, GET /v1/blobs/:id, etc.

    /// Upload an encrypted blob
    pub async fn blob_put(&self, request: BlobPutRequest) -> Result<BlobResponse> {
        let auth_header = self.get_auth_header().await?;

        let response = self
            .http
            .post(format!("{}/blobs", self.config.api_url))
            .header("Authorization", auth_header)
            .json(&request)
            .send()
            .await
            .map_err(|e| Error::Network(e.to_string()))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(Error::Api(format!("Blob put failed ({}): {}", status, body)));
        }

        response
            .json()
            .await
            .map_err(|e| Error::Api(format!("Invalid response: {}", e)))
    }

    /// Get an encrypted blob by key
    pub async fn blob_get(&self, key: &str) -> Result<BlobGetResponse> {
        let auth_header = self.get_auth_header().await?;

        let response = self
            .http
            .get(format!("{}/blobs/{}", self.config.api_url, urlencoding::encode(key)))
            .header("Authorization", auth_header)
            .send()
            .await
            .map_err(|e| Error::Network(e.to_string()))?;

        if response.status() == reqwest::StatusCode::NOT_FOUND {
            return Err(Error::NotFound(format!("Blob not found: {}", key)));
        }

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(Error::Api(format!("Blob get failed ({}): {}", status, body)));
        }

        response
            .json()
            .await
            .map_err(|e| Error::Api(format!("Invalid response: {}", e)))
    }

    /// Delete a blob
    pub async fn blob_delete(&self, key: &str) -> Result<()> {
        let auth_header = self.get_auth_header().await?;

        let response = self
            .http
            .delete(format!("{}/blobs/{}", self.config.api_url, urlencoding::encode(key)))
            .header("Authorization", auth_header)
            .send()
            .await
            .map_err(|e| Error::Network(e.to_string()))?;

        if !response.status().is_success() && response.status() != reqwest::StatusCode::NOT_FOUND {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(Error::Api(format!("Blob delete failed ({}): {}", status, body)));
        }

        Ok(())
    }

    /// List blobs with optional prefix filter
    pub async fn blob_list(&self, prefix: Option<&str>) -> Result<Vec<BlobListEntry>> {
        let auth_header = self.get_auth_header().await?;
        let mut all_blobs = Vec::new();
        let mut cursor: Option<String> = None;

        loop {
            let mut url = format!("{}/blobs", self.config.api_url);
            let mut params = Vec::new();

            if let Some(p) = prefix {
                params.push(format!("prefix={}", urlencoding::encode(p)));
            }
            if let Some(c) = &cursor {
                params.push(format!("cursor={}", urlencoding::encode(c)));
            }
            if !params.is_empty() {
                url.push('?');
                url.push_str(&params.join("&"));
            }

            let response = self
                .http
                .get(&url)
                .header("Authorization", &auth_header)
                .send()
                .await
                .map_err(|e| Error::Network(e.to_string()))?;

            if !response.status().is_success() {
                let status = response.status();
                let body = response.text().await.unwrap_or_default();
                return Err(Error::Api(format!("Blob list failed ({}): {}", status, body)));
            }

            let list: BlobListResponse = response
                .json()
                .await
                .map_err(|e| Error::Api(format!("Invalid response: {}", e)))?;

            all_blobs.extend(list.blobs);

            match list.next_cursor {
                Some(c) => cursor = Some(c),
                None => break,
            }
        }

        Ok(all_blobs)
    }

    /// Check if a blob exists and get its version
    pub async fn blob_head(&self, key: &str) -> Result<Option<BlobListEntry>> {
        let auth_header = self.get_auth_header().await?;

        let response = self
            .http
            .head(format!("{}/blobs/{}", self.config.api_url, urlencoding::encode(key)))
            .header("Authorization", auth_header)
            .send()
            .await
            .map_err(|e| Error::Network(e.to_string()))?;

        if response.status() == reqwest::StatusCode::NOT_FOUND {
            return Ok(None);
        }

        if !response.status().is_success() {
            let status = response.status();
            return Err(Error::Api(format!("Blob head failed: {}", status)));
        }

        // Parse metadata from headers
        let entry = BlobListEntry {
            id: response
                .headers()
                .get("x-blob-id")
                .and_then(|v| v.to_str().ok())
                .unwrap_or("")
                .to_string(),
            key: key.to_string(),
            version: response
                .headers()
                .get("x-blob-version")
                .and_then(|v| v.to_str().ok())
                .and_then(|s| s.parse().ok())
                .unwrap_or(1),
            updated_at: response
                .headers()
                .get("x-updated-at")
                .and_then(|v| v.to_str().ok())
                .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
                .map(|dt| dt.with_timezone(&Utc))
                .unwrap_or_else(Utc::now),
            size_bytes: response
                .headers()
                .get("content-length")
                .and_then(|v| v.to_str().ok())
                .and_then(|s| s.parse().ok())
                .unwrap_or(0),
            checksum: response
                .headers()
                .get("x-checksum")
                .and_then(|v| v.to_str().ok())
                .unwrap_or("")
                .to_string(),
        };

        Ok(Some(entry))
    }

    /// Get blob version history
    pub async fn blob_versions(&self, key: &str) -> Result<Vec<BlobListEntry>> {
        let auth_header = self.get_auth_header().await?;

        let response = self
            .http
            .get(format!("{}/blobs/{}/versions", self.config.api_url, urlencoding::encode(key)))
            .header("Authorization", auth_header)
            .send()
            .await
            .map_err(|e| Error::Network(e.to_string()))?;

        if response.status() == reqwest::StatusCode::NOT_FOUND {
            return Err(Error::NotFound(format!("Blob not found: {}", key)));
        }

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(Error::Api(format!("Blob versions failed ({}): {}", status, body)));
        }

        #[derive(Deserialize)]
        struct VersionsResponse {
            versions: Vec<BlobListEntry>,
        }

        let resp: VersionsResponse = response
            .json()
            .await
            .map_err(|e| Error::Api(format!("Invalid response: {}", e)))?;

        Ok(resp.versions)
    }
}

impl Default for VeilCloudClient {
    fn default() -> Self {
        Self::new()
    }
}

// ========== Helper: Convert to internal types ==========

impl From<BlobGetResponse> for StorageEntry {
    fn from(r: BlobGetResponse) -> Self {
        StorageEntry {
            key: r.key,
            blob: EncryptedBlob {
                ciphertext: r.data,
                nonce: r.nonce,
                version: r.version,
            },
            metadata: StorageMetadata {
                created_at: r.created_at,
                updated_at: r.updated_at,
                size_bytes: r.size_bytes,
                checksum: r.checksum,
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
        assert_eq!(config.api_url, "http://localhost:8000/v1");
    }

    #[test]
    fn test_session_restore() {
        let client = VeilCloudClient::new();

        let tokens = AuthTokens {
            access_token: "test_access".to_string(),
            refresh_token: "test_refresh".to_string(),
            expires_at: Utc::now() + Duration::hours(1),
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
}
