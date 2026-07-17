/**
 * Shared setup for split useDemoHub branch-coverage test files.
 */
import { vi } from 'vitest';
import { teardownActiveDemoHub } from './useDemoHub.coverage-helpers';

export function setupUseDemoHubCoverageBeforeEach(): void {
  vi.useRealTimers();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.clearAllMocks();
  localStorage.clear();
  document.body.innerHTML = '';
}

export async function teardownUseDemoHubCoverageAfterEach(): Promise<void> {
  await teardownActiveDemoHub();
  vi.restoreAllMocks();
}
