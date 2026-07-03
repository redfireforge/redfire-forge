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
  { stepId: 'grpc1-history', setsFlags: { executed: true }, verifySelector: 'grpc-history-replay-btn' },
] as const;

const GRPC_SCHEMA_DISCOVERY_CHECKPOINTS: readonly GrpcLessonStepCheckpoint[] = [
  { stepId: 'grpc16-target', setsFlags: { targetSet: true }, verifySelector: 'grpc-target-status-ok' },
  { stepId: 'grpc16-reflect', setsFlags: { reflected: true }, verifySelector: 'grpc-explorer-tree' },
  { stepId: 'grpc16-source', setsFlags: { reflected: true }, verifySelector: 'grpc-explorer-source' },
  { stepId: 'grpc16-schema-browser', setsFlags: { reflected: true }, verifySelector: 'grpc-schema-browser' },
  { stepId: 'grpc16-open-method', setsFlags: { methodSelected: true, executed: true }, verifySelector: 'grpc-response-body' },
  { stepId: 'grpc16-drift', setsFlags: { methodSelected: true }, verifySelector: 'grpc-service-explorer' },
] as const;

const GRPC_STREAMING_CHECKPOINTS: readonly GrpcLessonStepCheckpoint[] = [
  { stepId: 'grpc3-server-select', setsFlags: { methodSelected: true }, verifySelector: 'grpc-call-type-selector' },
  { stepId: 'grpc3-server-fill', setsFlags: { methodSelected: true }, verifySelector: 'grpc-stream-log-list' },
  { stepId: 'grpc3-server-status', setsFlags: { reflected: true }, verifySelector: 'grpc-stream-status-bar' },
  { stepId: 'grpc3-client-select', setsFlags: { methodSelected: true }, verifySelector: 'grpc-stream-add-queue-btn' },
  { stepId: 'grpc3-client-queue', setsFlags: { messageFilled: true }, verifySelector: 'grpc-stream-pending-panel' },
  { stepId: 'grpc3-client-send', setsFlags: { executed: true }, verifySelector: 'grpc-stream-log-list' },
  { stepId: 'grpc3-bidi-select', setsFlags: { methodSelected: true }, verifySelector: 'grpc-stream-start-btn' },
  { stepId: 'grpc3-bidi-exchange', setsFlags: { executed: true }, verifySelector: 'grpc-stream-log-list' },
  { stepId: 'grpc3-cancel', setsFlags: { executed: true }, verifySelector: 'grpc-stream-status-bar' },
  { stepId: 'grpc3-export', setsFlags: { executed: true }, verifySelector: 'grpc-stream-export-log-btn' },
] as const;

const CHECKPOINTS_BY_LESSON: Readonly<Record<string, readonly GrpcLessonStepCheckpoint[]>> = {
  'grpc-first-call': GRPC_FIRST_CALL_CHECKPOINTS,
  'grpc-schema-discovery': GRPC_SCHEMA_DISCOVERY_CHECKPOINTS,
  'grpc-streaming': GRPC_STREAMING_CHECKPOINTS,
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
