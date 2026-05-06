# Sub-Workflows Guide

Compose complex workflows from reusable building blocks — call workflows from other workflows.

## Overview

**Sub-workflows** enable:
- Workflow reuse and composition
- Modular design
- Simplified maintenance
- Reduced duplication

## What is a Sub-Workflow?

A sub-workflow is a workflow called from within another workflow:

```
Main Workflow:
  [Start] → [Create Order] → [Sub: Process Payment] → [Send Email] → [End]
                                      │
                                      └── Calls another workflow
```

## Sub-Workflow Node

### Configuration

```
┌─────────────────────────────────────────────────────────┐
│ Sub-Workflow Node: Process Payment                      │
├─────────────────────────────────────────────────────────┤
│ Workflow: [Select Workflow ▼]                          │
│           ☑ Payment Processing Flow                    │
│           ○ Email Notification Flow                    │
│           ○ Data Validation Flow                       │
│                                                         │
│ Input Variables:                                        │
│ ┌────────────┬─────────────────────────────────────┐   │
│ │ Sub-wf Var │ Value from Main Workflow            │   │
│ ├────────────┼─────────────────────────────────────┤   │
│ │ amount     │ {{orderTotal}}                      │   │
│ │ orderId    │ {{orderId}}                         │   │
│ │ customerId │ {{customer.id}}                     │   │
│ └────────────┴─────────────────────────────────────┘   │
│                                                         │
│ Output Mapping:                                         │
│ ┌────────────┬─────────────────────────────────────┐   │
│ │ Main Var   │ From Sub-workflow Result            │   │
│ ├────────────┼─────────────────────────────────────┤   │
│ │ paymentId  │ result.transactionId               │   │
│ │ payStatus  │ result.status                      │   │
│ └────────────┴─────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Input Variables

Pass data from main workflow to sub-workflow:

```yaml
Main Workflow Variables:
  orderTotal: 99.99
  orderId: "ORD-123"
  customer: { id: "CUST-456", name: "John" }

Sub-Workflow Receives:
  amount: 99.99          # mapped from orderTotal
  orderId: "ORD-123"     # mapped from orderId
  customerId: "CUST-456" # mapped from customer.id
```

### Output Mapping

Capture sub-workflow results:

```yaml
Sub-Workflow Returns:
  result:
    transactionId: "TXN-789"
    status: "completed"
    timestamp: "2024-01-15T10:30:00Z"

Main Workflow Receives:
  paymentId: "TXN-789"   # mapped from result.transactionId
  payStatus: "completed" # mapped from result.status
```

## Creating Reusable Workflows

### Design for Reuse

Good sub-workflow characteristics:
- Clear input/output contract
- Single responsibility
- No hardcoded values
- Well-documented variables

### Example: Payment Processing

```yaml
Workflow: Payment Processing
  Input Variables:
    - amount (required): Payment amount
    - orderId (required): Order reference
    - customerId (required): Customer ID
    - currency (optional, default: "USD"): Currency code
  
  Flow:
    [Start]
    → [Validate Amount]
    → [Call Payment Gateway]
    → [Log Transaction]
    → [End]
  
  Output:
    - transactionId: Payment reference
    - status: "completed" | "failed" | "pending"
    - errorMessage: Error details if failed
```

### Example: Email Notification

```yaml
Workflow: Email Notification
  Input Variables:
    - recipientEmail (required)
    - subject (required)
    - templateName (required)
    - templateData (required): Object with template variables
  
  Flow:
    [Start]
    → [Load Template]
    → [Render Template]
    → [Send Email]
    → [End]
  
  Output:
    - messageId: Email tracking ID
    - sent: boolean
```

## Nesting and Composition

### Nested Sub-Workflows

Sub-workflows can call other sub-workflows:

```
Main Workflow
  └── Sub: Order Processing
        └── Sub: Payment Processing
        └── Sub: Inventory Update
        └── Sub: Email Notification
```

### Nesting Limits

- Maximum depth: 10 levels
- Circular references detected and prevented

### Composition Pattern

Build complex flows from simple parts:

```
Order Fulfillment Workflow:
  [Start]
  → [Sub: Validate Order]
  → [Sub: Process Payment]
  → [Fork]
      ├── [Sub: Update Inventory]
      └── [Sub: Notify Customer]
  → [Join]
  → [Sub: Create Shipping Label]
  → [End]
```

## Error Handling

### Sub-Workflow Failure

When a sub-workflow fails:

```yaml
Sub-Workflow Node:
  On Error:
    ○ Fail main workflow
    ● Continue with error output
    ○ Retry N times
```

### Error Output

Access error information:

```
{{$subworkflow.error}}
{{$subworkflow.errorMessage}}
{{$subworkflow.errorNode}}
```

### Error Handler Pattern

```
[Sub: Process Payment]
     ↓
[Condition: $subworkflow.error?]
   ├─ Yes → [Handle Payment Error]
   └─ No → [Continue Processing]
```

## Timeout Configuration

### Sub-Workflow Timeout

```yaml
Sub-Workflow Node:
  Timeout: 60s   # Wait max 60 seconds for completion
  
  On Timeout:
    ○ Fail
    ● Return default output
```

### Long-Running Sub-Workflows

For sub-workflows that may take time:

```yaml
Timeout: 300s  # 5 minutes
On Timeout: Continue with partial result
```

## Variable Scope

### Isolation

Sub-workflows have isolated variable scope:
- Cannot directly access main workflow variables
- Must pass values via input mapping
- Returns values via output mapping

### Why Isolation?

- Prevents accidental variable conflicts
- Makes dependencies explicit
- Enables independent testing

### Sharing Data

```yaml
Main Workflow:
  Variables: orderId, userId, settings

Sub-Workflow Inputs:
  orderId: {{orderId}}     # Explicitly passed
  userId: {{userId}}       # Explicitly passed
  # settings NOT passed - sub-workflow doesn't need it
```

## Testing Sub-Workflows

### Independent Testing

Test sub-workflows in isolation:

1. Open sub-workflow
2. Set test input variables
3. Run Quick Test
4. Verify outputs

### Integration Testing

Test main workflow with sub-workflows:

1. All sub-workflows use actual implementation
2. Quick Test runs full flow
3. Step-through to inspect sub-workflow execution

### Mocking Sub-Workflows

For main workflow testing without sub-workflow execution:

```yaml
Sub-Workflow Node:
  Mock Mode: Enabled
  Mock Output:
    transactionId: "MOCK-TXN-123"
    status: "completed"
```

## Performance Considerations

### Overhead

Sub-workflow calls add:
- Context switching overhead
- Variable mapping time
- Additional memory usage

### When to Use

**Good candidates:**
- Complex, reusable logic
- Multiple workflows need same capability
- Clear boundaries and contracts

**Not recommended:**
- Simple, one-liner operations
- Heavily nested structures
- Performance-critical hot paths

## Tips & Best Practices

### 1. Design Clear Contracts

Document input/output:
```yaml
# Payment Processing Workflow
# 
# Inputs:
#   amount (number, required): Payment amount in dollars
#   orderId (string, required): Order reference
#
# Outputs:
#   transactionId (string): Payment transaction ID
#   status (string): "completed" | "failed"
```

### 2. Use Meaningful Names

```
✓ "Process Payment"
✓ "Send Order Confirmation Email"
✗ "Sub1"
✗ "Helper"
```

### 3. Keep Sub-Workflows Focused

One responsibility per sub-workflow:
```
✓ "Validate Order" - just validation
✓ "Process Payment" - just payment
✗ "Validate and Process" - too many responsibilities
```

### 4. Handle Errors Gracefully

Always configure error handling for sub-workflow nodes.

### 5. Test in Isolation

Test sub-workflows independently before using in main workflow.

## Related Guides

- [Workflow Designer Guide](./workflow-designer-guide.md) — Building workflows
- [Workflow Variables Guide](./workflow-variables-guide.md) — Variables
- [Workflow Debugging Guide](./workflow-debugging-guide.md) — Debugging
