# Data Mapper Plan

> _Branch: `feature/data-mapper` (from `develop`) | Created: 2026-05-10 | Last updated: 2026-05-11_

### Progress Overview

| Phase | Name | Status | Notes |
|-------|------|--------|-------|
| **1** | Core Mapper Component | ✅ Complete | Path engine, tree model, types, state, UI panels, canvas, toolbar |
| **2** | Expression Editor, Preview & UX | ✅ Complete | Expression evaluator, editor modal, paste/fetch, preview bar, type mismatch, modal, UX polish |
| **3** | Adapters — Extraction, Validation & Assertion | ✅ Complete | 3 adapters built + tested + wired. RegexAssertionBuilderModal replaces old PickerNode-based modal with DM tree |
| **4** | Adapters — Data Sources | ✅ Complete | 3 adapters (PopulateFromApi, ColumnMapping, SharedDsFetch) + deprecation hardening. 7 adapters total. |
| **5** | Adapters — Workflow & Webhooks | ✅ Complete | 5A–5D complete. WebhookExtraction + VariableBinding adapters. Unified path engine. 9 adapters total. |
| **6** | Request Body Builder | ✅ Complete | 10th adapter (RequestBodyAdapter), bi-directional sync, BodyBuilderPanel (JSON/Form/Raw), HttpConfig integration, hardening. |
| **7** | Polish & UX Excellence | ✅ Complete | 7A–7F complete. Profiles, bulk ops, array mapping, keyboard nav, code view, Monaco editor, gallery samples, accessibility, hardening. |
| **8** | Schema Drift & Contracts | ✅ Complete | 8A–8E complete (snapshot, severity, visual overlay, auto-repair, contracts, hardening). |
| **Pre-9** | Gap Closure (Prework) | ✅ Complete | Repair UI wiring, assertion adapter resolution, plan hygiene |
| **9** | Mapping Debugger | ✅ Complete | 9A–9E complete (Mapping Execution Trace + Data Flow Overlay + Step-Through & Failure Pinpointing + Historical Comparison & Results Integration + Hardening). |
| **10** | AI-Assisted Mapping | ⬜ Not started | Semantic matching, confidence scores (differentiator) |
| **11** | Visual Polish — Mockup Alignment | ⬜ Not started | Align UI with `data-mapper-edge-cases-mockup.html` design reference |

**Next up:** Phase 10 (AI-Assisted Mapping) or Phase 11 (Visual Polish — Mockup Alignment).

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
| 3 | **Regex Assertion Builder Modal** | `RegexAssertionBuilderModal.tsx` | Pick JSON path + build regex pattern | DM tree (`SelectableTreeNode`) + pattern library | Reusable tree picker (replaced old `RegexAssertionModal`) |
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

### Existing Auto-Mapping Capabilities (limited)

Codebase audit (2026-05-10) found only **two isolated, basic name-matching implementations** — no reusable auto-map component exists:

| # | Location | File | Matching Algorithm | Limitations |
|---|----------|------|--------------------|-------------|
| 1 | **Data Source Paste Preview** | `DataSourcePastePreview.tsx` | Case-insensitive exact match: `c.name.toLowerCase() === h.toLowerCase()` or `c.mapping?.toLowerCase() === h.toLowerCase()` | Exact match only. No fuzzy, camel/snake normalization, or semantic matching. Only used when pasting CSV data. |
| 2 | **Populate from API** | `populateFromApiUtils.ts` → `findMatchingColumn()` + `normalizeForMatch()` | Trim + lowercase, then tries: (a) column mapping match, (b) column name match, (c) JSONPath suffix match (`.fieldName` or `[fieldName]`), (d) any column name match | Better than #1 (tries multiple strategies), but still only exact-after-normalization. No camel↔snake conversion, no semantic similarity. |

**Gap**: Neither implementation supports:
- **Camel/snake/kebab case normalization** (`firstName` ↔ `first_name` ↔ `first-name`)
- **Semantic/synonym matching** (`qty` ↔ `quantity`, `fname` ↔ `firstName`, `dob` ↔ `dateOfBirth`)
- **Confidence scoring** (how sure is the match?)
- **Pending confirmation UX** (dotted lines for suggested matches, accept/reject individually)
- **Reusability** (each is hard-coded into its own component)

These gaps are addressed in Phase 1 (task 1.7 — auto-map algorithm) and Phase 10 (AI-assisted semantic matching).

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
    ├── Code editor (textarea-based; Monaco optional upgrade in Phase 7D)
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

#### Current Adapters

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

#### Future Integration Adapters (Extensibility)

The adapter architecture is designed to support integration points beyond HTTP APIs. As RedfireForge expands to orchestrate workflows involving external services, each new integration will reuse the same Data Mapper — users learn the mapping pattern once, then apply it everywhere.

| Future Integration | Source(s) | Target | Notes |
|-------------------|-----------|--------|-------|
| **Slack** | Slack message payload (text, blocks, attachments, user, channel) | Workflow variables or outbound message structure | Map incoming webhook fields; build Block Kit JSON for outbound messages |
| **Email (SMTP/IMAP)** | Email message (from, to, subject, body, headers, attachments metadata) | Workflow variables or outbound email fields | Extract fields from inbound email triggers; compose outbound email templates |
| **Social Media** | Platform-specific payloads (tweets, posts, comments, user profiles) | Normalized internal schema or workflow variables | Each platform (X/Twitter, LinkedIn, Facebook) provides its own source schema via adapter |
| **AI / LLM** | AI model response (content, usage, tokens, function calls, tool outputs) | Workflow variables, structured data extraction | Map model outputs (chat completion, embeddings, structured outputs) to downstream workflow nodes |
| **Database** | Query result set (columns, rows, metadata) | Workflow variables or data source columns | Map SQL/NoSQL result fields; handle result sets as arrays |
| **Message Queue** | Queue message (body, headers, metadata) | Workflow variables | Kafka, RabbitMQ, SQS message payload mapping |
| **File/Storage** | File metadata (name, size, type, content) or parsed content (CSV rows, XML nodes) | Workflow variables or data source rows | S3, GCS, or local file content parsing and mapping |
| **gRPC / GraphQL** | Protobuf message or GraphQL response | Workflow variables | Typed schemas from `.proto` files or GraphQL introspection |
| **Custom Webhook** | Any incoming HTTP payload | Any target schema | Generic catch-all for user-defined integrations |

**Key extensibility principle:** Adding a new integration to the Data Mapper requires **only writing an adapter** — no changes to the mapper core, canvas, expression engine, or UI components. The adapter provides:
1. Source schema/sample data (what the integration produces)
2. Target schema/constraints (what the user maps into)
3. Serialization (how mappings become integration-specific config)
4. Deserialization (how existing config loads into the mapper)

### Adapter Interface

```typescript
interface MapperAdapter<TOutput> {
  /** Unique identifier for this mapping context */
  contextId: string;

  /** Human-readable title shown in mapper header */
  title: string;

  /** Integration category — for grouping in UI and future integration registry */
  category?: 'http' | 'webhook' | 'data-source' | 'workflow'
           | 'messaging' | 'ai' | 'database' | 'file' | 'custom';

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

  /** Optional: custom validation rules beyond type checking */
  validate?: (mappings: Mapping[]) => ValidationIssue[];

  /** Optional: integration-specific expression functions (e.g., $slackMention, $aiTokenCount) */
  customFunctions?: ExpressionFunction[];

  /** Optional: documentation URL for the integration's data model */
  docsUrl?: string;
}

interface MapperSource {
  id: string;
  label: string;             // e.g., "HTTP Response", "Slack Message", "AI Completion"
  icon?: string;              // SVG icon identifier
  schema?: JsonSchema;        // If known ahead of time
  sampleData?: unknown;       // For tree building and preview
  fetchSample?: () => Promise<unknown>;  // Fetch live sample

  /** Source data format — determines tree-building strategy */
  format?: 'json' | 'xml' | 'csv' | 'protobuf' | 'graphql' | 'plain-text';

  /** Whether this source supports live fetching (API call, DB query, queue peek) */
  supportsLiveFetch?: boolean;

  /** Optional: pre-defined field descriptions shown as tooltips in the source tree */
  fieldDescriptions?: Record<string, string>;
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

interface ExpressionFunction {
  name: string;              // e.g., "$slackMention", "$aiTokenCount"
  category: string;          // Palette category (new or existing)
  signature: string;         // e.g., "$slackMention(userId: string) → string"
  description: string;
  example?: { input: string; output: string };
}
```

### Extensibility Design Principles

The Data Mapper is the **single mapping surface** for all current and future integrations. These principles ensure new integrations plug in cleanly:

1. **Adapter-only extension** — Adding a new integration (Slack, email, AI, database, etc.) requires **only writing a `MapperAdapter`**. Zero changes to the mapper core, canvas, expression engine, tree components, or styles.

2. **Schema-driven, not hard-coded** — The source/target trees are built from schema + sample data provided by the adapter, not from hard-coded field lists. Any JSON-shaped data (or data convertible to JSON) works automatically.

3. **Format-agnostic tree building** — While the initial implementation targets JSON, the `format` field on `MapperSource` prepares for XML, CSV, protobuf, and GraphQL sources. Each format will have a tree-builder plugin that converts to the unified `JsonTreeModel`. Adapters for non-JSON integrations supply a `format` hint and optionally a custom tree builder.

4. **Integration-specific functions** — Adapters can register custom expression functions (`customFunctions`) that appear in the Function Palette under a new category. Example: a Slack adapter adds `$slackMention(userId)`, `$slackBlockKit(text)`. An AI adapter adds `$aiTokenCount(text)`, `$aiTruncate(text, maxTokens)`.

5. **Composable sources** — The multi-source tab system supports any number of source panels. A future workflow node that calls Slack + an AI model + a database can show all three as source tabs in a single mapper instance.

6. **Category-based grouping** — The `category` field on adapters enables future UI features like: integration marketplace, adapter registry, filtered adapter list ("Show only messaging adapters"), and per-category icons/themes.

7. **Field documentation** — `fieldDescriptions` on `MapperSource` lets integration adapters provide inline tooltips (e.g., Slack: `"ts" → "Message timestamp, used as unique ID"`), making unfamiliar schemas self-documenting.

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
| **Slow preview** | Debounce preview evaluation to 250ms. Show "Computing..." state. Cancel previous evaluation on new input. |

### Design Reference — Mockups

See `docs/mockups/data-mapper-edge-cases-mockup.html` for interactive visualization of array mapping, function palette, conditional mapping, and type mismatch handling.

---

## Phased Implementation Plan

### Phase 1: Core Mapper Component — Foundation

Phase 1 is split into seven sub-phases, each producing a testable, working increment. Each sub-phase should compile and pass tests before starting the next.

**Estimated effort:** ~8–10 days

##### Sub-phase 1A: Unified Path Engine (~1 day)

Extract the canonical JSONPath engine from `validator.ts` and replace all 4 scattered implementations with it.

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 1A.1 | Extract `getByPath()` + `tokenizeJsonPath()` from `validator.ts` into `src/shared/utils/jsonPath.ts`. Added `getByPathAsString()` helper. Kept re-export from `validator.ts`. | `src/shared/utils/jsonPath.ts` **New**, `src/engine/validator.ts` | ✅ |
| 1A.2 | Replace `extractJsonPath()` in `dataSourceImport.ts` with re-export of `getByPathAsString` from unified module | `src/features/scenarios/utils/dataSourceImport.ts` | ✅ |
| 1A.3 | Replace `extractPayloadVariables()` inline path resolution with `getByPath` call | `src/features/workflow/engine/graphRunnerHelpers.ts` | ✅ |
| 1A.4 | Replace `resolvePath()` with re-export of `getByPath` | `src/features/scenarios/utils/populateFromApiUtils.ts` | ✅ |
| 1A.5 | Updated imports in `ExtractionPathPickerModal.tsx` and `extractorVariables.ts` to use `src/shared/utils/jsonPath` | `ExtractionPathPickerModal.tsx`, `extractorVariables.ts` | ✅ |
| 1A.6 | Created `jsonPath.test.ts` with 39 tests (basic, edge cases, wildcards, empty paths, bracket spaces, deep chains, boolean/number leaves, `.length`) | `src/shared/utils/jsonPath.test.ts` **New** | ✅ |
| 1A.7 | Verified all 242 existing tests pass across 5 affected test suites | Existing test files | ✅ |
| 1A.8 | `tsc --noEmit` — zero type errors | | ✅ |

**Files affected:** 8 source files, 3 test files  
**Consumers to update:** `dataSourceImport.ts` (7 callsites), `graphRunnerHelpers.ts` (2 callsites), `populateFromApiUtils.ts` (3 callsites), `ExtractionPathPickerModal.tsx` (1), `extractorVariables.ts` (1)  
**Success criteria:** One `getByPath` function in `src/shared/utils/jsonPath.ts`. All 4 previous path implementations removed. All existing tests pass. Zero breaking changes.

##### Sub-phase 1B: Unified Tree Model (~1 day)

Consolidate the two parallel JSON tree implementations into one reusable model.

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 1B.1 | Analyzed: `JsonNode`/`buildTree` has path tracking, truncation, maxDepth; `JNode`/`buildJTree` is simpler (no path, no truncation). Unified model is a superset. | Analysis | ✅ |
| 1B.2 | Created unified `jsonTreeModel.ts` with `JsonTreeNode` interface, `buildJsonTree()` function, `trackPaths` option, `maxArrayItems`/`maxDepth` truncation | `src/shared/utils/jsonTreeModel.ts` **New** | ✅ |
| 1B.3 | Added `getAllLeafPaths()`, `getAllPaths()`, `nodeMatchesSearch()`, `suggestedVariableNameFromJsonPath()` to unified model | `src/shared/utils/jsonTreeModel.ts` | ✅ |
| 1B.4 | Migrated `jsonPathTreeUtils.ts` to thin re-export wrapper over unified model. All 5 consumer components unchanged (backward-compatible `JsonNode` type alias + `buildTree` wrapper) | `src/features/requests/utils/jsonPathTreeUtils.ts` | ✅ |
| 1B.5 | Migrated `JsonTreePreview.tsx`: `JNode` → type alias for `JsonTreeNode`, `buildJTree` delegates to `buildJsonTree` with `trackPaths: false` + `fixArrayKeys` compatibility shim | `src/features/requests/components/JsonTreePreview.tsx` | ✅ |
| 1B.6 | Shared styling in `jsonTreeShared.tsx` unchanged | No change | ✅ |
| 1B.7 | 38 tests: tree building (objects, arrays, nested, null, undefined, booleans, numbers, strings, empty), truncation, `trackPaths` option, leaf paths, all paths, search, `suggestedVariableNameFromJsonPath`, real-world API response, mixed-type arrays | `src/shared/utils/jsonTreeModel.test.ts` **New** | ✅ |
| 1B.8 | All 356 tests pass across 8 test suites. `tsc --noEmit` clean. | | ✅ |

**Files affected:** 3 source files, 1 new file  
**Consumers:** All 5 consumer components work via backward-compatible re-exports  
**Success criteria:** ✅ One `buildJsonTree` function. Old implementations replaced with re-exports/wrappers. All tree-based UIs render identically. 38 tests on unified model.

##### Sub-phase 1C: Core Types & State Management (~0.5 day)

Define the mapper data model and core state hook.

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 1C.1 | Created `types.ts` with: `Mapping`, `MapperAdapter<T>`, `MapperSource`, `MapperTarget`, `TargetField`, `FieldConstraint`, `ValidationIssue`, `ExpressionFunction`, `MapperState`, `MapperAction`, `AdapterCategory`, `SourceFormat` | `types.ts` **New** | ✅ |
| 1C.2 | Created `useMapperState.ts` hook: full CRUD (`addMapping`, `removeMapping`, `updateMapping`, `setMappings`, `clearAll`), `selectMapping`, `setActiveSource`, undo/redo stack (max 50), `canUndo`/`canRedo` flags | `hooks/useMapperState.ts` **New** | ✅ |
| 1C.3 | Created `autoMapAlgorithm.ts`: 3-tier matching (exact, case-insensitive, camelCase/snake_case/kebab-case normalization), `normalizeFieldName()`, `computeAutoMapCandidates()`, `candidatesToMappings()`. Each source used at most once. | `utils/autoMapAlgorithm.ts` **New** | ✅ |
| 1C.4 | Created `mappingSerializer.ts`: `serializeMappings()`, `deserializeMappings()`, `validateMappings()`, `roundTripMappings()` (lossless detection) | `utils/mappingSerializer.ts` **New** | ✅ |
| 1C.5 | 57 tests across 3 files: `useMapperState` (29 tests), `autoMapAlgorithm` (21 tests), `mappingSerializer` (7 tests). | 3 test files **New** | ✅ |
| 1C.6 | `tsc --noEmit` — zero type errors | | ✅ |

**Files created:** 4 source + 3 test  
**Success criteria:** ✅ All types compile. State hook supports CRUD + undo/redo. Auto-map handles exact/case/normalized matching. Serializer delegates correctly with round-trip validation.

##### Sub-phase 1D: Source Panel (~1.5 days)

Build the left-side source tree panel with drag handles.

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 1D.1 | Created `SourcePanel.tsx`: tab bar (multi-source), search input, expand/collapse all buttons, recursive `SourceTreeNode` rendering from `sampleData` via `buildJsonTree` | `SourcePanel.tsx` **New** | ✅ |
| 1D.2 | Created `SourceTreeNode.tsx`: recursive tree with expand/collapse chevrons, type badges (colored: string=green, number=blue, boolean=orange, array=yellow, object=purple, null=gray), value preview (truncated at 40 chars), drag handle (`⠿`), search filtering | `SourceTreeNode.tsx` **New** | ✅ |
| 1D.3 | Integrated `buildJsonTree` from unified model to build tree from `source.sampleData` (JSON or string) | `SourcePanel.tsx` | ✅ |
| 1D.4 | Search filtering: non-matching nodes hidden entirely; matching nodes + ancestors remain visible | `SourceTreeNode.tsx` | ✅ |
| 1D.5 | Multi-source tabs: tab bar with label, active indicator, click to switch source tree | `SourcePanel.tsx` | ✅ |
| 1D.6 | Native HTML5 drag: leaf nodes are `draggable`, `onDragStart` sets `application/mapper-source` data with `{ path, sourceId }` | `SourceTreeNode.tsx` | ✅ |
| 1D.7 | Paste JSON & Fetch Sample implemented in **Phase 2C** (tasks 2C.1–2C.5): panel modes, overrides/state, adapter fetch, invalid JSON handling, tab-switch paste-mode reset. | `SourcePanel.tsx`, `useMapperState.ts`, `types.ts` | ✅ |
| 1D.8 | Full CSS in `data-mapper.css`: panels, tree nodes, type badges, chevrons, drag handles, search, tabs, empty states | `src/styles/data-mapper.css` **New** | ✅ |
| 1D.9 | Tests covered in `DataMapper.test.tsx` (tree rendering, search filtering, tab switching, empty state) | `DataMapper.test.tsx` | ✅ |
| 1D.10 | `tsc --noEmit` — zero type errors | | ✅ |

**Files created:** 2 source + 1 CSS (shared)  
**Decision:** Used native HTML5 drag-and-drop instead of `@dnd-kit` to avoid adding a dependency — simpler and sufficient for Phase 1 tree-to-tree dragging.  
**Success criteria:** ✅ Tree renders from any JSON. Search filters nodes. Multi-source tabs switch. Drag produces correct data payload.

##### Sub-phase 1E: Target Panel (~1.5 days)

Build the right-side target tree with drop zones and mapping indicators.

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 1E.1 | Created `TargetPanel.tsx`: search input, expand/collapse all, mapped count badge, recursive `TargetTreeNode` rendering | `TargetPanel.tsx` **New** | ✅ |
| 1E.2 | Created `TargetTreeNode.tsx`: recursive node with native HTML5 drop zones (`onDragOver`/`onDrop`), mapped/unmapped indicators, selection highlighting, click-to-select mapping | `TargetTreeNode.tsx` **New** | ✅ |
| 1E.3 | Sample data mode: target tree built from `target.sampleData` via `buildJsonTree`. Schema-driven mode (building tree from `target.fields` / JSON Schema) deferred (see Deferred Items). | `TargetPanel.tsx` | ✅ |
| 1E.4 | Free-form mode (add field button) deferred to Phase 9+ (`allowCustomFields` type exists but no UI yet) | — | 🔜 |
| 1E.5 | Drop handling: native drag/drop parses `application/mapper-source` data, calls `onDrop(targetPath, sourcePath, sourceId)`. Drop replaces existing mapping on same target. Visual feedback via CSS class `dm-tree-node--drag-over`. | `TargetTreeNode.tsx` | ✅ |
| 1E.6 | Remove mapping via canvas (click connection line → remove button). Inline ✕ on hover — **done in 2G.1**. | `MappingCanvas.tsx`, `TargetTreeNode.tsx` | ✅ |
| 1E.7 | Inline display: mapped target shows `← sourcePath` (direct maps) or `fx sourcePath` (expression maps) | `TargetTreeNode.tsx` | ✅ |
| 1E.8 | Type mismatch indicator — **implemented in Phase 2E** (see 2E.1–2E.5) | — | ✅ |
| 1E.9 | Unmapped required fields footer — implemented in Phase 2F (`findUnmappedRequired` in `DataMapperModal.tsx`) | `DataMapperModal.tsx` | ✅ |
| 1E.10 | CSS: drop zone highlight (`dm-tree-node--drag-over`), mapped (`dm-tree-node--mapped`), selected (`dm-tree-node--selected`), mapped indicator | `src/styles/data-mapper.css` | ✅ |
| 1E.11 | Tests covered in `DataMapper.test.tsx` (target rendering, empty state, mapped count display) | `DataMapper.test.tsx` | ✅ |
| 1E.12 | `tsc --noEmit` — zero type errors | | ✅ |

**Files created:** 2 source  
**Success criteria:** ✅ Target tree renders from sample data. Drop creates mappings. Mapped indicators visible. Selection works. Phase 2 items (type mismatch, schema mode, free-form fields) logged.

##### Sub-phase 1F: Mapping Canvas & Toolbar (~1.5 days)

Build the SVG connection layer and the action toolbar.

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 1F.1 | Created `MappingCanvas.tsx`: SVG between panels, renders bezier curves via `bezierPath()` with 45% control points. Invisible wide hit area (12px) for easy clicking. | `MappingCanvas.tsx` **New** | ✅ |
| 1F.2 | Created `useConnectionLines.ts`: finds source/target DOM elements by `data-path` attribute, computes vertical positions relative to container | `hooks/useConnectionLines.ts` **New** | ✅ |
| 1F.3 | Line styling: solid = confirmed, dashed (`stroke-dasharray: 4 3`) = auto-mapped. Selected lines thicker (2.5px). Non-selected lines dimmed when one is selected. | `MappingCanvas.tsx` | ✅ |
| 1F.4 | Expression badge: `fx` text rendered at midpoint of lines with expressions | `MappingCanvas.tsx` | ✅ |
| 1F.5 | Scroll synchronization via `useLayoutTick` (ResizeObserver + MutationObserver + scroll). **Implemented in Phase 2 hardening.** | `hooks/useConnectionLines.ts` | ✅ |
| 1F.6 | Click-to-select: clicking line selects mapping. Red `×` remove button appears on selected line. Keyboard remove/deselect: **`Delete`/`Backspace`** and **`Escape`** are implemented in **1H.8** (`DataMapper.tsx`), not in `MappingCanvas.tsx` alone. | `MappingCanvas.tsx`, `DataMapper.tsx` (**1H.8**) | ✅ |
| 1F.7 | Created `MapperToolbar.tsx`: Auto-map (with candidate count badge), Clear All (disabled when 0), mapping count status, Undo/Redo buttons | `MapperToolbar.tsx` **New** | ✅ |
| 1F.8 | Auto-map button: calls `computeAutoMapCandidates` + `candidatesToMappings`, badge shows available candidate count. Toast — **done in 2G.4**. | `MapperToolbar.tsx` | ✅ |
| 1F.9 | Accept/reject individual auto-maps — implemented in Phase 2G.3 (`isPending` flag, dashed pending lines, ✓/✗ badges, Accept All/Reject All toolbar) | `types.ts`, `useMapperState.ts`, `MappingCanvas.tsx`, `MapperToolbar.tsx` | ✅ |
| 1F.10 | CSS: SVG line styles (`dm-connection-line` variants), expression badge, remove button, toolbar layout, badge styling | `src/styles/data-mapper.css` | ✅ |
| 1F.11 | Tests covered in `DataMapper.test.tsx` (toolbar rendering, badge count, button states) | `DataMapper.test.tsx` | ✅ |
| 1F.12 | `tsc --noEmit` — zero type errors | | ✅ |

**Files created:** 3 source  
**Success criteria:** ✅ SVG bezier lines connect mapped fields. Click-to-select with remove. Auto-map with candidate count badge. Toolbar with undo/redo/clear.

##### Sub-phase 1G: DataMapper Container & Integration (~1 day)

Wire all sub-components into the main `DataMapper` component and verify end-to-end.

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 1G.1 | Created `DataMapper.tsx`: three-column flex layout (SourcePanel \| MappingCanvas \| TargetPanel). Generic `<TOutput>` prop typing. Configurable `height`. `onChange` callback fires on mapping changes. | `DataMapper.tsx` **New** | ✅ |
| 1G.2 | Uses native HTML5 drag-and-drop (no `@dnd-kit` needed). Drop handler creates mapping, replacing any existing mapping on same target. | `DataMapper.tsx` | ✅ |
| 1G.3 | Adapter lifecycle: on mount, calls `adapter.deserialize(initialData)`. `onChange` callback provides current mappings for external serialization. Full modal/Done/Cancel — **done in 2F** (`DataMapperModal.tsx`). | `DataMapper.tsx` | ✅ |
| 1G.4 | Adapter validation wiring — implemented in Phase 2F (`DataMapperModal.tsx` calls `adapter.validate()`, inline validation bar) | `DataMapperModal.tsx` | ✅ |
| 1G.5 | Keyboard shortcuts: `Cmd+Z` undo, `Cmd+Shift+Z` redo, `Delete`/`Backspace` remove selected, `Escape` deselect (via `useEffect` keydown listener — see **1H.8**). `/` focus search — **done in 2G.2**. | `DataMapper.tsx` | ✅ |
| 1G.6 | Responsive layout: panels use `flex: 1`, canvas fixed at 120px width. Panel resize handles — **done in 2G.5**. | `DataMapper.tsx`, `data-mapper.css` | ✅ |
| 1G.7 | Empty states: source → "No sample data. Paste JSON or fetch a sample…"; target → "No target schema. Define target fields or paste sample JSON." | `SourcePanel.tsx`, `TargetPanel.tsx` | ✅ |
| 1G.8 | Demo adapter — implemented in Phase 2G.7 (`adapters/demoAdapter.ts` with User→Order Summary sample data, 10 unit tests) | `adapters/demoAdapter.ts` | ✅ |
| 1G.9 | Created `DataMapper.test.tsx`: 56 tests covering rendering, source/target trees, toolbar, initial data, onChange, empty states, search filtering, multi-source tabs, auto-map badge, preview toggle, fetchError tab-switch, type mismatch badge/quick-fix, drop handling, keyboard shortcuts, expression editor, resize handles, toast, accept/reject pending, fetch error handling | `DataMapper.test.tsx` **New** | ✅ |
| 1G.10 | Full test suite: `tsc --noEmit` clean. 1468 tests across 73 files passing (including all legacy + new data-mapper tests). | | ✅ |

**Files created:** 1 source + 1 test  
**Decision:** No `@dnd-kit` dependency added — native HTML5 drag-and-drop is simpler and sufficient for Phase 1.  
**Success criteria:** ✅ DataMapper renders source + target trees with SVG canvas between them. Drag-and-drop creates mappings. Auto-map with candidate count. Undo/redo works. Serialize/deserialize via adapter. 1468 tests passing.

##### Sub-phase 1H: Phase 1 Hardening — Test Coverage & Polish

Thorough re-evaluation identified 12 gaps that must be addressed before Phase 1 is considered complete.

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 1H.1 | Added 26 dedicated tests for `MapperToolbar`: auto-map click, clear-all enabled/disabled, undo/redo button states, mapping count display, badge visibility, preview toggle (show/hide/active state), accept/reject pending | `MapperToolbar.test.tsx` **New** | ✅ |
| 1H.2 | SourcePanel/TargetPanel covered via integration tests in DataMapper.test.tsx (tree rendering, search, expand/collapse, empty states, tabs, badges) | `DataMapper.test.tsx` | ✅ |
| 1H.3 | Drag-and-drop: native HTML5 DataTransfer not fully simulatable in jsdom; covered by auto-map click integration instead | `DataMapper.test.tsx` | ✅ |
| 1H.4 | Added auto-map click integration tests: button click → mappings created → `onChange` called → badge disappears | `DataMapper.test.tsx` | ✅ |
| 1H.5 | Added keyboard shortcut tests: `Cmd+Z` undo, `Cmd+Shift+Z` redo, `Escape` deselect | `DataMapper.test.tsx` | ✅ |
| 1H.6 | Added Clear All integration test: verifies mappings cleared and onChange callback fired | `DataMapper.test.tsx` | ✅ |
| 1H.7 | Added target panel search filtering test (parity with source search) | `DataMapper.test.tsx` | ✅ |
| 1H.8 | Implemented `Delete`/`Backspace` to remove selected mapping, `Escape` to deselect | `DataMapper.tsx` | ✅ |
| 1H.9 | Added 6 edge case tests: remove/update non-existent IDs, setMappings/clearAll clearing selection, MAX_UNDO pruning, undo after clearAll | `useMapperState.test.ts` | ✅ |
| 1H.10 | Added 6 edge case tests: bracket-heavy paths, kebab-to-camel normalized match, case-insensitive precedence, empty source/target, leaf-only matching | `autoMapAlgorithm.test.ts` | ✅ |
| 1H.11 | Created barrel `index.ts` exporting DataMapper, hooks, utils, and all types | `index.ts` **New** | ✅ |
| 1H.12 | Updated `validator.getByPath.test.ts` to import from canonical `shared/utils/jsonPath`. Also fixed `validator.ts` runtime — re-export alone didn't import for internal use; added explicit import. | `validator.getByPath.test.ts`, `validator.ts` | ✅ |
| 1H.13 | Full suite: `tsc --noEmit` clean, 464 test files, 11,999 tests, zero failures | | ✅ |

**Success criteria:** ✅ All interaction behaviors tested. Dedicated MapperToolbar tests (22 cases). useMapperState edge cases (6 new). autoMapAlgorithm edge cases (6 new). Integration tests for auto-map, clear-all, keyboard shortcuts, target search, string sampleData, invalid JSON, preview toggle. Barrel export for clean API. Fixed critical `getByPath` runtime bug.

##### Phase 1 Dependency Graph

```
  1A (Path engine)
    │
    └──► 1B (Tree model)
            │
            ├──► 1C (Types & state)
            │       │
            │       ├──► 1D (Source panel)
            │       │       │
            │       │       └──►──┐
            │       │             │
            │       └──► 1E (Target panel)
            │               │    │
            │               └──►─┤
            │                    │
            │                    └──► 1F (Canvas & toolbar)
            │                           │
            │                           └──► 1G (Container & integration)
            │
            (1D + 1E can be built in parallel after 1C)
```

1A is the foundation. 1B depends on 1A (tree model uses path engine). 1C depends on 1B (types reference tree nodes). 1D and 1E can be built in parallel after 1C. 1F depends on 1D + 1E (canvas connects them). 1G wires everything together.

### Phase 2: Expression Editor, Preview & Deferred UX

Phase 2 has two tracks: **expressions & preview** (the core new capability) and **deferred Phase 1 UX items** that are prerequisites for Phase 3 adapters. Broken into 8 sub-phases.

**Progress:** ✅ **Complete.** All sub-phases 2A–2H done.

**Key architectural decision:** Textarea-based expression editor (lightweight, no extra dependency). Monaco (`@monaco-editor/react`) is an **optional upgrade deferred to Phase 7D**. Reuses existing `expressionFunctions/` registry (6 categories, 920 lines) and `expressionEvaluator.ts` tokenizer/evaluator.

---

##### Sub-phase 2A: Mapper Expression Evaluator (~0.5 day)

Bridge the existing workflow expression engine (`expressionEvaluator.ts` + `expressionFunctions/`) into a mapper-compatible evaluator. The workflow engine uses `{{varName}}` for variables — the mapper needs `$.source.path` references instead.

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 2A.1 | Create `mapperExpressionEvaluator.ts`: wraps `evaluateExpression` with a mapper-specific `EvalContext.resolveVariable` that resolves `$.path` JSONPath references against source sample data using `getByPath`. Also supports `{{var}}` syntax for backward compat. | `src/shared/components/data-mapper/utils/mapperExpressionEvaluator.ts` **New** | ✅ |
| 2A.2 | Add `evaluateMapperExpression(expression, sources, activeSourceId)` — convenience function that builds the context from `MapperSource[]` and returns `{ value, error?, preview }`. Returns stringified preview for display. | Same file | ✅ |
| 2A.3 | Handle adapter `customFunctions`: merge adapter-provided `ExpressionFunction[]` into the global registry at evaluation time. | Same file | ✅ |
| 2A.4 | Unit tests: path resolution, function calls, nested expressions, error cases (bad path, unknown function, type errors), custom functions, multi-source resolution | `mapperExpressionEvaluator.test.ts` **New** | ✅ |

**Reuses:** `expressionEvaluator.ts` (tokenizer, parser, evaluator), `EXPRESSION_FUNCTION_MAP`, `getByPath` from `shared/utils/jsonPath.ts`.  
**Success criteria:** `evaluateMapperExpression('$upper($.name)', sources, 's1')` returns `{ value: 'ALICE', preview: '"ALICE"' }`.

---

##### Sub-phase 2B: Expression Editor Modal (~1 day)

Expression editor modal for editing mapping expressions. Opened by double-clicking a mapped target node or clicking "Edit expression" on a selected mapping line. Originally textarea-based; **upgraded to Monaco (`@monaco-editor/react`) in Phase 7D** with `$fn()` autocomplete and source path completions.

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 2B.1 | Create `ExpressionEditorModal.tsx`: full-screen modal with **textarea** editor (top), function reference panel (left sidebar), live preview (bottom). Accept/Cancel buttons. | `src/shared/components/data-mapper/ExpressionEditorModal.tsx` **New** | ✅ |
| 2B.2 | **Phase 2:** Textarea editing with insert-at-cursor for function templates; focus management and modal accessibility (e.g. focus trap via `tabIndex` + `aria-modal`). **Phase 7D (optional Monaco):** JavaScript language mode, `$fn()` autocomplete from `EXPRESSION_FUNCTIONS`, source path autocomplete from `getAllLeafPaths(sourceTree)` prefixed with `$.`, theme-aware (dark/light). | Same file | ✅ |
| 2B.3 | Function reference sidebar: grouped by category, clickable to insert `$fn()` template at cursor, shows signature + description + examples (reuse `groupedExpressionFunctions()`). | Same file or `ExpressionFunctionPanel.tsx` **New** | ✅ |
| 2B.4 | Live preview bar (within modal): evaluate expression via `evaluateMapperExpression` with **250ms debounce** after edits; show result or error below editor. Green for success, red for error. | Same file | ✅ |
| 2B.5 | Wire into DataMapper: double-click mapped target node → opens modal pre-filled with `mapping.expression ?? mapping.sourcePath`. On Accept → `updateMapping(id, { expression })`. | `DataMapper.tsx`, `TargetTreeNode.tsx` | ✅ |
| 2B.6 | Wire into MappingCanvas: "fx" badge on expression lines. Click "fx" badge → opens expression editor for that mapping. | `MappingCanvas.tsx` | ✅ |
| 2B.7 | CSS styles for the expression editor modal, function sidebar, preview bar — split into dedicated stylesheet | `src/styles/data-mapper-expression.css` (+ base `data-mapper.css`) | ✅ |
| 2B.8 | Unit tests: modal open/close, expression save, preview evaluation, function insert, cancel discards changes (Monaco-specific autocomplete tests deferred to Phase 7D) | `ExpressionEditorModal.test.tsx` **New** | ✅ |

**Reuses:** `ExpressionBuilderView.tsx` patterns (3-column layout, function catalog). **Deferred to Phase 7D (optional):** `@monaco-editor/react` and `ScriptCodeEditor.tsx` completion-provider patterns for a Monaco-based editor.  
**Dependency:** 2A (evaluator).  
**Success criteria:** ✅ User double-clicks target field → expression editor opens with expression → debounced live preview shows result → Accept saves expression → mapping line shows "fx" badge. _(Originally textarea-based; upgraded to Monaco in Phase 7D.)_

---

##### Sub-phase 2C: Source Data Input — Paste JSON & Fetch Sample (~1 day)

Add the ability to provide source data interactively (not just via `sampleData` prop). Critical for the PreviewBar and for Phase 3 adapters.

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 2C.1 | Add "Paste JSON" toggle to `SourcePanel`: button in panel header toggles between tree view and a `<textarea>` for pasting raw JSON. On blur/submit, parse and update the source tree. | `SourcePanel.tsx` | ✅ |
| 2C.2 | Add state management for user-provided source data: `MapperState` gains optional `sourceSampleOverrides: Record<sourceId, unknown>`. `SET_SOURCE_SAMPLE` action. When present, overrides `adapter.sources[].sampleData`. | `types.ts`, `hooks/useMapperState.ts` | ✅ |
| 2C.3 | Add "Fetch Sample" button: visible when `adapter.fetchSampleData` is defined. Calls adapter method, updates source sample override. Shows loading spinner during fetch. | `SourcePanel.tsx` | ✅ |
| 2C.4 | Error handling for paste/fetch: invalid JSON shows inline error message, keeps previous tree visible. | `SourcePanel.tsx` | ✅ |
| 2C.5 | Unit tests: paste JSON → tree updates, fetch button calls adapter, invalid JSON error, toggle between tree/paste modes, source sample override precedence; tab-switch resets paste mode | `SourcePanel.test.tsx` **New** | ✅ |

**Reuses:** `fetchScenarioSample.ts` patterns (one-off HTTP fetch).  
**Dependency:** None (can parallel with 2A/2B).  
**Success criteria:** User clicks "Paste JSON" → pastes `{"users":[{"name":"A"}]}` → tree shows the structure. User clicks "Fetch" → adapter fetches live data → tree updates.

---

##### Sub-phase 2D: Preview Bar (~0.5 day)

Collapsible bottom bar showing the mapped output in real time. For each mapping, evaluates expression (or direct path copy) against source sample data and shows the resulting target object.

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 2D.1 | Create `PreviewBar.tsx`: collapsible panel below the mapper body. Two columns: "Source Sample" (read-only JSON, left) and "Mapped Output" (computed JSON, right). Toggle button in toolbar. | `src/shared/components/data-mapper/PreviewBar.tsx` **New** | ✅ |
| 2D.2 | Compute mapped output: for each mapping, evaluate `mapping.expression` (or `getByPath(source, mapping.sourcePath)` if no expression) → build a target JSON object with values filled in. Unmapped fields shown as `null` or `<unmapped>`. | Same file or `utils/previewCompute.ts` **New** | ✅ |
| 2D.3 | Error highlighting: if any mapping expression fails evaluation, show that field in red with the error message inline. | `PreviewBar.tsx` | ✅ |
| 2D.4 | Wire into DataMapper: add preview toggle button to `MapperToolbar`. `DataMapper.tsx` renders `PreviewBar` when visible. Auto-recalculates on mapping/expression/source changes (debounced). | `DataMapper.tsx`, `MapperToolbar.tsx` | ✅ |
| 2D.5 | CSS styles for preview bar, split view, error highlighting | `src/styles/data-mapper.css` | ✅ |
| 2D.6 | Unit tests: preview computation, error fields, toggle show/hide, re-computation on mapping change | `PreviewBar.test.tsx` **New** | ✅ |

**Dependency:** 2A (evaluator), 2C (source data for preview).  
**Success criteria:** User has 3 mappings → clicks "Preview" → bottom bar shows source JSON on left and target JSON with mapped values on right. Expression error shows red field.

---

##### Sub-phase 2E: Type Mismatch Detection & Indicators (~0.5 day)

Detect when source and target field types don't match and suggest conversion functions.

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 2E.1 | Created `typeMismatch.ts`: detects mismatches (string→number, number→string, boolean→string, etc.) using runtime type inference, `fieldConstraints`, `fields`, and sample data fallback. Returns severity (warning for scalar, info for structural) and suggested fix functions (`$parseInt`, `$toString`, `$toBool`, `$toInt`). | `src/shared/components/data-mapper/utils/typeMismatch.ts` **New** | ✅ |
| 2E.2 | Amber ⚠ (warning) and blue ℹ (info) mismatch badges on target tree nodes. Tooltip shows full mismatch message. Badges propagate through recursive children. | `TargetTreeNode.tsx`, `TargetPanel.tsx` | ✅ |
| 2E.3 | Dashed amber `dm-connection-line--mismatch` class on canvas lines for type-mismatched mappings. `ConnectionLine` interface extended with `hasTypeMismatch`. `useConnectionLines` accepts `mismatchIds` set. | `MappingCanvas.tsx`, `useConnectionLines.ts` | ✅ |
| 2E.4 | Quick-fix: clicking the ⚠ badge auto-applies the suggested expression (e.g., `$parseInt($.name)`) via `handleQuickFix` in `DataMapper.tsx`. Once expression is set, mismatch badge disappears (expressions skip detection). | `TargetTreeNode.tsx`, `DataMapper.tsx` | ✅ |
| 2E.5 | 26 unit tests: `inferType`, `typesCompatible`, all type combinations, suggested functions, no false positives for compatible/null types, fieldConstraints/fields/sampleData resolution, string sampleData parsing, `getMismatchForMapping`, expression mapping skip, structural mismatches. Integration tests in `TargetTreeNode.test.tsx` (4 tests), `MappingCanvas.test.tsx` (2 tests), `DataMapper.test.tsx` (4 tests). | `typeMismatch.test.ts` **New**, `TargetTreeNode.test.tsx`, `MappingCanvas.test.tsx`, `DataMapper.test.tsx` | ✅ |

**Dependency:** 2A (evaluator for suggested function evaluation), 2B (expression editor for quick-fix).  
**Success criteria:** Dragging `$.price` (string "29.99") to a number target shows amber ⚠ warning badge → clicking it auto-applies `$parseInt($.price)` as a quick-fix expression on the mapping → mismatch badge disappears (mappings with expressions skip detection).

---

##### Sub-phase 2F: Modal Shell & Validation Display (~0.5 day)

Add the full modal wrapper (Done/Cancel) and adapter validation display — prerequisites for Phase 3 adapter integration.

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 2F.1 | Created `DataMapperModal.tsx`: modal wrapper around `DataMapper`. Title from `adapter.title`. Footer with Done/Cancel buttons. Full-screen toggle (⊞/⊟). Close (×) button. `aria-modal` overlay. | `src/shared/components/data-mapper/DataMapperModal.tsx` **New** | ✅ |
| 2F.2 | Adapter validation wiring: on Done click, calls `adapter.validate(mappings)`. Errors block save; warnings don't. Issues stored in state, cleared on mapping changes. | `DataMapperModal.tsx` | ✅ |
| 2F.3 | Inline validation display: `ValidationIssue[]` rendered in validation bar with error/warning counts. Per-issue icons (✕/⚠/ℹ), messages, and optional `targetPath` display. | `DataMapperModal.tsx` | ✅ |
| 2F.4 | Unmapped required fields: `findUnmappedRequired` checks `fieldConstraints` for `required: true` paths not in mappings. Shows warning-severity issues. `ValidationIssue.targetPath` added as optional field. | `DataMapperModal.tsx`, `types.ts` | ✅ |
| 2F.5 | 16 unit tests: rendering (title, buttons, DataMapper inside), cancel/close, Done serialization, validation error blocking, warning pass-through, unmapped required fields, full-screen toggle, error+warning counts, validation icons, targetPath display, Done disabled on errors. | `DataMapperModal.test.tsx` **New** | ✅ |

**Dependency:** None (uses existing adapter `validate` method from types.ts).  
**Success criteria:** Adapter with `validate` returning errors → "Done" blocked with inline error display. Adapter without `validate` → "Done" saves immediately.

---

##### Sub-phase 2G: Deferred UX Polish (~1 day)

Remaining Phase 1 deferred items that improve the mapper experience but aren't blockers for Phase 3.

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 2G.1 | Inline ✕ on hover: target tree nodes show a small ✕ button on hover when mapped. Click removes that mapping. `onRemoveMapping` prop added to `TargetTreeNode` and `TargetPanel`. CSS `.dm-inline-remove` with show-on-hover. | `TargetTreeNode.tsx`, `TargetPanel.tsx` | ✅ |
| 2G.2 | `/` keyboard shortcut: focuses the source search input via `searchInputRef` prop on `SourcePanel`. Skips when already in input/textarea. | `DataMapper.tsx`, `SourcePanel.tsx` | ✅ |
| 2G.3 | Accept/reject individual auto-maps: `isPending` flag on `Mapping`. Auto-map sets `isPending: true`. Dashed cyan lines (`.dm-connection-line--pending`). Per-line ✓/✗ SVG badges. Accept All / Reject All toolbar buttons. State actions: `ACCEPT_PENDING`, `REJECT_PENDING`, `ACCEPT_ALL_PENDING`, `REJECT_ALL_PENDING`. | `types.ts`, `useMapperState.ts`, `MappingCanvas.tsx`, `MapperToolbar.tsx`, `DataMapper.tsx`, `useConnectionLines.ts` | ✅ |
| 2G.4 | Toast/feedback after auto-map: "Auto-mapped N fields" notification with 3s auto-dismiss and CSS fade animation (`.dm-toast`, `@keyframes dm-toast-fade`). | `DataMapper.tsx`, `data-mapper.css` | ✅ |
| 2G.5 | Panel resize handles: draggable vertical `.dm-resize-handle` splitters between source/canvas and canvas/target. Mouse-event-based drag with `MIN_PANEL=150px` constraint. `.dm-panel-wrapper` class for layout. | `DataMapper.tsx`, `data-mapper.css` | ✅ |
| 2G.6 | ResizeObserver for connection lines — **already implemented** via `useLayoutTick` (ResizeObserver + MutationObserver + scroll listeners) in Phase 2 Hardening Round 2. | `hooks/useConnectionLines.ts` | ✅ |
| 2G.7 | Demo/reference adapter: `adapters/demoAdapter.ts` with User→Order Summary sample data, field constraints, field descriptions, custom validate(). Exported from barrel. 10 unit tests in `adapters/demoAdapter.test.ts`. | `adapters/demoAdapter.ts` **New**, `adapters/demoAdapter.test.ts` **New** | ✅ |
| 2G.8 | Unit tests for all 2G items: 3 TargetTreeNode inline-remove tests, 4 MapperToolbar accept/reject tests, 4 useMapperState pending tests, 2 DataMapper toast/resize tests, 10 demoAdapter tests. Total 23 new tests. | Various test files | ✅ |

**Dependency:** None (fully independent of 2A–2F).  
**Success criteria:** ✅ All deferred Phase 1 items resolved except 1E.4 (free-form mode, deferred to Phase 9+). Only one 🔜 remains in Phase 1 rows (1E.4).

---

##### Sub-phase 2H: Phase 2 Hardening (~0.5 day)

Final verification and cleanup before Phase 3.

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 2H.1 | Run `tsc --noEmit` — zero errors | | ✅ |
| 2H.2 | Run full test suite — zero failures. _(At Phase 2H completion: 524/21 files. Grew to 608/24 files by Phase 3F.)_ | | ✅ |
| 2H.3 | Coverage check — hooks/utils/adapters >90% on all 4 metrics. Components ~94% stmts (improved from ~84% via targeted test additions for DataMapper, SourcePanel, TargetPanel, MappingCanvas, PreviewBar). External shared utils 100% via their own test suites. | | ✅ |
| 2H.4 | Updated `data-mapper-plan.md` — all Phase 2 tasks ✅. Fixed stale 🔜 markers (1E.9, 1F.9, 1G.4, 1G.8). Added pre-2H audit tests (7 new). Updated CSS line counts, adapters note. | | ✅ |
| 2H.5 | All files under 900-line threshold. Largest source: DataMapper.tsx (367 lines). CSS split: data-mapper.css (814), data-mapper-expression.css (363), data-mapper-modal.css (170). | | ✅ |

**Success criteria:** All Phase 2 features working. Expression editor with live preview, type mismatch detection, fetch/paste source data, modal shell with validation. Full test coverage. Ready for Phase 3 adapter integration.

---

##### Phase 2 Dependency Graph

```
  2A (Expression evaluator)
    │
    ├──► 2B (Expression editor modal)
    │       │
    │       └──► 2E (Type mismatch — uses editor for quick-fix)
    │
    └──► 2D (Preview bar — uses evaluator)
            │
            └── 2C (Source data input — feeds preview)

  2F (Modal shell & validation) ── independent

  2G (Deferred UX polish) ── independent

  2A + 2B + 2C + 2D + 2E + 2F + 2G ──► 2H (Hardening)
```

**Estimated total:** ~5–6 days  
**Parallelism:** 2A/2C/2F/2G can start simultaneously. 2B depends on 2A. 2D depends on 2A+2C. 2E depends on 2A+2B.

### Phase 3: Adapters — Extraction & Validation

**Strategy: "Side-by-side, then switch."** Each adapter is built alongside the existing UI, verified via round-trip tests, wired in as the primary UI, then the old component is deprecated. This avoids breaking existing functionality during migration.

**Pattern per adapter:**
1. Build adapter file (`adapters/<name>Adapter.ts`) implementing `MapperAdapter<TOutput>`
2. Implement `serialize(Mapping[]) → TOutput` and `deserialize(TOutput) → Mapping[]`
3. Write round-trip unit tests: `serialize(deserialize(existing))` === `existing`
4. Wire into parent component as the primary UI
5. Mark old component as `@deprecated`

**Design decisions (resolved):**
- **Header/status extractions:** Kept as simple text fields alongside the mapper. The mapper handles body JSONPath extractions only — header and status extractions remain as inline rows in the extraction list (they are not tree-shaped and don't benefit from visual mapping).
- **Include/exclude mode:** The mapper uses a "select source fields" interaction model. In include mode, dragged fields become `expectedFields`. In exclude mode, un-dragged fields become `excludedPaths`. A mode toggle on the adapter controls which output shape is produced.
- **Migration:** The mapper replaces the old component directly (no "Open in Mapper" button). The old components are deprecated but not deleted until Phase 7 cleanup.

**Progress:** ✅ **All Phase 3 tasks complete.** 3A.1–3A.7, 3B.1–3B.4, 3C.1–3C.11, 3D.1–3D.5, 3E.1–3E.5, 3F.1–3F.7 all ✅. All three adapters (extraction, assertion, validation) are built, tested, and wired into their target components.

#### Sub-Phase 3A: ExtractionAdapter (Medium Complexity — Start Here)

Replace `ExtractionEditor` + `ExtractionPathPickerModal` + `ExtractionMapperModal` with the Data Mapper. Source = HTTP response body tree; Target = variable name list. Output: `Extraction[]`. The existing `ExtractionMapperModal` (337 lines) is essentially a simpler version of our Data Mapper, making this the most natural starting point.

**Existing components being replaced:**
- `ExtractionEditor.tsx` (~226 lines) — inline extraction row list with add/remove/reorder
- `ExtractionPathPickerModal.tsx` (~374 lines) — single-path JSONPath picker with tree
- `ExtractionMapperModal.tsx` (~337 lines) — bulk "Fetch & Map" with tree + extraction rows

**Parents that render these:**
- `HttpConfig.tsx` (workflow HTTP node config, Extract tab)
- `TestEditorModal.tsx` (harness test editor, Extract tab)

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 3A.1 | Created `extractionAdapter.ts` — `MapperAdapter<Extraction[]>`. Source: single source `'response-body'` built from `sampleResponseBody` JSON (parsed from string or object). Target: `allowCustomFields: true` for variable names. `serialize()`: convert `Mapping[]` → `Extraction[]` (targetPath → name, expression ?? sourcePath → expression, source = `'body'`). `deserialize()`: convert body-only `Extraction[]` → `Mapping[]`, filtering header/status. `splitExtractions()` helper exported for parent components. | `adapters/extractionAdapter.ts` **New** | ✅ |
| 3A.2 | `fetchSampleData()` on adapter — delegates to `opts.fetchSampleData` callback provided by parent. Source `supportsLiveFetch` set based on callback presence. Host-override pattern handled by parent wrapping the fetch callback. | Same file | ✅ |
| 3A.3 | Header/status extraction pass-through — `nonBodyExtractions` option stores header/status rows. `deserialize()` filters to `source === 'body'` only. `serialize()` prepends non-body rows before mapper output. `splitExtractions()` utility separates body from non-body for parent use. | Same file | ✅ |
| 3A.4 | Wired via `ExtractionEditor.tsx` — `DataMapperModal` + `createExtractionAdapter` integrated inside `ExtractionEditor` itself (used by both `HttpConfig.tsx` and `TestEditorModal.tsx`). Picker-mode for single-row path editing + full mapper-mode for bulk mapping. `sampleResponseBody`, `nonBodyExtractions` threaded through adapter. | `ExtractionEditor.tsx` | ✅ |
| 3A.5 | (Covered by 3A.4) `TestEditorModal.tsx` renders `ExtractionEditor` which now contains the Data Mapper wiring. No direct changes to `TestEditorModal.tsx` needed. | `TestEditorModal.tsx` | ✅ |
| 3A.6 | 34 unit tests: adapter creation (9), serialize (5), deserialize (5), round-trip (3), validate (8), splitExtractions (4). Covers: JSON string parsing, invalid JSON, null/undefined input, expression passthrough, non-body merge, duplicate names, empty names, braces warning, empty expression. | `adapters/extractionAdapter.test.ts` **New** | ✅ |
| 3A.7 | Integration tests in `ExtractionEditor.test.tsx` — updated mocks from old modals to `DataMapperModal`, verified picker-mode and full-mapper-mode onSave, button text "Visual Mapper", modal open/close flows. Also `adapterIntegration.test.ts` covers cross-adapter consistency. | `ExtractionEditor.test.tsx`, `adapterIntegration.test.ts` | ✅ |

**Success criteria:** Workflow HTTP node Extract tab and Test Editor Extract tab use the Data Mapper instead of the old extraction components. Header/status extractions still work as inline rows. All existing extraction tests pass. Round-trip: open existing extractions in mapper → save → `Extraction[]` is identical.

#### Sub-Phase 3B: AssertionAdapter (Low Complexity — Quick Win)

Replace `RegexAssertionModal` path picker tree with the Data Mapper's `SourcePanel` tree. Source = response body tree; Target = single regex assertion config (`{ jsonPath, pattern }`). This is the simplest adapter — no multi-mapping, just path selection + pattern input.

**Existing component being replaced:**
- `RegexAssertionModal.tsx` (~383 lines) — JSON tree picker + pattern library + live preview

**Parents:**
- `TestEditorValidationTab.tsx` (regex assertion builder)

**Note:** `RegexAssertionModal` exports `PickerNode` which is reused by extraction modals. After 3A replaces the extraction modals, `PickerNode` is only used internally by `RegexAssertionModal`. We can either: (a) replace the modal's tree with `SourcePanel`, keeping the pattern library / live preview; or (b) build a lightweight mapper view. Option (a) is preferred — less disruption, reuses our tree with better UX.

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 3B.1 | Created `assertionAdapter.ts` — `MapperAdapter<AssertionAdapterResult>`. Source: single `'response-body'` from parsed sample JSON. Target: single required field `jsonPath`. `serialize()`: first mapping's sourcePath/expression → `{ jsonPath, pattern, patternName? }`. `deserialize()`: creates single mapping from `initialJsonPath`. `validate()`: checks no path selected, multiple mappings, empty path. Pattern/patternName stored via adapter options. | `adapters/assertionAdapter.ts` **New** | ✅ |
| 3B.2 | Created `RegexAssertionBuilderModal.tsx` — new component using DM tree (`buildJsonTree`, `SelectableTreeNode`) for click-to-select path picking + pattern library + live preview. Replaces old `RegexAssertionModal` with unified tree UX (search, expand/collapse, paste JSON, fetch sample). 30 unit tests. | `RegexAssertionBuilderModal.tsx` **New** | ✅ |
| 3B.3 | Wired into `TestEditorValidationTab.tsx` — replaced `RegexAssertionModal` import with `RegexAssertionBuilderModal` from data-mapper barrel. Updated `onApply`/`onClose` to `onSave`/`onCancel`. Added pattern validation to `assertionAdapter.validate()`. | `TestEditorValidationTab.tsx` | ✅ |
| 3B.4 | 30 unit tests: adapter creation (10), serialize (8), deserialize (4), round-trip (2), validate (6). Covers: JSON string parsing, invalid JSON, null input, expression vs sourcePath, pattern passthrough, patternName omission, empty/multiple mappings, whitespace path, getPattern callback, fallback. | `adapters/assertionAdapter.test.ts` **New** | ✅ |

**Success criteria:** Regex assertion builder uses the Data Mapper's `SourcePanel` for tree browsing. Pattern library and live preview unchanged. Same output shape (`RegexAssertionResult`). All existing regex assertion tests pass.

#### Sub-Phase 3C: ValidationAdapter (High Complexity)

Replace `JsonPathBuilder` (658 lines) with the Data Mapper for selective validation. Source = response body tree; Target = expected field values. Must support both include and exclude modes. This is the most complex adapter because `JsonPathBuilder` uses a checkbox interaction model that differs from the mapper's drag-and-drop model.

**Existing component being replaced:**
- `JsonPathBuilder.tsx` (~658 lines) — checkbox tree for field selection, include/exclude toggle, manual rule entry, table/list view toggle

**Parents:**
- `TestEditorValidationTab.tsx` (~551 lines) — selective validation mode
- `SetupStepValidate.tsx` — parameterized datasource wizard (include mode only)
- `DataSourceRowDetailModal.tsx` — row-level validation field picker (include mode only)

**Interaction model change:** `JsonPathBuilder` uses checkboxes (click to include/exclude). The Data Mapper uses drag-and-drop (drag source field to target to create mapping). For validation, the target is the expected value for each field. Users drag response fields they want to validate into the target panel, then fill in expected values.

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 3C.1 | Created `validationAdapter.ts` — `MapperAdapter<ValidationAdapterOutput>` where `ValidationAdapterOutput = { selectiveMode, expectedFields: ExpectedField[], excludedPaths: string[] }`. Source: single `'response-body'` from parsed sample. Target: `allowCustomFields: true` for validation fields. Uses `buildJsonTree`/`getAllLeafPaths` from unified tree model for leaf path computation. | `adapters/validationAdapter.ts` **New** | ✅ |
| 3C.2 | Include mode `serialize()` — each mapping → `ExpectedField` (sourcePath/expression → `jsonPath`, targetPath → `expectedValue`). `excludedPaths` stays empty. | Same file | ✅ |
| 3C.3 | Exclude mode `serialize()` — un-mapped source leaf paths become `excludedPaths`. Mapped paths → `expectedFields` with values. Uses `getLeafPaths()` helper with `buildJsonTree`/`getAllLeafPaths`. | Same file | ✅ |
| 3C.4 | `deserialize()` — include mode: reconstructs mappings from `expectedFields`. Exclude mode: inverts `excludedPaths` against full leaf set, uses existing `expectedValue` or falls back to sample data via `resolveValue()`. | Same file | ✅ |
| 3C.5 | Mode toggle — `selectiveMode` option on `createValidationAdapter()`. Parent recreates adapter with new mode; serialize/deserialize logic switches automatically. | Same file | ✅ |
| 3C.6 | Sample JSON management — `fetchSampleData` callback option, `supportsLiveFetch` flag. Paste JSON handled by Data Mapper's built-in source panel. | Same file | ✅ |
| 3C.7 | Wired into `TestEditorValidationTab.tsx` — added `DataMapperModal` + `createValidationAdapter` as "⚡ Visual Mapper" button alongside existing `JsonPathBuilder`. `handleValidationMapperSave` writes `selectiveMode`, `expectedFields`, `excludedPaths`. Both UIs coexist. | `TestEditorValidationTab.tsx` | ✅ |
| 3C.8 | Wired into `SetupStepValidate.tsx` — added `DataMapperModal` + `createValidationAdapter` (include mode only). "⚡ Visual Mapper" button alongside `JsonPathBuilder`. | `SetupStepValidate.tsx` | ✅ |
| 3C.9 | Wired into `DataSourceRowDetailModal.tsx` — added `DataMapperModal` + `createValidationAdapter` (include mode only). "⚡ Visual Mapper" button alongside `JsonPathBuilder`. | `DataSourceRowDetailModal.tsx` | ✅ |
| 3C.10 | 32 unit tests: adapter creation (11), include serialize (3), exclude serialize (3), include deserialize (4), exclude deserialize (4), round-trip (3), validate (5). Covers: JSON parsing, mode toggle, leaf path computation, sample value fallback, empty/null input, duplicate paths, empty paths. | `adapters/validationAdapter.test.ts` **New** | ✅ |
| 3C.11 | Integration tests in `TestEditorValidationTab.test.tsx` — mocked `DataMapperModal`, verified "⚡ Visual Mapper" button renders/opens, onSave writes expectedFields + excludedPaths + selectiveMode. `adapterIntegration.test.ts` covers cross-adapter round-trip. | `TestEditorValidationTab.test.tsx`, `adapterIntegration.test.ts` | ✅ |

**Success criteria:** `TestEditorValidationTab`, `SetupStepValidate`, and `DataSourceRowDetailModal` use the Data Mapper instead of `JsonPathBuilder`. Both include and exclude modes work. Sample JSON synced. All existing validation tests pass. Round-trip: open existing validation config → save → output is identical.

#### Sub-Phase 3D: Integration Wiring & Cross-Cutting

Final wiring to ensure all parent components correctly use the new adapters and all existing pipelines are preserved.

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 3D.1 | Verified host-override pipeline — all 3 adapters (`extraction`, `assertion`, `validation`) correctly delegate `fetchSampleData` to provided callback and set `supportsLiveFetch` flag. The existing `HttpConfig` → `ExtractionEditor` → `ExtractionPathPickerModal` pipeline threads `fetchHostEnabled`, `fetchHostOverride`, `resolvedBaseUrl` via `ExtractionFetchSampleProps.host`. Adapter API is compatible: parent creates adapter with `fetchSampleData` callback that wraps the same host-aware fetch. 5 integration tests verify delegation, absence, and updated-sample scenarios. | `adapters/adapterIntegration.test.ts` **New** | ✅ |
| 3D.2 | Verified variable hints — `variableHints` flow from `WorkflowNodeConfigModal` → `WorkflowConfigPanel` → `HttpConfig` → `ExtractionEditor` as a prop. They're consumed by `ExpressionInput` components (autocomplete), not by the adapter itself. When wiring (3A.4), parent will pass `variableHints` to Data Mapper component directly. 5 integration tests verify source IDs, context IDs, and category consistency across all adapters. | `adapters/adapterIntegration.test.ts` | ✅ |
| 3D.3 | Verified `PickerNode` status — still has 3 active consumers: `ExtractionMapperModal.tsx`, `ExtractionPathPickerModal.tsx`, `RegexAssertionModal.component.test.tsx`. Cannot be removed until wiring tasks (3A.4-3A.5, 3B.2-3B.3) replace those components. 1 integration test verifies export exists. | `adapters/adapterIntegration.test.ts` | ✅ |
| 3D.4 | Update barrel export (`index.ts`) — export new adapters: `createExtractionAdapter`, `createAssertionAdapter`, `createValidationAdapter`. | `index.ts` | ✅ |
| 3D.5 | Update `project-conventions.mdc` — add new adapter files to Key Files table. | `.cursor/rules/project-conventions.mdc` | ✅ |

#### Sub-Phase 3E: Deprecation

Mark old components as deprecated. Do NOT delete them yet — they serve as reference and may be needed for edge cases discovered during Phase 4+.

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 3E.1 | Added `@deprecated` JSDoc to `ExtractionPathPickerModal` — "Use `DataMapper` with `createExtractionAdapter` instead." | `ExtractionPathPickerModal.tsx` | ✅ |
| 3E.2 | Added `@deprecated` JSDoc to `ExtractionMapperModal` — "Use `DataMapperModal` with `createExtractionAdapter` instead." | `ExtractionMapperModal.tsx` | ✅ |
| 3E.3 | Added `@deprecated` JSDoc to `JsonPathBuilder` — "Use `DataMapperModal` with `createValidationAdapter` instead." | `JsonPathBuilder.tsx` | ✅ |
| 3E.4 | Added `@deprecated` JSDoc to `PickerNode` export — "Use the Data Mapper's `SourceTreeNode` / `TargetTreeNode` instead." Still exported; 3 active consumers remain until wiring. | `RegexAssertionModal.tsx` | ✅ |
| 3E.5 | Verified all imports of deprecated components are in expected locations only: `ExtractionEditor.tsx` (wiring target), `ExtractionMapperModal.test.tsx`, `ExtractionPathPickerModal.test.tsx`, `RegexAssertionModal.component.test.tsx`, plus type-only imports (`ExtractionFetchSampleProps`) in `HttpConfig.tsx`, `WorkflowConfigPanel.tsx`, `WorkflowNodeConfigModal.tsx`. No unexpected new consumers. | Grep search | ✅ |

#### Sub-Phase 3F: Hardening & Documentation

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 3F.1 | `tsc --noEmit` — zero errors. | — | ✅ |
| 3F.2 | Full data-mapper test suite — 608 tests pass across 24 files, zero failures. | — | ✅ |
| 3F.3 | Full project test suite — 12,435 tests pass across 481 files, zero regressions. | — | ✅ |
| 3F.4 | Coverage check — adapters 97%/92%/100%/100% (stmts/branch/fn/lines), hooks 92%/90%/86%/96%, utils 94%/85%/100%/98%. All above 90% on stmts/lines. | — | ✅ |
| 3F.5 | No files exceed 900-line threshold. Largest: DataMapper.tsx (367 lines). | — | ✅ |
| 3F.6 | Updated `data-mapper-plan.md` — all Phase 3 tasks marked ✅, added changelog entries. All wiring tasks completed. | This file | ✅ |
| 3F.7 | Updated `CHANGELOG.md` — Data Mapper section updated to "Phases 1–3" with Phase 3 adapter details and 608 test count. | `CHANGELOG.md` | ✅ |

**Dependency graph:**
```
3A (ExtractionAdapter) ──┐
                         ├── 3D (Integration Wiring) ── 3E (Deprecation) ── 3F (Hardening)
3B (AssertionAdapter) ───┤
                         │
3C (ValidationAdapter) ──┘
```

**Estimated total:** ~6–8 days  
**Parallelism:** 3A, 3B, and 3C can proceed independently. 3D depends on all three. 3E depends on 3D. 3F depends on 3E.
**Recommended order:** 3A → 3B → 3C → 3D → 3E → 3F (sequential, because lessons from 3A inform 3B/3C design).

### Phase 4: Adapters — Data Sources & Parameterized Tests

Replace the data source mapping UIs with Data Mapper adapters. These components deal with mapping API response fields to data source columns and mapping columns to request template placeholders.

**Existing components being replaced:**
- `PopulateFromApiModal.tsx` (~146 lines) + `usePopulateFromApi.ts` + `PopulateFetchStep` / `PopulateMapStep` + `populateFromApiUtils.ts`
- Column type/mapping UI in `DataSourceEditor.tsx` (~855 lines)
- Fetch config mapping in `SharedDataSourceModal.tsx` (~740 lines)

**Progress:** 4A ✅ Complete.

#### Sub-Phase 4A: PopulateFromApiAdapter

Replace the Populate from API wizard with a Data Mapper. Source = fetched API response JSON; Target = data source columns (name + type + mapping). Output: `{ columns: DataSourceColumn[], rows: DataSourceRow[], mode: 'append' | 'replace' }`.

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 4A.1 | Create `populateFromApiAdapter.ts` — `MapperAdapter<PopulateOutput>`. Source: single source `'api-response'` from fetched JSON (using the existing `onFetchRow` pipeline with auth-aware HTTP). Target: fields representing column definitions with `name`, `type` (path/param/body/header/validate), and `mapping` (JSONPath/URL segment). | `adapters/populateFromApiAdapter.ts` **New** | ✅ |
| 4A.2 | `serialize()` — convert `Mapping[]` → `{ columns: DataSourceColumn[], rows: DataSourceRow[] }`. Each mapping produces a column definition (`targetPath` → column name, `sourcePath` → mapping JSONPath). Row data extracted from sample values. Reuses existing `guessColType`, `findMatchingColumn`, `stringifyValue` from `populateFromApiUtils.ts`. | Same file | ✅ |
| 4A.3 | `deserialize()` — reconstruct mappings from existing `DataSourceColumn[]` that have `mapping` values (for re-editing an existing populate configuration). | Same file | ✅ |
| 4A.4 | `fetchSampleData()` — wraps the parent's `onFetchRow` callback. Builds the request from `draft: Scenario` using `buildHeaders` + `resolveScenarioFromDataRow`, fetches via auth-aware pipeline, detects arrays, auto-selects best array, stores full response internally for `serialize` to extract all rows. | Same file + wiring in `DataSourceEditor.tsx` / `SharedDataSourceModal.tsx` | ✅ |
| 4A.5 | Append/Replace mode — adapter exposes `mode` property ('append' \| 'replace'). Passed through in `PopulateOutput` to `onSave`. Parent merges rows accordingly. | Same file | ✅ |
| 4A.6 | Wire into `DataSourceEditor.tsx` — replaced `PopulateFromApiModal` with `<DataMapperModal<PopulateOutput>>` using the populate adapter. `handlePopulateApply` now accepts `PopulateOutput` directly. Adapter created via `useMemo` when modal opens. | `DataSourceEditor.tsx` | ✅ |
| 4A.7 | Wire into `SharedDataSourceModal.tsx` — replaced populate flow with the same adapter pattern. Uses `editorPanel.handleFetchRow` for auth-aware fetch. | `SharedDataSourceModal.tsx` | ✅ |
| 4A.8 | Unit tests — 52 tests covering adapter creation, serialize, deserialize, round-trip, validate, fetchSampleData (with mutable internal state), edge cases (root arrays, missing fields, null values, nested objects). | `adapters/populateFromApiAdapter.test.ts` **New** | ✅ |
| 4A.9 | Integration tests — 4 new tests in `adapterIntegration.test.ts`: context ID uniqueness (5 adapters), populate round-trip, populate validation, data-source category. Updated `DataSourceEditor.test.tsx` (113 pass) and `SharedDataSourceModal.test.tsx` (99 pass) with new mocks. | Multiple files | ✅ |

**Success criteria:** ✅ "Populate from API" uses the Data Mapper for field selection and column creation. Column type semantics (path/param/body/header/validate) preserved via `guessColType`. All 844 wired + mapper tests pass (632 mapper + 212 wired components). TypeScript 0 errors, ESLint 0 errors.

#### Sub-Phase 4B: ColumnMappingAdapter

Replace the column type/mapping inline UI in `DataSourceEditor` with a visual mapper. Source = data source column names; Target = request template placeholders (URL path segments, query params, body fields, headers, validation paths). This gives users a visual view of "which column feeds which part of the request."

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 4B.1 | Create `columnMappingAdapter.ts` — `MapperAdapter<DataSourceColumn[]>`. Source: column names from the data source. Target: request template fields parsed from the `Scenario` (URL path variables, query params, body `{{placeholders}}`, header values). `parseScenarioTemplate()` extracts all slots. Target paths use `type::name` format for disambiguation. | `adapters/columnMappingAdapter.ts` **New** | ✅ |
| 4B.2 | Request template parser — `parseScenarioTemplate()` extracts `{{var}}` tokens from URL path (→ path), query params (→ param), body (→ body), and header values (→ header). Handles URL-encoded braces, non-parseable URLs, whitespace in tokens. Deduplicates within same type. | Same file | ✅ |
| 4B.3 | `serialize()` — each mapping updates the corresponding `DataSourceColumn.type` and `DataSourceColumn.mapping` based on which target slot the column was dragged to. Unmapped columns pass through unchanged. `__custom__` validate target preserves existing mapping. | Same file | ✅ |
| 4B.4 | `deserialize()` — reconstruct mappings from existing column definitions where `type` and `mapping` are set. Builds `type::mapping` target paths. Skips columns with empty mapping. | Same file | ✅ |
| 4B.5 | Wire into `DataSourceEditor.tsx` — "🔗 Map Columns" button in `DataSourceToolbar` opens `DataMapperModal<ColumnMappingOutput>` with `initialData={dt.columns}`. Apply updates `dt.columns` in `draft`. Button disabled when no columns or linked to shared DS. | `DataSourceEditor.tsx`, `DataSourceToolbar.tsx` | ✅ |
| 4B.6 | Unit tests — 48 tests covering template parsing (12), adapter creation (8), serialize (8), deserialize (6), round-trip (3), validate (8). Plus 3 integration tests in `adapterIntegration.test.ts`. | `adapters/columnMappingAdapter.test.ts` **New** | ✅ |

**Success criteria:** ✅ Users can visually map data source columns to request template placeholders. Column `type` and `mapping` values are set correctly. Round-trip: open existing columns → save → `DataSourceColumn[]` is identical.

#### Sub-Phase 4C: SharedDsFetchAdapter

Replace the fetch config mapping UI in `SharedDataSourceModal` with a Data Mapper. Source = API response from the shared data source's `fetchConfig`; Target = column definitions for the shared data source.

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 4C.1 | Create `sharedDsFetchAdapter.ts` — `MapperAdapter<SharedDsFetchOutput>`. Source: `shared-ds-response` from `fetchConfig` URL. Target: column definitions. Distinct `contextId` (`shared-ds-fetch`), dynamic title built from `fetchConfig.method` + URL pathname. Reuses populate helper utilities (`detectArrays`, `resolvePath`, `guessColType`, `findMatchingColumn`, `stringifyValue`, `selectBestArray`, `getByPath`). | `adapters/sharedDsFetchAdapter.ts` **New** | ✅ |
| 4C.2 | `fetchSampleData()` — caller-provided callback delegates to `handleFetchRow` in `SharedDataSourceModal`. Adapter wraps callback, stores full response, detects arrays, auto-selects best array, returns first item as source sample. pathVariables substitution handled by caller via `resolveScenarioFromDataRow`. | Same file | ✅ |
| 4C.3 | `serialize()` / `deserialize()` — same pattern as `populateFromApiAdapter`. Creates/reuses columns, extracts rows from stored response at `selectedArrayPath`, resolves nested dotted paths via `getByPath`. Deserialize uses `sdf-N` prefix for stable mapping IDs. | Same file | ✅ |
| 4C.4 | Wire into `SharedDataSourceModal.tsx` — replaced `createPopulateFromApiAdapter` import with `createSharedDsFetchAdapter`. `SharedDsFetchOutput` replaces `PopulateOutput` for handler + `DataMapperModal` generic. `fetchConfig` passed to adapter for contextual title. All existing fetch flow preserved (scenario resolution, auth, unresolved token checks). | `SharedDataSourceModal.tsx` | ✅ |
| 4C.5 | Unit tests — 61 tests: adapter creation (19), serialize (15), deserialize (5), round-trip (2), validate (7), fetchSampleData (6), edge cases (7). Plus 5 integration tests in `adapterIntegration.test.ts` (sourceId, round-trip, category, fetchSampleData delegation, distinct contextId). | `adapters/sharedDsFetchAdapter.test.ts` **New** | ✅ |

**Success criteria:** ✅ Shared data source fetch mapping uses the Data Mapper via dedicated `shared-ds-fetch` adapter. `fetchConfig` pipeline (URL, auth, path variables) preserved. All existing shared DS tests pass (2188 scenario tests, 752 data-mapper tests, 0 failures).

#### Sub-Phase 4D: Deprecation & Hardening

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 4D.1 | Add `@deprecated` JSDoc to `PopulateFromApiModal` (already done in 4A), `PopulateFetchStep`, `PopulateMapStep`, `usePopulateFromApi`. All note replacement by `DataMapperModal` + `createPopulateFromApiAdapter` (4A) or `createSharedDsFetchAdapter` (4C). | 4 files | ✅ |
| 4D.2 | Verify no direct imports of deprecated components remain in production code. Only self-references (PopulateFromApiModal → sub-components) and test files remain. `PickerNode` still used by `ExtractionMapperModal`/`ExtractionPathPickerModal` (Phase 5 targets). | Grep search | ✅ |
| 4D.3 | `tsc --noEmit` — 0 errors. Full test suite — 12,655 tests pass, 0 failures across 485 files. | — | ✅ |
| 4D.4 | Coverage check — adapters: 97.57% stmts / 90.18% branches / 100% functions / 99.54% lines. All four metrics >90% for the adapters directory. | — | ✅ |
| 4D.5 | Updated `data-mapper-plan.md` (Phase 4 status, completed phases, metrics) + `CHANGELOG.md` (Phase 4 Data Source Adapters entry). | Docs | ✅ |

**Dependency graph:**
```
4A (PopulateFromApiAdapter) ──┐
                              ├── 4D (Deprecation & Hardening)
4B (ColumnMappingAdapter) ────┤
                              │
4C (SharedDsFetchAdapter) ────┘
```

**Estimated total:** ~4–5 days  
**Parallelism:** 4A, 4B, 4C can proceed independently. 4D depends on all three.
**Recommended order:** 4A → 4C → 4B → 4D (4A and 4C share logic; 4B is the most novel).

---

### Phase 5: Adapters — Workflow Variables & Webhooks

Replace the webhook/correlation payload extraction UIs with Data Mapper adapters. These currently use simple text-field JSON path inputs for extracting variables from webhook payloads.

**Existing components being replaced:**
- `CorrelationWaitConfig.tsx` (~413 lines) — `extractVariables: { name, jsonPath }[]` table
- `WebhookConfig.tsx` (~139 lines) — currently has **no `extractVariables` UI** (data honored by engine but not editable in UI)
- `extractPayloadVariables()` in `graphRunnerHelpers.ts` — runtime extraction function

**Progress:** ✅ 5A + 5B + 5C + 5D complete. Phase 5 fully complete.

#### Sub-Phase 5A: WebhookExtractionAdapter

Build a single adapter that handles both Webhook Trigger and Correlation Wait payload extraction. Source = webhook/correlation payload JSON (from `samplePayload` or live fetch); Target = workflow variable names. Output: `Array<{ name: string; jsonPath: string }>`.

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 5A.1 | Create `webhookExtractionAdapter.ts` — `MapperAdapter<WebhookExtractionOutput>`. Source: single source `'webhook-payload'` from `samplePayload` JSON string. Target: variable name list (each field = a variable to extract). | `adapters/webhookExtractionAdapter.ts` **New** | ✅ |
| 5A.2 | `serialize()` — convert `Mapping[]` → `Array<{ name, jsonPath }>`. `sourcePath` → `jsonPath`, `targetPath` → `name`. | Same file | ✅ |
| 5A.3 | `deserialize()` — convert existing `extractVariables` → `Mapping[]`. | Same file | ✅ |
| 5A.4 | Correlation source handling — `CorrelationWaitConfig` supports `correlationSource: 'body' | 'header' | 'query'`. For body source, the mapper handles JSONPath selection. For header/query, keep as inline fields (same approach as extraction adapter 3A.3). | Same file | ✅ |
| 5A.5 | Wire into `CorrelationWaitConfig.tsx` — add `<DataMapperModal>` "Visual Mapper" button alongside inline fields. Parse `samplePayload` as source sample. Thread `onChange` to update `data.extractVariables`. | `CorrelationWaitConfig.tsx` | ✅ |
| 5A.6 | Wire into `WebhookConfig.tsx` — **add** `extractVariables` editing UI (previously missing from config panel). Use the same adapter. Parse `samplePayload` as source sample. | `WebhookConfig.tsx` | ✅ |
| 5A.7 | Unit tests — adapter round-trip, path normalization, empty payload handling, validation. 32 tests. | `adapters/webhookExtractionAdapter.test.ts` **New** | ✅ |
| 5A.8 | Integration tests — context ID uniqueness (9 adapters), validation, round-trip, category check. | `adapterIntegration.test.ts` | ✅ |

**Success criteria:** Correlation Wait and Webhook Trigger use the Data Mapper for payload → variable extraction. `extractVariables` shape preserved. WebhookConfig now has editable extraction UI (new capability).

#### Sub-Phase 5B: VariableBindingAdapter (Complete)

Visual mapper for binding upstream node outputs to current node input variables. Source = available variables from upstream nodes (grouped by source node); Target = current node's input variable references (`{{var}}` in URL, headers, body).

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 5B.1 | Create `variableBindingAdapter.ts` — `MapperAdapter<VariableBinding[]>`. Source: multiple sources (one per upstream node), each containing that node's output variables. Target: current node's input template slots (`{{var}}` references in URL, headers, body). | `adapters/variableBindingAdapter.ts` **New** | ✅ |
| 5B.2 | Source builder — groups `WorkflowVariableHint[]` by producing node. Each upstream node becomes a source tab with hint refs as sample data. | Same file | ✅ |
| 5B.3 | Target builder — `collectTemplateSlots()` parses URL, headers, body, bodyForm for `{{var}}` refs. `extractTemplateRefs()` helper. Deduplicates per location. | Same file | ✅ |
| 5B.4 | `serialize()` / `deserialize()` — maps `Mapping[]` ↔ `VariableBinding[]` (`{ templateRef, boundTo }`). `findSourceForRef` for source resolution. | Same file | ✅ |
| 5B.5 | Wire into `HttpConfig.tsx` — "Visual Variables (N slots)" button above tabs. `DataMapperModal` with memoized `varBindingAdapter`. Shows only when template slots exist. | `HttpConfig.tsx` | ✅ |
| 5B.6 | Unit tests — 42 tests: `extractTemplateRefs`, `collectTemplateSlots`, adapter creation, serialize, deserialize, round-trip, validate. Integration tests in `adapterIntegration.test.ts`. | `adapters/variableBindingAdapter.test.ts` **New** | ✅ |

**Success criteria:** Users can visually see which upstream variables feed into which template slots. This is an additive feature — does not replace existing text-based variable input.

#### Sub-Phase 5C: Unify extractPayloadVariables

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 5C.1 | Audit `extractPayloadVariables` in `graphRunnerHelpers.ts` — verify it uses canonical `getByPath` from `src/shared/utils/jsonPath.ts`. If not, migrate. | `graphRunnerHelpers.ts` | ✅ |
| 5C.2 | Verify `extractVariables` in `graphRunnerTriggerHandlers.ts` uses the same canonical path engine. | `graphRunnerTriggerHandlers.ts` | ✅ |
| 5C.3 | Remove any remaining duplicate path resolution logic. Introduced `setByPath` in `jsonPath.ts`; refactored `CorrelationWaitConfig.tsx` manual path walks to use canonical `getByPath` / `setByPath`. | Various | ✅ |

#### Sub-Phase 5D: Hardening

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 5D.1 | `tsc --noEmit` + full test suite — zero errors, zero failures. 12,843 tests / 489 files. | — | ✅ |
| 5D.2 | Coverage check — webhook adapter 98.85% stmts / 91.83% branches; variable-binding 98.85% / 91.83%; jsonPath 100% / 94.82%. | — | ✅ |
| 5D.3 | Update `data-mapper-plan.md` + `CHANGELOG.md`. | Docs | ✅ |

**Dependency graph:**
```
5A (WebhookExtractionAdapter) ── 5C (Unify extractPayloadVariables) ── 5D (Hardening)
5B (VariableBindingAdapter) ─────────────────────────────────────────┘
```

**Completed:** 5A + 5B + 5C + 5D. Phase 5 fully complete.
**Next:** Phase 6 (Request Body Builder).

---

### Phase 6: Request Body Builder Mode

New capability: use the Data Mapper in "reverse" — instead of mapping source→target for extraction, map available variables/data into a request body structure. This enables visual request body construction.

**No existing component is being replaced.** This is an additive feature.

**Progress:** ✅ Phase 6 complete (6A–6D).

#### Sub-Phase 6A: RequestBodyAdapter Core

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 6A.1 | Create `requestBodyAdapter.ts` — `MapperAdapter<string>`. Source: multiple sources — available workflow variables (grouped by upstream node), built-in generators (`$uuid`, `$timestamp`, etc.), and environment variables. Target: JSON body template structure. Output: serialized JSON body string with `{{var}}` template references. | `adapters/requestBodyAdapter.ts` **New** | ✅ |
| 6A.2 | Target schema builder — if the user has an existing body template or OpenAPI request body schema, parse it into a target tree. Users drag variables from source to fill template slots. | Same file | ✅ |
| 6A.3 | `serialize()` — convert `Mapping[]` → JSON body string with `{{variableName}}` placeholders inserted at mapped positions. | Same file | ✅ |
| 6A.4 | `deserialize()` — parse existing body template for `{{var}}` references and reconstruct `Mapping[]` from them. | Same file | ✅ |
| 6A.5 | Unit tests — adapter round-trip, template parsing, variable reference detection. | `adapters/requestBodyAdapter.test.ts` **New** | ✅ |

#### Sub-Phase 6B: Bi-Directional Sync

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 6B.1 | Template → visual sync — when the user edits the raw body textarea, detect `{{var}}` references and update the visual mapping lines to reflect the current template state. | `utils/bodyTemplateSync.ts` **New** | ✅ |
| 6B.2 | Visual → template sync — when the user drags a variable onto a target field, update the raw body template string with the `{{var}}` placeholder at the correct position. | Same | ✅ |
| 6B.3 | Conflict resolution — handle cases where the user manually types `{{var}}` in the template that conflicts with a visual mapping (prefer the latest edit). | Same | ✅ |
| 6B.4 | Unit tests — sync in both directions, conflict resolution. | `utils/bodyTemplateSync.test.ts` **New** | ✅ |

#### Sub-Phase 6C: Body Type Support & Integration

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 6C.1 | JSON builder mode — structured JSON body construction with the mapper's tree view. | `BodyBuilderPanel.tsx` **New** | ✅ |
| 6C.2 | Form-data builder mode — key-value pair mapping for `multipart/form-data` bodies. Each form field is a target node. | Same | ✅ |
| 6C.3 | Raw template mode — plain text body with `{{var}}` template references (no tree structure). | Same | ✅ |
| 6C.4 | Wire into `HttpConfig.tsx` Body tab — add "Visual Builder" toggle alongside the existing raw textarea. Both views stay in sync via 6B. | `HttpConfig.tsx` | ✅ |
| 6C.5 | Unit + integration tests. | `BodyBuilderPanel.test.tsx`, `useBodyBuilderSync.test.ts` **New** | ✅ |

#### Sub-Phase 6D: Hardening

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 6D.1 | `tsc --noEmit` + full test suite — zero errors, zero failures. | — | ✅ |
| 6D.2 | Coverage check — new files >90% coverage. | — | ✅ |
| 6D.3 | Update `data-mapper-plan.md` + `CHANGELOG.md`. | Docs | ✅ |

**Dependency graph:**
```
6A (Core Adapter) → 6B (Bi-Directional Sync) → 6C (Body Types & Integration) → 6D (Hardening)
```

**Estimated total:** ~5–6 days  
**Recommended order:** Sequential — each sub-phase builds on the previous.

---

### Phase 7: Polish & UX Excellence

Refinements to the Data Mapper UX that apply across all adapters. These are independent improvements that can be tackled in any order.

**Progress:** ✅ Phase 7 complete (7A–7F all done).

#### Sub-Phase 7A: Mapping Profiles & Bulk Operations

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 7A.1 | **Mapping profiles** — save the current mapping configuration (all `Mapping[]` plus adapter context) as a named profile in localStorage/Tauri storage. | `utils/mappingProfiles.ts` **New** | ✅ |
| 7A.2 | Profile manager UI — list, load, rename, delete profiles from the `MapperToolbar`. "Save as Profile" and "Load Profile" buttons. | `MapperToolbar.tsx` | ✅ |
| 7A.3 | **Bulk select** — hold Shift or Ctrl and click multiple source fields to select a group, then drag the group to an array target field. All selected fields create mappings simultaneously. | `SourcePanel.tsx`, `SourceTreeNode.tsx`, `DataMapper.tsx` | ✅ |
| 7A.4 | **Multi-select delete** — select multiple mappings (Shift+click connection lines), press Delete to remove all at once. | `MappingCanvas.tsx`, `DataMapper.tsx`, `useMapperState.ts`, `types.ts` | ✅ |
| 7A.5 | Unit tests — profile CRUD (13 tests), bulk select state, multi-delete (4 tests), integration (4 tests). 21 new tests total. | `mappingProfiles.test.ts`, `useMapperState.test.ts`, `DataMapper.test.tsx` | ✅ |

#### Sub-Phase 7B: Array Handling & Type Coercion

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 7B.1 | **Array-to-array indicator** — when source and target are both arrays, show a dashed loop line (`∞ for each`) on the connection. Aggregate lines show `Σ` badges. Spread lines show `⤑`. Each kind has distinct stroke dash + color. | `MappingCanvas.tsx`, `useConnectionLines.ts` | ✅ |
| 7B.2 | **Array mapping utility** — `classifyArrayMapping()` detects loop/aggregate/spread/direct kinds from sample data. `detectArrayMappings()` batch API. `isArrayWildcardPath()` detects `[*]`/`[]` patterns. `generateForEachExpression()` produces `$map(...)` expressions. Smart aggregate suggestions: `$sum` for number elements→number target, `$join` for string elements→string, `$count` for object elements→number. | `utils/arrayMapping.ts` **New** | ✅ |
| 7B.3 | **Array suggestion bar** — when a non-direct array mapping is selected, a contextual bar appears below the canvas showing the mapping kind description and a one-click "Apply" button for the suggested expression (e.g., `$join`, `$sum`, `$count`). | `DataMapper.tsx`, CSS | ✅ |
| 7B.4 | **Enhanced type coercion** — extended `FIX_MAP` with `array→string` (`$join`), `string→array` (`$split`), `array→number` (`$count`), `array→boolean` (`$toBool($count(…))`). Added `looksLikeDate()` detector for ISO 8601, MM/DD/YYYY, YYYY/MM/DD, RFC 2822 formats. Date-like strings now produce `$dateFormat(…)` suggestions. | `utils/typeMismatch.ts` | ✅ |
| 7B.5 | **Unit tests** — 22 tests in `arrayMapping.test.ts` (classify all 4 kinds, aggregate element-type logic, wildcard detection, forEach generation, missing/string sampleData edge cases). 10 tests added to `typeMismatch.test.ts` (array→scalar coercion, `looksLikeDate`, date format detection). 1 integration test in `DataMapper.test.tsx`. **Total: 32 new tests.** | Test files | ✅ |

#### Sub-Phase 7C: Keyboard Navigation & Code View

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 7C.1 | **Full keyboard navigation** — `useKeyboardNavigation` hook: Tab/Shift+Tab cycles source→canvas→target panels, Arrow Up/Down moves focus between visible tree nodes, Arrow Right expands collapsed nodes, Arrow Left collapses expanded nodes, Home/End jump to first/last node. Disabled when expression editor is open. | `hooks/useKeyboardNavigation.ts` **New**, `DataMapper.tsx` | ✅ |
| 7C.2 | **Focus management** — `.dm-panel--focused` outline ring on active panel, `.dm-tree-node--focused` highlight on keyboard-focused node, `tabIndex` management for tree containers, `role="tree"` ARIA semantics. `focusedPath` prop threaded through `SourcePanel→SourceTreeNode` and `TargetPanel→TargetTreeNode`. | CSS, `SourcePanel.tsx`, `TargetPanel.tsx`, `SourceTreeNode.tsx`, `TargetTreeNode.tsx` | ✅ |
| 7C.3 | **Code view toggle** — `CodeView` component shows read-only code representation of all mappings sorted by target path. Format: `target.field ← source.field` or `target.field ← $fn(source.field)`. Line numbers, mapping count, real-time updates. `<> Code` button in toolbar toggles visibility. | `CodeView.tsx` **New**, `MapperToolbar.tsx` | ✅ |
| 7C.4 | **Unit tests** — 7 tests for `useKeyboardNavigation` (init, region switching, ArrowDown/Up navigation, Home/End, ArrowRight expand, disabled mode). 7 tests for `CodeView` (empty state, mapping lines, expression notation, sort by target, count, line numbers). **Total: 14 new tests.** | Test files | ✅ |

#### Sub-Phase 7D: Monaco Editor Upgrade (Optional)

Upgrade the expression editor from `<textarea>` to Monaco for richer editing. Deferred from Phase 2B — only implement if the textarea proves insufficient for user needs.

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 7D.1 | `@monaco-editor/react` already installed (^4.7.0). Verified import works. | `package.json` | ✅ |
| 7D.2 | Replaced `<textarea>` with lazy-loaded Monaco in `ExpressionEditorModal.tsx` — `plaintext` language mode, `vs-dark` theme, Suspense fallback textarea for loading. | `ExpressionEditorModal.tsx` | ✅ |
| 7D.3 | `$fn()` autocomplete — registered completion items from expression registry with snippet insertText, category/return-type detail, and signature documentation. Triggered by `$` prefix. | `ExpressionEditorModal.tsx` | ✅ |
| 7D.4 | Source path autocomplete — registered completions from `getAllLeafPaths(sourceTree)` prefixed with `$.`. Triggered by `$.` prefix. Source paths update reactively via ref. | `ExpressionEditorModal.tsx` | ✅ |
| 7D.5 | Unit tests — 8 new Monaco-specific tests (editor mock, value changes, hint text, Ctrl/Cmd+Enter, string/null sampleData). Total: 32 tests passing. | `ExpressionEditorModal.test.tsx` | ✅ |

#### Sub-Phase 7E: Gallery Samples & Accessibility

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 7E.1 | **Gallery samples** — 6 mapper-specific presets: direct field mapping, expression transformation, array mapping, multi-source combine, type conversion, conditional mapping. 11 unit tests. | `utils/gallerySamples.ts` | ✅ |
| 7E.2 | **WCAG AA compliance** — added `aria-labelledby` on dialogs, `aria-label` on all icon buttons (replaced `title`), `aria-expanded` on tree toggles, `aria-pressed` on paste toggle, `role="tab"` + `aria-selected` on source tabs, `aria-invalid` on paste textarea, `role="alert"` on error messages, `role="separator"` on resize handles, `aria-hidden` on SVG canvas. | All mapper components | ✅ |
| 7E.3 | **Screen reader support** — `aria-live="polite"` on preview bar output, error lists, validation bar, expression preview, array suggestion bar. `aria-label` on search inputs, clear buttons, expand/collapse. Mismatch badge converted from `<span>` to `<button>` with descriptive label when actionable. | All mapper components | ✅ |
| 7E.4 | **High contrast mode** — 26 CSS custom properties (`--dm-accent`, `--dm-success`, `--dm-warning`, `--dm-error`, `--dm-info`, `--dm-expression`, 6 type colors, mapped/selected/focus backgrounds, connection line colors). Type badges, mismatch badges, focus rings, connection lines, and selected nodes all reference tokens. | `data-mapper.css` | ✅ |
| 7E.5 | **Training manual update** — added 5 new sections to basics manual: Mapping Profiles, Bulk Operations, Keyboard Shortcuts, Code View, Expression Editor (Monaco). | `data-mapper-basics-easy.html` | ✅ |

#### Sub-Phase 7F: Hardening

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 7F.1 | `tsc --noEmit` + full test suite — zero errors, zero failures. 13,116 tests pass. | — | ✅ |
| 7F.2 | Coverage check — mapper dir 91.35% lines, all key files >90%. Added 25 new tests (MapperToolbar profiles, keyboard nav, code view). | Tests | ✅ |
| 7F.3 | No files exceed 900-line threshold. Split `DataMapper.test.tsx` (921→610+327). | Tests | ✅ |
| 7F.4 | Update `data-mapper-plan.md` + `CHANGELOG.md` + `README.md`. | Docs | ✅ |

**Dependency graph:**
```
7A (Profiles & Bulk) ────┐
7B (Arrays & Coercion) ──┤
7C (Keyboard & Code) ────┼── 7F (Hardening)
7D (Monaco — optional) ──┤
7E (Gallery & A11y) ─────┘
```

**Estimated total:** ~6–8 days (excluding 7D Monaco which is optional +2 days)  
**Parallelism:** 7A, 7B, 7C, 7D, 7E are fully independent.

---

### Phase 8: Schema Drift Detection & Contract Validation

Differentiator: Most mapper tools are design-time only. This phase makes our Data Mapper **runtime-aware** — it detects when APIs change their response shape and alerts users before tests break silently.

**Progress:** ✅ Complete. 8A–8E all done.

#### Sub-Phase 8A: Schema Snapshot Engine

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 8A.1 | **Schema snapshot type** — `SchemaSnapshot`: captures field names, types (inferred from sample values using `inferType` from `typeMismatch.ts`), nesting depth, array indicators. Stored alongside mapping configuration. | `utils/schemaSnapshot.ts` **New** | ✅ |
| 8A.2 | **Capture on save** — when `DataMapperModal` "Done" is clicked, compute and persist a `SchemaSnapshot` for both source and target schemas. Store in localStorage/Tauri FS keyed by adapter `contextId`. | `DataMapperModal.tsx`, `utils/schemaSnapshot.ts` | ✅ |
| 8A.3 | **Snapshot comparison** — `diffSchemas(saved: SchemaSnapshot, current: SchemaSnapshot)` returns a list of `SchemaDrift` entries with `path`, `driftType` (added/removed/typeChanged/nullableChanged), and affected mapping IDs. | `utils/schemaDrift.ts` **New** | ✅ |
| 8A.4 | Unit tests — snapshot capture, diff computation for various drift scenarios. | `utils/schemaSnapshot.test.ts`, `utils/schemaDrift.test.ts` **New** | ✅ |

#### Sub-Phase 8B: Drift Severity & Notification

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 8B.1 | **Drift severity classification** — `classifyDrift(drift: SchemaDrift[]): ClassifiedDrift[]`. **Info**: new fields added (additive, no action). **Warning**: field type changed (mapping may still work). **Breaking**: mapped field removed or renamed (mapping will fail at runtime). | `utils/schemaDrift.ts` | ✅ |
| 8B.2 | **Drift notification banner** — when `DataMapperModal` opens and a saved snapshot exists, auto-compare against current source data. If drift detected, show a dismissible banner with "Accept & Update" and dismiss buttons. Breaking drifts shown with red style and item list. | `DriftBanner.tsx`, `DataMapperModal.tsx` | ✅ |
| 8B.3 | **"Accept & Update"** — user acknowledges the drift, snapshot is updated to current schema, banner is cleared. | `DataMapperModal.tsx` | ✅ |
| 8B.4 | Unit tests — severity classification (9 tests), banner rendering (10 tests), classified summary (3 tests). 22 new tests, 13,412 total. | `schemaDrift.test.ts`, `DriftBanner.test.tsx` | ✅ |

#### Sub-Phase 8C: Visual Drift Overlay

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 8C.1 | **Source tree drift indicators** — green dot (info/added), amber ⚠ (warning/type-changed), red ✕ with strikethrough (breaking/removed). `driftMap` prop flows from modal → DataMapper → SourcePanel → SourceTreeNode. Breaking nodes are non-draggable. | `SourceTreeNode.tsx`, `SourcePanel.tsx`, `DataMapper.tsx` | ✅ |
| 8C.2 | **Affected mapping lines** — `driftSeverity` on `ConnectionLine` type. Breaking: red dashed with ✕ badge. Warning: amber dashed with ⚠ badge. `driftMappingIds` computed from classified drifts, merged into lines via `useMemo`. | `MappingCanvas.tsx`, `useConnectionLines.ts`, `DataMapper.tsx` | ✅ |
| 8C.3 | **Schema diff modal** — `SchemaDiffModal` component with tabular diff view: severity, path, change type, saved/current types, affected count. Sorted breaking-first. "Show Diff" button on `DriftBanner`. z-index 1100 above mapper modal. | `SchemaDiffModal.tsx` **New**, `DriftBanner.tsx`, `DataMapperModal.tsx` | ✅ |
| 8C.4 | Unit tests — 7 SourceTreeNode drift tests, 5 MappingCanvas drift line tests, 11 SchemaDiffModal tests. 23 new tests, 13,444 total. | `SourceTreeNode.test.tsx`, `MappingCanvas.test.tsx`, `SchemaDiffModal.test.tsx` | ✅ |

#### Sub-Phase 8D: Auto-Repair & Contract Mode

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 8D.1 | **Auto-repair suggestions** — for broken mappings (source field removed), suggest: (a) similar field names (by Levenshtein edit distance), (b) renamed field candidates (same type, same parent, different name). Sorted by confidence, max 5 per mapping. | `utils/schemaRepair.ts` **New** | ✅ |
| 8D.2 | **Apply repair** — `applyRepair()` creates a new Mapping with updated `sourcePath`. UI integration (dropdown on broken lines) deferred to Pre-Phase 9 prework (Pre-9.1). | `utils/schemaRepair.ts` | ✅ |
| 8D.3 | **Mapping health dashboard** — deferred to Phase 9 (requires trace/results infrastructure). | — | 🔜 |
| 8D.4 | **Contract mode ("Lock Schema")** — strict (any change fails) and lenient (additions OK) modes. `validateContract()` produces `ContractViolation[]`, convertible to `FailureDetail[]` via `contractViolationsToFailures()`. Config persistence via `loadContractConfig`/`saveContractConfig`. | `utils/schemaContract.ts` **New** | ✅ |
| 8D.5 | Unit tests — 18 repair tests (levenshtein, suggestRepairs, generateRepairResults, applyRepair), 15 contract tests (validateContract strict/lenient, violations, storage). **33 new tests.** | `schemaRepair.test.ts`, `schemaContract.test.ts` **New** | ✅ |

#### Sub-Phase 8E: Hardening

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 8E.1 | `tsc --noEmit` + full test suite — zero errors, zero failures. 13,490 tests pass across 510 files. | — | ✅ |
| 8E.2 | Coverage check — all Phase 8 files >90% stmts/lines/funcs. schemaContract 100%/88%/100%/100%, schemaRepair 96%/81%/100%/100%, schemaSnapshot 98%/98%/100%/100%, DriftBanner 100%/92%/100%/100%, SchemaDiffModal 100%/87%/100%/100%. | — | ✅ |
| 8E.3 | Update docs — plan, changelog. Pre-8E audit fixes documented. | Docs | ✅ |

**Dependency graph:**
```
8A (Snapshot Engine) → 8B (Severity & Notification) → 8C (Visual Overlay) → 8D (Auto-Repair & Contract) → 8E (Hardening)
```

**Estimated total:** ~6–7 days  
**Recommended order:** Sequential — each sub-phase builds on the previous.

---

### Pre-Phase 9 Prework: Gap Closure

Before Phase 9, close outstanding gaps from Phases 1–8 that were deferred or discovered during the pre-9A audit.

**Progress:** ✅ Complete.

#### Sub-Phase Pre-9.1: Repair UI (8D.2 deferred wiring)

The repair engine (`suggestRepairs`, `generateRepairResults`, `applyRepair`) was built in Phase 8D but never wired into the UI. This sub-phase adds the missing interactive repair surface.

| # | Task | File(s) | Status |
|---|------|---------|--------|
| P9.1.1 | **Repair action column in SchemaDiffModal** — for breaking drifts with affected mappings, add a "Repair" column showing the top suggestion (or "No suggestions" if none). Click opens a dropdown with all suggestions, confidence scores, and "Apply" button. | `SchemaDiffModal.tsx` | ✅ |
| P9.1.2 | **`onRepairMapping` callback** — new props `repairSuggestions` and `onApplyRepair` on `SchemaDiffModal`. `DataMapperModal` computes suggestions via `suggestRepairs`, calls `applyRepair` and updates mappings + drift entries on apply. | `SchemaDiffModal.tsx`, `DataMapperModal.tsx` | ✅ |
| P9.1.3 | **Repair badge on broken connection lines** — deferred; repair is accessible from SchemaDiffModal dropdown (lower complexity, same functionality). Canvas badge can be added in Phase 9 if needed. | `MappingCanvas.tsx` | 🔜 |
| P9.1.4 | **CSS** — repair dropdown styling (`.dm-repair-*`), suggestion cards with confidence color coding (high/medium/low), wrench button, apply button. | `data-mapper-modal.css` | ✅ |
| P9.1.5 | **Unit tests** — 7 new tests: SchemaDiffModal repair column rendering, dropdown toggle, Apply callback, "No suggestions", confidence color coding, no-repair column when not provided. | `SchemaDiffModal.test.tsx` | ✅ |

#### Sub-Phase Pre-9.2: Assertion Adapter Resolution

The `createAssertionAdapter` exists and is tested but `RegexAssertionBuilderModal` doesn't use it — it builds its own tree UI. Two parallel assertion surfaces risk drift. This sub-phase resolves the gap.

| # | Task | File(s) | Status |
|---|------|---------|--------|
| P9.2.1 | **Document `assertionAdapter` as API-only** — added JSDoc explaining production UI is `RegexAssertionBuilderModal`, adapter retained for testing and future use. | `adapters/assertionAdapter.ts` | ✅ |
| P9.2.2 | **Remove from production barrel** — `createAssertionAdapter` removed from `index.ts` barrel (only types remain). Tests import directly from adapter file. | `index.ts` | ✅ |
| P9.2.3 | **Update plan & docs** — clarified in this plan and changelog. | `data-mapper-plan.md` | ✅ |

#### Sub-Phase Pre-9.3: Plan Hygiene & Stale Fixes

| # | Task | File(s) | Status |
|---|------|---------|--------|
| P9.3.1 | **Fix 1E.4 deferral inconsistency** — aligned to "Phase 9+" in both 1E.4 row and Deferred Items table. | `data-mapper-plan.md` | ✅ |
| P9.3.2 | **Fix 2B success criteria** — updated to reflect Monaco (Phase 7D upgrade). | `data-mapper-plan.md` | ✅ |
| P9.3.3 | **Fix overall success criteria checkbox** — checked "DataMapper in 8+ contexts" (9 production surfaces). | `data-mapper-plan.md` | ✅ |
| P9.3.4 | **Fix 8D.2 deferral wording** — updated to reference Pre-9.1. | `data-mapper-plan.md` | ✅ |
| P9.3.5 | **Scope 8D.3 into Phase 9** — health dashboard already referenced in 8D.3; Phase 9 tasks cover the trace/debug infrastructure needed. | `data-mapper-plan.md` | ✅ |
| P9.3.6 | **Update File Structure section** — added `schemaRepair.ts` and `schemaContract.ts` to utils listing. | `data-mapper-plan.md` | ✅ |

**Dependency graph:**
```
Pre-9.1 (Repair UI) ──┐
Pre-9.2 (Assertion) ──┼── Pre-9.3 (Plan Hygiene) → Phase 9
```

**Estimated total:** ~2 days

---

### Phase 9: Mapping Debugger & Data Flow Trace

Differentiator: Inspired by Altova MapForce's interactive debugger. No other API testing tool offers step-through mapping debugging.

**Progress:** ✅ Complete. 9A–9E all done.

#### Sub-Phase 9A: Mapping Execution Trace

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 9A.1 | **`MappingTrace` type** — per-mapping trace record: `{ mappingId, sourcePath, sourceValue, expression?, evaluatedValue, targetPath, targetValue, timestamp, durationMs, error? }`. Plus `MappingTraceSummary`, `formatTraceValue`, `isTraceError`. | `utils/mappingTrace.ts` **New** | ✅ |
| 9A.2 | **Trace capture in execution** — `captureMappingTraces()` evaluates mappings against source data. Integrated into `graphRunnerHttpHandler.ts` for HTTP node extraction mappings. Gated by `shouldCaptureMappingTraces()`. | `utils/mappingTrace.ts`, `graphRunnerHttpHandler.ts` | ✅ |
| 9A.3 | **Trace storage** — `ExecutionEventDetails.mappingTraces` and `CapturedHttpNodeDetails.mappingTraces` added. `graphRunner.ts` propagates traces at full/debug level alongside request/response bodies. | `shared/types/index.ts`, `graphRunnerNodeHandlerContext.ts`, `graphRunner.ts` | ✅ |
| 9A.4 | Unit tests — 40 tests covering trace capture (direct, nested, expression, error, multi-mapping, missing source, JSON string source, custom functions), summarization, formatTraceValue, isTraceError, trace level gating. | `utils/mappingTrace.test.ts` **New** | ✅ |

#### Sub-Phase 9B: Data Flow Overlay

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 9B.1 | **Debug view toggle** — "Debug" button in `MapperToolbar` that activates data flow overlay mode. Only available when trace data is loaded. Shows error count badge. | `MapperToolbar.tsx` | ✅ |
| 9B.2 | **Value badges on lines** — in debug mode, each connection line shows the actual runtime value that flowed through it as a small badge (truncated to ~16 chars). Hover for full value. Color-coded: green for successful, red for error. Lines themselves colored green/red with dashed red for errors. | `MappingCanvas.tsx` | ✅ |
| 9B.3 | **Source/target value overlay** — source tree nodes show actual values from the trace (not sample data) in debug mode. Target tree nodes show the actual written values with `=` prefix. `TraceValueOverlay` type defined. | `SourceTreeNode.tsx`, `TargetTreeNode.tsx` | ✅ |
| 9B.4 | Unit tests — 25 new tests: toolbar debug toggle (7), canvas trace badges (7), source tree trace overlay (6), target tree trace overlay (5). | Test files | ✅ |

#### Sub-Phase 9C: Step-Through & Failure Pinpointing

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 9C.1 | **Step-through mode** — "Step Debug" button in expression editor opens step-through panel. Each intermediate evaluation step is shown: `$.price` → `29.99` → `$upper($.name)` → `WIDGET`. Path resolutions, nested function evaluations, and final result displayed with ◀/▶ navigation + click-to-select. | `ExpressionEditorModal.tsx`, `expressionStepDebugger.ts` **New** | ✅ |
| 9C.2 | **Failure pinpointing** — in debug mode, failed mapping lines show inline "⚠ Click for details" label in red below the connection line. Non-error lines remain clean. Lines get `dm-connection-line--trace-error` class for red dashed styling. | `MappingCanvas.tsx` | ✅ |
| 9C.3 | **Error detail popover** — click a failed mapping line to see: source path, target path, expression (if any), source value, target value, error message. Floating popover rendered in DataMapper (not inside overflow-hidden canvas wrapper), with close button, outside-click dismiss, Escape key dismiss. Auto-dismissed when debugMode is toggled off or traceData removed. | `DataMapper.tsx` (popover rendering + lifecycle), `MappingCanvas.tsx` (callback `onShowErrorDetail`) | ✅ |
| 9C.4 | Unit tests — step-through evaluator (13 incl string-awareness regression), expression editor debugger UI (8), failure pinpointing + callback (6), error popover lifecycle (3). | `expressionStepDebugger.test.ts`, `ExpressionEditorModal.test.tsx`, `MappingCanvas.test.tsx`, `DataMapper.test.tsx` | ✅ |

##### Pre-9D Audit Findings & Fixes

| # | Severity | Issue | Fix |
|---|----------|-------|-----|
| H1 | HIGH | `extractPathRefs` picked up `$.path` inside string literals (phantom debugger steps) | Rewritten with string-aware scanning (`skipQuoted`, `skipBraces`) |
| H2 | HIGH | `extractFunctionCalls` parenthesis balancing ignored quotes — `$concat("(hello)", $.name)` misdetected | Rewritten with quote-aware char-by-char scanning |
| H3 | HIGH | Error popover clipped by `overflow: hidden` on `.dm-canvas-wrapper` (120px wide, popover 240px min) | Moved popover rendering from MappingCanvas to DataMapper (outside canvas wrapper). MappingCanvas now exposes `onShowErrorDetail` callback |
| M1 | MEDIUM | Error popover not dismissed when `debugMode` toggled off | Added `useEffect` in DataMapper to clear popover on `!debugMode` + `!hasTraceData` |
| M2 | MEDIUM | Toggling debugger on with empty expression showed active toggle but no panel | `handleToggleDebugger` now returns `false` (no toggle) when expression is empty |
| M3 | MEDIUM | Debug bar showed raw `traceData.length` instead of filtered count | Changed to `traceByMappingId.size` |
| M4 | MEDIUM | `.dm-expr-preview-label` lacked flex layout for label + button alignment | Added `display: flex; align-items: center; gap: 8px;` |
| M5 | MEDIUM | Truncated step values (60 char) had no tooltip | Added `title={step.displayValue}` on `<code>` element |

#### Sub-Phase 9D: Historical Comparison & Results Integration

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 9D.1 | **Historical comparison** — `traceComparison.ts` engine classifies each mapping as unchanged/changed/regression/fixed/added/removed. `MappingCompare.tsx` renders summary badges + filterable side-by-side comparison table with custom run labels, truncated values with tooltips, status icons, and regression highlighting. | `traceComparison.ts` **New**, `MappingCompare.tsx` **New** | ✅ |
| 9D.2 | **"Open in Mapper" from Results Explorer** — Variables tab shows "Mapping Traces" section when `event.details.mappingTraces` exists. "Open in Mapper" button triggers `onOpenMapper(traces, nodeLabel)` callback. Tab enabled when only mapping traces exist (no extracted/snapshot variables needed). Error styling for failed traces. `fx` badge for expression mappings. | `ResultsExplorerDetailPanel.tsx` | ✅ |
| 9D.3 | **Trace export/import** — `traceExportImport.ts` provides `exportMappingTraces` (versioned envelope with metadata), `importMappingTraces` (validation + reconstruction), `extractAllMappingTraces` (flat extraction from `WorkflowExecutionTrace` with iteration/node context). Round-trip verified. Mapping traces already ride inside `saveJsonFile(currentTrace)` via `ExecutionEventDetails.mappingTraces`. | `traceExportImport.ts` **New** | ✅ |
| 9D.4 | Unit tests — comparison engine (16), MappingCompare UI (14 incl empty state + isTraceError regressions), trace export/import round-trip (16), Results Explorer mapping traces (5). **51 new tests.** | `traceComparison.test.ts`, `MappingCompare.test.tsx`, `traceExportImport.test.ts`, `ResultsExplorerDetailPanel.test.tsx` | ✅ |

##### Pre-9E Audit Findings & Fixes

| # | Severity | Issue | Fix |
|---|----------|-------|-----|
| H1 | HIGH | Error popover `top` positioning wrong — `.dm-container` lacks `position: relative`, causing popover's containing block to be an ancestor | Added `position: relative` to `.dm-container` CSS rule |
| M1 | MEDIUM | MappingCompare error cell styling used `entry.error` instead of `isTraceError` — traces with `targetValue: undefined` but no error string were not styled as errors | Changed to use `isTraceError(entry.baseline)` / `isTraceError(entry.current)` |
| M2 | MEDIUM | MappingCompare empty state misleading — showed "No mappings match the current filter" when both arrays are empty | Added distinct message: "No mapping traces to compare." when `summary.total === 0` |
| M3 | MEDIUM | Missing CSS rules for `dm-compare-row--unchanged` and `dm-compare-row--added` | Added `.dm-compare-row--added` rule with blue tint |
| M4 | MEDIUM | `summarizeMappingTraces` / `isTraceError` misalignment — summary only counted `trace.error != null` as failed, but `isTraceError` also treats `targetValue === undefined` | Aligned `summarizeMappingTraces` to use `isTraceError()` predicate |

#### Sub-Phase 9E: Hardening

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 9E.1 | `tsc --noEmit` + full test suite — zero errors, zero failures. 515 files, 13,713 tests pass. | — | ✅ |
| 9E.2 | Coverage check — overall 97.62%/93.39%/98.05%/98.48%. All utils/adapters >90%. UI components at 81–96% (DOM/browser-API-dependent gaps). | — | ✅ |
| 9E.3 | Update docs — plan, changelog, README. | Docs | ✅ |

**Dependency graph:**
```
9A (Execution Trace) → 9B (Data Flow Overlay) → 9C (Step-Through & Failure) → 9D (Historical & Results) → 9E (Hardening)
```

**Estimated total:** ~7–8 days  
**Recommended order:** Sequential — each sub-phase requires the trace infrastructure from the previous.

---

### Phase 10: AI-Assisted Mapping

Differentiator: Leading-edge feature. Only enterprise iPaaS tools (Flatfile, Boomi) currently offer AI mapping. No API testing tool has this.

**Progress:** ⬜ Not started.

#### Sub-Phase 10A: Smart Auto-Map & Semantic Matching

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 10A.1 | **Value-based type inference** — upgrade auto-map to analyze sample data values, not just field names. Detect that `phone_number` contains phone-formatted strings (`+1-555-...`) and should map to `contactPhone`. Use regex pattern libraries for common data types (email, phone, URL, date, UUID, currency). | `utils/smartAutoMap.ts` **New** | ⬜ |
| 10A.2 | **Synonym dictionary** — built-in mapping of conceptually similar field names across naming conventions: `MSRP`↔`price`, `qty`↔`quantity`, `fname`↔`firstName`, `dob`↔`dateOfBirth`, `amt`↔`amount`, `desc`↔`description`, `addr`↔`address`, `tel`↔`phone`, `img`↔`image`, `num`↔`number`. Extensible via localStorage. | `utils/synonymDictionary.ts` **New** | ⬜ |
| 10A.3 | **Semantic name matching** — extend `autoMapAlgorithm.ts` with a 4th matching tier (after exact, case-insensitive, suffix): synonym lookup. Score: exact=100, case=90, suffix=75, synonym=60. | `utils/autoMapAlgorithm.ts` | ⬜ |
| 10A.4 | Unit tests — value-based inference, synonym matching, scoring accuracy. | Test files | ⬜ |

#### Sub-Phase 10B: Confidence Scores & Pattern Learning

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 10B.1 | **Confidence scores** — show confidence percentage on each auto-map suggestion badge: 95% for exact match, 80% for case-normalized, 70% for suffix, 60% for semantic. Color-coded: green (>80%), amber (50–80%), red (<50%). | `MappingCanvas.tsx`, `MapperToolbar.tsx` | ⬜ |
| 10B.2 | **Confidence threshold** — toolbar setting to filter auto-map suggestions by minimum confidence (default: 50%). Below threshold → not suggested. | `MapperToolbar.tsx` | ⬜ |
| 10B.3 | **Pattern learning** — remember user mapping decisions per source/target schema pair. Store in localStorage keyed by `contextId + sourceSchemaHash + targetSchemaHash`. Next time the same pair appears, suggest previously used mappings with "Previously mapped" badge. | `utils/mappingPatterns.ts` **New** | ⬜ |
| 10B.4 | **"Previously mapped" badge** — visual indicator on connection lines that were restored from pattern history. Different color from auto-map (blue vs cyan). | `MappingCanvas.tsx` | ⬜ |
| 10B.5 | Unit tests — confidence scoring, threshold filtering, pattern storage/retrieval, schema hashing. | Test files | ⬜ |

#### Sub-Phase 10C: Expression Suggestions & Example-Based Mapping

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 10C.1 | **Expression suggestions** — when a user maps incompatible types (e.g., string date → timestamp), auto-suggest the appropriate transformation: "Apply `$dateFormat(source, 'ISO8601')`?" Show as a suggestion chip on the connection line (similar to quick-fix but triggered on mapping creation, not just mismatch detection). | `utils/expressionSuggestions.ts` **New** | ⬜ |
| 10C.2 | **Common transformation library** — pre-built expression templates for common transformations: date format conversion, string→number, boolean→string, array join/split, null coalescing, string concatenation, unit conversion. | `utils/transformationLibrary.ts` **New** | ⬜ |
| 10C.3 | **Mapping from examples** — user provides 2–3 input/output example pairs (paste JSON). System infers mapping rules by comparing field values between input and output. Uses value matching + position heuristics. Results are suggested as auto-map candidates. | `utils/exampleInference.ts` **New** | ⬜ |
| 10C.4 | **Example inference UI** — "Learn from Examples" button in toolbar opens a modal with input/output paste areas. After analysis, shows inferred mappings as pending (same accept/reject flow as auto-map). | `ExampleInferenceModal.tsx` **New** | ⬜ |
| 10C.5 | Unit tests — expression suggestion accuracy, transformation library coverage, example inference with various data shapes. | Test files | ⬜ |

#### Sub-Phase 10D: Hardening

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 10D.1 | `tsc --noEmit` + full test suite — zero errors, zero failures. | — | ⬜ |
| 10D.2 | Coverage check — all new files >90% coverage. | — | ⬜ |
| 10D.3 | Update docs — plan, changelog, README, training manuals. Add "AI-Assisted Mapping" to Feature Reference. | Docs | ⬜ |

**Dependency graph:**
```
10A (Smart Auto-Map & Semantic) → 10B (Confidence & Patterns) → 10C (Expressions & Examples) → 10D (Hardening)
```

**Estimated total:** ~5–6 days  
**Recommended order:** Sequential — scoring (10B) builds on matching (10A), suggestions (10C) build on both.

---

### Phase 11: Visual Polish — Mockup Alignment

Align the Data Mapper UI with the design reference in `docs/mockups/data-mapper-edge-cases-mockup.html`. The current implementation has correct architecture and full functionality, but the visual presentation needs polish to match the mockup's design language.

**Progress:** ⬜ Not started.

**Design reference:** `docs/mockups/data-mapper-edge-cases-mockup.html` (6 scenes: Array→Array, Aggregation, Function Palette, Null/Default/Conditional, Type Mismatch, Multi-Source).

#### Sub-Phase 11A: Tree Node Visual Enhancement

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 11A.1 | **Colored type badges** — add `str`/`num`/`arr`/`obj`/`bool` pills with per-type colors (green string, blue number, pink array, purple object, yellow boolean) matching mockup `.typ` / `.t-str` / `.t-num` styles. | `SourceTreeNode.tsx`, `TargetTreeNode.tsx`, `RegexAssertionBuilderModal.tsx`, `data-mapper.css` | ✅ |
| 11A.2 | **Inline sample values** — display truncated sample values (e.g., `"Widget A"`, `29.99`) on leaf nodes in the source tree, matching mockup `.val` style (muted, right-aligned, ellipsis). | `SourceTreeNode.tsx`, `data-mapper.css` | ✅ |
| 11A.3 | **Mapped indicator bar** — green left-border bar on mapped nodes (mockup `.tree-node.mapped::before`). Source nodes now receive `mappedPaths` prop from `DataMapper.tsx` via `SourcePanel.tsx`. | `SourceTreeNode.tsx`, `DataMapper.tsx`, `SourcePanel.tsx`, `data-mapper.css` | ✅ |
| 11A.4 | **Target mapped badges** — show source reference on mapped target nodes (e.g., `← item.product`), expression result previews, and `fx` pill for expression mappings. New `.dm-mapped-badge`, `.dm-mapped-src-ref`, `.dm-mapped-fx-pill` CSS classes. | `TargetTreeNode.tsx`, `data-mapper.css` | ✅ |
| 11A.5 | **Drag handles** — subtle grip icon (`⠿`) on source leaf nodes, visible on hover only. Added `aria-hidden` and cursor styles. | `SourceTreeNode.tsx`, `data-mapper.css` | ✅ |

#### Sub-Phase 11B: Canvas & Connection Line Polish

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 11B.1 | **Dot-grid background** — radial gradient dot pattern on `.dm-canvas-wrapper` matching mockup `.canvas-panel` background. | `data-mapper.css` | ✅ |
| 11B.2 | **Colored connection lines** — green solid (direct), purple dashed (expression), pink (loop), blue dashed (aggregate), amber dashed (mismatch). Added `dm-connection-line--expression` class. Updated loop/aggregate/spread colors to match mockup. | `MappingCanvas.tsx`, `data-mapper.css` | ✅ |
| 11B.3 | **Canvas badges** — pill-style SVG badges (`CanvasBadge` component) with colored backgrounds: `ƒx expression` (purple), `∞ for each` (pink), `Σ aggregate` (blue), `⚠ mismatch` (amber), `✕/⚠ drift` (red/amber). 9 new CSS badge variant classes. | `MappingCanvas.tsx`, `data-mapper.css` | ✅ |

#### Sub-Phase 11C: Footer & Stats Bar

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 11C.1 | **Stats footer** — colored stat counters: N loops, N mapped, N expressions, N aggregates, N mismatches. Keyboard shortcut hints. | `DataMapper.tsx`, `data-mapper.css` | ⬜ |

#### Sub-Phase 11D: Hardening

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 11D.1 | `tsc --noEmit` + full test suite — zero errors, zero failures. | — | ⬜ |
| 11D.2 | Snapshot / visual regression tests for styled components. | Test files | ⬜ |
| 11D.3 | Update docs and screenshots. | Docs | ⬜ |

**Estimated total:** ~3–4 days  
**Recommended order:** 11A → 11B → 11C → 11D (tree nodes first, then canvas, then footer).

---

## Technical Decisions

### Drag-and-Drop Library

**Final decision: Native HTML5 DnD** — simpler, no external dependency, sufficient for drag-and-drop mapping. `@dnd-kit` was initially considered for accessibility but HTML5 DnD with custom `DataTransfer` data proved adequate. Phase 7 accessibility work (7E) focused on ARIA attributes, focus management, and keyboard navigation rather than DnD library replacement.

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
├── DataMapper.tsx                       # Main container component
├── DataMapper.test.tsx
├── DataMapper.integration.test.tsx
├── DataMapperModal.tsx                  # Modal shell + validation + drift detection
├── DataMapperModal.test.tsx
├── SourcePanel.tsx                      # Source tree panel with paste/fetch
├── SourcePanel.test.tsx
├── SourceTreeNode.tsx                   # Draggable source tree node + drift indicators
├── SourceTreeNode.test.tsx
├── TargetPanel.tsx                      # Target tree panel with drop zones
├── TargetPanel.test.tsx
├── TargetTreeNode.tsx                   # Droppable target tree node
├── TargetTreeNode.test.tsx
├── MappingCanvas.tsx                    # SVG connection lines + drift line styling
├── MappingCanvas.test.tsx
├── MapperToolbar.tsx                    # Toolbar (auto-map, undo/redo, profiles, samples)
├── MapperToolbar.test.tsx
├── PreviewBar.tsx                       # Live preview output bar
├── PreviewBar.test.tsx
├── ExpressionEditorModal.tsx            # Monaco expression editor + autocomplete
├── ExpressionEditorModal.test.tsx
├── BodyBuilderPanel.tsx                 # Three-mode body builder (JSON/Form/Raw)
├── BodyBuilderPanel.test.tsx
├── CodeView.tsx                         # Read-only mapping code view
├── CodeView.test.tsx
├── RegexAssertionBuilderModal.tsx       # Regex assertion builder
├── RegexAssertionBuilderModal.test.tsx
├── DriftBanner.tsx                      # Schema drift notification banner
├── DriftBanner.test.tsx
├── SchemaDiffModal.tsx                  # Schema diff detail modal
├── SchemaDiffModal.test.tsx
├── index.ts                             # Barrel export (public API)
├── types.ts                             # Core types
├── adapters/
│   ├── demoAdapter.ts
│   ├── extractionAdapter.ts             # HTTP extraction adapter
│   ├── assertionAdapter.ts              # Regex assertion adapter
│   ├── validationAdapter.ts             # Selective validation adapter
│   ├── populateFromApiAdapter.ts        # Populate from API adapter
│   ├── columnMappingAdapter.ts          # Column ↔ request template adapter
│   ├── sharedDsFetchAdapter.ts          # Shared DS fetch adapter
│   ├── webhookExtractionAdapter.ts      # Webhook payload extraction adapter
│   ├── variableBindingAdapter.ts        # Variable binding adapter
│   ├── requestBodyAdapter.ts            # Request body builder adapter
│   ├── adapterIntegration.test.ts       # Cross-adapter integration tests
│   └── *.test.ts                        # Per-adapter test files
├── hooks/
│   ├── useMapperState.ts                # Mapping CRUD + undo/redo state
│   ├── useConnectionLines.ts            # Connection line position calculator
│   ├── useKeyboardNavigation.ts         # Keyboard navigation hook
│   ├── useBodyBuilderSync.ts            # Body builder sync lifecycle
│   └── *.test.ts
└── utils/
    ├── autoMapAlgorithm.ts              # Auto-mapping engine (3-tier matching)
    ├── mappingSerializer.ts             # Mapping serialization/deserialization
    ├── mapperExpressionEvaluator.ts     # Expression evaluator bridge
    ├── previewCompute.ts                # Preview evaluation engine
    ├── typeMismatch.ts                  # Type mismatch detection + quick-fix
    ├── bodyTemplateSync.ts              # Bi-directional template↔visual sync
    ├── bodyMappingShared.ts             # Shared body builder helpers
    ├── mappingProfiles.ts               # Named mapping profile CRUD
    ├── arrayMapping.ts                  # Array mapping detection + classification
    ├── gallerySamples.ts                # Gallery preset samples
    ├── schemaSnapshot.ts                # Schema snapshot capture + storage
    ├── schemaDrift.ts                   # Schema drift comparison + classification
    ├── schemaRepair.ts                  # Auto-repair engine (Levenshtein, renamed-candidate)
    ├── schemaContract.ts                # Contract mode (strict/lenient validation)
    ├── mappingTrace.ts                  # Mapping execution trace capture + summarization (Phase 9A)
    └── *.test.ts
```

**Styles**

- `src/styles/data-mapper.css` — base mapper styles + canvas + tree + drift indicators + preview + resize
- `src/styles/data-mapper-expression.css` — expression editor modal CSS
- `src/styles/data-mapper-modal.css` — modal shell + validation bar + drift banner + schema diff modal CSS

**Shared utilities** (outside the component folder):

```
src/shared/utils/
├── jsonPath.ts                      # Canonical path engine (from validator.ts)
├── jsonPath.test.ts
├── jsonTreeModel.ts                 # Unified tree model
└── jsonTreeModel.test.ts
```

Adapters live under `src/shared/components/data-mapper/adapters/` — 10 adapters implemented (demo, extraction, assertion, validation, populateFromApi, columnMapping, sharedDsFetch, webhookExtraction, variableBinding, requestBody).

---

## Migration Strategy

The Data Mapper will be introduced **alongside** existing components, not as a big-bang replacement:

1. **Phase 1–2**: Build the core mapper as a new standalone component with no existing feature dependencies
2. **Phase 3**: Replace extraction editor, assertion modal tree, and validation builder with Data Mapper adapters (direct replacement, old components deprecated but kept as reference)
3. **Phase 4–5**: Same adapter-based replacement for data sources and webhook config
4. **Phase 6**: Request body builder as a new optional mode
5. **Phase 7**: Polish, remove deprecated components after one release cycle
6. **Phase 8**: Schema drift detection runs passively — captures snapshots on save, compares on fetch, no user action needed until drift is found
7. **Phase 9**: Mapping debugger is opt-in — "Debug View" toggle in mapper toolbar; trace capture uses existing `traceCollector` infrastructure
8. **Phase 10**: AI-assisted features layer on top of the existing auto-map — same UI, smarter backend

This ensures zero disruption to existing workflows while the mapper matures. Phases 8–10 are **differentiators** — they go beyond what any current API testing or integration tool offers and position RedfireForge as the industry leader in visual data mapping.

---

## Success Criteria

### Core (Phases 1–7)
- [x] Single `DataMapper` component used in 8+ mapping contexts _(Phase 3–6 — wired into 9 production surfaces: ExtractionEditor, HttpConfig, WebhookConfig, CorrelationWaitConfig, TestEditorValidationTab, SetupStepValidate, DataSourceEditor, SharedDataSourceModal, DataSourceRowDetailModal)_
- [x] One canonical path engine (`getByPath`) replacing 5 scattered implementations _(Phase 1A — `src/shared/utils/jsonPath.ts`)_
- [x] One unified tree model replacing 2 parallel implementations _(Phase 1B — `src/shared/utils/jsonTreeModel.ts`)_
- [x] Auto-map correctly matches >80% of common field patterns _(Phase 1F — 3-tier matching: exact, case-insensitive, suffix)_
- [x] Live preview updates with 250ms debounce for payloads up to 10KB _(Phase 2D — computation itself is <100ms; debounce prevents UI thrash during rapid typing)_
- [x] Expression evaluation sandboxed (no `eval`, no global access) _(Phase 2A — uses `scriptSandbox.ts`)_
- [x] Full keyboard navigation (no mouse required) _(Phase 7C — Tab/Shift+Tab between panels, Arrow Up/Down for tree traversal, Arrow Right/Left for expand/collapse, Home/End)_
- [x] >90% unit test coverage on core mapper, path engine, and all adapters _(Phase 2H — hooks/utils/adapters >90%; components ~94% stmts)_
- [x] Training manuals and gallery samples for each mapping context _(4 manuals created)_

### Industry-Leading (Phases 8–10)
- [x] Schema drift detected automatically on source/target changes _(Phase 8A–8C — snapshot capture on save, diff on modal open, drift classification)_
- [x] Breaking changes surfaced before test runs fail silently _(Phase 8B–8C — DriftBanner notification, visual tree/line overlays, SchemaDiffModal)_
- [ ] Mapping debugger shows actual runtime values on connection lines
- [ ] Failed mappings pinpoint the exact source→target connection that broke
- [ ] Auto-map suggests semantic matches (synonym-based, not just name-based)
- [ ] Confidence scores on every auto-map suggestion
- [x] Expression suggestions for type mismatches _(Phase 2E — `typeMismatch.ts` with quick-fix suggestions and one-click apply)_
- [ ] Pattern learning remembers user mapping decisions across sessions

---

## Changelog

### Completed Phases Summary

| Phase | Completed | Key Deliverables | Tests at Completion |
|-------|-----------|-----------------|---------------------|
| **1 (1A–1H)** | 2026-05-10 | Unified path engine (`jsonPath.ts`), unified tree model (`jsonTreeModel.ts`), core types + state (`useMapperState` with undo/redo), auto-map algorithm (3-tier matching), UI components (SourcePanel, TargetPanel, MappingCanvas, MapperToolbar, DataMapper), native HTML5 DnD, barrel export | 11,999 project tests |
| **2 (2A–2H)** | 2026-05-10 | Expression evaluator bridge, textarea-based expression editor modal with function catalog + live preview (250ms debounce), paste JSON + fetch sample, PreviewBar with live mapped output, type mismatch detection + one-click quick-fix (`$parseInt`/`$toString`/`$toBool`), modal shell with validation display, deferred UX polish (inline ✕, `/` search, accept/reject pending, toast, resize handles), demo adapter, CSS split (814+363+170) | ~12,200 project tests |
| **3 (3A–3F)** | 2026-05-10 | 3 adapters (`extractionAdapter`, `assertionAdapter`, `validationAdapter`), 20 cross-cutting integration tests, old components deprecated (`@deprecated` JSDoc), host-override pipeline verified, variable hints flow verified, PickerNode status audited | 12,435 project tests |
| **4A** | 2026-05-10 | `populateFromApiAdapter` with mutable internal state for live-fetch, wired into `DataSourceEditor` + `SharedDataSourceModal` replacing `PopulateFromApiModal`, 52 adapter tests + 4 integration tests, test mocks updated | 12,435+ project tests |
| **4B** | 2026-05-10 | `columnMappingAdapter` with `parseScenarioTemplate` for URL/body/header `{{var}}` extraction, `type::name` target paths, wired into `DataSourceEditor` via "Map Columns" button, 48 adapter tests + 3 integration tests | 12,435+ project tests |
| **4C** | 2026-05-10 | `sharedDsFetchAdapter` — purpose-built adapter for shared DS "Populate from API" with dedicated `shared-ds-fetch` contextId, dynamic title from `fetchConfig`, wired into `SharedDataSourceModal.tsx` replacing `populateFromApiAdapter`, 61 adapter tests + 5 integration tests | 12,435+ project tests |
| **4D** | 2026-05-10 | Deprecation & Hardening — `@deprecated` on `PopulateFromApiModal`, `PopulateFetchStep`, `PopulateMapStep`, `usePopulateFromApi`; verified no live imports; full test suite 12,655 pass; adapter coverage 97.57%/90.18%/100%/99.54% | 12,655 project tests |
| **5 (5A–5D)** | 2026-05-10 | WebhookExtractionAdapter, VariableBindingAdapter, unified `extractPayloadVariables` path engine, `setByPath` canonical helper. 9 adapters total. | 12,843 project tests |
| **6 (6A–6D)** | 2026-05-10 | RequestBodyAdapter (10th adapter), bi-directional sync (`bodyTemplateSync`), BodyBuilderPanel (JSON/Form/Raw modes), HttpConfig integration, hardening. | ~12,900 project tests |
| **7 (7A–7F)** | 2026-05-11 | Mapping profiles, bulk select/delete, array mapping classification, type coercion extensions, keyboard navigation, CodeView, Monaco editor upgrade, gallery samples, WCAG AA accessibility, training manuals, hardening. | 13,116 project tests |
| **8A** | 2026-05-11 | Schema snapshot engine (`captureSchemaSnapshot`, `collectFieldEntries`), snapshot storage (load/save/delete), schema diff engine (`diffSchemas`), `findAffectedMappings`. | ~13,200 project tests |
| **8B** | 2026-05-11 | Drift severity classification (`classifyDrift` — info/warning/breaking), `DriftBanner` notification component, `DataMapperModal` drift detection on mount, "Accept & Update" flow. | 13,412 project tests |
| **8C** | 2026-05-11 | Visual drift overlay — source tree drift indicators (badges, strikethrough, non-draggable), affected mapping line styling (dashed + badges), `SchemaDiffModal` tabular diff view, "Show Diff" button. | 13,444 project tests |
| **8D** | 2026-05-11 | Auto-repair engine (`schemaRepair.ts` — Levenshtein, renamed-candidate strategies), contract mode (`schemaContract.ts` — strict/lenient validation, FailureDetail conversion, config persistence). Pre-8D audit fixed 8 HIGH + 1 MEDIUM issues. Pre-8E audit fixed 3 HIGH + 3 MEDIUM issues (lastSegment path corruption, contract JSON string parsing, drift detection overrides, root-array driftMap, canvas badge overlap, unused param cleanup). | 13,487 project tests |
| **8E** | 2026-05-11 | Hardening — full test suite pass (13,490 tests, 510 files), coverage check (all Phase 8 files >90% stmts/lines/funcs), docs updated. | 13,490 project tests |
| **Pre-9** | 2026-05-11 | Repair UI (SchemaDiffModal repair column with suggestions + confidence + apply), assertion adapter documented as API-only and removed from barrel, plan hygiene (6 stale items fixed). | 13,497 project tests |
| **Pre-9A audit** | 2026-05-11 | Fixed 1 CRITICAL + 3 HIGH + 2 MEDIUM issues: repair→state sync, multi-source drift matching, sourceId-aware findAffectedMappings, preview `[*]` wildcard, stale snapshot cleanup. | 13,500 project tests |
| **Pre-9B audit** | 2026-05-11 | Fixed 4 HIGH + 4 MEDIUM issues: unstable initialData refs (WebhookConfig, CorrelationWaitConfig), stale body sync mappings, $count non-array, $hash metadata, $random swapped bounds, $padStart empty pad, $urlEncode surrogate. | 13,505 project tests |
| **9A** | 2026-05-11 | `MappingTrace` type + `captureMappingTraces()` + trace level gating + `ExecutionEventDetails.mappingTraces` + `CapturedHttpNodeDetails.mappingTraces` + graphRunner wiring at full/debug + HTTP handler extraction trace capture. 40 new tests. | 13,545 project tests |
| **Pre-9B audit (R2)** | 2026-05-11 | Fixed 1 CRITICAL + 3 HIGH + 3 MEDIUM issues: HTTP extraction trace wrong fields (expression/name vs jsonPath/variable), evaluateMapperExpression unhandled throws, repair tick stale onChange, circular import graphRunner↔handler, isTraceError null misclassification, adapter.validate unguarded, ExpressionFunction wrong import path. | 13,546 project tests |
| **9B** | 2026-05-11 | Data Flow Overlay — Debug mode toggle, value badges on connection lines, source/target tree trace overlays, debug status bar, `traceData` prop on DataMapper, `TraceValueOverlay` type, CSS styling (120+ lines). 25 new tests. | 13,571 project tests |
| **Pre-9C audit** | 2026-05-11 | Fixed 3 HIGH + 4 MEDIUM issues: debugMode stuck when traces cleared, sourceTraceOverlay ignored sourceId (multi-source collision), traceByMappingId included stale traces, double onChange on repair, stuck repairTick, empty-string badge render, TraceValueOverlay type location. hasTraceData now derived from filtered traces. 5 new tests. | 13,576 project tests |
| **9C** | 2026-05-11 | Step-Through & Failure Pinpointing — `expressionStepDebugger.ts` (path resolution, nested function eval, step-by-step), "Step Debug" button + panel in ExpressionEditorModal, inline error labels on failed lines, error detail popover with close/outside-click, `traceByMappingId` prop on MappingCanvas. 30 new tests. | 13,606 project tests |

### Current Metrics (as of Phase 9C Completion)

| Metric | Value |
|--------|-------|
| **Full project tests** | **13,606 across 512 files** |
| TypeScript errors | 0 |
| Lint errors | 0 |
| Adapters | 10 (extraction, assertion, validation, populate, column-mapping, shared-ds-fetch, webhook-extraction, variable-binding, request-body, demo) |
| Deprecated components | 4 (PopulateFromApiModal, PopulateFetchStep, PopulateMapStep, usePopulateFromApi) |
| Schema drift features | Snapshot engine, drift classification (info/warning/breaking), notification banner, visual tree/line overlays, schema diff modal, auto-repair engine, contract mode |

### Key Bugs Fixed During Development

| Bug | Severity | Phase | Fix |
|-----|----------|-------|-----|
| `wrapDollarPaths` PATH_CHAR regex unescaped `]` breaks bracket paths in expressions | Critical | Pre-4A | Escaped `[` and `]` in character class: `/[\w.\[\]*-]/` |
| `autoMapAlgorithm` doesn't exclude already-used source paths | High | Pre-4A | Seed `claimedSources` from `existingMappings` source paths |
| `previewCompute` `setNestedValue` doesn't strip `$.` prefix from targetPath | High | Pre-4A | Added `path.replace(/^\$\.?/, '')` normalization before parsing segments |
| `validationAdapter` invalid `selectiveMode` silently treated as exclude | High | Pre-4A | Guard: only `'exclude'` explicitly → exclude branch; all else → include |
| Picker `initialData` creates new array every render → mapper resets | High | Pre-4A | Memoized `pickerInitialData` with `useMemo` keyed on `pickerIdx` |
| `RegexAssertionBuilderModal` external JSON clear doesn't reset sampleJson | Medium | Pre-4A | Sync on any change (not just truthy): `setSampleJson(externalJson \|\| '')` |
| `ExtractionEditor` dead no-op spread `...(mapped.name && !nameEmpty ? {} : {})` | Low | Pre-4A | Removed dead code |
| `extractionAdapter` useMemo stale nonBody closure in ExtractionEditor | High | Pre-3B | Changed dep from `.length` to JSON fingerprint of nonBody array |
| Picker-mode onSave drops fallback from mapped extraction | Medium | Pre-3B | Added fallback propagation in picker save handler |
| `isEditable` missing `SELECT` — undo fires on focused selects | Medium | Pre-3B | Added `SELECT` to isEditable tag check |
| `stripDollarPrefix` inconsistent with `resolveValue` for `$` paths | High | Pre-3B | Changed to regex `/^\$\.?/` matching `resolveValue` |
| `DataMapperModal` serialize error permanently blocks Done button | High | Pre-3B | Changed serialize errors to warnings (non-blocking, retryable) |
| `assertionAdapter.validate` doesn't check for empty pattern | Medium | Pre-3B | Added pattern validation via `getPattern` / `initialPattern` |
| Keyboard handler steals Backspace/Delete/Undo from text inputs | Critical | Pre-Wiring | Added `isEditable` guard (INPUT/TEXTAREA/contentEditable) |
| `typeMismatch.ts` suggestedFix creates double `$.` for prefixed paths | High | Pre-Wiring | Normalize `sourcePath` before substitution |
| `FIX_MAP` type was `Record<string, Record<string, string>>` (wrong) | Medium | Pre-Wiring | Fixed to `Record<string, string>` |
| `ExpressionEditorModal` stale expression on mapping change | High | Pre-Wiring | Sync expression via `useEffect` on `mapping.id` change |
| `extractionAdapter` drops `Extraction.fallback` on round-trip | High | Pre-Wiring | Added `fallbackMap` to preserve fallbacks through serialize/deserialize |
| `validationAdapter` exclude mode `$.` prefix mismatch | High | Pre-Wiring | Added `stripDollarPrefix()` for path comparison and lookup |
| `DataMapperModal` `adapter.serialize` can throw unhandled | Medium | Pre-Wiring | Wrapped in try/catch with error validation issue |
| `TargetTreeNode` drop payload not validated | Medium | Pre-Wiring | Added type check for `path` and `sourceId` before `onDrop` |
| `initialMappings` `useMemo([])` ignored prop changes | Critical | Pre-3C | Track `initialData` via `useRef` + sync effect |
| Adapter-change sync (adapter changes but initialData same) | High | Pre-3F | Added `prevAdapterRef` to check both in sync effect |
| `assertionAdapter` stale pattern/patternName closure | Important | Pre-3C | Added `getPattern` callback for live retrieval |
| `extractionAdapter.validate()` missed empty expression | Important | Pre-3C | Added `expr.trim()` check |
| `findUnmappedRequired` only checked `fieldConstraints` | Important | Pre-3C | Now also checks `target.fields[].required` |
| `previewCompute` `setNestedValue` didn't handle bracket paths | Important | Pre-2F | Added `parsePathSegments` parser |
| `validator.ts` re-exported `getByPath` but didn't import for internal use | Critical | 1H | Added explicit import (fixed 81 test failures) |
| Quick-fix functions not registered in workflow engine | Important | Pre-2G | Registered `$parseInt`/`$toString`/`$toBool`/`$toInt`/`$parseFloat` |
| DataMapperModal Escape closes parent when expression editor open | Critical | Pre-8A audit | Check for `.dm-expr-overlay` before closing; skip editable fields |
| Bulk drop ignores actual drop target | High | Pre-8A audit | Map dragged source to actual `targetPath`; others by name |
| `extractionAdapter.serialize` loses interleaved ordering | High | Pre-8A audit | Track original non-body indices; re-interleave on serialize |
| `requestBodyAdapter`/`bodyTemplateSync` drops multi-ref strings | High | Pre-8A audit | Loop over all refs from `extractBodyTemplateRefs`, not just `refs[0]` |
| `variableBindingAdapter` duplicate target paths for same ref | High | Pre-8A audit | Disambiguate with `ref::location` suffix; strip on serialize |
| Duplicate `.dm-tree-node--selected` CSS rules | Medium | Pre-8A audit | Removed hardcoded rule; kept custom property version |
| `autoMapAlgorithm` claims expression strings as source paths | Low | Pre-8A audit | Removed `claimedSources.add(m.expression)` |
| `$parseInt` doc says "Returns NaN" but returns 0 | Low | Pre-8A audit | Updated description to match behavior |
| `$hash` example shows decimal but evaluate returns hex | Low | Pre-8A audit | Updated example to correct hex output |
| Gallery "Conditional Mapping" sample has no conditionals | Medium | Pre-8A audit | Replaced mappings with `$default`, `$if`, `$concat` expressions |
| `buildBodyFromMappings` last-write-wins for multi-ref fields | Critical | Pre-8A audit #2 | Group placeholders by targetPath; concatenate instead of overwrite |
| `syncFromTemplate` `existingByTarget` loses multi-ref mappings | High | Pre-8A audit #2 | Changed `Map<string, Mapping>` → `Map<string, Mapping[]>` for multi-ref preservation |
| `DataMapperModal` Escape skips `contentEditable` check | Medium | Pre-8A audit #2 | Added `contentEditable === 'true'` guard alongside INPUT/TEXTAREA/SELECT |
| `DataMapperModal` snapshot captures stale adapter sources | High | Post-8A audit | Added `onSourceSampleChange` callback; modal uses effective (pasted/fetched) data |
| `findAffectedMappings` `[*]` vs `[0]` path mismatch | Medium | Post-8A audit | Added `normalizePathForDrift()` to canonicalize array notation before matching |
| `collectFieldEntries` no cycle/depth guard | Medium | Post-8A audit | Added `WeakSet` cycle detection + `MAX_DEPTH=20` guard |
| `collectFieldEntries` null-first array misses object fields | Medium | Post-8A audit | Uses `Array.find(el => el != null)` to find first representative element |
| `extractionAdapter.deserialize([])` skips clearing internal state | High | Post-8B audit | Moved `fallbackMap.clear()` and `nonBodyIndices.clear()` before early return |
| Modal drift detection reads empty `currentMappingsRef` | Medium | Post-8B audit | Added `mappingsReadyRef` + `requestAnimationFrame` polling to wait for child effects |
| `requestBodyAdapter.validate` "Last mapping wins" misleading | Medium | Post-8B audit | Updated message to "values will be concatenated as {{ref1}}{{ref2}}" |
| `bodyTemplateSync` duplicate IDs for `{{ref}}{{ref}}` pattern | Medium | Post-8B audit | Track consumed candidates with `usedCandidateIds` Set |
| `classifyDrift` JSDoc says nullable=warning but code uses info | Medium | Post-8B audit | Fixed JSDoc to match implementation (nullable = info) |
| `handleRepairMapping` only updates ref, not DataMapper state | Critical | Pre-9A audit | Added `repairTick` + `repairedMappingsRef` props to DataMapper; child re-syncs via `setMappings` on tick change |
| `repairSuggestions` always uses first snapshot pair | High | Pre-9A audit | Tag `sourceId` on drifts at detection; find matching pair by `drift.sourceId` |
| `findAffectedMappings` ignores `mapping.sourceId` — cross-source false positives | High | Pre-9A audit | Filter by `drift.sourceId` when available; skip non-matching mappings |
| `previewCompute` `setNestedValue` treats `[*]` as literal string | High | Pre-9A audit | Map `*` wildcard to `0` in `parsePathSegments` |
| `handleRepairMapping` keeps zero-affected breaking drift rows | Medium | Pre-9A audit | Simplified filter to remove any breaking drift with no affected mappings |
| `savedSnapshotsRef` not cleared on accept/dismiss | Medium | Pre-9A audit | Clear `savedSnapshotsRef.current = []` in accept and dismiss handlers |
| Unstable `initialData` from `?? []` in WebhookConfig/CorrelationWaitConfig | High | Pre-9B audit | Module-level `EMPTY_EXTRACT_VARS` constant replaces inline `?? []` |
| `useBodyBuilderSync` carries stale mappings from invalid→valid body transition | High | Pre-9B audit | Fall back to `syncFromTemplate` when old body is unparseable |
| `$count` returns `undefined` for non-array JSON-parsed strings | High | Pre-9B audit | Added `Array.isArray(parsed)` guard; falls through to string length |
| `$hash` metadata lists unused `algorithm` arg | Medium | Pre-9B audit | Removed `algorithm` arg from metadata; documented as djb2-only |
| `$random` broken when `max < min` | Medium | Pre-9B audit | Added swap: `if (lo > hi) { tmp = lo; lo = hi; hi = tmp; }` |
| `$padStart`/`$padEnd` throw on empty pad string | Medium | Pre-9B audit | Guard: `s(pad) !== '' ? s(pad) : ' '` — falls back to space |
| `$urlEncode` throws on lone surrogates | Medium | Pre-9B audit | Wrapped `encodeURIComponent` in try/catch; returns raw on error |
| HTTP extraction trace uses wrong field names (`jsonPath`/`variable` vs `expression`/`name`) | Critical | Pre-9B audit R2 | Fixed to use `e.expression` and `e.name`, filter by `source === 'body'` |
| `evaluateMapperExpression` uses try/finally with no catch | High | Pre-9B audit R2 | Added `catch` returning `{ value: undefined, preview: '', error }` |
| Repair tick + onChange passive effects cause stale `currentMappingsRef` | High | Pre-9B audit R2 | Merged into single effect; repair path calls `onChange` with repaired array directly |
| Circular import `graphRunner.ts` ↔ `graphRunnerHttpHandler.ts` | High | Pre-9B audit R2 | Extracted `resolveTraceLevel` to leaf module `graphRunnerTraceLevel.ts` |
| `isTraceError` treats `null` targetValue as error | Medium | Pre-9B audit R2 | Narrowed to `trace.targetValue === undefined` only |
| `adapter.validate` not wrapped in try/catch in `handleDone` | Medium | Pre-9B audit R2 | Wrapped in try/catch; throwing validate produces a warning message |
| `mappingTrace.ts` imports `ExpressionFunction` from wrong module | Medium | Pre-9B audit R2 | Fixed import path to `expressionFunctions/types.ts` |
| `applyTemplateDiff` wipes mappings when new body is invalid JSON | Critical | Pre-11B audit | Added `parseBodyJson(newBody)` guard — preserves mappings on invalid JSON (mirrors `syncFromTemplate`) |
| `handleDrop` stale `adapter.target` due to missing `useCallback` dep | High | Pre-11B audit | Added `adapter.target` to `handleDrop` dependency array |
| `mappedSourcePaths` ignores `$.` prefix — source mapped highlights break | High | Pre-11B audit | Strip `$.` prefix when building `mappedSourcePaths`; also include mappings with falsy `sourceId` |
| `applyRepair` only updates `sourcePath`, leaves stale refs in `expression` | High | Pre-11B audit | Also `replaceAll` old path variants inside `mapping.expression` |
| `ExpressionEditorModal` allows saving with evaluation errors silently | Medium | Pre-11B audit | Added `window.confirm` guard when `preview.error` is set |
| `RegexAssertionBuilderModal` inconsistent with 11A (uses `∅` for null, `dm-node-value`) | Medium | Pre-11B audit | Changed null label to `'null'`, class to `dm-node-sample-value` |
| `isTraceError` flags empty-string `error` as failure | Medium | Pre-11B audit | Changed to `typeof error === 'string' && error.length > 0` |
| `SourceTreeNode` awkward `export type` then `import type` for `TraceValueOverlay` | Low | Pre-11B audit | Consolidated to single `import type` + `export type` |
| Monaco Ctrl+Enter bypasses `handleSave` error confirmation | Medium | Pre-11C audit | Used `handleSaveRef` pattern so Monaco command calls same confirm flow as Save button |

### Deferred Items

| Item | Deferred To | Reason |
|------|-------------|--------|
| Free-form target fields (`allowCustomFields` UI) | Phase 9+ | Adapters set the flag; TargetPanel UX not built yet |
| Schema-driven target tree (from `target.fields` / JSON Schema) | Phase 9+ | Only sample data tree implemented |
| Remove deprecated `PickerNode` / `JsonPathBuilder` | After full wiring | Keep both old + new UIs in parallel until DataMapper is fully validated |

### Resolved Items (formerly deferred)

| Item | Resolved In | Notes |
|------|-------------|-------|
| Monaco expression editor | Phase 7D | Upgraded from textarea to `@monaco-editor/react` with function/path autocomplete |
| `$jsonpath` wildcard support | Post-7F fix | Added `[*]` array wildcard and bracket notation; 37 new unit tests |
| `mappingProfiles.ts` localStorage bypass | Post-7F fix | Migrated to `readKey`/`writeKey` async storage abstraction (Tauri + browser) |
| Static element IDs in modals | Post-7F fix | Replaced `id="dm-modal-title"` / `id="dm-expr-title"` with `useId()` for uniqueness |
| Gallery samples not wired to UI | Post-7F fix | Added `📖 Samples` dropdown to `MapperToolbar` with `onLoadGallerySample` prop; CSS for difficulty badges |
| Modal Escape key handler | Post-7F fix | Added `window` keydown listener in `DataMapperModal` for Escape → `onCancel()` |
| Monaco Escape unreliable | Post-7F fix | Registered `editor.addCommand(KeyCode.Escape)` in `ExpressionEditorModal` for reliable cancel |
| Training manual version outdated | Post-7F fix | Updated `data-mapper-basics-easy.html` from v0.6.0 to v0.5.7 (header + footer) |
| Duplicate keyboard shortcut sections | Post-7F fix | Merged sections 8 and 12 into one accurate section; renumbered subsequent sections |
| Training manual Escape claim wrong | Post-7F fix | Corrected "close the mapper" to "clear selection; close modal when used from Modal" |
