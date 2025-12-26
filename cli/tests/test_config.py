"""
Comprehensive tests for EnvSync CLI configuration management.
Tests config file loading, saving, validation, and defaults.
"""
import json
import os
from pathlib import Path

import pytest

from envsync.config import Config, get_config, get_project_config, CONFIG_DIR, CONFIG_FILE, CREDENTIALS_FILE


class TestConfigInit:
    """Tests for Config initialization."""

    def test_config_default_values(self, clean_config):
        """Test Config has correct default values."""
        assert clean_config.api_url == "https://api.envsync.com"
        assert clean_config.api_key is None
        assert clean_config.refresh_token is None
        assert clean_config.default_project is None
        assert clean_config.default_environment == "development"

    def test_config_with_custom_values(self):
        """Test Config initialization with custom values."""
        config = Config(
            api_url="https://custom.api.com",
            api_key="test_key",
            refresh_token="test_refresh",
            default_project="my-project",
            default_environment="production",
        )

        assert config.api_url == "https://custom.api.com"
        assert config.api_key == "test_key"
        assert config.refresh_token == "test_refresh"
        assert config.default_project == "my-project"
        assert config.default_environment == "production"


class TestConfigSave:
    """Tests for saving configuration."""

    def test_save_creates_config_dir(self, temp_config_dir):
        """Test save creates config directory if it doesn't exist."""
        # Remove the directory
        import shutil
        shutil.rmtree(temp_config_dir)

        config = Config()
        config.save()

        assert temp_config_dir.exists()
        assert temp_config_dir.is_dir()

    def test_save_creates_config_file(self, temp_config_dir):
        """Test save creates config.json file."""
        config = Config()
        config.api_url = "https://custom.api.com"
        config.default_project = "test-project"
        config.save()

        config_file = temp_config_dir / "config.json"
        assert config_file.exists()

        data = json.loads(config_file.read_text())
        assert data["api_url"] == "https://custom.api.com"
        assert data["default_project"] == "test-project"
        assert data["default_environment"] == "development"

    def test_save_creates_credentials_file(self, temp_config_dir):
        """Test save creates credentials.json file."""
        config = Config()
        config.api_key = "test_api_key"
        config.refresh_token = "test_refresh_token"
        config.save()

        creds_file = temp_config_dir / "credentials.json"
        assert creds_file.exists()

        data = json.loads(creds_file.read_text())
        assert data["api_key"] == "test_api_key"
        assert data["refresh_token"] == "test_refresh_token"

    def test_save_separates_config_and_credentials(self, temp_config_dir):
        """Test save stores config and credentials separately."""
        config = Config()
        config.api_url = "https://custom.api.com"
        config.api_key = "secret_key"
        config.save()

        # Config file should not contain sensitive data
        config_file = temp_config_dir / "config.json"
        config_data = json.loads(config_file.read_text())
        assert "api_key" not in config_data
        assert "refresh_token" not in config_data

        # Credentials file should not contain non-sensitive data
        creds_file = temp_config_dir / "credentials.json"
        creds_data = json.loads(creds_file.read_text())
        assert "api_url" not in creds_data
        assert "default_project" not in creds_data

    def test_save_sets_file_permissions(self, temp_config_dir):
        """Test save sets secure file permissions (600)."""
        config = Config()
        config.save()

        config_file = temp_config_dir / "config.json"
        creds_file = temp_config_dir / "credentials.json"

        # Check permissions are 0o600 (owner read/write only)
        assert config_file.stat().st_mode & 0o777 == 0o600
        assert creds_file.stat().st_mode & 0o777 == 0o600

    def test_save_overwrites_existing_config(self, temp_config_dir):
        """Test save overwrites existing configuration."""
        config = Config()
        config.api_url = "https://old.api.com"
        config.save()

        config.api_url = "https://new.api.com"
        config.save()

        config_file = temp_config_dir / "config.json"
        data = json.loads(config_file.read_text())
        assert data["api_url"] == "https://new.api.com"

    def test_save_with_none_values(self, temp_config_dir):
        """Test save handles None values correctly."""
        config = Config()
        config.api_key = None
        config.default_project = None
        config.save()

        creds_file = temp_config_dir / "credentials.json"
        creds_data = json.loads(creds_file.read_text())
        assert creds_data["api_key"] is None
        assert creds_data["refresh_token"] is None


class TestConfigLoad:
    """Tests for loading configuration."""

    def test_load_returns_defaults_when_no_files(self, temp_config_dir):
        """Test load returns default config when no files exist."""
        config = Config.load()

        assert config.api_url == "https://api.envsync.com"
        assert config.api_key is None
        assert config.default_environment == "development"

    def test_load_reads_config_file(self, temp_config_dir):
        """Test load reads config from config.json."""
        config_file = temp_config_dir / "config.json"
        config_data = {
            "api_url": "https://loaded.api.com",
            "default_project": "loaded-project",
            "default_environment": "production",
        }
        config_file.write_text(json.dumps(config_data))

        config = Config.load()

        assert config.api_url == "https://loaded.api.com"
        assert config.default_project == "loaded-project"
        assert config.default_environment == "production"

    def test_load_reads_credentials_file(self, temp_config_dir):
        """Test load reads credentials from credentials.json."""
        creds_file = temp_config_dir / "credentials.json"
        creds_data = {
            "api_key": "loaded_api_key",
            "refresh_token": "loaded_refresh_token",
        }
        creds_file.write_text(json.dumps(creds_data))

        config = Config.load()

        assert config.api_key == "loaded_api_key"
        assert config.refresh_token == "loaded_refresh_token"

    def test_load_handles_corrupted_config_file(self, temp_config_dir):
        """Test load handles corrupted config file gracefully."""
        config_file = temp_config_dir / "config.json"
        config_file.write_text("{ invalid json }")

        # Should not raise exception, just use defaults
        config = Config.load()

        assert config.api_url == "https://api.envsync.com"

    def test_load_handles_corrupted_credentials_file(self, temp_config_dir):
        """Test load handles corrupted credentials file gracefully."""
        creds_file = temp_config_dir / "credentials.json"
        creds_file.write_text("not json at all")

        # Should not raise exception, just use defaults
        config = Config.load()

        assert config.api_key is None
        assert config.refresh_token is None

    def test_load_handles_missing_keys(self, temp_config_dir):
        """Test load handles missing keys in config file."""
        config_file = temp_config_dir / "config.json"
        config_file.write_text(json.dumps({"api_url": "https://custom.api.com"}))

        config = Config.load()

        assert config.api_url == "https://custom.api.com"
        assert config.default_project is None
        assert config.default_environment == "development"

    def test_load_environment_variable_overrides_api_url(self, temp_config_dir, monkeypatch):
        """Test environment variable overrides config file for API URL."""
        config_file = temp_config_dir / "config.json"
        config_file.write_text(json.dumps({"api_url": "https://file.api.com"}))

        monkeypatch.setenv("ENVSYNC_API_URL", "https://env.api.com")

        config = Config.load()

        assert config.api_url == "https://env.api.com"

    def test_load_environment_variable_overrides_api_key(self, temp_config_dir, monkeypatch):
        """Test environment variable overrides config file for API key."""
        creds_file = temp_config_dir / "credentials.json"
        creds_file.write_text(json.dumps({"api_key": "file_api_key"}))

        monkeypatch.setenv("ENVSYNC_API_KEY", "env_api_key")

        config = Config.load()

        assert config.api_key == "env_api_key"

    def test_load_preserves_all_fields(self, temp_config_dir):
        """Test load preserves all configuration fields."""
        config_file = temp_config_dir / "config.json"
        config_data = {
            "api_url": "https://test.api.com",
            "default_project": "test-proj",
            "default_environment": "staging",
        }
        config_file.write_text(json.dumps(config_data))

        creds_file = temp_config_dir / "credentials.json"
        creds_data = {
            "api_key": "test_key",
            "refresh_token": "test_refresh",
        }
        creds_file.write_text(json.dumps(creds_data))

        config = Config.load()

        assert config.api_url == "https://test.api.com"
        assert config.default_project == "test-proj"
        assert config.default_environment == "staging"
        assert config.api_key == "test_key"
        assert config.refresh_token == "test_refresh"


class TestGetConfig:
    """Tests for the get_config helper function."""

    def test_get_config_returns_config_instance(self, temp_config_dir):
        """Test get_config returns a Config instance."""
        config = get_config()

        assert isinstance(config, Config)

    def test_get_config_loads_from_disk(self, temp_config_dir):
        """Test get_config loads configuration from disk."""
        # Save a config
        config = Config()
        config.api_url = "https://saved.api.com"
        config.save()

        # Get config should load the saved value
        loaded_config = get_config()

        assert loaded_config.api_url == "https://saved.api.com"


class TestGetProjectConfig:
    """Tests for project-specific configuration (.envsync file)."""

    def test_get_project_config_returns_none_when_no_file(self):
        """Test get_project_config returns None when .envsync doesn't exist."""
        config = get_project_config()

        assert config is None

    def test_get_project_config_parses_simple_config(self, temp_dir, monkeypatch):
        """Test get_project_config parses simple key=value config."""
        monkeypatch.chdir(temp_dir)
        config_file = temp_dir / ".envsync"
        config_file.write_text("project=my-project\nenvironment=production\n")

        config = get_project_config()

        assert config is not None
        assert config["project"] == "my-project"
        assert config["environment"] == "production"

    def test_get_project_config_ignores_comments(self, temp_dir, monkeypatch):
        """Test get_project_config ignores comment lines."""
        monkeypatch.chdir(temp_dir)
        config_file = temp_dir / ".envsync"
        config_file.write_text("# This is a comment\nproject=test\n# Another comment\n")

        config = get_project_config()

        assert config is not None
        assert "project" in config
        assert len(config) == 1

    def test_get_project_config_ignores_empty_lines(self, temp_dir, monkeypatch):
        """Test get_project_config ignores empty lines."""
        monkeypatch.chdir(temp_dir)
        config_file = temp_dir / ".envsync"
        config_file.write_text("\n\nproject=test\n\n")

        config = get_project_config()

        assert config is not None
        assert config["project"] == "test"

    def test_get_project_config_strips_whitespace(self, temp_dir, monkeypatch):
        """Test get_project_config strips whitespace from keys and values."""
        monkeypatch.chdir(temp_dir)
        config_file = temp_dir / ".envsync"
        config_file.write_text("  project  =  my-project  \n")

        config = get_project_config()

        assert config is not None
        assert config["project"] == "my-project"

    def test_get_project_config_handles_values_with_equals(self, temp_dir, monkeypatch):
        """Test get_project_config handles values containing equals signs."""
        monkeypatch.chdir(temp_dir)
        config_file = temp_dir / ".envsync"
        config_file.write_text("connection=user=admin;password=secret\n")

        config = get_project_config()

        assert config is not None
        assert config["connection"] == "user=admin;password=secret"

    def test_get_project_config_ignores_invalid_lines(self, temp_dir, monkeypatch):
        """Test get_project_config ignores lines without equals sign."""
        monkeypatch.chdir(temp_dir)
        config_file = temp_dir / ".envsync"
        config_file.write_text("project=test\ninvalidline\nenv=dev\n")

        config = get_project_config()

        assert config is not None
        assert "project" in config
        assert "env" in config
        assert len(config) == 2


class TestConfigRoundTrip:
    """Tests for save/load round-trip operations."""

    def test_config_round_trip_preserves_all_values(self, temp_config_dir):
        """Test saving and loading config preserves all values."""
        original = Config(
            api_url="https://test.api.com",
            api_key="test_api_key",
            refresh_token="test_refresh_token",
            default_project="test-project",
            default_environment="staging",
        )
        original.save()

        loaded = Config.load()

        assert loaded.api_url == original.api_url
        assert loaded.api_key == original.api_key
        assert loaded.refresh_token == original.refresh_token
        assert loaded.default_project == original.default_project
        assert loaded.default_environment == original.default_environment

    def test_config_round_trip_with_none_values(self, temp_config_dir):
        """Test round trip with None values."""
        original = Config()
        original.api_key = None
        original.default_project = None
        original.save()

        loaded = Config.load()

        assert loaded.api_key is None
        assert loaded.default_project is None

    def test_config_multiple_save_load_cycles(self, temp_config_dir):
        """Test multiple save/load cycles work correctly."""
        config = Config()
        config.api_url = "https://first.api.com"
        config.save()

        config = Config.load()
        config.api_url = "https://second.api.com"
        config.save()

        config = Config.load()
        config.default_project = "new-project"
        config.save()

        final = Config.load()
        assert final.api_url == "https://second.api.com"
        assert final.default_project == "new-project"
