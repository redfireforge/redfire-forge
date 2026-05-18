# Requests Guide

Master the Requests module for ad-hoc API testing with collections, folders, and advanced features.

## Overview

The **Requests** module provides Postman/Insomnia-style API testing. Use it for:
- Quick API exploration and debugging
- Building request collections
- Testing endpoints before creating performance tests
- Generating cURL commands

## Getting Started

### Creating a Collection

1. Go to the **Requests** tab
2. Click **+ New Collection**
3. Enter a name (e.g., "User API")
4. Choose the collection mode:
   - **URL Mode**: Direct URLs (e.g., `https://api.example.com/users`)
   - **ENV Mode**: Environment-based URLs with base URL switching

### Adding Requests

Right-click a collection and select:
- **Add Request** — Create a new HTTP request
- **Add Folder** — Create a folder for organization
- **Add Sub-Collection** — Create a nested collection with its own settings

## Collection Organization

### Hierarchy

```
Collection: User API
├── Folder: Authentication
│   ├── Request: Login
│   └── Request: Refresh Token
├── Folder: Users
│   ├── Request: List Users
│   ├── Request: Get User
│   └── Request: Create User
└── Sub-Collection: Admin API
    └── Request: Delete User
```

### Folders vs Sub-Collections

| Feature | Folder | Sub-Collection |
|---------|--------|----------------|
| Purpose | Group related requests | Mini-collection with own settings |
| Auth | Inherits from parent | Can define own auth |
| Base URL | Uses parent's | Can pin to specific environment |
| Icon | 📁 | 📦 |

### Drag and Drop

- Drag requests between folders
- Drag folders between collections
- Drag a collection onto another to convert it to a sub-collection
- Reorder items by dragging

## Request Editor

### URL Bar

```
[GET ▼] [https://api.example.com/users/{{id}}     ] [Send]
```

- **Method selector**: GET, POST, PUT, PATCH, DELETE
- **URL field**: Full URL with variable support
- **Send button**: Execute the request

### Tabs

| Tab | Purpose |
|-----|---------|
| **Params** | Query parameters |
| **Headers** | HTTP headers |
| **Body** | Request body (POST/PUT/PATCH) |
| **Auth** | Authentication configuration |
| **Tests** | Response assertions |

### Query Parameters

Add parameters visually or in the URL:

```
URL: https://api.example.com/search?q=test&limit=10

Or use the Params tab:
┌──────────┬─────────┬─────────┐
│ Key      │ Value   │ Enabled │
├──────────┼─────────┼─────────┤
│ q        │ test    │ ✓       │
│ limit    │ 10      │ ✓       │
│ page     │ 1       │ ☐       │  ← disabled, not sent
└──────────┴─────────┴─────────┘
```

### Headers

Common headers are suggested as you type:

```
┌────────────────┬─────────────────────┐
│ Key            │ Value               │
├────────────────┼─────────────────────┤
│ Content-Type   │ application/json    │
│ Accept         │ application/json    │
│ Authorization  │ Bearer {{token}}    │
└────────────────┴─────────────────────┘
```

### Body Types

| Type | Use Case |
|------|----------|
| **None** | GET requests |
| **JSON** | API requests |
| **Form URL-encoded** | HTML forms |
| **Form Data** | File uploads |
| **Raw** | Plain text, XML, etc. |

## Response Viewer

### Response Tabs

| Tab | Content |
|-----|---------|
| **Body** | Response body (JSON tree or raw) |
| **Headers** | Response headers |
| **Cookies** | Cookies set by the response |
| **Console** | Request/response trace |

### JSON Tree Viewer

The response body displays as a collapsible tree:

```
▼ data
  ▼ user
      id: 1
      name: "John Doe"
      email: "john@example.com"
  ▼ meta
      total: 100
      page: 1
```

Features:
- **Search**: Find values in the response
- **Collapse/Expand All**: Toggle all nodes
- **Copy Path**: Right-click to copy JSONPath
- **Navigate Matches**: Use prev/next buttons when searching

### Console Trace

View detailed request/response information:

```
▶ Request
  Method: POST
  URL: https://api.example.com/users
  Headers:
    Content-Type: application/json
    Authorization: Bearer eyJhbG...
  Body: {"name": "John"}
  
◀ Response
  Status: 201 Created
  Time: 145ms
  Size: 234 bytes
  Headers:
    Content-Type: application/json
```

## Environment-Based URLs

### Setting Up Environments

1. Click **Edit** on a collection
2. Switch to **ENV Mode**
3. Add environments with base URLs:

```
┌─────────────┬──────────────────────────────────┐
│ Environment │ Base URL                         │
├─────────────┼──────────────────────────────────┤
│ dev         │ https://dev.api.example.com      │
│ staging     │ https://staging.api.example.com  │
│ production  │ https://api.example.com          │
└─────────────┴──────────────────────────────────┘
```

### Using Relative URLs

In ENV mode, requests use relative paths:

```
Request URL: /users/{{id}}

With "staging" selected:
→ https://staging.api.example.com/users/{{id}}
```

### Pinning Sub-Collections

Sub-collections can be pinned to a specific environment:

```
Collection: User API (ENV Mode)
├── Request: List Users → uses selected env
└── Sub-Collection: Staging Tests (pinned to "staging")
    └── Request: Test Feature → always uses staging
```

## Import & Export

### cURL Import

1. Click **Import** in the request editor
2. Paste a cURL command:

```bash
curl -X POST https://api.example.com/users \
  -H "Content-Type: application/json" \
  -d '{"name": "John"}'
```

3. Click **Import** — the request is populated automatically

### cURL Export

1. Open a request
2. Click **Export → cURL**
3. Copy the generated command

For OAuth2 requests, the export fetches a real token and embeds it.

### JSON Export/Import

Export collections or folders as JSON for sharing or version control:

1. Right-click → **Export**
2. Choose location and save
3. Import via **Right-click → Import**

## Tips & Best Practices

### 1. Use Folders for Organization

Group related requests:
```
Users/
  CRUD/
    Create User
    Read User
    Update User
    Delete User
  Search/
    Search by Name
    Search by Email
```

### 2. Leverage Variables

Use `{{variable}}` syntax for dynamic values:
- `{{baseUrl}}/users` — Environment-specific
- `{{userId}}` — Extracted from previous response
- `{{$uuid}}` — Auto-generated UUID

### 3. Disable Params Without Deleting

Toggle the checkbox to disable query params or headers temporarily.

### 4. Use the Console for Debugging

The console shows exactly what was sent and received — useful for debugging auth issues.

### 5. Pin Sub-Collections for Isolation

When testing a specific environment, pin the sub-collection to avoid accidentally hitting production.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + Enter` | Send request |
| `Cmd/Ctrl + S` | Save request |
| `Cmd/Ctrl + N` | New request |
| `Cmd/Ctrl + D` | Duplicate request |

## Related Guides

- [Request Auth Guide](./request-auth-guide.md) — Authentication configuration
- [Getting Started](./getting-started.md) — Quick start tutorial
- [Scenarios Guide](./scenarios-guide.md) — Convert requests to tests
