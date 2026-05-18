# Workflow Designer Guide

Build visual API workflows with the drag-and-drop graph editor — create multi-step sequences, parallel execution, conditional branching, and more.

## Overview

The **Workflow Designer** lets you create complex API flows visually:

```
[Start] → [Create User] → [Get Token] → [Fork] → [Send Email]
                                           ↓
                                      [Create Profile]
                                           ↓
                                        [Join] → [End]
```

## Getting Started

### Creating a Workflow

1. Go to **Workflow** tab
2. Click **+ New Workflow**
3. Name your workflow (e.g., "User Registration Flow")
4. The canvas opens with a Start node

### The Canvas

```
┌─────────────────────────────────────────────────────────────┐
│ Toolbar: [Save] [Quick Test] [Run in Harness] [Variables]   │
├───────────────┬─────────────────────────────────────────────┤
│               │                                             │
│  Node Palette │              Canvas Area                    │
│               │                                             │
│  • HTTP       │     [Start] ──→ [HTTP] ──→ [End]           │
│  • Condition  │                                             │
│  • Delay      │                                             │
│  • Fork/Join  │                                             │
│  • Loop       │                                             │
│  • ...        │                                             │
│               │                                             │
├───────────────┴─────────────────────────────────────────────┤
│ [Zoom] [Fit] [Auto-Layout]                    [Minimap]     │
└─────────────────────────────────────────────────────────────┘
```

### Adding Nodes

**Drag and drop** from the palette, or:
1. Right-click the canvas
2. Select node type from the menu

### Connecting Nodes

1. Hover over a node's output handle (right side)
2. Click and drag to another node's input handle (left side)
3. Release to create a connection

### Selecting and Moving

- **Click** a node to select it
- **Drag** selected nodes to move them
- **Ctrl+Click** for multi-select
- **Delete/Backspace** to remove selected

## Node Types

### Start Node

Entry point for workflow execution. Every workflow needs exactly one Start node.

```
[●] Start
     ↓
```

### HTTP Node

Execute an HTTP request.

```
[⟳] Create User
     Method: POST
     URL: /users
     Body: {"name": "{{name}}"}
```

**Configuration:**
- Method (GET, POST, PUT, PATCH, DELETE)
- URL (with variable support)
- Headers
- Body
- Auth (inherit from service or custom)
- Validation and assertions
- Variable extraction

### Condition Node

If/Else branching based on expressions.

```
        ┌── [True Path]
[?] ────┤
        └── [False Path]
```

**Configuration:**
- Left operand (value or expression)
- Operator (==, !=, >, <, contains, regex)
- Right operand (value or expression)

**Example:**
```
Condition: $response.status == 200
  True → Continue to next step
  False → Go to error handler
```

### Switch Node

Multi-way branching based on expression value.

```
         ┌── Case: "pending"
[⊡] ─────┼── Case: "approved"
         └── Default
```

**Configuration:**
- Expression to evaluate
- Cases with target values
- Default path for unmatched values

### Delay Node

Pause execution for a duration.

```
[⏱] Wait 2 seconds
```

**Modes:**
- **Constant**: Fixed duration
- **Uniform**: Random within range
- **Gaussian**: Normal distribution

### Fork Node

Split into parallel execution paths.

```
       ┌── [Path A]
[⑂] ───┼── [Path B]
       └── [Path C]
```

All paths execute simultaneously.

### Join Node

Wait for all parallel paths to complete.

```
[Path A] ──┐
[Path B] ──┼── [⊕] → Continue
[Path C] ──┘
```

### Loop Node

Iterate multiple times or over an array.

```
[↺] For each user in {{users}}
     ↓
    [Process User]
```

**Modes:**
- **Count**: Fixed number of iterations
- **ForEach**: Iterate over JSON array
- **While**: Condition-based loop

**Available variables:**
- `{{$index}}` — Current iteration index
- `{{$item}}` — Current array item (ForEach mode)

### SetVariable Node

Assign values to variables.

```
[=] Set userId = {{response.data.id}}
```

### Aggregate Node

Collect values across loop iterations.

```
[∑] Collect all user IDs
     Strategy: array
```

**Strategies:**
- `array` — Collect all values into an array
- `concat` — Concatenate strings
- `sum` — Sum numbers
- `count` — Count items
- `first` / `last` — Keep first or last value

### End Node

Mark workflow completion.

```
     ↓
[■] End
```

## Variables

### Workflow Variables

Define initial variables in the Variables modal:

```
name: "John Doe"
email: "john@example.com"
baseUrl: "https://api.example.com"
```

### Using Variables

Use `{{variableName}}` syntax anywhere:

```
URL: {{baseUrl}}/users/{{userId}}
Header: Authorization: Bearer {{token}}
Body: {"name": "{{name}}"}
```

### Built-in Generators

| Variable | Description |
|----------|-------------|
| `{{$uuid}}` | Random UUID |
| `{{$timestamp}}` | Current Unix timestamp |
| `{{$isoDate}}` | Current ISO date |
| `{{$randomInt}}` | Random integer |
| `{{$randomEmail}}` | Random email address |
| `{{$randomString(N)}}` | Random string of length N |

### Variable Extraction

Extract values from HTTP responses:

```
HTTP Node: Create User
Extractions:
  userId ← $.data.id
  authToken ← $.headers.Authorization
```

Extracted values are available to downstream nodes.

### Expression Functions

Use `$function()` syntax for transformations:

| Function | Description |
|----------|-------------|
| `$upper(str)` | Uppercase |
| `$lower(str)` | Lowercase |
| `$concat(a, b)` | Concatenate |
| `$jsonpath(obj, path)` | Extract JSONPath |
| `$length(arr)` | Array/string length |
| `$now()` | Current timestamp |

## Quick Test

### Running a Quick Test

1. Click **Quick Test** in the toolbar
2. Workflow executes from the Start node
3. Each node shows real-time status

### Status Indicators

| Icon | Status |
|------|--------|
| ⏳ | Running |
| ✓ | Passed |
| ✗ | Failed |
| ⊘ | Skipped |
| ⏸ | Waiting (at Join) |

### Step-Through Mode

Debug step-by-step:

1. Start Quick Test
2. Click **Step** to advance one node
3. Inspect variables and responses at each step
4. Click **Resume** to run to completion

### Viewing Results

Click a completed HTTP node to see:
- Request details
- Response body
- Extracted variables
- Assertion results

## Auto-Layout

Automatically arrange nodes:

1. Click the **Auto-Layout** button
2. Nodes are arranged hierarchically
3. Adjust manually if needed

## Canvas Viewport Persistence

The Workflow Designer remembers your pan and zoom position:

- **Tab switching**: When you switch away from the Workflow tab and return, the canvas restores exactly where you left it — same pan position and zoom level.
- **Save with workflow**: Click **Save** to persist the current viewport as the default view. Next time you open this workflow, it loads at the saved position.
- **Fit to View**: Use the **Fit** button in the toolbar to auto-zoom to show all nodes, regardless of saved viewport.

> This uses an `IntersectionObserver` to detect visibility changes — no data loss even when rapidly switching between tabs.

## Workflow Services

### Service Registry

Define services for URL resolution:

```
Service: user-api
  dev: https://dev.api.example.com
  staging: https://staging.api.example.com
  prod: https://api.example.com
```

### Using Services in HTTP Nodes

```
HTTP Node: Get User
  Service: user-api
  Path: /users/{{userId}}
  
Resolves to: https://staging.api.example.com/users/123
```

## Import & Export

### Export Workflow

1. Click **Export** in the toolbar
2. Save as JSON file
3. Includes all nodes, edges, and variables

### Import Workflow

1. Click **Import** in the toolbar
2. Select a JSON file
3. Workflow is loaded with new IDs

### Gallery Samples

Browse and import pre-built workflows:

1. Click **Browse Samples**
2. Preview workflow structure
3. Click **Use as Template**

## Tips & Best Practices

### 1. Start Simple

Begin with linear sequences, then add complexity:

```
Step 1: Start → HTTP → End
Step 2: Add condition
Step 3: Add parallel paths
```

### 2. Use Meaningful Node Labels

```
✗ "HTTP 1", "HTTP 2", "HTTP 3"
✓ "Create User", "Get Token", "Update Profile"
```

### 3. Extract Early, Use Often

Extract values immediately after they're available:

```
[Create User] → Extract userId
  ↓
[Get User] → Uses {{userId}}
  ↓
[Update User] → Uses {{userId}}
```

### 4. Handle Errors

Add condition nodes to check for failures:

```
[API Call] → [Check Status?]
              ↓ (200)    ↓ (4xx/5xx)
           [Continue]  [Error Handler]
```

### 5. Test Incrementally

Build and test in small increments rather than creating the entire workflow first.

### 6. Use Services for Multi-Environment

Don't hardcode URLs — use services to switch environments easily.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Delete` | Delete selected nodes |
| `Ctrl+C` | Copy selected |
| `Ctrl+V` | Paste |
| `Ctrl+Z` | Undo |
| `Ctrl+A` | Select all |
| `Space` (drag) | Pan canvas |
| `Scroll` | Zoom |

## Related Guides

- [Workflow Nodes Reference](./workflow-nodes-reference.md) — Detailed node documentation
- [Workflow Runner Guide](./workflow-runner-guide.md) — Performance testing workflows
- [Runners Comparison](./runners-comparison.md) — When to use workflows vs tests
