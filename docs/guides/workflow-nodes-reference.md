# Workflow Nodes Reference

Complete reference for all workflow node types — configuration options, inputs, outputs, and examples.

## Node Categories

| Category | Nodes |
|----------|-------|
| **Control Flow** | Start, End, Condition, Switch |
| **HTTP** | HTTP Request |
| **Timing** | Delay |
| **Parallel** | Fork, Join |
| **Iteration** | Loop, Aggregate |
| **Data** | SetVariable |
| **Triggers** | Webhook, Schedule |
| **Advanced** | Script, Sub-Workflow, CorrelationWait |

---

## Start Node

**Purpose:** Entry point for workflow execution.

### Configuration

| Property | Description |
|----------|-------------|
| Label | Display name (default: "Start") |

### Outputs

| Handle | Description |
|--------|-------------|
| Default | Single output to the first step |

### Notes

- Every workflow must have exactly one Start node
- Quick Test begins from the Start node
- Cannot have input connections

---

## End Node

**Purpose:** Mark workflow completion.

### Configuration

| Property | Description |
|----------|-------------|
| Label | Display name (default: "End") |

### Inputs

| Handle | Description |
|--------|-------------|
| Default | Accepts connections from any node |

### Notes

- Multiple End nodes are allowed
- Reaching any End node terminates that execution path
- In parallel flows, other paths continue until they also reach End or Join

---

## HTTP Node

**Purpose:** Execute an HTTP request.

### Configuration

| Property | Description |
|----------|-------------|
| Label | Display name |
| Method | GET, POST, PUT, PATCH, DELETE |
| URL | Request URL (supports variables) |
| Headers | Key-value header pairs |
| Body | Request body (for POST/PUT/PATCH) |
| Auth | Authentication configuration |
| Timeout | Request timeout in seconds |

### Validation

| Property | Description |
|----------|-------------|
| Mode | None, Full, Selective |
| Assertions | Status, JSONPath, regex, etc. |

### Extractions

| Property | Description |
|----------|-------------|
| Name | Variable name to store value |
| Source | body, header, status |
| Expression | JSONPath or header name |

### Inputs/Outputs

| Handle | Description |
|--------|-------------|
| Input | Single input |
| Output | Single output (success or failure) |

### Available Variables

After execution:
- `{{$response.body}}` — Full response body
- `{{$response.status}}` — Status code
- `{{$response.headers}}` — Response headers
- Plus any extracted variables

### Example

```yaml
HTTP Node: Create User
  Method: POST
  URL: https://api.example.com/users
  Headers:
    Content-Type: application/json
  Body: |
    {"name": "{{name}}", "email": "{{email}}"}
  Extractions:
    - name: userId
      source: body
      expression: $.data.id
```

---

## Condition Node

**Purpose:** If/Else branching based on expression evaluation.

### Configuration

| Property | Description |
|----------|-------------|
| Label | Display name |
| Left | Left operand (value or variable) |
| Operator | Comparison operator |
| Right | Right operand (value or variable) |

### Operators

| Operator | Description |
|----------|-------------|
| `==` | Equal |
| `!=` | Not equal |
| `>` | Greater than |
| `<` | Less than |
| `>=` | Greater than or equal |
| `<=` | Less than or equal |
| `contains` | String contains |
| `startsWith` | String starts with |
| `endsWith` | String ends with |
| `regex` | Regex match |
| `exists` | Value is defined |

### Inputs/Outputs

| Handle | Description |
|--------|-------------|
| Input | Single input |
| True | Output when condition is true |
| False | Output when condition is false |

### Example

```yaml
Condition: Check Status
  Left: {{$response.status}}
  Operator: ==
  Right: 200
  True → Continue processing
  False → Handle error
```

---

## Switch Node

**Purpose:** Multi-way branching based on expression value.

### Configuration

| Property | Description |
|----------|-------------|
| Label | Display name |
| Expression | Value to evaluate |
| Cases | List of case values and targets |
| Default | Target for unmatched values |

### Inputs/Outputs

| Handle | Description |
|--------|-------------|
| Input | Single input |
| Case outputs | One per defined case |
| Default | Fallback output |

### Example

```yaml
Switch: Route by Status
  Expression: {{order.status}}
  Cases:
    - value: "pending" → Process pending
    - value: "approved" → Ship order
    - value: "rejected" → Notify customer
  Default → Log unknown status
```

---

## Delay Node

**Purpose:** Pause execution for a specified duration.

### Configuration

| Property | Description |
|----------|-------------|
| Label | Display name |
| Mode | Constant, Uniform, Gaussian |
| Duration | Delay time in milliseconds |
| Min/Max | Range for Uniform mode |
| Mean/StdDev | Parameters for Gaussian mode |

### Modes

| Mode | Description |
|------|-------------|
| Constant | Fixed delay |
| Uniform | Random delay between min and max |
| Gaussian | Normal distribution around mean |

### Inputs/Outputs

| Handle | Description |
|--------|-------------|
| Input | Single input |
| Output | Single output (after delay) |

### Example

```yaml
Delay: Think Time
  Mode: Uniform
  Min: 500ms
  Max: 1500ms
```

---

## Fork Node

**Purpose:** Split execution into parallel paths.

### Configuration

| Property | Description |
|----------|-------------|
| Label | Display name |

### Inputs/Outputs

| Handle | Description |
|--------|-------------|
| Input | Single input |
| Outputs | Multiple outputs (one per parallel path) |

### Notes

- All connected paths execute simultaneously
- Each path runs independently
- Typically paired with a Join node

### Example

```yaml
Fork: Parallel Data Fetch
  → [Get User Profile]
  → [Get User Orders]
  → [Get User Preferences]
```

---

## Join Node

**Purpose:** Wait for all parallel paths to complete.

### Configuration

| Property | Description |
|----------|-------------|
| Label | Display name |

### Inputs/Outputs

| Handle | Description |
|--------|-------------|
| Inputs | Multiple inputs (one from each parallel path) |
| Output | Single output (when all inputs arrive) |

### Notes

- Waits for ALL incoming paths before continuing
- Quick Test shows "Waiting for N threads" status
- Variables from all paths are merged

### Example

```yaml
[Fork] → [Path A] → [Join]
       → [Path B] →
       → [Path C] →
```

---

## Loop Node

**Purpose:** Iterate multiple times or over an array.

### Configuration

| Property | Description |
|----------|-------------|
| Label | Display name |
| Mode | Count, ForEach, While |
| Count | Number of iterations (Count mode) |
| Array | JSONPath to array (ForEach mode) |
| Condition | Loop condition (While mode) |
| Max Iterations | Safety limit |

### Loop Variables

| Variable | Description |
|----------|-------------|
| `{{$index}}` | Current iteration (0-based) |
| `{{$item}}` | Current array item (ForEach) |
| `{{$first}}` | True on first iteration |
| `{{$last}}` | True on last iteration |

### Inputs/Outputs

| Handle | Description |
|--------|-------------|
| Input | Single input |
| Loop Body | Output to loop contents |
| Done | Output when loop completes |

### Example

```yaml
Loop: Process Each User
  Mode: ForEach
  Array: {{users}}
  Max: 100
  
  Body:
    [Get User Details] using {{$item.id}}
    [Update Statistics]
  
  Done → [Summary Report]
```

---

## SetVariable Node

**Purpose:** Assign values to variables.

### Configuration

| Property | Description |
|----------|-------------|
| Label | Display name |
| Assignments | List of name-value pairs |

### Inputs/Outputs

| Handle | Description |
|--------|-------------|
| Input | Single input |
| Output | Single output |

### Example

```yaml
SetVariable: Initialize Counters
  Assignments:
    - name: totalCount
      value: 0
    - name: processedIds
      value: []
```

---

## Aggregate Node

**Purpose:** Collect values across loop iterations.

### Configuration

| Property | Description |
|----------|-------------|
| Label | Display name |
| Mappings | Source → Target with strategy |

### Strategies

| Strategy | Description |
|----------|-------------|
| `array` | Collect into array |
| `concat` | Concatenate strings |
| `sum` | Sum numbers |
| `count` | Count items |
| `first` | Keep first value |
| `last` | Keep last value |

### Example

```yaml
Aggregate: Collect User IDs
  Mappings:
    - source: {{userId}}
      target: allUserIds
      strategy: array
    - source: {{orderTotal}}
      target: grandTotal
      strategy: sum
```

---

## Webhook Trigger

**Purpose:** Start workflow when HTTP request is received.

### Configuration

| Property | Description |
|----------|-------------|
| Label | Display name |
| Method | Expected HTTP method |
| Path | Endpoint path |
| Extractions | Extract values from request |

### Available Variables

- `{{$webhook.body}}` — Request body
- `{{$webhook.headers}}` — Request headers
- `{{$webhook.query}}` — Query parameters
- Plus extracted variables

### Example

```yaml
Webhook Trigger: Order Created
  Method: POST
  Path: /webhooks/orders
  Extractions:
    - name: orderId
      expression: $.order.id
```

---

## Schedule Trigger

**Purpose:** Start workflow on a schedule.

### Configuration

| Property | Description |
|----------|-------------|
| Label | Display name |
| Cron | 5-field cron expression |
| Timezone | Execution timezone |

### Available Variables

- `{{$triggerTime}}` — ISO timestamp
- `{{$triggerTimestamp}}` — Unix timestamp

### Cron Format

```
┌───────────── minute (0-59)
│ ┌───────────── hour (0-23)
│ │ ┌───────────── day of month (1-31)
│ │ │ ┌───────────── month (1-12)
│ │ │ │ ┌───────────── day of week (0-6, Sun=0)
│ │ │ │ │
* * * * *
```

### Examples

| Cron | Description |
|------|-------------|
| `0 * * * *` | Every hour |
| `0 0 * * *` | Daily at midnight |
| `0 9 * * 1-5` | Weekdays at 9 AM |
| `*/15 * * * *` | Every 15 minutes |

---

## Script Node

**Purpose:** Execute custom JavaScript code.

### Configuration

| Property | Description |
|----------|-------------|
| Label | Display name |
| Code | JavaScript code to execute |

### Available Context

```javascript
// Access variables
const userId = context.variables.userId;

// Access previous response
const data = context.response.body;

// Set output variables
context.setVariable('result', computedValue);

// Return value
return { success: true, data: result };
```

### Example

```javascript
// Calculate order total with tax
const items = context.variables.items;
const subtotal = items.reduce((sum, item) => sum + item.price, 0);
const tax = subtotal * 0.08;
const total = subtotal + tax;

context.setVariable('orderTotal', total);
return { subtotal, tax, total };
```

---

## Sub-Workflow Node

**Purpose:** Execute another workflow as a step.

### Configuration

| Property | Description |
|----------|-------------|
| Label | Display name |
| Workflow | Referenced workflow ID |
| Input Variables | Variables to pass |
| Output Mapping | Map sub-workflow outputs |

### Example

```yaml
Sub-Workflow: Process Payment
  Workflow: payment-processing-flow
  Inputs:
    orderId: {{orderId}}
    amount: {{total}}
  Outputs:
    transactionId ← result.transactionId
```

---

## CorrelationWait Node

**Purpose:** Wait for an external event with correlation.

### Configuration

| Property | Description |
|----------|-------------|
| Label | Display name |
| Correlation Key | Unique identifier to match events |
| Timeout | Maximum wait time |
| Mock Payload | Default payload for testing |

### Example

```yaml
CorrelationWait: Wait for Payment Callback
  Correlation Key: {{orderId}}
  Timeout: 300s
  Mock Payload: {"status": "completed"}
```

---

## Related Guides

- [Workflow Designer Guide](./workflow-designer-guide.md) — Building workflows
- [Workflow Runner Guide](./workflow-runner-guide.md) — Performance testing
- [Workflow Variables Guide](./workflow-variables-guide.md) — Variable management
