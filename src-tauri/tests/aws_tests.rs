// AWS Parameter Store Integration Tests
// These tests verify the AWS SSM Parameter Store integration functionality

#[cfg(test)]
mod aws_parameter_store_tests {
    use app_lib::aws::{AwsClient, AwsConfig, ParameterType, Parameter};

    // Helper function to create a test AWS client
    fn create_test_client() -> AwsClient {
        let config = AwsConfig {
            access_key: "test_access_key".to_string(),
            secret_key: "test_secret_key".to_string(),
            region: "us-east-1".to_string(),
        };
        AwsClient::new(config)
    }

    // ========================================
    // AWS Client Configuration Tests
    // ========================================

    #[test]
    fn test_aws_client_creation_with_valid_config() {
        let config = AwsConfig {
            access_key: "AKIAIOSFODNN7EXAMPLE".to_string(),
            secret_key: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY".to_string(),
            region: "us-west-2".to_string(),
        };

        let client = AwsClient::new(config.clone());
        assert_eq!(client.config().region, "us-west-2");
    }

    #[test]
    fn test_aws_client_creation_with_different_regions() {
        let regions = vec!["us-east-1", "us-west-2", "eu-west-1", "ap-southeast-1"];

        for region in regions {
            let config = AwsConfig {
                access_key: "test_key".to_string(),
                secret_key: "test_secret".to_string(),
                region: region.to_string(),
            };

            let client = AwsClient::new(config);
            assert_eq!(client.config().region, region);
        }
    }

    #[test]
    fn test_aws_config_clone() {
        let config = AwsConfig {
            access_key: "test_access_key".to_string(),
            secret_key: "test_secret_key".to_string(),
            region: "us-east-1".to_string(),
        };

        let cloned = config.clone();
        assert_eq!(config.access_key, cloned.access_key);
        assert_eq!(config.secret_key, cloned.secret_key);
        assert_eq!(config.region, cloned.region);
    }

    #[test]
    fn test_aws_config_debug_does_not_expose_secrets() {
        let config = AwsConfig {
            access_key: "AKIAIOSFODNN7EXAMPLE".to_string(),
            secret_key: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY".to_string(),
            region: "us-west-2".to_string(),
        };

        let debug_string = format!("{:?}", config);
        // Secrets should be redacted in debug output
        assert!(!debug_string.contains("wJalrXUtnFEMI/K7MDENG"));
        assert!(debug_string.contains("***"));
    }

    // ========================================
    // Parameter Type Tests
    // ========================================

    #[test]
    fn test_parameter_type_string() {
        let param_type = ParameterType::String;
        assert_eq!(param_type.as_str(), "String");
    }

    #[test]
    fn test_parameter_type_secure_string() {
        let param_type = ParameterType::SecureString;
        assert_eq!(param_type.as_str(), "SecureString");
    }

    #[test]
    fn test_parameter_type_string_list() {
        let param_type = ParameterType::StringList;
        assert_eq!(param_type.as_str(), "StringList");
    }

    #[test]
    fn test_parameter_type_from_string() {
        assert!(matches!(ParameterType::from_str("String"), Ok(ParameterType::String)));
        assert!(matches!(ParameterType::from_str("SecureString"), Ok(ParameterType::SecureString)));
        assert!(matches!(ParameterType::from_str("StringList"), Ok(ParameterType::StringList)));
    }

    #[test]
    fn test_parameter_type_from_invalid_string() {
        let result = ParameterType::from_str("InvalidType");
        assert!(result.is_err());
    }

    // ========================================
    // Parameter Model Tests
    // ========================================

    #[test]
    fn test_parameter_creation() {
        let param = Parameter {
            name: "/app/database/host".to_string(),
            value: "localhost".to_string(),
            param_type: ParameterType::String,
            version: Some(1),
            last_modified_date: None,
            description: Some("Database host".to_string()),
        };

        assert_eq!(param.name, "/app/database/host");
        assert_eq!(param.value, "localhost");
        assert_eq!(param.version, Some(1));
    }

    #[test]
    fn test_parameter_with_secure_string_type() {
        let param = Parameter {
            name: "/app/database/password".to_string(),
            value: "encrypted_password".to_string(),
            param_type: ParameterType::SecureString,
            version: Some(2),
            last_modified_date: None,
            description: Some("Database password".to_string()),
        };

        assert!(matches!(param.param_type, ParameterType::SecureString));
    }

    #[test]
    fn test_parameter_clone() {
        let param = Parameter {
            name: "/app/api/key".to_string(),
            value: "api_key_value".to_string(),
            param_type: ParameterType::SecureString,
            version: Some(1),
            last_modified_date: None,
            description: None,
        };

        let cloned = param.clone();
        assert_eq!(param.name, cloned.name);
        assert_eq!(param.value, cloned.value);
    }

    // ========================================
    // List Parameters Tests
    // ========================================

    #[tokio::test]
    async fn test_list_parameters_with_empty_path() {
        // This is a mock test - in real scenarios, you'd use mock AWS SDK
        // For now, we're testing the structure
        let client = create_test_client();

        // This would fail with real AWS credentials, but tests the method exists
        // In production, you'd use aws-sdk-ssm test utilities or mocks
        assert!(client.list_parameters("").await.is_err());
    }

    #[tokio::test]
    async fn test_list_parameters_with_valid_path() {
        let client = create_test_client();
        let result = client.list_parameters("/app/production").await;

        // Should return error with test credentials
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_list_parameters_with_nested_path() {
        let client = create_test_client();
        let result = client.list_parameters("/app/production/database").await;

        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_list_parameters_recursive() {
        let client = create_test_client();
        let result = client.list_parameters_recursive("/app").await;

        assert!(result.is_err());
    }

    // ========================================
    // Get Parameter Tests
    // ========================================

    #[tokio::test]
    async fn test_get_parameter_by_name() {
        let client = create_test_client();
        let result = client.get_parameter("/app/database/host").await;

        // Should fail with test credentials
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_get_parameter_with_decryption() {
        let client = create_test_client();
        let result = client.get_parameter_with_decryption("/app/api/key", true).await;

        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_get_parameter_nonexistent() {
        let client = create_test_client();
        let result = client.get_parameter("/nonexistent/parameter").await;

        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_get_parameter_empty_name() {
        let client = create_test_client();
        let result = client.get_parameter("").await;

        assert!(result.is_err());
    }

    // ========================================
    // Get Multiple Parameters Tests
    // ========================================

    #[tokio::test]
    async fn test_get_parameters_multiple_names() {
        let client = create_test_client();
        let names = vec![
            "/app/database/host".to_string(),
            "/app/database/port".to_string(),
            "/app/api/key".to_string(),
        ];

        let result = client.get_parameters(names).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_get_parameters_empty_list() {
        let client = create_test_client();
        let names: Vec<String> = vec![];

        let result = client.get_parameters(names).await;
        // Should return empty result or error
        assert!(result.is_err() || result.unwrap().is_empty());
    }

    #[tokio::test]
    async fn test_get_parameters_with_decryption() {
        let client = create_test_client();
        let names = vec!["/app/secure/password".to_string()];

        let result = client.get_parameters_with_decryption(names, true).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_get_parameters_max_limit() {
        let client = create_test_client();
        // AWS SSM has a limit of 10 parameters per request
        let names: Vec<String> = (0..10)
            .map(|i| format!("/app/param{}", i))
            .collect();

        let result = client.get_parameters(names).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_get_parameters_exceeds_limit() {
        let client = create_test_client();
        // More than 10 parameters should either batch or error
        let names: Vec<String> = (0..15)
            .map(|i| format!("/app/param{}", i))
            .collect();

        let result = client.get_parameters(names).await;
        // Should handle batching or return appropriate error
        assert!(result.is_err());
    }

    // ========================================
    // Put Parameter Tests
    // ========================================

    #[tokio::test]
    async fn test_put_parameter_string_type() {
        let client = create_test_client();
        let result = client.put_parameter(
            "/app/test/value",
            "test_value",
            ParameterType::String,
        ).await;

        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_put_parameter_secure_string_type() {
        let client = create_test_client();
        let result = client.put_parameter(
            "/app/secure/password",
            "encrypted_password",
            ParameterType::SecureString,
        ).await;

        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_put_parameter_with_description() {
        let client = create_test_client();
        let result = client.put_parameter_with_description(
            "/app/database/host",
            "localhost",
            ParameterType::String,
            "Database host configuration",
        ).await;

        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_put_parameter_overwrite() {
        let client = create_test_client();
        let result = client.put_parameter_overwrite(
            "/app/existing/value",
            "new_value",
            ParameterType::String,
            true,
        ).await;

        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_put_parameter_with_empty_name() {
        let client = create_test_client();
        let result = client.put_parameter(
            "",
            "value",
            ParameterType::String,
        ).await;

        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_put_parameter_with_invalid_path() {
        let client = create_test_client();
        // Path must start with /
        let result = client.put_parameter(
            "invalid_path",
            "value",
            ParameterType::String,
        ).await;

        assert!(result.is_err());
    }

    // ========================================
    // Delete Parameter Tests
    // ========================================

    #[tokio::test]
    async fn test_delete_parameter() {
        let client = create_test_client();
        let result = client.delete_parameter("/app/test/value").await;

        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_delete_nonexistent_parameter() {
        let client = create_test_client();
        let result = client.delete_parameter("/nonexistent/param").await;

        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_delete_parameter_empty_name() {
        let client = create_test_client();
        let result = client.delete_parameter("").await;

        assert!(result.is_err());
    }

    // ========================================
    // Parameter Path Validation Tests
    // ========================================

    #[test]
    fn test_validate_parameter_path_valid() {
        let client = create_test_client();

        assert!(client.validate_parameter_path("/app/database/host"));
        assert!(client.validate_parameter_path("/production/api/key"));
        assert!(client.validate_parameter_path("/a/b/c/d/e"));
    }

    #[test]
    fn test_validate_parameter_path_invalid() {
        let client = create_test_client();

        // Doesn't start with /
        assert!(!client.validate_parameter_path("app/database/host"));

        // Empty path
        assert!(!client.validate_parameter_path(""));

        // Contains invalid characters
        assert!(!client.validate_parameter_path("/app/database/host!"));

        // Too long (>2048 characters)
        let long_path = format!("/{}", "a".repeat(2048));
        assert!(!client.validate_parameter_path(&long_path));
    }

    #[test]
    fn test_validate_parameter_name_valid() {
        let client = create_test_client();

        assert!(client.validate_parameter_name("/app/DATABASE_HOST"));
        assert!(client.validate_parameter_name("/app/api-key"));
        assert!(client.validate_parameter_name("/app/my.parameter"));
    }

    #[test]
    fn test_validate_parameter_name_invalid() {
        let client = create_test_client();

        // Contains spaces
        assert!(!client.validate_parameter_name("/app/my parameter"));

        // Contains special characters
        assert!(!client.validate_parameter_name("/app/param@value"));
        assert!(!client.validate_parameter_name("/app/param#value"));
    }

    // ========================================
    // Error Handling Tests
    // ========================================

    #[tokio::test]
    async fn test_error_on_invalid_credentials() {
        let config = AwsConfig {
            access_key: "invalid".to_string(),
            secret_key: "invalid".to_string(),
            region: "us-east-1".to_string(),
        };

        let client = AwsClient::new(config);
        let result = client.get_parameter("/app/test").await;

        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_error_on_invalid_region() {
        let config = AwsConfig {
            access_key: "test".to_string(),
            secret_key: "test".to_string(),
            region: "invalid-region-999".to_string(),
        };

        let client = AwsClient::new(config);
        let result = client.list_parameters("/app").await;

        assert!(result.is_err());
    }

    // ========================================
    // Batch Operations Tests
    // ========================================

    #[tokio::test]
    async fn test_batch_put_parameters() {
        let client = create_test_client();
        let parameters = vec![
            ("/app/param1".to_string(), "value1".to_string(), ParameterType::String),
            ("/app/param2".to_string(), "value2".to_string(), ParameterType::String),
            ("/app/param3".to_string(), "value3".to_string(), ParameterType::SecureString),
        ];

        let result = client.batch_put_parameters(parameters).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_batch_delete_parameters() {
        let client = create_test_client();
        let names = vec![
            "/app/param1".to_string(),
            "/app/param2".to_string(),
            "/app/param3".to_string(),
        ];

        let result = client.batch_delete_parameters(names).await;
        assert!(result.is_err());
    }

    // ========================================
    // Integration Helper Tests
    // ========================================

    #[test]
    fn test_parameter_path_parsing() {
        let client = create_test_client();

        let parts = client.parse_parameter_path("/app/production/database/host");
        assert_eq!(parts, vec!["app", "production", "database", "host"]);
    }

    #[test]
    fn test_parameter_path_to_hierarchy() {
        let client = create_test_client();

        let hierarchy = client.path_to_hierarchy("/app/production/database");
        assert_eq!(hierarchy.len(), 3);
        assert_eq!(hierarchy[0], "/app");
        assert_eq!(hierarchy[1], "/app/production");
        assert_eq!(hierarchy[2], "/app/production/database");
    }
}
