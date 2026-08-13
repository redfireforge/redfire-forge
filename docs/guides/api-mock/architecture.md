# API Mock Studio — Architecture

## 1. Mental model

| Concept | Meaning |
|---|---|
| **Mock Server (tab)** | One durable definition: name, host, port, base path, settings, routes, samples |
| **Workspace** | Ordered set of servers (`tabOrder`) persisted as one envelope |
| **Control plane** | Web: companion HTTP API on `:3001` (`/api/mock/...`). Tauri: native `api_mock_listener_*` commands for listen/journal/state; companion still used for TLS PEM helpers. |
| **Data plane** | User traffic on the mock’s listen port (e.g. `:4600`) |
| **Generation** | Monotonic snapshot id after each successful **Apply** / commit |

Identity is **`serverId`**, not port. Ports are editable and reusable; tabs survive port changes.

## 2. Runtime topology

```
Web:
┌─────────────┐     control      ┌──────────────────┐
│  Studio UI  │ ───────────────► │ Companion :3001  │
└─────────────┘                  │  /api/mock/*     │
                                 └────────┬─────────┘
                                          │ manages
                                 ┌────────▼─────────┐
                                 │ Listener :4600…  │  ◄── curl / Requests / SUT
                                 └──────────────────┘

Tauri desktop:
┌─────────────┐  invoke api_mock_listener_*  ┌──────────────────┐
│  Studio UI  │ ────────────────────────────► │ Native Hyper     │  :4600… (HTTP/1.1;
└─────────────┘                               │ listener         │   TLS = h2 + HTTP/1.1)
       │                                      └──────────────────┘
       │  companion still used for TLS PEM generation
       │  and Kafka / GraphQL / webhooks
       ▼
┌──────────────────┐
│ Companion :3001  │
└──────────────────┘
```

## 3. Hot-apply lifecycle

1. Author edits the **draft** definition in the UI (dirty badge).
2. **Validate** (contracts + ceilings).
3. **Atomic commit** replaces the running snapshot and bumps **generation**.
4. In-flight requests remain pinned to the generation they started on.
5. Invalid drafts never replace a healthy running snapshot.

Server bar actions: **Start**, **Stop**, **Restart**, **Apply**.

## 4. Persistence

| Item | Detail |
|---|---|
| Storage key | `api-mock-workspace-v1` |
| Web | IndexedDB / storage abstraction |
| Desktop | Tauri FS store via the same abstraction |
| What is saved | Definitions, tab order, folders — **not** trusted runtime “running” flags |
| Load path | `safeLoadWorkspace` → parse → migrate → validate; corrupt data falls back to empty with diagnostics |
| Autosave | Debounced save on definition / active-tab changes; flush on unmount |

## 5. Matching pipeline (high level)

1. Normalize request (base path strip, body bounds).
2. Evaluate enabled routes (path + predicate tree).
3. Apply **selection** policy (`highest_priority` or `reject_multiple`, equal-priority tie-break).
4. Select response variant (rules / sequence / weighted / state).
5. Render templates → optional transforms → faults → journal row.
6. Optional unmatched **proxy** or closest-match debug / default 404.

## 6. Conflict analysis

Static analyzer (`conflictAnalyzer`) produces findings: definite/potential overlap, duplicate, shadowed, unreachable — with witness requests for Simulate. Acknowledgements are fingerprint-based and go **stale** when definitions change.

## 7. Hard ceilings (selected)

From `HARD_CEILINGS` in `src/shared/api-mock/defaults.ts`:

| Ceiling | Value |
|---|---|
| Open tabs | 8 |
| Routes / server | 2,000 |
| Inbound / response body | 10 MiB |
| Concurrent connections | 500 |
| Journal entries | 500 (configurable lower) |
| Auto port range | 4600–4699 |

## 8. Intentional Node ↔ native differences

HTTP mock features are feature-complete on both listeners. Remaining intentional diffs:

| Topic | Behavior |
|---|---|
| Plaintext HTTP | HTTP/1.1 only (**no h2c**) on both |
| Commit / Apply | Does **not** rebind listen port or TLS material — Restart to pick up bind/cert changes |
| XML Schema | Element-presence / minimal `xs:element` subset — not a full XSD engine |
| NOT combinator | Fail-closes when a child is `evaluated: false` |
| Malformed fault on HTTP/2 | Native **RST_STREAM**s one stream; Node may destroy the TLS session |
| TLS PEM generation | Still via companion helpers even on Tauri desktop |
| Warning APIs | `analyzeNativeUnsupported` / `native_capability_warnings` stay wired but currently return **empty** |

## 9. Related code map

| Area | Location |
|---|---|
| Studio UI | `src/features/api-mock/` |
| Shared engine | `src/shared/api-mock/` (incl. `corsHeaders.ts`, `proxyRecording.ts`) |
| Companion routes | `src-server/routes/api-mock/` |
| Node listeners | `src-server/api-mock/` |
| Native listener | `src-tauri/src/api_mock/` (`proxy.rs`, `callbacks.rs`, `recording.rs`, `transforms.rs`, `faker.rs`, …) |
| CLI | `cli/mockCommands.ts`, `src/shared/api-mock/cliMock.ts` |

See also [compatibility.md](./compatibility.md) and [operations.md](./operations.md).
