// Comprehensive unit tests for the crypto module
// Tests cover encryption, decryption, key derivation, password hashing,
// edge cases, error handling, and security considerations

use app_lib::crypto::{
    decrypt, decrypt_bytes, derive_key, encrypt, encrypt_bytes, generate_salt, hash_password,
    verify_password,
};
use app_lib::error::EnvSyncError;

// ============================================================================
// Basic Encrypt/Decrypt Roundtrip Tests
// ============================================================================

#[test]
fn test_encrypt_decrypt_roundtrip_simple() {
    let password = "test_password";
    let salt = generate_salt();
    let key = derive_key(password, &salt).unwrap();

    let plaintext = "Hello, World!";
    let encrypted = encrypt(plaintext, &key).unwrap();
    let decrypted = decrypt(&encrypted, &key).unwrap();

    assert_eq!(plaintext, decrypted);
}

#[test]
fn test_encrypt_decrypt_roundtrip_long_text() {
    let password = "secure_password_123";
    let salt = generate_salt();
    let key = derive_key(password, &salt).unwrap();

    let plaintext = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(100);
    let encrypted = encrypt(&plaintext, &key).unwrap();
    let decrypted = decrypt(&encrypted, &key).unwrap();

    assert_eq!(plaintext, decrypted);
}

#[test]
fn test_encrypt_decrypt_multiple_times() {
    let password = "multi_encrypt_test";
    let salt = generate_salt();
    let key = derive_key(password, &salt).unwrap();

    let plaintext = "Test message";

    // Encrypt and decrypt multiple times
    for _ in 0..10 {
        let encrypted = encrypt(plaintext, &key).unwrap();
        let decrypted = decrypt(&encrypted, &key).unwrap();
        assert_eq!(plaintext, decrypted);
    }
}

#[test]
fn test_different_encryptions_produce_different_ciphertexts() {
    let password = "nonce_test";
    let salt = generate_salt();
    let key = derive_key(password, &salt).unwrap();

    let plaintext = "Same message";
    let encrypted1 = encrypt(plaintext, &key).unwrap();
    let encrypted2 = encrypt(plaintext, &key).unwrap();

    // Different nonces should produce different ciphertexts
    assert_ne!(encrypted1, encrypted2);

    // But both should decrypt to the same plaintext
    assert_eq!(decrypt(&encrypted1, &key).unwrap(), plaintext);
    assert_eq!(decrypt(&encrypted2, &key).unwrap(), plaintext);
}

#[test]
fn test_encrypt_bytes_roundtrip() {
    let key = [42u8; 32]; // Simple key for testing
    let plaintext = b"Raw bytes data";

    let (ciphertext, nonce) = encrypt_bytes(plaintext, &key).unwrap();
    let decrypted = decrypt_bytes(&ciphertext, &nonce, &key).unwrap();

    assert_eq!(plaintext.to_vec(), decrypted);
}

#[test]
fn test_encrypt_bytes_binary_data() {
    let key = [0u8; 32];
    let plaintext: Vec<u8> = (0..=255).collect();

    let (ciphertext, nonce) = encrypt_bytes(&plaintext, &key).unwrap();
    let decrypted = decrypt_bytes(&ciphertext, &nonce, &key).unwrap();

    assert_eq!(plaintext, decrypted);
}

// ============================================================================
// Key Derivation Tests
// ============================================================================

#[test]
fn test_derive_key_deterministic() {
    let password = "consistent_password";
    let salt = [1u8; 16];

    let key1 = derive_key(password, &salt).unwrap();
    let key2 = derive_key(password, &salt).unwrap();

    assert_eq!(key1, key2);
}

#[test]
fn test_derive_key_different_passwords() {
    let salt = generate_salt();

    let key1 = derive_key("password1", &salt).unwrap();
    let key2 = derive_key("password2", &salt).unwrap();

    assert_ne!(key1, key2);
}

#[test]
fn test_derive_key_different_salts() {
    let password = "same_password";

    let salt1 = generate_salt();
    let salt2 = generate_salt();

    let key1 = derive_key(password, &salt1).unwrap();
    let key2 = derive_key(password, &salt2).unwrap();

    assert_ne!(key1, key2);
}

#[test]
fn test_derive_key_empty_password() {
    let salt = generate_salt();
    let result = derive_key("", &salt);

    // Empty password should still work (not recommended but technically valid)
    assert!(result.is_ok());
}

#[test]
fn test_derive_key_long_password() {
    let salt = generate_salt();
    let long_password = "a".repeat(1000);

    let result = derive_key(&long_password, &salt);
    assert!(result.is_ok());
}

#[test]
fn test_derive_key_special_characters() {
    let salt = generate_salt();
    let passwords = vec![
        "p@ssw0rd!",
        "パスワード",
        "🔐🔑🗝️",
        "pass\nword",
        "pass\tword",
        "pass word",
    ];

    for password in passwords {
        let result = derive_key(password, &salt);
        assert!(result.is_ok(), "Failed for password: {}", password);
    }
}

// ============================================================================
// Salt Generation Tests
// ============================================================================

#[test]
fn test_generate_salt_size() {
    let salt = generate_salt();
    assert_eq!(salt.len(), 16);
}

#[test]
fn test_generate_salt_uniqueness() {
    let mut salts = Vec::new();

    for _ in 0..100 {
        salts.push(generate_salt());
    }

    // Check all salts are unique
    for i in 0..salts.len() {
        for j in (i + 1)..salts.len() {
            assert_ne!(salts[i], salts[j], "Salts {} and {} are identical", i, j);
        }
    }
}

#[test]
fn test_generate_salt_not_all_zeros() {
    let salt = generate_salt();
    let all_zeros = [0u8; 16];

    assert_ne!(salt, all_zeros);
}

// ============================================================================
// Empty String Handling Tests
// ============================================================================

#[test]
fn test_encrypt_decrypt_empty_string() {
    let password = "test_password";
    let salt = generate_salt();
    let key = derive_key(password, &salt).unwrap();

    let plaintext = "";
    let encrypted = encrypt(plaintext, &key).unwrap();
    let decrypted = decrypt(&encrypted, &key).unwrap();

    assert_eq!(plaintext, decrypted);
}

#[test]
fn test_encrypt_bytes_empty() {
    let key = [1u8; 32];
    let plaintext = b"";

    let (ciphertext, nonce) = encrypt_bytes(plaintext, &key).unwrap();
    let decrypted = decrypt_bytes(&ciphertext, &nonce, &key).unwrap();

    assert_eq!(plaintext.to_vec(), decrypted);
}

// ============================================================================
// Unicode and Special Character Handling Tests
// ============================================================================

#[test]
fn test_encrypt_decrypt_unicode() {
    let password = "unicode_test";
    let salt = generate_salt();
    let key = derive_key(password, &salt).unwrap();

    let plaintexts = vec![
        "Hello, 世界!",
        "Привет, мир!",
        "مرحبا بالعالم",
        "🚀🌟💻",
        "Ñoño",
        "café",
    ];

    for plaintext in plaintexts {
        let encrypted = encrypt(plaintext, &key).unwrap();
        let decrypted = decrypt(&encrypted, &key).unwrap();
        assert_eq!(plaintext, decrypted);
    }
}

#[test]
fn test_encrypt_decrypt_special_characters() {
    let password = "special_chars";
    let salt = generate_salt();
    let key = derive_key(password, &salt).unwrap();

    let plaintexts = vec![
        "Line1\nLine2\nLine3",
        "Tab\tSeparated\tValues",
        "Quote: \"Hello\"",
        "Backslash: \\test\\path",
        "Null char: \0 included",
        "Mix: \r\n\t\"'\\",
    ];

    for plaintext in plaintexts {
        let encrypted = encrypt(plaintext, &key).unwrap();
        let decrypted = decrypt(&encrypted, &key).unwrap();
        assert_eq!(plaintext, decrypted);
    }
}

#[test]
fn test_encrypt_decrypt_json_data() {
    let password = "json_test";
    let salt = generate_salt();
    let key = derive_key(password, &salt).unwrap();

    let json_data = r#"{"name":"John","age":30,"city":"New York","nested":{"key":"value"}}"#;
    let encrypted = encrypt(json_data, &key).unwrap();
    let decrypted = decrypt(&encrypted, &key).unwrap();

    assert_eq!(json_data, decrypted);
}

// ============================================================================
// Large Data Encryption Tests
// ============================================================================

#[test]
fn test_encrypt_decrypt_1kb_data() {
    let password = "large_data_test";
    let salt = generate_salt();
    let key = derive_key(password, &salt).unwrap();

    let plaintext = "A".repeat(1024);
    let encrypted = encrypt(&plaintext, &key).unwrap();
    let decrypted = decrypt(&encrypted, &key).unwrap();

    assert_eq!(plaintext, decrypted);
}

#[test]
fn test_encrypt_decrypt_100kb_data() {
    let password = "very_large_data";
    let salt = generate_salt();
    let key = derive_key(password, &salt).unwrap();

    let plaintext = "B".repeat(100 * 1024);
    let encrypted = encrypt(&plaintext, &key).unwrap();
    let decrypted = decrypt(&encrypted, &key).unwrap();

    assert_eq!(plaintext, decrypted);
}

#[test]
fn test_encrypt_decrypt_1mb_data() {
    let password = "huge_data";
    let salt = generate_salt();
    let key = derive_key(password, &salt).unwrap();

    let plaintext = "C".repeat(1024 * 1024);
    let encrypted = encrypt(&plaintext, &key).unwrap();
    let decrypted = decrypt(&encrypted, &key).unwrap();

    assert_eq!(plaintext, decrypted);
}

// ============================================================================
// Invalid Key Size Tests
// ============================================================================

#[test]
fn test_encrypt_bytes_invalid_key_too_short() {
    let key = [1u8; 16]; // Only 16 bytes instead of 32
    let plaintext = b"test data";

    let result = encrypt_bytes(plaintext, &key);
    assert!(result.is_err());

    if let Err(EnvSyncError::Encryption(msg)) = result {
        assert!(msg.contains("Invalid key size"));
    } else {
        panic!("Expected Encryption error");
    }
}

#[test]
fn test_encrypt_bytes_invalid_key_too_long() {
    let key = [1u8; 64]; // 64 bytes instead of 32
    let plaintext = b"test data";

    let result = encrypt_bytes(plaintext, &key);
    assert!(result.is_err());
}

#[test]
fn test_decrypt_bytes_invalid_key_size() {
    let key = [1u8; 32];
    let plaintext = b"test";
    let (ciphertext, nonce) = encrypt_bytes(plaintext, &key).unwrap();

    let wrong_key = [2u8; 16]; // Wrong size
    let result = decrypt_bytes(&ciphertext, &nonce, &wrong_key);

    assert!(result.is_err());
    if let Err(EnvSyncError::Decryption(msg)) = result {
        assert!(msg.contains("Invalid key size"));
    } else {
        panic!("Expected Decryption error");
    }
}

// ============================================================================
// Corrupted Ciphertext Handling Tests
// ============================================================================

#[test]
fn test_decrypt_with_wrong_key() {
    let salt = generate_salt();
    let key1 = derive_key("password1", &salt).unwrap();
    let key2 = derive_key("password2", &salt).unwrap();

    let plaintext = "secret message";
    let encrypted = encrypt(plaintext, &key1).unwrap();

    let result = decrypt(&encrypted, &key2);
    assert!(result.is_err());
    assert!(matches!(result, Err(EnvSyncError::InvalidPassword)));
}

#[test]
fn test_decrypt_invalid_base64() {
    let key = derive_key("password", &generate_salt()).unwrap();
    let invalid_base64 = "This is not valid base64!!!";

    let result = decrypt(invalid_base64, &key);
    assert!(result.is_err());

    if let Err(EnvSyncError::Decryption(msg)) = result {
        assert!(msg.contains("Invalid base64"));
    } else {
        panic!("Expected Decryption error with base64 message");
    }
}

#[test]
fn test_decrypt_data_too_short() {
    let key = derive_key("password", &generate_salt()).unwrap();

    // Create base64 of data shorter than nonce size
    use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
    let short_data = BASE64.encode(&[1u8; 5]); // Only 5 bytes, need at least 12

    let result = decrypt(&short_data, &key);
    assert!(result.is_err());

    if let Err(EnvSyncError::Decryption(msg)) = result {
        assert!(msg.contains("Data too short"));
    } else {
        panic!("Expected Decryption error");
    }
}

#[test]
fn test_decrypt_corrupted_ciphertext() {
    let password = "test";
    let salt = generate_salt();
    let key = derive_key(password, &salt).unwrap();

    let plaintext = "original message";
    let mut encrypted = encrypt(plaintext, &key).unwrap();

    // Corrupt the ciphertext by modifying a character
    encrypted.push_str("corrupted");

    let result = decrypt(&encrypted, &key);
    assert!(result.is_err());
}

#[test]
fn test_decrypt_bytes_invalid_nonce_size() {
    let key = [1u8; 32];
    let ciphertext = b"fake ciphertext";
    let invalid_nonce = [0u8; 8]; // Wrong size, should be 12

    let result = decrypt_bytes(ciphertext, &invalid_nonce, &key);
    assert!(result.is_err());

    if let Err(EnvSyncError::Decryption(msg)) = result {
        assert!(msg.contains("Invalid nonce size"));
    } else {
        panic!("Expected Decryption error");
    }
}

#[test]
fn test_decrypt_bytes_tampered_ciphertext() {
    let key = [1u8; 32];
    let plaintext = b"sensitive data";
    let (mut ciphertext, nonce) = encrypt_bytes(plaintext, &key).unwrap();

    // Tamper with the ciphertext
    if !ciphertext.is_empty() {
        ciphertext[0] ^= 1;
    }

    let result = decrypt_bytes(&ciphertext, &nonce, &key);
    assert!(result.is_err());
    assert!(matches!(result, Err(EnvSyncError::InvalidPassword)));
}

#[test]
fn test_decrypt_bytes_tampered_nonce() {
    let key = [1u8; 32];
    let plaintext = b"sensitive data";
    let (ciphertext, mut nonce) = encrypt_bytes(plaintext, &key).unwrap();

    // Tamper with the nonce
    nonce[0] ^= 1;

    let result = decrypt_bytes(&ciphertext, &nonce, &key);
    assert!(result.is_err());
    assert!(matches!(result, Err(EnvSyncError::InvalidPassword)));
}

// ============================================================================
// Nonce Reuse Prevention Tests
// ============================================================================

#[test]
fn test_nonce_uniqueness_single_key() {
    let key = [1u8; 32];
    let plaintext = b"message";

    let mut nonces = Vec::new();
    for _ in 0..100 {
        let (_, nonce) = encrypt_bytes(plaintext, &key).unwrap();
        nonces.push(nonce);
    }

    // Verify all nonces are unique
    for i in 0..nonces.len() {
        for j in (i + 1)..nonces.len() {
            assert_ne!(nonces[i], nonces[j], "Nonces {} and {} are identical", i, j);
        }
    }
}

#[test]
fn test_encrypt_produces_different_nonces() {
    let password = "test_password";
    let salt = generate_salt();
    let key = derive_key(password, &salt).unwrap();

    use base64::{engine::general_purpose::STANDARD as BASE64, Engine};

    let plaintext = "same message";
    let encrypted1 = encrypt(plaintext, &key).unwrap();
    let encrypted2 = encrypt(plaintext, &key).unwrap();

    // Decode and extract nonces (first 12 bytes)
    let data1 = BASE64.decode(&encrypted1).unwrap();
    let data2 = BASE64.decode(&encrypted2).unwrap();

    let nonce1 = &data1[0..12];
    let nonce2 = &data2[0..12];

    assert_ne!(nonce1, nonce2);
}

// ============================================================================
// Password Hashing Tests
// ============================================================================

#[test]
fn test_hash_password_produces_hash() {
    let password = "secure_password";
    let hash = hash_password(password).unwrap();

    assert!(!hash.is_empty());
    assert!(hash.starts_with("$argon2"));
}

#[test]
fn test_hash_password_different_hashes() {
    let password = "same_password";

    let hash1 = hash_password(password).unwrap();
    let hash2 = hash_password(password).unwrap();

    // Different salts should produce different hashes
    assert_ne!(hash1, hash2);
}

#[test]
fn test_verify_password_correct() {
    let password = "correct_password";
    let hash = hash_password(password).unwrap();

    let result = verify_password(password, &hash).unwrap();
    assert!(result);
}

#[test]
fn test_verify_password_incorrect() {
    let password = "correct_password";
    let hash = hash_password(password).unwrap();

    let result = verify_password("wrong_password", &hash).unwrap();
    assert!(!result);
}

#[test]
fn test_verify_password_empty_password() {
    let hash = hash_password("").unwrap();

    assert!(verify_password("", &hash).unwrap());
    assert!(!verify_password("not_empty", &hash).unwrap());
}

#[test]
fn test_verify_password_long_password() {
    let long_password = "a".repeat(1000);
    let hash = hash_password(&long_password).unwrap();

    assert!(verify_password(&long_password, &hash).unwrap());
    assert!(!verify_password("short", &hash).unwrap());
}

#[test]
fn test_verify_password_unicode() {
    let password = "パスワード🔐";
    let hash = hash_password(password).unwrap();

    assert!(verify_password(password, &hash).unwrap());
    assert!(!verify_password("different", &hash).unwrap());
}

#[test]
fn test_verify_password_invalid_hash_format() {
    let result = verify_password("password", "invalid_hash_format");

    assert!(result.is_err());
    if let Err(EnvSyncError::Decryption(msg)) = result {
        assert!(msg.contains("Invalid hash format"));
    } else {
        panic!("Expected Decryption error");
    }
}

#[test]
fn test_verify_password_case_sensitive() {
    let password = "Password123";
    let hash = hash_password(password).unwrap();

    assert!(verify_password("Password123", &hash).unwrap());
    assert!(!verify_password("password123", &hash).unwrap());
    assert!(!verify_password("PASSWORD123", &hash).unwrap());
}

#[test]
fn test_hash_password_special_characters() {
    let passwords = vec![
        "p@ssw0rd!",
        "pass\nword",
        "pass\tword",
        "pass word",
        "🔐🔑",
    ];

    for password in passwords {
        let hash = hash_password(password).unwrap();
        assert!(verify_password(password, &hash).unwrap());
    }
}

// ============================================================================
// Timing Attack Resistance Tests
// ============================================================================

#[test]
fn test_verify_password_timing_consistency() {
    use std::time::Instant;

    let password = "timing_test_password";
    let hash = hash_password(password).unwrap();

    // Test with correct password
    let start = Instant::now();
    let _ = verify_password(password, &hash);
    let correct_duration = start.elapsed();

    // Test with wrong password (same length)
    let start = Instant::now();
    let _ = verify_password("wrong_test_password", &hash);
    let wrong_duration = start.elapsed();

    // Argon2 should have constant-time verification
    // Allow some variance but they should be similar
    let ratio = if correct_duration > wrong_duration {
        correct_duration.as_nanos() as f64 / wrong_duration.as_nanos() as f64
    } else {
        wrong_duration.as_nanos() as f64 / correct_duration.as_nanos() as f64
    };

    // Ratio should be close to 1.0 (within 2x for timing variations)
    assert!(ratio < 2.0, "Timing ratio too large: {}", ratio);
}

#[test]
fn test_verify_password_constant_time_different_lengths() {
    use std::time::Instant;

    let password = "test_password_for_timing";
    let hash = hash_password(password).unwrap();

    // Test with short wrong password
    let start = Instant::now();
    let _ = verify_password("x", &hash);
    let short_duration = start.elapsed();

    // Test with long wrong password
    let start = Instant::now();
    let _ = verify_password(&"x".repeat(100), &hash);
    let long_duration = start.elapsed();

    // Even with different lengths, timing should be similar
    let ratio = if short_duration > long_duration {
        short_duration.as_nanos() as f64 / long_duration.as_nanos() as f64
    } else {
        long_duration.as_nanos() as f64 / short_duration.as_nanos() as f64
    };

    assert!(ratio < 2.0, "Timing ratio too large: {}", ratio);
}

// ============================================================================
// Additional Error Handling Tests
// ============================================================================

#[test]
fn test_decrypt_non_utf8_result() {
    let key = [1u8; 32];

    // Create invalid UTF-8 bytes
    let invalid_utf8 = vec![0xFF, 0xFE, 0xFD];
    let (ciphertext, nonce) = encrypt_bytes(&invalid_utf8, &key).unwrap();

    use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
    let mut combined = nonce.to_vec();
    combined.extend(&ciphertext);
    let encoded = BASE64.encode(&combined);

    // decrypt() expects UTF-8, so this should fail
    let result = decrypt(&encoded, &key);
    assert!(result.is_err());

    if let Err(EnvSyncError::Decryption(msg)) = result {
        assert!(msg.contains("Invalid UTF-8"));
    } else {
        panic!("Expected Decryption error with UTF-8 message");
    }
}

#[test]
fn test_encrypt_decrypt_consistency_across_operations() {
    let password = "consistency_test";
    let salt = generate_salt();
    let key = derive_key(password, &salt).unwrap();

    let original = "Test message for consistency";

    // Perform multiple encrypt/decrypt cycles
    let mut current = original.to_string();
    for _ in 0..5 {
        let encrypted = encrypt(&current, &key).unwrap();
        current = decrypt(&encrypted, &key).unwrap();
    }

    assert_eq!(original, current);
}

#[test]
fn test_key_derivation_with_various_salt_sizes() {
    let password = "test_password";

    // Test with different salt sizes
    let salt_8 = [1u8; 8];
    let salt_16 = [1u8; 16];
    let salt_32 = [1u8; 32];

    let key1 = derive_key(password, &salt_8).unwrap();
    let key2 = derive_key(password, &salt_16).unwrap();
    let key3 = derive_key(password, &salt_32).unwrap();

    // All should succeed and produce different keys
    assert_ne!(key1, key2);
    assert_ne!(key2, key3);
    assert_ne!(key1, key3);
}

#[test]
fn test_encrypt_decrypt_preserves_exact_bytes() {
    let key = [42u8; 32];

    // Create test data with all possible byte values
    let plaintext: Vec<u8> = (0..=255).cycle().take(1000).collect();

    let (ciphertext, nonce) = encrypt_bytes(&plaintext, &key).unwrap();
    let decrypted = decrypt_bytes(&ciphertext, &nonce, &key).unwrap();

    assert_eq!(plaintext, decrypted);
    assert_eq!(plaintext.len(), decrypted.len());
}

#[test]
fn test_concurrent_encryption_safety() {
    use std::sync::Arc;
    use std::thread;

    let password = "concurrent_test";
    let salt = generate_salt();
    let key = Arc::new(derive_key(password, &salt).unwrap());

    let mut handles = vec![];

    for i in 0..10 {
        let key_clone = Arc::clone(&key);
        let handle = thread::spawn(move || {
            let plaintext = format!("Message {}", i);
            let encrypted = encrypt(&plaintext, &key_clone).unwrap();
            let decrypted = decrypt(&encrypted, &key_clone).unwrap();
            assert_eq!(plaintext, decrypted);
        });
        handles.push(handle);
    }

    for handle in handles {
        handle.join().unwrap();
    }
}

#[test]
fn test_base64_encoding_correctness() {
    use base64::{engine::general_purpose::STANDARD as BASE64, Engine};

    let password = "base64_test";
    let salt = generate_salt();
    let key = derive_key(password, &salt).unwrap();

    let plaintext = "Test message";
    let encrypted = encrypt(plaintext, &key).unwrap();

    // Verify it's valid base64
    let decoded = BASE64.decode(&encrypted);
    assert!(decoded.is_ok(), "Encrypted output should be valid base64");

    let decoded_data = decoded.unwrap();
    assert!(decoded_data.len() >= 12, "Decoded data should include nonce");
}

#[test]
fn test_password_hash_contains_metadata() {
    let password = "metadata_test";
    let hash = hash_password(password).unwrap();

    // Argon2 hash should contain algorithm identifier and parameters
    assert!(hash.starts_with("$argon2"));
    assert!(hash.contains("$v="));
    assert!(hash.contains("$m="));
    assert!(hash.contains("$t="));
    assert!(hash.contains("$p="));
}
