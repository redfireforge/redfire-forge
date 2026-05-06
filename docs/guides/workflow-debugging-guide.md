# Workflow Debugging Guide

Debug workflows with Quick Test mode — step-through execution, variable inspection, and troubleshooting.

## Overview

Debugging workflows involves:
- Running Quick Test to validate the flow
- Stepping through node by node
- Inspecting variables at each step
- Identifying and fixing issues

## Quick Test Mode

### Starting Quick Test

1. Open the workflow
2. Click **Quick Test** in the toolbar
3. Execution starts from the Start node

### Execution Status

Each node shows status during execution:

| Icon | Status | Description |
|------|--------|-------------|
| ⏳ | Running | Currently executing |
| ✓ | Passed | Completed successfully |
| ✗ | Failed | Error occurred |
| ⊘ | Skipped | Condition not met |
| ⏸ | Waiting | At Join, waiting for branches |

### Live Progress

Watch the workflow execute:

```
[Start] ✓ → [Create User] ⏳ → [Get Token] ○ → [End] ○
```

## Step-Through Mode

### Enabling Step Mode

1. Click **Quick Test ▼**
2. Select **Step-Through Mode**
3. Click **Step** to advance one node

### Step Controls

| Button | Action |
|--------|--------|
| **Step** | Execute next node |
| **Resume** | Run to completion |
| **Stop** | Abort execution |

### Breakpoints

Set breakpoints to pause at specific nodes:

1. Click the breakpoint icon on a node
2. Run Quick Test
3. Execution pauses at the breakpoint
4. Inspect state, then continue

## Variable Inspection

### Variables Panel

View variables at any step:

```
┌─────────────────────────────────────┐
│ Variables                           │
├─────────────────────────────────────┤
│ Initial:                            │
│   userName: "John"                  │
│   apiKey: "abc123"                  │
│                                     │
│ Extracted:                          │
│   userId: "usr_456"                 │
│   authToken: "eyJhbG..."           │
│                                     │
│ Computed:                           │
│   fullUrl: "https://api.ex.com/..." │
└─────────────────────────────────────┘
```

### Variable History

Track how variables change:

```
userId:
  [Create User] ← "usr_456" (extracted)
  [Update User] ← "usr_456" (unchanged)
  [Delete User] ← "usr_456" (unchanged)
```

### Expanding Complex Values

Click to expand objects and arrays:

```
▼ response:
    ▼ data:
        id: "usr_456"
        name: "John Doe"
      ▶ metadata: {...}
    status: "success"
```

## HTTP Node Debugging

### Request Details

Click an HTTP node to see:

```
┌─────────────────────────────────────────────────────────┐
│ HTTP Node: Create User                                  │
├─────────────────────────────────────────────────────────┤
│ Request:                                                │
│   Method: POST                                          │
│   URL: https://api.example.com/users                    │
│   Headers:                                              │
│     Content-Type: application/json                      │
│     Authorization: Bearer eyJhbG...                     │
│   Body:                                                 │
│     {"name": "John", "email": "john@example.com"}       │
├─────────────────────────────────────────────────────────┤
│ Response:                                               │
│   Status: 201 Created                                   │
│   Time: 145ms                                           │
│   Body:                                                 │
│     {"data": {"id": "usr_456", "name": "John"}}         │
├─────────────────────────────────────────────────────────┤
│ Extractions:                                            │
│   userId ← $.data.id = "usr_456" ✓                     │
├─────────────────────────────────────────────────────────┤
│ Assertions:                                             │
│   Status = 201 ✓                                        │
│   $.data.id exists ✓                                    │
└─────────────────────────────────────────────────────────┘
```

### Response Body Tree

Navigate the response:

```
▼ data
    id: "usr_456" [Copy Path]
    name: "John Doe"
  ▼ permissions
      read: true
      write: false
```

Right-click to copy JSONPath.

## Condition Debugging

### Condition Evaluation

See how conditions evaluate:

```
┌─────────────────────────────────────┐
│ Condition: Check Status             │
├─────────────────────────────────────┤
│ Expression:                         │
│   {{status}} == "success"           │
│                                     │
│ Evaluated:                          │
│   "success" == "success"            │
│                                     │
│ Result: TRUE → Taking True path     │
└─────────────────────────────────────┘
```

### Switch Evaluation

```
┌─────────────────────────────────────┐
│ Switch: Route by Status             │
├─────────────────────────────────────┤
│ Expression: {{orderStatus}}         │
│ Value: "pending"                    │
│                                     │
│ Cases:                              │
│   "pending" ← MATCHED               │
│   "completed"                       │
│   "cancelled"                       │
│                                     │
│ Result: → Process Pending           │
└─────────────────────────────────────┘
```

## Loop Debugging

### Loop Progress

```
┌─────────────────────────────────────┐
│ Loop: Process Users (ForEach)       │
├─────────────────────────────────────┤
│ Array: {{users}} (5 items)          │
│ Current Iteration: 3 of 5           │
│                                     │
│ Loop Variables:                     │
│   $index: 2                         │
│   $item: {"id": "usr_003", ...}     │
│   $first: false                     │
│   $last: false                      │
├─────────────────────────────────────┤
│ Iterations:                         │
│   0: ✓ Passed                       │
│   1: ✓ Passed                       │
│   2: ⏳ Running                      │
│   3: ○ Pending                      │
│   4: ○ Pending                      │
└─────────────────────────────────────┘
```

### Per-Iteration Variables

View variables for each iteration:

```
Iteration 0:
  userId: "usr_001"
  result: "success"

Iteration 1:
  userId: "usr_002"
  result: "success"

Iteration 2:
  userId: "usr_003"
  result: "failed" ← Error here
```

## Error Diagnosis

### Error Details

When a node fails:

```
┌─────────────────────────────────────────────────────────┐
│ ✗ Error: HTTP Node Failed                               │
├─────────────────────────────────────────────────────────┤
│ Node: Get User Details                                  │
│ Error Type: HTTP Error                                  │
│                                                         │
│ Details:                                                │
│   Status: 404 Not Found                                 │
│   Message: User not found                               │
│                                                         │
│ Request:                                                │
│   GET https://api.example.com/users/invalid_id          │
│                                                         │
│ Response:                                               │
│   {"error": "USER_NOT_FOUND", "message": "..."}         │
├─────────────────────────────────────────────────────────┤
│ Possible Causes:                                        │
│   - userId variable has wrong value                     │
│   - User was deleted before this step                   │
│   - Wrong environment selected                          │
└─────────────────────────────────────────────────────────┘
```

### Assertion Failures

```
┌─────────────────────────────────────┐
│ Assertion Failed                    │
├─────────────────────────────────────┤
│ Assertion: $.status equals "active" │
│                                     │
│ Expected: "active"                  │
│ Actual: "pending"                   │
│                                     │
│ Full Response:                      │
│ {                                   │
│   "id": "usr_123",                  │
│   "status": "pending"    ← HERE     │
│ }                                   │
└─────────────────────────────────────┘
```

### Extraction Failures

```
┌─────────────────────────────────────┐
│ Extraction Failed                   │
├─────────────────────────────────────┤
│ Variable: authToken                 │
│ Path: $.data.token                  │
│                                     │
│ Error: Path not found               │
│                                     │
│ Actual Response:                    │
│ {                                   │
│   "data": {                         │
│     "accessToken": "..."  ← Note:   │
│   }                         different│
│ }                           name    │
└─────────────────────────────────────┘
```

## Console Logging

### Using SetVariable for Debugging

Add debug nodes:

```yaml
SetVariable: Debug Log
  Assignments:
    - name: debugInfo
      value: "Step: Create User, userId={{userId}}, status={{status}}"
```

### Viewing Debug Info

Variables panel shows debug messages:

```
debugInfo: "Step: Create User, userId=usr_456, status=success"
```

## Common Issues

### Variable Not Found

**Symptom:** `{{userId}}` shows as literal text

**Causes:**
- Variable not extracted yet
- Extraction failed
- Typo in variable name

**Fix:** Check extraction config, verify response structure

### Wrong Path in Flow

**Symptom:** Unexpected condition branch taken

**Causes:**
- Condition expression error
- Variable value unexpected
- Type mismatch (string vs number)

**Fix:** Check condition evaluation, inspect variable values

### Timeout

**Symptom:** Node hangs, eventually times out

**Causes:**
- Server not responding
- Wrong URL
- Network issue

**Fix:** Verify URL, check server status, increase timeout

### Auth Failure

**Symptom:** 401 Unauthorized on HTTP nodes

**Causes:**
- Wrong credentials
- Token expired
- Auth not configured

**Fix:** Verify auth config, check token validity

## Tips & Best Practices

### 1. Start with Quick Test

Always validate with Quick Test before performance testing.

### 2. Use Step-Through for Complex Flows

For workflows with many branches, step through to understand flow.

### 3. Check Variables After Each HTTP Node

Verify extractions worked before using values.

### 4. Add Debug Checkpoints

Insert SetVariable nodes to log state at key points.

### 5. Test Each Branch

Modify inputs to test all condition branches.

### 6. Isolate Issues

When errors occur, run a minimal subset of nodes to isolate the problem.

## Related Guides

- [Workflow Designer Guide](./workflow-designer-guide.md) — Building workflows
- [Workflow Variables Guide](./workflow-variables-guide.md) — Variables
- [Workflow Nodes Reference](./workflow-nodes-reference.md) — Node types
