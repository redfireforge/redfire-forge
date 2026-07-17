/**
 * Phase 12B — pure state machine for gRPC lesson live runs.
 */
import { EMPTY_GRPC_LESSON_RUN_FLAGS } from './types';
import type {
  GrpcLessonRunFlags,
  GrpcLessonRunState,
  GrpcLessonRuntimeEvent,
  GrpcLessonRuntimeStatus,
} from './types';

function cloneFlags(flags: GrpcLessonRunFlags): GrpcLessonRunFlags {
  return { ...flags };
}

function mergeFlags(
  flags: GrpcLessonRunFlags,
  patch?: Partial<GrpcLessonRunFlags>,
): GrpcLessonRunFlags {
  if (!patch) return cloneFlags(flags);
  return { ...flags, ...patch };
}

function newRunId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `grpc-run-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function baseRunState(
  lessonId: string,
  snapshot: GrpcLessonRunState['snapshot'],
  status: GrpcLessonRuntimeStatus,
): GrpcLessonRunState {
  return {
    status,
    lessonId,
    runId: newRunId(),
    snapshot,
    stepIndex: 0,
    flags: { ...EMPTY_GRPC_LESSON_RUN_FLAGS },
    startedAt: Date.now(),
  };
}

/** Returns whether `event` is legal from `state` (null = idle / no active run). */
export function canTransitionGrpcLessonRun(
  state: GrpcLessonRunState | null,
  event: GrpcLessonRuntimeEvent,
): boolean {
  switch (event.type) {
    case 'start':
      return state == null || state.status === 'idle';
    case 'reset':
      return state != null && state.status !== 'locked';
    case 'lock':
      return (
        state == null
        || state.status === 'idle'
        || state.status === 'running'
        || state.status === 'paused'
      );
    case 'pause':
      return state?.status === 'running';
    case 'resume':
      return state?.status === 'paused';
    case 'complete':
      return state?.status === 'running' || state?.status === 'paused';
    case 'fail':
      return state?.status === 'running' || state?.status === 'paused';
    case 'step-advance':
      return state?.status === 'running' || state?.status === 'paused';
    default:
      return false;
  }
}

export function assertGrpcLessonRunTransition(
  state: GrpcLessonRunState | null,
  event: GrpcLessonRuntimeEvent,
): void {
  if (!canTransitionGrpcLessonRun(state, event)) {
    const from = state?.status ?? 'idle';
    throw new Error(`Invalid gRPC lesson transition: ${from} + ${event.type}`);
  }
}

/** Apply a runtime event and return the next state (`null` = idle / ended). */
export function transitionGrpcLessonRun(
  state: GrpcLessonRunState | null,
  event: GrpcLessonRuntimeEvent,
): GrpcLessonRunState | null {
  assertGrpcLessonRunTransition(state, event);

  switch (event.type) {
    case 'start':
      return { ...baseRunState(event.lessonId, event.snapshot, 'running') };

    case 'reset':
      return {
        ...baseRunState(event.lessonId, event.snapshot, 'running'),
        stepIndex: 0,
      };

    case 'lock':
      if (state == null) {
        return {
          status: 'locked',
          lessonId: event.lessonId,
          runId: newRunId(),
          snapshot: event.snapshot,
          stepIndex: 0,
          flags: { ...EMPTY_GRPC_LESSON_RUN_FLAGS },
          startedAt: Date.now(),
          lockReason: event.reason,
        };
      }
      return {
        ...state,
        status: 'locked',
        lockReason: event.reason,
      };

    case 'pause':
      return state ? { ...state, status: 'paused' } : state;

    case 'resume':
      return state ? { ...state, status: 'running', lastError: undefined } : state;

    case 'complete':
      return state ? { ...state, status: 'completed', lastError: undefined } : state;

    case 'fail':
      return state ? { ...state, status: 'failed', lastError: event.error } : state;

    case 'step-advance':
      return state
        ? {
            ...state,
            stepIndex: event.stepIndex,
            flags: mergeFlags(state.flags, event.flags),
          }
        : state;

    default:
      return state;
  }
}
