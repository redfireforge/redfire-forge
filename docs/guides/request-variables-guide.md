# Request Variables Guide

Use variables to make requests dynamic — environment values, extractions, generators, and expressions.

## Overview

**Variables** allow dynamic values in requests:

```
URL: {{baseUrl}}/users/{{userId}}
Header: Authorization: Bearer {{token}}
Body: {"requestId": "{{$uuid}}"}
```

## Variable Syntax

### Basic Syntax

Use double curly braces: `{{variableName}}`

Valid locations:
- URL path and query parameters
- Header values
- Request body
- Assertions

### Case Sensitivity

Variable names are case-sensitive:
- `{{userId}}` and `{{UserId}}` are different
- Convention: use camelCase

## Variable Sources

### 1. Data Source Variables

From test data sources:

```
Data Source:
  Column: userId → Value: 123
  Column: userName → Value: John

Request:
  GET /users/{{userId}}
  Body: {"name": "{{userName}}"}
```

### 2. Extracted Variables

From previous request responses:

```
Request 1: Create User
  Extract: userId ← $.data.id

Request 2: Get User
  GET /users/{{userId}}  ← Uses extracted value
```

### 3. Environment Variables

From collection or workflow environment:

```
Environment: staging
Variables:
  baseUrl: https://staging.api.example.com
  apiVersion: v2

Request:
  GET {{baseUrl}}/{{apiVersion}}/users
```

### 4. Built-in Generators

Dynamic values generated at runtime:

| Generator | Description | Example |
|-----------|-------------|---------|
| `{{$uuid}}` | Random UUID | `f47ac10b-58cc-4372-a567-0e02b2c3d479` |
| `{{$timestamp}}` | Unix timestamp | `1705312800` |
| `{{$isoDate}}` | ISO date string | `2024-01-15T10:00:00.000Z` |
| `{{$randomInt}}` | Random integer | `42857` |
| `{{$randomInt(min, max)}}` | Random in range | `{{$randomInt(1, 100)}}` → `47` |
| `{{$randomString(n)}}` | Random string | `{{$randomString(8)}}` → `xK9mL2pQ` |
| `{{$randomEmail}}` | Random email | `user_xk9m@example.com` |
| `{{$randomName}}` | Random name | `John Smith` |
| `{{$randomBoolean}}` | Random true/false | `true` |

### 5. Workflow Context Variables

In workflows, additional context:

| Variable | Description |
|----------|-------------|
| `{{$index}}` | Loop iteration index |
| `{{$item}}` | Current loop item |
| `{{$response.body}}` | Last response body |
| `{{$response.status}}` | Last status code |

## Variable Extraction

### From Response Body (JSONPath)

```yaml
Extractions:
  - name: userId
    source: body
    expression: $.data.id
```

JSONPath examples:

| Expression | Extracts |
|------------|----------|
| `$.id` | Root-level id |
| `$.data.user.id` | Nested value |
| `$.users[0].id` | First array element |
| `$.users[-1].id` | Last array element |
| `$.users[*].id` | All user IDs (array) |
| `$.users[?(@.active)].id` | IDs where active is true |

### From Response Headers

```yaml
Extractions:
  - name: authToken
    source: header
    expression: Authorization
```

### From Status Code

```yaml
Extractions:
  - name: statusCode
    source: status
```

## Using Variables

### In URLs

```
GET {{baseUrl}}/users/{{userId}}
GET /api/v{{version}}/products
GET /search?q={{query}}&page={{page}}
```

### In Headers

```
Authorization: Bearer {{token}}
X-API-Key: {{apiKey}}
X-Request-ID: {{$uuid}}
```

### In Request Body

```json
{
  "name": "{{userName}}",
  "email": "{{userEmail}}",
  "orderId": "ORD-{{$timestamp}}-{{$randomInt(1000,9999)}}"
}
```

### In Assertions

```yaml
Assertions:
  - path: $.data.email
    operator: equals
    value: {{expectedEmail}}
```

## Variable Fallbacks

Provide default values:

```
{{variableName || defaultValue}}
```

Example:
```
GET /users?limit={{limit || 10}}
```

If `limit` is undefined, uses `10`.

## Expression Functions

Transform variable values:

### String Functions

| Function | Description | Example |
|----------|-------------|---------|
| `$upper(str)` | Uppercase | `$upper({{name}})` → `JOHN` |
| `$lower(str)` | Lowercase | `$lower({{name}})` → `john` |
| `$trim(str)` | Remove whitespace | `$trim({{input}})` |
| `$substring(str, start, end)` | Extract part | `$substring({{id}}, 0, 8)` |
| `$concat(a, b, ...)` | Concatenate | `$concat({{first}}, " ", {{last}})` |
| `$replace(str, find, repl)` | Replace text | `$replace({{text}}, "-", "_")` |

### Number Functions

| Function | Description | Example |
|----------|-------------|---------|
| `$parseInt(str)` | Parse integer | `$parseInt({{count}})` |
| `$parseFloat(str)` | Parse float | `$parseFloat({{price}})` |
| `$round(num, decimals)` | Round number | `$round({{price}}, 2)` |
| `$abs(num)` | Absolute value | `$abs({{diff}})` |

### JSON Functions

| Function | Description | Example |
|----------|-------------|---------|
| `$jsonpath(obj, path)` | Extract path | `$jsonpath({{response}}, "$.id")` |
| `$length(arrOrStr)` | Get length | `$length({{items}})` |
| `$stringify(obj)` | JSON to string | `$stringify({{data}})` |
| `$parse(str)` | String to JSON | `$parse({{jsonStr}})` |

### Date Functions

| Function | Description | Example |
|----------|-------------|---------|
| `$now()` | Current timestamp | `$now()` |
| `$dateAdd(date, amount, unit)` | Add to date | `$dateAdd($now(), 1, "day")` |
| `$formatDate(date, format)` | Format date | `$formatDate($now(), "YYYY-MM-DD")` |

## Variable Scope

### Request Scope

Variables available within a single request.

### Scenario Scope

Extracted variables persist across requests in the same scenario iteration.

### Workflow Scope

Variables persist across all nodes in a workflow execution.

## Insert Variable Modal

Access the variable picker:

1. Press `Ctrl+I` or `Cmd+I`
2. Or click the `{{}}` button

Modal features:
- Browse all available variables
- See current values
- Search by name
- Insert at cursor

```
┌─────────────────────────────────────────┐
│ Insert Variable                         │
├─────────────────────────────────────────┤
│ Search: [userId______]                  │
│                                         │
│ Data Source                             │
│   userId: 123                           │
│   userName: John                        │
│                                         │
│ Extracted                               │
│   token: eyJhbG...                      │
│                                         │
│ Generators                              │
│   $uuid                                 │
│   $timestamp                            │
│   $randomInt                            │
├─────────────────────────────────────────┤
│ [Cancel]                  [Insert]      │
└─────────────────────────────────────────┘
```

## Tips & Best Practices

### 1. Name Variables Clearly

```
✗ {{id}}, {{val}}, {{x}}
✓ {{userId}}, {{orderTotal}}, {{authToken}}
```

### 2. Use Prefixes for Organization

```
user_id, user_name, user_email
order_id, order_total, order_status
```

### 3. Extract Early

Extract values immediately after they're available:
```
Step 1: Create User → Extract userId
Step 2: Use {{userId}} in all subsequent steps
```

### 4. Use Fallbacks for Optional Values

```
{{category || "default"}}
{{limit || 10}}
```

### 5. Validate Extracted Values

Add assertions to ensure extractions succeeded:
```yaml
Assertions:
  - path: $.data.id
    operator: exists
```

## Troubleshooting

### "Variable not found"

- Check spelling and case
- Verify variable is in scope
- Check extraction worked (value is defined)

### "Undefined" in request

- Variable wasn't extracted or defined
- Use fallback: `{{var || "fallback"}}`

### Extraction returns wrong value

- Verify JSONPath is correct
- Check response structure matches expectation
- Use console to inspect actual response

## Related Guides

- [Request Editor Guide](./request-editor-guide.md) — Using the editor
- [Parameterized Testing Guide](./parameterized-testing-guide.md) — Data sources
- [Workflow Variables Guide](./workflow-variables-guide.md) — Workflow context
