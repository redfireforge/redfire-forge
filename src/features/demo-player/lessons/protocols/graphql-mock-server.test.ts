/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { gqlMockServerLesson } from './graphql-mock-server';
import { makeCtx } from './ws-test-utils';
import { GQL } from '../../../../shared/selectors';
import {
  GQL_MOCK_HTTP,
  LESSON13_HEALTH_OVERRIDE,
  ensureLesson13HealthOverrideConfigured,
  ensureLesson13LatencyDemo,
  ensureLesson13MockDisabledAndRestored,
  ensureLesson13MockEnabled,
  ensureLesson13MockExecuted,
  ensureLesson13MockPanelOpen,
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
});
