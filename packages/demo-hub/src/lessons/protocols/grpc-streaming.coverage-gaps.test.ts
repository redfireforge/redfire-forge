/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GRPC } from '@shared/selectors';
import { makeCtx } from './ws-test-utils';

const helperSpies = vi.hoisted(() => ({
  navigateToGrpcStudio: vi.fn(async () => {}),
  closeGrpcSettingsDrawerQuiet: vi.fn(async () => {}),
  ensureGrpcStudioSubNavQuiet: vi.fn(async () => {}),
  ensureGrpcReflected: vi.fn(async () => {}),
  ensureStreamingMethodSelected: vi.fn(async () => {}),
  fillServerStreamRequest: vi.fn(async () => {}),
  ensureClientStreamQueued: vi.fn(async () => {}),
  startAndExchangeBidiStream: vi.fn(async () => {}),
}));

vi.mock('../env-manager-lesson-helpers', () => ({
  navigateToGrpcStudio: helperSpies.navigateToGrpcStudio,
}));

vi.mock('./grpc-lesson-helpers', async () => {
  const actual = await vi.importActual<typeof import('./grpc-lesson-helpers')>('./grpc-lesson-helpers');
  return {
    ...actual,
    closeGrpcSettingsDrawerQuiet: helperSpies.closeGrpcSettingsDrawerQuiet,
    ensureGrpcStudioSubNavQuiet: helperSpies.ensureGrpcStudioSubNavQuiet,
    ensureGrpcReflected: helperSpies.ensureGrpcReflected,
    ensureStreamingMethodSelected: helperSpies.ensureStreamingMethodSelected,
    fillServerStreamRequest: helperSpies.fillServerStreamRequest,
    ensureClientStreamQueued: helperSpies.ensureClientStreamQueued,
    startAndExchangeBidiStream: helperSpies.startAndExchangeBidiStream,
  };
});

import { grpcStreamingLesson } from './grpc-streaming';

function getStep(stepId: string) {
  const step = grpcStreamingLesson.steps.find((entry) => entry.id === stepId);
  if (!step) throw new Error(`Missing step ${stepId}`);
  return step;
}

describe('grpc-streaming coverage gaps', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    Object.values(helperSpies).forEach((spy) => spy.mockClear());
  });

  it('executes intro, select, and queue-oriented callbacks', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <div data-testid="grpc-call-type-selector"></div>
      <button data-testid="grpc-stream-add-queue-btn"></button>
      <div data-testid="grpc-stream-pending-panel"></div>
    `;

    await getStep('grpc17-intro').preAction?.(ctx);
    await getStep('grpc17-server-select').preAction?.(ctx);
    await getStep('grpc17-server-select').action?.(ctx);
    await getStep('grpc17-client-select').preAction?.(ctx);
    await getStep('grpc17-client-select').action?.(ctx);
    await getStep('grpc17-client-queue').preAction?.(ctx);
    await getStep('grpc17-client-queue').action?.(ctx);

    expect(helperSpies.navigateToGrpcStudio).toHaveBeenCalled();
    expect(helperSpies.closeGrpcSettingsDrawerQuiet).toHaveBeenCalledTimes(3);
    expect(helperSpies.ensureGrpcStudioSubNavQuiet).toHaveBeenCalled();
    expect(helperSpies.ensureGrpcReflected).toHaveBeenCalledTimes(3);
    expect(helperSpies.ensureStreamingMethodSelected).toHaveBeenCalledWith(ctx, 'ServerStream');
    expect(helperSpies.ensureStreamingMethodSelected).toHaveBeenCalledWith(ctx, 'ClientStream');
    expect(helperSpies.ensureClientStreamQueued).toHaveBeenCalledWith(ctx);
  });

  it('server-fill starts the stream when start button is enabled and tolerates missing log list', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = '<button data-testid="grpc-stream-start-btn"></button>';

    await getStep('grpc17-server-fill').preAction?.(ctx);

    vi.mocked(ctx.waitFor).mockRejectedValueOnce(new Error('log missing'));
    await expect(getStep('grpc17-server-fill').action?.(ctx)).resolves.toBeUndefined();

    expect(helperSpies.ensureStreamingMethodSelected).toHaveBeenCalledWith(ctx, 'ServerStream');
    expect(helperSpies.fillServerStreamRequest).toHaveBeenCalledWith(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GRPC.STREAM_START_BTN);
  });

  it('server-fill skips start click when button is disabled', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = '<button data-testid="grpc-stream-start-btn" disabled></button><div data-testid="grpc-stream-log-list"></div>';

    await getStep('grpc17-server-fill').action?.(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GRPC.STREAM_START_BTN);
  });

  it('server-status preAction starts stream only when log list is absent', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = '<button data-testid="grpc-stream-start-btn"></button><div data-testid="grpc-stream-status-bar"></div><span data-testid="grpc-stream-status-badge">finished</span>';

    await getStep('grpc17-server-status').preAction?.(ctx);
    await getStep('grpc17-server-status').action?.(ctx);

    expect(helperSpies.fillServerStreamRequest).toHaveBeenCalledWith(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GRPC.STREAM_START_BTN);

    vi.mocked(ctx.click).mockClear();
    vi.mocked(helperSpies.fillServerStreamRequest).mockClear();
    document.body.innerHTML = '<div data-testid="grpc-stream-log-list"></div><div data-testid="grpc-stream-status-bar"></div><span data-testid="grpc-stream-status-badge">complete</span>';
    await getStep('grpc17-server-status').preAction?.(ctx);
    expect(helperSpies.fillServerStreamRequest).not.toHaveBeenCalled();
    expect(ctx.click).not.toHaveBeenCalledWith(GRPC.STREAM_START_BTN);
  });

  it('client-send preAction queues pending messages and closes an active stream', async () => {
    const ctx = makeCtx();
    const cancelClick = vi.fn();
    document.body.innerHTML = '<button data-testid="grpc-stream-cancel-btn"></button>';
    document.querySelector<HTMLElement>(GRPC.STREAM_CANCEL_BTN)?.addEventListener('click', cancelClick);

    await getStep('grpc17-client-send').preAction?.(ctx);

    expect(helperSpies.ensureStreamingMethodSelected).toHaveBeenCalledWith(ctx, 'ClientStream');
    expect(helperSpies.ensureClientStreamQueued).toHaveBeenCalledWith(ctx);
    expect(cancelClick).toHaveBeenCalled();
  });

  it('client-send action runs start, send-all, and end branches when controls are available', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="grpc-stream-start-btn"></button>
      <button data-testid="grpc-stream-send-all-btn"></button>
      <button data-testid="grpc-stream-pending-end-btn"></button>
      <span data-testid="grpc-stream-status-badge">finished</span>
    `;

    await getStep('grpc17-client-send').action?.(ctx);

    expect(ctx.click).toHaveBeenCalledWith(GRPC.STREAM_START_BTN);
    expect(ctx.click).toHaveBeenCalledWith(GRPC.STREAM_SEND_ALL_BTN);
    expect(ctx.click).toHaveBeenCalledWith(GRPC.STREAM_PENDING_END_BTN);
  });

  it('client-send action tolerates missing send-all and end buttons', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = '<button data-testid="grpc-stream-start-btn"></button><span data-testid="grpc-stream-status-badge">ended</span>';
    vi.mocked(ctx.waitFor)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('no send all'))
      .mockRejectedValueOnce(new Error('no end'));

    await expect(getStep('grpc17-client-send').action?.(ctx)).resolves.toBeUndefined();
    expect(ctx.click).toHaveBeenCalledWith(GRPC.STREAM_START_BTN);
  });

  it('executes bidi select and exchange callbacks', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = '<button data-testid="grpc-stream-start-btn"></button><div data-testid="grpc-stream-message-log"></div>';

    await getStep('grpc17-bidi-select').preAction?.(ctx);
    await getStep('grpc17-bidi-select').action?.(ctx);
    await getStep('grpc17-bidi-exchange').preAction?.(ctx);
    await getStep('grpc17-bidi-exchange').action?.(ctx);

    expect(helperSpies.ensureStreamingMethodSelected).toHaveBeenCalledWith(ctx, 'BidiStream');
    expect(helperSpies.startAndExchangeBidiStream).toHaveBeenCalledTimes(1);
  });

  it('cancel step starts exchange when needed and clicks cancel when enabled', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = '<button data-testid="grpc-stream-cancel-btn"></button><div data-testid="grpc-stream-status-bar"></div><span data-testid="grpc-stream-status-badge">cancelled</span>';

    await getStep('grpc17-cancel').preAction?.(ctx);
    await getStep('grpc17-cancel').action?.(ctx);

    expect(helperSpies.startAndExchangeBidiStream).not.toHaveBeenCalled();
    expect(ctx.click).toHaveBeenCalledWith(GRPC.STREAM_CANCEL_BTN);

    document.body.innerHTML = '<div data-testid="grpc-stream-status-bar"></div><span data-testid="grpc-stream-status-badge">canceled</span>';
    await getStep('grpc17-cancel').preAction?.(ctx);
    expect(helperSpies.startAndExchangeBidiStream).toHaveBeenCalledWith(ctx);
  });

  it('cancel step tolerates status wait timing out', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = '<button data-testid="grpc-stream-cancel-btn"></button><div data-testid="grpc-stream-status-bar"></div><span data-testid="grpc-stream-status-badge">streaming</span>';

    await expect(getStep('grpc17-cancel').action?.(ctx)).resolves.toBeUndefined();
    expect(ctx.click).toHaveBeenCalledWith(GRPC.STREAM_CANCEL_BTN);
  });

  it('cancel step tolerates status wait timing out when badge is missing', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = '<button data-testid="grpc-stream-cancel-btn"></button><div data-testid="grpc-stream-status-bar"></div>';

    await expect(getStep('grpc17-cancel').action?.(ctx)).resolves.toBeUndefined();
    expect(ctx.click).toHaveBeenCalledWith(GRPC.STREAM_CANCEL_BTN);
  });

  it('export step seeds a stream log when absent and clicks export when available', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = '<button data-testid="grpc-stream-export-log-btn"></button>';

    await getStep('grpc17-export').preAction?.(ctx);
    await getStep('grpc17-export').action?.(ctx);

    expect(helperSpies.startAndExchangeBidiStream).toHaveBeenCalledWith(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GRPC.STREAM_EXPORT_LOG_BTN);
  });

  it('export preAction skips cancel when stream log exists without cancel control', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = '<div data-testid="grpc-stream-log-list"></div><button data-testid="grpc-stream-export-log-btn"></button>';

    await getStep('grpc17-export').preAction?.(ctx);

    expect(helperSpies.ensureStreamingMethodSelected).toHaveBeenCalledWith(ctx, 'BidiStream');
    expect(helperSpies.startAndExchangeBidiStream).not.toHaveBeenCalled();
  });

  it('export preAction clicks cancel after seeding a stream log when cancel control is present', async () => {
    const ctx = makeCtx();
    const cancelClick = vi.fn();
    document.body.innerHTML = '<button data-testid="grpc-stream-cancel-btn"></button><button data-testid="grpc-stream-export-log-btn"></button>';
    document.querySelector<HTMLElement>(GRPC.STREAM_CANCEL_BTN)?.addEventListener('click', cancelClick);

    await getStep('grpc17-export').preAction?.(ctx);

    expect(helperSpies.startAndExchangeBidiStream).toHaveBeenCalledWith(ctx);
    expect(cancelClick).toHaveBeenCalled();
  });
});
