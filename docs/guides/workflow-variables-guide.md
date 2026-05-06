# Workflow Variables Guide

Master variable management in workflows — initialization, extraction, chaining, and expressions.

## Overview

**Workflow variables** enable dynamic, data-driven workflow execution:

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ Create User  │ ──► │ Get Token    │ ──► │ Update Prof  │
│              │     │              │     │              │
│ Extract:     │     │ Uses:        │     │ Uses:        │
│ userId       │     │ {{userId}}   │     │ {{userId}}   │
└──────────────┘     │ Extract:     │     │ {{token}}    │
                     │ token        │     └──────────────┘
                     └──────────────┘
```

## Variable Basics

### Declaring Variables

Define initial variables in the workflow:

1. Click **Variables** in the toolbar
2. Add variables with names and values:

```yaml
Variables:
  baseUrl: "https://api.example.com"
  userName: "John Doe"
  testMode: true
  maxRetries: 3
```

### Using Variables

Reference with `{{variableName}}` syntax:

```
URL: {{baseUrl}}/users
Body: {"name": "{{userName}}"}
Header: X-Test-Mode: {{testMode}}
```

### Variable Types

Variables can hold any JSON value:

| Type | Example |
|------|---------|
| String | `"hello"` |
| Number | `42`, `3.14` |
| Boolean | `true`, `false` |
| Object | `{"key": "value"}` |
| Array | `[1, 2, 3]` |
| Null | `null` |

## Variable Sources

### 1. Initial Variables

Defined when creating the workflow:

```yaml
variables:
  userId: "123"
  environment: "staging"
```

### 2. Extracted Variables

Captured from HTTP responses:

```yaml
HTTP Node: Create User
  Extractions:
    - name: userId
      source: body
      expression: $.data.id
    - name: authToken
      source: header
      expression: Authorization
```

### 3. SetVariable Nodes

Explicitly set or modify variables:

```yaml
SetVariable Node:
  Assignments:
    - name: fullName
      value: "{{firstName}} {{lastName}}"
    - name: counter
      value: 0
```

### 4. Loop Variables

Available inside loops:

| Variable | Description |
|----------|-------------|
| `{{$index}}` | Current iteration (0-based) |
| `{{$item}}` | Current array element |
| `{{$first}}` | True on first iteration |
| `{{$last}}` | True on last iteration |

### 5. Built-in Generators

Dynamic values:

| Generator | Output |
|-----------|--------|
| `{{$uuid}}` | Random UUID |
| `{{$timestamp}}` | Unix timestamp |
| `{{$isoDate}}` | ISO date string |
| `{{$randomInt}}` | Random integer |
| `{{$randomString(8)}}` | 8-char random string |

## Variable Extraction

### From Response Body (JSONPath)

```yaml
Extractions:
  - name: userId
    source: body
    expression: $.data.id
    
  - name: items
    source: body
    expression: $.items[*].id
```

JSONPath examples:

| Expression | Result |
|------------|--------|
| `$.id` | `123` |
| `$.data.user.name` | `"John"` |
| `$.items[0]` | First item |
| `$.items[-1]` | Last item |
| `$.items.length` | Array length |
| `$.items[*].id` | All IDs as array |

### From Response Headers

```yaml
Extractions:
  - name: location
    source: header
    expression: Location
    
  - name: contentType
    source: header
    expression: Content-Type
```

### From Status Code

```yaml
Extractions:
  - name: statusCode
    source: status
```

### Default Values

Provide fallback if extraction fails:

```yaml
Extractions:
  - name: retryAfter
    source: header
    expression: Retry-After
    default: "60"
```

## Variable Chaining

### Sequential Chaining

Pass data between consecutive nodes:

```
[Create Order] ──► [Get Order Details] ──► [Process Payment]
     │                    │                      │
     └─ orderId ──────────┘                      │
                          └─ totalAmount ────────┘
```

### Parallel Branch Variables

Fork/Join handles variables from parallel paths:

```
        ┌── [Get User] ── userId, userName
[Fork] ─┼── [Get Config] ── settings
        └── [Get Prefs] ── preferences
                │
            [Join] ── All variables merged
                │
            [Process] uses {{userId}}, {{settings}}, {{preferences}}
```

### Variable Conflicts

If parallel paths extract the same variable name, last-to-complete wins. Avoid this by using unique names:

```
✗ Both extract: userId
✓ Extract: userA_id, userB_id
```

## Expressions

### Basic Operations

Combine variables:

```
{{firstName}} {{lastName}}
{{baseUrl}}/api/v{{version}}/users
```

### Expression Functions

Transform values:

#### String Functions

```
$upper({{name}})          → "JOHN"
$lower({{name}})          → "john"
$trim({{input}})          → removes whitespace
$substring({{id}}, 0, 8)  → first 8 chars
$concat({{a}}, "-", {{b}})
$replace({{path}}, "/", "-")
```

#### Number Functions

```
$parseInt({{count}})
$parseFloat({{price}})
$round({{price}}, 2)
$abs({{diff}})
```

#### JSON Functions

```
$jsonpath({{response}}, "$.data.id")
$length({{items}})
$stringify({{object}})
$parse({{jsonString}})
```

#### Date Functions

```
$now()                              → current timestamp
$dateAdd($now(), 1, "day")          → tomorrow
$formatDate($now(), "YYYY-MM-DD")   → "2024-01-15"
```

### Conditional Expressions

```
{{status == "active" ? "Enabled" : "Disabled"}}
{{count > 0 ? count : "None"}}
```

## Variables in Conditions

### Condition Node

Use variables in branching logic:

```yaml
Condition:
  Left: {{status}}
  Operator: equals
  Right: "success"
```

Or with expressions:

```yaml
Condition:
  Left: {{items.length}}
  Operator: ">"
  Right: 0
```

### Switch Node

Route based on variable value:

```yaml
Switch:
  Expression: {{orderStatus}}
  Cases:
    - "pending" → Process
    - "paid" → Ship
    - "shipped" → Notify
  Default → Error Handler
```

## Variables in Loops

### Count Loop

```yaml
Loop:
  Mode: count
  Count: {{itemCount}}
  
Body:
  HTTP: POST /process/{{$index}}
```

### ForEach Loop

```yaml
Loop:
  Mode: forEach
  Array: {{users}}
  
Body:
  HTTP: GET /users/{{$item.id}}
```

### Aggregating Results

Collect values across iterations:

```yaml
Loop: forEach {{orders}}
  Body:
    HTTP: GET /orders/{{$item.id}}
    Extract: total ← $.total

Aggregate:
  - source: {{total}}
    target: allTotals
    strategy: array
  - source: {{total}}
    target: grandTotal
    strategy: sum
```

## Variable Scope

### Workflow Scope

Variables persist across the entire workflow execution:

```
[Start] → [HTTP 1] extracts userId
    → [HTTP 2] uses {{userId}}
    → [HTTP 3] uses {{userId}}
    → [End]
```

### Loop Scope

Loop variables (`$index`, `$item`) only exist inside the loop:

```
[Loop]
  └─ [HTTP] can use {{$item}}
    
[After Loop] ← Cannot use {{$item}} here
```

### Aggregated Variables

Aggregated values are available after the loop:

```
[Loop]
  └─ Aggregate: allIds (array)
    
[After Loop]
  └─ [HTTP] uses {{allIds}}
```

## Debug Variables

### In Quick Test

View variable values at each step:

1. Run Quick Test
2. Click a node
3. View **Variables** panel

```
Variables at "Get Token":
  userId: "123"
  authToken: "eyJhbG..."
  requestCount: 3
```

### In Step-Through Mode

Watch variables change:

1. Start Quick Test
2. Click **Step**
3. Variables panel updates after each step

### Console Output

Log variables for debugging:

```yaml
SetVariable:
  Assignments:
    - name: debug
      value: "userId={{userId}}, status={{status}}"
```

## Tips & Best Practices

### 1. Initialize All Variables

Declare variables at the start, even with empty values:

```yaml
Variables:
  userId: ""
  authToken: ""
  orderIds: []
```

### 2. Use Descriptive Names

```
✗ id, val, x
✓ userId, authToken, orderItems
```

### 3. Namespace Related Variables

```
user_id, user_name, user_email
order_id, order_total, order_items
```

### 4. Extract Early

Extract values immediately after the HTTP call:

```
[Create User] → Extract userId
  ↓
[Any subsequent node can use {{userId}}]
```

### 5. Handle Missing Values

Use default values or conditions:

```
{{retryAfter || 60}}
```

### 6. Document Complex Expressions

Add comments in node labels:

```
Node Label: "Calculate Total (items * price + tax)"
```

## Related Guides

- [Workflow Designer Guide](./workflow-designer-guide.md) — Building workflows
- [Workflow Nodes Reference](./workflow-nodes-reference.md) — Node types
- [Request Variables Guide](./request-variables-guide.md) — Request variables
