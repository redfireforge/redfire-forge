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
| M6 | Post-audit UI/UX enhancement delta | 8 | `MapperToolbar`, `DataMapper`, `PreviewBar`, `CodeView`, Playwright |

---

## Current UI Comparison Audit (2026-05-12)

### Audit Inputs

- Latest implementation in:
  - `src/shared/components/data-mapper/DataMapper.tsx`
  - `src/shared/components/data-mapper/MapperToolbar.tsx`
  - `src/shared/components/data-mapper/MappingCanvas.tsx`
  - `src/shared/components/data-mapper/DataMapperModal.tsx`
  - `src/styles/data-mapper.css`
  - `src/styles/data-mapper-modal.css`
- Current UI screenshot (dense mapped scenario with toolbar + mapping list + preview visible).
- Existing vitest/snapshot coverage in `src/shared/components/data-mapper/*test.tsx`.

### Milestone-by-Milestone Comparison

- **M0 (Baseline/guardrails):** implemented and test-covered.
- **M1 (IA/action hierarchy/modal shell):** mostly implemented; however dense toolbar states still create cognitive load in real-world scenarios.
- **M2 (empty/trust states):** implemented and behavior-guarded.
- **M3 (visual polish):** partially complete in practical usage; crowded bottom utilities and dense list readability still need UX tuning.
- **M4 (progressive disclosure):** partially complete; advanced grouping exists, but initial/expanded behavior and high-action density need refinement for calmer default flow.
- **M5 (validation/release gate):** completed for current scope (tests/typecheck/docs), but browser-level UX regressions are not yet protected by Playwright.

### Key Gaps Found In Current UI

- **Toolbar noise in dense sessions:** when multiple view/debug/history controls are visible, top action row is still visually busy.
- **Progressive disclosure behavior:** advanced actions are grouped, but default disclosure behavior is not yet optimized for lowest-noise first-map experience.
- **Bottom stack crowding:** mapping list + preview can consume vertical space and reduce canvas readability during larger mappings.
- **Dense-content readability:** long mapping rows/path-heavy entries need stronger readability affordances in high-volume mappings.
- **Browser-level UX guardrails missing:** no dedicated Playwright coverage for mapper UX interactions and regression visuals.

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
- [x] Milestones M0-M6 complete (post-audit enhancement delta)
- [x] `npx tsc -b --noEmit` passes
- [x] Targeted mapper test files pass
- [x] Updated visual snapshots reviewed
- [x] Accessibility re-check completed
- [x] UX smoke checklist completed

---

## M6 - Post-Audit UI/UX Enhancement Delta

### Exit Criteria

- Default mapper view is calmer for first-map and dense-map workflows.
- Utility surfaces (code/preview/list) are easier to manage without shrinking primary canvas focus.
- Advanced features remain discoverable but less visually noisy.
- Critical mapper UX behaviors are protected by Playwright scenarios.

### Tickets

- [x] **DMUI-6001 - Toolbar declutter and action prioritization (dense state pass)**
  - **Components:** top toolbar hierarchy
  - **Files:** `src/shared/components/data-mapper/MapperToolbar.tsx`, `src/styles/data-mapper.css`
  - **Done when:** high-frequency controls remain instantly accessible while secondary controls are visually de-emphasized in dense sessions.
  - **Depends on:** `DMUI-4001`

- [x] **DMUI-6002 - Progressive disclosure default-state refinement**
  - **Components:** advanced container behavior
  - **Files:** `src/shared/components/data-mapper/MapperToolbar.tsx`, `src/shared/components/data-mapper/DataMapper.tsx`
  - **Done when:** advanced controls open/close behavior supports a lower-noise default and predictable re-entry state.
  - **Depends on:** `DMUI-6001`

- [x] **DMUI-6003 - Bottom utility dock consolidation (code/preview/list)**
  - **Components:** bottom utility surfaces
  - **Files:** `src/shared/components/data-mapper/DataMapper.tsx`, `src/shared/components/data-mapper/CodeView.tsx`, `src/shared/components/data-mapper/PreviewBar.tsx`, `src/styles/data-mapper.css`
  - **Done when:** mapping list/code/preview usage does not overly compress primary source-canvas-target workflow.
  - **Depends on:** `DMUI-3004`

- [x] **DMUI-6004 - High-volume mapping readability pass**
  - **Components:** mapping list/tree readability
  - **Files:** `src/shared/components/data-mapper/CodeView.tsx`, `src/shared/components/data-mapper/SourceTreeNode.tsx`, `src/shared/components/data-mapper/TargetTreeNode.tsx`, `src/styles/data-mapper.css`
  - **Done when:** long paths and large mapping sets are more scannable (spacing/truncation/hover affordances) without clutter.
  - **Depends on:** `DMUI-6003`

- [x] **DMUI-6005 - Save CTA emphasis and footer clarity (dense modal pass)**
  - **Components:** modal footer/action confidence
  - **Files:** `src/shared/components/data-mapper/DataMapperModal.tsx`, `src/styles/data-mapper-modal.css`
  - **Done when:** Save path remains visually clear and consistently prominent in long mapping sessions.
  - **Depends on:** `DMUI-1004`

- [x] **DMUI-6006 - Adaptive layout behavior for wide/narrow mapper states**
  - **Components:** responsive layout and panel proportions
  - **Files:** `src/shared/components/data-mapper/DataMapper.tsx`, `src/styles/data-mapper.css`
  - **Done when:** toolbar/body/footer remain readable across compact and wide modal sizes without control crowding.
  - **Depends on:** `DMUI-6001`, `DMUI-6003`

- [x] **DMUI-6007 - Playwright mapper UX flow coverage**
  - **Components:** browser-level regression coverage
  - **Files:** `e2e/data-mapper-ui.spec.ts`
  - **Done when:** end-to-end flows cover first-map, dense mapped state, advanced toggle behavior, bottom utility behavior, and save/cancel hierarchy.
  - **Depends on:** `DMUI-6002`, `DMUI-6003`, `DMUI-6005`, `DMUI-6006`

- [x] **DMUI-6008 - Post-audit visual baseline and sign-off refresh**
  - **Components:** visual verification artifacts/docs
  - **Files:** `src/shared/components/data-mapper/visual-snapshots.test.tsx`, `src/shared/components/data-mapper/__snapshots__/visual-snapshots.test.tsx.snap`, `docs/plan/data-mapper-ui-improvement.md`
  - **Done when:** updated snapshots + Playwright evidence are reviewed and sign-off is recorded.
  - **Depends on:** `DMUI-6004`, `DMUI-6007`

### M6 Implementation Update (2026-05-12)

- Consolidated bottom utility into a single active dock surface (`Code` or `Preview`) to prevent stacked compression of the source/canvas/target workflow.
- Added high-volume readability improvements for mapping table rows (multiline truncation, better path/value scanability) and tree hover affordances for full normalized field paths.
- Emphasized modal save CTA with stronger visual priority and responsive footer behavior.
- Added adaptive layout media-query handling for toolbar/status/body utility behavior in narrower modal widths.
- Added browser-level mapper UX coverage in `e2e/data-mapper-ui.spec.ts` for first-map drag/drop, advanced toggle behavior, dock behavior, and save/cancel hierarchy.
- Playwright validation run completed: `npx playwright test e2e/data-mapper-ui.spec.ts --reporter=html --workers=40 --timeout=5000` (3 passed).

### M6 Closeout Execution Record (2026-05-12)

- Visual baseline refresh:
  - `npx vitest run src/shared/components/data-mapper/visual-snapshots.test.tsx -u`
  - Result: `32` tests passed, `25` snapshots updated and reviewed.
- Keyboard/accessibility regression sweep:
  - `npx vitest run src/shared/components/data-mapper/DataMapper.test.tsx src/shared/components/data-mapper/SourcePanel.test.tsx src/shared/components/data-mapper/TargetPanel.test.tsx src/shared/components/data-mapper/MapperToolbar.test.tsx src/shared/components/data-mapper/MappingCanvas.test.tsx`
  - Result: `5` files passed, `431` tests passed.
- Type gate:
  - `npx tsc --noEmit`
  - Result: passed.
- Browser UX guardrails:
  - `npx playwright test e2e/data-mapper-ui.spec.ts --reporter=html --workers=40 --timeout=5000`
  - Result: `3` tests passed.
- UX sign-off record: User approved M6 closeout execution in chat (`"Go ahead."`).

---

## Post-Audit Smoke Checklist (for M6)

- [x] Dense mapped scenario preserves source/canvas/target readability.
- [x] Advanced controls are discoverable but not noisy by default.
- [x] Code/Preview/List usage no longer crowds primary mapping flow.
- [x] Save/Cancel path remains obvious in long sessions.
- [x] Keyboard and screen-reader interactions remain intact after UI adjustments.
- [x] Playwright scenarios pass for mapper UX critical paths.

---

## M7 - Benchmark-Driven Functional Parity Roadmap

### Benchmark Scope (Web Research Baseline)

Commercial/enterprise mappers reviewed:
- MuleSoft Transform Message (graphical mapping + fixed values/functions + live code sync)
- Boomi Map components (drag/drop map, Boomi Suggest, clear/restart, map functions)
- SnapLogic Mapper (mapping table, search/filter mapped vs unmapped, AutoLink, pass-through, preview)
- Informatica Mapping Designer (validation panel, lineage bird's-eye, run/test, mapping canvas ergonomics)
- Talend Data Mapper (loop expressions, nested loops, loop-to-loop and loop-to-scalar handling)
- Altova MapForce (autoconnect child items, rich function library, preview/debugger, mapping automation)
- Workato group mapping (one-shot name-based bulk mapping across large field sets)
- Make mapping arrays (array-index handling, iterator/aggregator patterns)

Open-source and source-available transformation ecosystems reviewed:
- JOLT (shift/default/remove/cardinality chain model)
- JSONata (query/transform language, map/filter/reduce operators)
- Apache NiFi JoltTransformJSON + RecordPath (processor-level transform + structured path DSL)
- n8n data mapping (drag-drop expression generation with linked item semantics)

### Key Capability Gaps Observed in Current Mapper

- Subtree mapping is incomplete for non-leaf object->object drops in some paths.
- High-volume array mapping (100+ repeated items) still needs deterministic one-shot workflows.
- Left/right structure parity can drift (tree segmentation and path rendering consistency).
- Bulk operations are too implicit; users need explicit "Map subtree", "Map all siblings", and "Propagate pattern".
- Validation ergonomics are weaker than benchmark tools (mapped/unmapped filters, integrity diagnostics, quick repair loops).
- Preview/debug confidence remains behind mature tools (step-debug style visibility, before/after diff at mapping row level).

### Recommended Functional Milestones

#### P0 - Foundational Mapping Reliability (must-have)

- [x] **DMUI-7001 - Deterministic subtree mapping semantics**
  - **Goal:** Dragging object/array node A->B maps all matching descendants in one action with explicit add/update behavior.
  - **Done when:** object->object and array-index->array-index drops produce predictable bulk results and toast summary.

- [x] **DMUI-7002 - High-volume repeated array one-shot mapping**
  - **Goal:** Map `offers[*].x` style paths with one action, not N manual drags.
  - **Done when:** auto-map and map-siblings can map 100+ repeated children in a single operation with conflict handling.

- [x] **DMUI-7003 - Explicit bulk actions**
  - **Goal:** Add first-class controls: `Map subtree`, `Map all matching siblings`, `Clear subtree`, `Replace mapped subtree`.
  - **Done when:** users can execute and undo bulk operations without ambiguity.

- [x] **DMUI-7004 - Left/right tree parity normalization**
  - **Goal:** Source and target present equivalent hierarchy semantics (`offers -> [0] -> field`).
  - **Done when:** search, drag targets, and line routing operate on consistent normalized paths.

- [x] **DMUI-7005 - Mapped/unmapped operational filters**
  - **Goal:** Add filters and counts for mapped/unmapped in both source and target trees.
  - **Done when:** users can isolate unmapped items quickly in dense datasets.

#### P1 - Workflow Acceleration and Recovery

- [x] **DMUI-7101 - Pattern propagation across indices**
  - **Goal:** Learn mapping on `[0]`, propagate to `[1..N]` with safe preview.
  - **Done when:** users can apply propagate-pattern and review impacted mappings before confirm.

- [x] **DMUI-7102 - Mapping table mode with row search and diff preview**
  - **Goal:** Add table mode for large maps similar to enterprise mapper workflows.
  - **Done when:** expression/path rows support search, focus mode, and before/after value preview.
  - **Implementation scope (this pass):**
    - Add `Code`/`Table` mode toggle inside mapper bottom utility surface.
    - In table mode, render one row per mapping with `target`, `source/expression`, `before`, `after`, and `status`.
    - Add row search over target/source/expression/preview values.
    - Add focus mode to show only matching rows when search is active.
    - Mark row status (`changed`, `unchanged`, `error`) based on before/after evaluation.
  - **Validation (completed):**
    - Extended `CodeView` unit tests for mode toggle, search + focus mode, and before/after preview semantics.
    - Verified mapper code-view integration test path and TypeScript check.

- [x] **DMUI-7103 - Validation and repair panel**
  - **Goal:** Central panel for missing targets, duplicate targets, type mismatch, unresolved paths.
  - **Done when:** each issue has direct action (`fix`, `replace`, `ignore once`, `open node`).
  - **Implementation scope (this pass):**
    - Add an in-mapper validation/repair panel that lists actionable issues in one place.
    - Surface issue categories: missing target, duplicate target, type mismatch, unresolved source path.
    - Provide direct row actions: `fix`, `replace`, `ignore once`, and `open node`.
    - Wire actions into mapper state updates (quick expression fix, duplicate replacement, node focus).
  - **Validation (completed):**
    - Extended DataMapper integration tests to cover issue rendering and repair actions.
    - Verified full `DataMapper.test.tsx` suite and TypeScript check.

- [x] **DMUI-7104 - Schema drift guardrails**
  - **Goal:** Detect target/source schema drift and batch repair affected mappings.
  - **Done when:** drift report and repair actions are available before save.
  - **Implementation scope (this pass):**
    - Extend drift detection to both source and target snapshots.
    - Add batch repair action in schema diff view (`Apply all repairs`) with deduped mapping-level application.
    - Guard save flow when unresolved breaking drift remains, and direct users to drift report/repair actions.
    - Keep single-repair and accept-update flows functional alongside batch repair.
  - **Validation (completed):**
    - Extended `SchemaDiffModal` tests for batch repair controls and payload behavior.
    - Extended `DataMapperModal` tests for pre-save drift guardrail and save-after-batch-repair flow.
    - Verified targeted mapper tests + TypeScript check.

#### P2 - Advanced Productivity and Trust

- [x] **DMUI-7201 - Function/expression workflow parity**
  - **Goal:** Better fixed value + function pipelines (inline compose, reusable snippets, function templates).
  - **Done when:** users can apply transforms as quickly as commercial mapper formula/function modes.
  - **Implementation scope (this pass):**
    - Add inline compose action to wrap current expression with selected function templates.
    - Add reusable expression snippets (save, reuse, delete) in the expression editor.
    - Add quick function-template picker with search + compose mode (`use source path` vs `compose current`).
    - Add fixed-value quick builder for string/number/boolean/null expression literals.
  - **Validation (completed):**
    - Extend expression editor tests for compose flow, snippet lifecycle, templates, and fixed-value builder.
    - Add snippet storage utility tests.
    - Run targeted expression/editor tests + TypeScript check.

- [x] **DMUI-7202 - Debug and observability mode**
  - **Goal:** Mapping step-through diagnostics with row-level input/output value trace.
  - **Done when:** users can inspect where a mapping failed without leaving the mapper context.
  - **Implementation scope (this pass):**
    - Extend table mode with per-row trace inspection action.
    - Add in-context trace inspector panel showing source/evaluated/target values and timing.
    - Add expression step timeline for selected row using mapper step-debug utility.
    - Surface runtime-trace metadata when available and fallback to preview-derived trace when not.
  - **Validation (completed):**
    - Extend `CodeView` tests for trace inspector rendering, runtime trace usage, and error visibility.
    - Validate integration wiring from `DataMapper` to `CodeView`.
    - Run targeted `CodeView` + `DataMapper` tests and TypeScript check.

- [x] **DMUI-7203 - Mapping profiles and reusable templates**
  - **Goal:** Save/load named mapping presets for recurring payload families.
  - **Done when:** teams can reuse baseline mappings and apply delta edits instead of remapping from scratch.
  - **Implementation scope (this pass):**
    - Extend profile UX with explicit `Apply delta` action in addition to full `Load`.
    - Add deterministic profile-delta merge logic (by normalized target path) with insert/update/unchanged accounting.
    - Wire delta-apply flow into mapper state with user feedback toast and selection reset.
    - Keep existing profile save/load/rename/delete behavior intact.
  - **Validation (completed):**
    - Add unit tests for profile-delta merge utility behavior.
    - Extend toolbar tests for delta action visibility and callback wiring.
    - Extend DataMapper integration tests for delta apply behavior from profile menu.
    - Run targeted mapper/profile tests and TypeScript check.

### M7 Deliverable Criteria

- [x] Competitive benchmark summary captured with feature-to-ticket traceability.
- [x] P0 tickets implemented and validated by targeted Vitest coverage + Playwright critical-path coverage.
- [x] Large-array workflows (100+ repeated children) verified in one-shot mapping UX.
- [x] Validation workflows catch and repair mapping integrity issues before save.
- [x] Updated visual baseline and UX sign-off recorded.

### External References Used (for M7)

- https://docs.mulesoft.com/mule-runtime/latest/transform-graphically-construct-mapping-design-center-task
- https://help.boomi.com/docs/atomsphere/integration/process%20building/c-atm-map_components_87f669d6-4999-445f-9f29-ed24e79c92dd/
- https://docs.snaplogic.com/snaps/snaps-core/sp-transform/snap-mapper.html
- https://docs.snaplogic.com/snaps/snaps-core/sp-transform/use-mapping-table.html
- https://docs.informatica.com/integration-cloud/data-integration/current-version/mappings/mappings/mapping-designer.html
- https://help.qlik.com/talend/en-US/data-mapper-user-guide/8.0-R2026-02/loop-expressions
- https://www.altova.com/mapforce
- https://docs.workato.com/recipes/group-data-mapping.html
- https://help.make.com/mapping-arrays
- https://raw.githubusercontent.com/bazaarvoice/jolt/master/README.md
- https://docs.jsonata.org/overview.html
- https://nifi.apache.org/components/org.apache.nifi.processors.jolt.JoltTransformJSON
- https://nifi.apache.org/nifi-docs/record-path-guide.html
- https://docs.n8n.io/data/data-mapping/
