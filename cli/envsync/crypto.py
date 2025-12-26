"""
EnvSync Crypto Helper
Client-side encryption/decryption matching the Rust/Python backends
"""
import base64
import hashlib
import secrets
from typing import Tuple

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


class CryptoHelper:
    """
    Handles client-side encryption/decryption.
    Uses AES-256-GCM with key derived from password.
    """

    def __init__(self, password: str, salt: bytes = None):
        """
        Initialize crypto helper with password.

        Args:
            password: User's master password
            salt: Salt for key derivation (generated if not provided)
        """
        self.salt = salt or secrets.token_bytes(16)
        self.key = self._derive_key(password, self.salt)

    def _derive_key(self, password: str, salt: bytes) -> bytes:
        """
        Derive a 256-bit encryption key from password using PBKDF2.
        This matches the backend implementation for compatibility.
        """
        return hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt,
            iterations=100000,
            dklen=32,
        )

    def encrypt(self, plaintext: str) -> Tuple[str, str]:
        """
        Encrypt a string value.

        Args:
            plaintext: The value to encrypt

        Returns:
            Tuple of (base64_encrypted_value, base64_nonce)
        """
        nonce = secrets.token_bytes(12)  # 96-bit nonce for GCM
        aesgcm = AESGCM(self.key)
        ciphertext = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)

        return (
            base64.b64encode(ciphertext).decode("ascii"),
            base64.b64encode(nonce).decode("ascii"),
        )

    def decrypt(self, encrypted_value: str, nonce: str) -> str:
        """
        Decrypt a string value.

        Args:
            encrypted_value: Base64-encoded ciphertext
            nonce: Base64-encoded nonce

        Returns:
            Decrypted plaintext string
        """
        ciphertext = base64.b64decode(encrypted_value)
        nonce_bytes = base64.b64decode(nonce)

        aesgcm = AESGCM(self.key)
        plaintext = aesgcm.decrypt(nonce_bytes, ciphertext, None)

        return plaintext.decode("utf-8")

    def get_salt_b64(self) -> str:
        """Get the salt as base64 string."""
        return base64.b64encode(self.salt).decode("ascii")

    @classmethod
    def from_salt_b64(cls, password: str, salt_b64: str) -> "CryptoHelper":
        """Create helper from base64-encoded salt."""
        salt = base64.b64decode(salt_b64)
        return cls(password, salt)


def generate_salt() -> str:
    """Generate a random salt as base64 string."""
    return base64.b64encode(secrets.token_bytes(16)).decode("ascii")


def hash_password(password: str) -> str:
    """
    Hash a password for storage.
    Uses PBKDF2 with SHA-256.
    """
    salt = secrets.token_bytes(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 100000)
    return base64.b64encode(salt + key).decode("ascii")


def verify_password(password: str, stored_hash: str) -> bool:
    """Verify a password against its hash."""
    decoded = base64.b64decode(stored_hash)
    salt = decoded[:16]
    stored_key = decoded[16:]
    key = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 100000)
    return secrets.compare_digest(key, stored_key)
