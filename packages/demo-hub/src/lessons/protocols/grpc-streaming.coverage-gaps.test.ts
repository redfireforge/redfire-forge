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
  guardGrpcReflectedQuiet: vi.fn(async () => {}),
  guardServerStreamFormQuiet: vi.fn(async () => {}),
  guardServerStreamExecutedQuiet: vi.fn(async () => {}),
  guardClientStreamSelectedQuiet: vi.fn(async () => {}),
  guardClientStreamQueuedQuiet: vi.fn(async () => {}),
  guardBidiStreamSelectedQuiet: vi.fn(async () => {}),
  guardBidiStreamActiveQuiet: vi.fn(async () => {}),
  seedBidiStreamLogQuiet: vi.fn(async () => {}),
  cancelActiveStreamQuiet: vi.fn(async () => {}),
  ensureStreamingMethodSelected: vi.fn(async () => {}),
  fillServerStreamRequest: vi.fn(async () => {}),
  runClientStreamSendLifecycle: vi.fn(async () => {}),
  startAndExchangeBidiStream: vi.fn(async () => {}),
  spotlightAndPause: vi.fn(async () => {}),
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
    guardGrpcReflectedQuiet: helperSpies.guardGrpcReflectedQuiet,
    guardServerStreamFormQuiet: helperSpies.guardServerStreamFormQuiet,
    guardServerStreamExecutedQuiet: helperSpies.guardServerStreamExecutedQuiet,
    guardClientStreamSelectedQuiet: helperSpies.guardClientStreamSelectedQuiet,
    guardClientStreamQueuedQuiet: helperSpies.guardClientStreamQueuedQuiet,
    guardBidiStreamSelectedQuiet: helperSpies.guardBidiStreamSelectedQuiet,
    guardBidiStreamActiveQuiet: helperSpies.guardBidiStreamActiveQuiet,
    seedBidiStreamLogQuiet: helperSpies.seedBidiStreamLogQuiet,
    cancelActiveStreamQuiet: helperSpies.cancelActiveStreamQuiet,
    ensureStreamingMethodSelected: helperSpies.ensureStreamingMethodSelected,
    fillServerStreamRequest: helperSpies.fillServerStreamRequest,
    runClientStreamSendLifecycle: helperSpies.runClientStreamSendLifecycle,
    startAndExchangeBidiStream: helperSpies.startAndExchangeBidiStream,
    spotlightAndPause: helperSpies.spotlightAndPause,
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
    await getStep('grpc17-intro').action?.(ctx);
    await getStep('grpc17-server-select').preAction?.(ctx);
    await getStep('grpc17-server-select').action?.(ctx);
    await getStep('grpc17-client-select').preAction?.(ctx);
    await getStep('grpc17-client-select').action?.(ctx);
    await getStep('grpc17-client-queue').preAction?.(ctx);
    await getStep('grpc17-client-queue').action?.(ctx);

    expect(helperSpies.navigateToGrpcStudio).toHaveBeenCalled();
    expect(helperSpies.closeGrpcSettingsDrawerQuiet).toHaveBeenCalled();
    expect(helperSpies.ensureGrpcStudioSubNavQuiet).toHaveBeenCalled();
    expect(helperSpies.guardGrpcReflectedQuiet).toHaveBeenCalled();
    expect(helperSpies.ensureStreamingMethodSelected).toHaveBeenCalledWith(ctx, 'ServerStream');
    expect(helperSpies.ensureStreamingMethodSelected).toHaveBeenCalledWith(ctx, 'ClientStream');
    expect(helperSpies.guardClientStreamSelectedQuiet).toHaveBeenCalledWith(ctx);
    expect(helperSpies.spotlightAndPause).toHaveBeenCalled();
  });

  it('server-fill starts the stream when start button is enabled and tolerates missing log list', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = '<button data-testid="grpc-stream-start-btn"></button>';

    await getStep('grpc17-server-fill').preAction?.(ctx);

    vi.mocked(ctx.waitFor).mockRejectedValueOnce(new Error('log missing'));
    await expect(getStep('grpc17-server-fill').action?.(ctx)).resolves.toBeUndefined();

    expect(helperSpies.guardServerStreamFormQuiet).toHaveBeenCalledWith(ctx);
    expect(helperSpies.fillServerStreamRequest).toHaveBeenCalledWith(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GRPC.STREAM_START_BTN);
  });

  it('server-fill skips start click when button is disabled', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = '<button data-testid="grpc-stream-start-btn" disabled></button><div data-testid="grpc-stream-log-list"></div>';

    await getStep('grpc17-server-fill').action?.(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GRPC.STREAM_START_BTN);
  });

  it('server-status preAction delegates to guardServerStreamExecutedQuiet', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = '<div data-testid="grpc-stream-status-bar"></div><span data-testid="grpc-stream-status-badge">finished</span>';

    await getStep('grpc17-server-status').preAction?.(ctx);
    await getStep('grpc17-server-status').action?.(ctx);

    expect(helperSpies.guardServerStreamExecutedQuiet).toHaveBeenCalledWith(ctx);
    expect(helperSpies.spotlightAndPause).toHaveBeenCalled();
  });

  it('client-send preAction queues pending messages and cancels an active stream', async () => {
    const ctx = makeCtx();

    await getStep('grpc17-client-send').preAction?.(ctx);

    expect(helperSpies.guardClientStreamQueuedQuiet).toHaveBeenCalledWith(ctx);
    expect(helperSpies.cancelActiveStreamQuiet).toHaveBeenCalledWith(ctx);
  });

  it('client-send action runs lifecycle helper and spotlights status', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <span data-testid="grpc-stream-status-badge">finished</span>
    `;

    await getStep('grpc17-client-send').action?.(ctx);

    expect(helperSpies.runClientStreamSendLifecycle).toHaveBeenCalledWith(ctx);
    expect(helperSpies.spotlightAndPause).toHaveBeenCalled();
  });

  it('client-queue action spotlights existing pending items without re-queueing', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <div data-testid="grpc-stream-pending-panel">
        <div data-testid="grpc-stream-pending-item-0">msg</div>
      </div>
    `;

    await getStep('grpc17-client-queue').action?.(ctx);

    expect(ctx.fill).not.toHaveBeenCalled();
    expect(helperSpies.spotlightAndPause).toHaveBeenCalled();
  });

  it('executes bidi select and exchange callbacks', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = '<button data-testid="grpc-stream-start-btn"></button><div data-testid="grpc-stream-message-log"></div>';

    await getStep('grpc17-bidi-select').preAction?.(ctx);
    await getStep('grpc17-bidi-select').action?.(ctx);
    await getStep('grpc17-bidi-exchange').preAction?.(ctx);
    await getStep('grpc17-bidi-exchange').action?.(ctx);

    expect(helperSpies.ensureStreamingMethodSelected).toHaveBeenCalledWith(ctx, 'BidiStream');
    expect(helperSpies.guardBidiStreamSelectedQuiet).toHaveBeenCalledWith(ctx);
    expect(helperSpies.startAndExchangeBidiStream).toHaveBeenCalledTimes(1);
  });

  it('cancel step uses guardBidiStreamActiveQuiet and clicks cancel when enabled', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = '<button data-testid="grpc-stream-cancel-btn"></button><div data-testid="grpc-stream-status-bar"></div><span data-testid="grpc-stream-status-badge">cancelled</span>';

    await getStep('grpc17-cancel').preAction?.(ctx);
    await getStep('grpc17-cancel').action?.(ctx);

    expect(helperSpies.guardBidiStreamActiveQuiet).toHaveBeenCalledWith(ctx);
    expect(helperSpies.startAndExchangeBidiStream).not.toHaveBeenCalled();
    expect(ctx.click).toHaveBeenCalledWith(GRPC.STREAM_CANCEL_BTN);
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

    expect(helperSpies.seedBidiStreamLogQuiet).toHaveBeenCalledWith(ctx);
    expect(helperSpies.cancelActiveStreamQuiet).toHaveBeenCalledWith(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GRPC.STREAM_EXPORT_LOG_BTN);
  });

  it('export preAction skips seeding when stream log exists', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = '<div data-testid="grpc-stream-log-list"></div><button data-testid="grpc-stream-export-log-btn"></button>';

    await getStep('grpc17-export').preAction?.(ctx);

    expect(helperSpies.guardBidiStreamSelectedQuiet).toHaveBeenCalledWith(ctx);
    expect(helperSpies.seedBidiStreamLogQuiet).not.toHaveBeenCalled();
  });
});
