//! VeilKey - Threshold Cryptography Module
//!
//! Implements t-of-n Shamir's Secret Sharing for team key management.
//! This allows distributing a master key across team members such that
//! a threshold number of members must collaborate to reconstruct it.

use base64::Engine;
use sharks::{Share, Sharks};

use crate::crypto::encrypt;
use crate::error::{EnvSyncError, Result};
use crate::models::KeyShare;

/// VeilKey threshold cryptography manager
pub struct VeilKey {
    threshold: u8,
    total_shares: u8,
}

impl VeilKey {
    /// Create a new VeilKey instance with threshold parameters
    ///
    /// # Arguments
    /// * `threshold` - Minimum shares needed to reconstruct (t)
    /// * `total_shares` - Total shares to generate (n)
    ///
    /// # Errors
    /// Returns error if threshold > total_shares or threshold < 2
    pub fn new(threshold: u8, total_shares: u8) -> Result<Self> {
        if threshold < 2 {
            return Err(EnvSyncError::InvalidThreshold(
                "Threshold must be at least 2".to_string(),
            ));
        }
        if threshold > total_shares {
            return Err(EnvSyncError::InvalidThreshold(
                format!(
                    "Threshold ({}) cannot exceed total shares ({})",
                    threshold, total_shares
                ),
            ));
        }
        if total_shares > 255 {
            return Err(EnvSyncError::InvalidThreshold(
                "Total shares cannot exceed 255".to_string(),
            ));
        }

        Ok(Self {
            threshold,
            total_shares,
        })
    }

    /// Generate a new team master key and split it into shares
    ///
    /// Returns (master_key, shares) where shares are base64-encoded
    pub fn generate_team_key(&self) -> Result<([u8; 32], Vec<(u8, String)>)> {
        // Generate a random 256-bit master key
        let master_key: [u8; 32] = rand::random();

        // Split the key using Shamir's Secret Sharing
        let shares = self.split_secret(&master_key)?;

        Ok((master_key, shares))
    }

    /// Split a secret into threshold shares
    ///
    /// Returns a vector of (share_index, base64_encoded_share) tuples
    pub fn split_secret(&self, secret: &[u8; 32]) -> Result<Vec<(u8, String)>> {
        let sharks = Sharks(self.threshold);

        // Generate shares for the secret
        let dealer = sharks.dealer(secret);
        let shares: Vec<Share> = dealer.take(self.total_shares as usize).collect();

        // Convert shares to base64-encoded strings with their indices
        let encoded_shares: Vec<(u8, String)> = shares
            .into_iter()
            .enumerate()
            .map(|(idx, share)| {
                let share_bytes: Vec<u8> = (&share).into();
                let encoded = base64::engine::general_purpose::STANDARD.encode(&share_bytes);
                ((idx + 1) as u8, encoded) // 1-indexed share indices
            })
            .collect();

        Ok(encoded_shares)
    }

    /// Reconstruct the secret from a collection of shares
    ///
    /// # Arguments
    /// * `shares` - Vector of base64-encoded share strings
    ///
    /// # Returns
    /// The reconstructed 32-byte secret
    pub fn reconstruct_secret(&self, shares: &[(u8, String)]) -> Result<[u8; 32]> {
        if shares.len() < self.threshold as usize {
            return Err(EnvSyncError::InsufficientShares(
                self.threshold,
                shares.len() as u8,
            ));
        }

        let sharks = Sharks(self.threshold);

        // Decode shares from base64
        let decoded_shares: Vec<Share> = shares
            .iter()
            .map(|(_, encoded)| {
                let bytes = base64::engine::general_purpose::STANDARD
                    .decode(encoded)
                    .map_err(|e| {
                        EnvSyncError::KeyReconstructionFailed(format!("Invalid share encoding: {}", e))
                    })?;
                Share::try_from(bytes.as_slice()).map_err(|e| {
                    EnvSyncError::KeyReconstructionFailed(format!("Invalid share format: {}", e))
                })
            })
            .collect::<Result<Vec<_>>>()?;

        // Reconstruct the secret
        let secret_vec = sharks.recover(&decoded_shares).map_err(|e| {
            EnvSyncError::KeyReconstructionFailed(format!("Failed to reconstruct key: {}", e))
        })?;

        // Convert to fixed-size array
        if secret_vec.len() != 32 {
            return Err(EnvSyncError::KeyReconstructionFailed(
                "Reconstructed key has invalid length".to_string(),
            ));
        }

        let mut secret = [0u8; 32];
        secret.copy_from_slice(&secret_vec);

        Ok(secret)
    }

    /// Encrypt a share for a specific user using their encryption key
    pub fn encrypt_share_for_user(
        share: &str,
        user_encryption_key: &[u8; 32],
    ) -> Result<String> {
        encrypt(share, user_encryption_key)
    }

    /// Create KeyShare models for database storage
    pub fn create_key_shares(
        team_id: &str,
        shares: &[(u8, String)],
        user_ids: &[String],
        user_keys: &[[u8; 32]],
    ) -> Result<Vec<KeyShare>> {
        if shares.len() != user_ids.len() || shares.len() != user_keys.len() {
            return Err(EnvSyncError::InvalidThreshold(
                "Shares, user IDs, and user keys must have the same length".to_string(),
            ));
        }

        let mut key_shares = Vec::new();

        for i in 0..shares.len() {
            let (share_index, share_data) = &shares[i];
            let encrypted_share = Self::encrypt_share_for_user(share_data, &user_keys[i])?;

            key_shares.push(KeyShare::new(
                team_id.to_string(),
                *share_index,
                encrypted_share,
                user_ids[i].clone(),
            ));
        }

        Ok(key_shares)
    }

    /// Verify that a set of shares can reconstruct the original secret
    pub fn verify_shares(&self, shares: &[(u8, String)], expected_secret: &[u8; 32]) -> Result<bool> {
        // Need at least threshold shares to verify
        if shares.len() < self.threshold as usize {
            return Ok(false);
        }

        let reconstructed = self.reconstruct_secret(shares)?;
        Ok(&reconstructed == expected_secret)
    }

    /// Get threshold value
    pub fn threshold(&self) -> u8 {
        self.threshold
    }

    /// Get total shares value
    pub fn total_shares(&self) -> u8 {
        self.total_shares
    }
}

/// Common threshold configurations
pub mod presets {
    use super::VeilKey;
    use crate::error::Result;

    /// 2-of-3 threshold (small teams)
    pub fn small_team() -> Result<VeilKey> {
        VeilKey::new(2, 3)
    }

    /// 3-of-5 threshold (medium teams)
    pub fn medium_team() -> Result<VeilKey> {
        VeilKey::new(3, 5)
    }

    /// 4-of-7 threshold (large teams)
    pub fn large_team() -> Result<VeilKey> {
        VeilKey::new(4, 7)
    }

    /// 5-of-9 threshold (enterprise)
    pub fn enterprise() -> Result<VeilKey> {
        VeilKey::new(5, 9)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_and_reconstruct() {
        let veilkey = VeilKey::new(2, 3).unwrap();
        let (master_key, shares) = veilkey.generate_team_key().unwrap();

        // Reconstruct with exactly threshold shares
        let subset: Vec<(u8, String)> = shares[0..2].to_vec();
        let reconstructed = veilkey.reconstruct_secret(&subset).unwrap();

        assert_eq!(master_key, reconstructed);
    }

    #[test]
    fn test_insufficient_shares() {
        let veilkey = VeilKey::new(3, 5).unwrap();
        let (_, shares) = veilkey.generate_team_key().unwrap();

        // Try to reconstruct with fewer shares than threshold
        let subset: Vec<(u8, String)> = shares[0..2].to_vec();
        let result = veilkey.reconstruct_secret(&subset);

        assert!(result.is_err());
    }

    #[test]
    fn test_invalid_threshold() {
        // Threshold greater than total
        assert!(VeilKey::new(5, 3).is_err());

        // Threshold less than 2
        assert!(VeilKey::new(1, 3).is_err());
    }

    #[test]
    fn test_verify_shares() {
        let veilkey = VeilKey::new(2, 3).unwrap();
        let (master_key, shares) = veilkey.generate_team_key().unwrap();

        assert!(veilkey.verify_shares(&shares, &master_key).unwrap());

        // Wrong key should not verify
        let wrong_key: [u8; 32] = [0u8; 32];
        assert!(!veilkey.verify_shares(&shares, &wrong_key).unwrap());
    }

    #[test]
    fn test_presets() {
        assert!(presets::small_team().is_ok());
        assert!(presets::medium_team().is_ok());
        assert!(presets::large_team().is_ok());
        assert!(presets::enterprise().is_ok());
    }
}
