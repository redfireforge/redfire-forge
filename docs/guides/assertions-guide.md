# Assertions Guide

Validate API responses with powerful assertion types — status codes, JSONPath, regex, timing, and more.

## Overview

**Assertions** are validation rules that run on every request. They verify that:
- Status codes are correct
- Response data matches expectations
- Performance meets SLAs
- Headers are present and correct

## Assertion Types

### Status Code

Validate the HTTP status code.

```
Type: Status
Expected: 200
```

**Supported formats:**
- Exact match: `200`
- Range: `200-299`
- Pattern: `2xx`, `4xx`, `5xx`

**Examples:**
```
200        → Exactly 200
201        → Exactly 201
2xx        → Any 2xx (200, 201, 204, etc.)
200-299    → Any status between 200 and 299
```

### JSONPath

Validate values at specific JSON paths.

```
Type: JSONPath
Path: $.data.user.name
Operator: equals
Value: John Doe
```

**Operators:**

| Operator | Description | Example |
|----------|-------------|---------|
| `equals` | Exact match | `$.name` equals `"John"` |
| `not equals` | Not equal | `$.status` not equals `"error"` |
| `contains` | Substring match | `$.email` contains `"@"` |
| `starts with` | Prefix match | `$.id` starts with `"usr_"` |
| `ends with` | Suffix match | `$.file` ends with `".pdf"` |
| `exists` | Path exists | `$.token` exists |
| `not exists` | Path doesn't exist | `$.error` not exists |
| `is null` | Value is null | `$.deletedAt` is null |
| `is not null` | Value is not null | `$.id` is not null |
| `is empty` | Empty string/array | `$.items` is empty |
| `is not empty` | Non-empty | `$.items` is not empty |

### Numeric

Numeric comparisons for values.

```
Type: Numeric
Path: $.data.count
Operator: >=
Value: 1
```

**Operators:**

| Operator | Description |
|----------|-------------|
| `>` | Greater than |
| `>=` | Greater than or equal |
| `<` | Less than |
| `<=` | Less than or equal |
| `==` | Equal |
| `!=` | Not equal |

**Examples:**
```
$.price > 0
$.count >= 1
$.total <= 100
$.items.length == 10
```

### Regex

Match values against regular expressions.

```
Type: Regex
Path: $.email
Pattern: ^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$
```

**Common patterns:**

| Pattern | Matches |
|---------|---------|
| `^[a-z]+$` | Lowercase letters only |
| `^\d{4}-\d{2}-\d{2}$` | Date YYYY-MM-DD |
| `^[0-9a-f]{8}-[0-9a-f]{4}-...` | UUID |
| `^https?://` | URL |

### Header

Validate response headers.

```
Type: Header
Name: Content-Type
Operator: contains
Value: application/json
```

**Operators:**
- `equals` — Exact match
- `contains` — Substring match
- `exists` — Header is present
- `not exists` — Header is absent
- `regex` — Pattern match

### Response Time

Validate response time against SLAs.

```
Type: Response Time
Operator: <=
Value: 500  (milliseconds)
```

**Common SLAs:**
```
<= 200ms   → Fast response
<= 500ms   → Normal response
<= 1000ms  → Acceptable slow
<= 3000ms  → Maximum tolerance
```

## Adding Assertions

### In Test Editor

1. Open the test editor
2. Go to **Validation** tab
3. Click **+ Add Assertion**
4. Configure the assertion type and values

### In Workflow HTTP Nodes

1. Click the HTTP node
2. Open **Validation** section
3. Add assertions to the node

## Assertion Builder

### Visual JSONPath Builder

Build paths by clicking on response fields:

1. Click **Fetch Response** to get sample data
2. Click fields in the JSON tree
3. Path is automatically generated

```json
{
  "data": {
    "user": {        ← Click to get $.data.user
      "name": "John" ← Click to get $.data.user.name
    }
  }
}
```

### Regex Builder

Build regex patterns with helpers:

1. Click **Build Regex**
2. Select from pattern library
3. Preview matches against sample data

**Pattern library includes:**
- Email validation
- Phone numbers
- URLs
- UUIDs
- Dates
- Credit cards
- IP addresses

## Assertion Results

### Pass/Fail

Each assertion shows:
- ✓ **Pass**: Value matches expectation
- ✗ **Fail**: Value doesn't match

### Failure Details

When assertions fail, details show:

```
Assertion Failed: JSONPath $.data.name
  Expected: "John Doe"
  Actual: "Jane Smith"
  Path resolved: true
```

### Assertion Badges

Tests show assertion type badges:

```
[200] [$.name] [<500ms]
```

## Validation Modes

### No Validation

Skip all body validation — only assertions run.

```
Mode: None
Assertions: [status 200, response time <500ms]
```

### Full JSON Match

Deep-compare entire response against expected JSON.

```
Mode: Full
Expected: {"name": "John", "age": 30}
```

### Selective Fields

Validate specific paths only.

```
Mode: Selective
Include: [$.name, $.email, $.status]
```

Or exclude paths:

```
Mode: Selective (Exclude)
Exclude: [$.timestamp, $.requestId]
```

## Combining Assertions

### Multiple Assertions

All assertions must pass:

```
Assertions:
  1. Status = 200
  2. $.data.id exists
  3. $.data.name equals "John"
  4. Response time <= 500ms

Result: Pass only if ALL four pass
```

### Order Independence

Assertions run independently — order doesn't matter.

## Dynamic Assertions

### Using Variables

Reference test data in assertions:

```
Type: JSONPath
Path: $.data.email
Operator: equals
Value: {{expectedEmail}}  ← From data source
```

### Extracted Values

Assert against previously extracted values:

```
Step 1: Create User → Extract $.id as userId
Step 2: Get User → Assert $.id equals {{userId}}
```

## Tips & Best Practices

### 1. Start with Status Code

Always assert the status code first:

```
✓ Assert status 200
✓ Then assert body content
```

### 2. Use Specific Paths

```
✗ Assert $.data exists
✓ Assert $.data.user.id exists
```

### 3. Add SLA Assertions

Monitor performance with response time assertions:

```
Critical endpoints: <= 200ms
Normal endpoints: <= 500ms
Batch operations: <= 3000ms
```

### 4. Test Error Cases

Assert on error responses too:

```
Test: Get Invalid User
Assert: status 404
Assert: $.error.code equals "USER_NOT_FOUND"
```

### 5. Use Regex for Dynamic Values

When exact values vary:

```
✗ $.id equals "abc123"  (fragile)
✓ $.id matches "^[a-z0-9]+$"  (robust)
```

### 6. Validate Arrays

Check array contents:

```
$.items.length >= 1
$.items[0].id exists
$.items[*].status all equal "active"
```

## Troubleshooting

### "Path not found"

The JSONPath doesn't exist in the response:
- Check for typos
- Verify the response structure
- Use **Fetch Response** to see actual data

### "Type mismatch"

Comparing different types:
- String `"123"` vs Number `123`
- Use appropriate comparison operators

### "Assertion never passes"

- Check if the API returns expected data
- Verify auth is working (401 returns different body)
- Use **Fetch Response** to debug

## Validation Data Mapper

For **visual, operator-based validation** with 24 field operators, array assertions, DSL rules, and live verification, use the **Validation Data Mapper**:

1. Go to **Validation** tab → set mode to **Selective Fields**
2. Click **Fetch Response** to load sample data
3. Click **Data Mapper** to open the visual validation builder
4. Drag fields, set operators, add assertions, and verify live

See the [Data Mapper Validation Guide](./data-mapper-validation-guide.md) for complete documentation including:
- 24 field operators (equals, contains, between, regex, is_type, etc.)
- Array assertions (LENGTH, CONTAINS, EACH, SUBSET)
- DSL code editor with syntax highlighting and autocomplete
- ASSERT custom predicates with 125+ expression functions
- Universal negation (NOT modifier)
- Live verification with pass/fail indicators

## Related Guides

- [Data Mapper Validation Guide](./data-mapper-validation-guide.md) — Visual validation with operators, DSL, ASSERT
- [Validation Modes Guide](./validation-modes-guide.md) — None, Selective, Full modes
- [Scenarios Guide](./scenarios-guide.md) — Test organization
- [Test Runner Guide](./test-runner-guide.md) — Running tests
- [Parameterized Testing Guide](./parameterized-testing-guide.md) — Data-driven testing
- [Results Guide](./results-guide.md) — Analyzing failures
