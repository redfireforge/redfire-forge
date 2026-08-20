/**
 * Jest global setup / teardown helpers.
 *
 * Add to jest.config.ts:
 * ```ts
 * export default {
 *   globalSetup:    '@redfireforge/mock-jest/dist/jest.js',
 *   globalTeardown: '@redfireforge/mock-jest/dist/jest.js',
 * };
 * ```
 *
 * Or use the factory for custom configuration:
 * ```ts
 * // jest.globalSetup.ts
 * export { setup, teardown } from '@redfireforge/mock-jest/dist/jest.js';
 * ```
 */

import { RffMockServer, type RffMockConfig } from './RffMockServer.js';

const GLOBAL_KEY = '__RFF_MOCK_SERVER__';

export interface JestRffMockOptions extends RffMockConfig {
  /** Path to the workspace / server JSON or YAML. Defaults to `RFF_MOCK_FILE` env var. */
  definitionFile?: string;
  /**
   * Environment variable to set with the base URL after the server starts.
   * Defaults to `MOCK_BASE_URL`.
   */
  baseUrlEnvVar?: string;
  /**
   * Environment variable to set with the port after the server starts.
   * Defaults to `MOCK_PORT`.
   */
  portEnvVar?: string;
}

/**
 * Jest `globalSetup` export.  Starts the mock server and stores it on `global`
 * so `teardown` can shut it down.
 *
 * @example
 * ```ts
 * // jest.config.ts
 * export default { globalSetup: './test/mock-setup.ts' };
 *
 * // test/mock-setup.ts
 * import { setup } from '@redfireforge/mock-jest';
 * export default () => setup({ definitionFile: 'mocks/orders.json' });
 * ```
 */
export async function setup(opts: JestRffMockOptions = {}): Promise<void> {
  const definitionFile = opts.definitionFile ?? process.env['RFF_MOCK_FILE'];
  if (!definitionFile) {
    throw new Error(
      'rff-mock-jest: no definition file. Pass definitionFile option or set RFF_MOCK_FILE env var.'
    );
  }

  const mock = await RffMockServer.start(definitionFile, opts);
  (global as Record<string, unknown>)[GLOBAL_KEY] = mock;

  const baseUrlVar = opts.baseUrlEnvVar ?? 'MOCK_BASE_URL';
  const portVar    = opts.portEnvVar    ?? 'MOCK_PORT';
  process.env[baseUrlVar] = mock.baseUrl;
  process.env[portVar]    = String(mock.port);
}

/**
 * Jest `globalTeardown` export. Stops the mock server started by {@link setup}.
 */
export async function teardown(): Promise<void> {
  const mock = (global as Record<string, unknown>)[GLOBAL_KEY] as RffMockServer | undefined;
  await mock?.stop();
}
