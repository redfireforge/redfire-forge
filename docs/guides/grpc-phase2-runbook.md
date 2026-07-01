# gRPC Studio — Phase 2 Runbook

Operational guide for streaming (server / client / bidirectional), E2E verification, and Phase 2 acceptance.

See also: [Phase 1 runbook](./grpc-phase1-runbook.md) for unary setup and shared infra.

## Architecture (Phase 2)

```
Browser (gRPC Studio UI)
  → Vite :5173  /api/grpc/stream/*
  → Express :3001  src-server/routes/grpc + grpc-stream-service
  → @grpc/grpc-js ClientDuplexStream  →  target host:port (e.g. localhost:50051)

SSE relay: GET /api/grpc/stream/:streamId/events?tabId=…&lastSequence=N
  ← grpc-message | grpc-end | grpc-error | grpc-heartbeat (15s)
```

Tab-scoped streams use `tabId` on every control route. One active stream per tab; starting a new stream cancels the prior one on the same tab.

## Known limits

| Limit | Value | Where |
|---|---|---|
| Message log cap | 10,000 entries | `GRPC_STREAM_MESSAGE_CAP` |
| SSE heartbeat | 15s | `GRPC_STREAM_HEARTBEAT_INTERVAL_MS` |
| Client reconnect attempts | 3 (1s / 2s / 4s backoff) | `GRPC_STREAM_RECONNECT_MAX_ATTEMPTS` |
| Registry grace after last SSE disconnect | 60s on active stream | `streamRegistry.ts` |
| Terminal stream registry retention | Up to 60s until SSE attach replays buffer or grace expires | `scheduleFinalizeAfterTerminal` |
| SSE late-attach replay | Buffered `eventLog` replayed on `GET …/events` when stream already ended | `replayBufferedGrpcStreamEvents` |
| Server-streaming send/end | **409** — use Start + Cancel only | Route guards |

## Local dev setup

Same as Phase 1:

1. `npm run server` — Express :3001
2. `npm run dev` — Vite :5173
3. `cd docker/grpc && docker compose up -d --build` — echo fixture :50051/:50052

Open **Protocols → gRPC** or `http://localhost:5173/?tab=grpc-studio`.

## Manual smoke flow (1× walk — human gate)

Complete at **1× speed** before marking Phase 2 done. Restart lesson-style: fresh tab, read narration-equivalent labels, watch each visible beat.

### Server streaming (`EchoService.ServerStream`)

1. Target `localhost:50051` → **Reflect** → select **ServerStream**.
2. Form: `message` = `manual-ss`, `repeat_count` = **3**, `interval_ms` = **0**.
3. **▶ Start stream** — status badge → **Streaming**; log shows three inbound rows `[1/3]` … `[3/3]`.
4. Status → **Ended**; inbound count **↓ 3**.
5. Cancel smoke: `repeat_count` = **10**, `interval_ms` = **500** → Start → **✕ Cancel** while streaming → **Cancelled**.

### Client streaming (`EchoService.ClientStream`)

1. Select **ClientStream** → **▶ Start stream**.
2. Form `message` = `alpha` → **Send message** → outbound row in log.
3. Form `message` = `beta` → **Send message**.
4. **End stream** → single inbound aggregated row `alpha,beta` → **Ended**.

### Bidirectional (`EchoService.BidiStream`)

1. Select **BidiStream** → **▶ Start stream**.
2. Form `message` = `bidi-ping` → **Send message** → inbound echo in log with direction legend.
3. **End stream** → **Ended**.

### Tab isolation

1. Duplicate tab while **ServerStream** selected on tab A.
2. Start stream on tab A; confirm messages appear.
3. Switch to tab B — log empty (no tab A traffic).

### Unary regression

Run Phase 1 smoke: **Echo** unary send + `@sleep:8000` cancel — see [Phase 1 runbook](./grpc-phase1-runbook.md).

## E2E tests

| Spec | Docker | Backend | Notes |
|---|---|---|---|
| `e2e/grpc-studio-shell.spec.ts` | No | No | Shell / validation only |
| `e2e/grpc-test-server.spec.ts` | Yes | Yes | API + fixture smoke |
| `e2e/grpc-studio-unary.spec.ts` | Yes | Yes | Phase 1 unary UI |
| `e2e/grpc-studio-server-stream.spec.ts` | Yes | Yes | ServerStream + cancel + tab isolation |
| `e2e/grpc-studio-client-stream.spec.ts` | Yes | Yes | ClientStream aggregate |
| `e2e/grpc-studio-bidi-stream.spec.ts` | Yes | Yes | Bidi echo |
| `e2e/grpc-studio-manage-schemas.spec.ts` | Partial | Partial | Phase 3I manage schemas + schema browser |
| `e2e/grpc-studio-schema-drift.spec.ts` | No | No | Phase 3I drift UI (mocked reflect) |

```bash
# Shell only
npx playwright test e2e/grpc-studio-shell.spec.ts --reporter=list

# Full gRPC suite — 31 tests across 8 specs (auto-starts Docker when E2E_GRPC_SERVER=1)
npm run server   # separate terminal
npm run test:e2e:grpc
```

Phase 3 descriptor/drift details: [Phase 3 runbook](./grpc-phase3-runbook.md).

Live specs **skip** when :50051 or :3001 is down (same pattern as unary).

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Start stream disabled | Invalid form / no method / unary selected | Pick streaming method; fix validation errors |
| No inbound messages | Wrong target or reflect stale | Re-reflect; confirm :50051 healthy |
| ServerStream ends immediately | `repeat_count` 0 → Docker defaults to 1 | Set explicit `repeat_count` in form |
| Cancel on ServerStream with `@sleep:` no-op | `@sleep:` only works on unary **Echo** | Use `interval_ms` + high `repeat_count` for slow stream |
| Tab B shows tab A messages | Stream ownership bug | File bug — check `streamGenerationRef` / per-tab `streamMessages` |
| SSE stuck after cancel | Stale generation | Should not happen post-Sprint 3 — check `grpcStreamClient` fail-fast on 404/409 |
| Send/End returns 409 on ServerStream | Expected | Server streaming is start + cancel only |
| Clear log then tab switch / reconnect duplicates rows | `lastSequence` preserved | Fixed — Clear log does not reset sequence cursor |
| Send/End API error leaves orphan server stream | Best-effort DELETE cancel | Fixed in `useGrpcStudio` send/end catch paths |

## Phase 2 acceptance checklist

| Criterion | Verified by |
|---|---|
| Tab A stream traffic never in Tab B log | `e2e/grpc-studio-server-stream.spec.ts` (duplicate tab); per-tab `streamMessages` in `useGrpcStudio` |
| Tab switch does not mutate in-flight stream snapshot | `useGrpcStudio.test.ts` (`selectTab` preserves snapshot during streaming) |
| Tab close cancels active streams | `useGrpcStudio.test.ts` (`closeTab cancels active stream via DELETE`) |
| Idempotent cancel/end | `grpc-stream-service.test.ts`; `grpc-routes.test.ts`; `useGrpcStudio.test.ts` |
| SSE dedupe by sequence | `grpcStreamLogUtils.test.ts`; `grpcStreamClient.test.ts` (`shouldAcceptGrpcStreamSequence`); `useGrpcStudio.test.ts` (`clearStreamLog` preserves `lastSequence`) |
| Server-streaming: send/end → 409 | `grpc-routes.test.ts` |
| Client-streaming: aggregate on EOF | `grpc-stream-docker.integration.test.ts` + `e2e/grpc-studio-client-stream.spec.ts` |
| Bidi: direction arrows in log | `GrpcStreamMessageLog.test.tsx`; `e2e/grpc-studio-bidi-stream.spec.ts` |
| Unary regression green | `e2e/grpc-studio-unary.spec.ts`; Phase 1 unit suites |
| Tab call-type pill (U/SS/CS/BD) | `e2e/grpc-studio-server-stream.spec.ts` (SS pill on tab during ServerStream); manual 1× walk |

## UI mockup parity (Phase 2 vs `02-streaming.html`)

Reference: `docs/plan/future/grpc/mockups/02-streaming.html`  
Gap table (authoritative): `docs/plan/future/grpc/grpc-studio-plan.md` § **Phase 2 vs mockup gap**

**Shipped in Phase 2:** stream message log, status bar, compose panel (client/bidi), tab call-type pills, message cap + clear log.

**Deferred (not Phase 2 bugs):** manual call-type selector row, pending queue panel UI, export log JSON, TLS/auth bar (Phase 4).

## Phase 3 handoff notes

- Proto management / protoset import builds on Phase 1 descriptor loader + Phase 2 stream contracts.
- Reuse `metadataValidation.ts`, `validateGrpcStreamStartRequest`, and tab snapshot pattern for workflow nodes (Phase 6).
- Phase 3 runbook: [grpc-phase3-runbook.md](./grpc-phase3-runbook.md) — descriptor sources, drift, test matrix, merge gate (`npm run test:grpc:phase3`).
