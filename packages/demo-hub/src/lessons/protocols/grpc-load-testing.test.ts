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
  resetGrpcConnectionSettingsQuiet: vi.fn(async () => {}),
  clearGrpcSchemaDriftQuiet: vi.fn(async () => {}),
  ensureGrpcPlaintextChannelReady: vi.fn(async () => {}),
  fillGrpcEchoMessage: vi.fn(async () => {}),
  resetGrpcLessonSessionFlags: vi.fn(),
  captureGrpcActiveDescriptorKey: vi.fn(),
}));

vi.mock('../env-manager-lesson-helpers', () => ({
  navigateToGrpcStudio: navigateSpy,
}));

vi.mock('../../adapters', async () => {
  const actual = await vi.importActual<typeof import('../../adapters')>('../../adapters');
  return {
    ...actual,
    captureGrpcActiveDescriptorKey: helperSpies.captureGrpcActiveDescriptorKey,
  };
});

vi.mock('./grpc-lesson-helpers', async () => {
  const actual = await vi.importActual<typeof import('./grpc-lesson-helpers')>('./grpc-lesson-helpers');
  return {
    ...actual,
    closeGrpcSettingsDrawerQuiet: helperSpies.closeGrpcSettingsDrawerQuiet,
    ensureGrpcStudioSubNavQuiet: helperSpies.ensureGrpcStudioSubNavQuiet,
    resetGrpcConnectionSettingsQuiet: helperSpies.resetGrpcConnectionSettingsQuiet,
    clearGrpcSchemaDriftQuiet: helperSpies.clearGrpcSchemaDriftQuiet,
    ensureGrpcPlaintextChannelReady: helperSpies.ensureGrpcPlaintextChannelReady,
    fillGrpcEchoMessage: helperSpies.fillGrpcEchoMessage,
    resetGrpcLessonSessionFlags: helperSpies.resetGrpcLessonSessionFlags,
  };
});

import { grpcLoadTestingLesson } from './grpc-load-testing';

describe('grpc-load-testing lesson boot', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <button data-testid="grpc-reflect-btn"></button>
      <div data-testid="grpc-explorer-tree"></div>
      <button data-testid="grpc-method-echo.EchoService-Echo"></button>
      <div data-testid="grpc-call-method-name">Echo</div>
      <div data-testid="grpc-request-form-scroll"></div>
    `;
    Object.values(helperSpies).forEach((spy) => spy.mockClear());
    navigateSpy.mockClear();
  });

  it('skips studio tab isolation and boots without ctx.click ripples', async () => {
    const ctx = makeCtx();
    expect(grpcLoadTestingLesson.skipStudioTabIsolation).toBe(true);

    await grpcLoadTestingLesson.setup?.(ctx);

    expect(navigateSpy).toHaveBeenCalledWith(ctx);
    expect(helperSpies.resetGrpcLessonSessionFlags).toHaveBeenCalled();
    expect(helperSpies.ensureGrpcPlaintextChannelReady).toHaveBeenCalledWith(ctx);
    expect(helperSpies.fillGrpcEchoMessage).toHaveBeenCalled();
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('compare step reads on Start and verifies the detail table (not the tall card shell)', () => {
    const compare = grpcLoadTestingLesson.steps.find((step) => step.id === 'grpc12-compare');
    expect(compare?.highlight).toBe(GRPC.LOAD_TEST_START);
    expect(compare?.verify).toBe(GRPC.LOAD_TEST_RUN_COMPARE_DETAILS);
    expect(compare?.pauseAfter).toBe(true);
  });

  it('profile and streaming steps target exact controls (no shell / nav bounce)', () => {
    const profile = grpcLoadTestingLesson.steps.find((step) => step.id === 'grpc12-profile');
    expect(profile?.highlight).toBe(GRPC.LOAD_TEST_PROFILE_NAME);

    const streaming = grpcLoadTestingLesson.steps.find((step) => step.id === 'grpc12-streaming');
    expect(streaming?.highlight).toBe(GRPC.LOAD_TEST_CALL_TYPE_BADGE);
    expect(streaming?.verify).toBe(GRPC.LOAD_TEST_SUMMARY_METRICS);
  });

  it('intro action opens Advanced without re-spotlighting the reading target first', async () => {
    document.body.innerHTML += `
      <button data-testid="grpc-sub-nav-advanced"></button>
      <div data-testid="grpc-advanced-shell"></div>
      <div data-testid="grpc-advanced-nav"></div>
      <button data-testid="grpc-advanced-tab-load_test"></button>
      <button data-testid="grpc-advanced-tab-mock_server"></button>
      <button data-testid="grpc-advanced-tab-schema_diff"></button>
      <button data-testid="grpc-advanced-tab-rpc_statistics"></button>
      <button data-testid="grpc-advanced-tab-native_diagnostics"></button>
      <div data-testid="grpc-load-test-panel"></div>
    `;
    const ctx = makeCtx();
    const intro = grpcLoadTestingLesson.steps.find((step) => step.id === 'grpc12-intro');
    expect(intro?.highlight).toBe(GRPC.SUB_NAV_ADVANCED);

    await intro?.action?.(ctx);

    expect(ctx.click).toHaveBeenCalledWith(GRPC.SUB_NAV_ADVANCED);
    // First click is Advanced — no pre-click spotlightAndPause on the same control.
    const firstClickIndex = vi.mocked(ctx.click).mock.calls.findIndex(
      ([selector]) => selector === GRPC.SUB_NAV_ADVANCED,
    );
    expect(firstClickIndex).toBe(0);
  });
});
