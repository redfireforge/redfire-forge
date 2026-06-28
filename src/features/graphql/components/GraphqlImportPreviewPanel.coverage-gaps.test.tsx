/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GraphqlImportPreviewPanel } from './GraphqlImportPreviewPanel';
import type { CollectionImportPreview } from '../utils/collectionImportPreview';

const preview: CollectionImportPreview = {
  meta: { exportedAt: 'not-a-date', version: '1', source: 'test' },
  totalCollections: 1,
  totalOperations: 2,
  collections: [{
    id: 'c1',
    name: 'Demo',
    folderCount: 1,
    itemCount: 2,
    variableCount: 2,
    rootItems: [{
      name: 'RootOp',
      operationType: 'query',
      queryPreview: 'query { root }',
    }],
    folders: [{
      id: 'f1',
      name: 'Folder',
      folders: [{
        id: 'f2',
        name: 'Nested',
        folders: [],
        items: [{
          name: 'NestedOp',
          operationType: 'mutation',
          queryPreview: 'mutation { m }',
        }],
      }],
      items: [],
    }],
  }],
};

describe('GraphqlImportPreviewPanel — coverage gaps', () => {
  it('renders invalid exportedAt as raw string', () => {
    render(<GraphqlImportPreviewPanel preview={preview} />);
    expect(screen.getByText(/not-a-date/)).toBeTruthy();
  });

  it('renders nested folder blocks', () => {
    render(<GraphqlImportPreviewPanel preview={preview} />);
    expect(screen.getAllByTestId('gql-import-preview-folder').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('NestedOp')).toBeTruthy();
  });

  it('omits meta header when version, exportedAt, and source are absent', () => {
    render(<GraphqlImportPreviewPanel preview={{
      ...preview,
      meta: { exportedAt: undefined, version: undefined, source: undefined },
    }} />);
    expect(screen.queryByTestId('gql-import-preview-meta')).toBeNull();
  });

  it('renders pluralized collection meta and subscription operation type', () => {
    render(<GraphqlImportPreviewPanel preview={{
      meta: { version: '2', exportedAt: '2026-01-01T00:00:00.000Z', source: 'src' },
      totalCollections: 1,
      totalOperations: 3,
      collections: [{
        id: 'c-sub',
        name: 'Subs',
        folderCount: 2,
        itemCount: 3,
        variableCount: 2,
        rootItems: [{
          name: 'Live',
          operationType: 'subscription',
          queryPreview: 'subscription { live }',
        }],
        folders: [],
      }],
    }} />);
    expect(screen.getByText(/3 operations/)).toBeTruthy();
    expect(screen.getByText(/2 folders/)).toBeTruthy();
    expect(screen.getByText(/2 variables/)).toBeTruthy();
    expect(screen.getByText('Subscription')).toBeTruthy();
  });

  it('renders singular operation, folder, and variable counts', () => {
    render(<GraphqlImportPreviewPanel preview={{
      meta: {},
      totalCollections: 1,
      totalOperations: 1,
      collections: [{
        id: 'c-one',
        name: 'Single',
        folderCount: 1,
        itemCount: 1,
        variableCount: 1,
        rootItems: [{ name: 'Only', operationType: 'query', queryPreview: 'query { only }' }],
        folders: [],
      }],
    }} />);
    expect(screen.getByText(/1 operation · 1 folder · 1 variable/)).toBeTruthy();
  });

  it('renders empty collections message', () => {
    render(<GraphqlImportPreviewPanel preview={{
      meta: {},
      totalCollections: 0,
      totalOperations: 0,
      collections: [],
    }} />);
    expect(screen.getByTestId('gql-import-preview-empty')).toBeTruthy();
  });

  it('skips empty folder blocks with no items or nested folders', () => {
    render(<GraphqlImportPreviewPanel preview={{
      meta: {},
      totalCollections: 1,
      totalOperations: 0,
      collections: [{
        id: 'c-empty-folder',
        name: 'Empty Folder Case',
        folderCount: 1,
        itemCount: 0,
        variableCount: 0,
        rootItems: [],
        folders: [{ id: 'f-empty', name: 'Empty', folders: [], items: [] }],
      }],
    }} />);
    expect(screen.queryByTestId('gql-import-preview-folder')).toBeNull();
  });
});
