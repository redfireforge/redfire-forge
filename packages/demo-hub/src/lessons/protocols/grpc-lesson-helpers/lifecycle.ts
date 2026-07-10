import type { DemoActionContext } from '../../../types';
import {
  purgeGrpcDemoCallHistory,
  resetGrpcActiveTabRuntimeState,
} from '../../../adapters';
import { navigateToGrpcStudio } from '../../env-manager-lesson-helpers';
import { resetGrpcLessonSessionFlags } from './constants';
import { resetGrpcConnectionSettingsQuiet } from './connection';
import { ensureGrpcRequestFormTabQuiet } from './echoComposer';
import { closeGrpcSettingsDrawerQuiet, ensureGrpcStudioSubNavQuiet } from './navigation';
import { clearGrpcSchemaDriftQuiet, resetGrpcManageSchemasDraftsQuiet } from './schema';
import { normalizeGrpcDemoTabsQuiet } from './tabs';

export async function grpcFirstCallSetup(
  ctx: DemoActionContext,
  options?: { resetSchemaDrafts?: boolean },
): Promise<void> {
  resetGrpcLessonSessionFlags();
  await navigateToGrpcStudio(ctx);
  resetGrpcActiveTabRuntimeState();
  await closeGrpcSettingsDrawerQuiet(ctx);
  await ensureGrpcStudioSubNavQuiet(ctx);
  await normalizeGrpcDemoTabsQuiet(ctx);
  try {
    const { purgeGrpcDemoEphemeralStorage } = await import('../../grpc-demo-storage-cleanup');
    await purgeGrpcDemoEphemeralStorage();
  } catch {
    // Best-effort hygiene only.
  }
  if (options?.resetSchemaDrafts !== false) {
    await resetGrpcManageSchemasDraftsQuiet(ctx);
  }
  await clearGrpcSchemaDriftQuiet(ctx);
  // Always start with auth = none regardless of previous session state.
  await resetGrpcConnectionSettingsQuiet(ctx);
}

export async function grpcFirstCallCleanup(ctx: DemoActionContext): Promise<void> {
  resetGrpcLessonSessionFlags();
  await normalizeGrpcDemoTabsQuiet(ctx);
  // Reset composer to Form Input so the next lesson starts in a stable
  // request-editor state even when the previous lesson used JSON request mode.
  await ensureGrpcRequestFormTabQuiet(ctx);
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
