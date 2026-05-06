# Parameterized Testing Guide

Run data-driven tests using data sources — execute one test definition against multiple data rows.

## Overview

**Parameterized testing** lets you define a test once and run it with different data:

```
Test: Create User
URL: POST /users
Body: {"name": "{{name}}", "email": "{{email}}"}

Data Source:
  Row 1: name="John", email="john@example.com"
  Row 2: name="Jane", email="jane@example.com"
  Row 3: name="Bob", email="bob@example.com"

Result: 3 test executions with different data
```

## Creating a Data Source

### In the Test Editor

1. Open a test in the editor
2. Click the **Data** tab
3. Click **+ Add Data Source**

### Data Source Structure

A data source has **columns** and **rows**:

```
┌──────────┬────────────────────────┬─────────┐
│ Column   │ Mapping                │ Type    │
├──────────┼────────────────────────┼─────────┤
│ userId   │ Path: /users/{userId}  │ path    │
│ name     │ Body: $.name           │ body    │
│ email    │ Body: $.email          │ body    │
│ expected │ Validate: $.status     │ validate│
└──────────┴────────────────────────┴─────────┘

┌──────────┬──────────────────────┬────────────┐
│ userId   │ name                 │ email      │
├──────────┼──────────────────────┼────────────┤
│ 1        │ John Doe             │ john@ex.co │
│ 2        │ Jane Smith           │ jane@ex.co │
│ 3        │ Bob Wilson           │ bob@ex.co  │
└──────────┴──────────────────────┴────────────┘
```

## Column Types

### Path Variables

Replace `{variable}` in the URL path:

```
URL: /users/{userId}/posts/{postId}

Columns:
  userId (type: path) → replaces {userId}
  postId (type: path) → replaces {postId}
```

### Query Parameters

Add query string parameters:

```
URL: /search

Columns:
  query (type: param) → adds ?query=value
  limit (type: param) → adds &limit=value
```

### Header Values

Set HTTP headers:

```
Columns:
  authToken (type: header, name: Authorization) → Authorization: value
```

### Body Placeholders

Replace `{{variable}}` in the request body:

```
Body: {"name": "{{name}}", "email": "{{email}}"}

Columns:
  name (type: body) → replaces {{name}}
  email (type: body) → replaces {{email}}
```

### Validation Values

Assert against expected values:

```
Columns:
  expectedStatus (type: validate, path: $.status)
  expectedName (type: validate, path: $.data.name)
```

## Adding Data Rows

### Manual Entry

Click **+ Add Row** and fill in values:

```
┌────────┬────────────┬─────────────────────┐
│ userId │ name       │ email               │
├────────┼────────────┼─────────────────────┤
│ 1      │ John Doe   │ john@example.com    │  [+ Add Row]
└────────┴────────────┴─────────────────────┘
```

### Import from CSV

1. Click **Import**
2. Select a CSV file
3. Map columns to data source columns
4. Preview and confirm

### Import from JSON

```json
[
  { "userId": "1", "name": "John", "email": "john@example.com" },
  { "userId": "2", "name": "Jane", "email": "jane@example.com" }
]
```

### Import from Excel

Upload `.xlsx` files with the same structure.

### Populate from API

Fetch data from an API:

1. Click **Populate from API**
2. Configure the request:
   ```
   GET https://api.example.com/test-data
   ```
3. Map response fields to columns:
   ```
   $.users[*].id → userId
   $.users[*].name → name
   ```
4. Click **Populate**

## Row Management

### Enable/Disable Rows

Toggle rows without deleting:

```
☑ Row 1: John Doe (enabled - will run)
☐ Row 2: Jane Smith (disabled - skipped)
☑ Row 3: Bob Wilson (enabled - will run)
```

### Bulk Operations

Select multiple rows (Ctrl+click, Shift+click):
- **Enable Selected**
- **Disable Selected**
- **Delete Selected**
- **Duplicate Selected**

### Reorder Rows

Drag rows using the handle (⠿) to reorder.

### Row Labels

Add descriptive labels for clarity:

```
Row 1: "Valid user - standard case"
Row 2: "Edge case - long name"
Row 3: "Error case - invalid email"
```

## Row Tags

Categorize rows for selective execution:

```
Row 1: tags=[smoke, critical]
Row 2: tags=[regression]
Row 3: tags=[edge-case]
```

### Filtering by Tags

In the Test Runner:

```
Tags: smoke
Mode: Any (matches rows with "smoke" tag)
```

Or:

```
Tags: smoke, critical
Mode: All (matches rows with BOTH tags)
```

## Distribution Modes

### Sequential

Execute rows in order:
```
Row 1 → Row 2 → Row 3 → Row 1 → Row 2 → ...
```

### Random

Execute rows in random order:
```
Row 2 → Row 1 → Row 3 → Row 3 → Row 1 → ...
```

### Round Robin

Distribute evenly across concurrent requests:
```
Worker 1: Row 1, Row 4, Row 7...
Worker 2: Row 2, Row 5, Row 8...
Worker 3: Row 3, Row 6, Row 9...
```

## Verify All (Pre-Validation)

Test all rows against the live API before running a full performance test:

1. Click **Verify All**
2. Each row is tested once
3. Results show pass/fail per row
4. Fix issues before running under load

## Shared Data Sources

### What are Shared Data Sources?

Data sources that can be used across multiple tests. Edit once, update everywhere.

### Creating a Shared Data Source

1. Go to **Harness** → **Data Sources** tab
2. Click **+ New Shared Data Source**
3. Configure columns and rows
4. Save

### Linking to a Test

In the test's Data tab:

1. Click **Use Shared Data Source**
2. Select from available sources
3. The test now uses the shared data

### Benefits

- **Single source of truth**: Update data in one place
- **Consistency**: All linked tests use the same data
- **Easier maintenance**: No duplicate data management

## Templates

### Export Template

Generate an Excel template from a test:

1. Open test editor
2. Click **Export Template**
3. Three-step wizard:
   - Select path variables
   - Customize column names
   - Preview and download

### Template Structure

The `.xlsx` file has two sheets:

**Data Sheet:**
```
┌──────────┬────────────────┬─────────────────┐
│ userId   │ name           │ expectedStatus  │
├──────────┼────────────────┼─────────────────┤
│ 1        │ Sample Name    │ 200             │
└──────────┴────────────────┴─────────────────┘
```

**Metadata Sheet:**
- Column mappings
- URL pattern
- HTTP method
- Validation config

### Import Template

1. Fill in the Data sheet
2. Keep the Metadata sheet unchanged
3. Import via **Import Template**
4. Tests are created from each row

## Results

### Grouped Results

Results are grouped by data row:

```
Row: userId=1, name="John"
  ✓ Passed (145ms)
  
Row: userId=2, name="Jane"
  ✗ Failed - status 404
  
Row: userId=3, name="Bob"
  ✓ Passed (132ms)
```

### Data Row Summary

Export detailed per-row results:

```bash
redfireforge run test.yaml --data-rows-summary results.json
```

## Tips & Best Practices

### 1. Start with Sample Data

Create a few rows manually, verify they work, then scale up.

### 2. Use Meaningful Labels

```
✗ "Row 1", "Row 2", "Row 3"
✓ "Valid user", "Edge case - max length", "Error - missing email"
```

### 3. Tag Strategically

```
smoke: Quick validation subset
regression: Full test coverage
critical: Must-pass tests
edge-case: Boundary conditions
negative: Error scenarios
```

### 4. Validate Before Load Testing

Always run **Verify All** before performance tests to catch data issues.

### 5. Use Shared Data Sources for Common Data

User lists, product catalogs, and other reusable data should be shared.

## Related Guides

- [Scenarios Guide](./scenarios-guide.md) — Test organization
- [Assertions Guide](./assertions-guide.md) — Validation rules
- [Test Runner Guide](./test-runner-guide.md) — Execution configuration
- [Shared Data Sources Guide](./shared-data-sources-guide.md) — Advanced data sharing
