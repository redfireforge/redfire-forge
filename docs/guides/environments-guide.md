# Environments Guide

Configure environments, microservices, and base URLs for multi-environment API testing.

## Overview

**Environments** let you run the same tests against different deployment targets:

```
Test: GET /users
  
  dev:        https://dev.api.example.com/users
  staging:    https://staging.api.example.com/users
  production: https://api.example.com/users
```

## Key Concepts

### Environments

An **Environment** is a deployment target:
- `dev` — Development
- `t01`, `t02` — Test environments
- `staging` — Pre-production
- `production` — Live

### Microservices

A **Microservice** is a service you test:
- `user-service`
- `order-api`
- `payment-gateway`

### Base URLs

Each microservice has URLs per environment:

```
user-service:
  dev:     https://dev.api.example.com/users
  staging: https://staging.api.example.com/users
  prod:    https://api.example.com/users

order-api:
  dev:     https://dev.api.example.com/orders
  staging: https://staging.api.example.com/orders
  prod:    https://api.example.com/orders
```

## Creating Environments

### From Settings

1. Click **⚙ Settings** in the sidebar
2. Go to **Environments** section
3. Type environment name
4. Click **+ Add**

### From Sidebar

1. Click **Environments** in the top-left sidebar
2. Type name in the input
3. Click **+ Add**

### Environment Properties

| Property | Description |
|----------|-------------|
| **Name** | Display name (e.g., "staging") |
| **ID** | Auto-generated unique identifier |

## Creating Microservices

### From Settings

1. Go to **Settings** → **Microservices**
2. Type microservice name
3. Click **+ Add**

### Configuring URLs

1. Click **Configure** on a microservice
2. For each environment:
   - Check **Deployed** if the service exists there
   - Click **Edit** to set the base URL
   - Click **Save**

### URL Configuration

```
┌──────────────────────────────────────────────────────┐
│ Microservice: user-service                           │
├─────────────┬──────────┬─────────────────────────────┤
│ Environment │ Deployed │ Base URL                    │
├─────────────┼──────────┼─────────────────────────────┤
│ dev         │ ☑        │ https://dev.api.ex.com     │
│ staging     │ ☑        │ https://stg.api.ex.com     │
│ production  │ ☐        │ (not configured)           │
└─────────────┴──────────┴─────────────────────────────┘
```

## Using Environments

### Sidebar Navigation

The sidebar shows your hierarchy:

```
▼ Environments
  ▼ dev
      user-service
      order-api
  ▼ staging
      user-service
      order-api
      
▼ Microservices
  ▼ user-service
      dev
      staging
  ▼ order-api
      dev
      staging
```

### Switching Views

Toggle between views:
- **Env** — Group by environment
- **Svc** — Group by microservice

### Selection

Click to select:
- An environment
- A microservice
- Both (click child item)

Selection filters:
- Feature Groups
- Test Runner
- Results

## In Test Runner

### Host Mode

| Mode | Behavior |
|------|----------|
| **Original** | Use URL as defined in test |
| **Settings** | Replace host with environment's base URL |
| **Custom** | Use a specified custom URL |

### With Settings Host

```
Test URL: /users/{{id}}
Environment: staging
Microservice: user-service
Base URL: https://stg.api.example.com

Resolved: https://stg.api.example.com/users/{{id}}
```

## In Requests

### Collection Modes

| Mode | Description |
|------|-------------|
| **URL Mode** | Direct URLs (no environment switching) |
| **ENV Mode** | Environment-based URL resolution |

### ENV Mode Setup

1. Create/edit a collection
2. Enable **ENV Mode**
3. Add environment URLs:

```
┌─────────────┬──────────────────────────────────┐
│ Environment │ Base URL                         │
├─────────────┼──────────────────────────────────┤
│ dev         │ https://dev.api.example.com      │
│ staging     │ https://staging.api.example.com  │
└─────────────┴──────────────────────────────────┘
```

### Switching Environments

Use the environment dropdown to switch:

```
[dev ▼] Request: GET /users
        
→ Resolved: https://dev.api.example.com/users
```

## In Workflows

### Service Registry

Define services with per-environment URLs:

1. Open workflow settings
2. Go to **Services**
3. Add service with environment URLs

```
Service: user-api
  Environments:
    dev: https://dev.api.example.com
    staging: https://staging.api.example.com
```

### HTTP Nodes

Reference services instead of hardcoding URLs:

```
HTTP Node: Get User
  Service: user-api
  Path: /users/{{userId}}
```

### Environment Selection

Select environment in workflow settings or runner.

## Storage

### Desktop App

Environments and microservices are stored in:
- **macOS**: `~/Library/Application Support/com.redfireforge.desktop/`
- **Windows**: `%APPDATA%/com.redfireforge.desktop/`
- **Linux**: `~/.local/share/com.redfireforge.desktop/`

### Web Mode

Stored in `localStorage`:
- `perf-test-environments`
- `perf-test-microservices`

## Import & Export

### Export

Environments and microservices are included when exporting via **Export Center**:

1. Open **Settings** → **Export Center**
2. Check **Environments** and **Microservices**
3. Export JSON

### Import

1. Open **Settings** → **Import**
2. Select JSON file
3. Resolve conflicts if any

## Tips & Best Practices

### 1. Use Consistent Naming

```
✓ dev, staging, production
✓ t01, t02, t03
✗ Dev, STAGING, Prod
```

### 2. Match Service Names to Code

```
✓ user-service (matches code repo)
✗ UserAPI, user_api (inconsistent)
```

### 3. Mark Deployed Status

Only mark environments where services actually exist:
- Prevents accidental testing against non-existent endpoints
- Settings host mode is disabled for non-deployed combinations

### 4. Use Settings Host in Runner

Switch between environments without changing tests:

```
Same test, different environments:
  dev → test against dev
  staging → test against staging
```

### 5. Document Your URLs

Keep a reference of all URLs:

```markdown
# Environment URLs

## dev
- user-service: https://dev.api.example.com
- order-api: https://dev.orders.example.com

## staging
- user-service: https://staging.api.example.com
- order-api: https://staging.orders.example.com
```

## Related Guides

- [Getting Started](./getting-started.md) — Quick setup
- [Concepts Overview](./concepts-overview.md) — Key concepts
- [Test Runner Guide](./test-runner-guide.md) — Running tests
- [Global Auth Guide](./global-auth-guide.md) — Authentication profiles
