"""
EnvSync CLI Main Entry Point
"""
import os
import sys
from pathlib import Path

import click
from rich.console import Console
from rich.table import Table

from envsync import __version__
from envsync.config import Config, get_config
from envsync.client import EnvSyncClient
from envsync.crypto import CryptoHelper

console = Console()


@click.group()
@click.version_option(version=__version__, prog_name="envsync")
@click.option("--api-url", envvar="ENVSYNC_API_URL", help="EnvSync API URL")
@click.option("--api-key", envvar="ENVSYNC_API_KEY", help="EnvSync API key")
@click.pass_context
def cli(ctx, api_url: str, api_key: str):
    """
    EnvSync - Zero-knowledge .env manager

    Sync secrets. Not trust.

    \b
    Examples:
        envsync login
        envsync pull my-project
        envsync push my-project
        envsync export my-project > .env
    """
    ctx.ensure_object(dict)
    ctx.obj["config"] = get_config()

    if api_url:
        ctx.obj["config"].api_url = api_url
    if api_key:
        ctx.obj["config"].api_key = api_key


@cli.command()
@click.option("--email", prompt="Email", help="Your email address")
@click.option("--password", prompt=True, hide_input=True, help="Your password")
@click.pass_context
def login(ctx, email: str, password: str):
    """Authenticate with EnvSync."""
    config = ctx.obj["config"]

    try:
        client = EnvSyncClient(config.api_url)
        result = client.login(email, password)

        # Save tokens
        config.api_key = result["access_token"]
        config.refresh_token = result["refresh_token"]
        config.save()

        console.print(f"[green]✓[/green] Logged in as {email}")
    except Exception as e:
        console.print(f"[red]✗[/red] Login failed: {e}")
        sys.exit(1)


@cli.command()
@click.pass_context
def logout(ctx):
    """Log out and clear credentials."""
    config = ctx.obj["config"]
    config.api_key = None
    config.refresh_token = None
    config.save()
    console.print("[green]✓[/green] Logged out")


@cli.command()
@click.pass_context
def whoami(ctx):
    """Show current user info."""
    config = ctx.obj["config"]

    if not config.api_key:
        console.print("[yellow]Not logged in[/yellow]")
        console.print("Run: envsync login")
        sys.exit(1)

    try:
        client = EnvSyncClient(config.api_url, config.api_key)
        user = client.get_current_user()
        console.print(f"[green]✓[/green] Logged in as {user['email']}")
        console.print(f"   Subscription: {user['subscription_tier']}")
    except Exception as e:
        console.print(f"[red]✗[/red] Error: {e}")
        sys.exit(1)


@cli.command("list")
@click.pass_context
def list_projects(ctx):
    """List all projects."""
    config = ctx.obj["config"]
    client = EnvSyncClient(config.api_url, config.api_key)

    try:
        result = client.list_projects()
        projects = result["projects"]

        if not projects:
            console.print("[yellow]No projects found[/yellow]")
            console.print("Create one at https://app.envsync.com")
            return

        table = Table(title="Projects")
        table.add_column("Name", style="cyan")
        table.add_column("Environments", justify="right")
        table.add_column("Variables", justify="right")
        table.add_column("Last Synced")

        for project in projects:
            table.add_row(
                project["name"],
                str(project.get("environment_count", 0)),
                str(project.get("variable_count", 0)),
                project.get("last_synced_at", "-") or "-",
            )

        console.print(table)
    except Exception as e:
        console.print(f"[red]✗[/red] Error: {e}")
        sys.exit(1)


@cli.command()
@click.argument("project")
@click.option("-e", "--env", default="development", help="Environment name")
@click.option("-o", "--output", type=click.Path(), help="Output file path")
@click.option("--password", prompt=True, hide_input=True, help="Decryption password")
@click.pass_context
def pull(ctx, project: str, env: str, output: str, password: str):
    """Pull environment variables from EnvSync."""
    config = ctx.obj["config"]
    client = EnvSyncClient(config.api_url, config.api_key)

    try:
        # Get project
        projects = client.list_projects()["projects"]
        proj = next((p for p in projects if p["name"] == project), None)

        if not proj:
            console.print(f"[red]✗[/red] Project '{project}' not found")
            sys.exit(1)

        # Get environment
        environments = client.get_environments(proj["id"])
        environment = next((e for e in environments if e["name"] == env), None)

        if not environment:
            console.print(f"[red]✗[/red] Environment '{env}' not found")
            console.print(f"Available: {', '.join(e['name'] for e in environments)}")
            sys.exit(1)

        # Get variables
        variables = client.get_variables(proj["id"], environment["id"])

        if not variables:
            console.print(f"[yellow]No variables in {project}/{env}[/yellow]")
            return

        # Decrypt variables
        crypto = CryptoHelper(password)
        lines = []

        for var in variables:
            try:
                decrypted = crypto.decrypt(var["encrypted_value"], var["value_nonce"])
                lines.append(f"{var['key']}={decrypted}")
            except Exception:
                console.print(f"[yellow]Warning: Could not decrypt {var['key']}[/yellow]")
                lines.append(f"# {var['key']}=<decryption failed>")

        content = "\n".join(lines)

        if output:
            Path(output).write_text(content)
            console.print(f"[green]✓[/green] Wrote {len(variables)} variables to {output}")
        else:
            console.print(content)

    except Exception as e:
        console.print(f"[red]✗[/red] Error: {e}")
        sys.exit(1)


@cli.command()
@click.argument("project")
@click.option("-e", "--env", default="development", help="Environment name")
@click.option("-f", "--file", type=click.Path(exists=True), help="Input .env file")
@click.option("--password", prompt=True, hide_input=True, help="Encryption password")
@click.pass_context
def push(ctx, project: str, env: str, file: str, password: str):
    """Push environment variables to EnvSync."""
    config = ctx.obj["config"]
    client = EnvSyncClient(config.api_url, config.api_key)

    # Default to .env in current directory
    if not file:
        file = ".env"
        if not Path(file).exists():
            console.print(f"[red]✗[/red] No .env file found")
            sys.exit(1)

    try:
        # Parse .env file
        variables = []
        content = Path(file).read_text()

        for line in content.strip().split("\n"):
            line = line.strip()
            if not line or line.startswith("#"):
                continue

            if "=" not in line:
                continue

            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip()

            # Remove quotes
            if value.startswith('"') and value.endswith('"'):
                value = value[1:-1]
            elif value.startswith("'") and value.endswith("'"):
                value = value[1:-1]

            variables.append({"key": key, "value": value})

        if not variables:
            console.print("[yellow]No variables found in file[/yellow]")
            return

        # Get project
        projects = client.list_projects()["projects"]
        proj = next((p for p in projects if p["name"] == project), None)

        if not proj:
            console.print(f"[red]✗[/red] Project '{project}' not found")
            sys.exit(1)

        # Get environment
        environments = client.get_environments(proj["id"])
        environment = next((e for e in environments if e["name"] == env), None)

        if not environment:
            console.print(f"[red]✗[/red] Environment '{env}' not found")
            sys.exit(1)

        # Encrypt and push variables
        crypto = CryptoHelper(password)
        encrypted_vars = []

        for var in variables:
            encrypted, nonce = crypto.encrypt(var["value"])
            encrypted_vars.append({
                "key": var["key"],
                "encrypted_value": encrypted,
                "value_nonce": nonce,
            })

        # Bulk create
        client.create_variables_bulk(proj["id"], environment["id"], encrypted_vars)

        console.print(f"[green]✓[/green] Pushed {len(variables)} variables to {project}/{env}")

    except Exception as e:
        console.print(f"[red]✗[/red] Error: {e}")
        sys.exit(1)


@cli.command()
@click.argument("project")
@click.option("-e", "--env", default="development", help="Environment name")
@click.option("--password", prompt=True, hide_input=True, help="Decryption password")
@click.pass_context
def export(ctx, project: str, env: str, password: str):
    """Export variables as .env format to stdout."""
    ctx.invoke(pull, project=project, env=env, output=None, password=password)


@cli.command()
@click.argument("project")
@click.option("--env", "-e", default="development", help="Environment name")
@click.pass_context
def diff(ctx, project: str, env: str):
    """Show diff between local .env and remote."""
    config = ctx.obj["config"]
    client = EnvSyncClient(config.api_url, config.api_key)

    local_file = Path(".env")
    if not local_file.exists():
        console.print("[yellow]No local .env file[/yellow]")
        return

    try:
        # Get project and environment
        projects = client.list_projects()["projects"]
        proj = next((p for p in projects if p["name"] == project), None)

        if not proj:
            console.print(f"[red]✗[/red] Project '{project}' not found")
            sys.exit(1)

        environments = client.get_environments(proj["id"])
        environment = next((e for e in environments if e["name"] == env), None)

        if not environment:
            console.print(f"[red]✗[/red] Environment '{env}' not found")
            sys.exit(1)

        # Get remote variables (keys only, since we can't decrypt without password)
        variables = client.get_variables(proj["id"], environment["id"])
        remote_keys = {v["key"] for v in variables}

        # Parse local file
        local_keys = set()
        for line in local_file.read_text().strip().split("\n"):
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                key = line.split("=", 1)[0].strip()
                local_keys.add(key)

        # Compare
        only_local = local_keys - remote_keys
        only_remote = remote_keys - local_keys
        both = local_keys & remote_keys

        if only_local:
            console.print("\n[yellow]Only in local:[/yellow]")
            for key in sorted(only_local):
                console.print(f"  + {key}")

        if only_remote:
            console.print("\n[cyan]Only in remote:[/cyan]")
            for key in sorted(only_remote):
                console.print(f"  - {key}")

        if both:
            console.print(f"\n[green]In both ({len(both)} variables)[/green]")

        if not only_local and not only_remote:
            console.print("[green]✓[/green] Local and remote have same keys")

    except Exception as e:
        console.print(f"[red]✗[/red] Error: {e}")
        sys.exit(1)


@cli.command()
@click.pass_context
def init(ctx):
    """Initialize EnvSync in current directory."""
    config_file = Path(".envsync")

    if config_file.exists():
        console.print("[yellow]Already initialized[/yellow]")
        return

    project = click.prompt("Project name", default=Path.cwd().name)

    config_file.write_text(f"""# EnvSync Configuration
project={project}
environment=development
""")

    console.print(f"[green]✓[/green] Initialized EnvSync for '{project}'")
    console.print(f"   Config saved to .envsync")


def main():
    """CLI entry point."""
    cli(obj={})


if __name__ == "__main__":
    main()
