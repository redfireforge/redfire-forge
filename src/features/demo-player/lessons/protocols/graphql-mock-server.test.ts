/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./graphql-lesson-helpers/gql-demo-tab', () => ({
  ensureGqlDemoTab: vi.fn(async () => 'demo-tab-gql13'),
  closeGqlDemoTabs: vi.fn(async () => {}),
}));

import { gqlMockServerLesson } from './graphql-mock-server';
import { ensureGqlDemoTab, closeGqlDemoTabs } from './graphql-lesson-helpers/gql-demo-tab';
import { makeCtx } from './ws-test-utils';
import { GQL } from '../../../../shared/selectors';
import {
  GQL_DEMO_HTTP,
  GQL_MOCK_HTTP,
  LESSON13_HEALTH_OVERRIDE,
  LESSON13_MOCK_HEALTH_FIXED,
  LESSON13_MOCK_HEALTH_RESOLVER,
  ensureLesson13LatencyExecute,
  ensureLesson13LiveEndpointOnly,
  ensureLesson13LiveEndpointRestored,
  ensureLesson13MockDisabledOnly,
  ensureLesson13HealthOverrideConfigured,
  ensureLesson13MockEnabled,
  ensureLesson13MockExecuted,
  ensureLesson13MockPanelOpen,
  gqlMockServerLessonSetup,
  gqlMockServerLessonCleanup,
  ensureLesson13MockEndpointIntrospected,
  prepareLesson13MockFixedValueSpotlight,
  prepareLesson13MockHealthSpotlight,
  prepareLesson13MockLatencySpotlight,
  prepareLesson13MockResolversListSpotlight,
  prepareLesson13MockResponseSpotlight,
  prepareLesson13MockSchemaSourceSpotlight,
  prepareLesson13ReadLiveSpotlight,
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
      <div data-testid="gql-mock-schema-source">Introspected SDL</div>
      <div data-testid="gql-mock-resolvers-list">
        <div data-testid="gql-mock-type-group">
          <button data-testid="gql-mock-type-header">Query</button>
          <div data-testid="gql-mock-field-row" data-lesson-target="mock-health">
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

/** Jsdom has no real GraphQL server — simulate live `health: ok` on Execute. */
function mockLesson13LiveExecute(
  ctx: ReturnType<typeof makeCtx>,
  onClick?: (selector: string) => void | Promise<void>,
): void {
  vi.mocked(ctx.click).mockImplementation(async (selector: string) => {
    if (selector === GQL.EXECUTE_BTN) {
      document.querySelector(GQL.RESPONSE_BODY)!.textContent = '{"data":{"health":"ok"}}';
    }
    if (onClick) await onClick(selector);
  });
}

describe('gql-mock-server lesson', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetGqlLessonSessionFlags();
    resetGqlLesson13SessionFlags();
    delete (window as unknown as Record<string, unknown>).__RF_E2E_MOCK_DESKTOP__;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ── Lesson structure ───────────────────────────────────────────────────────

  it('has valid lesson structure', () => {
    expect(gqlMockServerLesson.id).toBe('gql-mock-server');
    expect(gqlMockServerLesson.category).toBe('graphql');
    expect(gqlMockServerLesson.name).toBe('Mock Server');
    expect(gqlMockServerLesson.steps.length).toBe(15);
    expect(gqlMockServerLesson.estimatedMinutes).toBe(6);
    expect(gqlMockServerLesson.tabBudget).toBe(1);
  });

  it('has docker prerequisite fields', () => {
    expect(gqlMockServerLesson.dockerEndpoint).toContain('localhost:4010');
    expect(gqlMockServerLesson.tag).toBe('🐳 Docker · 🖥 Desktop');
    expect(gqlMockServerLesson.desktopOnly).toBe(true);
  });

  it('has correct step IDs in order', () => {
    expect(gqlMockServerLesson.steps.map((s) => s.id)).toEqual([
      'gql13-open-mock',
      'gql13-enable-mock',
      'gql13-schema-source',
      'gql13-mock-endpoint',
      'gql13-mock-introspect',
      'gql13-resolver-fixed',
      'gql13-fixed-value',
      'gql13-resolver-types',
      'gql13-execute-mock',
      'gql13-observe-response',
      'gql13-latency-slider',
      'gql13-observe-latency',
      'gql13-disable-mock',
      'gql13-restore-endpoint',
      'gql13-read-live',
    ]);
  });

  it('all 15 steps have pauseAfter: true', () => {
    gqlMockServerLesson.steps.forEach((step) => {
      expect(step.pauseAfter).toBe(true);
    });
  });

  it('stateful steps have preAction guards except the intro step', () => {
    gqlMockServerLesson.steps.slice(1).forEach((step) => {
      expect(step.preAction).toBeTypeOf('function');
    });
  });

  // ── Concept content ────────────────────────────────────────────────────────

  it('concept title positions mock as test-without-backend feature', () => {
    expect(gqlMockServerLesson.concept.title).toContain('Mock Server');
    expect(gqlMockServerLesson.concept.title).toContain('Test Without');
  });

  it('concept body explains WHY local proxy beats shared test servers', () => {
    expect(gqlMockServerLesson.concept.body).toContain('deterministic');
    expect(gqlMockServerLesson.concept.body).toContain('flaky');
  });

  it('concept body explains WHY introspection is required first', () => {
    expect(gqlMockServerLesson.concept.body).toContain('contract');
    expect(gqlMockServerLesson.concept.body).toContain('introspect');
  });

  it('concept body explains all four resolver types', () => {
    expect(gqlMockServerLesson.concept.body).toContain('Random');
    expect(gqlMockServerLesson.concept.body).toContain('Fixed');
    expect(gqlMockServerLesson.concept.body).toContain('Error');
    expect(gqlMockServerLesson.concept.body).toContain('Script');
  });

  it('concept body explains WHY latency simulation is important', () => {
    expect(gqlMockServerLesson.concept.body).toContain('loading spinner');
    expect(gqlMockServerLesson.concept.body).toContain('skeleton screen');
  });

  it('concept body explains WHY mock is desktop-only', () => {
    expect(gqlMockServerLesson.concept.body).toContain('TCP');
    expect(gqlMockServerLesson.concept.body).toContain('Tauri');
  });

  it('has exactly 5 key terms', () => {
    expect(gqlMockServerLesson.concept.keyTerms.length).toBe(5);
  });

  it('key terms cover: Mock mode, Resolver override, Schema source, Latency simulation, Mock endpoint', () => {
    const terms = gqlMockServerLesson.concept.keyTerms.map((k) => k.term);
    expect(terms).toContain('Mock mode');
    expect(terms).toContain('Resolver override');
    expect(terms).toContain('Schema source');
    expect(terms).toContain('Latency simulation');
    expect(terms).toContain('Mock endpoint');
  });

  it('Mock endpoint key term contains the mock URL', () => {
    const term = gqlMockServerLesson.concept.keyTerms.find((k) => k.term === 'Mock endpoint')!;
    expect(term.definition).toContain('3001');
  });

  it('Resolver override key term explains all override types', () => {
    const term = gqlMockServerLesson.concept.keyTerms.find((k) => k.term === 'Resolver override')!;
    expect(term.definition).toContain('Fixed');
    expect(term.definition).toContain('Error');
  });

  // ── Diagram ────────────────────────────────────────────────────────────────

  it('diagram has 700x430 studio chrome dimensions', () => {
    expect(gqlMockServerLesson.concept.diagram).toContain('viewBox="0 0 700 430"');
  });

  it('diagram includes window chrome traffic lights', () => {
    expect(gqlMockServerLesson.concept.diagram).toContain('#ff5f57');
    expect(gqlMockServerLesson.concept.diagram).toContain('#febc2e');
    expect(gqlMockServerLesson.concept.diagram).toContain('#28c840');
  });

  it('diagram shows mock endpoint in connection bar', () => {
    expect(gqlMockServerLesson.concept.diagram).toContain('localhost:3001/api/graphql/mock');
    expect(gqlMockServerLesson.concept.diagram).toContain('Mock');
  });

  it('diagram shows mock panel with toggle card and Mock active badge', () => {
    expect(gqlMockServerLesson.concept.diagram).toContain('Mock mode ON');
    expect(gqlMockServerLesson.concept.diagram).toContain('Mock active');
    expect(gqlMockServerLesson.concept.diagram).toContain('Mock server');
  });

  it('diagram shows Fixed resolver on health field', () => {
    expect(gqlMockServerLesson.concept.diagram).toContain('health');
    expect(gqlMockServerLesson.concept.diagram).toContain('Fixed');
    expect(gqlMockServerLesson.concept.diagram).toContain('mock-ok');
  });

  it('diagram shows latency slider at 650ms', () => {
    expect(gqlMockServerLesson.concept.diagram).toContain('650 ms');
    expect(gqlMockServerLesson.concept.diagram).toContain('RESPONSE TIMING');
  });

  it('diagram shows response body with mock-ok value', () => {
    expect(gqlMockServerLesson.concept.diagram).toContain('"health"');
    expect(gqlMockServerLesson.concept.diagram).toContain('"mock-ok"');
    expect(gqlMockServerLesson.concept.diagram).toContain('Fixed resolver value');
  });

  it('diagram includes bottom pipeline legend', () => {
    expect(gqlMockServerLesson.concept.diagram).toContain('Enable');
    expect(gqlMockServerLesson.concept.diagram).toContain('Restore');
    expect(gqlMockServerLesson.concept.diagram).toContain('live :4010');
  });

  // ── Step spotlights (all 15) ───────────────────────────────────────────────

  it('gql13-open-mock highlights ACTIVITY_MOCK', () => {
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-open-mock')!;
    expect(step.highlight).toBe(GQL.ACTIVITY_MOCK);
  });

  it('gql13-enable-mock highlights MOCK_TOGGLE_CARD', () => {
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-enable-mock')!;
    expect(step.highlight).toBe(GQL.MOCK_TOGGLE_CARD);
  });

  it('gql13-schema-source highlights MOCK_SCHEMA_SOURCE', () => {
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-schema-source')!;
    expect(step.highlight).toBe(GQL.MOCK_SCHEMA_SOURCE);
  });

  it('gql13-mock-endpoint highlights ENDPOINT_INPUT', () => {
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-mock-endpoint')!;
    expect(step.highlight).toBe(GQL.ENDPOINT_INPUT);
  });

  it('gql13-mock-introspect highlights INTROSPECT_BTN', () => {
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-mock-introspect')!;
    expect(step.highlight).toBe(GQL.INTROSPECT_BTN);
  });

  it('gql13-resolver-fixed highlights health resolver select', () => {
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-resolver-fixed')!;
    expect(step.highlight).toBe(LESSON13_MOCK_HEALTH_RESOLVER);
  });

  it('gql13-fixed-value highlights health fixed input', () => {
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-fixed-value')!;
    expect(step.highlight).toBe(LESSON13_MOCK_HEALTH_FIXED);
  });

  it('gql13-resolver-types highlights MOCK_RESOLVERS_LIST', () => {
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-resolver-types')!;
    expect(step.highlight).toBe(GQL.MOCK_RESOLVERS_LIST);
  });

  it('gql13-execute-mock highlights EXECUTE_BTN', () => {
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-execute-mock')!;
    expect(step.highlight).toBe(GQL.EXECUTE_BTN);
  });

  it('gql13-observe-response highlights RESPONSE_BODY', () => {
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-observe-response')!;
    expect(step.highlight).toBe(GQL.RESPONSE_BODY);
  });

  it('gql13-latency-slider highlights MOCK_LATENCY_SLIDER', () => {
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-latency-slider')!;
    expect(step.highlight).toBe(GQL.MOCK_LATENCY_SLIDER);
  });

  it('gql13-observe-latency highlights EXECUTE_BTN', () => {
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-observe-latency')!;
    expect(step.highlight).toBe(GQL.EXECUTE_BTN);
  });

  it('gql13-disable-mock highlights MOCK_TOGGLE_CARD', () => {
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-disable-mock')!;
    expect(step.highlight).toBe(GQL.MOCK_TOGGLE_CARD);
  });

  it('gql13-restore-endpoint highlights ENDPOINT_INPUT', () => {
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-restore-endpoint')!;
    expect(step.highlight).toBe(GQL.ENDPOINT_INPUT);
  });

  it('gql13-read-live highlights RESPONSE_BODY', () => {
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-read-live')!;
    expect(step.highlight).toBe(GQL.RESPONSE_BODY);
  });

  // ── Step descriptions WHY content ─────────────────────────────────────────

  it('gql13-open-mock description explains WHY mock has its own panel', () => {
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-open-mock')!;
    expect(step.description).toContain('dedicated activity panel');
  });

  it('gql13-enable-mock description explains WHY toggle matters', () => {
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-enable-mock')!;
    expect(step.description).toContain('3001');
    expect(step.description).toContain('listening');
  });

  it('gql13-schema-source description explains WHY schema source is needed', () => {
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-schema-source')!;
    expect(step.description).toContain('Introspected SDL');
    expect(step.description).toContain('validates');
  });

  it('gql13-mock-endpoint description explains endpoint comes before introspect', () => {
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-mock-endpoint')!;
    expect(step.description).toContain('3001');
    expect(step.description).toContain('next step');
  });

  it('gql13-mock-introspect description explains introspect after URL change', () => {
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-mock-introspect')!;
    expect(step.description).toContain('Introspect');
    expect(step.description).toContain('schema');
  });

  it('gql13-resolver-fixed description explains splitting type from value', () => {
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-resolver-fixed')!;
    expect(step.description).toContain('dropdown');
    expect(step.description).toContain('Fixed');
  });

  it('gql13-fixed-value description explains WHY Fixed beats Random', () => {
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-fixed-value')!;
    expect(step.description).toContain('deterministic');
    expect(step.description).toContain('mock-ok');
  });

  it('gql13-resolver-types description explains all four types', () => {
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-resolver-types')!;
    expect(step.description).toContain('Random');
    expect(step.description).toContain('Fixed');
    expect(step.description).toContain('Error');
    expect(step.description).toContain('Script');
  });

  it('gql13-execute-mock description explains WHY execute comes after override', () => {
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-execute-mock')!;
    expect(step.description).toContain('proof step');
    expect(step.description).toContain('end-to-end');
  });

  it('gql13-observe-response description explains WHY mock-ok is the key proof', () => {
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-observe-response')!;
    expect(step.description).toContain('mock-ok');
    expect(step.description).toContain('sentinel');
  });

  it('gql13-latency-slider description explains slider before execute', () => {
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-latency-slider')!;
    expect(step.description).toContain('650');
    expect(step.description).toContain('slider');
  });

  it('gql13-observe-latency description explains WHY latency simulation matters', () => {
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-observe-latency')!;
    expect(step.description).toContain('Loading spinners');
    expect(step.description).toContain('skeleton screens');
  });

  it('gql13-disable-mock description explains disable before restore', () => {
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-disable-mock')!;
    expect(step.description).toContain('OFF');
    expect(step.description).toContain('endpoint');
  });

  it('gql13-restore-endpoint description explains live URL restore', () => {
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-restore-endpoint')!;
    expect(step.description).toContain('4010');
    expect(step.description).toContain('Docker');
  });

  it('gql13-read-live description explains closing proof with live ok', () => {
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-read-live')!;
    expect(step.description).toContain('mock-ok');
    expect(step.description).toContain('"ok"');
  });

  // ── Verify selectors ───────────────────────────────────────────────────────

  it('gql13-enable-mock verify selector includes MOCK_STATUS_ROW', () => {
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-enable-mock')!;
    expect(step.verify).toContain(GQL.MOCK_STATUS_ROW);
    expect(step.verify).toContain(GQL.MOCK_GUARD);
  });

  it('gql13-mock-introspect verify selector is SCHEMA_BADGE_OK', () => {
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-mock-introspect')!;
    expect(step.verify).toBe(GQL.SCHEMA_BADGE_OK);
  });

  it('gql13-execute-mock verify selector is RESPONSE_BODY', () => {
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-execute-mock')!;
    expect(step.verify).toBe(GQL.RESPONSE_BODY);
  });

  it('gql13-observe-latency verify selector is RESPONSE_LATENCY', () => {
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-observe-latency')!;
    expect(step.verify).toBe(GQL.RESPONSE_LATENCY);
  });

  // ── Step actions ───────────────────────────────────────────────────────────

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
    expect(toggle.checked).toBe(true);
  });

  it('gql13-schema-source action calls delay (observation step)', async () => {
    const ctx = makeCtx();
    stubMockDom();
    const toggle = document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!;
    vi.mocked(ctx.click).mockImplementation(async (selector: string) => {
      if (selector === GQL.MOCK_TOGGLE) toggle.checked = true;
    });
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-schema-source')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.delay).toHaveBeenCalled();
  });

  it('gql13-mock-endpoint points to the mock URL only', async () => {
    const ctx = makeCtx();
    stubMockDom();
    const toggle = document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!;
    vi.mocked(ctx.click).mockImplementation(async (selector: string) => {
      if (selector === GQL.MOCK_TOGGLE) toggle.checked = true;
    });
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-mock-endpoint')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, GQL_MOCK_HTTP);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
  });

  it('gql13-mock-introspect introspects after endpoint is set', async () => {
    const ctx = makeCtx();
    stubMockDom();
    const toggle = document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!;
    vi.mocked(ctx.click).mockImplementation(async (selector: string) => {
      if (selector === GQL.MOCK_TOGGLE) toggle.checked = true;
    });
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-mock-introspect')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
  });

  it('gql13-resolver-fixed selects fixed on health row', async () => {
    const ctx = makeCtx();
    stubMockDom();
    const toggle = document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!;
    vi.mocked(ctx.click).mockImplementation(async (selector: string) => {
      if (selector === GQL.MOCK_TOGGLE) toggle.checked = true;
    });
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-resolver-fixed')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.selectOption).toHaveBeenCalledWith(LESSON13_MOCK_HEALTH_RESOLVER, 'fixed');
  });

  it('gql13-fixed-value fills the health fixed input', async () => {
    const ctx = makeCtx();
    stubMockDom();
    const toggle = document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!;
    vi.mocked(ctx.click).mockImplementation(async (selector: string) => {
      if (selector === GQL.MOCK_TOGGLE) toggle.checked = true;
    });
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-fixed-value')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(
      LESSON13_MOCK_HEALTH_FIXED,
      `"${LESSON13_HEALTH_OVERRIDE}"`,
    );
  });

  it('gql13-resolver-types action calls delay (observation step)', async () => {
    const ctx = makeCtx();
    stubMockDom();
    const toggle = document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!;
    vi.mocked(ctx.click).mockImplementation(async (selector: string) => {
      if (selector === GQL.MOCK_TOGGLE) toggle.checked = true;
    });
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-resolver-types')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.delay).toHaveBeenCalled();
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

  it('gql13-observe-response action calls delay (observation step)', async () => {
    const ctx = makeCtx();
    stubMockDom();
    stubMonacoEditor();
    const toggle = document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!;
    vi.mocked(ctx.click).mockImplementation(async (selector: string) => {
      if (selector === GQL.MOCK_TOGGLE) toggle.checked = true;
    });
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-observe-response')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.delay).toHaveBeenCalled();
  });

  it('gql13-latency-slider changes the mock slider without execute', async () => {
    const ctx = makeCtx();
    stubMockDom();
    stubMonacoEditor();
    const toggle = document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!;
    const slider = document.querySelector<HTMLInputElement>(GQL.MOCK_LATENCY_SLIDER)!;
    vi.mocked(ctx.click).mockImplementation(async (selector: string) => {
      if (selector === GQL.MOCK_TOGGLE) toggle.checked = true;
    });
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-latency-slider')!;
    await step.preAction!(ctx);
    vi.mocked(ctx.click).mockClear();
    await step.action!(ctx);
    expect(slider.value).toBe('650');
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('gql13-observe-latency re-executes after slider change', async () => {
    const ctx = makeCtx();
    stubMockDom();
    stubMonacoEditor();
    const toggle = document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!;
    vi.mocked(ctx.click).mockImplementation(async (selector: string) => {
      if (selector === GQL.MOCK_TOGGLE) toggle.checked = true;
    });
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-observe-latency')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('gql13-disable-mock toggles mock off', async () => {
    const ctx = makeCtx();
    stubMockDom();
    stubMonacoEditor();
    const toggle = document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!;
    toggle.checked = true;
    vi.mocked(ctx.click).mockImplementation(async (selector: string) => {
      if (selector === GQL.MOCK_TOGGLE) toggle.checked = !toggle.checked;
    });
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-disable-mock')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(toggle.checked).toBe(false);
  });

  it('gql13-disable-mock verify waits for mock panel not status row', () => {
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-disable-mock')!;
    expect(step.verify).toContain(GQL.MOCK_PANEL);
    expect(step.verify).not.toContain(GQL.MOCK_STATUS_ROW);
  });

  it('gql13-restore-endpoint restores live endpoint without re-disabling mock', async () => {
    const ctx = makeCtx();
    stubMockDom();
    stubMonacoEditor();
    const toggle = document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!;
    toggle.checked = false;
    document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT)!.value = GQL_MOCK_HTTP;
    mockLesson13LiveExecute(ctx);
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-restore-endpoint')!;
    await step.preAction!(ctx);
    vi.mocked(ctx.click).mockClear();
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, 'http://localhost:4010/graphql');
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.MOCK_TOGGLE);
  });

  it('gql13-read-live action calls delay (observation step)', async () => {
    const ctx = makeCtx();
    stubMockDom();
    stubMonacoEditor();
    const toggle = document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!;
    mockLesson13LiveExecute(ctx, (selector) => {
      if (selector === GQL.MOCK_TOGGLE) toggle.checked = !toggle.checked;
    });
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-read-live')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.delay).toHaveBeenCalled();
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
    expect(closeGqlDemoTabs).toHaveBeenCalledWith(ctx, 'gql-mock-server');
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
