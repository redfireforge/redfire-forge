# Environment Manager Expansion Plan

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

**Scope:** No UI change. Add `protocolEndpoints` to the `Microservice` type and update `buildEnvVarMap` to use it with fallback.

**Deliverables:**
- [ ] Add `ProtocolKey` and `ProtocolEndpoint` types to `src/shared/types/index.ts`
- [ ] Add optional `protocolEndpoints` field to `Microservice`
- [ ] Write `buildEnvVarMap(svc, envId, protocol, envName)` in `wsMessageUtils.ts` (or a new `envVarUtils.ts`)
- [ ] Update WebSocket Studio to call `buildEnvVarMap(..., 'websocket', ...)`
- [ ] Update SSE Studio to call `buildEnvVarMap(..., 'sse', ...)`
- [ ] Update GraphQL Studio to call `buildEnvVarMap(..., 'graphql', ...)`
- [ ] Unit tests for `buildEnvVarMap` (all protocols, fallback behavior, missing fields)

**Risk:** Low. All changes are additive. Existing behavior is preserved via fallback.

---

### Phase 2 — Environment Manager UI: Protocol Tabs

**Scope:** Redesign the microservice card to show per-protocol endpoint tables.

**Deliverables:**
- [ ] Protocol tab bar inside expanded microservice card (HTTP / WebSocket / SSE / GraphQL / gRPC)
- [ ] Each tab shows the same env × baseUrl grid as today
- [ ] gRPC tab shows `host:port` label and validation (no `://` scheme)
- [ ] GraphQL tab adds optional "Default path" column (defaults to `/graphql`)
- [ ] Inline save/cancel editing per cell (same UX as today's HTTP table)
- [ ] Badge on each tab: "Configured (N envs)" vs "Using HTTP fallback"
- [ ] Persist `protocolEndpoints` on every edit via `setMicroservices`
- [ ] Audit log entries for per-protocol URL changes

**Risk:** Medium. UI is more complex; requires careful styling and keyboard navigation.

---

### Phase 3 — App Header Protocol Indicator

**Scope:** Show the resolved endpoint for the current studio in the header.

**Deliverables:**
- [ ] Small protocol badge below env/service dropdowns showing resolved URL
- [ ] Green ✓ (explicitly configured), Amber ⚠ (HTTP fallback in use), Red ✗ (unresolved)
- [ ] Tooltip showing full resolved URL on hover

**Risk:** Low. Display-only; no data model changes.

---

### Phase 4 — Studio Integration (per protocol)

Connect each studio to the env var map from Phase 1 and show inline resolution:

| Studio | Variable shown | Resolved preview |
|---|---|---|
| WebSocket | `{{wsBaseUrl}}/ws` | `wss://ws.example.com/ws ✓` |
| SSE | `{{sseUrl}}/events` | `https://events.example.com/events ✓` |
| GraphQL | `{{graphqlUrl}}` | `https://api.example.com/graphql ✓` |
| gRPC | `{{grpcHost}}` | `grpc.example.com:50051 ✓` |

WebSocket Studio already has a resolved-URL preview. SSE, GraphQL, and gRPC need the same treatment.

---

### Phase 5 — Demo Lesson Updates

Once Phase 2 is live, update demo lessons to navigate to the Environment Manager and demonstrate per-protocol configuration:

- **WebSocket workspace lesson** — show WebSocket tab in microservice card, type `wss://localhost:9876`, demonstrate `{{wsBaseUrl}}/ws` resolving
- **SSE lesson** — show SSE tab, type `http://localhost:3001`, demonstrate `{{sseUrl}}/api/sse-test` resolving
- **GraphQL lesson** — show GraphQL tab, type endpoint URL, demonstrate `{{graphqlUrl}}` resolving

**Note:** Demo lessons should NOT be updated until Phase 2 is fully shipped. The env config steps added to ws-workspace and sse-studio lessons should be removed from both until Phase 2 is live.

---

## What to Do Right Now (Pre-Phase 1)

> **⚠️ PENDING CLEANUP — Do not forget**
>
> The following demo lesson steps were added prematurely. They navigate to the Environment Manager to "show where env vars are configured," but the Environment Manager currently shows only HTTP base URLs with no protocol-specific (WebSocket / SSE / GraphQL / gRPC) fields. Showing it to users is misleading and causes a secondary bug where the live demo panel disappears when navigating away from the studio tab.
>
> **Files to fix:**
> - `src/features/demo-player/lessons/protocols/sse-studio.ts`
>   - Remove steps: `sse-env-config` (navigate to Settings + waitFor env-manager), `sse-env-url` (navigate back)
>   - Replace with a single step `sse-env-vars`: stay on SSE Studio, fill URL with `{{baseUrl}}/api/sse-test`, describe that the variable resolves from the environment and service selected in the header
>   - Update `estimatedMinutes` back to 3 (from 4)
>   - Remove `allowedTabs: ['environments']` (no longer needed)
>
> - `src/features/demo-player/lessons/protocols/ws-workspace.ts`
>   - Remove steps: `ws-env-config` (navigate to Settings), `ws-env-table` (stay on env manager)
>   - Keep steps: `ws-env-intro` (type `{{wsBaseUrl}}/ws` in URL field) and `ws-env-warn` (type unresolved var)
>   - Remove `allowedTabs: ['environments']` (no longer needed once env-config/table steps are gone)
>   - Update `estimatedMinutes` from 5 to 4 (8 steps → ~4 min)
>
> - Update matching test files: `sse-studio.test.ts` and `ws-workspace.test.ts` (step count, IDs, estimatedMinutes)
>
> **Restore these steps** (with correct content) once **Phase 2** of this plan is shipped and the microservice card shows per-protocol endpoint tabs in the Environment Manager.

---

## Open Questions

1. **gRPC TLS**: gRPC can use plaintext or TLS. Should the card show a TLS toggle per environment, or derive it from the address format (`grpc://` vs no scheme = TLS assumed)?
2. **Shared auth**: Should `authProfileIds` remain at the microservice level (shared across all protocols) or become per-protocol? Per-protocol is more accurate but adds complexity.
3. **Custom variables**: Should users be able to define arbitrary additional `{{myVar}}` variables per environment, beyond the protocol-derived ones? This would make the env system a general-purpose variable store.
4. **Import/Export**: Should `protocolEndpoints` be included in project export? Almost certainly yes — add to the existing export format.
5. **Validation**: Should the UI validate URL format per protocol (e.g., warn if a WebSocket tab has `http://` instead of `ws://`)?
