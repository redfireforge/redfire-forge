# Test Runner / Workflow Runner Split Plan

> **Goal:** Split the unified Test Runner into two focused runners — **Test Runner** (for scenario-based tests) and **Workflow Runner** (for workflow-based performance tests) — while maintaining a unified Results experience.

---

## 1. Current State

### What Exists Today

| Component | Status | Notes |
|-----------|--------|-------|
| `TestRunner.tsx` | ✅ Unified | Handles both scenario and workflow modes via radio buttons |
| `WorkflowPicker.tsx` | ✅ Done | Workflow selector with variable history |
| `RunnerExecutionConfig.tsx` | ✅ Done | Shared execution mode config |
| `useTestExecution.ts` | ✅ Done | Shared execution hook |
| `useRunnerConfig.ts` | ✅ Done | Shared config state management |
| `ResultsDashboard.tsx` | ✅ Done | Unified results with workflow-aware display |
| `WorkflowResultsSummary.tsx` | ✅ Done | Workflow-specific results visualization |

### Current Issues

1. **User confusion**: "Workflow" mode ignores Host, Auth, and Scenario settings — but they're still visible
2. **Conditional spaghetti**: `TestRunner.tsx` has complex `{executionMode === 'workflow' && ...}` blocks
3. **Dead UI elements**: Host selector, scenario tree, auth inheritance shown but ignored in workflow mode
4. **Mixed mental model**: One runner tries to serve two different use cases

---

## 2. Target Architecture

### Sidebar Structure

```
Testing
├── Tests           (existing — test definition management)
├── Test Runner     (scenario-based performance tests)
├── Workflow Runner (workflow-based performance tests)
└── Results         (unified results for both)
```

### Component Structure

```
src/features/test-runner/
├── TestRunner.tsx              ← Scenario-based runner (refactored)
├── WorkflowRunner.tsx          ← NEW: Workflow-based runner
├── components/
│   ├── RunnerConfigPanel.tsx   ← NEW: Shared config UI (extracted)
│   ├── LiveProgressPanel.tsx   ← NEW: Shared progress display (extracted)
│   ├── WorkflowPicker.tsx      ← Existing
│   ├── ScenarioSelector.tsx    ← NEW: Extracted from TestRunner
│   └── ...
├── hooks/
│   ├── useTestExecution.ts     ← Existing (shared)
│   ├── useRunnerConfig.ts      ← Existing (shared)
│   └── ...
└── utils/
    └── ...
```

---

## 3. Implementation Phases

### Phase 1: Extract Shared Components

**Priority: Critical | Effort: Medium**

#### 1.1 Extract `RunnerConfigPanel`

Create a reusable component for the common configuration controls:
- Iterations
- Concurrency
- Think time
- Timeout
- Retry count/delay
- Error policy (circuit breaker)

```tsx
// src/features/test-runner/components/RunnerConfigPanel.tsx
interface Props {
  config: RunnerConfig;
  onChange: (config: RunnerConfig) => void;
  disabled?: boolean;
  /** Hide execution mode selector (workflow runner doesn't need it) */
  hideExecutionMode?: boolean;
  /** Available execution modes (test runner shows all, workflow runner shows subset) */
  executionModes?: ExecutionMode[];
}
```

#### 1.2 Extract `LiveProgressPanel`

Create a reusable component for the live execution display:
- Progress bar / step indicator
- Live TPS chart
- Current stats (requests completed, pass rate, avg response time)
- Abort button

```tsx
// src/features/test-runner/components/LiveProgressPanel.tsx
interface Props {
  isRunning: boolean;
  completed: number;
  total: number;
  liveSummary: TestSummary | null;
  timeSeries: TimeSeriesPoint[];
  onAbort: () => void;
}
```

#### 1.3 Extract `ScenarioSelector`

Move the scenario/test selection tree from `TestRunner.tsx` into its own component:
- Feature group tree
- Scenario checkboxes
- Test weight configuration
- "Select All" / "Deselect All"

```tsx
// src/features/test-runner/components/ScenarioSelector.tsx
interface Props {
  featureGroups: FeatureGroup[];
  selectedScenarioIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  weights: Record<string, number>;
  onWeightsChange: (weights: Record<string, number>) => void;
}
```

#### 1.4 Deliverables

| File | Action |
|------|--------|
| `RunnerConfigPanel.tsx` | Create |
| `RunnerConfigPanel.test.tsx` | Create |
| `LiveProgressPanel.tsx` | Create |
| `LiveProgressPanel.test.tsx` | Create |
| `ScenarioSelector.tsx` | Create |
| `ScenarioSelector.test.tsx` | Create |

---

### Phase 2: Create Workflow Runner

**Priority: Critical | Effort: Medium**

#### 2.1 Create `WorkflowRunner.tsx`

A focused component for workflow-based performance testing:

```tsx
// src/features/test-runner/WorkflowRunner.tsx
export default function WorkflowRunner() {
  // Workflow selection
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});
  
  // Shared hooks
  const { config, updateConfig } = useRunnerConfig();
  const { execute, abort, state } = useTestExecution();
  
  // Get workflows from storage
  const { workflows } = useWorkflows();
  
  const selectedWorkflow = workflows.find(w => w.id === selectedWorkflowId);
  
  const handleRun = async () => {
    if (!selectedWorkflow) return;
    
    const testConfig: TestConfig = {
      executionMode: 'workflow',
      workflowId: selectedWorkflowId,
      workflowVariables: variables,
      concurrency: config.concurrency,
      totalTransactions: config.iterations,
      thinkTime: config.thinkTime,
      timeout: config.timeout,
      retryCount: config.retryCount,
      retryDelay: config.retryDelay,
      errorPolicy: config.errorPolicy,
    };
    
    await execute(testConfig, [], {}, selectedWorkflow);
    
    // Navigate to results after completion
    // (handled by parent or via callback)
  };
  
  return (
    <div className="workflow-runner">
      <h2>Workflow Runner</h2>
      
      {/* Workflow Selection */}
      <WorkflowPicker
        workflows={workflows}
        selectedWorkflowId={selectedWorkflowId}
        onWorkflowChange={setSelectedWorkflowId}
        variables={variables}
        onVariablesChange={setVariables}
        disabled={state.isRunning}
      />
      
      {/* Configuration */}
      <RunnerConfigPanel
        config={config}
        onChange={updateConfig}
        disabled={state.isRunning}
        hideExecutionMode={true}
        executionModes={['workflow']}
      />
      
      {/* Run Button */}
      <button 
        className="btn btn-primary"
        onClick={handleRun}
        disabled={!selectedWorkflow || state.isRunning}
      >
        Run Workflow
      </button>
      
      {/* Live Progress */}
      {state.isRunning && (
        <LiveProgressPanel
          isRunning={state.isRunning}
          completed={state.completed}
          total={state.total}
          liveSummary={state.liveSummary}
          timeSeries={state.timeSeries}
          onAbort={abort}
        />
      )}
      
      {/* Latest Run Link */}
      {state.finalRun && (
        <div className="latest-run-link">
          Latest run: {formatDate(state.finalRun.timestamp)} — 
          {state.finalRun.summary.totalRequests} req — 
          {state.finalRun.summary.successRate}% pass
          <a href={`?tab=results&runId=${state.finalRun.id}`}>View →</a>
        </div>
      )}
    </div>
  );
}
```

#### 2.2 Workflow Runner Features

| Feature | Description |
|---------|-------------|
| Workflow picker | Select from saved workflows |
| Variable editor | Edit initial variables with history |
| Iterations config | How many times to run the workflow |
| Concurrency config | How many parallel iterations |
| Think time | Delay between iterations |
| Error policy | Circuit breaker for failing iterations |
| Live progress | TPS chart, completion progress |
| Post-run navigation | Auto-navigate to Results |

#### 2.3 What Workflow Runner Does NOT Have

| Feature | Reason |
|---------|--------|
| Host selector | URLs are defined in workflow nodes |
| Environment selector | Not applicable (could add later for variable injection) |
| Scenario tree | No scenarios — the workflow IS the test |
| Auth configuration | Auth is defined in workflow nodes |
| Execution mode selector | Always "workflow" mode |
| Test weights | No tests to weight — one workflow per run |

#### 2.4 Deliverables

| File | Action |
|------|--------|
| `WorkflowRunner.tsx` | Create |
| `WorkflowRunner.test.tsx` | Create |
| `e2e/workflow-runner.spec.ts` | Create |

---

### Phase 3: Refactor Test Runner

**Priority: Critical | Effort: Medium**

#### 3.1 Simplify `TestRunner.tsx`

Remove all workflow-specific logic:
- Remove `WorkflowPicker` import and rendering
- Remove `executionMode === 'workflow'` conditionals
- Remove `workflowId` and `workflowVariables` from config
- Keep only: Sequential, Batch, Pool, Load Profile modes

```tsx
// src/features/test-runner/TestRunner.tsx (simplified)
export default function TestRunner() {
  // Scenario selection
  const [selectedScenarioIds, setSelectedScenarioIds] = useState<Set<string>>(new Set());
  const [weights, setWeights] = useState<Record<string, number>>({});
  
  // Host / environment
  const [hostMode, setHostMode] = useState<'original' | 'settings' | 'custom'>('settings');
  const [customHost, setCustomHost] = useState('');
  
  // Shared hooks
  const { config, updateConfig } = useRunnerConfig();
  const { execute, abort, state } = useTestExecution();
  
  // Feature groups from storage
  const { featureGroups } = useProjects();
  
  const handleRun = async () => {
    const scenarios = buildScenariosFromSelection(featureGroups, selectedScenarioIds);
    const baseUrl = resolveBaseUrl(hostMode, customHost, settings);
    
    const testConfig: TestConfig = {
      executionMode: config.executionMode, // sequential | batch | pool | load-profile
      concurrency: config.concurrency,
      totalTransactions: config.iterations,
      // ... other config
    };
    
    await execute(testConfig, scenarios, { baseUrl });
  };
  
  return (
    <div className="test-runner">
      <h2>Test Runner</h2>
      
      {/* Host Selection */}
      <HostSelector
        mode={hostMode}
        onModeChange={setHostMode}
        customHost={customHost}
        onCustomHostChange={setCustomHost}
      />
      
      {/* Scenario Selection */}
      <ScenarioSelector
        featureGroups={featureGroups}
        selectedScenarioIds={selectedScenarioIds}
        onSelectionChange={setSelectedScenarioIds}
        weights={weights}
        onWeightsChange={setWeights}
      />
      
      {/* Configuration */}
      <RunnerConfigPanel
        config={config}
        onChange={updateConfig}
        disabled={state.isRunning}
        executionModes={['sequential', 'batch', 'pool', 'load-profile']}
      />
      
      {/* Run Button */}
      <button onClick={handleRun} disabled={selectedScenarioIds.size === 0 || state.isRunning}>
        Run Test
      </button>
      
      {/* Live Progress */}
      {state.isRunning && <LiveProgressPanel ... />}
    </div>
  );
}
```

#### 3.2 Deliverables

| File | Action |
|------|--------|
| `TestRunner.tsx` | Refactor (remove workflow logic) |
| `TestRunner.test.tsx` | Update tests |
| `e2e/test-runner.spec.ts` | Update tests |

---

### Phase 4: Update App Navigation

**Priority: High | Effort: Small**

#### 4.1 Add Workflow Runner Tab

Update `App.tsx` and `appTabUtils.ts`:

```tsx
// src/app/utils/appTabUtils.ts
export type Tab = 
  | 'environments' | 'preferences' 
  | 'requests' | 'catalog' 
  | 'workflow' | 'workflow-executions' | 'webhook-deliveries' 
  | 'gallery' | 'training' 
  | 'scenarios' | 'runner' | 'workflow-runner' | 'results';  // ADD workflow-runner

const HARNESS_TABS = new Set<Tab>(['scenarios', 'runner', 'workflow-runner', 'results']);
```

#### 4.2 Update Sidebar

```tsx
// In Sidebar.tsx
{/* Testing section */}
<NavItem tab="scenarios" icon="📋" label="Tests" />
<NavItem tab="runner" icon="▶️" label="Test Runner" />
<NavItem tab="workflow-runner" icon="⚡" label="Workflow Runner" />
<NavItem tab="results" icon="📊" label="Results" />
```

#### 4.3 Render Workflow Runner

```tsx
// In App.tsx
<div hidden={activeTab !== 'workflow-runner'}>
  <WorkflowRunner />
</div>
```

#### 4.4 Deliverables

| File | Action |
|------|--------|
| `appTabUtils.ts` | Add `workflow-runner` tab |
| `Sidebar.tsx` | Add Workflow Runner nav item |
| `App.tsx` | Render `WorkflowRunner` component |

---

### Phase 5: Enhance Results Tab

**Priority: High | Effort: Small**

#### 5.1 Add Filter Tabs

```tsx
// In ResultsDashboard.tsx
const [runTypeFilter, setRunTypeFilter] = useState<'all' | 'test' | 'workflow'>('all');

const filteredRuns = useMemo(() => {
  if (runTypeFilter === 'all') return runs;
  if (runTypeFilter === 'test') return runs.filter(r => r.config.executionMode !== 'workflow');
  return runs.filter(r => r.config.executionMode === 'workflow');
}, [runs, runTypeFilter]);

// In render:
<div className="results-filter-tabs">
  <button 
    className={`filter-tab ${runTypeFilter === 'all' ? 'active' : ''}`}
    onClick={() => setRunTypeFilter('all')}
  >
    All Runs
  </button>
  <button 
    className={`filter-tab ${runTypeFilter === 'test' ? 'active' : ''}`}
    onClick={() => setRunTypeFilter('test')}
  >
    📋 Test Runs
  </button>
  <button 
    className={`filter-tab ${runTypeFilter === 'workflow' ? 'active' : ''}`}
    onClick={() => setRunTypeFilter('workflow')}
  >
    ⚡ Workflow Runs
  </button>
</div>
```

#### 5.2 Enhance Run Dropdown

Show run type indicator:

```tsx
// Run option display
<option value={run.id}>
  {formatDate(run.timestamp)} — 
  {run.config.executionMode === 'workflow' ? '⚡' : '📋'} 
  {run.workflowName || run.svcName || 'Unknown'} — 
  {run.summary.totalRequests} req
</option>
```

#### 5.3 Auto-Navigate with runId

Support `?tab=results&runId=<id>` to pre-select a run:

```tsx
// In ResultsDashboard.tsx
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const runId = params.get('runId');
  if (runId && runs.find(r => r.id === runId)) {
    setSelectedRunId(runId);
  }
}, [runs]);
```

#### 5.4 Deliverables

| File | Action |
|------|--------|
| `ResultsDashboard.tsx` | Add filter tabs, enhance dropdown, support runId param |
| `ResultsDashboard.test.tsx` | Add tests for new features |
| `base.css` | Add styles for filter tabs |

---

### Phase 6: Post-Run Navigation

**Priority: Medium | Effort: Small**

#### 6.1 Navigate to Results After Run

Both runners should navigate to Results after a successful run:

```tsx
// In useTestExecution.ts or in runner components
const navigateToResults = useCallback((runId: string) => {
  const url = new URL(window.location.href);
  url.searchParams.set('tab', 'results');
  url.searchParams.set('runId', runId);
  window.history.pushState({}, '', url.toString());
  // Trigger tab change via App state
  onTabChange?.('results');
}, [onTabChange]);

// After run completes:
if (testRun) {
  navigateToResults(testRun.id);
}
```

#### 6.2 "Run in Harness" from Workflow Designer

Update the navigation to go to Workflow Runner:

```tsx
// In WorkflowDesigner.tsx
const handleRunInHarness = () => {
  // Navigate to workflow-runner with workflow pre-selected
  navigate(`?tab=workflow-runner&workflowId=${workflow.id}`);
};
```

#### 6.3 Deliverables

| File | Action |
|------|--------|
| `useTestExecution.ts` | Add navigation callback |
| `TestRunner.tsx` | Call navigation after run |
| `WorkflowRunner.tsx` | Call navigation after run |
| `WorkflowDesigner.tsx` | Update "Run in Harness" to use workflow-runner tab |

---

## 4. Migration Path

### Backward Compatibility

- `?tab=runner` continues to work (Test Runner)
- `?tab=runner&mode=workflow` redirects to `?tab=workflow-runner`
- Existing test runs remain accessible in unified Results

### Deprecation

- Remove `executionMode: 'workflow'` from Test Runner's mode selector
- Keep the mode in `TestConfig` for stored runs (backward compatibility)

---

## 5. Testing Strategy

### Unit Tests

| Component | Tests |
|-----------|-------|
| `RunnerConfigPanel` | Config changes, validation, disabled state |
| `LiveProgressPanel` | Progress display, abort button |
| `ScenarioSelector` | Selection, weights, tree navigation |
| `WorkflowRunner` | Workflow selection, variable editing, run execution |
| `ResultsDashboard` | Filter tabs, run type indicators, runId navigation |

### E2E Tests

| Test File | Coverage |
|-----------|----------|
| `test-runner.spec.ts` | Scenario-based test runs |
| `workflow-runner.spec.ts` | Workflow-based test runs |
| `results-navigation.spec.ts` | Post-run navigation, filter tabs, runId param |

---

## 6. Dependency Graph

```
Phase 1 (Extract Shared)
        │
        ├──────────────────┐
        ▼                  ▼
Phase 2 (Workflow Runner)  Phase 3 (Refactor Test Runner)
        │                  │
        └────────┬─────────┘
                 ▼
        Phase 4 (App Navigation)
                 │
                 ▼
        Phase 5 (Results Enhancements)
                 │
                 ▼
        Phase 6 (Post-Run Navigation)
```

| Phase | Priority | Effort | Depends On |
|-------|----------|--------|------------|
| 1. Extract Shared Components | Critical | M | — |
| 2. Create Workflow Runner | Critical | M | Phase 1 |
| 3. Refactor Test Runner | Critical | M | Phase 1 |
| 4. Update App Navigation | High | S | Phase 2, 3 |
| 5. Enhance Results Tab | High | S | Phase 4 |
| 6. Post-Run Navigation | Medium | S | Phase 5 |

**Estimated total: 6 phases, ~3-4 implementation sessions**

---

## 7. Visual Summary

### Before (Unified)

```
┌─────────────────────────────────────────────────────┐
│ Test Runner                                         │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Mode: ○ Seq ○ Batch ○ Pool ○ Profile ○ Workflow │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ (if not workflow)           (if workflow)           │
│ ┌───────────────────┐      ┌───────────────────┐   │
│ │ Host Selector     │      │ Workflow Picker   │   │
│ │ Scenario Tree     │      │ Variable Editor   │   │
│ │ Test Weights      │      │                   │   │
│ └───────────────────┘      └───────────────────┘   │
│                                                     │
│ [Run]                                               │
└─────────────────────────────────────────────────────┘
```

### After (Split)

```
┌─────────────────────────────┐  ┌─────────────────────────────┐
│ Test Runner                 │  │ Workflow Runner             │
│                             │  │                             │
│ Host Selector               │  │ Workflow Picker             │
│ Scenario Tree               │  │ Variable Editor + History   │
│ Test Weights                │  │                             │
│                             │  │                             │
│ Mode: ○ Seq ○ Batch ○ Pool  │  │ Iterations: [___]           │
│       ○ Load Profile        │  │ Concurrency: [___]          │
│                             │  │ Think Time: [___]           │
│ Iterations: [___]           │  │                             │
│ Concurrency: [___]          │  │                             │
│                             │  │                             │
│ [Run Test]                  │  │ [Run Workflow]              │
└─────────────────────────────┘  └─────────────────────────────┘
              │                              │
              └──────────────┬───────────────┘
                             ▼
              ┌─────────────────────────────┐
              │ Results                     │
              │ [All] [Test Runs] [Workflow]│
              │                             │
              │ Run: [dropdown ▼]           │
              │                             │
              │ (auto-detects run type,     │
              │  shows appropriate view)    │
              └─────────────────────────────┘
```

---

## Changelog

| Date | Change |
|------|--------|
| 2026-05-05 | Phase 2 complete: Created WorkflowRunner with useWorkflowRunnerConfig hook, reusing existing components |
| 2026-05-05 | Phase 1 complete: Extracted ScenarioSelector, LiveProgressPanel, and HostSelector components with unit tests |
| 2026-05-05 | Initial plan created |

---

_Created: 2026-05-05 | Status: Pending | Related: [workflow-harness-integration-plan.md](./workflow-harness-integration-plan.md)_
