# gRPC Studio — Phase 9 Runbook (9I)

Operational gate and troubleshooting for **Environment Variable Interpolation** (Phase 9A–9I).

## Gate commands

| Gate | Command |
|---|---|
| Phase 9I full hardening gate | `npm run test:grpc:phase9i` |
| Phase 9I acceptance only | `npx vitest run src/shared/grpc/grpcPhase9iAcceptance.test.ts` |
| Full Phase 9 regression (9A→9I) | `npm run test:grpc:phase9` |
| Phase 9H cross-surface parity | `npm run test:grpc:phase9h` |
| Phase 9G preview UX | `npm run test:grpc:phase9g` |
| TypeScript check | `npx tsc -b --noEmit` |

**Prerequisites:** Node 20+, `npm install`. Unit tests use mocked transport — no live gRPC server required.

---

## Phase 9 features

### Token grammar (9A)

- Templates use `{{varName}}` with escape rules `\{{` and `\}}`.
- Invalid syntax returns `invalid_syntax` state; unresolved tokens block execute.

### Shared resolver (9B)

- Flat single-pass substitution — env values are **not** recursively expanded.
- Deep traversal for JSON body, metadata keys/values, and auth fields.

### Precedence and snapshots (9C)

- Merge order: workspace → active env → profile variables → tab overrides.
- Every execute snapshot carries immutable `interpolationEnv`.
- In-flight Studio calls are insulated from env switching.

### Target validation (9D)

- Resolved targets reject URL schemes (`http://`, `grpc://`, etc.).
- Canonical tokens: `grpcHost` (full `host:port`), `grpcPort` (derived `1–65535`).

### Cycle detection (9E)

- Env values referencing other env keys are validated for cycles before bind.
- Diagnostics show token **names** on cycle path — never secret values.

### Template persistence (9F)

- Saved requests and harness actions persist templates, not resolved literals.
- Export/sanitize guards detect resolved literal leaks.

### Preview UX (9G)

- Target strip: Template / Resolved toggle when draft contains tokens.
- Error banner for cycles, missing tokens, invalid syntax.

### Cross-surface execute parity (9H)

- Studio `prepareExecuteSnapshot` and replay deep-resolve body/metadata/auth.
- Harness/workflow/studio produce identical comparable payloads from same templates.

### Stream send hardening (9I)

- Mid-stream `sendStreamMessageCall` deep-interpolates body using **frozen** `lastExecuteSnapshot.interpolationEnv`.
- Env switch during active stream does not alter in-flight send resolution.
- Interpolation validation failures use `category: validation` (not transport `call_failed`) and **cancel the server stream** before clearing local state (prevents orphan streams).

---

## Troubleshooting

### Send/Reflect blocked — missing `grpcHost`

**Symptom:** Target validation error mentioning Environment Manager or `grpcHost`.

**Fix:**
1. Open **Settings → Environments** and set gRPC endpoint on the active environment.
2. Confirm env selector in app header matches the environment you configured.
3. Use **Resolved** preview on target strip to verify `localhost:PORT` appears.

### Unresolved template variables

**Symptom:** Error lists token names like `greeting`, `token`.

**Fix:**
1. Add missing keys to active environment or profile variables.
2. Check tab **env overrides** (highest precedence).
3. For workflow nodes, verify upstream variable bindings.

### Env cycle detected

**Symptom:** Banner shows cycle path chips (e.g. `a → b → a`).

**Fix:** Break the cycle — env variable values must not reference each other in a loop. Use flat values or remove cross-references.

### Escaped braces show as unresolved

**Symptom:** `\{{grpcHost}}` appears literally (expected) but UI shows unresolved badge.

**Fix:** Escaped literals are intentional. Switch preview to **Template** view. Execute uses literal string, not token expansion.

### Saved request replay resolves differently than expected

**Symptom:** Replay uses new env values; old run history shows different target.

**Expected:** Replay re-binds current env (9F). Prior execute snapshots in history remain immutable (9C).

### Stream message send fails after env switch

**Symptom:** Mid-stream send still uses old greeting/token values.

**Expected:** In-flight streams use frozen env from stream start (9I). Restart stream to pick up new env.

### Stream send: "Cannot send without active execute snapshot"

**Symptom:** Validation error when sending mid-stream message (`category: validation`).

**Fix:** Cancel and restart the stream — `lastExecuteSnapshot` was lost (tab reset or error recovery). The server stream is cancelled automatically on this validation path.

### Stream send: unresolved template variables

**Symptom:** Validation error listing missing token names (not a transport failure).

**Fix:** Add missing env keys to the **environment active when the stream started** (frozen env), or restart the stream after updating env. The server stream is cancelled automatically; restart to continue.

### Secret leaked in export

**Symptom:** Export JSON contains resolved bearer token instead of `{{token}}`.

**Fix:** Report as bug — run `npm run test:grpc:phase9f` and `npm run test:grpc:phase9h`. Persist guards should block literal leaks.

---

## Sign-off checklist

Before merging Phase 9 to `develop`:

1. `npm run test:grpc:phase9i` — green
2. `npx tsc -b --noEmit` — 0 errors
3. Review `docs/guides/grpc-phase9-validation-report.md` — no open P0/P1
4. Manual smoke (optional): Studio tab with `{{grpcHost}}`, switch env, verify subsequent call only changes
