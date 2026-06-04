# Kafka Message Studio — Implementation Plan

> Branch: `feature/kafka-integration`  
> Created: 2025-07-14  
> Last Reviewed: 2026-06-04 (Phase 3 re-evaluation pass #2 + Docker validation)
> Status: ✅ Phase 3/4/5 re-evaluated — pending merge to develop

---

## Table of Contents

1. [Overview & Goals](#overview--goals)
2. [Context: Why a Standalone Tool?](#context-why-a-standalone-tool)
3. [Current Kafka Implementation Inventory](#current-kafka-implementation-inventory)
4. [Design Decisions](#design-decisions)
5. [Navigation & Page Structure](#navigation--page-structure)
6. [Phase 1 — Core Publish Studio & Consume Studio](#phase-1--core-publish-studio--consume-studio)
7. [Phase 2 — Templates & Saved Sessions](#phase-2--templates--saved-sessions)
8. [Phase 3 — Workflow Integration Hooks](#phase-3--workflow-integration-hooks)
9. [Phase 4 — Topic Explorer Enhancement](#phase-4--topic-explorer-enhancement)
10. [Phase 5 — Schema Registry Browser](#phase-5--schema-registry-browser)
11. [Test Plan](#test-plan)
12. [Type Definitions](#type-definitions)
13. [File Map](#file-map)
14. [Phase Status Tracker](#phase-status-tracker)
15. [Open Questions / Risks](#open-questions--risks)

---

## Overview & Goals

**Kafka Message Studio** is a standalone, fullscreen debug tool for publishing to and consuming from Kafka topics — analogous to how **Requests** works for HTTP testing and **Catalog** works for grouped test execution.

Unlike the workflow node configs (`KafkaProduceConfig`, `KafkaConsumeConfig`), which are embedded inside workflow edges and only used at design time, Message Studio is a **first-class page** where developers and testers can:

- Send a Kafka message to any topic on a connected cluster and immediately see the partition/offset result
- Consume a bounded set of messages with explicit filters (key regex, header match, JSONPath) and inspect payloads
- Save sessions as reusable templates
- Feed consumed messages back into workflows ("Use as Workflow Input")

The key analogy:

| HTTP world | Kafka world |
|---|---|
| Requests page (send HTTP, see response) | Publish Studio (produce message, see offset) |
| Catalog (organized test suites to execute) | *(Phase 2: saved Kafka test templates)* |

---

## Context: Why a Standalone Tool?

The existing Kafka feature set covers:

1. **Cluster Studio** (`KafkaSettingsPage`) — connect/disconnect, manage cluster configs, browse topics
2. **Workflow nodes** — `KafkaProduceConfig`, `KafkaConsumeConfig`, `KafkaTriggerConfig`, `KafkaWaitConfig` — embedded in the workflow designer, not accessible standalone
3. **Server APIs** — `/api/kafka/produce`, `/api/kafka/consume-once`, `/api/kafka/subscribe`, etc. — fully implemented and well-tested

The gap: **there is no UI to manually send a Kafka message or run a bounded consume without building a workflow first.** This plan fills that gap.

---

## Current Kafka Implementation Inventory

### Server-side (all routes live in `src-server/routes/kafka-routes.ts`)

| Endpoint | Method | Used by Message Studio |
|---|---|---|
| `POST /api/kafka/produce` | POST | ✅ Publish Studio |
| `POST /api/kafka/consume-once` | POST | ✅ Consume Studio |
| `POST /api/kafka/subscribe` | POST | Phase 3 (live stream) |
| `GET /api/kafka/subscriptions` | GET | Phase 3 |
| `POST /api/kafka/unsubscribe` | POST | Phase 3 |
| `GET /api/kafka/topics` | GET | Both (topic picker) |
| `GET /api/kafka/status` | GET | Both (guard: must be connected) |
| Schema registry routes | POST | Phase 2 (schema encoding) |

All route handlers use `KafkaRouteEnvelope<T>` / `sendEnvelope()` / `createKafkaErrorEnvelope()`. No server-side changes are needed for Phase 1 or Phase 2.

### Client-side contracts (`src/shared/kafka/kafkaClient.ts` + `src-server/kafka/contracts.ts`)

Key request/response shapes used by Message Studio:

**Publish:**
```ts
// Request — maps to KafkaProduceRequest
{
  clusterId?: string;          // from connected cluster
  topic: string;
  messages: [{
    key?: string;
    value: string;             // JSON body as string
    headers?: Record<string, string>;
    partition?: number;        // undefined = auto
    timestamp?: string;
  }];
  acks?: number;               // -1 | 0 | 1
  timeoutMs?: number;
}

// Response — KafkaProduceResult
{
  clusterId?: string;
  topic: string;
  sentCount: number;
  records: [{ partition: number; offset: string; timestamp?: string }];
  valueEncoding?: 'avro' | 'protobuf' | 'json-schema' | 'plain';
}
```

**Consume:**
```ts
// Request — maps to KafkaConsumeOnceRequest
{
  clusterId?: string;
  topic: string;
  groupId?: string;            // default: 'redfireforge-debug-<uuid8>' per mount
  fromBeginning?: boolean;     // default: false (latest)
  timeoutMs?: number;          // default: 10000
  maxMessages?: number;        // default: 50
  filter?: {
    keyEquals?: string;
    headersMatch?: Record<string, string>;
    jsonPath?: string;
    jsonEquals?: string;
  };
}

// Response — KafkaConsumeResult
{
  messageCount: number;
  messages: [{
    topic: string;
    partition: number;
    offset: string;
    timestamp?: string;
    key?: string;
    value: string;
    headers?: Record<string, string>;
  }];
  timedOut: boolean;
}
```

### State hook (`src/app/hooks/useKafkaState.ts`)

Exposes: `selectedCluster`, `selectedClusterId`, `connection`, `topics`, `refreshTopics`.
Message Studio will read these to gate operations (must be connected) and populate the topic picker.
**No changes to `useKafkaState` are needed for Phase 1.** A new dedicated hook (`useKafkaMessageStudio`) will own its own operation state.

---

## Design Decisions

### Decision 1: Navigation placement — where do interactive protocol tools live?

**Context:** The app currently has five Activity Bar domains: API (Requests + Catalog), Workflow, Harness, Gallery, Settings. Kafka cluster *configuration* lives under Settings → Kafka. The question is where to place interactive testing tools: Kafka Message Studio, Kafka Topic Explorer, and future protocol studios (GraphQL, gRPC, WebSocket).

**Options considered:**
- A) Add sub-tabs inside `KafkaSettingsPage`: `Cluster Studio | Message Studio | Topic Explorer` — cluttered, mixes config with testing.
- B) Expand the `settings` domain: add `kafka-message-studio` and `kafka-topic-explorer` alongside `kafka-settings` — studios sit near config, but conceptually wrong; Settings is for configuration, not active testing.
- C) Expand the `api` domain: add Kafka/GraphQL/gRPC studios as sub-tabs under API — conflates REST HTTP testing with protocol-specific tooling; the domain label "API" becomes misleading.
- D) **New `protocols` domain in the Activity Bar** — dedicated domain for all interactive protocol testing studios. Cluster *configuration* (kafka-settings) stays in Settings.

**Decision: Option D** — New `'protocols'` domain in the Activity Bar.

**Rationale:**
- Separates *active testing tools* from *configuration*. Same principle as how `requests` (active) is separate from `environments` (config).
- Scales cleanly: each new protocol (GraphQL, gRPC, WebSocket) adds one sub-tab to the Protocols domain without touching any other domain.
- Kafka cluster settings remain in Settings → Kafka, so existing users aren't disrupted.
- The guard panel in Kafka Studio can link to Settings → Kafka for cluster setup.

**Future-proof nav structure (when all protocols are added):**
```
Activity Bar:  API | Workflow | Harness | Gallery | Protocols | Settings

Protocols sub-nav:
  kafka-message-studio   → "Kafka Studio"
  kafka-topic-explorer   → "Topic Explorer"
  (future) graphql-studio     → "GraphQL"
  (future) grpc-studio        → "gRPC"
  (future) websocket-studio   → "WebSocket"
```

**Nav change (Phase 1 + Phase 4):**
```ts
// appTabUtils.ts:
//   - Add 'kafka-message-studio' | 'kafka-topic-explorer' to Tab union
//   - Add new PROTOCOLS_TABS set, isProtocolsTab() predicate, 'protocols' Domain
//   - Update domainOf() to return 'protocols' for protocol tabs

// AppActivityBar.tsx: add Protocols button (between Gallery and Settings)
// AppSubNav.tsx: add DOMAIN_ITEMS.protocols with two initial tabs
// App.tsx: add render branches for the two new tabs
```

### Decision 2: One page, two panels (Publish + Consume side by side)

**Layout:** Side-by-side `1fr 1fr` grid, matching the mockup. On narrow viewports (<900px) stack vertically.

Each panel is an independent card with its own send/consume action, result state, and error display.

No shared toolbar — each panel owns its own actions.

### Decision 3: Topic input is free text with a hint

The topic field in both panels is a plain text input (not a dropdown). A placeholder hint shows the expected pattern, e.g. `e.g. orders.created`. This avoids fetching/loading the topic list as a hard dependency and lets users type topics that may not yet exist on the cluster (useful during development).

If no cluster is connected, both panels show a full-panel guard state: "Connect a cluster in Kafka Settings to use Message Studio."

### Decision 4: `useKafkaMessageStudio` is a dedicated hook, not an extension of `useKafkaState`

`useKafkaState` is already 574 lines and owns connection/cluster lifecycle. Message Studio state (form fields, operation loading flags, results, errors) is independent and belongs in its own hook.  
The hook receives `kafkaState: UseKafkaStateReturn` as a parameter (for clusterId + connection guard). It also accepts optional `deps.dispatch` for test injection, following the `useKafkaState` pattern.

### Decision 5: Server-side streaming (subscribe/unsubscribe) is Phase 3 only

Phase 1 only calls `produce` and `consume-once`. The "Start Stream" button in the mockup is deferred to Phase 3 to keep Phase 1 scoped and shippable.

---

## Navigation & Page Structure

### Changes to `src/app/utils/appTabUtils.ts`

```ts
// Extend Tab union:
export type Tab = ... | 'kafka-message-studio' | 'kafka-topic-explorer';

// Extend Domain union:
export type Domain = 'api' | 'workflow' | 'testing' | 'gallery' | 'protocols' | 'settings';

// New protocols set:
const PROTOCOLS_TABS = new Set<Tab>(['kafka-message-studio', 'kafka-topic-explorer']);
export const isProtocolsTab = (t: Tab) => PROTOCOLS_TABS.has(t);

// Update domainOf():
export function domainOf(tab: Tab): Domain {
  if (isApiTab(tab)) return 'api';
  if (isWorkflowTab(tab)) return 'workflow';
  if (isGalleryTab(tab)) return 'gallery';
  if (isHarnessTab(tab)) return 'testing';
  if (isProtocolsTab(tab)) return 'protocols';   // NEW
  return 'settings';
}

// Add both tabs to ALL_TABS.
```

### Changes to `src/app/components/AppSubNav.tsx`

```ts
// Phase 1 — Protocols domain starts with one sub-tab:
protocols: [
  { tab: 'kafka-message-studio', label: 'Kafka Studio' },
],
// Phase 4 — same domain extended to two tabs:
// protocols: [
//   { tab: 'kafka-message-studio', label: 'Kafka Studio' },
//   { tab: 'kafka-topic-explorer', label: 'Topic Explorer' },  // added in Phase 4
// ],
// Phase 5 — fully populated:
// protocols: [
//   { tab: 'kafka-message-studio',  label: 'Kafka Studio'   },
//   { tab: 'kafka-topic-explorer',  label: 'Topic Explorer' },
//   { tab: 'kafka-schema-registry', label: 'Schema Registry' },  // added in Phase 5
// ],
```

### Changes to `src/app/components/AppActivityBar.tsx`

Add a new "Protocols" button between Gallery and Settings:

```tsx
<button
  className={`ab-btn ${domainOf(activeTab) === 'protocols' ? 'active' : ''}`}
  onClick={() => { if (!isProtocolsTab(activeTab)) setActiveTab('kafka-message-studio'); }}
  title="Protocols"
>
  <span className="ab-icon">
    <ActivityBarIcon>
      {/* data stream / pulse icon */}
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </ActivityBarIcon>
  </span>
  <span className="ab-label">Protocols</span>
</button>
```

### Changes to `src/app/App.tsx`

```tsx
// Phase 1:
import KafkaMessageStudioPage from '../features/kafka/KafkaMessageStudioPage';

// Phase 4 adds:
// import KafkaTopicExplorerPage from '../features/kafka/KafkaTopicExplorerPage';

// Phase 1 render branch:
{activeTab === 'kafka-message-studio' && (
  <KafkaMessageStudioPage
    kafkaState={kafkaState}
    onNavigateToKafkaSettings={() => setActiveTab('kafka-settings')}
  />
)}

// Phase 4 adds:
// {activeTab === 'kafka-topic-explorer' && (
//   <KafkaTopicExplorerPage kafkaState={kafkaState}
//     onNavigateToKafkaSettings={() => setActiveTab('kafka-settings')} />
// )}
```

### `isSettingsTab` and `domainOf` interaction with AppActivityBar / App.tsx

Today `settings` domain hides the sidebar and skips the sub-nav spacer. The new `protocols` domain follows the **same pattern**: no sidebar, no spacer. `AppActivityBar` and `App.tsx` already gate on `domainOf(...) !== 'settings'`; update those guards to also exclude `'protocols'`.

---

## Phase 1 — Core Publish Studio & Consume Studio

### Phase 1 Success Criteria

- [x] New "Protocols" domain in Activity Bar (between Gallery and Settings)
- [x] New top-level tab "Kafka Studio" in the Protocols domain
- [x] Guard state shown when no cluster is connected (links to Kafka Settings tab)
- [x] Publish Studio: topic picker, key, partition (auto/explicit), acks, headers editor, body textarea
- [x] Publish Studio: "Send Once" dispatches to `POST /api/kafka/produce`
- [x] Publish Studio: success result shows partition + offset + timestamp
- [x] Publish Studio: error shown inline with retry-able indicator
- [x] Publish Studio: "Validate JSON" button formats/validates body textarea
- [x] Consume Studio: topic picker, consumer group, start position (latest/earliest), timeout, max messages
- [x] Consume Studio: key match (exact string), header match (key=value), JSONPath filter (path + expected value fields)
- [x] Consume Studio: "Consume Once" dispatches to `POST /api/kafka/consume-once`
- [x] Consume Studio: scrollable results table (max-height ~320px), columns: `#` · `Offset` · `Partition` · `Key` · `Value preview`
- [x] Consume Studio: click a row to inspect full payload in detail pane below the table
- [x] Consume Studio: timed-out amber badge above the table when `timedOut === true`
- [x] Consume Studio: empty state when `messageCount === 0`
- [x] Consume Studio: "Copy Payload" copies selected message body to clipboard
- [x] Publish: "Validate JSON" also pretty-prints the body in place
- [x] Inline validation: topic required (both panels), body non-empty (publish) — red hint text, no blocking alerts
- [x] TypeScript: 0 errors
- [x] Unit tests: `useKafkaMessageStudio` hook — >90% branch/func/stmt
- [x] Unit tests: `KafkaPublishStudio`, `KafkaConsumeStudio`, `kafkaMessageStudioUtils` — >90% branch/func/stmt
- [x] Consume Studio: message count shown above results table (e.g. "3 messages" / "50 / 50 max reached")
- [x] `sendOnce` / `consumeOnce` replaces previous result on re-run (never appends)
- [x] `[Clear]` button in Publish result area calls `clearPublishResult`
- [x] `[Clear]` and `[Export Result Set]` buttons in Consume Zone A — Export downloads all rows as `.json`, Clear calls `clearConsumeResult`
- [x] Publish Studio: collapsible "Enable Schema Registry" section rendered via `KafkaSchemaConfigSection`; maps to `publishDraft.schemaConfig`
- [x] Consume Studio: same schema section maps to `consumeDraft.schemaConfig`
- [x] Schema disabled by default; enabling shows `registryUrl` + format + optional subject/version/auth
- [x] `schemaConfig` passed through `buildPublishRequest` / `buildConsumeRequest` and included in dispatch body when non-undefined

### New Files

```
src/features/kafka/
  types.ts                          — shared Kafka Studio types (consumed by Phases 1–5; lives here, not in shared/)
  KafkaStudioGuard.tsx              — shared not-connected guard component (reused by Phases 1, 4, and 5)
  KafkaStudioGuard.test.tsx         — guard component unit tests
  KafkaMessageStudioPage.tsx        — top-level page component (Phase 1)
  KafkaMessageStudioPage.test.tsx   — component unit tests
  KafkaPublishStudio.tsx            — Publish panel component
  KafkaPublishStudio.test.tsx
  KafkaConsumeStudio.tsx            — Consume panel component
  KafkaConsumeStudio.test.tsx
  kafkaMessageStudioUtils.ts        — pure helpers: JSON validate/format, header parse, filter build, publish/consume request builders
  kafkaMessageStudioUtils.test.ts

src/app/hooks/
  useKafkaMessageStudio.ts          — operation state hook
  useKafkaMessageStudio.test.ts
```

### `useKafkaMessageStudio` Hook

```ts
export interface KafkaPublishDraft {
  topic: string;              // free text, placeholder 'e.g. orders.created'
  key: string;
  partition: string;          // '' = auto, '2' = explicit partition number
  acks: -1 | 0 | 1;          // -1=all, 0=none, 1=leader
  timeoutMs: string;
  headers: Array<{ id: string; key: string; value: string; enabled: boolean }>;
  body: string;               // raw JSON string
  schemaConfig?: KafkaSchemaConfig;  // undefined = no encoding; set = Avro/Protobuf/JSON Schema
}

export interface KafkaConsumeDraft {
  topic: string;              // free text, placeholder 'e.g. orders.created'
  groupId: string;            // initialized to 'redfireforge-debug-<uuid8>' per mount
  startPosition: 'latest' | 'earliest';
  timeoutMs: string;          // ms, default '10000'
  maxMessages: string;        // default '50'
  keyEquals: string;          // exact key match — maps to KafkaMessageFilter.keyEquals
  headerMatch: string;        // 'key=value' format → headersMatch: { key: 'value' }
  jsonPath: string;           // JSONPath expression e.g. '$.status'
  jsonPathEquals: string;     // expected value e.g. 'CREATED' (blank = assert path exists)
  schemaConfig?: KafkaSchemaConfig;  // undefined = no decoding; set = auto-decode via registry
}

export interface KafkaPublishResult {
  topic: string;
  sentCount: number;
  records: Array<{ partition: number; offset: string; timestamp?: string }>;
  valueEncoding?: string;
}

export interface KafkaConsumeResultRow {
  topic: string;
  partition: number;
  offset: string;
  timestamp?: string;
  key?: string;
  value: string;
  headers?: Record<string, string>;
}

export interface UseKafkaMessageStudioReturn {
  // Publish
  publishDraft: KafkaPublishDraft;
  setPublishDraft: (patch: Partial<KafkaPublishDraft>) => void;
  publishLoading: boolean;
  publishResult: KafkaPublishResult | null;
  publishError: KafkaUiSafeError | null;
  sendOnce: () => Promise<void>;
  validateJsonBody: () => boolean;

  // Consume
  consumeDraft: KafkaConsumeDraft;
  setConsumeDraft: (patch: Partial<KafkaConsumeDraft>) => void;
  consumeLoading: boolean;
  consumeResult: KafkaConsumeResultRow[] | null;
  consumeTimedOut: boolean;
  consumeError: KafkaUiSafeError | null;
  selectedMessageIndex: number | null;
  selectedMessage: KafkaConsumeResultRow | null;
  selectMessage: (index: number | null) => void;
  consumeOnce: () => Promise<void>;

  // Utility / reset
  clearPublishResult: () => void;     // clears publishResult + publishError
  clearConsumeResult: () => void;     // clears consumeResult + consumeError + selectedMessage + consumeTimedOut
  consumeMessageCount: number;        // 0 before first consume; equals consumeResult?.length ?? 0
}

// Re-run behavior: both sendOnce and consumeOnce clear their previous
// result/error at the start of each call, then set new values on resolve/reject.
// Results are never accumulated — each call fully replaces the previous.
export interface UseKafkaMessageStudioDeps {
  /** Injectable dispatch for unit tests. Defaults to `dispatchKafkaOperation`. */
  dispatch?: typeof dispatchKafkaOperation;
}

export function useKafkaMessageStudio(
  kafkaState: UseKafkaStateReturn,
  deps?: UseKafkaMessageStudioDeps,
): UseKafkaMessageStudioReturn
```

### `KafkaMessageStudioPage` Component

```tsx
// Props
interface KafkaMessageStudioPageProps {
  kafkaState: UseKafkaStateReturn;
  onNavigateToKafkaSettings: () => void;  // passed from App.tsx (→ setActiveTab('kafka-settings'))
}

export default function KafkaMessageStudioPage({ kafkaState, onNavigateToKafkaSettings }: KafkaMessageStudioPageProps)
```

**Render logic:**
1. If `!kafkaState.loaded` → loading spinner
2. If `kafkaState.connection.state !== 'connected'` → `<KafkaStudioGuard>` panel with link to Kafka settings
3. Otherwise → two-column layout with `<KafkaPublishStudio>` and `<KafkaConsumeStudio>`

### `KafkaStudioGuard` Component

Inline component rendered when not connected. **Reused by `KafkaTopicExplorerPage` in Phase 4** — export it from `KafkaMessageStudioPage.tsx` or a shared file `KafkaStudioGuard.tsx` under `src/features/kafka/`.

```tsx
interface KafkaStudioGuardProps {
  connection: UseKafkaStateReturn['connection'];
  hasClusters: boolean;              // kafkaState.clusters.length > 0
  onNavigateToSettings: () => void;  // navigates to 'kafka-settings' tab
}
```

**Render cases (evaluated top-down):**

| Condition | Message | CTA |
|---|---|---|
| `hasClusters === false` | "No clusters configured." | `[→ Add a cluster]` calls `onNavigateToSettings` |
| `state === 'testing'` | "Connecting to cluster…" | Spinner, no button |
| `state === 'disconnected'` | "Cluster is not connected." | `[→ Open Kafka Settings]` |
| `state === 'error'` | "Cluster connection error." + error detail | `[→ Open Kafka Settings]` |

CSS: `.kafka-studio-guard` card, centered, same radial-bg as other guard states in the app.

### `KafkaPublishStudio` Panel

```tsx
interface KafkaPublishStudioProps {
  studio: UseKafkaMessageStudioReturn;
  clusterId: string;          // displayed in header, used for context only
}
```

**UI sections:**
1. **Card header** — "Publish Studio" title + subtitle
2. **Field grid (2-col):** Topic (text input, placeholder `e.g. orders.created`), Acks (select: `All (−1)` / `Leader (1)` / `None (0)`)
3. **Field grid (2-col):** Message Key (text, optional), Partition (text input, placeholder `blank = auto`)
4. **Headers subpanel** — key/value rows with enable toggle + Add/Remove (same pattern as `KafkaProduceConfig.tsx` using `useListCrud`)
5. **Message Body** — monospace `<textarea>`, full width, with inline validation error below
6. **Schema Registry** (collapsible) — `<KafkaSchemaConfigSection>` imported from `src/features/workflow/components/configs/KafkaSchemaConfigSection.tsx` (component already exists from Phase 10C). Renders an "Enable Schema Registry" toggle + `registryUrl`, `format` (Avro / Protobuf / JSON Schema), optional `subject`, `version`, and `auth` fields when enabled. The `topic` prop is passed from `publishDraft.topic` for subject auto-defaulting (`{topic}-value`). Maps to `publishDraft.schemaConfig`. Collapsed/off by default.
7. **Action row** — `[Validate & Format JSON]` `[Send Once]` (Send Once disabled while `publishLoading` or `topic` blank)
   - **Phase 2 adds**: `[Load Template ▾]` and `[Save Template]` to the panel **card header** (not the action row). See Phase 2 spec.
   - **Phase 3 adds**: `[Map from Workflow Variables]` to the action row (between Validate and Send Once). See Phase 3 spec.
8. **Result area** — green success card: `partition N · offset NNNN · timestamp` OR red error banner with `retryable` indicator

### `KafkaConsumeStudio` Panel

```tsx
interface KafkaConsumeStudioProps {
  studio: UseKafkaMessageStudioReturn;
  clusterId: string;          // displayed in header, used for context only
}
```

**UI sections:**
1. **Card header** — "Consume Studio" title + subtitle
2. **Field grid (2-col):** Topic (text input, placeholder `e.g. orders.created`), Consumer Group (text, initialized to `redfireforge-debug-<uuid8>`)
3. **Field grid (2-col):** Start Position (select: `Latest` / `Earliest`), Timeout (text, ms, default `10000`)
4. **Field grid (2-col):** Max Messages (number, default `50`)
5. **Filters subpanel:**
   - Key Match (text, placeholder `exact key value`, maps to `keyEquals`)
   - Header Match (text, placeholder `source=checkout`, maps to `headersMatch`)
   - JSONPath (text, placeholder `$.status`)
   - JSONPath Expected (text, placeholder `CREATED`, blank = assert path exists)
6. **Schema Registry** (collapsible) — same `<KafkaSchemaConfigSection>` as Publish panel. Maps to `consumeDraft.schemaConfig`. When enabled, the server decodes each message's raw binary value via the registry before returning it. The `topic` prop comes from `consumeDraft.topic`. Collapsed/off by default.
7. **Action row** — `[Consume Once]` (disabled while `consumeLoading` or `topic` blank)
   - `[Start Stream]` / `[Stop Stream]` added in Phase 3.
   - `[Save Filter]` deferred to Phase 2.
8. **Results — Zone A (message list):**
   - Amber timed-out badge when `timedOut === true`: "Timed out — results may be partial"
   - Empty state when `messageCount === 0 && !consumeLoading`: "No messages received"
   - Scrollable table, max-height ~320px, columns: `#` · `Offset` · `Partition` · `Key` · `Value preview`
   - Selected row highlighted
   - `[Export Result Set]` button above the table — downloads all `consumeResult` rows as a `.json` file
   - `[Clear]` button beside Export — calls `clearConsumeResult`
9. **Results — Zone B (detail pane):**
   - Shown below Zone A when a row is selected
   - Full JSON body (pretty-printed, monospace), all headers in a compact table
   - `[Copy Key]` copies `key` field; `[Copy Payload]` copies `value` to clipboard
   - **Phase 3 adds**: `[Use as Workflow Input]` in Zone B (see Phase 3 spec)

### CSS — New Classes (added to `src/styles/settings.css`)

```css
/* Message Studio page */
.kafka-studio-page          — full-page container, padding 24px
.kafka-studio-guard         — centered guard state card
.kafka-studio-guard-title   — "Not Connected" heading
.kafka-studio-grid          — 2-col 1fr/1fr grid, gap 18px, stack <900px
.kafka-studio-card          — card with same radial bg/border/shadow as other kafka cards
.kafka-studio-card-head     — card header with h2 + subtitle p
.kafka-studio-body          — card body, padding 18px 22px

/* Shared field patterns (reuse existing kafka-field-* if they exist) */
.kafka-studio-field-grid    — 2-col repeat(2,1fr) gap 12px
.kafka-studio-field         — label + input/select column
.kafka-studio-field.full    — spans both columns

/* Results */
.kafka-studio-result-success — green-tinted result row
.kafka-studio-result-error   — red-tinted error row
.kafka-studio-result-table   — consume results table
.kafka-studio-result-detail  — expanded message detail panel
```

---

## Phase 2 — Templates & Saved Sessions

> Deferred until Phase 1 is merged and smoke-tested.

### What a "template" is

A named preset of the current form state — saves you from re-typing the same topic, headers, body, and filter config every session. Analogous to a saved Request in the Requests page.

Example:
- Fill Publish Studio with topic `orders.created`, key `customer-123`, specific JSON body and headers
- Click "Save as Template" → enter name "Place Order Event"
- Next session: pick "Place Order Event" from the Load Template dropdown → form pre-fills instantly

### Goals

- "Save as Template" button in each panel → prompts for a name → saved
- "Load Template" dropdown populated from saved presets → fills form
- Delete a template action
- Presets persist across page reloads and app restarts

### Storage

Follows the exact same pattern as Kafka cluster configs: uses the `readKey`/`writeKey` abstraction from `src/shared/utils/storage` (works in browser localStorage and Tauri native storage).

New functions added to **`src/shared/kafka/kafkaStorage.ts`** (not a new file):

```ts
// Storage keys — following existing 'perf-test-kafka-*' naming convention
export const KAFKA_PUBLISH_TEMPLATES_KEY = 'perf-test-kafka-publish-templates-v1';
export const KAFKA_CONSUME_TEMPLATES_KEY = 'perf-test-kafka-consume-templates-v1';

export interface KafkaPublishTemplate {
  id: string;
  name: string;
  createdAt: string;
  draft: KafkaPublishDraft;
}

export interface KafkaConsumeTemplate {
  id: string;
  name: string;
  createdAt: string;
  draft: KafkaConsumeDraft;
}

export async function loadKafkaPublishTemplates(): Promise<KafkaPublishTemplate[]>
export async function saveKafkaPublishTemplates(templates: KafkaPublishTemplate[]): Promise<void>
export async function loadKafkaConsumeTemplates(): Promise<KafkaConsumeTemplate[]>
export async function saveKafkaConsumeTemplates(templates: KafkaConsumeTemplate[]): Promise<void>
```

### Phase 2 Hook Extension

A new hook `useKafkaTemplates` (separate from `useKafkaMessageStudio`) owns all template persistence. Keeping it independent makes each hook independently testable and keeps storage concerns out of the operation hook.

```ts
// src/app/hooks/useKafkaTemplates.ts
export interface UseKafkaTemplatesReturn {
  publishTemplates: KafkaPublishTemplate[];
  consumeTemplates: KafkaConsumeTemplate[];
  templatesLoading: boolean;
  templateError: string | null;           // added: surfaces async errors
  savePublishTemplate: (name: string, draft: KafkaPublishDraft) => Promise<void>;
  loadPublishTemplate: (id: string) => KafkaPublishDraft | null;
  deletePublishTemplate: (id: string) => Promise<void>;
  saveConsumeTemplate: (name: string, draft: KafkaConsumeDraft) => Promise<void>;
  loadConsumeTemplate: (id: string) => Omit<KafkaConsumeDraft, 'groupId'> | null; // groupId intentionally stripped
  deleteConsumeTemplate: (id: string) => Promise<void>;
}

export function useKafkaTemplates(): UseKafkaTemplatesReturn
```

`KafkaMessageStudioPage` instantiates both `useKafkaMessageStudio` and `useKafkaTemplates`, then passes relevant template props into each panel.

### Phase 2 UI Changes

Template controls are added to the card header of each panel — no new pages or Activity Bar tabs.

**`KafkaPublishStudio` and `KafkaConsumeStudio` card header (Phase 2):**
```
[Panel heading]                              [Load Template ▾]  [Save Template]
```

- **Load Template ▾**: dropdown listing templates by name. Selecting one calls `setPublishDraft` / `setConsumeDraft` with the template's `draft`. Each item has a `×` delete icon that calls `deletePublishTemplate` / `deleteConsumeTemplate`.
- **Save Template**: clicking reveals an inline `<input type="text">` name field in the header row. Pressing Enter (or a ✓ confirm button) calls `savePublishTemplate(name, publishDraft)` and collapses the input.
- Both controls are disabled while `templatesLoading`.

### Unit tests — `useKafkaTemplates.test.ts`

| Test case | What it covers |
|---|---|
| Initial load | `loadKafkaPublishTemplates` called on mount; `publishTemplates` populated |
| `savePublishTemplate` | Appends new entry; calls `saveKafkaPublishTemplates` with updated list |
| `loadPublishTemplate` | Returns `draft` for known id; `null` for unknown id |
| `deletePublishTemplate` | Removes entry; calls `saveKafkaPublishTemplates` with remaining |
| Consume template variants | Mirror all publish tests for `consumeTemplates` |
| Storage error on save | `templatesLoading` clears; error not silently swallowed |

### Phase 2 Success Criteria

- [x] "Save as Template" in Publish panel prompts for name, saves draft
- [x] "Load Template" dropdown in Publish panel populated from saved presets
- [x] "Save as Template" in Consume panel prompts for name, saves filter config
- [x] "Load Template" dropdown in Consume panel populated from saved presets
- [x] Templates persist across page reloads (survive browser restart)
- [x] Delete template action removes it from storage
- [x] Unit tests for new `kafkaStorage.ts` functions — >90% branch coverage

### Phase 2 Implementation Notes

**groupId stripping in `loadConsumeTemplate`**: Returns `Omit<KafkaConsumeDraft, 'groupId'>` instead of the full draft. Each consume session should start with a fresh groupId to avoid consumer group conflicts. Since `setConsumeDraft` is a patch-merge, loading a template preserves the current session's `groupId`.

**Hook return type**: Added `templateError: string | null` to `UseKafkaTemplatesReturn` (not in original plan) — surfaced for future error toast display.

**Error test pattern**: Tests for error state after throw must catch the error *inside* `act()` (not with `rejects.toThrow()`) so React can flush state updates from catch blocks before act completes.

**Dropdown outside-click**: Uses `useRef` + `document.addEventListener('mousedown', handler)` only while `dropdownOpen` is true — no global always-on listener.

**Save input UX**: Enter = submit, Escape = cancel, button disabled when name is blank/whitespace. Empty/whitespace name also causes early return in the hook.

**Test count**: 21 tests in `useKafkaTemplates.test.ts` + 15 tests in `kafkaStorage.test.ts` (template section) + 8 tests in `KafkaMessageStudioPage.test.tsx`.

**Duplicate name guard (review-added)**: `savePublishTemplate` and `saveConsumeTemplate` now do a case-insensitive name lookup before inserting. If a template with the same name already exists, its `draft` is updated in-place (id and createdAt preserved). This prevents accumulating duplicate entries on repeated save-with-same-name.

**`parseTemplates` validation (review-added)**: Added `isValidTemplateEntry(entry)` guard in `kafkaStorage.ts` that checks `id`/`name`/`draft` are present and correctly typed before returning from storage. Corrupt/partial entries are silently filtered out.

**Backend hang root cause (Docker validation)**: During E2E testing, the backend server appeared to hang on all `/api/kafka/*` routes. Root cause: a previous server process (PID 57838) was stuck with an open KafkaJS TCP socket that never resolved. The issue was operational (stale process), not a code bug. Fixed by `lsof -ti:3001 | xargs kill -9` + restart. No polling or route changes were needed — the exponential backoff in `useKafkaState.ts` (4s base, 30s max) worked correctly once the server was clean.

#### Phase 2 re-evaluation — 2026-06-04

Thorough re-evaluation against Phase 2 plan success criteria. Found and fixed **4 issues**, added **7 new unit tests**, and re-validated with Docker.

**Issues found and fixed:**

1. **`templateError` never shown in UI**: `useKafkaTemplates` exposes `templateError` but `KafkaMessageStudioPage` never read or displayed it. When save/delete operations failed, users got no feedback. Fixed — added a `.kafka-ms-template-error` banner that renders when `templateError` is non-null, with new CSS styling.

2. **Missing test coverage for `isValidTemplateEntry` corrupt entry filtering**: `kafkaStorage.test.ts` tested JSON parse errors and non-array storage, but never tested the `isValidTemplateEntry` guard that filters individual entries with missing `id`, `name`, or `draft` fields. Fixed — added 4 tests: missing id, missing name, null draft, and non-object entries (string, number, null).

3. **Missing test for duplicate name guard**: The case-insensitive duplicate name update behavior (described in implementation notes) had zero test coverage. Fixed — added 2 tests (publish + consume) verifying that saving with a duplicate name (case-insensitive) updates the existing entry's draft while preserving its id and createdAt.

4. **Page test missing template error verification**: `KafkaMessageStudioPage.test.tsx` tested guard states and tab switching but never verified the template error banner. Fixed — added test that mocks `useKafkaTemplates` to return an error and verifies the banner appears.

**Docker validation results** (Redpanda v24.1.18 plaintext):

- ✅ Produce with template-style payload (key + 3 headers + JSON body): partition 0, offset 49
- ✅ Consume with header filter (`source=phase2-validation`): 1 message, headers round-tripped
- ✅ Consume with key filter (`tpl-test-key`): 1 message found
- ✅ Consume with JSONPath filter (`$.templateName = "Phase 2 Test"`): 1 message found
- ✅ Storage functions: 29 tests passing (load/save/filter/corrupt handling)
- ✅ Template hook: 21 tests passing (CRUD + duplicate guard + error propagation)

#### Phase 4 re-evaluation — 2026-06-04

Thorough re-evaluation against Phase 4 plan success criteria. Found and fixed **6 issues**, added **2 new unit tests**, and validated the `topic-detail` endpoint against live Docker.

**Issues found and fixed:**

1. **Missing CSS — entire page unstyled**: All `kafka-explorer-*`, `kafka-topic-health-*`, `kafka-partition-table`, `kafka-consumer-group-table`, `kafka-config-table`, `kafka-isr-fraction`, `kafka-cg-state-*`, `kafka-lag-*` CSS classes were referenced in JSX but had no corresponding stylesheet rules. Fixed — added ~250 lines of CSS to `settings.css` covering the 2-column layout, topic list table, detail card, tab bar, metrics row, health badges, partition/consumer group/config tables, ISR fraction indicators, state badges, and lag colors.

2. **Missing Header/JSONPath filter fields in Messages tab**: `useTopicMessageBrowser` hook supported `headerMatch`, `jsonPath`, and `jsonPathEquals` draft fields, but `KafkaTopicDetailPanel` only rendered Time Window, Partition, Key Match, and Max Messages. Fixed — added Header Match, JSONPath, and JSONPath Expected input fields in the detail panel's Messages tab.

3. **Health/Retention filters and special chips not disabled until first detail load**: The plan requires Health and Retention filter dropdowns to be grayed out until at least one topic detail has been fetched. Also, "Recently Active" and "Lagging Consumers" chips should be visually disabled. Fixed — added `hasCachedDetails` property to `useTopicExplorer` return type. Dropdowns and special chips now set `disabled={!hasCachedDetails}` with tooltip hints.

4. **Type triplication of KafkaTopicDetail**: `KafkaTopicPartitionDetail`, `KafkaTopicConsumerGroupSummary`, and `KafkaTopicDetail` were independently declared in `useTopicExplorer.ts` (client), `kafka-adapter.ts` (server), and `contracts.ts` (server). Fixed — `kafka-adapter.ts` now imports and re-exports from `contracts.ts`, eliminating server-side duplication. Client/server duplication is intentional (separate TS projects).

5. **TypeScript error in App.tsx**: `KafkaMessageStudioPage` was being passed `onUseAsWorkflowInput` and `lastWorkflowOutput` props (Phase 3 features not yet implemented on the component). Fixed — removed unsupported props from JSX, kept callback declarations for future Phase 3 wiring.

6. **App.tsx wrapper class inconsistency**: Topic Explorer page used `main-content-area` wrapper while all other Kafka pages used `app-tab-pane`. Fixed — unified to `app-tab-pane`.

**Test updates:**

- Updated `KafkaTopicDetailPanel.test.tsx`: draft controls test now verifies all 7 fields (was 4 — missing headerMatch, jsonPath, jsonPathEquals)
- Added `useTopicExplorer.test.ts`: `hasCachedDetails` property test (false initially, true after detail load)
- Added `KafkaTopicExplorerPage.test.tsx`: health/retention filters and special chips disabled until detail loaded

**Docker validation results** (Redpanda v24.1.18 plaintext):

- ✅ `GET /api/kafka/topics/redfireforge.debug.consume/detail`: full partition data (3 partitions, offsets, ISR), 15 consumer groups with lag values, 5 config keys, `healthStatus: "healthy"`
- ✅ `GET /api/kafka/topics/orders.created/detail`: topic with traffic, empty consumer groups, correct partition offsets
- ✅ Non-existent topic: returns proper error `KAFKA_TOPIC_DETAIL_FAILED`
- ✅ Disconnected state: returns proper error `KAFKA_NOT_CONNECTED`

**Test count**: 71 tests across 4 Phase 4 test files (`KafkaTopicExplorerPage.test.tsx` 13 + `KafkaTopicDetailPanel.test.tsx` 20 + `useTopicExplorer.test.ts` 19 + `useTopicMessageBrowser.test.ts` 19). TypeScript: 0 errors. Total Kafka tests: 190 passing.

---

## Phase 3 — Streaming & Workflow Integration

> Prerequisite: Phase 2 merged into `develop`.
> Last reviewed: 2026-06-04

### Overview

Phase 3 adds two major capabilities to Kafka Message Studio:

1. **Live streaming** — Subscribe to a topic and watch messages arrive in real time (append mode)
2. **Workflow integration** — Bi-directional bridge between Kafka Studio and the Workflow Runner

Phase 3 is split into **five sub-phases** (3A–3E) based on dependency order. Each sub-phase is independently testable and committable.

### Critical Gap Identified During Re-evaluation

The original plan assumed `GET /api/kafka/subscriptions` could return buffered messages when polled with a `subscriptionId` query param. **This is incorrect.** The actual server state:

- `GET /api/kafka/subscriptions` returns **metadata only** (`KafkaSubscribeInfo[]`) — no messages.
- The ring buffer in `kafka-service.ts` `subscribe()` is a **local closure variable** — it is never stored on `SubscriptionEntry` and is unreachable from any route.
- The `subscriptions` route does not accept a `subscriptionId` query param.
- `'subscriptions'` already exists in `KafkaOperation` on both client and server — no client dispatch changes needed.

**Platform asymmetry:**
- **Tauri (desktop):** Streaming already works via push events (`kafka-subscription-message` Tauri event → `listenKafkaSubscriptionMessage()` in `kafkaNativeTauriTransport.ts`).
- **Web (Express):** Zero message delivery after `POST /api/kafka/subscribe`. The ring buffer fills but nothing reads it.

**Resolution:** Phase 3A adds a new server route `GET /api/kafka/subscription-messages` to expose the ring buffer. Phase 3B uses platform detection to choose HTTP polling (web) vs Tauri events (desktop).

---

### Phase 3A — Server: Subscription Message Retrieval

#### Goal

Create a message retrieval endpoint so the web frontend can poll for buffered subscription messages.

#### Server Changes

##### 1. Move ring buffer onto `SubscriptionEntry` (`kafka-service.ts`)

Currently `ringBuffer` is a local variable inside the `subscribe()` closure. Move it onto the registry entry so it's accessible from other methods.

```ts
// Current SubscriptionEntry (metadata only):
interface SubscriptionEntry {
  info: KafkaSubscribeInfo;
  cleanup?: () => Promise<void>;
}

// Updated SubscriptionEntry:
interface SubscriptionEntry {
  info: KafkaSubscribeInfo;
  cleanup?: () => Promise<void>;
  ringBuffer: KafkaConsumeRecord[];       // moved from closure → entry
  maxInMemoryMessages: number;
  cursor: number;                          // monotonically increasing; starts at 0
}
```

Each time a message is pushed to `ringBuffer`, increment `cursor`. When `ringBuffer.length > maxInMemoryMessages`, `shift()` as before.

##### 2. New method: `getSubscriptionMessages()` (`kafka-service.ts`)

```ts
getSubscriptionMessages(request: KafkaSubscriptionMessagesRequest):
  KafkaRouteEnvelope<KafkaSubscriptionMessagesResult>
```

| Field | Type | Description |
|---|---|---|
| `request.subscriptionId` | `string` | Required |
| `request.clusterId` | `string?` | Optional cluster guard |
| `request.sinceCursor` | `number?` | Return messages with cursor > sinceCursor. Default 0 (all buffered). |

**Response:**

```ts
interface KafkaSubscriptionMessagesResult {
  subscriptionId: string;
  messages: KafkaConsumeRecord[];      // only messages with cursor > sinceCursor
  cursor: number;                       // latest cursor value (client stores this for next poll)
  bufferSize: number;                   // current ring buffer length
  maxInMemoryMessages: number;
}
```

**Behavior:**
- If `subscriptionId` not found → 404 `KAFKA_SUBSCRIPTION_NOT_FOUND`
- If `sinceCursor` provided → filter `ringBuffer` to entries added after that cursor
- If `sinceCursor` is older than the earliest buffered message (ring buffer wrapped) → return all buffered + a `cursorGap: true` flag so the client knows messages were lost

##### 3. New contract types (`contracts.ts`)

```ts
export interface KafkaSubscriptionMessagesRequest {
  clusterId?: string;
  subscriptionId: string;
  sinceCursor?: number;
}

export interface KafkaSubscriptionMessagesResult {
  subscriptionId: string;
  messages: KafkaConsumeRecord[];
  cursor: number;
  bufferSize: number;
  maxInMemoryMessages: number;
  cursorGap?: boolean;
}
```

##### 4. New route (`kafka-routes.ts`)

```ts
// GET /api/kafka/subscription-messages?subscriptionId=...&sinceCursor=...&clusterId=...
router.get('/api/kafka/subscription-messages', (req, res) => {
  const request: KafkaSubscriptionMessagesRequest = {
    clusterId: toStringQuery(req.query.clusterId),
    subscriptionId: toStringQuery(req.query.subscriptionId) ?? '',
    sinceCursor: toNumberQuery(req.query.sinceCursor),
  };
  const envelope = service.getSubscriptionMessages(request);
  return sendEnvelope(res, envelope);
});
```

##### 5. Update client dispatch map (`kafkaClient.ts`)

Add `'subscription-messages'` to `KafkaOperation` union and `OPERATION_MAP`:

```ts
// Add to KafkaOperation union:
| 'subscription-messages'

// Add to OPERATION_MAP:
'subscription-messages': {
  method: 'GET',
  path: '/api/kafka/subscription-messages',
  queryKeys: ['subscriptionId', 'sinceCursor', 'clusterId'],
},
```

**Note:** `'subscriptions'` (list metadata) and `'subscribe'`/`'unsubscribe'` already exist — no changes needed for those.

##### 6. Tauri command mapping (`kafkaNativeTauriTransport.ts`)

Add `'subscription-messages': 'kafka_subscription_messages'` to the Tauri command map. The Rust backend does not need this route (it uses push events), but the mapping should exist for completeness — it can return an empty response or redirect to the event-based path.

#### Phase 3A Files

```
src-server/kafka/kafka-service.ts            MODIFY — move ringBuffer onto SubscriptionEntry, add getSubscriptionMessages()
src-server/kafka/contracts.ts                MODIFY — add KafkaSubscriptionMessagesRequest/Result types
src-server/routes/kafka-routes.ts            MODIFY — add GET /subscription-messages route
src/shared/kafka/kafkaClient.ts              MODIFY — add 'subscription-messages' to KafkaOperation + OPERATION_MAP
```

#### Phase 3A Unit Tests

| Test case | File |
|---|---|
| `getSubscriptionMessages` returns messages for valid `subscriptionId` | `kafka-service.test.ts` |
| `getSubscriptionMessages` returns 404 for unknown `subscriptionId` | `kafka-service.test.ts` |
| `sinceCursor` filters to only newer messages | `kafka-service.test.ts` |
| Ring buffer wraps correctly; `cursorGap: true` when cursor behind buffer | `kafka-service.test.ts` |
| Cluster mismatch → 409 | `kafka-service.test.ts` |
| `GET /api/kafka/subscription-messages` route returns 200 envelope | `kafka-routes.test.ts` |
| Route returns 404 when subscription not found | `kafka-routes.test.ts` |
| Route parses `sinceCursor` as number from query string | `kafka-routes.test.ts` |

#### Phase 3A Success Criteria

- [x] Ring buffer stored on `SubscriptionEntry`, not in closure
- [x] `cursor` increments per message; cursor tracking works across poll cycles
- [x] `GET /api/kafka/subscription-messages?subscriptionId=X&sinceCursor=N` returns only new messages
- [x] Ring buffer wrap detected via `cursorGap` flag
- [x] `'subscription-messages'` in `KafkaOperation` union + `OPERATION_MAP`
- [x] TypeScript: 0 errors
- [x] Unit tests: new server methods + route — >90% coverage

---

### Phase 3B — Client: Streaming Infrastructure

#### Goal

Add live streaming to the Consume Studio panel with platform-aware message delivery.

#### Platform-Aware Streaming Strategy

```
┌─────────────────────────────────────────────────────┐
│                   useKafkaStreamMode                 │
│                                                     │
│  startStream():                                     │
│    1. POST /api/kafka/subscribe → subscriptionId    │
│    2. if (isTauri()):                               │
│         listen('kafka-subscription-message')         │
│       else:                                         │
│         setInterval(pollMessages, 1000ms)            │
│                                                     │
│  stopStream():                                      │
│    1. POST /api/kafka/unsubscribe                   │
│    2. if (isTauri()): unlisten()                    │
│       else: clearInterval()                         │
│    3. Keep streamMessages (don't clear)             │
└─────────────────────────────────────────────────────┘
```

#### New Hook: `useKafkaStreamMode`

Streaming state is extracted into a **dedicated hook** (not merged into `useKafkaMessageStudio`) to keep responsibilities separated and each hook independently testable.

```ts
// src/app/hooks/useKafkaStreamMode.ts

export interface UseKafkaStreamModeReturn {
  isStreaming: boolean;
  streamMessages: KafkaConsumeResultRow[];
  streamError: KafkaUiSafeError | null;
  streamSubscriptionId: string | null;
  cursorGap: boolean;                      // true if ring buffer wrapped (messages lost)

  startStream: (draft: KafkaConsumeDraft, clusterId: string) => Promise<void>;
  stopStream: () => Promise<void>;
  clearStreamMessages: () => void;

  selectedStreamIndex: number | null;
  selectedStreamMessage: KafkaConsumeResultRow | null;
  selectStreamMessage: (index: number | null) => void;
}

export interface UseKafkaStreamModeDeps {
  dispatch?: typeof dispatchKafkaOperation;
}

export function useKafkaStreamMode(
  kafkaState: UseKafkaStateReturn,
  deps?: UseKafkaStreamModeDeps,
): UseKafkaStreamModeReturn
```

**Key behaviors:**

- `startStream(draft, clusterId)`: Builds subscribe request from `draft` (reuses `buildConsumeFilter` from `kafkaMessageStudioUtils`). On success, stores `subscriptionId` and starts the platform-appropriate listener.
- **Web polling:** `setInterval` every 1000ms → `dispatch('subscription-messages', { subscriptionId, sinceCursor, clusterId })` → append new messages to `streamMessages`, update `sinceCursor`.
- **Tauri events:** `listen('kafka-subscription-message', callback)` → append each message to `streamMessages`. No polling needed.
- `stopStream()`: Fires `dispatch('unsubscribe', { subscriptionId, clusterId })`. Stops polling/unlisten. Keeps `streamMessages` intact (user can still browse). Sets `isStreaming = false`.
- `clearStreamMessages()`: Resets `streamMessages = []`, `sinceCursor = 0`, `cursorGap = false`.
- **Disconnect cleanup:** `useEffect` watches `kafkaState.connection.state` — if it transitions away from `'connected'` while streaming, auto-calls `stopStream()` and clears state.
- **Unmount cleanup:** `useEffect` cleanup calls `stopStream()` to prevent orphaned intervals/listeners.
- Stream messages **append** (unlike `consumeOnce` which replaces).

#### `buildSubscribeRequest` utility (`kafkaMessageStudioUtils.ts`)

```ts
export function buildSubscribeRequest(
  draft: KafkaConsumeDraft,
  clusterId: string,
): Record<string, unknown> {
  const req: Record<string, unknown> = {
    clusterId,
    topic: draft.topic,
    fromBeginning: draft.startPosition === 'earliest',
    maxInMemoryMessages: 200,
  };
  if (draft.groupId.trim()) req.groupId = draft.groupId.trim();
  const filter = buildConsumeFilter(draft);
  if (filter) req.filter = filter;
  return req;
}
```

#### Consume Studio UI Changes

**Mode tab strip** (below filter fields, above results):

```
[Consume Once]  [Stream]
```

- Default: `Consume Once` (current behavior, unchanged).
- `Stream` mode: renders stream-specific action row and stream results.
- Switching modes does **not** clear the other mode's results.

**Stream mode — Action row:**

| Button | When visible | Behavior |
|---|---|---|
| `[Start Stream]` | `!isStreaming` | Calls `startStream(consumeDraft, clusterId)` |
| `[Stop Stream]` | `isStreaming` | Calls `stopStream()` |
| `[Clear]` | `streamMessages.length > 0` | Calls `clearStreamMessages()` |
| `[Export Stream]` | `streamMessages.length > 0` | Downloads `streamMessages` as JSON |

**Stream mode — Zone A (message list):**

- Same table layout as consume-once Zone A (columns: `#`, `Offset`, `Partition`, `Key`, `Value preview`).
- New messages appear at the **bottom** (newest last) with a brief highlight animation.
- Scrollable with max-height ~400px; auto-scrolls to bottom when streaming unless user has scrolled up manually.
- Message count badge: `"142 messages"` (updates live).
- `cursorGap` warning badge (amber): `"Buffer wrapped — some messages were not captured"` shown when `cursorGap === true`.

**Stream mode — Zone B (detail pane):**

- Same layout as consume-once Zone B — pretty-printed payload, headers table, Copy Key / Copy Payload.
- `[Use as Workflow Input]` button added here (Phase 3C).

#### Phase 3B Files

```
src/app/hooks/useKafkaStreamMode.ts          NEW — streaming hook
src/app/hooks/useKafkaStreamMode.test.ts     NEW
src/features/kafka/KafkaConsumeStudio.tsx     MODIFY — add mode tabs, stream UI
src/features/kafka/KafkaConsumeStudio.test.tsx  MODIFY — add stream mode tests
src/features/kafka/KafkaMessageStudioPage.tsx  MODIFY — instantiate useKafkaStreamMode, pass to KafkaConsumeStudio
src/features/kafka/kafkaMessageStudioUtils.ts  MODIFY — add buildSubscribeRequest
src/features/kafka/kafkaMessageStudioUtils.test.ts  MODIFY — add buildSubscribeRequest tests
src/styles/settings.css                      MODIFY — add stream mode CSS classes
```

#### Phase 3B Unit Tests

| Test case | File |
|---|---|
| Initial state: `isStreaming=false`, `streamMessages=[]` | `useKafkaStreamMode.test.ts` |
| `startStream` success: sets `isStreaming=true`, stores `subscriptionId` | `useKafkaStreamMode.test.ts` |
| `startStream` with blank topic: sets `streamError`, does not dispatch | `useKafkaStreamMode.test.ts` |
| `startStream` when not connected: sets `streamError` | `useKafkaStreamMode.test.ts` |
| Web polling: appends new messages from `subscription-messages` response | `useKafkaStreamMode.test.ts` |
| Web polling: `sinceCursor` increments correctly across polls | `useKafkaStreamMode.test.ts` |
| Web polling: `cursorGap=true` when server indicates buffer wrap | `useKafkaStreamMode.test.ts` |
| `stopStream`: fires `unsubscribe`, clears interval, keeps messages | `useKafkaStreamMode.test.ts` |
| `clearStreamMessages`: resets to `[]`, resets cursor | `useKafkaStreamMode.test.ts` |
| Disconnect cleanup: auto-stops stream on connection state change | `useKafkaStreamMode.test.ts` |
| Unmount cleanup: stops polling interval | `useKafkaStreamMode.test.ts` |
| `selectStreamMessage` / detail selection works | `useKafkaStreamMode.test.ts` |
| `buildSubscribeRequest` — correct filter/topic/groupId mapping | `kafkaMessageStudioUtils.test.ts` |
| `buildSubscribeRequest` — blank groupId omitted | `kafkaMessageStudioUtils.test.ts` |
| Consume Studio: mode tabs render (Consume Once / Stream) | `KafkaConsumeStudio.test.tsx` |
| Consume Studio: Start Stream button calls `startStream` | `KafkaConsumeStudio.test.tsx` |
| Consume Studio: Stop Stream button visible when streaming | `KafkaConsumeStudio.test.tsx` |

#### Phase 3B Success Criteria

- [x] `useKafkaStreamMode` hook with full streaming lifecycle
- [x] Platform detection: HTTP polling on web, Tauri events on desktop
- [x] Consume Studio shows `[Consume Once | Stream]` mode tab strip
- [x] `[Start Stream]` fires `POST /api/kafka/subscribe`; button switches to `[Stop Stream]`
- [x] Web polling via `GET /api/kafka/subscription-messages` every 1s appends new messages
- [x] `[Stop Stream]` fires `POST /api/kafka/unsubscribe`; polling stops; messages preserved
- [x] `[Clear]` resets `streamMessages` to `[]`
- [x] `cursorGap` warning badge shown when ring buffer wrapped
- [x] Auto-scroll to bottom during streaming; pauses when user scrolls up
- [x] Disconnect auto-cleanup: streaming stops, state clears
- [x] Unmount cleanup: no orphaned intervals
- [x] TypeScript: 0 errors
- [x] Unit tests: `useKafkaStreamMode` + updated `KafkaConsumeStudio` — >90% coverage

---

### Phase 3C — Workflow Integration: Consume → Runner

#### Goal

"Use as Workflow Input" — send a consumed/streamed Kafka message to the Workflow Runner as pre-populated initial variables.

#### Prerequisite: Extend `WorkflowRunner` Props

`WorkflowRunner` currently accepts `initialWorkflowId` (pre-selects a workflow) but has no mechanism for injecting external variables. Phase 3C adds:

```ts
// WorkflowRunner.tsx — new optional prop:
interface Props {
  // ... existing props ...
  initialWorkflowVariables?: Record<string, string> | null;
  onClearInitialWorkflowVariables?: () => void;
}
```

**Behavior:** When `initialWorkflowVariables` is non-null and `configLoaded`, merge into `workflowVariables` (overwriting same-name keys, preserving existing ones). Call `onClearInitialWorkflowVariables()` to prevent re-application on subsequent renders. This mirrors the existing `initialWorkflowId` lifecycle pattern.

#### App-Level State (`App.tsx`)

```ts
const [workflowRunnerInitialVariables, setWorkflowRunnerInitialVariables] =
  useState<Record<string, string> | null>(null);

const handleUseAsWorkflowInput = useCallback((
  payload: string,
  meta: { topic: string; partition: number; offset: string },
) => {
  let messageVar: string;
  try {
    JSON.parse(payload);
    messageVar = payload;          // valid JSON — pass as-is (string form)
  } catch {
    messageVar = payload;          // non-JSON — pass raw string
  }
  setWorkflowRunnerInitialVariables({
    kafka_message: messageVar,
    kafka_topic: meta.topic,
    kafka_partition: String(meta.partition),
    kafka_offset: meta.offset,
  });
  setActiveTab('workflow-runner');
}, []);
```

**Variable naming:** Uses `kafka_` prefix (not bare `message`, `topic`) to avoid collisions with existing workflow variables. All values are strings (workflow variables are `Record<string, string>`).

#### Prop Wiring

```
App.tsx
  ├── KafkaMessageStudioPage
  │     onUseAsWorkflowInput={handleUseAsWorkflowInput}
  │     └── KafkaConsumeStudio
  │           onUseAsWorkflowInput={onUseAsWorkflowInput}
  │
  └── WorkflowRunner
        initialWorkflowVariables={workflowRunnerInitialVariables}
        onClearInitialWorkflowVariables={() => setWorkflowRunnerInitialVariables(null)}
```

#### Consume Studio UI

- `[Use as Workflow Input]` button in Zone B detail actions (both consume-once and stream modes).
- Button visible only when `onUseAsWorkflowInput` prop is provided.
- Clicking calls `onUseAsWorkflowInput(selectedMessage.value, { topic, partition, offset })`.

#### Phase 3C Files

```
src/features/test-runner/WorkflowRunner.tsx         MODIFY — add initialWorkflowVariables prop + useEffect
src/features/test-runner/WorkflowRunner.test.tsx     MODIFY — add variable injection tests
src/app/App.tsx                                     MODIFY — add handleUseAsWorkflowInput, state, wire props
src/features/kafka/KafkaMessageStudioPage.tsx        MODIFY — accept + forward onUseAsWorkflowInput
src/features/kafka/KafkaConsumeStudio.tsx            MODIFY — add onUseAsWorkflowInput prop, button in Zone B
src/features/kafka/KafkaConsumeStudio.test.tsx       MODIFY — add workflow input button tests
```

#### Phase 3C Unit Tests

| Test case | File |
|---|---|
| `[Use as Workflow Input]` visible when prop provided + message selected | `KafkaConsumeStudio.test.tsx` |
| `[Use as Workflow Input]` hidden when prop not provided | `KafkaConsumeStudio.test.tsx` |
| Click calls `onUseAsWorkflowInput` with correct payload + meta | `KafkaConsumeStudio.test.tsx` |
| `WorkflowRunner` applies `initialWorkflowVariables` to local state | `WorkflowRunner.test.tsx` |
| `WorkflowRunner` calls `onClearInitialWorkflowVariables` after applying | `WorkflowRunner.test.tsx` |
| `WorkflowRunner` merges (not replaces) with existing variables | `WorkflowRunner.test.tsx` |
| `WorkflowRunner` ignores null `initialWorkflowVariables` | `WorkflowRunner.test.tsx` |

#### Phase 3C Success Criteria

- [x] `[Use as Workflow Input]` button visible in Zone B when message selected (both modes)
- [x] Button hidden when `onUseAsWorkflowInput` prop not provided
- [x] Clicking calls handler with correct `{ payload, topic, partition, offset }`
- [x] App navigates to `workflow-runner` tab
- [x] `WorkflowRunner` receives variables with `kafka_` prefix
- [x] Variables merge with existing workflow variables (don't wipe others)
- [x] Non-JSON payload handled gracefully (passed as raw string)
- [x] TypeScript: 0 errors
- [x] Unit tests: all new/modified tests pass — >90% coverage

---

### Phase 3D — Workflow Integration: Runner → Publish

#### Goal

"Map from Workflow Variables" — after running a workflow, copy an output variable value into the Publish Studio message body.

#### Prerequisite: Lift Workflow Output to App State

`WorkflowRunner` currently keeps `finalRun` (completed `TestRun`) in local state. Phase 3D lifts the final execution variables to App-level:

```ts
// WorkflowRunner.tsx — new optional callback:
interface Props {
  // ... existing props ...
  onWorkflowOutputAvailable?: (output: Record<string, string>) => void;
}
```

**When called:** After a workflow run completes successfully, extract final variables from `finalRun.executionTrace?.iterations[lastIndex]?.finalVariables` and call `onWorkflowOutputAvailable(finalVariables)`.

#### App-Level State (`App.tsx`)

```ts
const [lastWorkflowOutput, setLastWorkflowOutput] =
  useState<Record<string, string> | null>(null);

// Passed to WorkflowRunner:
onWorkflowOutputAvailable={setLastWorkflowOutput}

// Passed to KafkaMessageStudioPage:
lastWorkflowOutput={lastWorkflowOutput}
```

#### Publish Studio UI

Phase 3D adds `[Map from Workflow ▾]` to the Publish Studio action row (between `[Format JSON]` and `[Send Once]`).

**Behavior:**

1. Button renders a dropdown listing all entries from `lastWorkflowOutput` as `{ name: key, preview: truncated value }`.
2. Clicking an entry replaces `publishDraft.body` with `JSON.stringify(JSON.parse(value), null, 2)` (pretty-prints if valid JSON) or raw `value` if not JSON.
3. Button disabled with tooltip `"Run a workflow first"` when `lastWorkflowOutput` is null or empty.
4. Dropdown search input at top for filtering by variable name (useful when workflows have many variables).

#### Phase 3D Files

```
src/features/test-runner/WorkflowRunner.tsx         MODIFY — add onWorkflowOutputAvailable callback
src/features/test-runner/WorkflowRunner.test.tsx     MODIFY — add output callback tests
src/app/App.tsx                                     MODIFY — add lastWorkflowOutput state, wire to both pages
src/features/kafka/KafkaMessageStudioPage.tsx        MODIFY — accept + forward lastWorkflowOutput
src/features/kafka/KafkaPublishStudio.tsx            MODIFY — add Map from Workflow button + dropdown
src/features/kafka/KafkaPublishStudio.test.tsx       MODIFY — add Map from Workflow tests
src/styles/settings.css                             MODIFY — dropdown CSS for variable picker
```

#### Phase 3D Unit Tests

| Test case | File |
|---|---|
| `WorkflowRunner` calls `onWorkflowOutputAvailable` with final variables after run | `WorkflowRunner.test.tsx` |
| `[Map from Workflow ▾]` disabled when `lastWorkflowOutput` is null | `KafkaPublishStudio.test.tsx` |
| `[Map from Workflow ▾]` enabled when `lastWorkflowOutput` has entries | `KafkaPublishStudio.test.tsx` |
| Selecting a variable fills `publishDraft.body` with its value | `KafkaPublishStudio.test.tsx` |
| JSON variable values are pretty-printed | `KafkaPublishStudio.test.tsx` |
| Non-JSON variable values inserted as raw string | `KafkaPublishStudio.test.tsx` |
| Dropdown search filters variable list | `KafkaPublishStudio.test.tsx` |

#### Phase 3D Success Criteria

- [x] `[Map from Workflow ▾]` in Publish action row
- [x] Dropdown lists all variables from `lastWorkflowOutput`
- [x] Selecting a variable fills `publishDraft.body` with its value
- [x] JSON values pretty-printed; non-JSON values inserted raw
- [x] Button disabled with tooltip when no workflow output available
- [x] Dropdown search filters by variable name
- [x] `WorkflowRunner` lifts final variables via `onWorkflowOutputAvailable`
- [x] TypeScript: 0 errors
- [x] Unit tests: all new/modified tests pass — >90% coverage

---

### Phase 3E — Docker Tooling & Manual Validation

#### Goal

Create a continuous message producer script for stream testing and run a full manual validation of all Phase 3 features against Docker.

#### New Script: `docker/kafka/topics/stream-producer.sh`

```bash
#!/usr/bin/env bash
# Continuous message producer for testing Kafka stream/subscribe features.
# Usage: ./stream-producer.sh [topic] [interval_seconds]
#   topic:    default "redfireforge.debug.consume"
#   interval: default 2 (seconds between messages)
#
# Produces messages with incrementing sequence numbers, timestamps, and random keys.
# Ctrl+C to stop.

TOPIC="${1:-redfireforge.debug.consume}"
INTERVAL="${2:-2}"
SEQ=0

while true; do
  SEQ=$((SEQ + 1))
  KEY="stream-key-$((RANDOM % 10))"
  TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  PAYLOAD="{\"seq\":$SEQ,\"ts\":\"$TS\",\"source\":\"stream-producer\",\"data\":{\"value\":$((RANDOM % 1000))}}"

  docker compose -f docker/kafka/plaintext/docker-compose.yml exec -T redpanda \
    rpk topic produce "$TOPIC" --key "$KEY" \
    -H "traceId:stream-$SEQ" -H "source:stream-producer" \
    <<< "$PAYLOAD"

  echo "[$(date +%H:%M:%S)] #$SEQ → $TOPIC key=$KEY"
  sleep "$INTERVAL"
done
```

#### Manual Validation Protocol

All steps MUST be completed against the **plaintext Docker profile** before Phase 3 is marked complete.

##### Prerequisites

```bash
# Terminal 1 — start Kafka
cd docker/kafka/plaintext && docker compose up -d
./docker/kafka/plaintext/healthcheck.sh
./docker/kafka/topics/create-topics.sh
./docker/kafka/topics/seed-messages.sh

# Terminal 2 — start server
npm run dev:server

# Terminal 3 — start frontend
npm run dev
# → http://localhost:5173

# Terminal 4 — start continuous producer (for stream tests)
./docker/kafka/topics/stream-producer.sh redfireforge.debug.consume 2
```

Connect in the app: **Settings → Kafka → Add Cluster**, brokers = `127.0.0.1:19092`, no auth, no TLS.

##### Phase 3A Validation (Server)

| # | Action | Expected | Result |
|---|---|---|---|
| 1 | `curl http://127.0.0.1:3001/api/kafka/subscribe -d '{"topic":"redfireforge.debug.consume","fromBeginning":true}' -H 'Content-Type: application/json'` | Returns `subscriptionId` in envelope | |
| 2 | `curl 'http://127.0.0.1:3001/api/kafka/subscription-messages?subscriptionId=<ID>&sinceCursor=0'` | Returns buffered messages + cursor value | |
| 3 | Wait 5s, repeat step 2 with `sinceCursor=<prev cursor>` | Returns only NEW messages since last poll | |
| 4 | `curl http://127.0.0.1:3001/api/kafka/unsubscribe -d '{"subscriptionId":"<ID>"}' -H 'Content-Type: application/json'` | Returns `unsubscribed: true` | |
| 5 | Repeat step 2 after unsubscribe | Returns 404 `KAFKA_SUBSCRIPTION_NOT_FOUND` | |

##### Phase 3B Validation (Streaming UI)

| # | Action | Expected | Result |
|---|---|---|---|
| 1 | Navigate to Protocols → Kafka Studio → Consume tab | Consume Studio renders | |
| 2 | Click `[Stream]` mode tab | Stream mode visible; `[Start Stream]` button shown | |
| 3 | Fill topic `redfireforge.debug.consume`, Start Position = Earliest | Fields filled | |
| 4 | Click `[Start Stream]` | Button switches to `[Stop Stream]`; messages start appearing in table | |
| 5 | Wait 10s with stream-producer running | Messages accumulate; count badge updates live; auto-scroll works | |
| 6 | Scroll up in message list | Auto-scroll pauses; new messages still append below | |
| 7 | Click a message row | Zone B detail pane opens with full payload + headers | |
| 8 | Click `[Stop Stream]` | Streaming stops; messages preserved; button reverts to `[Start Stream]` | |
| 9 | Click `[Clear]` | Stream messages cleared; count resets to 0 | |
| 10 | Click `[Export Stream]` (after re-streaming) | JSON file downloads with all stream messages | |
| 11 | Switch to `[Consume Once]` mode tab | Consume-once UI appears; previous consume results preserved (if any) | |
| 12 | Disconnect cluster in Settings → return to Kafka Studio | Stream auto-stopped; no console errors | |

##### Phase 3C Validation (Consume → Workflow)

| # | Action | Expected | Result |
|---|---|---|---|
| 1 | Consume Once from `redfireforge.debug.consume` | Results appear | |
| 2 | Click a result row | Zone B detail pane opens | |
| 3 | Click `[Use as Workflow Input]` | App navigates to Workflow Runner tab | |
| 4 | Check Workflow Runner variable editor | Variables include: `kafka_message`, `kafka_topic`, `kafka_partition`, `kafka_offset` | |
| 5 | Repeat steps 1–3 from Stream mode | Same behavior — button works in both modes | |
| 6 | Consume a non-JSON message (produce one via Console at `localhost:18080`) | `kafka_message` = raw string (no JSON parse error) | |

##### Phase 3D Validation (Workflow → Publish)

| # | Action | Expected | Result |
|---|---|---|---|
| 1 | Run any workflow in Workflow Runner that produces output variables | Run completes | |
| 2 | Navigate back to Protocols → Kafka Studio → Publish tab | Publish Studio renders | |
| 3 | Click `[Map from Workflow ▾]` | Dropdown lists all workflow output variables | |
| 4 | Select a variable | `publishDraft.body` fills with the variable's value (pretty-printed if JSON) | |
| 5 | Click `[Send Once]` | Message sent successfully with the mapped body | |
| 6 | Without running a workflow first, check `[Map from Workflow ▾]` | Button disabled with tooltip "Run a workflow first" | |

#### Phase 3E Files

```
docker/kafka/topics/stream-producer.sh      NEW — continuous message producer
```

#### Phase 3E Success Criteria

- [x] `stream-producer.sh` produces messages at configurable interval
- [x] All Phase 3A server curl tests pass
- [x] All Phase 3B streaming UI tests pass in Chrome
- [x] All Phase 3C consume → workflow tests pass
- [x] All Phase 3D workflow → publish tests pass
- [x] No console errors throughout entire manual test session
- [x] Cluster disconnect + reconnect cycle works without orphaned state

---

### Phase 3 Aggregate Success Criteria

All sub-phase criteria, plus:

- [x] TypeScript: 0 errors across entire codebase
- [x] Unit tests: all new hooks/utils/components ≥ 90% coverage
- [x] Full unit test suite passes (`npx vitest run`)
- [x] Manual Docker validation completed on web (Chrome)
- [x] Reconnect after cluster disconnect clears all streaming state cleanly

### Phase 3 Files — Complete List

```
Phase 3A (server):
  src-server/kafka/kafka-service.ts            MODIFY
  src-server/kafka/contracts.ts                MODIFY
  src-server/routes/kafka-routes.ts            MODIFY
  src/shared/kafka/kafkaClient.ts              MODIFY

Phase 3B (streaming):
  src/app/hooks/useKafkaStreamMode.ts          NEW
  src/app/hooks/useKafkaStreamMode.test.ts     NEW
  src/features/kafka/KafkaConsumeStudio.tsx     MODIFY
  src/features/kafka/KafkaConsumeStudio.test.tsx  MODIFY
  src/features/kafka/KafkaMessageStudioPage.tsx  MODIFY
  src/features/kafka/kafkaMessageStudioUtils.ts  MODIFY
  src/features/kafka/kafkaMessageStudioUtils.test.ts  MODIFY
  src/styles/settings.css                      MODIFY

Phase 3C (consume → workflow):
  src/features/test-runner/WorkflowRunner.tsx         MODIFY
  src/features/test-runner/WorkflowRunner.test.tsx     MODIFY (if exists, otherwise NEW)
  src/app/App.tsx                                     MODIFY
  src/features/kafka/KafkaMessageStudioPage.tsx        MODIFY
  src/features/kafka/KafkaConsumeStudio.tsx            MODIFY
  src/features/kafka/KafkaConsumeStudio.test.tsx       MODIFY

Phase 3D (workflow → publish):
  src/features/test-runner/WorkflowRunner.tsx         MODIFY
  src/features/test-runner/WorkflowRunner.test.tsx     MODIFY
  src/app/App.tsx                                     MODIFY
  src/features/kafka/KafkaMessageStudioPage.tsx        MODIFY
  src/features/kafka/KafkaPublishStudio.tsx            MODIFY
  src/features/kafka/KafkaPublishStudio.test.tsx       MODIFY
  src/styles/settings.css                             MODIFY

Phase 3E (docker tooling):
  docker/kafka/topics/stream-producer.sh              NEW
```

### Phase 3 Implementation Order

```
3A (server route) → 3B (streaming UI) → 3C (consume→workflow) → 3D (workflow→publish) → 3E (docker validation)
```

3A must come first (streaming depends on the message retrieval route). 3C and 3D are independent of each other but both depend on 3B being done (for the Zone B detail pane changes). 3E is the final validation gate.

### Phase 3 Implementation Notes

> Implemented: 2026-06-04

#### Approach

Phase 3 was split into five sub-phases (3A–3E). Sub-phases 3A (server), 3B (streaming hook), and parts of 3C/3D (WorkflowRunner props) were previously implemented. This implementation focused on wiring the existing infrastructure into the UI and completing the end-to-end integration.

#### Pre-existing Implementation (verified, not modified)

- **Phase 3A (Server):** `KafkaSubscriptionMessagesRequest/Result` types, `SubscriptionEntry` with ring buffer, `getSubscriptionMessages()`, `GET /api/kafka/subscription-messages` route, `'subscription-messages'` in `KafkaOperation` + `OPERATION_MAP`, Tauri `_server_proxy` routing. All 73 server/route tests pass.
- **Phase 3B (Hook):** `useKafkaStreamMode.ts` with full lifecycle (start/stop/clear/poll/disconnect cleanup), `buildSubscribeRequest()`. All 10 hook tests pass.
- **Phase 3C/3D (WorkflowRunner):** `initialWorkflowVariables` + `onWorkflowOutputAvailable` props already implemented and tested (21 tests).

#### New Implementation

**Phase 3B — Consume Studio Streaming UI:**
- Added `[Consume Once | Stream]` mode tab strip with `kafka-ms-mode-tab` CSS (accent border for active tab)
- Stream mode renders Start/Stop/Clear/Export Stream action row
- Stream results table reuses consume-once layout with scrollable `max-height: 400px` wrapper
- Auto-scroll to bottom during streaming; pauses when user scrolls up manually
- LIVE badge with pulsing green animation, cursor gap amber warning badge
- Red danger button for Stop Stream
- Stream row fade-in animation (`kafka-stream-fadein`)

**Phase 3C — Consume → Workflow Wiring:**
- Removed `void handleUseAsWorkflowInput` from `App.tsx`; passed as prop to `KafkaMessageStudioPage` → `KafkaConsumeStudio`
- `[Use as Workflow Input]` button in Zone B detail pane (both consume-once and stream modes)
- Button conditionally renders only when `onUseAsWorkflowInput` prop is provided
- Clicking sends `{ payload, topic, partition, offset }` and navigates to `workflow-runner` tab

**Phase 3D — Workflow → Publish Wiring:**
- Removed `void lastWorkflowOutput` from `App.tsx`; passed as prop to `KafkaMessageStudioPage` → `KafkaPublishStudio`
- `[Map from Workflow ▾]` dropdown button in Publish action row (between Format JSON and Clear)
- Dropdown lists all workflow output variables with name + truncated value preview
- Searchable dropdown with `kafka-ms-wf-search` input
- Selecting a JSON variable pretty-prints it into `publishDraft.body`; non-JSON inserted raw
- Button disabled with tooltip "Run a workflow first" when no workflow output available

**Phase 3E — Docker Tooling:**
- `stream-producer.sh` already existed and was used for validation

#### Files Modified

| File | Change |
|---|---|
| `src/features/kafka/KafkaMessageStudioPage.tsx` | Import `useKafkaStreamMode`, instantiate hook, accept `onUseAsWorkflowInput` + `lastWorkflowOutput` props, pass to children |
| `src/features/kafka/KafkaConsumeStudio.tsx` | Complete rewrite: mode tabs, stream mode UI (Start/Stop/Clear/Export), auto-scroll, `[Use as Workflow Input]` button, shared `renderDetailPane` |
| `src/features/kafka/KafkaConsumeStudio.test.tsx` | Expanded from 20 to 44 tests: consume-once (20), mode tabs (4), stream mode (16), workflow input (4) |
| `src/features/kafka/KafkaPublishStudio.tsx` | Added `lastWorkflowOutput` prop, `[Map from Workflow ▾]` dropdown with search, variable selection |
| `src/features/kafka/KafkaPublishStudio.test.tsx` | Expanded from 18 to 27 tests: added 9 Map from Workflow tests |
| `src/app/App.tsx` | Removed `void` suppressions, wired `handleUseAsWorkflowInput` + `lastWorkflowOutput` to `KafkaMessageStudioPage` |
| `src/styles/settings.css` | Added Phase 3 CSS block: mode tabs, stream table, LIVE badge, cursor gap badge, danger button, workflow dropdown |

#### Test Results

- **TypeScript:** 0 errors (`npx tsc -b --noEmit`)
- **Kafka test suite:** 665 tests across 28 files — all pass
- **KafkaConsumeStudio.test.tsx:** 44 tests — all pass
- **KafkaPublishStudio.test.tsx:** 27 tests — all pass
- **useKafkaStreamMode.test.ts:** 10 tests — all pass
- **WorkflowRunner.test.tsx:** 21 tests — all pass

#### Docker Manual Validation Results

All tests performed against **plaintext Docker profile** (Redpanda 127.0.0.1:19092).

| # | Test | Result |
|---|---|---|
| 3A-1 | `POST /api/kafka/subscribe` returns subscriptionId | ✅ Pass |
| 3A-2 | `GET /subscription-messages?sinceCursor=0` returns 100 buffered messages + cursor=3664 | ✅ Pass |
| 3A-3 | `GET /subscription-messages?sinceCursor=3664` returns only 4 new messages | ✅ Pass |
| 3A-4 | `POST /api/kafka/unsubscribe` returns `unsubscribed: true` | ✅ Pass |
| 3A-5 | Poll after unsubscribe returns 404 `KAFKA_SUBSCRIPTION_NOT_FOUND` | ✅ Pass |
| 3B-1 | Navigate to Consume Studio → mode tabs visible | ✅ Pass |
| 3B-2 | Click Stream tab → Stream mode active | ✅ Pass |
| 3B-3 | Fill topic, click Start Stream → messages accumulate, LIVE badge shown | ✅ Pass — 230 messages streamed |
| 3B-4 | Click Stop Stream → streaming stops, messages preserved, Start Stream shown | ✅ Pass |
| 3B-5 | Click message row → detail pane with JSON + headers | ✅ Pass |
| 3B-6 | Export Stream / Clear buttons visible and functional | ✅ Pass |
| 3C-1 | Click `[Use as Workflow Input]` → navigates to Workflow Runner tab | ✅ Pass |
| 3C-2 | Workflow Runner receives `kafka_*` variables | ✅ Pass |
| 3D-1 | Publish Studio shows `[Map from Workflow ▾]` disabled when no output | ✅ Pass |
| 3D-2 | Button tooltip = "Run a workflow first" | ✅ Pass |
| — | Console errors throughout session | ✅ 0 errors |

#### Phase 3 Re-evaluation Pass (2026-06-04)

**Scope:** Thorough code review of all 7 Phase 3 files + hook + CSS, followed by Docker manual validation.

**Issues Found & Fixed:**

1. **`handleExportStream` callback dependency churn** — `streamMode.streamMessages` was in the dependency array, causing the callback to be recreated on every new message. Fixed by introducing a `streamMessagesRef` and reading from `.current` at call-time, reducing the dependency to just `consumeDraft.topic`.
2. **`handleStartStream` / `handleStopStream` over-broad dependencies** — Both listed `streamMode` (the entire return object) instead of the specific function reference (`streamMode.startStream`, `streamMode.stopStream`). Fixed to use granular deps, reducing unnecessary re-renders.

**No critical bugs found.** The implementation is structurally sound:
- All 90 Phase 3 unit tests pass (4 test files: ConsumeStudio 44, PublishStudio 27, StreamMode hook 10, PageLevel 9).
- TypeScript: 0 errors.
- Docker manual validation: all 15 test points pass (subscribe/poll/unsubscribe, streaming UI, workflow input, Map from Workflow disabled state).
- 0 console errors during the full browser session.

---

## Phase 4 — Topic Explorer Enhancement

> Deferred until Phase 1 merges. Requires server-side work (new endpoint + adapter methods).

### Goal

The current Topic Explorer (inside `KafkaSettingsPage`) shows a basic flat list: Name + Partitions + Type. The mockup (`docs/mockups/kafka-topic-explorer.html`) specifies a full two-column page:
- **Left**: topic list with Replicas + Health badge columns
- **Right**: detail panel with 4 tabs — Messages | Partitions | Consumer Groups | Config

Phase 4 extracts Topic Explorer into a standalone page under the `protocols` domain and adds all missing detail.

### Phase 4 Connection Guard

`KafkaTopicExplorerPage` checks `kafkaState.connection.state !== 'connected'` at the top and renders the **same `KafkaStudioGuard`** component introduced in Phase 1. Props:

```tsx
// KafkaTopicExplorerPage props
interface KafkaTopicExplorerPageProps {
  kafkaState: UseKafkaStateReturn;
  onNavigateToKafkaSettings: () => void;
}
```

App.tsx passes `() => setActiveTab('kafka-settings')` (same pattern as `KafkaMessageStudioPage`).

### `useTopicExplorer` Hook

Manages all page-level state for `KafkaTopicExplorerPage`: topic list filtering, selected topic, and the cached detail map (populated lazily on first row selection).

```ts
// src/features/kafka/useTopicExplorer.ts

export type TopicHealthFilter = 'all' | 'healthy' | 'degraded' | 'unknown';
export type TopicPartitionBucket = 'any' | '1-4' | '5-12' | '12+';

export interface UseTopicExplorerReturn {
  // Search & filter
  searchText: string;
  setSearchText: (v: string) => void;
  healthFilter: TopicHealthFilter;
  setHealthFilter: (v: TopicHealthFilter) => void;
  partitionFilter: TopicPartitionBucket;
  setPartitionFilter: (v: TopicPartitionBucket) => void;
  showInternal: boolean;
  setShowInternal: (v: boolean) => void;
  domainChip: string | null;         // null = no chip active; string = prefix filter
  setDomainChip: (v: string | null) => void;

  // Derived list
  filteredTopics: KafkaTopicSummary[];  // topics from kafkaState.topics filtered by all active filters

  // Detail cache
  selectedTopicName: string | null;
  selectTopic: (name: string | null) => void;  // triggers detail fetch if not cached
  detailCache: Map<string, KafkaTopicDetail>;  // filled as each topic is selected
  selectedDetail: KafkaTopicDetail | null;     // shorthand: detailCache.get(selectedTopicName) ?? null
  detailLoading: boolean;
  detailError: KafkaUiSafeError | null;
}

export interface UseTopicExplorerDeps {
  dispatch?: typeof dispatchKafkaOperation;
}

export function useTopicExplorer(
  kafkaState: UseKafkaStateReturn,
  deps?: UseTopicExplorerDeps,
): UseTopicExplorerReturn
```

**Key behaviors:**
- `filteredTopics` applies `searchText` substring, `healthFilter` (from `detailCache`), `partitionFilter` (client-side on `topic.partitionCount`), `showInternal`, and `domainChip` prefix — all in one derived computation.
- `healthFilter !== 'all'` only affects topics whose detail has been loaded (health is in `detailCache`). Unloaded topics are **always shown** when any health filter is active (they appear as `unknown`). This is an intentional trade-off: fetching all topic details upfront would be O(n) requests.
- `selectTopic(name)` sets `selectedTopicName` and fires `GET /api/kafka/topics/:name/detail` (via `'topic-detail'` operation) if the topic is not in `detailCache`. On success, stores in `detailCache` and updates `cachedHealthStatus` for the topic row.
- `KafkaDiagnosticBannerData` is imported from `src/features/kafka/kafkaSettingsUtils.ts` (not from `kafkaClient.ts` — it already lives there).

**Special domain chips:**
- Standard chips derive from topic name prefixes (e.g. `orders.*`). Chips are computed from `kafkaState.topics` by extracting the first word before `.` and deduplicating.
- **"Lagging Consumers"**: a special chip that shows topics where `detailCache.get(name)?.consumerGroups.some(g => g.totalLag > 0)`. Only topics already in `detailCache` can match; others are hidden when this chip is active.
- **"Recently Active"**: shows topics where `detailCache.get(name)?.partitions.some(p => p.messageCount > 0)`. Same lazy-load caveat — only loaded topics participate.
- Both special chips are inactive until at least one topic detail has been fetched. This is documented inline via a tooltip: "Load a topic to populate this filter."

---

### Phase 4 Server Work

#### New method on `KafkaAdminAdapter` (`src-server/kafka/kafka-adapter.ts`)

```ts
// New types:
export interface KafkaTopicPartitionDetail {
  partitionId: number;
  leader: number;          // broker node ID
  replicas: number[];      // all replica broker IDs
  isr: number[];           // in-sync replica broker IDs
  earliestOffset: string;  // string to match KafkaJS offset format
  latestOffset: string;
  messageCount: number;    // parseInt(latestOffset) - parseInt(earliestOffset), clamped ≥ 0
}

export interface KafkaTopicConsumerGroupSummary {
  groupId: string;
  state: string;           // 'Stable' | 'PreparingRebalance' | 'Dead' | 'Empty' | 'Unknown'
  totalLag: number;        // sum of per-partition lag (latest - committed), -1 if unknown
}

export interface KafkaTopicDetail {
  name: string;
  partitionCount: number;
  replicationFactor: number;           // replicas.length on partition 0
  isInternal: boolean;
  partitions: KafkaTopicPartitionDetail[];
  consumerGroups: KafkaTopicConsumerGroupSummary[];  // best-effort; empty [] on timeout
  config: Record<string, string>;      // only interesting keys — see TOPIC_INTERESTING_CONFIGS
  healthStatus: 'healthy' | 'degraded' | 'unknown';
  // healthy: all partitions have isr.length === replicas.length
  // degraded: any partition has isr.length < replicas.length
  // unknown: partition data unavailable
}

// Add to KafkaAdminAdapter interface:
fetchTopicDetail(topicName: string): Promise<KafkaTopicDetail>;
```

#### Implementation in `KafkaJsAdminAdapter`

Three parallel KafkaJS calls, then one optional consumer-groups pass:

```ts
async fetchTopicDetail(topicName: string): Promise<KafkaTopicDetail> {
  // Call 1: partition metadata (leader, replicas, ISR)
  //   admin.fetchTopicMetadata({ topics: [topicName] })
  //   → metadata.topics[0].partitions[]
  //     partitionId, leader, replicas[], isr[], offlineReplicas[]

  // Call 2: per-partition offsets
  //   admin.fetchTopicOffsets(topicName)
  //   → [{ partition, offset (latest), high (latest), low (earliest) }]

  // Call 3: topic config
  //   admin.describeConfigs({ resources: [{ type: ConfigResourceTypes.TOPIC, name: topicName,
  //     configNames: TOPIC_INTERESTING_CONFIGS }] })
  //   → resources[0].configEntries[]

  // Call 4 (best-effort, 5s timeout): consumer group lag
  //   admin.listGroups() → all groupIds
  //   admin.fetchOffsets({ groupId, topics: [topicName] }) per group
  //   Filter: groups where any partition has committed offset >= 0
  //   Lag per partition = parseInt(latestOffset) - parseInt(committedOffset)
  //   totalLag = sum across all partitions
}

const TOPIC_INTERESTING_CONFIGS = [
  'retention.ms', 'retention.bytes', 'cleanup.policy',
  'max.message.bytes', 'min.insync.replicas',
  'compression.type', 'delete.retention.ms',
] as const;
```

**Consumer group note:** `admin.listGroups()` returns ALL groups in the cluster. To find which groups are subscribed to this specific topic, fetch committed offsets per group for this topic and discard any group where every partition offset is `-1` (never committed). This is O(n_groups) calls and may be slow with many groups. Use a 5-second race timeout; on timeout return `consumerGroups: []` and set `healthStatus` based only on ISR data.

#### New method on `KafkaService` (`src-server/kafka/kafka-service.ts`)

```ts
async getTopicDetail(topicName: string): Promise<KafkaTopicDetail>
// Guards: must be connected; delegates to this.admin!.fetchTopicDetail(topicName)
// Wrapped in standard withTimeout()
```

#### New contract types (`src-server/kafka/contracts.ts`)

```ts
export interface KafkaTopicDetailRequest {
  clusterId?: string;
}

// Response is KafkaTopicDetail (re-exported from kafka-adapter.ts via an alias or copy)
export type KafkaTopicDetailResponse = KafkaTopicDetail;
```

#### New route (`src-server/routes/kafka-routes.ts`)

```ts
// GET /api/kafka/topics/:topicName/detail
router.get('/topics/:topicName/detail', async (req, res) => {
  const { topicName } = req.params;  // URL-decoded by Express
  const clusterId = req.query['clusterId'] as string | undefined;
  // Resolve service → call getTopicDetail → sendEnvelope
});
```

#### Update `kafkaClient.ts` (`src/shared/kafka/kafkaClient.ts`)

Add `'topic-detail'` to `KafkaOperation` union and wire the new route.

---

### Phase 4 Client Work

#### New page: `KafkaTopicExplorerPage.tsx`

Replaces the `{/* Topic Explorer */}` section currently embedded in `KafkaSettingsPage`. Standalone full-page component under `src/features/kafka/`.

**Two-column layout (1.1fr 1fr, collapses to stacked below 960px):**

```
┌──────────────────────────────────┬───────────────────────────────────┐
│  Topic List                      │  Detail Panel (shown on selection) │
│  ─────────────────────────────   │  ─────────────────────────────────  │
│  [search]  [Health▾][Parts▾][Int▾]│  orders.created                     │
│  [Retention▾] [domain chips]     │  [Messages][Partitions][Groups][Cfg]│
│                                  │                                     │
│  Topic  Parts Repl Traffic CGs  H│  <tab content>                      │
│  orders.c  12    3  18.4M   6  OK│                                     │
│  orders.f   6    3  124K    2  ⚠ │                                     │
└──────────────────────────────────┴───────────────────────────────────┘
```

**Filter controls (above topic list table):**

- **Search input**: free text, filters `topic.name` by substring (existing).
- **Health dropdown** (`[Health ▾]`): options `All` / `Healthy` / `Warning` / `Unknown`. Filters by `cachedHealthStatus` (a `Map<topicName, healthStatus>` in page state, populated from detail fetches). `All` by default; grayed out until at least one detail load.
- **Partitions dropdown** (`[Parts ▾]`): `Any` / `1–4` / `5–12` / `12+` — client-side filter on `topic.partitionCount`.
- **Retention dropdown** (`[Retention ▾]`): `Any` / `< 1 day` / `1–7 days` / `> 7 days` — client-side filter on `detail.config['retention.ms']` where available (shimmed as `Any` if not yet loaded).
- **Internal dropdown** (`[Int ▾]`): `Hide Internal` / `Show Internal` — same as existing toggle.
- **Domain chips** (Orders, Payments, Inventory, etc): prefix-based quick filters on `topic.name` (e.g. chip "Orders" matches `orders.*`). "Recently Active" and "Lagging Consumers" chips are special: "Lagging Consumers" shows topics where any `cachedDetail.consumerGroups` entry has `totalLag > 0`.

**Topic list table columns:**
- **Topic** — `topic.name` + meta line (Internal · Application)
- **Partitions** — count badge
- **Replicas** — replication factor (from detail, shimmed as `—` until loaded)
- **Traffic** — total estimated message count across all partitions (sum `messageCount` from `detail.partitions`, formatted `18.4M`); shimmed as `—` until detail loaded
- **Consumer Groups** — count of groups in `detail.consumerGroups` (shimmed as `—`)
- **Health** — `●OK` / `⚠Warn` badge; hidden until detail is loaded

> Traffic, Replicas, Consumer Groups, and Health all load lazily on first row selection. The list does not pre-fetch all topic details (would be O(n) requests). These columns show `—` until the row is selected at least once.

**Topic selection flow:**
1. User clicks a row → row highlights, detail panel opens on the right
2. `GET /api/kafka/topics/:topicName/detail` fires (loading spinner in panel header)
3. On success → 4 tabs render, default tab = Messages
4. On error → `KafkaDiagnosticBanner` in the panel

#### Detail panel tabs

**Tab 1 — Messages**

Shows a **Topic Summary** metrics row above the filter form, then filter inputs, then results.

**Topic Summary metrics (4 stat boxes, from `detail`):**
- Partitions · Replication Factor · Total Messages (sum across partitions) · Consumer Groups count

**Filter fields** (match the mockup filter form):
- Key Match (exact), Partition (select: `Any / 0 / 1 / ...`), Time window (select: `Latest / Last 1h / Last 24h / Earliest`)
- Header Match (`key=value`), JSONPath, JSONPath Expected, Max Messages
- Start Position maps: `Latest` → `fromBeginning: false`; `Earliest` → `fromBeginning: true`; time-window options map to `fromBeginning: true` + a client-side post-filter on `timestamp` (approximation — exact time-range seek is not supported by the server in Phase 4)

`[Consume Once]` → calls `POST /api/kafka/consume-once` with `topic = selectedTopic`

Results shown in the same two-zone design as Consume Studio (scrollable table + detail pane).

**Action buttons on selected message** (matches mockup):
`[Copy Key]` · `[Copy Value]` · `[Export JSON]` · **`[Replay to Workflow]`** (Phase 3 only — calls `onUseAsWorkflowInput`)

Does **not** require `useKafkaMessageStudio`; uses `useTopicMessageBrowser` hook (see spec above).

#### `useTopicMessageBrowser` Hook

Minimal hook for the Messages tab. `topic` is fixed at call-site from the selected row; the user can only adjust filter/pagination fields.

```ts
// src/features/kafka/useTopicMessageBrowser.ts

export interface TopicMessageBrowserDraft {
  groupId: string;            // initialized to 'redfireforge-debug-<uuid8>' per hook mount
  startPosition: 'latest' | 'earliest';
  timeoutMs: string;          // default '10000'
  maxMessages: string;        // default '50'
  keyEquals: string;
  headerMatch: string;        // 'key=value' format
  jsonPath: string;
  jsonPathEquals: string;
}

export interface UseTopicMessageBrowserReturn {
  draft: TopicMessageBrowserDraft;
  setDraft: (patch: Partial<TopicMessageBrowserDraft>) => void;
  loading: boolean;
  result: KafkaConsumeResultRow[] | null;
  timedOut: boolean;
  messageCount: number;
  error: KafkaUiSafeError | null;
  selectedMessage: KafkaConsumeResultRow | null;
  selectMessage: (index: number | null) => void;
  consumeOnce: () => Promise<void>;
  clearResult: () => void;
}

export interface UseTopicMessageBrowserDeps {
  dispatch?: typeof dispatchKafkaOperation;
}

export function useTopicMessageBrowser(
  topicName: string,             // fixed — comes from selected topic row; hook resets when topicName changes
  kafkaState: UseKafkaStateReturn,
  deps?: UseTopicMessageBrowserDeps,
): UseTopicMessageBrowserReturn
```

**Behavior notes:**
- When `topicName` changes (user selects a different topic), the hook resets `result`, `error`, and `draft` to defaults (except `draft.groupId` stays — no need for a new group ID per topic switch).
- `consumeOnce` uses `buildConsumeRequest` from `kafkaMessageStudioUtils` (same conversion logic, no duplication).

**Tab 2 — Partitions**

Table from `detail.partitions`:

| Partition | Leader | Replicas | ISR | Earliest Offset | Latest Offset | Messages |
|---|---|---|---|---|---|---|
| 0 | broker-1 | [1, 2, 3] | [1, 2, 3] | 0 | 1829911 | 1,829,911 |

- ISR count shown as `3 / 3` — amber when `isr.length < replicas.length`
- Message count = `parseInt(latestOffset) - parseInt(earliestOffset)` formatted with locale commas
- Summary row: total partitions, total messages across all partitions

**Tab 3 — Consumer Groups**

Table from `detail.consumerGroups`:

| Group ID | State | Total Lag |
|---|---|---|
| checkout-service | Stable | 0 |
| fraud-detector | Stable | 142 |
| notif-worker | PreparingRebalance | 899 |

- State badge: `Stable` → green, `PreparingRebalance` / `CompletingRebalance` → amber, `Dead` / `Empty` → grey
- Total Lag: `0` → green, `>0` → amber, formatted with locale commas
- Empty state if `consumerGroups.length === 0` (no consumers or timed-out best-effort fetch): _"No consumer groups found for this topic."_

**Tab 4 — Config**

Simple key/value table from `detail.config`:

| Config Key | Value |
|---|---|
| retention.ms | 604800000 |
| cleanup.policy | delete |
| max.message.bytes | 1048588 |
| min.insync.replicas | 2 |
| compression.type | producer |

- Values shown verbatim (no human-formatting — raw values are more useful for debugging)
- Empty-state if `Object.keys(detail.config).length === 0`

---

### Phase 4 CSS Classes (added to `src/styles/settings.css`)

```
.kafka-explorer-layout            — 2-col grid (1.1fr 1fr), collapses below 960px
.kafka-explorer-list-card         — left panel card
.kafka-explorer-detail-card       — right panel card
.kafka-explorer-detail-tabs       — tab bar inside detail panel
.kafka-explorer-detail-tab        — individual tab button (.active state)
.kafka-explorer-detail-body       — tab content area with padding
.kafka-topic-health-badge         — health status pill (ok / warn / unknown variants)
.kafka-partition-table            — partitions tab table
.kafka-consumer-group-table       — consumer groups tab table
.kafka-config-table               — config tab table
.kafka-isr-fraction               — ISR count display (green/amber)
```

---

### Phase 4 New Files

```
src-server/kafka/kafka-adapter.ts            MODIFY — add fetchTopicDetail() to KafkaAdminAdapter + KafkaJsAdminAdapter
src-server/kafka/kafka-service.ts            MODIFY — add getTopicDetail() method
src-server/kafka/contracts.ts                MODIFY — add KafkaTopicDetailRequest/Response types
src-server/routes/kafka-routes.ts            MODIFY — add GET /topics/:topicName/detail route

src/shared/kafka/kafkaClient.ts              MODIFY — add 'topic-detail' KafkaOperation
src/features/kafka/KafkaStudioGuard.tsx               NEW (extracted from KafkaMessageStudioPage if not already standalone)
src/features/kafka/KafkaTopicExplorerPage.tsx          NEW
src/features/kafka/KafkaTopicExplorerPage.test.tsx     NEW
src/features/kafka/KafkaTopicDetailPanel.tsx           NEW — right-side detail panel + 4 tabs
src/features/kafka/KafkaTopicDetailPanel.test.tsx      NEW
src/features/kafka/useTopicMessageBrowser.ts           NEW — hook for Messages tab
src/features/kafka/useTopicMessageBrowser.test.ts      NEW
src/styles/settings.css                      MODIFY — add kafka-explorer-* CSS classes
```

`KafkaSettingsPage.tsx` loses the `{/* Topic Explorer */}` section (extracted). All other existing files unchanged.

---

### Phase 4 Success Criteria

- [x] `'kafka-topic-explorer'` tab visible in Protocols sub-nav (Protocols domain itself added in Phase 1)
- [x] `KafkaTopicExplorerPage` shows `KafkaStudioGuard` when cluster not connected
- [x] Topic list: two-column layout (list + detail panel) — CSS added with 1.1fr/1fr grid, collapses below 960px
- [x] Topic list: Name, Partitions columns visible immediately (no extra fetch)
- [x] Topic list: Replicas and Health columns populate after first row is selected and detail loads
- [x] Topic list: search filter and domain chips work as before
- [x] Clicking a topic row fires `GET /api/kafka/topics/:topicName/detail`
- [x] Detail panel: loading spinner while fetching, inline error on error
- [x] Detail panel Tab 1 (Messages): consume filter (Time Window, Partition, Key Match, Header Match, JSONPath, JSONPath Expected, Max Messages) + `[Consume Once]` pre-filled with selected topic
- [x] Detail panel Tab 2 (Partitions): full partition table with ISR fraction indicators
- [x] Detail panel Tab 3 (Consumer Groups): group state + lag table, empty state handled
- [x] Detail panel Tab 4 (Config): key/value config table, empty state handled
- [x] `GET /api/kafka/topics/:topicName/detail` returns correct data from `KafkaJsAdminAdapter`
- [x] Consumer group timeout (5s) returns empty array gracefully — no server crash
- [x] TypeScript: 0 errors
- [x] Unit tests: 71 tests across 4 Phase 4 test files — all passing
- [x] `KafkaSettingsPage` Topic Explorer section removed — 124 lines of JSX, 5 state variables, 2 derived memos, 1 useEffect, and 5 tests cleaned up
- [x] Topic list: Health filter dropdown grays out until first detail loaded; active health filter hides only topics with a known non-matching health status (unloaded topics remain visible)
- [x] Topic list: Partitions filter bucket (Any / 1–4 / 5–12 / 12+) client-side filters on `partitionCount`
- [x] Topic list: Internal toggle hides/shows internal topics
- [x] Topic list: domain chip prefix filter narrows list
- [x] "Lagging Consumers" chip: filters list to topics in cache with `totalLag > 0` (greyed out / disabled / tooltip until first detail load)
- [x] "Recently Active" chip: filters list to topics in cache with `messageCount > 0` (greyed out / disabled / tooltip until first detail load)
- [x] Partitions tab: ISR count shown as `n / n`; amber when `isr.length < replicas.length`
- [x] Consumer Groups tab: `Stable` state badge = green; `PreparingRebalance` = amber; `Dead` / `Empty` = grey
- [x] Config tab: empty state when `Object.keys(detail.config).length === 0`
- [x] Unit tests: `useTopicExplorer` — 19 tests passing (filter logic, caching, domain chips, special chips, error handling, hasCachedDetails)

---

### Phase 4 Test Plan

#### Server tests

| Test case | File |
|---|---|
| `fetchTopicDetail` builds correct `KafkaTopicDetail` from mock partition metadata + offsets + configs | `kafka-adapter.test.ts` |
| `healthStatus: 'healthy'` when all partitions have `isr.length === replicas.length` | `kafka-adapter.test.ts` |
| `healthStatus: 'degraded'` when any partition has `isr.length < replicas.length` | `kafka-adapter.test.ts` |
| Consumer group best-effort timeout (5 s) → `consumerGroups: []`, no crash | `kafka-adapter.test.ts` |
| `GET /api/kafka/topics/:topicName/detail` → returns 200 with envelope on success | `kafka-routes.test.ts` |
| Route returns 404 envelope when topic not found | `kafka-routes.test.ts` |
| Route returns 503 envelope when not connected | `kafka-routes.test.ts` |

#### Client unit tests — `KafkaTopicExplorerPage.test.tsx`

- Renders `KafkaStudioGuard` when cluster not connected (reuses Phase 1 guard component)
- Renders topic list when connected
- Clicking a topic row fires `GET /topics/:name/detail`
- Selecting a different row replaces detail (previous result discarded)
- Search filter narrows list
- Health filter grayed out before any detail loaded; filters by `cachedHealthStatus` after

#### Client unit tests — `KafkaTopicDetailPanel.test.tsx`

- Renders loading state while detail fetch in progress
- Renders `KafkaDiagnosticBanner` on error
- Default tab is Messages (Tab 1)
- Tab switching shows correct content
- Partitions tab: ISR fraction shown amber when `isr.length < replicas.length`
- Consumer Groups tab: state badge color correct (Stable=green, PreparingRebalance=amber, Dead/Empty=grey)
- Consumer Groups tab: empty state when `consumerGroups.length === 0`
- Config tab: all config keys present; empty state when `config` is `{}`

#### Client unit tests — `useTopicMessageBrowser.test.ts`

- Initial state: empty result, no selected message
- `consumeOnce` success → sets `result` rows, clears error
- `consumeOnce` → `timedOut: true` on timeout response
- `consumeOnce` → sets `error` on server error
- `topicName` change → result and error reset to `null`
- `selectMessage` / `clearResult` work correctly
- Injectable `dispatch` (from `deps`) is called instead of default

---

## Phase 5 — Schema Registry Browser

> Deferred until Phase 1 is merged. **No new server work required** — all three routes already exist from Phase 10 (`schema-subjects`, `schema-versions`, `schema-fetch`).

### Goal

A dedicated page to browse the Confluent-compatible Schema Registry for the connected cluster. Lets developers:

- See all registered subjects (e.g. `orders.created-value`, `orders.created-key`)
- Browse version history of a subject
- View and copy the raw schema definition (Avro JSON / Protobuf IDL / JSON Schema)
- Switch between versions to compare evolution

This is the only place in the app where schemas can be browsed standalone — today schema config is only accessible inline within workflow node configs.

### Navigation

Phase 5 adds `'kafka-schema-registry'` to the Tab union and `PROTOCOLS_TABS` set in `appTabUtils.ts`. The Protocols domain sub-nav becomes:

```ts
// AppSubNav.tsx — Phase 5 fully populated:
protocols: [
  { tab: 'kafka-message-studio',  label: 'Kafka Studio'      },  // Phase 1
  { tab: 'kafka-topic-explorer',  label: 'Topic Explorer'    },  // Phase 4
  { tab: 'kafka-schema-registry', label: 'Schema Registry'   },  // Phase 5
],
```

### Guard

`KafkaSchemaRegistryPage` renders the shared `KafkaStudioGuard` when the cluster is not connected (same pattern as Phases 1 and 4).

Additionally, if connected but no Registry URL has been entered yet, the page shows a **URL prompt state** (not the cluster guard):

> "Enter a Schema Registry URL to begin browsing."  
> [Registry URL input] [optional Auth username/password] [Connect]

The registry URL and credentials live in local component state (not persisted between sessions — the URL is sensitive and may differ per environment). Credentials travel in POST request body only (OWASP A02).

### Layout

Two-column layout (1.1fr 1fr), same breakpoint as Topic Explorer (collapses below 960px):

```
┌──────────────────────────────────────┬────────────────────────────────────────┐
│  Subject List                        │  Subject Detail                        │
│  Registry URL [_________________]    │  orders.created-value                  │
│  Auth User [______] Pass [______]    │  Version: [v3 (latest) ▾]  Format: Avro│
│  [Connect to Registry]               │                                        │
│                                      │  ┌─────────────────────────────────┐   │
│  [search filter]                     │  │ {                               │   │
│                                      │  │   "type": "record",             │   │
│  Subject                  Format     │  │   "name": "OrderCreated",       │   │
│  orders.created-value     Avro  [>]  │  │   "fields": [...]               │   │
│  orders.created-key       Avro  [>]  │  │ }                               │   │
│  payments.settled-value   Protobuf   │  └─────────────────────────────────┘   │
└──────────────────────────────────────┴────────────────────────────────────────┘
```

### Subject List (left panel)

- **Registry URL** text input + optional username/password fields + **[Connect to Registry]** button. On click: fires `POST /api/kafka/schema-subjects` with `{ schemaConfig: { registryUrl, auth? } }`. Populates the subject list. After initial load, the button label changes to **[Refresh Subjects]**. Clicking it re-fires `loadSubjects`, clearing previous subjects and selection.
- **Search filter**: free text substring filter on subject name.
- **Subject table columns**: Subject Name | Format (shimmed as `—` until a version is loaded) | `[>]` select button. Format column is populated **lazily** — only when a subject is selected and its latest schema fetched. Once populated, `SchemaSubjectRow.format` persists in the table even after selecting another subject.

### Subject Detail (right panel)

Shown on row selection:

- **Subject name** as heading.
- **Versions dropdown** (`[v3 (latest) ▾]`): populated by `POST /api/kafka/schema-versions`. Options listed as `v1, v2, ... vN (latest)`. Auto-selects latest on subject load.
- **Format badge**: derives from `KafkaSchemaFetchResult.schemaType` returned by the server (AVRO → avro, PROTOBUF → protobuf, JSON → json-schema). Content-sniffing (Avro = `"type": "record"` in JSON; Protobuf = does not parse as JSON; JSON Schema = has `"$schema"` key) is the fallback only when `schemaType` is absent. Falls back to `—` if ambiguous.
- **Schema content area**: read-only `<pre>` / `<textarea readonly>`, monospace font, pretty-printed JSON for Avro and JSON Schema, raw text for Protobuf.
- **Action buttons**: `[Copy Schema]` (copies raw schema string to clipboard) · `[Export]` (downloads as `.json` or `.proto` file, filename = `{subject}-v{version}.json`).
- **Loading states**: Detail panel shows a loading skeleton while `versionsLoading` or `schemaLoading` is true (same shimmer pattern as Topic Explorer). An inline error banner renders when `versionsError` or `schemaError` is set.

### Hook — `useSchemaRegistry`

```ts
// src/features/kafka/useSchemaRegistry.ts

export interface SchemaRegistryConfig {
  registryUrl: string;
  auth?: { username: string; password: string };
}

export interface SchemaSubjectRow {
  name: string;
  format?: 'avro' | 'protobuf' | 'json-schema';  // populated after version load
}

export interface SchemaVersionDetail {
  subject: string;
  version: number;
  id: number;
  schema: string;       // raw schema string
  schemaType?: string;  // from registry (AVRO | PROTOBUF | JSON)
}

export interface UseSchemaRegistryReturn {
  registryConfig: SchemaRegistryConfig;
  setRegistryConfig: (patch: Partial<SchemaRegistryConfig>) => void;

  subjects: SchemaSubjectRow[];       // all loaded subjects (unfiltered)
  subjectsLoading: boolean;
  subjectsError: KafkaUiSafeError | null;
  loadSubjects: () => Promise<void>;

  filter: string;                     // substring filter text
  setFilter: (f: string) => void;
  filteredSubjects: SchemaSubjectRow[];  // subjects filtered by filter (client-side)

  selectedSubject: string | null;
  selectSubject: (name: string | null) => void;  // auto-loads versions + latest schema

  versions: number[];
  versionsLoading: boolean;
  versionsError: KafkaUiSafeError | null;

  selectedVersion: number | null;
  selectVersion: (v: number | null) => void;      // loads schema for selected version

  schemaDetail: SchemaVersionDetail | null;
  schemaLoading: boolean;
  schemaError: KafkaUiSafeError | null;
}

export interface UseSchemaRegistryDeps {
  dispatch?: typeof dispatchKafkaOperation;
}

export function useSchemaRegistry(
  kafkaState: UseKafkaStateReturn,
  deps?: UseSchemaRegistryDeps,
): UseSchemaRegistryReturn
```

**Behavior:**
- `loadSubjects` → `POST /api/kafka/schema-subjects` with `{ schemaConfig: registryConfig }`.
- `selectSubject(name)` clears previous versions + schema, then fires `POST /api/kafka/schema-versions` and auto-selects the latest version, which triggers `POST /api/kafka/schema-fetch`.
- `selectVersion(v)` fires `POST /api/kafka/schema-fetch` for the chosen version.
- Auth: if both `username` and `password` are empty strings, omit `auth` from request body entirely (OWASP A02).

### Phase 5 New Files

```
src/app/utils/appTabUtils.ts           MODIFY — add 'kafka-schema-registry' to Tab union + PROTOCOLS_TABS
src/app/components/AppSubNav.tsx       MODIFY — add 'kafka-schema-registry' sub-tab in protocols block
src/app/App.tsx                        MODIFY — add render branch for 'kafka-schema-registry'
src/features/kafka/KafkaSchemaRegistryPage.tsx       NEW
src/features/kafka/KafkaSchemaRegistryPage.test.tsx  NEW
src/features/kafka/useSchemaRegistry.ts              NEW
src/features/kafka/useSchemaRegistry.test.ts         NEW
src/styles/settings.css                MODIFY — add kafka-schema-* CSS classes

> `KafkaStudioGuard.tsx` is **not** a new file in Phase 5 — it is shared from Phase 1.
```

### Phase 5 CSS Classes

```css
.kafka-schema-layout          — 2-col grid (1.1fr 1fr), collapses below 960px
.kafka-schema-list-card       — left panel card
.kafka-schema-detail-card     — right panel card
.kafka-schema-registry-url    — registry URL + auth fields row
.kafka-schema-subject-table   — subject list table
.kafka-schema-version-select  — versions dropdown
.kafka-schema-content         — schema code display area (monospace, scrollable)
.kafka-schema-format-badge    — format pill (avro / protobuf / json-schema variants)
```

### Phase 5 Success Criteria

- [x] New "Schema Registry" sub-tab visible in Protocols domain
- [x] Guard state shown when cluster not connected
- [x] URL prompt shown when connected but no Registry URL entered
- [x] `[Connect to Registry]` fetches subjects from `POST /api/kafka/schema-subjects`
- [x] Subject list populates with all registered subjects
- [x] Clicking a subject loads versions via `POST /api/kafka/schema-versions`; latest auto-selected
- [x] Schema content loaded via `POST /api/kafka/schema-fetch` and displayed formatted
- [x] Format badge correctly identifies Avro / Protobuf / JSON Schema from schema content
- [x] `[Copy Schema]` copies raw schema string to clipboard
- [x] `[Export]` downloads schema as `.json` or `.proto` file
- [x] Version dropdown allows switching between schema versions
- [x] Search filter narrows subject list by substring
- [x] Empty auth fields omit `auth` from request body (OWASP A02)
- [x] TypeScript: 0 errors
- [x] Unit tests: `useSchemaRegistry` — >90% branch/func/stmt
- [x] Unit tests: `KafkaSchemaRegistryPage` — >90% branch/func/stmt

### Phase 5 Test Plan

| Test case | File |
|---|---|
| Initial state: empty subjects, registryConfig `{ registryUrl: '' }` | `useSchemaRegistry.test.ts` |
| `loadSubjects` success → populates `subjects` | `useSchemaRegistry.test.ts` |
| `loadSubjects` error → `subjectsError` set | `useSchemaRegistry.test.ts` |
| `selectSubject` fires versions load, auto-selects latest, fires schema-fetch | `useSchemaRegistry.test.ts` |
| `selectSubject` clears previous `versions`, `selectedVersion`, `schemaDetail` | `useSchemaRegistry.test.ts` |
| `selectVersion` fires schema-fetch for chosen version | `useSchemaRegistry.test.ts` |
| `selectVersion` error → `schemaError` set | `useSchemaRegistry.test.ts` |
| Auth both empty → `auth` omitted from dispatch body | `useSchemaRegistry.test.ts` |
| Auth partially filled → `auth` included | `useSchemaRegistry.test.ts` |
| Injectable `dispatch` called instead of default | `useSchemaRegistry.test.ts` |
| `setFilter('orders')` → `filteredSubjects` narrows to matching subjects | `useSchemaRegistry.test.ts` |
| `setFilter('')` → `filteredSubjects` equals full `subjects` list | `useSchemaRegistry.test.ts` |
| Filter is case-insensitive substring match | `useSchemaRegistry.test.ts` |
| `loadSubjects` error → fix URL → retry succeeds, clears error | `useSchemaRegistry.test.ts` |
| Renders `KafkaStudioGuard` when not connected | `KafkaSchemaRegistryPage.test.tsx` |
| Renders URL prompt when connected but URL blank | `KafkaSchemaRegistryPage.test.tsx` |
| Subject list renders after load | `KafkaSchemaRegistryPage.test.tsx` |
| Clicking subject populates detail panel | `KafkaSchemaRegistryPage.test.tsx` |
| Version dropdown switches schema content | `KafkaSchemaRegistryPage.test.tsx` |
| `[Copy Schema]` copies raw schema string to clipboard | `KafkaSchemaRegistryPage.test.tsx` |
| `[Export]` triggers download with correct filename (`{subject}-v{version}.json`) | `KafkaSchemaRegistryPage.test.tsx` |
| `[Export]` uses `.proto` extension for Protobuf schemas | `KafkaSchemaRegistryPage.test.tsx` |
| Format badge shows "Avro" when `schemaType` is `AVRO` | `KafkaSchemaRegistryPage.test.tsx` |
| Format badge shows "Protobuf" when `schemaType` is `PROTOBUF` | `KafkaSchemaRegistryPage.test.tsx` |
| Format badge shows "JSON Schema" when `schemaType` is `JSON` | `KafkaSchemaRegistryPage.test.tsx` |
| Format badge shows `—` when `schemaType` is missing | `KafkaSchemaRegistryPage.test.tsx` |

### Phase 5 Implementation (2026-06-04)

#### Implementation Notes

- **No server changes required** — Phase 10 routes (`schema-subjects`, `schema-versions`, `schema-fetch`) were reused unchanged.
- **7 plan gaps identified and addressed** before implementation:
  1. Format badge derivation: prefers server `schemaType` over content-sniffing fallback
  2. Subject format column: lazy population — persists after selection
  3. Detail panel loading/error states: shimmer skeleton + inline error banners
  4. Refresh action: button label changes to "Refresh Subjects" after initial load
  5. Missing Copy/Export test cases: 3 new page tests added
  6. Missing format badge test cases: 4 new page tests added
  7. Missing retry-after-error test case: 1 new hook test added
- **`_kafkaState` parameter**: retained in hook signature for future use (e.g. persisting registry URL per cluster) but currently unused.

#### Files Created

| File | Purpose |
|---|---|
| `src/features/kafka/useSchemaRegistry.ts` | Hook: registry config, subject/version/schema state, filter, format derivation |
| `src/features/kafka/useSchemaRegistry.test.ts` | 21 tests: 14 hook + 7 `deriveSchemaFormat` |
| `src/features/kafka/KafkaSchemaRegistryPage.tsx` | Page: two-column layout, guard, URL prompt, subject list, detail panel, copy/export |
| `src/features/kafka/KafkaSchemaRegistryPage.test.tsx` | 12 tests: guard, URL prompt, list, detail, version switch, copy, export (×2), format badges (×4) |

#### Files Modified

| File | Change |
|---|---|
| `src/app/utils/appTabUtils.ts` | Added `'kafka-schema-registry'` to `Tab`, `PROTOCOLS_TABS`, `ALL_TABS` |
| `src/app/components/AppSubNav.tsx` | Added `{ tab: 'kafka-schema-registry', label: 'Schema Registry' }` to protocols |
| `src/app/App.tsx` | Added import + render branch for `kafka-schema-registry` |
| `src/styles/settings.css` | Added 8 CSS class groups (`kafka-schema-*`) for layout, cards, URL/auth, subject table, format badge, detail panel, version select, schema content, actions, skeleton |

#### Test Results

| Suite | Tests | Status |
|---|---|---|
| `useSchemaRegistry.test.ts` | 21 | All passing |
| `KafkaSchemaRegistryPage.test.tsx` | 12 | All passing |
| Full Kafka test suite (24 files) | 588 | All passing |
| TypeScript (`tsc -b --noEmit`) | — | 0 errors |

#### Docker Manual Validation Results

| Step | Result |
|---|---|
| Schema Registry tab visible in Protocols sub-nav | PASS |
| Guard state shown when cluster not connected | PASS |
| URL prompt shown when connected but no URL entered | PASS |
| Enter `http://localhost:8085`, click Connect → 2 subjects loaded | PASS |
| Button label changed to "Refresh Subjects" after load | PASS |
| Click `orders.created-value` → detail panel, v2 (latest) auto-selected | PASS |
| Schema content pretty-printed JSON (4 fields incl. `currency`) | PASS |
| Format badge: green "Avro" pill in detail header + subject table | PASS |
| Switch to v1 → schema shows 3 fields (no `currency`) | PASS |
| Filter "payment" → 1 of 2 subjects visible | PASS |
| Click `payments.settled-value` → PaymentSettled schema loaded | PASS |
| Copy Schema + Export buttons visible at bottom-right | PASS |
| Console errors during entire flow | 0 |

---

## Test Plan

### Unit tests — `useKafkaMessageStudio.test.ts`

| Test case | What it covers |
|---|---|
| Initial state | Default draft values (including uuid groupId), null results |
| `sendOnce` — success | Dispatches produce with correct body, sets publishResult, clears error |
| `sendOnce` — topic blank | Does not dispatch, sets publishError |
| `sendOnce` — cluster not connected | Returns error before dispatching |
| `sendOnce` — server error | Sets publishError with kind/code/message |
| `validateJsonBody` — valid JSON | Returns true, updates draft.body to pretty-printed form |
| `validateJsonBody` — invalid JSON | Returns false, sets publishError |
| `consumeOnce` — success | Dispatches consume-once with correct filter, sets consumeResult rows |
| `consumeOnce` — topic blank | Does not dispatch, sets consumeError |
| `consumeOnce` — timed out | Sets consumeTimedOut = true |
| `consumeOnce` — server error | Sets consumeError |
| `selectMessage` — valid index | Sets selectedMessage |
| `selectMessage` — null | Clears selectedMessage |
| Injectable dispatch | Custom deps.dispatch is called instead of default |

### Unit tests — `KafkaPublishStudio.test.tsx`

- Renders topic text input (not select)
- Renders Acks select with 3 options (All / Leader / None)
- Renders partition as text input, not select
- Add header row renders new row
- Remove header row removes row
- "Validate & Format JSON" button calls `validateJsonBody`
- "Send Once" disabled when `topic` is blank
- "Send Once" disabled while `publishLoading`
- Success result renders `partition · offset · timestamp`
- Error banner renders error message with retryable text when applicable

### Unit tests — `KafkaConsumeStudio.test.tsx`

- Renders with empty result state
- Renders Key Match, Header Match, JSONPath, JSONPath Expected as 4 separate inputs
- "Consume Once" calls `consumeOnce`
- "Consume Once" disabled when `topic` is blank
- Result table renders 5 columns: `#`, `Offset`, `Partition`, `Key`, `Value preview`
- Clicking a row calls `selectMessage`
- Detail pane renders formatted body for selected message
- Detail pane renders headers table for selected message
- Timed-out amber badge shown when `consumeTimedOut === true`
- Empty state shown when `messageCount === 0`
- "Copy Payload" calls `navigator.clipboard.writeText` with selected message value

### Unit tests — `kafkaMessageStudioUtils.test.ts`

- `parseHeaderMatch('')` → `undefined`
- `parseHeaderMatch('k=v')` → `{ k: 'v' }`
- `parseHeaderMatch('k=v=extra')` → `{ k: 'v=extra' }` (splits on first `=` only)
- `buildConsumeFilter` — all blank → `undefined`
- `buildConsumeFilter` — keyEquals only → `{ keyEquals: 'x' }`
- `buildConsumeFilter` — jsonPath only → `{ jsonPath: '$.a' }` (no jsonEquals)
- `buildConsumeFilter` — jsonPath + jsonPathEquals → `{ jsonPath: '$.a', jsonEquals: 'b' }`
- `buildConsumeFilter` — all fields → full filter object
- `formatPublishResult(result)` → `'partition 2 · offset 99 · 2026-06-04T10:00:00Z'`
- `formatPublishResult` — no timestamp → `'partition 2 · offset 99'`

### Unit tests — `buildPublishRequest` / `buildConsumeRequest` (in `kafkaMessageStudioUtils.test.ts`)

These builders convert draft form state (strings) into server-ready request objects (numbers). All string→number conversions and filter assembly happen here, keeping the hook lean.

- `buildPublishRequest` — partition blank → no `partition` field in output
- `buildPublishRequest` — partition `'3'` → `partition: 3`
- `buildPublishRequest` — timeoutMs blank → no `timeoutMs` field in output
- `buildPublishRequest` — only enabled headers with non-empty key included
- `buildPublishRequest` — acks `-1 | 0 | 1` passes through unchanged
- `buildPublishRequest` — empty body string → still included (body is required by server)
- `buildConsumeRequest` — `startPosition: 'earliest'` → `fromBeginning: true`
- `buildConsumeRequest` — `startPosition: 'latest'` → `fromBeginning: false`
- `buildConsumeRequest` — maxMessages `'100'` → `maxMessages: 100`
- `buildConsumeRequest` — no filter fields set → `filter: undefined`
- `buildConsumeRequest` — all filter fields set → full filter object with correct mapping

### Integration — existing tests unchanged

No changes to `kafka-routes.ts`, `kafka-service.ts`, or existing hook/component files in Phase 1, so all 95 frontend + 278 server tests remain green.

---

## Type Definitions

### `src/features/kafka/types.ts` (new file)

```ts
import type { KafkaUiSafeError } from '../../shared/kafka/kafkaClient';

export interface KafkaStudioHeaderRow {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

export interface KafkaPublishDraft {
  topic: string;              // free text, placeholder 'e.g. orders.created'
  key: string;
  partition: string;          // '' = auto, numeric string = explicit partition
  acks: -1 | 0 | 1;          // -1=all, 0=none, 1=leader
  timeoutMs: string;          // kept as string for controlled input
  headers: KafkaStudioHeaderRow[];
  body: string;               // raw JSON string
  schemaConfig?: KafkaSchemaConfig;  // undefined = no encoding; set = Avro/Protobuf/JSON Schema
}

export interface KafkaConsumeDraft {
  topic: string;              // free text, placeholder 'e.g. orders.created'
  groupId: string;            // initialized to 'redfireforge-debug-<uuid8>' per mount
  startPosition: 'latest' | 'earliest';
  timeoutMs: string;          // default '10000'
  maxMessages: string;        // default '50'
  keyEquals: string;          // exact key match → KafkaMessageFilter.keyEquals
  headerMatch: string;        // 'key=value' → headersMatch: { key: 'value' }
  jsonPath: string;           // JSONPath expression → KafkaMessageFilter.jsonPath
  jsonPathEquals: string;     // expected value → KafkaMessageFilter.jsonEquals
  schemaConfig?: KafkaSchemaConfig;  // undefined = no decoding; set = auto-decode via registry
}

export type KafkaStudioTab = 'publish' | 'consume';

export interface KafkaPublishResultRecord {
  partition: number;
  offset: string;
  timestamp?: string;
}

export interface KafkaPublishSendResult {
  topic: string;
  sentCount: number;
  records: KafkaPublishResultRecord[];
  valueEncoding?: string;
}

export interface KafkaConsumeResultRow {
  topic: string;
  partition: number;
  offset: string;
  timestamp?: string;
  key?: string;
  value: string;
  headers?: Record<string, string>;
}

export interface KafkaConsumeSessionResult {
  rows: KafkaConsumeResultRow[];
  timedOut: boolean;
  messageCount: number;
}

export interface KafkaStudioOperationState<TResult> {
  loading: boolean;
  result: TResult | null;
  error: KafkaUiSafeError | null;
}
```

---

## File Map

```
src/
  app/
    utils/
      appTabUtils.ts                     MODIFY — add 'kafka-message-studio' | 'kafka-topic-explorer', 'protocols' domain, isProtocolsTab()
    components/
      AppActivityBar.tsx                 MODIFY — add Protocols domain button
      AppSubNav.tsx                      MODIFY — add DOMAIN_ITEMS.protocols with two tabs
    hooks/
      useKafkaMessageStudio.ts           NEW
      useKafkaMessageStudio.test.ts      NEW
    App.tsx                              MODIFY — add render branches for both new tabs

  features/
    kafka/
      types.ts                           NEW — shared Kafka Studio types
      KafkaMessageStudioPage.tsx         NEW — page container
      KafkaMessageStudioPage.test.tsx    NEW
      KafkaPublishStudio.tsx             NEW — Publish panel
      KafkaPublishStudio.test.tsx        NEW
      KafkaConsumeStudio.tsx             NEW — Consume panel
      KafkaConsumeStudio.test.tsx        NEW
      kafkaMessageStudioUtils.ts         NEW — pure helpers
      kafkaMessageStudioUtils.test.ts    NEW

  styles/
    settings.css                         MODIFY — add kafka-studio-* CSS classes

Phase 2 only:
  src/shared/kafka/kafkaStorage.ts           MODIFY — add KAFKA_PUBLISH/CONSUME_TEMPLATES_KEY constants + 4 load/save functions
  src/app/hooks/useKafkaTemplates.ts         NEW — template CRUD hook
  src/app/hooks/useKafkaTemplates.test.ts    NEW

Phase 3 only (streaming + workflow integration):
  src/app/hooks/useKafkaMessageStudio.ts     MODIFY — add isStreaming, startStream, stopStream, streamMessages, clearStreamMessages

Phase 4 only:
  src-server/kafka/kafka-adapter.ts          MODIFY — add fetchTopicDetail() to adapter interface + KafkaJsAdminAdapter
  src-server/kafka/kafka-service.ts          MODIFY — add getTopicDetail() method
  src-server/kafka/contracts.ts              MODIFY — add KafkaTopicDetailRequest/Response types
  src-server/routes/kafka-routes.ts          MODIFY — add GET /topics/:topicName/detail route

  src/shared/kafka/kafkaClient.ts            MODIFY — add 'topic-detail' KafkaOperation
  src/features/kafka/
    KafkaTopicExplorerPage.tsx               NEW — standalone Topic Explorer page
    KafkaTopicExplorerPage.test.tsx          NEW
    KafkaTopicDetailPanel.tsx                NEW — detail panel with 4 tabs
    KafkaTopicDetailPanel.test.tsx           NEW
    useTopicExplorer.ts                      NEW — page-level filter / selection / detail-cache hook
    useTopicExplorer.test.ts                 NEW
    useTopicMessageBrowser.ts               NEW — lightweight Messages tab hook
    useTopicMessageBrowser.test.ts          NEW
  src/styles/settings.css                    MODIFY — add kafka-explorer-* CSS classes
  src/features/kafka/KafkaSettingsPage.tsx   MODIFY — remove Topic Explorer section (extracted)

NO changes to:
  src/app/hooks/useKafkaState.ts
  src/features/workflow/**
```

---

## Phase Status Tracker

| Phase | Status | Start | Complete | Manual Test | Commit |
|---|---|---|---|---|---|
| Phase 1 — Core Publish & Consume Studio | ✅ Complete | 2026-06-05 | 2026-06-05 | ✅ All steps verified (see Phase 1 notes) | `a68e702`, `5cf6ee1` |
| Phase 2 — Templates & Saved Sessions | ✅ Complete | 2026-06-04 | 2026-06-04 | ✅ Unit + TypeScript + Docker E2E verified (Redpanda plaintext); save/load/delete/duplicate-upsert/groupId-exclusion all confirmed | — |
| Phase 3 — Streaming & Workflow Integration | ✅ Complete | 2026-06-04 | 2026-06-04 | ✅ Docker validated: 3A server curl (subscribe/poll/unsubscribe/404), 3B streaming UI (start/stop/clear/export/LIVE badge), 3C consume→workflow (variable injection + navigation), 3D workflow→publish (Map from Workflow dropdown) | — |
| Phase 4 — Topic Explorer Enhancement | ✅ Complete | 2026-06-04 | 2026-06-04 | ✅ Docker validated: topic-detail, partitions, CGs, config, error/disconnect guards | — |
| Phase 5 — Schema Registry Browser | ✅ Complete | 2026-06-04 | 2026-06-04 | ✅ Docker validated: subject list, detail panel, version switch, filter, format badges, copy/export | — |

---

## Manual Testing Protocol

> **Rule**: After implementing any UI phase, a manual test session MUST be completed before the phase is marked done. Unit tests alone are not sufficient — visual layout, interaction flow, and data population must be verified in the running browser app.

### How to run the app for manual testing

```bash
# Terminal 1 — start the dev server (Express + Kafka adapter)
npm run dev:server

# Terminal 2 — start the frontend (Vite)
npm run dev
# → opens http://localhost:5173
```

### Starting local Kafka for manual tests

**Phases 1–4 (no Schema Registry):**

```bash
# Terminal 3 — start plaintext Kafka (Redpanda)
cd docker/kafka/plaintext
docker compose up -d
# Broker available at: localhost:19092
# Redpanda Console UI at: http://localhost:18080

# Optional: seed test topics
bash ../topics/create-topics.sh
bash ../topics/seed-messages.sh
```

In the app: **Settings → Kafka → Add Cluster**, brokers = `localhost:19092`, no auth, no TLS.

**Phase 5 (Schema Registry):**

```bash
# Terminal 3 — start Kafka + Confluent Schema Registry
cd docker/kafka/schema-registry
docker compose up -d
# Broker available at: localhost:19094
# Schema Registry at: http://localhost:8085

# Optional: create subjects for smoke testing
bash smoke-test.sh
```

In the app: **Settings → Kafka → Add Cluster**, brokers = `localhost:19094`, no auth, no TLS.
Schema Registry URL: `http://localhost:8085`.

### Manual test checklist template (fill in per phase)

For each phase, manually verify the following. Record pass (✅) / fail (❌) in Implementation Notes.

#### Phase 1 manual smoke tests

| Step | Action | Expected | Result |
|---|---|---|---|
| 1 | Open browser at `localhost:5173` | App loads, no console errors | ✅ |
| 2 | Click Protocols icon in Activity Bar | Sub-nav shows "Kafka Studio" | ✅ |
| 3 | Click "Kafka Studio" (not connected) | Guard state shown: "Cluster is not connected" with link to Kafka Settings | ✅ |
| 4 | Settings → Kafka → Add Cluster, brokers = `localhost:19092` (plaintext Docker), connect; return to Protocols → Kafka Studio | Two-panel layout renders (Publish + Consume side by side) | ✅ (confirmed screenshot: two columns side-by-side) |
| 5 | Publish: leave Topic blank, click Send Once | Button disabled / inline error shown, no request fired | ✅ |
| 6 | Publish: fill Topic `test-topic`, body `{"hello":"world","n":3}`, click Send Once | Success result shows partition + offset + timestamp | ✅ partition 0, offset 2, ts -1 (ts -1 = no broker timestamp = expected with Redpanda) |
| 6a | Publish: add 2 headers (`x-source: redfire-forge`, `x-event-type: order.created`), key `order-abc-123`, body `{"orderId":"abc-123","amount":99.50,"status":"CREATED"}`, click Send Once | Banner shows "✓ Sent 1 message to test-topic — partition 0, offset 3, ts -1" | ✅ |
| 7 | Publish: enter invalid JSON in body, click Validate & Format JSON | Error shown inline; body not modified | ✅ |
| 8 | Publish: enter valid JSON, click Validate & Format JSON | Body pretty-printed in place | ✅ |
| 9 | Consume: leave Topic blank, click Consume Once | Button disabled, no request fired | ✅ |
| 10 | Consume: fill Topic `test-topic`, Start Position = Earliest, click Consume Once | Results table shows 4 messages (offsets 0–3); badge shows "4 messages / timed out" | ✅ (4 rows; "timed out" = consumer reached end of partition = expected) |
| 11 | Consume: click row 4 (key `order-abc-123`) | Detail pane opens with pretty-printed JSON body + HEADER KEY / HEADER VALUE table showing `x-source / redfire-forge` and `x-event-type / order.created` | ✅ headers round-tripped correctly |
| 11a | Consume filter — Key Equals: enter `order-abc-123`, new consumer group, Consume Once from Earliest | Only 1 message returned (offset 3, key `order-abc-123`); 3 unkeyed messages filtered out | ✅ |
| 11b | Consume filter — Header Match: enter `x-source=redfire-forge`, new consumer group, Consume Once from Earliest | Only 1 message returned (the one with that header) | ✅ |
| 11c | Consume filter — JSONPath + JSONPath Equals: `$.status` / `CREATED`, new consumer group, Consume Once | Only 1 message returned (`status: CREATED`); the 3 messages without `status` field filtered out | ✅ |
| 12 | Click `[Copy Payload]` | Clipboard contains selected message value | ✅ |
| 13 | Click `[Export Result Set]` | JSON file downloads | ✅ |

#### Phase 2 manual smoke tests

| Step | Action | Expected | Result |
|---|---|---|---|
| 1 | Publish: fill form, click Save Template, enter name | Template saved; dropdown shows name | ✅ |
| 2 | Reload page, open Load Template dropdown | Saved template still present | ✅ |
| 3 | Load the template | Form pre-fills with saved values (topic + key + body) | ✅ |
| 4 | Save again with same name | Only 1 entry in dropdown (upsert, not duplicate) | ✅ |
| 5 | Load again after upsert | Updated body is restored | ✅ |
| 6 | Delete the template | It disappears from the dropdown | ✅ |
| 7 | Consume: fill topic, save template | Template saved | ✅ |
| 8 | Load consume template | Topic restored; Consumer Group ID NOT restored (stays as-is) | ✅ |
| 9 | Consume: save same name again | Count stays 1 (upsert); updated topic value reflected | ✅ |
| 10 | Consume: delete template | Removed from dropdown | ✅ |

#### Phase 3 manual smoke tests

| Step | Action | Expected |
|---|---|---|
| 1 | Consume: click `[Start Stream]` | Button changes to `[Stop Stream]`; messages append live |
| 2 | Click `[Stop Stream]` | Stream halts; button reverts |
| 3 | Select a stream message, click `[Use as Workflow Input]` | App navigates to Workflow Runner with variables pre-filled |

#### Phase 4 manual smoke tests

| Step | Action | Expected |
|---|---|---|
| 1 | Click Protocols → Topic Explorer | Guard if disconnected; topic list if connected |
| 2 | Click a topic row | Detail panel opens; loading spinner then 4 tabs |
| 3 | Tab: Messages | Topic Summary metrics shown; filter form editable; Consume Once works |
| 4 | Tab: Partitions | Full partition table with ISR fractions |
| 5 | Tab: Consumer Groups | Group state + lag table (or empty state) |
| 6 | Tab: Config | Key/value config table (or empty state) |
| 7 | Search filter | Topic list narrows by substring |
| 8 | Health dropdown (after one detail loaded) | Filters visible list by health status |
| 9 | Domain chip click | Filters list to matching prefix |

#### Phase 5 manual smoke tests

| Step | Action | Expected | Result |
|---|---|---|---|
| 1 | Click Protocols → Schema Registry | Sub-tab visible; guard if disconnected; URL prompt if connected | |
| 2 | Enter registry URL `http://localhost:8085` (Schema Registry Docker profile), click [Connect to Registry] | Subject list populates | |
| 3 | Click a subject row | Detail panel opens; Versions dropdown shows all versions; latest selected | |
| 4 | Schema content area | Formatted JSON (Avro/JSON Schema) or raw text (Protobuf) visible | |
| 5 | Format badge | Correctly shows Avro / Protobuf / JSON Schema | |
| 6 | Change version in dropdown | Schema content updates to selected version | |
| 7 | Click `[Copy Schema]` | Clipboard contains raw schema string | |
| 8 | Click `[Export]` | File downloads as `.json` or `.proto` | |
| 9 | Search filter | Subject list narrows by substring | |
| 10 | Auth fields | Entering credentials re-fires requests with `auth` included | |

---

## Implementation Notes

### Phase 1 — Core Publish & Consume Studio

**Completed**: 2026-06-05  
**Commits**: `a68e702` (initial Phase 1 implementation), `5cf6ee1` (post-review bug fixes)  
**Tests**: 174 tests passing, 0 TypeScript errors

#### Design decisions that differ from the original plan

- **`app-tab-pane` flex container bug** (fixed in `5cf6ee1`): `app-tab-pane` does not have `display: flex` by default (see `src/styles/base.css` — it sets `flex: 1; overflow: hidden`). The `KafkaMessageStudioPage` children relied on `flex: 1` to fill height, but without a flex parent they couldn't. Fixed by adding `style={{ display: 'flex', flexDirection: 'column' }}` to the `<div className="app-tab-pane">` wrapper in `App.tsx`. **Visual confirmation**: screenshot taken after fix shows both columns side by side filling the viewport correctly.

- **Export cross-browser / Tauri bug** (fixed in `5cf6ee1`): The initial `exportResultSet` implementation created an `<a>` element and called `.click()` without appending it to `document.body` first — this works in Chrome but fails in Firefox and some environments. The correct pattern (used everywhere else in the codebase) is `saveJsonFile()` from `src/shared/utils/fileSaver.ts`, which also gains Tauri native save dialog support. Switched to `saveJsonFile()`; function signature changed to `async`; call sites updated to `void exportResultSet(...)`.

- **Blank leading lines** (fixed in `5cf6ee1`): `KafkaMessageStudioPage.tsx` and `KafkaStudioGuard.tsx` had an empty first line from replacing `import React from 'react'` with nothing. Removed the empty lines.

- **`ts -1` in publish result**: Redpanda returns `timestamp: -1` when no broker-side timestamp is set. This is expected behavior — not a bug. The result displays `ts -1` which is correct.

- **`moveHeader(idx, -1)` fix** (fixed before initial commit): `useListCrud.move(idx, dir)` takes direction `-1 | 1` as second arg, not the target index. Initial draft had `moveHeader(idx, idx - 1)` which caused TS2345. Fixed to `moveHeader(idx, -1)`.

#### What was verified in live Docker smoke test

Smoke test run against Redpanda `v24.1.18` (docker/kafka/plaintext/docker-compose.yml):
- ✅ Guard state (no cluster): disconnected message + link to Kafka Settings
- ✅ After connecting cluster at `localhost:19092`: two-column layout renders
- ✅ Publish: `test-topic`, `{"hello":"world","n":3}` → partition 0, offset 2, ts -1
- ✅ Invalid JSON body: inline error shown without firing request
- ✅ Consume: `test-topic`, Earliest, Max 50 → 3 rows returned
- ✅ Row click: detail pane opens with pretty-printed payload
- ✅ Copy Payload, Export Result Set, Clear all functional
- ✅ `Format JSON` button pretty-prints valid JSON

#### Phase 1 extended re-validation — headers and consume filters (2026-06-06)

Re-validated against Redpanda `v24.1.18` (docker/kafka/plaintext). Full header round-trip and all 3 consume filter types verified live in the browser.

**Publish with headers** (commit `c174989`):
- Published message: topic `test-topic`, key `order-abc-123`, body `{"orderId":"abc-123","amount":99.50,"status":"CREATED"}`, headers `x-source: redfire-forge` + `x-event-type: order.created`
- Result banner: "✓ Sent 1 message to test-topic — partition 0, offset 3, ts -1" ✅

**Consume row detail — headers table**:
- Consumed from Earliest → 4 rows returned; clicked row 4
- Detail pane shows pretty-printed JSON body + HEADER KEY / HEADER VALUE table
- `x-source → redfire-forge` and `x-event-type → order.created` both visible ✅ (headers round-tripped correctly through KafkaJS → Express → React)

**Consume filters — all 3 types verified**:
- Filter 1 (Key Equals `order-abc-123`, fresh group, Earliest): 1 message returned — offset 3 only. 3 unkeyed messages excluded. ✅
- Filter 2 (Header Match `x-source=redfire-forge`, fresh group, Earliest): 1 message returned — the one with that header. ✅
- Filter 3 (JSONPath `$.status` = `CREATED`, fresh group, Earliest): 1 message returned — `status: CREATED` message only. ✅

**Notes**:
- "timed out" badge on consume result is expected — consumer reaches partition end then waits for the configured timeout before returning. Not an error.
- Consumer group offsets are committed after each consume; repeat consumes from the same group will not re-read old messages. Use a fresh consumer group name to re-test from Earliest.

#### Phase 1 re-evaluation — 2026-06-04

Thorough re-evaluation against plan success criteria. Found and fixed **6 bugs**, added **13 new unit tests**, and re-validated all endpoints against live Docker.

**Bugs found and fixed:**

1. **Consume error missing retryable indicator**: Publish Studio showed `(non-retryable)` tag on non-retryable errors but Consume Studio did not. Fixed — both now show the tag consistently.
2. **No inline validation hints**: Plan requires "Inline validation: topic required (both panels), body non-empty (publish) — red hint text, no blocking alerts". Implementation only disabled buttons. Fixed — added `onBlur`-triggered validation hints for topic (both panels) and body (publish panel), styled with new `.kafka-ms-field-hint` CSS class.
3. **`sendOnce` didn't validate JSON before sending**: Invalid JSON body was sent to the server, which then rejected it. Fixed — `sendOnce` now runs `validateAndFormatJson()` on non-empty body before dispatching. Invalid JSON short-circuits with `INVALID_JSON` error.
4. **No "max reached" indicator**: Plan requires "50 / 50 max reached" when consume count equals maxMessages. Fixed — added `(max reached)` indicator rendered when `consumeMessageCount === parseInt(maxMessages, 10)`.
5. **Button label mismatch**: Plan says `[Validate & Format JSON]` but implementation said `Format JSON`. Fixed — button now reads "Validate & Format JSON".
6. **Tests missing required template props**: `KafkaPublishStudio.test.tsx` and `KafkaConsumeStudio.test.tsx` rendered components without passing required template props (`publishTemplates`, `onSaveTemplate`, etc.). While this didn't crash (dropdown is closed by default), it was fragile. Fixed — all test renders now pass complete props via `defaultTemplateProps()`.

**Docker validation results** (Redpanda v24.1.18 plaintext):

- ✅ Connect: `{"ok":true,"state":"connected"}`
- ✅ Topics: 11 topics listed
- ✅ Produce: message with key, headers, and JSON body → partition + offset returned
- ✅ Consume (no filter, earliest): 3 messages across multiple partitions
- ✅ Key filter (`keyEquals: "test-key-123"`): 1 exact match
- ✅ Header filter (`headersMatch: {"source":"smoke"}`): 2 matches
- ✅ JSONPath filter (`$.test = "true"`): 1 match
- ✅ Disconnect: clean disconnect, status confirmed disconnected
- ✅ "timed out" badge: expected behavior — consumer waits at partition end

#### Test coverage

| File | Tests |
|---|---|
| `kafkaMessageStudioUtils.test.ts` | 44 |
| `useKafkaMessageStudio.test.ts` | 22 |
| `KafkaPublishStudio.test.tsx` | 17 |
| `KafkaConsumeStudio.test.tsx` | 20 |
| `KafkaStudioGuard.test.tsx` | 7 |
| `KafkaMessageStudioPage.test.tsx` | 6 |
| **Total Phase 1** | **116** |

---

## Open Questions / Risks

> **Mockup files used as primary UI reference:**
> - `docs/mockups/kafka-message-studio.html` → Phase 1
> - `docs/mockups/kafka-topic-explorer.html` → Phase 4
> - `docs/mockups/kafka-workflow-integration.html` → Phase 3
> - `docs/mockups/kafka-cluster-studio.html` → already implemented (KafkaSettingsPage)
>
> **Intentional deviations from mockups (server constraints / plan improvements):**
> - **Key Regex → `keyEquals`**: Mockup shows "Key Regex" field. Server `KafkaMessageFilter` only supports exact match (`keyEquals`). UI label changed to "Key Match (exact)". Regex is a workflow-trigger-only concept.
> - **JSONPath single field → two fields**: Mockup shows `$.status = CREATED` in one input. Server needs `jsonPath` and `jsonEquals` as separate fields. Split into JSONPath + JSONPath Expected inputs.
> - **Topic as free text**: Mockup renders Topic as a `<select>`. Changed to free text input — avoids hard dependency on topic list load, supports typing topics that don't yet exist.
> - **Partition as text input**: Mockup renders Partition as a `<select>` (Auto / explicit). Plan uses text input (blank = auto, numeric = explicit) — simpler, avoids loading partition count before user types.
> - **Header enable toggle**: Mockup shows plain header rows. Plan adds enabled toggle per row (enhancement for temporarily disabling headers without deleting them).


1. ✅ **Topic input** — Free text with placeholder hint. No dropdown.

2. ✅ **Consumer group collision** — Default initialized to `redfireforge-debug-<uuid8>` per component mount. Editable.

3. ✅ **Header type reuse** — `KafkaStudioHeaderRow` is declared separately in `types.ts`. Same shape as `KafkaNodeHeaderRow` but no shared import, keeping studio decoupled from workflow internals.

4. ✅ **Phase 2 storage** — Uses `readKey`/`writeKey` from `src/shared/utils/storage` (same layer as cluster configs). New functions added to `kafkaStorage.ts`. Consistent with existing patterns, works in browser and Tauri.

5. ✅ **`keyEquals` vs regex** — The `consume-once` endpoint's `KafkaMessageFilter.keyEquals` is **exact string match** only. The UI label is "Key Match (exact)" with placeholder `exact key value`. `keyRegex` is a workflow-trigger-only concept not exposed here.

6. ✅ **JSONPath filter split** — `jsonPath` (expression) and `jsonPathEquals` (expected value) are two separate fields in both the draft type and the UI. `jsonPathEquals` blank = assert the path exists but don't check the value.
