/**
 * Playwright global setup — starts Docker infrastructure for E2E tests.
 *
 * Currently manages the GraphQL test server (task 4F-11):
 *   docker/graphql/docker-compose.yml → graphql-test-server on port 4010
 *
 * Activated when either env var is set:
 *   E2E_WITH_DOCKER=1      — full Docker project (kafka, websocket, graphql, …)
 *   E2E_GRAPHQL_SERVER=1  — GraphQL test server only (lighter weight)
 *
 * Skips silently when neither is set (standard chromium project runs).
 */

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const GRAPHQL_COMPOSE_DIR = path.resolve(__dirname, '../docker/graphql');
const GRAPHQL_HEALTH_URL = 'http://localhost:4010/health';

const MAX_WAIT_MS = 90_000;
const POLL_INTERVAL_MS = 1_000;

function shouldStartDocker(): boolean {
  return process.env.E2E_WITH_DOCKER === '1' || process.env.E2E_GRAPHQL_SERVER === '1';
}

async function isGraphqlServerHealthy(): Promise<boolean> {
  try {
    const resp = await fetch(GRAPHQL_HEALTH_URL, { signal: AbortSignal.timeout(3_000) });
    if (!resp.ok) return false;
    const body = (await resp.json()) as { status?: string };
    return body.status === 'ok';
  } catch {
    return false;
  }
}

async function waitForGraphqlHealth(): Promise<void> {
  const deadline = Date.now() + MAX_WAIT_MS;
  while (Date.now() < deadline) {
    if (await isGraphqlServerHealthy()) {
      console.log('[global-setup] GraphQL test server is healthy at', GRAPHQL_HEALTH_URL);
      return;
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error(
    `GraphQL test server did not become healthy within ${MAX_WAIT_MS / 1000}s.\n` +
    `  Health URL: ${GRAPHQL_HEALTH_URL}\n` +
    `  Start manually: cd docker/graphql && docker compose up -d`,
  );
}

function startGraphqlServer(): void {
  console.log('[global-setup] Starting graphql-test-server (port 4010)...');
  execSync('docker compose up -d --build', {
    cwd: GRAPHQL_COMPOSE_DIR,
    stdio: 'inherit',
  });
}

export default async function globalSetup(): Promise<void> {
  if (!shouldStartDocker()) {
    console.log(
      '[global-setup] Skipping Docker startup (set E2E_WITH_DOCKER=1 or E2E_GRAPHQL_SERVER=1 to enable)',
    );
    return;
  }

  if (await isGraphqlServerHealthy()) {
    console.log('[global-setup] GraphQL test server already running — skipping docker compose up');
    return;
  }

  startGraphqlServer();
  await waitForGraphqlHealth();
}
