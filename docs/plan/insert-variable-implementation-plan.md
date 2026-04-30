# Insert Variable Modal — Option C+ Implementation Plan

## Overview

Redesign the `WorkflowVariableInsertModal` from a simple two-column ref-based picker into a full-featured **three-column, source-aware, composable** variable insertion system with expression builder support.

**Mockup**: `docs/mockup-option-c-plus.html` (deleted — implementation complete)

> **Status:** Phases 1–3 complete ✅; Phase 4 deferred (future extensibility)

---

## Phase 1 — Source-Aware Grouping (Foundation) ✅ Complete

**Goal**: Replace ref-format-based grouping (`parseScopedRef`) with actual source node metadata. Add the three-column layout with category toolbar, node-type icons, and detail pane.

### Data Model Change

```ts
// src/utils/workflowVariableHints.ts
export interface WorkflowVariableHintSource {
  nodeId?: string;
  nodeLabel: string;
  nodeType: WorkflowNodeType | 'workflow';
  category: 'Triggers' | 'HTTP Steps' | 'Logic' | 'Integrations' | 'Workflow';
}

export interface WorkflowVariableHint {
  ref: string;
  label: string;
  description?: string;
  type?: string;
  source?: WorkflowVariableHintSource;   // NEW
  defaultValue?: string;                  // NEW — for detail pane
}
```

### Files Changed

| File | Change |
|------|--------|
| `src/utils/workflowVariableHints.ts` | Add `source` + `defaultValue` to interface; populate in `buildWorkflowOnlyHints`, `collectConditionVariableHints`, `mergeHttpVariableHintsWithStepInitialVars` |
| `src/components/workflow/WorkflowVariableInsertModal.tsx` | Replace `parseScopedRef`-based grouping with `source`-based grouping; add category toolbar, node-type icons, detail pane; add same-name disambiguation warnings |
| `src/styles/workflow.css` | Add CSS for three-column layout, category toolbar, detail pane, source pills, node-type icon colors |
| `src/utils/workflowVariableHints.test.ts` | Add tests for `source` field population on all hint builders |
| `src/components/workflow/WorkflowVariableInsertModal.test.tsx` | Update tests for new grouping logic, add tests for category filtering |

### Node Type → Icon/Color Map

| nodeType | Icon | Color | Category |
|----------|------|-------|----------|
| `workflow` | ⚡ | amber | Workflow |
| `start` | ▶ | green | Triggers |
| `webhook` | 🔔 | green | Triggers |
| `schedule` | 📅 | green | Triggers |
| `http` | ↗ | blue | HTTP Steps |
| `condition` | ◇ | cyan | Logic |
| `switch` | ⑃ | cyan | Logic |
| `loop` | ↻ | cyan | Logic |
| `waitForCondition` | ⏳ | orange | Logic |
| `setVariable` | ⊕ | purple | Logic |
| `aggregate` | Σ | teal | Logic |
| `delay` | ⏸ | gray | Logic |
| `errorHandler` | ⚠ | red | Logic |
| `logDebug` | 📝 | gray | Logic |
| `fork` / `join` | ⑂ | gray | Logic |
| `slack` | 💬 | #e01e5a | Integrations |
| `email` | ✉ | #ea4335 | Integrations |
| `gsheet` | 📊 | #34a853 | Integrations |
| `excel` | 📗 | #217346 | Integrations |
| `outlook` | 📧 | #0078d4 | Integrations |

### Acceptance Criteria

- [x] All `WorkflowVariableHint` objects have `source` populated
- [x] Modal groups by `source.nodeLabel` instead of ref format
- [x] Left column shows sources grouped by category with icons
- [x] Right detail pane shows ref, type, description, default value, source path
- [x] Same-name disambiguation warnings when multiple sources have same variable name
- [x] Category toolbar filters sources (All / Triggers / HTTP / Logic / Integrations)
- [x] Backward compatible — existing consumers work without `source`
- [x] All tests pass, coverage ≥ 90%

### Estimated Effort: **Medium** (2–3 files changed, ~200 lines net)

---

## Phase 2 — Compose Mode (Multi-Variable Insert) ✅ Complete

**Goal**: Add a toggle between Quick Insert (single-click → immediate insert) and Compose mode (checkbox selection → accumulate in compose strip → Insert All).

### New Components / Changes

| File | Change |
|------|--------|
| `src/components/workflow/WorkflowVariableInsertModal.tsx` | Add `composeMode` state; render checkboxes when compose is on; manage `composeTokens` array; render compose strip |
| `src/components/workflow/ComposeStrip.tsx` | **NEW** — Compose strip component: token list (var/literal/fn), drag-to-reorder, add literal text, preview, clear, insert all |
| `src/styles/workflow.css` | Compose strip CSS (tokens, drag handles, preview bar) |
| `src/components/workflow/ComposeStrip.test.tsx` | **NEW** — Tests for token management, reorder, literal insertion, preview |

### Compose Token Type

```ts
interface ComposeToken {
  id: string;                          // unique key for drag
  kind: 'variable' | 'literal' | 'expression';
  value: string;                       // "{{jobId}}" or " — " or "$upper({{name}})"
  displayLabel: string;                // rendered label
  source?: WorkflowVariableHintSource; // for color-coding
}
```

### Key Behaviors

- **Toggle**: Top-bar switch between Quick Insert / Compose
- **Checkboxes**: Each variable row gets a checkbox in compose mode
- **Compose strip**: Bottom area shows accumulated tokens with:
  - Drag-to-reorder
  - `+ literal text` button (opens inline input)
  - Preview line showing resolved template
  - `Clear` and `Insert All (N tokens)` buttons
- **Quick Actions** in detail pane: "Add separator between all", "Wrap each in $upper()"
- **Output**: `onPick(template)` — same signature, just a longer string like `{{jobId}} — {{jobName}}`

### Acceptance Criteria

- [x] Compose toggle switches between Quick Insert and Compose mode
- [x] Checking a variable adds it to the compose strip
- [x] Literal text can be inserted between variables
- [x] Tokens can be reordered by drag
- [x] Preview shows resolved template
- [x] "Insert All" calls `onPick()` with the full composed template
- [x] Quick Insert mode behavior unchanged from current
- [x] Tests cover compose mode: add, remove, reorder, literal, insert all
- [x] Coverage ≥ 90%

### Estimated Effort: **Medium** (~1 new component, ~150 lines net)

---

## Phase 3 — Expression Builder Tab ✅ Complete

**Goal**: Add an "Expression" tab alongside Browse/Search. Users can compose enriched expressions using built-in functions (`$upper`, `$jsonpath`, `$default`, etc.) combined with variables.

### New Files

| File | Purpose |
|------|---------|
| `src/features/workflow/utils/expressionFunctions/` | **DONE** — Modular function registry (refactored from single 957-line file into 9 modules: index, types, helpers, stringFunctions, mathFunctions, jsonFunctions, dateTimeFunctions, conditionalFunctions, encodingFunctions) |
| `src/features/workflow/utils/expressionEvaluator.ts` | **DONE** — Parse and evaluate `$fn(args)` syntax in templates |
| `src/features/workflow/components/expression/ExpressionBuilderView.tsx` | **DONE** — Three-column expression builder: function catalog, composer, preview |
| `src/features/workflow/utils/expressionFunctions/helpers.test.ts` | **DONE** — 29 tests for coercion helpers |
| `src/features/workflow/utils/expressionFunctions/index.test.ts` | **DONE** — 29 tests for registry and grouping |
| `src/features/workflow/components/expression/ExpressionBuilderView.test.tsx` | **DONE** — Component tests |

### Expression Function Registry

```ts
export interface ExpressionFunction {
  name: string;               // "$upper"
  category: string;            // "String" | "JSON" | "Math" | "Date" | "Conditional" | "Encoding"
  signature: string;           // "$upper(value: string) → string"
  description: string;
  args: { name: string; type: string; required: boolean; description: string }[];
  returnType: string;
  examples: { input: string; output: string }[];
  evaluate: (...args: unknown[]) => unknown;
}
```

### Function Catalog

| Category | Functions |
|----------|-----------|
| **String** | `$upper`, `$lower`, `$trim`, `$concat`, `$substring`, `$replace`, `$length`, `$split`, `$join` |
| **JSON** | `$jsonpath`, `$parse`, `$stringify`, `$keys`, `$values`, `$count`, `$flatten` |
| **Math** | `$add`, `$subtract`, `$multiply`, `$divide`, `$round`, `$abs`, `$min`, `$max` |
| **Date/Time** | `$now`, `$formatDate`, `$diffMs`, `$addDays`, `$toIso` |
| **Conditional** | `$default`, `$if`, `$isEmpty`, `$contains`, `$matches` |
| **Encoding** | `$base64`, `$base64Decode`, `$urlEncode`, `$urlDecode`, `$hash` |

### Integration Points

- **Expression Builder View**: Left = scrollable function catalog grouped by category; Middle = textarea composer with syntax highlighting + variable chips; Right = selected function docs + live preview
- **Engine integration**: `src/engine/requestExecution.ts` template resolver must be extended to handle `$fn()` calls
- **Compose strip**: Expression tokens use `kind: 'expression'` and get the pink/magenta color

### Acceptance Criteria

- [x] Expression tab shows function catalog with 25+ functions across 6 categories
- [x] Clicking a function inserts template at cursor
- [x] Variable chips below composer allow click-to-insert
- [x] Live preview evaluates expression with sample values
- [x] Function detail pane shows signature, args table, examples
- [x] Engine resolves `$fn()` calls at runtime
- [x] Expressions can be used in Compose mode tokens
- [x] All functions have unit tests
- [x] Coverage ≥ 90%

### Estimated Effort: **Large** (3–4 new files, engine changes, ~500+ lines net)

---

## Phase 4 — Integration Node Extensibility — Deferred

> Deferred: No integration nodes (Slack, Email, etc.) exist yet. The provider
> pattern will be implemented when the first integration node is added.

### New Files

| File | Purpose |
|------|---------|
| `src/utils/nodeVariableProviders.ts` | **NEW** — Provider registry and interface |
| `src/utils/nodeVariableProviders.test.ts` | **NEW** — Tests |

### Provider Interface

```ts
export interface NodeVariableProvider {
  nodeType: string;
  icon: string;
  color: string;
  category: 'Triggers' | 'HTTP Steps' | 'Logic' | 'Integrations';
  getOutputVariables(nodeId: string, data: unknown, label: string): WorkflowVariableHint[];
}

// Registry
const providers = new Map<string, NodeVariableProvider>();
export function registerNodeVariableProvider(provider: NodeVariableProvider): void;
export function getNodeVariableProvider(nodeType: string): NodeVariableProvider | undefined;
```

### Refactoring

- Extract the `switch(n.type)` logic in `collectConditionVariableHints()` into provider calls
- Each current node type (setVariable, aggregate, loop, waitForCondition, start) becomes a built-in provider
- New integration nodes (slack, email, etc.) just register a provider — zero changes to the modal

### Example: Slack Provider

```ts
registerNodeVariableProvider({
  nodeType: 'slack',
  icon: '💬',
  color: '#e01e5a',
  category: 'Integrations',
  getOutputVariables(nodeId, data, label) {
    const d = data as SlackNodeData;
    return [
      { ref: `deliveryStatus`, label: `deliveryStatus ← "${label}"`, type: 'string',
        source: { nodeId, nodeLabel: label, nodeType: 'slack', category: 'Integrations' } },
      { ref: `messageTs`, label: `messageTs ← "${label}"`, type: 'string',
        source: { nodeId, nodeLabel: label, nodeType: 'slack', category: 'Integrations' } },
    ];
  },
});
```

### Acceptance Criteria — Deferred

- [ ] All existing node types use the provider pattern
- [ ] Adding a new node type requires only a `registerNodeVariableProvider()` call
- [ ] Modal automatically shows new providers with correct icons/colors/categories
- [ ] Zero changes to `WorkflowVariableInsertModal.tsx` when adding new node types
- [ ] Tests validate provider registration, variable collection, and edge cases
- [ ] Coverage ≥ 90%

### Estimated Effort: **Medium** (refactor existing code into providers, ~200 lines net)

---

## Phase Summary

| Phase | Scope | Dependencies | Key Deliverable |
|-------|-------|-------------|----------------|
| **1** | Source-aware grouping | None | Three-column modal with proper source attribution | ✅ |
| **2** | Compose mode | Phase 1 | Multi-variable selection + compose strip | ✅ |
| **3** | Expression builder | Phase 1 | Function catalog + expression composer + live preview | ✅ |
| **4** | Node extensibility | Phase 1 | Plugin-style provider registry for new node types | Deferred |

**Recommended order**: Phase 1 → 2 → 3 → 4 (each builds on previous)

Phases 2, 3, and 4 are independent of each other and could be parallelized after Phase 1 is complete.

---

## Viewport / Layout Constraints

- Modal renders as an **overlay inside the right panel area** (not fullscreen over the entire IDE)
- The panel area width is determined by the **vertical resize bar** (user-draggable)
- Modal uses `max-height: 92%; max-width: 95%` of the panel area
- All three columns scroll independently; compose strip and status bar are pinned
- Minimum panel width: **400px** — below this the modal collapses left column into a dropdown
- When the panel is narrow (< 600px), detail pane becomes a **bottom sheet** instead of right column

---

## Existing Code to Leverage

| Asset | Location | Reuse |
|-------|----------|-------|
| JSON tree builder | `src/utils/jsonPathTreeUtils.ts` | Expression builder's `$jsonpath()` preview |
| JSONPath resolver | `src/engine/validator.ts` → `getByPath()` | Live preview evaluation |
| Picker tree node | `src/components/RegexAssertionModal.tsx` → `PickerNode` | Could reuse for JSON preview in Expression tab |
| Extraction mapper | `src/components/ExtractionMapperModal.tsx` | Pattern for compose strip (accumulate → review → apply) |
| Modal drag hook | `src/hooks/useModalDrag.ts` | Already used by current modal |
| Debounced search | `src/hooks/useDebounce.ts` | Search + expression preview |
