/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { GRPC1_LESSON } from '../../../../../e2e/grpc-lesson/constants';
import { validateGrpcDemoLesson, getGrpcLessonRosterEntry } from './grpc-lesson-contract';
import { grpcFirstCallLesson } from './grpc-first-call';

describe('grpc-first-call lesson', () => {
  it('registers GRPC-1 metadata and 10 steps', () => {
    expect(grpcFirstCallLesson.id).toBe('grpc-first-call');
    expect(grpcFirstCallLesson.category).toBe('grpc');
    expect(grpcFirstCallLesson.grpc.rosterNumber).toBe(1);
    expect(grpcFirstCallLesson.steps).toHaveLength(10);
    expect(grpcFirstCallLesson.dockerEndpoints?.some((u) => u.includes('50052'))).toBe(true);
    expect(grpcFirstCallLesson.dockerEndpoints?.some((u) => u.includes('3001'))).toBe(true);
    expect(grpcFirstCallLesson.gateLabel).toBe('🐳 Local setup required');
  });

  it('passes Phase 12A lesson contract validation', () => {
    const result = validateGrpcDemoLesson(grpcFirstCallLesson);
    expect(result.ok, result.issues.map((i) => `${i.path}: ${i.message}`).join('\n')).toBe(true);
  });

  it('final step highlights Send Unary and verifies response body', () => {
    const last = grpcFirstCallLesson.steps.at(-1)!;
    expect(last.id).toBe('grpc1-replay');
    expect(last.verify).toContain('grpc-response-body');
    expect(last.highlight).toContain('grpc-send-btn');
  });

  it('select-method step verifies Form Input scroll region', () => {
    const selectStep = grpcFirstCallLesson.steps.find((s) => s.id === 'grpc1-select-method')!;
    expect(selectStep.verify).toContain('grpc-request-form-scroll');
  });

  it('grpc1-history-tab step highlights Call History', () => {
    const historyTabStep = grpcFirstCallLesson.steps.find((s) => s.id === 'grpc1-history-tab')!;
    expect(historyTabStep.highlight).toContain('grpc-sub-nav-history');
    expect(historyTabStep.verify).toContain('grpc-history-panel');
  });

  it('grpc1-history step highlights Replay and transitions to Send Unary', () => {
    const historyStep = grpcFirstCallLesson.steps.find((s) => s.id === 'grpc1-history')!;
    expect(historyStep.highlight).toContain('grpc-history-replay-btn');
    expect(historyStep.verify).toContain('grpc-send-btn');
  });

  it('declares allowedTabs so history sub-nav does not auto-exit live demo', () => {
    expect(grpcFirstCallLesson.allowedTabs).toContain('grpc-studio');
    expect(grpcFirstCallLesson.allowedTabs).toContain('demo-hub');
    expect(grpcFirstCallLesson.initialTab).toBe('grpc-studio');
  });

  it('id and title stay in sync with E2E constants and roster', () => {
    expect(grpcFirstCallLesson.id).toBe(GRPC1_LESSON.id);
    expect(grpcFirstCallLesson.name).toBe(GRPC1_LESSON.name);
    expect(GRPC1_LESSON.name).toBe(getGrpcLessonRosterEntry('grpc-first-call')!.title);
  });
});
