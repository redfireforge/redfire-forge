# Structured JSON Body Assertions — Implementation Plan

> **Branch:** `feature/structured-assertions` (from `release/0.5.5`)
> **ROADMAP ref:** Phase 0.10.0 — Assertions & Observability
> **Goal:** Add user-friendly JSON body assertion rules: array length, numeric compare, date compare

---

## 1. Feature Specification

From ROADMAP:
> **Structured JSON body assertions** — User-friendly rules on response JSON (beyond regex):
> **array length** at a JSONPath (e.g. `$.offers` length ≥ 4), **numeric compare** at a path
> (`>`, `≥`, `=`, `<`), **date compare** at a path vs **`today`** (define local vs UTC) or a
> fixed ISO date. Extend `Assertion` in `src/types/index.ts`, implement in
> `evaluateAssertions()` (`validator.ts`) using existing `getByPath()`; add Validation tab UI
> with path picker + plain-language operators. Applies to Harness tests and workflow HTTP
> steps (same `Scenario.validation`).

### 1.1 Three New Assertion Types

| Type | Description | Example |
|------|-------------|---------|
| **arrayLength** | Assert the length of an array at a JSONPath using comparison operators | `$.items` has length `≥ 4` |
| **numeric** | Assert a numeric value at a JSONPath using comparison operators | `$.price > 0` |
| **date** | Assert a date value at a JSONPath vs today or a fixed ISO date | `$.expiresAt > today` |

### 1.2 Comparison Operators

`=`, `!=`, `>`, `>=`, `<`, `<=` — shared across all three assertion types.

### 1.3 Date References

- **`today`** — resolves to current date at runtime (UTC or local timezone)
- **`fixed`** — a specific ISO date string (e.g. `2024-12-31`)

Date comparison is **day-level** using `YYYY-MM-DD` string comparison.

---

## 2. Codebase Audit — Files to Touch

| File | Lines | Role | Changes |
|------|-------|------|---------|
| `src/shared/types/index.ts` | 323 | Type definitions | Add `ComparisonOperator`, `DateReference`, 3 new `Assertion` variants |
| `src/engine/validator.ts` | 508 | Assertion engine | Add 3 new `case` branches + helper functions |
| `src/features/scenarios/components/TestEditorValidationTab.tsx` | 388 | Validation UI | Add 3 new assertion row renderers + "add" menu items |
| `src/engine/validator.test.ts` | 1180 (112 tests) | Unit tests | Add ~45 new test cases |
| `e2e/run-test.spec.ts` | 59 (4 tests) | E2E tests | Add structured assertion E2E scenarios |

### 2.1 Monolithic File Check (>900 lines threshold)

| File | Lines | Status |
|------|-------|--------|
| `src/features/workflow/engine/graphRunnerNodeHandlers.test.ts` | 2995 | Test file — acceptable |
| `src/features/catalog/utils/openApiParser.test.ts` | 1327 | Test file — acceptable |
| `src/shared/utils/storage.test.ts` | 1188 | Test file — acceptable |
| `src/engine/validator.test.ts` | 1180 | Test file — acceptable |
| `src/features/workflow/utils/workflowMigrations.test.ts` | 1146 | Test file — acceptable |
| `src/features/workflow/engine/graphRunner.test.ts` | 1073 | Test file — acceptable |
| `src/features/workflow/engine/graphRunnerNodeHandlers.ts` | 840 | Below threshold ✓ |
| `src/features/workflow/utils/workflowAutoLayout.ts` | 826 | Below threshold ✓ |
| `src/app/App.tsx` | 814 | Below threshold ✓ |

**No production files exceed 900 lines.** Large files are all test files, which are acceptable.

Post-implementation, `validator.ts` will grow from 508 → ~620 lines (well under 900). If it approaches 900+, we will extract assertion helpers into `src/engine/assertionHelpers.ts`.

---

## 3. Implementation Phases

### Phase A — Types (src/shared/types/index.ts)

**Goal:** Add new type definitions without breaking existing code.

#### A.1 Add `ComparisonOperator` type
```typescript
export type ComparisonOperator = '=' | '!=' | '>' | '>=' | '<' | '<=';
```

#### A.2 Add `DateReference` type
```typescript
export type DateReference =
  | { kind: 'today'; timezone: 'utc' | 'local' }
  | { kind: 'fixed'; iso: string };
```

#### A.3 Extend `Assertion` union type (add 3 new variants)
```typescript
export type Assertion =
  | { type: 'status'; expected: string }
  | { type: 'responseTime'; maxMs: number }
  | { type: 'header'; name: string; operator: AssertionOperator; value?: string }
  | { type: 'regex'; jsonPath: string; pattern: string }
  // NEW:
  | { type: 'arrayLength'; jsonPath: string; operator: ComparisonOperator; value: number }
  | { type: 'numeric'; jsonPath: string; operator: ComparisonOperator; value: number }
  | { type: 'date'; jsonPath: string; operator: ComparisonOperator; reference: DateReference };
```

#### A.4 Verification
- `npx tsc --noEmit` — must pass with zero errors
- No existing tests should break

---

### Phase B — Engine (src/engine/validator.ts)

**Goal:** Implement evaluation logic for the 3 new assertion types.

#### B.1 Add shared `compare()` helper
```typescript
function compare(a: number, op: ComparisonOperator, b: number): boolean {
  switch (op) {
    case '=':  return a === b;
    case '!=': return a !== b;
    case '>':  return a > b;
    case '>=': return a >= b;
    case '<':  return a < b;
    case '<=': return a <= b;
  }
}
```

#### B.2 Add date helpers
```typescript
function resolveDate(ref: DateReference): string {
  if (ref.kind === 'fixed') return ref.iso.slice(0, 10);
  const now = new Date();
  if (ref.timezone === 'utc') {
    return now.toISOString().slice(0, 10);
  }
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toDayString(val: unknown): string | null {
  if (typeof val === 'string') {
    const match = val.match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : null;
  }
  if (typeof val === 'number') {
    return new Date(val).toISOString().slice(0, 10);
  }
  return null;
}
```

#### B.3 Add `formatOp()` display helper
```typescript
function formatOp(op: ComparisonOperator): string {
  const map: Record<ComparisonOperator, string> = {
    '=': '=', '!=': '≠', '>': '>', '>=': '≥', '<': '<', '<=': '≤'
  };
  return map[op];
}
```

#### B.4 Add 3 new cases to `evaluateAssertions()` switch

**arrayLength case:**
- Extract value at `jsonPath` using `getByPath()`
- If not an array → failure: `"expected array at path"`
- Compare `actual.length` against `a.value` using `compare()`

**numeric case:**
- Extract value at `jsonPath` using `getByPath()`
- Parse to number → if `NaN` → failure: `"expected numeric value at path"`
- Compare using `compare()`

**date case:**
- Extract value at `jsonPath` using `getByPath()`
- Convert to day string using `toDayString()` → if null → failure: `"expected date at path"`
- Resolve reference date using `resolveDate()`
- Compare day strings lexicographically using `compare()` on `localeCompare()` result

#### B.5 Verification
- `npx tsc --noEmit` — must pass
- All 112 existing tests must still pass

---

### Phase C — Unit Tests (src/engine/validator.test.ts)

**Goal:** ≥90% branch coverage for new code. ~45 new test cases.

#### C.1 `compare()` helper tests (6 tests)
| Test | Input | Expected |
|------|-------|----------|
| `=` true | `compare(5, '=', 5)` | true |
| `=` false | `compare(5, '=', 6)` | false |
| `!=` true | `compare(5, '!=', 6)` | true |
| `>` boundary | `compare(5, '>', 5)` | false |
| `>=` boundary | `compare(5, '>=', 5)` | true |
| `<` and `<=` | various | expected |

#### C.2 `toDayString()` tests (5 tests)
| Test | Input | Expected |
|------|-------|----------|
| ISO string | `"2024-12-31T10:00:00Z"` | `"2024-12-31"` |
| Date-only string | `"2024-12-31"` | `"2024-12-31"` |
| Unix timestamp ms | `1704067200000` | `"2024-01-01"` |
| Non-date string | `"hello"` | `null` |
| null/undefined | `null` | `null` |

#### C.3 `resolveDate()` tests (3 tests)
| Test | Input | Expected |
|------|-------|----------|
| Fixed date | `{ kind: 'fixed', iso: '2024-06-15' }` | `"2024-06-15"` |
| Today UTC | `{ kind: 'today', timezone: 'utc' }` | today's UTC date |
| Today local | `{ kind: 'today', timezone: 'local' }` | today's local date |

#### C.4 arrayLength assertion tests (10 tests)
| Test | Scenario |
|------|----------|
| Pass: array length = 3 | `$.items` has 3 elements, assert `= 3` |
| Pass: array length >= 2 | `$.items` has 3 elements, assert `>= 2` |
| Pass: array length < 10 | `$.items` has 3 elements, assert `< 10` |
| Fail: array length > 5 | `$.items` has 3 elements, assert `> 5` |
| Fail: not an array | `$.name` is string, assert length `= 1` |
| Fail: path not found | `$.missing` is undefined |
| Pass: empty array = 0 | `$.items` is `[]`, assert `= 0` |
| Pass: nested array | `$.data.results` deeply nested |
| Pass: wildcard path | `$.orders[*].items` |
| Fail: != operator | array length = 3, assert `!= 3` |

#### C.5 numeric assertion tests (12 tests)
| Test | Scenario |
|------|----------|
| Pass: equals | `$.price` = 19.99, assert `= 19.99` |
| Pass: greater than | `$.price` = 19.99, assert `> 10` |
| Pass: less than or equal | `$.count` = 5, assert `<= 5` |
| Fail: less than | `$.count` = 5, assert `< 5` |
| Pass: not equals | `$.count` = 5, assert `!= 0` |
| Fail: not a number | `$.name` = "Alice", assert `> 0` |
| Fail: path missing | `$.missing`, assert `= 0` |
| Pass: zero value | `$.count` = 0, assert `= 0` |
| Pass: negative number | `$.delta` = -5, assert `< 0` |
| Pass: string-encoded number | `$.price` = "19.99", assert `= 19.99` |
| Fail: string-encoded NaN | `$.val` = "abc", assert `= 0` |
| Pass: integer comparison | `$.count` = 100, assert `>= 100` |

#### C.6 date assertion tests (12 tests)
| Test | Scenario |
|------|----------|
| Pass: fixed date equals | `$.createdAt` = "2024-06-15T...", assert `= fixed(2024-06-15)` |
| Pass: after fixed date | `$.expiresAt` = "2025-01-01", assert `> fixed(2024-12-31)` |
| Fail: before fixed date | `$.expiresAt` = "2024-01-01", assert `> fixed(2024-12-31)` |
| Pass: today reference (UTC) | `$.date` = today's date, assert `= today(utc)` |
| Pass: future date > today | `$.expiresAt` = far future, assert `> today(utc)` |
| Fail: past date > today | `$.expiresAt` = "2020-01-01", assert `> today(utc)` |
| Pass: != operator | `$.date` = "2024-01-01", assert `!= fixed(2024-12-31)` |
| Fail: not a date | `$.name` = "Alice", assert `= fixed(2024-01-01)` |
| Fail: path missing | `$.missing`, assert `= today(utc)` |
| Pass: date-only string | `$.date` = "2024-06-15", assert `= fixed(2024-06-15)` |
| Pass: unix timestamp | `$.ts` = epoch ms, assert `= fixed(expected)` |
| Pass: local timezone | `$.date` = today local, assert `= today(local)` |

#### C.7 Integration tests (2 tests)
| Test | Scenario |
|------|----------|
| Mixed assertions pass | status + header + arrayLength + numeric all pass |
| Mixed assertions partial fail | some pass, some fail — verify correct failure details |

#### C.8 Verification
- `npx vitest run src/engine/validator.test.ts` — all tests pass
- `npx vitest run --coverage src/engine/validator.ts` — ≥90% branch coverage

---

### Phase D — UI (TestEditorValidationTab.tsx)

**Goal:** Add UI for creating/editing the 3 new assertion types in the Validation tab.

#### D.1 Add "add assertion" menu items
Extend the existing dropdown with:
- **"Array Length"** — adds `{ type: 'arrayLength', jsonPath: '', operator: '>=', value: 1 }`
- **"Numeric Compare"** — adds `{ type: 'numeric', jsonPath: '', operator: '=', value: 0 }`
- **"Date Compare"** — adds `{ type: 'date', jsonPath: '', operator: '>', reference: { kind: 'today', timezone: 'utc' } }`

#### D.2 Render assertion rows
For each new type, render an inline row with:
- **JSONPath input** (text field with placeholder `$.path.to.value`)
- **Operator dropdown** (`=`, `!=`, `>`, `>=`, `<`, `<=`)
- **Value input**:
  - arrayLength/numeric: number input
  - date: toggle between "today (UTC/local)" and "fixed date" + date input
- **Delete button** (existing pattern)

#### D.3 Operator display labels
Map symbols to readable labels in dropdown:
| Value | Label |
|-------|-------|
| `=` | equals (=) |
| `!=` | not equals (≠) |
| `>` | greater than (>) |
| `>=` | at least (≥) |
| `<` | less than (<) |
| `<=` | at most (≤) |

#### D.4 Verification
- Visual inspection (user must verify layout)
- All existing Validation tab behavior unchanged
- New assertions serialize correctly to `draft.validation.assertions[]`

---

### Phase E — E2E Tests (e2e/)

**Goal:** Playwright tests covering the new assertion UI and end-to-end validation.

#### E.1 New E2E test file: `e2e/structured-assertions.spec.ts`

| Test | Steps |
|------|-------|
| Add arrayLength assertion via UI | Open test editor → Validation tab → Add → Array Length → fill jsonPath + value → verify row |
| Add numeric assertion via UI | Same flow with Numeric Compare |
| Add date assertion via UI | Same flow with Date Compare → toggle today/fixed |
| Run test with passing assertions | Create test with known response → add assertions → run → verify pass |
| Run test with failing assertions | Create test with assertions that will fail → run → verify failure details |
| Delete assertion | Add assertion → click delete → verify removed |
| Edit assertion operator | Add assertion → change operator dropdown → verify updated |

#### E.2 Verification
- `npx playwright test e2e/structured-assertions.spec.ts` — all pass

---

## 4. Implementation Order & Checklist

```
Phase A — Types                         ☐
  A.1 Add ComparisonOperator type       ☐
  A.2 Add DateReference type            ☐
  A.3 Extend Assertion union            ☐
  A.4 Verify: tsc --noEmit             ☐

Phase B — Engine                        ☐
  B.1 Add compare() helper             ☐
  B.2 Add resolveDate() + toDayString() ☐
  B.3 Add formatOp() helper            ☐
  B.4 Add 3 switch cases               ☐
  B.5 Verify: tsc + existing tests     ☐

Phase C — Unit Tests                    ☐
  C.1 compare() tests (6)              ☐
  C.2 toDayString() tests (5)          ☐
  C.3 resolveDate() tests (3)          ☐
  C.4 arrayLength tests (10)           ☐
  C.5 numeric tests (12)               ☐
  C.6 date tests (12)                  ☐
  C.7 Integration tests (2)            ☐
  C.8 Verify: coverage ≥90%            ☐

Phase D — UI                            ☐
  D.1 Add menu items                   ☐
  D.2 Render assertion rows            ☐
  D.3 Operator display labels          ☐
  D.4 Verify: visual + serialization   ☐

Phase E — E2E Tests                     ☐
  E.1 Write 7 Playwright tests         ☐
  E.2 Verify: all pass                 ☐

Review Rounds                           ☐
  Round 1: Monolithic check (<900 LOC)  ☐
  Round 2: Redundancy scan             ☐
  Round 3: Coverage verification ≥90%  ☐
  Round 4: Full test suite pass        ☐
```

---

## 5. Refactoring Rules

- **If `validator.ts` exceeds 900 lines** → extract `compare()`, `resolveDate()`, `toDayString()`, `formatOp()` into `src/engine/assertionHelpers.ts`
- **If `TestEditorValidationTab.tsx` exceeds 900 lines** → extract new assertion row components into `src/features/scenarios/components/assertions/` directory:
  - `ArrayLengthAssertionRow.tsx`
  - `NumericAssertionRow.tsx`
  - `DateAssertionRow.tsx`
- **Common operator dropdown** → extract `ComparisonOperatorSelect` component if used in 3+ places
- **No duplicate code** — share `compare()` and operator labels between engine and UI

---

## 6. Quality Gates (Before Merge)

| Gate | Command | Target |
|------|---------|--------|
| TypeScript | `npx tsc --noEmit` | 0 errors |
| Unit tests (touched files) | `npx vitest run src/engine/validator.test.ts` | All pass |
| Coverage | `npx vitest run --coverage src/engine/validator.ts` | ≥90% branches |
| Full unit suite | `npx vitest run` | All pass |
| E2E | `npx playwright test` | All pass |
| Lint | `npx eslint .` | 0 errors |
| File size | `wc -l` on all changed `.ts`/`.tsx` files | <900 lines each |

---

## 7. Risk & Edge Cases

| Risk | Mitigation |
|------|------------|
| `getByPath()` returns nested array from `[*]` wildcard | arrayLength: check `Array.isArray()` strictly |
| Numeric strings (`"19.99"`) | Parse with `Number()`, fail on `NaN` |
| Date timezone ambiguity | Explicit `utc` vs `local` in DateReference |
| Date formats vary (`ISO`, `epoch`, custom) | `toDayString()` handles ISO + epoch; non-parseable → failure |
| Existing tests break | Run full suite after each phase |
| UI file grows too large | Proactive extraction per refactoring rules above |

---

## 8. Files Created / Modified Summary

| Action | File |
|--------|------|
| Modified | `src/shared/types/index.ts` |
| Modified | `src/engine/validator.ts` |
| Modified | `src/engine/validator.test.ts` |
| Modified | `src/features/scenarios/components/TestEditorValidationTab.tsx` |
| Created | `e2e/structured-assertions.spec.ts` |
| Created (if needed) | `src/engine/assertionHelpers.ts` |
| Created (if needed) | `src/features/scenarios/components/assertions/*.tsx` |
