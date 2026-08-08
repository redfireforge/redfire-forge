/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GRPC } from '@shared/selectors';
import { makeCtx } from './ws-test-utils';

const adapterSpies = vi.hoisted(() => ({
  clearGrpcCallHistory: vi.fn(async () => {}),
  dispatchGrpcCallHistoryReload: vi.fn(),
}));

const helperSpies = vi.hoisted(() => ({
  navigateToGrpcStudio: vi.fn(async () => {}),
  closeGrpcSettingsDrawerQuiet: vi.fn(async () => {}),
  ensureGrpcStudioSubNavQuiet: vi.fn(async () => {}),
  resetGrpcConnectionSettingsQuiet: vi.fn(async () => {}),
  ensureGrpcReflected: vi.fn(async () => {}),
  guardGrpcReflectedQuiet: vi.fn(async () => {}),
  clearGrpcSchemaDriftQuiet: vi.fn(async () => {}),
  ensureUnaryExecuted: vi.fn(async () => {}),
  openGrpcHistoryPanelQuiet: vi.fn(async () => {}),
  spotlightAndPause: vi.fn(async () => {}),
}));

vi.mock('../../adapters', async () => {
  const actual = await vi.importActual<typeof import('../../adapters')>('../../adapters');
  return {
    ...actual,
    clearGrpcCallHistory: adapterSpies.clearGrpcCallHistory,
    dispatchGrpcCallHistoryReload: adapterSpies.dispatchGrpcCallHistoryReload,
  };
});

vi.mock('../env-manager-lesson-helpers', () => ({
  navigateToGrpcStudio: helperSpies.navigateToGrpcStudio,
}));

vi.mock('../modal-close-helpers', () => ({
  closeModalByButtonQuiet: vi.fn(async () => {}),
}));

vi.mock('./grpc-lesson-helpers', async () => {
  const actual = await vi.importActual<typeof import('./grpc-lesson-helpers')>('./grpc-lesson-helpers');
  return {
    ...actual,
    closeGrpcSettingsDrawerQuiet: helperSpies.closeGrpcSettingsDrawerQuiet,
    ensureGrpcStudioSubNavQuiet: helperSpies.ensureGrpcStudioSubNavQuiet,
    resetGrpcConnectionSettingsQuiet: helperSpies.resetGrpcConnectionSettingsQuiet,
    ensureGrpcReflected: helperSpies.ensureGrpcReflected,
    guardGrpcReflectedQuiet: helperSpies.guardGrpcReflectedQuiet,
    clearGrpcSchemaDriftQuiet: helperSpies.clearGrpcSchemaDriftQuiet,
    ensureUnaryExecuted: helperSpies.ensureUnaryExecuted,
    openGrpcHistoryPanelQuiet: helperSpies.openGrpcHistoryPanelQuiet,
    spotlightAndPause: helperSpies.spotlightAndPause,
  };
});

import { grpcGrpcurlLesson } from './grpc-grpcurl';

function getStep(stepId: string) {
  const step = grpcGrpcurlLesson.steps.find((entry) => entry.id === stepId);
  if (!step) throw new Error(`Missing step ${stepId}`);
  return step;
}

function mountGrpcGrpcurlDom(opts: { withWarnings?: boolean; withExplorer?: boolean; withHistory?: boolean } = {}) {
  const { withWarnings = false, withExplorer = false, withHistory = false } = opts;
  document.body.innerHTML = `
    <div data-testid="grpc-connection-bar"></div>
    <button data-testid="grpc-import-grpcurl-btn"></button>
    <div data-testid="grpc-import-grpcurl-modal">
      <textarea data-testid="grpc-import-grpcurl-textarea"></textarea>
      <div data-testid="grpc-import-grpcurl-preview"></div>
      ${withWarnings ? '<div data-testid="grpc-import-grpcurl-warnings"></div>' : ''}
      <button data-testid="grpc-import-grpcurl-submit"></button>
      <button data-testid="grpc-import-grpcurl-cancel"></button>
    </div>
    <input data-testid="grpc-target-input" value="localhost:50051" />
    <div data-testid="grpc-call-method-name">echo.EchoService / Echo</div>
    <button data-testid="grpc-request-tab-form" aria-pressed="true"></button>
    <button data-testid="grpc-request-tab-metadata"></button>
    <div data-testid="grpc-metadata-editor"></div>
    <div data-testid="grpc-request-form-scroll"></div>
    <div data-testid="grpc-service-explorer"></div>
    ${withExplorer ? '<div data-testid="grpc-explorer-tree"></div>' : ''}
    <button data-testid="grpc-send-btn"></button>
    <div data-testid="grpc-response-panel"></div>
    <div data-testid="grpc-response-body">{"message":"hello from grpcurl"}</div>
    <div data-testid="grpc-response-status">OK</div>
    <button data-testid="grpc-sub-nav-history"></button>
    <span data-testid="grpc-sub-nav-history-badge">1</span>
    <div data-testid="grpc-history-panel"></div>
    ${withHistory ? `
      <div data-testid="grpc-history-entry-demo"></div>
      <div data-testid="grpc-history-detail"></div>
      <button data-testid="grpc-history-copy-grpcurl"></button>
      <button data-testid="grpc-history-replay-btn"></button>
    ` : ''}
  `;
}

describe('grpc-grpcurl coverage gaps', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    Object.values(adapterSpies).forEach((spy) => spy.mockClear());
    Object.values(helperSpies).forEach((spy) => spy.mockClear());
  });

  it('setup lands quietly on Studio and clears history once', async () => {
    const ctx = makeCtx();
    await grpcGrpcurlLesson.setup?.(ctx);
    await getStep('grpc22-open-modal').preAction?.(ctx);

    expect(grpcGrpcurlLesson.skipStudioTabIsolation).toBe(true);
    expect(helperSpies.navigateToGrpcStudio).toHaveBeenCalledWith(ctx);
    expect(helperSpies.resetGrpcConnectionSettingsQuiet).toHaveBeenCalledWith(ctx);
    // History cleared once in setup — first-step preAction must not re-clear.
    expect(adapterSpies.clearGrpcCallHistory).toHaveBeenCalledTimes(1);
    expect(adapterSpies.dispatchGrpcCallHistoryReload).toHaveBeenCalledTimes(1);
  });

  it('setup tolerates clearGrpcCallHistory failures', async () => {
    adapterSpies.clearGrpcCallHistory.mockRejectedValueOnce(new Error('storage'));
    const ctx = makeCtx();
    await expect(grpcGrpcurlLesson.setup?.(ctx)).resolves.toBeUndefined();
    expect(adapterSpies.dispatchGrpcCallHistoryReload).toHaveBeenCalledTimes(1);
  });

  it('combined open-modal step clicks Import then spotlights the modal', async () => {
    mountGrpcGrpcurlDom();
    const ctx = makeCtx();

    await getStep('grpc22-open-modal').preAction?.(ctx);
    await getStep('grpc22-open-modal').action?.(ctx);
    await getStep('grpc22-paste-command').preAction?.(ctx);
    await getStep('grpc22-paste-command').action?.(ctx);

    expect(ctx.click).toHaveBeenCalledWith(GRPC.IMPORT_GRPCURL_BTN);
    expect(helperSpies.spotlightAndPause).toHaveBeenCalledWith(ctx, GRPC.IMPORT_GRPCURL_MODAL, 1_000);
    expect(helperSpies.spotlightAndPause).toHaveBeenCalledWith(ctx, GRPC.IMPORT_GRPCURL_TEXTAREA, 1_100);
    expect(ctx.fill).toHaveBeenCalledWith(GRPC.IMPORT_GRPCURL_TEXTAREA, expect.stringContaining('grpcurl -plaintext'));
  });

  it('review-preview holds reading ring; only spotlights warnings when present', async () => {
    mountGrpcGrpcurlDom({ withWarnings: true });
    const ctx = makeCtx();
    await getStep('grpc22-review-preview').action?.(ctx);

    expect(helperSpies.spotlightAndPause).toHaveBeenCalledWith(ctx, GRPC.IMPORT_GRPCURL_WARNINGS, 900);
    expect(helperSpies.spotlightAndPause).not.toHaveBeenCalledWith(
      ctx,
      GRPC.IMPORT_GRPCURL_PREVIEW,
      expect.any(Number),
    );

    helperSpies.spotlightAndPause.mockClear();
    mountGrpcGrpcurlDom({ withWarnings: false });
    await getStep('grpc22-review-preview').action?.(ctx);

    expect(helperSpies.spotlightAndPause).not.toHaveBeenCalled();
    expect(getStep('grpc22-review-preview').highlight).toBe(GRPC.IMPORT_GRPCURL_PREVIEW);
  });

  it('executes import-fields when explorer is not yet loaded', async () => {
    mountGrpcGrpcurlDom();
    const ctx = makeCtx();
    vi.mocked(ctx.click).mockImplementation(async (selector) => {
      if (selector === GRPC.IMPORT_GRPCURL_SUBMIT) {
        document.querySelector('[data-testid="grpc-import-grpcurl-modal"]')?.remove();
      }
    });
    vi.mocked(ctx.waitFor).mockImplementation(async (selector) => {
      if (selector === GRPC.EXPLORER_TREE) {
        document.body.insertAdjacentHTML('beforeend', '<div data-testid="grpc-explorer-tree"></div>');
      }
    });

    await getStep('grpc22-import-fields').preAction?.(ctx);
    await getStep('grpc22-import-fields').action?.(ctx);

    expect(getStep('grpc22-import-fields').highlight).toBe(GRPC.IMPORT_GRPCURL_SUBMIT);
    expect(ctx.click).toHaveBeenCalledWith(GRPC.IMPORT_GRPCURL_SUBMIT);
    expect(document.querySelector(GRPC.IMPORT_GRPCURL_MODAL)).toBeNull();
    expect(helperSpies.ensureGrpcReflected).not.toHaveBeenCalled();
    expect(helperSpies.guardGrpcReflectedQuiet).toHaveBeenCalled();
    expect(helperSpies.clearGrpcSchemaDriftQuiet).toHaveBeenCalled();
    expect(helperSpies.spotlightAndPause).toHaveBeenCalledWith(ctx, GRPC.TARGET_INPUT, 1_000);
    expect(helperSpies.spotlightAndPause).not.toHaveBeenCalledWith(
      ctx,
      GRPC.CONNECTION_BAR,
      expect.any(Number),
    );
  });

  it('import-fields preAction returns early when explorer is loaded and modal is closed', async () => {
    mountGrpcGrpcurlDom({ withExplorer: true });
    document.querySelector('[data-testid="grpc-import-grpcurl-modal"]')?.remove();
    const ctx = makeCtx();
    await getStep('grpc22-import-fields').preAction?.(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GRPC.IMPORT_GRPCURL_BTN);
  });

  it('import-fields preAction reopens modal when explorer exists but modal is still open', async () => {
    mountGrpcGrpcurlDom({ withExplorer: true });
    const ctx = makeCtx();
    await getStep('grpc22-import-fields').preAction?.(ctx);
    // Modal already open — ensureCommandPastedQuiet should keep it (no early skip).
    expect(document.querySelector(GRPC.IMPORT_GRPCURL_MODAL)).toBeTruthy();
  });

  it('import-fields action falls back to ensureGrpcReflected when tree wait fails', async () => {
    mountGrpcGrpcurlDom();
    const ctx = makeCtx();
    vi.mocked(ctx.click).mockImplementation(async (selector) => {
      if (selector === GRPC.IMPORT_GRPCURL_SUBMIT) {
        document.querySelector('[data-testid="grpc-import-grpcurl-modal"]')?.remove();
      }
    });
    vi.mocked(ctx.waitFor).mockRejectedValue(new Error('timeout'));

    await getStep('grpc22-import-fields').action?.(ctx);

    expect(helperSpies.ensureGrpcReflected).toHaveBeenCalledWith(ctx);
  });

  it('executes send-call and history-copy without panel/detail shell rings', async () => {
    mountGrpcGrpcurlDom({ withExplorer: true, withHistory: true });
    const ctx = makeCtx();

    await getStep('grpc22-send-call').preAction?.(ctx);
    await getStep('grpc22-send-call').action?.(ctx);
    await getStep('grpc22-history-copy').preAction?.(ctx);
    await getStep('grpc22-history-copy').action?.(ctx);

    expect(helperSpies.ensureUnaryExecuted).toHaveBeenCalledWith(ctx, 'hello from grpcurl');
    expect(ctx.click).toHaveBeenCalledWith(GRPC.SEND_BTN);
    expect(ctx.click).toHaveBeenCalledWith(GRPC.SUB_NAV_HISTORY);
    expect(ctx.click).toHaveBeenCalledWith(GRPC.HISTORY_COPY_GRPCURL);
    expect(helperSpies.spotlightAndPause).toHaveBeenCalledWith(ctx, GRPC.HISTORY_COPY_GRPCURL, 1_200);
    expect(helperSpies.spotlightAndPause).not.toHaveBeenCalledWith(
      ctx,
      GRPC.HISTORY_PANEL,
      expect.any(Number),
    );
    expect(helperSpies.spotlightAndPause).not.toHaveBeenCalledWith(
      ctx,
      GRPC.HISTORY_DETAIL,
      expect.any(Number),
    );
  });

  it('executes secret-filtering preAction and action', async () => {
    mountGrpcGrpcurlDom({ withExplorer: true, withHistory: true });
    const ctx = makeCtx();

    await getStep('grpc22-secret-filtering').preAction?.(ctx);
    await getStep('grpc22-secret-filtering').action?.(ctx);

    expect(helperSpies.openGrpcHistoryPanelQuiet).toHaveBeenCalled();
    expect(helperSpies.spotlightAndPause).toHaveBeenCalledWith(ctx, GRPC.HISTORY_COPY_GRPCURL, 1_200);
    expect(helperSpies.spotlightAndPause).toHaveBeenCalledWith(ctx, GRPC.HISTORY_REPLAY_BTN, 800);
    expect(helperSpies.spotlightAndPause).not.toHaveBeenCalledWith(
      ctx,
      GRPC.HISTORY_PANEL,
      expect.any(Number),
    );
    expect(helperSpies.spotlightAndPause).not.toHaveBeenCalledWith(
      ctx,
      GRPC.HISTORY_DETAIL,
      expect.any(Number),
    );
  });

  it('secret-filtering preAction selects history row when Copy btn is missing', async () => {
    mountGrpcGrpcurlDom({ withExplorer: true });
    document.body.insertAdjacentHTML('beforeend', '<div data-testid="grpc-history-entry-demo"></div>');
    const ctx = makeCtx();
    const row = document.querySelector<HTMLElement>(GRPC.HISTORY_ENTRY_ROW)!;
    const clickSpy = vi.spyOn(row, 'click');

    await getStep('grpc22-secret-filtering').preAction?.(ctx);

    expect(clickSpy).toHaveBeenCalled();
  });
});
