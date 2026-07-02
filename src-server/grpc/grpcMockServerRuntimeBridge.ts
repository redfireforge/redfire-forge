/**
 * Phase 11M — server-side mock runtime registry (tab-scoped managers for network listener).
 */
import {
  createGrpcMockRuntimeRegistry,
  type GrpcMockRuntimeRegistry,
} from '../../src/shared/grpc/grpcMockRuntimeRegistry.js';

let serverMockRegistry: GrpcMockRuntimeRegistry | undefined;

export function getServerGrpcMockRuntimeRegistry(): GrpcMockRuntimeRegistry {
  if (serverMockRegistry == null) {
    serverMockRegistry = createGrpcMockRuntimeRegistry();
  }
  return serverMockRegistry;
}

export function resetServerGrpcMockRuntimeRegistryForTests(): void {
  serverMockRegistry = undefined;
}
