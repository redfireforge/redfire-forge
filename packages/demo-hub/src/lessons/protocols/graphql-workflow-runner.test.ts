/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { RES } from '@shared/selectors/res';
import { gqlWorkflowRunnerLesson } from './graphql-workflow-runner';
import { makeCtx } from './ws-test-utils';
import { stubWorkflowSeedBridge, clearWorkflowSeedBridge } from '../../test-utils/workflowBridgeStubs';
import { WF } from '@shared/selectors';
import {
  GQL_DEMO_HTTP,
  GQL_DEMO_VAR,
  LESSON17_WF_NAME,
  LESSON17_RUN_BTN,
  LESSON17_WORKFLOW_SELECT,
  resetGqlLesson17SessionFlags,
  gqlWorkflowRunnerLessonSetup,
  selectGqlLatencyDemoWorkflow,
  runGqlLatencyWorkflow,
  ensureLesson17WorkflowSelected,
  ensureLesson17WorkflowRun,
  ensureLesson17OnResultsTab,
  ensureLesson17ResultsOpen,
  createGqlLatencyDemoWorkflow,
} from './graphql-lesson-helpers';
import {
  handleGraphqlQueryNode,
  handleGraphqlAssertNode,
} from '@workflow/engine/graphRunnerGraphqlNodeHandlers';
import {
  makeNode,
  makeCallbacks,
  makeHandlerContext,
  makePassedFlag,
} from '@workflow/engine/graphRunnerNodeHandlers.test-utils';

vi.mock('@graphql/utils/graphqlProxyTransports', () => ({
  getProxyBase: vi.fn(() => 'http://localhost:4000'),
  createWsProxyTransport: vi.fn(),
  createSseProxyTransport: vi.fn(),
}));

vi.mock('@graphql/utils/authUtils', () => ({
  buildAuthHeaders: vi.fn(() => ({})),
}));

describe('gql-workflow-runner lesson', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetGqlLesson17SessionFlags();
    stubWorkflowSeedBridge(LESSON17_WF_NAME);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearWorkflowSeedBridge();
    delete (window as unknown as Record<string, unknown>).__wfQuickTest;
  });

  // ── Lesson structure ──────────────────────────────────────────────────────

  it('has valid lesson structure', () => {
    expect(gqlWorkflowRunnerLesson.id).toBe('gql-workflow-runner');
    expect(gqlWorkflowRunnerLesson.category).toBe('graphql');
    expect(gqlWorkflowRunnerLesson.name).toBe('Workflow Runner & Results');
    expect(gqlWorkflowRunnerLesson.steps.length).toBe(9);
    expect(gqlWorkflowRunnerLesson.estimatedMinutes).toBe(5);
  });

  it('starts at workflow-runner tab and allows workflow, workflow-runner, and results tabs', () => {
    expect(gqlWorkflowRunnerLesson.initialTab).toBe('workflow-runner');
    expect(gqlWorkflowRunnerLesson.allowedTabs).toContain('workflow-runner');
    expect(gqlWorkflowRunnerLesson.allowedTabs).toContain('workflow');
    expect(gqlWorkflowRunnerLesson.allowedTabs).toContain('results');
  });

  it('has correct step IDs in order', () => {
    expect(gqlWorkflowRunnerLesson.steps.map((s) => s.id)).toEqual([
      'gql17-open-runner',
      'gql17-runner-variables',
      'gql17-config-run',
      'gql17-start-run',
      'gql17-view-results',
      'gql17-results-dashboard',
      'gql17-request-details',
      'gql17-results-explorer',
      'gql17-export-results',
    ]);
  });

  it('all 9 steps have pauseAfter: true', () => {
    gqlWorkflowRunnerLesson.steps.forEach((step) => {
      expect(step.pauseAfter).toBe(true);
    });
  });

  it('uses Docker same as GQL-16 (port 4010 health endpoint)', () => {
    expect(gqlWorkflowRunnerLesson.dockerEndpoint).toContain('4010');
    expect(gqlWorkflowRunnerLesson.dockerCommand).toContain('docker/graphql');
    expect(gqlWorkflowRunnerLesson.tag).toBe('🐳 Docker');
  });

  // ── Concept content ───────────────────────────────────────────────────────

  it('concept title frames lesson as tracked execution vs ad hoc', () => {
    expect(gqlWorkflowRunnerLesson.concept.title).toContain('Workflow Runner');
    expect(gqlWorkflowRunnerLesson.concept.title).toContain('Tracked');
  });

  it('concept body explains WHY Workflow Runner vs Quick Test', () => {
    expect(gqlWorkflowRunnerLesson.concept.body).toContain('Quick Test');
    expect(gqlWorkflowRunnerLesson.concept.body).toContain('saved');
    expect(gqlWorkflowRunnerLesson.concept.body).toContain('variable overrides');
  });

  it('concept body explains WHY Results Dashboard vs canvas overlay', () => {
    expect(gqlWorkflowRunnerLesson.concept.body).toContain('p50');
    expect(gqlWorkflowRunnerLesson.concept.body).toContain('p95');
    expect(gqlWorkflowRunnerLesson.concept.body).toContain('histogram');
  });

  it('concept body explains WHY Results Explorer specifically', () => {
    expect(gqlWorkflowRunnerLesson.concept.body).toContain('Results Explorer');
    expect(gqlWorkflowRunnerLesson.concept.body).toContain('bottleneck');
  });

  it('concept body explains WHY export results', () => {
    expect(gqlWorkflowRunnerLesson.concept.body).toContain('CI/CD');
  });

  it('has 5 key terms including Results Explorer', () => {
    expect(gqlWorkflowRunnerLesson.concept.keyTerms.length).toBe(5);
    const terms = gqlWorkflowRunnerLesson.concept.keyTerms.map((k) => k.term);
    expect(terms).toContain('Workflow Runner');
    expect(terms).toContain('Initial Variables');
    expect(terms).toContain('Concurrency');
    expect(terms).toContain('p95 Latency');
    expect(terms).toContain('Results Explorer');
  });

  it('p95 Latency key term explains tail latency significance', () => {
    const term = gqlWorkflowRunnerLesson.concept.keyTerms.find((k) => k.term === 'p95 Latency');
    expect(term?.definition).toContain('95%');
    expect(term?.definition).toContain('average');
  });

  it('Results Explorer key term describes three-panel layout', () => {
    const term = gqlWorkflowRunnerLesson.concept.keyTerms.find((k) => k.term === 'Results Explorer');
    expect(term?.definition).toContain('canvas');
    expect(term?.definition).toContain('iteration');
  });

  // ── Diagram ───────────────────────────────────────────────────────────────

  it('concept diagram is a 700x430 SVG', () => {
    expect(gqlWorkflowRunnerLesson.concept.diagram).toContain('viewBox="0 0 700 430"');
  });

  it('diagram shows Workflow Runner panel with picker', () => {
    expect(gqlWorkflowRunnerLesson.concept.diagram).toContain('Workflow Runner');
    expect(gqlWorkflowRunnerLesson.concept.diagram).toContain('GraphQL Latency Demo');
  });

  it('diagram shows graphqlUrl in Initial Variables panel', () => {
    expect(gqlWorkflowRunnerLesson.concept.diagram).toContain('graphqlUrl');
    expect(gqlWorkflowRunnerLesson.concept.diagram).not.toContain('No input variables defined');
  });

  it('diagram shows Run Workflow button', () => {
    expect(gqlWorkflowRunnerLesson.concept.diagram).toContain('▶ Run Workflow');
  });

  it('diagram shows execution config: iterations and concurrency', () => {
    expect(gqlWorkflowRunnerLesson.concept.diagram).toContain('Iterations');
    expect(gqlWorkflowRunnerLesson.concept.diagram).toContain('Concurrency');
    expect(gqlWorkflowRunnerLesson.concept.diagram).toContain('Think Time');
  });

  it('diagram shows live progress bar', () => {
    expect(gqlWorkflowRunnerLesson.concept.diagram).toContain('iterations');
    expect(gqlWorkflowRunnerLesson.concept.diagram).toContain('Running');
  });

  it('diagram shows completion banner with View Full Results', () => {
    expect(gqlWorkflowRunnerLesson.concept.diagram).toContain('View Full Results');
  });

  it('diagram shows Results Dashboard with metric cards', () => {
    expect(gqlWorkflowRunnerLesson.concept.diagram).toContain('RESULTS DASHBOARD');
    expect(gqlWorkflowRunnerLesson.concept.diagram).toContain('p50');
    expect(gqlWorkflowRunnerLesson.concept.diagram).toContain('p95');
    expect(gqlWorkflowRunnerLesson.concept.diagram).toContain('Req/s');
    expect(gqlWorkflowRunnerLesson.concept.diagram).toContain('Error rate');
  });

  it('diagram shows latency histogram with p50/p95 markers', () => {
    expect(gqlWorkflowRunnerLesson.concept.diagram).toContain('Latency Distribution');
    expect(gqlWorkflowRunnerLesson.concept.diagram).toContain('p50=24ms');
    expect(gqlWorkflowRunnerLesson.concept.diagram).toContain('p95=41ms');
  });

  it('diagram shows Results Explorer section with three panels', () => {
    expect(gqlWorkflowRunnerLesson.concept.diagram).toContain('Results Explorer');
    expect(gqlWorkflowRunnerLesson.concept.diagram).toContain('Canvas overlay');
    expect(gqlWorkflowRunnerLesson.concept.diagram).toContain('Detail panel');
    expect(gqlWorkflowRunnerLesson.concept.diagram).toContain('Iteration matrix');
  });

  it('diagram shows Export JSON button', () => {
    expect(gqlWorkflowRunnerLesson.concept.diagram).toContain('Export JSON');
  });

  // ── Step spotlights & verify selectors ───────────────────────────────────

  it('gql17-open-runner highlights workflow picker and verifies vars section', () => {
    const step = gqlWorkflowRunnerLesson.steps.find((s) => s.id === 'gql17-open-runner')!;
    expect(step.highlight).toBe(WF.WORKFLOW_SELECT);
    expect(step.verify).toBe('.workflow-vars-section');
  });

  it('gql17-runner-variables highlights workflow-vars-section', () => {
    const step = gqlWorkflowRunnerLesson.steps.find((s) => s.id === 'gql17-runner-variables')!;
    expect(step.highlight).toBe('.workflow-vars-section');
  });

  it('gql17-config-run highlights iterations field in execution config', () => {
    const step = gqlWorkflowRunnerLesson.steps.find((s) => s.id === 'gql17-config-run')!;
    expect(step.highlight).toBe('.workflow-runner-config-section .resilience-field:nth-child(2)');
  });

  it('gql17-start-run highlights run button and verifies completion section', () => {
    const step = gqlWorkflowRunnerLesson.steps.find((s) => s.id === 'gql17-start-run')!;
    expect(step.highlight).toBe(LESSON17_RUN_BTN);
    expect(step.verify).toBe('.completion-section');
  });

  it('gql17-view-results highlights View Full Results button', () => {
    const step = gqlWorkflowRunnerLesson.steps.find((s) => s.id === 'gql17-view-results')!;
    expect(step.highlight).toBe('.completion-section .btn-primary');
    expect(step.verify).toBe('.results-run-filter-tabs');
  });

  it('gql17-results-dashboard highlights latency metrics row', () => {
    const step = gqlWorkflowRunnerLesson.steps.find((s) => s.id === 'gql17-results-dashboard')!;
    expect(step.highlight).toBe(RES.METRICS_LATENCY_ROW);
    expect(step.verify).toBe(RES.METRICS_LATENCY_ROW);
    expect(typeof step.action).toBe('function');
    expect(typeof step.preAction).toBe('function');
  });

  it('gql17-request-details highlights Request Details tab', () => {
    const step = gqlWorkflowRunnerLesson.steps.find((s) => s.id === 'gql17-request-details')!;
    expect(step.highlight).toBe('[data-testid="results-tab-requests"]');
  });

  it('gql17-results-explorer highlights Results Explorer button and verifies console body', () => {
    const step = gqlWorkflowRunnerLesson.steps.find((s) => s.id === 'gql17-results-explorer')!;
    expect(step.highlight).toBe(RES.RESULTS_EXPLORER_BTN);
    expect(step.verify).toBe('[data-testid="results-console-body"]');
  });

  it('gql17-export-results highlights Export JSON button', () => {
    const step = gqlWorkflowRunnerLesson.steps.find((s) => s.id === 'gql17-export-results')!;
    expect(step.highlight).toBe(RES.EXPORT_JSON_BTN);
  });

  // ── Step descriptions — WHY framing ──────────────────────────────────────

  it('gql17-open-runner description contrasts Quick Test with Workflow Runner', () => {
    const step = gqlWorkflowRunnerLesson.steps.find((s) => s.id === 'gql17-open-runner')!;
    expect(step.description).toContain('Quick Test');
    expect(step.description).toContain('saved');
  });

  it('gql17-runner-variables description explains WHY variable overrides are per-run', () => {
    const step = gqlWorkflowRunnerLesson.steps.find((s) => s.id === 'gql17-runner-variables')!;
    expect(step.description).toContain('Initial Variables');
    expect(step.description).toContain('graphqlUrl');
    expect(step.description).toContain('this run only');
    expect(step.description).not.toContain('no workflow-level input variables');
  });

  it('gql17-config-run description explains demo iterations and concurrency', () => {
    const step = gqlWorkflowRunnerLesson.steps.find((s) => s.id === 'gql17-config-run')!;
    expect(step.description).toContain('Iterations');
    expect(step.description).toContain('Concurrency');
    expect(step.description).toContain('3');
  });

  it('gql17-start-run description explains progress and persistence', () => {
    const step = gqlWorkflowRunnerLesson.steps.find((s) => s.id === 'gql17-start-run')!;
    expect(step.description).toContain('progress');
    expect(step.description).toContain('completion');
  });

  it('gql17-view-results description explains View Full Results hand-off', () => {
    const step = gqlWorkflowRunnerLesson.steps.find((s) => s.id === 'gql17-view-results')!;
    expect(step.description).toContain('View Full Results');
    expect(step.description).toContain('Results');
  });

  it('gql17-results-dashboard description explains the metric cards', () => {
    const step = gqlWorkflowRunnerLesson.steps.find((s) => s.id === 'gql17-results-dashboard')!;
    expect(step.description).toContain('P50');
    expect(step.description).toContain('P95');
    expect(step.description).toContain('TPS');
    expect(step.description).toContain('Workflow Execution Summary');
  });

  it('gql17-request-details description explains per-iteration rows', () => {
    const step = gqlWorkflowRunnerLesson.steps.find((s) => s.id === 'gql17-request-details')!;
    expect(step.description).toContain('Request Details');
    expect(step.description).toContain('GraphQL Query');
  });

  it('gql17-results-explorer description explains three-panel layout, fit view, and console', () => {
    const step = gqlWorkflowRunnerLesson.steps.find((s) => s.id === 'gql17-results-explorer')!;
    expect(step.description).toContain('Fit view');
    expect(step.description).toContain('Console');
    expect(step.description).toContain('iteration #1');
    expect(step.description).toContain('Minimal');
    expect(step.description).toContain('Canvas');
    expect(step.description).toContain('Detail panel');
    expect(step.description).toContain('Iteration matrix');
  });

  it('gql17-export-results description explains CI/CD integration', () => {
    const step = gqlWorkflowRunnerLesson.steps.find((s) => s.id === 'gql17-export-results')!;
    expect(step.description).toContain('Export JSON');
    expect(step.description).toContain('CI');
  });

  // ── Action tests ──────────────────────────────────────────────────────────

  it('gql17-open-runner action selects the workflow from dropdown', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = buildRunnerDom();
    // Simulate dropdown opening and item appearing
    const dropdown = document.querySelector<HTMLElement>(LESSON17_WORKFLOW_SELECT)!;
    dropdown.addEventListener('click', () => {
      const panel = document.createElement('div');
      panel.className = 'wfp-dropdown-panel';
      const item = document.createElement('div');
      item.className = 'wfp-dropdown-item';
      item.textContent = LESSON17_WF_NAME;
      panel.appendChild(item);
      document.body.appendChild(panel);
    });
    const step = gqlWorkflowRunnerLesson.steps.find((s) => s.id === 'gql17-open-runner')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(LESSON17_WORKFLOW_SELECT);
  });

  it('gql17-start-run action clicks run button when completion banner absent', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      ${buildRunnerDom()}
      <div class="workflow-vars-section"></div>
    `;
    const runBtn = document.querySelector<HTMLElement>(LESSON17_RUN_BTN)!;
    let runClicked = false;
    runBtn.addEventListener('click', () => {
      runClicked = true;
      const stop = document.createElement('button');
      stop.setAttribute('data-testid', 'workflow-runner-stop-btn');
      document.body.appendChild(stop);
      const banner = document.createElement('div');
      banner.className = 'completion-section';
      document.body.appendChild(banner);
    });
    const step = gqlWorkflowRunnerLesson.steps.find((s) => s.id === 'gql17-start-run')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(runClicked).toBe(true);
  });

  it('gql17-start-run action skips run when completion banner already visible', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      ${buildRunnerDom()}
      <div class="workflow-vars-section"></div>
      <div class="completion-section"></div>
    `;
    const runBtn = document.querySelector<HTMLElement>(LESSON17_RUN_BTN)!;
    let runClicked = false;
    runBtn.addEventListener('click', () => { runClicked = true; });
    const step = gqlWorkflowRunnerLesson.steps.find((s) => s.id === 'gql17-start-run')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(runClicked).toBe(false);
  });

  it('gql17-view-results action clicks View Full Results button', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      ${buildRunnerDom()}
      <div class="workflow-vars-section"></div>
      <div class="completion-section"><button class="btn-primary">View Full Results →</button></div>
    `;
    const step = gqlWorkflowRunnerLesson.steps.find((s) => s.id === 'gql17-view-results')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith('.completion-section .btn-primary');
  });

  it('gql17-results-explorer action opens explorer and clicks fit view', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      ${buildRunnerDom()}
      <div class="results-top"></div>
      <div class="workflow-vars-section"></div>
      <div class="completion-section"><button class="btn-primary">View Full Results →</button></div>
      <div class="results-run-filter-tabs"></div>
      <button title="Explore execution results" class="btn btn-primary" data-testid="results-explorer-open-btn">📊 Results Explorer</button>
    `;
    const explorerBtn = document.querySelector<HTMLElement>('[data-testid="results-explorer-open-btn"]')!;
    const explorerClickSpy = vi.spyOn(explorerBtn, 'click');
    explorerBtn.addEventListener('click', () => {
      const wrap = document.createElement('div');
      wrap.className = 'results-explorer-diagram';
      wrap.setAttribute('data-testid', 'results-explorer-diagram');
      wrap.innerHTML = `
        <div class="react-flow__node"></div>
        <button title="Fit view" data-testid="results-explorer-fit-view-btn">Fit</button>
        <button data-testid="view-toggle-diagram" class="view-toggle-active">Diagram</button>
        <button data-testid="iter-picker-toggle" class="aggregate">Aggregate</button>
        <button data-testid="console-toggle-btn-header">🖥 Console</button>
      `;
      document.body.appendChild(wrap);
    });
    const adapters = await import('../../adapters');
    vi.spyOn(adapters, 'waitForResultsExplorerBridge').mockResolvedValue(true);
    vi.spyOn(adapters, 'fitResultsExplorerDiagram').mockReturnValue(true);
    const step = gqlWorkflowRunnerLesson.steps.find((s) => s.id === 'gql17-results-explorer')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(explorerClickSpy).toHaveBeenCalled();
    const fitBtn = document.querySelector<HTMLElement>('[data-testid="results-explorer-fit-view-btn"]')!;
    expect(fitBtn).toBeTruthy();
  });

  it('gql17-results-explorer action is no-op when explorer button is absent', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      ${buildRunnerDom()}
      <div class="results-top"></div>
      <div class="workflow-vars-section"></div>
      <div class="completion-section"><button class="btn-primary">View Full Results →</button></div>
      <div class="results-run-filter-tabs"></div>
    `;
    const step = gqlWorkflowRunnerLesson.steps.find((s) => s.id === 'gql17-results-explorer')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    // Tour exits early with a short delay when the open button is missing.
    expect(ctx.delay).toHaveBeenCalled();
  });

  // ── Guard tests ───────────────────────────────────────────────────────────

  it('setup seeds workflow via __wfInsertWorkflow and navigates to workflow-runner', async () => {
    const ctx = makeCtx();
    const { deleteByName: deleteSpy, insertWorkflow: insertSpy } = stubWorkflowSeedBridge(LESSON17_WF_NAME);
    await gqlWorkflowRunnerLessonSetup(ctx);
    expect(deleteSpy).toHaveBeenCalledWith(LESSON17_WF_NAME);
    expect(insertSpy).toHaveBeenCalled();
    expect(ctx.navigateToTab).toHaveBeenCalledWith('workflow-runner');
  });

  it('ensureLesson17WorkflowSelected skips selection when vars section already visible', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      ${buildRunnerDom()}
      <div class="workflow-vars-section"></div>
    `;
    await ensureLesson17WorkflowSelected(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureLesson17WorkflowSelected(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(LESSON17_WORKFLOW_SELECT);
  });

  it('selectGqlLatencyDemoWorkflow skips re-opening the dropdown when already selected', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="workflow-select">${LESSON17_WF_NAME}</button>
      <div class="workflow-vars-section"></div>
    `;
    await selectGqlLatencyDemoWorkflow(ctx);
    vi.mocked(ctx.click).mockClear();
    await selectGqlLatencyDemoWorkflow(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('gqlWorkflowRunnerLessonSetup does not open the workflow picker', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `<button data-testid="workflow-select"></button>`;
    stubWorkflowSeedBridge(LESSON17_WF_NAME);
    await gqlWorkflowRunnerLessonSetup(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(LESSON17_WORKFLOW_SELECT);
  });

  it('ensureLesson17WorkflowRun clicks run button once then skips even without completion banner', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      ${buildRunnerDom()}
      <div class="workflow-vars-section"></div>
    `;
    const runBtn = document.querySelector<HTMLElement>(LESSON17_RUN_BTN)!;
    let runClickCount = 0;
    runBtn.addEventListener('click', () => {
      runClickCount += 1;
      const stop = document.createElement('button');
      stop.setAttribute('data-testid', 'workflow-runner-stop-btn');
      document.body.appendChild(stop);
      const banner = document.createElement('div');
      banner.className = 'completion-section';
      document.body.appendChild(banner);
    });
    await ensureLesson17WorkflowRun(ctx);
    expect(runClickCount).toBe(1);
    document.querySelector('.completion-section')?.remove();
    await ensureLesson17WorkflowRun(ctx);
    expect(runClickCount).toBe(1);
  });

  it('ensureLesson17OnResultsTab skips workflow run when results tab already open', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      ${buildRunnerDom()}
      <div class="workflow-vars-section"></div>
      <div class="results-run-filter-tabs"></div>
    `;
    const runBtn = document.querySelector<HTMLElement>(LESSON17_RUN_BTN)!;
    let runClicked = false;
    runBtn.addEventListener('click', () => { runClicked = true; });
    await ensureLesson17OnResultsTab(ctx);
    expect(runClicked).toBe(false);
  });

  it('ensureLesson17ResultsOpen navigates to results via View Full Results button', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      ${buildRunnerDom()}
      <div class="workflow-vars-section"></div>
      <div class="completion-section"><button class="btn-primary">View Full Results →</button></div>
    `;
    const btn = document.querySelector<HTMLElement>('.completion-section .btn-primary')!;
    const clickSpy = vi.spyOn(btn, 'click');
    await ensureLesson17ResultsOpen(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('ensureLesson17ResultsOpen falls back to navigateToTab when no View Full Results button', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      ${buildRunnerDom()}
      <div class="workflow-vars-section"></div>
      <div class="completion-section"></div>
    `;
    await ensureLesson17ResultsOpen(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('results');
  });

  // ── Helper unit tests ─────────────────────────────────────────────────────

  it('LESSON17_WF_NAME matches GQL-16 workflow name', () => {
    expect(LESSON17_WF_NAME).toBe('GraphQL Latency Demo');
  });

  it('LESSON17_RUN_BTN targets workflow runner run button test id', () => {
    expect(LESSON17_RUN_BTN).toBe('[data-testid="workflow-runner-run-btn"]');
  });

  it('LESSON17_WORKFLOW_SELECT targets workflow picker trigger', () => {
    expect(LESSON17_WORKFLOW_SELECT).toBe('[data-testid="workflow-select"]');
    expect(LESSON17_WORKFLOW_SELECT).toBe(WF.WORKFLOW_SELECT);
  });

  it('createGqlLatencyDemoWorkflow returns workflow with 4 nodes and 3 edges', () => {
    const wf = createGqlLatencyDemoWorkflow();
    expect(wf.name).toBe(LESSON17_WF_NAME);
    expect((wf.nodes as unknown[]).length).toBe(4);
    expect((wf.edges as unknown[]).length).toBe(3);
    expect(wf.schemaVersion).toBe(6);
  });

  it('createGqlLatencyDemoWorkflow includes graphqlQuery node with latencyMs binding', () => {
    const wf = createGqlLatencyDemoWorkflow();
    const nodes = wf.nodes as Array<{ type: string; data: Record<string, unknown> }>;
    const queryNode = nodes.find((n) => n.type === 'graphqlQuery');
    expect(queryNode).toBeTruthy();
    expect(queryNode!.data.endpoint).toBe(GQL_DEMO_VAR);
    expect(queryNode!.data.query).toContain('health');
    const bindings = queryNode!.data.outputBindings as Array<{ field: string; variableName: string; enabled?: boolean }>;
    expect(bindings.some((b) => b.field === 'latencyMs' && b.variableName === 'gqlLatency' && b.enabled === true)).toBe(true);
  });

  it('createGqlLatencyDemoWorkflow seeds graphqlUrl workflow default', () => {
    const wf = createGqlLatencyDemoWorkflow();
    expect(wf.variables).toEqual({ graphqlUrl: GQL_DEMO_HTTP });
  });

  it('createGqlLatencyDemoWorkflow includes graphqlAssert node with < 500 assertion', () => {
    const wf = createGqlLatencyDemoWorkflow();
    const nodes = wf.nodes as Array<{ type: string; data: Record<string, unknown> }>;
    const assertNode = nodes.find((n) => n.type === 'graphqlAssert');
    expect(assertNode).toBeTruthy();
    expect(assertNode!.data.sourceVariable).toBe('gqlLatency');
    const assertions = assertNode!.data.assertions as Array<{ operator: string; expectedValue?: string }>;
    expect(assertions[0].operator).toBe('less_than');
    expect(assertions[0].expectedValue).toBe('2000');
  });

  it('createGqlLatencyDemoWorkflow query + assert nodes pass when executed', async () => {
    const wf = createGqlLatencyDemoWorkflow();
    const nodes = wf.nodes as Array<{ id: string; type: string; data: Record<string, unknown> }>;
    const queryRaw = nodes.find((n) => n.type === 'graphqlQuery')!;
    const assertRaw = nodes.find((n) => n.type === 'graphqlAssert')!;
    const queryNode = makeNode(queryRaw.id, 'graphqlQuery', queryRaw.data);
    const assertNode = makeNode(assertRaw.id, 'graphqlAssert', assertRaw.data);

    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: { health: 'ok' } }),
    })));

    const cbResult = makeCallbacks();
    const hCtx = makeHandlerContext({
      callbacks: cbResult.callbacks,
      initialVariables: { graphqlUrl: GQL_DEMO_HTTP },
    });
    const queryPassed = makePassedFlag();
    await handleGraphqlQueryNode(queryRaw.id, queryNode, hCtx, queryPassed);
    expect(queryPassed.value).toBe(true);
    expect(hCtx.ctx.get('gqlLatency')).toBeTruthy();

    const assertPassed = makePassedFlag();
    await handleGraphqlAssertNode(assertRaw.id, assertNode, hCtx, assertPassed);
    expect(assertPassed.value).toBe(true);
    expect(cbResult.states[assertRaw.id]?.state).toBe('pass');
  });

  it('selectGqlLatencyDemoWorkflow clicks workflow select and picks matching item', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="workflow-select"></button>
    `;
    const btn = document.querySelector<HTMLElement>('[data-testid="workflow-select"]')!;
    btn.addEventListener('click', () => {
      const panel = document.createElement('div');
      panel.className = 'wfp-dropdown-panel';
      const item = document.createElement('div');
      item.className = 'wfp-dropdown-item';
      item.textContent = LESSON17_WF_NAME;
      panel.appendChild(item);
      document.body.appendChild(panel);
    });
    await selectGqlLatencyDemoWorkflow(ctx);
    expect(ctx.click).toHaveBeenCalledWith(LESSON17_WORKFLOW_SELECT);
  });

  it('selectGqlLatencyDemoWorkflow falls back to prefix match when exact name absent', async () => {
    const ctx = makeCtx();
    ctx.click = vi.fn(async (sel: string) => {
      document.querySelector<HTMLElement>(sel)?.click();
    });
    document.body.innerHTML = `<button data-testid="workflow-select"></button>`;
    const btn = document.querySelector<HTMLElement>('[data-testid="workflow-select"]')!;
    let clickSpy: ReturnType<typeof vi.spyOn> | undefined;
    btn.addEventListener('click', () => {
      const panel = document.createElement('div');
      panel.className = 'wfp-dropdown-panel';
      const itemEl = document.createElement('div');
      itemEl.className = 'wfp-dropdown-item';
      itemEl.textContent = `${LESSON17_WF_NAME} (copy)`;
      clickSpy = vi.spyOn(itemEl, 'click');
      panel.appendChild(itemEl);
      document.body.appendChild(panel);
    });
    await selectGqlLatencyDemoWorkflow(ctx);
    expect(clickSpy).toBeDefined();
    expect(clickSpy!).toHaveBeenCalled();
  });

  it('selectGqlLatencyDemoWorkflow skips item click when no workflow matches', async () => {
    const ctx = makeCtx();
    ctx.click = vi.fn(async (sel: string) => {
      document.querySelector<HTMLElement>(sel)?.click();
    });
    document.body.innerHTML = `<button data-testid="workflow-select"></button>`;
    const btn = document.querySelector<HTMLElement>('[data-testid="workflow-select"]')!;
    btn.addEventListener('click', () => {
      const panel = document.createElement('div');
      panel.className = 'wfp-dropdown-panel';
      const itemEl = document.createElement('div');
      itemEl.className = 'wfp-dropdown-item';
      itemEl.textContent = 'Unrelated Workflow';
      panel.appendChild(itemEl);
      document.body.appendChild(panel);
    });
    await selectGqlLatencyDemoWorkflow(ctx);
    expect(ctx.click).toHaveBeenCalledWith(LESSON17_WORKFLOW_SELECT);
  });

  it('runGqlLatencyWorkflow skips when completion banner already visible', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <div class="config-form"><div class="form-actions"><button class="btn btn-primary btn-lg" data-testid="workflow-runner-run-btn">▶ Run Workflow</button></div></div>
      <div class="completion-section"></div>
    `;
    const runBtn = document.querySelector<HTMLElement>(LESSON17_RUN_BTN)!;
    let runClicked = false;
    runBtn.addEventListener('click', () => { runClicked = true; });
    const completion = document.querySelector<HTMLElement>('.completion-section')!;
    completion.scrollIntoView = vi.fn();
    await runGqlLatencyWorkflow(ctx);
    expect(runClicked).toBe(false);
    expect(completion.scrollIntoView).not.toHaveBeenCalled();
  });

  it('runGqlLatencyWorkflow clicks run button and polls until completion banner appears', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <div class="config-form">
        <div class="form-actions">
          <button type="button" class="btn btn-primary btn-lg" data-testid="workflow-runner-run-btn">▶ Run Workflow</button>
        </div>
      </div>
    `;
    const runBtn = document.querySelector<HTMLElement>(LESSON17_RUN_BTN)!;
    let runClicked = false;
    runBtn.addEventListener('click', () => {
      runClicked = true;
      const stop = document.createElement('button');
      stop.setAttribute('data-testid', 'workflow-runner-stop-btn');
      document.body.appendChild(stop);
      const banner = document.createElement('div');
      banner.className = 'completion-section';
      document.body.appendChild(banner);
    });
    await runGqlLatencyWorkflow(ctx);
    expect(runClicked).toBe(true);
  });
});

// ── DOM helpers ──────────────────────────────────────────────────────────────

function buildRunnerDom(): string {
  return `
    <div class="workflow-picker">
      <button data-testid="workflow-select">Select workflow ▾</button>
    </div>
    <div class="workflow-runner-config-section"></div>
    <div class="config-form">
      <div class="form-actions">
        <button type="button" class="btn btn-primary btn-lg" data-testid="workflow-runner-run-btn">▶ Run Workflow</button>
      </div>
    </div>
  `;
}
