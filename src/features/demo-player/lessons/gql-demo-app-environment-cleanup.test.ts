/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  GQL_DEMO_ENV_NAME,
  GQL_DEMO_SVC_NAME,
  GQL_STUDIO_DEMO_ENV_NAME,
} from './env-manager-lesson-helpers';
import { purgeGqlDemoLessonEnvironmentsFromStorage } from './gql-demo-app-environment-cleanup';
import { GQL_ENVS_STORAGE_KEY } from '../../graphql/utils/gqlStudioEnvironmentStorage';

vi.mock('../../../shared/utils/storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../shared/utils/storage')>();
  return {
    ...actual,
    loadEnvironments: vi.fn(),
    saveEnvironments: vi.fn(),
    loadMicroservices: vi.fn(),
    saveMicroservices: vi.fn(),
    loadSelectedEnvId: vi.fn(),
    loadSelectedSvcId: vi.fn(),
    saveSelectedEnvId: vi.fn(),
    saveSelectedSvcId: vi.fn(),
    readKey: vi.fn(),
    writeKey: vi.fn(),
  };
});

import {
  loadEnvironments,
  saveEnvironments,
  loadMicroservices,
  saveMicroservices,
  loadSelectedEnvId,
  loadSelectedSvcId,
  saveSelectedEnvId,
  saveSelectedSvcId,
  readKey,
  writeKey,
} from '../../../shared/utils/storage';

describe('purgeGqlDemoLessonEnvironmentsFromStorage', () => {
  beforeEach(() => {
    vi.mocked(loadEnvironments).mockReset();
    vi.mocked(saveEnvironments).mockReset();
    vi.mocked(loadMicroservices).mockReset();
    vi.mocked(saveMicroservices).mockReset();
    vi.mocked(loadSelectedEnvId).mockReset();
    vi.mocked(loadSelectedSvcId).mockReset();
    vi.mocked(saveSelectedEnvId).mockReset();
    vi.mocked(saveSelectedSvcId).mockReset();
    vi.mocked(readKey).mockReset();
    vi.mocked(writeKey).mockReset();
  });

  it('removes Demo studio env, GraphQL Demo env, and graphql-demo microservice from storage', async () => {
    vi.mocked(readKey).mockResolvedValue(JSON.stringify([
      { id: 'env-demo', name: GQL_STUDIO_DEMO_ENV_NAME, variables: [], isActive: true, createdAt: 1, updatedAt: 1 },
      { id: 'env-user', name: 'Local', variables: [], isActive: false, createdAt: 1, updatedAt: 1 },
    ]));
    vi.mocked(loadEnvironments).mockResolvedValue([
      { id: 'e-demo', name: GQL_DEMO_ENV_NAME },
      { id: 'e-user', name: 't01' },
    ] as never);
    vi.mocked(loadMicroservices).mockResolvedValue([
      { id: 's-demo', name: GQL_DEMO_SVC_NAME, baseUrls: {} },
      { id: 's-user', name: 'api', baseUrls: {} },
    ] as never);
    vi.mocked(loadSelectedEnvId).mockResolvedValue('e-demo');
    vi.mocked(loadSelectedSvcId).mockResolvedValue('s-demo');

    const result = await purgeGqlDemoLessonEnvironmentsFromStorage();

    expect(result.removedStudioEnv).toBe(true);
    expect(result.removedEmEnvId).toBe('e-demo');
    expect(result.removedEmSvcId).toBe('s-demo');
    expect(result.resetEnvSelection).toBe(true);
    expect(result.resetSvcSelection).toBe(true);
    expect(writeKey).toHaveBeenCalledWith(
      GQL_ENVS_STORAGE_KEY,
      expect.stringContaining('"env-user"'),
    );
    expect(saveEnvironments).toHaveBeenCalledWith([{ id: 'e-user', name: 't01' }]);
    expect(saveMicroservices).toHaveBeenCalledWith([{ id: 's-user', name: 'api', baseUrls: {} }]);
    expect(saveSelectedEnvId).toHaveBeenCalledWith('e-user');
    expect(saveSelectedSvcId).toHaveBeenCalledWith('s-user');
  });
});
