# Data Mapper Plan

> **Status:** Planning
>
> _Created: 2026-05-10 | Last updated: 2026-05-10_

## Executive Summary

Build a **Data Mapper** — a reusable, full-screen visual mapping component that replaces 6+ scattered mapping/extraction/validation UIs with one consistent experience. Users see **source JSON on the left**, **target schema on the right**, and **draw connections** between fields via drag-and-drop. For complex transformations, an inline expression editor supports code.

This consolidates the existing fragmented mapping surfaces into a single, learnable pattern that works everywhere: HTTP extraction, validation assertions, data source column mapping, workflow variable binding, shared data source fetch mapping, and webhook payload extraction.

---

## Mockups

Interactive HTML mockups are available in `docs/mockups/`:

| Mockup | File | Shows |
|--------|------|-------|
| **Data Mapper — General** | [`data-mapper-mockup.html`](../mockups/data-mapper-mockup.html) | Full three-panel layout, drag-and-drop mapping, expression editor, live preview, auto-map |
| **Data Mapper — Workflow Integration** | [`data-mapper-workflow-mockup.html`](../mockups/data-mapper-workflow-mockup.html) | 6 interactive scenes: linear chain, fork, join, chained diamonds, node config modal, body builder with upstream variable grouping + collision warnings |
| **Data Mapper — Edge Cases** | [`data-mapper-edge-cases-mockup.html`](../mockups/data-mapper-edge-cases-mockup.html) | 6 interactive scenes: array loop mapping, array aggregation, function palette (80+ functions), null/default/conditional, type mismatch with auto-fix, multi-source combine/split |

Open in Chrome to interact with the mockups.

### Training Manuals

| Manual | File | Level | Covers |
|--------|------|-------|--------|
| **Data Mapper Basics** | [`data-mapper-basics-easy.html`](../training-manuals/data-mapper/data-mapper-basics-easy.html) | Easy | Panels, drag-and-drop, auto-map, search, keyboard shortcuts, visual indicators |
| **Expression & Function Mapping** | [`data-mapper-expressions-medium.html`](../training-manuals/data-mapper/data-mapper-expressions-medium.html) | Medium | Expression editor, 80+ function palette (9 categories), conditionals, type conversion, null handling, combining/splitting, function chaining |
| **Array & Loop Mapping** | [`data-mapper-arrays-medium.html`](../training-manuals/data-mapper/data-mapper-arrays-medium.html) | Medium | Array-to-array loops, aggregation (9 functions), filtering, flatten/collect, grouping, sorting, deduplication |
| **Data Mapper in Workflows** | [`data-mapper-workflow-advanced.html`](../training-manuals/data-mapper/data-mapper-workflow-advanced.html) | Advanced | Upstream variables, source grouping by node, fork/join topologies, variable collisions, nested diamonds, entry points, troubleshooting |

Registered in Gallery: `src/data/galleries/trainingPaths/contentPaths.ts` (path ID: `data-mapper`, 2 phases, 4 manuals).

---

## Commercial Research

### Products Studied

| Product | Mapper Model | Key UX Strengths | Key Weaknesses |
|---------|-------------|-------------------|----------------|
| **MuleSoft DataWeave** | Two-panel tree view (input ↔ output), drag lines between fields, auto-maps matching names, bi-directional code sync | Real-time DataWeave script preview synced with visual map; structure-level drag maps all children; double-click output field for inline function | Heavyweight; DataWeave learning curve |
| **Dell Boomi** | Source Profile ↔ Destination Profile with drag lines, function blocks in the middle, green highlight on valid drop targets | AI-powered "Boomi Suggest" for auto-mapping; search/filter on both trees; multiple source inputs to one function | Each destination accepts only one connection; can be visually cluttered |
| **Altova MapForce** | Multi-source/target panels, function chain between them, visual debugger with breakpoints | Any-to-any format support; reusable function library; step-through debugger tracing data flow | Desktop-only; complex UI for simple mappings |
| **Azure Logic Apps Data Mapper v2** | Docked schema panels (left=source, right=target), function palette in center, drag connections | Schema search; auto-looping for arrays; real-time error detection on save; instant payload test/preview | Windows-only VS Code; no dark theme; limited filter functions |
| **Celigo Mapper 2.0** | Source ↔ Destination with type icons, drag handles for reorder, data type indicators | Clear headers; hierarchy visualization; drag reorder; help text on hover; search across full mapping rows | iPaaS-only; not a standalone component |
| **Postman Flows** | Select block for path extraction, Record block for restructuring, FQL expression language | API-specific; Select block navigates nested JSON visually; Record block constructs output shape | Block-based (not visual lines); FQL is proprietary |
| **n8n** | Expression editor with drag from input panel, Edit Fields (Set) node, Code node for JavaScript/Python | Drag from previous node output; expression editor with live preview; AI Transform node | No visual line-drawing mapper; expression-centric |

### Best Practices Extracted

1. **Two-panel tree layout** is the industry standard (MuleSoft, Boomi, Azure, Altova, Celigo)
2. **Drag-and-drop lines** between source and target fields — the universal interaction pattern
3. **Auto-mapping** by name matching accelerates common cases (MuleSoft, Boomi)
4. **Inline expressions** on target fields for transformations (MuleSoft double-click, Azure function palette)
5. **Live preview** of mapped output against sample data (MuleSoft, Azure, Altova)
6. **Search/filter** on both source and target trees (all products)
7. **Type indicators** (string, number, array, object) on tree nodes (Celigo, Azure)
8. **Array/loop handling** — visual indicator when mapping into repeated structures (Azure auto-loop, Altova)
9. **Bidirectional code sync** — visual changes update code, code changes update visual (MuleSoft)
10. **Test with sample data** — paste or fetch sample input, see mapped output instantly (Azure, Altova)

---

## Current State Audit — Scattered Mapping Surfaces

### Existing Components (to consolidate)

| # | Surface | Files | What It Does | Interaction | Reusable? |
|---|---------|-------|-------------|-------------|-----------|
| 1 | **Extraction Editor** | `ExtractionEditor.tsx`, `ExtractionPathPickerModal.tsx`, `ExtractionMapperModal.tsx` | Map HTTP response fields → workflow variables | Table rows + "Pick path" modal with JSON tree | Shared (workflow + test) |
| 2 | **JSON Path Builder** | `JsonPathBuilder.tsx`, `jsonPathTreeUtils.ts` | Multi-select JSON paths for validation expected fields | Checkbox tree over sample JSON, include/exclude modes | Primary validation mapper |
| 3 | **Regex Assertion Modal** | `RegexAssertionModal.tsx` | Pick JSON path + build regex pattern | JSON tree (`PickerNode`) + pattern library | Reusable tree picker |
| 4 | **Data Source Column Mapping** | `DataSourceEditor.tsx`, `dataSourceExpander.ts` | Map `{{column}}` placeholders to request fields | Column headers with type prefix (`path:`, `param:`, `body:`) | Parameterized tests |
| 5 | **Populate from API** | `PopulateFromApiModal.tsx`, `usePopulateFromApi.ts` | Map API response → data source columns/rows | Two-step wizard: fetch → field mapping | Shared DS specific |
| 6 | **Webhook Variable Extraction** | `graphRunnerHelpers.ts`, `CorrelationWaitConfig.tsx` | Extract fields from webhook/correlation payloads → variables | Text fields for JSON paths | Workflow-coupled |
| 7 | **Shared DS Fetch Config** | `SharedDataSourceModal.tsx`, `useSharedDsFetchConfig.ts` | Map fetch URL + response → shared DS columns | URL bar + Params/Auth/Headers/Body tabs | Shared DS modal |

### Existing Building Blocks (to keep/evolve)

| Component | File | What It Provides |
|-----------|------|-----------------|
| `jsonPathTreeUtils.ts` | `buildTree`, `getAllLeafPaths` | Core JSON → tree model |
| `jsonTreeShared.tsx` | `typeColor`, `getValuePreview`, `ChevronIcon` | Shared tree styling |
| `PickerNode` | `RegexAssertionModal.tsx` (exported) | Clickable tree node row |
| `JsonTreePreview.tsx` | `buildJTree`, search, expand/collapse | Read-only tree viewer |
| `JsonTreeViewer.tsx` | Generic viewer | Results Explorer display |
| `validator.ts` → `getByPath` | Tokenized JSONPath evaluation | Most capable path engine |
| `VariableContext` | Template resolution `{{var}}`, node-scoped, `$` functions | Workflow expression engine |

### Path Evaluation Fragmentation (to unify)

| Engine | File | Syntax | Capability |
|--------|------|--------|-----------|
| `getByPath` | `validator.ts` | `$.a.b[0].c`, `[*]` | Full JSONPath-like, array wildcards |
| `extractJsonPath` | `dataSourceImport.ts` | `a.b.c` (dot-split) | Simple dot-only, `[*]` expansion |
| `extractPayloadVariables` | `graphRunnerHelpers.ts` | `$.a.b` (strip `$.`, split `.`) | Weak, no array indexing |
| `$jsonpath` | `jsonFunctions.ts` | `a.b.c` (dot-only) | Runtime expression function |
| `resolvePath` | `populateFromApiUtils.ts` | Dot notation | Simple object traversal |

**Recommendation**: Promote `getByPath` from `validator.ts` as the **single canonical path engine** and replace all others.

---

## Data Mapper Design

### Terminology

| Term | Definition |
|------|-----------|
| **Source** | The upstream data structure(s) — HTTP response, webhook payload, previous node output, data source row |
| **Target** | The downstream expected structure — extraction variables, validation fields, request body template, column mapping |
| **Mapping** | A connection from a source path to a target field, optionally with a transformation expression |
| **Expression** | An inline code snippet that transforms source value(s) into a target value |
| **Mapping Profile** | The complete set of mappings for a given context, saveable and reusable |

### Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      DataMapper                              │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐ │
│  │ Source Panel │  │ Canvas Layer │  │    Target Panel      │ │
│  │             │  │              │  │                      │ │
│  │ • JSON tree │  │ • SVG lines  │  │ • Schema tree        │ │
│  │ • Search    │←→│ • Drop zones │←→│ • Search             │ │
│  │ • Type tags │  │ • Expression │  │ • Type constraints   │ │
│  │ • Expand/   │  │   badges     │  │ • Mapped/unmapped    │ │
│  │   collapse  │  │ • Auto-map   │  │   indicators         │ │
│  │ • Multi-    │  │   button     │  │ • Expression editor  │ │
│  │   source    │  │              │  │   (inline/modal)     │ │
│  │   tabs      │  │              │  │ • Required/optional  │ │
│  └─────────────┘  └──────────────┘  └─────────────────────┘ │
│  ┌──────────────────────────────────────────────────────────┐│
│  │                    Preview Bar                           ││
│  │  Sample input → mapped output (live, read-only JSON)    ││
│  └──────────────────────────────────────────────────────────┘│
│  ┌──────────────────────────────────────────────────────────┐│
│  │                    Toolbar                               ││
│  │  Auto-map | Clear all | Import | Export | Test | Done    ││
│  └──────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

### Component Hierarchy

```
DataMapper (full-screen modal or embedded panel)
├── MapperToolbar
│   ├── Auto-map button (match by name/path)
│   ├── Clear All button
│   ├── View toggle: Visual | Code
│   ├── Test with sample data
│   └── Done / Cancel
├── MapperBody (three-column flex)
│   ├── SourcePanel
│   │   ├── SourceTabs (when multiple sources)
│   │   ├── SearchInput
│   │   └── SourceTree (recursive, uses unified tree model)
│   │       └── SourceNode (draggable, type-colored, expandable)
│   ├── MappingCanvas (SVG overlay)
│   │   ├── ConnectionLine[] (bezier curves, source→target)
│   │   ├── ExpressionBadge[] (on lines with transforms)
│   │   └── DropIndicator (highlight during drag)
│   └── TargetPanel
│       ├── SearchInput
│       └── TargetTree (recursive, uses unified tree model)
│           └── TargetNode (droppable, shows mapped source, inline expression editor)
├── PreviewBar (collapsible bottom)
│   ├── SampleInput (editable JSON, or "Fetch Sample")
│   └── MappedOutput (read-only, live-evaluated)
└── ExpressionEditorModal (opened from target node or line)
    ├── Code editor (Monaco or CodeMirror)
    ├── Available variables sidebar
    ├── Function library (string, math, date, array helpers)
    └── Live preview
```

### Source Data Options

The source panel supports two ways to populate the JSON tree:

| Option | Icon | Description | When to Use |
|--------|------|-------------|-------------|
| **Fetch Sample** | ⬇ | Fetches a live response from the configured endpoint and builds the tree from real data | When the API is available and you want the actual response structure |
| **Paste JSON** | 📋 | User pastes or types a JSON sample manually into an editor | When the API isn't available, for offline work, or when using a different sample than what the endpoint returns |

Both options produce the same result: a parsed JSON tree displayed in the Source Panel. The user can switch between them at any time. When "Fetch Sample" is used, the fetched JSON is also available for editing (user can tweak the sample before mapping). The same two options apply to the Target panel when the target schema needs sample data.

### Interaction Model

#### Drag-and-Drop Mapping
1. User expands source tree to find a field
2. Drag the source field node → drop onto target field node
3. A bezier line appears connecting them
4. Target node shows the source path as its value
5. If types mismatch, a warning badge appears on the line

#### Expression Mapping
1. Double-click a target field (or click the `fx` icon on a mapped line)
2. Expression editor opens with:
   - Pre-populated source path reference (e.g., `source.body.user.name`)
   - Available variables from all sources
   - Function palette (string, math, date, array operations)
   - Live preview against sample data
3. Expression syntax: JavaScript-like with helpers

```javascript
// Simple direct mapping (auto-generated from drag-drop)
source.body.user.name

// Transformation expression
source.body.user.firstName + " " + source.body.user.lastName

// Using built-in functions
$uppercase(source.body.user.email)
$dateFormat(source.body.created_at, "YYYY-MM-DD")
$default(source.body.user.phone, "N/A")

// Array mapping
source.body.items.map(item => item.id)

// Conditional
source.body.status === "active" ? "ENABLED" : "DISABLED"
```

#### Auto-Mapping
1. Click "Auto-map" in toolbar
2. Algorithm matches source fields to target fields by:
   - Exact name match (highest priority)
   - Case-insensitive match
   - Camel/snake/kebab case normalization
   - Semantic similarity (e.g., `firstName` → `first_name`)
3. Matched fields get dotted lines (pending confirmation)
4. User clicks "Accept All" or reviews individually

#### Live Preview
1. Bottom bar shows sample input JSON (editable or fetched)
2. Right side shows the mapped output in real-time
3. Errors highlighted inline (missing required fields, type mismatches)
4. Array expansion shown with `[0]`, `[1]`... for repeated elements

### Context-Specific Adapters

The Data Mapper is context-agnostic. Each use case provides an **adapter** that:
1. Defines the source schema(s) and sample data
2. Defines the target schema and constraints
3. Converts mapper output into the feature-specific data structure

| Use Case | Source(s) | Target | Adapter Output |
|----------|-----------|--------|----------------|
| **HTTP Extraction** | HTTP response (body, headers, status) | Variable names | `Extraction[]` |
| **Validation Assertions** | HTTP response body | Expected field values | `ExpectedField[]` + `Assertion[]` |
| **Data Source Column Mapping** | Column definitions | Request template fields (URL, headers, body) | `DataSourceColumn[].mapping` updates |
| **Populate from API** | API response JSON | Data source columns | `DataSourceColumn[]` + `DataSourceRow[]` |
| **Webhook Variable Extraction** | Webhook payload | Workflow variables | `{ name, jsonPath }[]` |
| **Workflow Variable Binding** | Previous node outputs, global vars | Current node inputs | Variable references in templates |
| **Shared DS Fetch → Columns** | Fetch response | Shared DS column definitions | `SharedDataSourceFetchConfig` column map |
| **Request Body Builder** | Available variables/extractions | Request body JSON | Template string with `{{var}}` |

### Adapter Interface

```typescript
interface MapperAdapter<TOutput> {
  /** Unique identifier for this mapping context */
  contextId: string;
  
  /** Human-readable title shown in mapper header */
  title: string;
  
  /** Source definitions — one or more upstream data shapes */
  sources: MapperSource[];
  
  /** Target schema — what the user is mapping into */
  target: MapperTarget;
  
  /** Convert mapper state into feature-specific output */
  serialize(mappings: Mapping[]): TOutput;
  
  /** Load existing mappings into mapper state */
  deserialize(existing: TOutput): Mapping[];
  
  /** Optional: provide sample data for live preview */
  fetchSampleData?: () => Promise<unknown>;
  
  /** Optional: custom validation rules */
  validate?: (mappings: Mapping[]) => ValidationIssue[];
}

interface MapperSource {
  id: string;
  label: string;            // e.g., "HTTP Response", "Webhook Payload"
  icon?: string;             // SVG icon identifier
  schema?: JsonSchema;       // If known ahead of time
  sampleData?: unknown;      // For tree building and preview
  fetchSample?: () => Promise<unknown>;  // Fetch live sample
}

interface MapperTarget {
  label: string;             // e.g., "Extraction Variables", "Expected Fields"
  schema?: JsonSchema;       // If target structure is known
  fields?: TargetField[];    // Pre-defined target fields
  allowCustomFields: boolean; // Can user add new target fields?
  fieldConstraints?: Record<string, FieldConstraint>;
}

interface Mapping {
  id: string;
  sourcePath: string;        // JSONPath from source
  sourceId: string;          // Which source (when multi-source)
  targetPath: string;        // Target field path
  expression?: string;       // Optional transformation expression
  isAutoMapped?: boolean;    // From auto-map (pending confirmation)
}
```

---

## Workflow Integration — How the Data Mapper Works in the Designer

### How to Open the Mapper

The Data Mapper opens from within a **node's config modal**, not from clicking edges or the canvas directly. The current workflow already follows this pattern: double-click a node → config modal opens with tabs (Params, Headers, Body, Extract, etc.). The Data Mapper replaces/enhances the **Extract tab** and becomes available in other tabs.

**Entry points within the node config modal:**

| Tab / Section | Trigger | What Mapper Shows |
|---|---|---|
| **Extract** tab | "Open Mapper" button (replaces current extraction table) | Source: this node's HTTP response → Target: variable names to extract |
| **Body** tab | "Build with Mapper" toggle | Source: available upstream variables → Target: request body JSON structure |
| **Validation** tab | "Open Mapper" button | Source: HTTP response body → Target: expected field assertions |
| **Webhook Config** | "Map Payload" button | Source: webhook payload (sample/paste) → Target: workflow variables |
| **Correlation Wait** | "Map Payload" button | Source: correlation payload → Target: variables + correlation ID |

**Why not edges?** Edges in the workflow designer represent control flow (execution order), not data flow. Data mapping is a property of **individual nodes** — a node defines what it extracts from its own response or payload. The edge just says "run B after A." Opening a mapper on an edge would be confusing because the data transformation doesn't happen "on the wire" — it happens inside the node.

### Source Panel — What Upstream Variables Are Available?

When the Data Mapper opens for a workflow node, the **Source Panel** shows:

1. **This node's own data** (primary tab):
   - For HTTP nodes: the fetched sample response (body, headers, status)
   - For webhook/correlation nodes: the sample payload

2. **Upstream variables** (secondary tab, "Available Variables"):
   - Computed via `collectAncestorNodeIds` — walks all incoming edges backwards
   - Groups variables by source node: "From: Get User (HTTP)", "From: Extract Token (Script)", etc.
   - Shows both global variables and node-scoped references (`{{node:"Step Name".var}}`)
   - This is for the Body/Headers tabs — building requests from upstream outputs

### Topology Scenarios

#### Scenario 1: Linear chain (A → B → C)

```
[Start] → [Get Token] → [Get User] → [Update Profile]
```

When mapping on **Get User** (Extract tab):
- **Source**: Get User's own HTTP response (body/headers/status)
- **Target**: Variables to extract (e.g., `userId`, `userName`)

When mapping on **Update Profile** (Body tab):
- **Source**: All upstream variables — from Get Token (`authToken`) + from Get User (`userId`, `userName`)
- **Target**: Request body JSON structure

Simple case. Each node sees everything upstream.

#### Scenario 2: Fork — One node diverges to multiple (A → B, A → C)

```
                  ┌→ [Branch A: Process Orders]
[Get Data] → [Fork]
                  └→ [Branch B: Send Notification]
```

When mapping on **Process Orders** or **Send Notification**:
- **Source**: Variables from [Get Data] + anything before it
- Both branches see the **same** upstream variables (shared `VariableContext`)
- Each branch independently extracts/creates its own variables
- **No conflict** — each node maps from its own response to its own new variables

The mapper just shows what's available upstream. Fork doesn't change that — it just means two nodes share the same ancestors.

#### Scenario 3: Join — Multiple nodes converge to one (B → D, C → D)

```
[Branch A: Get Orders] ──┐
                         ├→ [Join] → [Generate Report]
[Branch B: Get Users]  ──┘
```

When mapping on **Generate Report** (Body tab):
- **Source**: Variables from **both** Branch A (`orders`, `orderCount`) and Branch B (`users`, `userCount`) + anything before the fork
- The mapper shows **all** variables from all ancestor paths
- **Important UX**: Group by branch with visual separator:
  ```
  ── From: Get Orders (Branch A) ──
    orders       arr[5]
    orderCount   num
  ── From: Get Users (Branch B) ──
    users        arr[10]
    userCount    num
  ── From: Get Data (before fork) ──
    apiKey       str
  ```

**Variable collision warning**: If Branch A and Branch B both set a variable named `result`, the mapper shows a ⚠ warning icon because at runtime the value is non-deterministic (last writer wins). The mapper suggests using node-scoped references: `{{node:"Get Orders".result}}` vs `{{node:"Get Users".result}}`.

#### Scenario 4: Fork → Join → Fork → Join (Diamond patterns chained)

```
            ┌→ [B1] ─┐         ┌→ [D1] ─┐
[A] → [Fork1]        ├→ [Join1] → [Fork2]        ├→ [Join2] → [E]
            └→ [B2] ─┘         └→ [D2] ─┘
```

When mapping on **E** (after Join2):
- **Source**: Variables from A + B1 + B2 + Join1 + D1 + D2 — everything upstream
- The mapper uses the same `collectAncestorNodeIds` walk to find all producers
- Variables are grouped by their origin node
- Same collision warnings apply for any duplicate variable names across branches
- Node-scoped references (`{{node:"B1".x}}`) resolve correctly because HTTP extractions use `setForNode`

This scales to any depth. The mapper doesn't care how many fork/join layers there are — it just walks the graph backwards and shows all available variables, grouped by source node.

#### Scenario 5: Complex topology (practical example)

```
                    ┌→ [Get Orders] ──────────────┐
[Auth] → [Get User] → [Get Preferences] ──────────┼→ [Join] → [Build Report] → [Send Email]
                    └→ [Get Notifications] ────────┘
```

When mapping on **Build Report** (Body tab):
- **Source panel** shows:

```
── This node's own response ──
  (no sample yet — click Fetch Sample)

── Available Variables ──

▸ From: Auth (HTTP)
    authToken          str    "eyJhbG..."

▸ From: Get User (HTTP)  
    userId             num    42
    userEmail          str    "john@example.com"

▸ From: Get Orders (HTTP)
    orders             arr[5]
    totalAmount        num    1250.00

▸ From: Get Preferences (HTTP)
    theme              str    "dark"
    language           str    "en"

▸ From: Get Notifications (HTTP)
    unreadCount        num    3
```

User drags `userId`, `orders`, `unreadCount` into the report body structure.

### Design Principle — Topology

The Data Mapper doesn't need to understand the graph topology itself. It delegates that to the existing `collectAncestorNodeIds` utility. The mapper just asks: **"Given this node, what variables exist upstream?"** and displays them. Whether those came from a linear chain, parallel branches, or nested fork/join diamonds is irrelevant to the mapper's UI — it always shows a flat, grouped list of available source fields.

The graph-awareness lives in the **adapter layer** (`workflowExtractionAdapter`, `workflowBodyAdapter`), which calls the existing topology utilities and feeds the results into the mapper as source definitions.

---

## Edge Cases & Complex Mapping Patterns

This section covers scenarios where a simple "drag source → drop on target" is insufficient. These patterns require visual affordances, function blocks, and clear UX conventions.

### 1. Array Mapping (Loop / Iteration)

The most common complex pattern. Source has an array of objects, target expects a different array structure derived from it.

**Example**: Source `orders[].{id, product, quantity, price}` → Target `lineItems[].{sku, total}`

#### Handling Strategy

| Pattern | Visual UX | Generated Expression |
|---------|----------|---------------------|
| **Array → Array (same structure)** | Drag source array node onto target array node. Green "loop" badge appears on the connection line with `∞` icon. Children auto-expand for inner field mapping. | `source.orders` (direct passthrough) |
| **Array → Array (transform each)** | Drag source array → target array. Loop badge appears. Then drag inner fields: `product` → `sku`, etc. Line shows "for each" label. | `source.orders.map(item => ({ sku: item.product, total: item.quantity * item.price }))` |
| **Array → Single value (aggregate)** | Drag source array onto a scalar target. Aggregation picker appears: Sum / Count / Min / Max / Average / Join / First / Last | `$sum(source.orders, "price")` or `source.orders.length` |
| **Array → Filtered array** | Drag source array → target array, then click filter icon on the connection line. Filter builder opens (field, operator, value). | `source.orders.filter(item => item.quantity > 0)` |
| **Nested arrays** | Outer drag creates outer loop badge. Expand inner array, drag inner fields. Nested loops shown with indented loop badges. | `source.orders.map(o => ({ items: o.lineItems.map(li => li.name) }))` |
| **Array flatten** | Drag nested array onto a flat target array. "Flatten" badge appears. | `source.orders.flatMap(o => o.lineItems)` |
| **Single value → Array** | Drag scalar onto target array. "Wrap" badge appears — wraps the value in a single-element array. | `[source.userId]` |

#### Visual Indicators

- **Loop badge** `∞`: Colored pill on the connection line, indicating iteration. Shows "for each" or "map" label.
- **Aggregation badge** `Σ`: When array maps to scalar, shows the aggregation function name (sum, count, etc.).
- **Filter badge** `⧩`: Indicates a filter is applied to the array before mapping.
- **Flatten badge** `⊏`: Indicates nested arrays are being flattened.

### 2. Function Blocks (Non-Direct Mappings)

When a target field isn't a simple copy of a source field, users need transformation functions. These are available in three ways:

#### A. Inline Expression (for simple transforms)

Click the `ƒx` button on any target field to type a JavaScript expression directly:
```javascript
$uppercase(source.name)
source.firstName + " " + source.lastName
source.price * source.quantity
```

#### B. Function Palette (progressive disclosure — never cluttered)

Accessible from the toolbar or by clicking `ƒx` → "Browse Functions". Uses a **three-column progressive disclosure** layout to prevent overwhelming the user with 88 functions at once:

```
┌──────────────┬─────────────────────────┬──────────────────────────┐
│  Categories  │  Functions (selected    │  Detail / Docs           │
│  (sidebar)   │   category only)        │  (selected function)     │
│              │                         │                          │
│ ▸ String  15 │  $uppercase  (v) → str  │  $uppercase              │
│   Math    10 │  $lowercase  (v) → str  │  ──────────────────────  │
│   Date    10 │  $trim       (v) → str  │  Converts to uppercase.  │
│   Array   14 │  $replace    (...) → s  │                          │
│   Aggregate9 │  $substring  (...) → s  │  Signature:              │
│   Object   9 │  ...                    │  $uppercase(v: str) → s  │
│   Logic    5 │                         │                          │
│   Type     9 │                         │  Example:                │
│   Encode   7 │                         │  "hello" → "HELLO"       │
│              │                         │                          │
│              │                         │  [Insert $uppercase()]   │
└──────────────┴─────────────────────────┴──────────────────────────┘
```

**Design principles:**
1. **Only one category visible at a time** — clicking a category reveals its functions; others are hidden
2. **Search narrows across all categories** — typing in the search box filters the function list globally, collapsing categories
3. **Detail panel shows documentation on click** — signature, parameters table, example with input/output, "Insert" button
4. **Contextual suggestions** — when the target field type is known, relevant categories are highlighted (e.g., selecting a `num` target emphasizes Math and Aggregate)
5. **No scroll overload** — the widest category (Array, 14 functions) fits comfortably without scrolling; detail panel provides depth instead of breadth

**9 categories (88 functions):**

| Category | Count | Key Functions |
|----------|-------|--------------|
| **String** | 15 | `$uppercase`, `$lowercase`, `$trim`, `$replace`, `$split`, `$join`, `$contains`, `$match`, `$truncate` |
| **Math** | 10 | `$round`, `$floor`, `$ceil`, `$abs`, `$min`, `$max`, `$toFixed` |
| **Date** | 10 | `$now`, `$dateFormat`, `$dateParse`, `$dateAdd`, `$dateDiff`, `$toISO` |
| **Array** | 14 | `$map`, `$filter`, `$find`, `$reduce`, `$flatten`, `$unique`, `$sort`, `$slice` |
| **Aggregate** | 9 | `$sum`, `$avg`, `$count`, `$median`, `$groupBy`, `$countBy` |
| **Object** | 9 | `$keys`, `$values`, `$entries`, `$pick`, `$omit`, `$merge`, `$get` |
| **Logic** | 5 | `$if`, `$switch`, `$default`, `$coalesce`, `$unless` |
| **Type** | 9 | `$toString`, `$toNumber`, `$toBoolean`, `$typeof`, `$isNull`, `$isArray` |
| **Encode** | 7 | `$base64Encode`, `$base64Decode`, `$urlEncode`, `$jsonParse`, `$hash` |

#### C. Visual Function Chain (for complex multi-step transforms)

For transforms requiring multiple steps, users can chain functions visually:

```
source.orders ──→ [$filter: qty > 0] ──→ [$map: item.price * item.qty] ──→ [$sum] ──→ target.total
```

Each function block appears as a small card on the connection line with:
- Function name and icon
- Configurable parameters (click to edit)
- Input/output type indicators
- Remove button

### 3. Null Handling & Default Values

| Scenario | UX | Expression |
|----------|-----|-----------|
| **Source field may be null** | Amber `?` badge on connection line. Click to set default value. | `$coalesce(source.phone, "N/A")` |
| **Ignore null (don't include in target)** | Toggle "Skip if null" on the mapping. Dashed line style. | `source.phone != null ? source.phone : undefined` |
| **Null propagation** | No badge — null maps through as null. Default behavior. | `source.phone` |
| **Multiple fallbacks** | Chain coalesce: try field A, then B, then literal. | `$coalesce(source.mobile, source.home, source.work, "unknown")` |

### 4. Conditional Mapping

When the target value depends on a condition, not a direct copy:

| Pattern | UX | Expression |
|---------|-----|-----------|
| **If-else** | Click `ƒx` → insert `$if()` function. Condition + true/false branches. | `$if(source.status === "active", "ENABLED", "DISABLED")` |
| **Switch/case** | Click `ƒx` → insert `$switch()`. Map of values → results. | `$switch(source.type, { "A": "Alpha", "B": "Beta" }, "Unknown")` |
| **Conditional include** | Toggle "Conditional" on the connection line. Enter condition. Only maps when condition is true. | `source.age >= 18 ? source.name : undefined` |
| **Multi-source conditional** | Drag multiple sources to same target. Condition picker: "Use A when X, use B when Y". | `source.preferred || source.fallback` |

### 5. Structure Transformation Patterns

| Pattern | Source Shape | Target Shape | UX |
|---------|------------|-------------|-----|
| **Flatten nested** | `{ user: { address: { city } } }` | `{ city }` | Drag nested field to flat target. Auto-generates path `source.user.address.city` |
| **Nest flat** | `{ city, zip, state }` | `{ address: { city, zip, state } }` | Drag flat fields into nested target object. Groups them visually. |
| **Rename** | `{ firstName }` | `{ first_name }` | Drag across — just a name change. Simple direct mapping. |
| **Merge objects** | `{ a: {x} }` + `{ b: {y} }` | `{ x, y }` | Drag from both sources. Both merge into target. Two connection lines converge. |
| **Split field** | `{ fullName }` | `{ firstName, lastName }` | One source → two targets. Use expression: `source.fullName.split(" ")[0]` and `[1]`. |
| **Combine fields** | `{ first, last }` | `{ fullName }` | Two sources → one target. Expression: `source.first + " " + source.last`. Two lines converge to one target with expression badge. |

### 6. Type Mismatch Handling

When source and target types differ, the mapper should proactively help:

| Mismatch | Detection | UX | Suggested Fix |
|----------|----------|-----|--------------|
| `string` → `number` | Automatic on drop | Amber `⚠` badge with "Type mismatch" tooltip | "Apply `$toNumber()`?" button |
| `number` → `string` | Automatic | Amber badge | "Apply `$toString()`?" |
| `string` → `boolean` | Automatic | Amber badge | "Apply `$toBoolean()`? ('true'/'1' → true)" |
| `string` → `date` | Detect date-like pattern in sample value | Info badge | "Apply `$dateParse(source, 'YYYY-MM-DD')`?" |
| `array` → `string` | Automatic | Amber badge | "Apply `$join(source, ',')`?" |
| `object` → `string` | Automatic | Red badge (likely wrong) | "Apply `$jsonStringify()`?" |

### 7. Multi-Source to Single Target

When a target field derives from multiple source fields:

**Visual UX**: Drag first source → target creates a line. Drag second source → same target — a "combine" modal opens asking how to merge:

| Combine Mode | Description | Expression |
|-------------|-------------|-----------|
| **Concatenate** | Join with separator | `source.first + " " + source.last` |
| **Arithmetic** | Math operation | `source.price * source.quantity` |
| **Coalesce** | First non-null | `$coalesce(source.mobile, source.home)` |
| **Custom** | Free expression | Opens expression editor with both sources pre-populated |

Two connection lines converge at the target with a small `⊕` merge badge showing the combine mode.

### 8. Missing Source Fields (Unmapped Targets)

| Scenario | UX |
|----------|-----|
| **Required target, no source match** | Red `*` indicator. Target row highlighted. "1 required unmapped" in footer. |
| **Optional target, no source match** | Gray dash. No warning. |
| **Set static/constant value** | Click target → type literal value (string, number, boolean). Shows as `= "constant"` instead of `← source.path` |
| **Use generator** | Click `ƒx` → select generator: `$uuid()`, `$now()`, `$timestamp()`, `$randomInt(min, max)` |

### 9. Large Payload Performance

| Concern | Solution |
|---------|---------|
| **Source JSON >100KB** | Lazy tree expansion — only render visible nodes. Virtualized scroll (`react-window`). |
| **>500 fields** | Auto-collapse all after depth 2. Search becomes primary navigation. |
| **>50 mappings** | Mapping list sidebar (togglable) shows all mappings as a compact table for overview. |
| **Slow preview** | Debounce preview evaluation to 200ms. Show "Computing..." state. Cancel previous evaluation on new input. |

### Design Reference — Mockups

See `docs/mockups/data-mapper-edge-cases-mockup.html` for interactive visualization of array mapping, function palette, conditional mapping, and type mismatch handling.

---

## Phased Implementation Plan

### Phase 1: Core Mapper Component — Foundation

| # | Task | Description |
|---|------|-------------|
| 1.1 | Unify path engine | Extract `getByPath` from `validator.ts` into `src/shared/utils/jsonPath.ts`; replace `extractJsonPath`, `extractPayloadVariables`, `$jsonpath`, `resolvePath` with canonical implementation |
| 1.2 | Unify tree model | Consolidate `jsonPathTreeUtils.ts` (`buildTree`/`JsonNode`) and `JsonTreePreview.tsx` (`buildJTree`/`JNode`) into single `src/shared/utils/jsonTreeModel.ts` |
| 1.3 | Build `SourcePanel` | Expandable JSON tree with type tags, search/filter, drag handles on leaf/branch nodes, multi-source tabs |
| 1.4 | Build `TargetPanel` | Schema-driven or free-form target tree with drop zones, mapped/unmapped indicators, inline value display |
| 1.5 | Build `MappingCanvas` | SVG overlay rendering bezier connection lines between source and target nodes, with scroll synchronization |
| 1.6 | Build `MapperToolbar` | Auto-map, clear all, view toggle (visual/code), test, done/cancel actions |
| 1.7 | Wire drag-and-drop | HTML5 DnD or `@dnd-kit` for drag from source → drop on target; create/update/delete mappings |
| 1.8 | Unit tests | >90% coverage on path engine, tree model, mapping CRUD, auto-map algorithm |

### Phase 2: Expression Editor & Preview

| # | Task | Description |
|---|------|-------------|
| 2.1 | Build `ExpressionEditorModal` | CodeMirror-based expression editor with syntax highlighting, autocomplete for source paths and functions |
| 2.2 | Function library | Built-in helpers: `$uppercase`, `$lowercase`, `$trim`, `$default`, `$dateFormat`, `$parseInt`, `$join`, `$split`, `$length`, `$substring`, `$replace`, `$match`, `$map`, `$filter`, `$first`, `$last` |
| 2.3 | Expression evaluator | Safe sandbox evaluation of expressions against sample data (reuse `scriptSandbox.ts` patterns) |
| 2.4 | Build `PreviewBar` | Collapsible bottom bar: sample input editor (left), live mapped output (right), error highlighting |
| 2.5 | "Fetch Sample" integration | Button to fetch live sample data from configured endpoint (reuse `fetchScenarioSample`) |
| 2.6 | Unit tests | Expression parsing, evaluation, function library, preview rendering |

### Phase 3: Adapters — Extraction & Validation

| # | Task | Description |
|---|------|-------------|
| 3.1 | `ExtractionAdapter` | Replace `ExtractionEditor` + `ExtractionPathPickerModal` + `ExtractionMapperModal` with Data Mapper using extraction adapter. Source = HTTP response (body/headers/status); Target = variable names. Output: `Extraction[]` |
| 3.2 | `ValidationAdapter` | Replace `JsonPathBuilder` for validation with Data Mapper. Source = response body; Target = expected field values. Output: `ExpectedField[]`. Support include/exclude modes |
| 3.3 | `AssertionAdapter` | Replace `RegexAssertionModal` path picker with Data Mapper embedded picker. Source = response body; Target = assertion config. Output: `Assertion` |
| 3.4 | Update workflow HTTP config | Wire extraction adapter into `HttpConfig.tsx` Extract tab |
| 3.5 | Update test editor | Wire validation adapter into `TestEditorValidationTab.tsx` and `SetupStepValidate.tsx` |
| 3.6 | Deprecate old components | Mark `ExtractionPathPickerModal`, `ExtractionMapperModal`, `JsonPathBuilder` as deprecated |
| 3.7 | Unit + integration tests | Adapter serialization/deserialization, UI integration |

### Phase 4: Adapters — Data Sources & Parameterized Tests

| # | Task | Description |
|---|------|-------------|
| 4.1 | `PopulateFromApiAdapter` | Replace `PopulateFromApiModal` with Data Mapper. Source = API response JSON; Target = data source columns. Output: column definitions + row data |
| 4.2 | `ColumnMappingAdapter` | Replace column header prefix convention (`path:`, `param:`, `body:`) with visual mapper for mapping columns to request fields. Source = column names; Target = request template placeholders |
| 4.3 | `SharedDsFetchAdapter` | Replace fetch config mapping in `SharedDataSourceModal` with Data Mapper. Source = fetch response; Target = shared DS column definitions |
| 4.4 | Update data source editor | Wire adapters into `DataSourceEditor.tsx` and `SharedDataSourceModal.tsx` |
| 4.5 | Unit + integration tests | All data source adapters |

### Phase 5: Adapters — Workflow Variables & Webhooks

| # | Task | Description |
|---|------|-------------|
| 5.1 | `WebhookExtractionAdapter` | Replace text-field JSON path inputs in `CorrelationWaitConfig.tsx` and webhook node config with Data Mapper. Source = webhook payload; Target = workflow variables |
| 5.2 | `VariableBindingAdapter` | Optional: visual mapper for binding previous node outputs to current node inputs. Source = upstream node outputs; Target = current node variable references |
| 5.3 | Unify `extractPayloadVariables` | Replace with canonical `getByPath` from Phase 1 |
| 5.4 | Update workflow config panels | Wire webhook/correlation adapters into config UIs |
| 5.5 | Unit + integration tests | Webhook and variable adapters |

### Phase 6: Request Body Builder Mode

| # | Task | Description |
|---|------|-------------|
| 6.1 | `RequestBodyAdapter` | New mode: Target = JSON body template; Source = available variables/extractions. User drags variables into a body structure builder |
| 6.2 | Template ↔ visual sync | Bi-directional: editing the template `{{var}}` updates visual; dragging in visual updates template |
| 6.3 | Body type support | JSON builder, form-data builder, raw template modes |
| 6.4 | Integration | Wire into `HttpConfig.tsx` Body tab as optional visual mode |
| 6.5 | Unit + integration tests | Body builder serialization |

### Phase 7: Polish & UX Excellence

| # | Task | Description |
|---|------|-------------|
| 7.1 | Mapping profiles | Save/load mapping configurations as reusable templates |
| 7.2 | Bulk operations | Select multiple source fields → drag to array target; multi-select delete |
| 7.3 | Type coercion warnings | Visual warnings when mapping string→number, etc.; smart suggestions for type conversion functions |
| 7.4 | Array handling UX | Visual indicator for array-to-array mappings; auto-loop for `[*]` patterns; array flatten/collect controls |
| 7.5 | Keyboard navigation | Tab between fields, Enter to map, Escape to cancel, arrow keys for tree navigation, `/` to search |
| 7.6 | Code view toggle | Side-by-side view showing mapping as code (like MuleSoft DataWeave sync) |
| 7.7 | Gallery samples | Add mapper-specific gallery samples demonstrating common mapping patterns |
| 7.8 | Training manuals | ✅ Write training manuals for the Data Mapper feature (4 manuals created — see details below) |
| 7.9 | Accessibility | WCAG AA compliance, screen reader support, high contrast mode |

### Phase 8: Schema Drift Detection & Contract Validation

Differentiator: Most mapper tools are design-time only. This phase makes our Data Mapper **runtime-aware** — it detects when APIs change their response shape and alerts users before tests break silently.

| # | Task | Description |
|---|------|-------------|
| 8.1 | Schema snapshot | When a mapping is saved, capture a structural snapshot (field names, types, nesting) of the source and target schemas |
| 8.2 | Drift detection engine | On each "Fetch Sample" or test run, compare the live response schema against the saved snapshot. Detect: new fields (additive), removed fields (breaking), type changes (breaking), nullable changes |
| 8.3 | Drift severity classification | **Info**: new fields added (no action needed). **Warning**: field type changed (mapping may still work). **Breaking**: mapped field removed or renamed (mapping will fail) |
| 8.4 | Visual diff overlay | In the mapper, show a schema diff view: green = new fields, red = removed fields, amber = changed types. Highlight affected mapping lines with warning badges |
| 8.5 | Drift notification banner | When opening a mapper with stale schema, show: "⚠ Source schema changed since last mapping — 2 fields added, 1 removed. Review changes?" with "Show Diff" and "Accept & Update" buttons |
| 8.6 | Auto-repair suggestions | For broken mappings (source field removed), suggest: similar field names, renamed field candidates (by edit distance), or mark as manually fixable |
| 8.7 | Mapping health dashboard | In the Results tab, show a mapping health summary: how many mappings are current vs stale, which have drift warnings |
| 8.8 | Contract mode | Optional strict mode: "Lock Schema" — any response that deviates from the snapshot fails the assertion. Integrates with existing validation/assertion system |
| 8.9 | Unit tests | Drift detection engine, diff calculation, auto-repair suggestions |

### Phase 9: Mapping Debugger & Data Flow Trace

Differentiator: Inspired by Altova MapForce's interactive debugger. No other API testing tool offers step-through mapping debugging.

| # | Task | Description |
|---|------|-------------|
| 9.1 | Mapping execution trace | During test/workflow runs, record per-mapping trace: source value read → expression evaluated → target value written, with timestamps |
| 9.2 | Data flow overlay | In the mapper, toggle "Debug View" that shows actual runtime values flowing through each connection line. Values appear as badges on the lines (like MapForce data overlays) |
| 9.3 | Step-through mode | For expressions, add a "Debug Expression" button: step through the expression evaluation seeing intermediate values at each operation |
| 9.4 | Failure pinpointing | When a mapping fails (null source, expression error, type mismatch), highlight the exact connection line in red with the error message inline — not just "assertion failed" in the results |
| 9.5 | Historical comparison | Compare mapped output across multiple test runs: "Run #5 produced `userId=42`, Run #6 produced `userId=null`" — surface regressions in data flow |
| 9.6 | Integration with Results Explorer | From the Results Explorer detail panel, "Open in Mapper" button loads the mapping with actual runtime values overlaid, so users can see exactly what happened |
| 9.7 | Unit tests | Trace capture, overlay rendering, step-through evaluation |

### Phase 10: AI-Assisted Mapping

Differentiator: Leading-edge feature. Only enterprise iPaaS tools (Flatfile, Boomi) currently offer AI mapping. No API testing tool has this.

| # | Task | Description |
|---|------|-------------|
| 10.1 | Smart auto-map | Upgrade auto-map beyond name matching: use field value analysis (e.g., detect that source `phone_number` contains phone-formatted strings and should map to target `contactPhone`) |
| 10.2 | Semantic name matching | Match conceptually similar fields across naming conventions: `MSRP` → `price`, `qty` → `quantity`, `fname` → `firstName`, `dob` → `dateOfBirth` using a built-in synonym dictionary |
| 10.3 | Confidence scores | Show confidence percentage on each auto-map suggestion: 95% for exact match, 80% for case-normalized, 60% for semantic match. Color-coded: green (>80%), amber (50-80%), red (<50%) |
| 10.4 | Pattern learning | Remember user mapping decisions per source/target combination. Next time the same schema pair appears, suggest previously used mappings with "Previously mapped" badge |
| 10.5 | Expression suggestions | When a user maps incompatible types (string date → timestamp), auto-suggest the appropriate transformation: "Apply `$dateFormat(source, 'ISO8601')`?" |
| 10.6 | Mapping from examples | User provides 2-3 input/output example pairs, and the system infers the mapping rules automatically |
| 10.7 | Unit tests | Synonym matching, confidence scoring, pattern storage, suggestion engine |

---

## Technical Decisions

### Drag-and-Drop Library

**Recommendation: `@dnd-kit`** — already conceptually compatible with the codebase's React patterns, accessible by default, supports custom drag overlays and drop indicators. Alternatives considered: HTML5 DnD (limited styling), `react-beautiful-dnd` (deprecated).

### Connection Lines (SVG)

**Recommendation: Custom SVG overlay** — similar to how `WorkflowExecutionCanvas` uses React Flow edges, but simpler (only bezier curves between fixed anchor points). No need for a full graph library. Position anchors recalculate on scroll/resize using `ResizeObserver` + scroll event listeners.

### Expression Language

**Recommendation: JavaScript subset** — users already know JS from Script nodes. Sandboxed evaluation reuses `scriptSandbox.ts` patterns. Add helper functions prefixed with `$` (consistent with existing `$jsonpath`, `$uuid`, `$timestamp` pattern in `VariableContext`).

### Path Engine

**Recommendation: `getByPath` from `validator.ts`** — most capable existing implementation. Extract to `src/shared/utils/jsonPath.ts`, add missing features (recursive descent `..`, filter expressions) only if needed.

### Tree Model

**Recommendation: Unified `JsonTreeModel`** — merge `buildTree` (from `jsonPathTreeUtils`) and `buildJTree` (from `JsonTreePreview`). Single tree node type with lazy expansion for large payloads (>1000 nodes).

---

## File Structure

```
src/shared/components/data-mapper/
├── DataMapper.tsx                   # Main container component
├── DataMapper.test.tsx
├── MapperToolbar.tsx                # Top action bar
├── SourcePanel.tsx                  # Left: source tree(s)
├── TargetPanel.tsx                  # Right: target schema
├── MappingCanvas.tsx                # Center: SVG connection lines
├── PreviewBar.tsx                   # Bottom: sample input → output
├── ExpressionEditorModal.tsx        # Inline/modal expression editor
├── types.ts                        # Mapping, MapperAdapter, etc.
├── hooks/
│   ├── useMapperState.ts            # Core mapping CRUD state
│   ├── useAutoMap.ts                # Auto-mapping algorithm
│   ├── useDragMapping.ts            # Drag-and-drop wiring
│   ├── useConnectionLines.ts        # SVG line position calculation
│   └── useExpressionEval.ts         # Expression sandbox evaluation
├── utils/
│   ├── autoMapAlgorithm.ts          # Name matching, case normalization
│   ├── expressionFunctions.ts       # Built-in $helpers
│   └── mappingSerializer.ts         # Generic serialize/deserialize
└── adapters/
    ├── extractionAdapter.ts         # HTTP extraction → Extraction[]
    ├── validationAdapter.ts         # Validation → ExpectedField[]
    ├── assertionAdapter.ts          # Assertion path picking
    ├── populateFromApiAdapter.ts    # API response → DS columns/rows
    ├── columnMappingAdapter.ts      # DS columns → request template
    ├── webhookExtractionAdapter.ts  # Webhook → workflow variables
    ├── variableBindingAdapter.ts    # Node output → node input
    ├── requestBodyAdapter.ts        # Variables → request body
    └── sharedDsFetchAdapter.ts      # Fetch response → DS columns

src/shared/utils/
├── jsonPath.ts                      # Canonical path engine (from validator.ts)
├── jsonPath.test.ts
├── jsonTreeModel.ts                 # Unified tree model
└── jsonTreeModel.test.ts

src/styles/
└── data-mapper.css                  # All mapper styles
```

---

## Migration Strategy

The Data Mapper will be introduced **alongside** existing components, not as a big-bang replacement:

1. **Phase 1–2**: Build the core mapper as a new standalone component with no existing feature dependencies
2. **Phase 3**: Add an "Open in Mapper" button to extraction editor and validation builder — users can choose either UI
3. **Phase 4–5**: Same gradual migration for data sources and webhook config
4. **Phase 6**: Request body builder as a new optional mode
5. **Phase 7**: Once mapper is proven stable, deprecate old components and make mapper the default; remove deprecated components after one release cycle
6. **Phase 8**: Schema drift detection runs passively — captures snapshots on save, compares on fetch, no user action needed until drift is found
7. **Phase 9**: Mapping debugger is opt-in — "Debug View" toggle in mapper toolbar; trace capture uses existing `traceCollector` infrastructure
8. **Phase 10**: AI-assisted features layer on top of the existing auto-map — same UI, smarter backend

This ensures zero disruption to existing workflows while the mapper matures. Phases 8–10 are **differentiators** — they go beyond what any current API testing or integration tool offers and position RedfireForge as the industry leader in visual data mapping.

---

## Success Criteria

### Core (Phases 1–7)
- [ ] Single `DataMapper` component used in 8+ mapping contexts
- [ ] One canonical path engine (`getByPath`) replacing 5 scattered implementations
- [ ] One unified tree model replacing 2 parallel implementations
- [ ] Auto-map correctly matches >80% of common field patterns
- [ ] Live preview updates in <100ms for payloads up to 10KB
- [ ] Expression evaluation sandboxed (no `eval`, no global access)
- [ ] Full keyboard navigation (no mouse required)
- [ ] >90% unit test coverage on core mapper, path engine, and all adapters
- [x] Training manuals and gallery samples for each mapping context

### Industry-Leading (Phases 8–10)
- [ ] Schema drift detected automatically on source/target changes
- [ ] Breaking changes surfaced before test runs fail silently
- [ ] Mapping debugger shows actual runtime values on connection lines
- [ ] Failed mappings pinpoint the exact source→target connection that broke
- [ ] Auto-map suggests semantic matches (synonym-based, not just name-based)
- [ ] Confidence scores on every auto-map suggestion
- [ ] Expression suggestions for type mismatches
- [ ] Pattern learning remembers user mapping decisions across sessions

---

## Changelog

| Date | Change |
|------|--------|
| 2026-05-10 | Initial plan created: commercial research, codebase audit, 7-phase implementation plan |
| 2026-05-10 | Renamed from "Universal Mapper" to "Data Mapper" (industry-standard naming) |
| 2026-05-10 | Added workflow integration section: topology scenarios (linear, fork, join, chained diamonds), entry points, variable collision warnings |
| 2026-05-10 | Added two interactive HTML mockups: general mapper + workflow-specific scenarios |
| 2026-05-10 | Added source data options: Fetch Sample vs Paste JSON |
| 2026-05-10 | Added Phase 8: Schema Drift Detection & Contract Validation — runtime schema awareness, drift severity, auto-repair, contract mode |
| 2026-05-10 | Added Phase 9: Mapping Debugger & Data Flow Trace — step-through debugging, runtime value overlays, failure pinpointing, Results Explorer integration |
| 2026-05-10 | Added Phase 10: AI-Assisted Mapping — semantic matching, confidence scores, pattern learning, expression suggestions, mapping from examples |
| 2026-05-10 | Added Edge Cases section: array loop/aggregate/filter/flatten, function palette (80+ functions in 9 categories), null handling, conditional mapping, structure transforms, type mismatch auto-fix, multi-source combine/split, large payload performance |
| 2026-05-10 | Added edge cases mockup with 6 interactive scenes |
| 2026-05-10 | Created 4 training manuals (basics, expressions, arrays, workflows) and registered in Gallery |
