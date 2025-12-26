# EnvSync CLI

Zero-knowledge .env manager for the command line.

## Installation

```bash
pip install envsync-cli
```

Or with pipx (recommended):

```bash
pipx install envsync-cli
```

## Quick Start

```bash
# Login to your EnvSync account
envsync login

# List your projects
envsync list

# Pull environment variables
envsync pull my-project --env production --password

# Push local .env to EnvSync
envsync push my-project --env development --password

# Export to stdout (for piping)
envsync export my-project --env staging --password > .env.staging
```

## Commands

| Command | Description |
|---------|-------------|
| `login` | Authenticate with EnvSync |
| `logout` | Clear stored credentials |
| `whoami` | Show current user info |
| `list` | List all projects |
| `pull` | Pull variables from EnvSync |
| `push` | Push local .env to EnvSync |
| `export` | Export variables to stdout |
| `diff` | Compare local and remote keys |
| `init` | Initialize EnvSync in current directory |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ENVSYNC_API_URL` | Custom API URL (default: https://api.envsync.com) |
| `ENVSYNC_API_KEY` | API key for authentication |

## CI/CD Integration

### GitHub Actions

```yaml
- name: Setup EnvSync
  run: pip install envsync-cli

- name: Pull production secrets
  run: envsync pull my-project --env production --password ${{ secrets.ENVSYNC_PASSWORD }}
  env:
    ENVSYNC_API_KEY: ${{ secrets.ENVSYNC_API_KEY }}
```

### GitLab CI

```yaml
pull_secrets:
  script:
    - pip install envsync-cli
    - envsync pull my-project --env production --password $ENVSYNC_PASSWORD
  variables:
    ENVSYNC_API_KEY: $ENVSYNC_API_KEY
```

## Security

- All encryption happens client-side using AES-256-GCM
- Your password never leaves your machine
- Keys are derived using PBKDF2-HMAC-SHA256 (100,000 iterations)
- The EnvSync server only sees encrypted blobs

## Configuration

Create a `.envsync` file in your project root:

```ini
project=my-app
environment=development
```

Then commands will use these defaults:

```bash
envsync pull  # Uses project=my-app, env=development
```

## License

MIT
