/**
 * Phase 11E - Mock runtime lifecycle and hot-update acceptance tests.
 *
 * Validates:
 *   11E-A Mock config resolution (tab → profile → workspace)
 *   11E-B Runtime lifecycle and 11A operation wiring
 *   11E-C Hot-swap / in-flight pinning stability
 *   11E-D Latency jitter determinism
 *   11E-E Stream message planning
 *   11E-F Tab registry isolation
 *   11E-G Source-scan traceability
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  grpcMockConnectionConfigStorageKey,
  grpcMockTabOverrideStorageKey,
  resolveGrpcMockConnectionId,
  resolveGrpcTabMockConfig,
  type GrpcMockConfigSource,
} from './grpcMockConfigResolution';
import {
  GRPC_MOCK_LATENCY_LIMITS,
  drawGrpcMockJitterMs,
  resolveGrpcMockLatencyMs,
  validateGrpcMockLatencyPolicy,
  GrpcMockLatencyPolicyValidationError,
  assertGrpcMockLatencyPolicy,
} from './grpcMockLatencySimulation';
import { createGrpcMockRuntimeRegistry, GrpcMockRuntimeRegistryTabNotFoundError } from './grpcMockRuntimeRegistry';
import type { GrpcMockEvaluationContext, GrpcMockRule, GrpcMockRuleSet } from './grpcMockRuleContracts';
import { GRPC_MOCK_DEFAULT_STATUS_CODE } from './grpcMockRuleContracts';
import {
  createGrpcMockRuntimeManager,
  planGrpcMockStreamMessages,
  GrpcMockRuntimeAlreadyRunningError,
  GrpcMockRuntimeInFlightError,
  GrpcMockRuntimeNotRunningError,
  GrpcMockRuntimeUnknownCallError,
  GrpcMockRuntimeUnsupportedCallTypeError,
} from './grpcMockRuntimeCore';

const ROOT = fileURLToPath(new URL('../../..', import.meta.url));

function readSrc(relPath: string): string {
  return readFileSync(path.join(ROOT, relPath), 'utf-8');
}

function makeContext(overrides: Partial<GrpcMockEvaluationContext> = {}): GrpcMockEvaluationContext {
  return {
    service: 'order.OrderService',
    method: 'GetOrder',
    callType: 'unary',
    metadata: { 'x-tenant': 'acme' },
    requestBody: { order_id: '123' },
    ...overrides,
  };
}

function makeRule(overrides: Partial<GrpcMockRule> & Pick<GrpcMockRule, 'id'>): GrpcMockRule {
  return {
    name: overrides.id,
    enabled: true,
    priority: 100,
    predicate: { kind: 'method_equals', method: 'GetOrder' },
    response: { statusCode: 0, body: { ok: true } },
    ...overrides,
  };
}

function makeRuleSet(rules: GrpcMockRule[]): GrpcMockRuleSet {
  return { rules };
}

function workspaceDefault(body: unknown): GrpcMockConfigSource {
  return {
    ruleSet: makeRuleSet([
      makeRule({ id: 'default', response: { statusCode: 0, body } }),
    ]),
  };
}

describe('Phase 11E-A - mock config resolution', () => {
  it('exposes storage keys for tab override and connection config', () => {
    expect(grpcMockTabOverrideStorageKey('tab-1')).toBe('grpc-mock-tab-override-tab-1');
    expect(grpcMockConnectionConfigStorageKey('conn-1')).toBe('grpc-mock-config-conn-1');
  });

  it('resolves connection id from tab link then page default then tab id', () => {
    expect(resolveGrpcMockConnectionId({ tabId: 'tab-1', connectionId: 'profile-1' })).toBe('profile-1');
    expect(resolveGrpcMockConnectionId({ tabId: 'tab-1' }, 'page-default')).toBe('page-default');
    expect(resolveGrpcMockConnectionId({ tabId: 'tab-1' })).toBe('tab-1');
  });

  it('inherits workspace default when tab and profile have no mock config', () => {
    const resolved = resolveGrpcTabMockConfig(
      { tabId: 'tab-1', connectionId: 'profile-1' },
      { connectionId: 'profile-1' },
      workspaceDefault({ source: 'workspace' }),
    );
    expect(resolved.source).toBe('workspace_default');
    expect(resolved.ruleSet.rules[0]!.response.body).toEqual({ source: 'workspace' });
  });

  it('prefers connection profile mock config over workspace default', () => {
    const resolved = resolveGrpcTabMockConfig(
      { tabId: 'tab-1', connectionId: 'profile-1' },
      {
        connectionId: 'profile-1',
        mockConfig: workspaceDefault({ source: 'profile' }),
      },
      workspaceDefault({ source: 'workspace' }),
    );
    expect(resolved.source).toBe('connection_profile');
    expect(resolved.ruleSet.rules[0]!.response.body).toEqual({ source: 'profile' });
  });

  it('prefers tab mock override over profile and workspace', () => {
    const resolved = resolveGrpcTabMockConfig(
      {
        tabId: 'tab-1',
        connectionId: 'profile-1',
        mockConfigOverride: workspaceDefault({ source: 'tab' }),
      },
      {
        connectionId: 'profile-1',
        mockConfig: workspaceDefault({ source: 'profile' }),
      },
      workspaceDefault({ source: 'workspace' }),
    );
    expect(resolved.source).toBe('tab_override');
    expect(resolved.ruleSet.rules[0]!.response.body).toEqual({ source: 'tab' });
  });

  it('clones resolved config so later mutation does not leak', () => {
    const workspace = workspaceDefault({ source: 'workspace' });
    const resolved = resolveGrpcTabMockConfig({ tabId: 'tab-1' }, undefined, workspace);
    (resolved.ruleSet.rules[0]!.response.body as { source: string }).source = 'mutated';
    expect(workspace.ruleSet.rules[0]!.response.body).toEqual({ source: 'workspace' });
  });
});

describe('Phase 11E-B - runtime lifecycle', () => {
  it('starts with running operation state and commits initial generation 1', () => {
    const manager = createGrpcMockRuntimeManager();
    manager.start({
      connectionId: 'conn-1',
      ruleSet: makeRuleSet([makeRule({ id: 'r1' })]),
    }, { nowIso: '2026-06-30T00:00:00.000Z' });

    const state = manager.getState();
    expect(state.operation.status).toBe('running');
    expect(state.operation.operationId).toBe('conn-1');
    expect(state.committed?.generation).toBe(1);
    expect(state.inFlightCount).toBe(0);
  });

  it('rejects double start', () => {
    const manager = createGrpcMockRuntimeManager();
    manager.start({ connectionId: 'conn-1', ruleSet: makeRuleSet([makeRule({ id: 'r1' })]) });
    expect(() => manager.start({ connectionId: 'conn-1', ruleSet: makeRuleSet([makeRule({ id: 'r2' })]) }))
      .toThrow(GrpcMockRuntimeAlreadyRunningError);
  });

  it('stops cleanly when idle and resets to completed then idle on next start path', () => {
    const manager = createGrpcMockRuntimeManager();
    manager.start({ connectionId: 'conn-1', ruleSet: makeRuleSet([makeRule({ id: 'r1' })]) });
    manager.stop({ nowIso: '2026-06-30T00:00:01.000Z' });
    expect(manager.getState().operation.status).toBe('completed');
    expect(manager.getState().committed).toBeUndefined();
  });

  it('rejects calls when runtime is not running', () => {
    const manager = createGrpcMockRuntimeManager();
    expect(() => manager.beginCall(makeContext())).toThrow(GrpcMockRuntimeNotRunningError);
  });

  it('allows restart after stop completes', () => {
    const manager = createGrpcMockRuntimeManager();
    manager.start({ connectionId: 'conn-1', ruleSet: makeRuleSet([makeRule({ id: 'r1' })]) });
    manager.stop();
    manager.start({ connectionId: 'conn-2', ruleSet: makeRuleSet([makeRule({ id: 'r2' })]) });
    expect(manager.getState().connectionId).toBe('conn-2');
    expect(manager.getState().committed?.generation).toBe(1);
  });

  it('isolates getState operation snapshot from external mutation', () => {
    const manager = createGrpcMockRuntimeManager();
    manager.start({ connectionId: 'conn-1', ruleSet: makeRuleSet([makeRule({ id: 'r1' })]) });
    const snapshot = manager.getState();
    snapshot.operation.status = 'failed';
    expect(manager.getState().operation.status).toBe('running');
  });

  it('rejects unknown call sessions on endCall and evaluateSession', () => {
    const manager = createGrpcMockRuntimeManager();
    manager.start({ connectionId: 'conn-1', ruleSet: makeRuleSet([makeRule({ id: 'r1' })]) });
    const session = manager.beginCall(makeContext());
    manager.endCall(session.callId);
    expect(() => manager.endCall(session.callId)).toThrow(GrpcMockRuntimeUnknownCallError);
    expect(() => manager.evaluateSession(session)).toThrow(GrpcMockRuntimeUnknownCallError);
  });

  it('rejects unary call type for stream planner', () => {
    const manager = createGrpcMockRuntimeManager();
    manager.start({ connectionId: 'conn-1', ruleSet: makeRuleSet([makeRule({ id: 'r1' })]) });
    expect(() => manager.planStreamCall(makeContext({ callType: 'unary' })))
      .toThrow(GrpcMockRuntimeUnsupportedCallTypeError);
  });
});

describe('Phase 11E-C - hot-swap and in-flight pinning', () => {
  it('pins rule snapshot at beginCall across commitRuleSet', () => {
    const manager = createGrpcMockRuntimeManager();
    const rulesV1 = makeRuleSet([
      makeRule({ id: 'v1', response: { statusCode: 0, body: { version: 1 } } }),
    ]);
    const rulesV2 = makeRuleSet([
      makeRule({ id: 'v2', response: { statusCode: 0, body: { version: 2 } } }),
    ]);

    manager.start({ connectionId: 'conn-1', ruleSet: rulesV1 });
    const session = manager.beginCall(makeContext());
    expect(session.generation).toBe(1);

    const committed = manager.commitRuleSet(rulesV2);
    expect(committed.generation).toBe(2);

    const pinnedEval = manager.evaluateSession(session);
    expect(pinnedEval.response.body).toEqual({ version: 1 });
    manager.endCall(session.callId);

    return manager.executeUnaryCall(makeContext(), {
      sleep: async () => {},
    }).then((result) => {
      expect(result.generation).toBe(2);
      expect(result.evaluation.response.body).toEqual({ version: 2 });
    });
  });

  it('ignores tampered session snapshots and evaluates the in-flight pin', () => {
    const manager = createGrpcMockRuntimeManager();
    const rulesV1 = makeRuleSet([
      makeRule({ id: 'v1', response: { statusCode: 0, body: { version: 1 } } }),
    ]);
    const rulesV2 = makeRuleSet([
      makeRule({ id: 'v2', response: { statusCode: 0, body: { version: 2 } } }),
    ]);

    manager.start({ connectionId: 'conn-1', ruleSet: rulesV1 });
    const session = manager.beginCall(makeContext());
    manager.commitRuleSet(rulesV2);

    const tampered = {
      ...session,
      pinnedCommit: {
        ...session.pinnedCommit,
        ruleSet: rulesV2,
      },
    };

    expect(manager.evaluateSession(tampered).response.body).toEqual({ version: 1 });
    manager.endCall(session.callId);
  });

  it('ignores tampered session context and uses the in-flight pin', () => {
    const manager = createGrpcMockRuntimeManager();
    manager.start({
      connectionId: 'conn-1',
      ruleSet: makeRuleSet([
        makeRule({
          id: 'ctx',
          predicate: { kind: 'body_path_equals', path: 'order_id', value: '123' },
          response: { statusCode: 0, body: { matched: true } },
        }),
      ]),
    });

    const session = manager.beginCall(makeContext());
    const tampered = {
      ...session,
      context: makeContext({ requestBody: { order_id: '999' } }),
    };

    expect(manager.evaluateSession(tampered).response.body).toEqual({ matched: true });
    manager.endCall(session.callId);
  });

  it('blocks stop while calls are in flight', () => {
    const manager = createGrpcMockRuntimeManager();
    manager.start({ connectionId: 'conn-1', ruleSet: makeRuleSet([makeRule({ id: 'r1' })]) });
    const session = manager.beginCall(makeContext());

    expect(() => manager.stop()).toThrow(GrpcMockRuntimeInFlightError);
    manager.endCall(session.callId);
    expect(() => manager.stop()).not.toThrow();
  });

  it('bumps generation on each commit without affecting pinned sessions', () => {
    const manager = createGrpcMockRuntimeManager();
    manager.start({
      connectionId: 'conn-1',
      ruleSet: makeRuleSet([makeRule({ id: 'g1', response: { body: { g: 1 } } })]),
    });

    const s1 = manager.beginCall(makeContext());
    manager.commitRuleSet(makeRuleSet([makeRule({ id: 'g2', response: { body: { g: 2 } } })]));
    const s2 = manager.beginCall(makeContext());

    expect(s1.generation).toBe(1);
    expect(s2.generation).toBe(2);
    expect(manager.evaluateSession(s1).response.body).toEqual({ g: 1 });
    expect(manager.evaluateSession(s2).response.body).toEqual({ g: 2 });

    manager.endCall(s1.callId);
    manager.endCall(s2.callId);
  });
});

describe('Phase 11E-D - latency jitter determinism', () => {
  it('validates null latency policy as empty issues', () => {
    expect(validateGrpcMockLatencyPolicy(undefined)).toEqual([]);
  });

  it('documents latency caps', () => {
    expect(GRPC_MOCK_LATENCY_LIMITS.maxDefaultLatencyMs).toBe(30_000);
    expect(GRPC_MOCK_LATENCY_LIMITS.maxJitterMs).toBe(5_000);
  });

  it('rejects out-of-range latency policy values', () => {
    const issues = validateGrpcMockLatencyPolicy({
      defaultLatencyMs: GRPC_MOCK_LATENCY_LIMITS.maxDefaultLatencyMs + 1,
      jitterMs: GRPC_MOCK_LATENCY_LIMITS.maxJitterMs + 1,
    });
    expect(issues.length).toBeGreaterThanOrEqual(2);
    expect(() => assertGrpcMockLatencyPolicy({ jitterMs: -1 }))
      .toThrow(GrpcMockLatencyPolicyValidationError);
  });

  it('draws deterministic jitter from seed and call sequence', () => {
    const policy = { jitterMs: 40, seed: 99 };
    expect(drawGrpcMockJitterMs(policy, 1)).toBe(drawGrpcMockJitterMs(policy, 1));
    expect(drawGrpcMockJitterMs(policy, 1)).not.toBe(drawGrpcMockJitterMs(policy, 2));
  });

  it('returns zero jitter when seed is omitted', () => {
    expect(drawGrpcMockJitterMs({ jitterMs: 100 }, 1)).toBe(0);
  });

  it('resolves per-call latency from response override then policy default', () => {
    expect(resolveGrpcMockLatencyMs({
      responseLatencyMs: 25,
      policy: { defaultLatencyMs: 100, jitterMs: 0, seed: 1 },
      callSequence: 1,
    })).toBe(25);

    expect(resolveGrpcMockLatencyMs({
      policy: { defaultLatencyMs: 80, jitterMs: 10, seed: 5 },
      callSequence: 3,
    })).toBe(80 + drawGrpcMockJitterMs({ jitterMs: 10, seed: 5 }, 3));
  });

  it('applies simulated latency during unary execution', async () => {
    const manager = createGrpcMockRuntimeManager();
    manager.start({
      connectionId: 'conn-1',
      ruleSet: makeRuleSet([
        makeRule({ id: 'slow', response: { statusCode: 0, body: { ok: true }, latencyMs: 15 } }),
      ]),
      latencyPolicy: { jitterMs: 0, seed: 1 },
    });

    const slept: number[] = [];
    const result = await manager.executeUnaryCall(makeContext(), {
      sleep: async (ms) => { slept.push(ms); },
    });

    expect(slept).toEqual([15]);
    expect(result.latencyMs).toBe(15);
  });

  it('commitLatencyPolicy updates latency for subsequent unary calls', async () => {
    const manager = createGrpcMockRuntimeManager();
    manager.start({
      connectionId: 'conn-1',
      ruleSet: makeRuleSet([
        makeRule({ id: 'slow', response: { statusCode: 0, body: { ok: true }, latencyMs: 5 } }),
      ]),
      latencyPolicy: { defaultLatencyMs: 0, jitterMs: 0, seed: 1 },
    });

    manager.commitLatencyPolicy({ defaultLatencyMs: 40, jitterMs: 0, seed: 1 });

    const slept: number[] = [];
    await manager.executeUnaryCall(makeContext(), {
      sleep: async (ms) => { slept.push(ms); },
    });
    expect(slept).toEqual([5]);
    expect(manager.getState().latencyPolicy?.defaultLatencyMs).toBe(40);
  });
});

describe('Phase 11E-E - stream message planning', () => {
  it('plans ordered messages with first-message latency and inter-message delay', () => {
    const evaluation = {
      matched: true,
      usedDefault: false,
      fallthroughChain: [],
      response: {
        statusCode: 0,
        latencyMs: 20,
        interMessageDelayMs: 5,
        messages: [{ seq: 1 }, { seq: 2 }],
      },
    };

    const plan = planGrpcMockStreamMessages({
      evaluation,
      latencyPolicy: { defaultLatencyMs: 100, jitterMs: 0, seed: 1 },
      callSequence: 1,
    });

    expect(plan).toEqual([
      { index: 0, body: { seq: 1 }, delayBeforeMs: 20 },
      { index: 1, body: { seq: 2 }, delayBeforeMs: 5 },
    ]);
  });

  it('falls back to single body payload when messages[] is absent', () => {
    const plan = planGrpcMockStreamMessages({
      evaluation: {
        matched: true,
        usedDefault: false,
        fallthroughChain: [],
        response: { statusCode: 0, body: { only: true } },
      },
      callSequence: 1,
    });
    expect(plan).toEqual([{ index: 0, body: { only: true }, delayBeforeMs: 0 }]);
  });

  it('executes stream plan via runtime manager for server streaming', () => {
    const manager = createGrpcMockRuntimeManager();
    manager.start({
      connectionId: 'conn-1',
      ruleSet: makeRuleSet([
        makeRule({
          id: 'stream',
          response: {
            statusCode: 0,
            messages: [{ n: 1 }, { n: 2 }],
            interMessageDelayMs: 3,
          },
        }),
      ]),
    });

    const plan = manager.planStreamCall(makeContext({ callType: 'server_streaming' }));
    expect(plan.messages).toHaveLength(2);
    expect(plan.messages[1]!.delayBeforeMs).toBe(3);
    expect(manager.getState().inFlightCount).toBe(0);
  });

  it('uses default UNIMPLEMENTED path when no stream rule matches', () => {
    const manager = createGrpcMockRuntimeManager();
    manager.start({
      connectionId: 'conn-1',
      ruleSet: makeRuleSet([
        makeRule({
          id: 'miss',
          predicate: { kind: 'method_equals', method: 'Other' },
        }),
      ]),
    });

    const plan = manager.planStreamCall(makeContext({ callType: 'bidi_streaming' }));
    expect(plan.evaluation.usedDefault).toBe(true);
    expect(plan.evaluation.response.statusCode).toBe(GRPC_MOCK_DEFAULT_STATUS_CODE);
    expect(plan.messages).toEqual([]);
  });
});

describe('Phase 11E-F - tab registry isolation', () => {
  it('isolates getState committed snapshot from external mutation', () => {
    const manager = createGrpcMockRuntimeManager();
    manager.start({
      connectionId: 'conn-1',
      ruleSet: makeRuleSet([makeRule({ id: 'r1', response: { body: { n: 1 } } })]),
    });
    const snapshot = manager.getState();
    (snapshot.committed!.ruleSet.rules[0]!.response.body as { n: number }).n = 99;
    expect(manager.getState().committed?.ruleSet.rules[0]!.response.body).toEqual({ n: 1 });
  });

  it('tracks active tab id for routing', () => {
    const registry = createGrpcMockRuntimeRegistry();
    expect(registry.getActiveTabId()).toBeUndefined();
    registry.setActiveTab('tab-a');
    expect(registry.getActiveTabId()).toBe('tab-a');
  });

  it('throws when getManager is called for an unregistered tab', () => {
    const registry = createGrpcMockRuntimeRegistry();
    expect(() => registry.getManager('missing')).toThrow(GrpcMockRuntimeRegistryTabNotFoundError);
  });

  it('stopTab is a no-op for unknown tabs', () => {
    const registry = createGrpcMockRuntimeRegistry();
    expect(() => registry.stopTab('missing')).not.toThrow();
  });

  it('remove returns false for unknown tabs', () => {
    const registry = createGrpcMockRuntimeRegistry();
    expect(registry.remove('missing')).toBe(false);
  });

  it('keeps independent managers per tab', async () => {
    const registry = createGrpcMockRuntimeRegistry();
    registry.startTab('tab-a', {
      connectionId: 'conn-a',
      ruleSet: makeRuleSet([makeRule({ id: 'a', response: { body: { tab: 'a' } } })]),
    });
    registry.startTab('tab-b', {
      connectionId: 'conn-b',
      ruleSet: makeRuleSet([makeRule({ id: 'b', response: { body: { tab: 'b' } } })]),
    });

    registry.setActiveTab('tab-a');
    registry.getManager('tab-a').commitRuleSet(
      makeRuleSet([makeRule({ id: 'a2', response: { body: { tab: 'a2' } } })]),
    );

    const resultB = await registry.getManager('tab-b').executeUnaryCall(makeContext(), {
      sleep: async () => {},
    });
    expect(resultB.evaluation.response.body).toEqual({ tab: 'b' });

    const resultA = await registry.getManager('tab-a').executeUnaryCall(makeContext(), {
      sleep: async () => {},
    });
    expect(resultA.evaluation.response.body).toEqual({ tab: 'a2' });
  });

  it('startTabFromResolved wires connection id and latency policy', () => {
    const registry = createGrpcMockRuntimeRegistry();
    const resolved = resolveGrpcTabMockConfig(
      { tabId: 'tab-1', connectionId: 'profile-1' },
      undefined,
      {
        ruleSet: makeRuleSet([makeRule({ id: 'r1' })]),
        latencyPolicy: { defaultLatencyMs: 10, jitterMs: 0, seed: 1 },
      },
    );

    registry.startTabFromResolved('tab-1', resolved);
    const state = registry.getManager('tab-1').getState();
    expect(state.connectionId).toBe('profile-1');
    expect(state.latencyPolicy?.defaultLatencyMs).toBe(10);
  });

  it('clears active tab id when the active tab is removed', () => {
    const registry = createGrpcMockRuntimeRegistry();
    registry.startTab('tab-a', {
      connectionId: 'a',
      ruleSet: makeRuleSet([makeRule({ id: 'a' })]),
    });
    registry.setActiveTab('tab-a');
    registry.stopTab('tab-a');
    expect(registry.remove('tab-a')).toBe(true);
    expect(registry.getActiveTabId()).toBeUndefined();
  });

  it('remove throws when tab manager still has in-flight calls', () => {
    const registry = createGrpcMockRuntimeRegistry();
    registry.startTab('tab-a', {
      connectionId: 'a',
      ruleSet: makeRuleSet([makeRule({ id: 'a' })]),
    });
    const session = registry.getManager('tab-a').beginCall(makeContext());
    expect(() => registry.remove('tab-a')).toThrow(GrpcMockRuntimeInFlightError);
    expect(registry.hasManager('tab-a')).toBe(true);
    registry.getManager('tab-a').endCall(session.callId);
    expect(registry.remove('tab-a')).toBe(true);
  });

  it('remove stops the tab manager before dropping it', () => {
    const registry = createGrpcMockRuntimeRegistry();
    registry.startTab('tab-a', {
      connectionId: 'a',
      ruleSet: makeRuleSet([makeRule({ id: 'a' })]),
    });
    expect(registry.getManager('tab-a').getState().operation.status).toBe('running');

    expect(registry.remove('tab-a')).toBe(true);
    expect(registry.hasManager('tab-a')).toBe(false);
  });

  it('remove drops tab manager without affecting other tabs', () => {
    const registry = createGrpcMockRuntimeRegistry();
    registry.startTab('tab-a', {
      connectionId: 'a',
      ruleSet: makeRuleSet([makeRule({ id: 'a' })]),
    });
    registry.startTab('tab-b', {
      connectionId: 'b',
      ruleSet: makeRuleSet([makeRule({ id: 'b' })]),
    });

    expect(registry.remove('tab-a')).toBe(true);
    expect(registry.hasManager('tab-a')).toBe(false);
    expect(registry.hasManager('tab-b')).toBe(true);
    expect(registry.listTabIds()).toEqual(['tab-b']);
  });
});

describe('Phase 11E-G - source-scan traceability', () => {
  it('config resolution module exports resolver helpers', () => {
    const src = readSrc('src/shared/grpc/grpcMockConfigResolution.ts');
    expect(src.includes('resolveGrpcTabMockConfig')).toBe(true);
    expect(src.includes('grpcMockTabOverrideStorageKey')).toBe(true);
  });

  it('runtime core exports hot-swap manager without eval usage', () => {
    const src = readSrc('src/shared/grpc/grpcMockRuntimeCore.ts');
    expect(src.includes('commitRuleSet')).toBe(true);
    expect(src.includes('beginCall')).toBe(true);
    expect(src.includes('pinnedCommit')).toBe(true);
    expect(src.includes('eval(')).toBe(false);
  });

  it('latency module exports deterministic jitter resolver', () => {
    const src = readSrc('src/shared/grpc/grpcMockLatencySimulation.ts');
    expect(src.includes('resolveGrpcMockLatencyMs')).toBe(true);
    expect(src.includes('createGrpcMockLatencyRng')).toBe(true);
  });

  it('registry module exports per-tab manager routing', () => {
    const src = readSrc('src/shared/grpc/grpcMockRuntimeRegistry.ts');
    expect(src.includes('createGrpcMockRuntimeRegistry')).toBe(true);
    expect(src.includes('startTabFromResolved')).toBe(true);
  });
});
