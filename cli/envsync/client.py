"""
EnvSync API Client
HTTP client for communicating with EnvSync backend
"""
from typing import Any, Dict, List, Optional

import httpx


class EnvSyncError(Exception):
    """EnvSync API error."""

    def __init__(self, message: str, status_code: int = None):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class EnvSyncClient:
    """HTTP client for EnvSync API."""

    def __init__(self, api_url: str, api_key: str = None, timeout: float = 30.0):
        self.api_url = api_url.rstrip("/")
        self.api_key = api_key
        self.timeout = timeout

    def _headers(self) -> Dict[str, str]:
        """Get request headers."""
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "envsync-cli/1.0.0",
        }
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    def _request(
        self,
        method: str,
        path: str,
        json: Any = None,
        params: Dict[str, Any] = None,
    ) -> Any:
        """Make an HTTP request to the API."""
        url = f"{self.api_url}{path}"

        with httpx.Client(timeout=self.timeout) as client:
            response = client.request(
                method=method,
                url=url,
                headers=self._headers(),
                json=json,
                params=params,
            )

        if response.status_code >= 400:
            try:
                error = response.json()
                message = error.get("detail", str(error))
            except Exception:
                message = response.text or f"HTTP {response.status_code}"
            raise EnvSyncError(message, response.status_code)

        if response.status_code == 204:
            return None

        return response.json()

    # Authentication
    def login(self, email: str, password: str) -> Dict[str, Any]:
        """Authenticate and get tokens."""
        return self._request("POST", "/api/auth/login", json={
            "email": email,
            "password": password,
        })

    def refresh_token(self, refresh_token: str) -> Dict[str, Any]:
        """Refresh access token."""
        return self._request("POST", "/api/auth/refresh", json={
            "refresh_token": refresh_token,
        })

    def get_current_user(self) -> Dict[str, Any]:
        """Get current user info."""
        return self._request("GET", "/api/auth/me")

    # Projects
    def list_projects(self) -> Dict[str, Any]:
        """List all projects."""
        return self._request("GET", "/api/projects")

    def get_project(self, project_id: str) -> Dict[str, Any]:
        """Get project details."""
        return self._request("GET", f"/api/projects/{project_id}")

    def create_project(self, name: str, key_salt: str, **kwargs) -> Dict[str, Any]:
        """Create a new project."""
        return self._request("POST", "/api/projects", json={
            "name": name,
            "key_salt": key_salt,
            **kwargs,
        })

    # Environments
    def get_environments(self, project_id: str) -> List[Dict[str, Any]]:
        """List environments for a project."""
        return self._request("GET", f"/api/projects/{project_id}/environments")

    def create_environment(
        self, project_id: str, name: str, **kwargs
    ) -> Dict[str, Any]:
        """Create a new environment."""
        return self._request(
            "POST",
            f"/api/projects/{project_id}/environments",
            json={"name": name, **kwargs},
        )

    # Variables
    def get_variables(
        self, project_id: str, environment_id: str
    ) -> List[Dict[str, Any]]:
        """List variables in an environment."""
        return self._request(
            "GET",
            f"/api/projects/{project_id}/environments/{environment_id}/variables",
        )

    def create_variable(
        self,
        project_id: str,
        environment_id: str,
        key: str,
        encrypted_value: str,
        value_nonce: str,
        **kwargs,
    ) -> Dict[str, Any]:
        """Create a new variable."""
        return self._request(
            "POST",
            f"/api/projects/{project_id}/environments/{environment_id}/variables",
            json={
                "key": key,
                "encrypted_value": encrypted_value,
                "value_nonce": value_nonce,
                **kwargs,
            },
        )

    def create_variables_bulk(
        self,
        project_id: str,
        environment_id: str,
        variables: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """Create multiple variables at once."""
        return self._request(
            "POST",
            f"/api/projects/{project_id}/environments/{environment_id}/variables/bulk",
            json=variables,
        )

    def update_variable(
        self,
        project_id: str,
        environment_id: str,
        variable_id: str,
        **kwargs,
    ) -> Dict[str, Any]:
        """Update a variable."""
        return self._request(
            "PUT",
            f"/api/projects/{project_id}/environments/{environment_id}/variables/{variable_id}",
            json=kwargs,
        )

    def delete_variable(
        self, project_id: str, environment_id: str, variable_id: str
    ) -> None:
        """Delete a variable."""
        self._request(
            "DELETE",
            f"/api/projects/{project_id}/environments/{environment_id}/variables/{variable_id}",
        )

    # Sync
    def sync(self, project_ids: List[str] = None) -> Dict[str, Any]:
        """Sync projects with VeilCloud."""
        return self._request("POST", "/api/sync/sync", json={
            "project_ids": project_ids,
        })

    def get_sync_status(self) -> Dict[str, Any]:
        """Get VeilCloud sync status."""
        return self._request("GET", "/api/sync/status")

    # Search
    def search(self, query: str, **kwargs) -> Dict[str, Any]:
        """Search variables across projects."""
        return self._request("POST", "/api/projects/search", json={
            "query": query,
            **kwargs,
        })
