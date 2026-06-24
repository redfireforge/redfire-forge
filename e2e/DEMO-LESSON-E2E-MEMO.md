# Demo Lesson E2E — Memo & Pitfalls

**Read this before implementing any new Demo Hub step-through E2E spec** (GraphQL, WebSocket, Kafka, SSE, etc.).

Hard-won from GQL-1..3 (`demo-gql-first-query`, `demo-gql-variables`, `demo-gql-mutations`).

**Product merge gate:** Demo lesson E2E (`e2e/demo-*.spec.ts`, `npm run test:e2e:demo:*`) is **not required** when a PR touches only product code and does not change lesson files, adapters, or demo-player core. Use `npm run test:product` for those PRs.

---

## Quick checklist (new lesson spec)

- [ ] One spec file: `e2e/demo-{protocol}-{slug}.spec.ts`
- [ ] Dedicated Playwright project + `npm run test:e2e:demo:…` script (**run only that lesson** during dev)
- [ ] Import step control from `e2e/demo-player-helpers.ts` — never raw `waitForTimeout`
- [ ] **Last step:** use `finishDemoStep`, never `runNextStep` / `advanceToStep(totalSteps)`
- [ ] **Full walk:** `(totalSteps - 2) × runNextStep` → penultimate `completeCurrentStepAction` → `click Next` → `finishDemoStep`
- [ ] Scope assertions to `data-testid` panels — lesson narration duplicates UI text
- [ ] Docker GraphQL: `setupLiveProxy` + correct endpoint bootstrap (see §4)
- [ ] Heavy steps (execute, history, compare): **300s** action timeout minimum
- [ ] Re-use shared walk/prepare helpers when available (`e2e/graphql-lesson-smoke-helpers.ts`)

---

## 1. Last step — Next is always disabled

**Root cause:** `LiveDemo.tsx` sets `disabled={isLast || !canNavigate}` on the Next button. On the **final step**, Next is **never** enabled — even during reading. The **Complete lesson** button appears instead when `stepPhase === 'done'`.

**Symptom:** Test hangs for 600s in `waitForReadingPhase()` inside `runNextStep()`.

**Wrong:**

```typescript
// ❌ Hangs forever on step N/N
await runNextStep(page);
await advanceToStep(page, TOTAL_STEPS); // last iteration calls runNextStep onto final step
await playThroughLesson(page, totalSteps); // OK if using built-in helper — see below
```

**Right — full lesson walk:**

```typescript
// ✅ Canonical pattern (also in playThroughLesson / walkFullGql*Lesson)
for (let i = 0; i < totalSteps - 2; i++) {
  await runNextStep(page, timeout);
}
await completeCurrentStepAction(page, timeout);       // penultimate step action
await page.locator('[aria-label="Next step"]').click(); // enter final step
await finishDemoStep(page, timeout);                  // final step action — no waitForReadingPhase
```

**Right — isolated test ending on final step:**

```typescript
// ✅ Advance TO final step reading, then finish (not runNextStep onto it)
await advanceToStep(page, totalSteps - 1, timeout);  // e.g. 14 when total is 15
await completeCurrentStepAction(page, timeout);        // penultimate action if needed
await page.locator('[aria-label="Next step"]').click();
await finishDemoStep(page, timeout);
```

**GQL-1 nuance:** Next is disabled on the last step even **during reading**. Use `waitForGql1StepReady` (reading **or** done) after entering the final step — see `e2e/demo-gql-first-query.spec.ts` and `walkFullGql1Lesson` in `graphql-lesson-smoke-helpers.ts`.

**Reference implementations:**

| Lesson | Steps | Walk helper |
|--------|-------|-------------|
| GQL-1 | 13 | `walkFullGql1Lesson` |
| GQL-2 | 16 | `walkFullGql2Lesson` |
| GQL-3 | 15 | `walkFullGql3Lesson` |

---

## 2. Step index — reading vs action

`advanceToStep(N)` runs `runNextStep` until the panel shows **step N reading**. It does **not** run step N's action.

| Goal | Pattern |
|------|---------|
| Run step N action only | Already on step N reading → `completeCurrentStepAction` |
| Finish step N, land on N+1 reading | `runNextStep` (unless N+1 is last step — see §1) |
| Skip to step N reading from step 1 | `advanceToStep(N)` |

**Common bug:** Asserting step 13 UI after `completeCurrentStepAction` while still on step 12 — use `advanceToStep(13)` first, or `runNextStep` after step 12 completes.

---

## 3. Strict-mode locator violations

Lesson **descriptions** render the same strings as the UI (`user.name`, `Alice`, `GetUser`, `success: false`, etc.).

**Wrong:**

```typescript
await expect(page.getByText('user.name')).toBeVisible(); // matches narration + table
```

**Right:**

```typescript
const table = page.getByTestId('gql-history-compare-table');
await expect(table.getByText('user.name')).toBeVisible();
await expect(page.getByTestId('gql-response-body')).toContainText('"success": false');
```

Prefer `data-testid` from `src/shared/selectors.ts`. Use `{ force: true }` on Response tabs when the demo overlay covers them.

---

## 4. GraphQL Docker endpoint (port 4010)

| Lesson | Endpoint in lesson | E2E bootstrap helper |
|--------|-------------------|----------------------|
| GQL-1 | `{{graphqlUrl}}` (EM) | Lesson seeds EM; `setupLiveProxy` only |
| GQL-2 | `{{graphqlUrl}}` | `seedGqlDemoEnvironmentForE2e` + `ensureGql2StudioEndpoint` |
| GQL-3 | `http://localhost:4010/graphql` (literal) | `seedGqlDemoEnvironmentForE2e` + `ensureGql3StudioEndpoint` |

**Critical:** `http://localhost:4010` **without** `/graphql` POSTs to `/` → `Cannot POST /` (HTTP 404). EM seed stores base URL `http://localhost:4010`; `ensureGqlDemoHeaderSelected` can sync a truncated URL into the studio field.

**Fix:** Helpers must require the **full** path:

```typescript
// ensureGql3StudioEndpoint — val !== GQL_HTTP → fillEndpoint(GQL_HTTP)
// GQL_HTTP = 'http://localhost:4010/graphql'
```

Re-assert endpoint **before and after** long `advanceToStep` chains (`advanceToStepWithEndpoint` in GQL-3 spec).

Always call `setupLiveProxy(page, request)` for live Docker GraphQL E2E.

Mock health for prerequisite gate when Docker is up but probe route needed:

```typescript
await page.route(GQL_HEALTH, (route) => route.fulfill({ status: 200, body: '{"status":"ok"}' }));
```

---

## 5. History / compare steps (GQL-2)

History step `preAction` guards must **not** re-click Response tab or re-execute Alice/Bob queries when history is already populated — that flickers the right panel and confuses viewers/tests.

Use `skipResponseFocus: true` on execute guards when advancing through history-only steps. See `lesson2-variables-history.ts` and `core.ts` (`areLesson2StudioExecutionsDone`).

History assertions belong on **left** History sidebar testids (`gql-history-panel`, `gql-history-compare-table`), not Response panel state.

---

## 6. Timeouts

| Phase | Timeout |
|-------|---------|
| Lesson shell (concept, step count) | Default / 180s |
| Introspect, schema browse | 180s (`DEMO_ACTION_TIMEOUT`) |
| Execute mutations, history, compare | **300s** (`MUTATION_TIMEOUT` / `HISTORY_TIMEOUT`) |
| Full 15–16 step Docker walk | Test timeout **600–900s** |

Per-lesson projects: `workers: 1`, `retries: 0` (deterministic, easier to debug).

---

## 7. Project wiring (GraphQL pattern)

When adding GQL-N:

1. `e2e/demo-gql-*.spec.ts` — spec file
2. `DEMO_GQLN_SPEC` in `playwright.config.ts`
3. `demo-gqlN` project (exclude from default `chromium` via `testIgnore`)
4. `"test:e2e:demo:gqlN"` in `package.json`
5. Row in `e2e/README.md` + this memo if new pitfall found

**During development, run ONLY the lesson under test:**

```bash
npm run test:e2e:demo:gql3   # not npm run test:e2e
```

---

## 8. Synchronisation (always)

Never click **Next** during reading — that skips the step `action()`.

```typescript
await completeCurrentStepAction(page);  // skip reading badge → wait data-step-phase=done
await runNextStep(page);                // above + click Next + wait next reading (not on last step)
```

Gate on `[data-testid="demo-live-panel"]` attribute `data-step-phase`: `reading` | `action` | `verify` | `done`.

---

## 9. File map

| File | Role |
|------|------|
| `e2e/demo-player-helpers.ts` | `runNextStep`, `finishDemoStep`, `playThroughLesson`, `launchGqlLesson` |
| `e2e/graphql-helpers.ts` | Proxy, EM seed, `ensureGql2/3StudioEndpoint`, health check |
| `e2e/graphql-lesson-smoke-helpers.ts` | Shared `prepareGql*DockerLesson`, `walkFullGql*Lesson` |
| `e2e/graphql-demo-workspace-helpers.ts` | §11.0 seed/read workspace snapshots |
| `e2e/demo-gql-workspace-isolation.spec.ts` | §11.0 acceptance E2E |
| `.cursor/rules/e2e-testing.mdc` | Agent rule summary (points here) |

---

## When you hit a new pitfall

Add a row to §checklist or a new numbered section here, and one line to `.cursor/rules/e2e-testing.mdc` so agents pick it up on the next lesson.

---

## 10. §11.0 — Demo workspace isolation (GraphQL Studio)

**Problem:** GraphQL demo lessons run in the real Studio and persist to the same keys as the user's workspace (`gql_tabs_v1`, `gql_endpoint_v1`, …). Without isolation, a lesson could overwrite the user's endpoint or tab labels.

**Engineering fix (shipped):** Reserved **demo tab(s)** via `ensureGqlDemoTab` / `closeGqlDemoTabs` (`gql-demo-tab.ts`, `gqlDemoWorkspace.ts`). User tabs 1–7 + page endpoint must stay untouched.

**Acceptance spec:** `e2e/demo-gql-workspace-isolation.spec.ts` — run via:

```bash
npm run test:e2e:demo:gql110
```

| Case | What it proves |
|------|----------------|
| User workspace survives GQL-1 | Custom endpoint + tab title unchanged after exit; demo tab removed from storage |
| 7 user tabs + GQL-1 | Lesson uses slot 8 (7 user + 1 demo); 7 user tabs restored after exit |
| GQL-14 tab capacity gate | With 7 user tabs, Start blocked until 1 tab closed (`tabBudget: 2`) |
| GQL-1 → GQL-2 switch | Demo tab wiped and recreated; no `gql-first-query` demo tab after GQL-2 start |

**Helpers:** `e2e/graphql-demo-workspace-helpers.ts`

```typescript
await seedGqlUserWorkspace(page, { userTabCount: 7 }); // before first goto
const snap = await readGqlWorkspaceSnapshot(page);
expectUserWorkspaceIntact(snap, { userTabCount: 7 });
```

**Seed timing:** Call `seedGqlUserWorkspace` **before** `openDemoHub` — it uses `addInitScript` so localStorage is set on every navigation.

**Start flow:** Use `openGqlLessonConcept` + `waitForPrerequisiteGateUp` + `startLesson` — **not** `launchGqlLesson` (that already clicks Start Demo). Capture `readGqlWorkspaceSnapshot` **before** `startLesson`.

**After exit:** Call `waitForGqlDemoCleanup(page)` — cleanup is async after the concept view appears.

**Demo tab locator:** Use `[data-demo-lesson="gql-first-query"]` — not `/^Demo:/` on `[role="tab"]` (child nodes break `^` anchor).

**Tab capacity model:** `MAX_TABS = 8`, `MAX_USER_TABS = 7`. Lessons with `tabBudget: 2` (GQL-14, GQL-15) show `PrerequisiteGate` tab-capacity UI when `userTabsToCloseForLesson(count, 2) > 0`.

**Orphan demo tabs:** `purgeOrphanDemoTabs()` on Studio mount removes demo tabs when no active `gql_demo_session_v1` — hard refresh mid-lesson is handled separately (not covered by acceptance spec yet).

**Last-step rule still applies** when walking lessons inside §11.0 tests — use `finishDemoStep` on step N/N.
