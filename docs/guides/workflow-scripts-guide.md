# Workflow Scripts Guide

Execute custom JavaScript code in workflows — data transformation, complex logic, and custom operations.

## Overview

**Script nodes** allow custom JavaScript execution:
- Transform data between steps
- Implement complex business logic
- Generate dynamic values
- Call custom functions

## Script Node Configuration

### Basic Structure

```javascript
// Access workflow context
const userId = context.variables.userId;
const response = context.response.body;

// Do processing
const result = processData(response);

// Set output variables
context.setVariable('processedData', result);

// Return value (optional)
return { success: true, data: result };
```

### Configuration Panel

```
┌─────────────────────────────────────────────────────────┐
│ Script Node: Transform Response                         │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────┐ │
│ │ // JavaScript code                                  │ │
│ │ const users = context.variables.users;              │ │
│ │ const activeUsers = users.filter(u => u.active);    │ │
│ │ context.setVariable('activeUsers', activeUsers);    │ │
│ │ return { count: activeUsers.length };               │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Timeout: [5000__] ms                                    │
│                                                         │
│ [Test Script]                   [Save]                  │
└─────────────────────────────────────────────────────────┘
```

## Context Object

### Available Properties

| Property | Description |
|----------|-------------|
| `context.variables` | All workflow variables |
| `context.response` | Last HTTP response |
| `context.response.body` | Response body (parsed JSON) |
| `context.response.status` | HTTP status code |
| `context.response.headers` | Response headers |
| `context.iteration` | Current loop iteration info |

### Methods

| Method | Description |
|--------|-------------|
| `context.setVariable(name, value)` | Set a workflow variable |
| `context.getVariable(name)` | Get a workflow variable |
| `context.log(message)` | Log for debugging |

## Common Use Cases

### Data Transformation

```javascript
const users = context.variables.users;

// Transform array
const transformed = users.map(user => ({
  id: user.id,
  fullName: `${user.firstName} ${user.lastName}`,
  email: user.email.toLowerCase()
}));

context.setVariable('transformedUsers', transformed);
```

### Filtering

```javascript
const orders = context.variables.orders;

const pendingOrders = orders.filter(
  order => order.status === 'pending' && order.amount > 100
);

context.setVariable('pendingOrders', pendingOrders);
context.setVariable('pendingCount', pendingOrders.length);
```

### Aggregation

```javascript
const items = context.variables.items;

const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
const tax = total * 0.08;
const grandTotal = total + tax;

context.setVariable('orderTotal', {
  subtotal: total.toFixed(2),
  tax: tax.toFixed(2),
  total: grandTotal.toFixed(2)
});
```

### String Operations

```javascript
const template = context.variables.emailTemplate;
const user = context.variables.user;

const emailBody = template
  .replace('{{name}}', user.name)
  .replace('{{orderId}}', context.variables.orderId)
  .replace('{{date}}', new Date().toLocaleDateString());

context.setVariable('emailBody', emailBody);
```

### Date/Time Operations

```javascript
const now = new Date();
const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // +24 hours

context.setVariable('timestamp', now.toISOString());
context.setVariable('expiresAt', expiresAt.toISOString());
context.setVariable('formattedDate', now.toLocaleDateString('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric'
}));
```

### Conditional Logic

```javascript
const response = context.response.body;

let nextAction;
if (response.status === 'approved') {
  nextAction = 'process';
} else if (response.status === 'pending') {
  nextAction = 'wait';
} else {
  nextAction = 'reject';
}

context.setVariable('nextAction', nextAction);
return { action: nextAction };
```

### Error Handling

```javascript
try {
  const data = JSON.parse(context.variables.rawData);
  context.setVariable('parsedData', data);
  return { success: true };
} catch (error) {
  context.log(`Parse error: ${error.message}`);
  context.setVariable('parseError', error.message);
  return { success: false, error: error.message };
}
```

## Return Values

### Simple Return

```javascript
return { status: 'complete' };

// Available as: {{$script.status}}
```

### Object Return

```javascript
return {
  processed: true,
  count: 42,
  items: ['a', 'b', 'c']
};

// Available as:
// {{$script.processed}}
// {{$script.count}}
// {{$script.items}}
```

### No Return

If nothing is returned, script output is `undefined`.

## Built-in Functions

### Available Globally

```javascript
// JSON operations
JSON.parse(string)
JSON.stringify(object)

// Math operations
Math.random()
Math.floor(), Math.ceil(), Math.round()
Math.min(), Math.max()

// Array methods
array.map(), array.filter(), array.reduce()
array.find(), array.some(), array.every()

// String methods
string.split(), string.join()
string.trim(), string.toLowerCase(), string.toUpperCase()
string.replace(), string.includes()

// Date operations
new Date()
Date.now()
```

### Not Available (Security)

```javascript
// These are NOT available:
fetch()           // Use HTTP nodes instead
require()         // No module imports
eval()            // Security risk
setTimeout()      // Use Delay nodes instead
setInterval()     // Use Loop nodes instead
```

## Script Libraries

### Using Libraries

Import shared code from Script Library:

```javascript
// Library: utils
function formatCurrency(amount) {
  return `$${amount.toFixed(2)}`;
}

function validateEmail(email) {
  return /^.+@.+\..+$/.test(email);
}

// In Script Node:
const { formatCurrency, validateEmail } = context.libraries.utils;

const price = formatCurrency(context.variables.amount);
const isValid = validateEmail(context.variables.email);
```

### Creating Libraries

1. Go to Workflow → Script Libraries
2. Click **+ New Library**
3. Write reusable functions
4. Reference in Script nodes

## Debugging Scripts

### Using context.log()

```javascript
context.log('Starting transformation');
context.log(`Processing ${items.length} items`);
context.log('Completed');

// Logs appear in workflow console
```

### Test Script Button

Test before running:

1. Click **Test Script**
2. Provide mock context data
3. See output and any errors

### Error Messages

```
Script Error at node "Transform Data":
  TypeError: Cannot read property 'map' of undefined
  at line 3: const result = items.map(...)
  
  Context:
    items: undefined
```

## Performance

### Timeout

Default timeout: 5000ms (5 seconds)

For long-running scripts:
```
Timeout: 30000  // 30 seconds
```

### Best Practices

1. **Keep scripts focused**: One task per script node
2. **Avoid heavy computation**: Use multiple nodes if needed
3. **Handle nulls**: Check for undefined values
4. **Log sparingly**: Too many logs slow execution

## Tips & Best Practices

### 1. Validate Input

```javascript
const users = context.variables.users;
if (!users || !Array.isArray(users)) {
  context.log('Warning: users is not an array');
  context.setVariable('result', []);
  return { error: 'Invalid input' };
}
```

### 2. Use Descriptive Variable Names

```javascript
// Good
const activeUserCount = users.filter(u => u.active).length;

// Bad
const x = users.filter(u => u.active).length;
```

### 3. Break Down Complex Logic

Instead of one complex script, use multiple simple ones:
```
[Script: Parse Data] → [Script: Filter] → [Script: Transform]
```

### 4. Comment Complex Logic

```javascript
// Calculate weighted average considering quantity
// Formula: sum(price * qty) / sum(qty)
const weightedAvg = items.reduce((sum, item) => 
  sum + item.price * item.quantity, 0
) / items.reduce((sum, item) => sum + item.quantity, 0);
```

## Related Guides

- [Workflow Designer Guide](./workflow-designer-guide.md) — Building workflows
- [Workflow Variables Guide](./workflow-variables-guide.md) — Variables
- [Workflow Nodes Reference](./workflow-nodes-reference.md) — All node types
