/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./graphql-lesson-helpers/gql-demo-tab', () => ({
  ensureGqlDemoTab: vi.fn(async () => 'demo-tab-1'),
  closeGqlDemoTabs: vi.fn(async () => {}),
}));

import {
  setupGraphqlFirstQueryBeforeEach,
} from './graphql-first-query.testHelpers';
import { gqlFirstQueryLesson } from './graphql-first-query';
import { makeCtx } from './ws-test-utils';
import { APP, EM, GQL } from '@shared/selectors';
import { GQL_DEMO_BASE_URL } from '../env-manager-lesson-helpers';
import {
  GQL_DEMO_VAR,
  GQL_HEALTH_QUERY,
  gqlFirstQuerySetup,
} from './graphql-lesson-helpers';
import { stubMonacoEditor } from './__test-utils__/graphql-test-fixtures';

describe('gql-first-query lesson', () => {
  beforeEach(() => {
    setupGraphqlFirstQueryBeforeEach();
  });

// ─── Structure & metadata ────────────────────────────────────

  it('has valid lesson structure', () => {
    expect(gqlFirstQueryLesson.id).toBe('gql-first-query');
    expect(gqlFirstQueryLesson.domainId).toBe('protocols');
    expect(gqlFirstQueryLesson.category).toBe('graphql');
    expect(gqlFirstQueryLesson.name).toBe('Your First GraphQL Query');
    expect(gqlFirstQueryLesson.steps.length).toBe(13);
    expect(gqlFirstQueryLesson.estimatedMinutes).toBe(7);
    expect(gqlFirstQueryLesson.initialTab).toBe('graphql-studio');
    expect(gqlFirstQueryLesson.tabBudget).toBe(1);
    expect(gqlFirstQueryLesson.concept.title).toBeTruthy();
    expect(gqlFirstQueryLesson.concept.body).toBeTruthy();
  });

  it('has docker prerequisite fields for port 4010 test server', () => {
    expect(gqlFirstQueryLesson.tag).toBe('🐳 Docker');
    expect(gqlFirstQueryLesson.dockerEndpoint).toContain('localhost:4010');
    expect(gqlFirstQueryLesson.dockerCommand).toContain('docker/graphql');
  });

  it('has setup and cleanup functions', () => {
    expect(typeof gqlFirstQueryLesson.setup).toBe('function');
    expect(typeof gqlFirstQueryLesson.cleanup).toBe('function');
  });

  it('has correct step IDs in order', () => {
    const ids = gqlFirstQueryLesson.steps.map((s) => s.id);
    expect(ids).toEqual([
      'gql1-intro',
      'gql1-add-protocol',
      'gql1-env-config',
      'gql1-header-select',
      'gql1-endpoint',
      'gql1-endpoint-resolved',
      'gql1-introspect',
      'gql1-schema',
      'gql1-write-query',
      'gql1-execute',
      'gql1-read-response',
      'gql1-response-metadata',
      'gql1-history',
    ]);
  });

  it('declares allowedTabs for environments and graphql-studio', () => {
    expect(gqlFirstQueryLesson.allowedTabs).toContain('environments');
    expect(gqlFirstQueryLesson.allowedTabs).toContain('graphql-studio');
  });

  it('all 13 steps have pauseAfter: true', () => {
    gqlFirstQueryLesson.steps.forEach((step) => {
      expect(step.pauseAfter).toBe(true);
    });
  });

  it('stateful steps 2–13 have preAction guards', () => {
    const stateful = gqlFirstQueryLesson.steps.slice(1);
    stateful.forEach((step) => {
      expect(step.preAction).toBeTypeOf('function');
    });
  });

  it('step gql1-intro has no preAction', () => {
    const step = gqlFirstQueryLesson.steps.find((s) => s.id === 'gql1-intro')!;
    expect(step.preAction).toBeUndefined();
  });

  it('concept keyTerms cover introspection, operation, schema, and history', () => {
    const terms = (gqlFirstQueryLesson.concept.keyTerms ?? []).map((t) => t.term);
    expect(terms).toContain('Introspection');
    expect(terms).toContain('Operation');
    expect(terms).toContain('Schema');
    expect(terms).toContain('History');
  });

  it('concept body mentions HTTP POST to explain GraphQL transport', () => {
    expect(gqlFirstQueryLesson.concept.body).toContain('HTTP POST');
  });

  it('concept diagram is 700×430 studio chrome SVG', () => {
    expect(gqlFirstQueryLesson.concept.diagram).toContain('viewBox="0 0 700 430"');
    expect(gqlFirstQueryLesson.concept.diagram).toContain('GraphQL Studio — RedfireForge');
  });

  it('concept diagram includes numbered callouts for the 5-step flow', () => {
    const diagram = gqlFirstQueryLesson.concept.diagram ?? '';
    expect(diagram).toContain('①');
    expect(diagram).toContain('②');
    expect(diagram).toContain('③');
    expect(diagram).toContain('④');
    expect(diagram).toContain('⑤');
  });

  it('step gql1-schema highlights schema tab (visible before panel opens)', () => {
    const step = gqlFirstQueryLesson.steps.find((s) => s.id === 'gql1-schema')!;
    expect(step.highlight).toBe(GQL.RIGHT_TAB_SCHEMA);
  });

  it('step gql1-execute highlights execute button', () => {
    const step = gqlFirstQueryLesson.steps.find((s) => s.id === 'gql1-execute')!;
    expect(step.highlight).toBe(GQL.EXECUTE_BTN);
  });

  it('step gql1-read-response highlights the response body panel', () => {
    const step = gqlFirstQueryLesson.steps.find((s) => s.id === 'gql1-read-response')!;
    expect(step.highlight).toBe(GQL.RESPONSE_BODY);
  });

  it('step gql1-response-metadata highlights the metadata tab', () => {
    const step = gqlFirstQueryLesson.steps.find((s) => s.id === 'gql1-response-metadata')!;
    expect(step.highlight).toBe(GQL.RV_TAB_METADATA);
  });

  it('step gql1-history highlights history activity button', () => {
    const step = gqlFirstQueryLesson.steps.find((s) => s.id === 'gql1-history')!;
    expect(step.highlight).toBe(GQL.ACTIVITY_HISTORY);
  });

  it('step gql1-execute description does not describe the response body (separated into gql1-read-response)', () => {
    const step = gqlFirstQueryLesson.steps.find((s) => s.id === 'gql1-execute')!;
    // The response body description belongs in gql1-read-response now
    expect(step.description).not.toContain('"health": "ok"');
  });

  it('step gql1-read-response description mentions "health": "ok" response data', () => {
    const step = gqlFirstQueryLesson.steps.find((s) => s.id === 'gql1-read-response')!;
    expect(step.description).toContain('"health": "ok"');
  });

  it('step gql1-response-metadata description explains GraphQL is HTTP POST', () => {
    const step = gqlFirstQueryLesson.steps.find((s) => s.id === 'gql1-response-metadata')!;
    expect(step.description).toContain('HTTP POST');
    expect(step.description).toContain('Content-Type');
  });

  it('step gql1-intro description mentions the "single endpoint" GraphQL concept', () => {
    const step = gqlFirstQueryLesson.steps.find((s) => s.id === 'gql1-intro')!;
    expect(step.description).toContain('single endpoint');
  });

  it('step gql1-add-protocol highlights add protocol button', () => {
    const step = gqlFirstQueryLesson.steps.find((s) => s.id === 'gql1-add-protocol')!;
    expect(step.highlight).toBe(EM.ADD_PROTOCOL_BTN);
    expect(step.description).toContain('GraphQL Demo');
    expect(step.description).toContain('graphql-demo');
    expect(step.description).toContain('no protocol tabs');
  });

  it('step gql1-env-config highlights graphql protocol tab', () => {
    const step = gqlFirstQueryLesson.steps.find((s) => s.id === 'gql1-env-config')!;
    expect(step.highlight).toBe(EM.PROTOCOL_TAB_GQL);
    expect(step.description).toContain('GraphQL Demo');
    expect(step.description).toContain('{{graphqlUrl}}');
    expect(step.description).toContain('no HTTP');
  });

  it('step gql1-endpoint-resolved highlights endpoint preview', () => {
    const step = gqlFirstQueryLesson.steps.find((s) => s.id === 'gql1-endpoint-resolved')!;
    expect(step.highlight).toBe(GQL.ENDPOINT_PREVIEW);
    expect(step.verify).toBe(GQL.ENDPOINT_PREVIEW);
    expect(step.description).toContain('Resolved');
  });

  it('step gql1-header-select highlights header selectors', () => {
    const step = gqlFirstQueryLesson.steps.find((s) => s.id === 'gql1-header-select')!;
    expect(step.highlight).toBe(APP.HEADER_SELECTORS);
    expect(step.description).toContain('{{graphqlUrl}}');
  });

  // ─── Step actions ────────────────────────────────────────────

  it('step gql1-add-protocol action prepares GraphQL-only graphql-demo microservice', async () => {
    const step = gqlFirstQueryLesson.steps.find((s) => s.id === 'gql1-add-protocol')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('environments');
    expect(ctx.click).toHaveBeenCalledWith('[data-testid="em-protocol-tab-graphql"]');
    expect(ctx.click).not.toHaveBeenCalledWith('[data-testid="em-protocol-tab-http"]');
  });

  it('step gql1-env-config action saves graphql endpoint via configureNamedGraphqlEndpoint', async () => {
    document.body.innerHTML = `
      <div class="env-manager"></div>
      <div data-env-name="GraphQL Demo"></div>
      <div data-svc-name="graphql-demo"></div>
      <div data-testid="microservice-protocol-panel">
        <button data-testid="em-protocol-tab-graphql">GraphQL</button>
        <table>
          <tr>
            <td><span class="em-env-chip">GraphQL Demo</span></td>
            <td><button data-testid="em-endpoint-edit-btn">Edit</button></td>
            <td><code class="em-url-text"></code></td>
          </tr>
        </table>
        <input data-testid="em-endpoint-edit-input" />
        <button data-testid="em-endpoint-save-btn">Save</button>
        <input data-testid="em-graphql-path-input" />
      </div>
      <div data-testid="derived-vars-graphql"></div>`;
    const step = gqlFirstQueryLesson.steps.find((s) => s.id === 'gql1-env-config')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith('[data-testid="em-endpoint-edit-input"]', GQL_DEMO_BASE_URL);
    expect(ctx.fill).toHaveBeenCalledWith(
      '[data-testid="microservice-protocol-panel"] [data-testid="em-graphql-path-input"]',
      '/graphql',
    );
    expect(ctx.waitFor).toHaveBeenCalledWith(EM.DERIVED_VARS_GQL, 5000);
  });

  it('step gql1-env-config verifies derived variables panel', () => {
    const step = gqlFirstQueryLesson.steps.find((s) => s.id === 'gql1-env-config')!;
    expect(step.verify).toBe(EM.DERIVED_VARS_GQL);
  });

  it('step gql1-env-config preAction prepares graphql tab via ensureGqlDemoProtocolReady', async () => {
    const step = gqlFirstQueryLesson.steps.find((s) => s.id === 'gql1-env-config')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('environments');
  });

  it('step gql1-header-select action selects GraphQL Demo and graphql-demo in header', async () => {
    document.body.innerHTML = `
      <select data-testid="header-env-select">
        <option value="">Select env</option>
        <option value="e1">GraphQL Demo</option>
      </select>
      <select data-testid="header-svc-select">
        <option value="">Select svc</option>
        <option value="s1">graphql-demo</option>
      </select>
      <input data-testid="gql-endpoint-input" />
    `;
    const step = gqlFirstQueryLesson.steps.find((s) => s.id === 'gql1-header-select')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.selectOption).toHaveBeenCalledWith(APP.HEADER_ENV_SELECT, 'e1');
    expect(ctx.selectOption).toHaveBeenCalledWith(APP.HEADER_SVC_SELECT, 's1');
  });

  it('step gql1-endpoint preAction ensures header context before filling endpoint', async () => {
    document.body.innerHTML = `
      <select data-testid="header-env-select">
        <option value="">Select env</option>
        <option value="e1">GraphQL Demo</option>
      </select>
      <select data-testid="header-svc-select">
        <option value="">Select svc</option>
        <option value="s1">graphql-demo</option>
      </select>
      <input data-testid="gql-endpoint-input" />
    `;
    const step = gqlFirstQueryLesson.steps.find((s) => s.id === 'gql1-endpoint')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('graphql-studio');
    expect(ctx.selectOption).toHaveBeenCalledWith(APP.HEADER_ENV_SELECT, 'e1');
  });

  it('step gql1-header-select preAction navigates to graphql studio before checking endpoint', async () => {
    document.body.innerHTML = '<input data-testid="gql-endpoint-input" />';
    const step = gqlFirstQueryLesson.steps.find((s) => s.id === 'gql1-header-select')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('graphql-studio');
    expect(ctx.navigateToTab).not.toHaveBeenCalledWith('environments');
  });

  it('step gql1-header-select preAction configures endpoint only when studio mount fails', async () => {
    const step = gqlFirstQueryLesson.steps.find((s) => s.id === 'gql1-header-select')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('graphql-studio');
    expect(ctx.navigateToTab).toHaveBeenCalledWith('environments');
  });

  it('step gql1-add-protocol preAction opens env manager with demo microservice expanded', async () => {
    const step = gqlFirstQueryLesson.steps.find((s) => s.id === 'gql1-add-protocol')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('environments');
  });

  it('step gql1-endpoint fills the {{graphqlUrl}} template', async () => {
    const step = gqlFirstQueryLesson.steps.find((s) => s.id === 'gql1-endpoint')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, GQL_DEMO_VAR);
  });

  it('step gql1-endpoint preAction waits for endpoint input', async () => {
    document.body.innerHTML = `
      <select data-testid="header-env-select">
        <option value="e1">GraphQL Demo</option>
      </select>
      <select data-testid="header-svc-select">
        <option value="s1">graphql-demo</option>
      </select>
      <input data-testid="gql-endpoint-input" />
    `;
    const step = gqlFirstQueryLesson.steps.find((s) => s.id === 'gql1-endpoint')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, 5000);
  });

  it('step gql1-endpoint-resolved preAction fills endpoint variable when missing', async () => {
    document.body.innerHTML = `
      <select data-testid="header-env-select">
        <option value="e1">GraphQL Demo</option>
      </select>
      <select data-testid="header-svc-select">
        <option value="s1">graphql-demo</option>
      </select>
      <input data-testid="gql-endpoint-input" value="" />
    `;
    const step = gqlFirstQueryLesson.steps.find((s) => s.id === 'gql1-endpoint-resolved')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, GQL_DEMO_VAR);
  });

  it('step gql1-endpoint-resolved preAction skips fill when variable already set', async () => {
    document.body.innerHTML = `
      <select data-testid="header-env-select">
        <option value="e1">GraphQL Demo</option>
      </select>
      <select data-testid="header-svc-select">
        <option value="s1">graphql-demo</option>
      </select>
      <input data-testid="gql-endpoint-input" value="{{graphqlUrl}}" />
    `;
    const step = gqlFirstQueryLesson.steps.find((s) => s.id === 'gql1-endpoint-resolved')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('step gql1-endpoint-resolved action waits for endpoint preview', async () => {
    const step = gqlFirstQueryLesson.steps.find((s) => s.id === 'gql1-endpoint-resolved')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.ENDPOINT_PREVIEW, 5000);
  });

  it('step gql1-introspect always clicks introspect and opens schema tab', async () => {
    const step = gqlFirstQueryLesson.steps.find((s) => s.id === 'gql1-introspect')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.SCHEMA_BADGE_OK, 25000);
    expect(ctx.click).toHaveBeenCalledWith(GQL.RIGHT_TAB_SCHEMA);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.SCHEMA_EXPLORER, 5000);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.SCHEMA_TYPE_LIST, 5000);
  });

  it('step gql1-introspect still clicks introspect when badge already present', async () => {
    document.body.innerHTML = '<div data-testid="gql-schema-badge-ok"></div>';
    const step = gqlFirstQueryLesson.steps.find((s) => s.id === 'gql1-introspect')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
    expect(ctx.click).toHaveBeenCalledWith(GQL.RIGHT_TAB_SCHEMA);
  });

  it('step gql1-schema switches to schema tab', async () => {
    const step = gqlFirstQueryLesson.steps.find((s) => s.id === 'gql1-schema')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.RIGHT_TAB_SCHEMA);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.SCHEMA_EXPLORER, 5000);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.SCHEMA_TYPE_LIST, 5000);
  });

  it('step gql1-execute clicks execute and waits for response', async () => {
    const step = gqlFirstQueryLesson.steps.find((s) => s.id === 'gql1-execute')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.RESPONSE_VIEWER, 15000);
  });

  it('step gql1-read-response clicks response tab and waits for response body', async () => {
    const step = gqlFirstQueryLesson.steps.find((s) => s.id === 'gql1-read-response')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.RIGHT_TAB_RESPONSE);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.RESPONSE_BODY, 5000);
  });

  it('step gql1-read-response uses ensureExecuted as preAction guard', async () => {
    document.body.innerHTML = `
      <span data-testid="gql-schema-badge-ok"></span>
      <div data-testid="gql-response-viewer"></div>
    `;
    stubMonacoEditor('query { health }');
    const step = gqlFirstQueryLesson.steps.find((s) => s.id === 'gql1-read-response')!;
    const ctx = makeCtx();
    // First call warms session flags (Execute fires once to complete state)
    await step.preAction!(ctx);
    vi.mocked(ctx.click).mockClear();
    // Second call: state already set — Execute should not be called again
    await step.preAction!(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('step gql1-response-metadata clicks metadata tab and waits for metadata panel', async () => {
    const step = gqlFirstQueryLesson.steps.find((s) => s.id === 'gql1-response-metadata')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.RV_TAB_METADATA);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.RV_METADATA, 5000);
  });

  it('step gql1-response-metadata uses ensureExecuted as preAction guard', async () => {
    document.body.innerHTML = `
      <span data-testid="gql-schema-badge-ok"></span>
      <div data-testid="gql-response-viewer"></div>
    `;
    stubMonacoEditor('query { health }');
    const step = gqlFirstQueryLesson.steps.find((s) => s.id === 'gql1-response-metadata')!;
    const ctx = makeCtx();
    // First call warms session flags
    await step.preAction!(ctx);
    vi.mocked(ctx.click).mockClear();
    // Second call: guard should skip Execute
    await step.preAction!(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('step gql1-history opens history panel and waits for entry', async () => {
    const step = gqlFirstQueryLesson.steps.find((s) => s.id === 'gql1-history')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.ACTIVITY_HISTORY);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.HISTORY_PANEL, 5000);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.HISTORY_ENTRY, 5000);
  });

  it('step gql1-write-query ensures editor mode before filling', async () => {
    document.body.innerHTML = `
      <button data-testid="gql-mode-editor" class="gql-mode-btn"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
    `;
    const w = window as unknown as { monaco: { editor: { getModels: () => unknown[] } } };
    const setValue = vi.fn();
    w.monaco = {
      editor: {
        getModels: () => [{ uri: { toString: () => 'inmemory://graphql/tab-1' }, getValue: () => '', setValue }],
      },
    };
    const step = gqlFirstQueryLesson.steps.find((s) => s.id === 'gql1-write-query')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.MODE_EDITOR);
    expect(setValue).toHaveBeenCalledWith(GQL_HEALTH_QUERY);
  });

  it('step gql1-write-query preAction activates editor mode when editor button is inactive', async () => {
    document.body.innerHTML = '<button data-testid="gql-mode-editor" class="gql-mode-btn"></button>';
    const step = gqlFirstQueryLesson.steps.find((s) => s.id === 'gql1-write-query')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.MODE_EDITOR);
    expect(ctx.click).toHaveBeenCalledWith(GQL.RIGHT_TAB_RESPONSE);
  });

  it('step gql1-write-query preAction skips editor click when editor button is already active', async () => {
    document.body.innerHTML = '<button data-testid="gql-mode-editor" class="gql-mode-btn gql-mode-btn--active"></button>';
    const step = gqlFirstQueryLesson.steps.find((s) => s.id === 'gql1-write-query')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    const editorClicks = (ctx.click as ReturnType<typeof vi.fn>).mock.calls
      .map((c: string[]) => c[0])
      .filter((sel: string) => sel === GQL.MODE_EDITOR);
    expect(editorClicks.length).toBe(0);
    expect(ctx.click).toHaveBeenCalledWith(GQL.RIGHT_TAB_RESPONSE);
  });

  it('step gql1-write-query preAction is resilient when editor button is missing', async () => {
    const step = gqlFirstQueryLesson.steps.find((s) => s.id === 'gql1-write-query')!;
    const ctx = makeCtx();
    await expect(step.preAction!(ctx)).resolves.not.toThrow();
    expect(ctx.click).toHaveBeenCalledWith(GQL.RIGHT_TAB_RESPONSE);
  });

  // ─── Setup ───────────────────────────────────────────────────

  it('setup creates demo tab and resets editor query', async () => {
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://old" />
      <button data-testid="gql-mode-editor" class="gql-mode-btn gql-mode-btn--active"></button>
      <button data-testid="gql-right-tab-response" aria-selected="true"></button>
      <div data-testid="gql-editor"></div>
    `;
    const setValue = vi.fn();
    const w = window as unknown as { monaco: { editor: { getModels: () => unknown[] } } };
    w.monaco = {
      editor: {
        getModels: () => [{ uri: { toString: () => 'inmemory://graphql/tab-1' }, getValue: () => 'old', setValue }],
      },
    };
    const ctx = makeCtx();
    await gqlFirstQuerySetup(ctx);
    expect(setValue).toHaveBeenCalledWith('query { }');
  });
});
