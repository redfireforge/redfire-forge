/**
 * GRPC-13 Mock Server lesson — combined step list.
 */
import type { GrpcDemoLesson } from './grpc-lesson-contract';
import { grpcMockServerBuilderSteps } from './grpc-mock-server-steps-builder';
import { grpcMockServerRuntimeSteps } from './grpc-mock-server-steps-runtime';

type DemoStep = GrpcDemoLesson['steps'][number];

export const grpcMockServerSteps: DemoStep[] = [
  ...grpcMockServerBuilderSteps,
  ...grpcMockServerRuntimeSteps,
];
