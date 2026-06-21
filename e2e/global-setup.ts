/**
 * Playwright global setup — starts Docker infrastructure for E2E tests.
 *
 * E2E_WITH_DOCKER=1      → all stacks (Kafka, Schema Registry, WebSocket, GraphQL)
 * E2E_GRAPHQL_SERVER=1  → GraphQL test server only (port 4010)
 */

import { ensureDockerInfrastructure } from './docker-infra';

export default async function globalSetup(): Promise<void> {
  const fullDocker = process.env.E2E_WITH_DOCKER === '1';
  const graphqlOnly = process.env.E2E_GRAPHQL_SERVER === '1';

  if (!fullDocker && !graphqlOnly) {
    console.log(
      '[global-setup] Skipping Docker startup (set E2E_WITH_DOCKER=1 or E2E_GRAPHQL_SERVER=1 to enable)',
    );
    return;
  }

  await ensureDockerInfrastructure(fullDocker);
}
