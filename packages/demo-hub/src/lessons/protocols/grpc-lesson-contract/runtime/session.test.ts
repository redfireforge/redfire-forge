/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  __resetGrpcLessonRunForTests,
  advanceGrpcLessonRunStep,
  beginGrpcLessonRun,
  completeGrpcLessonRun,
  endGrpcLessonRun,
  getGrpcLessonRun,
  pauseGrpcLessonRun,
  resetGrpcLessonRun,
  resumeGrpcLessonRun,
  setGrpcLessonRunFlag,
} from './session';

describe('grpc lesson runtime session', () => {
  beforeEach(() => {
    __resetGrpcLessonRunForTests();
  });

  it('begins a run with frozen snapshot', () => {
    const run = beginGrpcLessonRun('grpc-first-call');
    expect(run.status).toBe('running');
    expect(run.snapshot.lessonId).toBe('grpc-first-call');
    expect(getGrpcLessonRun()?.runId).toBe(run.runId);
  });

  it('begins GRPC-16 with consolidated schema discovery snapshot', () => {
    const run = beginGrpcLessonRun('grpc-schema-discovery');
    expect(run.status).toBe('running');
    expect(run.snapshot.lessonId).toBe('grpc-schema-discovery');
    expect(run.snapshot.descriptorSource).toBe('reflection');
  });

  it('rejects begin when an active run already exists', () => {
    beginGrpcLessonRun('grpc-first-call');
    expect(() => beginGrpcLessonRun('grpc-first-call')).toThrow(/Invalid gRPC lesson transition/);
  });

  it('preserves snapshot fingerprint across separate runs', () => {
    const first = beginGrpcLessonRun('grpc-first-call');
    const fingerprint = first.snapshot.fingerprint;
    resetGrpcLessonRun('grpc-first-call');
    const second = getGrpcLessonRun()!;
    expect(second.runId).not.toBe(first.runId);
    expect(second.snapshot.fingerprint).toBe(fingerprint);
  });

  it('advances step checkpoints for GRPC-1', () => {
    beginGrpcLessonRun('grpc-first-call');
    advanceGrpcLessonRunStep('grpc-first-call', 'grpc1-target', 1);
    expect(getGrpcLessonRun()?.flags.targetSet).toBe(true);
    expect(getGrpcLessonRun()?.stepIndex).toBe(1);
  });

  it('pause and resume preserve flags', () => {
    beginGrpcLessonRun('grpc-first-call');
    advanceGrpcLessonRunStep('grpc-first-call', 'grpc1-reflect', 2);
    pauseGrpcLessonRun();
    expect(getGrpcLessonRun()?.status).toBe('paused');
    expect(getGrpcLessonRun()?.flags.reflected).toBe(true);
    resumeGrpcLessonRun();
    expect(getGrpcLessonRun()?.status).toBe('running');
    expect(getGrpcLessonRun()?.flags.reflected).toBe(true);
  });

  it('resume is a no-op when run is already running', () => {
    const run = beginGrpcLessonRun('grpc-first-call');
    const resumed = resumeGrpcLessonRun();
    expect(resumed?.status).toBe('running');
    expect(resumed?.runId).toBe(run.runId);
  });

  it('complete transitions running run to completed', () => {
    beginGrpcLessonRun('grpc-first-call');
    completeGrpcLessonRun();
    expect(getGrpcLessonRun()?.status).toBe('completed');
  });

  it('restart issues new runId and clears flags', () => {
    const first = beginGrpcLessonRun('grpc-first-call');
    advanceGrpcLessonRunStep('grpc-first-call', 'grpc1-send', 5);
    const second = resetGrpcLessonRun('grpc-first-call');
    expect(second.runId).not.toBe(first.runId);
    expect(second.flags.executed).toBe(false);
  });

  it('endGrpcLessonRun clears active session', () => {
    beginGrpcLessonRun('grpc-first-call');
    endGrpcLessonRun();
    expect(getGrpcLessonRun()).toBeNull();
  });

  it('advanceGrpcLessonRunStep ignores mismatched lesson id', () => {
    beginGrpcLessonRun('grpc-first-call');
    advanceGrpcLessonRunStep('grpc-tls', 'grpc1-target', 1);
    expect(getGrpcLessonRun()?.flags.targetSet).toBe(false);
    expect(getGrpcLessonRun()?.stepIndex).toBe(0);
  });

  it('complete is idempotent when already completed', () => {
    beginGrpcLessonRun('grpc-first-call');
    completeGrpcLessonRun();
    const first = getGrpcLessonRun();
    completeGrpcLessonRun();
    expect(getGrpcLessonRun()?.status).toBe('completed');
    expect(getGrpcLessonRun()?.runId).toBe(first?.runId);
  });

  it('setGrpcLessonRunFlag is ignored on terminal statuses', () => {
    beginGrpcLessonRun('grpc-first-call');
    completeGrpcLessonRun();
    setGrpcLessonRunFlag('targetSet', true);
    expect(getGrpcLessonRun()?.flags.targetSet).toBe(false);
  });

  it('advanceGrpcLessonRunStep is ignored on completed runs', () => {
    beginGrpcLessonRun('grpc-first-call');
    completeGrpcLessonRun();
    advanceGrpcLessonRunStep('grpc-first-call', 'grpc1-target', 1);
    expect(getGrpcLessonRun()?.stepIndex).toBe(0);
    expect(getGrpcLessonRun()?.flags.targetSet).toBe(false);
  });
});
