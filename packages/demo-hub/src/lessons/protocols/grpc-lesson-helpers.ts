/** Shared helpers for gRPC Studio demo lessons (GRPC-1+). */
import type { DemoActionContext } from '../../types';
import { GRPC } from '@shared/selectors';
import {
  GRPC_DEMO_DOCKER_COMMAND,
  GRPC_DEMO_HEALTH_URL,
  GRPC_DEMO_PREREQUISITE_ENDPOINTS,
  GRPC_DEMO_TARGET,
  GRPC_EXPRESS_HEALTH_URL,
  GRPC_STUDIO_LESSON_ALLOWED_TABS as GRPC_STUDIO_LESSON_ALLOWED_TABS_VALUES,
  purgeGrpcDemoCallHistory,
} from '../../adapters';
import {
  getGrpcLessonRunFlags,
  setGrpcLessonRunFlag,
} from './grpc-lesson-contract/runtime';
import { navigateToGrpcStudio } from '../env-manager-lesson-helpers';

export {
  GRPC_DEMO_TARGET,
  GRPC_DEMO_HEALTH_URL,
  GRPC_EXPRESS_HEALTH_URL,
  GRPC_DEMO_PREREQUISITE_ENDPOINTS,
  GRPC_DEMO_DOCKER_COMMAND,
};

export const GRPC_STUDIO_LESSON_ALLOWED_TABS = GRPC_STUDIO_LESSON_ALLOWED_TABS_VALUES;

export const GRPC_ECHO_SERVICE = 'echo.EchoService';
export const GRPC_ECHO_METHOD = 'Echo';
export const GRPC_DEMO_MESSAGE = 'Hello from gRPC Studio';

export const GRPC_ECHO_SERVICE_SEL = GRPC.SERVICE(GRPC_ECHO_SERVICE);
export const GRPC_ECHO_METHOD_SEL = GRPC.METHOD(GRPC_ECHO_SERVICE, GRPC_ECHO_METHOD);

export const grpcLessonSession = {
  get targetSet() {
    return getGrpcLessonRunFlags().targetSet;
  },
  get reflected() {
    return getGrpcLessonRunFlags().reflected;
  },
  get methodSelected() {
    return getGrpcLessonRunFlags().methodSelected;
  },
  get messageFilled() {
    return getGrpcLessonRunFlags().messageFilled;
  },
  get executed() {
    return getGrpcLessonRunFlags().executed;
  },
};

export function resetGrpcLessonSessionFlags(): void {
  setGrpcLessonRunFlag('targetSet', false);
  setGrpcLessonRunFlag('reflected', false);
  setGrpcLessonRunFlag('methodSelected', false);
  setGrpcLessonRunFlag('messageFilled', false);
  setGrpcLessonRunFlag('executed', false);
}

/** Close connection settings drawer if a prior step left it open. */
export async function closeGrpcSettingsDrawerQuiet(ctx: DemoActionContext): Promise<void> {
  if (document.querySelector(GRPC.SETTINGS_DRAWER)) {
    const closeBtn = document.querySelector<HTMLElement>(GRPC.SETTINGS_CLOSE);
    if (closeBtn) {
      closeBtn.click();
      await ctx.delay(400);
    }
  }
}

/** Ensure Studio sub-nav is on the main call surface (not Collections/History). */
export async function ensureGrpcStudioSubNavQuiet(ctx: DemoActionContext): Promise<void> {
  const studioBtn = document.querySelector<HTMLElement>(GRPC.SUB_NAV_STUDIO);
  if (studioBtn && studioBtn.getAttribute('aria-selected') !== 'true') {
    await ctx.click(GRPC.SUB_NAV_STUDIO);
    await ctx.delay(600);
  }
}

export async function ensureGrpcTarget(ctx: DemoActionContext): Promise<void> {
  await navigateToGrpcStudio(ctx);
  await closeGrpcSettingsDrawerQuiet(ctx);
  await ensureGrpcStudioSubNavQuiet(ctx);
  await ctx.waitFor(GRPC.TARGET_INPUT, 10_000);

  const input = document.querySelector<HTMLInputElement>(GRPC.TARGET_INPUT);
  if (grpcLessonSession.targetSet && input?.value.trim() === GRPC_DEMO_TARGET) {
    if (document.querySelector(GRPC.TARGET_STATUS_OK)) return;
  }

  await ctx.fill(GRPC.TARGET_INPUT, GRPC_DEMO_TARGET);

  // Fallback path: some runtime states can ignore synthetic fill calls.
  // Force native input/change events so React state is updated deterministically.
  if (!document.querySelector(GRPC.TARGET_STATUS_OK)) {
    const targetInput = document.querySelector<HTMLInputElement>(GRPC.TARGET_INPUT);
    if (targetInput) {
      targetInput.focus();
      targetInput.value = GRPC_DEMO_TARGET;
      targetInput.dispatchEvent(new Event('input', { bubbles: true }));
      targetInput.dispatchEvent(new Event('change', { bubbles: true }));
      targetInput.blur();
    }
  }

  try {
    await ctx.waitFor(GRPC.TARGET_STATUS_OK, 6_000);
  } catch {
    // Keep lesson flow responsive even when local endpoint interpolation/config
    // prevents target validation from reaching OK.
    return;
  }
  await ctx.delay(500);
  setGrpcLessonRunFlag('targetSet', true);
}

/**
 * Quietly reset auth → none and TLS → plaintext (disabled).
 * Called during lesson setup and cleanup so leftover session config
 * (e.g. OAuth2 from a previous lesson) does not bleed into a new lesson.
 * Opens and closes the settings drawer invisibly — no viewer ripple.
 */
export async function resetGrpcConnectionSettingsQuiet(ctx: DemoActionContext): Promise<void> {
  const settingsBtn = document.querySelector<HTMLButtonElement>(GRPC.CONNECTION_SETTINGS_BTN);
  if (!settingsBtn || settingsBtn.disabled) return;

  // Only open the drawer if it is not already open.
  if (!document.querySelector(GRPC.SETTINGS_DRAWER)) {
    await ctx.click(GRPC.CONNECTION_SETTINGS_BTN);
    try {
      await ctx.waitFor(GRPC.SETTINGS_DRAWER, 5_000);
    } catch {
      return;
    }
  }

  try {
    // Reset auth → none.
    const authNavSel = GRPC.SETTINGS_NAV_ITEM('auth');
    if (document.querySelector(authNavSel)) {
      await ctx.click(authNavSel);
      await ctx.waitFor(GRPC.SETTINGS_PANEL('auth'), 3_000);
      const authSelect = document.querySelector<HTMLSelectElement>(GRPC.AUTH_TYPE_SELECT);
      if (authSelect && !authSelect.disabled && authSelect.value !== 'none') {
        await ctx.selectOption(GRPC.AUTH_TYPE_SELECT, 'none');
        await ctx.delay(300);
      }
    }

    // Reset TLS → plaintext (disabled).
    const tlsNavSel = GRPC.SETTINGS_NAV_ITEM('tls');
    const tlsDisabledSel = GRPC.TLS_MODE('disabled');
    if (document.querySelector(tlsNavSel)) {
      await ctx.click(tlsNavSel);
      await ctx.waitFor(GRPC.SETTINGS_PANEL('tls'), 3_000);
      const tlsDisabledBtn = document.querySelector<HTMLButtonElement>(tlsDisabledSel);
      const isTlsDisabledActive = tlsDisabledBtn?.className.includes('active') ?? false;
      if (tlsDisabledBtn && !tlsDisabledBtn.disabled && !isTlsDisabledActive) {
        await ctx.click(tlsDisabledSel);
        await ctx.delay(300);
      }
    }
  } catch {
    // Best-effort hygiene — do not block lesson progression on settings UI drift.
  } finally {
    const closeBtn = document.querySelector<HTMLElement>(GRPC.SETTINGS_CLOSE);
    if (closeBtn) {
      closeBtn.click();
      await ctx.delay(300);
    }
  }
}

async function normalizeGrpcConnectionForReflection(ctx: DemoActionContext): Promise<void> {
  const reflectBtn = document.querySelector<HTMLButtonElement>(GRPC.REFLECT_BTN);
  if (reflectBtn && !reflectBtn.disabled) return;
  // Reflect is disabled — connection settings are blocking it. Reset them.
  await resetGrpcConnectionSettingsQuiet(ctx);
}

export async function ensureGrpcReflected(ctx: DemoActionContext): Promise<void> {
  await ensureGrpcTarget(ctx);
  const hasExplorerReflectionData = () =>
    Boolean(document.querySelector(GRPC.EXPLORER_TREE) || document.querySelector(GRPC.EXPLORER_SOURCE));

  if (grpcLessonSession.reflected && hasExplorerReflectionData()) {
    return;
  }

  let reflectBtn = document.querySelector<HTMLButtonElement>(GRPC.REFLECT_BTN);
  if (reflectBtn?.disabled) {
    await normalizeGrpcConnectionForReflection(ctx);
    reflectBtn = document.querySelector<HTMLButtonElement>(GRPC.REFLECT_BTN);
  }

  if (reflectBtn && !reflectBtn.disabled) {
    await ctx.click(GRPC.REFLECT_BTN);
  }

  const reflectionLoadTimeoutMs = reflectBtn?.disabled ? 3_500 : 12_000;
  try {
    await ctx.waitFor(`${GRPC.EXPLORER_TREE}, ${GRPC.EXPLORER_SOURCE}`, reflectionLoadTimeoutMs);
  } catch {
    // Demo lessons should remain navigable even when local reflection infra
    // is unavailable or temporarily unhealthy.
  }

  if (hasExplorerReflectionData()) {
    await ctx.delay(500);
    setGrpcLessonRunFlag('reflected', true);
  }
}

export async function ensureEchoMethodSelected(ctx: DemoActionContext): Promise<void> {
  await ensureGrpcReflected(ctx);

  if (
    grpcLessonSession.methodSelected
    && document.querySelector(GRPC.PROTO_FORM)
    && document.querySelector(GRPC_ECHO_METHOD_SEL)
  ) {
    return;
  }

  const methodBtn = document.querySelector<HTMLElement>(GRPC_ECHO_METHOD_SEL);
  if (!methodBtn) {
    const serviceBtn = document.querySelector<HTMLElement>(GRPC_ECHO_SERVICE_SEL);
    if (serviceBtn) {
      await ctx.click(GRPC_ECHO_SERVICE_SEL);
      await ctx.delay(500);
    }
  }

  await ctx.waitFor(GRPC_ECHO_METHOD_SEL, 10_000);
  await ctx.click(GRPC_ECHO_METHOD_SEL);
  await ctx.waitFor(GRPC.PROTO_FORM, 10_000);
  await ctx.delay(600);
  setGrpcLessonRunFlag('methodSelected', true);
}

export async function ensureEchoMessageFilled(
  ctx: DemoActionContext,
  message = GRPC_DEMO_MESSAGE,
): Promise<void> {
  await ensureEchoMethodSelected(ctx);

  const field = document.querySelector<HTMLInputElement>(GRPC.PROTO_FIELD_INPUT_MESSAGE);
  if (grpcLessonSession.messageFilled && field?.value === message) {
    return;
  }

  await ctx.waitFor(GRPC.PROTO_FIELD_INPUT_MESSAGE, 10_000);
  await ctx.fill(GRPC.PROTO_FIELD_INPUT_MESSAGE, message);
  await ctx.delay(500);
  setGrpcLessonRunFlag('messageFilled', true);
}

function setInputValueAndDispatch(input: HTMLInputElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
  descriptor?.set?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Best-effort cleanup for persisted Manage Schemas drafts.
 * Clears staged proto/protoset/url/bsr inputs so lessons start from a deterministic baseline.
 */
export async function resetGrpcManageSchemasDraftsQuiet(ctx: DemoActionContext): Promise<void> {
  await ensureGrpcStudioSubNavQuiet(ctx);
  const cleanupCurrentActiveTabDrafts = async (): Promise<void> => {
    const manageBtn = document.querySelector<HTMLButtonElement>(GRPC.MANAGE_SCHEMAS_BTN);
    if (!manageBtn || manageBtn.disabled) return;

    const openModal = async (): Promise<boolean> => {
      if (document.querySelector(GRPC.PROTO_MANAGE_MODAL)) return true;
      manageBtn.click();
      try {
        await ctx.waitFor(GRPC.PROTO_MANAGE_MODAL, 3_500);
        return true;
      } catch {
        return false;
      }
    };

    const closeModal = async (): Promise<void> => {
      const cancelBtn = document.querySelector<HTMLElement>(GRPC.PROTO_CANCEL_BTN);
      if (!cancelBtn) return;
      cancelBtn.click();
      await ctx.delay(180);
    };

    if (!(await openModal())) return;

    try {
      const modal = document.querySelector<HTMLElement>(GRPC.PROTO_MANAGE_MODAL);
      if (!modal) return;

      // Proto Files: clear staged files in every root and remove custom roots.
      const rootButtons = () => Array.from(modal.querySelectorAll<HTMLElement>('[data-testid^="grpc-proto-root-item-"]'));
      const clearCurrentRootFiles = () => {
        const clearBtn = modal.querySelector<HTMLButtonElement>(GRPC.PROTO_FILE_CLEAR_ALL);
        if (clearBtn && !clearBtn.disabled) {
          clearBtn.click();
        }
      };

      const protoFilesTab = modal.querySelector<HTMLElement>(GRPC.PROTO_TAB_PROTO_FILES);
      protoFilesTab?.click();
      await ctx.delay(120);

      for (const rootBtn of rootButtons()) {
        rootBtn.click();
        await ctx.delay(80);
        clearCurrentRootFiles();
        await ctx.delay(80);
      }

      for (const rootBtn of rootButtons()) {
        const testId = rootBtn.getAttribute('data-testid') ?? '';
        const rootId = testId.replace('grpc-proto-root-item-', '').trim();
        const mountPath = rootBtn.querySelector('span')?.textContent?.trim().toLowerCase() ?? '';
        if (!rootId || mountPath === 'root') {
          continue;
        }
        const removeBtn = modal.querySelector<HTMLButtonElement>(`[data-testid="grpc-proto-root-remove-${rootId}"]`);
        removeBtn?.click();
        await ctx.delay(120);
      }

      // Protoset: remove staged file.
      const protosetTab = modal.querySelector<HTMLElement>(GRPC.PROTO_TAB_PROTOSET);
      protosetTab?.click();
      await ctx.delay(120);
      const protosetClear = modal.querySelector<HTMLButtonElement>('[data-testid="grpc-proto-protoset-clear"]');
      if (protosetClear && !protosetClear.disabled) {
        protosetClear.click();
        await ctx.delay(220);
      }

      // URL: clear staged URL input.
      const urlTab = modal.querySelector<HTMLElement>(GRPC.PROTO_TAB_URL);
      urlTab?.click();
      await ctx.delay(80);
      const urlInput = modal.querySelector<HTMLInputElement>(GRPC.PROTO_URL_INPUT);
      if (urlInput) {
        setInputValueAndDispatch(urlInput, '');
      }

      // BSR: clear module/version/token inputs.
      const bsrTab = modal.querySelector<HTMLElement>(GRPC.PROTO_TAB_BSR);
      bsrTab?.click();
      await ctx.delay(80);
      const bsrModuleInput = modal.querySelector<HTMLInputElement>(GRPC.PROTO_BSR_MODULE_INPUT);
      const bsrVersionInput = modal.querySelector<HTMLInputElement>(GRPC.PROTO_BSR_VERSION_INPUT);
      const bsrTokenInput = modal.querySelector<HTMLInputElement>(GRPC.PROTO_BSR_TOKEN_INPUT);
      if (bsrModuleInput) setInputValueAndDispatch(bsrModuleInput, '');
      if (bsrVersionInput) setInputValueAndDispatch(bsrVersionInput, '');
      if (bsrTokenInput) setInputValueAndDispatch(bsrTokenInput, '');
    } catch {
      // Best-effort hygiene only.
    } finally {
      await closeModal();
    }
  };

  const allTabIds = Array.from(document.querySelectorAll<HTMLElement>(`${GRPC.TAB_BAR} [role="tab"]`))
    .map((el) => el.getAttribute('data-testid')?.trim())
    .filter((id): id is string => Boolean(id));
  const activeTabId = document
    .querySelector<HTMLElement>(`${GRPC.TAB_BAR} [role="tab"][aria-selected="true"]`)
    ?.getAttribute('data-testid')
    ?.trim();

  if (allTabIds.length === 0) {
    await cleanupCurrentActiveTabDrafts();
    return;
  }

  for (const tabId of allTabIds) {
    const tabEl = document.querySelector<HTMLElement>(`[data-testid="${tabId}"]`);
    tabEl?.click();
    await ctx.delay(120);
    await cleanupCurrentActiveTabDrafts();
  }

  if (activeTabId) {
    const restoreActiveTabEl = document.querySelector<HTMLElement>(`[data-testid="${activeTabId}"]`);
    restoreActiveTabEl?.click();
    await ctx.delay(100);
  }
}

/**
 * Open a fresh gRPC tab so the active call panel has no orphaned method
 * binding before a descriptor source switch (Protoset/BSR/URL).
 * Idempotent: if a blank tab already exists it stays in place.
 */
export async function openFreshGrpcTabQuiet(ctx: DemoActionContext): Promise<void> {
  await openFreshGrpcTabQuietWithOptions(ctx);
}

export async function openFreshGrpcTabQuietWithOptions(
  ctx: DemoActionContext,
  options?: { forceFresh?: boolean },
): Promise<void> {
  await ensureGrpcStudioSubNavQuiet(ctx);
  const forceFresh = options?.forceFresh === true;
  const tabBar = document.querySelector<HTMLElement>(GRPC.TAB_BAR);
  const tabs = tabBar ? Array.from(tabBar.querySelectorAll<HTMLElement>('[role="tab"]')) : [];
  const demoTabs = tabs.filter((tab) => {
    const label = tab.querySelector<HTMLElement>('.grpc-tab-label')?.textContent?.trim().toLowerCase();
    return label === 'demo';
  });

  if (demoTabs.length > 0 && !forceFresh) {
    const keepDemoTab = demoTabs.find((tab) => tab.getAttribute('aria-selected') === 'true') ?? demoTabs[0]!;
    // Close duplicate demo tabs if present.
    for (const tab of demoTabs) {
      if (tab === keepDemoTab) continue;
      const tabId = tab.getAttribute('data-testid');
      if (!tabId) continue;
      const closeBtn = document.querySelector<HTMLButtonElement>(`[data-testid="grpc-tab-close-${tabId}"]`);
      if (closeBtn && !closeBtn.disabled) {
        closeBtn.click();
        await ctx.delay(120);
      }
    }
    if (keepDemoTab.getAttribute('aria-selected') !== 'true') {
      keepDemoTab.click();
      await ctx.delay(100);
    }
  } else {
  const addTabBtn = document.querySelector<HTMLButtonElement>(GRPC.ADD_TAB);
    if (!addTabBtn || addTabBtn.disabled) return;
    addTabBtn.click();
    await ctx.delay(240);

    // Rename the active tab to "demo" so all lessons target a consistent demo tab.
    const activeTab = document.querySelector<HTMLElement>(`${GRPC.TAB_BAR} [role="tab"][aria-selected="true"]`);
    if (activeTab) {
      activeTab.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, detail: 2 }));
      let renameInput: HTMLInputElement | null = null;
      const startedAt = Date.now();
      while (Date.now() - startedAt < 1_000) {
        renameInput = document.querySelector<HTMLInputElement>('.grpc-tab-rename-input');
        if (renameInput) break;
        await ctx.delay(50);
      }
      if (renameInput) {
        const nativeSet = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
        nativeSet?.set?.call(renameInput, 'demo');
        renameInput.dispatchEvent(new Event('input', { bubbles: true }));
        renameInput.dispatchEvent(new Event('change', { bubbles: true }));
        renameInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        renameInput.blur();
        await ctx.delay(100);
      }
    }
  }

  // Copy the target so the new tab connects to the same server.
  const targetInput = document.querySelector<HTMLInputElement>(GRPC.TARGET_INPUT);
  if (targetInput && !targetInput.value.trim()) {
    const nativeSet = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
    nativeSet?.set?.call(targetInput, GRPC_DEMO_TARGET);
    targetInput.dispatchEvent(new Event('input', { bubbles: true }));
    targetInput.dispatchEvent(new Event('change', { bubbles: true }));
    await ctx.delay(200);
  }
}

/**
 * Normalize gRPC demo lesson tabs to a stable set: keep first user tab + demo tab.
 * Prevents leaked lesson-created tabs from carrying into later lessons.
 */
export async function normalizeGrpcDemoTabsQuiet(ctx: DemoActionContext): Promise<void> {
  await ensureGrpcStudioSubNavQuiet(ctx);
  const tabBar = document.querySelector<HTMLElement>(GRPC.TAB_BAR);
  if (!tabBar) return;

  const tabs = Array.from(tabBar.querySelectorAll<HTMLElement>('[role="tab"]'));
  if (tabs.length <= 2) return;

  const firstTabId = tabs[0]?.getAttribute('data-testid') ?? null;
  const demoTab = tabs.find((tab) => {
    const label = tab.querySelector<HTMLElement>('.grpc-tab-label')?.textContent?.trim().toLowerCase();
    return label === 'demo';
  }) ?? null;
  const demoTabId = demoTab?.getAttribute('data-testid') ?? null;
  const keepIds = new Set([firstTabId, demoTabId].filter((id): id is string => Boolean(id)));

  for (const tab of tabs.slice().reverse()) {
    const tabId = tab.getAttribute('data-testid');
    if (!tabId || keepIds.has(tabId)) continue;
    const closeBtn = document.querySelector<HTMLButtonElement>(`[data-testid="grpc-tab-close-${tabId}"]`);
    if (closeBtn && !closeBtn.disabled) {
      closeBtn.click();
      await ctx.delay(120);
    }
  }

  if (demoTab && demoTab.getAttribute('aria-selected') !== 'true') {
    demoTab.click();
    await ctx.delay(100);
  }
}

/**
 * Best-effort drift reset for demo lessons.
 * Clears stale-method drift banners that can remain after source switching.
 */
export async function clearGrpcSchemaDriftQuiet(ctx: DemoActionContext): Promise<void> {
  await ensureGrpcStudioSubNavQuiet(ctx);
  // Drift state can be applied a short moment after source/method updates.
  // Fast-path: if banner is absent immediately, return without polling.
  // Only start the poll loop when a banner is present on first check.
  let banner: HTMLElement | null = document.querySelector<HTMLElement>(GRPC.SCHEMA_DRIFT_BANNER);
  if (!banner) {
    // Wait one short frame to catch banners that appear asynchronously.
    await ctx.delay(80);
    banner = document.querySelector<HTMLElement>(GRPC.SCHEMA_DRIFT_BANNER);
  }
  if (!banner) {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await ctx.delay(80);
      banner = document.querySelector<HTMLElement>(GRPC.SCHEMA_DRIFT_BANNER);
      if (banner) break;
    }
  }
  if (!banner) return;

  const reconcileOnce = async (): Promise<void> => {
    const pruneBtn = document.querySelector<HTMLButtonElement>(GRPC.SCHEMA_DRIFT_PRUNE_BTN);
    if (pruneBtn && !pruneBtn.disabled) {
      pruneBtn.click();
      await ctx.delay(180);
    }

    const dismissBtn = document.querySelector<HTMLButtonElement>(GRPC.SCHEMA_DRIFT_DISMISS_BTN);
    if (dismissBtn && !dismissBtn.disabled) {
      dismissBtn.click();
      await ctx.delay(140);
    }

    // Blocking drift banners do not expose dismiss/prune. Rebind to any
    // suggested compatible method so lessons can recover from stale selection.
    if (document.querySelector(GRPC.SCHEMA_DRIFT_BANNER)) {
      const rebindBtn = document.querySelector<HTMLButtonElement>('[data-testid^="grpc-schema-drift-rebind-"]');
      if (rebindBtn && !rebindBtn.disabled) {
        rebindBtn.click();
        await ctx.delay(220);
      }
    }

    if (document.querySelector(GRPC.SCHEMA_DRIFT_BANNER)) {
      const echoMethodBtn = document.querySelector<HTMLButtonElement>(GRPC_ECHO_METHOD_SEL);
      if (echoMethodBtn && !echoMethodBtn.disabled) {
        echoMethodBtn.click();
        await ctx.delay(180);
      }
    }

    // Descriptor source may not contain Echo (e.g., BSR/Eliza). Fall back to
    // any available method so the tab can rebind away from an orphaned method.
    if (document.querySelector(GRPC.SCHEMA_DRIFT_BANNER)) {
      const anyMethodBtn = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-testid^="grpc-method-"]'))
        .find((btn) => !btn.disabled);
      if (anyMethodBtn) {
        anyMethodBtn.click();
        await ctx.delay(160);
      }
    }

    if (document.querySelector(GRPC.SCHEMA_DRIFT_BANNER)) {
      const dismissRetryBtn = document.querySelector<HTMLButtonElement>(GRPC.SCHEMA_DRIFT_DISMISS_BTN);
      if (dismissRetryBtn && !dismissRetryBtn.disabled) {
        dismissRetryBtn.click();
        await ctx.delay(100);
      }
    }
  };

  // Run multiple passes because some flows briefly re-render the banner after
  // descriptors settle, especially during source switching in demo lessons.
  for (let pass = 0; pass < 5; pass += 1) {
    if (!document.querySelector(GRPC.SCHEMA_DRIFT_BANNER)) {
      return;
    }
    await reconcileOnce();
    if (!document.querySelector(GRPC.SCHEMA_DRIFT_BANNER)) {
      return;
    }
    await ctx.delay(120);
  }
}

/**
 * Best-effort method rebind for lesson stability.
 * Ensures the active tab points at a currently available method even when
 * drift banner has not rendered yet.
 */
export async function rebindGrpcMethodQuiet(ctx: DemoActionContext): Promise<void> {
  await ensureGrpcStudioSubNavQuiet(ctx);

  const clickIfAvailable = async (btn: HTMLButtonElement | null): Promise<boolean> => {
    if (!btn || btn.disabled) return false;
    btn.click();
    await ctx.delay(140);
    return true;
  };

  const echoMethodBtn = document.querySelector<HTMLButtonElement>(GRPC_ECHO_METHOD_SEL);
  const anyMethodBtn = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-testid^="grpc-method-"]'))
    .find((btn) => !btn.disabled) ?? null;

  const clickedEcho = await clickIfAvailable(echoMethodBtn);
  if (!clickedEcho) {
    await clickIfAvailable(anyMethodBtn);
  }

  if (document.querySelector(GRPC.SCHEMA_DRIFT_BANNER)) {
    await clearGrpcSchemaDriftQuiet(ctx);
  }
}

export async function ensureUnaryExecuted(
  ctx: DemoActionContext,
  message = GRPC_DEMO_MESSAGE,
): Promise<void> {
  await ensureEchoMessageFilled(ctx, message);

  if (grpcLessonSession.executed && document.querySelector(GRPC.RESPONSE_BODY)) {
    const body = document.querySelector(GRPC.RESPONSE_BODY);
    if (body?.textContent?.includes(message)) return;
  }

  const sendBtn = document.querySelector<HTMLButtonElement>(GRPC.SEND_BTN);
  if (sendBtn && !sendBtn.disabled) {
    await ctx.click(GRPC.SEND_BTN);
  }
  await ctx.waitFor(GRPC.RESPONSE_STATUS, 30_000);
  await ctx.waitFor(GRPC.RESPONSE_BODY, 10_000);
  await ctx.delay(800);
  setGrpcLessonRunFlag('executed', true);
}

/** Open History sub-nav without viewer ripple (preAction / guards). */
export async function openGrpcHistoryPanelQuiet(ctx: DemoActionContext): Promise<void> {
  await ensureGrpcStudioSubNavQuiet(ctx);
  const historyBtn = document.querySelector<HTMLElement>(GRPC.SUB_NAV_HISTORY);
  if (historyBtn && historyBtn.getAttribute('aria-selected') !== 'true') {
    historyBtn.click();
    await ctx.delay(220);
  }
  try {
    await ctx.waitFor(GRPC.HISTORY_PANEL, 2_500);
  } catch {
    // History panel may be unavailable when storage is empty — caller handles entry wait.
  }
}

/** Open History and select the latest call row so the detail pane is populated. */
export async function openFirstGrpcHistoryEntry(
  ctx: DemoActionContext,
  options?: { ensureExecuted?: boolean },
): Promise<void> {
  if (options?.ensureExecuted !== false) {
    await ensureUnaryExecuted(ctx);
  }
  await closeGrpcSettingsDrawerQuiet(ctx);
  const historyBtn = document.querySelector<HTMLElement>(GRPC.SUB_NAV_HISTORY);
  if (historyBtn && historyBtn.getAttribute('aria-selected') !== 'true') {
    await ctx.click(GRPC.SUB_NAV_HISTORY);
  }
  await ctx.waitFor(GRPC.HISTORY_PANEL, 5_000);
  await ctx.waitFor(GRPC.HISTORY_LIST, 5_000);
  await ctx.waitFor(GRPC.HISTORY_ENTRY_ROW, 5_000);
  await ctx.delay(150);
  await ctx.click(GRPC.HISTORY_ENTRY_ROW);
  await ctx.waitFor(GRPC.HISTORY_REPLAY_BTN, 5_000);
  await ctx.delay(250);
}

// ---------------------------------------------------------------------------
// Streaming lesson helpers (GRPC-3)
// ---------------------------------------------------------------------------

export const GRPC_SERVER_STREAM_METHOD = 'ServerStream';
export const GRPC_CLIENT_STREAM_METHOD = 'ClientStream';
export const GRPC_BIDI_STREAM_METHOD = 'BidiStream';
export const GRPC_STREAM_MESSAGE = 'stream-demo';
export const GRPC_STREAM_REPEAT_COUNT = 5;
export const GRPC_STREAM_INTERVAL_MS = 300;

export const GRPC_SERVER_STREAM_SEL = GRPC.METHOD(GRPC_ECHO_SERVICE, GRPC_SERVER_STREAM_METHOD);
export const GRPC_CLIENT_STREAM_SEL = GRPC.METHOD(GRPC_ECHO_SERVICE, GRPC_CLIENT_STREAM_METHOD);
export const GRPC_BIDI_STREAM_SEL = GRPC.METHOD(GRPC_ECHO_SERVICE, GRPC_BIDI_STREAM_METHOD);

const CLIENT_STREAM_QUEUE_MESSAGES = ['client-msg-1', 'client-msg-2', 'client-msg-3'];

/**
 * Select a streaming method (ServerStream, ClientStream, or BidiStream) from the Service Explorer.
 * Idempotent — skips click if the correct compose/call type panel is already visible.
 */
export async function ensureStreamingMethodSelected(
  ctx: DemoActionContext,
  methodName: 'ServerStream' | 'ClientStream' | 'BidiStream',
): Promise<void> {
  await ensureGrpcReflected(ctx);

  const methodSel = GRPC.METHOD(GRPC_ECHO_SERVICE, methodName);

  // Check if the correct method is already active by inspecting the call type tab.
  const callTypeMap: Record<string, string> = {
    ServerStream: 'server_streaming',
    ClientStream: 'client_streaming',
    BidiStream: 'bidi_streaming',
  };
  const expectedCallType = callTypeMap[methodName];
  const activeTab = document.querySelector(
    `${GRPC.CALL_TYPE_TAB(expectedCallType)}[aria-selected="true"], ${GRPC.CALL_TYPE_TAB(expectedCallType)}.active`,
  );
  if (activeTab) return;

  // Expand the service node if the method button isn't visible.
  if (!document.querySelector(methodSel)) {
    const serviceBtn = document.querySelector<HTMLElement>(GRPC_ECHO_SERVICE_SEL);
    if (serviceBtn) {
      await ctx.click(GRPC_ECHO_SERVICE_SEL);
      await ctx.delay(160);
    }
  }

  await ctx.waitFor(methodSel, 10_000);
  await ctx.click(methodSel);
  await ctx.waitFor(GRPC.CALL_TYPE_SELECTOR, 8_000);
  await ctx.delay(180);
}

/**
 * Fill the StreamRequest fields for server-streaming.
 * Fills message, repeat_count, and interval_ms.
 */
export async function fillServerStreamRequest(
  ctx: DemoActionContext,
  opts: { message?: string; repeatCount?: number; intervalMs?: number } = {},
): Promise<void> {
  const { message = GRPC_STREAM_MESSAGE, repeatCount = GRPC_STREAM_REPEAT_COUNT, intervalMs = GRPC_STREAM_INTERVAL_MS } = opts;

  await ctx.waitFor(GRPC.PROTO_FIELD_INPUT('message'), 10_000);
  await ctx.fill(GRPC.PROTO_FIELD_INPUT('message'), message);
  await ctx.delay(120);

  const repeatInput = document.querySelector<HTMLInputElement>(GRPC.PROTO_FIELD_INPUT('repeat_count'));
  if (repeatInput) {
    await ctx.fill(GRPC.PROTO_FIELD_INPUT('repeat_count'), String(repeatCount));
    await ctx.delay(120);
  }

  const intervalInput = document.querySelector<HTMLInputElement>(GRPC.PROTO_FIELD_INPUT('interval_ms'));
  if (intervalInput) {
    await ctx.fill(GRPC.PROTO_FIELD_INPUT('interval_ms'), String(intervalMs));
    await ctx.delay(120);
  }
}

/**
 * Add a single message to the client streaming pending queue.
 * Fills the message field with the given body and clicks Add to queue.
 */
export async function queueClientStreamMessage(
  ctx: DemoActionContext,
  message: string,
): Promise<void> {
  const messageInput = document.querySelector<HTMLInputElement>(GRPC.PROTO_FIELD_INPUT('message'));
  if (messageInput) {
    await ctx.fill(GRPC.PROTO_FIELD_INPUT('message'), message);
    await ctx.delay(120);
  }
  const addBtn = document.querySelector<HTMLButtonElement>(GRPC.STREAM_ADD_QUEUE_BTN);
  if (addBtn && !addBtn.disabled) {
    await ctx.click(GRPC.STREAM_ADD_QUEUE_BTN);
    await ctx.delay(160);
  }
}

/**
 * Queue the three client stream demo messages if the pending panel is empty.
 * Idempotent — skips if items are already queued.
 */
export async function ensureClientStreamQueued(ctx: DemoActionContext): Promise<void> {
  await ensureStreamingMethodSelected(ctx, 'ClientStream');

  // Skip if messages are already queued.
  if (document.querySelector(GRPC.STREAM_PENDING_ITEM(0))) return;

  for (const msg of CLIENT_STREAM_QUEUE_MESSAGES) {
    await queueClientStreamMessage(ctx, msg);
  }

  await ctx.waitFor(GRPC.STREAM_PENDING_ITEM(0), 5_000);
  await ctx.delay(120);
}

/**
 * Start the bidi stream and send two interleaved messages.
 * The stream must not already be active — check STREAM_CANCEL_BTN before calling.
 */
export async function startAndExchangeBidiStream(ctx: DemoActionContext): Promise<void> {
  await ensureStreamingMethodSelected(ctx, 'BidiStream');

  // Start the stream if not already active.
  const startBtn = document.querySelector<HTMLButtonElement>(GRPC.STREAM_START_BTN);
  if (startBtn && !startBtn.disabled) {
    await ctx.click(GRPC.STREAM_START_BTN);
    await ctx.delay(200);
  }

  // Wait for stream to be active (Start btn transitions to Cancel btn).
  try {
    await ctx.waitFor(GRPC.STREAM_CANCEL_BTN, 6_000);
  } catch {
    // Stream may already be open on retry.
  }

  // Send first message.
  const messageInput = document.querySelector<HTMLInputElement>(GRPC.PROTO_FIELD_INPUT('message'));
  if (messageInput) {
    await ctx.fill(GRPC.PROTO_FIELD_INPUT('message'), 'bidi-hello');
    await ctx.delay(120);
  }
  const sendBtn = document.querySelector<HTMLButtonElement>(GRPC.STREAM_SEND_MESSAGE_BTN);
  if (sendBtn && !sendBtn.disabled) {
    await ctx.click(GRPC.STREAM_SEND_MESSAGE_BTN);
    await ctx.delay(220);
  }

  // Send second message.
  if (messageInput) {
    await ctx.fill(GRPC.PROTO_FIELD_INPUT('message'), 'bidi-world');
    await ctx.delay(120);
  }
  if (sendBtn && !sendBtn.disabled) {
    await ctx.click(GRPC.STREAM_SEND_MESSAGE_BTN);
    await ctx.delay(180);
  }

  try {
    await ctx.waitFor(GRPC.STREAM_LOG_LIST, 5_000);
  } catch {
    // Log may populate asynchronously.
  }
}

/**
 * Close all non-active gRPC tabs and keep the currently active one.
 * This is safer for demo isolation sessions where the active tab is the
 * temporary demo tab and user tabs should remain untouched unless explicitly
 * cleaned by the isolation lifecycle.
 */
export async function closeExtraGrpcTabsQuiet(ctx: DemoActionContext): Promise<void> {
  await ensureGrpcStudioSubNavQuiet(ctx);
  const tabBar = document.querySelector<HTMLElement>(GRPC.TAB_BAR);
  if (!tabBar) return;
  const tabEls = Array.from(tabBar.querySelectorAll<HTMLElement>('[role="tab"]'));
  const activeTab = tabEls.find((tabEl) => tabEl.getAttribute('aria-selected') === 'true') ?? tabEls[0] ?? null;
  const activeTabId = activeTab?.getAttribute('data-testid') ?? null;

  // Close all tabs except the active tab, in reverse order so indices stay stable.
  for (const tabEl of tabEls.slice().reverse()) {
    const tabId = tabEl.getAttribute('data-testid');
    if (!tabId || tabId === activeTabId) continue;
    const closeBtn = document.querySelector<HTMLButtonElement>(`[data-testid="grpc-tab-close-${tabId}"]`);
    if (closeBtn && !closeBtn.disabled) {
      closeBtn.click();
      await ctx.delay(120);
    }
  }

  // Keep active focus on the preserved tab when possible.
  const preservedTab = activeTabId
    ? tabBar.querySelector<HTMLElement>(`[role="tab"][data-testid="${activeTabId}"]`)
    : tabBar.querySelector<HTMLElement>('[role="tab"]');
  if (preservedTab && preservedTab.getAttribute('aria-selected') !== 'true') {
    preservedTab.click();
    await ctx.delay(100);
  }
}

export async function grpcFirstCallSetup(ctx: DemoActionContext): Promise<void> {
  resetGrpcLessonSessionFlags();
  await navigateToGrpcStudio(ctx);
  await closeGrpcSettingsDrawerQuiet(ctx);
  await ensureGrpcStudioSubNavQuiet(ctx);
  await normalizeGrpcDemoTabsQuiet(ctx);
  try {
    const { purgeGrpcDemoEphemeralStorage } = await import('../grpc-demo-storage-cleanup');
    await purgeGrpcDemoEphemeralStorage();
  } catch {
    // Best-effort hygiene only.
  }
  await resetGrpcManageSchemasDraftsQuiet(ctx);
  await clearGrpcSchemaDriftQuiet(ctx);
  // Always start with auth = none and TLS = plaintext regardless of previous session state.
  await resetGrpcConnectionSettingsQuiet(ctx);
}

export async function grpcFirstCallCleanup(ctx: DemoActionContext): Promise<void> {
  resetGrpcLessonSessionFlags();
  await normalizeGrpcDemoTabsQuiet(ctx);
  await resetGrpcManageSchemasDraftsQuiet(ctx);
  await clearGrpcSchemaDriftQuiet(ctx);
  await resetGrpcConnectionSettingsQuiet(ctx);
  await ensureGrpcStudioSubNavQuiet(ctx);
  await closeGrpcSettingsDrawerQuiet(ctx);
  try {
    await purgeGrpcDemoCallHistory();
  } catch {
    // Best-effort — do not block demo teardown on storage drift.
  }
}
