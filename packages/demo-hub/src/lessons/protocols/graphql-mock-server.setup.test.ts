/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./graphql-lesson-helpers/gql-demo-tab', () => ({
  ensureGqlDemoTab: vi.fn(async () => 'demo-tab-gql13'),
  closeGqlDemoTabs: vi.fn(async () => {}),
}));

import {
  setupGraphqlMockServerBeforeEach,
  teardownGraphqlMockServerAfterEach,
  stubMonacoEditor,
  stubMockDom,
  mockLesson13LiveExecute,
} from './graphql-mock-server.testHelpers';
import { ensureGqlDemoTab, closeGqlDemoTabs } from './graphql-lesson-helpers/gql-demo-tab';
import { makeCtx } from './ws-test-utils';
import { GQL } from '@shared/selectors';
import {
  GQL_DEMO_HTTP,
  GQL_MOCK_HTTP,
  ensureLesson13LatencyExecute,
  ensureLesson13LiveEndpointRestored,
  ensureLesson13HealthOverrideConfigured,
  ensureLesson13MockEnabled,
  ensureLesson13MockExecuted,
  gqlMockServerLessonCleanup,
  ensureLesson13MockEndpointIntrospected,
  resetGqlLesson12SessionFlags,
  gqlMockServerLessonSetup,
  ensureLesson13MockPanelOpen,
} from './graphql-lesson-helpers';

describe('gql-mock-server lesson — setup', () => {
  beforeEach(() => {
    setupGraphqlMockServerBeforeEach();
  });
  afterEach(async () => {
    await teardownGraphqlMockServerAfterEach();
  });

it('gqlMockServerLessonSetup creates demo tab and loads health query', async () => {
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
    expect(ensureGqlDemoTab).toHaveBeenCalledWith(ctx, 'gql-mock-server', 'Mock Server');
    expect(ctx.fill).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, '{{graphqlUrl}}');
  });

  it('gqlMockServerLessonCleanup disables mock and closes demo tab', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-activity-mock" class="gql-activity-tab--active"></button>
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
    expect(closeGqlDemoTabs).toHaveBeenCalledWith(ctx, 'gql-mock-server');
    expect(ctx.click).toHaveBeenCalledWith(GQL.ACTIVITY_MOCK);
    expect(ctx.fill).not.toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, 'http://localhost:4010/graphql');
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

  it('ensureLesson13MockEnabled guard skips when mock UI already enabled', async () => {
    const ctx = makeCtx();
    stubMockDom();
    const toggle = document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!;
    toggle.checked = true;
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

  it('ensureLesson13LatencyExecute guard skips when latency already high', async () => {
    const ctx = makeCtx();
    stubMockDom();
    stubMonacoEditor('query { health }');
    await ensureLesson13LatencyExecute(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureLesson13LatencyExecute(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('ensureLesson13LiveEndpointRestored runs restore flow when mock was enabled', async () => {
    const ctx = makeCtx();
    stubMockDom();
    stubMonacoEditor('query { health }');
    const toggle = document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!;
    toggle.checked = true;
    document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT)!.value = GQL_MOCK_HTTP;
    mockLesson13LiveExecute(ctx, (selector) => {
      if (selector === GQL.MOCK_TOGGLE) toggle.checked = !toggle.checked;
    });
    await ensureLesson13LiveEndpointRestored(ctx);
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

  it('ensureLesson13LatencyExecute guard skips when latency already above threshold', async () => {
    const ctx = makeCtx();
    stubMockDom();
    document.querySelector(GQL.RESPONSE_LATENCY)!.textContent = '750 ms';
    stubMonacoEditor('query { health }');
    await ensureLesson13MockExecuted(ctx);
    await ensureLesson13LatencyExecute(ctx);
    const execAfterFirst = (ctx.click as ReturnType<typeof vi.fn>).mock.calls
      .filter((c: string[]) => c[0] === GQL.EXECUTE_BTN).length;
    await ensureLesson13LatencyExecute(ctx);
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

  it('gqlMockServerLessonCleanup closes demo tab without rewriting user endpoint', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-activity-mock"></button>
      <div data-testid="gql-mock-panel"><input data-testid="gql-mock-toggle" type="checkbox" /></div>
      <input data-testid="gql-endpoint-input" value="${GQL_DEMO_HTTP}" />
    `;
    await gqlMockServerLessonCleanup(ctx);
    expect(closeGqlDemoTabs).toHaveBeenCalledWith(ctx, 'gql-mock-server');
    expect(ctx.fill).not.toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, GQL_DEMO_HTTP);
  });

  it('ensureLesson13LatencyExecute skips slider when slider missing', async () => {
    const ctx = makeCtx();
    stubMockDom();
    document.querySelector(GQL.MOCK_LATENCY_SLIDER)?.remove();
    stubMonacoEditor('query { health }');
    await ensureLesson13LatencyExecute(ctx);
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

  it('ensureLesson13LatencyExecute reads zero latency when metadata has no digits', async () => {
    const ctx = makeCtx();
    stubMockDom();
    document.querySelector(GQL.RESPONSE_LATENCY)!.textContent = 'n/a';
    stubMonacoEditor('query { health }');
    await ensureLesson13LatencyExecute(ctx);
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
