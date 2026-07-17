/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import {
  assertGrpcLessonRunTransition,
  canTransitionGrpcLessonRun,
  transitionGrpcLessonRun,
} from './stateMachine';
import { buildGrpcFirstCallScenarioSnapshot } from './snapshots';
import type { GrpcLessonRunState } from './types';

const snapshot = buildGrpcFirstCallScenarioSnapshot();

function runningState(): GrpcLessonRunState {
  return transitionGrpcLessonRun(null, {
    type: 'start',
    lessonId: 'grpc-first-call',
    snapshot,
  })!;
}

describe('transitionGrpcLessonRun', () => {
  it('starts from idle into running', () => {
    const state = runningState();
    expect(state.status).toBe('running');
    expect(state.lessonId).toBe('grpc-first-call');
    expect(state.flags.targetSet).toBe(false);
  });

  it('pauses and resumes a running lesson', () => {
    const running = runningState();
    const paused = transitionGrpcLessonRun(running, { type: 'pause' });
    expect(paused?.status).toBe('paused');
    const resumed = transitionGrpcLessonRun(paused, { type: 'resume' });
    expect(resumed?.status).toBe('running');
  });

  it('resets with a new runId and cleared flags', () => {
    const running = runningState();
    const advanced = transitionGrpcLessonRun(running, {
      type: 'step-advance',
      stepIndex: 2,
      flags: { targetSet: true, reflected: true },
    })!;
    const reset = transitionGrpcLessonRun(advanced, {
      type: 'reset',
      lessonId: 'grpc-first-call',
      snapshot,
    })!;
    expect(reset.runId).not.toBe(advanced.runId);
    expect(reset.flags.targetSet).toBe(false);
    expect(reset.stepIndex).toBe(0);
  });

  it('allows reset from completed status', () => {
    const completed = transitionGrpcLessonRun(runningState(), { type: 'complete' })!;
    const reset = transitionGrpcLessonRun(completed, {
      type: 'reset',
      lessonId: 'grpc-first-call',
      snapshot,
    })!;
    expect(reset.status).toBe('running');
    expect(reset.runId).not.toBe(completed.runId);
  });

  it('rejects invalid transitions', () => {
    expect(canTransitionGrpcLessonRun(null, { type: 'pause' })).toBe(false);
    expect(() => assertGrpcLessonRunTransition(null, { type: 'pause' })).toThrow(/Invalid gRPC lesson transition/);
  });

  it('covers valid and invalid transitions across runtime statuses', () => {
    const running = runningState();
    const paused = transitionGrpcLessonRun(running, { type: 'pause' })!;
    const completed = transitionGrpcLessonRun(running, { type: 'complete' })!;
    const failed = transitionGrpcLessonRun(running, { type: 'fail', error: 'boom' })!;
    const locked = transitionGrpcLessonRun(null, {
      type: 'lock',
      lessonId: 'grpc-first-call',
      reason: 'blocked',
      snapshot,
    })!;

    expect(canTransitionGrpcLessonRun(running, { type: 'resume' })).toBe(false);
    expect(canTransitionGrpcLessonRun(paused, { type: 'pause' })).toBe(false);
    expect(canTransitionGrpcLessonRun(completed, { type: 'pause' })).toBe(false);
    expect(canTransitionGrpcLessonRun(failed, { type: 'resume' })).toBe(false);
    expect(canTransitionGrpcLessonRun(locked, { type: 'reset', lessonId: 'grpc-first-call', snapshot })).toBe(false);
    expect(canTransitionGrpcLessonRun(completed, {
      type: 'step-advance',
      stepIndex: 1,
      flags: { targetSet: true },
    })).toBe(false);
    expect(canTransitionGrpcLessonRun(failed, {
      type: 'step-advance',
      stepIndex: 1,
    })).toBe(false);
    expect(canTransitionGrpcLessonRun(paused, { type: 'complete' })).toBe(true);
    expect(canTransitionGrpcLessonRun(running, { type: 'fail', error: 'x' })).toBe(true);
  });

  it('locks from idle with snapshot', () => {
    const locked = transitionGrpcLessonRun(null, {
      type: 'lock',
      lessonId: 'grpc-first-call',
      reason: 'Phase 11 not shipped',
      snapshot,
    });
    expect(locked?.status).toBe('locked');
    expect(locked?.lockReason).toContain('Phase 11');
  });
});
