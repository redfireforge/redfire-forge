/**
 * Lesson GRPC-5: TLS, mTLS & Certificate Configuration
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
  grpcFirstCallCleanup,
  grpcFirstCallSetup,
} from './grpc-lesson-helpers';
import { grpcTlsConcept } from './grpc-tls-concept';
import {
  fillTargetQuiet,
  resetTlsToPlaintextQuiet,
} from './grpc-tls-helpers';
import { grpcTlsSteps } from './grpc-tls-steps';

const GRPC5_ROSTER = getGrpcLessonRosterEntry('grpc-tls')!;

export const grpcTlsLesson: GrpcDemoLesson = {
  ...buildGrpcLessonShellFromRoster(GRPC5_ROSTER),
  domainId: 'protocols',
  category: 'grpc',
  description:
    'Connect to TLS-protected gRPC servers, configure mutual TLS with client certificates, ' +
    'validate the handshake locally, and learn how RedfireForge keeps PEM material in a session vault.',

  setup: (ctx) => grpcFirstCallSetup(ctx, { resetSchemaDrafts: false }),
  cleanup: async (ctx) => {
    await resetTlsToPlaintextQuiet(ctx);
    await fillTargetQuiet(ctx, GRPC_DEMO_TARGET);
    await grpcFirstCallCleanup(ctx);
  },

  grpc: buildGrpcContractMetaFromRoster(GRPC5_ROSTER),
  concept: grpcTlsConcept,
  steps: grpcTlsSteps,
};
