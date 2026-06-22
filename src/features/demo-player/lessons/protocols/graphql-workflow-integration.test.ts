/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { gqlWorkflowIntegrationLesson } from './graphql-workflow-integration';
import { makeCtx } from './ws-test-utils';
import { GQL, WF } from '../../../../shared/selectors';
import {
  LESSON11_LATENCY_VAR,
  LESSON11_WF_NAME,
  resetGqlLesson11SessionFlags,
  gqlWorkflowIntegrationLessonSetup,
  ensureLesson11QueryNodeAdded,
  ensureLesson11QueryConfigured,
  ensureLesson11AssertNodeAdded,
  ensureLesson11AssertRuleConfigured,
  ensureLesson11WorkflowPassRun,
  ensureLesson11WorkflowCreated,
  ensureLesson11ConsoleOpen,
  ensureLesson11DebugRun,
  GQL_DEMO_HTTP,
} from './graphql-lesson-helpers';

describe('gql-workflow-integration lesson', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetGqlLesson11SessionFlags();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete (window as unknown as Record<string, unknown>).__wfConnect;
    delete (window as unknown as Record<string, unknown>).__wfOpenNodeConfig;
    delete (window as unknown as Record<string, unknown>).__wfDeleteByName;
    delete (window as unknown as Record<string, unknown>).__wfQuickTest;
  });

  // ── Lesson structure ──────────────────────────────────────────────────────

  it('has valid lesson structure', () => {
    expect(gqlWorkflowIntegrationLesson.id).toBe('gql-workflow-integration');
    expect(gqlWorkflowIntegrationLesson.category).toBe('graphql');
    expect(gqlWorkflowIntegrationLesson.name).toBe('Workflow Integration');
    expect(gqlWorkflowIntegrationLesson.steps.length).toBe(10);
    expect(gqlWorkflowIntegrationLesson.estimatedMinutes).toBe(5);
  });

  it('allows workflow and workflow-runner tabs', () => {
    expect(gqlWorkflowIntegrationLesson.allowedTabs).toContain('workflow');
    expect(gqlWorkflowIntegrationLesson.allowedTabs).toContain('workflow-runner');
    expect(gqlWorkflowIntegrationLesson.initialTab).toBe('workflow');
  });

  it('has correct step IDs in order', () => {
    expect(gqlWorkflowIntegrationLesson.steps.map((s) => s.id)).toEqual([
      'gql11-create',
      'gql11-query-node',
      'gql11-config-query',
      'gql11-assert-node',
      'gql11-assert-source',
      'gql11-assert-rule',
      'gql11-console',
      'gql11-run-pass',
      'gql11-run-fail',
      'gql11-debug-mode',
    ]);
  });

  it('all 10 steps have pauseAfter: true', () => {
    gqlWorkflowIntegrationLesson.steps.forEach((step) => {
      expect(step.pauseAfter).toBe(true);
    });
  });

  it('stateful steps have preAction guards', () => {
    gqlWorkflowIntegrationLesson.steps.forEach((step) => {
      expect(step.preAction).toBeTypeOf('function');
    });
  });

  // ── Concept content ───────────────────────────────────────────────────────

  it('concept title frames lesson as automation path', () => {
    expect(gqlWorkflowIntegrationLesson.concept.title).toContain('Workflow Integration');
    expect(gqlWorkflowIntegrationLesson.concept.title).toContain('Automated Test');
  });

  it('concept body explains WHY GraphQL Query node vs generic HTTP', () => {
    expect(gqlWorkflowIntegrationLesson.concept.body).toContain('generic HTTP node');
    expect(gqlWorkflowIntegrationLesson.concept.body).toContain('latencyMs');
  });

  it('concept body explains WHY Output binding matters', () => {
    expect(gqlWorkflowIntegrationLesson.concept.body).toContain('Output binding');
    expect(gqlWorkflowIntegrationLesson.concept.body).toContain('isolated island');
  });

  it('concept body explains WHY GraphQL Assert is better than generic Assert', () => {
    expect(gqlWorkflowIntegrationLesson.concept.body).toContain('GraphQL Assert');
    expect(gqlWorkflowIntegrationLesson.concept.body).toContain('triage');
  });

  it('concept body explains WHY Debug Mode exists', () => {
    expect(gqlWorkflowIntegrationLesson.concept.body).toContain('Debug Mode');
    expect(gqlWorkflowIntegrationLesson.concept.body).toContain('step by step');
  });

  it('has 5 key terms including Debug Mode', () => {
    expect(gqlWorkflowIntegrationLesson.concept.keyTerms.length).toBe(5);
    const terms = gqlWorkflowIntegrationLesson.concept.keyTerms.map((k) => k.term);
    expect(terms).toContain('Output binding');
    expect(terms).toContain('Source variable');
    expect(terms).toContain('Quick Test');
    expect(terms).toContain('less_than');
    expect(terms).toContain('Debug Mode');
  });

  it('Debug Mode key term explains step-by-step execution', () => {
    const debugTerm = gqlWorkflowIntegrationLesson.concept.keyTerms.find(
      (k) => k.term === 'Debug Mode',
    );
    expect(debugTerm?.definition).toContain('Step-by-step');
    expect(debugTerm?.definition).toContain('variable');
  });

  // ── Diagram ───────────────────────────────────────────────────────────────

  it('concept diagram is a 700x430 SVG', () => {
    expect(gqlWorkflowIntegrationLesson.concept.diagram).toContain('viewBox="0 0 700 430"');
  });

  it('diagram shows Workflow Designer chrome with toolbar', () => {
    expect(gqlWorkflowIntegrationLesson.concept.diagram).toContain('Workflow Designer');
    expect(gqlWorkflowIntegrationLesson.concept.diagram).toContain('Quick Test');
    expect(gqlWorkflowIntegrationLesson.concept.diagram).toContain('Debug');
  });

  it('diagram shows 4-node workflow wired in sequence', () => {
    expect(gqlWorkflowIntegrationLesson.concept.diagram).toContain('Start');
    expect(gqlWorkflowIntegrationLesson.concept.diagram).toContain('GraphQL Query');
    expect(gqlWorkflowIntegrationLesson.concept.diagram).toContain('GraphQL Assert');
    expect(gqlWorkflowIntegrationLesson.concept.diagram).toContain('End');
  });

  it('diagram shows green pass + red fail node state overlay', () => {
    expect(gqlWorkflowIntegrationLesson.concept.diagram).toContain('#22c55e');
    expect(gqlWorkflowIntegrationLesson.concept.diagram).toContain('#ef4444');
    expect(gqlWorkflowIntegrationLesson.concept.diagram).toContain('✓ 28ms');
    expect(gqlWorkflowIntegrationLesson.concept.diagram).toContain('✗ FAIL');
  });

  it('diagram shows output binding annotation', () => {
    expect(gqlWorkflowIntegrationLesson.concept.diagram).toContain('latencyMs → gqlLatency');
  });

  it('diagram shows Console panel at bottom', () => {
    expect(gqlWorkflowIntegrationLesson.concept.diagram).toContain('Console');
    expect(gqlWorkflowIntegrationLesson.concept.diagram).toContain('Console ●');
  });

  it('diagram shows palette with GraphQL Query and Assert blocks', () => {
    expect(gqlWorkflowIntegrationLesson.concept.diagram).toContain('ACTIONS');
    expect(gqlWorkflowIntegrationLesson.concept.diagram).toContain('LOGIC');
  });

  // ── Step spotlights & verify selectors ───────────────────────────────────

  it('gql11-create highlights sidebar new btn', () => {
    const step = gqlWorkflowIntegrationLesson.steps.find((s) => s.id === 'gql11-create')!;
    expect(step.highlight).toBe(WF.SIDEBAR_NEW_BTN);
    expect(step.verify).toBe(WF.CANVAS);
  });

  it('gql11-query-node highlights GQL Query palette item', () => {
    const step = gqlWorkflowIntegrationLesson.steps.find((s) => s.id === 'gql11-query-node')!;
    expect(step.highlight).toBe(WF.PAL_GQL_QUERY);
    expect(step.verify).toBe(GQL.WF_CANVAS_QUERY_NODE);
  });

  it('gql11-config-query highlights query panel', () => {
    const step = gqlWorkflowIntegrationLesson.steps.find((s) => s.id === 'gql11-config-query')!;
    expect(step.highlight).toBe(GQL.WF_QUERY_PANEL);
    expect(step.verify).toBe(GQL.WF_CANVAS_QUERY_NODE);
  });

  it('gql11-assert-node highlights GQL Assert palette item', () => {
    const step = gqlWorkflowIntegrationLesson.steps.find((s) => s.id === 'gql11-assert-node')!;
    expect(step.highlight).toBe(WF.PAL_GQL_ASSERT);
    expect(step.verify).toBe(GQL.WF_CANVAS_ASSERT_NODE);
  });

  it('gql11-assert-source highlights assert panel', () => {
    const step = gqlWorkflowIntegrationLesson.steps.find((s) => s.id === 'gql11-assert-source')!;
    expect(step.highlight).toBe(GQL.WF_ASSERT_PANEL);
    expect(step.verify).toBe(GQL.WF_CANVAS_ASSERT_NODE);
  });

  it('gql11-assert-rule highlights assert row', () => {
    const step = gqlWorkflowIntegrationLesson.steps.find((s) => s.id === 'gql11-assert-rule')!;
    expect(step.highlight).toBe(GQL.WF_ASSERT_ROW);
    expect(step.verify).toBe(GQL.WF_CANVAS_ASSERT_NODE);
  });

  it('gql11-console highlights console badge and verifies console panel', () => {
    const step = gqlWorkflowIntegrationLesson.steps.find((s) => s.id === 'gql11-console')!;
    expect(step.highlight).toBe(WF.CONSOLE_BADGE);
    expect(step.verify).toBe(WF.CONSOLE);
  });

  it('gql11-run-pass highlights quick test btn and verifies exec summary', () => {
    const step = gqlWorkflowIntegrationLesson.steps.find((s) => s.id === 'gql11-run-pass')!;
    expect(step.highlight).toBe(WF.QUICK_TEST_BTN);
    expect(step.verify).toBe(WF.EXEC_SUMMARY);
  });

  it('gql11-run-fail highlights assert node and verifies assert node', () => {
    const step = gqlWorkflowIntegrationLesson.steps.find((s) => s.id === 'gql11-run-fail')!;
    expect(step.highlight).toBe(GQL.WF_CANVAS_ASSERT_NODE);
    expect(step.verify).toBe(GQL.WF_CANVAS_ASSERT_NODE);
  });

  it('gql11-debug-mode highlights debug btn and verifies canvas', () => {
    const step = gqlWorkflowIntegrationLesson.steps.find((s) => s.id === 'gql11-debug-mode')!;
    expect(step.highlight).toBe(WF.DEBUG_BTN);
    expect(step.verify).toBe(WF.CANVAS);
  });

  // ── Step descriptions — WHY framing ──────────────────────────────────────

  it('gql11-create description explains palette structure', () => {
    const step = gqlWorkflowIntegrationLesson.steps.find((s) => s.id === 'gql11-create')!;
    expect(step.description).toContain('Blocks Palette');
    expect(step.description).toContain('Actions');
  });

  it('gql11-query-node description explains WHY dedicated node over HTTP node', () => {
    const step = gqlWorkflowIntegrationLesson.steps.find((s) => s.id === 'gql11-query-node')!;
    expect(step.description).toContain('generic HTTP node');
    expect(step.description).toContain('latencyMs');
  });

  it('gql11-config-query description explains WHY Output binding is the superpower', () => {
    const step = gqlWorkflowIntegrationLesson.steps.find((s) => s.id === 'gql11-config-query')!;
    expect(step.description).toContain('Output');
    expect(step.description).toContain('isolated island');
  });

  it('gql11-assert-node description explains WHY GraphQL Assert vs generic', () => {
    const step = gqlWorkflowIntegrationLesson.steps.find((s) => s.id === 'gql11-assert-node')!;
    expect(step.description).toContain('GraphQL Assert');
    expect(step.description).toContain('triage');
  });

  it('gql11-assert-source description explains WHY source variable is live', () => {
    const step = gqlWorkflowIntegrationLesson.steps.find((s) => s.id === 'gql11-assert-source')!;
    expect(step.description).toContain('Source variable');
    expect(step.description).toContain('live runtime');
  });

  it('gql11-assert-rule description explains JSONPath $ and 500ms threshold reasoning', () => {
    const step = gqlWorkflowIntegrationLesson.steps.find((s) => s.id === 'gql11-assert-rule')!;
    expect(step.description).toContain('less_than');
    expect(step.description).toContain('500');
  });

  it('gql11-console description explains WHY console must be opened before run', () => {
    const step = gqlWorkflowIntegrationLesson.steps.find((s) => s.id === 'gql11-console')!;
    expect(step.description).toContain('before');
    expect(step.description).toContain('Console');
  });

  it('gql11-run-pass description explains what green nodes mean', () => {
    const step = gqlWorkflowIntegrationLesson.steps.find((s) => s.id === 'gql11-run-pass')!;
    expect(step.description).toContain('green');
    expect(step.description).toContain('500ms');
  });

  it('gql11-run-fail description explains Console failure detail', () => {
    const step = gqlWorkflowIntegrationLesson.steps.find((s) => s.id === 'gql11-run-fail')!;
    expect(step.description).toContain('red');
    expect(step.description).toContain('Console');
  });

  it('gql11-debug-mode description explains WHY Debug Mode is used for diagnosis', () => {
    const step = gqlWorkflowIntegrationLesson.steps.find((s) => s.id === 'gql11-debug-mode')!;
    expect(step.description).toContain('Debug');
    expect(step.description).toContain('node by node');
  });

  // ── Action tests ──────────────────────────────────────────────────────────

  it('gql11-create creates blank workflow', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button title="New workflow"></button>
      <div class="wf-new-dropdown-item"></div>
      <input class="req-confirm-input" />
      <button class="req-confirm-ok"></button>
      <div class="wf-canvas-area"></div>
    `;
    const step = gqlWorkflowIntegrationLesson.steps.find((s) => s.id === 'gql11-create')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('workflow');
    expect(ctx.fill).toHaveBeenCalledWith(WF.CREATE_INPUT, LESSON11_WF_NAME);
  });

  it('gql11-query-node adds palette block and connects start', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <div class="wf-canvas-area"></div>
      <button class="wf-palette-block-graphqlQuery"></button>
      <div class="react-flow__node-start" data-id="start1"></div>
      <div class="react-flow__node-graphqlQuery" data-id="q1">
        <div data-testid="gql-canvas-query-node"></div>
      </div>
      <button title="New workflow"></button>
      <div class="wf-new-dropdown-item"></div>
      <input class="req-confirm-input" />
      <button class="req-confirm-ok"></button>
    `;
    (window as unknown as Record<string, unknown>).__wfConnect = vi.fn();
    const step = gqlWorkflowIntegrationLesson.steps.find((s) => s.id === 'gql11-query-node')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(WF.PAL_GQL_QUERY);
  });

  it('gql11-config-query fills endpoint and output binding', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = buildQueryConfigDom();
    (window as unknown as Record<string, unknown>).__wfOpenNodeConfig = vi.fn();
    (window as unknown as Record<string, unknown>).__wfConnect = vi.fn();
    await ensureLesson11QueryNodeAdded(ctx);
    await ensureLesson11QueryConfigured(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(WF.WF_GQL_ENDPOINT, expect.stringContaining('4010'));
    expect(ctx.fill).toHaveBeenCalledWith(GQL.WF_QUERY_EDITOR, expect.stringContaining('health'));
    expect(ctx.fill).toHaveBeenCalledWith(GQL.WF_OUTPUT_VARNAME, LESSON11_LATENCY_VAR);
  });

  it('gql11-config-query action fills endpoint and output binding', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = buildQueryConfigDom();
    (window as unknown as Record<string, unknown>).__wfOpenNodeConfig = vi.fn();
    (window as unknown as Record<string, unknown>).__wfConnect = vi.fn();
    const step = gqlWorkflowIntegrationLesson.steps.find((s) => s.id === 'gql11-config-query')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(WF.WF_GQL_ENDPOINT, expect.stringContaining('4010'));
  });

  it('gql11-assert-node adds assert block from palette', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      ${buildQueryConfigDom()}
      <button class="wf-palette-block-graphqlAssert"></button>
      <div class="react-flow__node-graphqlAssert" data-id="a1">
        <div data-testid="gql-canvas-assert-node"></div>
      </div>
    `;
    (window as unknown as Record<string, unknown>).__wfConnect = vi.fn();
    const step = gqlWorkflowIntegrationLesson.steps.find((s) => s.id === 'gql11-assert-node')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(WF.PAL_GQL_ASSERT);
  });

  it('gql11-assert-source configures assert source variable', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      ${buildQueryConfigDom()}
      <button class="wf-palette-block-graphqlAssert"></button>
      <div class="react-flow__node-graphqlAssert" data-id="a1">
        <div data-testid="gql-canvas-assert-node"></div>
      </div>
      <div class="wf-config-modal">
        <div data-testid="gql-wf-assert-panel">
          <button class="wf-config-tab">Source</button>
          <input data-testid="gql-wf-assert-source-var" />
        </div>
        <div class="wf-config-modal-footer-actions"><button class="btn-primary"></button></div>
      </div>
    `;
    (window as unknown as Record<string, unknown>).__wfOpenNodeConfig = vi.fn();
    (window as unknown as Record<string, unknown>).__wfConnect = vi.fn();
    const step = gqlWorkflowIntegrationLesson.steps.find((s) => s.id === 'gql11-assert-source')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(WF.WF_GQL_ASSERT_SOURCE, LESSON11_LATENCY_VAR);
  });

  it('gql11-assert-rule adds less_than assertion', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      ${buildQueryConfigDom()}
      <div class="react-flow__node-graphqlAssert" data-id="a1">
        <div data-testid="gql-canvas-assert-node"></div>
      </div>
      <div class="wf-config-modal">
        <div data-testid="gql-wf-assert-panel">
          <button class="wf-config-tab">Assertions</button>
          <button data-testid="gql-wf-assert-add-btn"></button>
          <div data-testid="gql-wf-assert-row">
            <input data-testid="gql-wf-assert-jsonpath" />
            <select data-testid="gql-wf-assert-operator"><option value="less_than">&lt;</option></select>
            <input data-testid="gql-wf-assert-expected" />
          </div>
        </div>
        <div class="wf-config-modal-footer-actions"><button class="btn-primary"></button></div>
      </div>
    `;
    (window as unknown as Record<string, unknown>).__wfOpenNodeConfig = vi.fn();
    (window as unknown as Record<string, unknown>).__wfConnect = vi.fn();
    const step = gqlWorkflowIntegrationLesson.steps.find((s) => s.id === 'gql11-assert-rule')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.WF_ASSERT_EXPECTED, '500');
  });

  it('gql11-console action opens console panel via badge click', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      ${buildFullAssertDom()}
      <div class="wf-console-badge"></div>
    `;
    (window as unknown as Record<string, unknown>).__wfOpenNodeConfig = vi.fn();
    (window as unknown as Record<string, unknown>).__wfConnect = vi.fn();
    // Simulate badge click adding the panel to DOM
    const badge = document.querySelector<HTMLElement>('.wf-console-badge')!;
    badge.addEventListener('click', () => {
      const panel = document.createElement('div');
      panel.className = 'wf-console-panel';
      document.body.appendChild(panel);
    });
    const step = gqlWorkflowIntegrationLesson.steps.find((s) => s.id === 'gql11-console')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(document.querySelector('.wf-console-panel')).toBeTruthy();
  });

  it('gql11-console skips badge click when panel already open', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      ${buildFullAssertDom()}
      <div class="wf-console-badge"></div>
      <div class="wf-console-panel"></div>
    `;
    (window as unknown as Record<string, unknown>).__wfOpenNodeConfig = vi.fn();
    (window as unknown as Record<string, unknown>).__wfConnect = vi.fn();
    const badgeClickSpy = vi.fn();
    document.querySelector<HTMLElement>('.wf-console-badge')!.addEventListener('click', badgeClickSpy);
    await ensureLesson11ConsoleOpen(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureLesson11ConsoleOpen(ctx);
    expect(badgeClickSpy).not.toHaveBeenCalled();
  });

  it('gql11-run-pass runs quick test expecting pass', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      ${buildQueryConfigDom()}
      <button class="wf-quick-test-btn"></button>
      <div data-testid="wf-run-result-pass"></div>
      <div class="wf-console-badge"></div>
      <div class="wf-console-panel"></div>
    `;
    (window as unknown as Record<string, unknown>).__wfOpenNodeConfig = vi.fn();
    (window as unknown as Record<string, unknown>).__wfConnect = vi.fn();
    (window as unknown as Record<string, unknown>).__wfQuickTest = vi.fn();
    const step = gqlWorkflowIntegrationLesson.steps.find((s) => s.id === 'gql11-run-pass')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(WF.QUICK_TEST_BTN);
  });

  it('gql11-run-fail runs quick test with tightened threshold', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      ${buildQueryConfigDom()}
      <button class="wf-quick-test-btn"></button>
      <div data-testid="wf-run-result-fail"></div>
      <div class="wf-console-badge"></div>
      <div class="wf-console-panel"></div>
    `;
    (window as unknown as Record<string, unknown>).__wfOpenNodeConfig = vi.fn();
    (window as unknown as Record<string, unknown>).__wfConnect = vi.fn();
    (window as unknown as Record<string, unknown>).__wfQuickTest = vi.fn();
    const step = gqlWorkflowIntegrationLesson.steps.find((s) => s.id === 'gql11-run-fail')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(WF.QUICK_TEST_BTN);
  });

  it('gql11-debug-mode action clicks debug button', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      ${buildQueryConfigDom()}
      <div class="react-flow__node-graphqlAssert wf-node-fail" data-id="a1">
        <div data-testid="gql-canvas-assert-node"></div>
      </div>
      <button class="wf-quick-test-btn"></button>
      <button title="Run workflow step-by-step"></button>
      <div data-testid="wf-exec-summary"></div>
      <div class="wf-console-badge"></div>
      <div class="wf-console-panel"></div>
    `;
    (window as unknown as Record<string, unknown>).__wfOpenNodeConfig = vi.fn();
    (window as unknown as Record<string, unknown>).__wfConnect = vi.fn();
    (window as unknown as Record<string, unknown>).__wfQuickTest = vi.fn();
    const step = gqlWorkflowIntegrationLesson.steps.find((s) => s.id === 'gql11-debug-mode')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(WF.DEBUG_BTN);
  });

  // ── Guard tests ───────────────────────────────────────────────────────────

  it('ensureLesson11WorkflowCreated guard skips when canvas exists', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button title="New workflow"></button>
      <div class="wf-new-dropdown-item"></div>
      <div class="wf-canvas-area"></div>
    `;
    await ensureLesson11WorkflowCreated(ctx);
    vi.mocked(ctx.fill).mockClear();
    await ensureLesson11WorkflowCreated(ctx);
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('setup deletes stale workflow when bridge available', async () => {
    const ctx = makeCtx();
    const deleteSpy = vi.fn();
    (window as unknown as Record<string, unknown>).__wfDeleteByName = deleteSpy;
    await gqlWorkflowIntegrationLessonSetup(ctx);
    expect(deleteSpy).toHaveBeenCalledWith(LESSON11_WF_NAME);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('workflow');
  });

  it('ensureLesson11QueryNodeAdded guard skips when query node exists', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = buildQueryConfigDom();
    await ensureLesson11WorkflowCreated(ctx);
    await ensureLesson11QueryNodeAdded(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureLesson11QueryNodeAdded(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(WF.PAL_GQL_QUERY);
  });

  it('openWfNodeConfig falls back to dblclick when bridge missing', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <div class="react-flow__node-graphqlQuery" data-id="q1">
        <div data-testid="gql-canvas-query-node"></div>
      </div>
    `;
    const node = document.querySelector<HTMLElement>(GQL.WF_CANVAS_QUERY_NODE)!;
    const dblSpy = vi.spyOn(node, 'dispatchEvent');
    await ensureLesson11QueryConfigured(ctx);
    expect(dblSpy).toHaveBeenCalled();
  });

  it('connectWfNodes returns false when nodes missing', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = buildQueryConfigDom().replace('data-id="q1"', '');
    delete (window as unknown as Record<string, unknown>).__wfConnect;
    await ensureLesson11QueryNodeAdded(ctx);
    expect(document.querySelector(GQL.WF_CANVAS_QUERY_NODE)).toBeTruthy();
  });

  it('ensureLesson11QueryConfigured guard skips when already configured', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = buildQueryConfigDom();
    (window as unknown as Record<string, unknown>).__wfOpenNodeConfig = vi.fn();
    (window as unknown as Record<string, unknown>).__wfConnect = vi.fn();
    await ensureLesson11QueryConfigured(ctx);
    vi.mocked(ctx.fill).mockClear();
    await ensureLesson11QueryConfigured(ctx);
    expect(ctx.fill).not.toHaveBeenCalledWith(WF.WF_GQL_ENDPOINT, GQL_DEMO_HTTP);
  });

  it('ensureLesson11AssertRuleConfigured resets pass/fail flags for non-500 threshold', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      ${buildQueryConfigDom()}
      <div class="react-flow__node-graphqlAssert" data-id="a1">
        <div data-testid="gql-canvas-assert-node"></div>
      </div>
      <div class="wf-config-modal">
        <div data-testid="gql-wf-assert-panel">
          <button class="wf-config-tab">Assertions</button>
          <button data-testid="gql-wf-assert-add-btn"></button>
          <div data-testid="gql-wf-assert-row">
            <input data-testid="gql-wf-assert-jsonpath" />
            <select data-testid="gql-wf-assert-operator"><option value="less_than">&lt;</option></select>
            <input data-testid="gql-wf-assert-expected" />
            <input data-testid="gql-wf-assert-description" />
          </div>
        </div>
        <div class="wf-config-modal-footer-actions"><button class="btn-primary"></button></div>
      </div>
    `;
    (window as unknown as Record<string, unknown>).__wfOpenNodeConfig = vi.fn();
    (window as unknown as Record<string, unknown>).__wfConnect = vi.fn();
    await ensureLesson11AssertRuleConfigured(ctx, '1');
    expect(ctx.fill).toHaveBeenCalledWith(GQL.WF_ASSERT_EXPECTED, '1');
  });

  it('dismissWorkflowOnboarding clicks skip when tooltip visible', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button title="New workflow"></button>
      <div class="wf-new-dropdown-item"></div>
      <div class="wf-canvas-area"></div>
      <button class="onboarding-tooltip-skip"></button>
    `;
    const skipBtn = document.querySelector<HTMLElement>('.onboarding-tooltip-skip')!;
    const clickSpy = vi.spyOn(skipBtn, 'click');
    await ensureLesson11WorkflowCreated(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('ensureLesson11WorkflowPassRun guard skips when query node already passed', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      ${buildQueryConfigDom()}
      <button class="wf-palette-block-graphqlAssert"></button>
      <div class="react-flow__node-graphqlAssert wf-node-pass" data-id="a1">
        <div data-testid="gql-canvas-assert-node"></div>
      </div>
      <div class="react-flow__node-graphqlQuery" data-id="q1">
        <div data-testid="gql-canvas-query-node" class="wf-node-pass"></div>
      </div>
      <div class="wf-config-modal">
        <div data-testid="gql-wf-assert-panel">
          <button class="wf-config-tab">Source</button>
          <button class="wf-config-tab">Assertions</button>
          <div data-testid="gql-wf-assert-row">
            <input data-testid="gql-wf-assert-jsonpath" />
            <select data-testid="gql-wf-assert-operator"><option value="less_than">&lt;</option></select>
            <input data-testid="gql-wf-assert-expected" />
            <input data-testid="gql-wf-assert-description" />
          </div>
        </div>
        <div class="wf-config-modal-footer-actions"><button class="btn-primary"></button></div>
      </div>
      <button title="Fit view"></button>
      <button class="wf-toolbar-save-wrap"><button></button></button>
      <button data-testid="wf-quick-test-btn"></button>
      <div data-testid="wf-exec-summary"></div>
    `;
    (window as unknown as Record<string, unknown>).__wfOpenNodeConfig = vi.fn();
    (window as unknown as Record<string, unknown>).__wfConnect = vi.fn();
    await ensureLesson11WorkflowPassRun(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureLesson11WorkflowPassRun(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(WF.QUICK_TEST_BTN);
  });

  it('ensureLesson11AssertNodeAdded guard skips when assert node already added', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      ${buildQueryConfigDom()}
      <div class="react-flow__node-graphqlAssert" data-id="a1">
        <div data-testid="gql-canvas-assert-node"></div>
      </div>
    `;
    (window as unknown as Record<string, unknown>).__wfOpenNodeConfig = vi.fn();
    (window as unknown as Record<string, unknown>).__wfConnect = vi.fn();
    await ensureLesson11AssertNodeAdded(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureLesson11AssertNodeAdded(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(WF.PAL_GQL_ASSERT);
  });

  it('ensureLesson11AssertRuleConfigured guard skips when threshold unchanged', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      ${buildQueryConfigDom()}
      <div class="react-flow__node-graphqlAssert" data-id="a1">
        <div data-testid="gql-canvas-assert-node"></div>
      </div>
      <div class="wf-config-modal">
        <div data-testid="gql-wf-assert-panel">
          <button class="wf-config-tab">Source</button>
          <button class="wf-config-tab">Assertions</button>
          <div data-testid="gql-wf-assert-row">
            <input data-testid="gql-wf-assert-jsonpath" />
            <select data-testid="gql-wf-assert-operator"><option value="less_than">&lt;</option></select>
            <input data-testid="gql-wf-assert-expected" />
            <input data-testid="gql-wf-assert-description" />
          </div>
        </div>
        <div class="wf-config-modal-footer-actions"><button class="btn-primary"></button></div>
      </div>
    `;
    (window as unknown as Record<string, unknown>).__wfOpenNodeConfig = vi.fn();
    (window as unknown as Record<string, unknown>).__wfConnect = vi.fn();
    await ensureLesson11AssertRuleConfigured(ctx, '500');
    vi.mocked(ctx.fill).mockClear();
    await ensureLesson11AssertRuleConfigured(ctx, '500');
    expect(ctx.fill).not.toHaveBeenCalledWith(GQL.WF_ASSERT_EXPECTED, '500');
  });

  it('ensureLesson11QueryConfigured skips add output when row already exists', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = buildQueryConfigDom().replace(
      '<button data-testid="gql-wf-output-add-btn"></button>',
      '<select data-testid="gql-wf-output-field-select"><option value="latencyMs">latencyMs</option></select>',
    );
    (window as unknown as Record<string, unknown>).__wfOpenNodeConfig = vi.fn();
    (window as unknown as Record<string, unknown>).__wfConnect = vi.fn();
    await ensureLesson11QueryConfigured(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.WF_OUTPUT_ADD_BTN);
  });

  it('ensureLesson11DebugRun guard skips when already run', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      ${buildQueryConfigDom()}
      <div class="react-flow__node-graphqlAssert wf-node-fail" data-id="a1">
        <div data-testid="gql-canvas-assert-node"></div>
      </div>
      <button class="wf-quick-test-btn"></button>
      <button title="Run workflow step-by-step"></button>
      <div data-testid="wf-exec-summary"></div>
      <div class="wf-console-badge"></div>
      <div class="wf-console-panel"></div>
    `;
    (window as unknown as Record<string, unknown>).__wfOpenNodeConfig = vi.fn();
    (window as unknown as Record<string, unknown>).__wfConnect = vi.fn();
    (window as unknown as Record<string, unknown>).__wfQuickTest = vi.fn();
    await ensureLesson11DebugRun(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureLesson11DebugRun(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(WF.DEBUG_BTN);
  });
});

// ── DOM helpers ──────────────────────────────────────────────────────────────

function buildQueryConfigDom(): string {
  return `
    <div class="wf-canvas-area"></div>
    <button class="wf-palette-block-graphqlQuery"></button>
    <div class="react-flow__node-start" data-id="start1"></div>
    <div class="react-flow__node-graphqlQuery" data-id="q1">
      <div data-testid="gql-canvas-query-node"></div>
    </div>
    <button title="New workflow"></button>
    <div class="wf-new-dropdown-item"></div>
    <input class="req-confirm-input" />
    <button class="req-confirm-ok"></button>
    <div class="wf-config-modal">
      <div data-testid="gql-wf-query-panel">
        <button class="wf-config-tab">Operation</button>
        <button class="wf-config-tab">Output</button>
        <div class="wf-config-field--row"><div class="expr-input-wrapper"><input /></div></div>
        <textarea data-testid="gql-wf-query-editor"></textarea>
        <div data-testid="gql-wf-output-table">
          <button data-testid="gql-wf-output-add-btn"></button>
          <select data-testid="gql-wf-output-field-select"><option value="latencyMs">latencyMs</option></select>
          <input data-testid="gql-wf-output-varname" />
        </div>
      </div>
      <div class="wf-config-modal-footer-actions"><button class="btn-primary"></button></div>
    </div>
  `;
}

function buildFullAssertDom(): string {
  return `
    ${buildQueryConfigDom()}
    <div class="react-flow__node-graphqlAssert" data-id="a1">
      <div data-testid="gql-canvas-assert-node"></div>
    </div>
    <div class="wf-config-modal">
      <div data-testid="gql-wf-assert-panel">
        <button class="wf-config-tab">Source</button>
        <button class="wf-config-tab">Assertions</button>
        <input data-testid="gql-wf-assert-source-var" />
        <button data-testid="gql-wf-assert-add-btn"></button>
        <div data-testid="gql-wf-assert-row">
          <input data-testid="gql-wf-assert-jsonpath" />
          <select data-testid="gql-wf-assert-operator"><option value="less_than">&lt;</option></select>
          <input data-testid="gql-wf-assert-expected" />
          <input data-testid="gql-wf-assert-description" />
        </div>
      </div>
      <div class="wf-config-modal-footer-actions">
        <button class="btn-primary"></button>
        <button class="btn-ghost"></button>
      </div>
    </div>
    <button class="wf-quick-test-btn"></button>
    <button title="Fit view"></button>
    <button class="wf-toolbar-save-wrap"><button></button></button>
    <div data-testid="wf-exec-summary"></div>
  `;
}
