# Validation Modes Guide

Configure how API responses are validated — None, Selective Fields, and Full JSON matching.

## Overview

**Validation modes** control how response bodies are compared against expected values:

| Mode | Description |
|------|-------------|
| **None** | No body validation (status + assertions only) |
| **Selective** | Validate specific JSON paths |
| **Full** | Deep-compare entire response |

## Validation Mode: None

### When to Use

- Performance testing (maximum throughput)
- When only status code matters
- When response body varies (timestamps, IDs)
- Exploratory testing

### Configuration

```yaml
validation:
  mode: none
```

### What's Validated

- ✓ HTTP status code
- ✓ Assertions (if defined)
- ✗ Response body content

### Example

```yaml
test:
  name: Get User
  method: GET
  url: /users/123
  validation:
    mode: none
  assertions:
    - type: status
      expected: 200
    - type: responseTime
      operator: "<="
      value: 500
```

Only status code and response time are checked.

## Validation Mode: Selective

### When to Use

- Validate important fields only
- Ignore dynamic values (timestamps, generated IDs)
- Partial response verification
- When response has many fields but only some matter

### Configuration

```yaml
validation:
  mode: selective
  include:
    - $.data.id
    - $.data.name
    - $.data.status
```

Or exclude mode:

```yaml
validation:
  mode: selective
  exclude:
    - $.timestamp
    - $.requestId
    - $.meta
```

### Include Mode

Only listed paths are validated:

```yaml
Response:
{
  "id": 123,          ← Validated
  "name": "John",     ← Validated
  "timestamp": "...", ← Ignored
  "meta": {...}       ← Ignored
}

Include: [$.id, $.name]
```

### Exclude Mode

All paths except listed are validated:

```yaml
Response:
{
  "id": 123,          ← Validated
  "name": "John",     ← Validated
  "timestamp": "...", ← Ignored
  "meta": {...}       ← Ignored
}

Exclude: [$.timestamp, $.meta]
```

### JSONPath Patterns

Use patterns for arrays and nested objects:

| Pattern | Matches |
|---------|---------|
| `$.id` | Root-level `id` |
| `$.data.user.id` | Nested path |
| `$.items[*].id` | All array item IDs |
| `$.items[0].id` | First item ID only |
| `$.*.name` | `name` at any root key |

### Example: Include Mode

```yaml
test:
  name: Create User
  method: POST
  url: /users
  body:
    name: "John"
    email: "john@example.com"
  validation:
    mode: selective
    include:
      - $.data.id
      - $.data.name
      - $.data.email
  expected:
    data:
      id: "{{$any}}"
      name: "John"
      email: "john@example.com"
```

### Example: Exclude Mode

```yaml
test:
  name: Get Order
  method: GET
  url: /orders/123
  validation:
    mode: selective
    exclude:
      - $.timestamp
      - $.updatedAt
      - $.meta.requestId
  expected:
    id: 123
    status: "completed"
    items:
      - productId: "A1"
        quantity: 2
```

## Validation Mode: Full

### When to Use

- Contract testing (exact response required)
- Regression testing (any change is a failure)
- When entire response structure matters
- API snapshot testing

### Configuration

```yaml
validation:
  mode: full
```

### What's Validated

- ✓ Every field in expected matches response
- ✓ No extra fields in response
- ✓ Array order matters
- ✓ Data types match

### Example

```yaml
test:
  name: Get Config
  method: GET
  url: /config
  validation:
    mode: full
  expected:
    version: "2.0"
    features:
      darkMode: true
      analytics: false
    limits:
      maxUsers: 100
      maxProjects: 10
```

Response must match exactly.

## Special Matchers

Use special values to handle dynamic content:

### Any Value Matcher

Match any value (including nested):

```yaml
expected:
  id: "{{$any}}"
  createdAt: "{{$any}}"
  data:
    token: "{{$any}}"
```

### Type Matchers

Match by type:

```yaml
expected:
  id: "{{$anyNumber}}"
  name: "{{$anyString}}"
  active: "{{$anyBoolean}}"
  items: "{{$anyArray}}"
  meta: "{{$anyObject}}"
```

### Pattern Matchers

Match by pattern:

```yaml
expected:
  id: "{{$uuid}}"
  email: "{{$email}}"
  timestamp: "{{$isoDate}}"
```

### Regex Matcher

```yaml
expected:
  code: "{{$regex:^[A-Z]{3}\\d{4}$}}"
```

## Array Validation

### Ordered Arrays (Default)

Arrays must match in order:

```yaml
expected:
  items:
    - id: 1
    - id: 2
    - id: 3

# Passes: [{"id": 1}, {"id": 2}, {"id": 3}]
# Fails:  [{"id": 2}, {"id": 1}, {"id": 3}]
```

### Unordered Arrays

Enable unordered matching:

```yaml
validation:
  mode: full
  unorderedArrays: true

expected:
  items:
    - id: 1
    - id: 2
    - id: 3

# Passes: [{"id": 2}, {"id": 1}, {"id": 3}]
```

### Array Length Only

Validate just the count:

```yaml
expected:
  items: "{{$arrayLength:3}}"
```

## Combining with Assertions

Validation mode works alongside assertions:

```yaml
test:
  name: Create Order
  method: POST
  url: /orders
  validation:
    mode: selective
    include:
      - $.order.id
      - $.order.status
  expected:
    order:
      id: "{{$any}}"
      status: "pending"
  assertions:
    - type: status
      expected: 201
    - type: header
      name: Location
      operator: exists
    - type: responseTime
      operator: "<="
      value: 1000
```

## Validation Results

### Pass

All validated paths match expected values.

### Fail with Details

```
Validation Failed:

Path: $.data.status
  Expected: "active"
  Actual: "pending"

Path: $.data.items[0].quantity
  Expected: 5
  Actual: 3

Path: $.meta.version
  Expected: exists
  Actual: missing
```

## Choosing the Right Mode

### Decision Tree

```
Does the entire response need to match exactly?
  └─ Yes → Full mode
  └─ No → Continue...

Do you only care about specific fields?
  └─ Yes → Selective mode (include)
  └─ No → Continue...

Do most fields matter except a few dynamic ones?
  └─ Yes → Selective mode (exclude)
  └─ No → Continue...

Is this pure performance testing?
  └─ Yes → None mode
```

### Mode Comparison

| Mode | Strictness | Performance | Use Case |
|------|------------|-------------|----------|
| None | Low | Fast | Load testing |
| Selective | Medium | Medium | Functional testing |
| Full | High | Slower | Contract testing |

## Tips & Best Practices

### 1. Start with Selective

Begin with selective mode, validating only critical fields:
```yaml
include:
  - $.id
  - $.status
  - $.data.name
```

### 2. Use Exclude for Timestamps

Common excludes for dynamic fields:
```yaml
exclude:
  - $.timestamp
  - $.createdAt
  - $.updatedAt
  - $.requestId
  - $.meta.traceId
```

### 3. Use Matchers for IDs

Don't hardcode generated IDs:
```yaml
expected:
  id: "{{$any}}"  # Not: id: "abc123"
```

### 4. Test Validation Separately

Run a few requests with full validation first, then switch to selective for performance runs.

### 5. Document Expected Values

Keep expected responses in version control alongside test definitions.

## Related Guides

- [Assertions Guide](./assertions-guide.md) — Assertion types
- [Scenarios Guide](./scenarios-guide.md) — Test organization
- [Test Runner Guide](./test-runner-guide.md) — Running tests
