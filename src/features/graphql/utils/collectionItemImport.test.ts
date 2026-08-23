import { describe, it, expect } from 'vitest';
import {
  buildWorkflowImportPatch,
  filterCollectionItemsForNodeType,
  flattenCollectionImportEntries,
  filterImportEntriesBySearch,
  resolveImportPatchForItem,
} from './collectionItemImport';
import type { GraphqlCollectionItem } from '@shared/types/graphql';
import type { ConnectionProfile } from './connectionProfileStorage';

function makeItem(
  overrides: Partial<GraphqlCollectionItem> & { operationType?: 'query' | 'mutation' | 'subscription' },
): GraphqlCollectionItem {
  const { operationType = 'query', ...rest } = overrides;
  return {
    id: 'item-1',
    collectionId: 'col-1',
    name: 'Get User',
    sortOrder: 0,
    operation: {
      id: 'op-1',
      query: 'query { user { id } }',
      variables: '{"id": "1"}',
      operationType,
    },
    createdAt: 1,
    updatedAt: 1,
    ...rest,
  };
}

describe('collectionItemImport', () => {
  describe('filterCollectionItemsForNodeType', () => {
    const items = [
      makeItem({ id: 'q1', operationType: 'query' }),
      makeItem({ id: 'm1', operationType: 'mutation' }),
      makeItem({ id: 's1', operationType: 'subscription' }),
    ];

    it('returns only queries for graphqlQuery node', () => {
      const filtered = filterCollectionItemsForNodeType(items, 'graphqlQuery');
      expect(filtered.map((i) => i.id)).toEqual(['q1']);
    });

    it('returns only mutations for graphqlMutation node', () => {
      const filtered = filterCollectionItemsForNodeType(items, 'graphqlMutation');
      expect(filtered.map((i) => i.id)).toEqual(['m1']);
    });
  });

  describe('flattenCollectionImportEntries', () => {
    it('groups items by collection and filters by node type', () => {
      const entries = flattenCollectionImportEntries(
        [
          {
            collection: { name: 'Alpha' },
            items: [
              makeItem({ id: 'a1', name: 'A Query', operationType: 'query' }),
              makeItem({ id: 'a2', name: 'A Mutation', operationType: 'mutation' }),
            ],
          },
          {
            collection: { name: 'Beta' },
            items: [makeItem({ id: 'b1', name: 'B Query', operationType: 'query' })],
          },
        ],
        'graphqlQuery',
      );
      expect(entries.map((e) => e.item.id)).toEqual(['a1', 'b1']);
      expect(entries[0].collectionName).toBe('Alpha');
    });
  });

  describe('filterImportEntriesBySearch', () => {
    const entries = flattenCollectionImportEntries(
      [{ collection: { name: 'Shop' }, items: [makeItem({ name: 'List Orders' })] }],
      'graphqlQuery',
    );

    it('returns all entries when search is empty', () => {
      expect(filterImportEntriesBySearch(entries, '')).toHaveLength(1);
    });

    it('filters by item name', () => {
      expect(filterImportEntriesBySearch(entries, 'orders')).toHaveLength(1);
      expect(filterImportEntriesBySearch(entries, 'missing')).toHaveLength(0);
    });
  });

  describe('buildWorkflowImportPatch', () => {
    it('copies query and variables from collection item', () => {
      const patch = buildWorkflowImportPatch(makeItem({}));
      expect(patch.query).toBe('query { user { id } }');
      expect(patch.variables).toBe('{"id": "1"}');
    });

    it('omits variables when item has empty variables string', () => {
      const item = makeItem({});
      item.operation.variables = '   ';
      const patch = buildWorkflowImportPatch(item);
      expect(patch.variables).toBeUndefined();
    });

    it('applies endpoint and auth from connection profile', () => {
      const profile: ConnectionProfile = {
        id: 'prof-1',
        name: 'Prod',
        endpoint: 'https://api.example.com/graphql',
        auth: { type: 'bearer', token: 'tok' },
        createdAt: 1,
      };
      const patch = buildWorkflowImportPatch(
        makeItem({ connectionId: 'prof-1' }),
        profile,
      );
      expect(patch.endpoint).toBe('https://api.example.com/graphql');
      expect(patch.auth).toEqual({ type: 'bearer', token: 'tok' });
    });

    it('skips endpoint when profile is missing', () => {
      const patch = buildWorkflowImportPatch(makeItem({ connectionId: 'missing' }), null);
      expect(patch.endpoint).toBeUndefined();
    });

    it('Phase 6F-14: roundtrip studio tab profile link via collection item connectionId', async () => {
      const staging: ConnectionProfile = {
        id: 'prof-staging',
        name: 'Staging',
        endpoint: 'https://staging.example.com/graphql',
        auth: { type: 'bearer', token: 'staging-token' },
        createdAt: 1,
      };
      const prod: ConnectionProfile = {
        id: 'prof-prod',
        name: 'Prod',
        endpoint: 'https://prod.example.com/graphql',
        auth: { type: 'bearer', token: 'prod-token' },
        createdAt: 2,
      };
      const catalog = [staging, prod];

      const stagingPatch = await resolveImportPatchForItem(
        makeItem({ connectionId: 'prof-staging', name: 'Tab1 Query' }),
        catalog,
      );
      expect(stagingPatch.endpoint).toBe(staging.endpoint);
      expect(stagingPatch.auth).toEqual(staging.auth);

      const prodPatch = await resolveImportPatchForItem(
        makeItem({ connectionId: 'prof-prod', name: 'Tab2 Query' }),
        catalog,
      );
      expect(prodPatch.endpoint).toBe(prod.endpoint);
      expect(prodPatch.auth).toEqual(prod.auth);

      const orphanPatch = await resolveImportPatchForItem(
        makeItem({ connectionId: 'deleted-profile' }),
        catalog,
      );
      expect(orphanPatch.endpoint).toBeUndefined();
      expect(orphanPatch.auth).toBeUndefined();
    });
  });

  describe('resolveImportPatchForItem', () => {
    it('resolves profile by connectionId', async () => {
      const profiles: ConnectionProfile[] = [{
        id: 'prof-1',
        name: 'Dev',
        endpoint: 'http://localhost:4010/graphql',
        auth: null,
        createdAt: 1,
      }];
      const patch = await resolveImportPatchForItem(
        makeItem({ connectionId: 'prof-1' }),
        profiles,
      );
      expect(patch.endpoint).toBe('http://localhost:4010/graphql');
    });

    it('falls back to null profile when connectionId is not found', async () => {
      const patch = await resolveImportPatchForItem(
        makeItem({ connectionId: 'missing' }),
        [{ id: 'other', name: 'X', endpoint: 'http://x', auth: null, createdAt: 1 }],
      );
      expect(patch.endpoint).toBeUndefined();
    });
  });
});
