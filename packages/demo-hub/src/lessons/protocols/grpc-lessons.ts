/** gRPC Studio demo lesson registry (Phase 12A). */
import { shippedGrpcLessonRosterEntries } from './grpc-lesson-contract';
import { grpcFirstCallLesson } from './grpc-first-call';
import { grpcSchemaDiscoveryLesson } from './grpc-schema-discovery';
import { grpcStreamingLesson } from './grpc-streaming';
import { grpcMetadataAuthLesson } from './grpc-metadata-auth';

export { grpcFirstCallLesson };
export { grpcSchemaDiscoveryLesson };
export { grpcStreamingLesson };
export { grpcMetadataAuthLesson };

export const grpcLessons = [
  grpcFirstCallLesson,       // GRPC-1
  grpcSchemaDiscoveryLesson, // GRPC-16 (consolidated Schema Discovery)
  grpcStreamingLesson,       // GRPC-17 (Streaming RPCs: All Four Patterns)
  grpcMetadataAuthLesson,    // GRPC-18 (Request Metadata & Authentication)
] as const;

export function shippedGrpcLessonCount(): number {
  return shippedGrpcLessonRosterEntries().length;
}
