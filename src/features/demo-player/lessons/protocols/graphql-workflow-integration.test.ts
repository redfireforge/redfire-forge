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
  });

  it('has valid lesson structure', () => {
    expect(gqlWorkflowIntegrationLesson.id).toBe('gql-workflow-integration');
    expect(gqlWorkflowIntegrationLesson.category).toBe('graphql');
    expect(gqlWorkflowIntegrationLesson.name).toBe('Workflow Integration');
    expect(gqlWorkflowIntegrationLesson.steps.length).toBe(8);
    expect(gqlWorkflowIntegrationLesson.estimatedMinutes).toBe(4);
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
      'gql11-run-pass',
      'gql11-run-fail',
    ]);
  });

  it('all 8 steps have pauseAfter: true', () => {
    gqlWorkflowIntegrationLesson.steps.forEach((step) => {
      expect(step.pauseAfter).toBe(true);
    });
  });

  it('stateful steps have preAction guards', () => {
    gqlWorkflowIntegrationLesson.steps.forEach((step) => {
      expect(step.preAction).toBeTypeOf('function');
    });
  });

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

  it('gql11-run-pass runs quick test expecting pass', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      ${buildQueryConfigDom()}
      <button class="wf-quick-test-btn"></button>
      <div data-testid="wf-run-result-pass"></div>
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
    `;
    (window as unknown as Record<string, unknown>).__wfOpenNodeConfig = vi.fn();
    (window as unknown as Record<string, unknown>).__wfConnect = vi.fn();
    (window as unknown as Record<string, unknown>).__wfQuickTest = vi.fn();
    const step = gqlWorkflowIntegrationLesson.steps.find((s) => s.id === 'gql11-run-fail')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(WF.QUICK_TEST_BTN);
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
});

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
