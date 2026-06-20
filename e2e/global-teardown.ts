/**
 * Playwright global teardown — stops Docker infrastructure started by global-setup.
 *
 * Only runs when E2E_DOCKER_TEARDOWN=1 is set, so dev containers are left running
 * by default (matches reuseExistingServer pattern for the Vite dev server).
 */

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GRAPHQL_COMPOSE_DIR = path.resolve(__dirname, '../docker/graphql');

export default async function globalTeardown(): Promise<void> {
  if (process.env.E2E_DOCKER_TEARDOWN !== '1') {
    console.log('[global-teardown] Skipping Docker teardown (set E2E_DOCKER_TEARDOWN=1 to stop containers)');
    return;
  }

  console.log('[global-teardown] Stopping graphql-test-server...');
  try {
    execSync('docker compose down', {
      cwd: GRAPHQL_COMPOSE_DIR,
      stdio: 'inherit',
    });
  } catch (err) {
    console.warn('[global-teardown] docker compose down failed:', err);
  }
}
