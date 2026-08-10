/**
 * Playwright global setup — starts Docker infrastructure for E2E tests.
 *
 * E2E_WITH_DOCKER=1      → all stacks (Kafka, Schema Registry, WebSocket, GraphQL, gRPC)
 * E2E_GRAPHQL_SERVER=1  → GraphQL test server only (port 4010)
 * E2E_GRPC_SERVER=1     → gRPC echo test server only (ports 50051/50052)
 * E2E_WS_SERVER=1       → WebSocket protocol servers only (3100 / 4100 / 15674)
 * E2E_GQL5_DOCKER=1     → GQL-5 matrix: plain GraphQL (4010) + TLS (4444) + mTLS (4446)
 */

import {
  ensureDockerInfrastructure,
  ensureGql5DockerInfrastructure,
  ensureGrpcTestServerInfrastructure,
  ensureWsDockerInfrastructure,
} from './docker-infra';

export default async function globalSetup(): Promise<void> {
  const fullDocker = process.env.E2E_WITH_DOCKER === '1';
  const graphqlOnly = process.env.E2E_GRAPHQL_SERVER === '1';
  const grpcOnly = process.env.E2E_GRPC_SERVER === '1';
  const wsOnly = process.env.E2E_WS_SERVER === '1';
  const gql5Docker = process.env.E2E_GQL5_DOCKER === '1';

  if (!fullDocker && !graphqlOnly && !grpcOnly && !wsOnly && !gql5Docker) {
    console.log(
      '[global-setup] Skipping Docker startup (set E2E_WITH_DOCKER=1, E2E_GRAPHQL_SERVER=1, E2E_GRPC_SERVER=1, E2E_WS_SERVER=1, or E2E_GQL5_DOCKER=1)',
    );
    return;
  }

  if (gql5Docker) {
    await ensureGql5DockerInfrastructure();
    return;
  }

  if (wsOnly && !fullDocker) {
    await ensureWsDockerInfrastructure();
    return;
  }

  if (grpcOnly && !fullDocker && !graphqlOnly) {
    await ensureGrpcTestServerInfrastructure();
    return;
  }

  await ensureDockerInfrastructure(fullDocker);
}
