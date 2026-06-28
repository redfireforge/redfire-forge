/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeCtx } from '../ws-test-utils';
import { stubWorkflowSeedBridge, clearWorkflowSeedBridge, stubRunnerBridge } from '../../../test-utils/workflowBridgeStubs';
import { WFR } from '@shared/selectors/wfr';
import { REX } from '@shared/selectors/rex';
import {
  LESSON17_WF_NAME,
  resetGqlLesson17SessionFlags,
  createGqlLatencyDemoWorkflow,
  ensureLesson17WorkflowRun,
  ensureLesson17RunnerDemoConfig,
  ensureLesson17OnResultsTab,
  openLesson17ResultsFromCompletionBanner,
  openAndFitLesson17ResultsExplorer,
  fitLesson17ResultsExplorerDiagram,
  closeLesson17ResultsExplorerIfOpen,
  selectLesson17ResultsExplorerIteration,
  showLesson17ResultsExplorerConsole,
} from './lesson17-workflow-runner';

describe('lesson17-workflow-runner — coverage gaps', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetGqlLesson17SessionFlags();
    stubWorkflowSeedBridge(LESSON17_WF_NAME);
  });

  afterEach(() => {
    clearWorkflowSeedBridge();
  });

  it('createGqlLatencyDemoWorkflow builds the seeded latency workflow graph', () => {
    const wf = createGqlLatencyDemoWorkflow() as { name: string; nodes: unknown[]; edges: unknown[] };
    expect(wf.name).toBe(LESSON17_WF_NAME);
    expect(wf.nodes.length).toBeGreaterThan(0);
    expect(wf.edges.length).toBeGreaterThan(0);
  });

  it('ensureLesson17WorkflowRun short-circuits on second call when session flag is set', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <div class="workflow-vars-section"></div>
      <div class="completion-section"></div>
    `;
    (window as unknown as Record<string, unknown>).__wfRunnerApplyBatchConfig = vi.fn(() => true);
    await ensureLesson17WorkflowRun(ctx);
    const clicksAfterFirst = vi.mocked(ctx.click).mock.calls.length;
    await ensureLesson17WorkflowRun(ctx);
    expect(vi.mocked(ctx.click).mock.calls.length).toBe(clicksAfterFirst);
  });

  it('ensureLesson17OnResultsTab opens results when filter tabs already visible', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `<div class="results-run-filter-tabs"></div>`;
    await ensureLesson17OnResultsTab(ctx);
    expect(ctx.navigateToTab).not.toHaveBeenCalledWith('results');
  });

  it('ensureLesson17RunnerDemoConfig fills batch fields when bridge unavailable', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <div class="workflow-vars-section"></div>
      <div class="workflow-runner-config-section">
        <label class="radio-label">Batch execution</label>
        <div class="resilience-field"><label>Iterations</label><input value="10" /></div>
        <div class="resilience-field"><label>Concurrency</label><input value="5" /></div>
      </div>
      <div class="wf-runner-inline-options">
        <label class="radio-label">Standard trace</label>
        <input type="radio" />
      </div>
      <button data-testid="workflow-select">Select</button>
      <div class="wfp-dropdown-panel"></div>
      <div class="wfp-dropdown-item">GraphQL Latency Demo</div>
    `;
    await ensureLesson17RunnerDemoConfig(ctx);
    expect(ctx.delay).toHaveBeenCalled();
  });

  it('openLesson17ResultsFromCompletionBanner clicks view results button', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <div class="completion-section"><button class="btn-primary">View Full Results →</button></div>
    `;
    await openLesson17ResultsFromCompletionBanner(ctx);
    expect(ctx.click).toHaveBeenCalledWith('.completion-section .btn-primary');
  });

  it('openLesson17ResultsFromCompletionBanner navigates when button missing', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `<div class="completion-section"></div>`;
    await openLesson17ResultsFromCompletionBanner(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('results');
  });

  it('openAndFitLesson17ResultsExplorer no-ops when diagram already open', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <div class="results-explorer-diagram" data-testid="results-explorer-diagram"></div>
    `;
    (window as unknown as Record<string, unknown>).__reExplorerFitView = vi.fn(() => true);
    await openAndFitLesson17ResultsExplorer(ctx);
  });

  it('fitLesson17ResultsExplorerDiagram uses bridge when available', async () => {
    const ctx = makeCtx();
    const fitSpy = vi.fn(() => true);
    (window as unknown as Record<string, unknown>).__reExplorerFitView = fitSpy;
    await fitLesson17ResultsExplorerDiagram(ctx);
    expect(fitSpy).toHaveBeenCalled();
  });

  it('closeLesson17ResultsExplorerIfOpen clicks footer Close button', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <div class="results-explorer-footer-actions">
        <button class="cat-btn">Close</button>
      </div>
    `;
    const closeBtn = document.querySelector<HTMLElement>('.cat-btn')!;
    const clickSpy = vi.spyOn(closeBtn, 'click');
    await closeLesson17ResultsExplorerIfOpen(ctx);
    expect(clickSpy).toHaveBeenCalled();
    expect(ctx.delay).toHaveBeenCalledWith(600);
  });

  it('ensureLesson17RunnerDemoConfig short-circuits when batch bridge succeeds', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `<div class="workflow-vars-section"></div>`;
    (window as unknown as Record<string, unknown>).__wfRunnerApplyBatchConfig = vi.fn(() => true);
    await ensureLesson17RunnerDemoConfig(ctx);
    await ensureLesson17RunnerDemoConfig(ctx);
    expect(ctx.delay).toHaveBeenCalledWith(300);
  });

  it('runGqlLatencyWorkflow short-circuits when completion section already visible', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `<div class="completion-section"></div>`;
    const { runGqlLatencyWorkflow } = await import('./lesson17-workflow-runner');
    await runGqlLatencyWorkflow(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('openLesson17ResultsFromCompletionBanner short-circuits when results tabs visible', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `<div class="results-run-filter-tabs"></div>`;
    await openLesson17ResultsFromCompletionBanner(ctx);
    expect(ctx.navigateToTab).not.toHaveBeenCalled();
  });

  it('openLesson17RequestDetailsTab clicks Request Details tab', async () => {
    const ctx = makeCtx();
    const tab = document.createElement('button');
    tab.className = 'results-view-tab';
    tab.textContent = 'Request Details';
    const clickSpy = vi.spyOn(tab, 'click');
    document.body.innerHTML = `
      <div class="results-run-filter-tabs"></div>
    `;
    document.body.appendChild(tab);
    const { openLesson17RequestDetailsTab } = await import('./lesson17-workflow-runner');
    await openLesson17RequestDetailsTab(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('openLesson17ResultsExplorer opens modal from dashboard header', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <div class="results-run-filter-tabs"></div>
      <button title="Explore execution results">Explore</button>
    `;
    const btn = document.querySelector<HTMLElement>('button[title="Explore execution results"]')!;
    const clickSpy = vi.spyOn(btn, 'click');
    const { openLesson17ResultsExplorer } = await import('./lesson17-workflow-runner');
    await openLesson17ResultsExplorer(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('fitLesson17ResultsExplorerDiagram uses fit button fallback', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <div class="results-explorer-diagram"><div class="react-flow__node"></div></div>
      <button data-testid="results-explorer-fit-view-btn">Fit</button>
    `;
    (window as unknown as Record<string, unknown>).__reExplorerFitView = vi.fn(() => false);
    const fitBtn = document.querySelector<HTMLElement>('[data-testid="results-explorer-fit-view-btn"]')!;
    const clickSpy = vi.spyOn(fitBtn, 'click');
    await fitLesson17ResultsExplorerDiagram(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('selectLesson17ResultsExplorerIteration picks iteration from dropdown', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="iter-picker-toggle" class="aggregate"></button>
      <div data-testid="iter-picker-dropdown"></div>
      <button data-testid="iter-picker-item-0">#1</button>
    `;
    const item = document.querySelector<HTMLElement>('[data-testid="iter-picker-item-0"]')!;
    const clickSpy = vi.spyOn(item, 'click');
    await selectLesson17ResultsExplorerIteration(ctx, 0);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('showLesson17ResultsExplorerConsole toggles console and selects iteration', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="view-toggle-diagram" class="view-toggle-active"></button>
      <button data-testid="iter-picker-toggle"></button>
      <button data-testid="iter-picker-aggregate"></button>
      <button data-testid="console-toggle-btn-header"></button>
      <div data-testid="results-console-body"><div class="re-console-line">Iteration #1 started</div></div>
      <div data-testid="iter-picker-dropdown"></div>
      <button data-testid="iter-picker-item-0">#1</button>
    `;
    (window as unknown as Record<string, unknown>).__reExplorerFitView = vi.fn(() => true);
    await showLesson17ResultsExplorerConsole(ctx);
    expect(ctx.delay).toHaveBeenCalled();
  });

  it('gqlWorkflowRunnerLessonCleanup resets session flags', async () => {
    const ctx = makeCtx();
    const { gqlWorkflowRunnerLessonCleanup } = await import('./lesson17-workflow-runner');
    await gqlWorkflowRunnerLessonCleanup(ctx);
    expect(ctx.delay).toHaveBeenCalledWith(100);
  });

  it('ensureLesson17WorkflowRun marks complete when completion section appears', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <div class="workflow-vars-section"></div>
      <div class="completion-section"></div>
    `;
    (window as unknown as Record<string, unknown>).__wfRunnerApplyBatchConfig = vi.fn(() => true);
    await ensureLesson17WorkflowRun(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureLesson17WorkflowRun(ctx);
    expect(vi.mocked(ctx.click).mock.calls.length).toBe(0);
  });

  it('ensureLesson17RunnerDemoConfig DOM fallback clicks batch and standard radios', async () => {
    const ctx = makeCtx();
    stubRunnerBridge({ applyBatchConfig: false, selectAndRun: false });
    const batchRadio = document.createElement('input');
    batchRadio.type = 'radio';
    const batchClickSpy = vi.spyOn(batchRadio, 'click');
    document.body.innerHTML = `
      <div class="workflow-vars-section"></div>
      <div class="workflow-runner-config-section">
        <label class="radio-label">Batch execution</label>
      </div>
      <div class="wf-runner-inline-options">
        <label class="radio-label">Standard trace</label>
      </div>
      <div class="resilience-field"><label>Iterations</label><input value="10" /></div>
      <div class="resilience-field"><label>Concurrency</label><input value="5" /></div>
      <button data-testid="workflow-select">Select</button>
    `;
    document.querySelector('.workflow-runner-config-section label')!.appendChild(batchRadio);
    const standardRadio = document.createElement('input');
    standardRadio.type = 'radio';
    const standardClickSpy = vi.spyOn(standardRadio, 'click');
    document.querySelector('.wf-runner-inline-options label')!.appendChild(standardRadio);
    await ensureLesson17RunnerDemoConfig(ctx);
    expect(batchClickSpy).toHaveBeenCalled();
    expect(standardClickSpy).toHaveBeenCalled();
  });

  it('ensureLesson17RunnerDemoConfig short-circuits when config already set without bridge', async () => {
    const ctx = makeCtx();
    stubRunnerBridge({ applyBatchConfig: false, selectAndRun: false });
    document.body.innerHTML = `
      <div class="workflow-vars-section"></div>
      <div class="workflow-runner-config-section">
        <label class="radio-label">Batch execution</label>
        <input type="radio" />
      </div>
      <div class="wf-runner-inline-options">
        <label class="radio-label">Standard trace</label>
        <input type="radio" />
      </div>
      <div class="resilience-field"><label>Iterations</label><input value="3" /></div>
      <div class="resilience-field"><label>Concurrency</label><input value="1" /></div>
    `;
    await ensureLesson17RunnerDemoConfig(ctx);
    vi.mocked(ctx.delay).mockClear();
    await ensureLesson17RunnerDemoConfig(ctx);
    expect(vi.mocked(ctx.delay).mock.calls.length).toBe(0);
  });

  it('runGqlLatencyWorkflow uses run button fallback and scrolls completion banner', async () => {
    const ctx = makeCtx();
    stubRunnerBridge({ applyBatchConfig: true, selectAndRun: true });
    const runBtn = document.createElement('button');
    runBtn.className = 'btn btn-primary btn-lg';
    runBtn.textContent = 'Run Workflow';
    runBtn.scrollIntoView = vi.fn();
    document.body.innerHTML = `
      <div class="workflow-vars-section"></div>
      <div class="config-form"><div class="form-actions"></div></div>
      <div class="progress-section"></div>
    `;
    document.querySelector('.form-actions')!.appendChild(runBtn);
    const { runGqlLatencyWorkflow } = await import('./lesson17-workflow-runner');
    let addedCompletion = false;
    vi.mocked(ctx.delay).mockImplementation(async () => {
      if (!addedCompletion) {
        addedCompletion = true;
        const completion = document.createElement('div');
        completion.className = 'completion-section';
        completion.scrollIntoView = vi.fn();
        document.body.appendChild(completion);
      }
    });
    await runGqlLatencyWorkflow(ctx);
    expect(runBtn.scrollIntoView).toHaveBeenCalled();
  });

  it('runGqlLatencyWorkflow finds run button via WFR test id', async () => {
    const ctx = makeCtx();
    stubRunnerBridge({ applyBatchConfig: true, selectAndRun: false });
    document.body.innerHTML = `
      <div class="workflow-vars-section"></div>
      <button data-testid="workflow-runner-run-btn">Run</button>
      <div data-testid="workflow-runner-stop-btn"></div>
    `;
    const { runGqlLatencyWorkflow } = await import('./lesson17-workflow-runner');
    await runGqlLatencyWorkflow(ctx);
    expect(document.querySelector(WFR.STOP_BTN)).toBeTruthy();
  });

  it('fitLesson17ResultsExplorerDiagram collapses detail panel and scrolls fit button', async () => {
    const ctx = makeCtx();
    const toggle = document.createElement('button');
    toggle.setAttribute('data-testid', 'detail-panel-toggle');
    toggle.textContent = '▶';
    const toggleClickSpy = vi.spyOn(toggle, 'click');
    const fitBtn = document.createElement('button');
    fitBtn.setAttribute('data-testid', 'results-explorer-fit-view-btn');
    fitBtn.scrollIntoView = vi.fn();
    document.body.innerHTML = `
      <div class="results-explorer-detail"></div>
      <div class="results-explorer-diagram"><div class="react-flow__node"></div></div>
    `;
    document.body.append(toggle, fitBtn);
    (window as unknown as Record<string, unknown>).__reExplorerFitView = vi.fn(() => false);
    await fitLesson17ResultsExplorerDiagram(ctx);
    expect(toggleClickSpy).toHaveBeenCalled();
    expect(fitBtn.scrollIntoView).toHaveBeenCalled();
  });

  it('selectLesson17ResultsExplorerIteration opens picker when aggregate active', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="iter-picker-toggle" class="aggregate"></button>
      <div data-testid="iter-picker-dropdown"></div>
      <button data-testid="iter-picker-item-1">#2</button>
    `;
    const item = document.querySelector<HTMLElement>(REX.iterPickerItem(1))!;
    const clickSpy = vi.spyOn(item, 'click');
    await selectLesson17ResultsExplorerIteration(ctx, 1);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('selectLesson17ResultsExplorerIteration no-ops when toggle missing', async () => {
    const ctx = makeCtx();
    await selectLesson17ResultsExplorerIteration(ctx, 0);
    expect(ctx.delay).not.toHaveBeenCalled();
  });

  it('showLesson17ResultsExplorerConsole opens diagram view and aggregate console', async () => {
    const ctx = makeCtx();
    const diagramBtn = document.createElement('button');
    diagramBtn.setAttribute('data-testid', 'view-toggle-diagram');
    const diagramClickSpy = vi.spyOn(diagramBtn, 'click');
    const consoleBtn = document.createElement('button');
    consoleBtn.setAttribute('data-testid', 'console-toggle-btn-header');
    const consoleClickSpy = vi.spyOn(consoleBtn, 'click');
    document.body.innerHTML = `
      <button data-testid="iter-picker-toggle"></button>
      <button data-testid="iter-picker-aggregate"></button>
      <div data-testid="results-console-body"><div class="re-console-line">Iteration #1 started</div></div>
      <div data-testid="iter-picker-dropdown"></div>
      <button data-testid="iter-picker-item-0">#1</button>
      <div class="results-explorer-diagram"><div class="react-flow__node"></div></div>
      <button data-testid="results-explorer-fit-view-btn">Fit</button>
    `;
    document.body.append(diagramBtn, consoleBtn);
    (window as unknown as Record<string, unknown>).__reExplorerFitView = vi.fn(() => true);
    await showLesson17ResultsExplorerConsole(ctx);
    expect(diagramClickSpy).toHaveBeenCalled();
    expect(consoleClickSpy).toHaveBeenCalled();
  });

  it('gqlWorkflowRunnerLessonSetup seeds workflow and configures runner', async () => {
    const ctx = makeCtx();
    stubRunnerBridge({ applyBatchConfig: true, selectAndRun: false });
    document.body.innerHTML = `
      <div class="workflow-vars-section"></div>
      <button data-testid="workflow-select">Select</button>
      <div class="wfp-dropdown-panel"></div>
      <div class="wfp-dropdown-item">${LESSON17_WF_NAME}</div>
    `;
    const { gqlWorkflowRunnerLessonSetup } = await import('./lesson17-workflow-runner');
    await gqlWorkflowRunnerLessonSetup(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('workflow-runner');
  });

  it('ensureLesson17OnResultsTab clicks view results when tabs not yet open', async () => {
    const ctx = makeCtx();
    stubRunnerBridge({ applyBatchConfig: true, selectAndRun: true });
    const viewBtn = document.createElement('button');
    viewBtn.className = 'btn-primary';
    viewBtn.textContent = 'View Full Results →';
    const clickSpy = vi.spyOn(viewBtn, 'click');
    document.body.innerHTML = `
      <div class="workflow-vars-section"></div>
      <div class="completion-section"></div>
      <button data-testid="workflow-runner-run-btn">Run</button>
    `;
    document.querySelector('.completion-section')!.appendChild(viewBtn);
    await ensureLesson17OnResultsTab(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('runGqlLatencyWorkflow warns when run never starts', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ctx = makeCtx();
    stubRunnerBridge({ applyBatchConfig: true, selectAndRun: false });
    document.body.innerHTML = `<div class="workflow-vars-section"></div>`;
    const { runGqlLatencyWorkflow, resetGqlLesson17SessionFlags } = await import('./lesson17-workflow-runner');
    resetGqlLesson17SessionFlags();
    await runGqlLatencyWorkflow(ctx);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Run Workflow did not start'),
    );
    warnSpy.mockRestore();
  });

  it('selectGqlLatencyDemoWorkflow picks workflow by prefix when exact name missing', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="workflow-select">Select</button>
      <div class="wfp-dropdown-panel"></div>
      <div class="wfp-dropdown-item">GraphQL Latency Demo (copy)</div>
    `;
    const item = document.querySelector<HTMLElement>('.wfp-dropdown-item')!;
    const clickSpy = vi.spyOn(item, 'click');
    const { selectGqlLatencyDemoWorkflow } = await import('./lesson17-workflow-runner');
    await selectGqlLatencyDemoWorkflow(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('ensureLesson17OnResultsTab navigates to results when completion has no view button', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <div class="workflow-vars-section"></div>
      <div class="completion-section"></div>
    `;
    await ensureLesson17OnResultsTab(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('results');
  });

  it('ensureLesson17WorkflowSelected short-circuits when workflow already selected', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `<div class="workflow-vars-section"></div>`;
    const { selectGqlLatencyDemoWorkflow, ensureLesson17WorkflowSelected } = await import('./lesson17-workflow-runner');
    document.body.innerHTML = `
      <div class="workflow-vars-section"></div>
      <button data-testid="workflow-select">Select</button>
      <div class="wfp-dropdown-panel"></div>
      <div class="wfp-dropdown-item">${LESSON17_WF_NAME}</div>
    `;
    await selectGqlLatencyDemoWorkflow(ctx);
    vi.mocked(ctx.click).mockClear();
    vi.mocked(ctx.navigateToTab).mockClear();
    await ensureLesson17WorkflowSelected(ctx);
    expect(ctx.navigateToTab).not.toHaveBeenCalled();
    expect(vi.mocked(ctx.click).mock.calls.length).toBe(0);
  });

  it('ensureLesson17RunnerDemoConfig skips radio clicks when already checked or disabled', async () => {
    const ctx = makeCtx();
    stubRunnerBridge({ applyBatchConfig: false, selectAndRun: false });
    const batchRadio = document.createElement('input');
    batchRadio.type = 'radio';
    batchRadio.checked = true;
    const batchClickSpy = vi.spyOn(batchRadio, 'click');
    const standardRadio = document.createElement('input');
    standardRadio.type = 'radio';
    standardRadio.disabled = true;
    const standardClickSpy = vi.spyOn(standardRadio, 'click');
    document.body.innerHTML = `
      <div class="workflow-vars-section"></div>
      <div class="workflow-runner-config-section">
        <label class="radio-label">Batch execution</label>
      </div>
      <div class="wf-runner-inline-options">
        <label class="radio-label">Standard trace</label>
      </div>
      <div class="resilience-field"><label>Iterations</label><input value="3" /></div>
      <div class="resilience-field"><label>Concurrency</label><input value="1" /></div>
    `;
    document.querySelector('.workflow-runner-config-section label')!.appendChild(batchRadio);
    document.querySelector('.wf-runner-inline-options label')!.appendChild(standardRadio);
    await ensureLesson17RunnerDemoConfig(ctx);
    expect(batchClickSpy).not.toHaveBeenCalled();
    expect(standardClickSpy).not.toHaveBeenCalled();
  });

  it('ensureLesson17RunnerDemoConfig tolerates missing labeled number inputs', async () => {
    const ctx = makeCtx();
    stubRunnerBridge({ applyBatchConfig: false, selectAndRun: false });
    document.body.innerHTML = `
      <div class="workflow-vars-section"></div>
      <div class="workflow-runner-config-section">
        <label class="radio-label">Batch execution</label>
        <input type="radio" />
      </div>
      <div class="wf-runner-inline-options">
        <label class="radio-label">Standard trace</label>
        <input type="radio" />
      </div>
      <div class="resilience-field"><label>Other</label><input /></div>
    `;
    await ensureLesson17RunnerDemoConfig(ctx);
    expect(ctx.delay).toHaveBeenCalled();
  });

  it('runGqlLatencyWorkflow returns immediately when session flag already set', async () => {
    const ctx = makeCtx();
    stubRunnerBridge({ applyBatchConfig: true, selectAndRun: true });
    document.body.innerHTML = `
      <div class="workflow-vars-section"></div>
      <button data-testid="workflow-runner-run-btn">Run</button>
      <div class="progress-section"></div>
      <div class="completion-section"></div>
    `;
    const { runGqlLatencyWorkflow } = await import('./lesson17-workflow-runner');
    await runGqlLatencyWorkflow(ctx);
    vi.mocked(ctx.delay).mockClear();
    await runGqlLatencyWorkflow(ctx);
    expect(vi.mocked(ctx.delay).mock.calls.length).toBe(0);
  });

  it('runGqlLatencyWorkflow retries selectAndRun when first bridge call fails', async () => {
    const ctx = makeCtx();
    clearWorkflowSeedBridge();
    let runCalls = 0;
    const win = window as unknown as Record<string, unknown>;
    win.__wfRunnerApplyBatchConfig = vi.fn(() => true);
    win.__wfRunnerSelectByName = vi.fn(() => false);
    win.__wfRunnerTriggerRun = vi.fn(() => false);
    win.__wfRunnerSelectAndRun = vi.fn(() => {
      runCalls += 1;
      return runCalls >= 2;
    });
    document.body.innerHTML = `
      <div class="workflow-vars-section"></div>
      <button data-testid="workflow-runner-run-btn">Run</button>
    `;
    const { runGqlLatencyWorkflow, resetGqlLesson17SessionFlags } = await import('./lesson17-workflow-runner');
    resetGqlLesson17SessionFlags();
    let addedCompletion = false;
    vi.mocked(ctx.delay).mockImplementation(async () => {
      if (!addedCompletion && runCalls >= 2) {
        addedCompletion = true;
        const completion = document.createElement('div');
        completion.className = 'completion-section';
        document.body.appendChild(completion);
      }
    });
    await runGqlLatencyWorkflow(ctx);
    expect(runCalls).toBeGreaterThanOrEqual(2);
  });

  it('fitLesson17ResultsExplorerDiagram skips detail toggle when label is not collapse', async () => {
    const ctx = makeCtx();
    const toggle = document.createElement('button');
    toggle.setAttribute('data-testid', 'detail-panel-toggle');
    toggle.textContent = '◀';
    const toggleClickSpy = vi.spyOn(toggle, 'click');
    document.body.innerHTML = `
      <div class="results-explorer-detail"></div>
      <div class="results-explorer-diagram"><div class="react-flow__node"></div></div>
    `;
    document.body.appendChild(toggle);
    (window as unknown as Record<string, unknown>).__reExplorerFitView = vi.fn(() => true);
    await fitLesson17ResultsExplorerDiagram(ctx);
    expect(toggleClickSpy).not.toHaveBeenCalled();
  });

  it('fitLesson17ResultsExplorerDiagram uses title fallback fit button', async () => {
    const ctx = makeCtx();
    const fitBtn = document.createElement('button');
    fitBtn.title = 'Fit view';
    const clickSpy = vi.spyOn(fitBtn, 'click');
    fitBtn.scrollIntoView = vi.fn();
    document.body.innerHTML = `
      <div class="results-explorer-diagram"><div class="react-flow__node"></div></div>
    `;
    document.querySelector('.results-explorer-diagram')!.appendChild(fitBtn);
    (window as unknown as Record<string, unknown>).__reExplorerFitView = vi.fn(() => false);
    await fitLesson17ResultsExplorerDiagram(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('selectLesson17ResultsExplorerIteration skips aggregate toggle when not aggregate', async () => {
    const ctx = makeCtx();
    const toggle = document.createElement('button');
    toggle.setAttribute('data-testid', 'iter-picker-toggle');
    const toggleClickSpy = vi.spyOn(toggle, 'click');
    document.body.innerHTML = `
      <div data-testid="iter-picker-dropdown"></div>
      <button data-testid="iter-picker-item-0">#1</button>
    `;
    document.body.appendChild(toggle);
    const item = document.querySelector<HTMLElement>(REX.iterPickerItem(0))!;
    const itemClickSpy = vi.spyOn(item, 'click');
    await selectLesson17ResultsExplorerIteration(ctx, 0);
    expect(toggleClickSpy).not.toHaveBeenCalled();
    expect(itemClickSpy).toHaveBeenCalled();
  });

  it('showLesson17ResultsExplorerConsole skips console toggle when already active', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="view-toggle-diagram" class="view-toggle-active"></button>
      <button data-testid="iter-picker-toggle" class="aggregate"></button>
      <button data-testid="console-toggle-btn-header" class="view-toggle-active"></button>
      <div data-testid="results-console-body"><div class="re-console-line">GraphQL Assert</div></div>
      <div class="results-explorer-diagram"><div class="react-flow__node"></div></div>
    `;
    const consoleBtn = document.querySelector<HTMLElement>(REX.CONSOLE_TOGGLE)!;
    const consoleClickSpy = vi.spyOn(consoleBtn, 'click');
    (window as unknown as Record<string, unknown>).__reExplorerFitView = vi.fn(() => true);
    await showLesson17ResultsExplorerConsole(ctx);
    expect(consoleClickSpy).not.toHaveBeenCalled();
  });

  it('showLesson17ResultsExplorerConsole exits when console is disabled', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="view-toggle-diagram" class="view-toggle-active"></button>
      <button data-testid="iter-picker-toggle"></button>
      <button data-testid="iter-picker-aggregate"></button>
      <button data-testid="console-toggle-btn-header"></button>
      <div data-testid="results-console-body"></div>
      <div data-testid="results-console-disabled"></div>
      <div data-testid="iter-picker-dropdown"></div>
      <button data-testid="iter-picker-item-0">#1</button>
      <div class="results-explorer-diagram"><div class="react-flow__node"></div></div>
    `;
    (window as unknown as Record<string, unknown>).__reExplorerFitView = vi.fn(() => true);
    await showLesson17ResultsExplorerConsole(ctx);
    expect(ctx.delay).toHaveBeenCalled();
  });

  it('showLesson17ResultsExplorerConsole opens aggregate picker when not aggregate', async () => {
    const ctx = makeCtx();
    const aggregateBtn = document.createElement('button');
    aggregateBtn.setAttribute('data-testid', 'iter-picker-aggregate');
    const aggregateClickSpy = vi.spyOn(aggregateBtn, 'click');
    document.body.innerHTML = `
      <button data-testid="view-toggle-diagram" class="view-toggle-active"></button>
      <button data-testid="iter-picker-toggle"></button>
      <button data-testid="console-toggle-btn-header"></button>
      <div data-testid="results-console-body"><div class="re-console-line">line</div></div>
      <div data-testid="iter-picker-dropdown"></div>
      <button data-testid="iter-picker-item-0">#1</button>
      <div class="results-explorer-diagram"><div class="react-flow__node"></div></div>
    `;
    document.body.appendChild(aggregateBtn);
    (window as unknown as Record<string, unknown>).__reExplorerFitView = vi.fn(() => true);
    await showLesson17ResultsExplorerConsole(ctx);
    expect(aggregateClickSpy).toHaveBeenCalled();
  });

  it('openLesson17ResultsExplorer no-ops when explore button missing', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `<div class="results-run-filter-tabs"></div>`;
    const { openLesson17ResultsExplorer } = await import('./lesson17-workflow-runner');
    await openLesson17ResultsExplorer(ctx);
    expect(ctx.delay).not.toHaveBeenCalledWith(800);
  });

  it('closeLesson17ResultsExplorerIfOpen ignores non-Close footer buttons', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <div class="results-explorer-footer-actions">
        <button class="cat-btn">Export</button>
      </div>
    `;
    await closeLesson17ResultsExplorerIfOpen(ctx);
    expect(ctx.delay).not.toHaveBeenCalledWith(600);
  });

  it('ensureLesson17OnResultsTab short-circuits when results already open flag set', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <div class="results-run-filter-tabs"></div>
      <div class="workflow-vars-section"></div>
    `;
    await ensureLesson17OnResultsTab(ctx);
    vi.mocked(ctx.navigateToTab).mockClear();
    await ensureLesson17OnResultsTab(ctx);
    expect(ctx.navigateToTab).not.toHaveBeenCalled();
  });

  it('ensureLesson17RunnerDemoConfig DOM fallback fills Iterations and Concurrency inputs', async () => {
    const ctx = makeCtx();
    stubRunnerBridge({ applyBatchConfig: false, selectAndRun: false });
    document.body.innerHTML = `
      <div class="workflow-vars-section"></div>
      <div class="workflow-runner-config-section">
        <label class="radio-label">Batch execution</label>
        <input type="radio" />
      </div>
      <div class="resilience-field"><label>Iterations</label><input value="10" /></div>
      <div class="resilience-field"><label>Concurrency</label><input value="5" /></div>
    `;
    const iterInput = document.querySelector<HTMLInputElement>('.resilience-field input')!;
    const concInput = document.querySelectorAll<HTMLInputElement>('.resilience-field input')[1]!;
    await ensureLesson17RunnerDemoConfig(ctx);
    expect(iterInput.value).toBe('3');
    expect(concInput.value).toBe('1');
  });

  it('ensureLesson17RunnerDemoConfig tolerates missing inline trace options section', async () => {
    const ctx = makeCtx();
    stubRunnerBridge({ applyBatchConfig: false, selectAndRun: false });
    document.body.innerHTML = `
      <div class="workflow-vars-section"></div>
      <div class="workflow-runner-config-section">
        <label class="radio-label">Batch execution</label>
        <input type="radio" />
      </div>
      <div class="resilience-field"><label>Iterations</label><input value="10" /></div>
      <div class="resilience-field"><label>Concurrency</label><input value="5" /></div>
    `;
    await ensureLesson17RunnerDemoConfig(ctx);
    expect(ctx.delay).toHaveBeenCalledWith(300);
  });

  it('runGqlLatencyWorkflow scrolls completion banner when run finishes', async () => {
    const ctx = makeCtx();
    stubRunnerBridge({ applyBatchConfig: true, selectAndRun: true });
    const completion = document.createElement('div');
    completion.className = 'completion-section';
    completion.scrollIntoView = vi.fn();
    document.body.innerHTML = `
      <div class="workflow-vars-section"></div>
      <button data-testid="workflow-runner-run-btn">Run</button>
      <div data-testid="workflow-runner-stop-btn"></div>
    `;
    const { runGqlLatencyWorkflow, resetGqlLesson17SessionFlags } = await import('./lesson17-workflow-runner');
    resetGqlLesson17SessionFlags();
    let appended = false;
    vi.mocked(ctx.delay).mockImplementation(async () => {
      if (!appended) {
        appended = true;
        document.body.appendChild(completion);
      }
    });
    await runGqlLatencyWorkflow(ctx);
    expect(completion.scrollIntoView).toHaveBeenCalled();
  });

  it('clickWorkflowRunnerRun uses text-fallback run button and scrollIntoView', async () => {
    const ctx = makeCtx();
    stubRunnerBridge({ applyBatchConfig: true, selectAndRun: true });
    const runBtn = document.createElement('button');
    runBtn.className = 'btn btn-primary';
    runBtn.textContent = 'Run Workflow';
    runBtn.scrollIntoView = vi.fn();
    document.body.innerHTML = `
      <div class="workflow-vars-section"></div>
      <div class="config-form"><div class="form-actions"></div></div>
      <div data-testid="workflow-runner-stop-btn"></div>
    `;
    document.querySelector('.form-actions')!.appendChild(runBtn);
    const { runGqlLatencyWorkflow, resetGqlLesson17SessionFlags } = await import('./lesson17-workflow-runner');
    resetGqlLesson17SessionFlags();
    let appended = false;
    vi.mocked(ctx.delay).mockImplementation(async () => {
      if (!appended) {
        appended = true;
        const completion = document.createElement('div');
        completion.className = 'completion-section';
        document.body.appendChild(completion);
      }
    });
    await runGqlLatencyWorkflow(ctx);
    expect(runBtn.scrollIntoView).toHaveBeenCalled();
  });

  it('fitLesson17ResultsExplorerDiagram uses bridge success across multiple attempts', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <div class="results-explorer-diagram"><div class="react-flow__node"></div></div>
    `;
    const fitSpy = vi.fn(() => true);
    (window as unknown as Record<string, unknown>).__reExplorerFitView = fitSpy;
    await fitLesson17ResultsExplorerDiagram(ctx);
    expect(fitSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('openAndFitLesson17ResultsExplorer opens modal then fits diagram', async () => {
    const ctx = makeCtx();
    const exploreBtn = document.createElement('button');
    exploreBtn.title = 'Explore execution results';
    const exploreClickSpy = vi.spyOn(exploreBtn, 'click');
    document.body.innerHTML = `
      <div class="results-run-filter-tabs"></div>
      <div class="results-explorer-diagram"><div class="react-flow__node"></div></div>
    `;
    document.body.appendChild(exploreBtn);
    (window as unknown as Record<string, unknown>).__reExplorerFitView = vi.fn(() => true);
    await openAndFitLesson17ResultsExplorer(ctx);
    expect(exploreClickSpy).toHaveBeenCalled();
  });

  it('openLesson17RequestDetailsTab skips click when tab already active', async () => {
    const ctx = makeCtx();
    const tab = document.createElement('button');
    tab.className = 'results-view-tab active';
    tab.textContent = 'Request Details';
    const clickSpy = vi.spyOn(tab, 'click');
    document.body.innerHTML = `
      <div class="results-run-filter-tabs"></div>
    `;
    document.body.appendChild(tab);
    const { openLesson17RequestDetailsTab } = await import('./lesson17-workflow-runner');
    await openLesson17RequestDetailsTab(ctx);
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('showLesson17ResultsExplorerConsole waits for GraphQL Query console detail', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="view-toggle-diagram"></button>
      <button data-testid="iter-picker-toggle"></button>
      <button data-testid="iter-picker-aggregate"></button>
      <button data-testid="console-toggle-btn-header"></button>
      <div data-testid="results-console-body"><div class="re-console-line">GraphQL Query</div></div>
      <div data-testid="iter-picker-dropdown"></div>
      <button data-testid="iter-picker-item-0">#1</button>
      <div class="results-explorer-diagram"><div class="react-flow__node"></div></div>
    `;
    (window as unknown as Record<string, unknown>).__reExplorerFitView = vi.fn(() => true);
    await showLesson17ResultsExplorerConsole(ctx);
    expect(ctx.delay).toHaveBeenCalledWith(1200);
  });

  it('selectLesson17ResultsExplorerIteration no-ops when picker item missing', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="iter-picker-toggle"></button>
      <div data-testid="iter-picker-dropdown"></div>
    `;
    await selectLesson17ResultsExplorerIteration(ctx, 2);
    expect(ctx.delay).not.toHaveBeenCalledWith(600);
  });

  it('ensureLesson17WorkflowSelected navigates when workflow vars section missing', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="workflow-select">Select</button>
      <div class="wfp-dropdown-panel"></div>
      <div class="wfp-dropdown-item">${LESSON17_WF_NAME}</div>
    `;
    const { ensureLesson17WorkflowSelected, resetGqlLesson17SessionFlags } = await import('./lesson17-workflow-runner');
    resetGqlLesson17SessionFlags();
    await ensureLesson17WorkflowSelected(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('workflow-runner');
  });
});
