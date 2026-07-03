# gRPC Test Server (Phase 1H + Phase 2H Sprint 1)

Minimal Go echo server with **server reflection** and **all four call types** for gRPC Studio E2E and manual testing.

## Quick start

```bash
cd docker/grpc
docker compose up -d --build
curl http://localhost:50052/health
```

Expected health response:

```json
{"status":"ok","service":"grpc-test-server"}
```

## Endpoints

| Port | Protocol | Purpose |
|---|---|---|
| 50051 | gRPC (HTTP/2) | Reflection exposes `echo.EchoService` and `connectrpc.eliza.v1.ElizaService`; direct grpcurl compatibility includes `api.ApiService/Lookup` |
| 50052 | HTTP | Health check |

## RPC behaviour

| RPC | Type | Behaviour |
|---|---|---|
| `Echo` | Unary | Response `message` equals request `message`. `@sleep:8000` delays ~8s (cancel E2E). |
| `ServerStream` | Server streaming | Emits `repeat_count` messages (default 1), optional `interval_ms` between messages. |
| `ClientStream` | Client streaming | Aggregates client messages (comma-separated) into one response on client EOF. |
| `BidiStream` | Bidirectional | Echoes each client message as a server message. |
| `Lookup` | Unary | Returns `status: "ok"` and `resolved_id` from request `ref.id` (or `"unknown"` when empty). |
| `Say` | Unary | Echo-style Eliza response: returns the input sentence (default `"hello"` when empty). |
| `Introduce` | Server streaming | Sends a short three-line intro stream for demo validation. |
| `Converse` | Bidirectional | Echoes each incoming sentence back as streaming responses. |

### ServerStream request fields

| Field | Default | Notes |
|---|---|---|
| `message` | `"stream"` | Base text; appends `[i/N]` when `repeat_count > 1` |
| `repeat_count` | `1` | Number of server messages |
| `interval_ms` | `0` | Delay between messages |

## Proto

See `proto/echo.proto` — mirrored in `FIXTURE_ECHO_PROTO` / `FIXTURE_DESCRIPTOR` in `src/shared/grpc/contractFixtures.ts`.

The schema-discovery sample service is defined in `proto/api.proto` (`api.ApiService/Lookup`).
It is intentionally handled via unknown-service routing so reflection-based explorer lists remain focused on `echo.EchoService`.

Regenerate Go stubs (Docker build does this automatically):

```bash
cd docker/grpc/go-server
protoc --proto_path=../proto \
  --go_out=echo --go_opt=paths=source_relative \
  --go-grpc_out=echo --go-grpc_opt=paths=source_relative \
  ../proto/echo.proto

protoc --proto_path=../proto \
  --go_out=api --go_opt=paths=source_relative \
  --go-grpc_out=api --go-grpc_opt=paths=source_relative \
  ../proto/api.proto
```

## With RedfireForge

1. Terminal A: `npm run server` (Express `:3001`)
2. Terminal B: `npm run dev` (Vite `:5173`)
3. Open **Protocols → gRPC**, set target `localhost:50051`, click **Reflect**, select a method.

Quick grpcurl check for schema-discovery method:

```bash
grpcurl -plaintext -d '{"ref":{"id":"A-100"}}' localhost:50051 api.ApiService/Lookup
```

Expected response includes:

```json
{"status":"ok","resolvedId":"A-100"}
```

Quick grpcurl checks for ElizaService (BSR lesson parity):

```bash
grpcurl -plaintext -d '{"sentence":"hi"}' localhost:50051 connectrpc.eliza.v1.ElizaService/Say
grpcurl -plaintext localhost:50051 list
```

Expected `list` output includes:

```text
connectrpc.eliza.v1.ElizaService
echo.EchoService
```

Streaming RPCs appear in the explorer with SS/CS/BD badges; full execution UI (stream log, compose panel) ships in Phase 2 — see [`docs/guides/grpc-phase2-runbook.md`](../../docs/guides/grpc-phase2-runbook.md).

## E2E

```bash
# Without Docker — shell + mocked drift specs; live specs skip gracefully:
npx playwright test e2e/grpc-studio-shell.spec.ts e2e/grpc-studio-schema-drift.spec.ts --reporter=list

# Full suite — 31 tests across 8 specs (shell, API, unary, 3 streaming, manage-schemas, schema-drift):
npm run test:e2e:grpc
```

Phase 3 descriptor sources, drift, and merge gate: [`docs/guides/grpc-phase3-runbook.md`](../../docs/guides/grpc-phase3-runbook.md).  
See [`docs/guides/grpc-phase1-runbook.md`](../../docs/guides/grpc-phase1-runbook.md) for troubleshooting and mockup parity notes.
