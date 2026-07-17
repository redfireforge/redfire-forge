# gRPC Studio — Native vs Express Parity Matrix

Feature-by-feature comparison for Phase 7 Tauri native transport vs web Express path.

| Feature | Express (web) | Native (Tauri) | Parity notes |
|---|---|---|---|
| Unary call | `POST /api/grpc/call` | `grpc_unary` invoke | Same envelope shape via facade |
| Unary cancel | `DELETE /api/grpc/call/:id` | `grpc_call_cancel` invoke | Tab-scoped `requestId` |
| Server stream start | `POST /api/grpc/stream` | `grpc_stream_start` invoke | Same `GrpcStreamStartRequest` |
| Stream events | SSE `GET /api/grpc/stream/:id/events` | Tauri events `grpc-event-{tabId}` | Sequence dedup in adapter |
| Stream send/end/cancel | HTTP stream control routes | `grpc_stream_send` / `grpc_stream_end` / `grpc_stream_cancel` | Idempotent terminal handling |
| Descriptor load | Server-side cache + export | Express export + protoset payload on invoke | SHA-256 integrity (7G); no separate `grpc_descriptor_*` command |
| Health probe | `POST /api/grpc/call` (reflection) | Same Express path (not native) | Documented out-of-scope for 7E |
| TLS / mTLS | Node grpc-js credentials | Rust tls.rs connectors | Fingerprint includes TLS material |
| Channel reuse | Per-request client (grpc-js) | `channel_pool.rs` LRU reuse | Native pools by fingerprint |
| Auth metadata | Per-call headers | Per-call metadata map | Not part of pool fingerprint |
| Tab transport mode | Express only | Per-tab Native/Express selector (7F) | Desktop default: native |
| Pre-start fallback | N/A (web is express) | Native fail → offer Express retry | No mid-flight switch |
| Tab switch grace | SSE disconnect 60s | Listener detach + 60s supervisor | `GRPC_STREAM_SSE_DISCONNECT_GRACE_MS` |
| Tab close cleanup | Express registry cancel | `grpc_tab_cleanup` + renderer detach | Idempotent |
| Window/app exit | Server process continues | `shutdown_all` evicts pool | Desktop only |
| Workflow unary | `buildGrpcNodeOperations` → express | Same facade → native invoke | Checklist-7 |
| Workflow stream | SSE collector | Native stream transport + events | Phase 7E collector |
| Workflow transport on desktop | N/A | Uses `workflow:{nodeId}` tab IDs (default native) | Studio per-tab Express does not apply to workflow IDs (7F out-of-scope) |
| Error codes | `GRPC_*` Express codes | Mapped via `grpcTauriErrorMapping` | Checklist-6 |
| Schema version | HTTP API version | `GRPC_TAURI_SCHEMA_VERSION` | 7A contract gate |

## Intentional differences

| Area | Reason |
|---|---|
| Event transport | SSE (HTTP) vs Tauri event bus — adapter normalizes to `GrpcStreamEvent` |
| Channel pooling | Web creates per-call channels; native reuses tonic channels |
| Hard renderer crash | No heartbeat in 7H — streams cancelled on process exit only |
| E2E coverage | Web Playwright specs use Express; native E2E is desktop CI only |

## Deferred to Phase 8+

- Harness scenario YAML for gRPC test runner
- Proto-typed field assertions in harness
- Renderer liveness heartbeat for hard-crash orphan detection
