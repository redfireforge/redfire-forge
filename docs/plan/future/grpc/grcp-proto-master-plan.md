# gRPC Proto Hybrid Editor Master Plan

## 1. Document Status
This is the canonical master document for the gRPC proto hybrid editor redesign and implementation.

It consolidates:
- Product/UX plan (previously in `grcp-proto-new-design.md`)
- Engineering implementation contract (previously in `grcp-proto-implementation-contract.md`)

### 1.1 Phase Status Tracker
| Phase | Status | Updated | Notes |
|---|---|---|---|
| Phase 0.2 Foundations | ✅ Completed | 2026-07-05 | Feature flag, reducer state/events, validation utilities, baseline tests |
| Phase 0.4 Option C Contract Alignment | ✅ Completed | 2026-07-06 | Modal view state, JSON parse blocking semantics, reducer/test coverage |
| Phase 0.5 Hybrid Modal Wiring + Telemetry | ✅ Completed | 2026-07-06 | Full-form modal integration, dirty-close confirm, modal lifecycle telemetry |
| Phase 1 Option B Core | ✅ Completed | 2026-07-06 | Navigator + Focus editor composer, selected-path telemetry, read-only lock while modal open |
| Phase 2 Option A Modal Integration | ✅ Completed | 2026-07-06 | Transactional apply gating, modal open-context capture, post-close context restore |
| Phase 2.5 Option C Modal Tab Integration | ✅ Completed | 2026-07-06 | Modal JSON view sync + parse-error blocking + user-text preservation |
| Phase 3 Hardening | ✅ Completed | 2026-07-06 | Telemetry contract completion, navigator accessibility/keyboard/filter pass, regression verification |
| Phase 4 Gradual Rollout | 🔨 In Progress | 2026-07-06 | Staged feature-flag rollout, mockup-parity refinements, complex-form demo sample |

## 2. Executive Summary
Primary direction:
- Default editor: Option B (Schema Navigator + Focus Detail Editor)
- Secondary editor: Option A (Full Form Editor) in a modal
- Alternate modal angle: Option C (JSON-first Editor tab) in the same modal

Design and engineering goals:
- Reduce complexity for medium/large payload editing
- Preserve fast full-form bulk editing as an explicit action
- Keep one canonical request draft across all editor surfaces
- Guarantee payload and validation parity between surfaces

## 3. Scope and Non-Goals
### 3.1 Scope
- UX architecture for hybrid proto editing
- Shared state and validation model
- Modal apply/discard transaction semantics
- Component boundaries and event contracts
- Rollout, telemetry, testing, and Definition of Done

### 3.2 Non-Goals
- No API transport changes
- No protobuf parsing/runtime contract changes
- No response panel redesign in this phase
- No breaking changes to existing request execution pipeline

## 4. Problem Statement
Current full stacked form editing becomes difficult for complex schemas due to:
- Excessive vertical scrolling
- Mixed field types in one uninterrupted surface
- Weak structural hierarchy for oneof/map/repeated relationships
- Context loss while moving between distant fields

## 5. Product Strategy
### 5.1 Core UX Decision
- Keep Option B as the default editing model
- Offer Option A as an on-demand modal editor
- Offer Option C as a modal tab for JSON-first editing and structural review

### 5.2 Why Hybrid
- Option B lowers cognitive load and improves orientation
- Option A supports all-fields-at-once workflows
- Option C supports users who think/edit in raw JSON while keeping schema alignment
- Hybrid supports both novice and expert behavior without forcing one path

## 6. Information Architecture
### 6.1 Default Workspace Layout
- Left: service/method explorer (unchanged)
- Middle composer: Schema Navigator + Focus Detail Editor
- Right: response panel (unchanged)

### 6.2 Full Form Modal
- Entry point: composer header button "Full Form Editor"
- Contains tabbed modal views:
  - Option A tab: grouped progressive-card full form editing
  - Option C tab: JSON-first editor with validation and parser feedback
- Uses same shared validation semantics as default editor
- Uses one modal working draft lifecycle across both tabs (A/C)

## 7. UX and Interaction Contracts
### 7.1 UX Principles
- Show structure first, depth on demand
- One source of truth for request draft
- Consistent field semantics across both editors
- Strong oneof branch clarity
- Efficient keyboard and mouse workflows

### 7.2 Default Flow (Option B)
1. User selects a schema node in Navigator.
2. Focus editor binds to selected path and renders controls.
3. Navigator shows aggregate status (complete/warn/error).
4. User moves node-to-node without long scroll jumps.

### 7.3 Modal Flow (Option A)
1. User opens Full Form Editor modal.
2. Modal clones canonical draft into working draft.
3. User edits full payload.
4. User chooses Apply to Request or Discard.
5. On close, restore previous Option B focus context.

### 7.4 Modal Tab Flow (Option C)
1. User switches modal tab to Option C (JSON-first Editor).
2. Modal JSON editor initializes from current modal working draft.
3. User edits JSON directly.
4. Valid JSON updates modal working draft (A and C stay synchronized).
5. Invalid JSON keeps last valid working draft, surfaces inline parse error, and blocks Apply.

### 7.5 Sync Contract (Option A <-> Option C)
- A -> C: form edits update JSON view immediately.
- C -> A: valid JSON edits update form view immediately.
- Parse failures in C never corrupt modal working draft.
- Apply/Discard acts on one shared modal working draft regardless of active tab.

### 7.6 Concurrency Rule
- While modal is open, Option B editing is read-only.

## 8. System Model and Shared Concepts
- `RequestDraft`: canonical editable request state per active gRPC tab
- `SchemaPath`: stable node identifier (field/branch/nested path)
- `FieldValidity`: `valid | warning | error | unknown`
- `NodeAggregateStatus`: navigator-level aggregate state

Editor surfaces:
- `FocusEditor` (default, composer)
- `FullFormModal` (secondary, overlay)
  - `ModalFullFormTab` (Option A)
  - `ModalJsonTab` (Option C)

Both surfaces must operate on one canonical draft lifecycle.

## 9. State and Data Model
### 9.1 Canonical Tab State
```ts
type GrpcEditorTabState = {
  tabId: string;
  requestDraft: unknown;
  navigator: {
    selectedPath: string | null;
    expandedPaths: string[];
    scrollTop: number;
  };
  validation: {
    byPath: Record<string, FieldValidationState>;
    summary: ValidationSummary;
    computedAt: number;
  };
  modal: {
    isOpen: boolean;
    activeView: 'optionA' | 'optionC';
    workingDraft: unknown | null;
    jsonDraft: string;
    jsonError: string | null;
    openedAt: number | null;
    openContext: ModalOpenContext | null;
    dirty: boolean;
  };
};

type FieldValidationState = {
  level: 'error' | 'warning' | 'info' | 'none';
  code: string;
  message: string;
};

type ValidationSummary = {
  errors: number;
  warnings: number;
  infos: number;
};

type ModalOpenContext = {
  selectedPath: string | null;
  navigatorScrollTop: number;
  focusPaneScrollTop: number;
};
```

### 9.2 Internal Event Model
```ts
type GrpcProtoEditorEvent =
  | { type: 'NAVIGATOR_SELECT_PATH'; path: string }
  | { type: 'FOCUS_EDIT_PATCH'; path: string; patch: unknown }
  | { type: 'FULL_FORM_OPEN' }
  | { type: 'MODAL_VIEW_SWITCH'; view: 'optionA' | 'optionC' }
  | { type: 'FULL_FORM_PATCH'; patch: unknown }
  | { type: 'JSON_MODAL_PATCH'; jsonText: string }
  | { type: 'JSON_MODAL_PARSE_OK'; parsedDraft: unknown }
  | { type: 'JSON_MODAL_PARSE_ERROR'; message: string }
  | { type: 'FULL_FORM_APPLY' }
  | { type: 'FULL_FORM_DISCARD' }
  | { type: 'FULL_FORM_CLOSE' }
  | { type: 'VALIDATION_REFRESH' }
  | { type: 'REQUEST_SEND_ATTEMPT' };
```

### 9.3 Modal Transition Rules
- Open modal: `workingDraft = clone(requestDraft)` and capture open context.
- Open modal also initializes `activeView = optionA`, `jsonDraft = serialize(workingDraft)`, `jsonError = null`.
- Apply: commit `workingDraft` to `requestDraft` atomically.
- Discard: close modal and drop `workingDraft`.
- Close: restore previously captured navigator/focus context.
- Dirty state: structural diff between open snapshot and working draft.
- Option C parse error: update `jsonError`, keep prior valid `workingDraft`, block Apply.

## 10. State Transition Table
| Event | Preconditions | Transition | Postconditions |
|---|---|---|---|
| `NAVIGATOR_SELECT_PATH` | Modal closed | Set `navigator.selectedPath` | Focus editor rebinds to selected path |
| `FOCUS_EDIT_PATCH` | Modal closed | Apply patch to `requestDraft` | Validation refresh triggered |
| `FULL_FORM_OPEN` | Modal closed | `modal.isOpen=true`; clone `requestDraft` to `workingDraft`; capture context | Focus editor read-only |
| `MODAL_VIEW_SWITCH` | Modal open | Set `modal.activeView` | Preserves shared modal working draft |
| `FULL_FORM_PATCH` | Modal open | Apply patch to `workingDraft`; `dirty=true` | Modal validation updates |
| `JSON_MODAL_PATCH` | Modal open + Option C | Update `jsonDraft` | Parse pipeline triggered |
| `JSON_MODAL_PARSE_OK` | Modal open + Option C | Set `workingDraft` from parsed JSON; clear `jsonError`; `dirty=true` | Option A reflects updated structure |
| `JSON_MODAL_PARSE_ERROR` | Modal open + Option C | Set `jsonError`; keep prior `workingDraft` | Apply blocked until resolved |
| `FULL_FORM_APPLY` | Modal open; no blocking errors | Commit working draft to canonical draft; close modal | Navigator + Focus update |
| `FULL_FORM_DISCARD` | Modal open | Drop working draft; close modal | Canonical draft unchanged |
| `FULL_FORM_CLOSE` | Modal open | If dirty and not apply/discard, require confirmation policy | Focus context restored |
| `VALIDATION_REFRESH` | Any | Recompute path validations and summary | Status chips update |
| `REQUEST_SEND_ATTEMPT` | Any | Block on canonical errors | Send allowed on warning/info |

## 11. Validation Contract
### 11.1 Single Validation Engine
- Focus editor and modal must use identical validators.
- Error codes and messages must remain consistent across surfaces.

### 11.2 Blocking Policy
- `error`: blocks Apply and Send
- `warning`: allows Apply and Send
- `info`: never blocks
- `jsonError` in Option C: blocks Apply until valid parse succeeds

### 11.3 Path Mapping and Aggregation
- Each issue maps to a `SchemaPath`.
- Navigator aggregation:
  - Any child error => node error
  - Else any child warning => node warning
  - Else valid/unknown by completeness

## 12. Field-Type Behavioral Requirements
### 12.1 oneof
- Exactly one active branch in canonical draft
- Branch switching semantics shared by both editors
- Inactive branch retention policy must be explicit and consistent

### 12.2 map
- Duplicate key handling consistent across editors
- Deterministic key normalization
- Same add/remove/edit semantics

### 12.3 repeated
- Deterministic add/remove behavior
- Index-stable operations
- Optional reorder must preserve deterministic serialization

### 12.4 nested message
- Focus editor supports deep edits without losing context
- Modal presents nested groups clearly

## 13. Component Boundaries
### 13.1 New/Refactored Components
- `GrpcSchemaNavigator`
- `GrpcFocusDetailEditor`
- `GrpcFullFormModal`
- `GrpcModalJsonEditor`
- `GrpcProtoEditorController`

### 13.2 Existing Components to Adapt
- Existing proto field controls
- Existing oneof/map/repeated rows
- Existing validation display helpers

### 13.3 Responsibilities
`GrpcSchemaNavigator`:
- Render schema tree and aggregate status
- Emit `NAVIGATOR_SELECT_PATH`

`GrpcFocusDetailEditor`:
- Render selected-path controls
- Emit `FOCUS_EDIT_PATCH`
- Show path-local validation details

`GrpcFullFormModal`:
- Render tabbed modal shell for Option A and Option C on shared `workingDraft`
- Emit modal view-switch, patch, apply/discard/close events

`GrpcModalJsonEditor`:
- Render JSON editor with parse diagnostics
- Emit JSON patch + parse success/error events
- Keep modal `jsonDraft` and `workingDraft` synchronized by contract

`GrpcProtoEditorController`:
- Own transitions and orchestration
- Trigger validation refreshes
- Enforce read-only default editor while modal is open

## 14. UX Copy and Labels
Main composer:
- Button: Full Form Editor

Modal:
- Title: Full Form Editor
- Tabs: Form View (Option A) | JSON View (Option C)
- Primary action: Apply to Request
- Secondary action: Discard
- Helper text (A): Bulk edit all fields here. Default editor remains schema-focused.
- Helper text (C): Edit raw JSON here; valid JSON updates proto form instantly.

## 15. Accessibility Contract
- Keyboard navigation in Navigator and Focus editor
- Modal focus trap and Escape behavior
- Visible focus styles for all actionable controls
- ARIA labels for oneof groups, field groups, and status updates
- Screen-reader labels for path and validation states

## 16. Performance Contract
- Avoid full-tree rerender on single-field edits
- Prefer path-scoped selectors and memoization
- Modal open should avoid long blocking validation passes
- Define and meet large-schema benchmark threshold before broad rollout

## 17. Rollout Plan
### Phase 0: Design and Spec Finalization
- Approve IA, state model, validation contract, labels, and interaction rules

### Phase 0.1: Detailed Exit Criteria (Implementation Baseline)
Phase 0 is complete only when all of the following are true:
1. Canonical state model is defined in code (not doc-only) with event names matching this plan.
2. Apply/discard semantics are codified via a reducer-level transition function.
3. Blocking validation behavior is codified (`error` blocks Apply/Send).
4. Node-level validation aggregation utility exists and is tested.
5. Feature flag exists for staged rollout without changing current production behavior.
6. Unary-only scope guard for hybrid editor entry is codified for v1.
7. Unit tests cover transition and validation baseline contracts.

### Phase 0.2: Implemented Artifacts (Completed)
Status: Completed on 2026-07-05.

Implemented foundations:
1. Feature flag baseline in `src/config/features.ts` (`GRPC_PROTO_HYBRID_EDITOR_ENABLED`).
2. Hybrid tab state types + reducer in `src/features/grpc/utils/grpcProtoHybridState.ts`.
3. Validation summary and node aggregation utilities in `src/features/grpc/utils/grpcProtoHybridValidation.ts`.
4. Reducer transition tests in `src/features/grpc/utils/grpcProtoHybridState.test.ts`.
5. Validation utility tests in `src/features/grpc/utils/grpcProtoHybridValidation.test.ts`.

### Phase 0.4: Option C Contract Alignment (Completed)
Status: Completed on 2026-07-06.

Implementation notes:
1. Extended modal state with `activeView`, `jsonDraft`, and `jsonError` to formalize Option C JSON-tab behavior.
2. Added reducer events: `MODAL_VIEW_SWITCH`, `JSON_MODAL_PATCH`, `JSON_MODAL_PARSE_OK`, `JSON_MODAL_PARSE_ERROR`.
3. Enforced apply blocking when Option C parse errors exist, while preserving prior valid `workingDraft`.
4. Added apply-blocking utility for combined validation summary + JSON parse state.
5. Added reducer tests for Option C tab switch, parse success synchronization, parse failure resilience, and apply blocking.

### Phase 0.3: Explicitly Deferred to Phase 1+
The following are intentionally not enabled in Phase 0:
1. No visual shell replacement in `GrpcCallPanel`.
2. No default navigator/focus-pane rendering yet.
3. No broad Option B shell swap in production yet.
4. No default send-time validation telemetry set yet.

This keeps Phase 0 low-risk while validating contracts in executable code before UI swaps.

### Phase 0.5: Hybrid Modal Wiring and UX Telemetry (Completed)
Status: Completed on 2026-07-06.

Implemented in this pass:
1. Hybrid Full Form Editor modal wiring in `GrpcCallPanel` behind `GRPC_PROTO_HYBRID_EDITOR_ENABLED`.
2. Option C JSON-tab edits flow into the canonical request draft on Apply.
3. Dirty-close confirmation flow added (in-modal, non-alert) before closing with unsaved changes.
4. Selected-path open context is captured and restored to hybrid navigator state after close/apply/discard.
5. Telemetry hooks wired for modal lifecycle events: open, apply, discard, close prompted, close cancelled.

Verification evidence:
1. `src/features/grpc/components/GrpcProtoHybridEditorModal.test.tsx` updated for close-confirm UI coverage.
2. `src/features/grpc/components/GrpcCallPanel.hybrid.test.tsx` updated for dirty-close + telemetry lifecycle assertions.
3. Typecheck baseline required by implementation gate: `npx tsc -b --noEmit`.

### Phase 1: Option B Core (Completed)
Status: Completed on 2026-07-06.

Implemented in this pass:
1. Option B split composer shell (Navigator + Focus editor) now renders by default for unary methods under `GRPC_PROTO_HYBRID_EDITOR_ENABLED` in `GrpcCallPanel`.
2. Added focused Option B components:
  - `src/features/grpc/components/GrpcProtoHybridNavigator.tsx`
  - `src/features/grpc/components/GrpcProtoHybridFocusEditor.tsx`
3. Navigator path model implemented for regular fields (`field:<name>`) and oneof groups (`oneof:<group>`).
4. Deterministic selected-path initialization and schema-change fallback added using navigator path derivation.
5. Focus editor patches canonical draft via reducer `FOCUS_EDIT_PATCH` and retains existing request-sync contract.
6. Option B controls are read-only while Full Form modal is open.
7. Added selected-path telemetry event emission (`grpc_editor_selected_path_changed`) in hybrid telemetry flow.
8. Added Option B shell styles in `src/styles/grpc-studio.css` with responsive collapse for narrower widths.
9. Runtime stabilization: while Full Form modal is open, Focus editor interaction surface is now paused (read-only shell) to prevent dev-time update-loop churn and eliminate duplicate editor interaction paths.

Verification evidence:
1. `src/features/grpc/components/GrpcCallPanel.hybrid.test.tsx`
  - Navigator selection + focused patch propagation
  - Selected-path telemetry assertion
  - Modal-open read-only lock assertion
2. Existing modal lifecycle tests preserved in hybrid integration suite.
3. Typecheck + targeted test run performed after implementation.
4. Runtime validation (feature-flag enabled dev server) confirms:
  - Option B navigator/focus default shell renders for unary methods.
  - Full Form Editor opens successfully.
  - Navigator becomes disabled and focus area shows read-only shell while modal is open.
  - No recurring `Maximum update depth exceeded` console loop after stabilization fix.

#### Phase 1 Detailed Contract (Refined)
Phase 1 is complete only when all of the following are true:
1. Form composer default under `GRPC_PROTO_HYBRID_EDITOR_ENABLED` is a two-pane Option B layout:
  - left Navigator pane
  - right Focus editor pane
2. Navigator supports path-level selection for:
  - regular top-level fields
  - oneof groups (group-level entry selecting active member editor)
3. Focus editor patches only the selected node scope while preserving canonical request draft behavior.
4. Selected path is initialized deterministically (first available navigator entry) and remains valid when method/schema changes.
5. While Full Form modal is open, Option B controls are read-only.
6. Modal open context captures current selected navigator path.
7. Selected-path change telemetry is emitted (`grpc_editor_selected_path_changed`) with base hybrid payload context.
8. Validation parity behavior is preserved for tab switching and send gating (no regression versus existing form flow).

Implementation targets for this phase:
1. `GrpcCallPanel` composer integration and state wiring for navigator/focus flow.
2. New focused UI components for navigator and selected-node editor rendering.
3. CSS styling for Option B split layout following existing design tokens.
4. Component/integration tests covering:
  - navigator rendering + path switching
  - focus edit patch propagation
  - modal-open read-only behavior in Option B shell
  - selected-path telemetry emission

### Phase 2: Option A Modal Integration (Completed)
Status: Completed on 2026-07-06.

#### Phase 2 Detailed Contract (Refined)
Phase 2 is complete only when all of the following are true:
1. Full Form Editor (Option A) operates on modal working copy only; canonical request updates only on Apply.
2. Discard/Close leaves canonical request unchanged.
3. Apply action is transactional and disabled when no modal changes are present (`dirty=false`).
4. Open-context capture includes:
  - selected navigator path
  - navigator scroll position
  - focus-pane scroll position
5. Close/apply/discard restores captured Option B context after modal exit.
6. Option B editor interactions remain paused/read-only while modal is open.

Implemented in this pass:
1. Added Option A apply gating so `Apply to Request` requires dirty modal state (in addition to validation/no JSON blockers).
2. Implemented open-context scroll capture in `GrpcCallPanel` when opening modal.
3. Implemented post-close scroll restore for navigator/focus panes after apply/discard/close transitions.
4. Preserved existing selected-path restore behavior and read-only lock semantics.

Verification evidence:
1. `src/features/grpc/components/GrpcProtoHybridEditorModal.test.tsx`
  - apply disabled when `dirty=false`
  - apply enabled when `dirty=true` and no blockers
2. `src/features/grpc/components/GrpcCallPanel.hybrid.test.tsx`
  - scroll context capture/restore across modal open/discard
  - existing lock/telemetry regressions remain covered
3. Focused + broader hybrid/call-panel regression runs and `npx tsc -b --noEmit`.

### Phase 2.5: Option C JSON Modal Tab Integration (Completed)
Status: Completed on 2026-07-06.

#### Phase 2.5 Detailed Contract (Refined)
Phase 2.5 is complete only when all of the following are true:
1. Option C JSON view is available inside the Full Form modal and uses the same modal working draft as Option A.
2. Option C valid JSON edits update Option A working draft immediately (A/C bidirectional sync).
3. Option A control edits update Option C JSON representation on shared working draft updates.
4. JSON parse errors are shown inline and block Apply without mutating canonical request.
5. Valid JSON parse keeps the user-authored JSON text in the editor (no auto-reformat churn while typing).

Implemented in this pass:
1. Option C in-modal tab behavior and parse-error blocking path are active and tested.
2. Shared working-draft synchronization between Option A and Option C is active.
3. Reduced JSON editor churn by preserving user-entered JSON text after successful parse while still syncing `workingDraft`.

Verification evidence:
1. `src/features/grpc/utils/grpcProtoHybridState.test.ts`
  - Option C parse success syncs to working draft.
  - parse-error path blocks apply and preserves working draft.
  - user JSON text formatting is preserved after valid parse.
2. `src/features/grpc/components/GrpcProtoHybridEditorModal.test.tsx`
  - JSON parse error is surfaced inline and Apply is disabled while blocked.
3. Focused regression and type-check runs remain green.

### Phase 3: Hardening (Completed)
Status: Completed on 2026-07-06.

#### Phase 3 Detailed Contract (Refined)
Phase 3 is complete only when all of the following are true:
1. Required telemetry contract events are implemented and emitted from hybrid editor flows.
2. Option B navigator has keyboard-accessible traversal semantics.
3. Option B navigator supports low-friction field filtering for large schemas.
4. Focus-visible affordances exist for key hybrid controls.
5. Hybrid regression coverage validates these hardening paths.

Implemented in this pass:
1. Completed telemetry contract with:
  - `grpc_editor_send_blocked_error`
  - `grpc_editor_validation_warning_count`
2. Added deduped emission guards for send-block and warning-count events.
3. Added Option B navigator search/filter input and empty-state behavior.
4. Added Option B navigator keyboard traversal (`ArrowUp`, `ArrowDown`, `Home`, `End`) and active-descendant semantics.
5. Added focus-visible styling for hybrid tabs and navigator controls.

Verification evidence:
1. `src/features/grpc/components/GrpcCallPanel.hybrid.test.tsx`
  - emits warning-count telemetry baseline
  - emits send-blocked telemetry when send prerequisites fail
  - validates navigator keyboard traversal and field filtering behavior
2. Focused hybrid reducer/modal/call-panel regression and `npx tsc -b --noEmit` passed.

### Phase 4: Gradual Rollout
- Feature flag staged rollout (`grpcProtoHybridEditorEnabled`)
- Collect usage/usability metrics
- Iterate on friction points

Phase 4 parity work completed in this pass:
1. Option A: added in-modal complexity insight chips (oneof/map/repeated counts) for faster orientation.
2. Option B: navigator item detail now surfaces map/repeated semantics in addition to field type.
3. Option C: JSON view now includes a visual assist sidecar summarizing oneof active branch, map entry counts, and repeated item counts.
4. Added complex Form Input demo payload artifacts:
  - `examples/grpc/complex-form-input/complex-echo.proto`
  - `examples/grpc/complex-form-input/complex-echo.request.json`
  - `examples/grpc/complex-form-input/README.md`

Phase 4 parity refinement update (2026-07-06):
1. Option A modal Form View now supports a guided-cards presentation mode aligned with mockup intent:
  - left rail step cards with completion/review chips
  - right-side grouped cards for Core, Map, Collections, and oneof sections
  - oneof cards surface active branch state in the section header
2. Guided-cards rendering is scoped to Option A modal only (`presentation="guided-cards"`) so baseline plain form behavior in non-modal surfaces is unchanged.

## 18. Telemetry Contract
Minimum events:
- `grpc_editor_modal_opened`
- `grpc_editor_modal_applied`
- `grpc_editor_modal_discarded`
- `grpc_editor_send_blocked_error`
- `grpc_editor_validation_warning_count`
- `grpc_editor_selected_path_changed`

Each event includes:
- tab id hash
- method identifier
- schema complexity bucket (small/medium/large)

## 19. QA and Verification Matrix
### 19.1 Functional
- Payload equality between editors for equivalent user edits
- Apply/discard correctness
- oneof/map/repeated parity
- Validation parity and send blocking rules
- Option C JSON edits propagate to Option A controls
- Option A control edits propagate to Option C JSON
- Invalid JSON does not mutate canonical/modal working draft and blocks Apply

### 19.2 Unit
- Transition/reducer tests for all event types
- Apply/discard atomicity tests
- Path-based validation mapping tests

### 19.3 Component
- Navigator selection updates Focus editor
- Focus patch updates canonical draft
- Modal open clones canonical draft
- Modal apply/discard semantics

### 19.4 Integration
- Focus edit -> modal open -> modal patch -> apply -> send
- Focus edit -> modal open -> modal patch -> discard -> send
- oneof/map/repeated parity across both surfaces
- Focus edit -> modal open -> switch C -> json edit valid -> switch A -> apply -> send
- Focus edit -> modal open -> switch C -> json parse error -> apply blocked -> fix -> apply

### 19.5 Regression
- Request serialization stability
- Send pipeline unchanged
- Transport/auth/timing and adjacent workspace behaviors unaffected

## 20. Risks and Mitigations
- Risk: state drift between editors
  - Mitigation: canonical state + transactional apply semantics
- Risk: UX inconsistency across surfaces
  - Mitigation: shared field behavior and validation contracts
- Risk: modal overuse reduces Option B benefits
  - Mitigation: optimize default flow and keep it first-class
- Risk: performance regressions on large schemas
  - Mitigation: lazy rendering and scoped updates

## 21. Open Decisions
- Preserve inactive oneof draft values or clear on switch?
- Should warning-level issues be allowed on Apply by default? (current: yes)
- Should Option C provide strict JSON-schema style suggestions in v1 or only parse+validation errors?
- Should Navigator include v1 search/filter?

## 22. Acceptance Criteria
- Option B is default and production-usable
- Full Form Editor modal is stable and consistent
- Option C JSON view is available in modal and synchronized with Option A
- Apply/discard semantics match this contract
- Payload parity across editors is verified
- Validation parity across editors is verified
- JSON parse-error blocking behavior is verified
- Context restore after modal close is verified
- No regressions in send/response core workflows

## 23. Definition of Done
- Transition test suite passes
- Validation parity validated
- No payload drift between editors
- Accessibility baseline checks pass
- Performance baseline checks pass
- Telemetry events verified
- Feature flag rollout checklist completed
