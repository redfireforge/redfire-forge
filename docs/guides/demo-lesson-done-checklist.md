# Demo Lesson — Done Checklist

Use this as the **merge gate** when creating or materially changing a Demo Hub lesson.

**Scope:** Lesson wrappers under `src/features/demo-player/lessons/` and their E2E specs (`e2e/demo-*.spec.ts`).  
**Not in scope:** Runtime product code (GraphQL Studio, engine, workflow, etc.) — those keep the full >90% coverage bar.

Authoring quality (delays, WHY copy, diagrams, step pacing) still follows `.cursor/rules/demo-player-lessons.mdc` sections 1–7 and 9.  
**Done** means only the five items below.

---

## 1. End-to-end lesson run (manual, real app)

**Goal:** The lesson works for a human watching it.

- [ ] Demo Hub → open the lesson → **Restart**
- [ ] Auto-play at **1×** through **all steps**; each action shows ripple; pauses feel readable
- [ ] Final step: **`verify` selector** visible and matches narration
- [ ] **Rapid Next** through 2–3 stateful steps: no hang, wrong tab, or blank panel

**Fail if:** stuck on a step, wrong endpoint/tab, Monaco/Builder not ready, missing badge/card/menu.

**Do not require:** unit tests for concept text, diagram SVG, or key-term counts.

---

## 2. E2E smoke spec (one file, full walk)

**Goal:** CI catches integration breaks (selectors, timing, Docker, strict locators).

- [ ] Add or update `e2e/demo-<domain>-<lesson>.spec.ts` (or extend shared walk helpers)
- [ ] Reuse `e2e/graphql-lesson-smoke-helpers.ts`, `e2e/demo-player-helpers.ts` — do not duplicate walk logic
- [ ] Walk **all steps**; seed endpoints correctly (`ensureGql2StudioEndpoint`, TLS probes, etc.)
- [ ] **Never** `runNextStep` on the **last** step — see `e2e/DEMO-LESSON-E2E-MEMO.md`
- [ ] Run locally: `npm run test:e2e:demo:<project>` for that lesson (Docker lessons: 300s on heavy steps, `workers: 1`)

**Fail if:** E2E smoke does not pass once with required infra up.

---

## 3. Shared helper logic tested (only what you changed)

**Goal:** Cover **logic**, not lesson wrapper content.

- [ ] Put branching/state in **helpers** (`graphql-lesson-helpers/**`, `gql-demo-tab`, setup/cleanup, session flags) — not bloated step files
- [ ] Unit tests for **new or changed helpers only**
- [ ] Each helper test: happy path + **guard/skip** path (second call does not repeat work)
- [ ] **No >90% coverage requirement** on thin lesson wrappers (`graphql-*.ts`, `ws-*.ts`, etc. with mostly steps + copy)

**Fail if:** non-trivial helper branching has zero tests.

**OK without tests:** step `description`, `highlight`, static `concept` blocks.

---

## 4. Selectors and demo tab contract

**Goal:** UI refactors break one place, not many lessons.

- [ ] New interactions use `src/shared/selectors.ts` (`GQL.*`, `WS.*`, …) — no inline `[data-testid="..."]`
- [ ] Lesson sets `tabBudget`, `allowedTabs`, `setup`/`cleanup`; demo tab via `ensureGqlDemoTab` (or domain equivalent)
- [ ] User workspace stays untouched; cleanup closes demo tab and clears session flags

**Fail if:** lesson writes user tabs, leaves panels open, or uses raw selectors.

---

## 5. Typecheck + scoped tests

**Goal:** Fast feedback without full-suite tax on every commit.

- [ ] `npx tsc -b --noEmit` — zero errors
- [ ] `npx vitest run` on **touched** `*.test.ts` only
- [ ] Full `npx vitest run --coverage` (>90%): **before merge to `develop`**, excluding lesson wrappers (see `vitest.config.ts`)

**Not required per lesson:** full-repo coverage on wrapper files; split files **≥900 lines of logic** (not mostly strings).

---

## What stays at full product bar

| Path | Gate |
|------|------|
| Lesson wrappers (`protocols/graphql-https-tls.ts`, …) | This 5-item checklist |
| Lesson helpers (`graphql-lesson-helpers/**`, setup/cleanup) | >90% coverage when touched |
| Demo player core (`useDemoHub`, `LiveDemo`, bridges, spotlight utils) | Product conventions |
| GraphQL Studio, engine, workflow, etc. | Product conventions |

---

## PR footer (copy into description)

```text
Demo lesson checklist:
[ ] 1 manual 1× run + rapid Next
[ ] 2 E2E smoke
[ ] 3 helper unit tests (if helpers changed)
[ ] 4 selectors + demo tab
[ ] 5 tsc + scoped vitest
```

---

## Related docs

- Authoring: `.cursor/rules/demo-player-lessons.mdc`
- E2E pitfalls: `e2e/DEMO-LESSON-E2E-MEMO.md`
- E2E conventions: `.cursor/rules/e2e-testing.mdc`
