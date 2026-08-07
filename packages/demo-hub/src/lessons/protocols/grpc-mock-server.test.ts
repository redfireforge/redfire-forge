/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GRPC } from '@shared/selectors';
import { makeCtx } from './ws-test-utils';

const navigateSpy = vi.hoisted(() => vi.fn(async () => {}));
const helperSpies = vi.hoisted(() => ({
  closeGrpcSettingsDrawerQuiet: vi.fn(async () => {}),
  ensureGrpcStudioSubNavQuiet: vi.fn(async () => {}),
  ensureGrpcPlaintextChannelReady: vi.fn(async () => {}),
  clearGrpcSchemaDriftQuiet: vi.fn(async () => {}),
  resetGrpcLessonSessionFlags: vi.fn(),
  grpcFirstCallCleanup: vi.fn(async () => {}),
}));

const mockHelpers = vi.hoisted(() => ({
  markDemoMockRunning: vi.fn(),
  navigateToMockServerPanelQuiet: vi.fn(async () => {}),
  stopMockQuiet: vi.fn(async () => {}),
}));

vi.mock('../env-manager-lesson-helpers', () => ({
  navigateToGrpcStudio: navigateSpy,
}));

vi.mock('./grpc-lesson-helpers', async () => {
  const actual = await vi.importActual<typeof import('./grpc-lesson-helpers')>('./grpc-lesson-helpers');
  return {
    ...actual,
    closeGrpcSettingsDrawerQuiet: helperSpies.closeGrpcSettingsDrawerQuiet,
    ensureGrpcStudioSubNavQuiet: helperSpies.ensureGrpcStudioSubNavQuiet,
    ensureGrpcPlaintextChannelReady: helperSpies.ensureGrpcPlaintextChannelReady,
    clearGrpcSchemaDriftQuiet: helperSpies.clearGrpcSchemaDriftQuiet,
    resetGrpcLessonSessionFlags: helperSpies.resetGrpcLessonSessionFlags,
    grpcFirstCallCleanup: helperSpies.grpcFirstCallCleanup,
  };
});

vi.mock('./grpc-mock-server-helpers', async () => {
  const actual = await vi.importActual<typeof import('./grpc-mock-server-helpers')>('./grpc-mock-server-helpers');
  return {
    ...actual,
    markDemoMockRunning: mockHelpers.markDemoMockRunning,
    navigateToMockServerPanelQuiet: mockHelpers.navigateToMockServerPanelQuiet,
    stopMockQuiet: mockHelpers.stopMockQuiet,
  };
});

import { grpcMockServerLesson } from './grpc-mock-server';

describe('grpc-mock-server lesson boot', () => {
  beforeEach(() => {
    Object.values(helperSpies).forEach((spy) => spy.mockClear());
    Object.values(mockHelpers).forEach((spy) => spy.mockClear());
    navigateSpy.mockClear();
  });

  it('skips studio tab isolation and lands on Mock without Studio bounce', async () => {
    const ctx = makeCtx();
    expect(grpcMockServerLesson.skipStudioTabIsolation).toBe(true);
    // First paint must already be Advanced → Mock server (no Load testing flash).
    expect(grpcMockServerLesson.initialSurface).toEqual({
      grpcPanelView: 'advanced',
      grpcAdvancedTab: 'mock_server',
    });

    await grpcMockServerLesson.setup?.(ctx);

    expect(navigateSpy).toHaveBeenCalledWith(ctx);
    expect(helperSpies.resetGrpcLessonSessionFlags).toHaveBeenCalled();
    expect(mockHelpers.markDemoMockRunning).toHaveBeenCalledWith(false);
    // Mock panel before plaintext prep — avoid Studio call-panel flash.
    expect(mockHelpers.navigateToMockServerPanelQuiet).toHaveBeenCalledWith(ctx);
    expect(helperSpies.ensureGrpcPlaintextChannelReady).toHaveBeenCalledWith(ctx);
    expect(mockHelpers.stopMockQuiet).toHaveBeenCalledWith(ctx);
    // Do not force Studio sub-nav before Mock — that was the Studio→Advanced flash.
    expect(helperSpies.ensureGrpcStudioSubNavQuiet).not.toHaveBeenCalled();
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('intro Reading rings the Builder tab and action does not re-tour Studio/Advanced', () => {
    const intro = grpcMockServerLesson.steps.find((step) => step.id === 'grpc13-intro');
    expect(intro?.highlight).toBe(GRPC.MOCK_TAB_BUILDER);
    expect(intro?.verify).toBe(GRPC.MOCK_SERVER_PANEL);
  });
});
