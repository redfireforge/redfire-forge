import { beforeEach, describe, expect, it } from 'vitest';
import {
  createGrpcMockRuntimeManager,
  GrpcMockRuntimeAlreadyRunningError,
  GrpcMockRuntimeInFlightError,
  GrpcMockRuntimeNotRunningError,
  GrpcMockRuntimeUnknownCallError,
  GrpcMockRuntimeUnsupportedCallTypeError,
  planGrpcMockStreamMessages,
} from './grpcMockRuntimeCore';

const RULE_SET = {
  rules: [{
    id: 'echo',
    name: 'Echo',
    enabled: true,
    priority: 1,
    predicate: { kind: 'method_equals' as const, method: 'Echo' },
    response: { statusCode: 0, message: 'ok', body: { message: 'mocked' } },
  }],
};

describe('grpcMockRuntimeCore coverage gaps', () => {
  beforeEach(() => {
    // isolate call ids between tests
  });

  it('plans stream messages from response body and message arrays', () => {
    const single = planGrpcMockStreamMessages({
      evaluation: {
        matched: true,
        response: { statusCode: 0, body: { message: 'one' } },
      },
      callSequence: 1,
      latencyPolicy: { defaultLatencyMs: 5, jitterMs: 0 },
    });
    expect(single).toEqual([{ index: 0, body: { message: 'one' }, delayBeforeMs: 5 }]);

    const multi = planGrpcMockStreamMessages({
      evaluation: {
        matched: true,
        response: {
          statusCode: 0,
          messages: [{ message: 'a' }, { message: 'b' }],
          interMessageDelayMs: 3,
        },
      },
      callSequence: 2,
    });
    expect(multi).toHaveLength(2);
    expect(multi[1]?.delayBeforeMs).toBe(3);
    expect(planGrpcMockStreamMessages({
      evaluation: { matched: false, response: { statusCode: 14 } },
      callSequence: 1,
    })).toEqual([]);
  });

  it('starts, commits, executes unary calls, and stops mock runtime', async () => {
    const manager = createGrpcMockRuntimeManager();
    expect(manager.getState().operation.status).toBe('idle');

    manager.start({
      connectionId: 'conn-1',
      ruleSet: RULE_SET,
      latencyPolicy: { defaultLatencyMs: 0, jitterMs: 0 },
    }, { nowIso: '2026-07-01T00:00:00.000Z' });
    expect(manager.getState().operation.status).toBe('running');
    expect(() => manager.start({
      connectionId: 'conn-2',
      ruleSet: RULE_SET,
    })).toThrow(GrpcMockRuntimeAlreadyRunningError);

    const committed = manager.commitRuleSet(RULE_SET, { nowIso: '2026-07-01T00:00:01.000Z' });
    expect(committed.generation).toBe(2);
    manager.commitLatencyPolicy({ defaultLatencyMs: 1, jitterMs: 0 });

    const result = await manager.executeUnaryCall({
      service: 'echo.EchoService',
      method: 'Echo',
      callType: 'unary',
      metadata: {},
      requestBody: { message: 'hi' },
    }, {
      nowIso: '2026-07-01T00:00:02.000Z',
      sleep: async () => {},
    });
    expect(result.evaluation.matched).toBe(true);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(manager.getState().inFlightCount).toBe(0);
    expect(manager.getState().ruleHitCounts.echo).toBe(1);

    manager.stop({ nowIso: '2026-07-01T00:00:03.000Z', force: true });
    expect(manager.getState().operation.status).toBe('completed');
    expect(manager.getState().committed).toBeUndefined();
  });

  it('plans stream calls and tracks default/miss hit counts', () => {
    const manager = createGrpcMockRuntimeManager();
    manager.start({
      connectionId: 'conn-stream',
      ruleSet: {
        rules: [{
          id: 'stream',
          name: 'Stream',
          enabled: true,
          priority: 1,
          predicate: { kind: 'method_equals', method: 'ServerStream' },
          response: {
            statusCode: 0,
            messages: [{ message: 'chunk-1' }, { message: 'chunk-2' }],
          },
        }],
      },
    });

    const plan = manager.planStreamCall({
      service: 'echo.EchoService',
      method: 'ServerStream',
      callType: 'server_streaming',
      metadata: {},
      requestBody: {},
    }, { nowIso: '2026-07-01T00:00:00.000Z' });
    expect(plan.messages.length).toBe(2);

    const defaultRuleSet = {
      rules: [],
      defaultResponse: { statusCode: 0, message: 'default' },
    };
    manager.commitRuleSet(defaultRuleSet);
    const defaultSession = manager.beginCall({
      service: 'echo.EchoService',
      method: 'Echo',
      callType: 'unary',
      metadata: {},
      requestBody: {},
    });
    const defaultEvaluation = manager.evaluateSession(defaultSession);
    expect(defaultEvaluation.usedDefault).toBe(true);
    manager.endCall(defaultSession.callId);
    expect(manager.getState().defaultHitCount).toBe(1);
  });

  it('throws for unsupported operations and unknown calls', async () => {
    const manager = createGrpcMockRuntimeManager();
    expect(() => manager.commitRuleSet(RULE_SET)).toThrow(GrpcMockRuntimeNotRunningError);
    expect(() => manager.beginCall({
      service: 'echo.EchoService',
      method: 'Echo',
      callType: 'unary',
      metadata: {},
      requestBody: {},
    })).toThrow(GrpcMockRuntimeNotRunningError);

    manager.start({ connectionId: 'conn-guard', ruleSet: RULE_SET });
    const session = manager.beginCall({
      service: 'echo.EchoService',
      method: 'Echo',
      callType: 'unary',
      metadata: {},
      requestBody: {},
    });
    expect(() => manager.evaluateSession({ ...session, callId: 'missing' }))
      .toThrow(GrpcMockRuntimeUnknownCallError);
    expect(() => manager.endCall('missing')).toThrow(GrpcMockRuntimeUnknownCallError);
    expect(() => manager.planStreamCall({
      service: 'echo.EchoService',
      method: 'Echo',
      callType: 'unary',
      metadata: {},
      requestBody: {},
    })).toThrow(GrpcMockRuntimeUnsupportedCallTypeError);

    manager.endCall(session.callId);
    const inFlightSession = manager.beginCall({
      service: 'echo.EchoService',
      method: 'Echo',
      callType: 'unary',
      metadata: {},
      requestBody: {},
    });
    expect(() => manager.stop()).toThrow(GrpcMockRuntimeInFlightError);
    manager.endCall(inFlightSession.callId);
    manager.stop({ force: true });
  });

  it('uses default sleep when latency is positive', async () => {
    const manager = createGrpcMockRuntimeManager();
    manager.start({
      connectionId: 'conn-sleep',
      ruleSet: {
        rules: [{
          id: 'slow',
          name: 'Slow',
          enabled: true,
          priority: 1,
          predicate: { kind: 'method_equals', method: 'Echo' },
          response: { statusCode: 0, latencyMs: 1 },
        }],
      },
    });
    const result = await manager.executeUnaryCall({
      service: 'echo.EchoService',
      method: 'Echo',
      callType: 'unary',
      metadata: {},
      requestBody: {},
    });
    expect(result.latencyMs).toBe(1);
  });
});
