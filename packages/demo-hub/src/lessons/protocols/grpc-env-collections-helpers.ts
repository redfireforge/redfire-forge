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
 * Ensure the gRPC Demo microservice protocol variables (requestId, userId) are configured.
 * Navigates to the Environment Manager, expands the microservice, then seeds both
 * global Protocol vars in a single modal open/save pass (avoids double open/close).
 */
export async function ensureCustomVarsSeeded(ctx: DemoActionContext): Promise<void> {
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
