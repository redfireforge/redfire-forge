# Workflow & Test Runner Integration

## 1. Workflow Designer — API Mock palette

Category **API Mock** (`apimock`):

| Node (UI title) | Type | Purpose |
|---|---|---|
| **Start Mock Server** | `apiMockStart` | Start a Studio definition; optional port override; **`isolateRun`** (default true) allocates a run-scoped server id |
| **Apply Definition** | `apiMockApply` | Hot-apply definition to a running listener |
| **Reset Mock State** | `apiMockResetState` | Clear scenario/sequence state |
| **Stop Mock Server** | `apiMockStop` | Stop listener (optional idempotent) |
| **Assert Mock Calls** | `apiMockAssertCalls` | Journal asserts: min/max, route, status, body substring, header, recency |

Typical pattern:

`Start Mock Server` → HTTP/gRPC/… call under test → `Assert Mock Calls` → `Stop Mock Server`

### Isolation

When `isolateRun` is true, the engine registers started servers for cleanup after pass/fail/cancel (`apiMockRunIsolation`). Console may log `Stopped N API Mock server(s) for this run`.

Variables commonly written by Start: `mockPort`, `mockBaseUrl`, `mockGeneration`, `mockServerId`.

### Definition resolution

Nodes resolve the server definition from the persisted Studio workspace (`apiMockWorkflowDefinitionResolver`). Keep the target server saved in API Mock Studio before running the workflow.

## 2. Test Runner fixture

**Runner** page → API Mock fixture panel (`ApiMockFixturePanel`):

1. Select a Studio server.
2. Optionally enable isolate-run / host override so tests hit the mock base URL.
3. On run start: `setupApiMockFixture` starts the listener.
4. On complete: `teardownApiMockFixture` stops isolated servers.

Wired through `useTestExecution` / `apiMockTestFixture.ts`.

## 3. Results

Workflow/test results may carry `apiMockDetails` (transport, server id, generation) for the Results explorer overview.
