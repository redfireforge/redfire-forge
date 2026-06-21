/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { gqlMockServerLesson } from './graphql-mock-server';
import { makeCtx } from './ws-test-utils';
import { GQL } from '../../../../shared/selectors';
import {
  GQL_DEMO_HTTP,
  GQL_MOCK_HTTP,
  LESSON13_HEALTH_OVERRIDE,
  ensureLesson13HealthOverrideConfigured,
  ensureLesson13LatencyDemo,
  ensureLesson13MockDisabledAndRestored,
  ensureLesson13MockEnabled,
  ensureLesson13MockExecuted,
  ensureLesson13MockPanelOpen,
  gqlMockServerLessonSetup,
  gqlMockServerLessonCleanup,
  ensureLesson13MockEndpointIntrospected,
  resetGqlLesson12SessionFlags,
  resetGqlLesson13SessionFlags,
  resetGqlLessonSessionFlags,
} from './graphql-lesson-helpers';

function stubMonacoEditor(query = 'query { health }'): void {
  const w = window as unknown as {
    monaco?: {
      editor: {
        getModels: () => Array<{ getValue: () => string; setValue: (v: string) => void; uri: { toString: () => string } }>;
        getEditors: () => Array<{ getModel: () => null; setValue: (v: string) => void }>;
      };
    };
  };
  w.monaco = {
    editor: {
      getModels: () => [{
        getValue: () => query,
        setValue: (v: string) => { query = v; },
        uri: { toString: () => 'inmemory://graphql/1' },
      }],
      getEditors: () => [{ getModel: () => null, setValue: (v: string) => { query = v; } }],
    },
  };
}

function stubMockDom(): void {
  document.body.innerHTML = `
    <button data-testid="gql-activity-mock" aria-selected="true"></button>
    <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
    <button data-testid="gql-introspect-btn"></button>
    <button data-testid="gql-execute-btn"></button>
    <button data-testid="gql-right-tab-response"></button>
    <span data-testid="gql-schema-badge-ok"></span>
    <div data-testid="gql-response-viewer"></div>
    <div data-testid="gql-response-body">{"data":{"health":"${LESSON13_HEALTH_OVERRIDE}"}}</div>
    <div data-testid="gql-response-latency">650 ms</div>
    <div data-testid="gql-mock-panel">
      <input type="checkbox" data-testid="gql-mock-toggle" />
      <div data-testid="gql-mock-status-row"></div>
      <div data-testid="gql-mock-resolvers-list">
        <div data-testid="gql-mock-type-group">
          <button data-testid="gql-mock-type-header">Query</button>
          <div data-testid="gql-mock-field-row">
            <span>health</span>
            <select data-testid="gql-mock-resolver-select">
              <option value="random">Random</option>
              <option value="fixed">Fixed</option>
            </select>
            <input data-testid="gql-mock-fixed-input" />
          </div>
        </div>
      </div>
      <input type="range" data-testid="gql-mock-latency-slider" min="0" max="5000" step="50" value="0" />
    </div>
  `;
}

describe('gql-mock-server lesson', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetGqlLessonSessionFlags();
    resetGqlLesson13SessionFlags();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('has valid lesson structure', () => {
    expect(gqlMockServerLesson.id).toBe('gql-mock-server');
    expect(gqlMockServerLesson.category).toBe('graphql');
    expect(gqlMockServerLesson.name).toBe('Mock Server');
    expect(gqlMockServerLesson.steps.length).toBe(7);
    expect(gqlMockServerLesson.estimatedMinutes).toBe(3);
  });

  it('has docker prerequisite fields', () => {
    expect(gqlMockServerLesson.dockerEndpoint).toContain('localhost:4010');
    expect(gqlMockServerLesson.tag).toBe('🐳 Docker');
  });

  it('has correct step IDs in order', () => {
    expect(gqlMockServerLesson.steps.map((s) => s.id)).toEqual([
      'gql13-open-mock',
      'gql13-enable-mock',
      'gql13-switch-endpoint',
      'gql13-override-health',
      'gql13-execute-mock',
      'gql13-latency',
      'gql13-restore-live',
    ]);
  });

  it('all 7 steps have pauseAfter: true', () => {
    gqlMockServerLesson.steps.forEach((step) => {
      expect(step.pauseAfter).toBe(true);
    });
  });

  it('stateful steps have preAction guards except the intro step', () => {
    gqlMockServerLesson.steps.slice(1).forEach((step) => {
      expect(step.preAction).toBeTypeOf('function');
    });
  });

  it('gql13-open-mock clicks the activity button', async () => {
    const ctx = makeCtx();
    stubMockDom();
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-open-mock')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.ACTIVITY_MOCK);
  });

  it('gql13-enable-mock toggles mock mode on', async () => {
    const ctx = makeCtx();
    stubMockDom();
    const toggle = document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!;
    vi.mocked(ctx.click).mockImplementation(async (selector: string) => {
      if (selector === GQL.MOCK_TOGGLE) toggle.checked = true;
    });
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-enable-mock')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.MOCK_TOGGLE);
    expect(toggle.checked).toBe(true);
  });

  it('gql13-switch-endpoint points to the mock URL and introspects', async () => {
    const ctx = makeCtx();
    stubMockDom();
    const toggle = document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!;
    vi.mocked(ctx.click).mockImplementation(async (selector: string) => {
      if (selector === GQL.MOCK_TOGGLE) toggle.checked = true;
    });
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-switch-endpoint')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, GQL_MOCK_HTTP);
    expect(ctx.click).toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
  });

  it('gql13-override-health configures the fixed resolver input', async () => {
    const ctx = makeCtx();
    stubMockDom();
    const toggle = document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!;
    vi.mocked(ctx.click).mockImplementation(async (selector: string) => {
      if (selector === GQL.MOCK_TOGGLE) toggle.checked = true;
    });
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-override-health')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.selectOption).toHaveBeenCalledWith(
      '[data-lesson-target="mock-health"] [data-testid="gql-mock-resolver-select"]',
      'fixed',
    );
    expect(ctx.fill).toHaveBeenCalledWith(
      '[data-lesson-target="mock-health"] [data-testid="gql-mock-fixed-input"]',
      `"${LESSON13_HEALTH_OVERRIDE}"`,
    );
  });

  it('gql13-execute-mock runs the health query', async () => {
    const ctx = makeCtx();
    stubMockDom();
    stubMonacoEditor();
    const toggle = document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!;
    vi.mocked(ctx.click).mockImplementation(async (selector: string) => {
      if (selector === GQL.MOCK_TOGGLE) toggle.checked = true;
    });
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-execute-mock')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('gql13-latency changes the mock slider and re-executes', async () => {
    const ctx = makeCtx();
    stubMockDom();
    stubMonacoEditor();
    const toggle = document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!;
    const slider = document.querySelector<HTMLInputElement>(GQL.MOCK_LATENCY_SLIDER)!;
    vi.mocked(ctx.click).mockImplementation(async (selector: string) => {
      if (selector === GQL.MOCK_TOGGLE) toggle.checked = true;
    });
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-latency')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(slider.value).toBe('650');
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('gql13-restore-live disables mock and returns to live endpoint', async () => {
    const ctx = makeCtx();
    stubMockDom();
    stubMonacoEditor();
    const toggle = document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!;
    vi.mocked(ctx.click).mockImplementation(async (selector: string) => {
      if (selector === GQL.MOCK_TOGGLE) toggle.checked = !toggle.checked;
    });
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-restore-live')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, 'http://localhost:4010/graphql');
  });

  it('override / execute / latency / restore helpers perform their key actions', async () => {
    const ctx = makeCtx();
    stubMockDom();
    stubMonacoEditor();
    const toggle = document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!;
    vi.mocked(ctx.click).mockImplementation(async (selector: string) => {
      if (selector === GQL.MOCK_TOGGLE) toggle.checked = !toggle.checked;
    });

    await ensureLesson13HealthOverrideConfigured(ctx);
    expect(ctx.selectOption).toHaveBeenCalled();

    await ensureLesson13MockExecuted(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);

    await ensureLesson13LatencyDemo(ctx);
    expect(document.querySelector<HTMLInputElement>(GQL.MOCK_LATENCY_SLIDER)?.value).toBe('650');

    await ensureLesson13MockDisabledAndRestored(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, 'http://localhost:4010/graphql');
  });

  it('mock helper guards skip duplicate clicks once state is reached', async () => {
    const ctx = makeCtx();
    stubMockDom();
    stubMonacoEditor();
    const toggle = document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!;
    vi.mocked(ctx.click).mockImplementation(async (selector: string) => {
      if (selector === GQL.MOCK_TOGGLE) toggle.checked = !toggle.checked;
    });

    await ensureLesson13MockPanelOpen(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureLesson13MockPanelOpen(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.ACTIVITY_MOCK);

    await ensureLesson13MockEnabled(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureLesson13MockEnabled(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.MOCK_TOGGLE);
  });

  it('ensureLesson13MockPanelOpen accepts mock guard banner on web', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-activity-mock"></button>
      <div data-testid="gql-mock-guard">Desktop only</div>
    `;
    await ensureLesson13MockPanelOpen(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.ACTIVITY_MOCK);
  });

  it('ensureLesson13MockEndpointIntrospected guard skips when mock URL set', async () => {
    const ctx = makeCtx();
    stubMockDom();
    const input = document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT)!;
    input.value = GQL_MOCK_HTTP;
    const toggle = document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!;
    toggle.checked = true;
    await ensureLesson13MockEndpointIntrospected(ctx);
    vi.mocked(ctx.fill).mockClear();
    await ensureLesson13MockEndpointIntrospected(ctx);
    expect(ctx.fill).not.toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, GQL_MOCK_HTTP);
  });

  it('ensureLesson13HealthOverrideConfigured expands type when health row missing', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <div data-testid="gql-mock-panel">
        <input type="checkbox" data-testid="gql-mock-toggle" checked />
        <div data-testid="gql-mock-type-group">
          <button data-testid="gql-mock-type-header">Query</button>
        </div>
      </div>
      <button data-testid="gql-activity-mock"></button>
    `;
    vi.mocked(ctx.waitFor).mockImplementation(async () => {
      const group = document.querySelector(GQL.MOCK_TYPE_GROUP)!;
      if (!group.querySelector(GQL.MOCK_FIELD_ROW)) {
        group.insertAdjacentHTML(
          'beforeend',
          `<div data-testid="gql-mock-field-row"><span>health</span>
            <select data-testid="gql-mock-resolver-select"><option value="fixed">Fixed</option></select>
            <input data-testid="gql-mock-fixed-input" /></div>`,
        );
      }
    });
    await ensureLesson13HealthOverrideConfigured(ctx);
    expect(ctx.click).toHaveBeenCalled();
  });

  it('ensureLesson13LatencyDemo guard skips when latency already high', async () => {
    const ctx = makeCtx();
    stubMockDom();
    stubMonacoEditor();
    const toggle = document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!;
    toggle.checked = true;
    document.querySelector(GQL.ENDPOINT_INPUT)!.value = GQL_MOCK_HTTP;
    await ensureLesson13LatencyDemo(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureLesson13LatencyDemo(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('ensureLesson13MockDisabledAndRestored guard skips live restore when already restored', async () => {
    const ctx = makeCtx();
    stubMockDom();
    stubMonacoEditor();
    const toggle = document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!;
    vi.mocked(ctx.click).mockImplementation(async (selector: string) => {
      if (selector === GQL.MOCK_TOGGLE) toggle.checked = !toggle.checked;
    });
    document.querySelector(GQL.RESPONSE_BODY)!.textContent = '{"data":{"health":"ok"}}';
    await ensureLesson13MockDisabledAndRestored(ctx);
    vi.mocked(ctx.fill).mockClear();
    await ensureLesson13MockDisabledAndRestored(ctx);
    const liveRestoreFills = vi.mocked(ctx.fill).mock.calls.filter(
      (call) => call[0] === GQL.ENDPOINT_INPUT && call[1] === 'http://localhost:4010/graphql',
    );
    expect(liveRestoreFills.length).toBe(0);
  });

  it('gqlMockServerLessonSetup resets prior lessons and loads health query', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="" />
      <button data-testid="gql-introspect-btn"></button>
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <button data-testid="gql-right-tab-response"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
    `;
    stubMonacoEditor('');
    resetGqlLesson12SessionFlags();
    await gqlMockServerLessonSetup(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, '{{graphqlUrl}}');
  });

  it('gqlMockServerLessonCleanup disables mock and restores live endpoint', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-activity-mock"></button>
      <div data-testid="gql-mock-panel">
        <input type="checkbox" data-testid="gql-mock-toggle" checked />
      </div>
      <input data-testid="gql-endpoint-input" value="${GQL_MOCK_HTTP}" />
    `;
    vi.mocked(ctx.click).mockImplementation(async (sel: string) => {
      if (sel === GQL.MOCK_TOGGLE) {
        (document.querySelector(GQL.MOCK_TOGGLE) as HTMLInputElement).checked = false;
      }
    });
    await gqlMockServerLessonCleanup(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, 'http://localhost:4010/graphql');
  });

  it('gqlMockServerLessonCleanup is resilient when mock panel missing', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `<input data-testid="gql-endpoint-input" value="${GQL_MOCK_HTTP}" />`;
    await expect(gqlMockServerLessonCleanup(ctx)).resolves.not.toThrow();
  });

  it('ensureLesson13MockPanelOpen guard skips when panel already open', async () => {
    const ctx = makeCtx();
    stubMockDom();
    await ensureLesson13MockPanelOpen(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureLesson13MockPanelOpen(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.ACTIVITY_MOCK);
  });

  it('ensureLesson13MockEnabled guard skips when toggle already checked', async () => {
    const ctx = makeCtx();
    stubMockDom();
    (document.querySelector(GQL.MOCK_TOGGLE) as HTMLInputElement).checked = true;
    await ensureLesson13MockEnabled(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureLesson13MockEnabled(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.MOCK_TOGGLE);
  });

  it('ensureLesson13MockEndpointIntrospected guard skips when mock endpoint set', async () => {
    const ctx = makeCtx();
    stubMockDom();
    document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT)!.value = GQL_MOCK_HTTP;
    await ensureLesson13MockEndpointIntrospected(ctx);
    vi.mocked(ctx.fill).mockClear();
    await ensureLesson13MockEndpointIntrospected(ctx);
    expect(ctx.fill).not.toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, GQL_MOCK_HTTP);
  });

  it('ensureLesson13HealthOverrideConfigured skips type header when health row exists', async () => {
    const ctx = makeCtx();
    stubMockDom();
    await ensureLesson13HealthOverrideConfigured(ctx);
    vi.mocked(ctx.selectOption).mockClear();
    await ensureLesson13HealthOverrideConfigured(ctx);
    expect(ctx.selectOption).not.toHaveBeenCalled();
  });

  it('ensureLesson13MockExecuted guard skips when mock response present', async () => {
    const ctx = makeCtx();
    stubMockDom();
    stubMonacoEditor('query { health }');
    await ensureLesson13MockExecuted(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureLesson13MockExecuted(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('ensureLesson13LatencyDemo guard skips when latency already high', async () => {
    const ctx = makeCtx();
    stubMockDom();
    stubMonacoEditor('query { health }');
    await ensureLesson13LatencyDemo(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureLesson13LatencyDemo(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('ensureLesson13MockDisabledAndRestored runs restore flow when mock was enabled', async () => {
    const ctx = makeCtx();
    stubMockDom();
    stubMonacoEditor('query { health }');
    await ensureLesson13MockDisabledAndRestored(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, 'http://localhost:4010/graphql');
  });

  it('ensureLesson13HealthOverrideConfigured handles missing Query type group', async () => {
    const ctx = makeCtx();
    stubMockDom();
    document.querySelectorAll(GQL.MOCK_TYPE_GROUP).forEach((g) => g.remove());
    await expect(ensureLesson13HealthOverrideConfigured(ctx)).resolves.not.toThrow();
  });

  it('ensureLesson13MockPanelOpen accepts mock guard banner on web', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `<div data-testid="gql-mock-guard"></div>`;
    await ensureLesson13MockPanelOpen(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.ACTIVITY_MOCK);
  });

  it('ensureLesson13LatencyDemo guard skips when latency already above threshold', async () => {
    const ctx = makeCtx();
    stubMockDom();
    document.querySelector(GQL.RESPONSE_LATENCY)!.textContent = '750 ms';
    stubMonacoEditor('query { health }');
    await ensureLesson13MockExecuted(ctx);
    await ensureLesson13LatencyDemo(ctx);
    const execAfterFirst = (ctx.click as ReturnType<typeof vi.fn>).mock.calls
      .filter((c: string[]) => c[0] === GQL.EXECUTE_BTN).length;
    await ensureLesson13LatencyDemo(ctx);
    const execAfterSecond = (ctx.click as ReturnType<typeof vi.fn>).mock.calls
      .filter((c: string[]) => c[0] === GQL.EXECUTE_BTN).length;
    expect(execAfterSecond).toBe(execAfterFirst);
  });

  it('ensureLesson13MockExecuted re-runs when response lacks override value', async () => {
    const ctx = makeCtx();
    stubMockDom();
    stubMonacoEditor('query { health }');
    document.querySelector(GQL.RESPONSE_BODY)!.textContent = '{"data":{"health":"ok"}}';
    await ensureLesson13MockEndpointIntrospected(ctx);
    await ensureLesson13HealthOverrideConfigured(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureLesson13MockExecuted(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('gqlMockServerLessonSetup selects response tab when not active', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <button data-testid="gql-right-tab-response" aria-selected="false"></button>
      <input data-testid="gql-endpoint-input" value="" />
      <button data-testid="gql-introspect-btn"></button>
      <span data-testid="gql-schema-badge-ok"></span>
      <div data-testid="gql-editor"></div>
    `;
    stubMonacoEditor('query { health }');
    const tab = document.querySelector<HTMLElement>(GQL.RIGHT_TAB_RESPONSE)!;
    const clickSpy = vi.spyOn(tab, 'click');
    await gqlMockServerLessonSetup(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('gqlMockServerLessonCleanup skips endpoint fill when already on demo URL', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-activity-mock"></button>
      <div data-testid="gql-mock-panel"><input data-testid="gql-mock-toggle" type="checkbox" /></div>
      <input data-testid="gql-endpoint-input" value="${GQL_DEMO_HTTP}" />
    `;
    await gqlMockServerLessonCleanup(ctx);
    expect(ctx.fill).not.toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, GQL_DEMO_HTTP);
  });

  it('ensureLesson13LatencyDemo skips slider when slider missing', async () => {
    const ctx = makeCtx();
    stubMockDom();
    document.querySelector(GQL.MOCK_LATENCY_SLIDER)?.remove();
    stubMonacoEditor('query { health }');
    await ensureLesson13LatencyDemo(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('ensureLesson13HealthOverrideConfigured completes when health row missing', async () => {
    const ctx = makeCtx();
    stubMockDom();
    document.querySelectorAll(GQL.MOCK_FIELD_ROW).forEach((row) => {
      if (row.textContent?.includes('health')) row.remove();
    });
    await ensureLesson13HealthOverrideConfigured(ctx);
    expect(ctx.delay).toHaveBeenCalled();
  });

  it('ensureLesson13MockEnabled skips toggle click when already checked', async () => {
    const ctx = makeCtx();
    stubMockDom();
    document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!.checked = true;
    await ensureLesson13MockEnabled(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureLesson13MockEnabled(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.MOCK_TOGGLE);
  });

  it('ensureLesson13MockPanelOpen guard skips when guard banner already visible', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `<div data-testid="gql-mock-guard"></div>`;
    await ensureLesson13MockPanelOpen(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureLesson13MockPanelOpen(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.ACTIVITY_MOCK);
  });

  it('ensureLesson13MockEndpointIntrospected guard skips when mock endpoint already set', async () => {
    const ctx = makeCtx();
    stubMockDom();
    document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT)!.value = GQL_MOCK_HTTP;
    document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!.checked = true;
    await ensureLesson13MockEndpointIntrospected(ctx);
    vi.mocked(ctx.fill).mockClear();
    await ensureLesson13MockEndpointIntrospected(ctx);
    expect(ctx.fill).not.toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, GQL_MOCK_HTTP);
  });

  it('ensureLesson13LatencyDemo reads zero latency when metadata has no digits', async () => {
    const ctx = makeCtx();
    stubMockDom();
    document.querySelector(GQL.RESPONSE_LATENCY)!.textContent = 'n/a';
    stubMonacoEditor('query { health }');
    await ensureLesson13LatencyDemo(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('gqlMockServerLessonSetup selects response tab when inactive', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <button data-testid="gql-right-tab-response" aria-selected="false"></button>
      <input data-testid="gql-endpoint-input" value="" />
      <button data-testid="gql-introspect-btn"></button>
      <span data-testid="gql-schema-badge-ok"></span>
      <div data-testid="gql-editor"></div>
    `;
    stubMonacoEditor('query { health }');
    const tab = document.querySelector<HTMLElement>(GQL.RIGHT_TAB_RESPONSE)!;
    const clickSpy = vi.spyOn(tab, 'click');
    await gqlMockServerLessonSetup(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('gqlMockServerLessonSetup skips response tab click when already selected', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <button data-testid="gql-right-tab-response" aria-selected="true"></button>
      <input data-testid="gql-endpoint-input" value="" />
      <button data-testid="gql-introspect-btn"></button>
      <span data-testid="gql-schema-badge-ok"></span>
      <div data-testid="gql-editor"></div>
    `;
    stubMonacoEditor('query { health }');
    const tab = document.querySelector<HTMLElement>(GQL.RIGHT_TAB_RESPONSE)!;
    const clickSpy = vi.spyOn(tab, 'click');
    await gqlMockServerLessonSetup(ctx);
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('findMockTypeGroup skips non-matching groups before Query', async () => {
    const ctx = makeCtx();
    stubMockDom();
    const list = document.querySelector(GQL.MOCK_RESOLVERS_LIST)!;
    list.insertAdjacentHTML(
      'afterbegin',
      `<div data-testid="gql-mock-type-group"><button data-testid="gql-mock-type-header">Mutation</button></div>`,
    );
    await ensureLesson13HealthOverrideConfigured(ctx);
    expect(ctx.selectOption).toHaveBeenCalled();
  });

  it('gqlMockServerLessonCleanup survives mock panel open failure', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-activity-mock"></button>
      <input data-testid="gql-endpoint-input" value="${GQL_DEMO_HTTP}" />
    `;
    vi.mocked(ctx.click).mockImplementation(async (selector: string) => {
      if (selector === GQL.ACTIVITY_MOCK) {
        throw new Error('mock panel unavailable');
      }
    });
    await expect(gqlMockServerLessonCleanup(ctx)).resolves.toBeUndefined();
  });
});
