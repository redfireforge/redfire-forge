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
  closeExtraGrpcTabsQuiet: vi.fn(async () => {}),
  resetGrpcLessonSessionFlags: vi.fn(),
  fillGrpcEchoMessage: vi.fn(async () => {}),
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
    resetGrpcConnectionSettingsQuiet: helperSpies.resetGrpcConnectionSettingsQuiet,
    clearGrpcSchemaDriftQuiet: helperSpies.clearGrpcSchemaDriftQuiet,
    closeExtraGrpcTabsQuiet: helperSpies.closeExtraGrpcTabsQuiet,
    resetGrpcLessonSessionFlags: helperSpies.resetGrpcLessonSessionFlags,
    fillGrpcEchoMessage: helperSpies.fillGrpcEchoMessage,
  };
});

import { grpcTabsLesson } from './grpc-tabs';

describe('grpc-tabs lesson boot', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    Object.values(helperSpies).forEach((spy) => spy.mockClear());
    navigateSpy.mockClear();
  });

  it('skips studio tab isolation and boots quietly before Tab Bar reading', async () => {
    const ctx = makeCtx();
    expect(grpcTabsLesson.skipStudioTabIsolation).toBe(true);
    expect(grpcTabsLesson.steps[0]?.id).toBe('grpc25-intro');
    expect(grpcTabsLesson.steps[0]?.highlight).toBe(GRPC.TAB_BAR);

    await grpcTabsLesson.setup?.(ctx);

    expect(navigateSpy).toHaveBeenCalledWith(ctx);
    expect(helperSpies.resetGrpcLessonSessionFlags).toHaveBeenCalled();
    expect(helperSpies.closeExtraGrpcTabsQuiet).toHaveBeenCalledWith(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('grpc25-send fills Hello from Tab 1 via hybrid-aware helper before Send', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <div data-testid="grpc-tab-bar"><button role="tab" aria-selected="true"></button></div>
      <button data-testid="grpc-request-tab-form"></button>
      <button data-testid="grpc-send-btn"></button>
      <div data-testid="grpc-response-body"></div>
    `;
    const step = grpcTabsLesson.steps.find((s) => s.id === 'grpc25-send')!;
    await step.preAction!(ctx);
    await step.action!(ctx);

    expect(helperSpies.fillGrpcEchoMessage).toHaveBeenCalledWith(ctx, 'Hello from Tab 1');
    expect(ctx.click).toHaveBeenCalledWith(GRPC.SEND_BTN);
    // Must not use the obsolete form-row selector (hybrid composer has JSON only).
    expect(ctx.fill).not.toHaveBeenCalledWith(
      '.grpc-form-field input[type="text"]',
      expect.anything(),
    );
  });
});
