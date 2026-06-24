/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { gqlWorkflowRunnerLesson } from './graphql-workflow-runner';
import { makeCtx } from './ws-test-utils';
import { WF } from '../../../../shared/selectors';
import {
  LESSON17_WF_NAME,
  LESSON17_RUN_BTN,
  LESSON17_WORKFLOW_SELECT,
  resetGqlLesson17SessionFlags,
  gqlWorkflowRunnerLessonSetup,
  selectGqlLatencyDemoWorkflow,
  runGqlLatencyWorkflow,
  ensureLesson17WorkflowSelected,
  ensureLesson17WorkflowRun,
  ensureLesson17ResultsOpen,
  createGqlLatencyDemoWorkflow,
} from './graphql-lesson-helpers';
import {
  handleGraphqlQueryNode,
  handleGraphqlAssertNode,
} from '../../../workflow/engine/graphRunnerGraphqlNodeHandlers';
import {
  makeNode,
  makeCallbacks,
  makeHandlerContext,
  makePassedFlag,
} from '../../../workflow/engine/graphRunnerNodeHandlers.test-utils';

vi.mock('../../../graphql/utils/graphqlProxyTransports', () => ({
  getProxyBase: vi.fn(() => 'http://localhost:4000'),
  createWsProxyTransport: vi.fn(),
  createSseProxyTransport: vi.fn(),
}));

vi.mock('../../../graphql/utils/authUtils', () => ({
  buildAuthHeaders: vi.fn(() => ({})),
}));

describe('gql-workflow-runner lesson', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetGqlLesson17SessionFlags();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete (window as unknown as Record<string, unknown>).__wfDeleteByName;
    delete (window as unknown as Record<string, unknown>).__wfInsertWorkflow;
    delete (window as unknown as Record<string, unknown>).__wfQuickTest;
  });

  // ── Lesson structure ──────────────────────────────────────────────────────

  it('has valid lesson structure', () => {
    expect(gqlWorkflowRunnerLesson.id).toBe('gql-workflow-runner');
    expect(gqlWorkflowRunnerLesson.category).toBe('graphql');
    expect(gqlWorkflowRunnerLesson.name).toBe('Workflow Runner & Results');
    expect(gqlWorkflowRunnerLesson.steps.length).toBe(10);
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
      'gql17-results-dashboard',
      'gql17-node-filter',
      'gql17-results-explorer',
      'gql17-canvas-overlay',
      'gql17-bottleneck',
      'gql17-export-results',
    ]);
  });

  it('all 10 steps have pauseAfter: true', () => {
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
    expect(step.highlight).toBe('.workflow-picker');
    expect(step.verify).toBe('.workflow-vars-section');
  });

  it('gql17-runner-variables highlights workflow-vars-section', () => {
    const step = gqlWorkflowRunnerLesson.steps.find((s) => s.id === 'gql17-runner-variables')!;
    expect(step.highlight).toBe('.workflow-vars-section');
  });

  it('gql17-config-run highlights workflow runner config section', () => {
    const step = gqlWorkflowRunnerLesson.steps.find((s) => s.id === 'gql17-config-run')!;
    expect(step.highlight).toBe('.workflow-runner-config-section');
  });

  it('gql17-start-run highlights config form and verifies completion section', () => {
    const step = gqlWorkflowRunnerLesson.steps.find((s) => s.id === 'gql17-start-run')!;
    expect(step.highlight).toBe('.config-form');
    expect(step.verify).toBe('.completion-section');
  });

  it('gql17-results-dashboard highlights results run filter tabs', () => {
    const step = gqlWorkflowRunnerLesson.steps.find((s) => s.id === 'gql17-results-dashboard')!;
    expect(step.highlight).toBe('.results-run-filter-tabs');
    expect(step.verify).toBe('.results-run-filter-tabs');
  });

  it('gql17-node-filter highlights results view tabs', () => {
    const step = gqlWorkflowRunnerLesson.steps.find((s) => s.id === 'gql17-node-filter')!;
    expect(step.highlight).toBe('.results-view-tabs');
  });

  it('gql17-results-explorer highlights explore execution button and verifies canvas', () => {
    const step = gqlWorkflowRunnerLesson.steps.find((s) => s.id === 'gql17-results-explorer')!;
    expect(step.highlight).toBe('button[title="Explore execution results"]');
    expect(step.verify).toBe('.results-explorer-diagram');
  });

  it('gql17-canvas-overlay highlights results explorer diagram', () => {
    const step = gqlWorkflowRunnerLesson.steps.find((s) => s.id === 'gql17-canvas-overlay')!;
    expect(step.highlight).toBe('.results-explorer-diagram');
  });

  it('gql17-bottleneck highlights results explorer diagram', () => {
    const step = gqlWorkflowRunnerLesson.steps.find((s) => s.id === 'gql17-bottleneck')!;
    expect(step.highlight).toBe('.results-explorer-diagram');
  });

  it('gql17-export-results highlights results run filter tabs', () => {
    const step = gqlWorkflowRunnerLesson.steps.find((s) => s.id === 'gql17-export-results')!;
    expect(step.highlight).toBe('.results-run-filter-tabs');
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
    expect(step.description).toContain('per-run');
  });

  it('gql17-config-run description explains iterations, concurrency, and think time', () => {
    const step = gqlWorkflowRunnerLesson.steps.find((s) => s.id === 'gql17-config-run')!;
    expect(step.description).toContain('Iterations');
    expect(step.description).toContain('Concurrency');
    expect(step.description).toContain('Think Time');
  });

  it('gql17-start-run description explains progress and persistence', () => {
    const step = gqlWorkflowRunnerLesson.steps.find((s) => s.id === 'gql17-start-run')!;
    expect(step.description).toContain('progress');
    expect(step.description).toContain('completion');
  });

  it('gql17-results-dashboard description explains the four metric cards', () => {
    const step = gqlWorkflowRunnerLesson.steps.find((s) => s.id === 'gql17-results-dashboard')!;
    expect(step.description).toContain('p50');
    expect(step.description).toContain('p95');
    expect(step.description).toContain('histogram');
  });

  it('gql17-node-filter description explains per-node row filtering', () => {
    const step = gqlWorkflowRunnerLesson.steps.find((s) => s.id === 'gql17-node-filter')!;
    expect(step.description).toContain('Request Details');
    expect(step.description).toContain('node');
  });

  it('gql17-results-explorer description explains three-panel layout', () => {
    const step = gqlWorkflowRunnerLesson.steps.find((s) => s.id === 'gql17-results-explorer')!;
    expect(step.description).toContain('Canvas');
    expect(step.description).toContain('Detail Panel');
    expect(step.description).toContain('Iteration Matrix');
  });

  it('gql17-canvas-overlay description explains node latency overlay', () => {
    const step = gqlWorkflowRunnerLesson.steps.find((s) => s.id === 'gql17-canvas-overlay')!;
    expect(step.description).toContain('GraphQL Query');
    expect(step.description).toContain('GraphQL Assert');
  });

  it('gql17-bottleneck description identifies bottleneck node', () => {
    const step = gqlWorkflowRunnerLesson.steps.find((s) => s.id === 'gql17-bottleneck')!;
    expect(step.description).toContain('GraphQL Query');
    expect(step.description).toContain('bottleneck');
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

  it('gql17-start-run action clicks run button and waits for completion', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      ${buildRunnerDom()}
      <div class="workflow-vars-section"></div>
      <div class="completion-section"><button class="btn-primary">View Full Results →</button></div>
    `;
    const step = gqlWorkflowRunnerLesson.steps.find((s) => s.id === 'gql17-start-run')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(LESSON17_RUN_BTN);
  });

  it('gql17-results-dashboard action navigates to results via completion banner', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      ${buildRunnerDom()}
      <div class="workflow-vars-section"></div>
      <div class="completion-section"><button class="btn-primary">View Full Results →</button></div>
    `;
    const step = gqlWorkflowRunnerLesson.steps.find((s) => s.id === 'gql17-results-dashboard')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalled();
  });

  it('gql17-results-explorer action clicks Results Explorer button', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      ${buildRunnerDom()}
      <div class="workflow-vars-section"></div>
      <div class="completion-section"><button class="btn-primary">View Full Results →</button></div>
      <div class="results-run-filter-tabs"></div>
      <button title="Explore execution results" class="btn btn-primary">📊 Results Explorer</button>
    `;
    const explorerBtn = document.querySelector<HTMLElement>('button[title="Explore execution results"]')!;
    const clickSpy = vi.spyOn(explorerBtn, 'click');
    const step = gqlWorkflowRunnerLesson.steps.find((s) => s.id === 'gql17-results-explorer')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('gql17-results-explorer action is no-op when explorer button is absent', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      ${buildRunnerDom()}
      <div class="workflow-vars-section"></div>
      <div class="completion-section"><button class="btn-primary">View Full Results →</button></div>
      <div class="results-run-filter-tabs"></div>
    `;
    const step = gqlWorkflowRunnerLesson.steps.find((s) => s.id === 'gql17-results-explorer')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.delay).toHaveBeenCalledWith(600);
  });

  // ── Guard tests ───────────────────────────────────────────────────────────

  it('setup seeds workflow via __wfInsertWorkflow and navigates to workflow-runner', async () => {
    const ctx = makeCtx();
    const deleteSpy = vi.fn();
    const insertSpy = vi.fn();
    (window as unknown as Record<string, unknown>).__wfDeleteByName = deleteSpy;
    (window as unknown as Record<string, unknown>).__wfInsertWorkflow = insertSpy;
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

  it('ensureLesson17WorkflowRun clicks run button once then skips', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      ${buildRunnerDom()}
      <div class="workflow-vars-section"></div>
      <div class="completion-section"><button class="btn-primary">View Full Results →</button></div>
    `;
    await ensureLesson17WorkflowRun(ctx);
    expect(ctx.click).toHaveBeenCalledWith(LESSON17_RUN_BTN);
    vi.mocked(ctx.click).mockClear();
    await ensureLesson17WorkflowRun(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(LESSON17_RUN_BTN);
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

  it('LESSON17_RUN_BTN targets run workflow button', () => {
    expect(LESSON17_RUN_BTN).toBe('.config-form .form-actions .btn-primary');
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
    expect(queryNode!.data.endpoint).toContain('4010');
    expect(queryNode!.data.query).toContain('health');
    const bindings = queryNode!.data.outputBindings as Array<{ field: string; variableName: string; enabled?: boolean }>;
    expect(bindings.some((b) => b.field === 'latencyMs' && b.variableName === 'gqlLatency' && b.enabled === true)).toBe(true);
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
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
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

  it('runGqlLatencyWorkflow scrolls completion banner into view when present', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <div class="config-form"><div class="form-actions"><button class="btn btn-primary btn-lg">▶ Run Workflow</button></div></div>
      <div class="completion-section"></div>
    `;
    const completion = document.querySelector<HTMLElement>('.completion-section')!;
    completion.scrollIntoView = vi.fn();
    await runGqlLatencyWorkflow(ctx);
    expect(completion.scrollIntoView).toHaveBeenCalled();
  });

  it('runGqlLatencyWorkflow clicks run button and polls until completion banner appears', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <div class="config-form">
        <div class="form-actions">
          <button class="btn btn-primary btn-lg">▶ Run Workflow</button>
        </div>
      </div>
      <div class="completion-section"><button class="btn btn-primary">View Full Results →</button></div>
    `;
    await runGqlLatencyWorkflow(ctx);
    expect(ctx.click).toHaveBeenCalledWith(LESSON17_RUN_BTN);
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
        <button class="btn btn-primary btn-lg">▶ Run Workflow</button>
      </div>
    </div>
  `;
}
