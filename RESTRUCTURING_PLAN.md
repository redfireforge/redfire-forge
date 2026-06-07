# Source Code Restructuring Plan

> **Status**: This plan is on hold. **Phase 10 (WorkflowDesigner refactoring)** was completed ahead of schedule as part of Phase 7A development — WorkflowDesigner.tsx reduced from 1432 to 895 lines via 8 extracted hooks + 2 utility modules. ScenarioBuilder.tsx reduced from 984 to 702 lines via useScenarioMutations. **Kafka Service modularization** completed (2026-06-07) — KafkaService reduced from 660+ to 464 lines via extracted `kafka-produce.ts`, `kafka-subscribe.ts`, and `kafka-service-utils.ts`. Gallery workflow factories consolidated via shared `nodeFactories.ts` (~1,500 lines of duplication removed). The full directory restructure (Phases 1–9) remains pending and will be scheduled after core feature delivery is complete.
>
> _Last updated: 2026-06-07_

## Goal
Reorganize the codebase from flat dumping-ground directories into **functional domain modules** with co-located tests, following professional project structure conventions.

## Approach
- **Incremental**: one feature module at a time, TypeScript check + touched-file tests after each phase
- **WorkflowDesigner.tsx refactoring**: separate phase AFTER structural moves are complete
- **Full test suite**: run complete unit tests + E2E tests after ALL restructuring is done

---

## Current Problems

| Problem | Details |
|---------|---------|
| Flat `src/components/` | 32 unrelated files (modals, editors, configs) dumped together |
| Flat `src/utils/` | 46 files — workflow, CSV, request, catalog utils all mixed |
| Flat `src/hooks/` | 20 files — feature-specific hooks in a generic folder |
| Inconsistent test co-location | Some tests beside source, some not |
| No feature boundaries | Can't tell which files belong to which feature |
| `src/components/workflow/` bloat | 62 production files flat — configs, nodes, panels, modals all mixed |
| Monolithic pages | ~~WorkflowDesigner (2059 LOC)~~, ~~ScenarioBuilder (1045)~~, App (884) |

> **Note**: WorkflowDesigner.tsx already refactored to 895 LOC (Phase 10 completed ahead of schedule, with Round 4 extracting `workflowDesignerUtils.ts` and `workflowEdgeGeometry.ts`). ScenarioBuilder.tsx refactored to 702 LOC (useScenarioMutations extracted). App.tsx now at 884 LOC with useTheme + useWorkflowImportExport extracted.

---

## Target Structure

```
src/
├── app/                              # App shell & routing
│   ├── App.tsx
│   ├── Sidebar.tsx
│   └── main.tsx
│
├── features/
│   ├── workflow/                     # Workflow designer feature
│   │   ├── components/
│   │   │   ├── canvas/               # Canvas controls, palette, toolbar, status bar
│   │   │   ├── configs/              # Node config panels (Http, Delay, Condition, etc.)
│   │   │   ├── nodes/                # ReactFlow node components
│   │   │   ├── panels/               # Console, Variables, Inspector, Sidebar
│   │   │   ├── modals/               # Config modal, defaults, detail, template gallery
│   │   │   └── expression/           # ExpressionInput, HintDropdown, Builder, Textarea
│   │   ├── hooks/
│   │   ├── utils/
│   │   ├── engine/                   # graphRunner, debugController, variableContext, etc.
│   │   ├── types/
│   │   └── WorkflowDesigner.tsx
│   │
│   ├── requests/                     # API request builder feature
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── utils/
│   │   └── Requests.tsx
│   │
│   ├── test-runner/                  # Performance test execution feature
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── utils/
│   │   └── TestRunner.tsx
│   │
│   ├── scenarios/                    # Test scenario builder feature
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── utils/
│   │   └── ScenarioBuilder.tsx
│   │
│   ├── catalog/                      # API catalog feature
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── utils/
│   │   ├── types/
│   │   └── ApiCatalog.tsx
│   │
│   ├── environments/
│   │   └── EnvironmentManager.tsx
│   │
│   ├── results/
│   │   ├── components/
│   │   └── ResultsDashboard.tsx
│   │
│   ├── webhooks/
│   │   └── WebhookDeliveryLogs.tsx
│   │
│   └── settings/
│       ├── SettingsModal.tsx
│       └── SettingsStorageTab.tsx
│
├── shared/                           # Truly shared/reusable code
│   ├── components/                   # AppModalFrame, ModalResizeHandles, jsonTreeShared
│   ├── hooks/                        # useDebounce, useModalDrag, useModalResize, useToast, etc.
│   ├── utils/                        # helpers, platform, fileSaver, storage, tauriStore, etc.
│   └── types/                        # index.ts (shared types), server-api.ts
│
├── engine/                           # Core execution engine (non-workflow)
│   ├── executor.ts
│   ├── loadProfileRunner.ts
│   ├── metrics.ts
│   ├── circuitBreaker.ts
│   ├── thinkTime.ts
│   ├── tokenManager.ts
│   ├── workerBridge.ts
│   ├── workerProtocol.ts
│   ├── requestExecution.ts
│   ├── validator.ts
│   └── executionWorker.ts
│
├── data/                             # Static data (unchanged)
│   └── sampleWorkflows.ts
│
└── styles/                           # Global styles (unchanged)
```

**Rule**: Tests are ALWAYS co-located — `Foo.tsx` → `Foo.test.tsx` in the same directory.

---

## Phases

### Phase 1: `shared/` — Extract truly shared code
- [ ] Create `src/shared/components/`, `src/shared/hooks/`, `src/shared/utils/`, `src/shared/types/`
- [ ] Move shared components: `AppModalFrame`, `ModalExpandButton`, `ModalResizeHandles`, `jsonTreeShared`
- [ ] Move shared hooks: `useDebounce`, `useModalDrag`, `useModalResize`, `useModalExpand`, `useModalFrame`, `useToast`, `useListCrud`, `useResizablePanels`
- [ ] Move shared utils: `helpers`, `platform`, `fileSaver`, `storage`, `tauriStore`, `escapeRegExp`, `bodySerializer`, `curlGenerator`, `curlParser`, `httpClient`, `jsonHighlighter`, `executionMode`
- [ ] Move shared types: `index.ts`, `server-api.ts`
- [ ] Update all import paths
- [ ] `npx tsc --noEmit` ✓

### Phase 2: `features/catalog/` — API Catalog module
- [ ] Create `src/features/catalog/`
- [ ] Move `src/components/catalog/*` → `src/features/catalog/components/`
- [ ] Move `src/hooks/useCatalog.ts` → `src/features/catalog/hooks/`
- [ ] Move catalog utils: `catalogExport`, `catalogCurlGenerator`, `catalogSpecDiff`, `catalogStorage`, `openApiParser`, `schemaStubGenerator` → `src/features/catalog/utils/`
- [ ] Move `src/types/catalog.ts` → `src/features/catalog/types/`
- [ ] Move `src/pages/ApiCatalog.tsx` → `src/features/catalog/`
- [ ] Update all import paths
- [ ] `npx tsc --noEmit` ✓

### Phase 3: `features/requests/` — Request Builder module
- [ ] Create `src/features/requests/`
- [ ] Move `src/components/requests/*` → `src/features/requests/components/`
- [ ] Move request-specific components from `src/components/`: `AuthConfigPanel`, `BodyEditor`, `ExtractionEditor`, `ExtractionMapperModal`, `ExtractionPathPickerModal`, `ParamsEditor`, `JsonPathBuilder`, `ProfilePreview`, `RegexAssertionModal`, `regexAssertionUtils`, `ResponseDetailModal`, `ResponseVersionPanel`
- [ ] Move `src/hooks/useRequests.ts`, `useResponseCache.ts`, `useAuthVerify.ts` → `src/features/requests/hooks/`
- [ ] Move request utils: `requestTree`, `requestUrlResolver`, `requestAuthState`, `authResolver`, `jsonPathTreeUtils` → `src/features/requests/utils/`
- [ ] Move `src/pages/Requests.tsx` → `src/features/requests/`
- [ ] Update all import paths
- [ ] `npx tsc --noEmit` ✓

### Phase 4: `features/scenarios/` — Scenario Builder module
- [ ] Create `src/features/scenarios/`
- [ ] Move scenario components from `src/components/`: `TestEditorModal`, `TestEditorAuthTab`, `TestEditorValidationTab`, `CsvImportModal`, `CsvTemplateExportModal`, `CopyTestModal`, `MoveDialog`
- [ ] Move scenario utils: `csvTemplate`, `csvTemplateCsv`, `csvTemplateExcel`, `csvTemplateTypes`, `csvTemplateUrl`, `scenarioImportExport`, `scenarioSearch`, `testEditorUtils` → `src/features/scenarios/utils/`
- [ ] Move `src/hooks/useProjects.ts` → `src/features/scenarios/hooks/`
- [ ] Move `src/pages/ScenarioBuilder.tsx` → `src/features/scenarios/`
- [ ] Update all import paths
- [ ] `npx tsc --noEmit` ✓

### Phase 5: `features/test-runner/` — Test Runner module
- [ ] Create `src/features/test-runner/`
- [ ] Move test runner components from `src/components/`: `RunnerExecutionConfig`, `LiveCharts`, `WaterfallBar`
- [ ] Move `src/hooks/useTestExecution.ts` → `src/features/test-runner/hooks/`
- [ ] Move runner utils: `resultsGrouping`, `runnerProgressStorage`, `serverFormatters` → `src/features/test-runner/utils/`
- [ ] Move `src/pages/TestRunner.tsx` → `src/features/test-runner/`
- [ ] Update all import paths
- [ ] `npx tsc --noEmit` ✓

### Phase 6: `features/workflow/` — Workflow module (largest)
- [ ] Create subdirectories: `components/{canvas,configs,nodes,panels,modals,expression}`, `hooks/`, `utils/`, `engine/`, `types/`
- [ ] Move node configs → `components/configs/`: HttpConfig, DelayConfig, ConditionConfig, LoopConfig, etc.
- [ ] Move nodes → `components/nodes/`: (already grouped, just move path)
- [ ] Move canvas components → `components/canvas/`: WorkflowCanvasControls, WorkflowPalette, WorkflowToolbar, WorkflowStatusBar, WorkflowCommandPalette, WorkflowShortcutsOverlay
- [ ] Move panel components → `components/panels/`: WorkflowConsolePanel, VariablesSection, VariablePanel, WorkflowInspectContext, WorkflowSidebar, WorkflowServicesPanelInline, etc.
- [ ] Move modal components → `components/modals/`: WorkflowNodeConfigModal, WorkflowDefaultsModal, WorkflowDetailModal, TemplateGalleryModal, WorkflowServiceRegistryModal, WorkflowRequestsSettingsModal, WorkflowVariableInsertModal, etc.
- [ ] Move expression components → `components/expression/`: ExpressionInput, ExpressionHintDropdown, ExpressionBuilderView, ExpressionTextarea, expressionBuilderState, InsertVarField, SearchableVariableSelect, AvailableVariables
- [ ] Move remaining workflow components: WorkflowBreadcrumb, WorkflowDebugBar, WorkflowExecSummary, ComposeStrip, etc.
- [ ] Move workflow hooks: `useWorkflows`, `useNodeClipboard`, `useUndoRedo`, `useVariableInsertModal`, `useExpressionHints`, `useWorkflowRunCache` → `features/workflow/hooks/`
- [x] Move workflow utils: `workflowAutoLayout`, `workflowMigrations`, `workflowNodeMerge`, `workflowBundleExport`, `workflowEnvReadiness`, `workflowExtractSubWorkflow`, `workflowHostResolve`, `workflowRequestHost`, `workflowMappingUtils`, `expressionEvaluator`, `expressionFunctions` → `features/workflow/utils/` _(Note: `expressionFunctions` refactored from single 957-line file into 9-module directory)_
- [ ] Move `src/engine/workflow/*` → `features/workflow/engine/`
- [ ] Move `src/types/workflow.ts` → `features/workflow/types/`
- [ ] Move `src/pages/WorkflowDesigner.tsx` → `features/workflow/`
- [ ] Update all import paths
- [ ] `npx tsc --noEmit` ✓

### Phase 7: Remaining pages & app shell
- [ ] Move `src/pages/ResultsDashboard.tsx` → `src/features/results/`
- [ ] Move `src/pages/EnvironmentManager.tsx` → `src/features/environments/`
- [ ] Move `src/pages/WebhookDeliveryLogs.tsx` → `src/features/webhooks/`
- [ ] Move `src/pages/WorkflowExecutionHistory.tsx` → `src/features/workflow/`
- [ ] Move `src/components/SettingsModal.tsx`, `SettingsStorageTab.tsx` → `src/features/settings/`
- [ ] Move `src/components/ExportCenter.tsx`, `ImportCenter.tsx` → `src/shared/components/`
- [ ] Create `src/app/` — move `App.tsx`, `Sidebar.tsx`, `main.tsx`
- [ ] Update all import paths
- [ ] `npx tsc --noEmit` ✓

### Phase 8: Engine (non-workflow) cleanup
- [ ] Keep `src/engine/` for core execution engine files (already well-organized)
- [ ] Verify no stale imports remain
- [ ] `npx tsc --noEmit` ✓

### Phase 9: Cleanup old directories
- [ ] Remove empty directories (`src/pages/`, `src/components/`, old `src/hooks/`, old `src/utils/`, old `src/types/`)
- [ ] Verify no orphaned files
- [ ] `npx tsc --noEmit` ✓

---

## Phase 10: WorkflowDesigner.tsx Refactoring ✅ COMPLETE (done ahead of schedule)

Break the ~~2059~~-line god component into custom hooks:

- [x] Extract `useWorkflowExecution` — executeWorkflowRun, handleQuickTest, debug handlers, run progress, step summaries
- [x] Extract `useWorkflowConsole` — console state, toggle/close, SSE subscription
- [x] Extract `useWorkflowCanvas` — drag/drop handlers, node click, context menu, pane click
- [x] Extract `useWorkflowPersistence` — serializeNodes/Edges, persistWorkflow, handleSave, clipboard, undo/redo, handleUpdateWorkflowVariables
- [x] Extract `useWorkflowNodeOps` — insert, copy, paste, duplicate, update, delete, extract-to-sub
- [x] Extract `useWorkflowNavigation` — navStack, handleNew, handleSelect, breadcrumb navigate
- [x] Extract `useWorkflowKeyboardShortcuts` — keyboard event handler
- [x] Extract `useWorkflowExtractionSample` — design-time fetch sample flow for Extract tab
- [x] Write/update tests for each extracted hook — 53 new hook tests
- [x] `npx tsc --noEmit` ✓

**Result**: WorkflowDesigner.tsx reduced from 1432 to **893 lines** (6 hooks extracted). Tests: 4613 passing, 0 tsc errors.

---

## Phase 11: Final Validation (MUST PASS before merge)

- [ ] `npx tsc --noEmit` — zero TypeScript errors
- [ ] `npx vitest run` — full unit test suite, all passing, >90% coverage
- [ ] `npx playwright test --reporter=list` — all 203+ E2E tests passing
- [ ] Manual smoke test: open app, navigate all pages, run a workflow
- [ ] No broken imports, no orphaned files
- [ ] User approval before merging to develop

---

## Rules During Restructuring

1. **Move files, don't rewrite them** — only change import paths, not logic
2. **Test after each phase** — `npx tsc --noEmit` minimum; run touched-file tests if uncertain
3. **Co-locate tests** — every `Foo.tsx` must have `Foo.test.tsx` beside it after move
4. **Never commit to develop/master** — all work on `feature/sub-workflow` branch
5. **If a move breaks something, fix it before proceeding to the next phase**

---

## File Movement Reference

### What goes to `shared/` (used by 2+ features)
- Components: AppModalFrame, ModalExpandButton, ModalResizeHandles, jsonTreeShared, ExportCenter, ImportCenter
- Hooks: useDebounce, useModalDrag, useModalResize, useModalExpand, useModalFrame, useToast, useListCrud, useResizablePanels
- Utils: helpers, platform, fileSaver, storage, tauriStore, bodySerializer, curlGenerator, curlParser, httpClient, jsonHighlighter, executionMode, escapeRegExp
- Types: index.ts (shared types), server-api.ts

### What stays feature-specific
- Each feature gets its own components, hooks, utils, types that are only used within that feature
- If something is used by exactly one feature, it belongs in that feature's folder
