/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  isGrpcStudioLesson,
  pauseGrpcStudioLessonRun,
  runGrpcStudioLessonSetup,
  runGrpcStudioLessonTeardown,
  restartGrpcStudioLessonRun,
  resumeGrpcStudioLessonRun,
  syncGrpcStudioLessonStep,
  syncGrpcStudioLessonStepOnComplete,
  clearGrpcStudioLessonRun,
  completeGrpcStudioLessonRun,
} from './grpcLessonRuntimeAdapter';
import { grpcFirstCallLesson } from '../lessons/protocols/grpc-first-call';
import { getGrpcLessonRun, __resetGrpcLessonRunForTests } from '../lessons/protocols/grpc-lesson-contract/runtime';
import type { DemoActionContext } from '../types';

describe('grpcLessonRuntimeAdapter', () => {
  beforeEach(() => {
    __resetGrpcLessonRunForTests();
  });

  it('detects gRPC studio lessons by category', () => {
    expect(isGrpcStudioLesson(grpcFirstCallLesson)).toBe(true);
    expect(isGrpcStudioLesson({ ...grpcFirstCallLesson, category: 'graphql' } as never)).toBe(false);
  });

  it('setup begins an in-memory run', () => {
    const run = runGrpcStudioLessonSetup(grpcFirstCallLesson);
    expect(run.lessonId).toBe('grpc-first-call');
    expect(getGrpcLessonRun()?.runId).toBe(run.runId);
  });

  it('clearGrpcStudioLessonRun ends active session without cleanup', () => {
    runGrpcStudioLessonSetup(grpcFirstCallLesson);
    clearGrpcStudioLessonRun();
    expect(getGrpcLessonRun()).toBeNull();
  });

  it('pause marks run paused without clearing run state', () => {
    runGrpcStudioLessonSetup(grpcFirstCallLesson);
    pauseGrpcStudioLessonRun();
    expect(getGrpcLessonRun()?.status).toBe('paused');
  });

  it('syncGrpcStudioLessonStep updates checkpoints', () => {
    runGrpcStudioLessonSetup(grpcFirstCallLesson);
    syncGrpcStudioLessonStep(grpcFirstCallLesson, 'grpc1-target', 1);
    expect(getGrpcLessonRun()?.flags.targetSet).toBe(true);
  });

  it('sync helpers are no-op for non-gRPC lessons', () => {
    runGrpcStudioLessonSetup(grpcFirstCallLesson);
    const nonGrpc = { ...grpcFirstCallLesson, category: 'graphql' } as never;
    syncGrpcStudioLessonStep(nonGrpc, 'grpc1-target', 1);
    syncGrpcStudioLessonStepOnComplete(nonGrpc, 'grpc1-fill-message', 4, {
      verifyRequired: false,
      verified: true,
    });
    expect(getGrpcLessonRun()?.flags.targetSet).toBe(false);
    expect(getGrpcLessonRun()?.stepIndex).toBe(0);
  });

  it('syncGrpcStudioLessonStepOnComplete advances unverified checkpoint steps', () => {
    runGrpcStudioLessonSetup(grpcFirstCallLesson);
    syncGrpcStudioLessonStepOnComplete(grpcFirstCallLesson, 'grpc1-fill-message', 4, {
      verifyRequired: false,
      verified: true,
    });
    expect(getGrpcLessonRun()?.flags.messageFilled).toBe(true);
    expect(getGrpcLessonRun()?.stepIndex).toBe(4);
  });

  it('syncGrpcStudioLessonStepOnComplete advances step index without checkpoints', () => {
    runGrpcStudioLessonSetup(grpcFirstCallLesson);
    syncGrpcStudioLessonStepOnComplete(grpcFirstCallLesson, 'grpc1-response', 6, {
      verifyRequired: false,
      verified: true,
    });
    expect(getGrpcLessonRun()?.stepIndex).toBe(6);
  });

  it('syncGrpcStudioLessonStepOnComplete skips failed verify steps', () => {
    runGrpcStudioLessonSetup(grpcFirstCallLesson);
    syncGrpcStudioLessonStepOnComplete(grpcFirstCallLesson, 'grpc1-target', 1, {
      verifyRequired: true,
      verified: false,
    });
    expect(getGrpcLessonRun()?.flags.targetSet).toBe(false);
    expect(getGrpcLessonRun()?.stepIndex).toBe(0);
  });

  it('restart issues a new run id', () => {
    const first = runGrpcStudioLessonSetup(grpcFirstCallLesson);
    const second = restartGrpcStudioLessonRun(grpcFirstCallLesson);
    expect(second.runId).not.toBe(first.runId);
  });

  it('resume is safe when run is already running', () => {
    runGrpcStudioLessonSetup(grpcFirstCallLesson);
    const before = getGrpcLessonRun();
    resumeGrpcStudioLessonRun();
    expect(getGrpcLessonRun()?.runId).toBe(before?.runId);
    expect(getGrpcLessonRun()?.status).toBe('running');
  });

  it('complete marks run completed', () => {
    runGrpcStudioLessonSetup(grpcFirstCallLesson);
    completeGrpcStudioLessonRun();
    expect(getGrpcLessonRun()?.status).toBe('completed');
  });

  it('teardown clears runtime after cleanup', async () => {
    runGrpcStudioLessonSetup(grpcFirstCallLesson);
    const ctx = {
      navigateToTab: () => {},
      click: async () => {},
      fill: async () => {},
      selectOption: async () => {},
      waitFor: async () => {},
      delay: async () => {},
    } satisfies DemoActionContext;
    await runGrpcStudioLessonTeardown(grpcFirstCallLesson, ctx);
    expect(getGrpcLessonRun()).toBeNull();
  });

  it('teardown logs warning and still clears runtime when cleanup throws', async () => {
    runGrpcStudioLessonSetup(grpcFirstCallLesson);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const badLesson = {
      ...grpcFirstCallLesson,
      cleanup: async () => {
        throw new Error('cleanup failed');
      },
    };
    const ctx = {
      navigateToTab: () => {},
      click: async () => {},
      fill: async () => {},
      selectOption: async () => {},
      waitFor: async () => {},
      delay: async () => {},
    } satisfies DemoActionContext;

    await runGrpcStudioLessonTeardown(badLesson, ctx);
    expect(warnSpy).toHaveBeenCalled();
    expect(getGrpcLessonRun()).toBeNull();
    warnSpy.mockRestore();
  });
});
