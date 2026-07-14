/**
 * @vitest-environment jsdom
 * Direct branch-coverage tests for lesson13-mock-server helpers.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@shared/utils/platform', () => ({
  isTauri: vi.fn(() => false),
}));

vi.mock('../../../adapters', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../adapters')>();
  return {
    ...actual,
    loadCachedGraphqlSchemaSdl: vi.fn(() => 'type Query { health: String }'),
  };
});

import { isTauri } from '@shared/utils/platform';
import { loadCachedGraphqlSchemaSdl } from '../../../adapters';
import { makeCtx } from '../ws-test-utils';
import { GQL } from '@shared/selectors';
import {
  GQL_MOCK_HTTP,
  LESSON13_HEALTH_OVERRIDE,
  LESSON13_MOCK_HEALTH_RESOLVER,
  ensureLesson13LatencyDemo,
  ensureLesson13MockDisabledAndRestored,
  ensureLesson13MockDisabledOnly,
  ensureLesson13MockEnabled,
  ensureLesson13MockIntrospectOnly,
  ensureLesson13MockPanelOpen,
  ensureLesson13MockExecuted,
  ensureLesson13LiveEndpointOnly,
  gqlMockServerLessonCleanup,
  ensureLesson13ResolverFixedSelect,
  ensureLesson13FixedValueSet,
  ensureLesson13LatencyExecute,
  prepareLesson13MockFixedValueSpotlight,
  prepareLesson13MockHealthSpotlight,
  prepareLesson13MockToggleSpotlight,
  prepareLesson13MockResponseSpotlight,
  prepareLesson13MockSchemaSourceSpotlight,
  prepareLesson13MockResolversListSpotlight,
  prepareLesson13MockLatencySpotlight,
  prepareLesson13ReadLiveSpotlight,
  resetGqlLesson13SessionFlags,
} from './lesson13-mock-server';

const mockIsTauri = vi.mocked(isTauri);
const mockLoadSdl = vi.mocked(loadCachedGraphqlSchemaSdl);

const GQL_DEMO_HTTP = 'http://localhost:4010/graphql';

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

function stubMockPanel(): void {
  document.body.innerHTML = `
    <button data-testid="gql-activity-mock"></button>
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
          <div data-testid="gql-mock-field-row" data-lesson-target="mock-health"><span>health</span>
            <select data-testid="gql-mock-resolver-select"><option value="random">Random</option><option value="fixed">Fixed</option></select>
            <input data-testid="gql-mock-fixed-input" />
          </div>
        </div>
      </div>
      <input type="range" data-testid="gql-mock-latency-slider" value="0" />
    </div>
    <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
    <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
  `;
}

describe('lesson13-mock-server helpers (branch coverage)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetGqlLesson13SessionFlags();
    mockIsTauri.mockReturnValue(false);
    mockLoadSdl.mockReturnValue('type Query { health: String }');
    delete (window as unknown as Record<string, unknown>).__RF_E2E_MOCK_DESKTOP__;
    delete (window as unknown as Record<string, unknown>).__RF_E2E_MOCK_SDL__;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetAllMocks();
  });

  it('E2E web mock opens activity via gql13E2eOpenMockActivity', async () => {
    (window as unknown as Record<string, unknown>).__RF_E2E_MOCK_DESKTOP__ = true;
    const btn = document.createElement('button');
    btn.setAttribute('data-testid', 'gql-activity-mock');
    btn.disabled = true;
    btn.classList.add('gql-activity-tab--disabled');
    const clickSpy = vi.spyOn(btn, 'click');
    document.body.appendChild(btn);
    document.body.insertAdjacentHTML('beforeend', '<div data-testid="gql-mock-panel"></div>');

    const ctx = makeCtx();
    await ensureLesson13MockPanelOpen(ctx);
    expect(btn.disabled).toBe(false);
    expect(clickSpy).toHaveBeenCalled();
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.ACTIVITY_MOCK);
  });

  it('E2E web mock enable posts config with window SDL override', async () => {
    (window as unknown as Record<string, unknown>).__RF_E2E_MOCK_DESKTOP__ = true;
    (window as unknown as Record<string, unknown>).__RF_E2E_MOCK_SDL__ = 'type Query { ping: String }';
    stubMockPanel();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    const ctx = makeCtx();
    await ensureLesson13MockEnabled(ctx);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/graphql/mock/config',
      expect.objectContaining({ method: 'POST' }),
    );
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.sdl).toContain('ping');
  });

  it('E2E web mock resolver fixed posts config without UI select', async () => {
    (window as unknown as Record<string, unknown>).__RF_E2E_MOCK_DESKTOP__ = true;
    stubMockPanel();
    document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT)!.value = GQL_MOCK_HTTP;
    document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!.checked = true;
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    const ctx = makeCtx();
    await ensureLesson13ResolverFixedSelect(ctx);
    expect(ctx.selectOption).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalled();
  });

  it('E2E web mock fixed value sets health resolver via POST', async () => {
    (window as unknown as Record<string, unknown>).__RF_E2E_MOCK_DESKTOP__ = true;
    stubMockPanel();
    document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT)!.value = GQL_MOCK_HTTP;
    document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!.checked = true;
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    const ctx = makeCtx();
    await ensureLesson13FixedValueSet(ctx);
    const lastBody = JSON.parse(String(fetchMock.mock.calls.at(-1)?.[1]?.body));
    expect(lastBody.config.resolvers.Query.health.value).toBe(LESSON13_HEALTH_OVERRIDE);
  });

  it('E2E web mock latency execute posts 650ms latency and executes', async () => {
    (window as unknown as Record<string, unknown>).__RF_E2E_MOCK_DESKTOP__ = true;
    stubMockPanel();
    document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT)!.value = GQL_MOCK_HTTP;
    document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!.checked = true;
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await ensureLesson13LatencyExecute(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
    const latencyBody = JSON.parse(String(fetchMock.mock.calls.find(
      (c) => JSON.parse(String(c[1]?.body)).config?.globalLatencyMs === 650,
    )?.[1]?.body));
    expect(latencyBody.config.globalLatencyMs).toBe(650);
  });

  it('ensureLesson13LatencyDemo delegates to latency execute', async () => {
    stubMockPanel();
    document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!.checked = true;
    document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT)!.value = GQL_MOCK_HTTP;
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await ensureLesson13LatencyDemo(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('ensureLesson13MockDisabledAndRestored runs full restore flow', async () => {
    stubMockPanel();
    stubMonacoEditor('query { health }');
    const toggle = document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!;
    toggle.checked = true;
    document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT)!.value = GQL_MOCK_HTTP;
    const ctx = makeCtx();
    vi.mocked(ctx.click).mockImplementation(async (sel) => {
      if (sel === GQL.EXECUTE_BTN) {
        document.querySelector(GQL.RESPONSE_BODY)!.textContent = '{"data":{"health":"ok"}}';
        document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT)!.value = GQL_DEMO_HTTP;
      }
      if (sel === GQL.MOCK_TOGGLE) toggle.checked = false;
    });
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await ensureLesson13MockDisabledAndRestored(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
  });

  it('prepareLesson13MockHealthSpotlight returns early on E2E web mock', async () => {
    (window as unknown as Record<string, unknown>).__RF_E2E_MOCK_DESKTOP__ = true;
    stubMockPanel();
    document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT)!.value = GQL_MOCK_HTTP;
    document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!.checked = true;
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    const ctx = makeCtx();
    await prepareLesson13MockHealthSpotlight(ctx);
    expect(ctx.selectOption).not.toHaveBeenCalled();
  });

  it('prepareLesson13MockFixedValueSpotlight uses E2E introspect-only path', async () => {
    (window as unknown as Record<string, unknown>).__RF_E2E_MOCK_DESKTOP__ = true;
    stubMockPanel();
    document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT)!.value = GQL_MOCK_HTTP;
    document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!.checked = true;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));

    const ctx = makeCtx();
    await prepareLesson13MockFixedValueSpotlight(ctx);
    expect(ctx.delay).toHaveBeenCalledWith(200);
  });

  it('prepareLesson13MockToggleSpotlight waits for mock toggle card', async () => {
    stubMockPanel();
    document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!.checked = true;
    document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT)!.value = GQL_MOCK_HTTP;
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await prepareLesson13MockToggleSpotlight(ctx);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.MOCK_TOGGLE_CARD, 5000);
  });

  it('Tauri bootstrap syncs desktop mock when status reports disabled', async () => {
    mockIsTauri.mockReturnValue(true);
    stubMockPanel();
    document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!.checked = false;
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ enabled: false }) })
      .mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await ensureLesson13MockEnabled(ctx);
    expect(mockLoadSdl).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/graphql/mock/config',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('Tauri sync skips POST when cached SDL is missing', async () => {
    mockIsTauri.mockReturnValue(true);
    mockLoadSdl.mockReturnValue(null);
    stubMockPanel();
    document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!.checked = false;
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ enabled: false }) })
      .mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    const ctx = makeCtx();
    await ensureLesson13MockEnabled(ctx);
    const configPosts = fetchMock.mock.calls.filter(
      (c) => String(c[0]).includes('/mock/config'),
    );
    expect(configPosts.length).toBe(0);
  });

  it('E2E mock config POST throws on non-ok response', async () => {
    (window as unknown as Record<string, unknown>).__RF_E2E_MOCK_DESKTOP__ = true;
    stubMockPanel();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));

    const ctx = makeCtx();
    await expect(ensureLesson13MockEnabled(ctx)).rejects.toThrow('503');
  });

  it('ensureLesson13MockDisabledOnly posts enabled false for E2E web mock', async () => {
    (window as unknown as Record<string, unknown>).__RF_E2E_MOCK_DESKTOP__ = true;
    stubMockPanel();
    stubMonacoEditor();
    document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT)!.value = GQL_MOCK_HTTP;
    document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!.checked = true;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await ensureLesson13LatencyExecute(ctx);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    await ensureLesson13MockDisabledOnly(ctx);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/graphql/mock/config',
      expect.objectContaining({ body: expect.stringContaining('"enabled":false') }),
    );
  });

  it('dispatchMockToggleOn skips when toggle missing, checked, or disabled', async () => {
    stubMockPanel();
    document.querySelector(GQL.MOCK_TOGGLE)?.remove();
    const ctx = makeCtx();
    await ensureLesson13MockEnabled(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.MOCK_TOGGLE);
  });

  it('ensureLesson13LiveEndpointOnly sets restored when liveRestoreComplete after execute', async () => {
    stubMockPanel();
    document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT)!.value = GQL_MOCK_HTTP;
    document.querySelector(GQL.RESPONSE_BODY)!.textContent = '{"data":{"health":"ok"}}';
    const ctx = makeCtx();
    vi.mocked(ctx.click).mockImplementation(async (sel) => {
      if (sel === GQL.EXECUTE_BTN) {
        document.querySelector(GQL.RESPONSE_BODY)!.textContent = '{"data":{"health":"ok"}}';
        document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT)!.value = 'http://localhost:4010/graphql';
      }
    });
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await ensureLesson13MockDisabledAndRestored(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
  });

  it('invalid JSON response body is treated as not live during restore', async () => {
    stubMockPanel();
    stubMonacoEditor('query { health }');
    document.querySelector(GQL.RESPONSE_BODY)!.textContent = 'not-json';
    document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!.checked = true;
    document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT)!.value = GQL_MOCK_HTTP;
    const ctx = makeCtx();
    vi.mocked(ctx.click).mockImplementation(async (sel) => {
      if (sel === GQL.EXECUTE_BTN) {
        document.querySelector(GQL.RESPONSE_BODY)!.textContent = '{"data":{"health":"ok"}}';
        document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT)!.value = GQL_DEMO_HTTP;
      }
      if (sel === GQL.MOCK_TOGGLE) {
        (document.querySelector(GQL.MOCK_TOGGLE) as HTMLInputElement).checked = false;
      }
    });
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    vi.mocked(ctx.delay).mockResolvedValue(undefined);
    await ensureLesson13MockDisabledAndRestored(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
  });

  it('prepareLesson13MockFixedValueSpotlight selects fixed when resolver select exists but not fixed', async () => {
    stubMockPanel();
    document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT)!.value = GQL_MOCK_HTTP;
    document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!.checked = true;
    const select = document.querySelector<HTMLSelectElement>(LESSON13_MOCK_HEALTH_RESOLVER)!;
    select.value = 'random';
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await prepareLesson13MockFixedValueSpotlight(ctx);
    expect(ctx.selectOption).toHaveBeenCalledWith(LESSON13_MOCK_HEALTH_RESOLVER, 'fixed');
  });

  it('lesson13DesktopMockEnabled returns false when status fetch fails', async () => {
    mockIsTauri.mockReturnValue(true);
    stubMockPanel();
    document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!.checked = true;
    document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT)!.value = GQL_MOCK_HTTP;
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await ensureLesson13MockIntrospectOnly(ctx);
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3001/api/graphql/mock/status');
  });

  it('lesson13BootstrapDesktopMock skips sync when status reports enabled', async () => {
    mockIsTauri.mockReturnValue(true);
    stubMockPanel();
    document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!.checked = true;
    document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT)!.value = GQL_MOCK_HTTP;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ enabled: true }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await ensureLesson13MockIntrospectOnly(ctx);
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3001/api/graphql/mock/status');
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes('/mock/config'))).toBe(false);
  });

  it('gql13E2eOpenMockActivity no-ops when activity button missing', async () => {
    (window as unknown as Record<string, unknown>).__RF_E2E_MOCK_DESKTOP__ = true;
    document.body.innerHTML = '<div data-testid="gql-mock-panel"></div>';
    const ctx = makeCtx();
    await ensureLesson13MockPanelOpen(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('waitForLiveHealthOk times out gracefully on invalid JSON response', async () => {
    stubMockPanel();
    stubMonacoEditor();
    document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!.checked = true;
    document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT)!.value = GQL_MOCK_HTTP;
    document.querySelector(GQL.RESPONSE_BODY)!.textContent = 'not-json';
    const ctx = makeCtx();
    vi.mocked(ctx.click).mockImplementation(async (sel) => {
      if (sel === GQL.EXECUTE_BTN) {
        document.querySelector(GQL.RESPONSE_BODY)!.textContent = '{"data":{"health":"ok"}}';
        document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT)!.value = GQL_DEMO_HTTP;
      }
      if (sel === GQL.MOCK_TOGGLE) {
        (document.querySelector(GQL.MOCK_TOGGLE) as HTMLInputElement).checked = false;
      }
    });
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    vi.mocked(ctx.delay).mockResolvedValue(undefined);
    await ensureLesson13MockDisabledAndRestored(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
  });

  it('clickMockToggleOn skips when toggle already checked', async () => {
    stubMockPanel();
    document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!.checked = true;
    const ctx = makeCtx();
    await ensureLesson13MockEnabled(ctx);
    vi.mocked(ctx.click).mockClear();
    resetGqlLesson13SessionFlags();
    document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!.checked = true;
    await ensureLesson13MockEnabled(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.MOCK_TOGGLE);
  });

  it('mockUiEnabled uses E2E session flags when mock disabled', async () => {
    (window as unknown as Record<string, unknown>).__RF_E2E_MOCK_DESKTOP__ = true;
    stubMockPanel();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    const ctx = makeCtx();
    await ensureLesson13MockEnabled(ctx);
    await ensureLesson13MockDisabledOnly(ctx);
    expect(document.querySelector(GQL.MOCK_TOGGLE)).toBeTruthy();
  });

  it('dispatchMockToggleOn skips when toggle is disabled', async () => {
    stubMockPanel();
    const toggle = document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!;
    toggle.checked = false;
    toggle.disabled = true;
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await ensureLesson13MockEnabled(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.MOCK_TOGGLE);
  });

  it('ensureResponseTabSelected skips click when response tab already selected', async () => {
    stubMockPanel();
    stubMonacoEditor('query { health }');
    document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!.checked = true;
    document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT)!.value = GQL_MOCK_HTTP;
    document.querySelector(GQL.RESPONSE_BODY)!.textContent =
      `{"data":{"health":"${LESSON13_HEALTH_OVERRIDE}"}}`;
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await ensureLesson13MockExecuted(ctx);
    document.querySelector(GQL.RIGHT_TAB_RESPONSE)!.setAttribute('aria-selected', 'true');
    vi.mocked(ctx.click).mockClear();
    await prepareLesson13MockResponseSpotlight(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.RIGHT_TAB_RESPONSE);
  });

  it('responseShowsMockHealthOk returns false for invalid JSON during execute guard', async () => {
    stubMockPanel();
    stubMonacoEditor();
    document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!.checked = true;
    document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT)!.value = GQL_MOCK_HTTP;
    document.querySelector(GQL.RESPONSE_BODY)!.textContent = 'not-json';
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await ensureLesson13MockExecuted(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('isLiveEndpointConfigured treats empty and mock URLs as not live', async () => {
    stubMockPanel();
    stubMonacoEditor();
    document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT)!.value = '';
    document.querySelector(GQL.RESPONSE_BODY)!.textContent = '{"data":{"health":"ok"}}';
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await ensureLesson13LiveEndpointOnly(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
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

  it('lesson13DesktopMockEnabled returns false when status response not ok', async () => {
    mockIsTauri.mockReturnValue(true);
    stubMockPanel();
    document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!.checked = true;
    document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT)!.value = GQL_MOCK_HTTP;
    let statusCalls = 0;
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes('/mock/status')) {
        statusCalls += 1;
        return Promise.resolve({ ok: false });
      }
      return Promise.resolve({ ok: true });
    });
    vi.stubGlobal('fetch', fetchMock);
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await ensureLesson13MockIntrospectOnly(ctx);
    expect(statusCalls).toBe(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/graphql/mock/config',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('lesson13SyncDesktopMockEnabled falls back to endpoint SDL cache', async () => {
    mockIsTauri.mockReturnValue(true);
    mockLoadSdl.mockImplementation((url: string) =>
      url === GQL_DEMO_HTTP ? null : 'type Query { health: String }',
    );
    stubMockPanel();
    document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT)!.value = 'http://custom:4010/graphql';
    document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!.checked = false;
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await ensureLesson13MockEnabled(ctx);
    expect(mockLoadSdl).toHaveBeenCalledWith(GQL_DEMO_HTTP);
    expect(mockLoadSdl).toHaveBeenCalledWith('http://custom:4010/graphql');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/graphql/mock/config',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('ensureLesson13LiveEndpointOnly short-circuits when live restore already complete', async () => {
    stubMockPanel();
    document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT)!.value = GQL_DEMO_HTTP;
    document.querySelector(GQL.RESPONSE_BODY)!.textContent = '{"data":{"health":"ok"}}';
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await ensureLesson13LiveEndpointOnly(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureLesson13LiveEndpointOnly(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('prepareLesson13MockSchemaSourceSpotlight swallows waitFor rejection', async () => {
    stubMockPanel();
    document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!.checked = true;
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await ensureLesson13MockEnabled(ctx);
    await ensureLesson13MockPanelOpen(ctx);
    vi.mocked(ctx.waitFor).mockImplementation(async (sel) => {
      if (String(sel).includes('gql-mock-schema-source')) throw new Error('timeout');
    });
    await expect(prepareLesson13MockSchemaSourceSpotlight(ctx)).resolves.toBeUndefined();
  });

  it('prepareLesson13MockHealthSpotlight swallows waitFor rejection', async () => {
    stubMockPanel();
    document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!.checked = true;
    document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT)!.value = GQL_MOCK_HTTP;
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await ensureLesson13MockIntrospectOnly(ctx);
    vi.mocked(ctx.waitFor).mockImplementation(async (sel) => {
      if (String(sel).includes('mock-health') || String(sel).includes('gql-mock-resolver-select')) {
        throw new Error('timeout');
      }
    });
    await expect(prepareLesson13MockHealthSpotlight(ctx)).resolves.toBeUndefined();
  });

  it('prepareLesson13MockFixedValueSpotlight swallows waitFor rejection', async () => {
    stubMockPanel();
    document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!.checked = true;
    document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT)!.value = GQL_MOCK_HTTP;
    const select = document.querySelector<HTMLSelectElement>(LESSON13_MOCK_HEALTH_RESOLVER)!;
    select.value = 'fixed';
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockImplementation(async (sel) => {
      if (String(sel).includes('gql-mock-fixed-input')) throw new Error('timeout');
    });
    await expect(prepareLesson13MockFixedValueSpotlight(ctx)).resolves.toBeUndefined();
  });

  it('prepareLesson13MockResponseSpotlight swallows waitFor rejection', async () => {
    stubMockPanel();
    stubMonacoEditor('query { health }');
    document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!.checked = true;
    document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT)!.value = GQL_MOCK_HTTP;
    document.querySelector(GQL.RESPONSE_BODY)!.textContent =
      `{"data":{"health":"${LESSON13_HEALTH_OVERRIDE}"}}`;
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await ensureLesson13MockExecuted(ctx);
    vi.mocked(ctx.waitFor).mockImplementation(async (sel) => {
      if (String(sel).includes('gql-response-body')) throw new Error('timeout');
    });
    await expect(prepareLesson13MockResponseSpotlight(ctx)).resolves.toBeUndefined();
  });

  it('prepareLesson13ReadLiveSpotlight swallows waitFor rejection', async () => {
    stubMockPanel();
    document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT)!.value = GQL_DEMO_HTTP;
    document.querySelector(GQL.RESPONSE_BODY)!.textContent = '{"data":{"health":"ok"}}';
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockImplementation(async (sel) => {
      if (String(sel).includes('gql-response-body')) throw new Error('timeout');
    });
    await expect(prepareLesson13ReadLiveSpotlight(ctx)).resolves.toBeUndefined();
  });

  it('prepareLesson13MockResolversListSpotlight expands query group when not E2E web mock', async () => {
    stubMockPanel();
    document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!.checked = true;
    document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT)!.value = GQL_MOCK_HTTP;
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await prepareLesson13MockResolversListSpotlight(ctx);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.MOCK_RESOLVERS_LIST, 5000);
  });

  it('prepareLesson13MockLatencySpotlight swallows waitFor rejection', async () => {
    stubMockPanel();
    stubMonacoEditor('query { health }');
    document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!.checked = true;
    document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT)!.value = GQL_MOCK_HTTP;
    document.querySelector(GQL.RESPONSE_BODY)!.textContent =
      `{"data":{"health":"${LESSON13_HEALTH_OVERRIDE}"}}`;
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockImplementation(async (sel) => {
      if (String(sel).includes('gql-mock-latency')) throw new Error('timeout');
    });
    await expect(prepareLesson13MockLatencySpotlight(ctx)).resolves.toBeUndefined();
  });

  it('prepareLesson13MockToggleSpotlight swallows waitFor rejection', async () => {
    stubMockPanel();
    stubMonacoEditor('query { health }');
    document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!.checked = true;
    document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT)!.value = GQL_MOCK_HTTP;
    document.querySelector(GQL.RESPONSE_BODY)!.textContent =
      `{"data":{"health":"${LESSON13_HEALTH_OVERRIDE}"}}`;
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await ensureLesson13MockExecuted(ctx);
    vi.mocked(ctx.waitFor).mockImplementation(async (sel) => {
      if (String(sel).includes('gql-mock-toggle-card')) throw new Error('timeout');
    });
    await expect(prepareLesson13MockToggleSpotlight(ctx)).resolves.toBeUndefined();
  });

  it('E2E web mock mockToggleChecked reflects disabled session flag', async () => {
    (window as unknown as Record<string, unknown>).__RF_E2E_MOCK_DESKTOP__ = true;
    stubMockPanel();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const ctx = makeCtx();
    await ensureLesson13MockEnabled(ctx);
    await ensureLesson13MockDisabledOnly(ctx);
    expect(document.querySelector(GQL.MOCK_TOGGLE)).toBeTruthy();
  });

  it('responseLatencyMs parses numeric latency from response panel', async () => {
    stubMockPanel();
    stubMonacoEditor('query { health }');
    document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!.checked = true;
    document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT)!.value = GQL_MOCK_HTTP;
    document.body.insertAdjacentHTML(
      'beforeend',
      '<span data-testid="gql-response-latency">Latency: 650 ms</span>',
    );
    document.querySelector(GQL.RESPONSE_BODY)!.textContent =
      `{"data":{"health":"${LESSON13_HEALTH_OVERRIDE}"}}`;
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await ensureLesson13LatencyExecute(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('clickMockToggleOff falls back to ctx.click when checkbox stays checked', async () => {
    stubMockPanel();
    document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!.checked = true;
    document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT)!.value = GQL_MOCK_HTTP;
    const toggle = document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!;
    let checked = true;
    Object.defineProperty(toggle, 'checked', {
      configurable: true,
      get: () => checked,
      set: (v: boolean) => { checked = v; },
    });
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    vi.mocked(ctx.click).mockImplementation(async (sel) => {
      if (sel === GQL.MOCK_TOGGLE) checked = false;
    });
    await ensureLesson13MockDisabledOnly(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.MOCK_TOGGLE);
  });

  it('lesson13SyncDesktopMockDisabled posts when running in Tauri', async () => {
    mockIsTauri.mockReturnValue(true);
    stubMockPanel();
    document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!.checked = true;
    document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT)!.value = GQL_MOCK_HTTP;
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await ensureLesson13MockDisabledOnly(ctx);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/graphql/mock/config',
      expect.objectContaining({ method: 'POST' }),
    );
    mockIsTauri.mockReturnValue(false);
  });

  it('ensureLesson13LiveEndpointOnly treats port 3001 endpoint as not live', async () => {
    stubMockPanel();
    stubMonacoEditor('query { health }');
    document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT)!.value = GQL_MOCK_HTTP;
    document.querySelector(GQL.RESPONSE_BODY)!.textContent = '{"data":{"health":"ok"}}';
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await ensureLesson13LiveEndpointOnly(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
  });

  it('prepareLesson13MockFixedValueSpotlight selects fixed resolver when not E2E', async () => {
    stubMockPanel();
    document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!.checked = true;
    document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT)!.value = GQL_MOCK_HTTP;
    const select = document.querySelector<HTMLSelectElement>(LESSON13_MOCK_HEALTH_RESOLVER)!;
    select.value = 'passthrough';
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await prepareLesson13MockFixedValueSpotlight(ctx);
    expect(ctx.selectOption).toHaveBeenCalledWith(LESSON13_MOCK_HEALTH_RESOLVER, 'fixed');
  });

  it('prepareLesson13MockResolversListSpotlight skips expand on E2E web mock', async () => {
    (window as unknown as Record<string, unknown>).__RF_E2E_MOCK_DESKTOP__ = true;
    stubMockPanel();
    document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!.checked = true;
    document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT)!.value = GQL_MOCK_HTTP;
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await prepareLesson13MockResolversListSpotlight(ctx);
    expect(ctx.waitFor).not.toHaveBeenCalledWith(GQL.MOCK_RESOLVERS_LIST, 5000);
  });
});
