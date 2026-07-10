/**
 * Lesson GRPC-4: Request Metadata & Authentication
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
  closeGrpcSettingsDrawerQuiet,
  ensureGrpcStudioSubNavQuiet,
  grpcFirstCallCleanup,
  grpcFirstCallSetup,
} from './grpc-lesson-helpers';
import { navigateToGrpcStudio } from '../env-manager-lesson-helpers';
import { upsertWorkspaceDefaults } from '../../adapters';
import { grpcMetadataAuthConcept } from './grpc-metadata-auth-concept';
import {
  clearAllMetadataRowsQuiet,
  resetAuthToNoneQuiet,
  switchToFormTabQuiet,
} from './grpc-metadata-auth-helpers';
import { grpcMetadataAuthSteps } from './grpc-metadata-auth-steps';

const GRPC4_ROSTER = getGrpcLessonRosterEntry('grpc-metadata-auth')!;

export const grpcMetadataAuthLesson: GrpcDemoLesson = {
  ...buildGrpcLessonShellFromRoster(GRPC4_ROSTER),
  domainId: 'protocols',
  category: 'grpc',
  description:
    'Add custom request metadata headers, configure Bearer, Basic, and API Key auth, detect auth conflicts, ' +
    'try OAuth2 client-credentials flow, and interpolate environment variables in metadata values.',

  setup: grpcFirstCallSetup,
  cleanup: async (ctx) => {
    await grpcFirstCallCleanup(ctx);

    await navigateToGrpcStudio(ctx);
    await closeGrpcSettingsDrawerQuiet(ctx);
    await ensureGrpcStudioSubNavQuiet(ctx);
    await resetAuthToNoneQuiet(ctx);
    await clearAllMetadataRowsQuiet(ctx);
    await switchToFormTabQuiet(ctx);

    upsertWorkspaceDefaults({ authToken: '' });
  },

  grpc: buildGrpcContractMetaFromRoster(GRPC4_ROSTER),
  concept: grpcMetadataAuthConcept,
  steps: grpcMetadataAuthSteps,
};
