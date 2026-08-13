# API Mock Studio — Guides

> **Phase:** 12D (documentation & training)  
> **Audience:** Authors, QA, automation, and maintainers  
> **Product entry:** Protocols → **API Mock**  
> **Planning checklist:** [`docs/plan/future/apimock/apimock-studio-demo-doc.md`](../../plan/future/apimock/apimock-studio-demo-doc.md)

API Mock Studio is a GUI-first local HTTP mock server studio. Each tab is an independently runnable mock environment (host, port, routes, journal, TLS/proxy settings).

## Start here

| Path | When |
|---|---|
| [Getting started](./getting-started.md) | First run on web or Tauri |
| [Studio walkthrough](./studio-walkthrough.md) | Exact click-by-click training (Tracks A–F) |
| [Troubleshooting](./troubleshooting.md) | Companion down, port conflicts, native vs sidecar |

## Platform prerequisites

| Runtime | What you need |
|---|---|
| **Web** (`npm run dev`) | Companion control plane: `npm run server:dev` (default `http://127.0.0.1:3001`). Listeners bind on data-plane ports (auto range **4600–4699**). |
| **Tauri desktop** | Native Rust listener for Start / journal. Companion still used for TLS cert generation and other protocols. HTTPS advertises **HTTP/2** (`h2`) with HTTP/1.1 fallback (plaintext stays HTTP/1.1). |
| **CLI / Docker** | `npx tsx cli/index.ts mock …` — see [CLI & CI](./cli-and-ci.md) and [`examples/api-mock/`](../../../examples/api-mock/) |

## Guide index

| Guide | Contents |
|---|---|
| [Architecture](./architecture.md) | Control plane vs data plane, identity, hot-apply, persistence, web vs native |
| [Contracts](./contracts.md) | Workspace envelope, schema version, fingerprints, ceilings |
| [Matching & conflicts](./matching-and-conflicts.md) | Path kinds, predicates, selection policies, Conflict Inspector, Pattern Toolbox |
| [Runtime & journal](./runtime-and-journal.md) | Transactions, state, variables, settings, diagnostics, console |
| [TLS, mTLS & proxy](./tls-mtls-proxy.md) | HTTPS, client certs, unmatched proxy, record-as-drafts |
| [Import & export](./import-export.md) | Seven import sources, export menu, WireMock/HAR loss reports |
| [CLI & CI](./cli-and-ci.md) | `mock simulate` / `verify` / `start`, Docker, Actions |
| [Workflow & Test Runner](./workflow-and-test-runner.md) | Palette nodes, isolate-run, fixture panel |
| [Templates & responses](./templates-and-responses.md) | Variants, modes, Faker helpers, faults, outbound callbacks/transforms, Data Mapper |
| [Security](./security.md) | Redaction, secret stripping, PEM policy, proxy safety |
| [Migration](./migration.md) | Schema version, corrupt storage recovery |
| [Operations](./operations.md) | Companion lifecycle, ports, soak ceilings, shutdown |
| [Compatibility matrix](./compatibility.md) | Web companion vs Tauri native feature matrix |
| [Screenshots / validation](./screenshots/VALIDATION_RECORD.md) | Walkthrough evidence checklist |

## Related artifacts (not end-user guides)

| Path | Role |
|---|---|
| [`docs/plan/future/apimock/apimock-studio-plan.md`](../../plan/future/apimock/apimock-studio-plan.md) | Full product/implementation plan |
| [`docs/plan/future/apimock/mockups/`](../../plan/future/apimock/mockups/) | Phase 0 interactive design catalog |
| [`docs/plan/future/apimock/fixtures/`](../../plan/future/apimock/fixtures/) | Conformance / validation JSON |
| [`examples/api-mock/`](../../../examples/api-mock/) | CLI sample workspace + Dockerfile |
| [`cli/README.md`](../../../cli/README.md) | CLI command reference |

## Do not over-claim

See [Compatibility](./compatibility.md) and [Security](./security.md). In particular:

- Native Tauri HTTP mock matches the Node companion feature set (HTTP/2 on TLS, proxy, callbacks, transforms, faker). Sidecar still used for Kafka/GraphQL/webhooks and TLS cert generation. Plaintext stays HTTP/1.1 (no h2c).
- WireMock / HAR / OpenAPI are **interoperability** surfaces with documented loss, not 1:1 fidelity.
- Gallery domain **API Mock** ships starter samples (`am-gallery-health`, `am-gallery-users`, `am-gallery-conflicts`) — Load Mock Server from Gallery. Demo Hub lessons remain Phase 12E.
