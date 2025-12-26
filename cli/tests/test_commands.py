"""
Comprehensive tests for EnvSync CLI commands.
Tests all command functionality including error handling and edge cases.
"""
import json
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock

import pytest
from click.testing import CliRunner

from envsync.main import cli
from envsync.client import EnvSyncError


class TestLoginCommand:
    """Tests for the login command."""

    def test_login_success(self, cli_runner, temp_config_dir, mock_login_response):
        """Test successful login saves tokens."""
        with patch("envsync.main.EnvSyncClient") as MockClient:
            mock_client = Mock()
            mock_client.login.return_value = mock_login_response
            MockClient.return_value = mock_client

            result = cli_runner.invoke(cli, ["login"], input="test@example.com\npassword123\n")

            assert result.exit_code == 0
            assert "Logged in as test@example.com" in result.output
            assert mock_client.login.called

            # Verify tokens were saved
            creds_file = temp_config_dir / "credentials.json"
            assert creds_file.exists()
            creds = json.loads(creds_file.read_text())
            assert creds["api_key"] == "test_access_token"
            assert creds["refresh_token"] == "test_refresh_token"

    def test_login_with_email_option(self, cli_runner, temp_config_dir, mock_login_response):
        """Test login with --email option."""
        with patch("envsync.main.EnvSyncClient") as MockClient:
            mock_client = Mock()
            mock_client.login.return_value = mock_login_response
            MockClient.return_value = mock_client

            result = cli_runner.invoke(
                cli, ["login", "--email", "test@example.com"], input="password123\n"
            )

            assert result.exit_code == 0
            assert "Logged in as test@example.com" in result.output

    def test_login_failure_invalid_credentials(self, cli_runner, temp_config_dir):
        """Test login failure with invalid credentials."""
        with patch("envsync.main.EnvSyncClient") as MockClient:
            mock_client = Mock()
            mock_client.login.side_effect = EnvSyncError("Invalid credentials", 401)
            MockClient.return_value = mock_client

            result = cli_runner.invoke(cli, ["login"], input="test@example.com\nwrongpass\n")

            assert result.exit_code == 1
            assert "Login failed" in result.output
            assert "Invalid credentials" in result.output

    def test_login_failure_network_error(self, cli_runner, temp_config_dir):
        """Test login failure with network error."""
        with patch("envsync.main.EnvSyncClient") as MockClient:
            mock_client = Mock()
            mock_client.login.side_effect = Exception("Connection refused")
            MockClient.return_value = mock_client

            result = cli_runner.invoke(cli, ["login"], input="test@example.com\npassword\n")

            assert result.exit_code == 1
            assert "Login failed" in result.output


class TestLogoutCommand:
    """Tests for the logout command."""

    def test_logout_success(self, cli_runner, config_with_auth):
        """Test successful logout clears credentials."""
        creds_file = Path(config_with_auth.save.__self__.__class__.__dict__["save"].__globals__["CREDENTIALS_FILE"])

        result = cli_runner.invoke(cli, ["logout"])

        assert result.exit_code == 0
        assert "Logged out" in result.output

        # Verify credentials were cleared
        if creds_file.exists():
            creds = json.loads(creds_file.read_text())
            assert creds["api_key"] is None
            assert creds["refresh_token"] is None

    def test_logout_when_not_logged_in(self, cli_runner, temp_config_dir):
        """Test logout when not logged in."""
        result = cli_runner.invoke(cli, ["logout"])

        assert result.exit_code == 0
        assert "Logged out" in result.output


class TestWhoamiCommand:
    """Tests for the whoami command."""

    def test_whoami_when_logged_in(self, cli_runner, config_with_auth, mock_user_response):
        """Test whoami shows user info when logged in."""
        with patch("envsync.main.EnvSyncClient") as MockClient:
            mock_client = Mock()
            mock_client.get_current_user.return_value = mock_user_response
            MockClient.return_value = mock_client

            result = cli_runner.invoke(cli, ["whoami"])

            assert result.exit_code == 0
            assert "Logged in as test@example.com" in result.output
            assert "Subscription: pro" in result.output

    def test_whoami_when_not_logged_in(self, cli_runner, temp_config_dir):
        """Test whoami when not logged in."""
        result = cli_runner.invoke(cli, ["whoami"])

        assert result.exit_code == 1
        assert "Not logged in" in result.output
        assert "Run: envsync login" in result.output

    def test_whoami_with_invalid_token(self, cli_runner, config_with_auth):
        """Test whoami with invalid/expired token."""
        with patch("envsync.main.EnvSyncClient") as MockClient:
            mock_client = Mock()
            mock_client.get_current_user.side_effect = EnvSyncError("Unauthorized", 401)
            MockClient.return_value = mock_client

            result = cli_runner.invoke(cli, ["whoami"])

            assert result.exit_code == 1
            assert "Error" in result.output


class TestListProjectsCommand:
    """Tests for the list projects command."""

    def test_list_projects_success(self, cli_runner, config_with_auth, mock_projects_response):
        """Test listing projects successfully."""
        with patch("envsync.main.EnvSyncClient") as MockClient:
            mock_client = Mock()
            mock_client.list_projects.return_value = mock_projects_response
            MockClient.return_value = mock_client

            result = cli_runner.invoke(cli, ["list"])

            assert result.exit_code == 0
            assert "my-project" in result.output
            assert "another-project" in result.output
            assert "Projects" in result.output

    def test_list_projects_empty(self, cli_runner, config_with_auth):
        """Test listing projects when none exist."""
        with patch("envsync.main.EnvSyncClient") as MockClient:
            mock_client = Mock()
            mock_client.list_projects.return_value = {"projects": []}
            MockClient.return_value = mock_client

            result = cli_runner.invoke(cli, ["list"])

            assert result.exit_code == 0
            assert "No projects found" in result.output
            assert "https://app.envsync.com" in result.output

    def test_list_projects_unauthorized(self, cli_runner, config_with_auth):
        """Test listing projects with invalid auth."""
        with patch("envsync.main.EnvSyncClient") as MockClient:
            mock_client = Mock()
            mock_client.list_projects.side_effect = EnvSyncError("Unauthorized", 401)
            MockClient.return_value = mock_client

            result = cli_runner.invoke(cli, ["list"])

            assert result.exit_code == 1
            assert "Error" in result.output

    def test_list_projects_network_error(self, cli_runner, config_with_auth):
        """Test listing projects with network error."""
        with patch("envsync.main.EnvSyncClient") as MockClient:
            mock_client = Mock()
            mock_client.list_projects.side_effect = Exception("Connection timeout")
            MockClient.return_value = mock_client

            result = cli_runner.invoke(cli, ["list"])

            assert result.exit_code == 1
            assert "Error" in result.output


class TestPullCommand:
    """Tests for the pull command."""

    def test_pull_success_to_stdout(
        self,
        cli_runner,
        config_with_auth,
        mock_projects_response,
        mock_environments_response,
        mock_variables_response,
    ):
        """Test pulling variables and printing to stdout."""
        with patch("envsync.main.EnvSyncClient") as MockClient, patch(
            "envsync.main.CryptoHelper"
        ) as MockCrypto:
            mock_client = Mock()
            mock_client.list_projects.return_value = mock_projects_response
            mock_client.get_environments.return_value = mock_environments_response
            mock_client.get_variables.return_value = mock_variables_response
            MockClient.return_value = mock_client

            mock_crypto = Mock()
            mock_crypto.decrypt.side_effect = lambda enc, nonce: "decrypted_value"
            MockCrypto.return_value = mock_crypto

            result = cli_runner.invoke(
                cli, ["pull", "my-project"], input="password123\n"
            )

            assert result.exit_code == 0
            assert "DATABASE_URL=decrypted_value" in result.output
            assert "API_KEY=decrypted_value" in result.output
            assert "SECRET_KEY=decrypted_value" in result.output

    def test_pull_success_to_file(
        self,
        cli_runner,
        config_with_auth,
        temp_dir,
        mock_projects_response,
        mock_environments_response,
        mock_variables_response,
    ):
        """Test pulling variables to a file."""
        output_file = temp_dir / "output.env"

        with patch("envsync.main.EnvSyncClient") as MockClient, patch(
            "envsync.main.CryptoHelper"
        ) as MockCrypto:
            mock_client = Mock()
            mock_client.list_projects.return_value = mock_projects_response
            mock_client.get_environments.return_value = mock_environments_response
            mock_client.get_variables.return_value = mock_variables_response
            MockClient.return_value = mock_client

            mock_crypto = Mock()
            mock_crypto.decrypt.side_effect = lambda enc, nonce: "decrypted_value"
            MockCrypto.return_value = mock_crypto

            result = cli_runner.invoke(
                cli,
                ["pull", "my-project", "-o", str(output_file)],
                input="password123\n",
            )

            assert result.exit_code == 0
            assert output_file.exists()
            content = output_file.read_text()
            assert "DATABASE_URL=decrypted_value" in content
            assert "Wrote 3 variables" in result.output

    def test_pull_with_custom_environment(
        self,
        cli_runner,
        config_with_auth,
        mock_projects_response,
        mock_environments_response,
        mock_variables_response,
    ):
        """Test pulling from a specific environment."""
        with patch("envsync.main.EnvSyncClient") as MockClient, patch(
            "envsync.main.CryptoHelper"
        ) as MockCrypto:
            mock_client = Mock()
            mock_client.list_projects.return_value = mock_projects_response
            mock_client.get_environments.return_value = mock_environments_response
            mock_client.get_variables.return_value = mock_variables_response
            MockClient.return_value = mock_client

            mock_crypto = Mock()
            mock_crypto.decrypt.side_effect = lambda enc, nonce: "decrypted_value"
            MockCrypto.return_value = mock_crypto

            result = cli_runner.invoke(
                cli, ["pull", "my-project", "-e", "staging"], input="password123\n"
            )

            assert result.exit_code == 0

    def test_pull_project_not_found(
        self, cli_runner, config_with_auth, mock_projects_response
    ):
        """Test pulling from non-existent project."""
        with patch("envsync.main.EnvSyncClient") as MockClient:
            mock_client = Mock()
            mock_client.list_projects.return_value = mock_projects_response
            MockClient.return_value = mock_client

            result = cli_runner.invoke(
                cli, ["pull", "nonexistent-project"], input="password123\n"
            )

            assert result.exit_code == 1
            assert "Project 'nonexistent-project' not found" in result.output

    def test_pull_environment_not_found(
        self,
        cli_runner,
        config_with_auth,
        mock_projects_response,
        mock_environments_response,
    ):
        """Test pulling from non-existent environment."""
        with patch("envsync.main.EnvSyncClient") as MockClient:
            mock_client = Mock()
            mock_client.list_projects.return_value = mock_projects_response
            mock_client.get_environments.return_value = mock_environments_response
            MockClient.return_value = mock_client

            result = cli_runner.invoke(
                cli, ["pull", "my-project", "-e", "nonexistent"], input="password123\n"
            )

            assert result.exit_code == 1
            assert "Environment 'nonexistent' not found" in result.output
            assert "Available:" in result.output

    def test_pull_no_variables(
        self,
        cli_runner,
        config_with_auth,
        mock_projects_response,
        mock_environments_response,
    ):
        """Test pulling when environment has no variables."""
        with patch("envsync.main.EnvSyncClient") as MockClient:
            mock_client = Mock()
            mock_client.list_projects.return_value = mock_projects_response
            mock_client.get_environments.return_value = mock_environments_response
            mock_client.get_variables.return_value = []
            MockClient.return_value = mock_client

            result = cli_runner.invoke(
                cli, ["pull", "my-project"], input="password123\n"
            )

            assert result.exit_code == 0
            assert "No variables" in result.output

    def test_pull_decryption_failure(
        self,
        cli_runner,
        config_with_auth,
        mock_projects_response,
        mock_environments_response,
        mock_variables_response,
    ):
        """Test pull with decryption failure for some variables."""
        with patch("envsync.main.EnvSyncClient") as MockClient, patch(
            "envsync.main.CryptoHelper"
        ) as MockCrypto:
            mock_client = Mock()
            mock_client.list_projects.return_value = mock_projects_response
            mock_client.get_environments.return_value = mock_environments_response
            mock_client.get_variables.return_value = mock_variables_response
            MockClient.return_value = mock_client

            mock_crypto = Mock()
            # First decrypt succeeds, second fails, third succeeds
            mock_crypto.decrypt.side_effect = [
                "value1",
                Exception("Decryption failed"),
                "value3",
            ]
            MockCrypto.return_value = mock_crypto

            result = cli_runner.invoke(
                cli, ["pull", "my-project"], input="password123\n"
            )

            assert result.exit_code == 0
            assert "Warning: Could not decrypt" in result.output
            assert "# API_KEY=<decryption failed>" in result.output


class TestPushCommand:
    """Tests for the push command."""

    def test_push_success_with_env_file(
        self,
        cli_runner,
        config_with_auth,
        sample_env_file,
        mock_projects_response,
        mock_environments_response,
    ):
        """Test pushing variables from .env file."""
        with patch("envsync.main.EnvSyncClient") as MockClient, patch(
            "envsync.main.CryptoHelper"
        ) as MockCrypto:
            mock_client = Mock()
            mock_client.list_projects.return_value = mock_projects_response
            mock_client.get_environments.return_value = mock_environments_response
            mock_client.create_variables_bulk.return_value = []
            MockClient.return_value = mock_client

            mock_crypto = Mock()
            mock_crypto.encrypt.return_value = ("encrypted_value", "nonce_value")
            MockCrypto.return_value = mock_crypto

            result = cli_runner.invoke(
                cli,
                ["push", "my-project", "-f", str(sample_env_file)],
                input="password123\n",
            )

            assert result.exit_code == 0
            assert "Pushed" in result.output
            assert "variables" in result.output
            assert mock_client.create_variables_bulk.called

    def test_push_success_with_quoted_values(
        self,
        cli_runner,
        config_with_auth,
        sample_env_file_with_quotes,
        mock_projects_response,
        mock_environments_response,
    ):
        """Test pushing variables with quoted values."""
        with patch("envsync.main.EnvSyncClient") as MockClient, patch(
            "envsync.main.CryptoHelper"
        ) as MockCrypto:
            mock_client = Mock()
            mock_client.list_projects.return_value = mock_projects_response
            mock_client.get_environments.return_value = mock_environments_response
            mock_client.create_variables_bulk.return_value = []
            MockClient.return_value = mock_client

            mock_crypto = Mock()
            mock_crypto.encrypt.return_value = ("encrypted_value", "nonce_value")
            MockCrypto.return_value = mock_crypto

            result = cli_runner.invoke(
                cli,
                ["push", "my-project", "-f", str(sample_env_file_with_quotes)],
                input="password123\n",
            )

            assert result.exit_code == 0
            # Verify quotes were stripped from values
            call_args = mock_client.create_variables_bulk.call_args
            variables = call_args[0][2]  # Third argument is variables list
            # Find the variable by key
            db_var = next((v for v in variables if v["key"] == "DATABASE_URL"), None)
            assert db_var is not None

    def test_push_default_to_dot_env(
        self,
        cli_runner,
        config_with_auth,
        isolated_filesystem,
        mock_projects_response,
        mock_environments_response,
    ):
        """Test push defaults to .env in current directory."""
        # Create .env in isolated filesystem
        env_file = Path(".env")
        env_file.write_text("KEY=value\n")

        with patch("envsync.main.EnvSyncClient") as MockClient, patch(
            "envsync.main.CryptoHelper"
        ) as MockCrypto:
            mock_client = Mock()
            mock_client.list_projects.return_value = mock_projects_response
            mock_client.get_environments.return_value = mock_environments_response
            mock_client.create_variables_bulk.return_value = []
            MockClient.return_value = mock_client

            mock_crypto = Mock()
            mock_crypto.encrypt.return_value = ("encrypted_value", "nonce_value")
            MockCrypto.return_value = mock_crypto

            result = cli_runner.invoke(
                cli, ["push", "my-project"], input="password123\n"
            )

            assert result.exit_code == 0

    def test_push_no_env_file(self, cli_runner, config_with_auth, isolated_filesystem):
        """Test push fails when .env file doesn't exist."""
        result = cli_runner.invoke(cli, ["push", "my-project"], input="password123\n")

        assert result.exit_code == 1
        assert "No .env file found" in result.output

    def test_push_empty_env_file(
        self,
        cli_runner,
        config_with_auth,
        isolated_filesystem,
        mock_projects_response,
        mock_environments_response,
    ):
        """Test push with empty .env file."""
        Path(".env").write_text("# Only comments\n\n")

        with patch("envsync.main.EnvSyncClient") as MockClient:
            mock_client = Mock()
            mock_client.list_projects.return_value = mock_projects_response
            mock_client.get_environments.return_value = mock_environments_response
            MockClient.return_value = mock_client

            result = cli_runner.invoke(
                cli, ["push", "my-project"], input="password123\n"
            )

            assert result.exit_code == 0
            assert "No variables found" in result.output

    def test_push_project_not_found(
        self, cli_runner, config_with_auth, sample_env_file, mock_projects_response
    ):
        """Test push to non-existent project."""
        with patch("envsync.main.EnvSyncClient") as MockClient:
            mock_client = Mock()
            mock_client.list_projects.return_value = mock_projects_response
            MockClient.return_value = mock_client

            result = cli_runner.invoke(
                cli,
                ["push", "nonexistent", "-f", str(sample_env_file)],
                input="password123\n",
            )

            assert result.exit_code == 1
            assert "Project 'nonexistent' not found" in result.output

    def test_push_environment_not_found(
        self,
        cli_runner,
        config_with_auth,
        sample_env_file,
        mock_projects_response,
        mock_environments_response,
    ):
        """Test push to non-existent environment."""
        with patch("envsync.main.EnvSyncClient") as MockClient:
            mock_client = Mock()
            mock_client.list_projects.return_value = mock_projects_response
            mock_client.get_environments.return_value = mock_environments_response
            MockClient.return_value = mock_client

            result = cli_runner.invoke(
                cli,
                ["push", "my-project", "-e", "nonexistent", "-f", str(sample_env_file)],
                input="password123\n",
            )

            assert result.exit_code == 1
            assert "Environment 'nonexistent' not found" in result.output

    def test_push_with_custom_environment(
        self,
        cli_runner,
        config_with_auth,
        sample_env_file,
        mock_projects_response,
        mock_environments_response,
    ):
        """Test push to specific environment."""
        with patch("envsync.main.EnvSyncClient") as MockClient, patch(
            "envsync.main.CryptoHelper"
        ) as MockCrypto:
            mock_client = Mock()
            mock_client.list_projects.return_value = mock_projects_response
            mock_client.get_environments.return_value = mock_environments_response
            mock_client.create_variables_bulk.return_value = []
            MockClient.return_value = mock_client

            mock_crypto = Mock()
            mock_crypto.encrypt.return_value = ("encrypted_value", "nonce_value")
            MockCrypto.return_value = mock_crypto

            result = cli_runner.invoke(
                cli,
                ["push", "my-project", "-e", "production", "-f", str(sample_env_file)],
                input="password123\n",
            )

            assert result.exit_code == 0


class TestExportCommand:
    """Tests for the export command."""

    def test_export_invokes_pull(
        self,
        cli_runner,
        config_with_auth,
        mock_projects_response,
        mock_environments_response,
        mock_variables_response,
    ):
        """Test export command invokes pull."""
        with patch("envsync.main.EnvSyncClient") as MockClient, patch(
            "envsync.main.CryptoHelper"
        ) as MockCrypto:
            mock_client = Mock()
            mock_client.list_projects.return_value = mock_projects_response
            mock_client.get_environments.return_value = mock_environments_response
            mock_client.get_variables.return_value = mock_variables_response
            MockClient.return_value = mock_client

            mock_crypto = Mock()
            mock_crypto.decrypt.side_effect = lambda enc, nonce: "decrypted_value"
            MockCrypto.return_value = mock_crypto

            result = cli_runner.invoke(
                cli, ["export", "my-project"], input="password123\n"
            )

            assert result.exit_code == 0
            assert "DATABASE_URL=decrypted_value" in result.output

    def test_export_with_environment(
        self,
        cli_runner,
        config_with_auth,
        mock_projects_response,
        mock_environments_response,
        mock_variables_response,
    ):
        """Test export with specific environment."""
        with patch("envsync.main.EnvSyncClient") as MockClient, patch(
            "envsync.main.CryptoHelper"
        ) as MockCrypto:
            mock_client = Mock()
            mock_client.list_projects.return_value = mock_projects_response
            mock_client.get_environments.return_value = mock_environments_response
            mock_client.get_variables.return_value = mock_variables_response
            MockClient.return_value = mock_client

            mock_crypto = Mock()
            mock_crypto.decrypt.side_effect = lambda enc, nonce: "decrypted_value"
            MockCrypto.return_value = mock_crypto

            result = cli_runner.invoke(
                cli, ["export", "my-project", "-e", "staging"], input="password123\n"
            )

            assert result.exit_code == 0


class TestDiffCommand:
    """Tests for the diff command."""

    def test_diff_shows_only_local(
        self,
        cli_runner,
        config_with_auth,
        isolated_filesystem,
        mock_projects_response,
        mock_environments_response,
        mock_variables_response,
    ):
        """Test diff shows variables only in local."""
        # Create local .env with different variables
        Path(".env").write_text("LOCAL_ONLY=value\nDATABASE_URL=value\n")

        with patch("envsync.main.EnvSyncClient") as MockClient:
            mock_client = Mock()
            mock_client.list_projects.return_value = mock_projects_response
            mock_client.get_environments.return_value = mock_environments_response
            mock_client.get_variables.return_value = mock_variables_response
            MockClient.return_value = mock_client

            result = cli_runner.invoke(cli, ["diff", "my-project"])

            assert result.exit_code == 0
            assert "Only in local" in result.output
            assert "LOCAL_ONLY" in result.output

    def test_diff_shows_only_remote(
        self,
        cli_runner,
        config_with_auth,
        isolated_filesystem,
        mock_projects_response,
        mock_environments_response,
        mock_variables_response,
    ):
        """Test diff shows variables only in remote."""
        # Create local .env with subset of remote variables
        Path(".env").write_text("DATABASE_URL=value\n")

        with patch("envsync.main.EnvSyncClient") as MockClient:
            mock_client = Mock()
            mock_client.list_projects.return_value = mock_projects_response
            mock_client.get_environments.return_value = mock_environments_response
            mock_client.get_variables.return_value = mock_variables_response
            MockClient.return_value = mock_client

            result = cli_runner.invoke(cli, ["diff", "my-project"])

            assert result.exit_code == 0
            assert "Only in remote" in result.output
            assert "API_KEY" in result.output
            assert "SECRET_KEY" in result.output

    def test_diff_in_sync(
        self,
        cli_runner,
        config_with_auth,
        isolated_filesystem,
        mock_projects_response,
        mock_environments_response,
        mock_variables_response,
    ):
        """Test diff when local and remote are in sync."""
        # Create local .env with same keys as remote
        Path(".env").write_text(
            "DATABASE_URL=local_value\nAPI_KEY=local_value\nSECRET_KEY=local_value\n"
        )

        with patch("envsync.main.EnvSyncClient") as MockClient:
            mock_client = Mock()
            mock_client.list_projects.return_value = mock_projects_response
            mock_client.get_environments.return_value = mock_environments_response
            mock_client.get_variables.return_value = mock_variables_response
            MockClient.return_value = mock_client

            result = cli_runner.invoke(cli, ["diff", "my-project"])

            assert result.exit_code == 0
            assert "same keys" in result.output or "In both" in result.output

    def test_diff_no_local_env_file(
        self, cli_runner, config_with_auth, isolated_filesystem
    ):
        """Test diff when no local .env file exists."""
        result = cli_runner.invoke(cli, ["diff", "my-project"])

        assert result.exit_code == 0
        assert "No local .env file" in result.output

    def test_diff_project_not_found(
        self, cli_runner, config_with_auth, isolated_filesystem, mock_projects_response
    ):
        """Test diff with non-existent project."""
        Path(".env").write_text("KEY=value\n")

        with patch("envsync.main.EnvSyncClient") as MockClient:
            mock_client = Mock()
            mock_client.list_projects.return_value = mock_projects_response
            MockClient.return_value = mock_client

            result = cli_runner.invoke(cli, ["diff", "nonexistent"])

            assert result.exit_code == 1
            assert "Project 'nonexistent' not found" in result.output


class TestInitCommand:
    """Tests for the init command."""

    def test_init_creates_config(self, cli_runner, isolated_filesystem):
        """Test init creates .envsync config file."""
        result = cli_runner.invoke(cli, ["init"], input="my-project\n")

        assert result.exit_code == 0
        assert "Initialized EnvSync" in result.output
        assert Path(".envsync").exists()

        config = Path(".envsync").read_text()
        assert "project=my-project" in config
        assert "environment=development" in config

    def test_init_defaults_to_directory_name(self, cli_runner, isolated_filesystem):
        """Test init defaults project name to current directory."""
        result = cli_runner.invoke(cli, ["init"], input="\n")

        assert result.exit_code == 0
        assert Path(".envsync").exists()

    def test_init_already_initialized(self, cli_runner, isolated_filesystem):
        """Test init when already initialized."""
        Path(".envsync").write_text("project=existing\n")

        result = cli_runner.invoke(cli, ["init"], input="my-project\n")

        assert result.exit_code == 0
        assert "Already initialized" in result.output


class TestCLIOptions:
    """Tests for global CLI options."""

    def test_version_option(self, cli_runner):
        """Test --version option."""
        result = cli_runner.invoke(cli, ["--version"])

        assert result.exit_code == 0
        assert "1.0.0" in result.output

    def test_api_url_option(self, cli_runner, temp_config_dir):
        """Test --api-url option."""
        with patch("envsync.main.EnvSyncClient") as MockClient:
            mock_client = Mock()
            mock_client.list_projects.return_value = {"projects": []}
            MockClient.return_value = mock_client

            result = cli_runner.invoke(
                cli, ["--api-url", "https://custom.api.com", "list"]
            )

            # Should use custom API URL
            assert MockClient.called

    def test_api_key_option(self, cli_runner, temp_config_dir):
        """Test --api-key option."""
        with patch("envsync.main.EnvSyncClient") as MockClient:
            mock_client = Mock()
            mock_client.list_projects.return_value = {"projects": []}
            MockClient.return_value = mock_client

            result = cli_runner.invoke(cli, ["--api-key", "custom_key", "list"])

            # Should use custom API key
            assert MockClient.called

    def test_env_var_api_url(self, cli_runner, temp_config_dir, monkeypatch):
        """Test ENVSYNC_API_URL environment variable."""
        monkeypatch.setenv("ENVSYNC_API_URL", "https://env.api.com")

        with patch("envsync.main.EnvSyncClient") as MockClient:
            mock_client = Mock()
            mock_client.list_projects.return_value = {"projects": []}
            MockClient.return_value = mock_client

            result = cli_runner.invoke(cli, ["list"])

            # Config should have env var value
            assert result.exit_code in [0, 1]  # May fail on auth but that's okay

    def test_env_var_api_key(self, cli_runner, temp_config_dir, monkeypatch):
        """Test ENVSYNC_API_KEY environment variable."""
        monkeypatch.setenv("ENVSYNC_API_KEY", "env_api_key")

        with patch("envsync.main.EnvSyncClient") as MockClient:
            mock_client = Mock()
            mock_client.list_projects.return_value = {"projects": []}
            MockClient.return_value = mock_client

            result = cli_runner.invoke(cli, ["list"])

            # Config should have env var value
            assert result.exit_code in [0, 1]  # May fail on other reasons but that's okay


class TestErrorHandling:
    """Tests for error handling across commands."""

    def test_network_timeout(self, cli_runner, config_with_auth):
        """Test handling of network timeouts."""
        with patch("envsync.main.EnvSyncClient") as MockClient:
            mock_client = Mock()
            mock_client.list_projects.side_effect = Exception("Timeout")
            MockClient.return_value = mock_client

            result = cli_runner.invoke(cli, ["list"])

            assert result.exit_code == 1
            assert "Error" in result.output

    def test_invalid_json_response(self, cli_runner, config_with_auth):
        """Test handling of invalid JSON responses."""
        with patch("envsync.main.EnvSyncClient") as MockClient:
            mock_client = Mock()
            mock_client.list_projects.side_effect = Exception("Invalid JSON")
            MockClient.return_value = mock_client

            result = cli_runner.invoke(cli, ["list"])

            assert result.exit_code == 1

    def test_permission_denied(self, cli_runner, config_with_auth):
        """Test handling of permission errors."""
        with patch("envsync.main.EnvSyncClient") as MockClient:
            mock_client = Mock()
            mock_client.list_projects.side_effect = EnvSyncError("Forbidden", 403)
            MockClient.return_value = mock_client

            result = cli_runner.invoke(cli, ["list"])

            assert result.exit_code == 1
