// AWS Parameter Store Integration
// Provides secure parameter management using AWS Systems Manager Parameter Store

use aws_config::meta::region::RegionProviderChain;
use aws_config::BehaviorVersion;
use aws_sdk_ssm::{Client, Error as SsmError};
use aws_sdk_ssm::types::{Parameter as AwsParameter, ParameterType as AwsParameterType};
use serde::{Deserialize, Serialize};
use std::fmt;
use thiserror::Error;

// ========================================
// Error Types
// ========================================

#[derive(Error, Debug)]
pub enum AwsError {
    #[error("AWS SDK error: {0}")]
    SdkError(String),

    #[error("Parameter not found: {0}")]
    ParameterNotFound(String),

    #[error("Invalid parameter path: {0}")]
    InvalidPath(String),

    #[error("Invalid parameter name: {0}")]
    InvalidName(String),

    #[error("Invalid parameter type: {0}")]
    InvalidType(String),

    #[error("Access denied: {0}")]
    AccessDenied(String),

    #[error("Invalid credentials")]
    InvalidCredentials,

    #[error("Invalid region: {0}")]
    InvalidRegion(String),

    #[error("Batch operation failed: {0}")]
    BatchOperationFailed(String),

    #[error("Parameter limit exceeded")]
    ParameterLimitExceeded,
}

pub type Result<T> = std::result::Result<T, AwsError>;

// ========================================
// Configuration Types
// ========================================

/// AWS configuration for Parameter Store access
#[derive(Clone, Serialize, Deserialize)]
pub struct AwsConfig {
    pub access_key: String,
    pub secret_key: String,
    pub region: String,
}

impl fmt::Debug for AwsConfig {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("AwsConfig")
            .field("access_key", &"***")
            .field("secret_key", &"***")
            .field("region", &self.region)
            .finish()
    }
}

// ========================================
// Parameter Types
// ========================================

/// Parameter type enum matching AWS SSM parameter types
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ParameterType {
    String,
    SecureString,
    StringList,
}

impl ParameterType {
    /// Convert to AWS SDK parameter type
    pub fn to_aws_type(&self) -> AwsParameterType {
        match self {
            ParameterType::String => AwsParameterType::String,
            ParameterType::SecureString => AwsParameterType::SecureString,
            ParameterType::StringList => AwsParameterType::StringList,
        }
    }

    /// Convert from AWS SDK parameter type
    pub fn from_aws_type(aws_type: &AwsParameterType) -> Self {
        match aws_type {
            AwsParameterType::String => ParameterType::String,
            AwsParameterType::SecureString => ParameterType::SecureString,
            AwsParameterType::StringList => ParameterType::StringList,
            _ => ParameterType::String, // Default fallback
        }
    }

    /// Get string representation
    pub fn as_str(&self) -> &str {
        match self {
            ParameterType::String => "String",
            ParameterType::SecureString => "SecureString",
            ParameterType::StringList => "StringList",
        }
    }

    /// Parse from string
    pub fn from_str(s: &str) -> Result<Self> {
        match s {
            "String" => Ok(ParameterType::String),
            "SecureString" => Ok(ParameterType::SecureString),
            "StringList" => Ok(ParameterType::StringList),
            _ => Err(AwsError::InvalidType(s.to_string())),
        }
    }
}

// ========================================
// Parameter Model
// ========================================

/// Parameter representation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Parameter {
    pub name: String,
    pub value: String,
    pub param_type: ParameterType,
    pub version: Option<i64>,
    pub last_modified_date: Option<String>,
    pub description: Option<String>,
}

impl Parameter {
    /// Create from AWS SDK parameter
    pub fn from_aws_parameter(aws_param: &AwsParameter) -> Self {
        Parameter {
            name: aws_param.name().unwrap_or_default().to_string(),
            value: aws_param.value().unwrap_or_default().to_string(),
            param_type: aws_param
                .r#type()
                .map(ParameterType::from_aws_type)
                .unwrap_or(ParameterType::String),
            version: Some(aws_param.version()),
            last_modified_date: aws_param
                .last_modified_date()
                .map(|dt| dt.to_string()),
            description: None, // Description is not included in basic parameter queries
        }
    }
}

// ========================================
// AWS Client
// ========================================

/// AWS Systems Manager Parameter Store client
pub struct AwsClient {
    client: Client,
    config: AwsConfig,
}

impl AwsClient {
    /// Create a new AWS client with the provided configuration
    pub fn new(config: AwsConfig) -> Self {
        // Note: This creates a client synchronously for simplicity
        // In real usage, you'd call `build()` in an async context
        let client = Client::from_conf(Self::build_config_sync(&config));

        AwsClient { client, config }
    }

    /// Build AWS configuration synchronously (for non-async constructors)
    fn build_config_sync(config: &AwsConfig) -> aws_sdk_ssm::Config {
        // Create a minimal config - in production, use proper async initialization
        let creds = aws_sdk_ssm::config::Credentials::new(
            &config.access_key,
            &config.secret_key,
            None,
            None,
            "envsync",
        );

        let region = aws_sdk_ssm::config::Region::new(config.region.clone());

        aws_sdk_ssm::Config::builder()
            .credentials_provider(creds)
            .region(region)
            .behavior_version(aws_sdk_ssm::config::BehaviorVersion::latest())
            .build()
    }

    /// Get the current configuration
    pub fn config(&self) -> &AwsConfig {
        &self.config
    }

    // ========================================
    // List Parameters
    // ========================================

    /// List parameters under a given path prefix
    pub async fn list_parameters(&self, path_prefix: &str) -> Result<Vec<Parameter>> {
        if !path_prefix.is_empty() && !self.validate_parameter_path(path_prefix) {
            return Err(AwsError::InvalidPath(path_prefix.to_string()));
        }

        let result = self
            .client
            .get_parameters_by_path()
            .set_path(if path_prefix.is_empty() {
                None
            } else {
                Some(path_prefix.to_string())
            })
            .send()
            .await
            .map_err(|e| AwsError::SdkError(e.to_string()))?;

        Ok(result
            .parameters()
            .iter()
            .map(Parameter::from_aws_parameter)
            .collect())
    }

    /// List parameters recursively under a path
    pub async fn list_parameters_recursive(&self, path_prefix: &str) -> Result<Vec<Parameter>> {
        if !path_prefix.is_empty() && !self.validate_parameter_path(path_prefix) {
            return Err(AwsError::InvalidPath(path_prefix.to_string()));
        }

        let result = self
            .client
            .get_parameters_by_path()
            .set_path(if path_prefix.is_empty() {
                None
            } else {
                Some(path_prefix.to_string())
            })
            .recursive(true)
            .send()
            .await
            .map_err(|e| AwsError::SdkError(e.to_string()))?;

        Ok(result
            .parameters()
            .iter()
            .map(Parameter::from_aws_parameter)
            .collect())
    }

    // ========================================
    // Get Parameter(s)
    // ========================================

    /// Get a single parameter by name
    pub async fn get_parameter(&self, name: &str) -> Result<Parameter> {
        if name.is_empty() {
            return Err(AwsError::InvalidName("Empty parameter name".to_string()));
        }

        if !self.validate_parameter_path(name) {
            return Err(AwsError::InvalidPath(name.to_string()));
        }

        let result = self
            .client
            .get_parameter()
            .name(name)
            .send()
            .await
            .map_err(|e| {
                if e.to_string().contains("ParameterNotFound") {
                    AwsError::ParameterNotFound(name.to_string())
                } else {
                    AwsError::SdkError(e.to_string())
                }
            })?;

        result
            .parameter()
            .map(Parameter::from_aws_parameter)
            .ok_or_else(|| AwsError::ParameterNotFound(name.to_string()))
    }

    /// Get a parameter with decryption option
    pub async fn get_parameter_with_decryption(
        &self,
        name: &str,
        with_decryption: bool,
    ) -> Result<Parameter> {
        if name.is_empty() {
            return Err(AwsError::InvalidName("Empty parameter name".to_string()));
        }

        if !self.validate_parameter_path(name) {
            return Err(AwsError::InvalidPath(name.to_string()));
        }

        let result = self
            .client
            .get_parameter()
            .name(name)
            .with_decryption(with_decryption)
            .send()
            .await
            .map_err(|e| {
                if e.to_string().contains("ParameterNotFound") {
                    AwsError::ParameterNotFound(name.to_string())
                } else {
                    AwsError::SdkError(e.to_string())
                }
            })?;

        result
            .parameter()
            .map(Parameter::from_aws_parameter)
            .ok_or_else(|| AwsError::ParameterNotFound(name.to_string()))
    }

    /// Get multiple parameters by names
    pub async fn get_parameters(&self, names: Vec<String>) -> Result<Vec<Parameter>> {
        if names.is_empty() {
            return Ok(vec![]);
        }

        // AWS SSM limits to 10 parameters per request
        if names.len() > 10 {
            return Err(AwsError::ParameterLimitExceeded);
        }

        // Validate all names
        for name in &names {
            if !self.validate_parameter_path(name) {
                return Err(AwsError::InvalidPath(name.to_string()));
            }
        }

        let result = self
            .client
            .get_parameters()
            .set_names(Some(names))
            .send()
            .await
            .map_err(|e| AwsError::SdkError(e.to_string()))?;

        Ok(result
            .parameters()
            .iter()
            .map(Parameter::from_aws_parameter)
            .collect())
    }

    /// Get multiple parameters with decryption option
    pub async fn get_parameters_with_decryption(
        &self,
        names: Vec<String>,
        with_decryption: bool,
    ) -> Result<Vec<Parameter>> {
        if names.is_empty() {
            return Ok(vec![]);
        }

        if names.len() > 10 {
            return Err(AwsError::ParameterLimitExceeded);
        }

        for name in &names {
            if !self.validate_parameter_path(name) {
                return Err(AwsError::InvalidPath(name.to_string()));
            }
        }

        let result = self
            .client
            .get_parameters()
            .set_names(Some(names))
            .with_decryption(with_decryption)
            .send()
            .await
            .map_err(|e| AwsError::SdkError(e.to_string()))?;

        Ok(result
            .parameters()
            .iter()
            .map(Parameter::from_aws_parameter)
            .collect())
    }

    // ========================================
    // Put Parameter
    // ========================================

    /// Create or update a parameter
    pub async fn put_parameter(
        &self,
        name: &str,
        value: &str,
        param_type: ParameterType,
    ) -> Result<i64> {
        if name.is_empty() {
            return Err(AwsError::InvalidName("Empty parameter name".to_string()));
        }

        if !self.validate_parameter_path(name) {
            return Err(AwsError::InvalidPath(name.to_string()));
        }

        let result = self
            .client
            .put_parameter()
            .name(name)
            .value(value)
            .r#type(param_type.to_aws_type())
            .send()
            .await
            .map_err(|e| AwsError::SdkError(e.to_string()))?;

        Ok(result.version())
    }

    /// Put parameter with description
    pub async fn put_parameter_with_description(
        &self,
        name: &str,
        value: &str,
        param_type: ParameterType,
        description: &str,
    ) -> Result<i64> {
        if name.is_empty() {
            return Err(AwsError::InvalidName("Empty parameter name".to_string()));
        }

        if !self.validate_parameter_path(name) {
            return Err(AwsError::InvalidPath(name.to_string()));
        }

        let result = self
            .client
            .put_parameter()
            .name(name)
            .value(value)
            .r#type(param_type.to_aws_type())
            .description(description)
            .send()
            .await
            .map_err(|e| AwsError::SdkError(e.to_string()))?;

        Ok(result.version())
    }

    /// Put parameter with overwrite option
    pub async fn put_parameter_overwrite(
        &self,
        name: &str,
        value: &str,
        param_type: ParameterType,
        overwrite: bool,
    ) -> Result<i64> {
        if name.is_empty() {
            return Err(AwsError::InvalidName("Empty parameter name".to_string()));
        }

        if !self.validate_parameter_path(name) {
            return Err(AwsError::InvalidPath(name.to_string()));
        }

        let result = self
            .client
            .put_parameter()
            .name(name)
            .value(value)
            .r#type(param_type.to_aws_type())
            .overwrite(overwrite)
            .send()
            .await
            .map_err(|e| AwsError::SdkError(e.to_string()))?;

        Ok(result.version())
    }

    // ========================================
    // Delete Parameter
    // ========================================

    /// Delete a parameter
    pub async fn delete_parameter(&self, name: &str) -> Result<()> {
        if name.is_empty() {
            return Err(AwsError::InvalidName("Empty parameter name".to_string()));
        }

        if !self.validate_parameter_path(name) {
            return Err(AwsError::InvalidPath(name.to_string()));
        }

        self.client
            .delete_parameter()
            .name(name)
            .send()
            .await
            .map_err(|e| {
                if e.to_string().contains("ParameterNotFound") {
                    AwsError::ParameterNotFound(name.to_string())
                } else {
                    AwsError::SdkError(e.to_string())
                }
            })?;

        Ok(())
    }

    // ========================================
    // Batch Operations
    // ========================================

    /// Batch put parameters
    pub async fn batch_put_parameters(
        &self,
        parameters: Vec<(String, String, ParameterType)>,
    ) -> Result<Vec<i64>> {
        let mut versions = Vec::new();

        for (name, value, param_type) in parameters {
            let version = self.put_parameter(&name, &value, param_type).await?;
            versions.push(version);
        }

        Ok(versions)
    }

    /// Batch delete parameters
    pub async fn batch_delete_parameters(&self, names: Vec<String>) -> Result<()> {
        for name in names {
            self.delete_parameter(&name).await?;
        }

        Ok(())
    }

    // ========================================
    // Validation Helpers
    // ========================================

    /// Validate parameter path format
    pub fn validate_parameter_path(&self, path: &str) -> bool {
        if path.is_empty() {
            return false;
        }

        // Must start with /
        if !path.starts_with('/') {
            return false;
        }

        // Maximum length is 2048 characters
        if path.len() > 2048 {
            return false;
        }

        // Can only contain: a-z, A-Z, 0-9, /, ., _, -
        let valid_chars = |c: char| {
            c.is_ascii_alphanumeric() || c == '/' || c == '.' || c == '_' || c == '-'
        };

        path.chars().all(valid_chars)
    }

    /// Validate parameter name
    pub fn validate_parameter_name(&self, name: &str) -> bool {
        self.validate_parameter_path(name)
    }

    // ========================================
    // Path Helpers
    // ========================================

    /// Parse parameter path into parts
    pub fn parse_parameter_path(&self, path: &str) -> Vec<String> {
        path.trim_start_matches('/')
            .split('/')
            .map(|s| s.to_string())
            .collect()
    }

    /// Convert path to hierarchy
    pub fn path_to_hierarchy(&self, path: &str) -> Vec<String> {
        let parts = self.parse_parameter_path(path);
        let mut hierarchy = Vec::new();
        let mut current = String::new();

        for part in parts {
            current.push('/');
            current.push_str(&part);
            hierarchy.push(current.clone());
        }

        hierarchy
    }
}

// ========================================
// Tests
// ========================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parameter_type_conversion() {
        assert_eq!(ParameterType::String.as_str(), "String");
        assert_eq!(ParameterType::SecureString.as_str(), "SecureString");
        assert_eq!(ParameterType::StringList.as_str(), "StringList");
    }

    #[test]
    fn test_parameter_type_from_str() {
        assert!(matches!(
            ParameterType::from_str("String"),
            Ok(ParameterType::String)
        ));
        assert!(matches!(
            ParameterType::from_str("SecureString"),
            Ok(ParameterType::SecureString)
        ));
        assert!(ParameterType::from_str("Invalid").is_err());
    }

    #[test]
    fn test_path_validation() {
        let config = AwsConfig {
            access_key: "test".to_string(),
            secret_key: "test".to_string(),
            region: "us-east-1".to_string(),
        };
        let client = AwsClient::new(config);

        assert!(client.validate_parameter_path("/app/database/host"));
        assert!(client.validate_parameter_path("/production/api/key"));
        assert!(!client.validate_parameter_path("app/database/host")); // No leading /
        assert!(!client.validate_parameter_path("")); // Empty
        assert!(!client.validate_parameter_path("/app/host!")); // Invalid char
    }

    #[test]
    fn test_parse_parameter_path() {
        let config = AwsConfig {
            access_key: "test".to_string(),
            secret_key: "test".to_string(),
            region: "us-east-1".to_string(),
        };
        let client = AwsClient::new(config);

        let parts = client.parse_parameter_path("/app/production/database/host");
        assert_eq!(parts, vec!["app", "production", "database", "host"]);
    }

    #[test]
    fn test_path_to_hierarchy() {
        let config = AwsConfig {
            access_key: "test".to_string(),
            secret_key: "test".to_string(),
            region: "us-east-1".to_string(),
        };
        let client = AwsClient::new(config);

        let hierarchy = client.path_to_hierarchy("/app/production/database");
        assert_eq!(hierarchy.len(), 3);
        assert_eq!(hierarchy[0], "/app");
        assert_eq!(hierarchy[1], "/app/production");
        assert_eq!(hierarchy[2], "/app/production/database");
    }
}
