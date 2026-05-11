# Data Mapper UI/UX Improvement Plan

> Created: 2026-05-11  
> Scope: Data Mapper presentation quality, interaction clarity, and professional UX polish  
> Complements: `docs/plan/data-mapper-plan.md` (feature-complete roadmap)

---

## Why This Plan Exists

The Data Mapper is functionally rich, but the current production UI (as seen in the latest screenshot) still feels visually dense, inconsistent, and less professional than the intended benchmark in `docs/mockups/data-mapper-edge-cases-mockup.html`.

This document focuses only on **UI/UX quality improvement**, not core mapping logic.

---

## Evaluation Inputs Reviewed

1. **Current production UI screenshot** (Response Body -> Variables modal state)
2. **Edge-case mockup reference**: `docs/mockups/data-mapper-edge-cases-mockup.html`
3. **Existing master roadmap**: `docs/plan/data-mapper-plan.md`
4. **Commercial UX guidance already captured in plan**:
   - Two-panel trees + center mapping canvas
   - Progressive disclosure for advanced transformations
   - Strong type indicators and mapping status feedback
   - Search-first navigation for large schemas
   - Live feedback + trust-building state clarity

---

## Executive Assessment

The gap is not missing features. The gap is **experience coherence**:

- Too many controls appear at once in the top toolbar, with weak grouping and mixed visual language.
- Empty-state experience is low guidance and low trust (example: visible "1 mapping" while source and target are both empty).
- Visual hierarchy is flat; important and secondary actions compete equally.
- Styling uses many tiny controls and icon styles that look utility-oriented rather than product-polished.
- The mockup communicates mapping state, complexity, and next steps better through stronger hierarchy, badges, and progressive disclosure.

---

## Gap Matrix: Current vs Mockup

| Area | Current Screenshot Behavior | Mockup Benchmark | UX Impact | Priority |
|---|---|---|---|---|
| Toolbar information density | Many controls in one row, all similar weight | Clear action grouping; progressive disclosure | Cognitive overload, weak first-impression quality | P0 |
| Visual language | Emoji-heavy action labels (for example, "Auto-map", "Examples") mixed with text buttons | Consistent product-grade iconography and labels | Feels less enterprise/professional | P0 |
| State trust | Shows `1 mapping` / `1 mapped` while both trees are empty | State appears context-aware and self-consistent | User confidence drops; appears buggy | P0 |
| Empty states | Passive text only; no guided next action flow | Contextual, action-oriented empty-state pattern | Slower onboarding, uncertain next step | P0 |
| Primary action emphasis | "Done" is visually detached from mapping workflow | Apply/complete action visually integrated with status | Completion path unclear | P1 |
| Panel hierarchy | Panel headers/search/actions are visually similar; low contrast distinctions | Stronger panel segmentation and scanability | Harder to parse regions quickly | P1 |
| Canvas utility in empty state | Large blank middle zone with little help | Canvas conveys meaning through structure, labels, and status | Wasted visual real estate | P1 |
| Advanced feature discoverability | All users see advanced controls immediately | Progressive disclosure by context and user intent | Novice intimidation, expert clutter | P1 |
| Typography and spacing rhythm | Small typography and tight controls in several regions | Balanced rhythm and better breathing room | Perceived quality penalty | P2 |
| Interaction consistency | Multiple status surfaces (top count, panel count, bottom footer) can conflict | Unified status model | Redundant/conflicting signals | P2 |

---

## Root Causes

1. **Feature accretion without IA reset**  
   Many advanced capabilities were added into existing shell areas (mainly toolbar), but the shell was not redesigned to absorb that complexity.

2. **Single-row command model**  
   Primary, secondary, contextual, and expert actions currently live together.

3. **State model not tied to view readiness**  
   Mapping counts are computed globally, even when source/target trees are empty or unresolved.

4. **Styling token drift and inconsistent affordance weight**  
   Different visual styles coexist (emoji controls, compact utility buttons, badges, footer hints), resulting in mixed product tone.

5. **Empty-state UX treated as fallback text, not a workflow**  
   Empty states should guide setup sequence (Source -> Target -> First mapping), not just explain absence.

---

## UX North-Star Principles

1. **Clarity before power**: show core actions first, reveal advanced tools contextually.
2. **One truth per state**: visible counters and badges must always match the visible data context.
3. **Guided first-use path**: empty state should be actionable, not descriptive only.
4. **Consistent visual grammar**: typography, iconography, spacing, and badges must feel like one system.
5. **Progressive complexity**: advanced controls should not penalize beginners.
6. **Professional tone**: remove novelty cues that reduce enterprise confidence.

---

## Proposed UX Improvement Roadmap

### Phase UI-1: Shell & Information Architecture Reset (P0)

**Goal:** Make the interface immediately readable and professional before adding visual polish details.

| Task | Description | Files (expected) |
|---|---|---|
| UI-1.1 Toolbar regrouping | Split actions into: Core Mapping, View Modes, Advanced Tools, History | `MapperToolbar.tsx`, `DataMapper.tsx`, `data-mapper.css` |
| UI-1.2 Replace emoji-first controls | Move to consistent icon + text or text-only system | `MapperToolbar.tsx`, `SourcePanel.tsx`, `data-mapper.css` |
| UI-1.3 Primary action hierarchy | Ensure completion CTA and mapping status have clear visual hierarchy | `DataMapperModal.tsx`, `data-mapper-modal.css` |
| UI-1.4 State integrity rules | If source/target unavailable, show "unresolved mapping" state instead of plain mapped count | `DataMapper.tsx`, `TargetPanel.tsx` |

**Acceptance criteria**
- User can identify primary action and workflow in <5 seconds.
- No conflicting counts between top status, panel badges, and footer.
- Toolbar can be scanned by role group, not by individual button parsing.

---

### Phase UI-2: Empty-State Experience Redesign (P0)

**Goal:** Convert blank mapper states into guided setup flow.

| Task | Description | Files (expected) |
|---|---|---|
| UI-2.1 Guided setup cards | Add action cards: "Paste Source JSON", "Fetch Source Sample", "Define Target Schema", "Load Sample" | `SourcePanel.tsx`, `TargetPanel.tsx`, `data-mapper.css` |
| UI-2.2 Contextual callouts | Show setup progress steps (1/3 source ready, 2/3 target ready, 3/3 mapping ready) | `DataMapper.tsx`, `data-mapper.css` |
| UI-2.3 Empty canvas helper | Add center instructional scaffold (how mapping appears once both sides are ready) | `MappingCanvas.tsx`, `data-mapper.css` |
| UI-2.4 Recoverability hints | If mappings exist but schema missing, surface clear recovery CTA | `DataMapper.tsx`, `TargetPanel.tsx` |

**Acceptance criteria**
- First-time user can create first mapping without external instructions.
- Empty state never appears as "dead space".
- No "mapped" counts shown without corresponding visible mappable structure.

---

### Phase UI-3: Visual System Alignment with Mockup (P1)

**Goal:** Close aesthetic gap between production UI and edge-case mockup quality.

| Task | Description | Files (expected) |
|---|---|---|
| UI-3.1 Typography scale cleanup | Normalize size scale and weight for title, panel headers, metadata, helper text | `data-mapper.css`, `data-mapper-modal.css` |
| UI-3.2 Spacing rhythm pass | Standardize paddings, row heights, badge spacing, control heights | `data-mapper.css` |
| UI-3.3 Header/panel contrast tuning | Improve separation of toolbar, panel headers, search rows, canvas | `data-mapper.css` |
| UI-3.4 Badge and line polish | Ensure mapping badges, confidence chips, and mismatch badges remain legible and non-overlapping | `MappingCanvas.tsx`, `data-mapper.css` |
| UI-3.5 Footer rationalization | Keep one concise status strip; remove redundant noise | `DataMapper.tsx`, `data-mapper.css` |

**Acceptance criteria**
- Visual hierarchy matches mockup quality expectations.
- No badge overlap across common layouts.
- Interface appears coherent at 100%, 125%, and 150% zoom.

---

### Phase UI-4: Progressive Disclosure for Advanced Tools (P1)

**Goal:** Keep power features without overwhelming default experience.

| Task | Description | Files (expected) |
|---|---|---|
| UI-4.1 Advanced tools menu | Move less frequent controls (examples, profiles, confidence threshold, debug) into structured popover/drawer | `MapperToolbar.tsx`, `data-mapper.css` |
| UI-4.2 Context-aware control visibility | Show controls only when relevant (e.g., confidence only when auto-map candidates exist) | `MapperToolbar.tsx`, `DataMapper.tsx` |
| UI-4.3 Compact expert mode | Optional toggle to re-enable dense view for power users | `MapperToolbar.tsx`, `DataMapper.tsx` |

**Acceptance criteria**
- Default toolbar shows only high-frequency actions.
- Advanced controls stay discoverable but unobtrusive.
- Novice and expert workflows both remain efficient.

---

### Phase UI-5: UX Validation & Release Gate (P0 before merge)

**Goal:** Treat UX quality as shippable quality, not subjective polish.

| Task | Description | Files (expected) |
|---|---|---|
| UI-5.1 Visual regression suite expansion | Add snapshots/stories for empty, partial, and fully mapped states | `visual-snapshots.test.tsx` (+ related tests) |
| UI-5.2 UX scenario checklist | Add deterministic QA scenarios: first-use flow, partial schema, mismatch fix, auto-map review | `docs/plan` and test docs |
| UI-5.3 Accessibility re-check | Verify focus order, contrast, and screen-reader labels after UI changes | mapper components + CSS |
| UI-5.4 Smoke usability test | 3-5 internal runs measuring first-map completion time and confusion points | validation artifact |

**Acceptance criteria**
- Visual regressions cover empty and setup states explicitly.
- UX checklist passes before merge.
- No a11y regressions from visual updates.

---

## Prioritized Backlog (Implementation Order)

### P0 (Do First)

1. Toolbar regrouping and visual hierarchy reset
2. Empty-state workflow redesign
3. State integrity fix for mapping counters vs visible tree availability
4. Professional iconography and control language cleanup
5. UX validation gate definition

### P1 (Do Next)

1. Visual system tuning (typography, spacing, contrast)
2. Advanced-tool progressive disclosure
3. Footer and status channel simplification

### P2 (Polish/Optimization)

1. Optional expert compact mode
2. Further animation and micro-interaction refinements
3. Theme variants (if needed beyond current dark baseline)

---

## Proposed Deliverables

1. **Updated mapper shell** with cleaner command IA
2. **Guided empty-state UX** for both source and target setup
3. **Unified professional visual style** aligned with mockup intent
4. **Consistent state messaging** with no contradictory counters
5. **Documented UX quality gate** for future changes

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Over-optimizing visuals while breaking existing workflows | Medium | Keep behavior unchanged in UI-1/UI-3; add focused regression tests |
| Toolbar simplification hides needed controls | Medium | Add "Advanced" grouping with persistent discoverability |
| New empty-state flow adds complexity | Low | Keep max 2-step CTAs per panel, avoid wizard overhead |
| CSS regressions across many features | High | Add targeted visual snapshots for key states before refactor |

---

## Success Metrics

1. **Perceived quality:** stakeholder review rates UI as "professional and production-ready"
2. **First-map onboarding:** new user completes first mapping with no guidance
3. **Trust signals:** no contradictory status indicators in empty/partial states
4. **Operational quality:** zero visual/a11y regressions in mapper test suite

---

## Implementation Notes

- This plan should be executed as a **new UI-focused phase** after current feature-complete baseline.
- Functional mapping engine should remain stable; changes are mainly shell, hierarchy, and visual behavior.
- If desired, this can be tracked as **Phase 12: UI/UX Professionalization** inside `data-mapper-plan.md`, with this file as the detailed execution spec.

