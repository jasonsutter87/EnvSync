"""
EnvSync CLI Configuration
Handles config file and credentials storage
"""
import json
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional


CONFIG_DIR = Path.home() / ".config" / "envsync"
CONFIG_FILE = CONFIG_DIR / "config.json"
CREDENTIALS_FILE = CONFIG_DIR / "credentials.json"


@dataclass
class Config:
    """CLI configuration."""

    api_url: str = "https://api.envsync.com"
    api_key: Optional[str] = None
    refresh_token: Optional[str] = None
    default_project: Optional[str] = None
    default_environment: str = "development"

    def save(self):
        """Save configuration to disk."""
        CONFIG_DIR.mkdir(parents=True, exist_ok=True)

        # Save non-sensitive config
        config_data = {
            "api_url": self.api_url,
            "default_project": self.default_project,
            "default_environment": self.default_environment,
        }
        CONFIG_FILE.write_text(json.dumps(config_data, indent=2))
        CONFIG_FILE.chmod(0o600)

        # Save credentials separately
        creds_data = {
            "api_key": self.api_key,
            "refresh_token": self.refresh_token,
        }
        CREDENTIALS_FILE.write_text(json.dumps(creds_data, indent=2))
        CREDENTIALS_FILE.chmod(0o600)

    @classmethod
    def load(cls) -> "Config":
        """Load configuration from disk."""
        config = cls()

        # Load config
        if CONFIG_FILE.exists():
            try:
                data = json.loads(CONFIG_FILE.read_text())
                config.api_url = data.get("api_url", config.api_url)
                config.default_project = data.get("default_project")
                config.default_environment = data.get("default_environment", "development")
            except Exception:
                pass

        # Load credentials
        if CREDENTIALS_FILE.exists():
            try:
                data = json.loads(CREDENTIALS_FILE.read_text())
                config.api_key = data.get("api_key")
                config.refresh_token = data.get("refresh_token")
            except Exception:
                pass

        # Environment variable overrides
        if os.environ.get("ENVSYNC_API_URL"):
            config.api_url = os.environ["ENVSYNC_API_URL"]
        if os.environ.get("ENVSYNC_API_KEY"):
            config.api_key = os.environ["ENVSYNC_API_KEY"]

        return config


def get_config() -> Config:
    """Get the current configuration."""
    return Config.load()


def get_project_config() -> Optional[dict]:
    """Get project-specific config from .envsync file."""
    config_file = Path(".envsync")
    if not config_file.exists():
        return None

    config = {}
    for line in config_file.read_text().strip().split("\n"):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" in line:
            key, value = line.split("=", 1)
            config[key.strip()] = value.strip()

    return config
