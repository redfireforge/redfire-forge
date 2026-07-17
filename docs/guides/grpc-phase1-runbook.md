# gRPC Studio — Phase 1 Runbook

Operational guide for local development, E2E, and Phase 1 acceptance verification.

## Architecture (Phase 1)

```
Browser (gRPC Studio UI)
  → Vite :5173  /api/grpc/*
  → Express :3001  src-server/routes/grpc
  → @grpc/grpc-js  →  target host:port (e.g. localhost:50051)
```

Tab-scoped unary calls use `tabId` query on `POST /api/grpc/call` and `DELETE /api/grpc/call/:requestId`.

## Local dev setup

### 1. Start the Express backend

```bash
npm run server
```

Verify: `curl http://localhost:3001/health`

### 2. Start Vite

```bash
npm run dev
```

Open **Protocols → gRPC** or `http://localhost:5173/?tab=grpc-studio`

### 3. Start the Docker echo fixture (optional, for live calls)

```bash
cd docker/grpc
docker compose up -d --build
curl http://localhost:50052/health
```

### 4. Manual smoke flow

1. Target: `localhost:50051` — green **validation** badge (`grpc-target-status-ok`; client-side format check, not a network probe).
2. Click **⟳ Reflect** — `EchoService` appears in the explorer.
3. Select **Echo** — form shows `message` field.
4. Fill message → **Send Unary** — response panel shows OK + echoed JSON body.
5. Cancel test: message `@sleep:8000` → Send → **Cancel** → “Call cancelled” banner.

## E2E tests

| Spec | Docker | Backend | Project |
|---|---|---|---|
| `e2e/grpc-studio-shell.spec.ts` | No | No | `chromium` (default) |
| `e2e/grpc-test-server.spec.ts` | Yes | Yes (API routes) | `chromium` (skips when infra down) or `docker` with `E2E_GRPC_SERVER=1` |
| `e2e/grpc-studio-unary.spec.ts` | Yes | Yes | `chromium` (skips when infra down) or `docker` with `E2E_GRPC_SERVER=1` |
| `e2e/grpc-studio-*-stream.spec.ts` (×3) | Yes | Yes | Same as unary — see [Phase 2 runbook](./grpc-phase2-runbook.md) |
| `e2e/grpc-studio-manage-schemas.spec.ts` | Partial | Partial | Phase 3I — modal shell + schema browser (live skips when infra down) |
| `e2e/grpc-studio-schema-drift.spec.ts` | No | No | Phase 3I — mocked reflect drift UI |

```bash
# Shell only (no infra)
npx playwright test e2e/grpc-studio-shell.spec.ts e2e/grpc-studio-schema-drift.spec.ts e2e/grpc-studio-manage-schemas.spec.ts --grep "shell|mocked" --reporter=list

# Full gRPC suite — 31 tests across 8 specs (auto-starts Docker when E2E_GRPC_SERVER=1)
npm run server   # separate terminal
npm run test:e2e:grpc
```

See [Phase 3 runbook](./grpc-phase3-runbook.md) for descriptor sources, drift, and `npm run test:grpc:phase3`.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Reflect fails / ECONNREFUSED | Echo server down | `cd docker/grpc && docker compose up -d` |
| `/api/grpc/*` 502 | Express not running | `npm run server` |
| Target validation error | Invalid address | Use `host:port` (e.g. `localhost:50051`) |
| Send disabled after reflect | Non-unary method or invalid body | Select **Echo** (Unary); fix form/metadata errors |
| Cancel has no effect | Call already completed | Use `@sleep:8000` message for slow call |
| Stale response after tab switch | Should not happen in Phase 1 | File bug — check `callGenerationRef` / `tabId` |

## Phase 1 acceptance checklist

| Criterion | Verified by |
|---|---|
| Unary execution is tab-scoped with immutable snapshot at Send | `useGrpcStudio.test.ts` execute/cancel/race tests |
| Route contract implemented with correlation IDs | `src-server/routes/grpc/grpc-routes.test.ts`, `grpcApiClient.test.ts` |
| Target validation `host:port` + `in-process:<name>` | `targetValidation.test.ts` |
| Response panel: status, headers, trailers, body, duration | `GrpcResponsePanel.test.tsx` |
| Tab close cancels in-flight unary | `useGrpcStudio.test.ts` closeTab abort test |
| Live reflect → unary → cancel | `e2e/grpc-studio-unary.spec.ts` |
| Docker fixture health + API smoke | `e2e/grpc-test-server.spec.ts` |
| DELETE cancel route (API, in-flight) | `e2e/grpc-test-server.spec.ts` — `DELETE /api/grpc/call/:requestId` |
| Target validation badge (UI) | `e2e/grpc-studio-shell.spec.ts`, `setGrpcTarget` in `grpc-helpers.ts` |
| Network reachability probe (API) | `e2e/grpc-test-server.spec.ts` — `GET /api/grpc/status` |

## UI mockup parity (Phase 1 vs `01-main-studio.html`)

Visual reference: `docs/plan/future/grpc/mockups/01-main-studio.html`  
Agent rule for future UI work: `.cursor/rules/grpc-studio-ui.mdc`  
Full gap table: `docs/plan/future/grpc/grpc-studio-plan.md` § **Phase 1 vs mockup gap**

**Phase 1 matches the mockup for:** multi-tab studio, service explorer (search, reflect, call-type badges on **methods**), send bar with unary + cancel, Form/JSON/Metadata composer, response panel (status, duration, Body/Headers/Trailers/Timing tabs, copy).

**Known gaps (intentional — not Phase 1 bugs):**

| Area | Phase 1 behavior | Later phase |
|---|---|---|
| Tab label call-type pill (U/SS/…) | ✅ Shipped (Phase 2G) | See [Phase 2 runbook](./grpc-phase2-runbook.md) |
| TLS / Auth / Connect bar | Target + validation badge only | Phase 4 |
| Manage Schemas | ✅ Shipped (Phase 3) | See [Phase 3 runbook](./grpc-phase3-runbook.md) |
| Response Snapshot | Not shown | Phase 5 |
| JSON Pretty Format / Copy (request) | Not shown | Phase 3 polish |
| Response JSON syntax highlight | Plain `<pre>` | Phase 3 polish |
| Timing waterfall bars | Total ms only | Post–1G / Phase 3+ |
| oneof / advanced WKT form widgets | Nested JSON fallback | Phase 3+ |
| Drag-resize request/response split | Fixed flex ratio | Polish |

When fixing Phase 1 regressions, compare against this table before expanding scope into a later phase.

## Phase 2 handoff notes

Reuse these Phase 1 primitives for streaming:

- `tabId` + `requestId` ownership on start/cancel routes
- `callGenerationRef` / in-flight ref pattern in `useGrpcStudio`
- `abortTabPendingUnaryCall` for connection change, tab close, method rebind
- Docker fixture (all four call types) — see Phase 2H in `grpc-studio-plan.md`
- Phase 2 streaming runbook — [`grpc-phase2-runbook.md`](./grpc-phase2-runbook.md) (**shipped** — server/client/bidi UI + E2E)
