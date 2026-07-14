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
} from '../../adapters';
import {
  GRPC_DEMO_ENV_NAME,
  GRPC_DEMO_SVC_NAME,
  ensureDemoEnvironment,
  ensureDemoMicroservice,
  expandNamedMicroservice,
  navigateToEnvironmentManager,
  ensureProtocolDisabled,
} from '../env-manager-lesson-helpers';
import { grpcEnvCollectionsConcept } from './grpc-env-collections-concept';
import { grpcEnvCollectionsSteps } from './grpc-env-collections-steps';
import { DEMO_COLLECTION_NAME } from './grpc-env-collections-helpers';

const GRPC21_ROSTER = getGrpcLessonRosterEntry('grpc-env-collections')!;

export const grpcEnvCollectionsLesson: GrpcDemoLesson = {
  ...buildGrpcLessonShellFromRoster(GRPC21_ROSTER),
  domainId: 'protocols',
  category: 'grpc',
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
    await navigateToEnvironmentManager(ctx);
    await expandNamedMicroservice(ctx, GRPC_DEMO_SVC_NAME);
    await ensureProtocolDisabled(ctx, 'http');
    await ensureProtocolDisabled(ctx, 'websocket');
    await ensureProtocolDisabled(ctx, 'sse');
    await ensureProtocolDisabled(ctx, 'graphql');
    await ensureProtocolDisabled(ctx, 'grpc');
  },
  cleanup: async (_ctx) => {
    // Non-visual cleanup to avoid noisy close transitions.
    await clearGrpcCallHistory();
    await purgeGrpcDemoSavedRequests();
    await purgeEmptyGrpcDemoCollectionsByName([DEMO_COLLECTION_NAME, 'Saved Requests']);
  },
  steps: grpcEnvCollectionsSteps,
};
