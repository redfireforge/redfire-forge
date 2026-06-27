import { describe, it, expect } from 'vitest';
import {
  buildCollectionImportPreview,
  formatImportQueryPreview,
} from './collectionImportPreview';
import type { CollectionExportData } from '../../../shared/utils/idbGraphqlCollections';

const makeExport = (overrides?: Partial<CollectionExportData>): CollectionExportData => ({
  _exportMeta: { version: '1.1', exportedAt: '2026-06-23T12:00:00.000Z', source: 'RedfireForge/GraphQL' },
  collections: [],
  ...overrides,
});

describe('formatImportQueryPreview', () => {
  it('uses first non-empty line and collapses whitespace', () => {
    expect(formatImportQueryPreview('  \n  query {\n    health\n  }')).toBe('query {');
  });

  it('truncates long queries with ellipsis', () => {
    const long = 'query { ' + 'x'.repeat(100) + ' }';
    const preview = formatImportQueryPreview(long, 20);
    expect(preview.endsWith('…')).toBe(true);
    expect(preview.length).toBe(20);
  });
});

describe('buildCollectionImportPreview', () => {
  it('builds collection tree with folders and root items', () => {
    const data = makeExport({
      collections: [{
        collection: {
          id: 'col-1',
          name: 'Demo',
          createdAt: 1,
          updatedAt: 1,
          variables: { baseUrl: 'http://localhost' },
        },
        folders: [
          { id: 'f1', collectionId: 'col-1', name: 'Queries', sortOrder: 0, createdAt: 1 },
        ],
        items: [
          {
            id: 'i-root',
            collectionId: 'col-1',
            name: 'Health',
            sortOrder: 0,
            operation: { id: 'op1', query: 'query { health }', operationType: 'query' },
            createdAt: 1,
            updatedAt: 1,
          },
          {
            id: 'i-folder',
            collectionId: 'col-1',
            folderId: 'f1',
            name: 'GetUser',
            sortOrder: 0,
            operation: { id: 'op2', query: 'query { user { id } }', operationType: 'query' },
            createdAt: 1,
            updatedAt: 1,
          },
        ],
      }],
    });

    const preview = buildCollectionImportPreview(data);
    expect(preview.totalCollections).toBe(1);
    expect(preview.totalOperations).toBe(2);
    expect(preview.meta.version).toBe('1.1');
    expect(preview.collections[0]?.name).toBe('Demo');
    expect(preview.collections[0]?.variableCount).toBe(1);
    expect(preview.collections[0]?.rootItems[0]?.name).toBe('Health');
    expect(preview.collections[0]?.folders[0]?.name).toBe('Queries');
    expect(preview.collections[0]?.folders[0]?.items[0]?.name).toBe('GetUser');
  });

  it('handles empty export', () => {
    const preview = buildCollectionImportPreview(makeExport());
    expect(preview.totalCollections).toBe(0);
    expect(preview.totalOperations).toBe(0);
    expect(preview.collections).toEqual([]);
  });
});
