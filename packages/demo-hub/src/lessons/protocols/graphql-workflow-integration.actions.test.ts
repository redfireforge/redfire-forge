/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';



import {
  setupGraphqlWorkflowIntegrationBeforeEach,
  teardownGraphqlWorkflowIntegrationAfterEach,
  mockLesson11WorkflowBridge,
  buildQueryConfigDom,
  buildFullAssertDom,
} from './graphql-workflow-integration.testHelpers';
import { gqlWorkflowIntegrationLesson } from './graphql-workflow-integration';
import { makeCtx } from './ws-test-utils';
import { GQL, WF } from '@shared/selectors';
import {
  GQL_DEMO_HTTP,
  GQL_DEMO_VAR,
  LESSON11_LATENCY_VAR,
  LESSON11_WF_NAME,
  gqlWorkflowIntegrationLessonSetup,
  ensureLesson11QueryNodeAdded,
  ensureLesson11QueryConfigured,
  ensureLesson11AssertNodeAdded,
  ensureLesson11AssertRuleConfigured,
  ensureLesson11WorkflowPassRun,
  ensureLesson11WorkflowCreated,
  ensureLesson11WorkflowVariablesConfigured,
  ensureLesson11ConsoleOpen,
  ensureLesson11DebugRun,
} from './graphql-lesson-helpers';

describe('gql-workflow-integration lesson — actions', () => {
  beforeEach(() => {
    setupGraphqlWorkflowIntegrationBeforeEach();
  });
  afterEach(async () => {
    await teardownGraphqlWorkflowIntegrationAfterEach();
  });

// ── Action tests ──────────────────────────────────────────────────────────

  it('gql11-create creates blank workflow', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="wf-sidebar-new-btn" title="New workflow"></button>
      <div class="wf-new-dropdown"></div>
      <button data-testid="wf-new-blank-item" class="wf-new-dropdown-item"></button>
      <input data-testid="wf-create-input" class="req-confirm-input" />
      <button data-testid="wf-create-ok" class="req-confirm-ok"></button>
      <div class="wf-canvas-area"></div>
    `;
    const step = gqlWorkflowIntegrationLesson.steps.find((s) => s.id === 'gql11-create')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('workflow');
    expect(ctx.fill).toHaveBeenCalledWith(WF.CREATE_INPUT, LESSON11_WF_NAME);
  });

  it('gql11-workflow-variables opens modal and saves graphqlUrl', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <div class="wf-canvas-area"></div>
      <button data-testid="wf-toolbar-variables-btn"></button>
      <div class="wf-config-modal wf-defaults-modal">
        <div class="wf-config-vars">
          <div class="wf-config-kv-row-vars">
            <input class="wf-var-key-input" placeholder="name" />
            <div class="wf-var-new-row-value"><input class="wf-var-value-input" placeholder="value" /></div>
            <button type="button">+</button>
          </div>
        </div>
        <button class="btn-ghost">Cancel</button>
        <button class="btn-primary">Save</button>
      </div>
      <button data-testid="wf-sidebar-new-btn" title="New workflow"></button>
      <div class="wf-new-dropdown"></div>
      <button data-testid="wf-new-blank-item" class="wf-new-dropdown-item"></button>
      <input data-testid="wf-create-input" class="req-confirm-input" />
      <button data-testid="wf-create-ok" class="req-confirm-ok"></button>
    `;
    const step = gqlWorkflowIntegrationLesson.steps.find((s) => s.id === 'gql11-workflow-variables')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(WF.VARIABLES_BTN);
    expect(ctx.fill).toHaveBeenCalledWith(WF.DEFAULTS_NEW_KEY, 'graphqlUrl');
    expect(ctx.fill).toHaveBeenCalledWith(WF.DEFAULTS_NEW_VAL, GQL_DEMO_HTTP);
    expect(ctx.click).toHaveBeenCalledWith(WF.DEFAULTS_SAVE_BTN);
  });

  it('gql11-query-node searches Graph, clicks Query, then clears palette search', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <div class="wf-canvas-area"></div>
      <input class="wf-palette-search" />
      <button class="wf-palette-block-graphqlQuery"></button>
      <div class="react-flow__node-start" data-id="start1"></div>
      <div class="react-flow__node-graphqlQuery" data-id="q1">
        <div data-testid="gql-canvas-query-node"></div>
      </div>
      <button data-testid="wf-sidebar-new-btn" title="New workflow"></button>
      <div class="wf-new-dropdown"></div>
      <button data-testid="wf-new-blank-item" class="wf-new-dropdown-item"></button>
      <input data-testid="wf-create-input" class="req-confirm-input" />
      <button data-testid="wf-create-ok" class="req-confirm-ok"></button>
    `;
    (window as unknown as Record<string, unknown>).__wfConnect = vi.fn();
    const step = gqlWorkflowIntegrationLesson.steps.find((s) => s.id === 'gql11-query-node')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(WF.PAL_GQL_QUERY);
    // Search cleared so Action blocks do not keep purple match highlights.
    expect(document.querySelector<HTMLInputElement>(WF.PAL_SEARCH)?.value).toBe('');
  });

  it('gql11-config-query fills endpoint and output binding', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = buildQueryConfigDom();
    (window as unknown as Record<string, unknown>).__wfOpenNodeConfig = vi.fn();
    (window as unknown as Record<string, unknown>).__wfConnect = vi.fn();
    (window as unknown as Record<string, unknown>).__wfPatchWorkflowByName = vi.fn(() => true);
    await ensureLesson11QueryNodeAdded(ctx);
    await ensureLesson11QueryConfigured(ctx);
    // fillWfConfigField uses fillControlledInput for inputs/textareas (not ctx.fill).
    expect(document.querySelector<HTMLInputElement>(GQL.WF_ENDPOINT_INPUT)?.value).toBe(GQL_DEMO_VAR);
    expect(document.querySelector<HTMLTextAreaElement>(GQL.WF_QUERY_EDITOR)?.value).toContain('health');
    expect(document.querySelector<HTMLInputElement>(GQL.WF_OUTPUT_VARNAME)?.value).toBe(LESSON11_LATENCY_VAR);
  });

  it('gql11-config-query action fills endpoint and output binding', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = buildQueryConfigDom();
    (window as unknown as Record<string, unknown>).__wfOpenNodeConfig = vi.fn();
    (window as unknown as Record<string, unknown>).__wfConnect = vi.fn();
    (window as unknown as Record<string, unknown>).__wfPatchWorkflowByName = vi.fn(() => true);
    const step = gqlWorkflowIntegrationLesson.steps.find((s) => s.id === 'gql11-config-query')!;
    await step.preAction!(ctx);
    expect(document.querySelector(GQL.WF_QUERY_PANEL)).toBeTruthy();
    await step.action!(ctx);
    expect(document.querySelector<HTMLInputElement>(GQL.WF_ENDPOINT_INPUT)?.value).toBe(GQL_DEMO_VAR);
  });

  it('gql11-assert-node searches Assert then clicks Assert, clearing match noise', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      ${buildQueryConfigDom()}
      <input class="wf-palette-search" />
      <button class="wf-palette-block-graphqlAssert"></button>
      <div class="react-flow__node-graphqlAssert" data-id="a1">
        <div data-testid="gql-canvas-assert-node"></div>
      </div>
    `;
    (window as unknown as Record<string, unknown>).__wfConnect = vi.fn();
    (window as unknown as Record<string, unknown>).__wfPatchWorkflowByName = vi.fn(() => true);
    (window as unknown as Record<string, unknown>).__wfPatchNodeDataByType = vi.fn(() => true);
    const step = gqlWorkflowIntegrationLesson.steps.find((s) => s.id === 'gql11-assert-node')!;
    await step.preAction!(ctx);
    expect(document.querySelector<HTMLInputElement>(WF.PAL_SEARCH)?.value).toBe('Assert');
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(WF.PAL_GQL_ASSERT);
    expect(document.querySelector<HTMLInputElement>(WF.PAL_SEARCH)?.value).toBe('');
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
          <button type="button" class="gql-wf-subtab"><span>Source</span></button>
          <input data-testid="gql-wf-assert-source-var" />
        </div>
        <div class="wf-config-modal-footer-actions"><button class="btn-ghost">Close</button><button class="btn-primary">Save</button></div>
      </div>
    `;
    (window as unknown as Record<string, unknown>).__wfOpenNodeConfig = vi.fn();
    (window as unknown as Record<string, unknown>).__wfConnect = vi.fn();
    (window as unknown as Record<string, unknown>).__wfPatchWorkflowByName = vi.fn(() => true);
    (window as unknown as Record<string, unknown>).__wfPatchNodeDataByType = vi.fn(() => true);
    const step = gqlWorkflowIntegrationLesson.steps.find((s) => s.id === 'gql11-assert-source')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(document.querySelector<HTMLInputElement>(WF.WF_GQL_ASSERT_SOURCE)?.value).toBe(LESSON11_LATENCY_VAR);
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
          <button type="button" class="gql-wf-subtab"><span>Assertions</span></button>
          <button data-testid="gql-wf-assert-add-btn"></button>
          <div data-testid="gql-wf-assert-row">
            <input data-testid="gql-wf-assert-jsonpath" />
            <select data-testid="gql-wf-assert-operator"><option value="less_than">&lt;</option></select>
            <input data-testid="gql-wf-assert-expected" />
          </div>
        </div>
        <div class="wf-config-modal-footer-actions"><button class="btn-ghost">Close</button><button class="btn-primary">Save</button></div>
      </div>
    `;
    (window as unknown as Record<string, unknown>).__wfOpenNodeConfig = vi.fn();
    (window as unknown as Record<string, unknown>).__wfConnect = vi.fn();
    (window as unknown as Record<string, unknown>).__wfPatchWorkflowByName = vi.fn(() => true);
    (window as unknown as Record<string, unknown>).__wfPatchNodeDataByType = vi.fn(() => true);
    const step = gqlWorkflowIntegrationLesson.steps.find((s) => s.id === 'gql11-assert-rule')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(document.querySelector<HTMLInputElement>(GQL.WF_ASSERT_EXPECTED)?.value).toBe('2000');
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

  it('gql11-run-pass-exec runs quick test expecting pass', async () => {
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
    const step = gqlWorkflowIntegrationLesson.steps.find((s) => s.id === 'gql11-run-pass-exec')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(WF.QUICK_TEST_BTN);
  });

  it('gql11-tighten-threshold configures assert rule to 1ms', async () => {
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
    const step = gqlWorkflowIntegrationLesson.steps.find((s) => s.id === 'gql11-tighten-threshold')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.WF_ASSERT_EXPECTED, '1');
  });

  it('ensureLesson11ConsoleOpen does not reconfigure assert threshold', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      ${buildFullAssertDom()}
      <div class="wf-console-badge"></div>
      <div class="wf-console-panel"></div>
    `;
    (window as unknown as Record<string, unknown>).__wfOpenNodeConfig = vi.fn();
    (window as unknown as Record<string, unknown>).__wfConnect = vi.fn();
    mockLesson11WorkflowBridge('1');
    await ensureLesson11AssertRuleConfigured(ctx, '1');
    vi.mocked(ctx.fill).mockClear();
    await ensureLesson11ConsoleOpen(ctx);
    expect(ctx.fill).not.toHaveBeenCalledWith(GQL.WF_ASSERT_EXPECTED, '2000');
  });

  it('gql11-observe-failure preAction runs quick test; action only pauses', async () => {
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
    mockLesson11WorkflowBridge('1');
    const step = gqlWorkflowIntegrationLesson.steps.find((s) => s.id === 'gql11-observe-failure')!;
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(WF.QUICK_TEST_BTN);
    vi.mocked(ctx.click).mockClear();
    await step.action!(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(WF.QUICK_TEST_BTN);
  });

  it('gql11-debug-mode action starts debug and clicks each Step button', async () => {
    const ctx = makeCtx();
    let stepClicks = 0;
    document.body.innerHTML = `
      ${buildQueryConfigDom()}
      <button class="wf-quick-test-btn"></button>
      <button title="Run workflow step-by-step"></button>
      <div data-testid="wf-exec-summary"></div>
      <div class="wf-console-badge"></div>
      <div class="wf-console-panel"></div>
    `;
    (window as unknown as Record<string, unknown>).__wfOpenNodeConfig = vi.fn();
    (window as unknown as Record<string, unknown>).__wfConnect = vi.fn();
    mockLesson11WorkflowBridge('1');
    vi.mocked(ctx.waitFor).mockImplementation(async (sel: string) => {
      if (sel === WF.DEBUG_STEP_BTN && !document.querySelector(WF.DEBUG_STEP_BTN)) {
        const stepBtn = document.createElement('button');
        stepBtn.className = 'wf-debug-step-btn';
        document.body.appendChild(stepBtn);
      }
    });
    vi.mocked(ctx.click).mockImplementation(async (sel: string) => {
      const el = document.querySelector<HTMLElement>(sel);
      if (!el) return;
      if (sel === WF.DEBUG_STEP_BTN) {
        stepClicks++;
        if (stepClicks >= 3) el.remove();
      }
      el.click();
    });
    const step = gqlWorkflowIntegrationLesson.steps.find((s) => s.id === 'gql11-debug-mode')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(WF.DEBUG_BTN);
    expect(ctx.click).toHaveBeenCalledWith(WF.DEBUG_STEP_BTN);
    expect(stepClicks).toBeGreaterThan(0);
  });

  // ── Guard tests ───────────────────────────────────────────────────────────

  it('ensureLesson11WorkflowCreated guard skips when canvas exists', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="wf-sidebar-new-btn" title="New workflow"></button>
      <div class="wf-new-dropdown"></div>
      <button data-testid="wf-new-blank-item" class="wf-new-dropdown-item"></button>
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

  it('ensureLesson11WorkflowVariablesConfigured guard skips when already configured', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <div class="wf-canvas-area"></div>
      <button data-testid="wf-toolbar-variables-btn"></button>
      <button data-testid="wf-sidebar-new-btn" title="New workflow"></button>
      <div class="wf-new-dropdown"></div>
      <button data-testid="wf-new-blank-item" class="wf-new-dropdown-item"></button>
    `;
    mockLesson11WorkflowBridge('2000');
    await ensureLesson11WorkflowCreated(ctx);
    await ensureLesson11WorkflowVariablesConfigured(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureLesson11WorkflowVariablesConfigured(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(WF.VARIABLES_BTN);
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

  it('ensureLesson11QueryConfigured patches canvas when Save is disabled', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = buildQueryConfigDom().replace(
      '<button class="btn-primary">Save</button>',
      '<button class="btn-primary" disabled>Save</button>',
    );
    (window as unknown as Record<string, unknown>).__wfOpenNodeConfig = vi.fn();
    (window as unknown as Record<string, unknown>).__wfConnect = vi.fn();
    const patchSpy = vi.fn(() => true);
    const varsPatchSpy = vi.fn(() => true);
    (window as unknown as Record<string, unknown>).__wfPatchNodeDataByType = patchSpy;
    (window as unknown as Record<string, unknown>).__wfPatchWorkflowByName = varsPatchSpy;
    await ensureLesson11QueryConfigured(ctx);
    expect(patchSpy).toHaveBeenCalledWith('graphqlQuery', expect.objectContaining({
      endpoint: GQL_DEMO_VAR,
      query: 'query { health }',
    }));
    expect(varsPatchSpy).toHaveBeenCalledWith(LESSON11_WF_NAME, expect.objectContaining({
      variables: { graphqlUrl: GQL_DEMO_HTTP },
    }));
  });

  it('ensureLesson11QueryConfigured guard skips when already configured', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = buildQueryConfigDom();
    (window as unknown as Record<string, unknown>).__wfOpenNodeConfig = vi.fn();
    (window as unknown as Record<string, unknown>).__wfConnect = vi.fn();
    (window as unknown as Record<string, unknown>).__wfPatchNodeDataByType = vi.fn(() => true);
    mockLesson11WorkflowBridge('2000');
    await ensureLesson11QueryConfigured(ctx);
    vi.mocked(ctx.fill).mockClear();
    await ensureLesson11QueryConfigured(ctx);
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('ensureLesson11AssertRuleConfigured resets pass/fail flags for non-pass threshold', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      ${buildQueryConfigDom()}
      <div class="react-flow__node-graphqlAssert" data-id="a1">
        <div data-testid="gql-canvas-assert-node"></div>
      </div>
      <div class="wf-config-modal">
        <div data-testid="gql-wf-assert-panel">
          <button type="button" class="gql-wf-subtab"><span>Assertions</span></button>
          <button data-testid="gql-wf-assert-add-btn"></button>
          <div data-testid="gql-wf-assert-row">
            <input data-testid="gql-wf-assert-jsonpath" />
            <select data-testid="gql-wf-assert-operator"><option value="less_than">&lt;</option></select>
            <input data-testid="gql-wf-assert-expected" />
            <input data-testid="gql-wf-assert-description" />
          </div>
        </div>
        <div class="wf-config-modal-footer-actions"><button class="btn-ghost">Close</button><button class="btn-primary">Save</button></div>
      </div>
    `;
    (window as unknown as Record<string, unknown>).__wfOpenNodeConfig = vi.fn();
    (window as unknown as Record<string, unknown>).__wfConnect = vi.fn();
    (window as unknown as Record<string, unknown>).__wfPatchWorkflowByName = vi.fn(() => true);
    (window as unknown as Record<string, unknown>).__wfPatchNodeDataByType = vi.fn(() => true);
    await ensureLesson11AssertRuleConfigured(ctx, '1');
    expect(document.querySelector<HTMLInputElement>(GQL.WF_ASSERT_EXPECTED)?.value).toBe('1');
  });

  it('dismissWorkflowOnboarding clicks skip when tooltip visible', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="wf-sidebar-new-btn" title="New workflow"></button>
      <div class="wf-new-dropdown"></div>
      <button data-testid="wf-new-blank-item" class="wf-new-dropdown-item"></button>
      <div class="wf-canvas-area"></div>
      <button class="onboarding-tooltip-skip"></button>
    `;
    const skipBtn = document.querySelector<HTMLElement>('.onboarding-tooltip-skip')!;
    const clickSpy = vi.spyOn(skipBtn, 'click');
    await ensureLesson11WorkflowCreated(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('ensureLesson11WorkflowPassRun guard skips when both nodes already passed', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      ${buildQueryConfigDom()}
      <button class="wf-palette-block-graphqlAssert"></button>
      <div class="react-flow__node-graphqlAssert wf-node-pass" data-id="a1">
        <div data-testid="gql-canvas-assert-node" class="wf-node-pass"></div>
      </div>
      <div class="react-flow__node-graphqlQuery" data-id="q1">
        <div data-testid="gql-canvas-query-node" class="wf-node-pass"></div>
      </div>
      <div class="wf-config-modal">
        <div data-testid="gql-wf-assert-panel">
          <button type="button" class="gql-wf-subtab"><span>Source</span></button>
          <button type="button" class="gql-wf-subtab"><span>Assertions</span></button>
          <div data-testid="gql-wf-assert-row">
            <input data-testid="gql-wf-assert-jsonpath" />
            <select data-testid="gql-wf-assert-operator"><option value="less_than">&lt;</option></select>
            <input data-testid="gql-wf-assert-expected" />
            <input data-testid="gql-wf-assert-description" />
          </div>
        </div>
        <div class="wf-config-modal-footer-actions"><button class="btn-ghost">Close</button><button class="btn-primary">Save</button></div>
      </div>
      <button title="Fit view"></button>
      <button class="wf-toolbar-save-wrap"><button></button></button>
      <button class="wf-quick-test-btn"></button>
      <div data-testid="wf-exec-summary"></div>
    `;
    (window as unknown as Record<string, unknown>).__wfOpenNodeConfig = vi.fn();
    (window as unknown as Record<string, unknown>).__wfConnect = vi.fn();
    mockLesson11WorkflowBridge('2000');
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
          <button type="button" class="gql-wf-subtab"><span>Assertions</span></button>
          <div data-testid="gql-wf-assert-row">
            <input data-testid="gql-wf-assert-jsonpath" />
            <select data-testid="gql-wf-assert-operator"><option value="less_than">&lt;</option></select>
            <input data-testid="gql-wf-assert-expected" />
            <input data-testid="gql-wf-assert-description" />
          </div>
        </div>
        <div class="wf-config-modal-footer-actions"><button class="btn-ghost">Close</button><button class="btn-primary">Save</button></div>
      </div>
    `;
    (window as unknown as Record<string, unknown>).__wfOpenNodeConfig = vi.fn();
    (window as unknown as Record<string, unknown>).__wfConnect = vi.fn();
    (window as unknown as Record<string, unknown>).__wfPatchNodeDataByType = vi.fn(() => true);
    mockLesson11WorkflowBridge('2000');
    await ensureLesson11AssertRuleConfigured(ctx, '2000');
    vi.mocked(ctx.fill).mockClear();
    await ensureLesson11AssertRuleConfigured(ctx, '2000');
    expect(ctx.fill).not.toHaveBeenCalled();
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

  it('ensureLesson11DebugRun guard skips second Debug start but can resume Step clicks', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      ${buildQueryConfigDom()}
      <button class="wf-quick-test-btn"></button>
      <button title="Run workflow step-by-step"></button>
      <div data-testid="wf-exec-summary"></div>
      <div class="wf-console-badge"></div>
      <div class="wf-console-panel"></div>
    `;
    (window as unknown as Record<string, unknown>).__wfOpenNodeConfig = vi.fn();
    (window as unknown as Record<string, unknown>).__wfConnect = vi.fn();
    mockLesson11WorkflowBridge('1');
    await ensureLesson11DebugRun(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureLesson11DebugRun(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(WF.DEBUG_BTN);
  });
});
