/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { graphqlLessons } from './graphql-lessons';

describe('graphqlLessons registry', () => {
  it('lists lessons in §3.1 canonical order (implemented slots only)', () => {
    expect(graphqlLessons.map((l) => l.id)).toEqual([
      'gql-first-query',         // GQL-1
      'gql-variables',           // GQL-2
      'gql-schema-exploration',  // GQL-3
      'gql-auth-headers',        // GQL-4
      'gql-https-tls',           // GQL-5
      'gql-mutations',           // GQL-6
      'gql-subscriptions',       // GQL-7
      'gql-query-builder',       // GQL-8
      'gql-collections-history', // GQL-9
      'gql-export-share',        // GQL-10
      'gql-performance-tracing', // GQL-11
      'gql-schema-diff',         // GQL-12
      'gql-mock-server',         // GQL-13
      'gql-multi-tab',           // GQL-14
      'gql-batch-execution',     // GQL-15
      'gql-workflow-integration',// GQL-16
      'gql-workflow-runner',     // GQL-17
      'gql-workflow-mutation',   // GQL-18
      'gql-workflow-subscription', // GQL-19
    ]);
  });

  it('places Schema Exploration at slot 3 (GQL-3)', () => {
    expect(graphqlLessons[2]?.id).toBe('gql-schema-exploration');
    expect(graphqlLessons[2]?.name).toBe('Schema Exploration');
  });
});
