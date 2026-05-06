# Scenarios Guide

Organize your API tests into Feature Groups, Scenarios, and Tests for structured regression and performance testing.

## Overview

The **Harness** module organizes tests hierarchically:

```
Feature Group: Order Management
├── Scenario: Create Order Flow
│   ├── Test: Create Cart
│   ├── Test: Add Items
│   └── Test: Submit Order
└── Scenario: Order Cancellation
    ├── Test: Get Order
    └── Test: Cancel Order
```

## Key Concepts

### Feature Groups

A **Feature Group** represents a business capability or feature area:
- Groups related scenarios together
- Can define auth that all scenarios inherit
- Linked to specific environment/microservice

### Scenarios

A **Scenario** represents a specific user journey or test case:
- Contains a sequence of tests
- Can override feature group auth
- Can define weights for test distribution

### Tests

A **Test** is a single HTTP request with validation:
- URL, method, headers, body
- Authentication (inherited or custom)
- Assertions and validation rules
- Data source for parameterization

## Creating Feature Groups

### From the UI

1. Go to **Harness** → **Scenarios** tab
2. In the sidebar, select an **Environment** and **Microservice**
3. Type a name in "New Feature Group" input
4. Click **+ New Feature Group**

### Feature Group Settings

Click the gear icon to configure:

| Setting | Description |
|---------|-------------|
| **Name** | Feature group display name |
| **Auth** | Authentication (inherit or custom) |
| **Tags** | Labels for filtering |

## Creating Scenarios

### From the UI

1. Expand a Feature Group
2. Type a name in the "New Scenario" input
3. Click **+ Scenario**

### Scenario Settings

Click the **Auth** button to configure:

| Setting | Description |
|---------|-------------|
| **Name** | Scenario display name |
| **Auth** | Authentication (inherit from feature or custom) |
| **Weight** | Relative frequency in test runs |

## Creating Tests

### From the UI

1. Click **+ Add Test** inside a Scenario
2. The Test Editor modal opens

### Test Configuration

#### Basic Tab

| Field | Description |
|-------|-------------|
| **Name** | Test display name |
| **Method** | HTTP method (GET, POST, PUT, PATCH, DELETE) |
| **URL** | Full URL or path with base URL |

#### Params Tab

Add path variables and query parameters:

```
URL: https://api.example.com/users/{{userId}}?include={{fields}}

Path Variables:
  userId: 123

Query Parameters:
  include: profile,settings
  active: true
```

#### Headers Tab

Add HTTP headers:

```
Content-Type: application/json
Accept: application/json
X-Request-ID: {{$uuid}}
```

#### Body Tab

For POST/PUT/PATCH requests:

```json
{
  "name": "{{userName}}",
  "email": "{{userEmail}}",
  "role": "user"
}
```

#### Auth Tab

Configure authentication:
- **Inherit from Scenario** — use scenario's auth
- **Custom** — define test-specific auth

#### Validation Tab

Configure response validation:
- **Mode**: None, Full JSON Match, or Selective Fields
- **Assertions**: Status code, JSONPath, regex, etc.
- **Expected Fields**: Specific paths to validate

## Organizing Tests

### Drag and Drop

Reorder and move items:

- **Drag scenarios** between feature groups
- **Drag tests** between scenarios
- **Reorder** within the same container

A blue indicator line shows where items will be placed.

### Naming Conventions

Recommended patterns:

```
Feature Groups:
  User Management
  Order Processing
  Payment Handling

Scenarios:
  Happy Path - Create User
  Error - Invalid Email
  Edge Case - Long Name

Tests:
  POST /users - Create User
  GET /users/{id} - Get User
  DELETE /users/{id} - Delete User
```

## Import & Export

### Export

Export at any level:

1. **Feature Group**: Right-click → Export
2. **Scenario**: Right-click → Export
3. **Test**: Right-click → Export

Files are named: `{env}-{svc}-{level}-{name}-{timestamp}.json`

### Import

Import into a feature group:

1. Right-click the feature group → **Import**
2. Select a JSON file
3. Resolve any conflicts (skip, overwrite, keep both)

### Conflict Resolution

When importing, conflicts are detected:

| Conflict | Options |
|----------|---------|
| **ID Match** | Same ID exists → Skip, Overwrite, Keep Both |
| **Name Match** | Same name exists → Skip, Overwrite, Keep Both |

"Keep Both" creates new items with fresh IDs.

## Versioning

### Auto-Save Versions

Tests automatically save versions when:
- Validation rules change
- Response structure changes significantly

### Manual Versioning

Click **Save as Version** to create a named snapshot.

### Version History

View, compare, and restore:

1. Open test editor
2. Click **Version History**
3. Select two versions to compare
4. Click **Restore** to revert

## Tips & Best Practices

### 1. Group by Business Feature

```
❌ Bad: "API Tests", "POST Tests", "GET Tests"
✓ Good: "User Management", "Order Processing", "Authentication"
```

### 2. Use Descriptive Scenario Names

```
❌ Bad: "Test 1", "Test 2"
✓ Good: "Happy Path - New User Registration"
✓ Good: "Error - Duplicate Email"
```

### 3. One Test, One Purpose

Each test should validate one specific behavior:

```
❌ Bad: "Create and Update and Delete User" (one test)
✓ Good: "Create User", "Update User", "Delete User" (three tests)
```

### 4. Use Auth Inheritance

Define auth at the Feature Group level, not in every test:

```
Feature Group: User API
  Auth: OAuth2 (configured once)
  
  All tests inherit → no repeated config
```

### 5. Tag for Filtering

Use tags to categorize:
- `smoke` — Quick validation tests
- `regression` — Full regression suite
- `critical` — Must-pass tests
- `slow` — Long-running tests

## Converting from Requests

Turn ad-hoc requests into tests:

1. In **Requests**, right-click a request
2. Select **Send to Harness**
3. Choose or create a Feature Group and Scenario
4. The request becomes a test with all settings preserved

## Related Guides

- [Getting Started](./getting-started.md) — Quick tutorial
- [Test Runner Guide](./test-runner-guide.md) — Run performance tests
- [Request Auth Guide](./request-auth-guide.md) — Authentication
- [Assertions Guide](./assertions-guide.md) — Validation rules
- [Parameterized Testing Guide](./parameterized-testing-guide.md) — Data-driven tests
