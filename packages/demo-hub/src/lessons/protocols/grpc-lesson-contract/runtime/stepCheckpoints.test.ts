/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { GRPC } from '@shared/selectors';
import { grpcFirstCallLesson } from '../../grpc-first-call';
import { getGrpcStepCheckpointsForLesson } from './stepCheckpoints';

function extractTestId(selector: string): string | null {
  const match = selector.match(/data-testid="([^"]+)"/);
  return match?.[1] ?? null;
}

describe('grpc lesson step checkpoints', () => {
  it('maps GRPC-1 checkpoint step ids to lesson steps', () => {
    const lessonStepIds = new Set(grpcFirstCallLesson.steps.map((s) => s.id));
    const checkpoints = getGrpcStepCheckpointsForLesson('grpc-first-call');
    expect(checkpoints.length).toBeGreaterThan(0);
    for (const checkpoint of checkpoints) {
      expect(lessonStepIds.has(checkpoint.stepId)).toBe(true);
    }
  });

  it('aligns verifySelector with lesson verify data-testid when both exist', () => {
    const stepsById = Object.fromEntries(
      grpcFirstCallLesson.steps.map((s) => [s.id, s]),
    );
    for (const checkpoint of getGrpcStepCheckpointsForLesson('grpc-first-call')) {
      if (!checkpoint.verifySelector) continue;
      const step = stepsById[checkpoint.stepId];
      expect(step?.verify).toBeTruthy();
      const expected = extractTestId(step.verify!);
      expect(checkpoint.verifySelector).toBe(expected);
    }
  });

  it('covers GRPC-1 steps that define verify selectors', () => {
    const checkpointByStep = Object.fromEntries(
      getGrpcStepCheckpointsForLesson('grpc-first-call').map((c) => [c.stepId, c]),
    );
    for (const step of grpcFirstCallLesson.steps) {
      if (!step.verify) continue;
      const testId = extractTestId(step.verify);
      expect(checkpointByStep[step.id]?.verifySelector).toBe(testId);
    }
  });

  it('uses canonical GRPC selector test ids', () => {
    const expected = {
      'grpc1-target': extractTestId(GRPC.TARGET_STATUS_OK),
      'grpc1-reflect': extractTestId(GRPC.EXPLORER_TREE),
      'grpc1-select-method': extractTestId(GRPC.PROTO_FORM),
      'grpc1-send': extractTestId(GRPC.RESPONSE_BODY),
      'grpc1-history': extractTestId(GRPC.HISTORY_LIST),
    };
    const checkpointByStep = Object.fromEntries(
      getGrpcStepCheckpointsForLesson('grpc-first-call').map((c) => [c.stepId, c]),
    );
    for (const [stepId, testId] of Object.entries(expected)) {
      expect(checkpointByStep[stepId]?.verifySelector).toBe(testId);
    }
  });
});
