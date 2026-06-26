/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../shared/utils/storage', () => ({
  readKey: vi.fn(),
  writeKey: vi.fn(),
}));

vi.mock('../../../shared/utils/platform', () => ({
  isTauri: vi.fn(() => true),
}));

import { readKey, writeKey } from '../../../shared/utils/storage';
import {
  readGqlStudioEnvironments,
  writeGqlStudioEnvironments,
  purgeGqlStudioEnvironmentsByName,
  GQL_ENVS_STORAGE_KEY,
  GQL_ENVS_RELOAD_EVENT,
} from './gqlStudioEnvironmentStorage';
import type { GraphqlEnvironment } from '../../../shared/types/graphql';

const mockReadKey = vi.mocked(readKey);
const mockWriteKey = vi.mocked(writeKey);

function makeEnv(overrides: Partial<GraphqlEnvironment> = {}): GraphqlEnvironment {
  return {
    id: 'env-1',
    name: 'Demo Env',
    variables: [],
    isActive: true,
    ...overrides,
  };
}

describe('gqlStudioEnvironmentStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWriteKey.mockResolvedValue(undefined);
  });

  it('readGqlStudioEnvironments parses valid storage payload', async () => {
    mockReadKey.mockResolvedValue(JSON.stringify([makeEnv()]));
    await expect(readGqlStudioEnvironments()).resolves.toEqual([makeEnv()]);
    expect(mockReadKey).toHaveBeenCalledWith(GQL_ENVS_STORAGE_KEY);
  });

  it('readGqlStudioEnvironments returns empty array for invalid payload', async () => {
    mockReadKey.mockResolvedValue('{bad-json');
    await expect(readGqlStudioEnvironments()).resolves.toEqual([]);
  });

  it('writeGqlStudioEnvironments persists JSON', async () => {
    await writeGqlStudioEnvironments([makeEnv()]);
    expect(mockWriteKey).toHaveBeenCalledWith(GQL_ENVS_STORAGE_KEY, JSON.stringify([makeEnv()]));
  });

  it('purgeGqlStudioEnvironmentsByName removes matches and promotes first env active', async () => {
    mockReadKey.mockResolvedValue(JSON.stringify([
      makeEnv({ id: 'a', name: 'Remove Me', isActive: true }),
      makeEnv({ id: 'b', name: 'Keep', isActive: false }),
    ]));

    const handler = vi.fn();
    window.addEventListener(GQL_ENVS_RELOAD_EVENT, handler);

    await expect(purgeGqlStudioEnvironmentsByName('Remove Me')).resolves.toBe(true);
    expect(mockWriteKey).toHaveBeenCalledWith(
      GQL_ENVS_STORAGE_KEY,
      JSON.stringify([makeEnv({ id: 'b', name: 'Keep', isActive: true })]),
    );
    expect(handler).toHaveBeenCalled();
    window.removeEventListener(GQL_ENVS_RELOAD_EVENT, handler);
  });

  it('purgeGqlStudioEnvironmentsByName returns false when name is absent', async () => {
    mockReadKey.mockResolvedValue(JSON.stringify([makeEnv()]));
    await expect(purgeGqlStudioEnvironmentsByName('Missing')).resolves.toBe(false);
    expect(mockWriteKey).not.toHaveBeenCalled();
  });

  it('purgeGqlStudioEnvironmentsByName no-ops reload dispatch when window is undefined', async () => {
    mockReadKey.mockResolvedValue(JSON.stringify([makeEnv({ name: 'Demo Env' })]));
    const savedWindow = globalThis.window;
    // @ts-expect-error — simulate non-browser runtime
    delete globalThis.window;
    await expect(purgeGqlStudioEnvironmentsByName('Demo Env')).resolves.toBe(true);
    globalThis.window = savedWindow;
  });
});
