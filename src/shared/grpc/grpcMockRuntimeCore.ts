/**
 * Phase 11E - gRPC mock runtime manager.
 *
 * Hot-swap committed rule sets with in-flight pinning, unary execution,
 * and stream message planning. Process listener belongs to Phase 11G+.
 */

import {
  createInitialGrpcAdvancedOperationState,
  transitionGrpcAdvancedOperationState,
  type GrpcAdvancedOperationState,
} from './grpcAdvancedFeatureContracts';
import type { GrpcCallType } from './contracts';
import {
  assertGrpcMockRuleSet,
  type GrpcMockEvaluationContext,
  type GrpcMockRuleEvaluationResult,
  type GrpcMockRuleSet,
} from './grpcMockRuleContracts';
import { evaluateGrpcMockRuleSet } from './grpcMockRuleEvaluatorCore';
import {
  assertGrpcMockLatencyPolicy,
  resolveGrpcMockLatencyMs,
  type GrpcMockLatencyPolicy,
} from './grpcMockLatencySimulation';

export interface GrpcMockCommittedRuleSet {
  generation: number;
  committedAt: string;
  ruleSet: GrpcMockRuleSet;
}

export interface GrpcMockRuntimeStartConfig {
  connectionId: string;
  ruleSet: GrpcMockRuleSet;
  latencyPolicy?: GrpcMockLatencyPolicy;
}

export interface GrpcMockCallSession {
  callId: string;
  generation: number;
  pinnedCommit: GrpcMockCommittedRuleSet;
  context: GrpcMockEvaluationContext;
  startedAt: string;
}

export interface GrpcMockUnaryCallResult {
  callId: string;
  generation: number;
  evaluation: GrpcMockRuleEvaluationResult;
  latencyMs: number;
  completedAt: string;
}

export interface GrpcMockStreamMessagePlan {
  index: number;
  body: unknown;
  delayBeforeMs: number;
}

export interface GrpcMockStreamCallPlan {
  callId: string;
  generation: number;
  evaluation: GrpcMockRuleEvaluationResult;
  messages: GrpcMockStreamMessagePlan[];
  completedAt: string;
}

export interface GrpcMockRuntimeState {
  connectionId?: string;
  operation: GrpcAdvancedOperationState;
  committed?: GrpcMockCommittedRuleSet;
  latencyPolicy?: GrpcMockLatencyPolicy;
  inFlightCount: number;
  callSequence: number;
}

export interface GrpcMockRuntimeManager {
  getState(): GrpcMockRuntimeState;
  start(config: GrpcMockRuntimeStartConfig, options?: { nowIso?: string }): void;
  stop(options?: { nowIso?: string }): void;
  commitRuleSet(ruleSet: GrpcMockRuleSet, options?: { nowIso?: string }): GrpcMockCommittedRuleSet;
  beginCall(context: GrpcMockEvaluationContext, options?: { nowIso?: string }): GrpcMockCallSession;
  evaluateSession(session: GrpcMockCallSession): GrpcMockRuleEvaluationResult;
  endCall(callId: string): void;
  executeUnaryCall(
    context: GrpcMockEvaluationContext,
    options?: { nowIso?: string; sleep?: (ms: number) => Promise<void> },
  ): Promise<GrpcMockUnaryCallResult>;
  planStreamCall(
    context: GrpcMockEvaluationContext,
    options?: { nowIso?: string },
  ): GrpcMockStreamCallPlan;
}

let nextCallCounter = 0;

function createCallId(): string {
  nextCallCounter += 1;
  return `grpc-mock-call-${nextCallCounter}`;
}

function cloneCommittedRuleSet(
  ruleSet: GrpcMockRuleSet,
  generation: number,
  committedAt: string,
): GrpcMockCommittedRuleSet {
  return {
    generation,
    committedAt,
    ruleSet: structuredClone(ruleSet),
  };
}

function isStreamingCallType(callType: GrpcCallType): boolean {
  return callType === 'server_streaming'
    || callType === 'client_streaming'
    || callType === 'bidi_streaming';
}

export function planGrpcMockStreamMessages(input: {
  evaluation: GrpcMockRuleEvaluationResult;
  latencyPolicy?: GrpcMockLatencyPolicy;
  callSequence: number;
}): GrpcMockStreamMessagePlan[] {
  const { evaluation, latencyPolicy, callSequence } = input;
  const response = evaluation.response;
  const payloads = Array.isArray(response.messages) && response.messages.length > 0
    ? response.messages
    : response.body !== undefined
      ? [response.body]
      : [];

  if (payloads.length === 0) {
    return [];
  }

  const firstDelay = resolveGrpcMockLatencyMs({
    responseLatencyMs: response.latencyMs,
    policy: latencyPolicy,
    callSequence,
  });
  const betweenDelay = response.interMessageDelayMs ?? latencyPolicy?.defaultLatencyMs ?? 0;

  return payloads.map((body, index) => ({
    index,
    body,
    delayBeforeMs: index === 0 ? firstDelay : Math.max(0, betweenDelay),
  }));
}

export function createGrpcMockRuntimeManager(): GrpcMockRuntimeManager {
  let connectionId: string | undefined;
  let operation = createInitialGrpcAdvancedOperationState();
  let committed: GrpcMockCommittedRuleSet | undefined;
  let latencyPolicy: GrpcMockLatencyPolicy | undefined;
  let generation = 0;
  let callSequence = 0;
  const inFlight = new Map<string, GrpcMockCallSession>();

  const requireRunning = (): GrpcMockCommittedRuleSet => {
    if (operation.status !== 'running' || committed == null) {
      throw new GrpcMockRuntimeNotRunningError();
    }
    return committed;
  };

  return {
    getState(): GrpcMockRuntimeState {
      return {
        connectionId,
        operation: structuredClone(operation),
        committed: committed ? structuredClone(committed) : undefined,
        latencyPolicy: latencyPolicy != null ? structuredClone(latencyPolicy) : undefined,
        inFlightCount: inFlight.size,
        callSequence,
      };
    },

    start(config, options) {
      if (operation.status === 'running') {
        throw new GrpcMockRuntimeAlreadyRunningError();
      }

      const nowIso = options?.nowIso ?? new Date().toISOString();
      assertGrpcMockRuleSet(config.ruleSet);
      assertGrpcMockLatencyPolicy(config.latencyPolicy);

      operation = transitionGrpcAdvancedOperationState(
        createInitialGrpcAdvancedOperationState(),
        'validating',
        { operationId: config.connectionId, nowIso },
      );
      operation = transitionGrpcAdvancedOperationState(operation, 'running', {
        operationId: config.connectionId,
        nowIso,
      });

      connectionId = config.connectionId;
      latencyPolicy = config.latencyPolicy != null
        ? structuredClone(config.latencyPolicy)
        : undefined;
      generation = 1;
      callSequence = 0;
      committed = cloneCommittedRuleSet(config.ruleSet, generation, nowIso);
    },

    stop(options) {
      if (operation.status !== 'running') {
        return;
      }
      if (inFlight.size > 0) {
        throw new GrpcMockRuntimeInFlightError(inFlight.size);
      }

      const nowIso = options?.nowIso ?? new Date().toISOString();
      operation = transitionGrpcAdvancedOperationState(operation, 'completed', { nowIso });
      committed = undefined;
      connectionId = undefined;
      latencyPolicy = undefined;
      generation = 0;
      callSequence = 0;
    },

    commitRuleSet(ruleSet, options) {
      requireRunning();
      assertGrpcMockRuleSet(ruleSet);

      const nowIso = options?.nowIso ?? new Date().toISOString();
      generation += 1;
      committed = cloneCommittedRuleSet(ruleSet, generation, nowIso);
      return structuredClone(committed);
    },

    beginCall(context, options) {
      const activeCommit = requireRunning();
      const callId = createCallId();
      const session: GrpcMockCallSession = {
        callId,
        generation: activeCommit.generation,
        pinnedCommit: structuredClone(activeCommit),
        context: structuredClone(context),
        startedAt: options?.nowIso ?? new Date().toISOString(),
      };
      inFlight.set(callId, session);
      return structuredClone(session);
    },

    evaluateSession(session) {
      const active = inFlight.get(session.callId);
      if (active == null) {
        throw new GrpcMockRuntimeUnknownCallError(session.callId);
      }
      return evaluateGrpcMockRuleSet(active.pinnedCommit.ruleSet, active.context);
    },

    endCall(callId) {
      if (!inFlight.delete(callId)) {
        throw new GrpcMockRuntimeUnknownCallError(callId);
      }
    },

    async executeUnaryCall(context, options) {
      const session = this.beginCall(context, options);
      callSequence += 1;
      const sequence = callSequence;

      try {
        const evaluation = this.evaluateSession(session);
        const latencyMs = resolveGrpcMockLatencyMs({
          responseLatencyMs: evaluation.response.latencyMs,
          policy: latencyPolicy,
          callSequence: sequence,
        });

        if (latencyMs > 0) {
          const sleep = options?.sleep ?? ((ms: number) => new Promise((resolve) => {
            setTimeout(resolve, ms);
          }));
          await sleep(latencyMs);
        }

        return {
          callId: session.callId,
          generation: session.generation,
          evaluation,
          latencyMs,
          completedAt: options?.nowIso ?? new Date().toISOString(),
        };
      } finally {
        this.endCall(session.callId);
      }
    },

    planStreamCall(context, options) {
      if (!isStreamingCallType(context.callType)) {
        throw new GrpcMockRuntimeUnsupportedCallTypeError(context.callType);
      }

      const session = this.beginCall(context, options);
      callSequence += 1;

      try {
        const evaluation = this.evaluateSession(session);
        const messages = planGrpcMockStreamMessages({
          evaluation,
          latencyPolicy,
          callSequence,
        });

        return {
          callId: session.callId,
          generation: session.generation,
          evaluation,
          messages,
          completedAt: options?.nowIso ?? new Date().toISOString(),
        };
      } finally {
        this.endCall(session.callId);
      }
    },
  };
}

export class GrpcMockRuntimeNotRunningError extends Error {
  readonly category = 'runtime' as const;

  constructor() {
    super('Mock runtime is not running.');
    this.name = 'GrpcMockRuntimeNotRunningError';
  }
}

export class GrpcMockRuntimeAlreadyRunningError extends Error {
  readonly category = 'runtime' as const;

  constructor() {
    super('Mock runtime is already running.');
    this.name = 'GrpcMockRuntimeAlreadyRunningError';
  }
}

export class GrpcMockRuntimeInFlightError extends Error {
  readonly category = 'runtime' as const;
  readonly inFlightCount: number;

  constructor(inFlightCount: number) {
    super(`Cannot stop mock runtime while ${inFlightCount} call(s) are in flight.`);
    this.name = 'GrpcMockRuntimeInFlightError';
    this.inFlightCount = inFlightCount;
  }
}

export class GrpcMockRuntimeUnknownCallError extends Error {
  readonly category = 'runtime' as const;
  readonly callId: string;

  constructor(callId: string) {
    super(`Unknown mock call session: ${callId}`);
    this.name = 'GrpcMockRuntimeUnknownCallError';
    this.callId = callId;
  }
}

export class GrpcMockRuntimeUnsupportedCallTypeError extends Error {
  readonly category = 'validation' as const;
  readonly callType: GrpcCallType;

  constructor(callType: GrpcCallType) {
    super(`Unsupported mock stream call type: ${callType}`);
    this.name = 'GrpcMockRuntimeUnsupportedCallTypeError';
    this.callType = callType;
  }
}
