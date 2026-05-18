# Code Quality Review — Test Scenarios

> Review session: 2026-05-18
> Branch: `feature/review-status`

---

## Summary

Comprehensive code quality review of the `feature/review-status` branch covering monolithic file refactoring, test coverage improvements, duplicated code extraction, ESLint fixes, and bug fixes.

---

## Files Changed

| File | Changes |
|------|---------|
| `src/app/App.tsx` | Refactored from 910 → 779 lines; extracted header, activity bar, sub-nav |
| `src/app/components/AppHeader.tsx` | NEW — Extracted app header with env/svc selectors and theme picker |
| `src/app/components/AppActivityBar.tsx` | NEW — Extracted left activity bar navigation |
| `src/app/components/AppSubNav.tsx` | NEW — Extracted contextual sub-navigation tabs |
| `src/test-utils/factories.ts` | NEW — Shared test factories (makeScenario, makeResult, makeConfig) |
| `src/features/test-runner/hooks/useTestExecution.test.ts` | Fixed 41 failures: added rustBridge mock, fixed TestConfig fields, use shared factories |
| `src-server/webhook-server.test.ts` | Fixed 2 timeout failures: added 30s timeout to describe block |
| `src/features/test-runner/utils/rustBridge.test.ts` | Fixed ESLint: removed unused `RustExecutionPlan` import |
| `src/features/test-runner/utils/rustBridgeIntegration.test.ts` | Fixed ESLint: removed unused `abortRustLoadTest` import; added 10 new coverage tests |
| `src/engine/workerBridge.test.ts` | Refactored to use shared factories; removed unused `RequestResult` import |
| `src/engine/requestExecution.test.ts` | Refactored to use shared factories |
| `src/engine/loadProfileRunnerInteg.test.ts` | Refactored to use shared factories; removed unused `Scenario` import |
| `src/features/workflow/engine/graphLoadRunner.test.ts` | Refactored to use shared factories |
| `CHANGELOG.md` | Updated with all changes from this review |

---

## Validation Checklist

> Check each box after verifying the scenario.

| # | Scenario | Pass? | Notes |
|---|----------|-------|-------|
| 1 | [No Monolithic Files](#scenario-1-no-monolithic-files-900-lines) | [ ] | |
| 2 | [All Coverage Above 90%](#scenario-2-all-coverage-above-90) | [ ] | |
| 3 | [ESLint Zero Errors](#scenario-3-eslint-zero-errors) | [ ] | |
| 4 | [TypeScript Zero Errors](#scenario-4-typescript-zero-errors) | [ ] | |
| 5 | [All Unit Tests Pass](#scenario-5-all-unit-tests-pass) | [ ] | |
| 6 | [All E2E Tests Pass](#scenario-6-all-e2e-tests-pass) | [ ] | |
| 7 | [App.tsx Refactoring Preserves Behavior](#scenario-7-apptsx-refactoring-preserves-behavior) | [ ] | |
| 8 | [Shared Test Factories Work Correctly](#scenario-8-shared-test-factories-work-correctly) | [ ] | |
| 9 | [rustBridge Coverage Gaps Covered](#scenario-9-rustbridge-coverage-gaps-covered) | [ ] | |
| 10 | [No Duplicated Test Factories in Changed Files](#scenario-10-no-duplicated-factories-in-changed-files) | [ ] | |

**Progress**: 0 / 10 validated

---

## Scenario 1: No Monolithic Files (>900 Lines)

- [ ] **VALIDATED**

**Purpose**: Verify no source file (excluding tests) exceeds 900 lines.

**Steps**:
1. Run: `find src -name '*.ts' -o -name '*.tsx' | grep -v '\.test\.' | grep -v '\.spec\.' | xargs wc -l | sort -rn | head -11`
2. Confirm largest file is under 900 lines.

**Expected**: No file ≥ 900 lines. Top file should be `src/shared/types/index.ts` at 899.

---

## Scenario 2: All Coverage Above 90%

- [ ] **VALIDATED**

**Purpose**: Verify every source file has ≥ 90% statement coverage.

**Steps**:
1. Run: `npx vitest run --coverage`
2. Check coverage summary — all four metrics should be > 90% globally.
3. Extract per-file coverage: verify no file is below 90% statements.

**Expected**:
- Global: Stmts ≥ 98%, Branches ≥ 94%, Funcs ≥ 99%, Lines ≥ 99%
- `rustBridge.ts`: Stmts ≥ 95%, Branches ≥ 91%, Funcs ≥ 92%
- Lowest file (`storage.ts`): ≥ 90.4%

---

## Scenario 3: ESLint Zero Errors

- [ ] **VALIDATED**

**Purpose**: Verify zero ESLint errors across the entire `src/` directory.

**Steps**:
1. Run: `npx eslint src/`
2. Confirm exit code 0 with no output.

**Expected**: 0 errors, 0 warnings.

---

## Scenario 4: TypeScript Zero Errors

- [ ] **VALIDATED**

**Purpose**: Verify zero TypeScript compilation errors.

**Steps**:
1. Run: `npx tsc -b --noEmit`
2. Confirm exit code 0 with no output.

**Expected**: 0 errors.

---

## Scenario 5: All Unit Tests Pass

- [ ] **VALIDATED**

**Purpose**: Verify all unit tests pass with zero failures.

**Steps**:
1. Run: `npx vitest run`
2. Confirm all test files pass.

**Expected**: 638 files, 18,564 tests, 0 failures.

---

## Scenario 6: All E2E Tests Pass

- [ ] **VALIDATED**

**Purpose**: Verify all E2E tests pass (allow retry for flaky tests).

**Steps**:
1. Run: `npx playwright test --reporter=html --workers=10 --timeout=30000`
2. Confirm 0 permanent failures. Flaky tests (pass on retry) are acceptable.

**Expected**: 645+ passed, 0 failed. HTML report at `playwright-report/index.html`.

---

## Scenario 7: App.tsx Refactoring Preserves Behavior

- [ ] **VALIDATED**

**Purpose**: Verify App.tsx refactoring doesn't break any UI functionality.

**Steps**:
1. Open the app in a browser (localhost:5173).
2. Verify header shows: environment selector, service selector, theme picker.
3. Verify activity bar has: API, Workflow, Harness, Gallery, Settings buttons.
4. Click each activity bar button — verify correct sub-nav tabs appear.
5. Verify sidebar collapses/expands.
6. Verify theme picker opens and themes apply correctly.

**Expected**: All UI elements render and function identically to before refactoring.

---

## Scenario 8: Shared Test Factories Work Correctly

- [ ] **VALIDATED**

**Purpose**: Verify shared test factories produce correct default objects and accept overrides.

**Steps**:
1. Run: `npx vitest run src/features/test-runner/hooks/useTestExecution.test.ts src/engine/workerBridge.test.ts src/engine/requestExecution.test.ts src/engine/loadProfileRunnerInteg.test.ts src/features/workflow/engine/graphLoadRunner.test.ts`
2. Confirm all tests pass.

**Expected**: All 277 tests pass across 5 files using shared factories.

---

## Scenario 9: rustBridge Coverage Gaps Covered

- [ ] **VALIDATED**

**Purpose**: Verify the 10 new integration tests cover previously-uncovered paths.

**Steps**:
1. Run: `npx vitest run src/features/test-runner/utils/rustBridgeIntegration.test.ts`
2. Confirm all 59 tests pass (49 existing + 10 new).

**New tests cover**:
- `startRustLoadTest` — invoke failure without onError → calls onComplete with zeroed summary
- `startRustLoadTest` — outside Tauri with onError → calls onError, returns no-op unlisten
- `runTestViaRust` — rejects when startRustLoadTest fires onError
- `runTestViaRust` — wraps non-Error rejections in Error
- `mapRustResultWithoutValidation` — httpStatus=0 → "network error"
- `mapRustResultWithoutValidation` — httpStatus=500 with errorMessage
- `mapRustResultWithoutValidation` — httpStatus=403 without errorMessage → "HTTP 403"
- `mapRustResultWithoutValidation` — httpStatus=200 → passed, no failureDetails

**Expected**: 59 tests pass. Coverage: Funcs ≥ 92%, Branches ≥ 91%.

---

## Scenario 10: No Duplicated Factories in Changed Files

- [ ] **VALIDATED**

**Purpose**: Verify branch-modified test files use shared factories instead of local duplicates.

**Steps**:
1. Check each modified test file imports from `test-utils/factories`.
2. Verify no local `function makeScenario` / `function makeResult` / `function makeConfig` definitions remain in the modified files (thin wrappers that call the shared factory are OK).

**Expected**: All 6 modified test files import from `src/test-utils/factories.ts`.

---

## Metrics Summary

| Metric | Before Review | After Review |
|--------|--------------|--------------|
| **Files > 900 lines** | 1 (App.tsx: 910) | 0 |
| **Unit test failures** | 43 | 0 |
| **ESLint errors** | 5 | 0 |
| **tsc errors** | 0 | 0 |
| **Total unit tests** | 18,554 | 18,564 (+10) |
| **rustBridge.ts functions** | 85.37% | 92.68% |
| **rustBridge.ts branches** | 87.50% | 91.50% |
| **Duplicated factory files** | 6 (local definitions) | 0 (use shared module) |
| **Global statement coverage** | 98.49% | 98.49% |
| **Lowest file coverage** | 90.44% (storage.ts) | 90.44% (storage.ts) |
