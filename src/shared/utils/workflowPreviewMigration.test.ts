/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { migratePreviewsToLocalStorage, resetPreviewMigration, migratePublishedToWorkflowPublication, resetPublicationMigration } from './workflowPreviewMigration';
import type { CatalogEntry } from '../../features/catalog/types/catalog';

const readKeyMock = vi.hoisted(() => vi.fn());
const writeKeyMock = vi.hoisted(() => vi.fn());
const loadPreviewsMock = vi.hoisted(() => vi.fn());
const savePreviewsMock = vi.hoisted(() => vi.fn());

vi.mock('./storage', () => ({
  readKey: readKeyMock,
  writeKey: writeKeyMock,
}));

vi.mock('./workflowPreviewStorage', () => ({
  loadWorkflowPreviews: loadPreviewsMock,
  saveWorkflowPreviews: savePreviewsMock,
}));

beforeEach(() => {
  vi.resetAllMocks();
  writeKeyMock.mockResolvedValue(undefined);
  savePreviewsMock.mockResolvedValue(undefined);
  loadPreviewsMock.mockResolvedValue({});
});

const makeEntry = (overrides: Partial<CatalogEntry> = {}): CatalogEntry => ({
  id: 'entry1',
  name: 'Test API',
  currentVersionId: 'v1',
  versions: [],
  servers: [],
  securitySchemes: {},
  folders: [],
  endpoints: [],
  hostConfig: { strategy: 'global' },
  authConfig: { strategy: 'global' },
  ...overrides,
} as CatalogEntry);

describe('workflowPreviewMigration', () => {
  it('skips migration when already done', async () => {
    readKeyMock.mockResolvedValue('true');
    const updateEntry = vi.fn();
    const result = await migratePreviewsToLocalStorage([], updateEntry);
    expect(result).toBe(0);
    expect(updateEntry).not.toHaveBeenCalled();
  });

  it('migrates preview endpoints to local storage', async () => {
    readKeyMock.mockResolvedValue(null);
    const entry = makeEntry({
      endpoints: [
        { id: 'ep1', method: 'GET', path: '/users', summary: 'List Users', workflowExposure: 'preview', parameters: [], responses: [], tags: [] } as never,
        { id: 'ep2', method: 'POST', path: '/users', summary: 'Create User', workflowExposure: 'published', parameters: [], responses: [], tags: [] } as never,
      ],
    });

    const updateEntry = vi.fn();
    const result = await migratePreviewsToLocalStorage([entry], updateEntry);

    expect(result).toBe(1);
    expect(updateEntry).toHaveBeenCalledWith('entry1', expect.objectContaining({
      endpoints: expect.arrayContaining([
        expect.objectContaining({ id: 'ep1', workflowExposure: undefined }),
        expect.objectContaining({ id: 'ep2', workflowExposure: 'published' }),
      ]),
    }));
    expect(savePreviewsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        'entry1::ep1': expect.objectContaining({
          entryId: 'entry1',
          endpointId: 'ep1',
          method: 'GET',
          path: '/users',
        }),
      }),
    );
  });

  it('migrates legacy exposedToWorkflow=true to local storage', async () => {
    readKeyMock.mockResolvedValue(null);
    const entry = makeEntry({
      endpoints: [
        { id: 'ep3', method: 'DELETE', path: '/posts/{id}', summary: 'Delete Post', exposedToWorkflow: true, parameters: [], responses: [], tags: [] } as never,
      ],
    });

    const updateEntry = vi.fn();
    const result = await migratePreviewsToLocalStorage([entry], updateEntry);

    expect(result).toBe(1);
    expect(updateEntry).toHaveBeenCalledWith('entry1', expect.objectContaining({
      endpoints: [expect.objectContaining({
        id: 'ep3',
        workflowExposure: undefined,
        exposedToWorkflow: undefined,
      })],
    }));
    expect(savePreviewsMock).toHaveBeenCalled();
  });

  it('migrates preview endpoints in folders', async () => {
    readKeyMock.mockResolvedValue(null);
    const entry = makeEntry({
      folders: [
        {
          id: 'f1', name: 'Folder', description: '', endpoints: [
            { id: 'ep4', method: 'PATCH', path: '/items', summary: 'Update Item', workflowExposure: 'preview', parameters: [], responses: [], tags: [] } as never,
          ], folders: [],
        },
      ],
    });

    const updateEntry = vi.fn();
    const result = await migratePreviewsToLocalStorage([entry], updateEntry);

    expect(result).toBe(1);
    expect(updateEntry).toHaveBeenCalledWith('entry1', expect.objectContaining({
      folders: [expect.objectContaining({
        endpoints: [expect.objectContaining({ id: 'ep4', workflowExposure: undefined })],
      })],
    }));
  });

  it('does not call updateEntry when no migration needed', async () => {
    readKeyMock.mockResolvedValue(null);
    const entry = makeEntry({
      endpoints: [
        { id: 'ep5', method: 'GET', path: '/health', summary: 'Health', workflowExposure: 'published', parameters: [], responses: [], tags: [] } as never,
      ],
    });

    const updateEntry = vi.fn();
    const result = await migratePreviewsToLocalStorage([entry], updateEntry);

    expect(result).toBe(0);
    expect(updateEntry).not.toHaveBeenCalled();
    expect(savePreviewsMock).not.toHaveBeenCalled();
  });

  it('preserves workflowValues during migration', async () => {
    readKeyMock.mockResolvedValue(null);
    const entry = makeEntry({
      endpoints: [
        {
          id: 'ep6', method: 'POST', path: '/test', summary: 'Test',
          workflowExposure: 'preview',
          workflowValues: { paramValues: { a: '1' }, headerValues: { h: 'v' }, body: '{}' },
          parameters: [], responses: [], tags: [],
        } as never,
      ],
    });

    const updateEntry = vi.fn();
    await migratePreviewsToLocalStorage([entry], updateEntry);

    expect(savePreviewsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        'entry1::ep6': expect.objectContaining({
          values: { paramValues: { a: '1' }, headerValues: { h: 'v' }, body: '{}' },
        }),
      }),
    );
  });

  it('marks migration as complete', async () => {
    readKeyMock.mockResolvedValue(null);
    await migratePreviewsToLocalStorage([], vi.fn());
    expect(writeKeyMock).toHaveBeenCalledWith('perf-test-v3-wf-preview-migration-v1', 'true');
  });
});

describe('resetPreviewMigration', () => {
  it('clears the migration flag', async () => {
    await resetPreviewMigration();
    expect(writeKeyMock).toHaveBeenCalledWith('perf-test-v3-wf-preview-migration-v1', '');
  });
});

describe('migratePublishedToWorkflowPublication (P2)', () => {
  it('skips when already done', async () => {
    readKeyMock.mockResolvedValue('true');
    const updateEntry = vi.fn();
    const result = await migratePublishedToWorkflowPublication([], updateEntry);
    expect(result).toBe(0);
    expect(updateEntry).not.toHaveBeenCalled();
  });

  it('converts workflowExposure published to workflowPublication', async () => {
    readKeyMock.mockResolvedValue(null);
    const entry = makeEntry({
      currentVersionId: 'v2',
      endpoints: [
        {
          id: 'ep1', method: 'POST', path: '/posts', summary: 'Create Post',
          workflowExposure: 'published',
          workflowValues: { paramValues: { a: '1' }, headerValues: { h: 'v' }, body: '{}' },
          parameters: [], responses: [], tags: [],
        } as never,
      ],
    });

    const updateEntry = vi.fn();
    const result = await migratePublishedToWorkflowPublication([entry], updateEntry);

    expect(result).toBe(1);
    expect(updateEntry).toHaveBeenCalledWith('entry1', expect.objectContaining({
      endpoints: [expect.objectContaining({
        id: 'ep1',
        workflowExposure: undefined,
        workflowValues: undefined,
        workflowPublication: expect.objectContaining({
          publishedFromVersionId: 'v2',
          values: { paramValues: { a: '1' }, headerValues: { h: 'v' }, body: '{}' },
        }),
      })],
    }));
  });

  it('skips endpoints already having workflowPublication', async () => {
    readKeyMock.mockResolvedValue(null);
    const entry = makeEntry({
      endpoints: [
        {
          id: 'ep1', method: 'GET', path: '/check', summary: 'Check',
          workflowPublication: { publishedAt: 1000, publishedFromVersionId: 'v1' },
          parameters: [], responses: [], tags: [],
        } as never,
      ],
    });

    const updateEntry = vi.fn();
    const result = await migratePublishedToWorkflowPublication([entry], updateEntry);

    expect(result).toBe(0);
    expect(updateEntry).not.toHaveBeenCalled();
  });

  it('skips non-published endpoints', async () => {
    readKeyMock.mockResolvedValue(null);
    const entry = makeEntry({
      endpoints: [
        { id: 'ep1', method: 'GET', path: '/users', summary: 'List', parameters: [], responses: [], tags: [] } as never,
      ],
    });

    const updateEntry = vi.fn();
    const result = await migratePublishedToWorkflowPublication([entry], updateEntry);

    expect(result).toBe(0);
    expect(updateEntry).not.toHaveBeenCalled();
  });

  it('migrates published endpoints in folders', async () => {
    readKeyMock.mockResolvedValue(null);
    const entry = makeEntry({
      currentVersionId: 'v3',
      folders: [{
        id: 'f1', name: 'Folder', description: '', folders: [],
        endpoints: [
          {
            id: 'ep2', method: 'DELETE', path: '/items/{id}', summary: 'Delete',
            workflowExposure: 'published',
            parameters: [], responses: [], tags: [],
          } as never,
        ],
      }],
    });

    const updateEntry = vi.fn();
    const result = await migratePublishedToWorkflowPublication([entry], updateEntry);

    expect(result).toBe(1);
    expect(updateEntry).toHaveBeenCalledWith('entry1', expect.objectContaining({
      folders: [expect.objectContaining({
        endpoints: [expect.objectContaining({
          id: 'ep2',
          workflowPublication: expect.objectContaining({
            publishedFromVersionId: 'v3',
          }),
          workflowExposure: undefined,
        })],
      })],
    }));
  });

  it('marks P2 migration as complete', async () => {
    readKeyMock.mockResolvedValue(null);
    await migratePublishedToWorkflowPublication([], vi.fn());
    expect(writeKeyMock).toHaveBeenCalledWith('perf-test-v3-wf-publication-migration-v2', 'true');
  });
});

describe('resetPublicationMigration', () => {
  it('clears the P2 migration flag', async () => {
    await resetPublicationMigration();
    expect(writeKeyMock).toHaveBeenCalledWith('perf-test-v3-wf-publication-migration-v2', '');
  });
});
