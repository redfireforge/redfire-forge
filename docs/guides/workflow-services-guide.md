# Workflow Services Guide

Configure service registry for multi-environment URL resolution and authentication in workflows.

## Overview

**Workflow Services** provide:
- Centralized URL configuration per environment
- Service-level authentication
- Easy environment switching

## Why Use Services?

### Without Services

```yaml
HTTP Node 1:
  URL: https://staging.api.example.com/users
  Auth: Bearer {{token}}

HTTP Node 2:
  URL: https://staging.api.example.com/orders
  Auth: Bearer {{token}}

HTTP Node 3:
  URL: https://staging.api.example.com/products
  Auth: Bearer {{token}}
```

Problem: Changing environment requires editing every node.

### With Services

```yaml
Service: main-api
  staging: https://staging.api.example.com
  production: https://api.example.com
  Auth: Bearer Token

HTTP Node 1:
  Service: main-api
  Path: /users

HTTP Node 2:
  Service: main-api
  Path: /orders

HTTP Node 3:
  Service: main-api
  Path: /products
```

Benefit: Change environment once, all nodes update.

## Creating Services

### From Workflow Settings

1. Open the workflow
2. Click **Services** in the toolbar
3. Click **+ Add Service**
4. Configure name, URLs, and auth

### Service Configuration

```
┌─────────────────────────────────────────────────────────┐
│ Service: user-api                                       │
├─────────────────────────────────────────────────────────┤
│ Environments:                                           │
│ ┌─────────────┬────────────────────────────────────────┤
│ │ dev         │ https://dev.api.example.com            │
│ │ staging     │ https://staging.api.example.com        │
│ │ production  │ https://api.example.com                │
│ └─────────────┴────────────────────────────────────────┤
│                                                         │
│ Authentication:                                         │
│ Type: [OAuth2 ▼]                                       │
│ Token URL: https://auth.example.com/oauth/token         │
│ Client ID: {{CLIENT_ID}}                                │
│ Client Secret: {{CLIENT_SECRET}}                        │
│ Scope: read write                                       │
├─────────────────────────────────────────────────────────┤
│ [Test Connection]                   [Save]    [Cancel]  │
└─────────────────────────────────────────────────────────┘
```

## Using Services in HTTP Nodes

### Referencing a Service

In HTTP node configuration:

```yaml
HTTP Node: Get User
  Service: user-api
  Path: /users/{{userId}}
  Method: GET
```

The full URL is resolved at runtime:
- If environment is `staging`:
  `https://staging.api.example.com/users/123`

### Path Variables

Use variables in paths:

```yaml
Path: /users/{{userId}}/orders/{{orderId}}
```

### Query Parameters

Add query params via path or node config:

```yaml
Path: /search?q={{query}}&limit={{limit}}
```

Or:
```yaml
Path: /search
Query:
  q: {{query}}
  limit: {{limit}}
```

## Service Authentication

### Auth Types

Services support all auth types:

| Type | Configuration |
|------|---------------|
| None | No auth |
| Basic | Username, Password |
| Bearer | Token |
| API Key | Key name, value, location |
| OAuth2 | Token URL, Client ID/Secret, Scope |

### Auth Inheritance

HTTP nodes inherit auth from their service:

```
Service: user-api
  Auth: OAuth2
    │
    ├── HTTP Node: Create User (uses OAuth2)
    ├── HTTP Node: Get User (uses OAuth2)
    └── HTTP Node: Delete User (uses OAuth2)
```

### Auth Override

Individual nodes can override service auth:

```yaml
HTTP Node: Admin Operation
  Service: user-api
  Auth: Basic (admin credentials)  ← Overrides service OAuth2
```

## Environment Switching

### Default Environment

Set the default for the workflow:

```yaml
Workflow Settings:
  Default Environment: staging
```

### In Quick Test

Select environment before running:

```
[Environment: staging ▼]  [Run Quick Test]
```

### In Workflow Runner

Environment selection in runner config:

```
Workflow: User Registration Flow
Environment: [production ▼]
Iterations: 100
Concurrency: 10
```

## Multiple Services

### When to Use Multiple Services

Workflows calling different backends:

```
Service: user-api
  staging: https://users.staging.example.com
  
Service: order-api
  staging: https://orders.staging.example.com
  
Service: payment-api
  staging: https://payments.staging.example.com
```

### Different Auth Per Service

```yaml
Service: user-api
  Auth: OAuth2 (app credentials)

Service: admin-api
  Auth: Basic (admin credentials)

Service: public-api
  Auth: None
```

## Service Templates

### Common Service Pattern

```yaml
Service: {name}
  Environments:
    dev: https://dev.{domain}
    staging: https://staging.{domain}
    production: https://{domain}
  Auth: {type}
  Headers:
    X-API-Version: "2.0"
```

### Microservice Pattern

For microservice architectures:

```yaml
Service: gateway
  production: https://api.example.com
  
# All services behind gateway
HTTP Nodes use:
  Service: gateway
  Path: /user-service/users
  Path: /order-service/orders
  Path: /product-service/products
```

## Service Health Check

### Test Connection

Verify service configuration:

1. Open service settings
2. Click **Test Connection**
3. A basic request is sent to the base URL
4. Result shows success/failure

### Troubleshooting

```
Connection Failed:
  - Check URL is correct
  - Verify network access
  - Check auth credentials
  - Ensure service is running
```

## Service Variables

### Using Variables in Service Config

```yaml
Service: api
  production: https://{{PROD_HOST}}
  Auth:
    Client ID: {{CLIENT_ID}}
    Client Secret: {{CLIENT_SECRET}}
```

### Environment Variables

Set via workflow variables or external config:

```yaml
Workflow Variables:
  PROD_HOST: "api.example.com"
  CLIENT_ID: "app-123"
  CLIENT_SECRET: "secret-456"
```

## Common Patterns

### Gateway Pattern

Single service with path-based routing:

```yaml
Service: api-gateway
  staging: https://gateway.staging.example.com

HTTP Nodes:
  Path: /v1/users/...
  Path: /v1/orders/...
  Path: /v1/products/...
```

### Multi-Region Pattern

```yaml
Service: api
  us-east: https://us-east.api.example.com
  eu-west: https://eu-west.api.example.com
  ap-south: https://ap-south.api.example.com
```

### Internal/External Pattern

```yaml
Service: internal-api
  dev: http://localhost:8080
  staging: http://internal.staging.local

Service: external-api
  dev: https://sandbox.partner.com
  staging: https://staging.partner.com
```

## Tips & Best Practices

### 1. One Service Per Backend

```
✓ user-api, order-api, payment-api
✗ all-apis (everything in one)
```

### 2. Consistent Environment Names

```
✓ dev, staging, production (across all services)
✗ dev, stg, prod (inconsistent)
```

### 3. Use Variables for Secrets

Never hardcode credentials:

```yaml
✗ Client Secret: "abc123secret"
✓ Client Secret: {{CLIENT_SECRET}}
```

### 4. Document Services

Add descriptions:

```yaml
Service: user-api
  Description: "User management service (v2)"
  Owner: "Platform Team"
```

### 5. Test Before Using

Always test connection after configuring a new service.

## Related Guides

- [Workflow Designer Guide](./workflow-designer-guide.md) — Building workflows
- [Workflow Variables Guide](./workflow-variables-guide.md) — Variables
- [Environments Guide](./environments-guide.md) — Environment configuration
- [Request Auth Guide](./request-auth-guide.md) — Auth types
