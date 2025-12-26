use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use rand::RngCore;

use crate::error::{EnvSyncError, Result};

const NONCE_SIZE: usize = 12;
const KEY_SIZE: usize = 32;

/// Derives a 256-bit encryption key from a password using Argon2id
pub fn derive_key(password: &str, salt: &[u8]) -> Result<[u8; KEY_SIZE]> {
    use argon2::Argon2;

    // Use Argon2id with recommended parameters
    let argon2 = Argon2::default();

    // Create a hash of the password with salt
    let mut output = [0u8; KEY_SIZE];

    argon2
        .hash_password_into(password.as_bytes(), salt, &mut output)
        .map_err(|e| EnvSyncError::Encryption(format!("Key derivation failed: {}", e)))?;

    Ok(output)
}

/// Generates a random salt for key derivation
pub fn generate_salt() -> [u8; 16] {
    let mut salt = [0u8; 16];
    OsRng.fill_bytes(&mut salt);
    salt
}

/// Generates a random nonce for AES-GCM
fn generate_nonce() -> [u8; NONCE_SIZE] {
    let mut nonce = [0u8; NONCE_SIZE];
    OsRng.fill_bytes(&mut nonce);
    nonce
}

/// Encrypts plaintext using AES-256-GCM
/// Returns base64-encoded ciphertext with nonce prepended
pub fn encrypt(plaintext: &str, key: &[u8; KEY_SIZE]) -> Result<String> {
    let (ciphertext, nonce) = encrypt_bytes(plaintext.as_bytes(), key)?;

    // Prepend nonce to ciphertext
    let mut result = nonce.to_vec();
    result.extend(ciphertext);

    Ok(BASE64.encode(&result))
}

/// Encrypts raw bytes using AES-256-GCM
/// Returns (ciphertext, nonce) tuple for separate storage
pub fn encrypt_bytes(plaintext: &[u8], key: &[u8]) -> Result<(Vec<u8>, [u8; NONCE_SIZE])> {
    if key.len() != KEY_SIZE {
        return Err(EnvSyncError::Encryption("Invalid key size".to_string()));
    }

    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|e| EnvSyncError::Encryption(format!("Failed to create cipher: {}", e)))?;

    let nonce_bytes = generate_nonce();
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plaintext)
        .map_err(|e| EnvSyncError::Encryption(format!("Encryption failed: {}", e)))?;

    Ok((ciphertext, nonce_bytes))
}

/// Decrypts base64-encoded ciphertext using AES-256-GCM
pub fn decrypt(encrypted: &str, key: &[u8; KEY_SIZE]) -> Result<String> {
    let data = BASE64
        .decode(encrypted)
        .map_err(|e| EnvSyncError::Decryption(format!("Invalid base64: {}", e)))?;

    if data.len() < NONCE_SIZE {
        return Err(EnvSyncError::Decryption("Data too short".to_string()));
    }

    let (nonce_bytes, ciphertext) = data.split_at(NONCE_SIZE);

    let plaintext = decrypt_bytes(ciphertext, nonce_bytes, key)?;

    String::from_utf8(plaintext)
        .map_err(|e| EnvSyncError::Decryption(format!("Invalid UTF-8: {}", e)))
}

/// Decrypts raw bytes using AES-256-GCM
pub fn decrypt_bytes(ciphertext: &[u8], nonce: &[u8], key: &[u8]) -> Result<Vec<u8>> {
    if key.len() != KEY_SIZE {
        return Err(EnvSyncError::Decryption("Invalid key size".to_string()));
    }
    if nonce.len() != NONCE_SIZE {
        return Err(EnvSyncError::Decryption("Invalid nonce size".to_string()));
    }

    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|e| EnvSyncError::Decryption(format!("Failed to create cipher: {}", e)))?;

    let nonce = Nonce::from_slice(nonce);

    cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| EnvSyncError::InvalidPassword)
}

/// Hashes a password for storage (used for password verification)
pub fn hash_password(password: &str) -> Result<String> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();

    let hash = argon2
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| EnvSyncError::Encryption(format!("Password hashing failed: {}", e)))?;

    Ok(hash.to_string())
}

/// Verifies a password against a stored hash
pub fn verify_password(password: &str, hash: &str) -> Result<bool> {
    let parsed_hash = PasswordHash::new(hash)
        .map_err(|e| EnvSyncError::Decryption(format!("Invalid hash format: {}", e)))?;

    Ok(Argon2::default()
        .verify_password(password.as_bytes(), &parsed_hash)
        .is_ok())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt() {
        let password = "test_password_123";
        let salt = generate_salt();
        let key = derive_key(password, &salt).unwrap();

        let plaintext = "Hello, World! This is a secret.";
        let encrypted = encrypt(plaintext, &key).unwrap();
        let decrypted = decrypt(&encrypted, &key).unwrap();

        assert_eq!(plaintext, decrypted);
    }

    #[test]
    fn test_password_hash_verify() {
        let password = "secure_password_456";
        let hash = hash_password(password).unwrap();

        assert!(verify_password(password, &hash).unwrap());
        assert!(!verify_password("wrong_password", &hash).unwrap());
    }

    #[test]
    fn test_wrong_key_fails() {
        let salt = generate_salt();
        let key1 = derive_key("password1", &salt).unwrap();
        let key2 = derive_key("password2", &salt).unwrap();

        let encrypted = encrypt("secret", &key1).unwrap();
        let result = decrypt(&encrypted, &key2);

        assert!(result.is_err());
    }
}
