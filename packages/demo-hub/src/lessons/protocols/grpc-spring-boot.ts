/**
 * Lesson GRPC-15: Spring Boot & Spring gRPC Integration
 *
 * Thin barrel — helpers, concept, and steps live in sibling modules.
 */
import {
  buildGrpcLessonShellFromRoster,
  buildGrpcContractMetaFromRoster,
  getGrpcLessonRosterEntry,
  type GrpcDemoLesson,
} from './grpc-lesson-contract';
import { upsertWorkspaceDefaults } from '../../adapters';
import {
  closeExtraGrpcTabsQuiet,
  grpcFirstCallCleanup,
  grpcFirstCallSetup,
} from './grpc-lesson-helpers';
import { grpcSpringBootConcept } from './grpc-spring-boot-concept';
import { resetSpringBaselineQuiet } from './grpc-spring-boot-helpers';
import { grpcSpringBootSteps } from './grpc-spring-boot-steps';

const GRPC15_ROSTER = getGrpcLessonRosterEntry('grpc-spring-boot')!;

export const grpcSpringBootLesson: GrpcDemoLesson = {
  ...buildGrpcLessonShellFromRoster(GRPC15_ROSTER),
  domainId: 'protocols',
  category: 'grpc',
  description:
    'Connect gRPC Studio to a real Spring Boot server two different ways: the standard Netty gRPC port ' +
    '(`net.devh`, `:9090`) over Express Proxy, and the same JVM\'s HTTP/1.1 servlet bridge (`:8081`) over ' +
    'the Spring Servlet transport. Along the way: reflection that works with zero `application.yml` config, ' +
    'the standard gRPC Health Check protocol, a bearer-token-gated RPC mirroring a Spring Security ' +
    'interceptor, and environment-variable interpolation in the target field.',
  setup: async (ctx) => {
    await grpcFirstCallSetup(ctx);
    await resetSpringBaselineQuiet(ctx);
  },
  cleanup: async (ctx) => {
    upsertWorkspaceDefaults({ grpcHost: '' });
    await closeExtraGrpcTabsQuiet(ctx);
    await resetSpringBaselineQuiet(ctx);
    await grpcFirstCallCleanup(ctx);
  },
  grpc: buildGrpcContractMetaFromRoster(GRPC15_ROSTER),
  concept: grpcSpringBootConcept,
  steps: grpcSpringBootSteps,
};
