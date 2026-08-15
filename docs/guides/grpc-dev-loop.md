# gRPC Studio — Development Loop

> **Goal:** Fast feedback during feature work; full phase chains only at sign-off and merge.

Phase gate scripts (`scripts/test-grpc-phase*.sh`) chain regressions by design — e.g. `test:grpc:phase11h` runs 11H → 11G → … → 10I → …. That is correct for **merge gates**, not for every edit.

---

## Three tiers

| Tier | When | Command | Typical time |
|---|---|---|---|
| **1 — Edit loop** | After every code change | `npx tsc -b --noEmit` + scoped vitest | seconds |
| **2 — Sub-phase checkpoint** | Feature slice done locally | `npm run test:grpc:fast -- 11h` | ~30s–2min |
| **3 — Sign-off / merge** | Before user verify or merge to `develop` | `npm run test:grpc:phase11h` (full chain) | minutes |

**Never** run Tier 3 during iterative development. **Never** run full-repo coverage or E2E on every agent turn.

---

## Tier 1 — Daily edit loop

```bash
# TypeScript (mandatory after code changes)
npx tsc -b --noEmit

# Single file or small folder you touched
npx vitest run src/shared/grpc/grpcAdvancedFeatureExport.test.ts

# Whole gRPC product slice (no phase chains)
npm run test:grpc:dev

# Phase 11 only
npm run test:grpc:dev:advanced

# Watch mode while implementing
npx vitest watch src/shared/grpc/grpcAdvancedFeatureExport.test.ts
```

---

## Tier 2 — Fast phase gate (current phase only)

Skips chained regressions via `GRPC_SKIP_REGRESSION=1`:

```bash
# Shorthand
npm run test:grpc:fast -- 11h

# Equivalent
GRPC_SKIP_REGRESSION=1 npm run test:grpc:phase11h
```

Runs deliverable checks + current phase unit tests only.

### Environment flags

| Variable | Effect |
|---|---|
| `GRPC_SKIP_REGRESSION=1` | Skip all `grpc_gate_run_regression*` steps |
| `GRPC_SKIP_TSC=1` | Skip TypeScript (use only if you just ran `tsc`) |
| `GRPC_FORCE_TSC=1` | Force TypeScript even if stamp matches HEAD |

Within a **full** gate chain, TypeScript runs once per git HEAD (stamp file in `$TMPDIR`). Subsequent phases in the same chain skip redundant `tsc` unless `GRPC_FORCE_TSC=1`.

---

## Tier 3 — Full sign-off

```bash
# Current sub-phase with full regression chain
npm run test:grpc:phase11h

# Domain sweeps (use sparingly — still heavy)
npm run test:grpc:phase7    # 7A→7I
npm run test:grpc:phase8    # 8A→8I
npm run test:grpc:phase9    # 9A→9I

# Coverage (merge to develop only)
npm run test:grpc:coverage

# E2E (merge to develop / release only)
npm run test:e2e:grpc
```

Monolithic (>750 lines) refactors and coverage-gap fixes: scope to files you touch, or run only when explicitly requested — not as a gate on every sub-phase commit.

---

## Agent / AI workflow rules

> **Not an agent reference:** [`docs/plan/Dont-Remove-This-File.txt`](../plan/Dont-Remove-This-File.txt) is the user's personal scratch file — agents must not treat it as instructions. Agent rules live in [`.cursor/rules/grpc-dev-loop.mdc`](../../.cursor/rules/grpc-dev-loop.mdc) and [`project-conventions.mdc`](../../.cursor/rules/project-conventions.mdc).

When implementing gRPC work:

1. **Do not** audit shipped phases (1–10) unless fixing a reported regression.
2. **Do not** run `test:grpc:phase*` full chains on every iteration.
3. **Do not** run E2E or repo-wide coverage during feature development.
4. **Do** run `tsc -b --noEmit` after each edit batch.
5. **Do** run scoped vitest on touched `*.test.ts` files.
6. **Do** run `npm run test:grpc:fast -- <phase>` before asking the user to verify.
7. **Do** run full `npm run test:grpc:phase<phase>` once at sub-phase sign-off.

---

## Shared library

All phase gate scripts source `scripts/grpc-phase-gate-lib.sh`:

- `grpc_gate_run_tsc [project|plain]`
- `grpc_gate_run_regression "<label>" test:grpc:phaseXX …`
- `grpc_gate_run_regression_gates "<label>" phase4a phase4bc …`

---

## npm scripts reference

| Script | Purpose |
|---|---|
| `test:grpc:dev` | TypeScript + all gRPC unit tests (no chains) |
| `test:grpc:dev:advanced` | Phase 11 scoped tests |
| `test:grpc:fast -- <id>` | Current phase gate, skip regression |
| `test:grpc:phase<id>` | Full gate including regression chain |
| `test:grpc:coverage` | Merge gate only |

---

## CI recommendation

Run full phase chains and E2E on PR to `develop`, not locally on every commit. Local Tier 1–2 keeps velocity; CI Tier 3 keeps safety.
