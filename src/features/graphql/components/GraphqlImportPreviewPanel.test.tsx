/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { GraphqlImportPreviewPanel } from './GraphqlImportPreviewPanel';
import { buildCollectionImportPreview } from '../utils/collectionImportPreview';
import type { CollectionExportData } from '../../../shared/utils/idbGraphqlCollections';

const sampleData: CollectionExportData = {
  _exportMeta: { version: '1.1', exportedAt: '2026-06-23T12:00:00.000Z', source: 'RedfireForge/GraphQL' },
  collections: [{
    collection: {
      id: 'col-1',
      name: 'Lesson 8 Health',
      createdAt: 1,
      updatedAt: 1,
    },
    folders: [],
    items: [{
      id: 'item-1',
      collectionId: 'col-1',
      name: 'Health Check',
      sortOrder: 0,
      operation: { id: 'op-1', query: 'query { health }', operationType: 'query' },
      createdAt: 1,
      updatedAt: 1,
    }],
  }],
};

describe('GraphqlImportPreviewPanel', () => {
  it('renders collection and operation preview', () => {
    render(<GraphqlImportPreviewPanel preview={buildCollectionImportPreview(sampleData)} />);
    expect(screen.getByTestId('gql-import-mode-preview')).toBeInTheDocument();
    expect(screen.getByText('Lesson 8 Health')).toBeInTheDocument();
    expect(screen.getByText('Health Check')).toBeInTheDocument();
    expect(screen.getByText('query { health }')).toBeInTheDocument();
    expect(screen.getByTestId('gql-import-preview-meta')).toHaveTextContent('Export v1.1');
  });

  it('shows empty state when no collections', () => {
    render(<GraphqlImportPreviewPanel preview={buildCollectionImportPreview({ _exportMeta: sampleData._exportMeta, collections: [] })} />);
    expect(screen.getByTestId('gql-import-preview-empty')).toHaveTextContent('No collections');
  });
});
