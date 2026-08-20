# CLI Demo Lessons — Comprehensive Plan

> **Domain:** `cli` (new — not yet registered in `allDomains`)
> **Status:** New — no `cliDomain` exists today; `packages/demo-hub/src/lessons/index.ts` only registers `protocolsDomain`, `apiDomain`, `workflowDomain`, `harnessDomain`

---

## Design Philosophy

These lessons teach the **RedfireForge CLI** (`cli/index.ts`, published as `redfireforge-cli`) — the same execution engine as the desktop app, run headlessly from a terminal for CI/CD and automation. Unlike every other DemoHub domain, the CLI has **no DOM to spotlight** — it is a Node.js process printing to stdout. This plan proposes both the **lesson content** (what to teach) and the **DemoHub extensions** required to actually play a CLI lesson (a simulated/live terminal surface, since `DemoStep.highlight` is a CSS selector today).

**Key principles:**
- Every lesson runs **real CLI commands** against the same `examples/`/sample fixtures already in the repo — not just prose. Where the desktop app can spawn a real child process (Tauri `shell` plugin, already used for the companion sidecar in `src-tauri/src/companion.rs`), the demo replays actual stdout; on web, it falls back to a scripted/typed transcript (see [Architecture Proposal](#architecture-proposal-a-terminal-surface-for-demohub)).
- All examples target **JSONPlaceholder-style local fixtures** already shipped in the repo (`examples/`, `cli/*.test.ts` fixtures) so lessons don't depend on flaky third-party APIs.
- Each lesson **builds on the prior one's fixtures** (same sample test file) but stands alone via `setup()` seeding, matching the pattern used by `workflowDomain`/`harnessDomain` lessons.
- Mirrors the CLI's own command taxonomy: `run`, `workflow`, `validate`, `validate-workflow`, `mock simulate|verify|start` — plus the cross-cutting concerns (data-driven testing, SLA gates, baselines, reporters, CI).
- Desktop-only concepts (the `--cli` passthrough flag, symlink installation) get their own lesson since they differ from the standalone npm package.

---

## Current Coverage Gaps

| What exists today | Where |
|---|---|
| Full CLI implementation: `run`, `workflow`, `validate`, `validate-workflow`, `mock simulate/verify/start` | [cli/index.ts](../../../cli/index.ts), [cli/mockCommands.ts](../../../cli/mockCommands.ts) |
| Prose reference docs (installation, options tables, examples) | [cli/README.md](../../../cli/README.md), [docs/guides/cli-reference.md](../../guides/cli-reference.md), [docs/guides/cli-ci-cd.md](../../guides/cli-ci-cd.md) |
| API Mock Studio CLI/Docker/CI guide | [docs/guides/api-mock/cli-and-ci.md](../../guides/api-mock/cli-and-ci.md) |
| Desktop `--cli` passthrough (Rust `clap` subset: run/workflow/validate/validate-workflow only — **no `mock` subcommand**) | [src-tauri/src/main.rs](../../../src-tauri/src/main.rs) |
| Interactive DemoHub lessons for the CLI | **None.** `allDomains` = `[protocolsDomain, apiDomain, workflowDomain, harnessDomain]` only |
| A terminal-emulator UI surface in DemoHub | **None.** Every existing lesson spotlights real DOM (`highlight: string` = CSS selector) |

**What's completely missing:** any interactive, guided walkthrough of the CLI. Users currently only have static markdown reference docs — there is no equivalent of the "watch it built live" experience that `workflowDomain`/`harnessDomain` provide for the GUI.

---

## Architecture Proposal: A Terminal Surface for DemoHub

Every existing `DemoStep` targets a CSS selector in the live app (`ctx.click`, `highlight`, etc. — see `packages/demo-hub/src/types.ts`). The CLI has no such DOM. Two complementary building blocks are needed:

1. **`DemoTerminal` component** (new, `packages/demo-hub/src/components/`) — renders a fake terminal window (prompt, typed command, streamed output) inside the existing `LiveDemo`/`LessonPlayer` shell, styled consistently with the app's dark theme.
2. **New `DemoStep` fields** for terminal-driven steps, additive to the existing DOM-oriented ones:
   - `terminalCommand?: string` — the command to "type" (animated char-by-char, matching existing narration pacing via `calcReadingTime`)
   - `terminalOutput?: string` — canned/expected stdout to stream in when not running live (web fallback, or deterministic parts like exit codes)
   - `terminalHighlightLines?: [number, number]` — line range within the streamed output to visually emphasize (the terminal equivalent of `highlight`)

**Live vs. scripted execution:**
- **Desktop (Tauri):** reuse the `tauri_plugin_shell` capability already granted (`shell:allow-spawn` in `src-tauri/capabilities/default.json`) to spawn `node cli/index.ts <args>` (source), the repo-root `dist-cli/redfireforge.mjs` bundle (built via `npm run build:cli` → `scripts/build-cli.mjs` — the exact bundle the desktop installer ships and what `src-tauri/src/main.rs` shells out to), or the published-package bundle `cli/dist/redfireforge.mjs` (built via `npm run build:cli-package` → `scripts/build-cli-package.sh`) against fixture files bundled with the app, streaming real stdout into `DemoTerminal`. Gate these lessons with the existing `desktopOnly: true` flag (already defined on `DemoLesson` for exactly this kind of constraint) — mirrors the `dockerEndpoint`/`dockerCommand` gate pattern used by protocol lessons that need an external prerequisite.
- **Web:** no child-process capability in the browser, so lessons render the **scripted transcript** (`terminalOutput`) instead — real output captured once and pinned into the lesson source, refreshed whenever CLI output format changes (a lint/test step should diff actual CLI output against the pinned transcript to prevent drift — see [Open Questions](#open-questions--risks)).
- Exit codes should always be shown explicitly in the transcript (e.g. `$ echo $?` → `1`) since they're a core CI/CD teaching point and aren't otherwise visible in stdout.

This is additive — no changes to existing DOM-based lesson types, and `allDomains` gains one new entry (`cliDomain`) alongside a new `categories` set.

---

## Full CLI Command & Flag Inventory (research baseline)

Everything below was verified against the actual implementation, not just the README:

| Command | Source | Purpose |
|---|---|---|
| `run <file>` | `cli/index.ts`, `cli/loader.ts`, `cli/dataLoader.ts` | Execute a YAML/JSON test file — concurrency, iterations, execution mode, retries, timeouts, data-driven params, tags, SLA, baselines, reports |
| `workflow <file>` | `cli/index.ts`, `cli/workflowLoader.ts`, `src/features/workflow/engine/graphLoadRunner.ts` | Execute a workflow file as a load test — iterations, concurrency, `--var`, trace levels, reports |
| `validate <file>` | `cli/index.ts`, `cli/loader.ts` | Parse + structurally validate a test file, print scenario/tag summary, exit 0/2 |
| `validate-workflow <file>` | `cli/index.ts`, `cli/workflowLoader.ts` | Parse + validate a workflow file, print node/edge summary, exit 0/2 |
| `mock simulate <file>` | `cli/mockCommands.ts` → `src/shared/api-mock/cliMock.ts` | Replay saved API Mock samples against a definition, offline (no listener) |
| `mock verify <file>` | `cli/mockCommands.ts` | Assert against the **live journal** of a running mock (or `--simulate` for the offline corpus) |
| `mock start <file>` | `cli/mockCommands.ts`, `cli/mockStandalone.ts` | Start mock listener(s) — companion-mediated or `--standalone` in-process (Docker/CI) |

**Cross-cutting `run` capabilities** (each merits explicit teaching, not just a flags table):
- **Execution modes:** `sequential`, `batch`, `pool` (default), `load-profile` (`--duration`)
- **Retry/timeout:** `--timeout`, `--retries`, `--retry-delay`
- **Error policy / circuit breaker:** `--error-policy continue|stop-first|stop-threshold`, `--max-errors`, `--max-error-rate` (`src/engine/circuitBreaker.ts`)
- **Data-driven testing:** `--data <csv|json>`, `--scenario <name>`, `--tags`/`--tag-mode` (✅ **fully fixed** — works for both native `dataSource:` inline data and external `--data <csv|json>` rows, and a scenario whose rows are entirely filtered out is now dropped instead of running once unparameterized — see CLI-5 Step 4), `--scenario-tags`/`--scenario-tag-mode` (verified working, test-level), `--env`
- **Reports:** `-o/--output` (JSON), `--junit`, `--markdown`, `--data-rows-summary` (CI row-level format)
- **CI gating:** `--fail-on-error`, `--fail-threshold`
- **SLA evaluation (SLA-E3):** `--sla-config <path>` (`SlaTarget[]` JSON), `--fail-on-sla` → **exit code 4** (`cli/slaEval.ts`)
- **Baseline & regression:** `--save-baseline`, `--baseline-label`, `--baselines-dir` (default `DEFAULT_BASELINES_DIR`), `--compare-baseline <runId|latest-baseline>`, `--fail-on-regression` → **exit code 2 (regression only) or 3 (regression + failures)** (`cli/baselineStorage.ts`, `src/features/results/utils/runBaselines.ts`)
- **Exit code priority:** SLA fail (4) > regression+failure (3) > regression only (2) > test failure (1) > success (0) — this ordering is easy to get wrong and worth a dedicated teaching moment.

**`mock` command specifics:**
- Workspace file formats accepted: full workspace JSON/YAML, native export envelope (`_exportMeta`), or a single server definition (`cli/mockCommands.ts` → `asWorkspace()`)
- `mock start --standalone` auto-rewrites `127.0.0.1`/`localhost` → `0.0.0.0` inside containers (`cli/mockStandalone.ts`, checks `/.dockerenv`)
- Published Docker image: `examples/api-mock/Dockerfile` (`docker build -f examples/api-mock/Dockerfile ...`), health check on `GET /health`
- `mock verify` supports both **live journal** assertions (needs the companion on `:3001` + a running mock) and **offline `--simulate`** corpus checks — an important distinction for CI (no live server needed)

**Desktop `--cli` passthrough gaps** (verified in `src-tauri/src/main.rs`):
- Only wraps `Run`, `Workflow`, `Validate`, `ValidateWorkflow` — **`mock` is not exposed** via the Rust `clap` `Commands` enum, so Docker/CI users must use the npm package or source checkout for API Mock Studio headless commands, not the installed desktop app's `--cli` mode. This is a real gap worth calling out in the desktop-parity lesson rather than glossing over.
- ~~`run`/`workflow` flag parity gap (10+ missing flags)~~ — fixed, see BUG-10.
- ~~`redfireforge` command name collides with the npm package's own `redfireforge` bin~~ — fixed via a collision-free `rff` short alias on both sides, see NOTE-5.

---

## Bugs & Gaps Discovered During Research (Need Triage)

Everything below was found by actually running commands against the repo while writing lesson content, not by code reading alone. Filed here as a single triage list before continuing lesson authoring — each entry has a repro, evidence, a suggested fix, and an estimated effort. Severity is about impact on real CLI users, not on this demo plan.

### Effort Summary

| ID | Severity | Estimated Effort | Why |
|---|---|---|---|
| BUG-1 | High | ✅ **Fixed** (~1.5 hrs actual, matched estimate; +10 min follow-up hardening) | `dataSource:` in the YAML already matched the internal `DataSource` type field-for-field — implemented in `cli/loader.ts`, 18 new tests in `cli/loader.test.ts`, both real broken fixtures now verified working end-to-end. Follow-up (found during a full 10-bug re-review): `validate`-type columns now require an explicit `mapping` instead of silently defaulting to the column name, which would have produced a bogus JSONPath. |
| BUG-2 | High | ✅ **Fixed** (~2 hrs actual, within estimate) | CSV `_tags`/`_label`/`_note`/`_enabled` parsing added to `loadDataFile`; row-tag filtering logic extracted into a new testable `cli/tagFilter.ts` module that now drops a scenario entirely when its rows are filtered to zero, instead of falling through to one unparameterized execution |
| BUG-3 | Medium | ✅ **Fixed** (same commit as BUG-2's CSV half) | Same `loadDataFile` function, same fix |
| NOTE-1 | Low | ✅ **Fixed** (~10 min actual) | Removed `!opts.quiet` guard in `cli/index.ts` (`run` and `workflow` commands) — product decision made: the threshold-exceeded line always prints now |
| NOTE-2 | Low | ✅ **Fixed** (~20 min actual) | New `displayConcurrency()` helper in `cli/reporters.ts`, 4 new tests, no existing golden-output tests broken |
| NOTE-3 | Low | ✅ **Fully Fixed** (~10 min actual for the fixture-value change, on top of the earlier silent-report fix) | Found while detailing CLI-7: `--fail-on-sla`'s report was suppressed under `-q` (same pattern as NOTE-1, fixed) and `examples/sla-jsonplaceholder-targets.json`'s TPS target was non-deterministic against the live API (fixed by raising the threshold to an unreachable 100 req/s, verified across 4 runs) |
| NOTE-4 | Low (by design, not a code bug) | ✅ **Documented, no code change needed** | Found while building CLI-10: `mock verify`'s live-journal mode only ever reads from the **companion** process's control API — a `mock start --standalone` listener has no control surface at all, so live verify against it fails immediately with a clear `fetch failed` error naming the fix. Corrected the lesson's Step 5 to use companion mode instead of standalone; nothing in the CLI itself needed to change. |
| BUG-4 | Medium (latent) | ✅ **Fixed** (~15 min actual) | Mechanical path correction across 8 import statements in 6 files, all `import type` (type-only) so zero runtime risk |
| BUG-5 | High | ✅ **Fixed** (~1 hr actual, better than estimated — assertions run independent of `mode`, no default-mode decision needed) | `cli/loader.ts` now reads a top-level `assertions:` field, merged into `validation.assertions`. 4 new tests. Verified end-to-end with valid assertion types (`status`, `numeric`) — a deliberately-wrong assertion now correctly fails. |
| BUG-6 | Medium | ✅ **Fixed** (~45 min actual) | Found while verifying BUG-5's fix: `type: jsonPath` (used 9 times across `cli-basic-test.yaml`, `cli-assertions.yaml`, `cli-parameterized.yaml`) **was not a real assertion type** — translated all 9 to their correct real type (`existence`/`numeric`/`regex`), also catching a compounding `operator: "=="` bug (not a valid `ComparisonOperator` — would have always failed instead of comparing) |
| BUG-7 | Medium | ✅ **Fixed** (~45 min actual) | Found while verifying BUG-6's fix: data-row template values (`{{columnName}}`) never substituted into custom `assertions:` fields — only into url/headers/body (and a narrow kafka/ws-only, body-column-only exception). Fixed at the engine level in `resolveScenarioFromDataRow`: a new `assertionVars` map built from all column types (path/param/body/validate) now feeds a `substituteAssertionVariables()` helper covering `status`/`header`/`regex`/`numeric`/`arrayLength`/`bodySize`/`arrayContains`/`each`/`containsSubset`/`datePrecise` plus the original kafka/ws fields. 6 new tests. |
| BUG-8 | Medium | ✅ **Fixed** (~30 min actual) | Found while building CLI-9: `examples/workflow-cli-conditional.yaml`'s Switch node used a fictional schema (`cases[].targetNodeId`, node-level `defaultTargetNodeId`) that doesn't exist on the real `SwitchNodeData`/`SwitchCase` types — the engine actually routes via edge `sourceHandle: case-<id>`/`default`. Every branch was silently skipped since the fixture was first authored; a prior 2026-05-07 plan note "fixed" a *different* problem (a disconnected graph) without catching this one. Also depended on the now-deprecated restcountries.com v3.1 API. Fixed: corrected edge-based routing, branch decision now keys off the `{{country}}` variable directly, dead-API branch targets replaced with jsonplaceholder calls. |
| BUG-9 | Low (CLI-only; GUI is unaffected) | ✅ **Fixed** (~20 min actual) | Found while building CLI-9: `--trace-level` was fully **inert** in the CLI. `cli/index.ts`'s `workflow` command validated the flag and threaded `traceOptions` into `runGraphLoad(...)`, but only destructured `{ results }` from its return value — the returned `trace` (a full `WorkflowExecutionTrace`, the same data structure that powers the GUI's Results Explorer replay/heatmap) was discarded. Fixed by adding a new `--trace-output <path>` flag (same pattern as `-o`/`--junit`/`--markdown`) that serializes the trace to JSON — confirmed `standard` vs. `full` now produce genuinely different, populated per-node request/response detail. |
| BUG-10 | High (desktop `--cli` mode only; npm CLI unaffected) | ✅ **Fixed** (~40 min actual) | Found while building CLI-11: the desktop app's `--cli` wrapper (`src-tauri/src/main.rs`) had drifted **significantly** out of parity with the npm CLI — entirely missing `--scenario-tags`/`--scenario-tag-mode`, all of SLA gating (`--sla-config`/`--fail-on-sla`), all of baseline/regression detection (`--save-baseline`/`--baseline-label`/`--compare-baseline`/`--fail-on-regression`/`--baselines-dir`/`--comparison-report`), and workflow's `--base-url`/`--trace-level`/`--trace-output`. Fixed by adding the missing fields to the Rust `Commands` enum + `build_cli_args()`; verified end-to-end by compiling the actual binary and running it against real fixtures (SLA report, trace output, scenario-tag filtering all confirmed working through the compiled Rust wrapper). |
| NOTE-5 | Medium (local dev machines only; CI unaffected) | ✅ **Fixed** (~1.5 hrs actual) | Found while discussing CLI-11: the npm package (`redfireforge-cli`, `bin: redfireforge`) and the desktop app's installer both claim the **same command name** `redfireforge` on `$PATH` — bare `redfireforge` launches the GUI (Tauri) or runs the CLI directly (npm) depending on which wins, with zero warning either way. Confirmed via the real npm registry that `redfireforge-cli` isn't published yet (404), and that `scripts/version.sh` never synced `cli/package.json`'s version (only `.github/workflows/publish-cli.yml` did, at actual publish time). Fixed: added a collision-free `rff` bin alias (npm `bin` map, `main.rs` argv0 detection defaulting to CLI mode, all 3 installer scripts symlinking/shimming it) so `rff` always means "run the CLI" regardless of what else is installed; `redfireforge` bare is untouched (still opens the GUI). Also fixed `scripts/version.sh` to sync `cli/package.json`, and `docs/guides/cli-ci-cd.md`'s inconsistent CI examples (most defaulted to the heavy source-repo form instead of the recommended npm-package form). **Incidental find:** `src-tauri/installer/windows/main.wxs`'s XML comments already contained a literal `--` (invalid per the XML spec) before this session touched it — confirmed via `git show HEAD:...` that this predates all of today's changes; fixed alongside the `rff` work. |

**Recommended sequencing:** ~~fix BUG-1, BUG-2, and BUG-3 together in one PR~~ **All three are now fixed.** BUG-1 resolved the inline-schema half of BUG-2 as a verified side effect; this pass closed out BUG-2's remaining CSV half (which was identical work to BUG-3) plus the empty-filter-skip behavior in `cli/index.ts`. **BUG-5 through BUG-10 and NOTE-5 are all now fixed. NOTE-4 required no code change** — the CLI's behavior was already correct, only the lesson's step design needed correcting.

### BUG-5 (High, found while building CLI-8): top-level `assertions:` was silently ignored by the CLI — ✅ FIXED

- **Repro:** any test file with a top-level `assertions:` block directly under a test (not nested under `validation:`), run against a request that returns a real 200 OK, with an assertion crafted to definitely fail (e.g. `{ type: status, expected: '404' }` against an actual 200 response).
- **Expected:** `Failed Valid: 1`, `Result: FAILED ❌`.
- **Actual (before fix):** `Passed: 1`, `Failed Valid: 0`, `Result: PASSED ✅` — the assertion was never evaluated.
- **Scope:** confirmed via `grep` that **6 example fixtures declare 26 top-level `assertions:` blocks this way** — `examples/cli-basic-test.yaml`, `examples/cli-error-handling.yaml`, `examples/cli-assertions.yaml`, `examples/cli-load-profile.yaml`, `examples/cli-parameterized.yaml`, `examples/sla-jsonplaceholder-test.yaml`. By contrast, GUI-oriented fixtures (`sample-api-test.yaml`, workflow node configs) correctly use the nested `validation: { assertions: [...] }` shape the loader actually reads.
- **Root cause:** `cli/loader.ts`'s `TestFileScenario` interface had `validation?: TestFileValidation` (which itself has an `assertions?: Assertion[]` field), but **no top-level `assertions` field at all**. `buildScenarios` only ever called `toValidation(t.validation)` — a bare `t.assertions` was simply never read, structurally identical to BUG-1's root cause (`dataSource:` vs. `data:`), just with a different field name and a much larger blast radius (6 fixtures / 26 assertion blocks vs. BUG-1's 2 fixtures).
- **Key research insight that simplified the fix:** traced `buildValidationResult` (`src/engine/validationResult.ts`) and confirmed assertions are evaluated **independent of `validation.mode`** — `evaluateAssertions()` runs whenever `assertions.length > 0`, regardless of mode; `mode` only gates the separate `expectedJson`/`expectedFields` deep-comparison path in `validate()`. This meant the fix didn't need a "pick the right default mode" product decision at all — just attach the assertions array.
- **Fix implemented:** added `assertions?: Assertion[]` to `TestFileScenario` in `cli/loader.ts`. `toValidation()` now takes a second parameter and merges `t.assertions` with any assertions already nested under `t.validation.assertions` (concatenated, nested-first) — `validation.mode` is left exactly as it was (including `'none'`), since mode no longer needs to change for assertions to run.
- **Verification:** 4 new tests in `cli/loader.test.ts` (attaches top-level assertions, keeps `mode: 'none'` while still running them, merges with nested assertions, leaves `assertions` undefined when neither is present) — all 50 tests in the file pass. Real end-to-end run with valid assertion types (`status`, `numeric`) confirmed: a deliberately-wrong `status` assertion now correctly produces `passed: false` with the right failure detail (`expected: "404", actual: "200"`), a correct one passes, and a deliberately-wrong `numeric` jsonPath assertion fails with the right detail (`expected: "= 999", actual: "1"`). Full `cli/` suite: 325 passed (up from 321), same 1 pre-existing unrelated flake. No lint/type errors.
- **Where this landed in the plan:** [CLI-8 Step 5](#step-5--cli8-fail-on-regression---fail-on-regression) documented the original finding and worked around it with a genuine HTTP failure — that workaround is no longer strictly necessary but the narration is left as historical context since it's still a valid alternate path to exit 3.

### BUG-6 (Medium, found while verifying BUG-5's fix): `type: jsonPath` was not a real assertion type — ✅ FIXED

- **Repro:** any assertion with `type: jsonPath` (e.g. `{ type: jsonPath, jsonPath: '$.ok', operator: '==', value: false }`), correctly wired through via BUG-5's fix, run against any response.
- **Expected:** the assertion evaluates and can fail.
- **Actual (before fix):** silently produced zero failures regardless of the actual response — always "passes".
- **Root cause:** `src/engine/validator.ts`'s `evaluateAssertions()` switches on `a.type` with cases for `status`, `responseTime`, `header`, `regex`, `arrayLength`, `numeric`, `date`, `typeCheck`, `existence`, `arrayContains`, `each`, `containsSubset`, `jsonSchema`, `bodySize`, `datePrecise`, `kafkaField`, `wsField`, `wsNumericField`, `custom` — **no `default` case, and no `'jsonPath'` case**. The `Assertion` union type (`src/shared/types/index.ts`) doesn't even include a `'jsonPath'` variant. An assertion with this type name fell through the switch with `assertionFailures` staying `[]`, so it always "passed" — the same symptom as BUG-5, but from an entirely different, unrelated root cause. Also discovered in the same investigation: the numeric `ComparisonOperator` union only accepts `'='` (not `'=='`) — `compare()`'s `default: return false` means an `operator: '=='` numeric assertion would have always **failed** instead of comparing correctly, a third distinct symptom that would have surfaced the moment BUG-6 alone was "fixed" without also correcting the operator.
- **Fix implemented:** translated all **9 occurrences across 3 fixtures** to their correct real types, verified individually against `src/engine/validatorAssertionHandlers.ts`'s actual handler semantics before applying:
  - `operator: exists` → `type: existence, expectExists: true` (4 occurrences: `cli-basic-test.yaml` ×1, `cli-assertions.yaml` ×3)
  - `operator: ">"`/numeric comparisons → `type: numeric` with the same operator, unchanged (`>` is already a valid `ComparisonOperator`) (2 occurrences)
  - `operator: "=="` → `type: numeric, operator: "="` (corrected to the real operator token, not just the type) (2 occurrences)
  - `operator: contains` → `type: regex` with the literal value as the pattern — verified `handleRegex` uses `RegExp.test()`, which does a substring/partial match by default, making a literal string pattern a safe equivalent for "contains" (1 occurrence, `cli-assertions.yaml`'s "Graham" check)
- **Verification:** `grep` confirms zero remaining `type: jsonPath` in `examples/`. All 3 fixtures re-validated (`validate` command) and re-run for real: `cli-basic-test.yaml` (`Passed: 9, Failed Valid: 0`), `cli-assertions.yaml` (`Passed: 36, Failed Valid: 0`) — both clean, with assertions now genuinely evaluating (confirmed via BUG-5's separate deliberately-wrong-assertion tests using the same handler code paths). Full `cli/` suite: 325 passed, same 1 pre-existing unrelated flake.
- **Where this landed in the plan:** not directly referenced in any lesson step's captured output (BUG-6 was discovered and fixed outside the CLI-1–CLI-8 lesson-writing flow) — the fixed fixtures are still used as-is by CLI-1/CLI-2/CLI-4/CLI-6.

### BUG-7 (Medium, found while verifying BUG-6's fix on `cli-parameterized.yaml`): data-row template values never substitute into custom `assertions:` fields — ✅ FIXED

- **Repro:** a data-driven test with a custom assertion whose value contains a `{{columnName}}` placeholder (e.g. `type: regex, jsonPath: $.name, pattern: "{{expectedName}}"`, with `expectedName` a per-row data-source column).
- **Expected:** each row substitutes its own `expectedName` value into the pattern before evaluation.
- **Actual (before fix):** the literal string `"{{expectedName}}"` was used as the regex pattern for every row, unsubstituted — verified by re-running `cli-parameterized.yaml` after BUG-6's type-correction: every single row failed (`Failed Valid: 36`) despite the underlying API data being correct.
- **Root cause:** `src/engine/dataSourceExpander.ts::resolveScenarioFromDataRow` substituted row values into `url`/`headers`/`body` (and, as a narrow special case, into `kafkaField`/`wsField`/`wsNumericField` assertion values only, and only when the row had a `body`-type column) — but never into general-purpose assertion types like `regex`/`numeric`/`status`/`header`/etc. Custom assertions were carried through to every expanded row scenario byte-for-byte identical.
- **Fix implemented (engine-level, not just a fixture workaround):** added a new `assertionVars` map in `resolveScenarioFromDataRow`, built from **all** data source columns (not just `body` ones) — `path`/`param`/`body` columns key by their `mapping` (variable name), `validate` columns key by their human-readable `name` (since their `mapping` holds a JSONPath instead). A new `substituteAssertionVariables()` helper substitutes into whichever simple string/number field a given assertion type actually has: `status.expected`, `header.value`, `regex.pattern`, `arrayLength.value`/`numeric.value`/`bodySize.value` (re-parsed back to a number after substitution), `arrayContains.value`, `each.value`, `containsSubset.expected`, `datePrecise.reference`, plus the original `kafkaField`/`wsField`/`wsNumericField.value`. Assertion types with structured or code-like fields (`date`'s reference object, `jsonSchema`, `custom` expressions) are deliberately left untouched — blind substitution there would be unsafe or meaningless.
- **Tests:** new `src/engine/dataSourceExpander.assertionVars.test.ts` (6 tests) covering the exact `cli-parameterized.yaml` case (validate-column → regex pattern), status/header/numeric substitution from path/param columns, the no-columns no-op case, and confirming `date`/`custom` assertions are left alone. All existing `kafkaField`/`wsField`/`wsNumericField` interpolation tests in `dataSourceExpander.kafka.test.ts` still pass unchanged (that mechanism is now a strict superset of its old behavior, not a rewrite).
- **Verification:** full `src/engine/` + `cli/` suite: 1994 passed, 7 skipped, same 1 pre-existing unrelated flake (`cli/mockCommands.test.ts` "passes live journal filters through to assertions"). `cli-parameterized.yaml` re-run against the live API: `Passed: 36, Failed Valid: 0, Data Rows: 36 total, 36 passed, 0 failed`.
- **Fixture left as-is:** `cli-parameterized.yaml`'s redundant `type: regex` assertion (removed while this was still a known limitation) was **not** re-added — the file's `validate`-type data source column already performs the identical per-row name check via the correct, purpose-built `ExpectedField`/selective-mode mechanism, so re-adding it would just be duplicate coverage. The engine limitation this bug was about is now fixed and available to any future fixture/lesson that needs it (e.g. templating a `numeric`/`status`/`header` assertion off row data).
- **Effort:** ~45 min actual (engine change + new test file), matching the original "if pursued" estimate.

---

### BUG-8 (Medium, found while building CLI-9): `workflow-cli-conditional.yaml`'s Switch node used a schema that doesn't exist — ✅ FIXED

- **Repro:** `npx tsx cli/index.ts workflow examples/workflow-cli-conditional.yaml --var country=germany -i 1 -c 1` (and again with `country=japan`, and with no override at all for the default case).
- **Expected:** per the file's own header comment, `germany` routes through the "European Country" HTTP node, `japan` through "Asian Country", anything else through "Other Region" (default).
- **Actual (before fix):** every single run — regardless of `country` value — executed **only** the `Lookup Country` node and then silently ended. `Total Steps: 10` for 10 iterations (1 HTTP call each, not 2). A JSON report (`-o`) confirmed the branch/default nodes never fired at all — no error, no failure, just silently absent from the results.
- **Root cause:** the fixture's `check-region` switch node was authored with `cases: [{ value: 'Europe', targetNodeId: 'european-action' }, ...]` and a node-level `defaultTargetNodeId: 'other-region'` field. Neither field exists on the real `SwitchNodeData`/`SwitchCase` types (`src/features/workflow/types/workflow/node-core.ts`) — `SwitchCase` is just `{ id, value, label? }`, with **no `targetNodeId`**, and there is **no `defaultTargetNodeId` anywhere in the type system**. The actual engine (`handleSwitchNode` in `src/features/workflow/engine/graphRunnerControlFlowHandlers.ts`) routes by finding the outgoing **edge** whose `sourceHandle` equals `case-<matchedCaseId>` (or `'default'` when nothing matches), then marks every other outgoing edge's subtree as skipped. The fixture's edges (`e3`/`e4`/`e5`, `check-region` → each branch node) had **no `sourceHandle` at all** — so `matchHandle` (always `case-...` or `'default'`) never equaled any real edge's `sourceHandle`, meaning **all three branch edges were always in the "skipped" set, every single run**, independent of the switch expression or which country was requested. A second, independent problem compounded this: the switch's `expression: $response.body[0].region` read a field from the `Lookup Country` HTTP call's JSON response, but that call hits `restcountries.com/v3.1`, which is now deprecated and always returns `{"success":false,"data":null,"errors":[...]}` — so even with correct routing, `$response.body[0].region` would always resolve to `undefined` and only ever hit the default branch.
- **Notable:** a prior plan entry (`docs/plan/finished/workflow-harness-integration-plan.md`, dated 2026-05-07) claims this exact fixture was already "fixed" — but that pass only added a missing End node and connecting edges (a disconnected-graph problem), not this schema mismatch. The fixture has been silently non-functional for its stated purpose since it was first authored, and a previous fix pass didn't catch it because `validate-workflow` doesn't inspect node-type-specific config at all (see the note at the end of this entry).
- **Fix implemented:** rewrote the switch node to the real schema — `cases: [{ id: 'c-germany', value: 'germany', label: '...' }, { id: 'c-japan', value: 'japan', label: '...' }]` — and gave each branch edge the matching `sourceHandle` (`case-c-germany`, `case-c-japan`, `default`). Also decoupled the branch **decision** from the dead API entirely: `expression` now reads `"{{country}}"` directly instead of the HTTP response, so the demo no longer depends on any third-party API's response shape or uptime for its core teaching point (that `--var` changes which branch executes). The `Lookup Country` HTTP call is kept (still demonstrates a real HTTP request with `{{country}}` substituted into the URL) but its response is no longer load-bearing for routing. The three now-dead `restcountries.com/v3.1/subregion/...` branch-target URLs were replaced with working `jsonplaceholder.typicode.com/users/{id}` calls.
- **Verification (real, all three paths):** `--var country=germany` → `Per-Step Metrics: Lookup Country, European Country` (2 steps); `--var country=japan` → `Lookup Country, Asian Country`; no override (default `country: france`) → `Lookup Country, Other Region`. All three: `Passed: 2/2, Error Rate: 0%, Result: PASSED ✅`. `validate-workflow` on the fixed file: `✅ Valid workflow`, `Nodes: 7 total, 4 HTTP`, `Edges: 8`.
- **Related gap, not fixed:** `validate-workflow` only reports structural counts (node/edge/variable counts) — it does not check that Switch/Condition node case IDs actually have matching outgoing edges, so a fixture like this one would pass `validate-workflow` cleanly while being completely non-functional at runtime. Worth a future `validate-workflow` enhancement (warn on switch/condition nodes with no matching edge for a case or no `default` edge) — out of scope for this pass, noted here for the team.
- **Where this landed in the plan:** [CLI-9 Step 3](#cli-9-workflow-performance-testing) (`--var name=value`) — the step now demonstrates real, verified branch changes instead of what would have been a silently-broken demo.

### BUG-9 (Low, CLI-only — found while building CLI-9): `--trace-level` had no observable effect anywhere in the CLI — ✅ FIXED

- **Repro:** `npx tsx cli/index.ts workflow examples/workflow-cli-sample.yaml -i 3 -c 1 --trace-level full -o out.json` vs. the same command with `--trace-level` omitted entirely (defaults to `standard`).
- **Expected:** some visible difference in output — richer per-node trace data in the JSON report, or a way to export it, proportional to the deeper capture level requested.
- **Actual (before fix):** byte-for-byte identical set of fields in every `results[]` entry of the JSON report between `standard` and `full` — no trace data appeared anywhere in console output, the JSON report, JUnit, or Markdown, at any trace level.
- **Root cause:** `cli/index.ts`'s `workflow` action validates `--trace-level`, builds `traceOptions: { captureFullTrace, traceLevel }`, and passes it into `runGraphLoad(workflow, { ...traceOptions })` — but the call site was `const { results } = await runGraphLoad(...)`, destructuring **only** `results` and discarding the second element of the return tuple, `trace: WorkflowExecutionTrace` (the same rich per-node/per-iteration trace structure that powers the GUI's Results Explorer visual replay and heatmap). The flag was fully validated and threaded through the engine correctly — it was the CLI's own output layer that never surfaced the result.
- **Fix implemented:** added a new `--trace-output <path>` flag to the `workflow` command, following the exact same pattern as `-o`/`--junit`/`--markdown`. The action now destructures `const { results, trace } = await runGraphLoad(...)`, and writes `JSON.stringify(trace, null, 2)` to the given path when the flag is present, printing a `Trace:       <path>` confirmation line alongside the other report lines.
- **Verification:** real run with `--trace-level full --trace-output trace.json` produced a fully populated `WorkflowExecutionTrace` — `captureLevel: 'full'`, `fullTraceCaptured: true`, every HTTP node's event carrying a populated `details.request`/`details.response` (method, url, headers, resolved body, status, response body). The same run **without** `--trace-level` (default `standard`) confirmed `captureLevel: 'standard'`, `fullTraceCaptured: false`, and `details.request`/`details.response` both absent — a genuine, verified difference between levels. Omitting `--trace-output` entirely still behaves exactly as before (no file written, no error). Full `cli/` suite: 325 passed, same 1 pre-existing unrelated flake. No lint/type errors.
- **Where this landed in the plan:** [CLI-9 Step 5](#cli-9-workflow-performance-testing) now demonstrates `--trace-level`/`--trace-output` with real, verified output instead of documenting it as an inert flag.

---

### BUG-10 (High, desktop `--cli` mode only — found while building CLI-11): the Rust CLI wrapper had drifted far out of parity with the npm CLI — ✅ FIXED

- **Repro:** diff the option list of `cli/index.ts`'s `run`/`workflow` Commander commands against the fields on `src-tauri/src/main.rs`'s `Commands::Run`/`Commands::Workflow` enum variants.
- **Expected (per this lesson's original Step 3 draft, "Full Option Parity"):** every flag the npm CLI accepts, the desktop `--cli` wrapper accepts too, since it's meant to be a drop-in alternative.
- **Actual (before fix):** `Commands::Run` was missing `--scenario-tags`/`--scenario-tag-mode` (scenario-level tag filtering, distinct from row-level `--tags`), **all of CLI-7's SLA gating** (`--sla-config`/`--fail-on-sla`), and **all of CLI-8's baseline/regression detection** (`--save-baseline`/`--baseline-label`/`--compare-baseline`/`--fail-on-regression`/`--baselines-dir`/`--comparison-report`) — 10 flags entirely absent. `Commands::Workflow` was missing `--base-url`, and (unsurprisingly, since it was added in this same research pass) `--trace-level`/`--trace-output`. Attempting any of these through `--cli` would fail with clap's "unexpected argument" error — not silently ignored, but a hard block on two entire feature areas (SLA gates, baseline regression) from the desktop app's CLI mode.
- **Root cause:** the Rust wrapper is a hand-maintained parallel option list (`#[derive(Subcommand)]` structs + a manual `build_cli_args()` mapping function) that has to be updated by hand every time `cli/index.ts` gains a new flag — there's no shared source of truth or generation step between the two, so it silently drifts whenever one side changes without the other.
- **Fix implemented:** added the 10 missing fields to `Commands::Run` and the 3 missing fields to `Commands::Workflow`, plus their corresponding `build_cli_args()` mappings (each following the exact same `if let Some(x) = field { args.extend(["--flag".to_string(), x.clone()]); }` / `if *flag { args.push("--flag".to_string()); }` pattern already used for every other option).
- **Verification (real, compiled binary — not just a code read):** `cargo check --bin redfireforge` and `cargo build --bin redfireforge` both succeed cleanly (binary target name is `redfireforge`, not `redfire-forge`). Built a real `dist-cli/redfireforge.mjs` via `npm run build:cli` and copied it to `cli/dist/redfireforge.mjs` (the dev-mode fallback path `get_cli_script_path()` resolves to) so the compiled binary could actually shell out to real code. Ran the compiled binary directly:
  - `./src-tauri/target/debug/redfireforge --cli run examples/sla-jsonplaceholder-test.yaml --sla-config examples/sla-jsonplaceholder-targets.json --fail-on-sla -q` → produced the full SLA report (`✗ Create Post TPS ... 9.7req/s (target: >= 100req/s)`) and exited **4**, identical to the npm CLI.
  - `./src-tauri/target/debug/redfireforge --cli workflow examples/workflow-cli-sample.yaml --trace-level full --trace-output <path>` → wrote a trace file with `captureLevel: "full"`, `fullTraceCaptured: true`.
  - `./src-tauri/target/debug/redfireforge --cli run examples/cli-basic-test.yaml --scenario-tags smoke -q` → correctly filtered to smoke-tagged scenarios.
  - `cargo clippy --bin redfireforge` reports zero findings in `main.rs` itself (a pre-existing, unrelated deny-level clippy error exists in the separate `redfireforge` **lib** crate — confirmed unrelated to this change, not touched).
- **Not fixed, separately confirmed and left as a known, self-documenting gap:** the `mock` command family has **no** Rust `Commands` variant at all — `--cli mock ...` isn't a recognized subcommand. Unlike the flags above, this isn't silent drift; clap reports it immediately as an invalid subcommand. Adding full `mock simulate`/`verify`/`start` parity is a larger feature addition (a new subcommand + its own ~15 options) than this pass's mechanical flag-parity fixes, so it's left as CLI-11 Step 4's documented limitation rather than fixed here.
- **Where this landed in the plan:** [CLI-11 Step 3](#cli-11-desktop-app-cli-mode) now demonstrates genuine, verified full parity for `run`/`workflow`/`validate` (including SLA and baseline flags, which were previously impossible through `--cli`); [CLI-11 Step 4](#cli-11-desktop-app-cli-mode) still documents the separate, unfixed `mock` gap.

---

### NOTE-5 (Medium, local dev machines only — found while discussing CLI-11 with the team): `redfireforge` command name collision between the npm package and the desktop installer — ✅ FIXED

- **Repro:** install the desktop app (creates `/usr/local/bin/redfireforge` → Tauri GUI binary, `--cli` for CLI mode) **and** separately run `npm install -g redfireforge-cli` (creates its own `redfireforge` → the CLI binary directly, no `--cli` needed) on the same machine.
- **Observed:** whichever install wins `$PATH` resolution silently determines what bare `redfireforge` does — opens a GUI window, or runs the CLI — with no warning either way. Also confirmed two separate, real facts while researching this: (1) `redfireforge-cli` has never actually been published — `https://registry.npmjs.org/redfireforge-cli` returns a real **404** as of this session; (2) `scripts/version.sh` never updated `cli/package.json`'s version (only `.github/workflows/publish-cli.yml`'s "Sync version" step did, and only at actual publish time — which has never run for a real release per finding (1)).
- **Why this doesn't matter for CI/CD:** a pipeline never installs the desktop app, so there's no collision risk there — confirmed this is purely a local end-user/developer-machine concern.
- **Prior art considered:** Postman/`newman` and Insomnia/`inso` both give their CLI a distinct short name from their GUI app, avoiding the collision entirely rather than managing PATH priority between two things sharing a name.
- **Fix implemented:**
  - `cli/package.json`'s `bin` now exposes both `redfireforge` and a new **`rff`** alias (same file) — `rff` is never claimed by the desktop installer, so it's always unambiguous.
  - `src-tauri/src/main.rs` gained `invoked_as_rff()` (checks argv[0]'s basename) — invoking the Tauri binary as `rff` defaults straight into CLI mode, no `--cli` needed. Bare `redfireforge` is untouched — still opens the GUI exactly as before.
  - macOS/Linux `postinstall.sh`/`preremove.sh` now also symlink/remove `rff` alongside `redfireforge`.
  - Windows: added `src-tauri/installer/windows/rff.cmd` (a shim hardcoding `--cli`, since argv0 detection doesn't survive a `.cmd`→`.exe` hop on Windows) plus a WiX `<Component>`/`<File>` entry in `main.wxs`.
  - `scripts/version.sh` now also syncs `cli/package.json`'s version on every bump, closing the gap that let it drift between actual publishes.
  - `docs/guides/cli-ci-cd.md` fixed: most of its own CI platform examples (GitLab, Jenkins, Azure DevOps, CircleCI, Best Practices) defaulted to the heavy source-repo form (`npx tsx cli/index.ts`, requires cloning this whole monorepo) instead of the guide's own "Recommended" npm-package form — added a clear substitution rule at Quick Start plus a one-line reminder at each section that only showed the source-repo form.
- **Incidental find, unrelated to this fix but caught while touching the same file:** `src-tauri/installer/windows/main.wxs`'s XML comments already contained a literal `--` (from `--cli`) — invalid per the XML spec (`<!-- ... -- ... -->` is malformed). Confirmed via `git show HEAD:src-tauri/installer/windows/main.wxs` that this predates any change in this session. Fixed using a non-breaking hyphen (U+2011, visually identical) instead of ASCII `--` inside comments.
- **Verification:** compiled the real Tauri binary and symlinked it as `rff` — `rff run examples/cli-basic-test.yaml -q` ran the real CLI end-to-end (`Result: PASSED ✅`) with no `--cli` flag; confirmed bare `redfireforge` (no symlink, no flag) still launches the GUI (MCP bridge/WebSocket server start-up observed), zero regression. All 4 installer shell scripts functionally tested in sandboxed temp directories (not just `bash -n`), not just syntax-checked. `main.wxs` confirmed well-formed XML via `python3 -m xml.dom.minidom` (could not build a real MSI — no Windows/WiX toolset in this environment). `scripts/version.sh` verified with a real test bump (`patch --pre 99`) confirming `cli/package.json` synced correctly, then reverted. `cargo check --bin redfireforge` clean throughout.
- **Not done (explicitly deferred, noted for the team):** actually publishing `redfireforge-cli` to the real npm registry — requires real npm credentials/publishing rights, left as a maintainer action. Noted directly in `.github/workflows/publish-cli.yml`'s header comment for future reference.
- **Where this landed in the plan:** [CLI-11](#cli-11-desktop-app-cli-mode)'s Concept Slide and Step 1/3 now reference `rff` as the short, collision-free alternative to both `redfireforge --cli` and `npx tsx cli/index.ts`.

---

### BUG-1 (High): `examples/cli-parameterized.yaml` and `examples/parameterized-users.yaml` are non-functional as shipped — ✅ FIXED

- **Repro:** `npx tsx cli/index.ts run examples/cli-parameterized.yaml`
- **Expected:** 6 data rows run against `GET /users/{{id}}`, per the file's own header comment ("Demonstrates data-driven testing with inline data source").
- **Actual (before fix):** `Tests: 1` (not 6), and the single executed request's URL is the literal unresolved string `https://jsonplaceholder.typicode.com/users/{{id}}` — guaranteed 404/validation failure. Confirmed the same root cause affects `examples/parameterized-users.yaml`.
- **Root cause:** both files declare their data under a `dataSource:` key (columns with `id`/`name`/`type`/`mapping`, rows with `id`/`values`/`tags` — the GUI-native schema). `cli/loader.ts`'s `TestFileScenario` interface had no `dataSource` field at all — the CLI loader only read a compact `data: { columns, rows }` shorthand (consumed by `cli/dataLoader.ts`'s `buildDataSourceFromInline`). The `dataSource:` block was silently ignored rather than erroring, which is why `validate` reported the file as "valid" despite it not doing what it claimed.
- **Fix implemented:** option (b) — `cli/loader.ts` now accepts a native `dataSource:` block directly. Added `dataSource?: Record<string, unknown>` to `TestFileScenario`, plus `buildDataSourceFromNative()` (with `toNativeDataSourceColumn`/`toNativeDataSourceRow` helpers) that validates structure, auto-generates missing `id`s, accepts row `values` keyed by column **id or name** (friendlier for hand-authored files than requiring opaque ids), normalizes row `tags` (lowercase/trim, matching the existing scenario-tag convention), and preserves `label`/`note`/`enabled`. Priority order in `buildScenarios`: `--data` CLI flag → native `dataSource:` → compact `data:` shorthand.
- **Verification (real, not just unit tests):**
  - `cli/loader.test.ts`: 17 new tests (schema shape, id/name value lookup, id generation, `enabled` defaults, label/note preservation, priority ordering vs. both `externalDataSource` and `data:`, and 5 clear-error cases for malformed input) — all 46 tests in the file pass.
  - `examples/cli-parameterized.yaml` real run: `validate` now reports `[6 data rows]` (was silently 0); `run` now shows `Total: 36, Passed: 36, Result: PASSED ✅, Data Rows: 36 total, 36 passed, 0 failed` (was `Total: 1, Failed HTTP: 1`).
  - `examples/parameterized-users.yaml` real run: `Total: 25, Passed: 25, Data Rows: 25 total, 25 passed, 0 failed`.
  - **Bonus, verified side effect:** since native `DataSourceRow.tags` now actually gets populated, row-level `--tags`/`--tag-mode` filtering (BUG-2) now genuinely works for inline `dataSource:` files — real runs confirmed `--tags smoke` correctly matched 2/6 rows and `--tags critical,regression --tag-mode any` matched 5/6 rows against `cli-parameterized.yaml`'s real tags. (BUG-2's remaining CSV half and the empty-filter-skip behavior were fixed in a follow-up pass — see BUG-2/BUG-3 below.)
  - Full `cli/` suite: 300 passed, 1 unrelated pre-existing failure (`cli/mockCommands.test.ts`, a time-based flaky assertion — confirmed it fails identically on the pre-fix code via `git stash`, unrelated to this change).
  - `tsc`/eslint: no errors on `cli/loader.ts` or `cli/loader.test.ts`. (Aside, not fixed here since out of scope: `cli/*.ts` imports types from `../src/types`, a path that doesn't actually exist on disk — harmless today only because these are `import type`-only, erased by `tsx`/esbuild before resolution, and because `cli/` isn't included in any `tsc -b` project reference. Worth its own cleanup pass since it would break under real type-checking.)
- **Follow-up hardening (found during a full 10-bug re-review):** `toNativeDataSourceColumn()` originally defaulted a missing `mapping` to the column's `name` for *every* column type, including `validate`. That's fine for `path`/`param`/`body`/`header` (where `mapping` is a variable name, reasonably same as `name`), but for `validate` columns `mapping` **is the JSONPath** the engine matches against (`col.mapping` is used directly as `ExpectedField.jsonPath` in `dataSourceExpander.ts`) — defaulting it to a human-readable name like `"expectedName"` would silently produce a bogus JSONPath that never matches anything, the exact same "looks configured, silently does nothing" failure mode as BUG-5/BUG-6. Fixed: a `validate`-type column with no `mapping` now throws a clear error (`must specify a "mapping" (JSONPath...)`) instead of silently defaulting. New test added; all 3 committed fixtures already specified `mapping` explicitly and are unaffected. Full suite: 1995 passed (up from 1994), same 1 pre-existing unrelated flake.
- **Where this landed in the plan:** [CLI-5 Step 1](#step-1--cli5-inline-datasource-inline-data--the-schema-that-actually-works) originally demonstrated the failure using a one-off workaround file — now updated to use the real, now-fixed `examples/cli-parameterized.yaml` directly, with the bug history kept as context.

### BUG-2 (High): Row-level `--tags`/`--tag-mode` had no working implementation — ✅ FIXED

- **Repro:** any data-driven file, `run <file> --tags <any-tag>`
- **Expected:** rows tagged with a matching value run; others are skipped.
- **Actual (original):** every row was filtered out unconditionally, for every fixture shape tested — inline `data:` shorthand rows, external `--data <csv>` rows, and (moot, since it was unreadable per BUG-1) `dataSource:` rows. Worse: instead of skipping a test whose row-set became empty, the CLI still executes it once, unparameterized, producing an unrelated failure that looks like a different bug entirely.
- **Fix implemented:**
  - CSV/JSON `_tags` (+ `_label`/`_note`/`_enabled`) parsing added to `cli/dataLoader.ts::loadDataFile` (same change as BUG-3 below — one function, one fix).
  - Extracted the row-tag-filtering logic out of `cli/index.ts`'s monolithic `run` action into a new, independently testable module: `cli/tagFilter.ts` (`parseTagFilter`, `filterScenariosByRowTags`). This was necessary because `cli/index.ts` has **zero existing test coverage** — pulling the pure logic into its own module let this be properly unit-tested without mocking Commander/process/network.
  - `filterScenariosByRowTags` now **drops a scenario entirely** when every one of its rows is filtered out by `--tags`, instead of falling through to a single unparameterized execution. Scenarios with no data source (or an already-empty one) are left untouched — `--tags` only applies to data-driven tests, matching prior behavior.
  - `cli/index.ts`'s `run` action now reports which scenarios were dropped and exits 1 with a clear `❌ No data rows match the specified tags.` message if *every* scenario ends up dropped — mirroring the existing `--scenario-tags` zero-match UX precedent.
  - **Deliberately not changed:** `src/engine/dataSourceExpander.ts::expandDataSource` — its own "return `[scenario]` when 0 enabled rows" fallback is a **shared engine function also used by the GUI Test Runner**. Changing it there would affect GUI behavior (e.g. a user who manually disables every data row to smoke-test just the endpoint) — out of scope for a CLI-specific bug. The fix stays entirely within the CLI's own filtering step, which now removes affected scenarios *before* they ever reach the shared engine.
- **Verification (real, not just unit tests):**
  - `cli/tagFilter.test.ts`: 10 new tests (no-op on non-data-driven scenarios, filter modes any/all, rows-with-no-tags excluded, scenario dropped on zero matches, mixed keep/drop in one run, no mutation of original objects).
  - `cli/dataLoader.test.ts`: 7 new tests for `_tags`/`_label`/`_note`/`_enabled` (see BUG-3).
  - Real run: `run examples/parameterized-users.yaml --data examples/users-data.csv --tags smoke` now correctly narrows to 2/5 rows, and the resulting request URLs are clean (`?userId=1&name=Alice`, no more `_tags=`/`_label=`/`_note=` leaking through).
  - Real run: a 2-test fixture where one test's rows all get filtered out — confirmed console output `Tags: smoke (mode: any, 1 matching rows, 1/2 scenarios retained)` + `Dropped: No Smoke Rows (no rows matched the tag filter)`, and the run only executes 1 request total (the surviving scenario), not 2 (one real + one broken unparameterized execution as before).
  - Real run: every scenario's rows filtered to zero — confirmed `❌ No data rows match the specified tags.` and exit code **1**.
  - Real run: `--tags` against a fully non-parameterized file (`cli-basic-test.yaml`) — confirmed no-op, all 3 tests still ran normally.
  - Full `cli/` suite: 317 passed (up from 300 pre-fix), same 1 unrelated pre-existing flaky failure in `cli/mockCommands.test.ts`.
- **Where this landed in the plan:** [CLI-5 Step 4](#step-4--cli5-row-tags--now-fixed-everywhere) demonstrates both the fixed CSV filtering and the new drop-scenario-on-empty behavior.

### BUG-3 (Medium): `examples/README.md`'s CSV column-prefix table didn't apply to the CLI — ✅ FIXED

- **Repro:** `run <file> --data examples/users-data.csv` against a test hitting `https://httpbin.org/get`, then inspect the actual request URL in the JSON report.
- **Expected (per `examples/README.md`):** `_tags`, `_label`, `_note`, `_enabled` are special columns with CLI-recognized meaning (row tagging, labeling, annotation, enable/disable).
- **Actual (before fix):** all four leaked straight through as literal query parameters — a captured real request was `https://httpbin.org/get?userId=1&name=Alice&_tags=smoke%3Bcritical&_label=happy-path&_note=Standard+user+lookup`.
- **Root cause:** the documented convention was real, but only implemented in the **GUI's** CSV/JSON import wizard, not the standalone CLI's `--data` loader.
- **Fix implemented:** `cli/dataLoader.ts::loadDataFile` now recognizes `_tags` (semicolon-split, lowercased, trimmed → `row.tags`), `_label` (→ `row.label`, falls back to `Row N` when blank), `_note` (→ `row.note`), and `_enabled` (`"false"` case-insensitive → `row.enabled = false`, anything else/missing → `true`). All four are excluded from the generated `columns` list so they never leak into requests as params.
- **Verification:** `cli/dataLoader.test.ts` — 7 new tests covering exclusion from columns, tag parsing/normalization, empty-tags-is-undefined, label override/fallback, note mapping, and enabled true/false/missing. Real run confirmed the request URL leak is gone (see BUG-2's verification above, same fixture/run).
- **Where this landed in the plan:** [CLI-5 Step 2](#step-2--cli5-external-csv-the-external---data-file) now shows the clean request URL and the bug's history as context, rather than an open gap.

### NOTE-1 (Low): `--fail-threshold`'s explanation was silent under `-q` — ✅ FIXED

- **Repro:** `run examples/cli-error-handling.yaml --fail-threshold 5 --fail-on-error` vs. the same command with `-q` appended.
- **Observed (before fix):** without `-q`, the CLI printed `Error rate 20% exceeds threshold 5%` before exiting 1. With `-q` (matching the fixture's own documented CI example, and how most real pipelines invoke it), that line was suppressed — only the exit code communicated the failure.
- **Decision:** the team decided this line should always print, regardless of `-q` — it's the one explanation for an otherwise-bare non-zero exit, and suppressing it under the exact flag combination most CI pipelines use was a real trap.
- **Fix implemented:** removed the `!opts.quiet` guard around the `console.log` in both the `run` and `workflow` commands in `cli/index.ts` (`--fail-threshold` applies to both).
- **Verification:** real run of `run examples/cli-error-handling.yaml --fail-threshold 5 --fail-on-error -q` now prints `Error rate 20% exceeds threshold 5%` and exits 1 (previously silent under `-q`).
- **Where this landed in the plan:** [CLI-4 Step 5](#step-5--cli4-fail-threshold---fail-threshold-pct) should be updated to show the message now printing under `-q` too.

### NOTE-2 (Low): `sequential` mode's header showed a `C:` value it didn't use — ✅ FIXED

- **Repro:** any file with a `config.concurrency` set (e.g. `examples/cli-load-profile.yaml`, `concurrency: 5`), `run <file> -m sequential`.
- **Observed (before fix):** header printed `Mode: sequential (C:5 I:3)` — `sequential` mode processes one request at a time regardless of concurrency, so `C:5` was never actually honored, just echoed from config.
- **Fix implemented:** added `displayConcurrency(config)` helper in `cli/reporters.ts` — returns `1` when `executionMode === 'sequential'`, otherwise the real configured concurrency. Applied to both `printConsoleSummary` (console header) and `buildMarkdownReport` (Markdown report) for consistency; the `workflow` command's reporters were left untouched since `workflow` has no `-m`/execution-mode flag at all.
- **Verification:** 4 new tests (2 console, 2 markdown) confirming `C:1`/`Concurrency: 1` for `sequential` and the real value for other modes; real run of `run examples/cli-load-profile.yaml -m sequential -i 3` now shows `Mode:         sequential (C:1 I:3)`. Checked `cli/reporters.console.test.ts`/`cli/reporters.markdown.test.ts` beforehand — no existing test asserted the old (misleading) string, so no golden-output breakage.
- **Where this landed in the plan:** [CLI-3 Step 2](#step-2--cli3-sequential-sequential-mode) should be updated — the "real gotcha" callout there is now resolved.

---

### NOTE-3 (Low): `--fail-on-sla`'s report was silent under `-q`, and one shipped SLA target was flaky — ✅ FULLY FIXED

- **Repro (silent report):** `run examples/sla-jsonplaceholder-test.yaml --sla-config <targets> --fail-on-sla -q` against a config with a guaranteed SLA violation.
- **Observed (before fix):** exited **4** correctly, but with `-q` the entire SLA report — including which target failed and by how much — was suppressed. The console summary still showed `Result: PASSED ✅` (functional correctness is unaffected), so a quiet CI log showed a passing test summary and a bare exit code 4, with nothing indicating which SLA target tripped it. Same shape of issue as NOTE-1's original `--fail-threshold` gap.
- **Fix implemented (silent report):** in `cli/index.ts`, `hasSlaFail` is now computed *before* calling `printSlaReport`, and the report's own `quiet` flag is overridden to `false` whenever the run is actually about to exit non-zero because of it (`(opts.quiet as boolean) && !hasSlaFail`) — mirrors NOTE-1's exact pattern. A plain `-q` run with an SLA violation but **no** `--fail-on-sla` still correctly stays silent (verified — quiet mode is only overridden when it would otherwise hide the reason for a non-zero exit). Updated `printSlaReport`'s doc comment in `cli/slaEval.ts` to describe the caller's responsibility precisely.
- **Repro (flaky target):** `run examples/sla-jsonplaceholder-test.yaml --sla-config examples/sla-jsonplaceholder-targets.json -m sequential --timeout 30` run repeatedly.
- **Observed (before fix):** the `create-post-tps` target (`>= 10 req/s`) measured `5.3`, `10.1`, `16+`, `19.0` req/s across separate real runs — flipping between pass and fail purely from live network timing. Root cause: with the fixture's `iterations: 1`, a single scenario's TPS is really `1000 / responseTimeMs`, a one-sample rate whose threshold happened to sit right in the noisy zone of realistic single-request latency (other targets' thresholds had comfortable margins and never got close to flipping).
- **Fix implemented (flaky target):** raised `create-post-tps`'s `value` from `10` to `100` req/s in `examples/sla-jsonplaceholder-targets.json` — unreachable over any real HTTPS round-trip (would require sub-10ms latency), so it now **deterministically fails every run** rather than flipping. Added an explanatory comment to the sibling `examples/sla-jsonplaceholder-test.yaml`'s header (JSON itself can't hold comments) documenting why. This preserves the fixture's stated "mix of passing and failing targets" purpose, just reproducibly.
- **Verification:** real run of `--fail-on-sla -q` against the real, unmodified fixture now prints the full SLA report and exits 4; plain `-q` (no `--fail-on-sla`) still suppresses the report and exits 0. The retuned TPS target confirmed failing across 4 separate real runs (17.0/17.3/18.4/18.9 req/s, all below the new 100 req/s floor) — zero flips. Full `cli/` suite: 321 passed, same 1 pre-existing unrelated flake. No lint/type errors.
- **Where this landed in the plan:** [CLI-7 Step 2](#step-2--cli7-run-with-sla---sla-config) now shows the deterministic violation directly from the real committed fixture (no more "sometimes passes" caveat); [CLI-7 Step 4](#step-4--cli7-fail-on-sla---fail-on-sla) now runs `--fail-on-sla` against the real fixture too (no temp workaround file needed for the pass/fail half — only Step 3's `warnAt` demo still needs one, since no committed target defines a warn threshold).

---

### NOTE-4 (Low, by design — found while building CLI-10): `mock verify`'s live-journal mode cannot read a `--standalone` listener's journal

- **Repro:** `mock start examples/api-mock/sample-workspace.json --standalone` (background), hit `/health`, then `mock verify examples/api-mock/sample-workspace.json --min-calls 1` (no `--simulate`) against the still-running standalone listener.
- **Observed:** immediate failure — `Live journal verify failed: fetch failed — start the companion with \`npm run server:dev\`, or pass --simulate for offline corpus checks.` — not a partial or misleading result, a clean, correctly-worded error.
- **Root cause:** `runMockVerify`'s live-journal path (`cli/mockCommands.ts`) always calls `cliFetchJournal({ controlBase: opts.controlBase ?? 'http://127.0.0.1:3001', ... })` — it only ever reads the journal via the **companion** process's HTTP control API. `mock start --standalone` runs the mock entirely in-process with **no control API surface at all** (by design — it's meant for isolated CI containers, not to be queried from a second CLI invocation). The project's own `docs/guides/api-mock/cli-and-ci.md` already documents these as two separate flows ("Live journal asserts (companion + running mock)" vs. "Force in-process (Docker/CI)") — the demo plan's original Step 5 draft just conflated them.
- **Not a code bug — no fix needed:** the CLI's behavior and error message are already correct and self-explanatory. This is purely a lesson-content correction.
- **Fix implemented:** CLI-10 Step 5 now uses `mock start` **without** `--standalone` (companion mode, backed by the project's real `npm run server:dev` webhook/schedule server) instead of reusing Step 3's standalone listener. The standalone-vs-companion distinction is called out explicitly in the step's narration as a real, verified gotcha.
- **Verification:** real run confirmed the failure against a standalone listener exactly as described above; real run against a companion-started mock (`mode: "companion"` in the start output) confirmed `mock verify` then succeeds: `"mode": "live-journal", "passed": true, "matchingCount": 1`.
- **Where this landed in the plan:** [CLI-10 Step 5](#cli-10-api-mock-studio-headless) now uses companion mode and narrates the standalone/companion distinction directly.

---

### BUG-4 (Medium, latent — found while implementing BUG-1): every `cli/*.ts` type import points at a module that doesn't exist — ✅ FIXED

- **Repro:** `grep -rn "from '\.\./src/types'" cli/` — 8 matches across 6 files (`cli/loader.ts`, `cli/dataLoader.ts`, `cli/index.ts` ×2, `cli/baselineStorage.ts`, `cli/baselineStorage.test.ts`, `cli/reporters.ts`, `cli/reporters.comparison.test.ts`, `cli/reporters.test.utils.ts`). Confirmed `src/types.ts` and `src/types/index.ts` **do not exist** — `src/types/` on disk only contains two unrelated `.d.ts` ambient declaration files (`oas-validator.d.ts`, `swagger2openapi.d.ts`).
- **Why it was invisible:** every one of the 9 imports is `import type { ... }` — TypeScript's type-only imports are completely erased by `tsx`/esbuild before module resolution ever happens at runtime, so `npx tsx cli/index.ts ...` never fails. And `cli/` is excluded from every `tsc -b` project reference in the repo (`tsconfig.app.json` only includes `["src", "packages/demo-hub/src"]`) — so it's never caught by a real type-check either. The bug is latent: harmless today, but breaks the moment anyone (a) points a proper `tsc --noEmit` at `cli/`, (b) adds `cli/` to a tsconfig project, or (c) has an editor language server try to resolve these types for hover/autocomplete/refactor support.
- **Root cause:** the actual types (`Scenario`, `TestConfig`, `DataSource`, `RequestResult`, `TestSummary`, `TestRun`, etc.) all live in `src/shared/types/index.ts` (a barrel that also re-exports `./runner-config`, `./kafka`, `./grpc-harness`, etc.). The `cli/*.ts` imports were written against a stale path — likely from before `src/types.ts` was reorganized into `src/shared/types/`.
- **Fix implemented:** mechanically corrected all 8 import specifiers from `'../src/types'` to `'../src/shared/types'` across the 6 files. Purely a path change — every named type import (`DataSource`, `Scenario`, `TestConfig`, etc.) is exported from the same barrel, confirmed via grep before changing anything.
- **Verification:** full `cli/` test suite re-run after the change — same pass count as before the fix (the one pre-existing unrelated flaky test in `cli/mockCommands.test.ts` aside), confirming the path correction didn't alter any runtime behavior (as expected for type-only imports). No lint/type errors on any of the 6 changed files.

---

## Lesson Summary

| # | ID | Title | Steps | Est. Time | Key Features Covered |
|---|---|---|---|---|---|
| CLI-1 | `cli-quick-start` | Install & Your First Run | 5 | 5 min | 3 install methods, `redfireforge run`, console summary, exit codes 0/1/2 |
| CLI-2 | `cli-validate-authoring` | Validate Before You Run | 5 | 5 min | Test file YAML anatomy, `validate`, `validate-workflow`, catching a broken file, scenario/tag summary output |
| CLI-3 | `cli-execution-modes` | Execution Modes & Concurrency | 6 | 6 min | `-c`/`-i`, `sequential`/`batch`/`pool`/`load-profile`, `--duration`, `--timeout`, `--retries`/`--retry-delay` |
| CLI-4 | `cli-error-policies` | Error Policies & CI Gating | 5 | 5 min | `--error-policy`, `--max-errors`/`--max-error-rate`, `--fail-on-error`, `--fail-threshold`, exit code 1 |
| CLI-5 | `cli-data-driven` | Data-Driven Testing — What Actually Works | 6 | 6 min | Native `dataSource:` schema (✅ fixed, BUG-1), `--data` (CSV/JSON, verified working, `_tags`/`_label`/`_note`/`_enabled` ✅ fixed — BUG-2/BUG-3), `--scenario`, `--scenario-tags`/`--scenario-tag-mode` (verified working), `--tags`/`--tag-mode` (✅ fully fixed — inline and CSV, plus empty-filter scenarios are now dropped instead of running once unparameterized), `--data-rows-summary` |
| CLI-6 | `cli-reports-ci` | Reports & CI/CD Integration | 6 | 6 min | `-o`/`--junit`/`--markdown`/`--data-rows-summary`, `-q`, GitHub Actions snippet, artifact upload |
| CLI-7 | `cli-sla-gates` | SLA Targets as Quality Gates | 5 | 5 min | `SlaTarget[]` JSON shape, `--sla-config`, `--fail-on-sla`, exit code 4, pass/warn/fail report |
| CLI-8 | `cli-baseline-regression` | Baselines & Regression Detection | 6 | 6 min | `--save-baseline`/`--baseline-label`, `--compare-baseline latest-baseline`, `--fail-on-regression`, `--comparison-report`, exit codes 2/3 |
| CLI-9 | `cli-workflow-command` | Workflow Performance Testing | 5 | 5 min | `workflow <file>`, `--var`, `--trace-level`/`--trace-output`, iterations vs. concurrency, workflow JUnit/Markdown reports |
| CLI-10 | `cli-mock-studio` | API Mock Studio, Headless | 6 | 7 min | `mock simulate`, `mock verify` (live + `--simulate`), `mock start --standalone`, Docker image, health check |
| CLI-11 | `cli-desktop-parity` | Desktop App CLI Mode | 4 | 4 min | `--cli` flag, `rff` short alias (collision-free vs. the npm package), symlink/PATH install, full option parity for run/workflow/validate, **`mock` gap** |
| **Total** | | | **59** | **~60 min** | |

---

## Prerequisite: Fixtures — Already Exist, No Authoring Needed

**Correction from the first draft:** it invented a new `examples/cli/*` fixture set. The repo already ships a purpose-built, usage-annotated CLI fixture set in `examples/` (each file's header comment documents the exact flags to demo it with) — every lesson below should point at these real files instead:

| Fixture | Used by | Notes |
|---|---|---|
| `examples/cli-basic-test.yaml` | CLI-1, CLI-2, CLI-6 | `tags: [smoke, critical, regression]` per test, JSONPlaceholder-backed |
| `examples/cli-assertions.yaml` | CLI-2, CLI-6 | Assertion-type showcase (`status`, `jsonPath exists`, etc.) |
| `examples/cli-error-handling.yaml` | CLI-4 | Includes a deliberate 404 (`/users/99999`) for error-policy demos |
| `examples/cli-load-profile.yaml` | CLI-3 | `config: { concurrency: 5, mode: pool }` defaults, built for mode comparisons |
| `examples/cli-parameterized.yaml` | CLI-5 | Declares `dataSource:` (GUI-native schema, per-row tags). **Was broken** — the CLI loader only recognized a `data:` shorthand, so this ran as `Tests: 1` with an unresolved `{{id}}` in the URL. **Fixed** in `cli/loader.ts` (BUG-1) — now runs all 6 real rows, and its row tags (`smoke`/`critical`/`regression`/`boundary`) now genuinely drive `--tags` filtering. |
| `examples/users-data.csv` + `examples/parameterized-users.yaml` | CLI-5 (external-file variant) | `parameterized-users.yaml`'s own `dataSource:` block is likewise now readable directly (BUG-1 fix), but this pairing still demonstrates the external `--data <csv>` path. `_tags`/`_label`/`_note`/`_enabled` used to leak through as literal query params instead of being interpreted as row metadata (contradicted `examples/README.md`'s column-prefix table) — **fixed** in `cli/dataLoader.ts` (BUG-2/BUG-3); row filtering and labels/notes now work as documented. |
| `examples/sla-jsonplaceholder-test.yaml` + `examples/sla-jsonplaceholder-targets.json` | CLI-7 | Already has `featureGroup`/`scenario` hierarchy and a realistic mixed pass/warn/fail `SlaTarget[]` |
| `examples/workflow-cli-sample.yaml`, `workflow-cli-conditional.yaml` (`--var country=...`), `workflow-cli-parallel.yaml` (fork/join) | CLI-9 | `workflow-cli-conditional.yaml` **was broken** — its Switch node used a fictional schema (`cases[].targetNodeId`, node-level `defaultTargetNodeId`) that doesn't exist on the real `SwitchNodeData`/`SwitchCase` types, and its edges lacked the `sourceHandle: case-<id>`/`default` routing the engine actually reads — every branch was silently skipped, every run only ever executed the `Lookup Country` node. Also depended on the now-deprecated restcountries.com v3.1 API. **Fixed** (BUG-8): corrected to real edge-based `sourceHandle` routing, switched the branch decision to the `{{country}}` variable directly (no longer dependent on a third-party API's response shape), and replaced the dead-API branch targets with jsonplaceholder calls. Verified: germany → European Country, japan → Asian Country, anything else → Other Region. |
| `examples/api-mock/sample-workspace.json` (+ `Dockerfile`) | CLI-10 | Fixture itself unchanged and correct. **Lesson design corrected** (NOTE-4): the originally-planned Step 5 ("with the standalone listener still running, verify the live journal") doesn't work — `mock verify`'s live-journal mode only reads a companion-started mock's journal, never a `--standalone` one. Step 5 now starts the mock via companion mode instead. |

**Genuine gap (needs new authoring):** no fixture exists for a *deterministic* performance regression (CLI-8). Real jsonplaceholder.typicode.com response times aren't controllable, so "point at a slower endpoint" (the original draft's approach) would be flaky on camera. Fix: reuse the **API Mock Studio** listener from CLI-10 — start it once with a route's `behavior.delayMs` at e.g. `50`, save a baseline, then restart the same mock with `delayMs` bumped to `800` and re-run — this guarantees a reproducible regression every time the lesson plays. This is the only new authoring this plan requires (a tiny two-variant mock workspace pair, not a whole new fixture family).

- `setup()` for each lesson ensures the prior lesson's saved artifacts (baselines, report files) don't leak into the next — clean temp dir per lesson, matching `--baselines-dir` override pattern already supported by the CLI itself.
- Since these fixtures' header comments already show the exact command for many of the flags this plan teaches, lesson authoring can lift `terminalCommand` values directly from the fixture files rather than inventing new invocations.

---

## CLI-1: Install & Your First Run

**Goal:** Show the three installation paths and get a first green run with a legible console summary.

**✅ Implemented (see [NOTE-5](#note-5-medium-local-dev-machines-only--found-while-discussing-cli-11-with-the-team-redfireforge-command-name-collision-between-the-npm-package-and-the-desktop-installer--fixed)).** This lesson's code (`packages/demo-hub/src/lessons/cli/cli-quick-start.ts`) now primarily demonstrates the short `redfireforge`/`rff` commands (post `npm install -g redfireforge-cli`) rather than the verbose `npx tsx cli/index.ts` form — the latter is now framed only as the "from source, for contributors" option. All terminal output below was re-captured for real against the actual bundled CLI (`node cli/dist/redfireforge.mjs ...`, simulating the installed `redfireforge`/`rff` commands) to reflect this.

| Field | Value |
|---|---|
| `id` | `cli-quick-start` |
| `domainId` | `cli` |
| `category` | `getting-started` |
| `estimatedMinutes` | 5 |
| `initialTab` | n/a — terminal surface, not an app tab |
| `desktopOnly` | `false` (scripted transcript on web; live spawn on desktop) |
| `tag` | none |

### Concept Slide

| Field | Value |
|---|---|
| `title` | The RedfireForge CLI |
| `body` | "Everything you can do by clicking through the desktop app, you can also do from a terminal — same execution engine, same assertions, same reports. This is what makes RedfireForge CI/CD-friendly: a GitHub Actions job, a pre-commit hook, or a cron job can run the exact same test suite a human runs in the GUI, headlessly, with an exit code CI can gate on." |
| `keyTerms` | `redfireforge-cli` — the published npm package, installs both `redfireforge` and short `rff` commands; `rff` — short alias for `redfireforge`, same binary, less to type, never collides with the desktop app's own `redfireforge` command; `--cli` — desktop app passthrough flag, only needed for the plain `redfireforge` command (`rff` skips it automatically) |

### Steps

All 5 steps run in a single persistent `DemoTerminal` pane (prompt stays `$`, cwd stays repo root `~/redfire-forge`). Real output below was captured by actually running each command against the repo — not invented — so the transcript matches what a viewer would see byte-for-byte (on desktop, this is literally re-executed live; on web it replays this exact text).

#### Step 1 — `cli1-install-options`: Three (Really Four) Ways to Install

| Field | Value |
|---|---|
| `title` | Three (Really Four) Ways to Install |
| `description` | "There's no single right way to install the CLI. Pick based on where you're running it: a teammate's laptop gets the npm package, a CI runner might use either, and the desktop app already bundles its own copy." |
| `terminalCommand` | *(four commands typed in sequence, each preceded by a one-line comment narration, plus a closing `rff` callout — no real execution needed here, this step is illustrative)* |
| `verify` | n/a (no live execution — narration-only comparison step) |
| `pauseAfter` | `true` (auto reading time) |

`terminalOutput`:
```
$ npm install -g redfireforge-cli
# → published npm package (recommended for CI runners and teammates without the source repo)

$ redfireforge --cli run tests/api-test.yaml
# → desktop app passthrough — only works if RedfireForge.app is installed (symlink/PATH set up by the installer)

$ npx tsx cli/index.ts run tests/api-test.yaml
# → from source — no build step, runs the TypeScript directly via tsx (useful for contributors working in the repo)

$ node dist-cli/redfireforge.mjs run tests/api-test.yaml
# → prebuilt bundle — no tsx/ts-node needed, fastest cold start, what CI and the desktop installer actually ship

# Whichever path you pick, the short "rff" alias works everywhere "redfireforge" does —
# same binary, less to type, and it never collides with the desktop app's own command name:
$ rff run tests/api-test.yaml
```

#### Step 2 — `cli1-verify`: Verify the Install

| Field | Value |
|---|---|
| `title` | Verify the Install |
| `description` | "Two commands you'll reach for constantly: `--version` to confirm what you're running, and `--help` to see the full command list. Notice the five real commands — `run`, `workflow`, `validate`, `validate-workflow`, and the `mock` command group. That's the entire CLI surface; everything else is flags on top of these. `rff --version` prints the exact same thing — it's the same binary as `redfireforge`, just shorter to type." |
| `terminalCommand` | `redfireforge --version && redfireforge --help` |
| `terminalHighlightLines` | the `Commands:` block (6 lines) |
| `verify` | output contains `Commands:` |
| `pauseAfter` | `true` |

`terminalOutput` (real, captured — via `node cli/dist/redfireforge.mjs`, simulating the installed `redfireforge`/`rff` commands):
```
0.5.6-beta.1
Usage: redfireforge [options] [command]

RedfireForge CLI — run API performance tests from YAML/JSON files

Options:
  -V, --version              output the version number
  -h, --help                 display help for command

Commands:
  run [options] <file>       Execute a test file
  workflow [options] <file>  Execute a workflow file as a performance test
  validate <file>            Validate a test file without running it
  validate-workflow <file>   Validate a workflow file without running it
  mock                       API Mock Studio headless commands
  help [command]             display help for command
```

**Callout (real nuance worth narrating):** the installed npm package prints `cli/package.json`'s own version (`0.5.6-beta.1` at time of writing), while running from source via `npx tsx cli/index.ts` prints the **repo root** `package.json` version (`0.7.1-alpha.1`) instead — because the bundled file's `__dirname` resolves `../package.json` to a different file than `cli/index.ts`'s own `__dirname` does when run directly from source. A viewer who installs the npm package will see a *different* version number than someone running from source. Worth a beat so nobody files a confused bug report.

#### Step 3 — `cli1-first-run`: Run Your First Test

| Field | Value |
|---|---|
| `title` | Run Your First Test |
| `description` | "Let's run something real. `cli-basic-test.yaml` hits JSONPlaceholder's `/users` endpoints with three tests, each tagged `smoke`/`critical`/`regression` — tags we'll use later. Watch the header: it echoes the suite name and test count before anything executes, so you know what's about to run before you commit to it." |
| `terminalCommand` | `redfireforge run examples/cli-basic-test.yaml` |
| `verify` | output contains `Result:       PASSED` |
| `pauseAfter` | `true` |

`terminalOutput` (real, captured — via `node cli/dist/redfireforge.mjs run examples/cli-basic-test.yaml`):
```
  Loading: cli-basic-test.yaml
  Tests:   3
  Suite:   CLI Basic Test
  Mode:    batch (C:1 I:3)

──────────────────────────────────────────────────
  RedfireForge — Test Run Summary
──────────────────────────────────────────────────
  Mode:         batch (C:1 I:3)
  Duration:     0.47s
  TPS:          19.15
  Avg Response: 52.02 ms
  P50:          38.67 ms
  P95:          167.48 ms
  P99:          167.48 ms
  P99.9:        167.48 ms
  Min / Max:    32.35 ms / 167.48 ms
──────────────────────────────────────────────────
  Timing Breakdown (avg)
  DNS Lookup:   0 ms
  TCP Connect:  0 ms
  TLS Handshake:0 ms
  TTFB:         45.97 ms
  Download:     0.87 ms
──────────────────────────────────────────────────
  Total:        9
  Passed:       9
  Failed HTTP:  0
  Failed Valid: 0
  Error Rate:   0%
  Tags:         critical, regression, smoke
──────────────────────────────────────────────────
  Result:       PASSED ✅
──────────────────────────────────────────────────
```

**Note:** `Total: 9` from 3 tests is not a typo — the summary counts individual assertions/requests across the run, not just test names. This is exactly the kind of number a first-time viewer misreads, so the narration should call it out rather than skip past it.

#### Step 4 — `cli1-read-summary`: Reading the Console Summary

| Field | Value |
|---|---|
| `title` | Reading the Console Summary |
| `description` | "Same output, now let's actually read it. The timing block gives P50/P95/P99/P99.9 — not just an average, because averages hide tail latency. `Timing Breakdown` splits DNS/TCP/TLS/TTFB/Download so you can tell *where* time went, not just how much. And `Tags` at the bottom lists every tag seen across the run — a preview of the filtering we'll do in a later lesson." |
| `terminalCommand` | *(no new command — same output from step 3, camera pans/highlights different regions)* |
| `terminalHighlightLines` | first the `P50`/`P95`/`P99`/`P99.9` block, then the `Timing Breakdown` block, then the `Tags:` line (implemented as an auto-cycling array of ranges in `DemoTerminal`, ~2.5s per beat) |
| `verify` | n/a |
| `pauseAfter` | `true` |

#### Step 5 — `cli1-exit-codes`: Exit Codes Matter

| Field | Value |
|---|---|
| `title` | Exit Codes Matter |
| `description` | "The console summary is for humans. CI doesn't read text — it reads the exit code. A clean run exits 0. Let's force a failure: `cli-error-handling.yaml` has a deliberate request to a non-existent user, and `--fail-on-error` tells the CLI to treat that as a hard failure instead of just reporting it." |
| `terminalCommand` | `redfireforge run examples/cli-basic-test.yaml >/dev/null; echo "exit: $?"` then `redfireforge run examples/cli-error-handling.yaml --fail-on-error -q; echo "exit: $?"` |
| `terminalHighlightLines` | `Result:       FAILED ❌` and `exit: 1` |
| `verify` | output contains `exit: 1` |
| `pauseAfter` | `true` |

`terminalOutput` (real, captured — first command's summary is the same PASSED block from step 3 followed by `exit: 0`; second command shown below):
```
──────────────────────────────────────────────────
  RedfireForge — Test Run Summary
──────────────────────────────────────────────────
  Mode:         batch (C:1 I:5)
  Duration:     0.96s
  TPS:          26.03
  Avg Response: 38.34 ms
  P50:          34.58 ms
  P95:          41.65 ms
  P99:          140.17 ms
  P99.9:        140.17 ms
  Min / Max:    27.12 ms / 140.17 ms
──────────────────────────────────────────────────
  Timing Breakdown (avg)
  DNS Lookup:   0 ms
  TCP Connect:  0 ms
  TLS Handshake:0 ms
  TTFB:         36.75 ms
  Download:     0.46 ms
──────────────────────────────────────────────────
  Total:        25
  Passed:       20
  Failed HTTP:  5
  Failed Valid: 5
  Error Rate:   20%
──────────────────────────────────────────────────
  Result:       FAILED ❌
──────────────────────────────────────────────────
exit: 1
```

**Narration close:** "0 → success, 1 → test or threshold failure, 2 → the file itself was invalid (we'll hit that in the next lesson). Everything downstream — a red X on a PR, a Slack alert, a blocked deploy — starts with this number."

**Cleanup:** none (read-only fixture runs, no files written).

---

## CLI-2: Validate Before You Run

**Goal:** Teach the test-file YAML shape and the fast validate-only workflow, including catching mistakes before spending time on a real run.

**✅ Implemented** (`packages/demo-hub/src/lessons/cli/cli-validate-authoring.ts`, id `cli-validate-authoring`). Like CLI-1, uses the short `redfireforge` command (not `npx tsx cli/index.ts`) and adds a concept diagram: file → `validate`/`validate-workflow` (parse only, no network) → splits into exit 0 (safe to run) / exit 2 (fix & re-check), with a dashed loop-back arrow from exit 2 to the file box illustrating the fix-and-re-validate cycle. List-like description content (top-level file pieces, the two failure modes) uses markdown bullets, consistent with CLI-1's revision.

| Field | Value |
|---|---|
| `id` | `cli-validate-authoring` |
| `domainId` | `cli` |
| `category` | `getting-started` |
| `estimatedMinutes` | 5 |
| `desktopOnly` | `false` |
| `tag` | none |

### Concept Slide

| Field | Value |
|---|---|
| `title` | Validate Before You Run |
| `body` | "`validate` and `validate-workflow` do everything `run`/`workflow` do except actually make requests — parse the file, build scenarios, print a summary. They're instant (no network calls), which makes them the right first check in an editor save-hook or a CI pre-flight step, before burning time on a real load test against a broken file." |
| `keyTerms` | `tests[]` — the array every test file needs at least one entry in; `exit code 2` — reserved specifically for "the file itself is the problem", distinct from exit 1 (a test failed) |
| `diagram` | file (.yaml) → `validate` / `validate-workflow` (parse only — no network calls) → exit 0 (✅ safe to run) / exit 2 (❌ fix & re-check) → dashed loop-back arrow labeled "fix & re-validate" |

### Steps

All 5 steps continue in the same `DemoTerminal` pane from CLI-1.

#### Step 1 — `cli2-anatomy`: Test File Anatomy

| Field | Value |
|---|---|
| `title` | Test File Anatomy |
| `description` | "Before validating, let's actually read the file. `cli-basic-test.yaml` has four top-level pieces: `name` (suite label), `env` (metadata only — doesn't change behavior), `baseUrl` (prefixed onto every test's relative `url`), and `tests[]` — the only required array. Each test itself just needs `method`, `url`, and optionally `tags`/`assertions`." |
| `terminalCommand` | `cat examples/cli-basic-test.yaml` |
| `verify` | n/a |
| `pauseAfter` | `true` |

`terminalOutput` (real file contents, header comment omitted for the on-screen view — full file has 3 tests, only 2 shown below for brevity):
```
name: CLI Basic Test
env: demo
baseUrl: https://jsonplaceholder.typicode.com

tests:
  - name: List Users
    method: GET
    url: /users
    tags: [smoke, regression]
    headers:
      Accept: application/json
    assertions:
      - type: status
        expected: "200"
      - type: numeric
        jsonPath: $.length
        operator: ">"
        value: 0

  - name: Get Single User
    method: GET
    url: /users/1
    tags: [smoke, critical]
    ...
```

`terminalHighlightLines`: `name`/`env`/`baseUrl` block first, then `tests:` and one test's `tags`/`assertions` shape.

#### Step 2 — `cli2-validate-good`: Validate a Good File

| Field | Value |
|---|---|
| `title` | Validate a Good File |
| `description` | "Run `validate` against it. No network calls happen — this only parses the YAML and builds the scenario list in memory. Notice each line echoes the resolved method, full URL (baseUrl + path already joined), test name, and tags — a fast way to eyeball 'is this the file I think it is' before spending real time running it." |
| `terminalCommand` | `redfireforge validate examples/cli-basic-test.yaml` |
| `verify` | output contains `✅ Valid test file` |
| `pauseAfter` | `true` |

`terminalOutput` (real, captured — via `node cli/dist/redfireforge.mjs`, simulating the installed `redfireforge`/`rff` commands):
```
  ✅ Valid test file: cli-basic-test.yaml
  Tests: 3
    - GET https://jsonplaceholder.typicode.com/users  (List Users)  [tags: smoke, regression]
    - GET https://jsonplaceholder.typicode.com/users/1  (Get Single User)  [tags: smoke, critical]
    - GET https://jsonplaceholder.typicode.com/posts  (List Posts)  [tags: regression]
```

#### Step 3 — `cli2-validate-workflow`: Validate a Workflow File

| Field | Value |
|---|---|
| `title` | Validate a Workflow File |
| `description` | "Workflows get their own validator, since the shape is completely different — nodes and edges instead of a tests array. `validate-workflow` reports node/edge counts and which variables the workflow declares, so you can confirm a graph is well-formed before running it at load." |
| `terminalCommand` | `redfireforge validate-workflow examples/workflow-cli-sample.yaml` |
| `verify` | output contains `✅ Valid workflow` |
| `pauseAfter` | `true` |

`terminalOutput` (real, captured):
```
  ✅ Valid workflow: workflow-cli-sample.yaml
  Name: JSONPlaceholder Test Workflow
  Nodes: 4 total, 2 HTTP
  Edges: 3
  Variables: baseUrl
```

#### Step 4 — `cli2-break-it`: Two Ways to Break It

| Field | Value |
|---|---|
| `title` | Two Ways to Break It |
| `description` | "There are two different kinds of 'broken' here, and the CLI reports them differently. First: a YAML syntax mistake — say you delete the `tests:` key line but forget to un-indent the list underneath it. That's not valid YAML at all, so you get a parser error with a line/column pointer. Second: syntactically valid YAML that's semantically empty — `tests: []`. That parses fine, but the CLI's own validation rejects it because a suite with zero tests isn't runnable. Same exit code, very different messages — recognizing which one you're looking at saves debugging time." |
| `terminalCommand` | `redfireforge validate /tmp/cli-basic-test-broken.yaml` (malformed indentation) then `redfireforge validate /tmp/cli-basic-test-broken2.yaml` (`tests: []`) |
| `verify` | output contains `❌ Invalid` |
| `pauseAfter` | `true` |

`terminalOutput` (both real, captured against short temp fixtures — line/column numbers point at the actual line in each temp file, not the real fixture):
```
  ❌ Invalid: Nested mappings are not allowed in compact mappings at line 3, column 10:

baseUrl: https://jsonplaceholder.typicode.com
         ^
 [BLOCK_AS_IMPLICIT_KEY]
```
```
  ❌ Invalid: Test file must contain a non-empty "tests" array.
```

Both exit **2** — confirmed by running each with `; echo $?` in the actual capture session.

#### Step 5 — `cli2-fix-and-confirm`: Fix and Re-Validate

| Field | Value |
|---|---|
| `title` | Fix and Re-Validate |
| `description` | "Restore the real `tests:` array and re-run `validate` — back to green. This validate → fix → validate loop is exactly what you'd wire into a pre-commit hook or an editor save action: instant feedback, no network round-trip, no wasted load-test run against a file that was never going to work." |
| `terminalCommand` | `redfireforge validate examples/cli-basic-test.yaml` |
| `verify` | output contains `✅ Valid test file` |
| `pauseAfter` | `true` |

`terminalOutput`: identical to Step 2's captured output.

**Cleanup:** delete the two temp broken files (`/tmp/cli-basic-test-broken*.yaml`) — the real `examples/cli-basic-test.yaml` fixture is never modified on disk, only copied.

---

## CLI-3: Execution Modes & Concurrency

**Goal:** Understand `-c`/`-i`, the four execution modes, and per-request timeout/retry controls.

**✅ Implemented** (`packages/demo-hub/src/lessons/cli/cli-execution-modes.ts`, id `cli-execution-modes`). Uses the short `redfireforge` command like CLI-1/CLI-2. Adds a concept diagram: a 2×2 grid of the four modes (`sequential` / `batch` / `pool` (highlighted as default) / `load-profile`), each with a one-line descriptor, under a `-m <mode> picks one:` header. Output is trimmed to the handful of summary fields each step's narration actually references (`Mode`/`Duration`/`TPS`/`Total`/`Result`, plus latency fields for the timeout step) rather than the full dashed block — several steps compare two full runs side by side, so full ~25-line blocks per run would bury the comparison. Step titles avoid backticks (the sidebar step list renders `title` as plain text, not through the markdown renderer — CLI-1/CLI-2 established this convention). Numbers below are freshly re-captured against the real fixture and JSONPlaceholder API, not reused from the original plan draft — they naturally vary run-to-run since these are live HTTP timings.

| Field | Value |
|---|---|
| `id` | `cli-execution-modes` |
| `domainId` | `cli` |
| `category` | `execution` |
| `estimatedMinutes` | 6 |
| `desktopOnly` | `false` |
| `tag` | none |

### Concept Slide

| Field | Value |
|---|---|
| `title` | Execution Modes & Concurrency |
| `body` | "`-c` (concurrency) and `-i` (iterations) control the shape of a run, but the execution mode decides how they interact. `examples/cli-load-profile.yaml` ships its own default (`concurrency: 5`, `mode: pool` under its `config:` key) — CLI flags always override the file's own config." |
| `keyTerms` | `pool` — default mode, workers continuously refill from a shared queue; `batch` — fixed-size waves, each wave fully completes before the next starts; `sequential` — one request at a time, ignores concurrency; `load-profile` — time-boxed instead of iteration-boxed, driven by `--duration` |
| `diagram` | 2×2 grid: `sequential` (1 at a time, debugging) / `batch` (fixed waves of C, waits for full wave) / `pool` — default, highlighted (C workers refill queue, sustained concurrency) / `load-profile` (time-boxed via `--duration`, iterations ignored) |

### Steps

All 6 steps run `examples/cli-load-profile.yaml` (3 tests, `config: { concurrency: 5, mode: pool }` in the file itself).

#### Step 1 — `cli3-concurrency-iterations`: Concurrency vs. Iterations

| Field | Value |
|---|---|
| `title` | Concurrency vs. Iterations |
| `description` | "Baseline: one request at a time, one pass. Then push it — 5x the concurrency, 5x the iterations. Same fixture, same 3 tests" (bulleted: `-c 1 -i 3` — baseline; `-c 5 -i 15` — 5x concurrency, 5x iterations). "Watch TPS jump while total duration barely moves — that's the entire point of concurrency." |
| `terminalCommand` | `redfireforge run examples/cli-load-profile.yaml -c 1 -i 3 -q` then `redfireforge run examples/cli-load-profile.yaml -c 5 -i 15 -q` |
| `pauseAfter` | `true` |

`terminalOutput` (real, captured — both runs, trimmed to summary fields):
```
  Mode:         pool (C:1 I:3)
  Duration:     0.48s
  TPS:          18.78
  Total:        9
  Result:       PASSED ✅

  Mode:         pool (C:5 I:15)
  Duration:     0.51s
  TPS:          88.43
  Total:        45
  Result:       PASSED ✅
```

**Narration close:** "9 requests at C:1 vs. 45 requests at C:5 — 5x the work, barely more wall-clock time, because requests are running concurrently instead of queued one behind another."

#### Step 2 — `cli3-sequential`: Sequential Mode

| Field | Value |
|---|---|
| `title` | Sequential Mode |
| `description` | "Sequential mode processes one request at a time regardless of what `-c` says — it's for debugging, not throughput. Watch the header: it shows `C:1`, not the file's `config.concurrency` (which is 5) — the CLI displays the concurrency it actually honors for this mode, instead of echoing an unused config value." |
| `terminalCommand` | `redfireforge run examples/cli-load-profile.yaml -m sequential -i 3 -q` |
| `pauseAfter` | `true` |

`terminalOutput` (real, captured):
```
  Mode:         sequential (C:1 I:3)
  Duration:     0.40s
  TPS:          22.31
  Total:        9
  Result:       PASSED ✅
```

**History worth narrating:** this header used to print `C:5` (the file's `config.concurrency`, inherited but never actually honored in sequential mode) — misleading, since sequential always runs one request at a time. **Fixed** (NOTE-2): the header now shows the concurrency the engine actually uses for the selected mode — confirmed `C:1` in the real capture above.

#### Step 3 — `cli3-batch-pool`: Batch vs. Pool

| Field | Value |
|---|---|
| `title` | Batch vs. Pool |
| `description` | "Both run concurrently, but differently" (bulleted: **batch** — fires a fixed-size wave of `C` requests, waits for the whole wave to finish, then fires the next wave, so a single slow request in a wave holds up everyone behind it; **pool** — keeps `C` workers continuously busy, immediately handing a finished worker the next request — no wave boundary, no waiting on stragglers). "Same `C` and `I` here; compare TPS and duration." |
| `terminalCommand` | `redfireforge run examples/cli-load-profile.yaml -m batch -c 3 -i 9 -q` then `redfireforge run examples/cli-load-profile.yaml -m pool -c 3 -i 9 -q` |
| `pauseAfter` | `true` |

`terminalOutput` (real, captured):
```
  Mode:         batch (C:3 I:9)
  Duration:     0.79s
  TPS:          34.41
  Total:        27
  Result:       PASSED ✅

  Mode:         pool (C:3 I:9)
  Duration:     0.56s
  TPS:          48.4
  Total:        27
  Result:       PASSED ✅
```

**Updated honest note:** unlike the original draft capture (which showed batch/pool as noise-level close, 79.79 vs. 74.7 TPS), this re-capture shows a real, visible gap — pool at 48.4 TPS vs. batch at 34.41 TPS. Batch waits for the slowest straggler in each wave before starting the next one, so any per-request variance compounds across waves; pool never has that wave boundary. The lesson's narration states the mechanism plainly and lets the real numbers make the case, rather than asserting a fixed magnitude of difference — batch-vs-pool sensitivity to endpoint variance means the exact gap will differ run to run.

#### Step 4 — `cli3-load-profile`: load-profile + --duration

| Field | Value |
|---|---|
| `title` | load-profile + --duration |
| `description` | "Every mode so far was iteration-boxed — run exactly N requests, however long it takes. `load-profile` flips that: run for exactly N seconds, however many requests that produces. This is the mode for 'how much traffic can this API sustain for 3 seconds' instead of 'run these 500 requests'." |
| `terminalCommand` | `redfireforge run examples/cli-load-profile.yaml -m load-profile --duration 3 -q` |
| `pauseAfter` | `true` |

`terminalOutput` (real, captured):
```
  Mode:         load-profile (C:5 I:3)
  Duration:     3.03s
  TPS:          124.04
  Total:        376
  Result:       PASSED ✅
```

**Narration close:** "3 seconds requested, 3.03s actual, 376 requests fit in that window at C:5 — the `I:3` in the header is vestigial here (iterations aren't the driver in this mode), the real control is `--duration`."

#### Step 5 — `cli3-timeout-retries`: Timeouts & Retries

| Field | Value |
|---|---|
| `title` | Timeouts & Retries |
| `description` | "Let's force real timeouts — point `--base-url` at a non-routable address so every request genuinely hangs and times out, instead of faking it" (bulleted: `--timeout 1` — caps each attempt at 1 second; `--retries 1 --retry-delay 300` — one retry after a 300ms pause). "Watch the P50 land right around 1000ms — that's the timeout ceiling, not real network latency." Plus the exit-code gotcha, made concrete via `; echo "exit: $?"` in the transcript rather than only asserted in prose. |
| `terminalCommand` | `redfireforge run examples/cli-load-profile.yaml --base-url https://10.255.255.1 -m sequential -i 1 --timeout 1 --retries 1 --retry-delay 300 -q; echo "exit: $?"` |
| `pauseAfter` | `true` |

`terminalOutput` (real, captured — took ~7s wall-clock, which is itself worth showing un-sped-up so the cost of retries is felt, not just told):
```
  Mode:         sequential (C:1 I:1)
  Duration:     6.91s
  TPS:          0.43
  Avg Response: 1001.5 ms
  P50:          1001.68 ms
  Total:        3
  Passed:       0
  Failed HTTP:  3
  Error Rate:   100%
  Result:       FAILED ❌
exit: 0
```

**Real gotcha worth narrating (ties back to CLI-1):** confirmed via the actual capture — no `--fail-on-error`, so despite `Result: FAILED`, the process still exits **0**, shown directly in the transcript's final line. Retries and timeouts control *how hard the CLI tries*, not *whether a failed run fails CI* — that's a separate flag, covered in the next lesson. Also worth a caution: retries that mask a real outage look identical in the summary to retries that smoothed over one flaky request — the CLI reports the outcome, not the reason.

Note: `Mode:` correctly shows `C:1` here too (matching the sequential-mode header fix from Step 2), not the file's `config.concurrency: 5` and not the original draft's stale `C:5` capture.

#### Step 6 — `cli3-recap`: When to Use Which Mode

| Field | Value |
|---|---|
| `title` | When to Use Which Mode |
| `description` | "Recap, no execution" (bulleted: `sequential` — debugging one test at a time; `batch` — clean, discrete waves, e.g. matching a fixed downstream rate limit; `pool` (the default) — realistic sustained concurrency; `load-profile` — "how much traffic in N seconds" instead of "run N requests"). |
| `terminalCommand` | none — a comment-only cheat sheet is shown instead (`# sequential → ...`, `# batch → ...`, `# pool → ...`, `# load-profile → ...`), consistent with CLI-1 Step 1's precedent of comment-only terminal lines when nothing is actually executed. |
| `pauseAfter` | `true` |

**Cleanup:** none — every step here is a read-only GET against JSONPlaceholder (or a non-routable IP that never gets a response), no files written.

---

## CLI-4: Error Policies & CI Gating

**Goal:** Circuit-breaker error policies plus the flags that turn test failures into CI pipeline failures.

**✅ Implemented** (`packages/demo-hub/src/lessons/cli/cli-error-policies.ts`, id `cli-error-policies`). Uses the short `redfireforge` command like CLI-1/2/3. Adds a concept diagram: three "error policy" boxes (`continue` / `stop-first` / `stop-threshold`, controlling *what runs*) above a dashed divider, then a separate "CI gating" box (`--fail-on-error` / `--fail-threshold`, controlling only the *exit code*) with an arrow down to an `exit 0 or 1` badge — visually reinforcing the concept's core point that these are two independent axes. Numbers below are freshly re-captured against the real fixture and JSONPlaceholder API.

| Field | Value |
|---|---|
| `id` | `cli-error-policies` |
| `domainId` | `cli` |
| `category` | `execution` |
| `estimatedMinutes` | 5 |
| `desktopOnly` | `false` |
| `tag` | none |

### Concept Slide

| Field | Value |
|---|---|
| `title` | Error Policies & CI Gating |
| `body` | "Two separate concerns get confused a lot: whether the run keeps going after a failure (error policy), and whether the process exits non-zero when it's done (CI gating). `examples/cli-error-handling.yaml` has one test that always 404s (`/users/99999`) — everything in this lesson runs against that one deliberate failure." |
| `keyTerms` | `continue` — default, run everything regardless of failures; `stop-first`/`stop-threshold` — circuit breaker, halts the run itself; `--fail-on-error`/`--fail-threshold` — don't change what runs, only change the exit code afterward |
| `diagram` | Top row: `continue` / `stop-first` / `stop-threshold` boxes under "error policy — controls WHAT RUNS". Dashed divider. Bottom: `--fail-on-error / --fail-threshold` box under "CI gating — a separate axis, controls the EXIT CODE", arrow down to an `exit 0 or 1` badge. |

### Steps

All 5 steps run `examples/cli-error-handling.yaml` (5 tests: 4 always pass, 1 always 404s).

#### Step 1 — `cli4-continue`: continue (default)

| Field | Value |
|---|---|
| `title` | continue (default) |
| `description` | "No `--error-policy` flag means `continue` — the default. All 25 requests run (5 tests × the file's implicit iteration count) even though one test always 404s. This is what you want most of the time: one bad test shouldn't blind you to the other four." |
| `terminalCommand` | `redfireforge run examples/cli-error-handling.yaml -q` |
| `pauseAfter` | `true` |

`terminalOutput` (real, captured, trimmed to summary fields):
```
  Mode:         batch (C:1 I:5)
  Duration:     1.15s
  Total:        25
  Passed:       20
  Failed HTTP:  5
  Failed Valid: 5
  Error Rate:   20%
  Result:       FAILED ❌
```

#### Step 2 — `cli4-stop-first`: stop-first

| Field | Value |
|---|---|
| `title` | stop-first |
| `description` | "stop-first is the opposite instinct — the moment anything fails, stop the run. Good for local debugging when you just want to see the first problem and fix it, not wait through requests you already know will partially fail." |
| `terminalCommand` | `redfireforge run examples/cli-error-handling.yaml --error-policy stop-first -q` |
| `pauseAfter` | `true` |

`terminalOutput` (real, captured):
```
  Mode:         batch (C:1 I:5)
  Duration:     0.53s
  Total:        12
  Passed:       11
  Failed HTTP:  1
  Failed Valid: 1
  Error Rate:   8.33%
  Result:       FAILED ❌
```

**Updated note:** the original draft capture showed `Total: 4` for this step; the re-capture consistently shows `Total: 12` instead. The circuit breaker still visibly trips well before the full 25 (and duration drops from 1.15s to 0.53s, a real wall-clock saving), but "stops at the very first failure" should be narrated as "stops as soon as a failure is registered" rather than implying an exact request count — the precise cutoff depends on how the batch executor overlaps in-flight requests at the point of failure, so it isn't perfectly deterministic run to run.

#### Step 3 — `cli4-stop-threshold`: stop-threshold

| Field | Value |
|---|---|
| `title` | stop-threshold |
| `description` | "The middle ground: keep going until the error rate crosses a line, then stop — rather than stopping on the very first failure like stop-first. `--max-error-rate 10` here means 'halt once more than 10% of requests so far have failed', straight from the fixture's own header comment." |
| `terminalCommand` | `redfireforge run examples/cli-error-handling.yaml --error-policy stop-threshold --max-error-rate 10 -q` |
| `pauseAfter` | `true` |

`terminalOutput` (real, captured):
```
  Mode:         batch (C:1 I:5)
  Duration:     0.45s
  Total:        10
  Passed:       9
  Failed HTTP:  1
  Failed Valid: 1
  Error Rate:   10%
  Result:       FAILED ❌
```

**Narration close:** "Stopped at 10 requests once the running error rate crossed 10% — later than `stop-first` (12) but well short of the full 25 from `continue`. `--max-errors <n>` is the sibling flag for an absolute count instead of a rate."

#### Step 4 — `cli4-fail-on-error`: --fail-on-error

| Field | Value |
|---|---|
| `title` | --fail-on-error |
| `description` | "Everything so far controlled what the CLI does during the run. This flag controls what happens after — whether a failed run also fails the process" (bulleted: without `--fail-on-error` → `Result: FAILED ❌` but exit `0`; with `--fail-on-error` → same `Result: FAILED ❌`, but exit `1`). "This is the flag that actually turns a red summary into a red CI check." |
| `terminalCommand` | `redfireforge run examples/cli-error-handling.yaml -q; echo "exit: $?"` then `redfireforge run examples/cli-error-handling.yaml --fail-on-error -q; echo "exit: $?"` |
| `pauseAfter` | `true` |

`terminalOutput` (real, captured — both commands produce an identical FAILED summary; only the trailing exit code differs):
```
  Result:       FAILED ❌
exit: 0

  Result:       FAILED ❌
exit: 1
```

#### Step 5 — `cli4-fail-threshold`: --fail-threshold <pct>

| Field | Value |
|---|---|
| `title` | --fail-threshold <pct> |
| `description` | "`--fail-on-error` fails on any failure. `--fail-threshold` is more forgiving — fail only if the error rate exceeds a percentage. This run has a 20% error rate; `--fail-threshold 5` says anything over 5% should fail CI, so this trips it too. The explanation line now prints even with `-q` — no need to drop quiet mode just to see why a run failed." |
| `terminalCommand` | `redfireforge run examples/cli-error-handling.yaml --fail-threshold 5 --fail-on-error -q; echo "exit: $?"` |
| `pauseAfter` | `true` |

`terminalOutput` (real, captured):
```
  Result:       FAILED ❌

  Error rate 20% exceeds threshold 5%
exit: 1
```

**History worth narrating:** this explanation line used to be suppressed under `-q` — exactly the flag combination the fixture's own CI example and most real pipelines use — so a CI job would go red with a bare exit code and nothing in the log explaining why. **Fixed** (NOTE-1): the line now always prints when the threshold is exceeded, regardless of `-q`, since it's the one line that explains a non-zero exit.

**Cleanup:** none. All steps run `examples/cli-error-handling.yaml`.

---

## CLI-5: Data-Driven Testing from the Terminal

**Goal:** Parameterize a scenario with an external CSV/JSON file or the native inline `dataSource:` schema, filter by scenario/tag, and see what data-driven testing actually does (and doesn't) support today.

**✅ Implemented** (`packages/demo-hub/src/lessons/cli/cli-data-driven.ts`, id `cli-data-driven`). Uses the short `redfireforge` command like CLI-1–4. Adds a concept diagram: `dataSource:` (inline) and `--data <csv|json>` (external) converge into a shared "row-expansion engine" box, which splits into two independent filter paths — `--scenario(-tags)` (filters whole tests) and `--tags` (filters individual rows) — visually reinforcing the concept's two-parameterization-paths/two-filter-types structure. Step 4's "entire row-set filtered out" demo uses a small temp fixture (`/tmp/cli5-drop-test.yaml`, 2 tests — one with a `smoke`-tagged row, one with only a `regression`-tagged row) built specifically to reproduce the `Dropped:` line live, since no existing repo fixture demonstrates it; the temp file is never committed. Numbers below are freshly re-captured against the real fixtures and JSONPlaceholder/httpbin APIs.

**✅ Update: BUG-1 is fixed.** Both "parameterized" example fixtures (`examples/cli-parameterized.yaml`, `examples/parameterized-users.yaml`) originally declared their inline data using a `dataSource:` block (the GUI-native schema) that `cli/loader.ts` silently ignored — running `cli-parameterized.yaml` showed `Tests: 1` (not 6) with a literal unresolved `{{id}}` in the URL. **This is now fixed**: `cli/loader.ts` accepts `dataSource:` natively (`buildDataSourceFromNative`, 17 new tests in `cli/loader.test.ts`), and both fixtures now run correctly end-to-end — verified `cli-parameterized.yaml` real run: `Total: 36, Passed: 36, Data Rows: 36 total, 36 passed, 0 failed`. Step 1 below now demonstrates the real fixture directly rather than a workaround file, with the bug's history kept as context since it's a good lesson in itself.

**✅ Update: BUG-2/BUG-3 are also fixed.** Row-level `--tags`/`--tag-mode` filtering used to have no working code path for any fixture shape. It's now fixed everywhere: native `dataSource:` rows carry real `tags` (a side effect of the BUG-1 fix, verified: `--tags smoke` matched 2/6 rows and `--tags critical,regression --tag-mode any` matched 5/6 rows against `cli-parameterized.yaml`), and external `--data <csv|json>` rows now do too (`loadDataFile` parses `_tags`/`_label`/`_note`/`_enabled` instead of leaking them as query params). A scenario whose entire row-set gets filtered to zero is now **dropped from the run** (with a console `Dropped:` line naming it) instead of falling through to a single unparameterized, unrelated failure — and if every scenario ends up dropped, the CLI exits 1 with a clear `❌ No data rows match the specified tags.` message, mirroring the existing `--scenario-tags` zero-match precedent. Steps 2 and 4 below now demonstrate the fixed behavior directly.

| Field | Value |
|---|---|
| `id` | `cli-data-driven` |
| `domainId` | `cli` |
| `category` | `data-and-ci` |
| `estimatedMinutes` | 6 |
| `desktopOnly` | `false` |
| `tag` | none |

### Concept Slide

| Field | Value |
|---|---|
| `title` | Data-Driven Testing — What Actually Works |
| `body` | "The CLI supports two ways to parameterize a test: an external `--data <csv\|json>` file, or an inline data block in the test file itself — either the native `dataSource:` schema (columns/rows with ids, types, and per-row tags, same shape the GUI uses) or the more compact `data: { columns, rows }` shorthand. Both drive the same row-expansion engine. Filtering by `--scenario`/`--scenario-tags` operates at the *test* level and works reliably. Filtering rows by `--tags` now works for both `dataSource:`-based rows and external CSV rows — verified below rather than assumed." |
| `keyTerms` | `dataSource:` — the full native inline schema (columns with id/name/type/mapping, rows with id/values/tags/enabled/note); `data:` — the compact shorthand (no per-row tags); `validate:`/`header:` prefixes — the only two special column-name prefixes the external CSV/JSON `--data` loader recognizes |

### Steps

#### Step 1 — `cli5-inline-datasource`: Inline Data — Two Schemas, One Now Fixed

| Field | Value |
|---|---|
| `title` | Inline Data — Two Schemas, One Now Fixed |
| `description` | "`cli-parameterized.yaml` declares 6 rows of data using the native `dataSource:` schema — the same shape the GUI exports. Until recently the CLI silently ignored this field entirely: it would report `Tests: 1` and send a request with a literal unresolved `{{id}}` in the URL. That's fixed now — watch the header say `[6 data rows]` at validate time, and all 6 rows actually execute." |
| `terminalCommand` | `redfireforge validate examples/cli-parameterized.yaml` then `redfireforge run examples/cli-parameterized.yaml -q` |
| `verify` | validate output contains `[6 data rows]`; run output contains `Data Rows:    36 total, 36 passed, 0 failed` |
| `pauseAfter` | `true` |

`terminalOutput` (real, captured — post-fix):
```
  ✅ Valid test file: cli-parameterized.yaml
  Tests: 1
    - GET https://jsonplaceholder.typicode.com/users/{{id}}  (Get User by ID) [6 data rows]
```
```
  Mode:         batch (C:1 I:6)
  Total:        36
  Passed:       36
  Result:       PASSED ✅
  Data Rows:    36 total, 36 passed, 0 failed
```

**History worth narrating (a good lesson in itself):** this file used to be broken — the CLI only recognized a separate, more compact `data: { columns, rows }` shorthand and had no idea what to do with a `dataSource:` block, so it silently dropped it instead of erroring. That's exactly why `validate` still said the file was "valid" even though it wasn't doing what it claimed — a structurally-valid YAML file with a field the loader doesn't understand isn't caught by schema validation, only by actually running it and reading the output carefully. `Total: 36` = 6 rows × the default 6 iterations.

#### Step 2 — `cli5-external-csv`: The External `--data` File

| Field | Value |
|---|---|
| `title` | The External `--data` File |
| `description` | "`--data` works reliably — point it at `examples/users-data.csv` and it overrides any test's own data entirely (external always wins over inline, native or shorthand). `parameterized-users.yaml` targets httpbin.org's `/get`, which echoes back whatever query params it receives — perfect for the CSV's `validate:$.args.name` column. And unlike when this lesson was first written, the CSV's `_tags`/`_label`/`_note` columns are now real row metadata, not leaked query params." |
| `terminalCommand` | `redfireforge run examples/parameterized-users.yaml --data examples/users-data.csv -q` |
| `verify` | output contains `Data Rows:    25 total, 25 passed, 0 failed` |
| `pauseAfter` | `true` |

`terminalOutput` (real, captured):
```
  Mode:         batch (C:1 I:5)
  Total:        25
  Passed:       25
  Result:       PASSED ✅
  Data Rows:    25 total, 25 passed, 0 failed
```

**History worth narrating:** `examples/README.md`'s CSV column table always documented `_tags`/`_label`/`_note` as special columns, but the CLI's `loadDataFile` used to ignore that convention entirely — those values leaked straight through as literal query params (`?userId=1&name=Alice&_tags=smoke%3Bcritical&_label=happy-path&_note=Standard+user+lookup`). **That's fixed now** (BUG-3) — inspecting the request URLs from this exact run shows a clean `?userId=1&name=Alice`, no leaked metadata.

#### Step 3 — `cli5-scenario-filter`: `--scenario <name>`

| Field | Value |
|---|---|
| `title` | `--scenario <name>` |
| `description` | "This one's simple and it works exactly as documented: narrow the whole run down to one named test before anything else happens — data rows, tags, everything downstream only applies to the one test left standing." |
| `terminalCommand` | `redfireforge run examples/cli-basic-test.yaml --scenario "Get Single User" -q` |
| `verify` | output contains `Total:        1` |
| `pauseAfter` | `true` |

`terminalOutput` (real, captured):
```
  Total:        1
  Passed:       1
  Tags:         critical, smoke
  Result:       PASSED ✅
```

#### Step 4 — `cli5-row-tags`: `--tags` — Now Fixed Everywhere

| Field | Value |
|---|---|
| `title` | `--tags` — Now Fixed Everywhere |
| `description` | "Row-level `--tags` used to be broken for every fixture shape in the repo. It's now fixed for both native `dataSource:` files and external `--data <csv>` files. Watch two things: the CSV path now genuinely filters rows by real tags instead of ignoring them, and when a test's *entire* row-set gets filtered out, the CLI now drops that test from the run and tells you so — instead of silently executing it once with an unresolved placeholder." |
| `terminalCommand` | `redfireforge run examples/parameterized-users.yaml --data examples/users-data.csv --tags smoke -q` then, without `-q`, the same command against a temp fixture (`/tmp/cli5-drop-test.yaml`) where one test's rows all get filtered out |
| `verify` | first run contains `Data Rows:    4 total, 4 passed, 0 failed`; second run's console shows a `Dropped:` line naming the excluded test |
| `pauseAfter` | `true` |

`terminalOutput` (real, captured — CSV `--tags smoke`, request URLs clean, no leaked metadata):
```
  Mode:         batch (C:1 I:2)
  Total:        4
  Passed:       4
  Result:       PASSED ✅
  Data Rows:    4 total, 4 passed, 0 failed
```
Request URLs: `https://httpbin.org/get?userId=1&name=Alice`, `https://httpbin.org/get?userId=2&name=Bob` (only the 2 rows tagged `smoke`, no `_tags=`/`_label=` leakage).

`terminalOutput` (real, captured — a 2-test fixture where one test's rows all get filtered out):
```
  Tests:   2
  Tags:    smoke (mode: any, 1 matching rows, 1/2 scenarios retained)
  Dropped: No Smoke Rows (no rows matched the tag filter)
  Mode:    batch (C:1 I:1)
  Data:    1 row across 1 test
  ...
  Total:        1
  Passed:       1
  Result:       PASSED ✅
```

**History worth narrating:** before this fix, that second scenario wouldn't have been dropped — it would have silently executed once with its literal unresolved `{{id}}` placeholder still in the URL, failing for a completely unrelated reason and confusing anyone debugging it. Now it's named explicitly (`Dropped: No Smoke Rows`) and excluded from the run entirely. If *every* scenario in a run gets dropped this way, the CLI exits 1 with `❌ No data rows match the specified tags.` — the same pattern already used by `--scenario-tags` for its own zero-match case.

#### Step 5 — `cli5-scenario-tags`: `--scenario-tags`/`--scenario-tag-mode`

| Field | Value |
|---|---|
| `title` | `--scenario-tags`/`--scenario-tag-mode` |
| `description` | "Don't confuse this with the broken row-level `--tags` from the last step — this one filters whole **tests**, using the `tags:` array declared directly on each test in `cli-basic-test.yaml`, and it works correctly. `--scenario-tag-mode all` requires every listed tag to be present — here, no single test has both `critical` and `regression`, so it correctly reports zero matches instead of silently running everything." |
| `terminalCommand` | `redfireforge run examples/cli-basic-test.yaml --scenario-tags critical -q` then `redfireforge run examples/cli-basic-test.yaml --scenario-tags critical,regression --scenario-tag-mode all -q` |
| `verify` | second command outputs `❌ No scenarios match the specified tags.` and exits 1 |
| `pauseAfter` | `true` |

`terminalOutput` (real, captured):
```
  Total:        1
  Passed:       1
  Tags:         critical, smoke
  Result:       PASSED ✅
```
```
  ❌ No scenarios match the specified tags.
```
(exit code 1, confirmed)

#### Step 6 — `cli5-data-rows-summary`: `--data-rows-summary`

| Field | Value |
|---|---|
| `title` | `--data-rows-summary` |
| `description` | "The CI-friendly per-row JSON output — one entry per test pattern, with pass/fail row counts and details on any failed rows. This is what a CI job would parse to post a 'data row X of Y failed' comment on a PR." |
| `terminalCommand` | `redfireforge run <a working data-driven file> --data-rows-summary results.json -q && cat results.json` |
| `verify` | output JSON contains `"totalRows"` |
| `pauseAfter` | `true` |

`terminalOutput` (real, captured — via `examples/cli-parameterized.yaml`, 6 rows × 6 iterations):
```
[
  {
    "pattern": "Get User by ID",
    "totalRows": 36,
    "passedRows": 36,
    "failedRows": 0,
    "failedRowDetails": []
  }
]
```

**Cleanup:** delete any one-off demo fixture files and generated report files; never modify the real `examples/*.yaml` fixtures on disk.

---

## CLI-6: Reports & CI/CD Integration

**Goal:** Every report format the CLI can emit, and wiring it into a real GitHub Actions job.

**✅ Implemented** (`packages/demo-hub/src/lessons/cli/cli-reports-ci.ts`, id `cli-reports-ci`). Uses the short `redfireforge` command like CLI-1–5. Adds a concept diagram: "one test run" fans out into three boxes (`-o` JSON / `--junit` XML / `--markdown` .md), each labeled with its consumer, with a caption stating they're additive. Step 5's GitHub Actions YAML is quoted from `docs/guides/cli-ci-cd.md`'s "Basic Test Job (Using npm Package)" section (there is no live `.github/workflows/api-performance-tests.yml` file in this repo — the terminal step says so explicitly rather than implying a file that doesn't exist). Step 6's recap is a comment-only cheat sheet plus one example command showing all four report flags combined, consistent with CLI-3's `cli3-recap` precedent. Numbers below are freshly re-captured against the real fixture and JSONPlaceholder API.

| Field | Value |
|---|---|
| `id` | `cli-reports-ci` |
| `domainId` | `cli` |
| `category` | `data-and-ci` |
| `estimatedMinutes` | 6 |
| `desktopOnly` | `false` |
| `tag` | none |

### Concept Slide

| Field | Value |
|---|---|
| `title` | Reports & CI/CD Integration |
| `body` | "The console summary is for a human watching a terminal. Every other format targets a different consumer: JSON for scripts/dashboards that need the full per-request detail, JUnit XML for CI systems with built-in test-report UIs, Markdown for a PR comment a teammate will actually read. All three come from the exact same run — pick as many as you need, they're not mutually exclusive." |
| `keyTerms` | `-o/--output` — full JSON report (config + summary + every per-request result); `--junit` — `<testsuites>/<testsuite>/<testcase>` XML most CI dashboards already know how to render; `--markdown` — a ready-to-paste PR comment |

### Steps

All 4 executed steps run `examples/cli-basic-test.yaml` (3 tests, tagged `smoke`/`critical`/`regression`).

#### Step 1 — `cli6-json-report`: -o/--output — The Full JSON Report

| Field | Value |
|---|---|
| `title` | -o/--output — The Full JSON Report |
| `description` | "This is the report every other format is derived from — the full picture: run config, aggregate summary, and one entry per individual request with its status, timing breakdown, response body, and headers. If you're scripting anything on top of RedfireForge (a custom dashboard, a diffing tool), this is the format to parse." |
| `terminalCommand` | `redfireforge run examples/cli-basic-test.yaml -o results.json -q` |
| `pauseAfter` | `true` |

`terminalOutput` (real, captured — top-level shape, then one full result entry):
```
  JSON report: results.json
{
  "id": "...", "timestamp": 1755571200000, "config": { "...": "..." },
  "summary": { "tps": 20.3, "avgResponseTime": 49.06, "p50ResponseTime": 37.24, "p95ResponseTime": 141.37, "errorRate": 0, "totalRequests": 9, "successfulRequests": 9, "failedRequests": 0 },
  "results": [
    {
      "id": "r-1",
      "scenarioName": "Get Single User",
      "url": "https://jsonplaceholder.typicode.com/users/1",
      "method": "GET",
      "httpStatus": 200,
      "responseTimeMs": 141.37,
      "passed": true,
      "validationMode": "none",
      "timing": { "dnsLookup": 0, "tcpConnect": 0, "tlsHandshake": 0, "ttfb": 102.81, "download": 1.83, "total": 104.64 },
      "scenarioTags": ["smoke", "critical"]
    }
  ],
  "envName": "demo", "projectName": "CLI Basic Test"
}
```

**Note:** the real `responseBody`/`responseHeaders` fields are far larger than shown here (the full JSONPlaceholder response and every real HTTP header, cache/CDN headers included) — trimmed for the demo so the shape reads clearly. Every field is real, just not printed in full. Also worth noting: `responseTimeMs` (141.37) and `timing.total` (104.64) are measured differently internally and don't always match exactly — both are real, just from different timers.

#### Step 2 — `cli6-junit`: --junit — JUnit XML for CI Dashboards

| Field | Value |
|---|---|
| `title` | --junit — JUnit XML for CI Dashboards |
| `description` | "JUnit is the lingua franca of CI test reporting — GitHub Actions, Jenkins, GitLab CI, and most dashboard tools already know how to render this format natively, with zero custom parsing. One `<testcase>` per request, with the tags carried through as an attribute so a dashboard can filter by them too." |
| `terminalCommand` | `redfireforge run examples/cli-basic-test.yaml --junit results.xml -q && cat results.xml` |
| `pauseAfter` | `true` |

`terminalOutput` (real, captured — trimmed to 3 of the 9 `<testcase>` entries):
```xml
<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="CLI Basic Test" tests="9" failures="0" time="0.422">
  <testsuite name="CLI Basic Test" tests="9" failures="0" time="0.422">
    <testcase classname="RedfireForge" name="Get Single User [GET https://jsonplaceholder.typicode.com/users/1]" time="0.149" tags="smoke,critical">
    </testcase>
    <testcase classname="RedfireForge" name="List Users [GET https://jsonplaceholder.typicode.com/users]" time="0.035" tags="smoke,regression">
    </testcase>
    <testcase classname="RedfireForge" name="List Posts [GET https://jsonplaceholder.typicode.com/posts]" time="0.035" tags="regression">
    </testcase>
  </testsuite>
</testsuites>
```

**Note:** 9 `<testcase>` entries from only 3 declared tests — same "assertion/request count, not test count" nuance from CLI-1's console summary. Each of the 3 tests appears 3 times (the default iteration count), and a failed assertion would show up as a `<failure>` child element inside its `<testcase>` — not demonstrated here since this run is clean.

#### Step 3 — `cli6-markdown`: --markdown — A Ready-to-Paste PR Comment

| Field | Value |
|---|---|
| `title` | --markdown — A Ready-to-Paste PR Comment |
| `description` | "Same run, formatted for a human reading a pull request instead of a machine parsing XML — a title, a metrics table, the timing breakdown, and a pass/fail banner. Post this as a PR comment via a CI step and reviewers get the performance picture without opening a dashboard." |
| `terminalCommand` | `redfireforge run examples/cli-basic-test.yaml --markdown results.md -q && cat results.md` |
| `pauseAfter` | `true` |

`terminalOutput` (real, captured, trimmed to the fields shown in the lesson's terminal):
```markdown
# CLI Basic Test

**Environment:** demo
**Mode:** batch | Concurrency: 1 | Iterations: 3

## Summary

| Metric | Value |
|---|---|
| **TPS** | 20.86 |
| **Avg Response** | 47.73 ms |
| **P50** | 37.2 ms |
| **Error Rate** | 0% |
| **Total Requests** | 9 |
| **Tags** | critical, regression, smoke |

## Timing Breakdown (avg)

| Phase | Avg (ms) |
|---|---|
| **TTFB** | 44.4 |
| **Download** | 0.79 |

## Result: PASSED ✅
```

**Note:** the `**Mode:** batch | Concurrency: 1` line reflects the [NOTE-2 fix](#note-2-low-sequential-modes-header-showed-a-c-value-it-didnt-use--fixed) — it now shows the real, honored concurrency for whatever mode was used, not a stale config value.

#### Step 4 — `cli6-quiet`: -q — Quiet Mode for Log-Limited CI Runners

| Field | Value |
|---|---|
| `title` | -q — Quiet Mode for Log-Limited CI Runners |
| `description` | "Compare the same run with and without `-q`. Without it, the CLI echoes the loaded file, test count, and suite name before anything runs — useful locally, noisy in a CI log that already shows the command being run. With `-q`, only the final summary (and, per NOTE-1's fix, any threshold-exceeded explanation) survives." |
| `terminalCommand` | `redfireforge run examples/cli-basic-test.yaml` (no flag) vs. the same command with `-q` |
| `pauseAfter` | `true` |

`terminalOutput` (real, captured — header lines present without `-q`):
```
  Loading: cli-basic-test.yaml
  Tests:   3
  Suite:   CLI Basic Test
  Mode:    batch (C:1 I:3)
```

With `-q`, none of the above prints — the run jumps straight to the final summary block.

#### Step 5 — `cli6-github-actions`: A Real CI Job

| Field | Value |
|---|---|
| `title` | A Real CI Job |
| `description` | "Here's all four report/quiet concepts wired into an actual GitHub Actions workflow, straight from `docs/guides/cli-ci-cd.md` — checkout, setup-node, run with `--junit` + `--fail-on-error` + `-q`, upload the XML as a build artifact, then hand it to a JUnit-rendering action so failures show up natively in the GitHub Actions UI, not buried in a log." |
| `terminalCommand` | `cat docs/guides/cli-ci-cd.md` (excerpt shown, since this is documentation content, not a live `.github/workflows/*.yml` file in this repo) |
| `pauseAfter` | `true` |

`terminalOutput` (real file contents, `docs/guides/cli-ci-cd.md`'s "Basic Test Job (Using npm Package)" section):
```yaml
name: API Performance Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  performance-test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Run API tests
        run: |
          npx redfireforge-cli run tests/api-test.yaml \
            --concurrency 5 \
            --iterations 100 \
            --junit test-results.xml \
            --fail-on-error \
            -q

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: test-results
          path: test-results.xml

      - name: Publish Test Report
        uses: mikepenz/action-junit-report@v4
        if: always()
        with:
          report_paths: 'test-results.xml'
```

**Narration beats:** `if: always()` on both the upload and publish steps — so a failing run still gets its report published, which is the whole point (a green run needs no report, a red one needs the detail). `--fail-on-error` is what makes the run step actually fail the job, giving the JUnit action something to report on.

#### Step 6 — `cli6-recap`: Choosing Report Formats

| Field | Value |
|---|---|
| `title` | Choosing Report Formats |
| `description` | "Recap, no execution" (bulleted: **JSON** — anything you're going to parse programmatically, dashboards/custom diffing; **JUnit** — CI systems with a built-in test-report UI, almost all of them; **Markdown** — a PR comment a human will read; **`--data-rows-summary`** (from CLI-5) — per-row pass/fail in a parameterized CI gate). "They're additive — a single run can emit all four at once." |
| `terminalCommand` | none — a comment-only cheat sheet plus one example command combining all four report flags is shown instead, consistent with CLI-3's `cli3-recap` precedent |
| `pauseAfter` | `true` |

`terminalOutput`:
```
# -o results.json      → parse programmatically (dashboards, diffing)
# --junit results.xml  → CI systems with a built-in test-report UI
# --markdown results.md → a PR comment a human will read
# --data-rows-summary  → per-row pass/fail in a parameterized CI gate
#
# All additive — one run can emit all four at once:
$ redfireforge run examples/cli-basic-test.yaml -o r.json --junit r.xml --markdown r.md --data-rows-summary r-rows.json -q
```

**Cleanup:** delete `results.json`, `results.xml`, `results.md`.

---

## CLI-7: SLA Targets as Quality Gates

**Goal:** Encode performance SLAs as a JSON file and fail CI when they're violated — independent of pass/fail assertions.

**✅ Implemented** (`packages/demo-hub/src/lessons/cli/cli-sla-gates.ts`, id `cli-sla-gates`). Uses the short `redfireforge` command like CLI-1–6. Adds a concept diagram: "Test Run" diverges into "Assertions" (correctness, pass/fail) and "SLA Targets" (performance, pass/warn/fail), both converging into an "exit code priority" box listing `4 SLA fail > 3 both > 2 regression > 1 test fail`, `0 = clean run` — the priority order was cross-checked directly against `cli/index.ts`'s actual exit logic (`// ── Exit code (priority: SLA=4 > both=3 > regression=2 > failure=1)`), not assumed. Step 3's temp SLA config (`/tmp/sla-targets-demo.json`) is a full copy of the real fixture with only `get-posts-p95` (`warnAt: 5`) and `get-users-p95` (`value: 5`) modified — never committed.

**✅ Update: the flaky fixture is fixed.** `examples/sla-jsonplaceholder-targets.json`'s `create-post-tps` target originally used `>= 10 req/s`, which was **not deterministic** against the live `jsonplaceholder.typicode.com` API — with the fixture's `iterations: 1`, a single scenario's TPS is really just `1000 / responseTimeMs`, a one-sample rate that happened to sit right in the noisy zone of realistic single-request latency (measured 5.3, 10.1, 16+, 19.0 req/s across separate runs, flipping pass/fail each time). **Fixed:** the threshold is now `>= 100 req/s` — well beyond what any real HTTPS round-trip over the internet can hit (would require sub-10ms latency) — so it now **deterministically fails every run**, verified across 3 repeated real executions (17.0/17.3/18.4/18.9 req/s, all failing against the 100 req/s floor). The fixture's own header comment now documents why. This preserves the file's stated "mix of passing and failing targets" purpose, just reproducibly.

| Field | Value |
|---|---|
| `id` | `cli-sla-gates` |
| `domainId` | `cli` |
| `category` | `reliability` |
| `estimatedMinutes` | 5 |
| `desktopOnly` | `false` |
| `tag` | none |

### Concept Slide

| Field | Value |
|---|---|
| `title` | SLA Targets as Quality Gates |
| `body` | "Pass/fail assertions check *correctness* — did the response look right. SLA targets check *performance* — was it fast enough, reliable enough. They're evaluated independently, after the run, against the same summary metrics the console already prints. A test suite can be 100% functionally correct and still fail its SLA gate — that's the point." |
| `keyTerms` | `SlaTarget` — one JSON object per gate: a metric, an operator, a threshold, optionally scoped to a feature group or a single scenario; `warnAt` — an optional stricter threshold that produces a `warn` (⚠) status short of an outright `fail` (✗) |

### Steps

#### Step 1 — `cli7-sla-shape`: The `SlaTarget[]` Shape

| Field | Value |
|---|---|
| `title` | The `SlaTarget[]` Shape |
| `description` | "8 real targets, each independently scoped: one applies to the whole feature group (`featureGroupName`), the rest each target one named scenario (`scenarioName` — matching a test's `name:`, not its `scenario:` grouping field, worth calling out since the two look similar). Metrics span `p95`, `tps`, `errorRate`, and `avg` — whatever the summary already computes." |
| `terminalCommand` | `cat examples/sla-jsonplaceholder-targets.json` |
| `verify` | n/a |
| `pauseAfter` | `true` |

`terminalOutput` (real file contents, all 8 targets):
```json
[
  { "id": "sla-fg-p95", "metric": "p95", "operator": "lte", "value": 2000, "label": "Feature Group P95 SLA", "featureGroupName": "SLA Test Suite" },
  { "id": "create-post-p95", "metric": "p95", "operator": "lte", "value": 1000, "label": "Create Post P95", "scenarioName": "Create Post" },
  { "id": "create-post-tps", "metric": "tps", "operator": "gte", "value": 100, "label": "Create Post TPS", "scenarioName": "Create Post" },
  { "id": "create-post-error-rate", "metric": "errorRate", "operator": "lte", "value": 2, "label": "Create Post Error Rate", "scenarioName": "Create Post" },
  { "id": "get-posts-p95", "metric": "p95", "operator": "lte", "value": 1500, "label": "Posts P95", "scenarioName": "Get Posts" },
  { "id": "get-users-p95", "metric": "p95", "operator": "lte", "value": 500, "label": "Users P95", "scenarioName": "Get Users" },
  { "id": "get-users-error-rate", "metric": "errorRate", "operator": "lte", "value": 1, "label": "Users Error Rate", "scenarioName": "Get Users" },
  { "id": "update-post-avg", "metric": "avg", "operator": "lte", "value": 600, "label": "Update Post Avg Latency", "scenarioName": "Update Post" }
]
```

`terminalHighlightLines`: `featureGroupName` on the first target vs. `scenarioName` on the rest — the two different scoping levels. Also worth a beat on `create-post-tps`'s `value: 100` — deliberately set beyond any realistic single-request latency floor so this target reliably fails every run (see the fixture's own header comment for why).

#### Step 2 — `cli7-run-with-sla`: `--sla-config`

| Field | Value |
|---|---|
| `title` | `--sla-config` |
| `description` | "Run the fixture's own documented command. The SLA report prints as its own block after the console summary, one line per target: metric, actual value, and the threshold it was checked against. `Create Post TPS` reliably fails every run — its 100 req/s floor is deliberately unreachable over a real network, so this is a reproducible violation, not a flaky one." |
| `terminalCommand` | `redfireforge run examples/sla-jsonplaceholder-test.yaml --sla-config examples/sla-jsonplaceholder-targets.json -m sequential --timeout 30 -o results.json` |
| `verify` | output contains `SLA Evaluation:` and `✗ Create Post TPS` |
| `pauseAfter` | `true` |

`terminalOutput` (real, captured — one actual run; the console summary is omitted here, shown fully in CLI-1):
```
  SLA Evaluation:
  ─────────────────────────────────────────────────────────────
  ✓ Feature Group P95 SLA [FG: SLA Test Suite]      247.8ms  (target: <= 2000ms)
  ✓ Create Post P95 [Create Post]                   247.8ms  (target: <= 1000ms)
  ✗ Create Post TPS [Create Post]                  4.0req/s  (target: >= 100req/s)
  ✓ Create Post Error Rate [Create Post]               0.0%  (target: <= 2%)
  ✓ Posts P95 [Get Posts]                            38.3ms  (target: <= 1500ms)
  ✓ Users P95 [Get Users]                            35.4ms  (target: <= 500ms)
  ✓ Users Error Rate [Get Users]                       0.0%  (target: <= 1%)
  ✓ Update Post Avg Latency [Update Post]            98.9ms  (target: <= 600ms)
  ─────────────────────────────────────────────────────────────
  ✗ SLA: 1 violation, 7 passing
```

**Narration close:** "The console summary's own `Result: PASSED ✅` (functional correctness) is completely independent of the SLA block's `✗ SLA: 1 violation` (performance) — two separate gates. Re-run this exact command as many times as you like: `Create Post TPS` fails every time, deterministically, because its threshold is set beyond what a real network round-trip can achieve."

#### Step 3 — `cli7-tighten-sla`: Trigger a Warning, Deterministically

| Field | Value |
|---|---|
| `title` | Trigger a Warning, Deterministically |
| `description` | "Rather than fight the TPS target's flakiness, switch to a latency-based one — p95/avg proved reliably reproducible across every run in this research. Add a `warnAt` to the Posts P95 target, tighter than its `value` — real p95 for this fixture is consistently well under 100ms, so `warnAt: 5` guarantees a `warn`, every single time." |
| `terminalCommand` | edit a temp copy: `sla-targets-demo.json`'s `get-posts-p95` target gains `"warnAt": 5`, plus `get-users-p95`'s `value` tightened to `5` (guarantees a hard fail too, shown together) — then `redfireforge run examples/sla-jsonplaceholder-test.yaml --sla-config /tmp/sla-targets-demo.json -m sequential --timeout 30` |
| `verify` | output contains `⚠ Posts P95` and `✗ Users P95` |
| `pauseAfter` | `true` |

`terminalOutput` (real, captured — all three states, pass/warn/fail, in one deterministic run):
```
  SLA Evaluation:
  ─────────────────────────────────────────────────────────────
  ✓ Feature Group P95 SLA [FG: SLA Test Suite]      142.0ms  (target: <= 2000ms)
  ✓ Create Post P95 [Create Post]                    63.5ms  (target: <= 1000ms)
  ✗ Create Post TPS [Create Post]                 15.7req/s  (target: >= 100req/s)
  ✓ Create Post Error Rate [Create Post]               0.0%  (target: <= 2%)
  ⚠ Posts P95 [Get Posts]                           142.0ms  (target: <= 1500ms (warn <= 5ms))
  ✗ Users P95 [Get Users]                            35.2ms  (target: <= 5ms)
  ✓ Users Error Rate [Get Users]                       0.0%  (target: <= 1%)
  ✓ Update Post Avg Latency [Update Post]            66.5ms  (target: <= 600ms)
  ─────────────────────────────────────────────────────────────
  ✗ SLA: 2 violations, 1 warning, 5 passing
```

**Narration close:** "⚠ means 'past the stricter `warnAt` line but still under the hard `value` limit' — a heads-up, not a failure. `✗` means the hard limit itself was breached. The overall line at the bottom rolls all three states up: any `✗` makes the whole run `✗`, `⚠` only shows through when nothing failed outright."

#### Step 4 — `cli7-fail-on-sla`: `--fail-on-sla`

| Field | Value |
|---|---|
| `title` | `--fail-on-sla` |
| `description` | "Back to the real, committed fixture — no temp file needed here, since `Create Post TPS` now reliably fails on its own. Add `--fail-on-sla` and `-q` to match a real CI invocation. The SLA report — pass, warn, fail, all of it — is a display-only concept without this flag; `--fail-on-sla` is what turns a `✗` into an actual non-zero exit code a pipeline can gate on. The report itself now survives `-q` whenever it's the reason the process is about to exit non-zero." |
| `terminalCommand` | `redfireforge run examples/sla-jsonplaceholder-test.yaml --sla-config examples/sla-jsonplaceholder-targets.json -m sequential --timeout 30 --fail-on-sla -q; echo "exit: $?"` |
| `verify` | output contains `✗ Create Post TPS` and `exit: 4` |
| `pauseAfter` | `true` |

`terminalOutput` (real, captured — real committed fixture, unmodified):
```
  Result:       PASSED ✅

  SLA Evaluation:
  ──────────────────────────────────────────────────
  ✓ Feature Group P95 SLA [FG: SLA Test Suite]      206.8ms  (target: <= 2000ms)
  ✓ Create Post P95 [Create Post]                    53.5ms  (target: <= 1000ms)
  ✗ Create Post TPS [Create Post]                 18.7req/s  (target: >= 100req/s)
  ✓ Create Post Error Rate [Create Post]               0.0%  (target: <= 2%)
  ✓ Posts P95 [Get Posts]                            32.4ms  (target: <= 1500ms)
  ✓ Users P95 [Get Users]                            33.1ms  (target: <= 500ms)
  ✓ Users Error Rate [Get Users]                       0.0%  (target: <= 1%)
  ✓ Update Post Avg Latency [Update Post]            58.2ms  (target: <= 600ms)
  ──────────────────────────────────────────────────
  ✗ SLA: 1 violation, 7 passing

exit: 4
```

**History worth narrating:** this used to require a synthetic, tightened temp config to get a reliable fail — the real fixture's own `Create Post TPS` target was flaky. Both are fixed now: the report survives `-q` (NOTE-3), and the fixture itself deterministically fails every run (this fix) — so this step runs the exact same command anyone following the fixture's own header comment would type, no workaround file required.

#### Step 5 — `cli7-priority`: Exit Code Priority

| Field | Value |
|---|---|
| `title` | Exit Code Priority |
| `description` | "Recap, no execution: SLA failure (exit 4) outranks everything else — regression + test failure together (3), regression alone (2), plain test failure (1). Design intent: a performance regression against your own history, or a hard SLA breach, are treated as more serious than an individual assertion failing, because they represent systemic problems rather than one broken test." |
| `terminalCommand` | none (concept recap, no terminal action) |
| `verify` | n/a |
| `pauseAfter` | `true` |

**Cleanup:** delete the temp `/tmp/sla-targets-demo.json` and generated `results.json` — `examples/sla-jsonplaceholder-targets.json` is never modified on disk.

---

## CLI-8: Baselines & Regression Detection

**Goal:** Save a known-good run as a baseline, then detect performance regressions against it in later runs — the CLI's answer to "did this PR make things slower?"

**✅ Implemented** (`packages/demo-hub/src/lessons/cli/cli-baseline-regression.ts`, id `cli-baseline-regression`). Uses the short `redfireforge` command like CLI-1–7. Adds a concept diagram: "Run 1 (baseline)" and "Run 2 (later)" converge into a "Regression Report" box, flowing down into an exit-code-priority box. One correction found during re-capture: baselines are matched by the test file's exact **path**, not by scenario name — so Step 5's "combined regression + failure" demo edits the same `health-test.yaml`'s URL in place to point at a nonexistent route (rather than creating a differently-named file), otherwise `latest-baseline` can't find a match and the regression check is silently skipped. Also worth flagging: the real regression-report table has a genuine formatting quirk — every latency-metric row's percentage-change cell is missing its closing parenthesis before the status column (`+750.49 ms (+698.46%  🔴 CRITICAL`), while the TPS row's is correctly closed (`(-87.46%)`) — reproduced verbatim below, not corrected, since the goal is byte-accurate real output.

**⚠️ Significant finding from hands-on verification, discovered while building this lesson — see BUG-5 in the [triage section](#bugs--gaps-discovered-during-research-need-triage).** The original draft's Step 5 planned to "combine with a failing assertion" to demonstrate exit code 3. Testing that directly revealed a major, previously-undiscovered bug: **every top-level `assertions:` block in the CLI's example fixtures (`cli-basic-test.yaml`, `cli-error-handling.yaml`, `cli-assertions.yaml`, `cli-load-profile.yaml`, `cli-parameterized.yaml`, `sla-jsonplaceholder-test.yaml` — 6 files, 26 declared assertion blocks) is silently ignored by the CLI loader.** `cli/loader.ts`'s `TestFileScenario` interface has no top-level `assertions` field — only a nested `validation: { assertions: [...] }` is recognized. Verified with a deliberately-failing `jsonPath` assertion (`$.ok == false` against a real `{"ok":true}` response): `Passed: 1, Failed Valid: 0, Result: PASSED ✅` — proof the assertion was never evaluated. Every "Passed"/"Failed Valid" count shown in every prior CLI-1 through CLI-7 lesson step has been driven purely by raw HTTP status (2xx vs. not), never by the fixtures' declared custom assertions. Step 5 below uses a genuine HTTP-level failure instead, and this finding is filed as BUG-5 for the team to triage — not fixed as part of this lesson pass.

| Field | Value |
|---|---|
| `id` | `cli-baseline-regression` |
| `domainId` | `cli` |
| `category` | `reliability` |
| `estimatedMinutes` | 6 |
| `desktopOnly` | `false` |
| `tag` | none |

### Concept Slide

| Field | Value |
|---|---|
| `title` | Baselines & Regression Detection |
| `body` | "A baseline is just a saved snapshot of a run's summary metrics — response times, TPS, error rate — tagged with a label and timestamp. `--compare-baseline` re-runs the same test and diffs the new summary against that snapshot, metric by metric, flagging anything that got meaningfully worse. This is how a CI pipeline answers 'did this PR make the API slower?' without a human eyeballing dashboards." |
| `keyTerms` | `--save-baseline` — only saves when the run itself is clean (no failures, no regressions) — a dirty run is never a reference point; `--compare-baseline latest-baseline` — auto-picks the most recent baseline for this exact test file path |
| `diagram` | "Run 1 (baseline)" and "Run 2 (later)" converge into a "Regression Report" box, flowing down into an exit-code box: `0 clean / 1 test fail / 2 regression / 3 both` |

### Steps

All 6 steps use a one-off demo fixture (not committed) — the repo's only API Mock workspace, `examples/api-mock/sample-workspace.json`, has a single `GET /health` route with a `behavior.delayMs` field, which two temp copies tune to `50` (fast) and `800` (slow) to make the regression deterministic instead of depending on live third-party API timing.

#### Step 1 — `cli8-fast-mock`: Start the "Fast" Mock

| Field | Value |
|---|---|
| `title` | Start the "Fast" Mock |
| `description` | "Two temp copies of the repo's one API Mock workspace, differing only in `behavior.delayMs` on the `/health` route: 50ms (fast) and 800ms (slow). Start the fast one first — this is what today's 'known-good' baseline will be measured against." |
| `terminalCommand` | `redfireforge mock start /tmp/mock-fast.json --standalone` (background) |
| `pauseAfter` | `true` |

`terminalOutput` (real, captured):
```json
{
  "ready": true,
  "results": [
    { "serverId": "srv-demo", "ok": true, "port": 4650, "mode": "standalone" }
  ]
}
In-process listeners keep this process alive. Press Ctrl+C to stop.
```

#### Step 2 — `cli8-save-baseline`: Save a Baseline

| Field | Value |
|---|---|
| `title` | Save a Baseline |
| `description` | "Run a one-test fixture against the fast mock's `/health` route, with `--save-baseline` and a human-readable `--baseline-label`. Only a clean run — no failures, no existing regressions — actually gets saved; a dirty run is never worth using as a future reference point." |
| `terminalCommand` | `redfireforge run health-test.yaml --save-baseline --baseline-label "pre-change" --baselines-dir /tmp/cli8-baselines` |
| `pauseAfter` | `true` |

`terminalOutput` (real, captured):
```
  Total:        1
  Passed:       1
  Result:       PASSED ✅

  Baseline saved (pre-change): f1a87917-d97d-4125-84fd-1c87de597999
```

**Note:** `--baselines-dir` here points at a temp directory rather than the default `.redfireforge/baselines` — good practice for a demo (and for CI matrix runs that shouldn't cross-contaminate baseline stores), not required for everyday local use.

#### Step 3 — `cli8-slow-mock`: Restart as the "Slow" Mock

| Field | Value |
|---|---|
| `title` | Restart as the "Slow" Mock |
| `description` | "Stop the fast mock, start the slow variant on the same port — same route, same response body, only the artificial delay changed from 50ms to 800ms. This stands in for a real regression: a PR that adds an accidental N+1 query, a new blocking call, whatever made the endpoint slower without changing its correctness." |
| `terminalCommand` | Ctrl+C the fast mock, then `redfireforge mock start /tmp/mock-slow.json --standalone` |
| `pauseAfter` | `true` |

`terminalOutput` (real, captured):
```json
{
  "ready": true,
  "results": [
    { "serverId": "srv-demo", "ok": true, "port": 4650, "mode": "standalone" }
  ]
}
```

#### Step 4 — `cli8-compare-latest`: --compare-baseline latest-baseline

| Field | Value |
|---|---|
| `title` | --compare-baseline latest-baseline |
| `description` | "Re-run the identical command against the now-slow mock, with `--compare-baseline latest-baseline` instead of `--save-baseline` — auto-picks the most recent baseline saved for this exact test file. The regression report is a full metric-by-metric table: baseline value, current value, delta, percent change, severity." |
| `terminalCommand` | `redfireforge run health-test.yaml --compare-baseline latest-baseline --baselines-dir /tmp/cli8-baselines` |
| `pauseAfter` | `true` |

`terminalOutput` (real, captured — note the missing closing parenthesis on every latency row's percentage cell, a genuine formatting quirk, reproduced verbatim):
```
  ──────────────────────────────────────────────────────────────────────────────
  Performance Regression Report
  Baseline : pre-change
  Current  : 8/18/2026, 10:46:28 PM
  ──────────────────────────────────────────────────────────────────────────────
  Metric                    Baseline      Current       Δ           Status
  ──────────────────────────────────────────────────────────────────────────────
  Avg Response Time         107.45 ms     857.94 ms     +750.49 ms (+698.46%  🔴 CRITICAL
  P50 Response Time         107.45 ms     857.94 ms     +750.49 ms (+698.46%  🔴 CRITICAL
  P95 Response Time         107.45 ms     857.94 ms     +750.49 ms (+698.46%  🔴 CRITICAL
  P99 Response Time         107.45 ms     857.94 ms     +750.49 ms (+698.46%  🔴 CRITICAL
  P99.9 Response Time       107.45 ms     857.94 ms     +750.49 ms (+698.46%  🔴 CRITICAL
  Min Response Time         107.45 ms     857.94 ms     +750.49 ms (+698.46%  🔴 CRITICAL
  Max Response Time         107.45 ms     857.94 ms     +750.49 ms (+698.46%  🔴 CRITICAL
  TPS                       9.25          1.16          -8.09 (-87.46%)       🔴 CRITICAL
  Error Rate                0%            0%            0 pp (0%)             — ok
  ──────────────────────────────────────────────────────────────────────────────
  ⚠  Regressions: 8 critical
```

**Narration close:** "Every latency percentile moved together (they're all derived from the same single, slow request in this minimal demo) — +698.46% response time, -87.46% throughput. Error rate stayed at 0% — this is a performance regression, not a correctness one, and the report tells them apart."

#### Step 5 — `cli8-fail-on-regression`: --fail-on-regression

| Field | Value |
|---|---|
| `title` | --fail-on-regression |
| `description` | "Same comparison, now gating on it. `--fail-on-regression` turns a detected regression into exit code 2. To get exit 3 (regression and a functional failure together), the same test file's URL is pointed at a route that doesn't exist — a genuine HTTP-level failure — still against the slow mock, still compared against the same baseline. Important: baselines are matched by the test file's exact **path**, not by scenario name, so the URL inside `health-test.yaml` is edited in place rather than saving the modified test under a new filename — otherwise `latest-baseline` finds no match and the regression check is silently skipped entirely." |
| `terminalCommand` | `redfireforge run health-test.yaml --compare-baseline latest-baseline --baselines-dir /tmp/cli8-baselines --fail-on-regression -q; echo "exit: $?"` then the same command with `health-test.yaml`'s own URL edited in place to a nonexistent route and `--fail-on-error` added |
| `pauseAfter` | `true` |

`terminalOutput` (real, captured — regression only):
```
exit: 2
```

`terminalOutput` (real, captured — regression + a genuine HTTP failure, combined):
```
  Total:        1
  Passed:       0
  Failed HTTP:  1
  Error Rate:   100%
  Result:       FAILED ❌
exit: 3
```

**Real gotcha worth narrating:** in this second run, response time actually improved (27.58ms vs. the 107.45ms baseline — a 404 against a nonexistent route returns fast, it never reaches the slow handler). The regression that triggered here was **Error Rate** (0% → 100%, flagged 🔴 CRITICAL), not latency — a different metric than Step 4's demo, but the same mechanism: any tracked metric crossing its threshold counts as a regression, and combined with `--fail-on-error`'s functional failure, that's what produces exit 3 rather than 2.

#### Step 6 — `cli8-comparison-report`: --comparison-report

| Field | Value |
|---|---|
| `title` | --comparison-report |
| `description` | "The same comparison, written to a Markdown file — for a PR comment, same spirit as CLI-6's `--markdown` test report. A regressions table lists only the metrics that actually crossed a threshold, with severity and the exact delta." |
| `terminalCommand` | `redfireforge run health-test.yaml --compare-baseline latest-baseline --baselines-dir /tmp/cli8-baselines --comparison-report comparison.md -q && cat comparison.md` |
| `pauseAfter` | `true` |

`terminalOutput` (real, captured — the exit-3 run's comparison report):
```markdown
# Performance Comparison Report

| | |
|:---|:---|
| **Baseline** | pre-change |

> ⚠ **1 regression detected** (1 critical)

## Metric Deltas

| Metric | Baseline | Current | Delta | Change | Status |
|:---|---:|---:|---:|---:|:---|
| Avg Response Time | 107.45 ms | 27.88 ms | -79.57 ms | -74.05% | ✓ Improved |
| TPS | 9.25 | 34.96 | +25.71 | +277.95% | ✓ Improved |
| Error Rate | 0% | 100% | +100 pp | 0% | 🔴 Critical |

## Regressions

| Metric | Severity | Threshold | Actual |
|:---|:---|---:|---:|
| Error Rate | 🔴 Critical | 1 pp | +100 pp |
```

**Note:** the report lists every metric's delta (including the ones that improved) but only surfaces the actual triggers in the dedicated `## Regressions` table at the bottom — worth pointing out so a viewer doesn't assume the whole table is "the regressions."

**Cleanup:** stop the mock listener, delete the temp baselines dir and generated report files.

---

## CLI-9: Workflow Performance Testing

**Goal:** The `workflow` command — same graph engine as the Workflow Designer's Quick Test, run headlessly at load: multiple HTTP nodes per iteration, `--var` overrides, conditional branching, and fork/join concurrency, all measured the same way `run` measures a flat test file.

**✅ Implemented** (`packages/demo-hub/src/lessons/cli/cli-workflow-command.ts`, id `cli-workflow-command`). Uses the short `redfireforge` command like CLI-1–8. Adds a concept diagram: a mini node chain (Start → HTTP → HTTP → End) representing the workflow graph, flowing into a `workflow <file> -i N -c C` box, then a "Per-Step Metrics (per node, not per scenario)" box, with a caption clarifying Fork/Join's iteration-internal parallelism vs. `-c`. Step 5's trace-output sample was corrected against the real JSON shape — the actual per-node event nests `request`/`response` under a `details` object (`details.request`, `details.response`), not at the event's top level as the original draft assumed; the lesson now shows the genuine nested shape and a direct side-by-side of the same event at `full` vs. the default `standard` trace level.

**⚠️ Significant finding from hands-on verification, discovered while building this lesson — see BUG-8 and BUG-9 in the [triage section](#bugs--gaps-discovered-during-research-need-triage).** Step 3's originally-planned fixture (`workflow-cli-conditional.yaml`) turned out to be silently non-functional — its Switch node used a schema (`cases[].targetNodeId`, `defaultTargetNodeId`) that doesn't exist anywhere in the real workflow types, so every branch was skipped on every run regardless of the `--var country=...` value. Fixed as BUG-8 (now genuinely demonstrates branch changes). Separately, Step 5's originally-planned `--trace-level full` vs. `standard` comparison turned out to have **zero observable effect** in the CLI at any level — there was no flag to actually view or export the trace data the engine was computing. Fixed as BUG-9 by adding a new `--trace-output <path>` flag; Step 5 below demonstrates the genuine, verified difference between trace levels.

| Field | Value |
|---|---|
| `id` | `cli-workflow-command` |
| `domainId` | `cli` |
| `category` | `execution` |
| `estimatedMinutes` | 5 |
| `desktopOnly` | `false` |
| `tag` | none |

### Concept Slide

| Field | Value |
|---|---|
| `title` | Workflow Performance Testing |
| `body` | "A `run` test file is a flat list of independent scenarios. A workflow is a graph — nodes connected by edges, with branching (Switch), parallelism (Fork/Join), and shared variables that carry state from one HTTP call to the next. The `workflow` command runs that exact same graph the Workflow Designer's Quick Test runs, but headlessly and at load: N iterations, C concurrent, same metrics engine as `run`, just attributed per-node instead of per-scenario." |
| `keyTerms` | `--var name=value` — override any workflow variable from the command line, same mechanism CI would use to parameterize a run; **Fork/Join** — parallel branches within a single iteration, not to be confused with `-c`/`--concurrency`'s *iteration-level* parallelism |

### Steps

#### Step 1 — `cli9-workflow-file`: The Workflow File

| Field | Value |
|---|---|
| `title` | The Workflow File |
| `description` | "A workflow file is nodes + edges + variables — the same JSON/YAML the Designer canvas saves and loads. `examples/workflow-cli-sample.yaml` has a Start node, two HTTP nodes (`Get Users`, `Get Posts`), and an End node, chained by three edges. HTTP nodes support two shapes: this file's simplified form (`method`/`url`/`headers` directly under `data`), or a full nested `scenario` object when a node needs the complete Scenario structure (auth, validation, data sources, etc.)." |
| `terminalCommand` | `redfireforge validate-workflow examples/workflow-cli-sample.yaml` |
| `verify` | output contains `✅ Valid workflow` |
| `pauseAfter` | `true` |

`terminalOutput` (real, captured):
```
  ✅ Valid workflow: workflow-cli-sample.yaml
  Name: JSONPlaceholder Test Workflow
  Nodes: 4 total, 2 HTTP
  Edges: 3
  Variables: baseUrl
```

**Note:** `validate-workflow` only reports structural counts — it doesn't inspect node-type-specific config (e.g. whether a Switch node's cases actually have matching edges). BUG-8 below is a real example of a workflow that passes this check cleanly while being non-functional at runtime.

#### Step 2 — `cli9-run-workflow`: `workflow <file>`

| Field | Value |
|---|---|
| `title` | `workflow <file>` |
| `description` | "Same shape as `run`, different unit of work: instead of N scenarios × 1 request each, this is N iterations × however many HTTP nodes the graph visits per iteration. `-i 20 -c 4` runs 20 full iterations of the 2-node graph, 4 iterations concurrently at a time — 40 total HTTP requests, attributed back to their originating node in Per-Step Metrics." |
| `terminalCommand` | `redfireforge workflow examples/workflow-cli-sample.yaml -i 20 -c 4` |
| `verify` | output contains `Total Steps:  40` and `Result:       PASSED ✅` |
| `pauseAfter` | `true` |

`terminalOutput` (real, captured):
```
  Loading: workflow-cli-sample.yaml
  Workflow: JSONPlaceholder Test Workflow
  Steps:    2 HTTP nodes
  Variables: 1
    baseUrl=https://jsonplaceholder.typicode.com
  Mode:    workflow (I:20 C:4)

──────────────────────────────────────────────────
  RedfireForge — Workflow Test Run Summary
──────────────────────────────────────────────────
  Workflow:     JSONPlaceholder Test Workflow
  Mode:         workflow (I:20 C:4)
  Duration:     0.59s
  Iterations/s: 33.78
  Avg Response: 56.29 ms
  P50:          38.8 ms
  P95:          172.97 ms
  P99:          173.57 ms
  P99.9:        173.57 ms
──────────────────────────────────────────────────
  Total Steps:  40
  Passed:       40
  Failed:       0
  Error Rate:   0%
──────────────────────────────────────────────────
  Per-Step Metrics:
    Get Users: avg=65ms p95=173.57ms (100% pass)
    Get Posts: avg=47ms p95=105.51ms (100% pass)
──────────────────────────────────────────────────
  Result:       PASSED ✅
──────────────────────────────────────────────────
```

**Narration:** "`Total Steps: 40` is 20 iterations × 2 HTTP nodes, not 20 — this is the key difference from `run`'s `Total`. Per-Step Metrics breaks latency down by node, the same way SLA targets in CLI-7 broke it down by scenario."

#### Step 3 — `cli9-vars`: `--var name=value`

| Field | Value |
|---|---|
| `title` | `--var name=value` |
| `description` | "`workflow-cli-conditional.yaml` has a Switch node that routes on the `country` variable: `germany` and `japan` each take their own branch, anything else falls to a default branch. `--var country=...` overrides the file's own default (`france`) from the command line — the same mechanism a CI pipeline would use to run the same workflow file against different inputs without editing it." |
| `terminalCommand` | `redfireforge workflow examples/workflow-cli-conditional.yaml --var country=germany -i 1 -c 1` then the same command with `--var country=japan` |
| `verify` | first run's Per-Step Metrics contains `European Country`; second run's contains `Asian Country` |
| `pauseAfter` | `true` |

`terminalOutput` (real, captured — `country=germany`):
```
  Variables: 1
    country=germany
  Mode:    workflow (I:1 C:1)

──────────────────────────────────────────────────
  Total Steps:  2
  Passed:       2
  Failed:       0
  Error Rate:   0%
──────────────────────────────────────────────────
  Per-Step Metrics:
    Lookup Country: avg=261ms p95=261.04ms (100% pass)
    European Country: avg=98ms p95=97.91ms (100% pass)
──────────────────────────────────────────────────
  Result:       PASSED ✅
──────────────────────────────────────────────────
```

`terminalOutput` (real, captured — `country=japan`):
```
  Variables: 1
    country=japan
  Mode:    workflow (I:1 C:1)

──────────────────────────────────────────────────
  Total Steps:  2
  Passed:       2
  Failed:       0
  Error Rate:   0%
──────────────────────────────────────────────────
  Per-Step Metrics:
    Lookup Country: avg=251ms p95=250.96ms (100% pass)
    Asian Country: avg=111ms p95=111.04ms (100% pass)
──────────────────────────────────────────────────
  Result:       PASSED ✅
──────────────────────────────────────────────────
```

**Real gotcha worth narrating (BUG-8):** this exact demo was silently broken until this lesson pass — the Switch node's branch targets used a schema that doesn't exist in the workflow engine, so no branch (not even the default) ever executed; every run only ever showed `Lookup Country`. Fixed by routing through real edge `sourceHandle`s and switching the branch decision onto the `{{country}}` variable itself, rather than a field parsed from the `Lookup Country` HTTP response — which also sidesteps the fact that its upstream API (`restcountries.com/v3.1`) is now deprecated and always errors. Worth telling this story on camera: it's a good demonstration of why "verify with a real run" matters even for a file that *looks* correct.

#### Step 4 — `cli9-parallel`: Fork/Join at Load

| Field | Value |
|---|---|
| `title` | Fork/Join at Load |
| `description` | "`workflow-cli-parallel.yaml` fetches a user, then Forks into three parallel branches (posts/todos/albums for that user), then Joins before ending. At `-i 50 -c 5`, that's 50 iterations × 4 HTTP nodes each = 200 total requests, with the three forked branches genuinely firing concurrently within each iteration — not just iterations running in parallel via `-c`." |
| `terminalCommand` | `redfireforge workflow examples/workflow-cli-parallel.yaml -i 50 -c 5 --var userId=3` |
| `verify` | output contains `Total Steps:  200` and all 4 node names in Per-Step Metrics |
| `pauseAfter` | `true` |

`terminalOutput` (real, captured):
```
  Variables: 1
    userId=3
  Mode:    workflow (I:50 C:5)

──────────────────────────────────────────────────
  RedfireForge — Workflow Test Run Summary
──────────────────────────────────────────────────
  Workflow:     Parallel User Data Fetch
  Mode:         workflow (I:50 C:5)
  Duration:     1.03s
  Iterations/s: 48.59
  Avg Response: 47.68 ms
  P50:          35.55 ms
  P95:          164.44 ms
  P99:          200.37 ms
  P99.9:        208.58 ms
──────────────────────────────────────────────────
  Total Steps:  200
  Passed:       200
  Failed:       0
  Error Rate:   0%
──────────────────────────────────────────────────
  Per-Step Metrics:
    Get User: avg=50ms p95=172.76ms (100% pass)
    Get Posts: avg=44ms p95=104.35ms (100% pass)
    Get Todos: avg=48ms p95=176.62ms (100% pass)
    Get Albums: avg=49ms p95=177.22ms (100% pass)
──────────────────────────────────────────────────
  Result:       PASSED ✅
──────────────────────────────────────────────────
```

**Narration:** "`Get User` runs once per iteration (50 total, folded into the 200), then Fork fans out to `Get Posts`/`Get Todos`/`Get Albums` — three concurrent calls per iteration, joined before the iteration counts as complete. Two layers of concurrency here: `-c 5` runs 5 whole iterations at a time, and *within* each iteration, the fork's three branches run concurrently too."

#### Step 5 — `cli9-workflow-reports`: Workflow Reports & `--trace-output`

| Field | Value |
|---|---|
| `title` | Workflow Reports & `--trace-output` |
| `description` | "`--junit`/`--markdown` work the same as `run`, but the shape is iteration-oriented instead of scenario-oriented: JUnit testcases are named `Iteration 1`, `Iteration 2`, ... rather than per-scenario; Markdown's Per-Step Metrics table is the same node breakdown seen in every step above. `--trace-level` (minimal/standard/full/debug) controls how much per-node detail the engine captures, and the new `--trace-output <path>` flag writes that full execution trace — every node visited, its state, timing, and (at `full`/`debug`) the exact request sent and response received — as JSON. This is the same underlying data structure that drives the GUI's Results Explorer visual replay." |
| `terminalCommand` | `redfireforge workflow examples/workflow-cli-sample.yaml -i 5 -c 1 --junit wf.junit.xml --markdown wf.md -q && cat wf.junit.xml && cat wf.md` then `redfireforge workflow examples/workflow-cli-sample.yaml -i 2 -c 1 --trace-level full --trace-output wf-trace.json -q` |
| `verify` | JUnit output contains `<testcase classname="JSONPlaceholder Test Workflow" name="Iteration 1"`; Markdown output contains `## Per-Step Metrics`; trace run prints `Trace:       wf-trace.json` |
| `pauseAfter` | `true` |

`terminalOutput` (real, captured — JUnit):
```xml
<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="JSONPlaceholder Test Workflow" tests="5" failures="0" time="0.474">
  <testsuite name="JSONPlaceholder Test Workflow" tests="5" failures="0" time="0.474">
    <testcase classname="JSONPlaceholder Test Workflow" name="Iteration 1" time="0.200">
    </testcase>
    <testcase classname="JSONPlaceholder Test Workflow" name="Iteration 2" time="0.072">
    </testcase>
    <testcase classname="JSONPlaceholder Test Workflow" name="Iteration 3" time="0.062">
    </testcase>
    <testcase classname="JSONPlaceholder Test Workflow" name="Iteration 4" time="0.061">
    </testcase>
    <testcase classname="JSONPlaceholder Test Workflow" name="Iteration 5" time="0.073">
    </testcase>
  </testsuite>
</testsuites>
```

`terminalOutput` (real, captured — Markdown):
```markdown
# Workflow Test: JSONPlaceholder Test Workflow

**Date:** 2026-08-18T23:31:06.605Z  
**Mode:** workflow | Iterations: 5 | Concurrency: 1  

## Summary

| Metric | Value |
|---|---|
| **Iterations/s** | 10.55 |
| **Avg Response** | 46.8 ms |
| **P50** | 35.78 ms |
| **P95** | 161.43 ms |
| **P99** | 161.43 ms |
| **P99.9** | 161.43 ms |
| **Error Rate** | 0% |
| **Total Steps** | 10 |
| **Duration** | 0.47s |

## Per-Step Metrics

| Step | Count | Avg (ms) | P95 (ms) | Pass Rate |
|---|---|---|---|---|
| Get Users | 5 | 59 | 161.43 | 100% |
| Get Posts | 5 | 35 | 38.49 | 100% |

## Result: PASSED ✅
```

`terminalOutput` (real, captured — `--trace-level full --trace-output wf-trace.json`, then inspecting the file):
```
  Trace:       wf-trace.json
```
```json
{
  "captureLevel": "full",
  "fullTraceCaptured": true,
  "totalIterations": 2
}
--- sample event (Get Posts node, iteration 1, --trace-level full) ---
{
  "nodeId": "get-posts", "nodeLabel": "Get Posts", "state": "pass", "durationMs": 38.74,
  "details": {
    "statusCode": 200, "method": "GET", "url": "https://jsonplaceholder.typicode.com/posts?userId=1",
    "request": { "method": "GET", "url": "https://jsonplaceholder.typicode.com/posts?userId=1", "headers": { "Accept": "application/json" } },
    "response": { "statusCode": 200, "statusText": "200" }
  }
}
--- same event at the default --trace-level (standard) ---
{
  "nodeId": "get-posts", "nodeLabel": "Get Posts", "state": "pass", "durationMs": 38.74,
  "details": { "statusCode": 200, "method": "GET", "url": "https://jsonplaceholder.typicode.com/posts?userId=1" }
  // no "request" / "response" keys at all — only full/debug populate them
}
```

**Note on the real shape (corrected from the original draft):** `request`/`response` are nested under each event's own `details` object (`details.request`, `details.response`), not top-level fields on the event — the original draft's simplified sample had this one level too shallow.

**Real gotcha worth narrating (BUG-9, now fixed):** this exact demo was inert until this lesson pass — `--trace-level` was validated and threaded into the engine correctly, but the CLI's `workflow` action only ever destructured `const { results } = await runGraphLoad(...)`, silently discarding the returned `WorkflowExecutionTrace` (the same structure behind the GUI's Results Explorer replay/heatmap). No flag existed to see or export it, at any level. Fixed by adding `--trace-output <path>` (same pattern as `-o`/`--junit`/`--markdown`) and threading `trace` through to it. Verified the level genuinely matters: the same command with `--trace-level` **omitted** (default `standard`) produces `captureLevel: "standard"`, `fullTraceCaptured: false`, and no `request`/`response` fields on any event at all — only `full`/`debug` populate them.

**Cleanup:** delete `wf.junit.xml`, `wf.md`, `wf-trace.json`.

---

## CLI-10: API Mock Studio, Headless

**Goal:** The `mock` command family — simulate, verify, and start API Mock Studio definitions without the GUI, including Docker.

**✅ Implemented** (`packages/demo-hub/src/lessons/cli/cli-mock-studio.ts`, id `cli-mock-studio`). Uses the short `redfireforge` command like CLI-1–9. Adds a concept diagram: `workspace.json` fans out into `mock simulate` / `mock start` / `mock verify` boxes, with a caption stating live-journal verify only ever talks to companion mode. Step 5's companion-mode capture used the real `src-server` dev server, started on an alternate port (`3002`) in this sandbox since `3001` was occupied by an unrelated environment proxy — both `mock start` and `mock verify` accept a `--control-base <url>` flag for exactly this case. Step 6's Docker content remains statically verified (no Docker daemon available here either, confirmed via `docker info`) against the real, committed Dockerfile and CI guide — same limitation the original research hit.

**⚠️ Finding from hands-on verification, discovered while building this lesson — see NOTE-4 in the [triage section](#bugs--gaps-discovered-during-research-need-triage).** The original draft's Step 5 planned "with the standalone listener still running, curl a route then `mock verify` against the live journal" — but `mock verify`'s live-journal mode only ever talks to the **companion** process's control API (`http://127.0.0.1:3001` by default), never to a `mock start --standalone` in-process listener, which has no control surface at all. Verified: running `mock verify` (no `--simulate`) against a still-running standalone listener fails immediately with `fetch failed`, not a partial/misleading result. Step 5 below uses companion mode instead (`mock start` without `--standalone`, backed by the project's own webhook/schedule server, `npm run server:dev`) — this isn't a bug to fix, the CLI's own error message already correctly names the fix, but it's a real gotcha worth calling out explicitly since the two `mock start` modes look interchangeable at a glance.

| Field | Value |
|---|---|
| `id` | `cli-mock-studio` |
| `domainId` | `cli` |
| `category` | `reliability` |
| `estimatedMinutes` | 7 |
| `desktopOnly` | `false` |
| `tag` | none |
| `dockerCommand` | `docker build -f examples/api-mock/Dockerfile -t redfireforge-api-mock . && docker run --rm -p 4600:4600 redfireforge-api-mock` (Step 6 only) |

### Concept Slide

| Field | Value |
|---|---|
| `title` | API Mock Studio, Headless |
| `body` | "A saved API Mock Studio workspace — servers, routes, responses, and recorded samples — is a portable JSON file. The `mock` command family runs it three ways: `simulate` replays saved samples against the definition with zero network I/O (pure request-matching logic, same engine as the GUI's Simulate button); `start` actually listens on a port, either through the companion dev server or fully in-process (`--standalone`, what Docker/CI use); `verify` asserts against either an offline corpus (`--simulate`) or a live request journal from a running mock." |
| `keyTerms` | `--standalone` — an in-process listener with **no control API**, good for CI containers, bad for anything that needs `mock verify`'s live-journal mode; **companion** — the project's own dev server (`npm run server:dev`), the only thing `mock verify` (live) can ever talk to |

### Steps

#### Step 1 — `cli10-workspace-file`: The Workspace File

| Field | Value |
|---|---|
| `title` | The Workspace File |
| `description` | "`examples/api-mock/sample-workspace.json` is a minimal but complete workspace: one server (`srv-demo`, port 4600), one route (`GET /health`, returns `{"ok":true}`), and one recorded sample with its expected outcome (`matched`, status 200, body contains `ok`). Everything the `mock` commands below operate on lives in this single portable file — the same shape the GUI's API Mock Studio saves and loads." |
| `terminalCommand` | *(no command — this step shows the file directly)* |
| `verify` | n/a |
| `pauseAfter` | `true` |

#### Step 2 — `cli10-simulate`: `mock simulate`

| Field | Value |
|---|---|
| `title` | `mock simulate` |
| `description` | "Offline replay of every saved sample against the workspace's routing/response logic — no listener, no network calls, completely side-effect-free. The output is a full trace per sample: which route matched, why (priority, predicate results), which response was selected, and the exact rendered body — the same diagnostic depth the GUI's Simulate panel shows." |
| `terminalCommand` | `redfireforge mock simulate examples/api-mock/sample-workspace.json` |
| `verify` | output contains `"passed": true` and `Simulated 1 sample(s); 0 failure(s).` |
| `pauseAfter` | `true` |

`terminalOutput` (real, captured — abridged):
```json
{
  "serverId": "srv-demo",
  "total": 1,
  "failed": 0,
  "results": [
    {
      "sampleId": "sample-health",
      "passed": true,
      "outcome": "matched",
      "renderedResponse": {
        "status": 200,
        "body": "{\"ok\":true}",
        "contentType": "application/json"
      },
      "trace": {
        "candidates": [
          { "routeId": "route-health", "routeName": "Health", "priority": 10, "overallMatch": true }
        ],
        "policyDecision": {
          "policy": "highest_priority", "matchedCount": 1, "outcome": "matched",
          "selectedRouteId": "route-health", "selectedResponseId": "resp-health"
        }
      }
    }
  ]
}
Simulated 1 sample(s); 0 failure(s).
```

**Note:** with `-o <path>`/`--junit <path>`, both the raw JSON and a JUnit XML (`<testsuite name="api-mock-simulate">`) are written to file — but unlike `run`/`workflow`'s `-o`/`--junit`, `mock simulate` doesn't print a confirmation line naming the file it wrote (just the same `Simulated N sample(s); N failure(s).` summary either way). Minor inconsistency worth knowing, not a functional problem.

#### Step 3 — `cli10-start-standalone`: `mock start --standalone`

| Field | Value |
|---|---|
| `title` | `mock start --standalone` |
| `description` | "`--standalone` runs the mock entirely in-process, inside the CLI's own Node process — no companion dev server needed. This is what Docker/CI use. Without `--wait-ready` the process would exit immediately after starting; for a long-lived listener (or this demo), add it — the process blocks until Ctrl+C, then stops the listener cleanly." |
| `terminalCommand` | `redfireforge mock start examples/api-mock/sample-workspace.json --standalone` (background), then in a second pane: `curl http://127.0.0.1:4600/health` |
| `verify` | first command's output contains `"ready": true`; curl returns `{"ok":true}` |
| `pauseAfter` | `true` |

`terminalOutput` (real, captured — start):
```json
{
  "ready": true,
  "results": [
    { "serverId": "srv-demo", "ok": true, "port": 4600, "mode": "standalone" }
  ]
}
In-process listeners keep this process alive. Press Ctrl+C to stop.
```

`terminalOutput` (real, captured — health check, via Node's `fetch` rather than `curl` to sidestep this sandbox's proxy env vars):
```
200 {"ok":true}
```

#### Step 4 — `cli10-verify-simulate`: `mock verify --simulate`

| Field | Value |
|---|---|
| `title` | `mock verify --simulate` |
| `description` | "Assertions against the same offline corpus `mock simulate` replays — no running mock required at all. `--min-calls`/`--expect-outcome` gate on how many saved samples exist and what outcome they produced; useful as a CI smoke check that a workspace's samples still match after a route/response edit, with zero listener startup cost." |
| `terminalCommand` | `redfireforge mock verify examples/api-mock/sample-workspace.json --simulate --min-calls 1 --expect-outcome matched` |
| `verify` | exit code 0, output contains `Simulated 1 sample(s); 0 failure(s).` |
| `pauseAfter` | `true` |

`terminalOutput` (real, captured — passing):
```
Simulated 1 sample(s); 0 failure(s).
```

`terminalOutput` (real, captured — deliberately wrong `--min-calls 5`, to show a genuine failure):
```
Expected at least 5 samples, got 1
```
Exit code: `1`.

**Narration:** "`--last-call-within-ms` isn't accepted here — that's a live-journal-only option (there's no 'last call' concept for a static, offline corpus); passing it with `--simulate` errors out immediately rather than silently ignoring it."

#### Step 5 — `cli10-verify-live`: `mock verify` (Live Journal)

| Field | Value |
|---|---|
| `title` | `mock verify` (Live Journal) |
| `description` | "Live-journal `verify` asserts against **actual requests a running mock has received** — real recency (`--last-call-within-ms`), real response bodies (`--body-contains`). Critically, this only works against a mock started **through the companion** (`mock start` without `--standalone`) — the companion is what exposes the journal-read API `verify` calls. A `--standalone` listener (Step 3) has no such API at all, by design (it's meant for isolated CI containers, not to be queried from a second command)." |
| `terminalCommand` | `redfireforge mock start examples/api-mock/sample-workspace.json` (companion mode, requires `npm run server:dev` running — or `--control-base <url>` pointed at an alternate port) then `curl http://127.0.0.1:4600/health`, then `redfireforge mock verify examples/api-mock/sample-workspace.json --min-calls 1 --expect-outcome matched --last-call-within-ms 5000 --body-contains ok` |
| `verify` | output contains `"mode": "live-journal"`, `"passed": true`, and `Live journal: 1 matching call(s).` |
| `pauseAfter` | `true` |

`terminalOutput` (real, captured — companion-mode start):
```json
{
  "ready": true,
  "results": [
    { "serverId": "srv-demo", "ok": true, "port": 4600, "mode": "companion" }
  ]
}
```

`terminalOutput` (real, captured — health check): `200 {"ok":true}`

`terminalOutput` (real, captured — live verify):
```json
{
  "mode": "live-journal",
  "serverId": "srv-demo",
  "passed": true,
  "expected": "assertions satisfied",
  "actual": "count = 1",
  "matchingCount": 1,
  "matchingIds": ["tx-1787096517113-jxcj47"],
  "nearMisses": []
}
Live journal: 1 matching call(s).
```

**Real gotcha worth narrating (NOTE-4):** doing this exact sequence with the Step 3 `--standalone` listener instead produces `Live journal verify failed: fetch failed — start the companion with \`npm run server:dev\`, or pass --simulate for offline corpus checks.` — a real, verified failure, not a hypothetical one. The CLI's own error message names the fix, but it's worth calling out on camera precisely because the two `mock start` flags (plain vs. `--standalone`) look like interchangeable ways to "run the mock" and aren't, for this specific command.

**Cleanup:** `curl -X POST http://127.0.0.1:3001/api/mock/servers/srv-demo/stop` (stops the mock definition without touching the companion process itself, which may be a persistent dev server the user already relies on for other things).

#### Step 6 — `cli10-docker`: Dockerized Mock in CI

| Field | Value |
|---|---|
| `title` | Dockerized Mock in CI |
| `description` | "`examples/api-mock/Dockerfile` bakes the exact `--standalone --wait-ready` command into its `CMD`, plus a `HEALTHCHECK` that curls `/health` from inside the container every 10s. This is the same image a CI pipeline would build once and reuse as a service container for integration tests against a stable, versioned mock." |
| `terminalCommand` | `docker build -f examples/api-mock/Dockerfile -t redfireforge-api-mock . && docker run --rm -p 4600:4600 redfireforge-api-mock` then `curl -s http://127.0.0.1:4600/health` |
| `verify` | `docker build` exits 0; health check returns `{"ok":true}` |
| `pauseAfter` | `true` |

**Verification note:** Docker's daemon wasn't available in this research environment (`docker info` failed — CLI present, daemon not running), so this step's command was verified **statically** against the real, committed `Dockerfile` and [`docs/guides/api-mock/cli-and-ci.md`](../../guides/api-mock/cli-and-ci.md) rather than an actual `docker build`/`run`. Both are consistent: the Dockerfile's `CMD` is exactly `npx tsx cli/index.ts mock start examples/api-mock/sample-workspace.json --standalone --wait-ready`, and the guide's CI snippet independently confirms the same `mock start --standalone --wait-ready &` + retry-loop health-check pattern for use in an actual pipeline:
```yaml
- name: Mock simulate
  run: npx tsx cli/index.ts mock verify examples/api-mock/sample-workspace.json --simulate --expect-outcome matched --min-calls 1
- name: Mock start (background)
  run: npx tsx cli/index.ts mock start examples/api-mock/sample-workspace.json --standalone --wait-ready &
- name: Health
  run: |
    for i in 1 2 3 4 5; do curl -sf http://127.0.0.1:4600/health && exit 0; sleep 1; done
    exit 1
```
A future lesson-authoring pass in an environment with a working Docker daemon should replace this with a real captured `docker build`/`run` output.

**Cleanup:** stop the standalone listener / `docker stop` the container.

---

## CLI-11: Desktop App CLI Mode

**Goal:** When and how to use the bundled `--cli` mode instead of the npm package — and its one real, unfixed limitation.

**✅ Implemented** (`packages/demo-hub/src/lessons/cli/cli-desktop-parity.ts`, id `cli-desktop-parity`) — **the final lesson in this 11-lesson series.** `desktopOnly: true` (the only CLI lesson set this way), so it's gated/disabled in the web Learning Hub with a "Desktop only" badge, exactly as intended — it's not meant to be explorable outside the Tauri app. All 4 steps were re-verified against the real, freshly-compiled Rust binary (`cargo build`, `src-tauri/target/debug/redfireforge`), not just quoted from the original research: `--cli run` (Step 1), the real `postinstall.sh`/`rff` content (Step 2), full SLA-flag parity producing exit 4 (Step 3, BUG-10's fix), the `mock` subcommand's real `unrecognized subcommand` error + exit 2 (Step 4) — plus an extra check beyond the original plan: symlinked `rff` to the compiled binary and confirmed `rff run <file>` (no `--cli` flag) produces an identical PASSED result, directly verifying the key term's NOTE-5 claim. Adds a concept diagram: `redfireforge --cli <cmd>` and `rff <cmd>` converge into "same Node CLI bundle", branching into a green "run/workflow/validate/validate-workflow — full parity" bar and a red "mock — not supported" bar.

**⚠️ Significant finding from hands-on verification, discovered while building this lesson — see BUG-10 in the [triage section](#bugs--gaps-discovered-during-research-need-triage).** This lesson's original Step 3 draft claimed "Full Option Parity" between `--cli` and the npm package — verifying that claim by diffing the Rust `Commands` enum against `cli/index.ts`'s actual option list found it was false: the desktop wrapper was entirely missing `--scenario-tags`, all of SLA gating, and all of baseline/regression detection (10 flags), plus workflow's `--base-url`/`--trace-level`/`--trace-output`. Fixed as BUG-10 — the claim is genuinely true now, verified by compiling the actual Rust binary and running it against real fixtures.

**⚠️ Second finding, from a follow-up discussion — see NOTE-5.** The npm package and the desktop installer both claim the exact same command name `redfireforge` on `$PATH`, with genuinely different behavior (GUI vs. CLI) depending on which wins — confirmed as a real, unaddressed gap, not just a theoretical concern. Fixed by adding a collision-free `rff` short alias to *both* distribution channels (npm `bin` map and all 3 installer scripts); bare `redfireforge` is untouched either way.

| Field | Value |
|---|---|
| `id` | `cli-desktop-parity` |
| `domainId` | `cli` |
| `category` | `getting-started` |
| `estimatedMinutes` | 4 |
| `desktopOnly` | `true` |
| `tag` | none |

### Concept Slide

| Field | Value |
|---|---|
| `title` | Desktop App CLI Mode |
| `body` | "The installed desktop app isn't just a GUI — `redfireforge --cli <command>` runs the exact same engine headlessly, no separate npm install required. It's the same underlying Node CLI bundle the npm package ships, just invoked through a small Rust wrapper that the installer puts on your `PATH` automatically. Useful when a machine already has the desktop app installed (e.g. a build agent that also needs a GUI for debugging) and shouldn't need a second install path for CI." |
| `keyTerms` | `--cli` — the flag that switches the app from launching its GUI to running as a CLI, must come before the subcommand; **parity** — `run`/`workflow`/`validate`/`validate-workflow` now have full flag parity with the npm package (as of this lesson's BUG-10 fix); `mock` has none; **`rff`** — short alias installed alongside `redfireforge` by both the npm package and the desktop installer — always means "run the CLI" with no `--cli` flag needed, and never collides with the GUI (see NOTE-5) |

### Steps

#### Step 1 — `cli11-cli-flag`: The `--cli` Flag

| Field | Value |
|---|---|
| `title` | The `--cli` Flag |
| `description` | "`redfireforge --cli run <file>` produces the same output as the npm CLI's `run <file>` — same engine, same reporters, same exit codes. Under the hood, `src-tauri/src/main.rs` parses `--cli` and its subcommand with Rust's `clap`, rebuilds the equivalent flag list, and shells out to a bundled Node script via `get_cli_script_path()`. That script is `dist-cli/redfireforge.mjs`, built by `npm run build:cli` — and despite living at a different path than the npm-published `cli/dist/redfireforge.mjs`, it's actually the **same generated bundle**: `build-cli-package.sh` (the npm packaging script) calls `build-cli.mjs` internally and just copies its output to `cli/dist/`. One underlying build, two destinations for two different consumers. The installer also creates a short `rff` alias for exactly this command — `rff run <file>` does the same thing, no `--cli` needed (see Step 2)." |
| `terminalCommand` | `redfireforge --cli run examples/cli-basic-test.yaml -q` (via the compiled desktop binary) |
| `verify` | output contains `Total:        9` and `Result:       PASSED ✅` |
| `pauseAfter` | `true` |

`terminalOutput` (real, captured, compiled `src-tauri/target/debug/redfireforge --cli run examples/cli-basic-test.yaml -q`):
```
  Total:        9
  Passed:       9
  Failed HTTP:  0
  Failed Valid: 0
  Error Rate:   0%
  Tags:         critical, regression, smoke
──────────────────────────────────────────────────
  Result:       PASSED ✅
──────────────────────────────────────────────────
```

**Verification method:** diffed this against `npx tsx cli/index.ts run examples/cli-basic-test.yaml -q` run moments apart — every structural line (headers, `Total`/`Passed`/`Tags`/`Result`) was identical; only the live-network timing figures (`Duration`, `TPS`, `Avg Response`, percentiles) differed between the two separate runs, exactly as expected for two independent HTTP round-trips against the same real API.

#### Step 2 — `cli11-install-symlink`: Installer-Created Symlink/PATH Entry

| Field | Value |
|---|---|
| `title` | Installer-Created Symlink/PATH Entry |
| `description` | "No separate npm install needed — the desktop app's own installer wires up `redfireforge` **and** a short `rff` alias on your `PATH` automatically (see NOTE-5). On macOS/Linux, `postinstall.sh` symlinks both `/usr/local/bin/redfireforge` and `/usr/local/bin/rff` to the installed app binary. On Windows, the WiX installer template (`installer/windows/main.wxs`) adds the install directory to the system `PATH` (via its `Environment` component) and installs a small `rff.cmd` shim alongside the exe, since Windows has no symlink equivalent. `redfireforge` (bare) always opens the GUI — `--cli` switches it; `rff` always runs the CLI directly, no flag needed, and never collides with anything the desktop installer claims." |
| `terminalCommand` | *(no command — this step shows the installer script content)* |
| `verify` | n/a |
| `pauseAfter` | `true` |

**Verified against the real, committed installer scripts** — `src-tauri/installer/macos/postinstall.sh`, `src-tauri/installer/linux/postinstall.sh`, and `src-tauri/installer/windows/main.wxs` (`PathEntry` + `RffShim` components) all confirmed to do exactly this, including functional (not just syntax) tests of the shell scripts in sandboxed temp directories.

#### Step 3 — `cli11-full-parity`: Full Option Parity (Run/Workflow/Validate)

| Field | Value |
|---|---|
| `title` | Full Option Parity (Run/Workflow/Validate) |
| `description` | "Every flag the npm CLI's `run`/`workflow`/`validate`/`validate-workflow` commands accept, `--cli` now accepts too — including SLA gating and baseline/regression detection, which is what BUG-10 (found while building this exact step) had to fix. `--data`, `--tags`, `--error-policy`, `--sla-config`, `--fail-on-sla`, `--save-baseline`, `--trace-level`, `--trace-output` — all genuinely wired through the Rust wrapper into the same Node CLI, not a subset." |
| `terminalCommand` | `redfireforge --cli run examples/sla-jsonplaceholder-test.yaml --sla-config examples/sla-jsonplaceholder-targets.json --fail-on-sla -q; echo "exit: $?"` |
| `verify` | output contains `SLA Evaluation:`, `✗ Create Post TPS`, and `exit: 4` |
| `pauseAfter` | `true` |

`terminalOutput` (real, captured — compiled `src-tauri/target/debug/redfireforge --cli`, exercising a flag category that was completely absent before BUG-10):
```
  Total:        8
  Passed:       8
  Failed HTTP:  0
  Failed Valid: 0
  Error Rate:   0%
  Tags:         sla, smoke
──────────────────────────────────────────────────
  Result:       PASSED ✅
──────────────────────────────────────────────────

  SLA Evaluation:
  ─────────────────────────────────────────────────────────────
  ✓ Feature Group P95 SLA [FG: SLA Test Suite]      232.5ms  (target: <= 2000ms)
  ✓ Create Post P95 [Create Post]                   102.9ms  (target: <= 1000ms)
  ✗ Create Post TPS [Create Post]                  9.7req/s  (target: >= 100req/s)
  ✓ Create Post Error Rate [Create Post]               0.0%  (target: <= 2%)
  ✓ Posts P95 [Get Posts]                           102.4ms  (target: <= 1500ms)
  ✓ Users P95 [Get Users]                            36.7ms  (target: <= 500ms)
  ✓ Users Error Rate [Get Users]                       0.0%  (target: <= 1%)
  ✓ Update Post Avg Latency [Update Post]           187.7ms  (target: <= 600ms)
  ─────────────────────────────────────────────────────────────
  ✗ SLA: 1 violation, 7 passing

exit: 4
```

**Real gotcha worth narrating (BUG-10):** before this lesson pass, this exact command would have failed immediately with clap's "unrecognized argument `--sla-config`" — the entire SLA and baseline/regression feature areas (CLI-7 and CLI-8) were simply unreachable through `--cli`. Also verified `--scenario-tags smoke` (scenario-level filtering) and `workflow --trace-level full --trace-output <path>` (CLI-9's fix) both now work identically through the compiled desktop binary. The same command works identically with `rff run ...` in place of `redfireforge --cli run ...`, per NOTE-5.

#### Step 4 — `cli11-mock-gap`: The `mock` Gap

| Field | Value |
|---|---|
| `title` | The `mock` Gap |
| `description` | "One command family genuinely has no desktop `--cli` equivalent at all: API Mock Studio's headless commands. The Rust `Commands` enum only defines `Run`/`Workflow`/`Validate`/`ValidateWorkflow` — there's no `Mock` variant, so `clap` rejects `mock` immediately as an unrecognized subcommand rather than silently doing the wrong thing. Until this is built out (a new Rust subcommand plus its own ~15 options for `simulate`/`verify`/`start`), use the npm package or a source checkout for CLI-10's mock commands." |
| `terminalCommand` | `redfireforge --cli mock start examples/api-mock/sample-workspace.json --standalone` |
| `verify` | output contains `error: unrecognized subcommand 'mock'`, exit code 2 |
| `pauseAfter` | `true` |

`terminalOutput` (real, captured):
```
error: unrecognized subcommand 'mock'

Usage: redfireforge [OPTIONS] [COMMAND]

For more information, try '--help'.
```
Exit code: `2`.

**Cleanup:** none.

---

## `cliDomain` Registration (✅ Implemented — all 11 lessons complete)

**Actual final registration** in `packages/demo-hub/src/lessons/index.ts` (differs slightly from this doc's original proposal below — `mock`/`mock-and-desktop` was folded into the existing `reliability` and `getting-started` categories per each lesson's own field table, rather than adding a 5th category, since CLI-10 and CLI-11 fit cleanly into the categories already established by CLI-1 through CLI-9):

```typescript
export const cliDomain: DemoDomain = {
  id: 'cli',
  name: 'CLI',
  icon: '⌨️',
  description: 'Run tests, workflows, and API mocks headlessly from the terminal — same engine as the desktop app.',
  available: true,
  categories: [
    { id: 'getting-started', label: 'Getting Started', icon: '🚀' },
    { id: 'data-and-ci',     label: 'Data & CI/CD', icon: '📊' },
    { id: 'reliability',     label: 'Reliability', icon: '🛡️' },
    { id: 'execution',       label: 'Execution', icon: '▶' },
  ],
  lessons: cliLessons, // barrel from packages/demo-hub/src/lessons/cli/index.ts
};
```

Final category membership: `getting-started` → CLI-1, CLI-2, CLI-11; `execution` → CLI-3, CLI-4, CLI-9; `data-and-ci` → CLI-5, CLI-6; `reliability` → CLI-7, CLI-8, CLI-10.

### Post-completion review pass

After all 11 lessons were built, a full review pass checked every lesson file for stale
commands, unsupported markdown, and — most importantly — `terminalHighlightLines` bounds
that were syntactically valid (in range) but semantically wrong (pointing at the wrong
line, a blank line, or a lone brace instead of the content the step's own "N beats"
comment described). The bounds-check unit test only verifies ranges are in-bounds, not
that they point at the *right* content, so this class of bug wasn't caught by the test
suite — it required diffing each highlighted line's actual text against its comment.

Found and fixed 8 such mismatches:
- **CLI-6** `--markdown` step: banner beat highlighted a blank line instead of `## Result: PASSED ✅`.
- **CLI-6** GitHub Actions step: both beats stopped one line early, cutting off the `-q` flag and the Publish step's `with:`/`report_paths:` lines.
- **CLI-7** `--sla-config` step: both beats were off by one line (highlighted a passing check instead of the failing TPS line, and the divider instead of the verdict line).
- **CLI-7** `--fail-on-sla` step: exit-code beat stopped at a blank line instead of reaching `exit: 4`.
- **CLI-8** `--compare-baseline` step: the "response-time block" / "TPS+Error Rate" split was off by one row on both sides (excluded the divider vs. Max Response Time row).
- **CLI-8** `--comparison-report` step: "Regressions table" beat stopped at the header row, never reaching the one actual data row.
- **CLI-9** `workflow <file>` step: had a leftover orphan `Mode:` header line with no preceding context (copy-paste artifact from trimming the full CLI header block).
- **CLI-9** `--trace-output` step: the "full-level request/response" beat highlighted the wrong lines (the generic `details` wrapper instead of the actual `request`/`response` fields); the "standard's absence" beat highlighted an opening brace instead of the line + comment showing the absence.
- **CLI-10** `mock simulate` / `mock verify (Live Journal)` steps: the "final line" beats each landed one line early (the JSON's closing `}` / a blank line) instead of the actual summary/error message.
- **CLI-11** `--cli run --fail-on-sla` step: same exit-code-beat-stops-at-blank-line bug as CLI-7.

All 80 tests still pass after the fixes (bounds unaffected), and a small script (dumping
`lines.slice(start-1,end)` for every step in every lesson) was used to re-verify each
corrected range shows the exact content its comment describes. No content/narrative
inaccuracies were found — only these highlight-range mismatches.

<details>
<summary>Original proposal (superseded, kept for history)</summary>

```typescript
export const cliDomain: DemoDomain = {
  id: 'cli',
  name: 'CLI',
  icon: '⌨️',
  description: 'Run tests, workflows, and API mocks headlessly from the terminal — same engine as the desktop app.',
  available: true,
  categories: [
    { id: 'getting-started', label: 'Getting Started', icon: '🚀' },
    { id: 'execution',       label: 'Execution & Control', icon: '⚙️' },
    { id: 'data-and-ci',     label: 'Data & CI Integration', icon: '📊' },
    { id: 'reliability',     label: 'SLA & Regression', icon: '🛡️' },
    { id: 'mock-and-desktop',label: 'Mock Studio & Desktop', icon: '🪞' },
  ],
  lessons: [
    cliQuickStartLesson, cliValidateAuthoringLesson, cliExecutionModesLesson, cliErrorPoliciesLesson,
    cliDataDrivenLesson, cliReportsCiLesson, cliSlaGatesLesson, cliBaselineRegressionLesson,
    cliWorkflowCommandLesson, cliMockStudioLesson, cliDesktopParityLesson,
  ],
};
```

</details>

`cliDomain` is added to `allDomains` in [packages/demo-hub/src/lessons/index.ts](../../../packages/demo-hub/src/lessons/index.ts).

---

## Open Questions / Risks

1. **Transcript drift** — scripted (web) output is a point-in-time snapshot of real CLI stdout. If CLI output formatting changes (e.g. summary layout, new flag), the pinned transcript silently goes stale. Mitigation: a lint/test step that runs each lesson's real command against its fixture and diffs against the pinned `terminalOutput`, similar to how gallery samples are runtime-verified today.
2. **Live desktop execution safety** — spawning `node cli/index.ts run <fixture>` from within a running demo must use bundled, read-only fixtures and a temp working directory so a user's real project files/baselines are never touched.
3. **Two-terminal steps** (CLI-10 verify-live) — need either a split-pane `DemoTerminal` or a documented convention for "background process + second command" within a single pane; existing DemoHub primitives don't have this yet.
4. **Where this domain lives relative to `harnessDomain`** — CLI overlaps conceptually with Test Harness (SLA, baselines, data-driven) but is a distinct execution surface (terminal vs. GUI). Keeping it a separate `cliDomain` (as above) avoids overloading `harnessDomain`'s categories, but cross-links in each lesson's `concept.body` should point at the equivalent GUI feature (e.g. CLI-7 SLA lesson references TH-13 `th-sla-configuration`).
5. **Scope check with stakeholders** — this file assumes "demo session" means an interactive DemoHub domain (mirroring `docs/future/demo-lesson/*.md`). If the intent was instead a recorded asciinema/GIF walkthrough or a static training-manual page, the lesson *content* above (Lesson Summary + steps) is still directly reusable, but the [Architecture Proposal](#architecture-proposal-a-terminal-surface-for-demohub) section would not apply.

---

## Cross-References

- [cli/README.md](../../../cli/README.md) — canonical command reference
- [docs/guides/cli-reference.md](../../guides/cli-reference.md), [docs/guides/cli-ci-cd.md](../../guides/cli-ci-cd.md) — full option tables and CI examples
- [docs/guides/api-mock/cli-and-ci.md](../../guides/api-mock/cli-and-ci.md) — API Mock Studio CLI/Docker details
- [docs/future/demo-lesson/test-harness-demo-lesson.md](../demo-lesson/test-harness-demo-lesson.md) — SLA/baseline GUI equivalents (TH-13, TH-6)
- [docs/future/demo-lesson/workflow-demo-lesson.md](../demo-lesson/workflow-demo-lesson.md) — Workflow Designer GUI equivalent of CLI-9
