/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import GraphqlImportFromCollectionModal from './GraphqlImportFromCollectionModal';
import type { GraphqlCollectionItem } from '@shared/types/graphql';
import * as collectionItemImport from '../utils/collectionItemImport';

vi.mock('../hooks/useGraphqlCollections', () => ({
  useGraphqlCollections: vi.fn(),
}));

vi.mock('../utils/connectionProfileStorage', () => ({
  readConnectionProfiles: vi.fn().mockResolvedValue([]),
}));

import { useGraphqlCollections } from '../hooks/useGraphqlCollections';
import { readConnectionProfiles } from '../utils/connectionProfileStorage';

const mockUseGraphqlCollections = vi.mocked(useGraphqlCollections);
const mockReadConnectionProfiles = vi.mocked(readConnectionProfiles);

function makeItem(id: string, name: string, opType: 'query' | 'mutation' = 'query'): GraphqlCollectionItem {
  return {
    id,
    collectionId: 'col-1',
    name,
    sortOrder: 0,
    operation: {
      id: `op-${id}`,
      query: opType === 'mutation' ? 'mutation { x }' : 'query { x }',
      variables: '{"a": 1}',
      operationType: opType,
    },
    createdAt: 1,
    updatedAt: 1,
  };
}

describe('GraphqlImportFromCollectionModal', () => {
  const onImport = vi.fn();
  const onCancel = vi.fn();

  beforeEach(() => {
    resetAllMocks();
    mockUseGraphqlCollections.mockReturnValue({
      trees: [],
      loading: false,
    } as ReturnType<typeof useGraphqlCollections>);
  });

  it('shows empty state when no collections exist', () => {
    render(
      <GraphqlImportFromCollectionModal
        nodeType="graphqlQuery"
        onImport={onImport}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByTestId('gql-wf-import-col-empty')).toHaveTextContent(/No collections yet/i);
    expect(screen.getByTestId('gql-wf-import-col-import')).toBeDisabled();
  });

  it('lists query operations and imports selected item', async () => {
    mockUseGraphqlCollections.mockReturnValue({
      trees: [{
        collection: {
          id: 'col-1',
          name: 'My API',
          variables: {},
          preRequestScript: '',
          postResponseScript: '',
          createdAt: 1,
        },
        folders: [],
        items: [
          makeItem('item-1', 'Get User', 'query'),
          makeItem('item-2', 'Create User', 'mutation'),
        ],
      }],
      loading: false,
    } as ReturnType<typeof useGraphqlCollections>);

    render(
      <GraphqlImportFromCollectionModal
        nodeType="graphqlQuery"
        onImport={onImport}
        onCancel={onCancel}
      />,
    );

    const items = screen.getAllByTestId('gql-wf-import-col-item');
    expect(items).toHaveLength(1);
    expect(screen.getByText('Get User')).toBeInTheDocument();
    expect(screen.queryByText('Create User')).not.toBeInTheDocument();

    fireEvent.click(items[0]);
    fireEvent.click(screen.getByTestId('gql-wf-import-col-import'));

    await waitFor(() => {
      expect(onImport).toHaveBeenCalledWith({
        query: 'query { x }',
        variables: '{"a": 1}',
      });
    });
  });

  it('filters operations by search query', () => {
    mockUseGraphqlCollections.mockReturnValue({
      trees: [{
        collection: {
          id: 'col-1',
          name: 'Shop',
          variables: {},
          preRequestScript: '',
          postResponseScript: '',
          createdAt: 1,
        },
        folders: [],
        items: [
          makeItem('item-1', 'List Orders', 'query'),
          makeItem('item-2', 'Get Product', 'query'),
        ],
      }],
      loading: false,
    } as ReturnType<typeof useGraphqlCollections>);

    render(
      <GraphqlImportFromCollectionModal
        nodeType="graphqlQuery"
        onImport={onImport}
        onCancel={onCancel}
      />,
    );

    fireEvent.change(screen.getByTestId('gql-wf-import-col-search'), { target: { value: 'orders' } });
    expect(screen.getAllByTestId('gql-wf-import-col-item')).toHaveLength(1);
    expect(screen.getByText('List Orders')).toBeInTheDocument();
  });

  it('applies connection profile endpoint on import', async () => {
    mockReadConnectionProfiles.mockResolvedValue([{
      id: 'prof-1',
      name: 'Prod',
      endpoint: 'https://api.example.com/graphql',
      auth: { type: 'bearer', token: 'secret' },
      createdAt: 1,
    }]);

    mockUseGraphqlCollections.mockReturnValue({
      trees: [{
        collection: {
          id: 'col-1',
          name: 'API',
          variables: {},
          preRequestScript: '',
          postResponseScript: '',
          createdAt: 1,
        },
        folders: [],
        items: [{ ...makeItem('item-1', 'Get User'), connectionId: 'prof-1' }],
      }],
      loading: false,
    } as ReturnType<typeof useGraphqlCollections>);

    render(
      <GraphqlImportFromCollectionModal
        nodeType="graphqlQuery"
        onImport={onImport}
        onCancel={onCancel}
      />,
    );

    fireEvent.click(screen.getByTestId('gql-wf-import-col-item'));
    fireEvent.click(screen.getByTestId('gql-wf-import-col-import'));

    await waitFor(() => {
      expect(onImport).toHaveBeenCalledWith(expect.objectContaining({
        endpoint: 'https://api.example.com/graphql',
        auth: { type: 'bearer', token: 'secret' },
      }));
    });
  });

  it('calls onCancel from Cancel button', () => {
    render(
      <GraphqlImportFromCollectionModal
        nodeType="graphqlQuery"
        onImport={onImport}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByTestId('gql-wf-import-col-cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('shows loading state while collections are loading', () => {
    mockUseGraphqlCollections.mockReturnValue({
      trees: [],
      loading: true,
    } as ReturnType<typeof useGraphqlCollections>);

    render(
      <GraphqlImportFromCollectionModal
        nodeType="graphqlQuery"
        onImport={onImport}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByLabelText('Loading collections')).toBeInTheDocument();
  });

  it('shows mutation-specific empty state when no saved mutations exist', () => {
    mockUseGraphqlCollections.mockReturnValue({
      trees: [{
        collection: {
          id: 'col-1',
          name: 'My API',
          variables: {},
          preRequestScript: '',
          postResponseScript: '',
          createdAt: 1,
        },
        folders: [],
        items: [makeItem('item-1', 'Get User', 'query')],
      }],
      loading: false,
    } as ReturnType<typeof useGraphqlCollections>);

    render(
      <GraphqlImportFromCollectionModal
        nodeType="graphqlMutation"
        onImport={onImport}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByTestId('gql-wf-import-col-empty')).toHaveTextContent(/No saved mutation operations found/i);
  });

  it('shows search no-match state and count while filtering', () => {
    mockUseGraphqlCollections.mockReturnValue({
      trees: [{
        collection: {
          id: 'col-1',
          name: 'Shop',
          variables: {},
          preRequestScript: '',
          postResponseScript: '',
          createdAt: 1,
        },
        folders: [],
        items: [makeItem('item-1', 'List Orders', 'query')],
      }],
      loading: false,
    } as ReturnType<typeof useGraphqlCollections>);

    render(
      <GraphqlImportFromCollectionModal
        nodeType="graphqlQuery"
        onImport={onImport}
        onCancel={onCancel}
      />,
    );

    fireEvent.change(screen.getByTestId('gql-wf-import-col-search'), { target: { value: 'zzz' } });
    expect(screen.getByTestId('gql-wf-import-col-search-count')).toHaveTextContent('0/1');
    expect(screen.getByTestId('gql-wf-import-col-empty')).toHaveTextContent(/No operations match your search/i);
  });

  it('supports Escape and Enter keyboard handling on dialog', async () => {
    mockUseGraphqlCollections.mockReturnValue({
      trees: [{
        collection: {
          id: 'col-1',
          name: 'My API',
          variables: {},
          preRequestScript: '',
          postResponseScript: '',
          createdAt: 1,
        },
        folders: [],
        items: [
          makeItem('item-1', 'Get User', 'query'),
          makeItem('item-2', 'Watch User', 'subscription'),
        ],
      }],
      loading: false,
    } as ReturnType<typeof useGraphqlCollections>);

    render(
      <GraphqlImportFromCollectionModal
        nodeType="graphqlQuery"
        onImport={onImport}
        onCancel={onCancel}
      />,
    );

    const modal = screen.getByTestId('gql-wf-import-col-modal');
    fireEvent.keyDown(modal, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('gql-wf-import-col-item'));
    fireEvent.keyDown(modal, { key: 'Enter' });

    await waitFor(() => {
      expect(onImport).toHaveBeenCalled();
    });
    // Query modal filters out subscription item, so query badge path remains covered.
    expect(screen.getByText('Q')).toBeInTheDocument();
  });

  it('clears stale selection when filtered entries no longer include selected item', async () => {
    mockUseGraphqlCollections.mockReturnValue({
      trees: [{
        collection: {
          id: 'col-1',
          name: 'My API',
          variables: {},
          preRequestScript: '',
          postResponseScript: '',
          createdAt: 1,
        },
        folders: [],
        items: [makeItem('item-1', 'List Orders', 'query'), makeItem('item-2', 'Get Product', 'query')],
      }],
      loading: false,
    } as ReturnType<typeof useGraphqlCollections>);

    render(
      <GraphqlImportFromCollectionModal
        nodeType="graphqlQuery"
        onImport={onImport}
        onCancel={onCancel}
      />,
    );

    const selectedButton = screen.getByText('List Orders').closest('button');
    expect(selectedButton).toBeTruthy();
    fireEvent.click(selectedButton as HTMLButtonElement);
    expect(screen.getByTestId('gql-wf-import-col-import')).not.toBeDisabled();

    fireEvent.change(screen.getByTestId('gql-wf-import-col-search'), { target: { value: 'product' } });
    // selected item removed by filter, import button disables after effect clears stale selection
    await waitFor(() => {
      expect(screen.getByTestId('gql-wf-import-col-import')).toBeDisabled();
    });
  });

  it('shows subscription badge letter S for subscription operations', () => {
    mockUseGraphqlCollections.mockReturnValue({
      trees: [{
        collection: {
          id: 'col-1',
          name: 'Realtime',
          variables: {},
          preRequestScript: '',
          postResponseScript: '',
          createdAt: 1,
        },
        folders: [],
        items: [],
      }],
      loading: false,
    } as ReturnType<typeof useGraphqlCollections>);
    vi.spyOn(collectionItemImport, 'flattenCollectionImportEntries').mockReturnValue([
      { item: makeItem('sub-1', 'Live Feed', 'subscription'), collectionName: 'Realtime' },
    ]);

    render(
      <GraphqlImportFromCollectionModal
        nodeType="graphqlQuery"
        onImport={onImport}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByText('S')).toBeInTheDocument();
    vi.restoreAllMocks();
  });

});
