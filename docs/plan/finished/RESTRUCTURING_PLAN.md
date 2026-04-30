# Source Code Restructuring Plan

> **Status**: ✅ Complete — All phases (1–11) done. Codebase restructured into functional domain modules under `src/features/` and `src/shared/`. Old flat directories (`src/pages/`, `src/components/`, `src/hooks/`, `src/utils/`, `src/types/`) removed. WorkflowDesigner refactored (1432→893 lines). 4914 unit tests, 270+ E2E tests passing, tsc clean.
>
> _Last updated: 2026-04-29_

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
| Monolithic pages | ~~WorkflowDesigner (2059 LOC)~~, ScenarioBuilder (1045), App (~~846~~ 858) |

> **Note**: WorkflowDesigner.tsx already refactored to 893 LOC (Phase 10 completed ahead of schedule). App.tsx now at 858 LOC with useTheme extracted.

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

### Phase 1: `shared/` ✅ Complete — Extract truly shared code
- [x] Create `src/shared/components/`, `src/shared/hooks/`, `src/shared/utils/`, `src/shared/types/`
- [x] Move shared components: `AppModalFrame`, `ModalExpandButton`, `ModalResizeHandles`, `jsonTreeShared`
- [x] Move shared hooks: `useDebounce`, `useModalDrag`, `useModalResize`, `useModalExpand`, `useModalFrame`, `useToast`, `useListCrud`, `useResizablePanels`
- [x] Move shared utils: `helpers`, `platform`, `fileSaver`, `storage`, `tauriStore`, `escapeRegExp`, `bodySerializer`, `curlGenerator`, `curlParser`, `httpClient`, `jsonHighlighter`, `executionMode`
- [x] Move shared types: `index.ts`, `server-api.ts`
- [x] Update all import paths
- [x] `npx tsc --noEmit` ✓

### Phase 2: `features/catalog/` ✅ Complete — API Catalog module
- [x] Create `src/features/catalog/`
- [x] Move `src/components/catalog/*` → `src/features/catalog/components/`
- [x] Move `src/hooks/useCatalog.ts` → `src/features/catalog/hooks/`
- [x] Move catalog utils: `catalogExport`, `catalogCurlGenerator`, `catalogSpecDiff`, `catalogStorage`, `openApiParser`, `schemaStubGenerator` → `src/features/catalog/utils/`
- [x] Move `src/types/catalog.ts` → `src/features/catalog/types/`
- [x] Move `src/pages/ApiCatalog.tsx` → `src/features/catalog/`
- [x] Update all import paths
- [x] `npx tsc --noEmit` ✓

### Phase 3: `features/requests/` ✅ Complete — Request Builder module
- [x] Create `src/features/requests/`
- [x] Move `src/components/requests/*` → `src/features/requests/components/`
- [x] Move request-specific components from `src/components/`: `AuthConfigPanel`, `BodyEditor`, `ExtractionEditor`, `ExtractionMapperModal`, `ExtractionPathPickerModal`, `ParamsEditor`, `JsonPathBuilder`, `ProfilePreview`, `RegexAssertionModal`, `regexAssertionUtils`, `ResponseDetailModal`, `ResponseVersionPanel`
- [x] Move `src/hooks/useRequests.ts`, `useResponseCache.ts`, `useAuthVerify.ts` → `src/features/requests/hooks/`
- [x] Move request utils: `requestTree`, `requestUrlResolver`, `requestAuthState`, `authResolver`, `jsonPathTreeUtils` → `src/features/requests/utils/`
- [x] Move `src/pages/Requests.tsx` → `src/features/requests/`
- [x] Update all import paths
- [x] `npx tsc --noEmit` ✓

### Phase 4: `features/scenarios/` ✅ Complete — Scenario Builder module
- [x] Create `src/features/scenarios/`
- [x] Move scenario components from `src/components/`: `TestEditorModal`, `TestEditorAuthTab`, `TestEditorValidationTab`, `CsvImportModal`, `CsvTemplateExportModal`, `CopyTestModal`, `MoveDialog`
- [x] Move scenario utils: `csvTemplate`, `csvTemplateCsv`, `csvTemplateExcel`, `csvTemplateTypes`, `csvTemplateUrl`, `scenarioImportExport`, `scenarioSearch`, `testEditorUtils` → `src/features/scenarios/utils/`
- [x] Move `src/hooks/useProjects.ts` → `src/features/scenarios/hooks/`
- [x] Move `src/pages/ScenarioBuilder.tsx` → `src/features/scenarios/`
- [x] Update all import paths
- [x] `npx tsc --noEmit` ✓

### Phase 5: `features/test-runner/` ✅ Complete — Test Runner module
- [x] Create `src/features/test-runner/`
- [x] Move test runner components from `src/components/`: `RunnerExecutionConfig`, `LiveCharts`, `WaterfallBar`
- [x] Move `src/hooks/useTestExecution.ts` → `src/features/test-runner/hooks/`
- [x] Move runner utils: `resultsGrouping`, `runnerProgressStorage`, `serverFormatters` → `src/features/test-runner/utils/`
- [x] Move `src/pages/TestRunner.tsx` → `src/features/test-runner/`
- [x] Update all import paths
- [x] `npx tsc --noEmit` ✓

### Phase 6: `features/workflow/` ✅ Complete — Workflow module (largest)
- [x] Create subdirectories: `components/{canvas,configs,nodes,panels,modals,expression}`, `hooks/`, `utils/`, `engine/`, `types/`
- [x] Move node configs → `components/configs/`: HttpConfig, DelayConfig, ConditionConfig, LoopConfig, etc.
- [x] Move nodes → `components/nodes/`: (already grouped, just move path)
- [x] Move canvas components → `components/canvas/`: WorkflowCanvasControls, WorkflowPalette, WorkflowToolbar, WorkflowStatusBar, WorkflowCommandPalette, WorkflowShortcutsOverlay
- [x] Move panel components → `components/panels/`: WorkflowConsolePanel, VariablesSection, VariablePanel, WorkflowInspectContext, WorkflowSidebar, WorkflowServicesPanelInline, etc.
- [x] Move modal components → `components/modals/`: WorkflowNodeConfigModal, WorkflowDefaultsModal, WorkflowDetailModal, TemplateGalleryModal, WorkflowServiceRegistryModal, WorkflowRequestsSettingsModal, WorkflowVariableInsertModal, etc.
- [x] Move expression components → `components/expression/`: ExpressionInput, ExpressionHintDropdown, ExpressionBuilderView, ExpressionTextarea, expressionBuilderState, InsertVarField, SearchableVariableSelect, AvailableVariables
- [x] Move remaining workflow components: WorkflowBreadcrumb, WorkflowDebugBar, WorkflowExecSummary, ComposeStrip, etc.
- [x] Move workflow hooks: `useWorkflows`, `useNodeClipboard`, `useUndoRedo`, `useVariableInsertModal`, `useExpressionHints`, `useWorkflowRunCache` → `features/workflow/hooks/`
- [x] Move workflow utils: `workflowAutoLayout`, `workflowMigrations`, `workflowNodeMerge`, `workflowBundleExport`, `workflowEnvReadiness`, `workflowExtractSubWorkflow`, `workflowHostResolve`, `workflowRequestHost`, `workflowMappingUtils`, `expressionEvaluator`, `expressionFunctions` → `features/workflow/utils/` _(Note: `expressionFunctions` refactored from single 957-line file into 9-module directory)_
- [x] Move `src/engine/workflow/*` → `features/workflow/engine/`
- [x] Move `src/types/workflow.ts` → `features/workflow/types/`
- [x] Move `src/pages/WorkflowDesigner.tsx` → `features/workflow/`
- [x] Update all import paths
- [x] `npx tsc --noEmit` ✓

### Phase 7: Remaining pages ✅ Complete & app shell
- [x] Move `src/pages/ResultsDashboard.tsx` → `src/features/results/`
- [x] Move `src/pages/EnvironmentManager.tsx` → `src/features/environments/`
- [x] Move `src/pages/WebhookDeliveryLogs.tsx` → `src/features/webhooks/`
- [x] Move `src/pages/WorkflowExecutionHistory.tsx` → `src/features/workflow/`
- [x] Move `src/components/SettingsModal.tsx`, `SettingsStorageTab.tsx` → `src/features/settings/`
- [x] Move `src/components/ExportCenter.tsx`, `ImportCenter.tsx` → `src/shared/components/`
- [x] Create `src/app/` — move `App.tsx`, `Sidebar.tsx`, `main.tsx`
- [x] Update all import paths
- [x] `npx tsc --noEmit` ✓

### Phase 8: Engine ✅ Complete (non-workflow) cleanup
- [x] Keep `src/engine/` for core execution engine files (already well-organized)
- [x] Verify no stale imports remain
- [x] `npx tsc --noEmit` ✓

### Phase 9: Cleanup ✅ Complete old directories
- [x] Remove empty directories (`src/pages/`, `src/components/`, old `src/hooks/`, old `src/utils/`, old `src/types/`)
- [x] Verify no orphaned files
- [x] `npx tsc --noEmit` ✓

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

## Phase 11: Final Validation ✅ Complete (MUST PASS before merge)

- [x] `npx tsc --noEmit` — zero TypeScript errors
- [x] `npx vitest run` — full unit test suite, all passing, >90% coverage
- [x] `npx playwright test --reporter=list` — all 203+ E2E tests passing
- [x] Manual smoke test: open app, navigate all pages, run a workflow
- [x] No broken imports, no orphaned files
- [x] User approval before merging to develop

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
