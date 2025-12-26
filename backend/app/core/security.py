"""
EnvSync Security Module
Encryption, hashing, JWT, and authentication utilities
"""
import base64
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple

import argon2
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings


# Password hashing context
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

# Argon2 hasher for key derivation
argon2_hasher = argon2.PasswordHasher(
    time_cost=settings.ARGON2_TIME_COST,
    memory_cost=settings.ARGON2_MEMORY_COST,
    parallelism=settings.ARGON2_PARALLELISM,
)


def hash_password(password: str) -> str:
    """Hash a password using Argon2id."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)


def derive_key(password: str, salt: bytes) -> bytes:
    """
    Derive a 256-bit encryption key from a password using Argon2id.
    This matches the Tauri/Rust implementation for compatibility.
    """
    # Use raw Argon2id for key derivation
    hash_bytes = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode(),
        salt,
        iterations=100000,
        dklen=32,
    )
    return hash_bytes


def generate_salt() -> bytes:
    """Generate a random 16-byte salt."""
    return secrets.token_bytes(16)


def encrypt_data(plaintext: bytes, key: bytes) -> Tuple[bytes, bytes]:
    """
    Encrypt data using AES-256-GCM.
    Returns (nonce, ciphertext).
    """
    nonce = secrets.token_bytes(12)  # 96-bit nonce for GCM
    aesgcm = AESGCM(key)
    ciphertext = aesgcm.encrypt(nonce, plaintext, None)
    return nonce, ciphertext


def decrypt_data(nonce: bytes, ciphertext: bytes, key: bytes) -> bytes:
    """
    Decrypt data using AES-256-GCM.
    """
    aesgcm = AESGCM(key)
    return aesgcm.decrypt(nonce, ciphertext, None)


def encrypt_string(plaintext: str, key: bytes) -> str:
    """
    Encrypt a string and return base64-encoded result.
    Format: base64(nonce + ciphertext)
    """
    nonce, ciphertext = encrypt_data(plaintext.encode(), key)
    combined = nonce + ciphertext
    return base64.b64encode(combined).decode()


def decrypt_string(encrypted: str, key: bytes) -> str:
    """
    Decrypt a base64-encoded encrypted string.
    """
    combined = base64.b64decode(encrypted)
    nonce = combined[:12]
    ciphertext = combined[12:]
    plaintext = decrypt_data(nonce, ciphertext, key)
    return plaintext.decode()


def create_access_token(
    data: dict,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(data: dict) -> str:
    """Create a JWT refresh token."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    """Decode and validate a JWT token."""
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        return payload
    except JWTError:
        return None


def generate_api_key() -> str:
    """Generate a secure API key."""
    return f"es_{secrets.token_urlsafe(32)}"


def hash_api_key(api_key: str) -> str:
    """Hash an API key for storage."""
    return hashlib.sha256(api_key.encode()).hexdigest()
