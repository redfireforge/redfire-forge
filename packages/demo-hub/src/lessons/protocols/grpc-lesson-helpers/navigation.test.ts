/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GRPC } from '@shared/selectors';
import { makeCtx } from '../ws-test-utils';
import {
  closeGrpcSettingsDrawerQuiet,
  ensureGrpcStudioSubNavQuiet,
  openGrpcHistoryPanelQuiet,
  openGrpcSettingsDrawerQuiet,
} from './navigation';

describe('grpc-lesson-helpers/navigation', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('closeGrpcSettingsDrawerQuiet clicks close when drawer is open', async () => {
    document.body.innerHTML = `
      <div data-testid="grpc-connection-settings-drawer">
        <button data-testid="grpc-settings-close"></button>
      </div>
    `;
    const closeBtn = document.querySelector<HTMLButtonElement>(GRPC.SETTINGS_CLOSE)!;
    const clickSpy = vi.spyOn(closeBtn, 'click');
    const ctx = makeCtx();

    await closeGrpcSettingsDrawerQuiet(ctx);

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(ctx.delay).toHaveBeenCalledWith(200);
  });

  it('closeGrpcSettingsDrawerQuiet is a no-op when close button is missing', async () => {
    document.body.innerHTML = `<div data-testid="grpc-connection-settings-drawer"></div>`;
    const ctx = makeCtx();
    await closeGrpcSettingsDrawerQuiet(ctx);
    expect(ctx.delay).not.toHaveBeenCalled();
  });

  it('ensureGrpcStudioSubNavQuiet clicks Studio tab when not selected', async () => {
    document.body.innerHTML = `<button data-testid="grpc-sub-nav-studio" aria-selected="false"></button>`;
    const ctx = makeCtx();

    await ensureGrpcStudioSubNavQuiet(ctx);

    expect(ctx.click).toHaveBeenCalledWith(GRPC.SUB_NAV_STUDIO);
    expect(ctx.delay).toHaveBeenCalledWith(300);
  });

  it('openGrpcHistoryPanelQuiet skips history click when already selected', async () => {
    document.body.innerHTML = `
      <button data-testid="grpc-sub-nav-studio" aria-selected="true"></button>
      <button data-testid="grpc-sub-nav-history" aria-selected="true"></button>
      <div data-testid="grpc-history-panel"></div>
    `;
    const historyBtn = document.querySelector<HTMLButtonElement>(GRPC.SUB_NAV_HISTORY)!;
    const clickSpy = vi.spyOn(historyBtn, 'click');
    const ctx = makeCtx();

    await openGrpcHistoryPanelQuiet(ctx);

    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('openGrpcHistoryPanelQuiet does not bounce through Studio when History is already active', async () => {
    // Live state arriving from the previous step: History selected, Studio not.
    document.body.innerHTML = `
      <button data-testid="grpc-sub-nav-studio" aria-selected="false"></button>
      <button data-testid="grpc-sub-nav-history" aria-selected="true"></button>
      <div data-testid="grpc-history-panel"></div>
    `;
    const studioBtn = document.querySelector<HTMLButtonElement>(GRPC.SUB_NAV_STUDIO)!;
    const historyBtn = document.querySelector<HTMLButtonElement>(GRPC.SUB_NAV_HISTORY)!;
    const studioClickSpy = vi.spyOn(studioBtn, 'click');
    const historyClickSpy = vi.spyOn(historyBtn, 'click');
    const ctx = makeCtx();

    await openGrpcHistoryPanelQuiet(ctx);

    expect(studioClickSpy).not.toHaveBeenCalled();
    expect(historyClickSpy).not.toHaveBeenCalled();
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('openGrpcSettingsDrawerQuiet opens drawer without selecting a nav tab', async () => {
    document.body.innerHTML = `<button data-testid="grpc-connection-settings-btn"></button>`;
    const settingsBtn = document.querySelector<HTMLButtonElement>(GRPC.CONNECTION_SETTINGS_BTN)!;
    const clickSpy = vi.spyOn(settingsBtn, 'click');
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockImplementation(async (selector) => {
      if (selector === GRPC.SETTINGS_DRAWER) {
        document.body.insertAdjacentHTML('beforeend', '<div data-testid="grpc-connection-settings-drawer"></div>');
      }
    });

    await openGrpcSettingsDrawerQuiet(ctx);

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(ctx.waitFor).toHaveBeenCalledWith(GRPC.SETTINGS_DRAWER, 5_000);
  });

  it('ensureGrpcStudioSubNavQuiet skips click when Studio tab is already selected', async () => {
    document.body.innerHTML = `<button data-testid="grpc-sub-nav-studio" aria-selected="true"></button>`;
    const ctx = makeCtx();

    await ensureGrpcStudioSubNavQuiet(ctx);

    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('openGrpcHistoryPanelQuiet opens History and waits for panel', async () => {
    document.body.innerHTML = `
      <button data-testid="grpc-sub-nav-studio" aria-selected="true"></button>
      <button data-testid="grpc-sub-nav-history" aria-selected="false"></button>
      <div data-testid="grpc-history-panel"></div>
    `;
    const historyBtn = document.querySelector<HTMLButtonElement>(GRPC.SUB_NAV_HISTORY)!;
    const clickSpy = vi.spyOn(historyBtn, 'click');
    const ctx = makeCtx();

    await openGrpcHistoryPanelQuiet(ctx);

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(ctx.waitFor).toHaveBeenCalledWith(GRPC.HISTORY_PANEL, 2_500);
  });

  it('openGrpcSettingsDrawerQuiet opens drawer and selects transport nav', async () => {
    document.body.innerHTML = `
      <button data-testid="grpc-connection-settings-btn"></button>
      <button data-testid="grpc-settings-nav-transport"></button>
      <div data-testid="grpc-settings-panel-transport"></div>
    `;
    const settingsBtn = document.querySelector<HTMLButtonElement>(GRPC.CONNECTION_SETTINGS_BTN)!;
    const clickSpy = vi.spyOn(settingsBtn, 'click');
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockImplementation(async (selector) => {
      if (selector === GRPC.SETTINGS_DRAWER) {
        document.body.insertAdjacentHTML('beforeend', '<div data-testid="grpc-connection-settings-drawer"></div>');
      }
    });

    await openGrpcSettingsDrawerQuiet(ctx, 'transport');

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(ctx.waitFor).toHaveBeenCalledWith(GRPC.SETTINGS_DRAWER, 5_000);
    expect(ctx.waitFor).toHaveBeenCalledWith(GRPC.SETTINGS_PANEL('transport'), 3_000);
  });

  it('openGrpcSettingsDrawerQuiet returns early when settings button is disabled', async () => {
    document.body.innerHTML = `<button data-testid="grpc-connection-settings-btn" disabled></button>`;
    const ctx = makeCtx();

    await openGrpcSettingsDrawerQuiet(ctx, 'tls');

    expect(ctx.waitFor).not.toHaveBeenCalled();
  });

  it('openGrpcSettingsDrawerQuiet returns when drawer wait fails', async () => {
    document.body.innerHTML = `<button data-testid="grpc-connection-settings-btn"></button>`;
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockRejectedValueOnce(new Error('timeout'));

    await openGrpcSettingsDrawerQuiet(ctx, 'transport');

    expect(ctx.waitFor).toHaveBeenCalledWith(GRPC.SETTINGS_DRAWER, 5_000);
  });

  it('openGrpcHistoryPanelQuiet tolerates missing history panel', async () => {
    document.body.innerHTML = `
      <button data-testid="grpc-sub-nav-studio" aria-selected="true"></button>
      <button data-testid="grpc-sub-nav-history" aria-selected="false"></button>
    `;
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockRejectedValueOnce(new Error('no panel'));

    await openGrpcHistoryPanelQuiet(ctx);

    expect(ctx.waitFor).toHaveBeenCalledWith(GRPC.HISTORY_PANEL, 2_500);
  });

  it('openGrpcSettingsDrawerQuiet tolerates missing transport panel wait', async () => {
    document.body.innerHTML = `
      <button data-testid="grpc-connection-settings-btn"></button>
      <div data-testid="grpc-connection-settings-drawer"></div>
      <button data-testid="grpc-settings-nav-transport"></button>
    `;
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockRejectedValueOnce(new Error('no panel'));

    await openGrpcSettingsDrawerQuiet(ctx, 'transport');

    expect(ctx.waitFor).toHaveBeenCalledWith(GRPC.SETTINGS_PANEL('transport'), 3_000);
  });
});
