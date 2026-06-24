/**
 * Playwright global setup — starts Docker infrastructure for E2E tests.
 *
 * E2E_WITH_DOCKER=1      → all stacks (Kafka, Schema Registry, WebSocket, GraphQL)
 * E2E_GRAPHQL_SERVER=1  → GraphQL test server only (port 4010)
 * E2E_GQL5_DOCKER=1     → GQL-5 matrix: plain GraphQL (4010) + TLS (4444) + mTLS (4446)
 */

import { ensureDockerInfrastructure, ensureGql5DockerInfrastructure } from './docker-infra';

export default async function globalSetup(): Promise<void> {
  const fullDocker = process.env.E2E_WITH_DOCKER === '1';
  const graphqlOnly = process.env.E2E_GRAPHQL_SERVER === '1';
  const gql5Docker = process.env.E2E_GQL5_DOCKER === '1';

  if (!fullDocker && !graphqlOnly && !gql5Docker) {
    console.log(
      '[global-setup] Skipping Docker startup (set E2E_WITH_DOCKER=1, E2E_GRAPHQL_SERVER=1, or E2E_GQL5_DOCKER=1)',
    );
    return;
  }

  if (gql5Docker) {
    await ensureGql5DockerInfrastructure();
    return;
  }

  await ensureDockerInfrastructure(fullDocker);
}
