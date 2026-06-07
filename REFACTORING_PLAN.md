# Workflow Feature Branch - Refactoring & Test Coverage Plan

## Current Status
- Overall Coverage: 99.51% lines ✅ (target: >90%)
- Tests: 830 coverage files, 23,000+ tests passing ✅
- E2E Tests: 719 tests passing (0 skipped) ✅
- Branch: `feature/refactor-modularize` → merged to `develop`
- Version: 0.6.0
- Last updated: 2026-06-07

## Completed ✅

### 0. Kafka Service & Gallery Modularization ✅ (2026-06-07)
- **KafkaService class**: Reduced from 660+ → 464 lines by extracting `kafka-produce.ts`, `kafka-subscribe.ts`, and `kafka-service-utils.ts`
- **Gallery node factories**: Extracted shared `nodeFactories.ts` (386 lines), eliminating ~1,500 lines of duplicated boilerplate across 6 gallery files
- **Test helpers**: Extracted `expectSuccess()` / `expectError()` helpers in `kafka-service.test-utils.ts`
- **New tests**: `cron-scheduler.test.ts` (15), `kafka-produce.test.ts` (16), `kafka-subscribe.test.ts` (16), `nodeFactories.test.ts`, `kafka-service-utils.test.ts`
- **Coverage**: All files above 90%, overall 99.51%
- **No monolithic classes**: Largest class is 464 lines (KafkaService)

### 1. Coverage Above 90% ✅
All coverage targets met after adding 192 new unit tests across 7 files.

### 2. Monolithic Components Refactored ✅
- **WorkflowDesigner.tsx**: 1432 → 23 lines (fully decomposed into 10+ modules: `useWorkflowDesignerController`, `useWorkflowNodeActions`, `useWorkflowCanvasSync`, `useWorkflowEdgeOps`, `useWorkflowDetailModal`, `useWorkflowPersistence`, `useWorkflowExtractionSample`, `WorkflowDesignerMainLayout`, etc.)
- **App.tsx**: 913 → 884 lines (useTheme + useWorkflowImportExport hooks extracted)
- **ScenarioBuilder.tsx**: 984 → 702 lines (useScenarioMutations hook extracted)
- **expressionFunctions.ts**: 957 → 9 modules

## Refactoring Tasks

### Phase 1: Extract Custom Hooks from WorkflowDesigner ✅ Complete

#### 1.1 `useWorkflowNodeActions.ts` ✅
Extracted: Node add/delete/update, position tracking, nextNodeY computation

#### 1.2 `useWorkflowCanvasSync.ts` ✅
Extracted: Canvas state synchronization, node/edge state management, React Flow integration

#### 1.3 `useWorkflowEdgeOps.ts` ✅
Extracted: Edge connection/deletion operations, edge validation logic

#### 1.4 `useWorkflowDetailModal.ts` ✅
Extracted: Step detail modal, variable detail modal, run error detail modal, meta computation

#### 1.5 `useWorkflowPersistence.ts` ✅
Extracted: serializeRFNodes/serializeRFEdges (pure), persistWorkflow (webhook PUT), insertNodeAndPersist, clipboard (paste/duplicate/copy), undo/redo handlers, handleSave + saveAcknowledged lifecycle, handleUpdateWorkflowVariables

#### 1.6 `useWorkflowExtractionSample.ts` ✅
Extracted: Design-time "Fetch sample response" flow for Extract tab; host/auth resolution, entry-point variable seeding (start/schedule), JSON pretty-print of error bodies, reset-on-selection-change

#### Also extracted from App.tsx:

#### 1.7 `useTheme.ts` ✅
Extracted: Theme management, theme picker state, DOM updates, persistence

#### 1.8 `useSidebarResize.ts` ✅ (previously extracted)
Extracted: Sidebar width management, resize interactions, collapse/expand

### Phase 2: Extract Utility Modules

#### 2.1 `workflowNodeDefaults.ts`
Extract:
- `makeEmptyScenario()`
- `defaultNodeData()`
- `enrichNodeData()`
- Node type definitions

#### 2.2 `workflowSerialization.ts`
Extract:
- `serializeNodes()`
- `serializeEdges()`
- Deserialization logic from useEffect

### Phase 3: Improve Test Coverage

#### 3.1 workflowAutoLayout.ts Tests
Add tests for:
- Edge cases in `centerConditionBranches()` (Yes/No branch alignment)
- `centerForkJoinNodes()` with End nodes
- `alignLinearChains()` propagation
- `resolveOverlaps()` collision detection
- Empty graph edge cases
- Single node graphs
- Deeply nested fork structures

#### 3.2 graphRunner.ts Tests
Add tests for:
- End node failure propagation
- Multiple end nodes (all pass, some fail, all fail)
- Join node with skipped incoming edges
- markSubtreeSkipped with End nodes
- Error handling in visit() for all node types
- Debug mode edge cases

#### 3.3 debugController.ts Tests
Add tests for:
- Pause/resume with multiple pending nodes
- Step through condition branches
- Step through fork/join patterns
- Reset during step
- Error handling during step

### Phase 4: Add E2E Tests

#### 4.1 workflow-auto-layout.spec.ts
- Test auto-layout button functionality
- Verify positions persist after save
- Test restore saved layout button
- Test preview mode (no auto-save)
- Test "Use as Template" with auto-layout

#### 4.2 workflow-end-node.spec.ts
- Add End node to workflow
- Run workflow with End node (success path)
- Run workflow with End node (failure path)
- Multiple End nodes scenarios
- End node in fork branches

#### 4.3 workflow-preview-mode.spec.ts
- Load sample workflow
- Verify preview banner shown
- Verify Save button disabled
- Auto-layout in preview (visual only)
- "Use as Template" creates new workflow
- Close preview

### Phase 5: Code Quality Improvements

#### 5.1 Remove Redundant Code
- Check for duplicate type guards
- Consolidate repeated variable resolution logic
- Remove dead code paths
- Simplify complex conditionals

#### 5.2 Type Safety
- Add stricter types where `any` is used
- Add discriminated unions for node types
- Improve callback type definitions

#### 5.3 Performance
- Memoize expensive computations
- Reduce unnecessary re-renders
- Optimize large workflow handling

## Implementation Order

### Round 1: Critical Coverage (2-3 hours)
1. ✅ Run baseline coverage report
2. Add unit tests for workflowAutoLayout.ts (target: >90% branch)
3. Add unit tests for graphRunner.ts (target: >90% branch)
4. Add unit tests for debugController.ts (target: >90% branch)
5. Verify coverage: `npx vitest run --coverage`

### Round 2: Extract Hooks (3-4 hours)
1. Extract `useWorkflowState.ts`
2. Extract `useWorkflowExecution.ts`
3. Extract `useWorkflowNodeOperations.ts`
4. Update WorkflowDesigner to use new hooks
5. Run all tests: `npx vitest run`
6. Run E2E tests: `npx playwright test`

### Round 3: Additional Refactoring (2-3 hours)
1. Extract utility modules
2. Extract remaining hooks
3. Remove redundant code
4. Improve type safety
5. Run full test suite

### Round 4: E2E Tests (2-3 hours)
1. Add workflow-auto-layout.spec.ts
2. Add workflow-end-node.spec.ts  
3. Add workflow-preview-mode.spec.ts
4. Run: `npx playwright test`

### Round 5: Final Validation (1-2 hours)
1. Run full test suite with coverage
2. Verify >90% coverage on all metrics
3. Run E2E tests
4. Verify no broken logic
5. Code review
6. Document changes

## Success Criteria
- [x] Overall branch coverage >90% — ✅ 94.61% branch, 99.51% line coverage
- [x] workflowAutoLayout.ts coverage >90% all metrics — ✅ 100% lines, 90.11% branches
- [x] graphRunner.ts coverage >90% all metrics — ✅ 100% lines, 90.12% branches
- [x] WorkflowDesigner.tsx <500 lines — ✅ 23 lines (fully decomposed wrapper)
- [x] All 23,000+ unit tests passing
- [x] All 719 E2E tests passing
- [x] No broken functionality
- [x] Code reviewed and approved

## Timeline
- Total Estimated Time: 10-15 hours
- Target Completion: 2-3 working days
