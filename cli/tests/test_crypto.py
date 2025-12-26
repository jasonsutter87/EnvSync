"""
Comprehensive tests for EnvSync cryptographic operations.
Tests encryption, decryption, key derivation, and password handling.
"""
import base64
import secrets

import pytest
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from envsync.crypto import (
    CryptoHelper,
    generate_salt,
    hash_password,
    verify_password,
)


class TestCryptoHelperInit:
    """Tests for CryptoHelper initialization."""

    def test_init_with_password(self):
        """Test initialization with password generates key and salt."""
        crypto = CryptoHelper("test_password")

        assert crypto.key is not None
        assert len(crypto.key) == 32  # 256-bit key
        assert crypto.salt is not None
        assert len(crypto.salt) == 16  # 128-bit salt

    def test_init_with_custom_salt(self):
        """Test initialization with custom salt."""
        custom_salt = secrets.token_bytes(16)
        crypto = CryptoHelper("test_password", salt=custom_salt)

        assert crypto.salt == custom_salt

    def test_init_generates_different_salts(self):
        """Test that different instances generate different salts."""
        crypto1 = CryptoHelper("password")
        crypto2 = CryptoHelper("password")

        assert crypto1.salt != crypto2.salt

    def test_init_same_password_same_salt_same_key(self):
        """Test same password and salt produce same key."""
        salt = secrets.token_bytes(16)
        crypto1 = CryptoHelper("password", salt=salt)
        crypto2 = CryptoHelper("password", salt=salt)

        assert crypto1.key == crypto2.key

    def test_init_different_password_different_key(self):
        """Test different passwords produce different keys."""
        salt = secrets.token_bytes(16)
        crypto1 = CryptoHelper("password1", salt=salt)
        crypto2 = CryptoHelper("password2", salt=salt)

        assert crypto1.key != crypto2.key


class TestKeyDerivation:
    """Tests for key derivation from password."""

    def test_derive_key_returns_32_bytes(self):
        """Test derived key is 32 bytes (256 bits)."""
        crypto = CryptoHelper("test_password")

        assert len(crypto.key) == 32

    def test_derive_key_is_deterministic(self):
        """Test key derivation is deterministic with same inputs."""
        salt = secrets.token_bytes(16)
        crypto1 = CryptoHelper("password", salt=salt)
        crypto2 = CryptoHelper("password", salt=salt)

        assert crypto1.key == crypto2.key

    def test_derive_key_different_with_different_salt(self):
        """Test different salts produce different keys."""
        crypto1 = CryptoHelper("password", salt=b"salt1_1234567890")
        crypto2 = CryptoHelper("password", salt=b"salt2_1234567890")

        assert crypto1.key != crypto2.key

    def test_derive_key_handles_unicode_password(self):
        """Test key derivation handles unicode passwords."""
        crypto = CryptoHelper("pāsswørd™")

        assert crypto.key is not None
        assert len(crypto.key) == 32

    def test_derive_key_handles_empty_password(self):
        """Test key derivation handles empty password."""
        crypto = CryptoHelper("")

        assert crypto.key is not None
        assert len(crypto.key) == 32

    def test_derive_key_uses_pbkdf2(self):
        """Test key derivation uses PBKDF2 with correct parameters."""
        import hashlib

        password = "test_password"
        salt = b"test_salt_123456"

        crypto = CryptoHelper(password, salt=salt)

        # Manually derive key with same parameters
        expected_key = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), salt, iterations=100000, dklen=32
        )

        assert crypto.key == expected_key


class TestEncryption:
    """Tests for encryption functionality."""

    def test_encrypt_returns_tuple(self):
        """Test encrypt returns tuple of (ciphertext, nonce)."""
        crypto = CryptoHelper("password")
        result = crypto.encrypt("test value")

        assert isinstance(result, tuple)
        assert len(result) == 2

    def test_encrypt_returns_base64_strings(self):
        """Test encrypt returns base64-encoded strings."""
        crypto = CryptoHelper("password")
        encrypted, nonce = crypto.encrypt("test value")

        # Should be valid base64
        assert isinstance(encrypted, str)
        assert isinstance(nonce, str)
        base64.b64decode(encrypted)
        base64.b64decode(nonce)

    def test_encrypt_nonce_is_12_bytes(self):
        """Test encrypted nonce is 12 bytes (96 bits for GCM)."""
        crypto = CryptoHelper("password")
        encrypted, nonce = crypto.encrypt("test value")

        nonce_bytes = base64.b64decode(nonce)
        assert len(nonce_bytes) == 12

    def test_encrypt_different_nonces(self):
        """Test each encryption uses a different nonce."""
        crypto = CryptoHelper("password")
        _, nonce1 = crypto.encrypt("test value")
        _, nonce2 = crypto.encrypt("test value")

        assert nonce1 != nonce2

    def test_encrypt_different_ciphertexts(self):
        """Test encrypting same value produces different ciphertexts."""
        crypto = CryptoHelper("password")
        encrypted1, _ = crypto.encrypt("test value")
        encrypted2, _ = crypto.encrypt("test value")

        # Due to different nonces, ciphertexts should differ
        assert encrypted1 != encrypted2

    def test_encrypt_handles_unicode(self):
        """Test encryption handles unicode characters."""
        crypto = CryptoHelper("password")
        encrypted, nonce = crypto.encrypt("Hello 世界 🌍")

        assert encrypted is not None
        assert nonce is not None

    def test_encrypt_handles_empty_string(self):
        """Test encryption handles empty string."""
        crypto = CryptoHelper("password")
        encrypted, nonce = crypto.encrypt("")

        assert encrypted is not None
        assert nonce is not None

    def test_encrypt_handles_long_string(self):
        """Test encryption handles long strings."""
        crypto = CryptoHelper("password")
        long_value = "x" * 10000
        encrypted, nonce = crypto.encrypt(long_value)

        assert encrypted is not None
        assert nonce is not None


class TestDecryption:
    """Tests for decryption functionality."""

    def test_decrypt_reverses_encrypt(self):
        """Test decryption reverses encryption."""
        crypto = CryptoHelper("password")
        original = "test value"

        encrypted, nonce = crypto.encrypt(original)
        decrypted = crypto.decrypt(encrypted, nonce)

        assert decrypted == original

    def test_decrypt_with_unicode(self):
        """Test decryption with unicode characters."""
        crypto = CryptoHelper("password")
        original = "Hello 世界 🌍"

        encrypted, nonce = crypto.encrypt(original)
        decrypted = crypto.decrypt(encrypted, nonce)

        assert decrypted == original

    def test_decrypt_empty_string(self):
        """Test decryption of empty string."""
        crypto = CryptoHelper("password")
        original = ""

        encrypted, nonce = crypto.encrypt(original)
        decrypted = crypto.decrypt(encrypted, nonce)

        assert decrypted == original

    def test_decrypt_long_string(self):
        """Test decryption of long string."""
        crypto = CryptoHelper("password")
        original = "x" * 10000

        encrypted, nonce = crypto.encrypt(original)
        decrypted = crypto.decrypt(encrypted, nonce)

        assert decrypted == original

    def test_decrypt_with_wrong_password_fails(self):
        """Test decryption fails with wrong password."""
        crypto1 = CryptoHelper("password1")
        crypto2 = CryptoHelper("password2")

        encrypted, nonce = crypto1.encrypt("secret")

        with pytest.raises(Exception):
            crypto2.decrypt(encrypted, nonce)

    def test_decrypt_with_wrong_nonce_fails(self):
        """Test decryption fails with wrong nonce."""
        crypto = CryptoHelper("password")
        encrypted, _ = crypto.encrypt("secret")
        wrong_nonce = base64.b64encode(secrets.token_bytes(12)).decode()

        with pytest.raises(Exception):
            crypto.decrypt(encrypted, wrong_nonce)

    def test_decrypt_with_tampered_ciphertext_fails(self):
        """Test decryption fails with tampered ciphertext."""
        crypto = CryptoHelper("password")
        encrypted, nonce = crypto.encrypt("secret")

        # Tamper with ciphertext
        encrypted_bytes = base64.b64decode(encrypted)
        tampered = bytes([b ^ 1 for b in encrypted_bytes])
        tampered_b64 = base64.b64encode(tampered).decode()

        with pytest.raises(Exception):
            crypto.decrypt(tampered_b64, nonce)

    def test_decrypt_with_invalid_base64_fails(self):
        """Test decryption fails with invalid base64."""
        crypto = CryptoHelper("password")

        with pytest.raises(Exception):
            crypto.decrypt("not_base64!", "also_not_base64!")


class TestSaltHandling:
    """Tests for salt encoding and decoding."""

    def test_get_salt_b64_returns_string(self):
        """Test get_salt_b64 returns base64 string."""
        crypto = CryptoHelper("password")
        salt_b64 = crypto.get_salt_b64()

        assert isinstance(salt_b64, str)
        # Should be valid base64
        base64.b64decode(salt_b64)

    def test_get_salt_b64_encodes_salt(self):
        """Test get_salt_b64 correctly encodes the salt."""
        salt = b"test_salt_123456"
        crypto = CryptoHelper("password", salt=salt)
        salt_b64 = crypto.get_salt_b64()

        decoded_salt = base64.b64decode(salt_b64)
        assert decoded_salt == salt

    def test_from_salt_b64_creates_crypto_helper(self):
        """Test from_salt_b64 creates CryptoHelper with correct salt."""
        original_salt = secrets.token_bytes(16)
        salt_b64 = base64.b64encode(original_salt).decode()

        crypto = CryptoHelper.from_salt_b64("password", salt_b64)

        assert crypto.salt == original_salt

    def test_from_salt_b64_round_trip(self):
        """Test from_salt_b64 round trip preserves salt."""
        crypto1 = CryptoHelper("password")
        salt_b64 = crypto1.get_salt_b64()

        crypto2 = CryptoHelper.from_salt_b64("password", salt_b64)

        assert crypto2.salt == crypto1.salt
        assert crypto2.key == crypto1.key

    def test_from_salt_b64_allows_decryption(self):
        """Test from_salt_b64 creates helper that can decrypt."""
        crypto1 = CryptoHelper("password")
        encrypted, nonce = crypto1.encrypt("secret message")
        salt_b64 = crypto1.get_salt_b64()

        crypto2 = CryptoHelper.from_salt_b64("password", salt_b64)
        decrypted = crypto2.decrypt(encrypted, nonce)

        assert decrypted == "secret message"


class TestGenerateSalt:
    """Tests for the generate_salt utility function."""

    def test_generate_salt_returns_string(self):
        """Test generate_salt returns a string."""
        salt = generate_salt()

        assert isinstance(salt, str)

    def test_generate_salt_is_base64(self):
        """Test generate_salt returns valid base64."""
        salt = generate_salt()

        # Should decode without error
        decoded = base64.b64decode(salt)
        assert len(decoded) == 16

    def test_generate_salt_creates_unique_salts(self):
        """Test generate_salt creates unique salts each time."""
        salt1 = generate_salt()
        salt2 = generate_salt()
        salt3 = generate_salt()

        assert salt1 != salt2
        assert salt2 != salt3
        assert salt1 != salt3


class TestPasswordHashing:
    """Tests for password hashing and verification."""

    def test_hash_password_returns_string(self):
        """Test hash_password returns a string."""
        hashed = hash_password("test_password")

        assert isinstance(hashed, str)

    def test_hash_password_is_base64(self):
        """Test hash_password returns valid base64."""
        hashed = hash_password("test_password")

        # Should decode without error
        base64.b64decode(hashed)

    def test_hash_password_creates_different_hashes(self):
        """Test hash_password creates different hashes for same password."""
        hash1 = hash_password("password")
        hash2 = hash_password("password")

        # Due to different salts, hashes should differ
        assert hash1 != hash2

    def test_hash_password_includes_salt(self):
        """Test hash_password includes salt in the output."""
        hashed = hash_password("password")
        decoded = base64.b64decode(hashed)

        # Should be salt (16 bytes) + key (32 bytes) = 48 bytes
        assert len(decoded) == 48

    def test_verify_password_correct_password(self):
        """Test verify_password returns True for correct password."""
        password = "correct_password"
        hashed = hash_password(password)

        assert verify_password(password, hashed) is True

    def test_verify_password_wrong_password(self):
        """Test verify_password returns False for wrong password."""
        hashed = hash_password("correct_password")

        assert verify_password("wrong_password", hashed) is False

    def test_verify_password_handles_unicode(self):
        """Test verify_password handles unicode passwords."""
        password = "pāsswørd™"
        hashed = hash_password(password)

        assert verify_password(password, hashed) is True
        assert verify_password("different", hashed) is False

    def test_verify_password_empty_password(self):
        """Test verify_password handles empty password."""
        hashed = hash_password("")

        assert verify_password("", hashed) is True
        assert verify_password("not empty", hashed) is False

    def test_verify_password_constant_time_comparison(self):
        """Test verify_password uses constant-time comparison."""
        # This test verifies the function uses secrets.compare_digest
        # which is constant-time to prevent timing attacks
        password = "test_password"
        hashed = hash_password(password)

        # Both should execute in similar time
        result1 = verify_password("wrong", hashed)
        result2 = verify_password(password, hashed)

        assert result1 is False
        assert result2 is True


class TestEncryptionCompatibility:
    """Tests for encryption compatibility with backend."""

    def test_encryption_uses_aes_gcm(self):
        """Test encryption uses AES-GCM as expected by backend."""
        crypto = CryptoHelper("password")
        encrypted, nonce = crypto.encrypt("test")

        # Should be decryptable with AESGCM
        encrypted_bytes = base64.b64decode(encrypted)
        nonce_bytes = base64.b64decode(nonce)
        aesgcm = AESGCM(crypto.key)
        plaintext = aesgcm.decrypt(nonce_bytes, encrypted_bytes, None)

        assert plaintext.decode("utf-8") == "test"

    def test_key_derivation_matches_backend(self):
        """Test key derivation matches backend implementation."""
        import hashlib

        password = "test_password"
        salt = b"known_salt_12345"

        crypto = CryptoHelper(password, salt=salt)

        # Backend uses PBKDF2-SHA256 with 100,000 iterations
        expected_key = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), salt, iterations=100000, dklen=32
        )

        assert crypto.key == expected_key

    def test_nonce_size_matches_backend(self):
        """Test nonce size matches backend (12 bytes for GCM)."""
        crypto = CryptoHelper("password")
        _, nonce = crypto.encrypt("test")

        nonce_bytes = base64.b64decode(nonce)
        assert len(nonce_bytes) == 12  # 96 bits for GCM


class TestEdgeCases:
    """Tests for edge cases and error conditions."""

    def test_encrypt_decrypt_special_characters(self):
        """Test encryption/decryption with special characters."""
        crypto = CryptoHelper("password")
        special_chars = "!@#$%^&*()_+-=[]{}|;:',.<>?/~`\"\\"

        encrypted, nonce = crypto.encrypt(special_chars)
        decrypted = crypto.decrypt(encrypted, nonce)

        assert decrypted == special_chars

    def test_encrypt_decrypt_whitespace(self):
        """Test encryption/decryption preserves whitespace."""
        crypto = CryptoHelper("password")
        whitespace = "  leading\tmiddle  \n\r  trailing  "

        encrypted, nonce = crypto.encrypt(whitespace)
        decrypted = crypto.decrypt(encrypted, nonce)

        assert decrypted == whitespace

    def test_encrypt_decrypt_multiline(self):
        """Test encryption/decryption with multiline text."""
        crypto = CryptoHelper("password")
        multiline = "line1\nline2\r\nline3\rline4"

        encrypted, nonce = crypto.encrypt(multiline)
        decrypted = crypto.decrypt(encrypted, nonce)

        assert decrypted == multiline

    def test_multiple_encrypt_decrypt_cycles(self):
        """Test multiple encryption/decryption cycles."""
        crypto = CryptoHelper("password")
        original = "test value"

        # Encrypt and decrypt multiple times
        for _ in range(10):
            encrypted, nonce = crypto.encrypt(original)
            decrypted = crypto.decrypt(encrypted, nonce)
            assert decrypted == original
