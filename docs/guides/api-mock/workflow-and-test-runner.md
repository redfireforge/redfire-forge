# Workflow & Test Runner Integration

## 1. Workflow Designer — API Mock palette

Category **API Mock** (`apimock`):

| Node (UI title) | Type | Purpose |
|---|---|---|
| **Start Mock Server** | `apiMockStart` | Start a Studio definition; optional port override; **`isolateRun`** (default true) allocates a run-scoped server id |
| **Apply Definition** | `apiMockApply` | Hot-apply definition to a running listener |
| **Reset Mock State** | `apiMockResetState` | Clear scenario/sequence state |
| **Stop Mock Server** | `apiMockStop` | Stop listener (optional idempotent) |
| **Assert Mock Calls** | `apiMockAssertCalls` | Journal asserts: min/max, route, status, body (contains / equals / regex), request headers, recency |

Typical pattern:

`Start Mock Server` → HTTP/gRPC/… call under test → `Assert Mock Calls` → `Stop Mock Server`

### Isolation

When `isolateRun` is true, the engine registers started servers for cleanup after pass/fail/cancel (`apiMockRunIsolation`). Console may log `Stopped N API Mock server(s) for this run`.

Variables commonly written by Start: `mockPort`, `mockBaseUrl`, `mockGeneration`, `mockServerId`.

### Definition resolution

Nodes resolve the server definition from the persisted Studio workspace (`apiMockWorkflowDefinitionResolver`). Keep the target server saved in API Mock Studio before running the workflow.

## 2. Test Runner fixture

**Runner** page → API Mock fixture panel (`ApiMockFixturePanel`):

1. Pick **Mock Server** in the Host row (opens the fixture; scenarios always hit the mock).
2. Select a Studio server. **Isolate on** (default) starts a throwaway copy and stops it after the suite. **Isolate off** uses Studio's server and restores its prior Running/Stopped state.
3. On run start: `setupApiMockFixture` starts the listener (copy or Studio server).
4. On complete: `teardownApiMockFixture` stops an isolated copy, or restores Studio's prior status when isolate is off.

Wired through `useTestExecution` / `apiMockTestFixture.ts`.

## 3. Results

Workflow/test results may carry `apiMockDetails` (transport, server id, generation) for the Results explorer overview.
