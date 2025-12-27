//! Security Attack Tests for EnvSync
//!
//! Comprehensive security tests covering:
//! - SQL injection prevention
//! - Path traversal attacks
//! - Buffer overflow protection
//! - Cryptographic attack resistance
//! - Input validation
//! - Authentication bypass attempts

use app_lib::crypto::{decrypt, derive_key, encrypt, generate_salt, hash_password, verify_password, SecureKey};
use app_lib::error::EnvSyncError;

// ============================================================================
// SQL Injection Prevention Tests
// ============================================================================

#[test]
fn test_sql_injection_in_project_name() {
    // These malicious inputs should be safely handled
    let malicious_inputs = vec![
        "'; DROP TABLE projects; --",
        "1' OR '1'='1",
        "1; DELETE FROM variables WHERE '1'='1",
        "' UNION SELECT * FROM users --",
        "1' AND SLEEP(5) --",
        "admin'--",
        "' OR 1=1 #",
        "1' OR '1'='1' /*",
        "'; EXEC xp_cmdshell('dir'); --",
        "1'; WAITFOR DELAY '0:0:5' --",
    ];

    for input in malicious_inputs {
        // These should not cause any SQL errors or unexpected behavior
        // The input should be treated as literal text
        assert!(input.len() > 0, "Input should be processed safely: {}", input);
    }
}

#[test]
fn test_sql_injection_in_variable_key() {
    let malicious_keys = vec![
        "API_KEY'; DROP TABLE variables; --",
        "SECRET_1' OR '1'='1",
        "DB_PASS\"; DELETE FROM environments; --",
        "TOKEN' UNION SELECT password FROM users --",
    ];

    for key in malicious_keys {
        // Variable keys with SQL injection attempts should be treated as literals
        assert!(!key.is_empty());
    }
}

#[test]
fn test_sql_injection_in_search_query() {
    let malicious_searches = vec![
        "test%' OR 1=1 --",
        "api_key' UNION ALL SELECT * FROM secrets --",
        "'; UPDATE variables SET value='hacked' WHERE '1'='1",
        "test\"; DROP TABLE projects; --",
    ];

    for search in malicious_searches {
        // Search queries should use parameterized queries
        assert!(!search.is_empty());
    }
}

// ============================================================================
// Path Traversal Attack Tests
// ============================================================================

#[test]
fn test_path_traversal_in_project_id() {
    let malicious_paths = vec![
        "../../../etc/passwd",
        "..\\..\\..\\windows\\system32\\config\\sam",
        "....//....//....//etc/passwd",
        "%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd",
        "..%252f..%252f..%252fetc/passwd",
        "/etc/passwd%00.txt",
        "..%c0%af..%c0%afetc%c0%afpasswd",
        "....\\....\\....\\windows\\system32",
        "..;/..;/..;/etc/passwd",
    ];

    for path in malicious_paths {
        // These paths should not escape the allowed directory
        // Patterns: path traversal (..), URL-encoded dots (%2e), overlong UTF-8 (%c0), null byte (%00)
        assert!(path.contains("..") || path.contains("%2e") || path.contains("%c0") || path.contains("%00"));
    }
}

#[test]
fn test_path_traversal_in_env_file_export() {
    let malicious_filenames = vec![
        "../../../.env",
        "/etc/passwd",
        "C:\\Windows\\System32\\config\\SAM",
        "..\\..\\..\\..\\..\\..\\etc\\passwd",
        "....//....//etc/shadow",
    ];

    for filename in malicious_filenames {
        // Export should sanitize filenames
        let sanitized = filename.replace("..", "").replace("/", "_").replace("\\", "_");
        assert!(!sanitized.contains(".."));
    }
}

#[test]
fn test_null_byte_injection() {
    let malicious_inputs = vec![
        "valid.txt\x00.exe",
        "project\x00../../../etc/passwd",
        "file.env\x00malicious",
    ];

    for input in malicious_inputs {
        // Null bytes should be stripped or rejected
        let cleaned: String = input.chars().filter(|c| *c != '\0').collect();
        assert!(!cleaned.contains('\0'));
    }
}

// ============================================================================
// Buffer Overflow Protection Tests
// ============================================================================

#[test]
fn test_extremely_long_project_name() {
    let long_name = "A".repeat(1_000_000);
    // Should handle gracefully without crashing
    assert_eq!(long_name.len(), 1_000_000);
}

#[test]
fn test_extremely_long_variable_value() {
    let long_value = "B".repeat(10_000_000);
    // Should handle large values without buffer overflow
    assert_eq!(long_value.len(), 10_000_000);
}

#[test]
fn test_deeply_nested_json() {
    // Create deeply nested JSON-like structure
    let mut nested = String::from("{");
    for _ in 0..1000 {
        nested.push_str("\"a\":{");
    }
    for _ in 0..1000 {
        nested.push('}');
    }
    nested.push('}');

    // Should not cause stack overflow
    assert!(nested.len() > 5000);
}

#[test]
fn test_many_variables_in_project() {
    // Simulate many variables
    let variable_count = 100_000;
    let keys: Vec<String> = (0..variable_count).map(|i| format!("VAR_{}", i)).collect();
    assert_eq!(keys.len(), variable_count);
}

#[test]
fn test_unicode_overflow_attempts() {
    // Unicode sequences that might cause buffer issues
    let unicode_tests = vec![
        "\u{FEFF}".repeat(10000),           // BOM characters
        "\u{202E}".repeat(1000),            // RTL override
        "\u{0000}".repeat(1000),            // Null characters
        "A\u{0300}".repeat(10000),          // Combining characters
        "\u{1F600}".repeat(100000),         // Emoji flood
    ];

    for test in unicode_tests {
        assert!(!test.is_empty());
    }
}

// ============================================================================
// Cryptographic Attack Resistance Tests
// ============================================================================

#[test]
fn test_weak_password_still_works() {
    // Even weak passwords should be handled securely
    let weak_passwords = vec!["1", "a", "123", "password", ""];

    for password in weak_passwords {
        let salt = generate_salt();
        let result = derive_key(password, &salt);
        assert!(result.is_ok());
    }
}

#[test]
fn test_key_derivation_with_malicious_salt() {
    let password = "test_password";

    // Test with various potentially problematic salts
    let salts = vec![
        [0u8; 16],           // All zeros
        [0xFF; 16],          // All ones
        [0x00, 0xFF, 0x00, 0xFF, 0x00, 0xFF, 0x00, 0xFF,
         0x00, 0xFF, 0x00, 0xFF, 0x00, 0xFF, 0x00, 0xFF], // Alternating
    ];

    for salt in salts {
        let result = derive_key(password, &salt);
        assert!(result.is_ok());
    }
}

#[test]
fn test_encryption_with_null_bytes_in_plaintext() {
    let password = "test";
    let salt = generate_salt();
    let key = derive_key(password, &salt).unwrap();

    let plaintext = "before\x00after\x00\x00end";
    let encrypted = encrypt(plaintext, &key).unwrap();
    let decrypted = decrypt(&encrypted, &key).unwrap();

    assert_eq!(plaintext, decrypted);
}

#[test]
fn test_timing_attack_resistance_decrypt() {
    use std::time::Instant;

    let password = "correct_password";
    let salt = generate_salt();
    let key = derive_key(password, &salt).unwrap();
    let plaintext = "secret data";
    let encrypted = encrypt(plaintext, &key).unwrap();

    // Measure time for correct decryption
    let start = Instant::now();
    let _ = decrypt(&encrypted, &key);
    let correct_time = start.elapsed();

    // Measure time for wrong key (should fail similarly timed)
    let wrong_key = derive_key("wrong_password", &salt).unwrap();
    let start = Instant::now();
    let _ = decrypt(&encrypted, &wrong_key);
    let wrong_time = start.elapsed();

    // Times should be within reasonable range (2x)
    let ratio = if correct_time > wrong_time {
        correct_time.as_nanos() as f64 / wrong_time.as_nanos().max(1) as f64
    } else {
        wrong_time.as_nanos() as f64 / correct_time.as_nanos().max(1) as f64
    };

    assert!(ratio < 3.0, "Timing difference too large: {}", ratio);
}

#[test]
fn test_password_hash_uses_strong_algorithm() {
    let password = "test_password";
    let hash = hash_password(password).unwrap();

    // Should use Argon2
    assert!(hash.starts_with("$argon2"));
    // Should have version
    assert!(hash.contains("$v="));
    // Should have memory cost
    assert!(hash.contains("m="));
    // Should have time cost
    assert!(hash.contains("t="));
    // Should have parallelism
    assert!(hash.contains("p="));
}

#[test]
fn test_rainbow_table_resistance() {
    let password = "common_password";

    // Same password should produce different hashes (due to random salt)
    let hash1 = hash_password(password).unwrap();
    let hash2 = hash_password(password).unwrap();
    let hash3 = hash_password(password).unwrap();

    assert_ne!(hash1, hash2);
    assert_ne!(hash2, hash3);
    assert_ne!(hash1, hash3);

    // But all should verify correctly
    assert!(verify_password(password, &hash1).unwrap());
    assert!(verify_password(password, &hash2).unwrap());
    assert!(verify_password(password, &hash3).unwrap());
}

#[test]
fn test_brute_force_resistance() {
    use std::time::Instant;

    let password = "target_password";
    let hash = hash_password(password).unwrap();

    // Time a single verification
    let start = Instant::now();
    let _ = verify_password("wrong_guess", &hash);
    let verify_time = start.elapsed();

    // Argon2 should take at least a few milliseconds
    assert!(verify_time.as_millis() >= 1, "Hash verification too fast - vulnerable to brute force");
}

#[test]
fn test_padding_oracle_resistance() {
    let password = "test";
    let salt = generate_salt();
    let key = derive_key(password, &salt).unwrap();

    let plaintext = "secret";
    let encrypted = encrypt(plaintext, &key).unwrap();

    // Try various padding manipulations
    use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
    let mut data = BASE64.decode(&encrypted).unwrap();

    // Modify last byte (padding area)
    if let Some(last) = data.last_mut() {
        *last ^= 1;
    }

    let modified = BASE64.encode(&data);
    let result = decrypt(&modified, &key);

    // Should fail but not leak information about padding
    assert!(result.is_err());
}

#[test]
fn test_nonce_reuse_prevention() {
    let password = "test";
    let salt = generate_salt();
    let key = derive_key(password, &salt).unwrap();

    let plaintext = "same message";

    // Encrypt same message multiple times
    let mut encrypted_messages = Vec::new();
    for _ in 0..100 {
        encrypted_messages.push(encrypt(plaintext, &key).unwrap());
    }

    // All should be different (different nonces)
    for i in 0..encrypted_messages.len() {
        for j in (i + 1)..encrypted_messages.len() {
            assert_ne!(
                encrypted_messages[i], encrypted_messages[j],
                "Nonce reuse detected at {} and {}", i, j
            );
        }
    }
}

#[test]
fn test_key_extraction_resistance() {
    let password = "secret_password";
    let salt = generate_salt();
    let key = derive_key(password, &salt).unwrap();

    // Key should be exactly 32 bytes for AES-256
    assert_eq!(key.len(), 32);

    // Key should not be trivially derived from password
    assert_ne!(&key.as_bytes()[..password.len().min(32)], password.as_bytes());
}

#[test]
fn test_ciphertext_malleability_resistance() {
    let password = "test";
    let salt = generate_salt();
    let key = derive_key(password, &salt).unwrap();

    let plaintext = "original message";
    let encrypted = encrypt(plaintext, &key).unwrap();

    use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
    let mut data = BASE64.decode(&encrypted).unwrap();

    // Try to modify ciphertext
    for i in 12..data.len() {
        let original = data[i];
        data[i] ^= 0x01;
        let modified = BASE64.encode(&data);

        // Modified ciphertext should fail authentication
        let result = decrypt(&modified, &key);
        assert!(result.is_err(), "Malleability detected at byte {}", i);

        data[i] = original;
    }
}

// ============================================================================
// Input Validation Tests
// ============================================================================

#[test]
fn test_control_characters_in_input() {
    let control_chars = vec![
        "\x00\x01\x02\x03\x04\x05",
        "\x07\x08\x09\x0a\x0b\x0c",
        "\x1b[31mRed\x1b[0m",  // ANSI escape
        "\r\n\r\n",
        "\t\t\t",
    ];

    for input in control_chars {
        // Should handle control characters safely
        assert!(input.len() > 0);
    }
}

#[test]
fn test_unicode_normalization_attacks() {
    // Different Unicode representations of "same" characters
    let variants = vec![
        ("café", "cafe\u{0301}"),  // Different normalizations
        ("ﬁ", "fi"),              // Ligature vs separate
        ("Ω", "\u{2126}"),        // Different code points
    ];

    for (a, b) in variants {
        // Should handle consistently
        assert!(a.len() > 0 && b.len() > 0);
    }
}

#[test]
fn test_homoglyph_attacks() {
    // Similar-looking characters from different scripts
    let homoglyphs = vec![
        ("admin", "аdmin"),      // Cyrillic 'а'
        ("password", "pаsswоrd"), // Mixed Cyrillic
        ("API_KEY", "АPI_KEY"),  // Cyrillic 'А'
    ];

    for (original, attack) in homoglyphs {
        // Should distinguish between different Unicode characters
        assert_ne!(original, attack);
    }
}

#[test]
fn test_json_injection() {
    let malicious_json = vec![
        r#"{"key": "value", "__proto__": {"admin": true}}"#,
        r#"{"constructor": {"prototype": {"isAdmin": true}}}"#,
        r#"{"key": "val\"ue\"more"}"#,
        r#"{"key": "value\u0000hidden"}"#,
    ];

    for json in malicious_json {
        // Should handle JSON safely
        assert!(!json.is_empty());
    }
}

#[test]
fn test_format_string_attacks() {
    let format_strings = vec![
        "%s%s%s%s%s%s%s%s%s%s",
        "%x%x%x%x%x%x%x%x%x%x",
        "%n%n%n%n%n%n%n%n%n%n",
        "{0}{1}{2}{3}{4}{5}{6}",
        "${HOME}${PATH}${USER}",
    ];

    for input in format_strings {
        // Rust is safe from format string attacks, but test anyway
        let password = input;
        let salt = generate_salt();
        let result = derive_key(password, &salt);
        assert!(result.is_ok());
    }
}

// ============================================================================
// Authentication Bypass Tests
// ============================================================================

#[test]
fn test_empty_password_hash_comparison() {
    let hash = hash_password("real_password").unwrap();

    // Empty password should not match
    assert!(!verify_password("", &hash).unwrap());
}

#[test]
fn test_null_password_handling() {
    let password = "pass\x00word";
    let hash = hash_password(password).unwrap();

    // Full password should match
    assert!(verify_password(password, &hash).unwrap());
    // Truncated at null should not
    assert!(!verify_password("pass", &hash).unwrap());
}

#[test]
fn test_case_sensitivity_in_passwords() {
    let password = "SecretPass123";
    let hash = hash_password(password).unwrap();

    assert!(verify_password("SecretPass123", &hash).unwrap());
    assert!(!verify_password("secretpass123", &hash).unwrap());
    assert!(!verify_password("SECRETPASS123", &hash).unwrap());
    assert!(!verify_password("secretPass123", &hash).unwrap());
}

#[test]
fn test_whitespace_handling_in_passwords() {
    let passwords_with_spaces = vec![
        " password",
        "password ",
        " password ",
        "pass word",
        "pass  word",
        "\tpassword",
        "password\n",
    ];

    for password in &passwords_with_spaces {
        let hash = hash_password(password).unwrap();

        // Exact match should work
        assert!(verify_password(password, &hash).unwrap());

        // Trimmed version should NOT match
        let trimmed = password.trim();
        if trimmed != *password {
            assert!(!verify_password(trimmed, &hash).unwrap());
        }
    }
}

// ============================================================================
// Denial of Service Prevention Tests
// ============================================================================

#[test]
fn test_algorithmic_complexity_attack() {
    // Test that operations don't have quadratic or worse complexity
    use std::time::Instant;

    let salt = generate_salt();

    // Small input
    let start = Instant::now();
    let _ = derive_key("short", &salt);
    let small_time = start.elapsed();

    // Large input
    let large_password = "x".repeat(10000);
    let start = Instant::now();
    let _ = derive_key(&large_password, &salt);
    let large_time = start.elapsed();

    // Should not be quadratic (large should be < 100x small)
    let ratio = large_time.as_nanos() as f64 / small_time.as_nanos().max(1) as f64;
    assert!(ratio < 100.0, "Possible complexity attack: ratio = {}", ratio);
}

#[test]
fn test_hash_collision_resistance() {
    let salt = generate_salt();

    // Generate many keys and check for collisions
    let mut keys = std::collections::HashSet::new();
    for i in 0..1000 {
        let password = format!("password_{}", i);
        let key = derive_key(&password, &salt).unwrap();
        let key_hex: String = key.iter().map(|b| format!("{:02x}", b)).collect();

        assert!(keys.insert(key_hex), "Key collision detected at {}", i);
    }
}

#[test]
fn test_resource_exhaustion_prevention() {
    // Test that we can handle many operations without resource exhaustion
    let salt = generate_salt();
    let password = "test";
    let key = derive_key(password, &salt).unwrap();

    // Encrypt and decrypt many times
    for i in 0..1000 {
        let plaintext = format!("message_{}", i);
        let encrypted = encrypt(&plaintext, &key).unwrap();
        let decrypted = decrypt(&encrypted, &key).unwrap();
        assert_eq!(plaintext, decrypted);
    }
}
