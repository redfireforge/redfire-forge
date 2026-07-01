/**
 * Phase 12B — step id → runtime checkpoint mapping per shipped lesson.
 */
import type { GrpcLessonStepCheckpoint } from './types';

const GRPC_FIRST_CALL_CHECKPOINTS: readonly GrpcLessonStepCheckpoint[] = [
  { stepId: 'grpc1-target', setsFlags: { targetSet: true }, verifySelector: 'grpc-target-status-ok' },
  { stepId: 'grpc1-reflect', setsFlags: { reflected: true }, verifySelector: 'grpc-explorer-tree' },
  { stepId: 'grpc1-select-method', setsFlags: { methodSelected: true }, verifySelector: 'grpc-proto-form' },
  { stepId: 'grpc1-fill-message', setsFlags: { messageFilled: true } },
  { stepId: 'grpc1-send', setsFlags: { executed: true }, verifySelector: 'grpc-response-body' },
  { stepId: 'grpc1-history', setsFlags: { executed: true }, verifySelector: 'grpc-history-list' },
] as const;

const CHECKPOINTS_BY_LESSON: Readonly<Record<string, readonly GrpcLessonStepCheckpoint[]>> = {
  'grpc-first-call': GRPC_FIRST_CALL_CHECKPOINTS,
};

export function getGrpcStepCheckpointsForLesson(lessonId: string): readonly GrpcLessonStepCheckpoint[] {
  return CHECKPOINTS_BY_LESSON[lessonId] ?? [];
}

export function getGrpcStepCheckpoint(
  lessonId: string,
  stepId: string,
): GrpcLessonStepCheckpoint | undefined {
  return getGrpcStepCheckpointsForLesson(lessonId).find((c) => c.stepId === stepId);
}
