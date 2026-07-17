/**
 * Demo Hub ↔ gRPC lesson runtime adapter (Phase 12B).
 * Lessons import runtime helpers from grpc-lesson-contract — not from useDemoHub.
 */
import type { DemoActionContext, DemoLesson } from '../types';
import {
  advanceGrpcLessonRunStep,
  beginGrpcLessonRun,
  completeGrpcLessonRun,
  endGrpcLessonRun,
  pauseGrpcLessonRun,
  resetGrpcLessonRun,
  resumeGrpcLessonRun,
  type GrpcLessonRunState,
} from '../lessons/protocols/grpc-lesson-contract/runtime';

export function isGrpcStudioLesson(lesson: DemoLesson): boolean {
  return lesson.category === 'grpc';
}

/** Begin in-memory run with frozen scenario snapshot. */
export function runGrpcStudioLessonSetup(lesson: DemoLesson): GrpcLessonRunState {
  endGrpcLessonRun();
  return beginGrpcLessonRun(lesson.id);
}

/** Clear in-memory run without lesson cleanup — used during restart windows. */
export function clearGrpcStudioLessonRun(): void {
  endGrpcLessonRun();
}

/** Pause live auto-play without tearing down scenario flags. */
export function pauseGrpcStudioLessonRun(): void {
  pauseGrpcLessonRun();
}

/** Resume after manual pause. */
export function resumeGrpcStudioLessonRun(): void {
  resumeGrpcLessonRun();
}

/** Advance runtime checkpoints after a step completes verify. */
export function syncGrpcStudioLessonStep(
  lesson: DemoLesson,
  stepId: string,
  stepIndex: number,
): void {
  if (!isGrpcStudioLesson(lesson)) return;
  advanceGrpcLessonRunStep(lesson.id, stepId, stepIndex);
}

/**
 * Advance runtime checkpoints when a gRPC lesson step finishes.
 * Skips sync when a step required verify and the selector was not found.
 */
export function syncGrpcStudioLessonStepOnComplete(
  lesson: DemoLesson,
  stepId: string,
  stepIndex: number,
  options: { verifyRequired: boolean; verified: boolean },
): void {
  if (!isGrpcStudioLesson(lesson)) return;
  if (options.verifyRequired && !options.verified) return;
  advanceGrpcLessonRunStep(lesson.id, stepId, stepIndex);
}

/** Restart live demo — new runId, reset flags (run must already exist). */
export function restartGrpcStudioLessonRun(lesson: DemoLesson): GrpcLessonRunState {
  return resetGrpcLessonRun(lesson.id);
}

/** Mark the active run completed when the user confirms the lesson. */
export function completeGrpcStudioLessonRun(): void {
  completeGrpcLessonRun();
}

/** Lesson cleanup + clear in-memory runtime session. */
export async function runGrpcStudioLessonTeardown(
  lesson: DemoLesson,
  ctx: DemoActionContext,
): Promise<void> {
  try {
    if (lesson.cleanup) {
      await lesson.cleanup(ctx);
    }
  } catch (e) {
    console.warn('[DemoHub] gRPC lesson cleanup failed:', e);
  } finally {
    endGrpcLessonRun();
  }
}
