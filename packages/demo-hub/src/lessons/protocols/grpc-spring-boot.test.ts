/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeCtx } from './ws-test-utils';
import { validateGrpcDemoLesson, getGrpcLessonRosterEntry } from './grpc-lesson-contract';
import { grpcSpringBootLesson } from './grpc-spring-boot';

const helperSpies = vi.hoisted(() => ({
  grpcFirstCallSetup: vi.fn(async () => {}),
  grpcFirstCallCleanup: vi.fn(async () => {}),
  resetSpringBaselineQuiet: vi.fn(async () => {}),
  upsertWorkspaceDefaults: vi.fn(),
}));

vi.mock('./grpc-lesson-helpers', async () => {
  const actual = await vi.importActual<typeof import('./grpc-lesson-helpers')>('./grpc-lesson-helpers');
  return {
    ...actual,
    grpcFirstCallSetup: helperSpies.grpcFirstCallSetup,
    grpcFirstCallCleanup: helperSpies.grpcFirstCallCleanup,
  };
});

vi.mock('./grpc-spring-boot-helpers', async () => {
  const actual = await vi.importActual<typeof import('./grpc-spring-boot-helpers')>('./grpc-spring-boot-helpers');
  return {
    ...actual,
    resetSpringBaselineQuiet: helperSpies.resetSpringBaselineQuiet,
  };
});

vi.mock('../../adapters', async () => {
  const actual = await vi.importActual<typeof import('../../adapters')>('../../adapters');
  return {
    ...actual,
    upsertWorkspaceDefaults: helperSpies.upsertWorkspaceDefaults,
  };
});

describe('grpc-spring-boot lesson', () => {
  beforeEach(() => {
    Object.values(helperSpies).forEach((spy) => spy.mockClear());
  });

  it('registers GRPC-15 metadata and 11 steps', () => {
    expect(grpcSpringBootLesson.id).toBe('grpc-spring-boot');
    expect(grpcSpringBootLesson.category).toBe('grpc');
    expect(grpcSpringBootLesson.grpc.rosterNumber).toBe(15);
    expect(grpcSpringBootLesson.steps).toHaveLength(11);
    expect(grpcSpringBootLesson.dockerEndpoints?.length).toBeGreaterThan(0);
  });

  it('passes Phase 12A lesson contract validation', () => {
    const result = validateGrpcDemoLesson(grpcSpringBootLesson);
    expect(result.ok, result.issues.map((i) => `${i.path}: ${i.message}`).join('\n')).toBe(true);
  });

  it('setup resets spring baseline after first-call setup', async () => {
    const ctx = makeCtx();
    await grpcSpringBootLesson.setup?.(ctx);
    expect(helperSpies.grpcFirstCallSetup).toHaveBeenCalledTimes(1);
    // Setup skips reflect/method selection so step 1 (connection bar only) does
    // not flash the service tree + method highlight before the narration.
    expect(helperSpies.resetSpringBaselineQuiet).toHaveBeenCalledWith(ctx, { selectMethod: false });
  });

  it('cleanup clears grpcHost workspace default', async () => {
    const ctx = makeCtx();
    await grpcSpringBootLesson.cleanup?.(ctx);
    expect(helperSpies.upsertWorkspaceDefaults).toHaveBeenCalledWith({ grpcHost: '' });
    expect(helperSpies.grpcFirstCallCleanup).toHaveBeenCalledWith(ctx);
  });

  it('id and title stay in sync with roster', () => {
    const roster = getGrpcLessonRosterEntry('grpc-spring-boot')!;
    expect(grpcSpringBootLesson.name).toBe(roster.title);
    expect(roster.number).toBe(15);
  });
});
