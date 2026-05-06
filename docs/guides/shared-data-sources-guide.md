# Shared Data Sources Guide

Create reusable data sources that can be linked to multiple tests — edit once, update everywhere.

## Overview

**Shared Data Sources** are centrally managed data sets that multiple tests can use. Changes to a shared data source automatically apply to all linked tests.

## Why Use Shared Data Sources?

### Without Shared Data Sources

```
Test 1: Create User
  Data: user1, user2, user3...

Test 2: Update User  
  Data: user1, user2, user3...  ← Duplicated!

Test 3: Delete User
  Data: user1, user2, user3...  ← Duplicated again!
```

Problem: Updating user data requires editing every test.

### With Shared Data Sources

```
Shared Data Source: Test Users
  Data: user1, user2, user3...

Test 1: Create User → Links to "Test Users"
Test 2: Update User → Links to "Test Users"
Test 3: Delete User → Links to "Test Users"
```

Benefit: Update data once, all tests use new data.

## Creating Shared Data Sources

### From the Data Sources Tab

1. Go to **Harness** → **Data Sources** tab
2. Click **+ New Shared Data Source**
3. Configure name and columns
4. Add rows
5. Save

### From an Existing Test

Convert a test's data source to shared:

1. Open test editor
2. Go to **Data** tab
3. Click **Convert to Shared**
4. Name the shared data source
5. Confirm

The test now links to the new shared source.

## Configuring Shared Data Sources

### Columns

Define columns with names and types:

```
┌──────────────┬──────────────┬─────────────┐
│ Column Name  │ Description  │ Type        │
├──────────────┼──────────────┼─────────────┤
│ userId       │ User ID      │ text        │
│ email        │ Email addr   │ text        │
│ expectedCode │ HTTP status  │ number      │
└──────────────┴──────────────┴─────────────┘
```

### Rows

Add data rows:

```
┌──────────┬─────────────────────┬──────────────┐
│ userId   │ email               │ expectedCode │
├──────────┼─────────────────────┼──────────────┤
│ usr_001  │ john@example.com    │ 200          │
│ usr_002  │ jane@example.com    │ 200          │
│ usr_003  │ invalid             │ 400          │
└──────────┴─────────────────────┴──────────────┘
```

### Tags

Add tags to rows for filtering:

```
Row 1: tags = [smoke, happy-path]
Row 2: tags = [regression]
Row 3: tags = [error-case, negative]
```

## Linking Tests to Shared Data Sources

### When Creating a Test

1. Open test editor
2. Go to **Data** tab
3. Click **Use Shared Data Source**
4. Select from available sources
5. Map columns to test variables

### Column Mapping

Map shared columns to test placeholders:

```
Shared Column     →    Test Variable
userId            →    {{userId}} in URL path
email             →    {{email}} in body
expectedCode      →    Expected status assertion
```

### Multiple Tests, Same Source

```
Shared Data Source: "User Test Data"
    │
    ├── Test: Create User
    │     URL: POST /users
    │     Body: {"email": "{{email}}"}
    │
    ├── Test: Get User
    │     URL: GET /users/{{userId}}
    │
    └── Test: Delete User
          URL: DELETE /users/{{userId}}
```

All three tests use the same data rows.

## Managing Shared Data Sources

### Editing

1. Go to **Data Sources** tab
2. Click the shared data source
3. Edit columns, rows, or tags
4. Save

Changes apply to all linked tests.

### Viewing Linked Tests

See which tests use a shared data source:

1. Open the shared data source
2. Click **Linked Tests** tab
3. View list of tests using this source

```
Linked Tests (3):
  - Feature Group: Users / Create User
  - Feature Group: Users / Get User
  - Feature Group: Users / Delete User
```

### Deleting

Delete a shared data source:

1. Open the shared data source
2. Click **Delete**
3. Choose what to do with linked tests:
   - **Copy data to each test**: Tests keep a copy of current data
   - **Unlink only**: Tests have no data (must add new)

## Import & Export

### Import from CSV

1. Click **Import**
2. Select CSV file
3. Map columns
4. Preview and confirm

### Import from JSON

```json
{
  "columns": [
    { "id": "userId", "name": "User ID" },
    { "id": "email", "name": "Email" }
  ],
  "rows": [
    { "userId": "usr_001", "email": "john@example.com" },
    { "userId": "usr_002", "email": "jane@example.com" }
  ]
}
```

### Import from Excel

Upload `.xlsx` files with data in the first sheet.

### Export

Export to CSV, JSON, or Excel:

1. Open shared data source
2. Click **Export**
3. Choose format
4. Save file

### Populate from API

Fetch data from an API endpoint:

1. Click **Populate from API**
2. Configure the request
3. Map response fields to columns
4. Fetch and populate

Example:
```
GET https://api.example.com/test-users

Mapping:
  $.users[*].id → userId
  $.users[*].email → email
```

## Row Filtering

### Tag-Based Filtering

Filter rows by tags when running tests:

```
Tags: smoke
Mode: Any

Runs only rows tagged with "smoke"
```

### Enabling/Disabling Rows

Toggle rows without deleting:

```
☑ Row 1: usr_001 (enabled)
☐ Row 2: usr_002 (disabled - skipped)
☑ Row 3: usr_003 (enabled)
```

## Verify All

Test all rows against the live API:

1. Link a shared data source to a test
2. Click **Verify All**
3. Each row is tested once
4. Results show pass/fail per row

```
Verify Results:
  Row 1 (usr_001): ✓ Pass (145ms)
  Row 2 (usr_002): ✓ Pass (132ms)
  Row 3 (usr_003): ✓ Pass (400 expected, got 400)
```

## Use Cases

### User Test Data

```yaml
name: Test Users
columns:
  - userId
  - userName
  - email
  - role
rows:
  - { userId: "1", userName: "Admin", email: "admin@ex.com", role: "admin" }
  - { userId: "2", userName: "User", email: "user@ex.com", role: "user" }
  - { userId: "3", userName: "Guest", email: "guest@ex.com", role: "guest" }
```

Link to: User CRUD tests, Auth tests, Permission tests

### Product Catalog Data

```yaml
name: Test Products
columns:
  - productId
  - productName
  - price
  - category
rows:
  - { productId: "P001", productName: "Widget", price: "19.99", category: "gadgets" }
  - { productId: "P002", productName: "Gizmo", price: "29.99", category: "gadgets" }
```

Link to: Product search, Cart tests, Order tests

### Error Scenarios

```yaml
name: Error Cases
columns:
  - input
  - expectedError
  - expectedCode
rows:
  - { input: "", expectedError: "required", expectedCode: "400" }
  - { input: "invalid@", expectedError: "invalid email", expectedCode: "400" }
  - { input: "x".repeat(1000), expectedError: "too long", expectedCode: "400" }
```

Link to: Input validation tests

## Tips & Best Practices

### 1. Name Clearly

```
✗ "Data 1", "Test Data"
✓ "User Authentication Data", "Order Error Cases"
```

### 2. Document Columns

Add descriptions to columns:
```
userId: "Unique user identifier from user-service"
expectedCode: "Expected HTTP status code (200, 400, 404, etc.)"
```

### 3. Use Tags for Organization

```
Tags: smoke, regression, critical, edge-case, negative
```

Run subset of rows: `--tags smoke`

### 4. Version Your Data

For major changes, create a new shared data source:
```
User Data v1 (legacy)
User Data v2 (current)
```

### 5. Keep Sources Focused

One shared data source per domain:
```
✓ "User Data", "Product Data", "Order Data"
✗ "All Test Data" (too broad)
```

## Related Guides

- [Parameterized Testing Guide](./parameterized-testing-guide.md) — Data-driven testing
- [Scenarios Guide](./scenarios-guide.md) — Test organization
- [Test Runner Guide](./test-runner-guide.md) — Running tests
