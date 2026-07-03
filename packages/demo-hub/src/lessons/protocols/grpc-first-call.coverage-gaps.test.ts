/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GRPC } from '@shared/selectors';
import { makeCtx } from './ws-test-utils';

const helperSpies = vi.hoisted(() => ({
  navigateToGrpcStudio: vi.fn(async () => {}),
  closeGrpcSettingsDrawerQuiet: vi.fn(async () => {}),
  ensureGrpcTarget: vi.fn(async () => {}),
  ensureGrpcReflected: vi.fn(async () => {}),
  ensureEchoMethodSelected: vi.fn(async () => {}),
  ensureUnaryExecuted: vi.fn(async () => {}),
  openFirstGrpcHistoryEntry: vi.fn(async () => {}),
  openGrpcHistoryPanelQuiet: vi.fn(async () => {}),
}));

vi.mock('../env-manager-lesson-helpers', () => ({
  navigateToGrpcStudio: helperSpies.navigateToGrpcStudio,
}));

vi.mock('./grpc-lesson-helpers', async () => {
  const actual = await vi.importActual<typeof import('./grpc-lesson-helpers')>('./grpc-lesson-helpers');
  return {
    ...actual,
    closeGrpcSettingsDrawerQuiet: helperSpies.closeGrpcSettingsDrawerQuiet,
    ensureGrpcTarget: helperSpies.ensureGrpcTarget,
    ensureGrpcReflected: helperSpies.ensureGrpcReflected,
    ensureEchoMethodSelected: helperSpies.ensureEchoMethodSelected,
    ensureUnaryExecuted: helperSpies.ensureUnaryExecuted,
    openFirstGrpcHistoryEntry: helperSpies.openFirstGrpcHistoryEntry,
    openGrpcHistoryPanelQuiet: helperSpies.openGrpcHistoryPanelQuiet,
  };
});

import { grpcFirstCallLesson } from './grpc-first-call';

function getStep(stepId: string) {
  const step = grpcFirstCallLesson.steps.find((entry) => entry.id === stepId);
  if (!step) throw new Error(`Missing step ${stepId}`);
  return step;
}

describe('grpc-first-call coverage gaps', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    Object.values(helperSpies).forEach((spy) => spy.mockClear());
  });

  it('executes intro through reflect setup callbacks', async () => {
    const ctx = makeCtx();

    await getStep('grpc1-intro').preAction?.(ctx);
    await getStep('grpc1-target').preAction?.(ctx);
    await getStep('grpc1-target').action?.(ctx);
    await getStep('grpc1-reflect').preAction?.(ctx);
    await getStep('grpc1-reflect').action?.(ctx);
    await getStep('grpc1-select-method').preAction?.(ctx);
    await getStep('grpc1-select-method').action?.(ctx);
    await getStep('grpc1-fill-message').preAction?.(ctx);
    await getStep('grpc1-fill-message').action?.(ctx);

    expect(helperSpies.navigateToGrpcStudio).toHaveBeenCalledTimes(2);
    expect(helperSpies.closeGrpcSettingsDrawerQuiet).toHaveBeenCalledTimes(2);
    expect(helperSpies.ensureGrpcTarget).toHaveBeenCalledTimes(2);
    expect(helperSpies.ensureGrpcReflected).toHaveBeenCalledTimes(2);
    expect(helperSpies.ensureEchoMethodSelected).toHaveBeenCalledTimes(2);
    expect(ctx.waitFor).toHaveBeenCalledWith(GRPC.PROTO_FIELD_INPUT_MESSAGE, 10_000);
    expect(ctx.fill).toHaveBeenCalledWith(GRPC.PROTO_FIELD_INPUT_MESSAGE, 'Hello from gRPC Studio');
  });

  it('fills message in send preAction only when request field is empty', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = '<input data-testid="grpc-proto-field-input-message" value="" />';

    await getStep('grpc1-send').preAction?.(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GRPC.PROTO_FIELD_INPUT_MESSAGE, 'Hello from gRPC Studio');

    vi.mocked(ctx.fill).mockClear();
    document.body.innerHTML = '<input data-testid="grpc-proto-field-input-message" value="already-set" />';
    await getStep('grpc1-send').preAction?.(ctx);
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('executes send and response steps', async () => {
    const ctx = makeCtx();

    await getStep('grpc1-send').action?.(ctx);
    await getStep('grpc1-response').preAction?.(ctx);
    await getStep('grpc1-response').action?.(ctx);

    expect(helperSpies.ensureUnaryExecuted).toHaveBeenCalledTimes(2);
    expect(ctx.waitFor).toHaveBeenCalledWith(GRPC.RESPONSE_BODY, 10_000);
  });

  it('opens history tab only when not already selected', async () => {
    const ctx = makeCtx();
    const clickSpy = vi.fn();
    document.body.innerHTML = `
      <button data-testid="grpc-sub-nav-history" aria-selected="false"></button>
      <div data-testid="grpc-history-panel"></div>
    `;
    document.querySelector<HTMLElement>(GRPC.SUB_NAV_HISTORY)?.addEventListener('click', clickSpy);

    await getStep('grpc1-history-tab').preAction?.(ctx);
    await getStep('grpc1-history-tab').action?.(ctx);
    expect(helperSpies.ensureUnaryExecuted).toHaveBeenCalled();
    expect(helperSpies.closeGrpcSettingsDrawerQuiet).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();

    clickSpy.mockClear();
    document.body.innerHTML = `
      <button data-testid="grpc-sub-nav-history" aria-selected="true"></button>
      <div data-testid="grpc-history-panel"></div>
    `;
    await getStep('grpc1-history-tab').action?.(ctx);
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('replays from history when replay button exists and is enabled', async () => {
    const ctx = makeCtx();
    const replayClick = vi.fn();
    document.body.innerHTML = '<button data-testid="grpc-history-replay-btn"></button>';
    document.querySelector<HTMLElement>(GRPC.HISTORY_REPLAY_BTN)?.addEventListener('click', replayClick);

    await getStep('grpc1-history').preAction?.(ctx);
    await getStep('grpc1-history').action?.(ctx);

    expect(helperSpies.openGrpcHistoryPanelQuiet).not.toHaveBeenCalled();
    expect(helperSpies.openFirstGrpcHistoryEntry).toHaveBeenCalledWith(ctx, { ensureExecuted: false });
    expect(replayClick).toHaveBeenCalled();
  });

  it('opens history panel when replay button is missing and skips disabled replay clicks', async () => {
    const ctx = makeCtx();
    await getStep('grpc1-history').preAction?.(ctx);
    expect(helperSpies.openGrpcHistoryPanelQuiet).toHaveBeenCalledWith(ctx);

    document.body.innerHTML = '<button data-testid="grpc-history-replay-btn" disabled></button>';
    const replayClick = vi.fn();
    document.querySelector<HTMLElement>(GRPC.HISTORY_REPLAY_BTN)?.addEventListener('click', replayClick);
    await getStep('grpc1-history').action?.(ctx);
    expect(replayClick).not.toHaveBeenCalled();
  });

  it('sends replayed unary request when send button is available', async () => {
    const ctx = makeCtx();
    const sendClick = vi.fn();
    document.body.innerHTML = `
      <button data-testid="grpc-send-btn"></button>
      <div data-testid="grpc-response-status"></div>
      <div data-testid="grpc-response-body"></div>
    `;
    document.querySelector<HTMLElement>(GRPC.SEND_BTN)?.addEventListener('click', sendClick);

    await getStep('grpc1-replay').preAction?.(ctx);
    await getStep('grpc1-replay').action?.(ctx);

    expect(ctx.waitFor).toHaveBeenCalledWith(GRPC.SEND_BTN, 8_000);
    expect(sendClick).toHaveBeenCalled();
    expect(ctx.waitFor).toHaveBeenCalledWith(GRPC.RESPONSE_STATUS, 10_000);
    expect(ctx.waitFor).toHaveBeenCalledWith(GRPC.RESPONSE_BODY, 5_000);
  });

  it('swallows replay send errors when send button never becomes available', async () => {
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockRejectedValueOnce(new Error('missing send'));

    await expect(getStep('grpc1-replay').action?.(ctx)).resolves.toBeUndefined();
  });
});
