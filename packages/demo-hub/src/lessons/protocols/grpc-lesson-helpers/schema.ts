import type { DemoActionContext } from '../../../types';
import { resetGrpcManageSchemasDraftsViaBridge } from '../../../adapters';
import { GRPC } from '@shared/selectors';
import { GRPC_ECHO_METHOD_SEL } from './constants';
import { setInputValueAndDispatch } from './dom';
import { ensureGrpcStudioSubNavQuiet } from './navigation';

const MANAGE_SCHEMAS_CLOAK_STYLE_ID = 'demo-hub-cloak-grpc-manage-schemas';

/**
 * Hide Manage Schemas chrome while quiet setup mutates it — prevents step-1 flash.
 * Keeps elements queryable in the DOM (visibility:hidden, not display:none).
 */
function cloakManageSchemasUi(): () => void {
  if (document.getElementById(MANAGE_SCHEMAS_CLOAK_STYLE_ID)) {
    return () => undefined;
  }
  const style = document.createElement('style');
  style.id = MANAGE_SCHEMAS_CLOAK_STYLE_ID;
  style.textContent = `
    [data-testid="grpc-proto-manage-modal"],
    [data-testid="grpc-modal-overlay"] {
      visibility: hidden !important;
      opacity: 0 !important;
      pointer-events: none !important;
    }
  `;
  document.head.appendChild(style);
  return () => {
    style.remove();
  };
}

/**
 * Clear URL + BSR draft fields while Manage Schemas is open.
 * Leaves the modal open and switches back to the Proto Files tab.
 */
export async function clearGrpcManageSchemasUrlBsrDraftsQuiet(
  ctx: DemoActionContext,
): Promise<void> {
  const modal = document.querySelector<HTMLElement>(GRPC.PROTO_MANAGE_MODAL);
  if (!modal) return;

  const urlTab = modal.querySelector<HTMLElement>(GRPC.PROTO_TAB_URL);
  urlTab?.click();
  await ctx.delay(80);
  const urlInput = modal.querySelector<HTMLInputElement>(GRPC.PROTO_URL_INPUT);
  if (urlInput && urlInput.value) {
    setInputValueAndDispatch(urlInput, '');
  }

  const bsrTab = modal.querySelector<HTMLElement>(GRPC.PROTO_TAB_BSR);
  bsrTab?.click();
  await ctx.delay(80);
  const bsrModuleInput = modal.querySelector<HTMLInputElement>(GRPC.PROTO_BSR_MODULE_INPUT);
  const bsrVersionInput = modal.querySelector<HTMLInputElement>(GRPC.PROTO_BSR_VERSION_INPUT);
  const bsrTokenInput = modal.querySelector<HTMLInputElement>(GRPC.PROTO_BSR_TOKEN_INPUT);
  if (bsrModuleInput && bsrModuleInput.value) setInputValueAndDispatch(bsrModuleInput, '');
  if (bsrVersionInput && bsrVersionInput.value) setInputValueAndDispatch(bsrVersionInput, '');
  if (bsrTokenInput && bsrTokenInput.value) setInputValueAndDispatch(bsrTokenInput, '');

  const protoTab = modal.querySelector<HTMLElement>(GRPC.PROTO_TAB_PROTO_FILES);
  protoTab?.click();
  await ctx.delay(100);
}

/**
 * Best-effort cleanup for persisted Manage Schemas drafts.
 * Clears staged proto/protoset/url/bsr inputs so lessons start from a deterministic baseline.
 * Prefers the React bridge (no modal). DOM path is cloaked so viewers never see the flash.
 */
export async function resetGrpcManageSchemasDraftsQuiet(ctx: DemoActionContext): Promise<void> {
  // Preferred: wipe draft state in React without opening Manage Schemas.
  if (resetGrpcManageSchemasDraftsViaBridge()) {
    if (document.querySelector(GRPC.PROTO_MANAGE_MODAL)) {
      const uncloak = cloakManageSchemasUi();
      try {
        const cancelBtn = document.querySelector<HTMLButtonElement>(GRPC.PROTO_CANCEL_BTN);
        if (cancelBtn && !cancelBtn.disabled) {
          cancelBtn.click();
          await ctx.delay(120);
        }
        if (document.querySelector(GRPC.PROTO_MANAGE_MODAL)) {
          document.querySelector<HTMLElement>('[data-testid="grpc-modal-overlay"]')?.click();
          await ctx.delay(80);
        }
      } finally {
        uncloak();
      }
    }
    return;
  }

  const uncloak = cloakManageSchemasUi();
  try {
    await resetGrpcManageSchemasDraftsViaDom(ctx);
  } finally {
    uncloak();
  }
}

/** DOM fallback when the demo bridge is unavailable (cloaked by caller). */
async function resetGrpcManageSchemasDraftsViaDom(ctx: DemoActionContext): Promise<void> {
  // If the modal is already open, clear drafts in place then close.
  // (Previously we cancelled and returned — which left BSR/URL values in React state.)
  if (document.querySelector(GRPC.PROTO_MANAGE_MODAL)) {
    await clearGrpcManageSchemasUrlBsrDraftsQuiet(ctx);
    const cancelBtn = document.querySelector<HTMLButtonElement>(GRPC.PROTO_CANCEL_BTN);
    if (cancelBtn && !cancelBtn.disabled) {
      cancelBtn.click();
      await ctx.delay(200);
    }
    if (document.querySelector(GRPC.PROTO_MANAGE_MODAL)) {
      const overlay = document.querySelector<HTMLElement>('[data-testid="grpc-modal-overlay"]');
      overlay?.click();
      await ctx.delay(150);
    }
    return;
  }

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
 * Best-effort drift reset for demo lessons.
 * Clears stale-method drift banners that can remain after source switching.
 */
export async function clearGrpcSchemaDriftQuiet(ctx: DemoActionContext): Promise<void> {
  // Drift banner only mounts on the Studio explorer. If we are on Advanced /
  // Collections / History and no banner is in the DOM, do NOT bounce to Studio
  // just to poll — that undoes quiet lands (e.g. Schema Diff / Mock server)
  // and flashes Studio before step 1 Reading.
  const studioSelected =
    document.querySelector(GRPC.SUB_NAV_STUDIO)?.getAttribute('aria-selected') === 'true';
  let banner: HTMLElement | null = document.querySelector<HTMLElement>(GRPC.SCHEMA_DRIFT_BANNER);
  if (!banner && !studioSelected) return;

  if (!studioSelected) {
    await ensureGrpcStudioSubNavQuiet(ctx);
  }
  // Drift state can be applied a short moment after source/method updates.
  // Fast-path: if banner is absent immediately, return without polling.
  // Only start the poll loop when a banner is present on first check.
  banner = document.querySelector<HTMLElement>(GRPC.SCHEMA_DRIFT_BANNER);
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
      let anyMethodBtn = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-testid^="grpc-method-"]'))
        .find((btn) => !btn.disabled);
      // Method buttons only render for *expanded* service nodes. A freshly loaded
      // source (e.g. Eliza via BSR) can have every service collapsed, leaving no
      // grpc-method-* button to click — and an Eliza blocking banner exposes no
      // rebind/dismiss/prune control, so it can never clear without a rebind. Expand
      // collapsed services first so a rebind target exists, then retry.
      if (!anyMethodBtn) {
        const collapsedServices = Array.from(
          document.querySelectorAll<HTMLButtonElement>('button.grpc-explorer-service-btn'),
        ).filter((btn) => !btn.classList.contains('grpc-explorer-service-btn--open'));
        for (const serviceBtn of collapsedServices) {
          serviceBtn.click();
          await ctx.delay(80);
        }
        if (collapsedServices.length > 0) {
          anyMethodBtn = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-testid^="grpc-method-"]'))
            .find((btn) => !btn.disabled);
        }
      }
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
