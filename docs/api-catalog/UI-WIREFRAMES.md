# API Catalog — UI Wireframes

> ASCII wireframes for every screen and interaction in the API Catalog feature.

---

## Table of Contents

1. [App-Level Layout (3-Tab Sidebar)](#1-app-level-layout)
2. [Catalog Sidebar (Thin)](#2-catalog-sidebar)
3. [Sidebar Context Menu](#3-sidebar-context-menu)
4. [Welcome / Empty State](#4-welcome-state)
5. [Main Panel Layout (Endpoint Nav + Detail)](#5-main-panel-layout)
6. [Endpoint Nav Strip](#6-endpoint-nav-strip)
7. [Endpoint Detail View (Swagger UI)](#7-endpoint-detail-view)
8. [Host & Auth Bar](#8-host--auth-bar)
9. [Try It Response](#9-try-it-response)
10. [cURL Preview Popover](#10-curl-preview-popover)
11. [Import Modal](#11-import-modal)
12. [Overview Page](#12-overview-page)
13. [Version History Modal](#13-version-history-modal)
14. [Version Diff View](#14-version-diff-view)

---

## 1. App-Level Layout

The sidebar gains a third tab. The `Catalog` tab sits between `Workbench` and `Projects`.

```
┌──────────────────────────────────────────────────────────────────────┐
│  🔥 RedfireForge — Redfire Performance Workbench              v0.x  │
├──────────────────┬───────────────────────────────────────────────────┤
│ ┌──────────────┐ │                                                   │
│ │  Workbench   │ │                                                   │
│ │  Catalog  ●  │ │        Main Content Area                         │
│ │  Projects    │ │        (depends on active tab)                    │
│ └──────────────┘ │                                                   │
│                  │                                                   │
│ (sidebar content │                                                   │
│  changes per     │                                                   │
│  active tab)     │                                                   │
│                  │                                                   │
│                  │                                                   │
│ ⚙ Settings       │                                                   │
└──────────────────┴───────────────────────────────────────────────────┘
```

---

## 2. Catalog Sidebar

The sidebar is intentionally **thin** — only API entry names with version and
endpoint count badges. No endpoint trees in the sidebar.

```
┌──────────────────────────┐
│ [Workbench] [Catalog] [Projects]
├──────────────────────────┤
│ 🔍 Filter APIs...        │
│                          │
│ [+ Import Spec]          │
│                          │
│ ┌──────────────────────┐ │
│ │ 📋 Sales Product API │ │  ← selected (highlighted)
│ │    v3.2.1 • 14 eps   │ │     version + endpoint count
│ └──────────────────────┘ │
│                          │
│ ┌──────────────────────┐ │
│ │ 📋 Payment Gateway   │ │
│ │    v2.0.0 • 8 eps    │ │
│ └──────────────────────┘ │
│                          │
│ ┌──────────────────────┐ │
│ │ 📋 Notification Svc  │ │
│ │    v1.3.0 • 22 eps   │ │
│ └──────────────────────┘ │
│                          │
│ ┌──────────────────────┐ │
│ │ 📋 User Management   │ │
│ │    v4.1.0 • 35 eps   │ │
│ └──────────────────────┘ │
│                          │
│                          │
│                          │
│ ⚙ Settings               │
└──────────────────────────┘
```

Key design decisions:
- Even with 20 imported APIs, the sidebar stays scannable
- Version badge is subtle (small text, muted color)
- Endpoint count gives at-a-glance sense of API size
- Filter narrows the list by API name

---

## 3. Sidebar Context Menu

Right-click on any API entry:

```
┌────────────────────────────┐
│ Versions                    │
│ ┌────────────────────────┐ │
│ │ ● v3.2.1 (current)   ✓│ │
│ │   v3.1.0              │ │
│ │   v3.0.0              │ │
│ └────────────────────────┘ │
│ ─────────────────────────  │
│ Re-import / Update         │
│ Version History            │
│ Export Original Spec       │
│ ─────────────────────────  │
│ Host & Auth Config         │
│ Send All → Workbench       │
│ ─────────────────────────  │
│ Rename                     │
│ Delete                     │
└────────────────────────────┘
```

The version sub-list at the top lets the user switch versions inline.
Clicking a different version re-parses that version's stored spec and
refreshes the endpoint nav.

---

## 4. Welcome State

Shown when no API entry is selected, or when the catalog is empty.

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│                                                                │
│                                                                │
│                         📋                                     │
│                                                                │
│                   API Catalog                                  │
│                                                                │
│       Import an OpenAPI specification to get started.          │
│       Browse endpoints, test them interactively, and           │
│       track spec versions over time.                           │
│                                                                │
│                    [+ Import Spec]                              │
│                                                                │
│       Supported formats:                                       │
│       • OpenAPI 3.0, 3.1                                       │
│       • Swagger 2.0                                            │
│       • YAML and JSON                                          │
│                                                                │
│                                                                │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## 5. Main Panel Layout

When an API entry AND an endpoint are selected, the main panel splits into
two resizable regions:

```
┌─ Sidebar ──┐┌─ Main Panel ──────────────────────────────────────────────┐
│            ││                                                            │
│ Sales ●    ││ ┌─ Endpoint Nav ──────┐┌─ Detail Panel ──────────────────┐│
│ Payment    ││ │  (tag-grouped       ││  (Swagger-UI-style              ││
│ Notif      ││ │   endpoint list     ││   endpoint documentation        ││
│ User Mgmt  ││ │   with search)      ││   + interactive testing)        ││
│            ││ │                     ││                                  ││
│            ││ │  ~260px, resizable  ││  Fills remaining width           ││
│            ││ │  collapsible ◀      ││                                  ││
│            ││ └─────────────────────┘└──────────────────────────────────┘│
│            ││                                                            │
│ ⚙ Settings ││                                                            │
└────────────┘└────────────────────────────────────────────────────────────┘
```

The endpoint nav has a collapse button. When collapsed:

```
┌─ Sidebar ──┐┌─ Main Panel ──────────────────────────────────────────────┐
│            ││▶│                                                          │
│ Sales ●    ││ │  Detail Panel (full width)                               │
│ Payment    ││ │                                                          │
│ Notif      ││ │  POST /v1/auto-assign/assign                            │
│ User Mgmt  ││ │  ...                                                     │
│            ││ │                                                          │
│ ⚙ Settings ││ │                                                          │
└────────────┘└────────────────────────────────────────────────────────────┘
```

---

## 6. Endpoint Nav Strip

The internal navigation for browsing endpoints within one API:

```
┌────────────────────────────────┐
│ Sales Product API        [◀]  │  ← click name → overview; [◀] collapses
├────────────────────────────────┤
│ 🔍 Search endpoints...        │
├────────────────────────────────┤
│                                │
│ ▾ auto-assign            (2)  │  ← tag section, collapsible
│   ┌────────────────────────┐  │
│   │ POST /assign         ● │  │  ← ● = selected
│   │ GET  /status           │  │
│   └────────────────────────┘  │
│                                │
│ ▾ products               (8)  │
│   ┌────────────────────────┐  │
│   │ GET  /list              │  │
│   │ POST /create            │  │
│   │ GET  /{id}              │  │
│   │ PUT  /{id}              │  │
│   │ PATCH /{id}/status      │  │
│   │ DELETE /{id}            │  │
│   │ GET  /categories        │  │
│   │ POST /bulk              │  │
│   └────────────────────────┘  │
│                                │
│ ▾ webhooks               (2)  │
│   ┌────────────────────────┐  │
│   │ POST /hook              │  │
│   │ DELETE /hook/{id}       │  │
│   └────────────────────────┘  │
│                                │
│ ▾ untagged               (2)  │
│   ┌────────────────────────┐  │
│   │ GET  /health            │  │
│   │ GET  /version           │  │
│   └────────────────────────┘  │
│                                │
└────────────────────────────────┘
```

Method badges use the same color scheme as Workbench:
- `GET` = green (#22c55e)
- `POST` = amber (#f59e0b)
- `PUT` = blue (#3b82f6)
- `PATCH` = purple (#8b5cf6)
- `DELETE` = red (#ef4444)

Deprecated endpoints:
```
│   │ ~~GET  /legacy~~  ⚠      │  │  ← strikethrough + warning badge
```

---

## 7. Endpoint Detail View

The main documentation and testing interface for a single endpoint:

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  POST   /v1/auto-assign/assign                                      │
│  Assign a product to a sales representative                         │
│                                                          [▾ v3.2.1] │
│                                                                     │
│ ┌─ Host & Auth ───────────────────────────────────────────────────┐ │
│ │ Host: [Inherited ▾] https://api.sales.example.com              │ │
│ │ Auth: [Global ▾]    OAuth2 (sales-api-profile)                 │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ ┌─ Parameters ────────────────────────────────────────────────────┐ │
│ │                                                                 │ │
│ │  PATH PARAMETERS                                                │ │
│ │  (none)                                                         │ │
│ │                                                                 │ │
│ │  QUERY PARAMETERS                                               │ │
│ │  ┌──────────┬──────────┬────────────┬──────────────────────┐    │ │
│ │  │ Name     │ Type     │ Value      │ Description          │    │ │
│ │  ├──────────┼──────────┼────────────┼──────────────────────┤    │ │
│ │  │ region   │ string   │ [us-west ] │ Filter by region     │    │ │
│ │  │ limit    │ integer  │ [50      ] │ Max results          │    │ │
│ │  │ offset   │ integer  │ [0       ] │ Pagination offset    │    │ │
│ │  └──────────┴──────────┴────────────┴──────────────────────┘    │ │
│ │                                                                 │ │
│ │  HEADER PARAMETERS                                              │ │
│ │  ┌──────────────┬──────────┬────────────┬──────────────────┐    │ │
│ │  │ Name         │ Type     │ Value      │ Description      │    │ │
│ │  ├──────────────┼──────────┼────────────┼──────────────────┤    │ │
│ │  │ X-Request-Id │ string   │ [auto-gen] │ Correlation ID   │    │ │
│ │  │ X-Tenant-Id *│ string   │ [        ] │ Tenant identifier│    │ │
│ │  └──────────────┴──────────┴────────────┴──────────────────┘    │ │
│ │  * = required                                                   │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ ┌─ Request Body  (application/json) ─────────────────────────────┐ │
│ │                                                                 │ │
│ │  {                                                              │ │
│ │    "productId": "string",               ← editable             │ │
│ │    "salesRepId": "string",                                      │ │
│ │    "priority": 1,                                               │ │
│ │    "metadata": {                                                │ │
│ │      "source": "string",                                       │ │
│ │      "tags": ["string"]                                        │ │
│ │    }                                                            │ │
│ │  }                                                              │ │
│ │                                                                 │ │
│ │  Schema: productId (string, required), salesRepId (string,      │ │
│ │  required), priority (integer, default: 1), metadata (object)   │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│                                         [Try It]  [Copy as cURL]   │
│                                                                     │
│ ┌─ Responses ─────────────────────────────────────────────────────┐ │
│ │                                                                 │ │
│ │  ▾ 200 — Success                                                │ │
│ │    {                                                            │ │
│ │      "assignmentId": "string",                                  │ │
│ │      "status": "assigned",                                      │ │
│ │      "assignedAt": "2026-04-18T00:00:00Z"                      │ │
│ │    }                                                            │ │
│ │                                                                 │ │
│ │  ▸ 400 — Bad Request                                            │ │
│ │  ▸ 401 — Unauthorized                                           │ │
│ │  ▸ 404 — Product Not Found                                      │ │
│ │  ▸ 500 — Internal Server Error                                  │ │
│ │                                                                 │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 8. Host & Auth Bar

Detailed view of the strategy selection bar:

```
┌─ Host & Auth ─────────────────────────────────────────────────────────┐
│                                                                       │
│  Host                                                                 │
│  ┌─────────────┐  ┌────────────────────────────────────────────────┐  │
│  │ Inherited ▾ │  │ https://api.sales.example.com/v1              │  │
│  └─────────────┘  └────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────┐                              │
│  │ ○ Global     (pick Workbench env)   │  ← dropdown options         │
│  │ ● Inherited  (from spec servers)    │                              │
│  │ ○ Hardcoded  (type custom URL)      │                              │
│  └─────────────────────────────────────┘                              │
│                                                                       │
│  Auth                                                                 │
│  ┌─────────────┐  ┌────────────────────────────────────────────────┐  │
│  │ Global    ▾ │  │ OAuth2 — "sales-api-profile" (Client Creds)   │  │
│  └─────────────┘  └────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────┐                              │
│  │ ● Global     (app auth profile)     │  ← dropdown options         │
│  │ ○ Inherited  (from spec security)   │                              │
│  │ ○ Hardcoded  (configure inline)     │                              │
│  └─────────────────────────────────────┘                              │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

When "Inherited" is selected for Host, and the spec has multiple servers:

```
│  Host                                                                 │
│  ┌─────────────┐  ┌──────────────────────────────────┐                │
│  │ Inherited ▾ │  │ Server: [Production          ▾]  │                │
│  └─────────────┘  │  ○ Production — https://api...   │                │
│                    │  ● Staging — https://staging...  │                │
│                    └──────────────────────────────────┘                │
```

When "Hardcoded" is selected for Auth:

```
│  Auth                                                                 │
│  ┌─────────────┐  ┌────────────────────────────────────────────────┐  │
│  │ Hardcoded ▾ │  │ Type: [Bearer ▾]  Token: [eyJhbGciOi...     ] │  │
│  └─────────────┘  └────────────────────────────────────────────────┘  │
```

---

## 9. Try It Response

After clicking "Try It", the response appears below the action buttons:

```
│                                         [Try It]  [Copy as cURL]   │
│                                                                     │
│ ┌─ Response ──────────────────────────────────────────────────────┐ │
│ │                                                                 │ │
│ │  200 OK  •  142ms  •  1.2 KB                                    │ │
│ │                                                                 │ │
│ │  [Body]  [Headers]                                               │ │
│ │                                                                 │ │
│ │  Body:                                                          │ │
│ │  ┌───────────────────────────────────────────────────────────┐  │ │
│ │  │ ▾ {                                                       │  │ │
│ │  │     "assignmentId": "asgn-a1b2c3",                       │  │ │
│ │  │   ▾ "status": "assigned",                                │  │ │
│ │  │     "assignedAt": "2026-04-18T10:23:45Z",                │  │ │
│ │  │   ▾ "product": {                                         │  │ │
│ │  │         "id": "prod-001",                                │  │ │
│ │  │         "name": "Enterprise Suite"                       │  │ │
│ │  │     },                                                   │  │ │
│ │  │   ▾ "salesRep": {                                        │  │ │
│ │  │         "id": "rep-042",                                 │  │ │
│ │  │         "name": "Jane Smith"                             │  │ │
│ │  │     }                                                    │  │ │
│ │  │   }                                                      │  │ │
│ │  └───────────────────────────────────────────────────────────┘  │ │
│ │                                                                 │ │
│ └─────────────────────────────────────────────────────────────────┘ │

│  Headers tab:                                                       │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  content-type         application/json; charset=utf-8         │  │
│  │  x-request-id         abc-123-def-456                         │  │
│  │  x-ratelimit-remaining  98                                    │  │
│  │  cache-control        no-cache                                │  │
│  └───────────────────────────────────────────────────────────────┘  │
```

Error state:

```
│ ┌─ Response ──────────────────────────────────────────────────────┐ │
│ │                                                                 │ │
│ │  ⚠ Network Error                                                │ │
│ │                                                                 │ │
│ │  Could not connect to https://api.sales.example.com             │ │
│ │  Check that the host is correct and reachable.                  │ │
│ │                                                                 │ │
│ └─────────────────────────────────────────────────────────────────┘ │
```

Loading state:

```
│ ┌─ Response ──────────────────────────────────────────────────────┐ │
│ │                                                                 │ │
│ │  ⏳ Sending request...                                          │ │
│ │                                                                 │ │
│ └─────────────────────────────────────────────────────────────────┘ │
```

---

## 10. cURL Preview Popover

Appears as a popover/modal when clicking "Copy as cURL":

```
┌──────────────────────────────────────────────────────────┐
│ cURL Command                                   [✕ Close] │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  curl -X POST \                                          │
│    'https://api.sales.example.com/v1/auto-assign/ \      │
│     assign?region=us-west&limit=50' \                    │
│    -H 'Content-Type: application/json' \                 │
│    -H 'Authorization: Bearer eyJhbGciOiJSUz...' \       │
│    -H 'X-Request-Id: auto-gen' \                         │
│    -H 'X-Tenant-Id: tenant-001' \                        │
│    -d '{                                                 │
│      "productId": "prod-001",                            │
│      "salesRepId": "rep-042",                            │
│      "priority": 1,                                      │
│      "metadata": {                                       │
│        "source": "api-catalog",                          │
│        "tags": ["auto"]                                  │
│      }                                                   │
│    }'                                                    │
│                                                          │
│  ────────────────────────────────────────────────────    │
│  Format:  ○ Single-line   ● Multi-line                   │
│                                                          │
│  [Copy to Clipboard ✓]                                   │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

After clicking "Copy to Clipboard", the button briefly shows a checkmark
confirmation before reverting.

---

## 11. Import Modal

Triggered by `[+ Import Spec]` in sidebar or welcome page:

### Step 1 — File Selection

```
┌──────────────────────────────────────────────────────────┐
│ Import OpenAPI Specification                   [✕ Close] │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Drop a file here or click to browse                     │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │                                                    │  │
│  │           📄 Drag & drop .yaml or .json            │  │
│  │                                                    │  │
│  │              [Browse Files]                        │  │
│  │                                                    │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  Supported: OpenAPI 3.0, 3.1, Swagger 2.0               │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Step 2 — Preview & Confirm

```
┌──────────────────────────────────────────────────────────┐
│ Import OpenAPI Specification                   [✕ Close] │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ✅ Valid OpenAPI 3.0.3 specification                     │
│     (also detects: Swagger 2.0, OpenAPI 3.1.x)           │
│                                                          │
│  📄 sales-product-api.yaml                               │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Title:       Sales Product API                    │  │
│  │  Version:     3.2.1                                │  │
│  │  Description: REST API for sales product           │  │
│  │               auto-assignment microservice          │  │
│  │                                                    │  │
│  │  Servers:                                          │  │
│  │    • https://api.sales.example.com (Production)    │  │
│  │    • https://staging.sales.example.com (Staging)   │  │
│  │                                                    │  │
│  │  Endpoints:                                        │  │
│  │    auto-assign    2 endpoints                      │  │
│  │    products       8 endpoints                      │  │
│  │    webhooks       2 endpoints                      │  │
│  │    (untagged)     2 endpoints                      │  │
│  │    ─────────────────────────                       │  │
│  │    Total:        14 endpoints                      │  │
│  │                                                    │  │
│  │  Security Schemes:                                 │  │
│  │    • BearerAuth (HTTP Bearer / JWT)                │  │
│  │    • ApiKeyAuth (API Key in header)                │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ⚠ 1 warning:                                            │
│    • 2 endpoints have no operationId (names auto-        │
│      generated from method + path)                       │
│                                                          │
│                          [Cancel]  [Import]               │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Re-import Variant (existing API detected)

```
│  ⚠ "Sales Product API" already exists in catalog         │
│                                                          │
│  Current version: v3.1.0 (imported Mar 28, 2026)         │
│  New version:     v3.2.1                                  │
│                                                          │
│  Changes detected:                                       │
│    + 2 new endpoints (auto-assign tag)                   │
│    ~ 1 changed endpoint (PUT /products/{id})             │
│    - 1 removed endpoint (DELETE /products/bulk)          │
│                                                          │
│            [Cancel]  [Import as New]  [Update Existing]   │
```

### Validation Error State

```
│  ❌ Invalid specification                                 │
│                                                          │
│  📄 broken-spec.yaml                                     │
│                                                          │
│  Errors:                                                 │
│    • Line 45: Missing required field "info.title"        │
│    • Line 78: Invalid $ref "#/components/schemas/Foo"    │
│      — referenced schema does not exist                  │
│                                                          │
│  Please fix the specification and try again.             │
│                                                          │
│                                      [Cancel]            │
```

---

## 12. Overview Page

Shown when an API entry is selected but no specific endpoint:

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  📋 Sales Product API                                               │
│  v3.2.1  •  Last imported Apr 15, 2026  •  14 endpoints            │
│                                                                     │
│  ──────────────────────────────────────────────────────────────     │
│                                                                     │
│  REST API for the sales product auto-assignment microservice.       │
│  Manages product assignments, sales rep allocation, and webhook     │
│  notifications for downstream systems.                              │
│                                                                     │
│  ┌─ Servers ──────────────────────────────────────────────────────┐ │
│  │  Production  https://api.sales.example.com/v1                  │ │
│  │  Staging     https://staging.sales.example.com/v1              │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌─ Endpoints by Tag ────────────────────────────────────────────┐ │
│  │                                                                │ │
│  │  auto-assign   ██░░░░░░░░░░░░░░░░░░  2 endpoints    (14%)    │ │
│  │  products      ████████████████░░░░  8 endpoints    (57%)    │ │
│  │  webhooks      ██░░░░░░░░░░░░░░░░░░  2 endpoints    (14%)    │ │
│  │  untagged      ██░░░░░░░░░░░░░░░░░░  2 endpoints    (14%)    │ │
│  │                                                                │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌─ Methods ─────────────────────────────────────────────────────┐ │
│  │                                                                │ │
│  │  GET     ██████████████████    6                               │ │
│  │  POST    ██████████           4                               │ │
│  │  PUT     █████                2                               │ │
│  │  PATCH   ██                   1                               │ │
│  │  DELETE  ██                   1                               │ │
│  │                                                                │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌─ Configuration ───────────────────────────────────────────────┐ │
│  │  Host: Inherited → Production server                           │ │
│  │  Auth: Global → "sales-api-profile" (OAuth2 Client Creds)     │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  [Re-import]  [Export Spec]  [Version History]  [Send → Workbench] │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 13. Version History Modal

Triggered from context menu → "Version History" or overview page:

```
┌──────────────────────────────────────────────────────────┐
│ Sales Product API — Version History            [✕ Close] │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │                                                    │  │
│  │  ● v3.2.1 (current)                               │  │
│  │    Imported: Apr 15, 2026, 2:30 PM                 │  │
│  │    Note: "Added auto-assign endpoints"             │  │
│  │                                          [Diff ▾]  │  │
│  │                                                    │  │
│  │  ○ v3.1.0                                          │  │
│  │    Imported: Mar 28, 2026, 10:15 AM                │  │
│  │    Note: "New webhook support"                     │  │
│  │                              [Diff ▾]  [Restore]   │  │
│  │                                                    │  │
│  │  ○ v3.0.0                                          │  │
│  │    Imported: Feb 10, 2026, 4:45 PM                 │  │
│  │    Note: "Initial import"                          │  │
│  │                              [Diff ▾]  [Restore]   │  │
│  │                                                    │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  [Re-import New Version]                                 │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## 14. Version Diff View

Appears when clicking [Diff] on a version. Shows comparison against current:

```
┌──────────────────────────────────────────────────────────┐
│ Diff: v3.1.0 → v3.2.1                         [✕ Close] │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Summary: +2 added  ~1 changed  -1 removed              │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │                                                    │  │
│  │  + POST /v1/auto-assign/assign           (new)     │  │
│  │    Summary: Assign product to sales rep             │  │
│  │    Tags: auto-assign                                │  │
│  │                                                    │  │
│  │  + GET  /v1/auto-assign/status           (new)     │  │
│  │    Summary: Check assignment status                 │  │
│  │    Tags: auto-assign                                │  │
│  │                                                    │  │
│  │  ─────────────────────────────────────────────     │  │
│  │                                                    │  │
│  │  ~ PUT  /v1/products/{id}              (changed)   │  │
│  │    - Removed parameter: "legacyField" (query)      │  │
│  │    + Added parameter: "priority" (query, integer)   │  │
│  │    ~ Changed requestBody:                           │  │
│  │      + Added field: "metadata" (object)             │  │
│  │                                                    │  │
│  │  ─────────────────────────────────────────────     │  │
│  │                                                    │  │
│  │  - DELETE /v1/products/bulk              (removed)  │  │
│  │    Was: Bulk delete products                        │  │
│  │                                                    │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│                                              [Close]     │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

Color coding:
- Green (`+`) for added endpoints/fields
- Amber/yellow (`~`) for changed endpoints
- Red (`-`) for removed endpoints/fields

---

## Interaction Summary

| User Action | Result |
|---|---|
| Click `Catalog` tab in sidebar | Shows catalog sidebar + main panel |
| Click `[+ Import Spec]` | Opens import modal |
| Click API name in sidebar | Shows overview page (or endpoint nav + last endpoint) |
| Right-click API in sidebar | Context menu with versions, config, actions |
| Click endpoint in nav strip | Shows endpoint detail view |
| Click API name at top of endpoint nav | Returns to overview page |
| Fill params + click `[Try It]` | Executes request, shows response below |
| Click `[Copy as cURL]` | Opens cURL popover with formatted command |
| Click `[◀]` on endpoint nav | Collapses nav, detail takes full width |
| Search in endpoint nav | Filters endpoints by path/summary/operationId |
| Right-click endpoint in nav | Copy as cURL (with defaults) |

---

_Created: 2026-04-18_
