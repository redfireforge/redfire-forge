/**
 * Lesson GRPC-21: Environments, Collections & History
 *
 * Thin barrel — helpers, concept, and steps live in sibling modules.
 */
import {
  buildGrpcLessonShellFromRoster,
  buildGrpcContractMetaFromRoster,
  getGrpcLessonRosterEntry,
  type GrpcDemoLesson,
} from './grpc-lesson-contract';
import {
  clearGrpcCallHistory,
  purgeEmptyGrpcDemoCollectionsByName,
  purgeGrpcDemoSavedRequests,
  resetSettingsMicroserviceProtocols,
} from '../../adapters';
import {
  GRPC_DEMO_ENV_NAME,
  GRPC_DEMO_SVC_NAME,
  ensureDemoEnvironment,
  ensureDemoMicroservice,
  expandNamedMicroservice,
  navigateToEnvironmentManager,
} from '../env-manager-lesson-helpers';
import { grpcEnvCollectionsConcept } from './grpc-env-collections-concept';
import { grpcEnvCollectionsSteps } from './grpc-env-collections-steps';
import { DEMO_COLLECTION_NAME } from './grpc-env-collections-helpers';

const GRPC21_ROSTER = getGrpcLessonRosterEntry('grpc-env-collections')!;

export const grpcEnvCollectionsLesson: GrpcDemoLesson = {
  ...buildGrpcLessonShellFromRoster(GRPC21_ROSTER),
  domainId: 'protocols',
  category: 'grpc',
  // Step 1 is Environments — never create/rename a Studio "demo" tab on boot.
  skipStudioTabIsolation: true,
  description:
    'Use `{{grpcHost}}` to drive the target address from the active environment, inject custom ' +
    'variables into metadata and request body, save calls to a named collection folder, and replay ' +
    'from History with one click. Export the collection to JSON for sharing across machines.',
  grpc: buildGrpcContractMetaFromRoster(GRPC21_ROSTER),
  concept: grpcEnvCollectionsConcept,
  setup: async (ctx) => {
    // Keep startup focused on Environment Manager (Step 1 surface) and avoid
    // bouncing through Studio/Collections/History during lesson boot.
    await clearGrpcCallHistory();
    await purgeGrpcDemoSavedRequests();
    await purgeEmptyGrpcDemoCollectionsByName([DEMO_COLLECTION_NAME, 'Saved Requests']);
    await ensureDemoEnvironment(ctx, GRPC_DEMO_ENV_NAME);
    await ensureDemoMicroservice(ctx, GRPC_DEMO_SVC_NAME);
    // Bridge wipe — not DOM × clicks. Prior runs leave gRPC tab + {{grpcHost}}
    // + protocol vars; remove buttons are display:none until hover/active so
    // ensureProtocolDisabled often no-ops and step 1 looks "already configured".
    resetSettingsMicroserviceProtocols(GRPC_DEMO_SVC_NAME, {
      clearProtocols: true,
      clearGlobalVars: true,
    });
    await navigateToEnvironmentManager(ctx);
    await expandNamedMicroservice(ctx, GRPC_DEMO_SVC_NAME);
    // Let React commit the empty protocol panel before Reading starts.
    await ctx.delay(80);
  },
  cleanup: async (_ctx) => {
    // Non-visual cleanup to avoid noisy close transitions.
    await clearGrpcCallHistory();
    await purgeGrpcDemoSavedRequests();
    await purgeEmptyGrpcDemoCollectionsByName([DEMO_COLLECTION_NAME, 'Saved Requests']);
    resetSettingsMicroserviceProtocols(GRPC_DEMO_SVC_NAME, {
      clearProtocols: true,
      clearGlobalVars: true,
    });
  },
  steps: grpcEnvCollectionsSteps,
};
