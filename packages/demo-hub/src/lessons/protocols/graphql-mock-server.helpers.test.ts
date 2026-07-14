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
import { gqlMockServerLesson } from './graphql-mock-server';
import { makeCtx } from './ws-test-utils';
import { GQL } from '@shared/selectors';
import {GQL_MOCK_HTTP,
  LESSON13_HEALTH_OVERRIDE,
  LESSON13_MOCK_HEALTH_RESOLVER,
  ensureLesson13LatencyExecute,
  ensureLesson13LiveEndpointOnly,
  ensureLesson13LiveEndpointRestored,
  ensureLesson13MockDisabledOnly,
  ensureLesson13HealthOverrideConfigured,
  ensureLesson13MockEnabled,
  ensureLesson13MockExecuted,
  ensureLesson13MockPanelOpen,
  ensureLesson13MockEndpointIntrospected,
  prepareLesson13MockFixedValueSpotlight,
  prepareLesson13MockHealthSpotlight,
  prepareLesson13MockLatencySpotlight,
  prepareLesson13MockResolversListSpotlight,
  prepareLesson13MockResponseSpotlight,
  prepareLesson13MockSchemaSourceSpotlight,
  prepareLesson13ReadLiveSpotlight,
  resetGqlLesson13SessionFlags,
} from './graphql-lesson-helpers';

describe('gql-mock-server lesson', () => {
  beforeEach(() => {
    setupGraphqlMockServerBeforeEach();
  });
  afterEach(async () => {
    await teardownGraphqlMockServerAfterEach();
  });

// ── Guard helpers ──────────────────────────────────────────────────────────

  it('override / execute / latency / restore helpers perform their key actions', async () => {
    const ctx = makeCtx();
    stubMockDom();
    stubMonacoEditor();
    const toggle = document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!;
    mockLesson13LiveExecute(ctx, (selector) => {
      if (selector === GQL.MOCK_TOGGLE) toggle.checked = !toggle.checked;
    });

    await ensureLesson13HealthOverrideConfigured(ctx);
    expect(ctx.selectOption).toHaveBeenCalled();

    await ensureLesson13MockExecuted(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);

    await ensureLesson13LatencyExecute(ctx);
    expect(document.querySelector<HTMLInputElement>(GQL.MOCK_LATENCY_SLIDER)?.value).toBe('650');

    document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT)!.value = GQL_MOCK_HTTP;
    vi.mocked(ctx.fill).mockClear();
    await ensureLesson13LiveEndpointRestored(ctx);
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

  it('ensureLesson13LatencyExecute guard skips when latency already high', async () => {
    const ctx = makeCtx();
    stubMockDom();
    stubMonacoEditor();
    const toggle = document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!;
    toggle.checked = true;
    document.querySelector(GQL.ENDPOINT_INPUT)!.value = GQL_MOCK_HTTP;
    await ensureLesson13LatencyExecute(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureLesson13LatencyExecute(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('ensureLesson13LiveEndpointRestored guard skips live restore when already restored', async () => {
    const ctx = makeCtx();
    stubMockDom();
    stubMonacoEditor();
    const toggle = document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!;
    vi.mocked(ctx.click).mockImplementation(async (selector: string) => {
      if (selector === GQL.MOCK_TOGGLE) toggle.checked = !toggle.checked;
    });
    document.querySelector(GQL.RESPONSE_BODY)!.textContent = '{"data":{"health":"ok"}}';
    await ensureLesson13LiveEndpointRestored(ctx);
    vi.mocked(ctx.fill).mockClear();
    await ensureLesson13LiveEndpointRestored(ctx);
    const liveRestoreFills = vi.mocked(ctx.fill).mock.calls.filter(
      (call) => call[0] === GQL.ENDPOINT_INPUT && call[1] === 'http://localhost:4010/graphql',
    );
    expect(liveRestoreFills.length).toBe(0);
  });

  it('ensureLesson13LiveEndpointRestored does not skip when response still shows mock-ok', async () => {
    const ctx = makeCtx();
    stubMockDom();
    stubMonacoEditor();
    resetGqlLesson13SessionFlags();
    document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT)!.value = GQL_MOCK_HTTP;
    document.querySelector(GQL.RESPONSE_BODY)!.textContent = `{"data":{"health":"${LESSON13_HEALTH_OVERRIDE}"}}`;
    mockLesson13LiveExecute(ctx);
    vi.mocked(ctx.fill).mockClear();
    await ensureLesson13LiveEndpointOnly(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, 'http://localhost:4010/graphql');
  });

  it('ensureLesson13LiveEndpointOnly skips when live endpoint and ok response present', async () => {
    const ctx = makeCtx();
    stubMockDom();
    stubMonacoEditor();
    document.querySelector(GQL.RESPONSE_BODY)!.textContent = '{"data":{"health":"ok"}}';
    vi.mocked(ctx.fill).mockClear();
    await ensureLesson13LiveEndpointOnly(ctx);
    expect(ctx.fill).not.toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, 'http://localhost:4010/graphql');
  });

  it('ensureLesson13LiveEndpointOnly does not skip when ok response is stale but endpoint is mock', async () => {
    const ctx = makeCtx();
    stubMockDom();
    stubMonacoEditor();
    resetGqlLesson13SessionFlags();
    document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT)!.value = GQL_MOCK_HTTP;
    document.querySelector(GQL.RESPONSE_BODY)!.textContent = '{"data":{"health":"ok"}}';
    mockLesson13LiveExecute(ctx);
    vi.mocked(ctx.fill).mockClear();
    await ensureLesson13LiveEndpointOnly(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, 'http://localhost:4010/graphql');
  });

  it('prepareLesson13MockSchemaSourceSpotlight opens mock panel for schema row', async () => {
    const ctx = makeCtx();
    stubMockDom();
    const toggle = document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!;
    vi.mocked(ctx.click).mockImplementation(async (selector: string) => {
      if (selector === GQL.MOCK_TOGGLE) toggle.checked = true;
    });
    await prepareLesson13MockSchemaSourceSpotlight(ctx);
    expect(document.querySelector(GQL.MOCK_SCHEMA_SOURCE)).not.toBeNull();
  });

  it('prepareLesson13MockResolversListSpotlight keeps resolvers list visible', async () => {
    const ctx = makeCtx();
    stubMockDom();
    const toggle = document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!;
    vi.mocked(ctx.click).mockImplementation(async (selector: string) => {
      if (selector === GQL.MOCK_TOGGLE) toggle.checked = true;
    });
    await prepareLesson13MockResolversListSpotlight(ctx);
    expect(document.querySelector(GQL.MOCK_RESOLVERS_LIST)).not.toBeNull();
  });

  it('prepareLesson13MockHealthSpotlight tags health row for resolver spotlight', async () => {
    const ctx = makeCtx();
    stubMockDom();
    const toggle = document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!;
    vi.mocked(ctx.click).mockImplementation(async (selector: string) => {
      if (selector === GQL.MOCK_TOGGLE) toggle.checked = true;
    });
    await prepareLesson13MockHealthSpotlight(ctx);
    expect(document.querySelector('[data-lesson-target="mock-health"]')).not.toBeNull();
  });

  it('prepareLesson13MockFixedValueSpotlight reveals fixed input when resolver not yet fixed', async () => {
    const ctx = makeCtx();
    stubMockDom();
    const toggle = document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!;
    vi.mocked(ctx.click).mockImplementation(async (selector: string) => {
      if (selector === GQL.MOCK_TOGGLE) toggle.checked = true;
    });
    await prepareLesson13MockFixedValueSpotlight(ctx);
    expect(ctx.selectOption).toHaveBeenCalledWith(LESSON13_MOCK_HEALTH_RESOLVER, 'fixed');
  });

  it('prepareLesson13MockFixedValueSpotlight skips select when resolver already fixed', async () => {
    const ctx = makeCtx();
    stubMockDom();
    const toggle = document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!;
    const select = document.querySelector<HTMLSelectElement>(LESSON13_MOCK_HEALTH_RESOLVER)!;
    select.value = 'fixed';
    vi.mocked(ctx.click).mockImplementation(async (selector: string) => {
      if (selector === GQL.MOCK_TOGGLE) toggle.checked = true;
    });
    await prepareLesson13MockFixedValueSpotlight(ctx);
    expect(ctx.selectOption).not.toHaveBeenCalled();
  });

  it('prepareLesson13MockResponseSpotlight selects response tab for reading phase', async () => {
    const ctx = makeCtx();
    stubMockDom();
    stubMonacoEditor();
    const toggle = document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!;
    vi.mocked(ctx.click).mockImplementation(async (selector: string) => {
      if (selector === GQL.MOCK_TOGGLE) toggle.checked = true;
    });
    await prepareLesson13MockResponseSpotlight(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.RIGHT_TAB_RESPONSE);
  });

  it('prepareLesson13ReadLiveSpotlight restores live endpoint and selects response tab', async () => {
    const ctx = makeCtx();
    stubMockDom();
    stubMonacoEditor();
    const toggle = document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!;
    toggle.checked = true;
    document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT)!.value = GQL_MOCK_HTTP;
    mockLesson13LiveExecute(ctx, (selector) => {
      if (selector === GQL.MOCK_TOGGLE) toggle.checked = !toggle.checked;
    });
    await prepareLesson13ReadLiveSpotlight(ctx);
    const endpointFills = vi.mocked(ctx.fill).mock.calls.filter(
      (call) => call[0] === GQL.ENDPOINT_INPUT && call[1] === 'http://localhost:4010/graphql',
    );
    expect(endpointFills.length).toBeGreaterThan(0);
    expect(ctx.click).toHaveBeenCalledWith(GQL.RIGHT_TAB_RESPONSE);
  });

  it('gql13-observe-response preAction uses prepareLesson13MockResponseSpotlight', () => {
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-observe-response')!;
    expect(step.preAction).toBe(prepareLesson13MockResponseSpotlight);
  });

  it('gql13-read-live preAction uses prepareLesson13ReadLiveSpotlight', () => {
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-read-live')!;
    expect(step.preAction).toBe(prepareLesson13ReadLiveSpotlight);
  });

  it('prepareLesson13MockLatencySpotlight opens mock panel after execute', async () => {
    const ctx = makeCtx();
    stubMockDom();
    stubMonacoEditor();
    const toggle = document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!;
    vi.mocked(ctx.click).mockImplementation(async (selector: string) => {
      if (selector === GQL.MOCK_TOGGLE) toggle.checked = true;
    });
    await prepareLesson13MockLatencySpotlight(ctx);
    expect(document.querySelector(GQL.MOCK_PANEL)).not.toBeNull();
  });

  it('ensureLesson13MockDisabledOnly guard skips after E2E web mock disable', async () => {
    const ctx = makeCtx();
    stubMockDom();
    stubMonacoEditor();
    const w = window as unknown as Record<string, unknown>;
    w.__RF_E2E_MOCK_DESKTOP__ = true;
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    try {
      await ensureLesson13LatencyExecute(ctx);
      await ensureLesson13MockDisabledOnly(ctx);
      const callsAfterFirstDisable = fetchMock.mock.calls.length;
      await ensureLesson13MockDisabledOnly(ctx);
      expect(fetchMock.mock.calls.length).toBe(callsAfterFirstDisable);
    } finally {
      delete w.__RF_E2E_MOCK_DESKTOP__;
    }
  });
});
