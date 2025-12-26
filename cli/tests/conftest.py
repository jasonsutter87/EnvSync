"""
Pytest configuration and shared fixtures for EnvSync CLI tests.
"""
import json
import tempfile
from pathlib import Path
from typing import Dict, Any, Optional
from unittest.mock import Mock

import pytest
from click.testing import CliRunner

from envsync.config import Config
from envsync.client import EnvSyncClient


@pytest.fixture
def cli_runner():
    """Provide a Click CLI test runner."""
    return CliRunner()


@pytest.fixture
def temp_dir():
    """Provide a temporary directory for test files."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


@pytest.fixture
def temp_config_dir(temp_dir, monkeypatch):
    """Provide a temporary config directory and monkey-patch the config paths."""
    config_dir = temp_dir / ".config" / "envsync"
    config_dir.mkdir(parents=True, exist_ok=True)

    # Monkey-patch the config directory paths
    monkeypatch.setattr("envsync.config.CONFIG_DIR", config_dir)
    monkeypatch.setattr("envsync.config.CONFIG_FILE", config_dir / "config.json")
    monkeypatch.setattr("envsync.config.CREDENTIALS_FILE", config_dir / "credentials.json")

    return config_dir


@pytest.fixture
def clean_config(temp_config_dir):
    """Provide a clean Config instance with temp directory."""
    return Config()


@pytest.fixture
def config_with_auth(temp_config_dir):
    """Provide a Config instance with authentication tokens."""
    config = Config()
    config.api_key = "test_access_token_12345"
    config.refresh_token = "test_refresh_token_67890"
    config.api_url = "https://api.envsync.test"
    config.save()
    return config


@pytest.fixture
def mock_api_response():
    """Factory for creating mock API responses."""
    def _create_response(
        status_code: int = 200,
        json_data: Optional[Dict[str, Any]] = None,
        text: str = "",
    ):
        response = Mock()
        response.status_code = status_code
        response.json.return_value = json_data or {}
        response.text = text
        return response

    return _create_response


@pytest.fixture
def mock_login_response():
    """Mock successful login response."""
    return {
        "access_token": "test_access_token",
        "refresh_token": "test_refresh_token",
        "token_type": "bearer",
        "expires_in": 3600,
    }


@pytest.fixture
def mock_user_response():
    """Mock user info response."""
    return {
        "id": "user-123",
        "email": "test@example.com",
        "subscription_tier": "pro",
        "created_at": "2024-01-01T00:00:00Z",
    }


@pytest.fixture
def mock_projects_response():
    """Mock projects list response."""
    return {
        "projects": [
            {
                "id": "proj-1",
                "name": "my-project",
                "environment_count": 3,
                "variable_count": 15,
                "last_synced_at": "2024-01-15T10:30:00Z",
                "created_at": "2024-01-01T00:00:00Z",
            },
            {
                "id": "proj-2",
                "name": "another-project",
                "environment_count": 2,
                "variable_count": 8,
                "last_synced_at": None,
                "created_at": "2024-01-10T00:00:00Z",
            },
        ]
    }


@pytest.fixture
def mock_environments_response():
    """Mock environments list response."""
    return [
        {
            "id": "env-1",
            "name": "development",
            "variable_count": 10,
            "created_at": "2024-01-01T00:00:00Z",
        },
        {
            "id": "env-2",
            "name": "staging",
            "variable_count": 12,
            "created_at": "2024-01-01T00:00:00Z",
        },
        {
            "id": "env-3",
            "name": "production",
            "variable_count": 15,
            "created_at": "2024-01-01T00:00:00Z",
        },
    ]


@pytest.fixture
def mock_variables_response():
    """Mock variables list response with encrypted values."""
    return [
        {
            "id": "var-1",
            "key": "DATABASE_URL",
            "encrypted_value": "k8s9f7d6a5s4d3f2g1h0j9k8l7m6n5o4",
            "value_nonce": "a1b2c3d4e5f6g7h8i9j0k1l2",
            "created_at": "2024-01-01T00:00:00Z",
        },
        {
            "id": "var-2",
            "key": "API_KEY",
            "encrypted_value": "p9o8i7u6y5t4r3e2w1q0a9s8d7f6g5h4",
            "value_nonce": "m1n2b3v4c5x6z7a8s9d0f1g2",
            "created_at": "2024-01-01T00:00:00Z",
        },
        {
            "id": "var-3",
            "key": "SECRET_KEY",
            "encrypted_value": "j3h4g5f6d7s8a9z0x1c2v3b4n5m6k7l8",
            "value_nonce": "q1w2e3r4t5y6u7i8o9p0a1s2",
            "created_at": "2024-01-01T00:00:00Z",
        },
    ]


@pytest.fixture
def sample_env_file(temp_dir):
    """Create a sample .env file for testing."""
    env_file = temp_dir / ".env"
    content = """# Database configuration
DATABASE_URL=postgresql://localhost:5432/mydb
DATABASE_PASSWORD=super_secret_password

# API Keys
API_KEY=sk_test_1234567890abcdef
SECRET_KEY=my-secret-key-value

# App Settings
DEBUG=true
PORT=8000
"""
    env_file.write_text(content)
    return env_file


@pytest.fixture
def sample_env_file_with_quotes(temp_dir):
    """Create a .env file with quoted values for testing."""
    env_file = temp_dir / ".env"
    content = """DATABASE_URL="postgresql://localhost:5432/mydb"
API_KEY='sk_test_1234567890abcdef'
SECRET_KEY="my-secret-key-value"
UNQUOTED=plain_value
"""
    env_file.write_text(content)
    return env_file


@pytest.fixture
def sample_envsync_config(temp_dir):
    """Create a sample .envsync project config file."""
    config_file = temp_dir / ".envsync"
    content = """# EnvSync Configuration
project=my-project
environment=development
"""
    config_file.write_text(content)
    return config_file


@pytest.fixture
def mock_client(monkeypatch, mock_projects_response, mock_environments_response, mock_variables_response):
    """Provide a mock EnvSyncClient with common responses."""
    client = Mock(spec=EnvSyncClient)

    # Default mock responses
    client.list_projects.return_value = mock_projects_response
    client.get_environments.return_value = mock_environments_response
    client.get_variables.return_value = mock_variables_response
    client.get_current_user.return_value = {
        "email": "test@example.com",
        "subscription_tier": "pro",
    }
    client.create_variables_bulk.return_value = []

    return client


@pytest.fixture
def mock_httpx_client(monkeypatch):
    """Mock httpx.Client for API requests."""
    mock_client = Mock()
    mock_response = Mock()
    mock_response.status_code = 200
    mock_response.json.return_value = {}
    mock_client.request.return_value = mock_response
    mock_client.__enter__ = Mock(return_value=mock_client)
    mock_client.__exit__ = Mock(return_value=False)

    def mock_client_factory(*args, **kwargs):
        return mock_client

    monkeypatch.setattr("httpx.Client", mock_client_factory)
    return mock_client


@pytest.fixture
def mock_crypto_helper(monkeypatch):
    """Provide a mock CryptoHelper that doesn't do real encryption."""
    from envsync.crypto import CryptoHelper

    class MockCryptoHelper:
        def __init__(self, password: str, salt: bytes = None):
            self.password = password
            self.salt = salt or b"test_salt_123456"

        def encrypt(self, plaintext: str):
            # Simple base64 encoding for predictable testing
            import base64
            encoded = base64.b64encode(plaintext.encode()).decode()
            nonce = base64.b64encode(b"test_nonce_12345").decode()
            return (encoded, nonce)

        def decrypt(self, encrypted_value: str, nonce: str):
            # Simple base64 decoding
            import base64
            return base64.b64decode(encrypted_value).decode()

        def get_salt_b64(self):
            import base64
            return base64.b64encode(self.salt).decode()

        @classmethod
        def from_salt_b64(cls, password: str, salt_b64: str):
            import base64
            salt = base64.b64decode(salt_b64)
            return cls(password, salt)

    return MockCryptoHelper


@pytest.fixture
def isolated_filesystem(cli_runner):
    """Provide an isolated filesystem for CLI testing."""
    with cli_runner.isolated_filesystem():
        yield Path.cwd()


@pytest.fixture
def mock_click_prompt(monkeypatch):
    """Mock click.prompt for testing interactive commands."""
    responses = {}

    def mock_prompt(text, **kwargs):
        return responses.get(text, "default_value")

    monkeypatch.setattr("click.prompt", mock_prompt)
    return responses
