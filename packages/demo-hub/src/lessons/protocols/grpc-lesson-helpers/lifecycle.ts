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
  // NOTE: do NOT reset Manage Schemas drafts here. gRPC lessons run on an
  // isolated "demo" tab that is closed on teardown, so any staged proto/protoset/
  // url/bsr drafts are discarded per-tab automatically. Driving the modal reset
  // in cleanup is redundant, touches the user's real tabs, and — because it opens
  // the Manage Schemas modal for every tab and cycles its sub-tabs — flashes a
  // burst of modals on and off (visible at lesson start/restart, e.g. the
  // Metadata & Auth lesson which never touches schemas). Lessons that genuinely
  // need a clean draft baseline still reset it in their own setup (default
  // resetSchemaDrafts !== false).
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
