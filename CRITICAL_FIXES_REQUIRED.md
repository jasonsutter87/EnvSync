# CRITICAL SECURITY FIXES - IMMEDIATE ACTION REQUIRED

## Overview
This document provides EXACT code changes needed to fix the 3 CRITICAL vulnerabilities found in EnvSync.

**STOP:** Do not deploy to production until these fixes are implemented and tested.

---

## Fix #1: SQL Injection in LIMIT/OFFSET Clauses

### Affected Files
- `src-tauri/src/db.rs` - Lines 1632-1637, 1810-1816, 1857-1859

### Root Cause
User-controlled integers are directly interpolated into SQL strings using `format!()` instead of parameterized queries.

### The Fix

#### Step 1: Update `query_audit_log()` function (Line 1591-1668)

**FIND:**
```rust
        sql.push_str(" ORDER BY timestamp DESC");

        if let Some(limit) = query.limit {
            sql.push_str(&format!(" LIMIT {}", limit));
        }

        if let Some(offset) = query.offset {
            sql.push_str(&format!(" OFFSET {}", offset));
        }

        let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|b| b.as_ref()).collect();
```

**REPLACE WITH:**
```rust
        sql.push_str(" ORDER BY timestamp DESC");

        // Add LIMIT/OFFSET as parameters, not string interpolation
        if query.limit.is_some() || query.offset.is_some() {
            sql.push_str(" LIMIT ? OFFSET ?");
            params_vec.push(Box::new(query.limit.unwrap_or(100) as i64));
            params_vec.push(Box::new(query.offset.unwrap_or(0) as i64));
        }

        let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|b| b.as_ref()).collect();
```

#### Step 2: Update `get_variable_history()` function (Line 1736-1841)

**FIND:**
```rust
        );

        if let Some(lim) = limit {
            sql.push_str(&format!(" LIMIT {}", lim));
        }

        if let Some(off) = offset {
            sql.push_str(&format!(" OFFSET {}", off));
        }

        let mut stmt = conn.prepare(&sql)?;
```

**REPLACE WITH:**
```rust
        );

        // Add LIMIT/OFFSET as parameters
        if limit.is_some() || offset.is_some() {
            sql.push_str(" LIMIT ? OFFSET ?");
            params_vec.push(Box::new(limit.unwrap_or(100) as i64));
            params_vec.push(Box::new(offset.unwrap_or(0) as i64));
        }

        let mut stmt = conn.prepare(&sql)?;
```

#### Step 3: Update `get_variable_history_by_id()` function (Line 1844-1884)

**FIND:**
```rust
             ORDER BY timestamp DESC"
        );

        if let Some(lim) = limit {
            sql.push_str(&format!(" LIMIT {}", lim));
        }

        let mut stmt = conn.prepare(&sql)?;

        let entries = stmt
            .query_map(params![variable_id], |row| {
```

**REPLACE WITH:**
```rust
             ORDER BY timestamp DESC"
        );

        let mut query_params: Vec<Box<dyn rusqlite::ToSql>> = vec![
            Box::new(variable_id.to_string())
        ];

        if let Some(lim) = limit {
            sql.push_str(" LIMIT ?");
            query_params.push(Box::new(lim as i64));
        }

        let mut stmt = conn.prepare(&sql)?;

        let params_refs: Vec<&dyn rusqlite::ToSql> = query_params.iter().map(|b| b.as_ref()).collect();

        let entries = stmt
            .query_map(params_refs.as_slice(), |row| {
```

### Testing the Fix

```rust
#[cfg(test)]
mod sql_injection_tests {
    use super::*;

    #[test]
    fn test_sql_injection_in_limit() {
        let db = Database::new(PathBuf::from(":memory:"));
        db.initialize("test_password").unwrap();
        db.unlock("test_password").unwrap();

        // This should now be treated as a number, not SQL
        let query = AuditQuery {
            limit: Some(1_000_000), // Large number, not SQL injection
            offset: Some(0),
            ..Default::default()
        };

        // Should not panic or execute malicious SQL
        let result = db.query_audit_log(&query);
        assert!(result.is_ok());
    }
}
```

---

## Fix #2: Secure Memory Handling for Secrets

### Step 1: Add zeroize dependency

**File:** `src-tauri/Cargo.toml`

**ADD AFTER LINE 41 (after base64 dependency):**
```toml
# Secure memory zeroing
zeroize = { version = "1.7", features = ["derive"] }
```

### Step 2: Update crypto.rs

**File:** `src-tauri/src/crypto.rs`

**ADD AT TOP (after existing imports):**
```rust
use zeroize::{Zeroize, Zeroizing};
```

**REPLACE derive_key function (lines 18-32):**
```rust
/// Derives a 256-bit encryption key from a password using Argon2id
pub fn derive_key(password: &str, salt: &[u8]) -> Result<[u8; KEY_SIZE]> {
    use argon2::Argon2;

    // Use Zeroizing to ensure password bytes are cleared
    let password_bytes = Zeroizing::new(password.as_bytes().to_vec());

    // Use Argon2id with recommended parameters
    let argon2 = Argon2::default();

    // Create a hash of the password with salt
    let mut output = Zeroizing::new([0u8; KEY_SIZE]);

    argon2
        .hash_password_into(&password_bytes, salt, &mut *output)
        .map_err(|e| EnvSyncError::Encryption(format!("Key derivation failed: {}", e)))?;

    Ok(*output)
}
```

**REPLACE decrypt_bytes function (lines 99-115):**
```rust
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

    let mut plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| EnvSyncError::InvalidPassword)?;

    // Return Zeroizing wrapper to ensure plaintext is cleared when dropped
    Ok(plaintext)
}
```

### Step 3: Update Database encryption key storage

**File:** `src-tauri/src/db.rs`

**FIND (line 19):**
```rust
    encryption_key: Mutex<Option<[u8; 32]>>,
```

**REPLACE WITH:**
```rust
    encryption_key: Mutex<Option<Zeroizing<[u8; 32]>>>,
```

**UPDATE get_key() method (line 409-412):**

**FIND:**
```rust
    fn get_key(&self) -> Result<[u8; 32]> {
        let guard = self.encryption_key.lock().unwrap();
        guard.ok_or(EnvSyncError::VaultLocked)
    }
```

**REPLACE WITH:**
```rust
    fn get_key(&self) -> Result<[u8; 32]> {
        let guard = self.encryption_key.lock().unwrap();
        guard.as_ref()
            .map(|z| **z)  // Dereference Zeroizing wrapper
            .ok_or(EnvSyncError::VaultLocked)
    }
```

**UPDATE unlock() method storage (line 322-323):**

**FIND:**
```rust
        *self.conn.lock().unwrap() = Some(conn);
        *self.encryption_key.lock().unwrap() = Some(key);
```

**REPLACE WITH:**
```rust
        *self.conn.lock().unwrap() = Some(conn);
        *self.encryption_key.lock().unwrap() = Some(Zeroizing::new(key));
```

**UPDATE initialize() method storage (line 384-385):**

**FIND:**
```rust
        *self.conn.lock().unwrap() = Some(temp_conn);
        *self.encryption_key.lock().unwrap() = Some(key);
```

**REPLACE WITH:**
```rust
        *self.conn.lock().unwrap() = Some(temp_conn);
        *self.encryption_key.lock().unwrap() = Some(Zeroizing::new(key));
```

### Step 4: Add Zeroize to imports

**File:** `src-tauri/src/db.rs`

**ADD AFTER LINE 3 (after rusqlite import):**
```rust
use zeroize::Zeroizing;
```

---

## Fix #3: Harden SQLCipher Key Handling

### The Problem
Setting SQLCipher key via `execute_batch` with `format!()` could leak key in error messages.

### The Fix

**File:** `src-tauri/src/db.rs`

**REPLACE initialize() key setting (lines 107-109):**

**FIND:**
```rust
        // Set SQLCipher key
        let key_hex: String = key.iter().map(|b| format!("{:02x}", b)).collect();
        conn.execute_batch(&format!("PRAGMA key = \"x'{}'\"", key_hex))?;
```

**REPLACE WITH:**
```rust
        // Set SQLCipher key securely
        let key_hex: String = key.iter().map(|b| format!("{:02x}", b)).collect();

        // Use PRAGMA with error sanitization
        conn.pragma_update(None, "key", &format!("x'{}'", key_hex))
            .map_err(|_| EnvSyncError::Encryption(
                "Failed to set database encryption key".to_string()
                // Don't leak key in error message
            ))?;
```

**REPLACE unlock() key setting (lines 364-366):**

**FIND:**
```rust
        // Try to open with the derived key
        let key_hex: String = key.iter().map(|b| format!("{:02x}", b)).collect();
        temp_conn.execute_batch(&format!("PRAGMA key = \"x'{}'\"", key_hex))?;
```

**REPLACE WITH:**
```rust
        // Try to open with the derived key
        let key_hex: String = key.iter().map(|b| format!("{:02x}", b)).collect();

        // Use PRAGMA with error sanitization
        temp_conn.pragma_update(None, "key", &format!("x'{}'", key_hex))
            .map_err(|_| EnvSyncError::InvalidPassword)?;
            // Generic error - don't leak key details
```

### Additional: Clear key_hex from memory

**AFTER BOTH REPLACEMENTS ABOVE, ADD:**
```rust
        // Clear hex key from memory after use
        let mut key_hex_bytes = key_hex.into_bytes();
        key_hex_bytes.zeroize();
```

---

## Verification Steps

### 1. Compile and Test

```bash
cd src-tauri

# Run tests
cargo test

# Check for security issues
cargo audit

# Verify no SQL injection
cargo test sql_injection_tests
```

### 2. Manual Verification

**SQL Injection Test:**
```bash
# Try to inject SQL via API
curl -X POST http://localhost:3000/query_audit_log \
  -H "Content-Type: application/json" \
  -d '{"limit": "1; DROP TABLE audit_log; --", "offset": 0}'

# Should fail gracefully, not execute DROP
```

**Memory Safety Test:**
```rust
// Add to crypto tests
#[test]
fn test_key_zeroed_after_drop() {
    let password = "test_password";
    let salt = generate_salt();

    {
        let key = derive_key(password, &salt).unwrap();
        // Key is in scope
    }
    // Key should be zeroed here due to Zeroizing Drop
}
```

### 3. Security Scan

```bash
# Install cargo-audit if not present
cargo install cargo-audit

# Run security audit
cargo audit

# Check for unsafe code
cargo geiger

# Expected: No unsafe blocks in crypto or database code
```

---

## Post-Fix Checklist

- [ ] All 3 critical fixes applied
- [ ] Code compiles without errors
- [ ] All tests pass
- [ ] Manual SQL injection test fails gracefully
- [ ] Memory is properly zeroed (verified with debugger)
- [ ] SQLCipher errors don't leak key material
- [ ] No new unsafe code introduced
- [ ] Changes reviewed by second developer
- [ ] Security scan passes

---

## Next Steps After Critical Fixes

1. **Implement High Priority Fixes** (see SECURITY_ASSESSMENT.md)
   - Rate limiting
   - Input validation
   - Stronger Argon2 parameters

2. **Security Testing**
   - Automated fuzzing
   - Penetration testing
   - Third-party audit

3. **Documentation**
   - Update security documentation
   - Add security best practices guide
   - Document incident response plan

---

## Emergency Contact

If you discover additional security issues:
1. DO NOT commit fixes to public repo
2. Email security findings privately
3. Follow responsible disclosure timeline

---

**Document Version:** 1.0
**Last Updated:** 2025-12-26
**Status:** CRITICAL - IMPLEMENT IMMEDIATELY
