/**
 * Playwright global teardown — stops Docker infrastructure started by global-setup.
 *
 * Only runs when E2E_DOCKER_TEARDOWN=1 is set (containers left running by default).
 */

import { stopDockerInfrastructure, stopGql5DockerInfrastructure } from './docker-infra';

export default async function globalTeardown(): Promise<void> {
  if (process.env.E2E_DOCKER_TEARDOWN !== '1') {
    console.log('[global-teardown] Skipping Docker teardown (set E2E_DOCKER_TEARDOWN=1 to stop containers)');
    return;
  }

  if (process.env.E2E_GQL5_DOCKER === '1') {
    stopGql5DockerInfrastructure();
    return;
  }

  const fullDocker = process.env.E2E_WITH_DOCKER === '1';
  stopDockerInfrastructure(fullDocker);
}
