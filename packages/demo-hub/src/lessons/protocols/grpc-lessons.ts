/** gRPC Studio demo lesson registry (Phase 12A). */
import { shippedGrpcLessonRosterEntries } from './grpc-lesson-contract';
import { grpcFirstCallLesson } from './grpc-first-call';
import { grpcSchemaDiscoveryLesson } from './grpc-schema-discovery';
import { grpcStreamingLesson } from './grpc-streaming';
import { grpcMetadataAuthLesson } from './grpc-metadata-auth';
import { grpcTlsLesson } from './grpc-tls';
import { grpcTransportModesLesson } from './grpc-transport-modes';
import { grpcSpringBootLesson } from './grpc-spring-boot';
import { grpcProtoFormLesson } from './grpc-proto-form';
import { grpcEnvCollectionsLesson } from './grpc-env-collections';

export { grpcFirstCallLesson };
export { grpcSchemaDiscoveryLesson };
export { grpcStreamingLesson };
export { grpcMetadataAuthLesson };
export { grpcTlsLesson };
export { grpcTransportModesLesson };
export { grpcSpringBootLesson };
export { grpcProtoFormLesson };
export { grpcEnvCollectionsLesson };

export const grpcLessons = [
  grpcFirstCallLesson,          // GRPC-1
  grpcSchemaDiscoveryLesson,    // GRPC-16 (consolidated Schema Discovery)
  grpcStreamingLesson,          // GRPC-17 (Streaming RPCs: All Four Patterns)
  grpcMetadataAuthLesson,       // GRPC-18 (Request Metadata & Authentication)
  grpcTlsLesson,                // GRPC-5  (TLS, mTLS & Certificate Configuration)
  grpcTransportModesLesson,     // GRPC-19 (Transport Modes: Express, gRPC-Web & Spring Servlet)
  grpcSpringBootLesson,         // GRPC-15 (Spring Boot & Spring gRPC Integration)
  grpcProtoFormLesson,          // GRPC-20 (Proto Form Builder: Schema-Driven Request Editing)
  grpcEnvCollectionsLesson,     // GRPC-21 (Environments, Collections & History)
] as const;

export function shippedGrpcLessonCount(): number {
  return shippedGrpcLessonRosterEntries().length;
}
