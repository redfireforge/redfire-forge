/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ApiMockPredicateGroupV1, ApiMockServerDefinitionV1 } from '../../shared/api-mock/contracts';
import { DEFAULT_SETTINGS, createDefaultResponse } from '../../shared/api-mock/defaults';
import { createRoute } from './apiMockStudioFactory';
import { useDemoApiMockRoutePatch } from './useDemoApiMockRoutePatch';

const features = vi.hoisted(() => ({ enabled: true }));
vi.mock('../../config/features', () => ({
  get DEMO_HUB_ENABLED() { return features.enabled; },
}));

type Patch = {
  path?: string;
  pathKind?: 'exact' | 'parameterized' | 'glob' | 'regex';
  body?: string;
  contentType?: string;
  status?: number;
  reasonPhrase?: string;
  priority?: number;
  predicates?: ApiMockPredicateGroupV1;
  responseMode?: 'rules' | 'sequence' | 'weighted' | 'state';
  addVariant?: boolean;
  variantIndex?: number;
  variantName?: string;
  variantConditions?: ApiMockPredicateGroupV1;
  isDefault?: boolean;
  transition?: { currentState?: string; targetState: string; counterUpdates?: Array<{ key: string; delta: number }> };
  weight?: number;
  behavior?: {
    delayMs?: number;
    jitterMs?: number;
    maxMatches?: number | null;
    expiresAt?: string | null;
    probability?: number | null;
    fault?: 'none' | 'timeout' | 'close' | 'reset' | 'malformed' | 'dribble';
    longRunningMs?: number | null;
    chunkSchedule?: Array<{ afterMs: number; body: string }> | null;
  };
};
type PatchFn = (patch: Patch) => boolean;

function bridge(): PatchFn | undefined {
  return (window as unknown as { __demoPatchApiMockActiveRoute?: PatchFn }).__demoPatchApiMockActiveRoute;
}

function makeServer(routes: ApiMockServerDefinitionV1['routes']): ApiMockServerDefinitionV1 {
  return {
    id: 'srv-a',
    name: 'SRV-A',
    enabled: true,
    host: '127.0.0.1',
    port: 4600,
    basePath: '',
    folders: [],
    routes,
    samples: [],
    variables: [],
    settings: { ...DEFAULT_SETTINGS },
    createdAt: '2026-08-13T00:00:00.000Z',
    updatedAt: '2026-08-13T00:00:00.000Z',
  };
}

function setup(options: { server?: ApiMockServerDefinitionV1 | null; selectedRouteId?: string } = {}) {
  const server = options.server === undefined ? makeServer([createRoute('List users')]) : options.server;
  const state = { servers: server ? [server] : [], activeServerId: server ? server.id : undefined };
  const setServers = vi.fn((update: unknown) => {
    state.servers = (update as (prev: ApiMockServerDefinitionV1[]) => ApiMockServerDefinitionV1[])(state.servers);
  });
  const rendered = renderHook(() => useDemoApiMockRoutePatch({
    getState: () => state,
    selectedRouteId: options.selectedRouteId,
    setServers: setServers as never,
  }));
  return { rendered, state, setServers, route: server?.routes[0] };
}

describe('useDemoApiMockRoutePatch', () => {
  beforeEach(() => {
    features.enabled = true;
    delete (window as unknown as Record<string, unknown>).__demoPatchApiMockActiveRoute;
    delete (window as unknown as Record<string, unknown>).__demoPatchApiMockServerSettings;
  });

  it('does not mount the bridge outside Learning Hub builds', () => {
    features.enabled = false;
    setup();
    expect(bridge()).toBeUndefined();
  });

  it('patches status, reason phrase, and Content-Type without forcing JSON', () => {
    const { state } = setup();
    expect(bridge()?.({
      status: 201,
      reasonPhrase: 'Resource created',
      contentType: 'text/html',
      body: '<h1>ok</h1>',
    })).toBe(true);

    const variant = state.servers[0].routes[0].responses[0];
    expect(variant.status).toBe(201);
    expect(variant.reasonPhrase).toBe('Resource created');
    expect(variant.body).toMatchObject({
      kind: 'html',
      contentType: 'text/html',
      content: '<h1>ok</h1>',
    });
  });

  it('a body-only patch still forces JSON so existing lessons stay coherent', () => {
    const { state } = setup();
    expect(bridge()?.({ path: '/users/:id', priority: 42, body: '{"ok":true}' })).toBe(true);
    const route = state.servers[0].routes[0];
    expect(route.path).toMatchObject({ value: '/users/:id', kind: 'parameterized' });
    expect(route.priority).toBe(42);
    expect(route.responses[0].body).toMatchObject({
      kind: 'json',
      contentType: 'application/json',
      content: '{"ok":true}',
    });
  });

  it('content-type-only patches the kind without rewriting the body', () => {
    const { state } = setup();
    const before = state.servers[0].routes[0].responses[0].body.content;
    expect(bridge()?.({ contentType: 'application/octet-stream' })).toBe(true);
    expect(state.servers[0].routes[0].responses[0].body).toMatchObject({
      kind: 'binary_base64',
      contentType: 'application/octet-stream',
      content: before,
    });
  });

  it('honours an explicit path kind and leaves untouched fields alone', () => {
    const { state, route } = setup();
    expect(bridge()?.({ path: '^/v1/.*$', pathKind: 'regex' })).toBe(true);

    const patched = state.servers[0].routes[0];
    expect(patched.path).toMatchObject({ value: '^/v1/.*$', kind: 'regex' });
    expect(patched.priority).toBe(route?.priority);
  });

  it('replaces the whole match group so a replayed lesson step cannot stack rows', () => {
    const { state } = setup();
    const predicates: ApiMockPredicateGroupV1 = {
      id: 'grp-demo',
      combinator: 'all',
      children: [{ id: 'pred-demo', source: 'query', selector: 'page', operator: 'exact', expected: '2' }],
    };

    expect(bridge()?.({ predicates })).toBe(true);

    const patched = state.servers[0].routes[0].predicates;
    expect(patched).toEqual(predicates);
    // Cloned, so a later edit in the Studio cannot mutate the lesson's template.
    expect(patched).not.toBe(predicates);
  });

  it('patches the active server selection policy without touching routes', () => {
    const { state } = setup();
    const settingsFn = (window as unknown as {
      __demoPatchApiMockServerSettings?: (patch: {
        multipleMatchPolicy?: 'highest_priority' | 'reject_multiple';
        equalPriorityPolicy?: 'specificity_then_id' | 'reject';
        ambiguityBody?: string;
      }) => boolean;
    }).__demoPatchApiMockServerSettings;

    expect(settingsFn?.({
      multipleMatchPolicy: 'reject_multiple',
      equalPriorityPolicy: 'specificity_then_id',
      ambiguityBody: '{"error":"catalog_ambiguous"}',
    })).toBe(true);

    const selection = state.servers[0].settings.selection;
    expect(selection.multipleMatchPolicy).toBe('reject_multiple');
    expect(selection.equalPriorityPolicy).toBe('specificity_then_id');
    expect(selection.ambiguityResponse.body).toBe('{"error":"catalog_ambiguous"}');
    expect(state.servers[0].routes[0].priority).toBe(10);
  });

  it('patches fallback mode and proxy safety without touching routes', () => {
    const { state } = setup();
    const settingsFn = (window as unknown as {
      __demoPatchApiMockServerSettings?: (patch: {
        fallbackMode?: 'proxy';
        proxyEnabled?: boolean;
        proxyAllowlist?: string[];
        proxyBlockPrivate?: boolean;
        proxyForwardAuth?: boolean;
        proxyRecordDrafts?: boolean;
      }) => boolean;
    }).__demoPatchApiMockServerSettings;

    expect(settingsFn?.({
      fallbackMode: 'proxy',
      proxyEnabled: true,
      proxyAllowlist: ['http://localhost:4017'],
      proxyBlockPrivate: false,
      proxyForwardAuth: true,
      proxyRecordDrafts: true,
    })).toBe(true);

    const settings = state.servers[0].settings;
    expect(settings.fallback.mode).toBe('proxy');
    expect(settings.proxy).toMatchObject({
      enabled: true,
      allowlist: ['http://localhost:4017'],
      blockPrivateNetworks: false,
      forwardAuth: true,
      forwardCredentialHeaders: ['authorization', 'cookie', 'x-api-key'],
      recordAsDrafts: true,
    });
    expect(state.servers[0].routes[0].priority).toBe(10);

    expect(settingsFn?.({ proxyForwardAuth: false, proxyRecordDrafts: false })).toBe(true);
    expect(state.servers[0].settings.proxy).toMatchObject({
      forwardAuth: false,
      forwardCredentialHeaders: [],
      recordAsDrafts: false,
    });
  });

  it('patches CORS, limits, redaction, persist, and callback allowlist', () => {
    const { state } = setup();
    const settingsFn = (window as unknown as {
      __demoPatchApiMockServerSettings?: (patch: {
        corsEnabled?: boolean;
        corsOrigins?: string[];
        maxInboundBodyBytes?: number;
        maxConcurrentConnections?: number;
        gracefulDrainMs?: number;
        persistToDisk?: boolean;
        redactHeaders?: string[];
        redactJsonPaths?: string[];
        callbackAllowlist?: string[];
      }) => boolean;
    }).__demoPatchApiMockServerSettings;

    expect(settingsFn?.({
      corsEnabled: true,
      corsOrigins: ['http://localhost:5173'],
      maxInboundBodyBytes: 2_097_152,
      maxConcurrentConnections: 50,
      gracefulDrainMs: 8_000,
      persistToDisk: true,
      redactHeaders: ['authorization'],
      redactJsonPaths: ['$.password'],
      callbackAllowlist: ['https://hooks.example.com/mock-event'],
    })).toBe(true);

    const settings = state.servers[0].settings;
    expect(settings.cors).toMatchObject({ enabled: true, allowOrigins: ['http://localhost:5173'] });
    expect(settings.limits).toMatchObject({
      maxInboundBodyBytes: 2_097_152,
      maxConcurrentConnections: 50,
      gracefulDrainMs: 8_000,
    });
    expect(settings.journal.persistToDisk).toBe(true);
    expect(settings.redaction.headerNames).toEqual(['authorization']);
    expect(settings.redaction.jsonPaths).toEqual(['$.password']);
    expect(settings.callbacks?.allowlist).toEqual(['https://hooks.example.com/mock-event']);
  });

  it('reports failure from the settings bridge when there is no active server', () => {
    setup({ server: null });
    const settingsFn = (window as unknown as {
      __demoPatchApiMockServerSettings?: (patch: { multipleMatchPolicy?: 'reject_multiple' }) => boolean;
    }).__demoPatchApiMockServerSettings;
    expect(settingsFn?.({ multipleMatchPolicy: 'reject_multiple' })).toBe(false);
  });

  it('patches the selected rule rather than the first one', () => {
    const first = createRoute('First');
    const second = createRoute('Second');
    const { state } = setup({ server: makeServer([first, second]), selectedRouteId: second.id });
    expect(bridge()?.({ priority: 7 })).toBe(true);

    expect(state.servers[0].routes[0].priority).toBe(first.priority);
    expect(state.servers[0].routes[1].priority).toBe(7);
  });

  it('falls back to the first rule when the selection is stale', () => {
    const { state } = setup({ selectedRouteId: 'gone' });
    expect(bridge()?.({ priority: 3 })).toBe(true);
    expect(state.servers[0].routes[0].priority).toBe(3);
  });

  it('reports failure when there is no active server or no rules', () => {
    const withoutServer = setup({ server: null });
    expect(bridge()?.({ priority: 1 })).toBe(false);
    expect(withoutServer.setServers).not.toHaveBeenCalled();
    withoutServer.rendered.unmount();

    const withoutRoutes = setup({ server: makeServer([]) });
    expect(bridge()?.({ priority: 1 })).toBe(false);
    expect(withoutRoutes.setServers).not.toHaveBeenCalled();
  });

  it('leaves other servers untouched and survives a rule with no responses', () => {
    const bare = { ...createRoute('Bare'), responses: [] } as ApiMockServerDefinitionV1['routes'][0];
    const { state } = setup({ server: makeServer([bare]) });
    state.servers.push({ ...makeServer([createRoute('Other')]), id: 'srv-b' });

    expect(bridge()?.({ body: '{}' })).toBe(true);
    expect(state.servers[0].routes[0].responses).toEqual([]);
    expect(state.servers[1].routes[0].name).toBe('Other');
  });

  it('removes the bridge on unmount', () => {
    const { rendered } = setup();
    expect(bridge()).toBeTypeOf('function');
    rendered.unmount();
    expect(bridge()).toBeUndefined();
    expect((window as unknown as Record<string, unknown>).__demoPatchApiMockServerSettings).toBeUndefined();
  });

  it('adds a second variant and patches its name, status, and conditions', () => {
    const { state } = setup();
    const conditions: ApiMockPredicateGroupV1 = {
      id: 'pg-cond',
      combinator: 'all',
      children: [{ id: 'p1', source: 'body', selector: '', operator: 'jsonPath_equals', expected: ['$.sku', 'MISSING'] }],
    };
    expect(bridge()?.({
      addVariant: true,
      variantName: 'Not found',
      status: 404,
      body: '{"error":"not_found"}',
      variantConditions: conditions,
    })).toBe(true);

    const responses = state.servers[0].routes[0].responses;
    expect(responses).toHaveLength(2);
    expect(responses[0].isDefault).toBe(true);
    expect(responses[1]).toMatchObject({
      name: 'Not found',
      status: 404,
      isDefault: false,
      body: { content: '{"error":"not_found"}' },
    });
    expect(responses[1].conditions).toEqual(conditions);
    expect(responses[1].conditions).not.toBe(conditions);
  });

  it('switches to sequence mode and keeps variant conditions', () => {
    const { state } = setup();
    const conditions: ApiMockPredicateGroupV1 = {
      id: 'pg',
      combinator: 'all',
      children: [{ id: 'p', source: 'query', selector: 'q', operator: 'exact', expected: '1' }],
    };
    bridge()?.({
      addVariant: true,
      variantConditions: conditions,
    });
    expect(bridge()?.({ responseMode: 'sequence' })).toBe(true);
    expect(state.servers[0].routes[0].responseMode).toBe('sequence');
    expect(state.servers[0].routes[0].responses[1].conditions).toEqual(conditions);
  });

  it('marks a specific variant as the sole default', () => {
    const { state } = setup();
    bridge()?.({ addVariant: true, variantName: 'Alt' });
    expect(bridge()?.({ variantIndex: 1, isDefault: true })).toBe(true);
    const responses = state.servers[0].routes[0].responses;
    expect(responses[0].isDefault).toBe(false);
    expect(responses[1].isDefault).toBe(true);
  });

  it('skips addVariant when two responses already exist and honours weighted/state mode', () => {
    const first = createRoute('Cart');
    first.responses = [
      { ...first.responses[0], isDefault: true },
      { ...createDefaultResponse('resp-2'), isDefault: false, name: 'Alt' },
    ];
    const { state } = setup({ server: makeServer([first]) });
    expect(bridge()?.({ addVariant: true, variantName: 'Ignored' })).toBe(true);
    expect(state.servers[0].routes[0].responses).toHaveLength(2);
    expect(state.servers[0].routes[0].responses[1].name).toBe('Ignored');

    expect(bridge()?.({ responseMode: 'weighted' })).toBe(true);
    expect(state.servers[0].routes[0].responseMode).toBe('weighted');
    expect(state.servers[0].routes[0].responses[0].weight).toBe(1);

    expect(bridge()?.({ responseMode: 'state', variantIndex: 0, isDefault: false })).toBe(true);
    expect(state.servers[0].routes[0].responseMode).toBe('state');
    expect(state.servers[0].routes[0].responses[0].isDefault).toBe(false);
  });

  it('adds a bare second variant without rewriting the original body', () => {
    const { state } = setup();
    const before = state.servers[0].routes[0].responses[0].body.content;
    expect(bridge()?.({ addVariant: true })).toBe(true);
    const responses = state.servers[0].routes[0].responses;
    expect(responses).toHaveLength(2);
    expect(responses[0].body.content).toBe(before);
    expect(responses[1].isDefault).toBe(false);
    expect(responses[1].status).toBe(200);
  });

  it('rules mode clears weights and leaves conditions intact', () => {
    const { state } = setup();
    const conditions: ApiMockPredicateGroupV1 = {
      id: 'pg',
      combinator: 'all',
      children: [{ id: 'p', source: 'body', selector: '', operator: 'jsonPath_equals', expected: ['$.sku', 'MISSING'] }],
    };
    bridge()?.({ addVariant: true, variantConditions: conditions });
    expect(bridge()?.({ responseMode: 'rules' })).toBe(true);
    const route = state.servers[0].routes[0];
    expect(route.responseMode).toBe('rules');
    expect(route.responses.every(r => r.weight === undefined)).toBe(true);
    expect(route.responses[1].conditions).toEqual(conditions);
  });

  it('returns the route unchanged when variantIndex is out of range', () => {
    const { state } = setup();
    const before = state.servers[0].routes[0].responses[0].name;
    expect(bridge()?.({ variantIndex: 9, variantName: 'Nope' })).toBe(true);
    expect(state.servers[0].routes[0].responses[0].name).toBe(before);
  });

  it('clones a named state transition and a weight onto a variant', () => {
    const { state } = setup();
    const transition = {
      currentState: 'EMPTY',
      targetState: 'HAS_ITEMS',
      counterUpdates: [{ key: 'items', delta: 1 }],
    };
    expect(bridge()?.({
      responseMode: 'state',
      variantIndex: 0,
      transition,
    })).toBe(true);
    expect(state.servers[0].routes[0].responseMode).toBe('state');
    expect(state.servers[0].routes[0].responses[0].transition).toEqual(transition);
    expect(state.servers[0].routes[0].responses[0].transition).not.toBe(transition);

    expect(bridge()?.({ variantIndex: 0, weight: 90 })).toBe(true);
    expect(state.servers[0].routes[0].responses[0].weight).toBe(90);
  });

  it('merges timing, eligibility, and fault behavior onto a variant', () => {
    const { state } = setup();
    expect(bridge()?.({
      variantIndex: 0,
      behavior: { delayMs: 800, jitterMs: 200, maxMatches: 1, probability: 0.5 },
    })).toBe(true);
    expect(state.servers[0].routes[0].responses[0].behavior).toMatchObject({
      delayMs: 800,
      jitterMs: 200,
      maxMatches: 1,
      probability: 0.5,
    });

    expect(bridge()?.({
      variantIndex: 0,
      behavior: { fault: 'dribble', chunkSchedule: [{ afterMs: 50, body: 'a' }] },
    })).toBe(true);
    expect(state.servers[0].routes[0].responses[0].behavior.fault).toBe('dribble');
    expect(state.servers[0].routes[0].responses[0].behavior.chunkSchedule).toEqual([{ afterMs: 50, body: 'a' }]);

    expect(bridge()?.({ variantIndex: 0, behavior: { fault: 'timeout', longRunningMs: 3200 } })).toBe(true);
    expect(state.servers[0].routes[0].responses[0].behavior.fault).toBe('timeout');
    expect(state.servers[0].routes[0].responses[0].behavior.longRunningMs).toBe(3200);
    expect(state.servers[0].routes[0].responses[0].behavior.chunkSchedule).toBeUndefined();

    expect(bridge()?.({ variantIndex: 0, behavior: { longRunningMs: null } })).toBe(true);
    expect(state.servers[0].routes[0].responses[0].behavior.longRunningMs).toBeUndefined();

    expect(bridge()?.({
      variantIndex: 0,
      behavior: { maxMatches: null, probability: null, expiresAt: null, fault: 'none', chunkSchedule: null },
    })).toBe(true);
    expect(state.servers[0].routes[0].responses[0].behavior.maxMatches).toBeUndefined();
    expect(state.servers[0].routes[0].responses[0].behavior.probability).toBeUndefined();
    expect(state.servers[0].routes[0].responses[0].behavior.fault).toBeUndefined();
  });
});
