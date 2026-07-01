# gRPC Studio — Phase 5 Runbook (5I)

Operational gate and troubleshooting for **Saved Requests, Collections & History** (Phase 5A–5I).

## Gate commands

| Gate | Command |
|---|---|
| Phase 5I (full) | `npm run test:grpc:phase5i` |
| Phase 5H UI | `npm run test:grpc:phase5h` |
| Phase 5F/G grpcurl | `npm run test:grpc:phase5fg` |
| Phase 5C replay | `npm run test:grpc:phase5c` |
| Phase 5B/D persistence | `npm run test:grpc:phase5bd` |
| Phase 5E redaction | `npm run test:grpc:phase5e` |
| E2E collections/history | `npx playwright test e2e/grpc-studio-collections-history.spec.ts --reporter=list` |

**Prerequisites for live E2E:** Express on `:3001`, gRPC Docker echo server on `:50051` (see `docker/grpc/README.md`).

## Phase 5I features

### Response snapshot baseline (unary)

- Optional `responseBaseline` on saved requests in Collections detail pane.
- **Update baseline** captures the active tab's last successful unary response (same service/method).
- **View diff** opens a searchable diff modal when baseline and last result differ.
- Streaming saved requests do not show snapshot UI (unary only).

### Collections & history UI

- Sub-nav: Studio | Collections | Call History.
- Connection bar (Save / Import grpcurl) visible on all views.
- History auto-refreshes on execute via `grpc-call-history-updated` event.

## Troubleshooting

### Save Request disabled

- Select a method in Studio first (`service` + `method` on active tab).
- Resolve blocking schema drift (red banner) before execute/snapshot capture.
- When no collection exists yet, Save auto-prefills **Saved Requests** as the new collection name (editable before submit).
- To save into a **new** collection when one already exists, fill **Or new collection** — that name takes precedence over the dropdown selection.

### History row missing after call

- Confirm call reached terminal state (unary success/error or stream ended).
- Validation failures before snapshot capture do not write history.
- Check browser storage / IDB for `grpc_call_history_v1`.

### Replay disables Send

- **Blocking drift:** method removed or descriptor key mismatch — use drift banner rebind or refresh descriptor.
- **Warning drift:** Replay is allowed; Send blocked until you prune body or dismiss warning (Phase 5C policy).

### grpcurl import warnings

- `-proto` / `-protoset` / file paths show warnings — configure descriptor via Manage Schemas after import.
- Import still applies target, method, body, metadata to active tab.

### grpcurl export mismatch

- Run `npm run test:grpc:phase5fg` — parity matrix catches semantic drift.
- TLS PEM paths export as flags only; secrets never embedded in command string.

### Snapshot baseline always shows diff

- Timestamps/dynamic fields in response body will differ — baseline compares full JSON body and gRPC status.
- Update baseline after intentional API changes.

### Collection not visible after save

- Save navigates to Collections view and selects the new item.
- Expand collection group in sidebar if collapsed.

## Sign-off

See [`grpc-phase5-validation-report.md`](grpc-phase5-validation-report.md) for acceptance traceability and Phase 6 entry criteria.
