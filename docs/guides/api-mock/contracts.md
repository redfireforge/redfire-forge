# API Mock Studio — Contracts

## 1. Schema version

- Current: **`schemaVersion: 1`** (`CURRENT_SCHEMA_VERSION`).
- Future versions are rejected with a diagnostic (no silent partial load).
- Migrations run through `migrateWorkspace` before validation.

## 2. Workspace envelope

Typical persisted / exported shape:

```json
{
  "schemaVersion": 1,
  "servers": [ /* ApiMockServerDefinitionV1 — the saved library */ ],
  "openTabIds": ["srv-…"],
  "tabOrder": ["srv-…"],
  "activeServerId": "srv-…"
}
```

`servers` is the **library**: every mock server the author ever saved. `openTabIds`
lists the subset currently open as tabs, in tab-bar order — closing a tab removes an
id from `openTabIds` and leaves the definition in `servers`. `tabOrder` mirrors
`openTabIds` so older builds and the CLI keep reading the same field.

A workspace written before the library split has no `openTabIds`; loaders treat that
as "every saved server is open", which reproduces the old behaviour exactly. An
explicit `[]` means the opposite — a library with no open tabs.

Native **export** files may wrap with `_exportMeta` (tool, timestamp, format). Importers accept:

- Full workspace
- `_exportMeta` envelope
- Single server definition
- JSON or YAML

## 3. Server definition (conceptual)

| Field group | Purpose |
|---|---|
| `id`, `name` | Stable identity + display |
| `host`, `port`, `basePath` | Listen binding |
| `settings` | Selection, CORS, limits, journal, redaction, fallback, proxy, TLS, callbacks |
| `routes[]` | Rules with predicates + response variants |
| `folders[]` | Optional route grouping |
| `variables` | Server-scoped template variables |

## 4. Route / response

| Piece | Notes |
|---|---|
| Path matcher | `exact` \| `parameterized` \| `glob` \| `regex` (+ flags) |
| Predicates | Tree: `all` / `any` / `not` over leaf predicates |
| Responses | Variants with mode: rules, sequence, weighted, state transitions |
| Behavior | Delay, jitter, probability, max matches, expiry |
| Examples | Durable simulation samples tied to a route |

## 5. Fingerprints

Definition and route fingerprints (SHA-256 of the record, excluding timestamps / tags / `operationId`) power:

- Conflict acknowledgements (stale when either rule's hash changes)
- Deterministic export ordering
- Dirty / Apply comparisons

A **Duplicate** finding means method, path, and Match agree. The two rule fingerprints still usually differ, because they hash the whole rule (id, name, response, priority), not only the Match.

## 6. Diagnostics

Validation and runtime errors use stable codes (examples):

| Code family | Examples |
|---|---|
| Validation | Contract / ceiling violations with JSON Pointer `path` |
| Runtime | `MOCK_PORT_IN_USE`, `MOCK_PORT_OWNED`, `COMPANION_UNAVAILABLE`, `MOCK_VALIDATION_ERROR`, `MOCK_RUNTIME_ERROR` |
| Storage | Corrupt / unsupported version via `safeLoadWorkspace` |

Messages are user-facing; stacks and secret payloads are not echoed.

## 7. Capability gates

Some fields are version/capability gated. Invalid capability usage fails validation with an `AMS-CAPABILITY-*` style diagnostic rather than ignoring the field.

## 8. Fixtures for integrators

Use the published samples under [`examples/api-mock/`](../../../examples/api-mock/) for CLI and walkthrough imports. Authoritative TypeScript types live in `src/shared/api-mock/contracts.ts`.
