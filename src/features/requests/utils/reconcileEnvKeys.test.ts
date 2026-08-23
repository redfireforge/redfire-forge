import { describe, it, expect } from 'vitest';
import type { RequestsData, RequestCollection, RequestFolder } from '@shared/types';
import { reconcileRequestsEnvKeys } from './reconcileEnvKeys';

function makeFolder(overrides: Partial<RequestFolder> = {}): RequestFolder {
  return {
    id: 'folder-1',
    name: 'Folder',
    requests: [],
    ...overrides,
  };
}

function makeCollection(overrides: Partial<RequestCollection> = {}): RequestCollection {
  return {
    id: 'collection-1',
    name: 'Collection',
    mode: 'direct',
    requests: [],
    ...overrides,
  };
}

describe('reconcileRequestsEnvKeys', () => {
  it('returns the input untouched when there are no legacy environments', () => {
    const data: RequestsData = { collections: [] };
    const result = reconcileRequestsEnvKeys(data, [{ id: 'env-1', name: 'Dev' }]);

    expect(result.changed).toBe(false);
    expect(result.droppedNames).toEqual([]);
    expect(result.data).toBe(data);
  });

  it('remaps nested legacy env ids to matching settings env ids and drops unmatched ones', () => {
    const data: RequestsData = {
      environments: [
        { id: 'legacy-dev', name: 'Dev' },
        { id: 'legacy-drop', name: 'Legacy Only' },
      ],
      selectedEnvId: 'legacy-dev',
      collections: [
        makeCollection({
          baseUrls: {
            'legacy-dev': 'https://dev.example.test',
            'legacy-drop': 'https://drop.example.test',
            'env-existing': 'https://existing.example.test',
          },
          authPerEnv: {
            'legacy-dev': { type: 'none' },
            'legacy-drop': { type: 'bearer', token: 'secret' },
            'env-existing': { type: 'none' },
          },
          folders: [
            makeFolder({
              baseUrls: {
                'legacy-dev': 'https://folder-dev.example.test',
                'legacy-drop': 'https://folder-drop.example.test',
                'env-existing': 'https://folder-existing.example.test',
              },
              selectedEnvId: 'legacy-drop',
              folders: [
                makeFolder({
                  id: 'nested-folder',
                  selectedEnvId: 'env-existing',
                }),
              ],
            }),
          ],
        }),
      ],
    };

    const result = reconcileRequestsEnvKeys(data, [
      { id: 'env-dev', name: 'dev' },
      { id: 'env-existing', name: 'Existing' },
    ]);

    expect(result.changed).toBe(true);
    expect(result.droppedNames).toEqual(['Legacy Only']);
    expect(result.data.environments).toBeUndefined();
    expect(result.data.selectedEnvId).toBe('env-dev');

    const collection = result.data.collections[0];
    expect(collection.baseUrls).toEqual({
      'env-dev': 'https://dev.example.test',
      'env-existing': 'https://existing.example.test',
    });
    expect(collection.authPerEnv).toEqual({
      'env-dev': { type: 'none' },
      'env-existing': { type: 'none' },
    });

    const folder = collection.folders?.[0];
    expect(folder?.baseUrls).toEqual({
      'env-dev': 'https://folder-dev.example.test',
      'env-existing': 'https://folder-existing.example.test',
    });
    expect(folder?.selectedEnvId).toBeUndefined();
    expect(folder?.folders?.[0].selectedEnvId).toBe('env-existing');
  });

  it('drops a legacy selected env when no settings environment matches', () => {
    const data: RequestsData = {
      environments: [{ id: 'legacy-drop', name: 'Legacy Only' }],
      selectedEnvId: 'legacy-drop',
      collections: [makeCollection()],
    };

    const result = reconcileRequestsEnvKeys(data, [
      { id: 'env-existing', name: 'Existing' },
    ]);

    expect(result.changed).toBe(true);
    expect(result.droppedNames).toEqual(['Legacy Only']);
    expect(result.data.selectedEnvId).toBeUndefined();
  });

  it('leaves modern ids unchanged and tolerates missing nested env maps', () => {
    const data: RequestsData = {
      environments: [{ id: 'legacy-dev', name: 'Dev' }],
      selectedEnvId: 'env-existing',
      collections: [
        makeCollection({
          folders: [makeFolder()],
        }),
      ],
    };

    const result = reconcileRequestsEnvKeys(data, [
      { id: 'env-existing', name: 'Existing' },
    ]);

    expect(result.changed).toBe(true);
    expect(result.droppedNames).toEqual([]);
    expect(result.data.selectedEnvId).toBe('env-existing');
    expect(result.data.collections[0].folders?.[0].baseUrls).toBeUndefined();
  });
});