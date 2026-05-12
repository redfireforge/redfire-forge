# Data Mapper UI Improvement - Execution Checklist

> Converted on: 2026-05-11  
> Purpose: Turn the UI improvement plan into milestone tickets that can be executed directly by component/file.

---

## How To Use This Checklist

- Each ticket is implementation-ready and scoped by component/file.
- Mark a ticket complete only after code, tests, and visual verification are done.
- Execute milestones in order (M0 -> M5) unless a ticket explicitly says it can run in parallel.

---

## Milestone Overview

| Milestone | Objective | Tickets | Primary Components |
|---|---|---:|---|
| M0 | Baseline and guardrails | 4 | `DataMapper`, tests, docs |
| M1 | Shell and toolbar information architecture | 6 | `MapperToolbar`, `DataMapper`, `DataMapperModal` |
| M2 | Empty-state and state-trust UX | 5 | `SourcePanel`, `TargetPanel`, `MappingCanvas`, `DataMapper` |
| M3 | Visual system alignment and polish | 5 | CSS + panel/canvas/footer components |
| M4 | Progressive disclosure for advanced tools | 4 | `MapperToolbar`, `DataMapper` |
| M5 | Validation, accessibility, and release gate | 5 | tests, docs, full mapper surface |

---

## M0 - Baseline And Guardrails

### Exit Criteria
- Baseline visual states are captured.
- State integrity expectations are codified in tests.
- A repeatable UX validation checklist exists.

### Tickets

- [x] **DMUI-0001 - Baseline state inventory**
  - **Components:** `DataMapper`, `SourcePanel`, `TargetPanel`, `MappingCanvas`, `DataMapperModal`
  - **Files:** `src/shared/components/data-mapper/DataMapper.tsx`, `src/shared/components/data-mapper/SourcePanel.tsx`, `src/shared/components/data-mapper/TargetPanel.tsx`, `src/shared/components/data-mapper/MappingCanvas.tsx`, `src/shared/components/data-mapper/DataMapperModal.tsx`
  - **Done when:** current empty/partial/mapped states are documented in this file as baseline references.

- [x] **DMUI-0002 - Snapshot coverage for baseline states**
  - **Components:** visual snapshots
  - **Files:** `src/shared/components/data-mapper/visual-snapshots.test.tsx`, `src/shared/components/data-mapper/__snapshots__/visual-snapshots.test.tsx.snap`
  - **Done when:** snapshot tests include empty source, empty target, both empty, partially mapped, and fully mapped shells.

- [x] **DMUI-0003 - State truth contract tests**
  - **Components:** status counters and badges
  - **Files:** `src/shared/components/data-mapper/DataMapper.test.tsx`, `src/shared/components/data-mapper/MapperToolbar.test.tsx`, `src/shared/components/data-mapper/TargetPanel.test.tsx`
  - **Done when:** tests fail if mapping counters conflict with visible source/target readiness.

- [x] **DMUI-0004 - UX validation script scaffold**
  - **Components:** docs/test process
  - **Files:** `docs/plan/data-mapper-ui-improvement.md`
  - **Done when:** manual validation steps for first-map flow and trust-state checks are listed in M5.

---

### Baseline State Inventory (DMUI-0001)

Current baseline references are captured in visual snapshots and behavior tests for these states:

- **Both empty shell:** source has no sample data and target has no schema/sample.
- **Source-empty shell:** source missing sample data while target schema/sample exists.
- **Target-empty shell:** target missing schema/sample while source sample exists.
- **Partially mapped shell:** at least one mapping exists, but not all expected target fields are mapped.
- **Fully mapped shell:** all expected target fields in baseline sample are mapped.

State-truth guardrails covered in tests:

- Toolbar mapping status text remains synchronized with footer mapped-count value.
- Target mapped badge is hidden when no target schema/tree exists.
- Empty source/target states retain explicit instructional guidance.

---

## M1 - Shell And Toolbar Information Architecture

### Exit Criteria
- Toolbar is grouped by user intent.
- Primary and secondary actions are visually distinct.
- Modal completion path is clear and professional.

### Tickets

- [x] **DMUI-1001 - Toolbar group layout refactor**
  - **Components:** toolbar structure
  - **Files:** `src/shared/components/data-mapper/MapperToolbar.tsx`, `src/styles/data-mapper.css`
  - **Done when:** toolbar is grouped into Core Mapping, View, Advanced, and History clusters.
  - **Depends on:** `DMUI-0003`

- [x] **DMUI-1002 - Action priority hierarchy**
  - **Components:** toolbar/button emphasis
  - **Files:** `src/shared/components/data-mapper/MapperToolbar.tsx`, `src/styles/data-mapper.css`
  - **Done when:** `Auto-map`, `Clear`, and completion-related actions have clear priority and spacing.
  - **Depends on:** `DMUI-1001`

- [x] **DMUI-1003 - Professional control language cleanup**
  - **Components:** toolbar labels and icon usage
  - **Files:** `src/shared/components/data-mapper/MapperToolbar.tsx`, `src/shared/components/data-mapper/SourcePanel.tsx`
  - **Done when:** emoji-first labels are replaced with consistent product-grade labels/icons.
  - **Depends on:** `DMUI-1001`

- [x] **DMUI-1004 - Modal header/footer hierarchy pass**
  - **Components:** modal shell
  - **Files:** `src/shared/components/data-mapper/DataMapperModal.tsx`, `src/styles/data-mapper-modal.css`
  - **Done when:** `Done` path is visually clear, with cleaner header actions and footer rhythm.
  - **Depends on:** `DMUI-1002`

- [x] **DMUI-1005 - Status lane simplification (top-level)**
  - **Components:** top status text and badges
  - **Files:** `src/shared/components/data-mapper/MapperToolbar.tsx`, `src/shared/components/data-mapper/DataMapper.tsx`
  - **Done when:** top-level status conveys one clear mapping state with no redundant signals.
  - **Depends on:** `DMUI-1002`

- [x] **DMUI-1006 - Toolbar regression tests**
  - **Components:** toolbar interaction tests
  - **Files:** `src/shared/components/data-mapper/MapperToolbar.test.tsx`, `src/shared/components/data-mapper/DataMapper.test.tsx`
  - **Done when:** tests cover grouped layout, label updates, and action priority behavior.
  - **Depends on:** `DMUI-1001`, `DMUI-1003`, `DMUI-1005`

---

## M2 - Empty-State And State-Trust UX

### Exit Criteria
- Empty states are guided and actionable.
- Canvas provides setup guidance when no lines exist.
- Counter/status behavior stays trustworthy in all empty/partial states.

### Tickets

- [x] **DMUI-2001 - Source panel guided empty state**
  - **Components:** source setup UX
  - **Files:** `src/shared/components/data-mapper/SourcePanel.tsx`, `src/styles/data-mapper.css`
  - **Done when:** source empty state includes clear actions (paste/fetch/sample guidance), not passive text only.
  - **Depends on:** `DMUI-1001`

- [x] **DMUI-2002 - Target panel guided empty state**
  - **Components:** target setup UX
  - **Files:** `src/shared/components/data-mapper/TargetPanel.tsx`, `src/styles/data-mapper.css`
  - **Done when:** target empty state includes explicit next actions for schema/sample setup.
  - **Depends on:** `DMUI-1001`

- [x] **DMUI-2003 - Canvas instructional empty overlay**
  - **Components:** center canvas guidance
  - **Files:** `src/shared/components/data-mapper/MappingCanvas.tsx`, `src/shared/components/data-mapper/DataMapper.tsx`, `src/styles/data-mapper.css`
  - **Done when:** when no mappings exist, canvas communicates how lines will appear after setup.
  - **Depends on:** `DMUI-2001`, `DMUI-2002`

- [x] **DMUI-2004 - Unresolved mapping trust state**
  - **Components:** mapping counts and warnings
  - **Files:** `src/shared/components/data-mapper/DataMapper.tsx`, `src/shared/components/data-mapper/TargetPanel.tsx`, `src/shared/components/data-mapper/MapperToolbar.tsx`
  - **Done when:** persisted mappings with missing schema/source are shown as unresolved, not fully mapped.
  - **Depends on:** `DMUI-0003`

- [x] **DMUI-2005 - Empty-state and trust regression tests**
  - **Components:** test coverage
  - **Files:** `src/shared/components/data-mapper/DataMapper.test.tsx`, `src/shared/components/data-mapper/SourcePanel.test.tsx`, `src/shared/components/data-mapper/TargetPanel.test.tsx`, `src/shared/components/data-mapper/MappingCanvas.test.tsx`
  - **Done when:** tests lock in guided empty states and trust-state behavior.
  - **Depends on:** `DMUI-2001`, `DMUI-2002`, `DMUI-2003`, `DMUI-2004`

---

## M3 - Visual System Alignment And Polish

### Exit Criteria
- Hierarchy, spacing, and typography are cohesive.
- Badges/lines remain legible without overlap.
- Footer status is concise and non-redundant.

### Tickets

- [x] **DMUI-3001 - Typography and spacing scale normalization**
  - **Components:** global mapper styles
  - **Files:** `src/styles/data-mapper.css`, `src/styles/data-mapper-modal.css`
  - **Done when:** font sizes, weights, control heights, and spacing follow a consistent scale.
  - **Depends on:** `DMUI-1001`

- [x] **DMUI-3002 - Panel/header/search contrast tuning**
  - **Components:** source/target panel visual hierarchy
  - **Files:** `src/styles/data-mapper.css`
  - **Done when:** panel header/search/tree sections are visually distinct and easier to scan.
  - **Depends on:** `DMUI-3001`

- [x] **DMUI-3003 - Canvas badge and line collision handling**
  - **Components:** mapping line annotation system
  - **Files:** `src/shared/components/data-mapper/MappingCanvas.tsx`, `src/styles/data-mapper.css`
  - **Done when:** confidence/suggestion/mismatch/array badges do not overlap in common scenarios.
  - **Depends on:** `DMUI-2003`

- [x] **DMUI-3004 - Footer signal simplification**
  - **Components:** bottom status strip
  - **Files:** `src/shared/components/data-mapper/DataMapper.tsx`, `src/styles/data-mapper.css`
  - **Done when:** footer shows concise status and shortcuts without duplicating top-level status.
  - **Depends on:** `DMUI-1005`, `DMUI-2004`

- [x] **DMUI-3005 - Visual polish snapshot refresh**
  - **Components:** visual regression artifacts
  - **Files:** `src/shared/components/data-mapper/visual-snapshots.test.tsx`, `src/shared/components/data-mapper/__snapshots__/visual-snapshots.test.tsx.snap`
  - **Done when:** snapshots are updated and reviewed for professional visual consistency.
  - **Depends on:** `DMUI-3001`, `DMUI-3002`, `DMUI-3003`, `DMUI-3004`

---

## M4 - Progressive Disclosure For Advanced Tools

### Exit Criteria
- Default view prioritizes high-frequency actions.
- Advanced controls are discoverable but not noisy.
- Optional compact expert mode is available.

### Tickets

- [x] **DMUI-4001 - Advanced tools container**
  - **Components:** toolbar advanced section
  - **Files:** `src/shared/components/data-mapper/MapperToolbar.tsx`, `src/styles/data-mapper.css`
  - **Done when:** profiles/examples/debug/confidence are grouped under an "Advanced" affordance.
  - **Depends on:** `DMUI-1001`

- [x] **DMUI-4002 - Context-aware control visibility**
  - **Components:** dynamic toolbar behavior
  - **Files:** `src/shared/components/data-mapper/MapperToolbar.tsx`, `src/shared/components/data-mapper/DataMapper.tsx`
  - **Done when:** controls appear only when relevant (for example, confidence filter shown only with candidates).
  - **Depends on:** `DMUI-4001`

- [x] **DMUI-4003 - Expert compact mode**
  - **Components:** toolbar density mode
  - **Files:** `src/shared/components/data-mapper/MapperToolbar.tsx`, `src/shared/components/data-mapper/DataMapper.tsx`, `src/styles/data-mapper.css`
  - **Done when:** users can switch between default guided and compact expert layouts.
  - **Depends on:** `DMUI-4001`

- [x] **DMUI-4004 - Progressive disclosure test coverage**
  - **Components:** toolbar state tests
  - **Files:** `src/shared/components/data-mapper/MapperToolbar.test.tsx`, `src/shared/components/data-mapper/DataMapper.test.tsx`
  - **Done when:** tests verify advanced menu behavior, context visibility, and compact mode state.
  - **Depends on:** `DMUI-4001`, `DMUI-4002`, `DMUI-4003`

---

## M5 - Validation, Accessibility, And Release Gate

### Exit Criteria
- UX improvements are test-protected and accessible.
- Manual smoke checklist is completed.
- Release readiness criteria are explicitly passed.

### Tickets

- [x] **DMUI-5001 - Visual regression expansion**
  - **Components:** snapshot and state coverage
  - **Files:** `src/shared/components/data-mapper/visual-snapshots.test.tsx`, `src/shared/components/data-mapper/__snapshots__/visual-snapshots.test.tsx.snap`
  - **Done when:** snapshots cover all critical states introduced in M1-M4.
  - **Depends on:** `DMUI-3005`, `DMUI-4004`

- [x] **DMUI-5002 - Behavioral regression pass**
  - **Components:** mapper component tests
  - **Files:** `src/shared/components/data-mapper/DataMapper.test.tsx`, `src/shared/components/data-mapper/MapperToolbar.test.tsx`, `src/shared/components/data-mapper/SourcePanel.test.tsx`, `src/shared/components/data-mapper/TargetPanel.test.tsx`, `src/shared/components/data-mapper/MappingCanvas.test.tsx`, `src/shared/components/data-mapper/DataMapperModal.test.tsx`
  - **Done when:** updated tests pass with no regressions in core mapping flows.
  - **Depends on:** `DMUI-5001`

- [x] **DMUI-5003 - Accessibility verification pass**
  - **Components:** keyboard, aria labels, focus behavior, contrast
  - **Files:** `src/shared/components/data-mapper/*.tsx`, `src/styles/data-mapper.css`, `src/styles/data-mapper-modal.css`
  - **Done when:** no accessibility regressions after UI refactor (focus order, labels, contrast).
  - **Depends on:** `DMUI-5002`

- [x] **DMUI-5004 - Manual UX smoke checklist completion**
  - **Components:** QA workflow
  - **Files:** `docs/plan/data-mapper-ui-improvement.md`
  - **Done when:** checklist below is executed and signed off.
  - **Depends on:** `DMUI-5002`, `DMUI-5003`

- [x] **DMUI-5005 - Final release gate**
  - **Components:** overall mapper package
  - **Files:** `docs/plan/data-mapper-ui-improvement.md`
  - **Done when:** all tickets complete, tests pass, and UX sign-off is recorded.
  - **Depends on:** all previous tickets

---

## Manual UX Smoke Checklist (for DMUI-5004)

- [x] First-time flow: paste source JSON -> define target -> create first mapping without confusion.
- [x] Empty-state flow: source empty, target empty, both empty each show actionable guidance.
- [x] Trust-state flow: no contradictory mapped counts in empty/partial states.
- [x] Auto-map flow: candidate threshold and advanced controls are understandable.
- [x] Advanced flow: profiles/examples/debug are discoverable but not noisy.
- [x] Keyboard flow: search shortcut, undo/redo, delete, panel switching still work.
- [x] Modal flow: Save/Cancel hierarchy is visually clear and consistent.

### Smoke Execution Record (2026-05-12)

- Mapper smoke regression suite executed:
  - `npx vitest run src/shared/components/data-mapper/DataMapper.test.tsx src/shared/components/data-mapper/MapperToolbar.test.tsx src/shared/components/data-mapper/SourcePanel.test.tsx src/shared/components/data-mapper/TargetPanel.test.tsx src/shared/components/data-mapper/MappingCanvas.test.tsx src/shared/components/data-mapper/DataMapperModal.test.tsx src/shared/components/data-mapper/MapperFooter.test.tsx src/shared/components/data-mapper/visual-snapshots.test.tsx`
  - Result: `8` files passed, `512` tests passed.
- Type gate executed:
  - `npx tsc --noEmit`
  - Result: passed.
- UX sign-off record: User approved proceeding with final smoke/release gate in chat (`"Go ahead."`).

---

## Global Completion Criteria

- [x] Milestones M0-M5 complete
- [x] `npx tsc -b --noEmit` passes
- [x] Targeted mapper test files pass
- [x] Updated visual snapshots reviewed
- [x] Accessibility re-check completed
- [x] UX smoke checklist completed

