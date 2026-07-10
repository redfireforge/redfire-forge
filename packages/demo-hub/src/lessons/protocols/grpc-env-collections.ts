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
  GRPC_DEMO_TARGET,
  ensureEchoMethodSelected,
  grpcFirstCallCleanup,
  grpcFirstCallSetup,
  setGrpcTargetQuiet,
} from './grpc-lesson-helpers';
import { grpcEnvCollectionsConcept } from './grpc-env-collections-concept';
import { clearWorkspaceDefaults } from './grpc-env-collections-helpers';
import { grpcEnvCollectionsSteps } from './grpc-env-collections-steps';

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
    await grpcFirstCallSetup(ctx);
    await ensureEchoMethodSelected(ctx);
  },
  cleanup: async (ctx) => {
    await setGrpcTargetQuiet(ctx, GRPC_DEMO_TARGET);
    clearWorkspaceDefaults();
    await grpcFirstCallCleanup(ctx);
  },
  steps: grpcEnvCollectionsSteps,
};
