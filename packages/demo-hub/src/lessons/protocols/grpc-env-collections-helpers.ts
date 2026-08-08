/** GRPC-21 Environments & Collections — shared constants and quiet helpers */
import { GRPC } from '@shared/selectors';
import {
  GRPC_DEMO_TARGET,
  ensureEchoMessageFilled,
  ensureGrpcStudioSubNavQuiet,
  ensureUnaryExecuted,
  closeGrpcSettingsDrawerQuiet,
  setGrpcTargetQuiet,
} from './grpc-lesson-helpers';
import {
  navigateToGrpcStudio,
  navigateToEnvironmentManager,
  expandNamedMicroservice,
  ensureGrpcDemoEndpointConfigured,
  ensureGrpcDemoHeaderContext,
  GRPC_DEMO_SVC_NAME,
} from '../env-manager-lesson-helpers';
import type { DemoActionContext } from '../../types';

/**
 * Set to true after ensureCustomVarsSeeded succeeds so that subsequent
 * calls within the same lesson run skip the env manager navigation.
 * Reset by clearProtocolVarsQuiet (called in lesson setup/cleanup).
 */
let customVarsSeededThisRun = false;

/** Call after manually adding protocol vars in a step action to skip the next ensureCustomVarsSeeded nav. */
export function markCustomVarsSeeded(): void {
  customVarsSeededThisRun = true;
}

/** Live local fixture (Go echo Docker). */
export const LOCAL_GRPC_HOST = 'localhost:50051';
/** Unreachable "staging" address — shows interpolation without a live server. */
export const STAGING_GRPC_HOST = 'localhost:59999';

export const DEMO_REQUEST_ID = 'req-demo-001';
export const DEMO_USER_ID = 'user-42';
export const DEMO_MESSAGE = 'Hello from gRPC Studio';
export const DEMO_COLLECTION_NAME = 'Echo Demos';
export const DEMO_REQUEST_NAME = 'Echo — Hello World';
/** Variable token deliberately absent from the environment — triggers MISSING_TOKEN banner. */
export const UNKNOWN_VAR_TARGET = '{{_undefined_grpc_host_}}';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export async function ensureStudioNavQuiet(ctx: DemoActionContext): Promise<void> {
  await navigateToGrpcStudio(ctx);
  await closeGrpcSettingsDrawerQuiet(ctx);
  await ensureGrpcStudioSubNavQuiet(ctx);
}

/**
 * Remove requestId and userId protocol vars from the modal (if present) so the
 * lesson always starts from a clean slate. Opens the modal, deletes any existing
 * rows for the two known keys, saves, and closes.
 */
export async function clearProtocolVarsQuiet(ctx: DemoActionContext): Promise<void> {
  await navigateToEnvironmentManager(ctx);
  await expandNamedMicroservice(ctx, GRPC_DEMO_SVC_NAME);
  // No badge ⇒ no protocol vars UI (e.g. gRPC protocol removed in setup). Skip
  // so boot does not click a missing control / flash an empty modal.
  const badge = document.querySelector('[data-testid="protocol-vars-badge"]');
  if (!badge) {
    customVarsSeededThisRun = false;
    return;
  }
  const modalOpen = !!document.querySelector('[data-testid="protocol-vars-modal"]');
  if (!modalOpen) {
    await ctx.click('[data-testid="protocol-vars-badge"]');
    await ctx.delay(200);
  }
  if (!document.querySelector('[data-testid="protocol-vars-modal"]')) {
    customVarsSeededThisRun = false;
    return;
  }
  const rowSelectors = Array.from(document.querySelectorAll<HTMLElement>('[data-testid^="protocol-var-row-"]'));
  if (rowSelectors.length === 0) {
    // Nothing to clear — dismiss quietly.
    document.querySelector<HTMLButtonElement>('[data-testid="protocol-vars-close-btn"]')?.click();
    await ctx.delay(120);
    customVarsSeededThisRun = false;
    return;
  }
  for (let index = rowSelectors.length - 1; index >= 0; index -= 1) {
    const row = rowSelectors[index];
    const key = row?.getAttribute('data-testid')?.replace('protocol-var-row-', '') ?? '';
    if (!key) continue;
    const deleteBtn = document.querySelector<HTMLButtonElement>(`[data-testid="protocol-var-delete-${key}"]`);
    if (deleteBtn) {
      await ctx.click(`[data-testid="protocol-var-delete-${key}"]`);
      await ctx.delay(150);
    }
  }
  await ctx.click('[data-testid="protocol-vars-save-btn"]');
  await ctx.delay(200);
  customVarsSeededThisRun = false;
}

/**
 * Ensure the gRPC Demo microservice protocol variables (requestId, userId) are configured.
 * Navigates to the Environment Manager, expands the microservice, then seeds both
 * global Protocol vars in a single modal open/save pass (avoids double open/close).
 */
export async function ensureCustomVarsSeeded(ctx: DemoActionContext): Promise<void> {
  // Skip env manager navigation if vars were already seeded earlier in this lesson run.
  if (customVarsSeededThisRun) return;
  await navigateToEnvironmentManager(ctx);
  await expandNamedMicroservice(ctx, GRPC_DEMO_SVC_NAME);
  // Open the Protocol vars modal once for both keys.
  const modalOpen = !!document.querySelector('[data-testid="protocol-vars-modal"]');
  if (!modalOpen) {
    await ctx.click('[data-testid="protocol-vars-badge"]');
    await ctx.delay(200);
  }
  // Ensure requestId is present with the correct value.
  if (document.querySelector(`[data-testid="protocol-var-row-requestId"]`)) {
    const inp = document.querySelector<HTMLInputElement>('[data-testid="protocol-var-value-requestId"]');
    if (inp && inp.value !== DEMO_REQUEST_ID) {
      await ctx.fill('[data-testid="protocol-var-value-requestId"]', DEMO_REQUEST_ID);
      await ctx.delay(150);
    }
  } else {
    await ctx.fill('[data-testid="protocol-vars-key-input"]', 'requestId');
    await ctx.fill('[data-testid="protocol-vars-val-input"]', DEMO_REQUEST_ID);
    await ctx.click('[data-testid="protocol-vars-add-btn"]');
    await ctx.delay(200);
  }
  // Ensure userId is present with the correct value.
  if (document.querySelector(`[data-testid="protocol-var-row-userId"]`)) {
    const inp = document.querySelector<HTMLInputElement>('[data-testid="protocol-var-value-userId"]');
    if (inp && inp.value !== DEMO_USER_ID) {
      await ctx.fill('[data-testid="protocol-var-value-userId"]', DEMO_USER_ID);
      await ctx.delay(150);
    }
  } else {
    await ctx.fill('[data-testid="protocol-vars-key-input"]', 'userId');
    await ctx.fill('[data-testid="protocol-vars-val-input"]', DEMO_USER_ID);
    await ctx.click('[data-testid="protocol-vars-add-btn"]');
    await ctx.delay(200);
  }
  // Save and close in one shot.
  await ctx.click('[data-testid="protocol-vars-save-btn"]');
  await ctx.delay(250);
  customVarsSeededThisRun = true;
}

/**
 * Ensure target is {{grpcHost}} and preview strip is visible.
 * Used by several step preActions that build on the interpolation state.
 */
export async function ensureTemplateTargetQuiet(ctx: DemoActionContext): Promise<void> {
  await ensureGrpcDemoEndpointConfigured(ctx);
  await ensureCustomVarsSeeded(ctx);
  await ensureStudioNavQuiet(ctx);
  await ensureGrpcDemoHeaderContext(ctx);
  await setGrpcTargetQuiet(ctx, '{{grpcHost}}');
  // Wait up to 2 s for preview strip to mount after template change.
  try {
    await ctx.waitFor(GRPC.INTERPOLATION_PREVIEW_STRIP, 2_000);
  } catch {
    // Render may already be complete.
  }
}

/**
 * Like ensureTemplateTargetQuiet but skips the env manager navigation —
 * relies on header context already being available (env was visited earlier).
 */
export async function ensureTemplateTargetNoEnvNav(ctx: DemoActionContext): Promise<void> {
  await ensureGrpcDemoHeaderContext(ctx);
  await ensureCustomVarsSeeded(ctx);
  await ensureStudioNavQuiet(ctx);
  await setGrpcTargetQuiet(ctx, '{{grpcHost}}');
  try {
    await ctx.waitFor(GRPC.INTERPOLATION_PREVIEW_STRIP, 2_000);
  } catch { /* ok */ }
}

/** Ensure metadata has x-request-id row. */
export async function ensureMetadataRowQuiet(ctx: DemoActionContext): Promise<void> {
  await ensureTemplateTargetQuiet(ctx);
  // Navigate to Metadata tab silently.
  const metaTab = document.querySelector<HTMLButtonElement>(GRPC.REQUEST_TAB_METADATA);
  if (metaTab && metaTab.getAttribute('aria-pressed') !== 'true') {
    metaTab.click();
    await ctx.delay(300);
  }
  // Check if the x-request-id row already exists.
  const existingKey = Array.from(
    document.querySelectorAll<HTMLInputElement>('[aria-label^="Metadata key"]'),
  ).find((inp) => inp.value.trim() === 'x-request-id');
  if (existingKey) return;
  // Add a metadata row and fill it.
  const addBtn = document.querySelector<HTMLButtonElement>(GRPC.METADATA_ADD_BTN);
  if (addBtn) {
    addBtn.click();
    await ctx.delay(200);
  }
  const keyInput = document.querySelector<HTMLInputElement>('[aria-label="Metadata key 1"]');
  const valInput = document.querySelector<HTMLInputElement>('[aria-label="Metadata value 1"]');
  if (keyInput) {
    const nativeSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    nativeSet?.set?.call(keyInput, 'x-request-id');
    keyInput.dispatchEvent(new Event('input', { bubbles: true }));
  }
  if (valInput) {
    const nativeSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    nativeSet?.set?.call(valInput, '{{requestId}}');
    valInput.dispatchEvent(new Event('input', { bubbles: true }));
  }
  await ctx.delay(250);
}

/** Like ensureMetadataRowQuiet but skips env manager navigation. */
export async function ensureMetadataRowNoEnvNav(ctx: DemoActionContext): Promise<void> {
  await ensureTemplateTargetNoEnvNav(ctx);
  const metaTab = document.querySelector<HTMLButtonElement>(GRPC.REQUEST_TAB_METADATA);
  if (metaTab && metaTab.getAttribute('aria-pressed') !== 'true') {
    metaTab.click();
    await ctx.delay(300);
  }
  const existingKey = Array.from(
    document.querySelectorAll<HTMLInputElement>('[aria-label^="Metadata key"]'),
  ).find((inp) => inp.value.trim() === 'x-request-id');
  if (existingKey) return;
  const addBtn = document.querySelector<HTMLButtonElement>(GRPC.METADATA_ADD_BTN);
  if (addBtn) {
    addBtn.click();
    await ctx.delay(200);
  }
  const keyInput = document.querySelector<HTMLInputElement>('[aria-label="Metadata key 1"]');
  const valInput = document.querySelector<HTMLInputElement>('[aria-label="Metadata value 1"]');
  if (keyInput) {
    const nativeSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    nativeSet?.set?.call(keyInput, 'x-request-id');
    keyInput.dispatchEvent(new Event('input', { bubbles: true }));
  }
  if (valInput) {
    const nativeSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    nativeSet?.set?.call(valInput, '{{requestId}}');
    valInput.dispatchEvent(new Event('input', { bubbles: true }));
  }
  await ctx.delay(250);
}

/** Ensure a call has been executed and studio sub-nav is active. */
export async function ensureExecutedInStudioQuiet(ctx: DemoActionContext): Promise<void> {
  await ensureStudioNavQuiet(ctx);
  await ensureGrpcDemoHeaderContext(ctx);
  // Restore target to direct address so the send button is not blocked by a missing token.
  await setGrpcTargetQuiet(ctx, GRPC_DEMO_TARGET);
  await ctx.waitFor(GRPC.TARGET_INPUT, 5_000);
  await ensureEchoMessageFilled(ctx, DEMO_MESSAGE);
  await ensureUnaryExecuted(ctx, DEMO_MESSAGE);
}

/**
 * Delete all saved requests from the demo collection so the lesson always starts clean.
 * Expands every collection group before deleting so saved items are in the DOM.
 */
export async function clearDemoCollectionQuiet(ctx: DemoActionContext): Promise<void> {
  await navigateToGrpcStudio(ctx);
  const collBtn = document.querySelector<HTMLElement>(GRPC.SUB_NAV_COLLECTIONS);
  if (collBtn) {
    collBtn.click();
    await ctx.delay(400);
  }
  // Wait up to 3s for the collections tree; if absent there is nothing to clean.
  try { await ctx.waitFor(GRPC.COLLECTIONS_TREE, 3_000); } catch { return; }

  // Expand every collapsed collection group so saved items are rendered in the DOM.
  const expandAllGroups = () => {
    document.querySelectorAll<HTMLButtonElement>('.grpc-collection-group__header').forEach((header) => {
      if (header.getAttribute('aria-expanded') !== 'true') header.click();
    });
  };
  expandAllGroups();
  await ctx.delay(300);

  // Delete every saved item one at a time until none remain.
  for (let i = 0; i < 40; i++) {
    // Re-expand groups in case re-render collapsed them.
    expandAllGroups();
    await ctx.delay(100);
    const item = document.querySelector<HTMLElement>('[data-testid^="grpc-collection-saved-"]');
    if (!item) break;
    item.click();
    await ctx.delay(300);
    const deleteBtn = document.querySelector<HTMLButtonElement>(GRPC.SAVED_REQUEST_DELETE);
    if (!deleteBtn) { await ctx.delay(200); continue; }
    deleteBtn.click();
    // Wait for the item to disappear from the DOM before attempting the next deletion.
    const t0 = Date.now();
    while (Date.now() - t0 < 1_500) {
      if (!document.contains(item)) break;
      await ctx.delay(100);
    }
    await ctx.delay(100);
  }
}

/**
 * Clear all gRPC call history entries so the lesson always starts with a clean log.
 */
export async function clearGrpcHistoryQuiet(ctx: DemoActionContext): Promise<void> {
  await navigateToGrpcStudio(ctx);
  const histBtn = document.querySelector<HTMLElement>(GRPC.SUB_NAV_HISTORY);
  if (histBtn) {
    histBtn.click();
    await ctx.delay(400);
  }
  try { await ctx.waitFor(GRPC.HISTORY_PANEL, 2_000); } catch { return; }
  const clearBtn = document.querySelector<HTMLButtonElement>(GRPC.HISTORY_CLEAR_ALL);
  if (!clearBtn) return;
  clearBtn.click();
  await ctx.delay(400);
}
