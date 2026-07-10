/**
 * Lesson GRPC-16: Schema Discovery — Reflection & Proto Import
 *
 * Thin barrel — helpers, concept, and steps live in sibling modules.
 */
import {
  buildGrpcLessonShellFromRoster,
  buildGrpcContractMetaFromRoster,
  getGrpcLessonRosterEntry,
  type GrpcDemoLesson,
} from './grpc-lesson-contract';
import { grpcFirstCallCleanup } from './grpc-lesson-helpers';
import { grpcSchemaDiscoveryConcept } from './grpc-schema-discovery-concept';
import { grpcSchemaDiscoverySetup } from './grpc-schema-discovery-helpers';
import { grpcSchemaDiscoverySteps } from './grpc-schema-discovery-steps';

const GRPCD_ROSTER = getGrpcLessonRosterEntry('grpc-schema-discovery')!;

export const grpcSchemaDiscoveryLesson: GrpcDemoLesson = {
  ...buildGrpcLessonShellFromRoster(GRPCD_ROSTER),
  domainId: 'protocols',
  category: 'grpc',
  description:
    'Learn the five descriptor sources in gRPC Studio — server reflection, Proto file upload, Protoset bundle, URL descriptor, and BSR — then use Schema Browser to explore types, copy a grpcurl command, and open a method in the call panel.',

  setup: grpcSchemaDiscoverySetup,
  cleanup: grpcFirstCallCleanup,
  grpc: buildGrpcContractMetaFromRoster(GRPCD_ROSTER),
  concept: grpcSchemaDiscoveryConcept,
  steps: grpcSchemaDiscoverySteps,
};
