# gRPC Studio — Phase 7 Runbook (7I)

Operational gate and troubleshooting for **Tauri native gRPC transport** (Phase 7A–7I).

## Gate commands

| Gate | Command |
|---|---|
| Phase 7I full hardening gate | `npm run test:grpc:phase7i` |
| Full Phase 7 regression (7A→7I) | `npm run test:grpc:phase7` |
| Phase 7H lifecycle only | `npm run test:grpc:phase7h` |
| Phase 7I acceptance only | `npx vitest run src/shared/grpc/grpcPhase7iAcceptance.test.ts` |
| TypeScript check | `npx tsc -b --noEmit` |
| Phase 6 regression (included in 7I) | `npm run test:grpc:phase6i` |

**Prerequisites:** Node 20+, `npm install`, Rust toolchain for native unit tests. Docker echo optional (integration tests auto-skip when unreachable).

---

## Phase 7 architecture

```
gRPC Studio (renderer)
  ├─ express path → Vite proxy /api/grpc → Express grpc-js
  └─ tauri path   → invoke() → src-tauri/grpc (tonic + channel pool)
        ├─ unary.rs / stream.rs
        ├─ channel_pool.rs (7B fingerprint reuse)
        ├─ lifecycle.rs (7H orphan supervisor + tab cleanup)
        └─ events.rs → grpc-event-{tabId} Tauri events
```

Per-tab routing: `tabId` + `requestId` on every unary/stream operation. Tab switch detaches event listeners; 60s grace before orphan cancel (parity with Express SSE).

---

## Acceptance checklist (7I)

| # | Item | Test |
|---|---|---|
| 1 | Tab-scoped unary/stream routing | `checklist-1: tab-scoped response routing` |
| 2 | Tab close cancels native ops for that tab | `checklist-2: tab close cancels native ops` |
| 3 | Repeated end/cancel idempotent | `checklist-3: stream control idempotency` |
| 4 | Orphan cleanup within 60s grace | `checklist-4: orphan cleanup within timeout` |
| 5 | Channel pool reuse; TLS/cert eviction | `checklist-5: channel pool reuse and eviction` |
| 6 | Unary error envelope parity | `checklist-6: unary error envelope parity` |
| 7 | Workflow `runGraph` via native facade | `checklist-7: workflow native facade wiring` |
| 8 | Pre-start fallback; no mid-flight switch | `checklist-8: fallback orchestration` |

---

## Troubleshooting

### Native unary fails with `GRPC_TAURI_SCHEMA_MISMATCH`

Renderer and Rust `GRPC_TAURI_SCHEMA_VERSION` differ. Run `npm run test:grpc:phase7a` to verify contract parity.

### Stream events not arriving on Tauri

1. Confirm transport mode is **Native** (not Express) for the tab.
2. Check event listener attach: `grpc_tab_events_attach` must succeed after `listen`.
3. Verify channel name `grpc-event-{tabId}` matches active tab.

### Express fallback not offered after native failure

Fallback applies only to **pre-start** failures (descriptor, channel build, unreachable). Mid-flight gRPC errors (non-zero status) do not offer fallback. See Phase 7F transport panel.

### Orphan streams after tab switch

Expected: detach on tab switch starts 60s grace. Re-attach within 60s keeps stream alive. After grace, supervisor cancels. Force cleanup: close tab or `grpc_tab_cleanup`.

### Kill-restart drill (manual — desktop)

1. Start Tauri app, open gRPC Studio, start a server stream on tab A.
2. `kill -9` the renderer process (simulate hard crash).
3. Restart app — native supervisor should have cancelled streams on process exit (`RunEvent::Exit`).
4. **Known gap:** hard kill with attach count > 0 may leave streams until process exit; normal close paths are covered.

### Channel pool not reusing connections

Pool keys on target + TLS mode + CA/client cert material. Auth metadata is **per-call**, not pooled. Changing TLS settings creates a new pool entry.

---

## Docker echo (optional integration)

```bash
cd docker/grpc
docker compose up -d --build
curl http://localhost:50052/health
```

Native integration tests in 7C/7D/7G gates auto-skip when Docker is down.

---

## E2E — native transport (desktop CI only)

```bash
E2E_TAURI_NATIVE_GRPC=1 npx playwright test e2e/grpc-studio-native-transport.spec.ts --reporter=list
```

Requires a **real Tauri webview** (`isTauri()` true) — standard web Playwright leaves the Native card disabled and the spec will fail on `toBeEnabled()`. Skipped in default web E2E (`test:grpc:phase7i` does not require this).

---

## Phase 8 entry

Before starting Phase 8 harness integration:

- [ ] `npm run test:grpc:phase7i` green
- [ ] `npm run test:grpc:phase7` green
- [ ] `npx tsc -b --noEmit` — 0 errors
- [ ] No open P0/P1 in routing, lifecycle, or envelope parity
- [ ] Validation report signed off (`docs/guides/grpc-phase7-validation-report.md`)
