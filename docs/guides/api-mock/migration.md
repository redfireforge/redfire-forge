# Migration & Storage Recovery

## 1. Schema version

- Workspace documents carry `schemaVersion`.
- Current version: **1** (`CURRENT_SCHEMA_VERSION`).
- `migrateWorkspace` applies registered migrations before validation.
- **Unsupported future versions** fail closed with a diagnostic — the UI does not partially apply unknown shapes.

## 2. Load path

On Studio mount:

1. `readKey('api-mock-workspace-v1')`
2. `safeLoadWorkspace(raw)`:
   - Parse JSON
   - Migrate
   - Validate
3. Outcomes:
   - **ok** → hydrate servers (even with non-fatal validation warnings when safe)
   - **not ok** → empty workspace + user-visible diagnostics (no throw / no silent corruption)

Runtime running/stopped flags from disk are **not** trusted. After load, the UI reconciles against the companion / native listener (`reconcileRuntimeState`):

| Persisted | Live | Result |
|---|---|---|
| running | stopped | UI shows stopped + notice |
| running | companion down | UI shows unknown + companion unavailable |
| stopped | — | stopped |

## 3. Authoring migrations (maintainers)

- Add a migration with `registerMigration` in `src/shared/api-mock/migration.ts`.
- Bump `CURRENT_SCHEMA_VERSION` only with a forward migration and matching negative/positive contract tests.
- Add `invalid-unknown-version.json`-style negative tests.

## 4. Manual recovery

If the workspace will not load:

1. Export any recoverable JSON from backups / downloads.
2. Clear `api-mock-workspace-v1` via storage tooling / app data reset.
3. Re-import a known-good export (**Import → RedfireForge export**).
4. Reconcile listeners (Stop all / restart companion).
