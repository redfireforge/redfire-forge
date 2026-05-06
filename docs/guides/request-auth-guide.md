# Request Authentication Guide

Configure authentication for your API requests with support for Basic, Bearer, OAuth2, API Key, and more.

## Overview

RedfireForge supports multiple authentication methods with an inheritance system that reduces configuration duplication.

## Authentication Types

### No Auth

Use for public endpoints that don't require authentication.

```
Auth Type: None
```

### Basic Auth

HTTP Basic Authentication using username and password.

```
Auth Type: Basic
Username: admin
Password: ••••••••
```

Sends header: `Authorization: Basic base64(username:password)`

### Bearer Token

Token-based authentication (JWT, access tokens).

```
Auth Type: Bearer
Token: eyJhbGciOiJIUzI1NiIs...
Prefix: Bearer  (default, can be changed to "Token", etc.)
```

Sends header: `Authorization: Bearer <token>`

### API Key

Send an API key in a header or query parameter.

```
Auth Type: API Key
Key Name: X-API-Key
Key Value: your-api-key-here
Location: Header  (or Query)
```

Header mode sends: `X-API-Key: your-api-key-here`
Query mode appends: `?X-API-Key=your-api-key-here`

### OAuth2 Client Credentials

Automatically acquire access tokens using the OAuth2 client credentials flow.

```
Auth Type: OAuth2
Token URL: https://auth.example.com/oauth/token
Client ID: your-client-id
Client Secret: ••••••••••••••••
Scope: read write  (optional)
```

RedfireForge:
1. Calls the token URL with client credentials
2. Caches the access token
3. Auto-refreshes before expiration (30s buffer)
4. Sends: `Authorization: Bearer <access_token>`

### Digest Auth

HTTP Digest Authentication for enhanced security.

```
Auth Type: Digest
Username: admin
Password: ••••••••
```

Performs the digest challenge-response handshake automatically.

## Auth Inheritance

Authentication flows down the hierarchy, reducing duplication:

```
┌─────────────────────────────────┐
│    Global Auth Profile          │ ← Define once, reuse everywhere
│    (e.g., "prod-oauth2")        │
└────────────────┬────────────────┘
                 │ inherited by
┌────────────────▼────────────────┐
│       Feature Group             │ ← Can override or inherit
│    Auth: Inherit from Profile   │
└────────────────┬────────────────┘
                 │ inherited by
┌────────────────▼────────────────┐
│         Scenario                │ ← Can override or inherit
│    Auth: Inherit from Feature   │
└────────────────┬────────────────┘
                 │ inherited by
┌────────────────▼────────────────┐
│           Test                  │ ← Can override or inherit
│    Auth: Inherit from Scenario  │
└─────────────────────────────────┘
```

### How Inheritance Works

When a test runs:
1. Check test's auth — if "Inherit", go to scenario
2. Check scenario's auth — if "Inherit", go to feature group
3. Check feature group's auth — if "Inherit", go to global profile
4. Use the first non-inherit auth found

### Example

```
Global Profile: "prod-oauth2" (OAuth2 to production)

Feature Group: User Management
  Auth: Inherit from "prod-oauth2"
  
  Scenario: CRUD Operations
    Auth: Inherit from Feature
    
    Test: Create User → uses prod-oauth2 automatically
    Test: Delete User → uses prod-oauth2 automatically
    
  Scenario: Admin Operations
    Auth: Basic (admin/secret)  ← OVERRIDES
    
    Test: Get Audit Log → uses Basic auth
```

## Global Auth Profiles

### Creating a Profile

1. Go to **Settings** (⚙️ icon)
2. Scroll to **Global Auth Profiles**
3. Click **+ Add Profile**
4. Configure:
   - Profile name (e.g., "staging-oauth2")
   - Auth type and credentials

### Using a Profile

In Feature Group settings:
1. Click the **Auth** button
2. Select **Inherit from Global Profile**
3. Choose the profile from the dropdown

## Auth in Collections (Requests)

Collections have their own auth inheritance:

```
Collection: User API
  Auth: OAuth2
  
  Folder: Public Endpoints
    Auth: None  ← overrides
    
  Sub-Collection: Admin
    Auth: Basic  ← overrides
```

Requests inherit from their container unless overridden.

## Verifying Authentication

### Verify Button

Click **Verify Auth** to test your credentials:

- **OAuth2**: Actually acquires a token and shows it
- **Basic/Bearer**: Validates format and shows what will be sent
- **API Key**: Shows the header or query that will be added

### Token Preview

For OAuth2, the verify shows:

```
✓ Token acquired successfully

Token: eyJhbGciOiJSUzI1NiIs... (truncated)
Expires: 2024-01-15 14:30:00 (in 3599s)
Scope: read write
```

## Auth in Workflows

### Service-Level Auth

Workflows can configure auth per service:

```
Service: user-api
  Base URL: https://api.example.com
  Auth: OAuth2 (token URL, credentials)
```

All HTTP nodes using that service automatically use its auth.

### Node-Level Auth

Individual HTTP nodes can override:

```
HTTP Node: Create Admin User
  Service: user-api
  Auth: Basic (admin credentials)  ← overrides service auth
```

## Security Best Practices

### 1. Use Environment Variables

Don't hardcode secrets in test definitions:

```
Token URL: {{OAUTH_TOKEN_URL}}
Client ID: {{CLIENT_ID}}
Client Secret: {{CLIENT_SECRET}}
```

### 2. Use Global Profiles

Define auth once, use everywhere — easier to rotate credentials.

### 3. Separate Profiles by Environment

```
dev-oauth2 → Development credentials
staging-oauth2 → Staging credentials
prod-oauth2 → Production credentials (read-only)
```

### 4. Limit Production Access

Use read-only OAuth2 scopes for production testing.

### 5. Verify Before Running

Always verify auth before running performance tests to catch credential issues early.

## Troubleshooting

### "401 Unauthorized" Errors

1. **Check credentials**: Verify username/password or client ID/secret
2. **Check token URL**: For OAuth2, ensure the URL is correct
3. **Check scope**: Some APIs require specific scopes
4. **Check inheritance**: Verify auth isn't being overridden unexpectedly

### OAuth2 Token Not Refreshing

- Token is cached with 30s buffer before expiration
- Force refresh: Click **Verify Auth** again
- Check if token URL is returning correct `expires_in`

### API Key Not Sent

- Verify **Location** is set correctly (Header vs Query)
- Check the **Key Name** matches what the API expects

## Color-Coded Auth Badges

Tests and scenarios show color-coded badges:

| Badge Color | Meaning |
|-------------|---------|
| **Purple (solid)** | Auth at Feature Group level |
| **Blue (solid)** | Auth at Scenario level |
| **Green (solid)** | Auth at Test level |
| **Purple (outline)** | Inheriting from Feature |
| **Blue (outline)** | Inheriting from Scenario |
| **Gray (outline)** | No auth |

## Related Guides

- [Requests Guide](./requests-guide.md) — Request basics
- [Scenarios Guide](./scenarios-guide.md) — Test organization
- [Environments Guide](./environments-guide.md) — Environment configuration
- [Global Auth Guide](./global-auth-guide.md) — Advanced profile management
