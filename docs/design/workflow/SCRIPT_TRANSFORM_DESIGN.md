# Script/Transform Node — Design & Architecture

> Phase 5 feature from [DESIGN.md](DESIGN.md) — Priority #1 in Extended Capabilities

## Overview

The Script/Transform node enables users to execute custom JavaScript within a workflow to perform complex data manipulation, custom validation, and dynamic data generation — capabilities beyond what template expressions and the Set Variable node offer.

**Use cases:**
- Parse and reshape API response JSON (extract nested fields, flatten arrays)
- Custom assertion logic (compare two responses, validate business rules)
- Generate dynamic test data (random payloads, computed timestamps)
- String manipulation (regex extraction, encoding/decoding)
- Aggregation logic (sum, average, custom reduce)

---

## 1. Data Model

```typescript
export interface ScriptNodeData {
  [key: string]: unknown;
  label: string;
  /** JavaScript source code */
  code: string;
  /** Execution mode */
  mode: 'transform' | 'validate' | 'generate';
  /** Variables explicitly passed into the script sandbox */
  inputVariables: string[];
  /** Variables the script exports back to the workflow context */
  outputVariables: string[];
  /** Timeout in milliseconds (default 5000, max 30000) */
  timeoutMs: number;
  /** Whether to log console.log output to workflow console */
  captureConsole: boolean;
}
```

### Modes

| Mode | Purpose | Pass/Fail Behavior |
|------|---------|-------------------|
| **transform** | Map/reshape data | Always passes unless script throws |
| **validate** | Custom assertion logic | Passes when `output.result === true` |
| **generate** | Produce test data dynamically | Always passes unless script throws |

### Type Registration

```typescript
// WorkflowNodeType union
export type WorkflowNodeType = '...' | 'script';

// WorkflowNodeData union
export type WorkflowNodeData = ... | ScriptNodeData;
```

### Default Node Data

```typescript
case 'script': return {
  label: 'Script',
  code: '// Access input variables via input.varName\n// Set output variables via output.varName\n\noutput.result = input.value;\n',
  mode: 'transform',
  inputVariables: [],
  outputVariables: [],
  timeoutMs: 5000,
  captureConsole: true,
} as ScriptNodeData;
```

---

## 2. UI Design

### 2.1 Canvas Node

```
  ┌─────────────────────┐
  │  </>  Transform Data │  ← Code icon + label
  │       Script         │  ← Category sublabel
  │  ──────────────────  │
  │  3 in → 2 out        │  ← Variable count summary
  └─────────────────────┘
```

- **Color**: Purple/violet (`wf-node-script` CSS class)
- **Icon**: Code brackets icon (`</>`)
- **Category**: "Logic" (same group as Condition, Switch)
- **Handles**: Top (input), Bottom (output) — single in/single out

### 2.2 Config Panel

```
┌─────────────────────────────────────────────────┐
│ SCRIPT — Transform Data                         │
├─────────────────────────────────────────────────┤
│ Label: [Transform Response        ]             │
│ Mode:  [transform ▾]                            │
├─────────────────────────────────────────────────┤
│ Input Variables (available as `input.varName`):  │
│  ☑ response_body   ☑ status   ☐ headers         │
│  [+ Add variable]                               │
├─────────────────────────────────────────────────┤
│ ┌─ Code Editor ────────────────────────────────┐│
│ │ // Transform the API response               ││
│ │ const data = JSON.parse(input.response_body);││
│ │ output.userCount = data.users.length;        ││
│ │ output.firstUser = data.users[0].name;       ││
│ │ output.isValid = data.users.length > 0;      ││
│ └──────────────────────────────────────────────┘│
├─────────────────────────────────────────────────┤
│ Output Variables (exported to workflow):         │
│  userCount, firstUser, isValid                   │
│  [Auto-detect from code]                         │
├─────────────────────────────────────────────────┤
│ ⚙ Timeout: [5000] ms   ☑ Capture console.log   │
└─────────────────────────────────────────────────┘
```

### 2.3 Code Editor

**Phase A**: `<textarea>` with monospace font and basic styling.

**Phase B**: Monaco Editor (`@monaco-editor/react`) providing:
- JavaScript syntax highlighting
- Autocomplete for `input.*` and `output.*` properties
- Bracket matching and auto-indentation
- Error squiggles for syntax errors
- Variable insert button (`{{var}}`) consistent with `InsertVarField` pattern

---

## 3. Execution Engine

### 3.1 Sandbox Design (Phase A — `Function` Constructor)

```typescript
export async function executeScript(
  code: string,
  inputVars: Record<string, string>,
  timeoutMs: number,
  onConsole?: (msg: string) => void,
): Promise<{ outputs: Record<string, string>; error?: string }> {
  const input = Object.freeze({ ...inputVars });
  const output: Record<string, unknown> = {};
  const consoleLogs: string[] = [];

  const sandbox = {
    input,
    output,
    console: {
      log: (...args: unknown[]) => {
        const msg = args.map(a =>
          typeof a === 'string' ? a : JSON.stringify(a)
        ).join(' ');
        consoleLogs.push(msg);
        onConsole?.(msg);
      },
      warn: (...args: unknown[]) => { /* same pattern */ },
      error: (...args: unknown[]) => { /* same pattern */ },
    },
    // Safe built-ins
    JSON, Math, Date, parseInt, parseFloat,
    String, Number, Boolean, Array, Object,
    RegExp, Map, Set, encodeURIComponent, decodeURIComponent,
    atob, btoa, isNaN, isFinite, undefined, NaN, Infinity,
  };

  // Explicitly EXCLUDED from sandbox:
  // fetch, XMLHttpRequest, eval, Function, require, import,
  // globalThis, window, document, process, setTimeout, setInterval

  const fn = new Function(
    ...Object.keys(sandbox),
    `"use strict";\n${code}`
  );

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    await Promise.race([
      Promise.resolve(fn(...Object.values(sandbox))),
      new Promise((_, reject) => {
        controller.signal.addEventListener('abort', () =>
          reject(new Error(`Script timed out after ${timeoutMs}ms`))
        );
      }),
    ]);

    // Serialize outputs to string map for VariableContext
    const stringOutputs: Record<string, string> = {};
    for (const [k, v] of Object.entries(output)) {
      stringOutputs[k] = typeof v === 'string' ? v : JSON.stringify(v);
    }
    return { outputs: stringOutputs };
  } catch (err) {
    return { outputs: {}, error: String(err) };
  } finally {
    clearTimeout(timer);
  }
}
```

### 3.2 Security Considerations

| Threat | Mitigation |
|--------|------------|
| Network access (`fetch`) | Not provided in sandbox |
| DOM manipulation | `window`/`document` not provided |
| Code injection (`eval`) | Not provided; strict mode enforced |
| Infinite loops | Timeout via `Promise.race` (async only in Phase A) |
| Prototype pollution | `Object.freeze` on input; strict mode |
| Data exfiltration | No I/O channels beyond `output` object |
| Resource exhaustion | Timeout + max output size enforcement |

**Phase C upgrade**: Move execution to a **Web Worker** for true synchronous infinite-loop protection and main-thread isolation.

### 3.3 graphRunner Integration

```typescript
// Inside visit() function in graphRunner.ts

if (node.type === 'script') {
  const scriptData = node.data as ScriptNodeData;
  log({ prefix: '#', text: `[${nodeLabel(nodeId)}] Executing script (${scriptData.mode})...` });

  // Resolve input variables from VariableContext
  const inputVars: Record<string, string> = {};
  for (const varName of scriptData.inputVariables) {
    inputVars[varName] = ctx.resolve(`{{${varName}}}`);
  }

  const result = await executeScript(
    scriptData.code,
    inputVars,
    scriptData.timeoutMs,
    scriptData.captureConsole
      ? (msg) => log({ prefix: '#', text: `[${nodeLabel(nodeId)}] console: ${msg}` })
      : undefined,
  );

  if (result.error) {
    callbacks.onNodeStateChange(nodeId, {
      state: 'fail',
      error: result.error,
    });
    allPassed = false;
  } else {
    // Write outputs to VariableContext
    for (const [k, v] of Object.entries(result.outputs)) {
      ctx.set(k, v);
    }
    callbacks.onVariablesChange(ctx.snapshot());

    // In validate mode, check output.result
    const passed = scriptData.mode === 'validate'
      ? result.outputs['result'] === 'true'
      : true;

    callbacks.onNodeStateChange(nodeId, {
      state: passed ? 'pass' : 'fail',
      responseDetail: JSON.stringify(result.outputs, null, 2),
    });
    if (!passed) allPassed = false;
  }

  await visitOutgoing(nodeId);
  return;
}
```

---

## 4. Files to Create/Modify

### New Files

| File | Purpose |
|------|---------|
| `src/features/workflow/components/nodes/ScriptNode.tsx` | Canvas node component |
| `src/features/workflow/components/nodes/ScriptNode.test.tsx` | Canvas node tests |
| `src/features/workflow/components/configs/ScriptConfig.tsx` | Config panel with code editor |
| `src/features/workflow/components/configs/ScriptConfig.test.tsx` | Config panel tests |
| `src/features/workflow/engine/scriptSandbox.ts` | `executeScript()` sandboxed runner |
| `src/features/workflow/engine/scriptSandbox.test.ts` | Sandbox tests (security + functionality) |

### Modified Files

| File | Change |
|------|--------|
| `src/features/workflow/types/workflow.ts` | Add `ScriptNodeData`, extend unions |
| `src/features/workflow/utils/workflowNodeFactory.ts` | Register `ScriptNode`, add `defaultNodeData` case |
| `src/features/workflow/engine/graphRunner.ts` | Add `case 'script'` execution branch |
| `src/features/workflow/engine/graphRunnerHelpers.ts` | Import/re-export `executeScript` |
| `src/features/workflow/utils/workflowVariableHints.ts` | Add script output variable hints |
| `src/features/workflow/components/modals/WorkflowNodeConfigModal.tsx` | Add `ScriptConfig` rendering block |
| `src/features/workflow/components/nodes/NodeIcon.tsx` | Add `case 'script'` icon |

---

## 5. Implementation Phases

### Phase A — Core (MVP) ✅
- [x] `ScriptNodeData` type + union registration
- [x] `defaultNodeData('script')` factory
- [x] `ScriptNode.tsx` canvas component
- [x] `ScriptConfig.tsx` with `<textarea>` code editor
- [x] `scriptSandbox.ts` with `Function` constructor execution
- [x] `graphRunner.ts` script execution branch
- [x] `NodeIcon` + config modal integration
- [x] Unit tests for sandbox (security + happy path)

### Phase B — UX Polish ✅
- [x] Monaco Editor integration (`@monaco-editor/react`)
- [x] Autocomplete for `input.*` / `output.*` properties
- [x] Auto-detect output variables from `output.xxx =` assignments
- [x] Syntax error highlighting (via Monaco built-in)
- [x] "Test Script" button (run with mock input, show output preview)

### Phase C — Security Hardening (partial) ✅
- [x] Max output size enforcement (1MB limit via `validateOutputSize()`)
- [x] Script complexity analysis (warns on `while(true)`, `for(;;)`, recursive functions, `eval()`, network APIs, long lines)
- [ ] Web Worker sandbox (true infinite-loop protection) — deferred; current timeout via `Promise.race` provides async protection
- [ ] CSP-compatible execution path

### Phase D — Templates & Libraries ✅
- [x] Code templates/snippets gallery (12 templates across 4 categories: transform, validate, generate, utility)
- [x] Script libraries (reusable functions shared across nodes, localStorage persistence, CRUD management UI)

### Phase E — Props & Parameters UI
> **Competitor inspiration**: Pipedream (typed `props`), Zapier (`bundle` parameters)

Configurable typed parameters that render as form fields above the code editor, making scripts reusable without editing code.

- [ ] `ScriptParam` type definition: `{ name: string; type: 'string' | 'number' | 'boolean' | 'select'; default?: string; label: string; options?: string[] }`
- [ ] Add `params: ScriptParam[]` to `ScriptNodeData`
- [ ] "Parameters" section in `ScriptConfig` UI — renders form fields above the code editor
- [ ] Parameters accessible in sandbox via `params.paramName` (separate from `input.*` variables)
- [ ] "Add Parameter" button with type picker modal
- [ ] Parameter values stored per-node, editable without touching code
- [ ] Template gallery templates ship with pre-defined params where appropriate

### Phase F — Execution History & Debugging
> **Competitor inspiration**: n8n (Debug Executions, workflow history), Node-RED (status decoration)

Per-node execution history with input/output diffing for debugging regressions.

- [ ] Store last N script executions per node (inputs, outputs, console logs, timing, pass/fail) — configurable N (default 10)
- [ ] "Execution History" tab in ScriptConfig showing timestamped run list
- [ ] Side-by-side diff view: compare any two executions (inputs diff, outputs diff)
- [ ] Canvas node status decoration: show last execution time, pass/fail indicator, output preview on the node itself (inspired by Node-RED `node.status()`)
- [ ] Console log viewer with search/filter within execution history
- [ ] Export execution history as JSON for external analysis

### Phase G — Lifecycle Hooks (Setup/Teardown)
> **Competitor inspiration**: Node-RED (On Start / On Stop tabs)

Setup code runs once before a workflow/load-test begins; teardown runs once after completion.

- [ ] Add `setupCode: string` and `teardownCode: string` fields to `ScriptNodeData`
- [ ] "Setup" and "Teardown" tabs in the Monaco editor (alongside main "Code" tab)
- [ ] Setup runs once before the first execution of the node — outputs available to all subsequent runs
- [ ] Teardown runs once after the last execution — useful for cleanup (e.g., delete test data)
- [ ] In load test mode: setup runs before ramp-up, teardown runs after cool-down
- [ ] Setup/teardown share the same sandbox but have independent timeout controls

### Phase H — Multiple Outputs & Branching
> **Competitor inspiration**: Node-RED (multiple output ports per function node)

Allow a single script node to route data to different output ports based on script logic.

- [ ] Add `outputPorts: number` (default 1, max 5) to `ScriptNodeData`
- [ ] Script accesses ports via `output[0].varName`, `output[1].varName` (indexed outputs)
- [ ] Canvas node renders multiple bottom handles when `outputPorts > 1`
- [ ] graphRunner routes execution to the corresponding connected edge based on which output port received data
- [ ] Use case: replaces simple Condition nodes — e.g., `if (status < 400) output[0].result = data; else output[1].error = msg;`
- [ ] "Run-Per-Item" mode (inspired by n8n): when enabled, script executes once per data item rather than once per batch

### Phase I — Bundled Utility Packages
> **Competitor inspiration**: n8n (external modules), Pipedream (npm import), k6 (built-in crypto/encoding/html)

Expose curated utility functions in the sandbox without requiring module imports.

- [ ] `$hash(algorithm, data)` — SHA-256, SHA-512, MD5 hashing (wraps Web Crypto API)
- [ ] `$base64.encode(str)` / `$base64.decode(str)` — Base64 encoding/decoding
- [ ] `$uuid()` — Generate UUID v4
- [ ] `$timestamp()` / `$isoDate()` — Current timestamp helpers
- [ ] `$jsonpath(obj, expression)` — JSONPath query on objects
- [ ] `$faker.*` — Subset of faker.js for test data: `$faker.name()`, `$faker.email()`, `$faker.address()`, `$faker.phone()`, `$faker.sentence()`
- [ ] `$dayjs(date)` — Lightweight date manipulation (parse, format, add, subtract)
- [ ] `$lodash.*` — Subset of lodash utilities: `_.get()`, `_.set()`, `_.groupBy()`, `_.orderBy()`, `_.uniqBy()`, `_.pick()`, `_.omit()`
- [ ] Autocomplete support in Monaco for all `$` and `_` utility functions
- [ ] Documentation panel / hover tooltips showing function signatures and examples

### Phase J — Context Storage (Persistent State)
> **Competitor inspiration**: Node-RED (node/flow/global context), k6 (SharedArray, execution context)

Allow scripts to persist state across executions within a workflow run.

- [ ] Three scope levels: `context.node` (local to this script node), `context.flow` (shared across all nodes in the workflow), `context.global` (shared across workflow runs in a session)
- [ ] `context.node.get(key)` / `context.node.set(key, value)` API in sandbox
- [ ] `context.flow.get(key)` / `context.flow.set(key, value)` for cross-node state
- [ ] Use cases: iteration counters, rate limiting, cumulative aggregation, shared tokens
- [ ] Context inspector UI showing current state at all scopes
- [ ] Context data cleared between workflow runs (flow scope) or on page reload (global scope)

### Phase K — Advanced Language Features
- [ ] TypeScript support (transpile before execution via `@typescript/twoslash` or `ts.transpileModule`)
- [ ] Async/await support in user scripts (controlled async sandbox with safe APIs)
- [ ] Multi-script chaining (sequential code blocks within one node)
- [ ] Web Worker sandbox (true infinite-loop protection, moved from Phase C)
- [ ] CSP-compatible execution path (moved from Phase C)

---

## 6. Industry Comparison

| Feature | n8n Code Node | Node-RED Function | Pipedream Code | k6 Script | Zapier Code Mode | RedfireForge Script |
|---------|--------------|-------------------|----------------|-----------|-----------------|---------------------|
| Language | JS + Python | JavaScript | Node.js v20 | JavaScript (Go runtime) | JavaScript | JavaScript |
| Editor | Monaco | ACE Editor | Monaco | External IDE | Monaco | Monaco |
| Sandbox | Task Runner (isolated process) | Node.js VM | Server-side Node.js | Go-based JS runtime | Server-side Node.js | Function constructor → Web Worker |
| I/O model | `$input.all()` / `return items` | `msg` object | `steps.*` / `$.export` | `http.get()` / `check()` | `z.*` / `bundle.*` | `input.*` / `output.*` |
| Modes | Run All / Run Each | Single execution | Per-step | Per-VU iteration | Per-trigger/action | transform / validate / generate |
| Timeout | Configurable | Configurable | 30s limit | Configurable per-scenario | 30s limit | 5s default, 30s max |
| Console | `console.log` to browser | `node.warn/error/log` | `console.log/dir` | `console.log` | `z.console.log` | Captured to workflow console |
| Network | Blocked (use HTTP node) | Allowed (full Node.js) | Allowed (full Node.js) | `k6/http` module | `z.request` | Blocked (use HTTP node) |
| Multiple outputs | No | Yes (configurable ports) | No | N/A | No | Planned (Phase H) |
| Lifecycle hooks | No | On Start / On Stop | No | `setup()` / `teardown()` | No | Planned (Phase G) |
| Props/Parameters | No | N/A | Yes (typed `props` UI) | `options` object | `bundle.inputData` | Planned (Phase E) |
| Execution history | Workflow-level | No | Per-step logs | HTML report | Zap history | Planned (Phase F) |
| Templates | No | No | No | No | No | **Yes** (12 templates, 4 categories) |
| Script libraries | No | No | No | `jslib` (npm-like) | No | **Yes** (save/load/share) |
| External modules | npm (self-hosted only) | npm (configurable) | npm (just `import`) | `jslib` collection | `z.require` (stdlib) | Planned (Phase I — curated safe-list) |
| Context/State | No | node/flow/global context | No | `SharedArray` | No | Planned (Phase J) |
| TypeScript | No | No | No | Partial (ES modules) | No | Planned (Phase K) |

### Competitive Advantages (RedfireForge unique)
- **Template Gallery**: No competitor provides a categorized, searchable template gallery within the code editor
- **Script Library Manager**: No competitor allows saving reusable script snippets with tags and descriptions at the node level
- **Three execution modes**: transform/validate/generate with mode-specific pass/fail semantics — competitors use a single generic mode
- **Script complexity analysis**: Static analysis warnings for dangerous patterns before execution — no competitor does this in the editor

---

## 7. Example Scripts

### Transform — Parse JSON Response
```javascript
const data = JSON.parse(input.response_body);
output.totalUsers = String(data.users.length);
output.activeUsers = String(data.users.filter(u => u.active).length);
output.firstUserEmail = data.users[0]?.email || 'N/A';
```

### Validate — Custom Assertion
```javascript
const body = JSON.parse(input.response_body);
const expected = JSON.parse(input.expected_schema);

output.result = Object.keys(expected).every(
  key => key in body
);
output.missingKeys = JSON.stringify(
  Object.keys(expected).filter(key => !(key in body))
);
```

### Generate — Dynamic Test Data
```javascript
const timestamp = Date.now();
const randomId = Math.random().toString(36).substring(2, 10);

output.payload = JSON.stringify({
  id: `test-${randomId}`,
  timestamp,
  name: `User ${Math.floor(Math.random() * 1000)}`,
  email: `test-${randomId}@example.com`,
});
```

### Transform — CSV to JSON
```javascript
const lines = input.csv_data.split('\n');
const headers = lines[0].split(',').map(h => h.trim());
const rows = lines.slice(1).filter(l => l.trim()).map(line => {
  const values = line.split(',');
  const obj = {};
  headers.forEach((h, i) => { obj[h] = values[i]?.trim(); });
  return obj;
});
output.json_data = JSON.stringify(rows);
output.rowCount = String(rows.length);
```

---

## 8. Competitor Research Summary

> Research conducted April 2026 against: **n8n** (Code Node + AI Code), **Node-RED** (Function node), **Pipedream** (Node.js steps), **k6/Grafana** (JavaScript API), **Zapier** (Code Mode).

### Key Findings

#### n8n Code Node
- **Run Once for All Items** vs **Run Once for Each Item** — two execution modes for batch vs per-item processing
- **AI Code Generation (Ask AI tab)** — uses ChatGPT to generate code from natural language prompts; Cloud-only; replaces editor content
- **Python support** via Pyodide (WASM) — currently JS and Python as language options
- **External npm module support** in self-hosted mode via `functionExternalModules` config
- **Built-in methods/variables**: `$input.all()`, `$('NodeName').all()`, `$execution`, `$workflow`, etc.
- **Keyboard shortcuts** in Monaco editor
- **Promises/async-await** fully supported

#### Node-RED Function Node
- **Multiple output ports** — configurable number of outputs; script routes messages via `return [msg1, msg2, null]`
- **Lifecycle hooks**: `On Start` tab (runs on deploy), `On Stop` tab (runs on re-deploy/shutdown)
- **Three context scopes**: `node.context()` (local), `flow.context()` (flow-wide), `global.context()` (global) — with sync and async access
- **Status decoration**: `node.status({fill:"green", shape:"dot", text:"count: 5"})` shows runtime state on canvas node
- **External modules**: `functionExternalModules` setting allows npm packages in Function nodes
- **`node.done()`** for signaling async completion
- **Timeout handling** for long-running scripts

#### Pipedream Code Steps
- **Typed props system**: define `props: { email: { type: "string", label: "Email" } }` — renders as form fields in the workflow builder
- **npm package import**: just `import axios from "axios"` — packages auto-installed on deploy
- **Version pinning**: `import axios from "axios@0.19.2"` for reproducible builds
- **`$.export(name, value)`** for named exports to downstream steps
- **`$.flow.exit()`** for early workflow termination
- **`$.flow.trigger(workflowId, payload)`** for invoking sub-workflows
- **ConfigurationError** class for user-facing validation errors in props
- **Monaco editor** with syntax error highlighting

#### k6 (Grafana)
- **Built-in module ecosystem**: `k6/crypto` (hashing, HMAC), `k6/encoding` (base64), `k6/data` (SharedArray), `k6/html` (parsing), `k6/metrics` (custom counters/gauges/rates/trends)
- **`setup()` / `teardown()`** lifecycle functions — run once before/after all VU iterations
- **`check(value, predicates)`** — assertion function that doesn't abort on failure
- **`group(name, fn)`** — logical grouping of checks and requests
- **Execution context**: `k6/execution` module exposes VU ID, scenario name, iteration count at runtime
- **Secrets management**: `k6/secrets` module for secure credential access
- **Error codes**: Structured numeric error taxonomy (1000-1699) for programmatic error handling
- **`jslib`**: Curated collection of utility libraries (`httpx`, `k6chaijs`, `utils`, `totp`)

#### Zapier Code Mode
- **`z` object**: `z.console.log`, `z.JSON.parse`, `z.errors` for platform-specific operations
- **`z.require()`**: Import from Node.js standard library only (no npm)
- **30-second timeout** per trigger/action
- **`bundle`** for accessing auth data, input form data, request metadata
- **Form Mode ↔ Code Mode toggle**: switch between visual form builder and code — both states preserved
- **ConfigurationError**: User-friendly error display for prop validation failures
