import { describe, it, expect } from 'vitest';
import { buildCollectionImportPreview, formatImportQueryPreview } from './collectionImportPreview';
import type { CollectionExportData } from '../../../shared/utils/idbGraphqlCollections';

describe('collectionImportPreview — coverage gaps', () => {
  it('formatImportQueryPreview returns empty string for whitespace-only query', () => {
    expect(formatImportQueryPreview('   \n  ')).toBe('');
  });

  it('buildCollectionImportPreview nests folders by parentId and root items', () => {
    const data: CollectionExportData = {
      collections: [{
        collection: {
          id: 'col-1',
          name: 'Nested',
          createdAt: 1,
          updatedAt: 1,
          variables: { a: '1', b: '2' },
        },
        folders: [
          { id: 'root-f', collectionId: 'col-1', name: 'RootFolder', sortOrder: 0, createdAt: 1 },
          { id: 'child-f', collectionId: 'col-1', name: 'Child', parentId: 'root-f', sortOrder: 0, createdAt: 1 },
        ],
        items: [
          {
            id: 'i-root',
            collectionId: 'col-1',
            name: 'RootOp',
            sortOrder: 0,
            operation: { id: 'op1', query: 'query { root }', operationType: 'query' },
            createdAt: 1,
            updatedAt: 1,
          },
          {
            id: 'i-nested',
            collectionId: 'col-1',
            folderId: 'child-f',
            name: 'NestedOp',
            sortOrder: 0,
            operation: { id: 'op2', query: 'mutation { m }', operationType: 'mutation' },
            createdAt: 1,
            updatedAt: 1,
          },
          {
            id: 'i-orphan',
            collectionId: 'col-1',
            folderId: 'missing-folder',
            name: 'OrphanOp',
            sortOrder: 1,
            operation: { id: 'op3', query: 'subscription { s }', operationType: 'subscription' },
            createdAt: 1,
            updatedAt: 1,
          },
        ],
      }],
    };

    const preview = buildCollectionImportPreview(data);
    expect(preview.totalOperations).toBe(3);
    expect(preview.collections[0]?.variableCount).toBe(2);
    expect(preview.collections[0]?.rootItems.map((i) => i.name)).toEqual(['RootOp', 'OrphanOp']);
    expect(preview.collections[0]?.folders[0]?.folders[0]?.items[0]?.name).toBe('NestedOp');
  });

  it('buildCollectionImportPreview omits undefined export meta fields', () => {
    const preview = buildCollectionImportPreview({ collections: [] });
    expect(preview.meta).toEqual({});
    expect(preview.totalCollections).toBe(0);
  });

  it('buildCollectionImportPreview sorts root folders without parentId', () => {
    const data: CollectionExportData = {
      collections: [{
        collection: { id: 'c1', name: 'Flat', createdAt: 1, updatedAt: 1, variables: {} },
        folders: [
          { id: 'f2', collectionId: 'c1', name: 'B', sortOrder: 1, createdAt: 1 },
          { id: 'f1', collectionId: 'c1', name: 'A', sortOrder: 0, createdAt: 1 },
        ],
        items: [],
      }],
    };
    const preview = buildCollectionImportPreview(data);
    expect(preview.collections[0]?.folders.map((f) => f.name)).toEqual(['A', 'B']);
  });
});
