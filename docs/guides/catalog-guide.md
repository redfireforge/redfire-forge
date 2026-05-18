# API Catalog Guide

Browse, explore, and test APIs from OpenAPI specifications — import specs, test endpoints, and export to requests.

## Overview

The **API Catalog** lets you:
- Import OpenAPI/Swagger specifications
- Browse endpoints with documentation
- Test endpoints directly
- Export to Requests collection

## Getting Started

### Importing a Specification

1. Go to **Catalog** tab
2. Click **+ Import Spec**
3. Choose import method:
   - **URL**: Paste OpenAPI spec URL
   - **File**: Upload `.json` or `.yaml` file
   - **Paste**: Paste spec content directly

### Supported Formats

| Format | Versions |
|--------|----------|
| OpenAPI | 3.0.x, 3.1.x |
| Swagger | 2.0 |

## Catalog Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ API Catalog                                          [+Import]  │
├─────────────┬───────────────────────────────────────────────────┤
│             │                                                   │
│  API List   │              Endpoint Details                     │
│             │                                                   │
│  ▼ PetStore │  GET /pets                                        │
│    ▸ pets   │  Returns all pets from the system                │
│    ▸ users  │                                                   │
│             │  Parameters:                                      │
│  ▼ UserAPI  │    limit: integer (query)                        │
│    ▸ auth   │    status: string (query)                        │
│    ▸ users  │                                                   │
│             │  Responses:                                       │
│             │    200: List of pets                              │
│             │    400: Invalid status value                      │
│             │                                                   │
│             │  [Try It]  [Send to Requests]                     │
│             │                                                   │
└─────────────┴───────────────────────────────────────────────────┘
```

## Browsing APIs

### API List

Imported specs appear in the left panel:
- Click to expand/collapse
- Endpoints grouped by tag
- Search to filter

### Endpoint Card

Each endpoint shows:

| Section | Content |
|---------|---------|
| **Method/Path** | `GET /pets/{petId}` |
| **Summary** | Brief description |
| **Description** | Full documentation |
| **Parameters** | Path, query, header params |
| **Request Body** | Schema and examples |
| **Responses** | Status codes and schemas |

### Parameter Details

```
┌───────────────────────────────────────────────────────┐
│ Parameters                                            │
├───────────┬─────────┬──────────┬─────────────────────┤
│ Name      │ In      │ Type     │ Description         │
├───────────┼─────────┼──────────┼─────────────────────┤
│ petId *   │ path    │ integer  │ ID of pet to fetch  │
│ include   │ query   │ string   │ Extra fields        │
└───────────┴─────────┴──────────┴─────────────────────┘
* Required
```

### Schema Display

Complex schemas shown with expandable tree:

```
▼ Pet (object)
    id: integer (required)
    name: string (required)
  ▼ category: object
      id: integer
      name: string
    tags: array of Tag
    status: enum [available, pending, sold]
```

## Try It Mode

### Testing an Endpoint

1. Click **Try It** on an endpoint
2. Fill in parameters:
   - Path variables
   - Query parameters
   - Headers
   - Request body
3. Click **Execute**
4. View response

### Host Strategy

Choose how the base URL is resolved:

| Strategy | Description |
|----------|-------------|
| **From Spec** | Uses server URLs defined in the OpenAPI spec |
| **Environment** | Uses base URL from a linked microservice's environment |
| **Custom URL** | Enter any base URL manually |

> **Host Warning**: When using "From Spec" with a placeholder URL (e.g., `example.com`, `.test`, `.local`), an amber warning banner appears: *"Server URL 'api.example.com' from the spec is likely a placeholder. Switch to 'Custom URL' or 'Environment' mode to use your real server."*

### Parameter Input

```
┌────────────────────────────────────────────┐
│ Try It: POST /pets                         │
├────────────────────────────────────────────┤
│ Headers                                    │
│ ┌──────────────┬─────────────────────────┐ │
│ │ Content-Type │ application/json        │ │
│ └──────────────┴─────────────────────────┘ │
│                                            │
│ Body                                       │
│ ┌──────────────────────────────────────┐   │
│ │ {                                    │   │
│ │   "name": "Fluffy",                  │   │
│ │   "status": "available"              │   │
│ │ }                                    │   │
│ └──────────────────────────────────────┘   │
│                                            │
│ Server: [Production ▼]                     │
│                                            │
│ [Cancel]                      [Execute]    │
└────────────────────────────────────────────┘
```

### Server Selection

If the spec defines multiple servers:

```yaml
servers:
  - url: https://api.example.com
    description: Production
  - url: https://staging.api.example.com
    description: Staging
```

Select which server to use for requests.

## Send to Harness

### Direct Export to Test Harness

Export an endpoint directly from the Catalog to the Harness as a test scenario:

1. Click **Send to Harness** on an endpoint (in Try It mode or the Execute bar)
2. Choose the target Feature Group and Scenario (or create new ones)
3. Select environment and microservice
4. Click **Confirm** — the test is created and the Harness tab opens

### What's Included

- **URL**: Full URL with path variables resolved
- **Method**: HTTP method from the endpoint
- **Headers**: Declared header parameters
- **Body**: Auto-generated from schema (see below)
- **Query Parameters**: From endpoint parameter definitions
- **Path Parameters**: Declared path variables with empty values for you to fill
- **Catalog Metadata**: Original path, operationId, source spec, version

### Schema-Based Body Generation

When exporting POST/PUT/PATCH endpoints to Harness, the request body is automatically populated:

| Priority | Source | Example |
|----------|--------|---------|
| 1st | Content-type level `example` | Explicit example in spec |
| 2nd | Schema-level `example` | `schema: { example: {...} }` |
| 3rd | **Generated from schema** | Auto-built from properties/types |

The schema generator handles:
- **Objects** with nested properties (recursive)
- **Arrays** with typed items
- **Enums** (picks first value, e.g., `"available"`)
- **Primitives** — `string` → `"string"`, `integer` → `0`, `boolean` → `true`
- **Date formats** — `"2024-01-01T00:00:00Z"` for date-time, `"2024-01-01"` for date
- **Default values** — used when specified in schema

This prevents empty-body errors (405/400) when testing POST endpoints after export.

## Send to Requests

### Exporting an Endpoint

1. Click **Send to Requests** on an endpoint
2. Choose destination:
   - Existing collection
   - New collection
3. Request is created with all details

### What's Exported

- URL with path variables
- Method
- Headers (Content-Type, Accept)
- Body schema as template
- Authentication if defined

### Batch Export

Export multiple endpoints at once:

1. Right-click an API or tag
2. Select **Export All**
3. Choose destination collection
4. All endpoints are created

## Managing APIs

### Refreshing a Spec

If the spec URL changed:

1. Right-click the API
2. Select **Refresh**
3. Spec is re-fetched

### Updating a Spec

Replace with a new version:

1. Right-click the API
2. Select **Update Spec**
3. Import new file/URL

### Removing an API

1. Right-click the API
2. Select **Delete**
3. Confirm removal

## Search & Filter

### Global Search

Search across all APIs:
- Endpoint paths
- Descriptions
- Parameter names

### Method Filter

Show only specific methods:

```
[✓] GET  [✓] POST  [✓] PUT  [✓] DELETE
```

### Tag Filter

Filter by OpenAPI tags:

```
Tags: [pets] [users] [orders]
```

## Authentication

### Spec-Defined Auth

If the spec defines security schemes:

```yaml
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
```

The Catalog shows required auth and prompts for credentials in Try It mode.

### Setting Credentials

1. Click **Configure Auth** on the API
2. Enter credentials for each scheme
3. Credentials are saved for future requests

## Tips & Best Practices

### 1. Import from URL for Live Updates

Import by URL allows easy refreshing when the spec changes.

### 2. Use Try It Before Exporting

Test endpoints in Try It mode to understand parameters before exporting.

### 3. Export Related Endpoints Together

Export an entire tag to maintain grouping in your collection.

### 4. Check Server URLs

Ensure the correct server is selected in multi-environment specs. Watch for the **amber host warning** — it appears when the spec contains placeholder domains that won't resolve (e.g., `api.petstore.example.com`). Switch to "Custom URL" or "Environment" mode to point at your real server.

### 5. Review Generated Bodies

Exported request bodies are templates — fill in actual values before sending. When bodies are auto-generated from schema, they use sensible defaults (`"string"`, `0`, `true`) that should be replaced with real data.

### 6. Use Send to Harness for Quick Test Setup

Instead of exporting to Requests first, use **Send to Harness** to jump straight into testing:
- Body is auto-populated from schema
- Query parameters are pre-filled
- You can start assertions immediately

## Related Guides

- [Catalog Import Guide](./catalog-import-guide.md) — Import details
- [Requests Guide](./requests-guide.md) — Working with requests
- [Environments Guide](./environments-guide.md) — Multi-environment testing
- [Getting Started](./getting-started.md) — Quick start
