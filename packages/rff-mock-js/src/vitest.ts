/**
 * Vitest global setup helper.
 *
 * @example vitest.config.ts
 * ```ts
 * import { defineConfig } from 'vitest/config';
 *
 * export default defineConfig({
 *   test: {
 *     globalSetup: './test/vitest-mock-setup.ts',
 *   },
 * });
 * ```
 *
 * @example test/vitest-mock-setup.ts
 * ```ts
 * import { vitestSetup } from '@redfireforge/mock-jest/vitest';
 *
 * export const { setup, teardown } = vitestSetup({
 *   definitionFile: 'mocks/orders.json',
 *   baseUrlEnvVar:  'MOCK_BASE_URL',
 * });
 * ```
 */

import { RffMockServer, type RffMockConfig } from './RffMockServer.js';

export interface VitestRffMockOptions extends RffMockConfig {
  definitionFile?: string;
  baseUrlEnvVar?: string;
  portEnvVar?: string;
}

/**
 * Returns `{ setup, teardown }` functions compatible with Vitest's
 * `globalSetup` module contract.
 *
 * Vitest calls `setup()` once before all test files and `teardown()` after.
 */
export function vitestSetup(opts: VitestRffMockOptions = {}): {
  setup: () => Promise<() => Promise<void>>;
} {
  return {
    /**
     * Vitest calls this once. Return value is used as the teardown function.
     */
    async setup() {
      const definitionFile = opts.definitionFile ?? process.env['RFF_MOCK_FILE'];
      if (!definitionFile) {
        throw new Error(
          'rff-mock-jest/vitest: no definition file. Pass definitionFile or set RFF_MOCK_FILE.'
        );
      }

      const mock = await RffMockServer.start(definitionFile, opts);

      const baseUrlVar = opts.baseUrlEnvVar ?? 'MOCK_BASE_URL';
      const portVar    = opts.portEnvVar    ?? 'MOCK_PORT';
      process.env[baseUrlVar] = mock.baseUrl;
      process.env[portVar]    = String(mock.port);

      // Return the teardown function.
      return async () => { await mock.stop(); };
    },
  };
}
