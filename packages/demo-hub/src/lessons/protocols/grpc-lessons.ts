/** gRPC Studio demo lesson registry (Phase 12A). */
import { shippedGrpcLessonRosterEntries } from './grpc-lesson-contract';
import { grpcFirstCallLesson } from './grpc-first-call';

export { grpcFirstCallLesson };

export const grpcLessons = [
  grpcFirstCallLesson, // GRPC-1
] as const;

export function shippedGrpcLessonCount(): number {
  return shippedGrpcLessonRosterEntries().length;
}
