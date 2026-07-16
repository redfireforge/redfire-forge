/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GRPC } from '@shared/selectors';
import { makeCtx } from './ws-test-utils';
import { GRPC_ECHO_METHOD_SEL, GRPC_ECHO_SERVICE_SEL } from './grpc-lesson-helpers';
import {
  DEMO_BEARER_TOKEN,
  GRPC_SPRING_NETTY_TARGET,
  ensureManageModalClosed,
  ensureManageModalOpen,
  ensureSpringStudioReady,
  ensureTransportModeQuiet,
  bearerTokenFieldValue,
  fillBearerTokenField,
  isTransportModeActive,
  openAuthTabQuiet,
  reflectQuiet,
  resetSpringBaselineQuiet,
  selectAuthTypeQuiet,
  selectMethodQuiet,
  selectMethodVisible,
} from './grpc-spring-boot-helpers';

vi.mock('../env-manager-lesson-helpers', () => ({
  navigateToGrpcStudio: vi.fn(async () => {}),
}));

vi.mock('../../../demoRipple', () => ({
  showSpotlightRing: () => vi.fn(),
}));

import { navigateToGrpcStudio } from '../env-manager-lesson-helpers';

describe('grpc-spring-boot-helpers', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    delete (window as unknown as { __demoPatchGrpcActiveTab?: unknown }).__demoPatchGrpcActiveTab;
  });

  it('isTransportModeActive reads aria-pressed on transport drawer button', () => {
    document.body.innerHTML = `<button data-testid="grpc-transport-mode-express" aria-pressed="true"></button>`;
    expect(isTransportModeActive('express')).toBe(true);
    expect(isTransportModeActive('grpc-web')).toBe(false);
  });

  it('isTransportModeActive falls back to connection-bar badge class', () => {
    document.body.innerHTML = `<span data-testid="grpc-transport-badge" class="grpc-connection-transport-badge--spring-servlet"></span>`;
    expect(isTransportModeActive('spring-servlet')).toBe(true);
  });

  it('ensureTransportModeQuiet patches transport via demo bridge', async () => {
    const patch = vi.fn();
    (window as unknown as { __demoPatchGrpcActiveTab?: (patch: unknown) => void }).__demoPatchGrpcActiveTab = patch;
    const ctx = makeCtx();

    await ensureTransportModeQuiet(ctx, 'grpc-web');

    expect(patch).toHaveBeenCalledWith({ transportMode: 'grpc-web' });
    expect(ctx.delay).toHaveBeenCalledWith(150);
  });

  it('ensureTransportModeQuiet opens transport drawer when bridge is unavailable', async () => {
    document.body.innerHTML = `
      <button data-testid="grpc-sub-nav-studio" aria-selected="true"></button>
      <button data-testid="grpc-connection-settings-btn"></button>
      <button data-testid="grpc-settings-nav-transport"></button>
      <div data-testid="grpc-transport-panel"></div>
      <button data-testid="grpc-transport-mode-express" aria-pressed="false"></button>
      <button data-testid="grpc-settings-close"></button>
    `;
    const modeBtn = document.querySelector<HTMLButtonElement>(GRPC.TRANSPORT_MODE('express'))!;
    const clickSpy = vi.spyOn(modeBtn, 'click');
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockImplementation(async (selector) => {
      if (selector === GRPC.SETTINGS_DRAWER) {
        document.body.insertAdjacentHTML('beforeend', '<div data-testid="grpc-connection-settings-drawer"></div>');
      }
      if (selector === GRPC.SETTINGS_PANEL('transport')) {
        document.body.insertAdjacentHTML('beforeend', '<div data-testid="grpc-settings-panel-transport"></div>');
      }
    });

    await ensureTransportModeQuiet(ctx, 'express');

    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('reflectQuiet returns immediately when explorer tree is already present', async () => {
    document.body.innerHTML = `<div data-testid="grpc-explorer-tree"></div>`;
    const ctx = makeCtx();

    await reflectQuiet(ctx);

    expect(ctx.waitFor).not.toHaveBeenCalled();
  });

  it('selectMethodQuiet skips reflect when method is already selected', async () => {
    const methodId = GRPC_ECHO_METHOD_SEL.match(/data-testid="([^"]+)"/)?.[1] ?? '';
    document.body.innerHTML = `
      <button data-testid="${methodId}" class="grpc-explorer-method-btn--selected"></button>
      <div data-testid="grpc-call-panel"></div>
      <textarea data-testid="grpc-request-json"></textarea>
    `;
    const ctx = makeCtx();
    vi.mocked(ctx.fill).mockImplementation(async (_sel, value) => {
      const el = document.querySelector<HTMLTextAreaElement>('[data-testid="grpc-request-json"]');
      if (el) el.value = value;
    });

    await selectMethodQuiet(ctx, GRPC_ECHO_METHOD_SEL);

    expect(ctx.waitFor).not.toHaveBeenCalledWith(GRPC.EXPLORER_TREE, expect.any(Number));
  });

  it('ensureSpringStudioReady sets target when input value differs', async () => {
    document.body.innerHTML = `
      <button data-testid="grpc-sub-nav-studio" aria-selected="true"></button>
      <span data-testid="grpc-transport-badge" class="grpc-connection-transport-badge--express"></span>
      <input data-testid="grpc-target-input" value="localhost:50051" />
    `;
    const ctx = makeCtx();

    await ensureSpringStudioReady(ctx, { target: GRPC_SPRING_NETTY_TARGET });

    const input = document.querySelector<HTMLInputElement>(GRPC.TARGET_INPUT)!;
    expect(input.value).toBe(GRPC_SPRING_NETTY_TARGET);
  });

  it('openAuthTabQuiet clicks Auth tab when inactive', async () => {
    document.body.innerHTML = `<button data-testid="grpc-request-tab-auth" aria-pressed="false"></button>`;
    const authBtn = document.querySelector<HTMLButtonElement>(GRPC.REQUEST_TAB_AUTH)!;
    const clickSpy = vi.spyOn(authBtn, 'click');
    const ctx = makeCtx();

    await openAuthTabQuiet(ctx);

    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('selectAuthTypeQuiet changes auth type via selectOption', async () => {
    document.body.innerHTML = `
      <select data-testid="grpc-auth-type-select">
        <option value="none" selected></option>
        <option value="bearer"></option>
      </select>
    `;
    const ctx = makeCtx();

    await selectAuthTypeQuiet(ctx, 'bearer');

    expect(ctx.selectOption).toHaveBeenCalledWith(GRPC.AUTH_TYPE_SELECT, 'bearer');
  });

  it('fillBearerTokenField and bearerTokenFieldValue round-trip token value', () => {
    document.body.innerHTML = `<input data-testid="grpc-auth-bearer-token" value="" />`;
    fillBearerTokenField(DEMO_BEARER_TOKEN);
    expect(bearerTokenFieldValue()).toBe(DEMO_BEARER_TOKEN);
  });

  it('ensureManageModalOpen opens modal when absent', async () => {
    document.body.innerHTML = `<button data-testid="grpc-manage-schemas-btn"></button>`;
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockImplementation(async (selector) => {
      if (selector === GRPC.PROTO_MANAGE_MODAL) {
        document.body.insertAdjacentHTML('beforeend', '<div data-testid="grpc-proto-manage-modal"></div>');
      }
    });

    await ensureManageModalOpen(ctx);

    expect(ctx.click).toHaveBeenCalledWith(GRPC.MANAGE_SCHEMAS_BTN);
    expect(ctx.waitFor).toHaveBeenCalledWith(GRPC.PROTO_MANAGE_MODAL, 10_000);
  });

  it('ensureManageModalClosed clicks cancel when modal is open', async () => {
    document.body.innerHTML = `
      <div data-testid="grpc-proto-manage-modal"></div>
      <button data-testid="grpc-proto-cancel-btn"></button>
    `;
    const ctx = makeCtx();

    await ensureManageModalClosed(ctx);

    expect(ctx.click).toHaveBeenCalledWith(GRPC.PROTO_CANCEL_BTN);
  });

  it('isTransportModeActive returns false when no controls match', () => {
    expect(isTransportModeActive('tauri')).toBe(false);
  });

  it('ensureTransportModeQuiet returns early when mode is already active', async () => {
    document.body.innerHTML = `<button data-testid="grpc-transport-mode-express" aria-pressed="true"></button>`;
    const ctx = makeCtx();
    await ensureTransportModeQuiet(ctx, 'express');
    expect(ctx.delay).not.toHaveBeenCalled();
  });

  it('reflectQuiet clicks reflect and waits for explorer tree', async () => {
    document.body.innerHTML = `<button data-testid="grpc-reflect-btn"></button>`;
    const reflectBtn = document.querySelector<HTMLButtonElement>(GRPC.REFLECT_BTN)!;
    const clickSpy = vi.spyOn(reflectBtn, 'click');
    const ctx = makeCtx();

    await reflectQuiet(ctx);

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(ctx.waitFor).toHaveBeenCalledWith(`${GRPC.EXPLORER_TREE}, ${GRPC.EXPLORER_ERROR}`, 12_000);
  });

  it('selectMethodQuiet expands service and selects method', async () => {
    const methodId = GRPC_ECHO_METHOD_SEL.match(/data-testid="([^"]+)"/)?.[1] ?? '';
    const serviceId = GRPC_ECHO_SERVICE_SEL.match(/data-testid="([^"]+)"/)?.[1] ?? '';
    document.body.innerHTML = `
      <button data-testid="grpc-reflect-btn"></button>
      <button data-testid="${serviceId}"></button>
      <button data-testid="${methodId}"></button>
      <textarea data-testid="grpc-request-json"></textarea>
    `;
    const serviceBtn = document.querySelector<HTMLElement>(`[data-testid="${serviceId}"]`)!;
    const methodBtn = document.querySelector<HTMLElement>(`[data-testid="${methodId}"]`)!;
    vi.spyOn(serviceBtn, 'click');
    vi.spyOn(methodBtn, 'click');
    const ctx = makeCtx();
    vi.mocked(ctx.fill).mockImplementation(async (_sel, value) => {
      const el = document.querySelector<HTMLTextAreaElement>('[data-testid="grpc-request-json"]');
      if (el) el.value = value;
    });

    await selectMethodQuiet(ctx, GRPC_ECHO_METHOD_SEL);

    expect(methodBtn.click).toHaveBeenCalled();
  });

  it('selectAuthTypeQuiet skips when auth type already matches', async () => {
    document.body.innerHTML = `
      <select data-testid="grpc-auth-type-select">
        <option value="bearer" selected></option>
      </select>
    `;
    const ctx = makeCtx();
    await selectAuthTypeQuiet(ctx, 'bearer');
    expect(ctx.selectOption).not.toHaveBeenCalled();
  });

  it('fillBearerTokenField is a no-op when input is disabled', () => {
    document.body.innerHTML = `<input data-testid="grpc-auth-bearer-token" value="old" disabled />`;
    fillBearerTokenField('new');
    expect(bearerTokenFieldValue()).toBe('old');
  });

  it('resetSpringBaselineQuiet chains studio nav, settings reset, transport, target, and method', async () => {
    document.body.innerHTML = `
      <button data-testid="grpc-sub-nav-studio" aria-selected="true"></button>
      <span data-testid="grpc-transport-badge" class="grpc-connection-transport-badge--express"></span>
      <input data-testid="grpc-target-input" value="" />
      <button data-testid="grpc-reflect-btn"></button>
      <button data-testid="${GRPC_ECHO_METHOD_SEL.match(/data-testid="([^"]+)"/)?.[1] ?? ''}"></button>
      <textarea data-testid="grpc-request-json"></textarea>
    `;
    const ctx = makeCtx();
    await resetSpringBaselineQuiet(ctx);
    expect(navigateToGrpcStudio).toHaveBeenCalledWith(ctx);
  });

  it('resetSpringBaselineQuiet skips reflect + method selection when selectMethod is false', async () => {
    document.body.innerHTML = `
      <button data-testid="grpc-sub-nav-studio" aria-selected="true"></button>
      <span data-testid="grpc-transport-badge" class="grpc-connection-transport-badge--express"></span>
      <input data-testid="grpc-target-input" value="" />
      <button data-testid="grpc-reflect-btn"></button>
      <button data-testid="${GRPC_ECHO_METHOD_SEL.match(/data-testid="([^"]+)"/)?.[1] ?? ''}"></button>
      <textarea data-testid="grpc-request-json"></textarea>
    `;
    const reflectBtn = document.querySelector<HTMLButtonElement>('[data-testid="grpc-reflect-btn"]')!;
    const reflectClickSpy = vi.spyOn(reflectBtn, 'click');
    const ctx = makeCtx();
    await resetSpringBaselineQuiet(ctx, { selectMethod: false });
    expect(navigateToGrpcStudio).toHaveBeenCalledWith(ctx);
    // No reflect — the service tree must not build during setup / step 1.
    expect(reflectClickSpy).not.toHaveBeenCalled();
  });

  it('selectMethodVisible reflects, expands service, and selects method', async () => {
    const methodId = GRPC_ECHO_METHOD_SEL.match(/data-testid="([^"]+)"/)?.[1] ?? '';
    const serviceId = GRPC_ECHO_SERVICE_SEL.match(/data-testid="([^"]+)"/)?.[1] ?? '';
    document.body.innerHTML = `
      <button data-testid="grpc-reflect-btn"></button>
      <button data-testid="${serviceId}"></button>
      <button data-testid="${methodId}"></button>
      <textarea data-testid="grpc-request-json"></textarea>
    `;
    const ctx = makeCtx();
    vi.mocked(ctx.fill).mockImplementation(async (_sel, value) => {
      const el = document.querySelector<HTMLTextAreaElement>('[data-testid="grpc-request-json"]');
      if (el) el.value = value;
    });
    vi.mocked(ctx.waitFor).mockImplementation(async (selector) => {
      if (String(selector).includes('grpc-explorer-tree')) {
        document.body.insertAdjacentHTML('beforeend', '<div data-testid="grpc-explorer-tree"></div>');
      }
    });

    await selectMethodVisible(ctx, GRPC_ECHO_METHOD_SEL);

    expect(ctx.click).toHaveBeenCalledWith(GRPC.REFLECT_BTN);
    expect(ctx.click).toHaveBeenCalledWith(GRPC_ECHO_METHOD_SEL);
  });

  it('ensureSpringStudioReady resets auth and switches transport when needed', async () => {
    document.body.innerHTML = `
      <button data-testid="grpc-sub-nav-studio" aria-selected="true"></button>
      <button data-testid="grpc-transport-mode-spring-servlet" aria-pressed="false"></button>
      <input data-testid="grpc-target-input" value="localhost:9090" />
    `;
    const ctx = makeCtx();

    await ensureSpringStudioReady(ctx, { resetAuth: true, transport: 'spring-servlet' });

    expect(ctx.selectOption).not.toHaveBeenCalled();
  });

  it('ensureSpringStudioReady reflects and selects method when requested', async () => {
    const methodId = GRPC_ECHO_METHOD_SEL.match(/data-testid="([^"]+)"/)?.[1] ?? '';
    document.body.innerHTML = `
      <button data-testid="grpc-sub-nav-studio" aria-selected="true"></button>
      <span data-testid="grpc-transport-badge" class="grpc-connection-transport-badge--express"></span>
      <input data-testid="grpc-target-input" value="localhost:9090" />
      <button data-testid="grpc-reflect-btn"></button>
      <button data-testid="${methodId}"></button>
      <textarea data-testid="grpc-request-json"></textarea>
    `;
    const ctx = makeCtx();
    vi.mocked(ctx.fill).mockImplementation(async (_sel, value) => {
      const el = document.querySelector<HTMLTextAreaElement>('[data-testid="grpc-request-json"]');
      if (el) el.value = value;
    });

    await ensureSpringStudioReady(ctx, { reflect: true, method: GRPC_ECHO_METHOD_SEL, transport: 'spring-servlet' });

    expect(ctx.waitFor).toHaveBeenCalled();
  });

  it('openAuthTabQuiet skips click when auth tab is already active', async () => {
    document.body.innerHTML = `<button data-testid="grpc-request-tab-auth" aria-pressed="true"></button>`;
    const ctx = makeCtx();
    await openAuthTabQuiet(ctx);
    expect(ctx.delay).not.toHaveBeenCalled();
  });

  it('selectMethodVisible skips method click when already selected', async () => {
    const methodId = GRPC_ECHO_METHOD_SEL.match(/data-testid="([^"]+)"/)?.[1] ?? '';
    document.body.innerHTML = `
      <button data-testid="${methodId}" class="grpc-explorer-method-btn--selected"></button>
      <textarea data-testid="grpc-request-json"></textarea>
    `;
    const ctx = makeCtx();
    await selectMethodVisible(ctx, GRPC_ECHO_METHOD_SEL, { reflectFirst: false });
    expect(ctx.click).not.toHaveBeenCalledWith(GRPC_ECHO_METHOD_SEL);
  });

  it('ensureManageModalOpen returns immediately when modal is already open', async () => {
    document.body.innerHTML = `<div data-testid="grpc-proto-manage-modal"></div>`;
    const ctx = makeCtx();
    await ensureManageModalOpen(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });
});
