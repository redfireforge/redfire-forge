# Workflow Feature Branch - Refactoring & Test Coverage Plan

## Current Status
- Overall Coverage: 93.04% statements, 83.95% branch, 92.54% functions, 94.39% lines
- Tests: 68 test files, 1480 tests passing ✅
- Branch: `feature/workflow-trigger-nodes`

## Critical Issues

### 1. Coverage Below 90%
- **workflowAutoLayout.ts**: 79.74% stmt, 67.2% branch, 84.44% func, 84.14% lines
- **graphRunner.ts**: 87.25% stmt, 77.95% branch, 92% func, 88.31% lines
- **debugController.ts**: 95.65% stmt, 71.42% branch
- **index.ts** (workflow): 0% coverage (exports only)

### 2. Monolithic Component
- **WorkflowDesigner.tsx**: 1293 lines with 10+ responsibilities

## Refactoring Tasks

### Phase 1: Extract Custom Hooks from WorkflowDesigner

#### 1.1 `useWorkflowState.ts` (State Management)
Extract:
- Node/edge state management
- Node status tracking
- Variable management (workflow vars, initial vars)
- Service registry state
- Host/auth profiles
- Save acknowledgment state

#### 1.2 `useWorkflowExecution.ts` (Graph Execution)
Extract:
- Quick test execution
- Debug test execution
- Graph runner integration
- Abort controller management
- Run status tracking
- Error handling

#### 1.3 `useWorkflowNodeOperations.ts` (Node CRUD)
Extract:
- Add node to canvas
- Delete node
- Update node data
- Node configuration modal logic
- Node serialization/deserialization

#### 1.4 `useWorkflowVariableHints.ts` (Variable Context)
Extract:
- Condition variable hints computation
- HTTP variable hints computation
- Variable context enrichment

#### 1.5 `useWorkflowExtraction.ts` (Sample Fetching)
Extract:
- Extraction sample fetching
- JSON path picker logic
- Extraction state management

#### 1.6 `useWorkflowInspection.ts` (Detail Modals)
Extract:
- Step detail modal logic
- Variable detail modal logic
- Run error detail modal logic
- Detail modal meta computation

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
- [ ] Overall branch coverage >90%
- [ ] workflowAutoLayout.ts coverage >90% all metrics
- [ ] graphRunner.ts coverage >90% all metrics
- [ ] WorkflowDesigner.tsx <500 lines
- [ ] All 1480+ unit tests passing
- [ ] All E2E tests passing
- [ ] No broken functionality
- [ ] Code reviewed and approved

## Timeline
- Total Estimated Time: 10-15 hours
- Target Completion: 2-3 working days
