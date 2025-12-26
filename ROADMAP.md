# EnvSync

## Tagline
**"Sync secrets. Not trust."**

---

## The Problem

Developers juggle .env files across:
- Local development
- CI/CD pipelines
- Staging/production servers
- Team members
- Multiple services (Netlify, Vercel, Railway, AWS)

Current solutions suck:
- **Copy/paste**: Error-prone, no sync, secrets in Slack
- **1Password/Vault**: Overkill for .env, not built for this
- **dotenv-vault**: Cloud-dependent, they see your secrets
- **Git (encrypted)**: Merge conflicts, key management hell

---

## The Solution

EnvSync is a **zero-knowledge .env manager** that:
- Stores secrets encrypted (you hold the key)
- Syncs across devices without exposing plaintext
- Pushes directly to Netlify/Vercel/Railway via their APIs
- Works locally, in Docker, or via EnvSync.com
- Built on VeilCloud infrastructure

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         ENVSYNC ARCHITECTURE                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  LOCAL APP (Tauri + Angular)                                            │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │    │
│  │  │   Project    │  │    Env       │  │   Service    │          │    │
│  │  │   Manager    │  │   Editor     │  │ Integrations │          │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘          │    │
│  │                            │                                    │    │
│  │                            ▼                                    │    │
│  │  ┌──────────────────────────────────────────────────────────┐  │    │
│  │  │              Client-Side Encryption Layer                 │  │    │
│  │  │         (AES-256-GCM, key derived from password)         │  │    │
│  │  └──────────────────────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                   │                                      │
│                                   ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                       VEILCLOUD                                  │    │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐ │    │
│  │  │ ZK Storage │  │  VeilKey   │  │ VeilChain  │  │  VeilSign  │ │    │
│  │  │ (secrets)  │  │ (team keys)│  │  (audit)   │  │  (access)  │ │    │
│  │  └────────────┘  └────────────┘  └────────────┘  └────────────┘ │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  SERVICE INTEGRATIONS (Direct API, not through VeilCloud):              │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐        │
│  │  Netlify   │  │  Vercel    │  │  Railway   │  │   Fly.io   │        │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘        │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Deployment Modes

| Mode | Storage | Sync | Use Case |
|------|---------|------|----------|
| **Local Only** | Encrypted SQLite | None | Solo dev, air-gapped |
| **Docker** | Encrypted volume | LAN/VPN | Team self-hosted |
| **EnvSync.com** | VeilCloud | Cloud (ZK) | Teams, multi-device |

All modes use the same UI and encryption — only the storage backend changes.

---

## Features

### Core Features
- **Project Management**: Organize secrets by project
- **Environment Switching**: dev / staging / prod per project
- **Diff View**: Compare environments side-by-side
- **Search**: Find variables across all projects
- **Import/Export**: .env file support

### Security Features
- **Client-Side Encryption**: AES-256-GCM, key never leaves device
- **Master Password**: Derived via Argon2id
- **Auto-Lock**: Lock after inactivity
- **No Plaintext on Disk**: Even local storage is encrypted

### Sync Features (VeilCloud)
- **Cross-Device Sync**: Same secrets on laptop, desktop, CI
- **Team Sharing**: Share projects with team (VeilKey)
- **Audit Trail**: Who accessed what, when (VeilChain)
- **Conflict Resolution**: Last-write-wins with history

### Service Integrations
- **Netlify**: Pull/push env vars via API
- **Vercel**: Pull/push env vars via API
- **Railway**: Pull/push env vars via API
- **Fly.io**: Pull/push secrets via CLI wrapper
- **AWS Parameter Store**: Sync to SSM parameters
- **GitHub Actions**: Sync to repository secrets

---

## Tech Stack

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           TECH STACK                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  FRONTEND                                                                │
│  ├── Angular 17+ (you know it, works in Tauri)                          │
│  ├── TailwindCSS (fast styling)                                         │
│  └── Monaco Editor (for .env editing)                                   │
│                                                                          │
│  DESKTOP WRAPPER                                                         │
│  ├── Tauri 2.0 (Rust, lightweight, secure)                              │
│  └── ~5MB bundle (vs ~150MB Electron)                                   │
│                                                                          │
│  LOCAL BACKEND (embedded in Tauri)                                       │
│  ├── SQLite + SQLCipher (encrypted database)                            │
│  └── Rust crypto (ring, aes-gcm)                                        │
│                                                                          │
│  CLOUD BACKEND (VeilCloud)                                               │
│  ├── VeilCloud SDK (storage, sync)                                      │
│  ├── VeilKey (team key management)                                      │
│  └── VeilChain (audit logging)                                          │
│                                                                          │
│  API BACKEND (for web/docker mode)                                       │
│  ├── Python FastAPI                                                     │
│  ├── PostgreSQL (metadata only, encrypted)                              │
│  └── S3-compatible storage (encrypted blobs)                            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Phase Roadmap

### Phase 1: Local MVP (Weeks 1-3)
**Goal**: Working desktop app for solo developers

```
Deliverables:
├── Tauri + Angular Setup
│   ├── Project scaffolding
│   ├── Basic window/menu
│   └── IPC between frontend and Rust
│
├── Local Storage
│   ├── SQLCipher encrypted database
│   ├── Master password / key derivation
│   └── Auto-lock on idle
│
├── Core UI
│   ├── Project list sidebar
│   ├── Environment tabs (dev/staging/prod)
│   ├── Variable editor (key/value pairs)
│   ├── Import .env file
│   └── Export .env file
│
├── Basic Features
│   ├── Add/edit/delete projects
│   ├── Add/edit/delete variables
│   ├── Copy variable value
│   └── Search across projects
│
└── Netlify Integration
    ├── OAuth or personal access token
    ├── List sites
    ├── Pull env vars from site
    └── Push env vars to site
```

**Monetization**: Free (local only, unlimited)

---

### Phase 2: Cloud Sync via VeilCloud (Weeks 4-6)
**Goal**: Sync across devices with zero-knowledge encryption

```
Deliverables:
├── VeilCloud Integration
│   ├── @veilcloud/client SDK integration
│   ├── Account creation/login
│   ├── Master key derivation (same as local)
│   └── Encrypted blob sync
│
├── Sync Engine
│   ├── Push local changes to VeilCloud
│   ├── Pull remote changes
│   ├── Conflict detection
│   └── Version history
│
├── UI Updates
│   ├── Sync status indicator
│   ├── Login/signup flow
│   ├── Sync settings
│   └── History viewer
│
└── More Integrations
    ├── Vercel API
    └── Railway API
```

**Monetization**:
- Free: 3 projects, local only
- Pro ($29 one-time): Unlimited projects + cloud sync

---

### Phase 3: Team Sharing (Weeks 7-9)
**Goal**: Share secrets with team using VeilKey threshold crypto

```
Deliverables:
├── VeilKey Integration
│   ├── Team key generation (t-of-n)
│   ├── Share distribution to team members
│   └── Threshold decryption for shared projects
│
├── Team Features
│   ├── Create team
│   ├── Invite members
│   ├── Role-based access (admin/member/viewer)
│   └── Per-project team assignment
│
├── VeilChain Audit
│   ├── Log all access events
│   ├── Audit log viewer
│   └── Export audit trail
│
└── Sharing UI
    ├── Team management panel
    ├── Share project with team
    ├── Access request workflow
    └── Revocation
```

**Monetization**:
- Team ($12/user/month): Team sharing + audit logs

---

### Phase 4: Docker & Web (Weeks 10-12)
**Goal**: Self-hosted and web versions

```
Deliverables:
├── Docker Deployment
│   ├── Docker Compose config
│   ├── FastAPI backend
│   ├── PostgreSQL + encrypted storage
│   └── Same Angular frontend
│
├── EnvSync.com
│   ├── Web app (same Angular, no Tauri)
│   ├── Hosted on VeilCloud
│   └── Full feature parity with desktop
│
├── CLI Tool
│   ├── envsync pull <project>
│   ├── envsync push <project>
│   ├── envsync export <project> > .env
│   └── CI/CD integration examples
│
└── Enterprise Features
    ├── SSO (SAML/OIDC)
    ├── Admin console
    └── Compliance exports
```

**Monetization**:
- Self-hosted ($199/year): Docker + unlimited users
- Enterprise (custom): SSO + support + SLA

---

## VeilCloud Integration Details

### Storage (ZK Storage)
```typescript
// All secrets encrypted client-side before upload
await veilcloud.storage.put(`projects/${projectId}/env/${env}`, {
  variables: [
    { key: 'DATABASE_URL', value: 'postgres://...' },
    { key: 'API_KEY', value: 'sk_live_xxx' }
  ]
});
// VeilCloud only sees encrypted blob
```

### Team Keys (VeilKey)
```typescript
// Create 2-of-3 team key
const teamKey = await veilcloud.veilkey.generate({
  threshold: 2,
  parties: 3,
  algorithm: 'ECDSA-P256'
});

// Distribute shares to team members
// Any 2 can decrypt team secrets
// No single point of failure
```

### Audit Trail (VeilChain)
```typescript
// Every access logged immutably
await veilcloud.veilchain.append('envsync-audit', {
  action: 'secret.read',
  project: 'my-angular-app',
  environment: 'production',
  user: 'user_abc',
  timestamp: new Date()
});
// Tamper-proof audit trail
```

---

## Netlify Integration (Your Projects)

### Setup Flow
1. User connects Netlify account (OAuth or personal token)
2. EnvSync lists all Netlify sites
3. User links EnvSync project to Netlify site
4. Bi-directional sync enabled

### API Calls
```typescript
// List sites
GET https://api.netlify.com/api/v1/sites
Authorization: Bearer <token>

// Get env vars
GET https://api.netlify.com/api/v1/accounts/{account_id}/env
  ?site_id={site_id}

// Set env vars
POST https://api.netlify.com/api/v1/accounts/{account_id}/env
  ?site_id={site_id}
Body: [{ "key": "VAR_NAME", "values": [{ "value": "xxx", "context": "all" }] }]
```

### Angular Project Workflow
```
1. Create project "my-angular-app" in EnvSync
2. Add environments: dev, staging, prod
3. Link to Netlify site "my-angular-app.netlify.app"
4. Pull existing vars from Netlify → EnvSync
5. Edit in EnvSync (nice UI, search, diff)
6. Push back to Netlify
7. Changes sync to team via VeilCloud
8. Audit log shows who changed what
```

---

## Security Model

### What EnvSync Guarantees

| Property | How |
|----------|-----|
| **Secrets encrypted at rest** | AES-256-GCM, local SQLCipher |
| **Secrets encrypted in transit** | TLS + client-side encryption |
| **Server never sees plaintext** | VeilCloud ZK architecture |
| **Team access without single key** | VeilKey threshold crypto |
| **Tamper-proof audit trail** | VeilChain Merkle proofs |

### What You Must Protect

| Asset | Your Responsibility |
|-------|---------------------|
| Master password | Don't lose it, don't share it |
| Device security | Lock your laptop |
| Service tokens | Netlify/Vercel tokens are sensitive |

---

## Pricing Summary

| Tier | Price | Features |
|------|-------|----------|
| **Free** | $0 | Local only, unlimited projects |
| **Pro** | $29 (one-time) | Cloud sync, all integrations |
| **Team** | $12/user/mo | Team sharing, audit logs |
| **Self-Hosted** | $199/year | Docker, unlimited users |
| **Enterprise** | Custom | SSO, support, SLA |

---

## Success Metrics

### Product-Market Fit
- [ ] 500 downloads in month 1
- [ ] 50 Pro purchases in month 1
- [ ] 10 Team signups in month 2
- [ ] <5% refund rate

### Technical Excellence
- [ ] Zero plaintext exposure incidents
- [ ] <100ms local operations
- [ ] <500ms sync operations
- [ ] Cross-platform (Mac, Windows, Linux)

### Integration Adoption
- [ ] 80% of users connect at least one service
- [ ] Netlify most popular integration
- [ ] 5+ integrations by end of year

---

## The Vision

EnvSync becomes the **standard way developers manage secrets**:
- As easy as a .env file
- As secure as a vault
- As collaborative as Git

No more secrets in Slack. No more "can you send me the prod API key?" No more wondering if staging has the right config.

**"Finally, .env files that just work."**

---

*"Sync secrets. Not trust."*
