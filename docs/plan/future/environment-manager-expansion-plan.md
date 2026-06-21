# Environment Manager Expansion Plan

---

## Phase Status Tracker

| Phase | Title | Status | Notes |
|---|---|---|---|
| Pre-P1 | Demo lesson cleanup | ✅ Done | `ws-workspace.ts` and `sse-studio.ts` env-manager navigation steps removed; `sse-env-vars` step present; `allowedTabs: ['environments']` never added |
| Phase 1 | Data Model & Fallback Logic | ✅ Done | `ProtocolKey`, `ProtocolEndpoint`, `buildEnvVarMap()`, studio wiring, export test |
| Phase 2 | Environment Manager UI: Protocol Tabs | ✅ Done | 2026-06-20 re-eval gaps fixed (strict gRPC host:port + partial SSE fallback callout) |
| Phase 3 | App Header Protocol Indicator | ✅ Done | 2026-06-20 re-eval gaps fixed (tooltip guidance + non-context hide regressions + coverage >90% + header-indicator color tokenization) |
| Phase 4 | Studio Integration | ✅ Done | 2026-06-20 re-eval fixed unknown-row preview status semantics + added focused branch regressions (coverage >90%) |
| Phase 5 | Demo Lesson Updates | ✅ Done | ws-workspace, sse-studio, gql-first-query env-manager steps |

---

## Comprehensive Re-evaluation (2026-06-20)

Full cross-phase re-validation was re-run after repeated hardening loops to ensure no remaining regressions across Phase 1–5.

**Phase 1 (core implementation paths) re-validation:**
- `npx vitest run src/shared/utils/envVarUtils.test.ts src/features/websocket/wsMessageUtils.test.ts src/features/graphql/utils/envUtils.test.ts src/features/graphql/GraphqlStudioPage.test.tsx src/features/sse/SseStudioPage.test.tsx src/features/graphql/hooks/useGraphqlBatchExecution.test.ts src/features/graphql/hooks/useGraphqlCollectionRun.test.ts src/features/graphql/hooks/useSubscriptionOrchestration.test.ts src/features/graphql/hooks/useGqlKeyboardShortcuts.test.ts --coverage --coverage.reporter=text --coverage.include=src/shared/utils/envVarUtils.ts --coverage.include=src/features/websocket/wsMessageUtils.ts --coverage.include=src/features/graphql/utils/envUtils.ts --coverage.include=src/features/graphql/GraphqlStudioPage.tsx --coverage.include=src/features/sse/SseStudioPage.tsx --coverage.include=src/features/graphql/hooks/useGraphqlBatchExecution.ts --coverage.include=src/features/graphql/hooks/useGraphqlCollectionRun.ts --coverage.include=src/features/graphql/hooks/useSubscriptionOrchestration.ts --coverage.include=src/features/graphql/hooks/useGqlKeyboardShortcuts.ts`
  - **9 files, 402 tests passed**
  - **Coverage:** statements **99.52%**, branches **93.89%**, functions **98.26%**, lines **99.72%**

**Phase 2 re-validation:**
- `npx vitest run src/features/environments/utils/protocolEndpointUtils.test.ts src/features/environments/EnvironmentManager.test.tsx --coverage --coverage.reporter=text --coverage.include=src/features/environments/utils/protocolEndpointUtils.ts --coverage.include=src/features/environments/components/DerivedVarsPanel.tsx --coverage.include=src/features/environments/components/MicroserviceProtocolPanel.tsx --coverage.include=src/features/environments/EnvironmentManager.tsx`
  - **2 files, 80 tests passed**
  - **Coverage:** statements **96.22%**, branches **90.23%**, functions **99.31%**, lines **98.87%**

**Phase 3 re-validation:**
- `npx vitest run src/app/utils/headerProtocolUtils.test.ts src/app/components/AppHeader.test.tsx --coverage --coverage.reporter=text --coverage.include=src/app/utils/headerProtocolUtils.ts --coverage.include=src/app/components/HeaderProtocolIndicator.tsx --coverage.include=src/app/components/AppHeader.tsx`
  - **2 files, 36 tests passed**
  - **Coverage:** statements **98.68%**, branches **95.52%**, functions **100%**, lines **98.46%**

**Phase 4 re-validation:**
- `npx vitest run src/shared/utils/studioEndpointPreview.test.ts src/features/websocket/WebSocketConnectPanel.test.tsx src/features/sse/SseStudioPage.test.tsx src/features/graphql/components/GraphqlConnectionBar.test.tsx src/features/graphql/components/GraphqlHeadersPanel.test.tsx --coverage --coverage.reporter=text --coverage.include=src/shared/utils/studioEndpointPreview.ts --coverage.include=src/shared/components/ProtocolEndpointPreview.tsx --coverage.include=src/features/websocket/WebSocketConnectPanel.tsx --coverage.include=src/features/sse/SseStudioPage.tsx --coverage.include=src/features/graphql/components/GraphqlConnectionBar.tsx --coverage.include=src/features/graphql/components/GraphqlHeadersPanel.tsx`
  - **5 files, 330 tests passed**
  - **Coverage:** statements **99.67%**, branches **93.49%**, functions **100%**, lines **99.63%**

**Global compile gate:**
- `npx tsc -b --noEmit` → **passed with no type errors**

**Outcome:**
- No additional phase-level functional defects were identified after the comprehensive rerun.
- Coverage remains above 90% across focused phase implementation targets.
- Duplication review found no additional extraction candidates beyond the already-shared helper modules/components introduced by the plan.

**One-more round re-validation (2026-06-20):**
- Re-ran focused Phase 2/3/4/5 suites and compile gate with no code changes required.
- Phase 2 (`protocolEndpointUtils` + `EnvironmentManager`) remained green: **80 tests passed**, focused branches **90.23%**.
- Phase 3 (`headerProtocolUtils` + `AppHeader`) remained green: **36 tests passed**, focused branches **95.52%**.
- Phase 4 (studio endpoint preview integration set) remained green: **330 tests passed**, focused branches **93.49%**.
- Phase 5 (lesson/helper set) remained green: **140 tests passed**, focused branches **97.93%**.
- `npx tsc -b --noEmit` passed with no type errors.
- Result: no additional bugs, regressions, or duplication issues found in this round.

**GraphQL lesson helper modularization (2026-06-20):**
- Refactored the monolithic GraphQL lesson helper module from one large file into split lesson-focused modules under `src/features/demo-player/lessons/protocols/graphql-lesson-helpers/`.
- Kept the public API stable through a barrel re-export at `src/features/demo-player/lessons/protocols/graphql-lesson-helpers.ts` so existing lesson imports did not need to change.
- Extracted shared cross-lesson primitives into the new core module (`core.ts`) and rewired lesson modules to import from core instead of relying on file-global symbol bleed.
- Validation:
  - `npx tsc -b --noEmit` passed after refactor.
  - `npx vitest run src/features/demo-player/lessons/protocols/graphql-*.test.ts` passed (**13 files, 186 tests**).
- Outcome: file-size/composability risk is reduced while preserving runtime behavior and test coverage in GraphQL lesson flows.

---

## Executive Summary

The current Environment Manager supports one concept: a **microservice** with a **Base URL** per environment. That single HTTP base URL drives all resolved variables (`{{baseUrl}}`, `{{wsBaseUrl}}`, `{{host}}`).

As RedfireForge adds WebSocket Studio, GraphQL Studio, SSE Studio, gRPC (planned), and eventually other protocol studios, each protocol needs its own endpoint configuration that may differ from the HTTP base URL. A GraphQL endpoint is `https://api.example.com/graphql` while the same microservice's WebSocket endpoint might be `wss://ws.example.com/v2`. These cannot all be derived from one HTTP URL.

This plan expands the Environment Manager to model these realities without breaking existing data.

---

## Current State Analysis

### Data Model

```typescript
interface Environment {
  id: string;
  name: string;
}

interface Microservice {
  id: string;
  name: string;
  baseUrls: Record<string, string>;        // environmentId → HTTP base URL
  authProfileIds?: Record<string, string>; // environmentId → GlobalAuthProfile id
  customEnvs?: Environment[];              // per-service additional environments
}
```

### Derived Variables (today)

When a user selects an environment + microservice in the app header, `buildWsEnvVarMap()` builds:

| Variable | Value | Source |
|---|---|---|
| `{{baseUrl}}` | e.g. `http://localhost:9876` | `baseUrls[envId]` directly |
| `{{wsBaseUrl}}` | e.g. `ws://localhost:9876` | `baseUrl` with `http→ws`, `https→wss` |
| `{{host}}` | e.g. `localhost:9876` | hostname extracted from `baseUrl` |
| `{{envName}}` | e.g. `local` | environment name |
| `{{svcName}}` | e.g. `echo-server` | microservice name |

### Problems with Current Approach

1. **One URL, many protocols.** WebSocket, GraphQL, gRPC, and SSE endpoints often live on different hosts, ports, or paths than the HTTP REST API. All derived from one `baseUrl` is fragile.
2. **No GraphQL-specific config.** GraphQL Studio has its own local env vars (tab-level) that are not connected to the global Environments system.
3. **No SSE-specific endpoint.** SSE uses HTTP, so `{{baseUrl}}` works — but the SSE endpoint path may differ per environment.
4. **gRPC is not HTTP.** gRPC uses `host:port` with no path. Deriving it from an HTTP URL is always wrong.
5. **Demo lessons cannot accurately demonstrate env config** because the UI doesn't reflect the per-protocol structure yet.

---

## Proposed Data Model

### Phase 1 — Protocol Endpoint Map per Microservice (additive, non-breaking)

Add an optional `protocolEndpoints` map to `Microservice`. Each protocol can have its own base URL per environment. If not set, the existing `baseUrls` value is used as the fallback.

```typescript
type ProtocolKey = 'http' | 'websocket' | 'sse' | 'graphql' | 'grpc';

interface ProtocolEndpoint {
  baseUrl: string;               // protocol-specific base URL / address
  path?: string;                 // optional default path (e.g. /graphql, /subscriptions)
  tls?: boolean;                 // override TLS for this protocol
}

interface Microservice {
  id: string;
  name: string;
  baseUrls: Record<string, string>;         // EXISTING — envId → HTTP base URL (kept for compat)
  authProfileIds?: Record<string, string>;  // EXISTING
  customEnvs?: Environment[];               // EXISTING
  protocolEndpoints?: Record<             // NEW
    ProtocolKey,
    Record<string, ProtocolEndpoint>        // envId → endpoint config
  >;
}
```

### Phase 2 — Derived Variable Expansion

Each protocol contributes its own variables to the env var map:

| Variable | Protocol | Example Value |
|---|---|---|
| `{{baseUrl}}` | HTTP | `http://api.example.com` |
| `{{wsBaseUrl}}` | WebSocket | `wss://ws.example.com` |
| `{{sseUrl}}` | SSE | `https://events.example.com` |
| `{{graphqlUrl}}` | GraphQL | `https://api.example.com/graphql` |
| `{{grpcHost}}` | gRPC | `grpc.example.com:50051` |
| `{{host}}` | All | `api.example.com` |
| `{{envName}}` | All | `staging` |
| `{{svcName}}` | All | `orders-service` |

**Fallback chain:**
- If `protocolEndpoints.websocket[envId]` exists → use it for `{{wsBaseUrl}}`
- Otherwise → derive from `baseUrls[envId]` as today (backward compatible)

---

## UI Changes

### Environment Manager — Microservice Card Redesign

Each microservice card, when expanded, currently shows a single "Base URL" table. The redesign adds protocol tabs inside the card:

```
┌─────────────────────────────────────────────────────────────────┐
│  orders-service                              Configure | Delete  │
├─────────────────────────────────────────────────────────────────┤
│  [HTTP]  [WebSocket]  [SSE]  [GraphQL]  [gRPC]                  │
├─────────────────────────────────────────────────────────────────┤
│  ENV        BASE URL / ADDRESS              AUTH                 │
│  ───────────────────────────────────────────────────────────── │
│  local    https://api.local.svc            [None ▾]             │
│  staging  https://api.staging.svc          [OAuth2 ▾]           │
│  prod     https://api.prod.svc             [OAuth2 ▾]           │
└─────────────────────────────────────────────────────────────────┘
```

- **HTTP tab** — existing `baseUrls` behavior, no change in look
- **WebSocket tab** — `wss://` address per environment (not derived, explicitly set)
- **SSE tab** — `https://` event-stream URL per environment
- **GraphQL tab** — `https://` graphql endpoint + optional default path
- **gRPC tab** — `host:port` address per environment (no scheme)
- Each tab is **optional**; if left blank, the protocol falls back to the HTTP base URL derivation (current behavior)

### App Header — Protocol Context Indicator

Currently the header shows `[Env ▾] [Service ▾]`. Add a subtle protocol indicator that shows which endpoint is active for the current studio:

```
[local ▾]  [orders-service ▾]  · ws://ws.local.svc ✓
```

This resolves to the currently active protocol's endpoint. Green ✓ means the endpoint is configured; amber ⚠ means it's falling back to the HTTP derivation; red ✗ means unresolved.

### Mockup Alignment Audit (2026-06-20)

Reference mockup: `docs/mockups/environment-manager-expanded.html`

Items already represented in this plan:
- Protocol tabs inside each expanded microservice card (HTTP / WebSocket / SSE / GraphQL / gRPC)
- GraphQL default path support (`/graphql` fallback)
- gRPC `host:port` model and no HTTP fallback
- Header protocol indicator with status colors

Mockup requirements that were missing or underspecified and are now part of this plan:
- **Per-card protocol completeness badges** in the card header (`HTTP 3/3`, `WS 3/3`, `GraphQL 1/3`, etc.)
- **Per-tab completeness indicator** that supports numeric counts (`3/3`, `1/3`, `0/3`) and a fallback label
- **Fallback callout notice** inside SSE and gRPC panels explaining fallback/unresolved behavior
- **Derived variables preview panel** per active protocol (e.g., `{{wsBaseUrl}}`, `{{graphqlUrl}}`) for selected env/service
- **Inline row editor UX** (`Edit` → inline input row with `Save/Cancel`) explicitly called out as the expected interaction pattern
- **Per-tab column differences**:
  - HTTP and WebSocket show Auth Profile column
  - SSE has endpoint-only column set (no auth in mockup)
  - GraphQL includes endpoint + default path columns
  - gRPC includes endpoint + TLS toggle columns
- **gRPC TLS is per-environment in UI** (toggle in the gRPC table)

### Mockup Acceptance Checklist (Phase 2/3)

Use this checklist as the implementation and QA gate for `docs/mockups/environment-manager-expanded.html`.

| ID | Mockup requirement | Phase | Acceptance criteria |
|---|---|---|---|
| AC-EM-01 | Expanded microservice card contains protocol tabs: HTTP, WebSocket, SSE, GraphQL, gRPC | Phase 2 | Expanding a service card renders exactly 5 tabs in stable order; selecting each tab swaps panel content without leaving the card |
| AC-EM-02 | Card header protocol completeness badges (`HTTP 3/3`, etc.) | Phase 2 | Badge counts reflect configured env count per protocol in real time after save/cancel/edit |
| AC-EM-03 | Tab-level completeness indicator supports numeric, fallback, and empty states | Phase 2 | Each protocol tab shows `N/N`, `fallback`, or `0/N` based on resolved endpoint data; state updates after edits |
| AC-EM-04 | HTTP tab columns: Environment, Base URL, Auth Profile | Phase 2 | HTTP panel renders exact column contract; Auth dropdown persists to existing auth map |
| AC-EM-05 | WebSocket tab columns: Environment, WebSocket Address, Auth Profile | Phase 2 | WebSocket panel supports explicit endpoint edit per env and auth selector per env |
| AC-EM-06 | SSE tab columns: Environment, SSE Endpoint only | Phase 2 | SSE panel has no auth column; blank endpoint renders fallback state text and warning badge |
| AC-EM-07 | GraphQL tab columns: Environment, GraphQL Endpoint, Default Path | Phase 2 | Default path input persists per env and contributes to `{{graphqlUrl}}` derivation |
| AC-EM-08 | gRPC tab columns: Environment, gRPC Address, TLS | Phase 2 | gRPC panel enforces strict host:port format (no scheme, numeric port) and exposes TLS toggle per env |
| AC-EM-09 | SSE fallback callout notice | Phase 2 | SSE panel displays explicit fallback notice when any deployed row is using fallback, and hides notice only when fully explicit or fully empty |
| AC-EM-10 | gRPC unresolved callout notice (no HTTP fallback) | Phase 2 | gRPC panel shows unresolved warning until at least one grpc address is configured |
| AC-EM-11 | Inline row editing pattern (`Edit` → inline input row + Save/Cancel) | Phase 2 | Clicking Edit opens inline editor for target row only; Save persists; Cancel restores prior value |
| AC-EM-12 | URL status chips: set, fallback, empty | Phase 2 | Row status chip state is computed from explicit endpoint presence and fallback rules; visual state matches data |
| AC-EM-13 | Derived variables panel per protocol | Phase 2 | Active protocol panel includes derived variable preview for selected env/service (`{{baseUrl}}`, `{{wsBaseUrl}}`, `{{graphqlUrl}}`, etc.) |
| AC-EM-14 | Header protocol indicator badge (dot + resolved URL + status) | Phase 3 | App header shows active studio protocol endpoint with colored dot and status symbol |
| AC-EM-15 | Header badge status semantics (✓ explicit, ⚠ fallback, ✗ unresolved) | Phase 3 | Badge status reflects the exact resolution state computed from env+service+protocol endpoint chain |
| AC-EM-16 | Header tooltip includes full resolved URL and fallback reason | Phase 3 | Hover/focus tooltip shows resolved value, source protocol, and fallback reason when applicable |
| AC-EM-17 | Protocol-specific validation hints | Phase 2 | Invalid input states show inline warnings: WS requires ws/wss, HTTP/SSE/GraphQL require http/https, gRPC forbids scheme |
| AC-EM-18 | Persistence and migration safety | Phase 1/2 | Existing microservices without `protocolEndpoints` load unchanged; new endpoint edits persist and reload correctly |
| AC-EM-19 | Studio inline resolved-endpoint preview | Phase 4 | Connect panels show `→ Resolved: URL ✓/⚠/✗` when draft URL contains `{{vars}}` or resolves differently; status matches protocol row semantics |
| AC-EM-20 | Studio global env map wiring | Phase 4 | WS/SSE/GraphQL studios use `buildEnvVarMap(..., protocol, ...)` when env+service selected; GraphQL headers/endpoint/batch/subscription resolve global vars |
| AC-EM-21 | Demo lessons demonstrate per-protocol Environment Manager config | Phase 5 | ws-workspace, sse-studio, gql-first-query navigate to EM protocol tabs and show studio template resolution |

### Mockup Completion Gate

Phase 2 is complete only when AC-EM-01 through AC-EM-13 and AC-EM-17 through AC-EM-18 pass.

Phase 3 is complete only when AC-EM-14 through AC-EM-16 pass.

Phase 4 is complete only when AC-EM-19 through AC-EM-20 pass (gRPC deferred until studio ships).

Phase 5 is complete only when AC-EM-21 pass.

---

## Migration Strategy

### Backward Compatibility

- `Microservice.baseUrls` is **never removed** — it remains the HTTP source and the universal fallback
- `protocolEndpoints` is optional; if absent, all behavior is exactly as today
- Existing persisted data (localStorage / IDB) loads without any migration step

### Storage

`protocolEndpoints` is stored inside the `Microservice` object in the same storage location as today. No new stores needed in Phase 1.

### Env Var Map Builder

Replace `buildWsEnvVarMap` (WebSocket-specific) with a generic `buildEnvVarMap(svc, envId, protocolKey)`:

```typescript
function buildEnvVarMap(
  svc: Microservice,
  envId: string,
  protocol: ProtocolKey,
  envName: string,
): Record<string, string> {
  const httpBase = svc.baseUrls[envId] ?? '';
  const protoEndpoint = svc.protocolEndpoints?.[protocol]?.[envId];

  const map: Record<string, string> = {};

  // Universal variables
  if (httpBase) {
    map.baseUrl = httpBase;
    map.host    = extractHost(httpBase);
  }
  map.envName = envName;
  map.svcName = svc.name;

  // Protocol-specific variables
  switch (protocol) {
    case 'websocket': {
      const wsBase = protoEndpoint?.baseUrl ?? httpToWsUrl(httpBase);
      if (wsBase) map.wsBaseUrl = wsBase;
      break;
    }
    case 'sse': {
      const sseBase = protoEndpoint?.baseUrl ?? httpBase;
      if (sseBase) map.sseUrl = sseBase;
      break;
    }
    case 'graphql': {
      const gqlBase = protoEndpoint?.baseUrl ?? httpBase;
      const path    = protoEndpoint?.path ?? '/graphql';
      if (gqlBase) map.graphqlUrl = `${gqlBase}${path}`;
      break;
    }
    case 'grpc': {
      const grpcAddr = protoEndpoint?.baseUrl;  // no fallback — gRPC needs explicit config
      if (grpcAddr) map.grpcHost = grpcAddr;
      break;
    }
  }

  return map;
}
```

---

## Implementation Phases

### Phase 1 — Data Model & Fallback Logic (foundational)

**Scope:** No Environment Manager UI change. Add `protocolEndpoints` to the `Microservice` type, centralize env-var derivation in `buildEnvVarMap`, and wire protocol studios to consume it with backward-compatible fallbacks.

**Deliverables:**
- [x] Add `ProtocolKey` and `ProtocolEndpoint` types to `src/shared/types/index.ts`
- [x] Add optional `protocolEndpoints` field to `Microservice`
- [x] Write `buildEnvVarMap(svc, envId, protocol, envName)` in `src/shared/utils/envVarUtils.ts` with helpers `httpToWsUrl`, `extractHost`, `joinBaseAndPath`
- [x] Keep `buildWsEnvVarMap` in `wsMessageUtils.ts` as a thin backward-compat wrapper (legacy callers/tests that only pass `resolvedBaseUrl`)
- [x] Pass `selectedSvc` + `selectedEnvId` from `App.tsx` to WebSocket, SSE, and GraphQL studios (in addition to existing `resolvedBaseUrl` / name props)
- [x] Update WebSocket Studio to prefer `buildEnvVarMap(selectedSvc, selectedEnvId, 'websocket', envName)` when svc/env are available
- [x] Update SSE Studio to prefer `buildEnvVarMap(..., 'sse', ...)` — adds `{{sseUrl}}` (falls back to HTTP base URL)
- [x] Update GraphQL Studio to build `buildEnvVarMap(..., 'graphql', ...)` and merge global vars into `resolveVars` / `findUnresolvedVars` (local GraphQL tab env overrides global header vars)
- [x] Pass `globalEnvMap` through GraphQL hooks that resolve endpoints (`useSubscriptionOrchestration`, `useGraphqlBatchExecution`, `useGraphqlCollectionRun`)
- [x] Verify `SettingsExportImportTab` export writes the full `Microservice` object (add unit test with `protocolEndpoints` payload)
- [x] Unit tests for `buildEnvVarMap` (all protocols, fallback behavior, explicit `protocolEndpoints`, path joining, missing fields)

**Phase 1 vs Phase 4 boundary:**
- Phase 1 = data model + `buildEnvVarMap` + studios consume the map (including GraphQL var resolution via merged map)
- Phase 4 = per-studio **inline resolved preview UI** (e.g. `wss://ws.example.com/ws ✓` badge in connect panel) and any remaining polish

**Risk:** Low. All changes are additive. Existing behavior is preserved via fallback.

**Implementation Notes (2026-06-20 re-evaluation):**
- Fixed TypeScript issues in protocol tab support helpers (`DerivedVarsPanel` helper signature cleanup and type-safe `patchProtocolEndpoints` updates).
- Stabilized `EnvironmentManager` tests for the new derived-variables panel where endpoint/env text now appears in multiple UI locations.
- Added a GraphQL Studio test for the `selectedSvc + selectedEnvId` global env-map path to cover the branch that builds protocol-specific `{{graphqlUrl}}`.
- Re-ran focused Phase 1 validation (`tsc -b --noEmit` plus targeted suites for env-var utils, env manager, export/import, wsMessageUtils, WebSocket/SSE/GraphQL pages, and GraphQL orchestration hooks): all passing.
- Targeted Phase 1 coverage re-check is now above 90% across all included files (Statements 99.0%, Branches 92.76%, Functions 97.33%, Lines 99.33%).

---

### Phase 2 — Environment Manager UI: Protocol Tabs

**Scope:** Redesign the microservice card to show per-protocol endpoint tables.

**Deliverables:**
- [x] Protocol tab bar inside expanded microservice card (HTTP / WebSocket / SSE / GraphQL / gRPC)
- [x] Card-header protocol status badges per microservice (e.g., `HTTP 3/3`, `WS 2/3`, `GraphQL 1/3`, `gRPC 0/3`)
- [x] Tab-level completeness indicator (`N/N`, `fallback`, `0/N`) with protocol color coding
- [x] Per-tab env-grid columns follow mockup contract:
  - HTTP: Environment, Base URL, Auth Profile
  - WebSocket: Environment, WebSocket Address, Auth Profile
  - SSE: Environment, SSE Endpoint (optional), no auth column
  - GraphQL: Environment, GraphQL Endpoint, Default Path
  - gRPC: Environment, gRPC Address, TLS
- [x] gRPC tab shows `host:port` label and validation (no `://` scheme)
- [x] gRPC TLS toggle is editable per environment
- [x] GraphQL tab adds optional "Default path" column (defaults to `/graphql`)
- [x] Inline save/cancel editing per cell (same UX as today's HTTP table)
- [x] SSE panel includes fallback notice (`{{sseUrl}}` falls back to HTTP base URL)
- [x] gRPC panel includes unresolved notice (`{{grpcHost}}` unresolved until configured)
- [x] Derived variables panel in each protocol tab for selected env/service context
- [x] Persist `protocolEndpoints` on every edit via `setMicroservices`
- [x] Audit log entries for per-protocol URL changes
- [x] Phase 2 CSS in `src/styles/environment-manager.css` (protocol tabs, badges, derived vars, status chips)
- [x] Unit tests covering AC-EM-01 through AC-EM-13 and AC-EM-17 in `EnvironmentManager.test.tsx`

**Risk:** Medium. UI is more complex; requires careful styling and keyboard navigation.

**Implementation Notes (2026-06-20 re-evaluation):**
- Fixed `buildEnvVarMap` fallback: empty stored `baseUrl` with explicit `path` now falls back to HTTP base (was blocked by `??` treating `''` as set).
- Fixed protocol table `colSpan` for GraphQL/gRPC panels (was over-counting by one).
- Hardened `patchProtocolEndpoints` to preserve path/tls without forcing empty baseUrl on unrelated edits.
- Added full Phase 2 styling aligned with `docs/mockups/environment-manager-expanded.html` using design tokens.

**Re-opened gap audit (2026-06-20):**
- Gap P2-G1 (AC-EM-08): gRPC validation currently rejects scheme but still allows non-`host:port` values (e.g. `grpc.example.com`), which can mark rows as explicit even though address is unusable.
- Gap P2-G2 (AC-EM-09): SSE fallback notice only appears in all-fallback state; mixed explicit+fallback rows do not surface the fallback warning.

**Phase 2 patch tasks (2026-06-20):**
- [x] Enforce strict gRPC `host:port` validation (`port` numeric, no URI scheme)
- [x] Show SSE fallback notice when at least one deployed SSE row is fallback
- [x] Add/adjust unit tests in `protocolEndpointUtils.test.ts` and `EnvironmentManager.test.tsx`
- [x] Re-run Phase 2 validation loop (`tsc -b --noEmit` + targeted env-manager suites) until clean

**Validation evidence (2026-06-20):**
- `npx vitest run src/features/environments/utils/protocolEndpointUtils.test.ts src/features/environments/EnvironmentManager.test.tsx` → **80 passed, 0 failed**
- `npx tsc -b --noEmit` → **passed with no type errors**

---

### Phase 3 — App Header Protocol Indicator

**Scope:** Show the resolved endpoint for the current studio in the header.

**Deliverables:**
- [x] `tabToHeaderProtocol(activeTab)` maps studio/context tabs to `ProtocolKey` (WS/SSE/GraphQL studios + HTTP-context tabs: Requests, Catalog, Harness)
- [x] `resolveHeaderProtocolIndicator()` reuses `getRowStatus` + `getResolvedDisplayValue` from `protocolEndpointUtils` (same semantics as Environment Manager)
- [x] `HeaderProtocolIndicator` component: colored protocol dot + truncated URL + status symbol
- [x] Green ✓ (explicit), Amber ⚠ (HTTP fallback), Red ✗ (unresolved / missing selection)
- [x] Native `title` tooltip on hover/focus with full resolved URL, protocol label, env × service, and fallback reason (AC-EM-16)
- [x] Badge hidden on Settings, Workflow, Gallery, Demo, Kafka tabs (no protocol endpoint context)
- [x] `AppHeader` receives `activeTab` from `App.tsx` and renders indicator between env/service selectors and Kafka indicator
- [x] CSS in `src/styles/base.css` (`.header-proto-badge`, protocol dot colors, status colors)
- [x] Unit tests: `headerProtocolUtils.test.ts` + AppHeader integration tests for AC-EM-14–16

**Tab → protocol mapping:**

| Active tab(s) | Header protocol |
|---|---|
| `websocket-studio` | WebSocket (`{{wsBaseUrl}}`) |
| `sse-studio` | SSE (`{{sseUrl}}`) |
| `graphql-studio` | GraphQL (`{{graphqlUrl}}`) |
| `requests`, `catalog`, `scenarios`, `runner`, `param-runner`, `workflow-runner`, `results` | HTTP (`{{baseUrl}}`) |
| All other tabs | Hidden |

**Risk:** Low. Display-only; no data model changes.

**Implementation Notes (2026-06-20):**
- Indicator uses the same resolution chain as Phase 2 row status chips — no duplicate fallback logic.
- Long URLs truncate with ellipsis in the badge; full value always appears in the tooltip.
- When env/service selectors are empty on a protocol studio tab, badge shows ✗ with guidance tooltip rather than hiding.

**Re-opened gap audit (2026-06-20):**
- Gap P3-G1 (AC-EM-16): unresolved HTTP tooltip text is overly prescriptive (`Deploy this environment...`) and can be misleading when the env row is already deployed but base URL is empty.
- Gap P3-G2 (AC-EM-14): test coverage does not explicitly assert indicator hiding across all intended non-context domains (Workflow, Gallery, Demo, Kafka).

**Phase 3 patch tasks (2026-06-20):**
- [x] Refine unresolved HTTP tooltip guidance to be accurate for both undeployed and deployed-empty cases
- [x] Add regression tests that indicator is hidden on non-context tabs (Workflow/Gallery/Demo/Kafka)
- [x] Re-run Phase 3 validation loop (`tsc -b --noEmit` + targeted header suites) until clean

**Validation evidence (2026-06-20):**
- `npx vitest run src/app/utils/headerProtocolUtils.test.ts src/app/components/AppHeader.test.tsx` → **32 passed, 0 failed**
- `npx tsc -b --noEmit` → **passed with no type errors**

**Second re-opened gap audit (2026-06-20):**
- Gap P3-G3 (quality gate): focused Phase 3 branch coverage was below target due to untested tooltip reason branches in `headerProtocolUtils.ts`.
- Gap P3-G4 (maintainability): non-context tab hide assertions in `AppHeader.test.tsx` had duplicated test bodies.

**Phase 3 follow-up patch tasks (2026-06-20):**
- [x] Add focused tooltip branch regressions (`http` fallback reason, `grpc` unresolved guidance, unresolved-with-resolved defensive path, unknown protocol defensive path)
- [x] Refactor repeated non-context tab assertions into a table-driven `it.each(...)` test
- [x] Re-run focused coverage + validation loop (`vitest --coverage` + `tsc -b --noEmit`) until clean

**Follow-up validation evidence (2026-06-20):**
- `npx vitest run src/app/utils/headerProtocolUtils.test.ts src/app/components/AppHeader.test.tsx --coverage --coverage.reporter=text --coverage.include=src/app/utils/headerProtocolUtils.ts --coverage.include=src/app/components/AppHeader.tsx`
  - **All files:** statements **98.63%**, branches **95.38%**, functions **100%**, lines **98.38%**
  - **`src/app/utils/headerProtocolUtils.ts`:** statements **98.14%**, branches **95.12%**, functions **100%**, lines **97.87%**
  - **`src/app/components/AppHeader.tsx`:** statements **100%**, branches **95.83%**, functions **100%**, lines **100%**
- `npx tsc -b --noEmit` → **passed with no type errors**

**Third re-evaluation audit (2026-06-20):**
- No additional logic bugs, UX guidance issues, or duplication regressions found in Phase 3 scope.
- AC-EM-14 through AC-EM-16 remain satisfied after re-running the full focused validation loop.

**Third-cycle validation evidence (2026-06-20):**
- `npx vitest run src/app/utils/headerProtocolUtils.test.ts src/app/components/AppHeader.test.tsx --coverage --coverage.reporter=text --coverage.include=src/app/utils/headerProtocolUtils.ts --coverage.include=src/app/components/AppHeader.tsx`
  - **All files:** statements **98.63%**, branches **95.38%**, functions **100%**, lines **98.38%**
  - **`src/app/utils/headerProtocolUtils.ts`:** statements **98.14%**, branches **95.12%**, functions **100%**, lines **97.87%**
  - **`src/app/components/AppHeader.tsx`:** statements **100%**, branches **95.83%**, functions **100%**, lines **100%**
- `npx tsc -b --noEmit` → **passed with no type errors**

**Fourth re-evaluation audit (2026-06-20):**
- Gap P3-G5 (UI consistency): header protocol indicator CSS still used hardcoded status/protocol colors rather than theme-token-driven variables.

**Fourth-cycle patch tasks (2026-06-20):**
- [x] Replace hardcoded indicator status colors with semantic tokens (`--success`, `--warning`, `--danger`)
- [x] Replace hardcoded protocol dot colors with overridable tokenized variables (`--header-proto-dot-*` with safe fallbacks)
- [x] Re-run focused validation loop (`vitest --coverage` + `tsc -b --noEmit`) until clean

**Fourth-cycle validation evidence (2026-06-20):**
- `npx vitest run src/app/utils/headerProtocolUtils.test.ts src/app/components/AppHeader.test.tsx --coverage --coverage.reporter=text --coverage.include=src/app/utils/headerProtocolUtils.ts --coverage.include=src/app/components/AppHeader.tsx`
  - **All files:** statements **98.63%**, branches **95.38%**, functions **100%**, lines **98.38%**
  - **`src/app/utils/headerProtocolUtils.ts`:** statements **98.14%**, branches **95.12%**, functions **100%**, lines **97.87%**
  - **`src/app/components/AppHeader.tsx`:** statements **100%**, branches **95.83%**, functions **100%**, lines **100%**
- `npx tsc -b --noEmit` → **passed with no type errors**

---

### Phase 4 — Studio Integration (per protocol)

Connect each studio to the env var map from Phase 1 and show inline resolution:

| Studio | Variable shown | Resolved preview | Status |
|---|---|---|---|
| WebSocket | `{{wsBaseUrl}}/ws` | `wss://ws.example.com/ws ✓` | ✅ Done |
| SSE | `{{sseUrl}}/events` | `https://events.example.com/events ✓` | ✅ Done |
| GraphQL | `{{graphqlUrl}}` | `https://api.example.com/graphql ✓` | ✅ Done |
| gRPC | `{{grpcHost}}` | `grpc.example.com:50051 ✓` | 🔲 Deferred (no studio) |

**Phase 4 deliverables:**
- [x] WebSocket Studio uses `buildEnvVarMap(..., 'websocket', ...)` when env+service selected; legacy `buildWsEnvVarMap` fallback when not
- [x] SSE Studio uses `buildEnvVarMap(..., 'sse', ...)`; exposes `{{sseUrl}}` in connect URL field
- [x] GraphQL Studio uses `buildEnvVarMap(..., 'graphql', ...)`; exposes `{{graphqlUrl}}`, `{{envName}}`, `{{svcName}}`
- [x] GraphQL endpoint input resolves `{{baseUrl}}` / `{{graphqlUrl}}` via merged global + tab env map
- [x] GraphQL headers panel passes `globalEnvMap` to `findUnresolvedVars`
- [x] GraphQL batch execution, collection run, subscription orchestration, keyboard shortcuts pass `globalEnvMap`
- [x] Shared `ProtocolEndpointPreview` component + `computeStudioEndpointPreview()` utility
- [x] Inline preview in WebSocket connect panel, SSE top bar, GraphQL connection bar (AC-EM-19)
- [x] Unit tests: `studioEndpointPreview.test.ts`, WebSocketConnectPanel, SseStudioPage, GraphqlConnectionBar, GraphqlHeadersPanel
- [ ] gRPC Studio integration deferred (no studio exists yet)

**Implementation Notes (2026-06-20 re-evaluation):**
- Preview visibility: shown when draft URL contains `{{` templates OR resolved URL differs from draft literal
- Preview status reuses `getRowStatus()` protocol row semantics (explicit ✓, fallback ⚠, unresolved ✗)
- SSE placeholder updated to mention `{{sseUrl}}/events`
- GraphQL `previewEnvMap` merges global map with tab-local environment variables for live endpoint preview

**Re-opened gap audit (2026-06-20):**
- Gap P4-G1 (AC-EM-19 semantics): `computeStudioEndpointPreview()` could report `explicit` when protocol row status was unknown (`undefined`), which can overstate endpoint configuration certainty.
- Gap P4-G2 (quality gate): focused branch coverage around preview row-status mapping missed `empty` / `unresolved` row-state paths.

**Phase 4 patch tasks (2026-06-20):**
- [x] Make unknown row status resolve to `unresolved` (✗) instead of defaulting to `explicit`
- [x] Refactor row-status mapping to a switch-based branch for clearer semantics and lower duplication risk
- [x] Add targeted tests for unknown/empty/unresolved row-state preview outcomes
- [x] Re-run focused Phase 4 validation loop (`vitest --coverage` + `tsc -b --noEmit`) until clean

**Validation evidence (2026-06-20):**
- `npx vitest run src/shared/utils/studioEndpointPreview.test.ts src/features/websocket/WebSocketConnectPanel.test.tsx src/features/sse/SseStudioPage.test.tsx src/features/graphql/components/GraphqlConnectionBar.test.tsx src/features/graphql/components/GraphqlHeadersPanel.test.tsx --coverage --coverage.reporter=text --coverage.include=src/shared/utils/studioEndpointPreview.ts --coverage.include=src/shared/components/ProtocolEndpointPreview.tsx --coverage.include=src/features/graphql/components/GraphqlHeadersPanel.tsx`
  - **All files:** statements **100%**, branches **93.75%**, functions **100%**, lines **100%**
  - **`src/shared/utils/studioEndpointPreview.ts`:** statements **100%**, branches **95.45%**, functions **100%**, lines **100%**
  - **`src/shared/components/ProtocolEndpointPreview.tsx`:** statements **100%**, branches **100%**, functions **100%**, lines **100%**
  - **`src/features/graphql/components/GraphqlHeadersPanel.tsx`:** statements **100%**, branches **90.47%**, functions **100%**, lines **100%**
- `npx tsc -b --noEmit` → **passed with no type errors**

**Follow-up re-evaluation (2026-06-20):**
- No additional Phase 4 logic regressions found after the P4-G1/P4-G2 fixes.
- Added test-harness isolation in `SseStudioPage.test.tsx` by mocking `SseStudioShell` to reduce unrelated shell-level behavior coupling and duplication in page-level assertions.
- Extended SSE page test isolation by mocking `useSseConsole`, `SseMessageLog`, and `ConsolePanel` with lightweight fixtures that preserve tested selectors/commands while avoiding unrelated asynchronous UI churn.

**Follow-up validation evidence (2026-06-20):**
- `npx vitest run src/features/sse/SseStudioPage.test.tsx src/shared/utils/studioEndpointPreview.test.ts src/features/websocket/WebSocketConnectPanel.test.tsx src/features/graphql/components/GraphqlConnectionBar.test.tsx src/features/graphql/components/GraphqlHeadersPanel.test.tsx --coverage --coverage.reporter=text --coverage.include=src/shared/utils/studioEndpointPreview.ts --coverage.include=src/shared/components/ProtocolEndpointPreview.tsx --coverage.include=src/features/graphql/components/GraphqlHeadersPanel.tsx`
  - **All files:** statements **100%**, branches **93.75%**, functions **100%**, lines **100%**
  - **`src/shared/utils/studioEndpointPreview.ts`:** statements **100%**, branches **95.45%**, functions **100%**, lines **100%**
  - **`src/shared/components/ProtocolEndpointPreview.tsx`:** statements **100%**, branches **100%**, functions **100%**, lines **100%**
  - **`src/features/graphql/components/GraphqlHeadersPanel.tsx`:** statements **100%**, branches **90.47%**, functions **100%**, lines **100%**
- `npx tsc -b --noEmit` → **passed with no type errors**

**Final follow-up re-evaluation (2026-06-20):**
- Re-ran the full focused Phase 4 verification suite after test-harness stabilization.
- No additional logic, coverage, or duplication issues detected.

**Final follow-up validation evidence (2026-06-20):**
- `npx vitest run src/features/sse/SseStudioPage.test.tsx src/shared/utils/studioEndpointPreview.test.ts src/features/websocket/WebSocketConnectPanel.test.tsx src/features/graphql/components/GraphqlConnectionBar.test.tsx src/features/graphql/components/GraphqlHeadersPanel.test.tsx --coverage --coverage.reporter=text --coverage.include=src/shared/utils/studioEndpointPreview.ts --coverage.include=src/shared/components/ProtocolEndpointPreview.tsx --coverage.include=src/features/graphql/components/GraphqlHeadersPanel.tsx`
  - **All files:** statements **100%**, branches **93.75%**, functions **100%**, lines **100%**
  - **`src/shared/utils/studioEndpointPreview.ts`:** statements **100%**, branches **95.45%**, functions **100%**, lines **100%**
  - **`src/shared/components/ProtocolEndpointPreview.tsx`:** statements **100%**, branches **100%**, functions **100%**, lines **100%**
  - **`src/features/graphql/components/GraphqlHeadersPanel.tsx`:** statements **100%**, branches **90.47%**, functions **100%**, lines **100%**
- `npx tsc -b --noEmit` → **passed with no type errors**

**Risk:** Low. Display + wiring only; Phase 1 data model unchanged.

---

### Phase 5 — Demo Lesson Updates

Restore Environment Manager navigation steps now that Phase 2 protocol tabs are live.

| Lesson | Env Manager step | Studio resolution step | Variables |
|---|---|---|---|
| `ws-workspace` | WebSocket tab → `ws://localhost:9876` | `{{wsBaseUrl}}/ws` preview ✓ | `{{wsBaseUrl}}` |
| `sse-studio` | SSE tab → `http://localhost:3001` | `{{sseUrl}}/api/sse-test` preview | `{{sseUrl}}` |
| `gql-first-query` | GraphQL tab → `http://localhost:4010` + `/graphql` | `{{graphqlUrl}}` preview | `{{graphqlUrl}}` |

**Phase 5 deliverables:**
- [x] Shared `env-manager-lesson-helpers.ts` + `EM` selectors in `shared/selectors.ts`
- [x] `data-testid` on protocol tabs, Configure button, endpoint inline editor (Environment Manager)
- [x] `ws-workspace`: steps `ws-env-config`, `ws-env-resolve`; `allowedTabs: ['environments', 'websocket-studio']`
- [x] `sse-studio`: step `sse-env-config`; update `sse-env-vars` to use `{{sseUrl}}`; `allowedTabs: ['environments', 'sse-studio']`
- [x] `gql-first-query`: steps `gql1-env-config`, updated `gql1-endpoint` with `{{graphqlUrl}}`; `allowedTabs: ['environments', 'graphql-studio']`
- [x] `ensureDemoEndpoint` accepts `{{graphqlUrl}}` template
- [x] Unit tests for helpers + updated lesson test files

**Acceptance criteria (AC-EM-21):**
- Each lesson navigates to Settings → Environments without auto-exit (`allowedTabs` includes `environments`)
- Each lesson demonstrates the correct protocol tab inline edit (Edit → Save)
- Each lesson returns to the studio and shows template URL resolving with inline preview
- All lesson tests pass (step count, step IDs, action smoke tests)

**Implementation Notes (2026-06-20 re-evaluation):**
- Helpers deploy HTTP base URL on first environment when no envs are deployed (required for protocol tabs to show rows)
- WebSocket lesson uses mock-server URL `ws://localhost:9876` (not wss) to match built-in mock server
- GraphQL lesson uses Docker test server `http://localhost:4010/graphql` via `{{graphqlUrl}}`

**Phase 5 re-opened gap audit (2026-06-20, additional hardening round):**
- Gap found: focused Phase 5 branch coverage was below target (**71.13%**) despite all tests passing; weak spots were helper protocol-navigation/GraphQL-path branches and GraphQL/WebSocket lesson preAction guards.
- Fixes implemented:
  - Extended `env-manager-lesson-helpers.test.ts` with protocol studio navigation guard tests and GraphQL path update/skip branches.
  - Added `ensureFirstEnvDeployed(...)` branch test for empty deployed-row flow (deploy checkbox enable path).
  - Extended `graphql-first-query.test.ts` with `gql1-env-config` preAction present/absent endpoint guard tests and `gql1-write-query` preAction active/inactive/missing editor-mode button branches.
  - Extended `ws-workspace.test.ts` with `ws-env-config` and `ws-env-resolve` preAction navigation guard coverage.
- Duplication audit: no production-code duplication introduced in Phase 5 scope; helper abstraction remains the single shared path across WS/SSE/GQL lessons.

**Phase 5 final validation evidence (2026-06-20):**
- `npx vitest run src/features/demo-player/lessons/env-manager-lesson-helpers.test.ts src/features/demo-player/lessons/protocols/ws-workspace.test.ts src/features/demo-player/lessons/protocols/sse-studio.test.ts src/features/demo-player/lessons/protocols/graphql-first-query.test.ts --coverage --coverage.reporter=text --coverage.include=src/features/demo-player/lessons/env-manager-lesson-helpers.ts --coverage.include=src/features/demo-player/lessons/protocols/ws-workspace.ts --coverage.include=src/features/demo-player/lessons/protocols/sse-studio.ts --coverage.include=src/features/demo-player/lessons/protocols/graphql-first-query.ts`
  - **All files:** statements **98.86%**, branches **90.72%**, functions **98.43%**, lines **99.40%**
  - **`src/features/demo-player/lessons/env-manager-lesson-helpers.ts`:** statements **97.46%**, branches **84.61%**, functions **100%**, lines **100%**
  - **`src/features/demo-player/lessons/protocols/ws-workspace.ts`:** statements **100%**, branches **96.42%**, functions **100%**, lines **100%**
  - **`src/features/demo-player/lessons/protocols/sse-studio.ts`:** statements **97.46%**, branches **90.90%**, functions **94.73%**, lines **97.43%**
  - **`src/features/demo-player/lessons/protocols/graphql-first-query.ts`:** statements **100%**, branches **100%**, functions **100%**, lines **100%**
- `npx tsc -b --noEmit` → **passed with no type errors**

**Phase 5 follow-up re-evaluation (2026-06-20, one more round):**
- Gap found: although the previous aggregate branch gate passed, helper-file branch coverage remained below 90% (`env-manager-lesson-helpers.ts` at **84.61%**), leaving edge branches under-tested.
- Additional fixes implemented:
  - Added visibility-path branch test for `expandFirstMicroservice()` (`firstVisibleSelector` visible-element path).
  - Added `ensureFirstEnvDeployed()` branches for already-checked deploy checkbox and prefilled URL early return.
  - Added `configureProtocolEndpointInEnvManager()` GraphQL custom-path branch without HTTP fallback option.
  - Added `navigateToSseStudio()` no-op branch when already on SSE studio.
- Duplication audit: no production duplication added; helper-centric reuse remains intact across WS/SSE/GraphQL lessons.

**Phase 5 follow-up validation evidence (2026-06-20):**
- `npx vitest run src/features/demo-player/lessons/env-manager-lesson-helpers.test.ts src/features/demo-player/lessons/protocols/ws-workspace.test.ts src/features/demo-player/lessons/protocols/sse-studio.test.ts src/features/demo-player/lessons/protocols/graphql-first-query.test.ts --coverage --coverage.reporter=text --coverage.include=src/features/demo-player/lessons/env-manager-lesson-helpers.ts --coverage.include=src/features/demo-player/lessons/protocols/ws-workspace.ts --coverage.include=src/features/demo-player/lessons/protocols/sse-studio.ts --coverage.include=src/features/demo-player/lessons/protocols/graphql-first-query.ts`
  - **All files:** statements **99.43%**, branches **95.87%**, functions **98.43%**, lines **99.40%**
  - **`src/features/demo-player/lessons/env-manager-lesson-helpers.ts`:** statements **100%**, branches **97.43%**, functions **100%**, lines **100%**
  - **`src/features/demo-player/lessons/protocols/ws-workspace.ts`:** statements **100%**, branches **96.42%**, functions **100%**, lines **100%**
  - **`src/features/demo-player/lessons/protocols/sse-studio.ts`:** statements **97.46%**, branches **90.90%**, functions **94.73%**, lines **97.43%**
  - **`src/features/demo-player/lessons/protocols/graphql-first-query.ts`:** statements **100%**, branches **100%**, functions **100%**, lines **100%**
- `npx tsc -b --noEmit` → **passed with no type errors**

**Phase 5 final re-evaluation (2026-06-20, one-more round):**
- Gap found: `sse-studio.ts` still had an uncovered preAction guard branch for `sse-env-config` when URL input is already present.
- Fix implemented:
  - Added `sse-env-config` preAction skip-navigation test in `sse-studio.test.ts`.
- Duplication audit: no new duplication introduced; no additional extraction needed beyond the existing shared helper module.

**Phase 5 final re-validation evidence (2026-06-20):**
- `npx vitest run src/features/demo-player/lessons/env-manager-lesson-helpers.test.ts src/features/demo-player/lessons/protocols/ws-workspace.test.ts src/features/demo-player/lessons/protocols/sse-studio.test.ts src/features/demo-player/lessons/protocols/graphql-first-query.test.ts --coverage --coverage.reporter=text --coverage.include=src/features/demo-player/lessons/env-manager-lesson-helpers.ts --coverage.include=src/features/demo-player/lessons/protocols/ws-workspace.ts --coverage.include=src/features/demo-player/lessons/protocols/sse-studio.ts --coverage.include=src/features/demo-player/lessons/protocols/graphql-first-query.ts`
  - **All files:** statements **99.71%**, branches **96.90%**, functions **100%**, lines **99.70%**
  - **`src/features/demo-player/lessons/env-manager-lesson-helpers.ts`:** statements **100%**, branches **97.43%**, functions **100%**, lines **100%**
  - **`src/features/demo-player/lessons/protocols/ws-workspace.ts`:** statements **100%**, branches **96.42%**, functions **100%**, lines **100%**
  - **`src/features/demo-player/lessons/protocols/sse-studio.ts`:** statements **98.73%**, branches **95.45%**, functions **100%**, lines **98.71%**
  - **`src/features/demo-player/lessons/protocols/graphql-first-query.ts`:** statements **100%**, branches **100%**, functions **100%**, lines **100%**
- `npx tsc -b --noEmit` → **passed with no type errors**

**Phase 5 post-final re-evaluation (2026-06-20, extra one-more round):**
- Gap found: one GraphQL default-path branch remained uncovered in `configureProtocolEndpointInEnvManager(...)` when options are omitted.
- Fix implemented:
  - Added helper test: default GraphQL path fallback (`/graphql`) when `options` is undefined.
- Duplication audit: no additional duplication; shared helper/test structure remains clean.

**Phase 5 post-final validation evidence (2026-06-20):**
- `npx vitest run src/features/demo-player/lessons/env-manager-lesson-helpers.test.ts src/features/demo-player/lessons/protocols/ws-workspace.test.ts src/features/demo-player/lessons/protocols/sse-studio.test.ts src/features/demo-player/lessons/protocols/graphql-first-query.test.ts --coverage --coverage.reporter=text --coverage.include=src/features/demo-player/lessons/env-manager-lesson-helpers.ts --coverage.include=src/features/demo-player/lessons/protocols/ws-workspace.ts --coverage.include=src/features/demo-player/lessons/protocols/sse-studio.ts --coverage.include=src/features/demo-player/lessons/protocols/graphql-first-query.ts`
  - **All files:** statements **99.71%**, branches **97.93%**, functions **100%**, lines **99.70%**
  - **`src/features/demo-player/lessons/env-manager-lesson-helpers.ts`:** statements **100%**, branches **100%**, functions **100%**, lines **100%**
  - **`src/features/demo-player/lessons/protocols/ws-workspace.ts`:** statements **100%**, branches **96.42%**, functions **100%**, lines **100%**
  - **`src/features/demo-player/lessons/protocols/sse-studio.ts`:** statements **98.73%**, branches **95.45%**, functions **100%**, lines **98.71%**
  - **`src/features/demo-player/lessons/protocols/graphql-first-query.ts`:** statements **100%**, branches **100%**, functions **100%**, lines **100%**
- `npx tsc -b --noEmit` → **passed with no type errors**

**Risk:** Low. Demo-only changes; no runtime behavior changes outside lessons.

---

## Pre-Phase 1 Cleanup — ✅ DONE

> **Completed.** Premature env-manager steps were removed from demo lessons during Phase 1. **Phase 5 restored** the correct Environment Manager steps to `ws-workspace`, `sse-studio`, and `gql-first-query` now that protocol tabs ship in Phase 2.

---

## Current Studio Env Var Integration (post-Phase 4)

All protocol studios now consume `buildEnvVarMap()` when the app header has env+service selected, with legacy fallbacks when not.

### WebSocket Studio ✅
- `buildEnvVarMap(..., 'websocket', ...)` when `selectedSvc + selectedEnvId` present; else `buildWsEnvVarMap` legacy path
- `ProtocolEndpointPreview` in connect panel with `getRowStatus(selectedSvc, 'websocket', selectedEnvId)`
- Connect URL resolves `{{wsBaseUrl}}`, `{{baseUrl}}`, `{{host}}`, `{{envName}}`, `{{svcName}}`

### SSE Studio ✅
- `buildEnvVarMap(..., 'sse', ...)` when env+service selected; legacy map with `sseUrl = baseUrl` otherwise
- `ProtocolEndpointPreview` in top URL row with SSE protocol row status
- Connect URL resolves `{{sseUrl}}`, `{{baseUrl}}`, etc.

### GraphQL Studio ✅
- `globalEnvMap` from `buildEnvVarMap(..., 'graphql', ...)` merged with tab-local environment variables
- Endpoint, headers, batch, collection run, subscription orchestration all pass `globalEnvMap` to `resolveVars` / `findUnresolvedVars`
- `ProtocolEndpointPreview` below connection bar

### gRPC Studio 🔲 Deferred
- No gRPC studio exists; `{{grpcHost}}` is available in Environment Manager derived vars panel only
- Phase 4 gRPC studio integration blocked until studio ships

---

## Open Questions

1. **gRPC TLS**: gRPC can use plaintext or TLS. Should the card show a TLS toggle per environment, or derive it from the address format (`grpc://` vs no scheme = TLS assumed)? — **Resolved from mockup:** show per-environment TLS toggle in the gRPC tab.

2. **Shared auth**: Should `authProfileIds` remain at the microservice level (shared across all protocols) or become per-protocol? Per-protocol is more accurate but adds significant complexity. — **Keep microservice-level auth map for now; in UI, only HTTP and WebSocket tabs expose auth selectors (matching mockup).**

3. **Custom variables**: Should users be able to define arbitrary additional `{{myVar}}` variables per environment, beyond the protocol-derived ones? This would make the env system a general-purpose variable store. — **Out of scope for this plan; track as a separate feature request.**

4. **Import/Export**: Should `protocolEndpoints` be included in project export? — **Yes, definitively. Add to Phase 1 deliverables: verify existing export/import codepath includes the full `Microservice` object (including new `protocolEndpoints` field).**

5. **Validation**: Should the UI validate URL format per protocol (e.g., warn if a WebSocket tab has `http://` instead of `ws://`)? — **Yes, add inline validation per tab in Phase 2. WebSocket: warn if not `ws://`/`wss://`. gRPC: warn if `://` scheme is present. GraphQL/SSE/HTTP: warn if not `http://`/`https://`.**
