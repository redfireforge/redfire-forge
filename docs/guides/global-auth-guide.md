# Global Auth Profiles Guide

Create reusable authentication profiles that can be shared across feature groups, scenarios, and tests.

## Overview

**Global Auth Profiles** let you:
- Define authentication once, use everywhere
- Easily switch credentials across all tests
- Manage different auth per environment
- Rotate secrets without editing tests

## Why Use Global Profiles?

### Without Global Profiles

```
Feature Group: Users
  Auth: OAuth2 (token URL, client ID, secret)
  
Feature Group: Orders
  Auth: OAuth2 (same token URL, client ID, secret)  ← Duplicated!
  
Feature Group: Products
  Auth: OAuth2 (same token URL, client ID, secret)  ← Duplicated again!
```

Problem: Updating credentials requires editing every feature group.

### With Global Profiles

```
Global Profile: "prod-oauth2"
  Auth: OAuth2 (configured once)

Feature Group: Users → Inherit from "prod-oauth2"
Feature Group: Orders → Inherit from "prod-oauth2"  
Feature Group: Products → Inherit from "prod-oauth2"
```

Benefit: Update credentials in one place, all feature groups use new auth.

## Creating Global Profiles

### From Settings

1. Click **⚙ Settings** in the sidebar
2. Scroll to **Global Auth Profiles**
3. Click **+ Add Profile**
4. Configure:
   - Profile name
   - Auth type
   - Credentials

### Profile Configuration

```
┌─────────────────────────────────────────────────────────┐
│ Global Auth Profile                                     │
├─────────────────────────────────────────────────────────┤
│ Name: [prod-oauth2__________________]                   │
│                                                         │
│ Auth Type: [OAuth2 ▼]                                  │
│                                                         │
│ Token URL: [https://auth.example.com/oauth/token____]   │
│ Client ID: [app-client-id_______________________]       │
│ Client Secret: [••••••••••••••••••••____________]       │
│ Scope: [read write_____________________________]        │
│                                                         │
│ [Verify]                            [Save]    [Cancel]  │
└─────────────────────────────────────────────────────────┘
```

## Auth Types in Profiles

### Basic Auth

```yaml
Profile: admin-basic
Type: Basic
Username: admin
Password: {{ADMIN_PASSWORD}}
```

### Bearer Token

```yaml
Profile: api-token
Type: Bearer
Token: {{API_TOKEN}}
Prefix: Bearer  # or "Token", etc.
```

### API Key

```yaml
Profile: partner-api
Type: API Key
Key Name: X-Partner-Key
Key Value: {{PARTNER_API_KEY}}
Location: Header  # or Query
```

### OAuth2 Client Credentials

```yaml
Profile: prod-oauth2
Type: OAuth2
Token URL: https://auth.example.com/oauth/token
Client ID: {{CLIENT_ID}}
Client Secret: {{CLIENT_SECRET}}
Scope: read write admin
```

## Using Global Profiles

### In Feature Groups

1. Open Feature Group settings
2. Click **Auth**
3. Select **Inherit from Global Profile**
4. Choose profile from dropdown

```
Feature Group: User Management
  Auth: ○ None
        ○ Custom
        ● Inherit from Global Profile
          Profile: [prod-oauth2 ▼]
```

### In Scenarios

Scenarios can inherit or override:

```
Feature Group: User Management
  Auth: prod-oauth2
  
  Scenario: User CRUD
    Auth: Inherit (uses prod-oauth2)
    
  Scenario: Admin Operations
    Auth: Custom (Basic with admin credentials)
```

### In Tests

Individual tests can also override:

```
Scenario: User CRUD
  Auth: Inherit
  
  Test: Create User → Inherit
  Test: Delete User (Admin) → Custom (admin-basic profile)
```

## Profile Inheritance

### Inheritance Chain

```
Global Profile
    ↓
Feature Group (Inherit)
    ↓
Scenario (Inherit)
    ↓
Test (Inherit)
```

At each level, you can:
- **Inherit**: Use parent's auth
- **Override**: Define custom auth
- **None**: No authentication

### Resolution Order

When a test runs, auth is resolved:

1. Check test's auth → if "Inherit", go to scenario
2. Check scenario's auth → if "Inherit", go to feature group
3. Check feature group's auth → if "Profile", use that profile
4. Apply the first non-inherit auth found

## Managing Multiple Environments

### Environment-Specific Profiles

Create profiles per environment:

```
Profiles:
  - dev-oauth2 (development credentials)
  - staging-oauth2 (staging credentials)
  - prod-oauth2 (production credentials)
```

### Switching Profiles

Change the profile assignment when testing different environments:

```
Feature Group: Users
  Environment: staging
  Auth Profile: staging-oauth2
```

### Environment Variables

Use environment variables for credentials:

```yaml
Profile: prod-oauth2
Token URL: https://auth.example.com/oauth/token
Client ID: {{OAUTH_CLIENT_ID}}
Client Secret: {{OAUTH_CLIENT_SECRET}}
```

Set variables based on environment:
- Development: `OAUTH_CLIENT_ID=dev-app`
- Production: `OAUTH_CLIENT_ID=prod-app`

## Verifying Profiles

### Verify Button

Test that credentials work:

1. Open profile settings
2. Click **Verify**
3. For OAuth2: Acquires a token
4. Shows success or error

### Verification Results

```
✓ Profile Verified Successfully

Token acquired:
  Token: eyJhbGciOiJS... (truncated)
  Expires: 2024-01-15 14:30:00 (in 3599s)
  Scope: read write admin
```

Or:

```
✗ Verification Failed

Error: invalid_client
Message: Client authentication failed
```

## Profile Security

### Storing Secrets

Best practices:

1. **Use variables** instead of hardcoding:
   ```yaml
   Client Secret: {{OAUTH_SECRET}}
   ```

2. **Set variables externally**:
   - Environment variables
   - CI/CD secrets
   - Secure vault

### Access Control

Profiles are stored locally:
- Desktop: In app data directory
- Web: In localStorage

For shared environments, use variables that team members set locally.

### Rotating Credentials

When credentials change:

1. Update the profile
2. Verify it works
3. All linked tests automatically use new credentials

## Profile Organization

### Naming Conventions

Use clear, consistent names:

```
✓ prod-oauth2, staging-oauth2, dev-oauth2
✓ user-service-auth, order-service-auth
✓ admin-basic, readonly-token

✗ profile1, auth, test
```

### Grouping by Purpose

```
Authentication Profiles:
├── Production
│   ├── prod-oauth2 (main services)
│   └── prod-admin (admin operations)
├── Staging
│   ├── staging-oauth2
│   └── staging-admin
└── Development
    └── dev-oauth2
```

## Common Patterns

### Service-Per-Profile

When different services need different auth:

```
Profile: user-service-auth (OAuth2)
Profile: payment-service-auth (API Key)
Profile: admin-service-auth (Basic)

Feature Group: User Tests → user-service-auth
Feature Group: Payment Tests → payment-service-auth
Feature Group: Admin Tests → admin-service-auth
```

### Read/Write Split

Separate profiles for different permissions:

```
Profile: readonly-token (limited scope)
Profile: readwrite-token (full scope)
Profile: admin-token (admin scope)

Scenario: Read Operations → readonly-token
Scenario: Write Operations → readwrite-token
Scenario: Admin Operations → admin-token
```

### Multi-Tenant

Profiles for different tenants:

```
Profile: tenant-a-auth
Profile: tenant-b-auth
Profile: tenant-c-auth

Scenario: Tenant A Tests → tenant-a-auth
Scenario: Tenant B Tests → tenant-b-auth
```

## Troubleshooting

### "Profile not found"

- Check profile name spelling
- Ensure profile is saved
- Refresh the profile list

### "Token acquisition failed"

For OAuth2:
- Verify token URL
- Check client ID/secret
- Confirm scope is valid
- Check network access

### "Auth not applied"

- Check inheritance chain
- Verify no overrides at lower levels
- Ensure profile is linked to feature group

## Tips & Best Practices

### 1. One Profile Per Auth Source

```
✓ profile for auth.example.com
✓ profile for api.partner.com

✗ "all-auth" with mixed credentials
```

### 2. Use Environment Variables

Never hardcode secrets:
```yaml
✗ Client Secret: "abc123secret"
✓ Client Secret: {{OAUTH_SECRET}}
```

### 3. Document Profiles

Add descriptions:
```
Profile: prod-oauth2
Description: "Production OAuth2 for user-service. Scope: read write."
```

### 4. Test Before Using

Always verify profiles work before linking to tests.

### 5. Rotate Regularly

Update credentials periodically:
- Update profile
- Verify
- All tests continue to work

## Related Guides

- [Request Auth Guide](./request-auth-guide.md) — Auth types
- [Environments Guide](./environments-guide.md) — Environments
- [Scenarios Guide](./scenarios-guide.md) — Test organization
