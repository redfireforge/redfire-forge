/**
 * Phase 12B — in-memory active gRPC lesson run (tab-scoped; cleared on teardown).
 * Durable progress persistence ships in 12C.
 */
import { buildGrpcScenarioSnapshotForLesson } from './snapshots';
import { getGrpcStepCheckpoint } from './stepCheckpoints';
import {
  assertGrpcLessonRunTransition,
  canTransitionGrpcLessonRun,
  transitionGrpcLessonRun,
} from './stateMachine';
import { EMPTY_GRPC_LESSON_RUN_FLAGS } from './types';
import type { GrpcLessonRunFlags, GrpcLessonRunState } from './types';

let activeRun: GrpcLessonRunState | null = null;

export function getGrpcLessonRun(): GrpcLessonRunState | null {
  return activeRun;
}

export function getGrpcLessonRunFlags(): GrpcLessonRunFlags {
  return activeRun?.flags ?? { ...EMPTY_GRPC_LESSON_RUN_FLAGS };
}

export function setGrpcLessonRunFlag<K extends keyof GrpcLessonRunFlags>(
  key: K,
  value: GrpcLessonRunFlags[K],
): void {
  if (!activeRun) return;
  if (
    activeRun.status === 'completed'
    || activeRun.status === 'failed'
    || activeRun.status === 'locked'
  ) {
    return;
  }
  activeRun = {
    ...activeRun,
    flags: { ...activeRun.flags, [key]: value },
  };
}

/** Start a new live run with a frozen scenario snapshot. */
export function beginGrpcLessonRun(lessonId: string): GrpcLessonRunState {
  const snapshot = buildGrpcScenarioSnapshotForLesson(lessonId);
  if (!snapshot) {
    throw new Error(`No scenario snapshot registered for gRPC lesson "${lessonId}"`);
  }
  const event = { type: 'start' as const, lessonId, snapshot };
  assertGrpcLessonRunTransition(activeRun, event);
  activeRun = transitionGrpcLessonRun(activeRun, event);
  return activeRun!;
}

/** Pause an in-flight run (auto-play off). */
export function pauseGrpcLessonRun(): GrpcLessonRunState | null {
  if (!activeRun) return null;
  const event = { type: 'pause' as const };
  if (!canTransitionGrpcLessonRun(activeRun, event)) return activeRun;
  activeRun = transitionGrpcLessonRun(activeRun, event);
  return activeRun;
}

/** Resume a paused run (no-op when not paused). */
export function resumeGrpcLessonRun(): GrpcLessonRunState | null {
  if (!activeRun) return null;
  const event = { type: 'resume' as const };
  if (!canTransitionGrpcLessonRun(activeRun, event)) return activeRun;
  activeRun = transitionGrpcLessonRun(activeRun, event);
  return activeRun;
}

/** Restart run — new runId, reset flags, same snapshot template. */
export function resetGrpcLessonRun(lessonId: string): GrpcLessonRunState {
  const snapshot = buildGrpcScenarioSnapshotForLesson(lessonId);
  if (!snapshot) {
    throw new Error(`No scenario snapshot registered for gRPC lesson "${lessonId}"`);
  }
  if (activeRun == null) {
    return beginGrpcLessonRun(lessonId);
  }
  const event = { type: 'reset' as const, lessonId, snapshot };
  assertGrpcLessonRunTransition(activeRun, event);
  activeRun = transitionGrpcLessonRun(activeRun, event);
  return activeRun!;
}

/** Mark run completed (last step finished). */
export function completeGrpcLessonRun(): GrpcLessonRunState | null {
  if (!activeRun) return null;
  const event = { type: 'complete' as const };
  if (!canTransitionGrpcLessonRun(activeRun, event)) return activeRun;
  activeRun = transitionGrpcLessonRun(activeRun, event);
  return activeRun;
}

/** Record step index + checkpoint flags after verify passes. */
export function advanceGrpcLessonRunStep(
  lessonId: string,
  stepId: string,
  stepIndex: number,
): GrpcLessonRunState | null {
  if (!activeRun || activeRun.lessonId !== lessonId) return activeRun;

  const checkpoint = getGrpcStepCheckpoint(lessonId, stepId);
  const event = {
    type: 'step-advance' as const,
    stepIndex,
    flags: checkpoint?.setsFlags,
  };
  if (!canTransitionGrpcLessonRun(activeRun, event)) return activeRun;
  activeRun = transitionGrpcLessonRun(activeRun, event);
  return activeRun;
}

/** Clear in-memory run — idempotent. */
export function endGrpcLessonRun(): void {
  activeRun = null;
}

/** Test-only reset. */
export function __resetGrpcLessonRunForTests(): void {
  activeRun = null;
}
