/**
 * GraphQL test gallery preset factories.
 *
 * Two samples showing how to test GraphQL APIs using standard HTTP POST assertions:
 *  1. TG-GQL-01 — GraphQL Health Check (easy)       — introspection ping, assert __typename
 *  2. TG-GQL-02 — GraphQL Query & Mutation (medium)  — list query + create mutation
 */

import { ts, s } from './presets-helpers';
import type { FeatureGroup } from './presets-helpers';

const GQL_HEADERS = [{ key: 'Content-Type', value: 'application/json' }];

// ─── TG-GQL-01: GraphQL Health Check ─────────────────────────────────────────

export function createGraphQLHealthTest(): FeatureGroup {
  return {
    id: 'test-graphql-health',
    name: 'GraphQL Health Check',
    scenarios: [
      ts({
        id: 'sc-gql-health',
        name: 'Introspection Ping',
        tests: [
          s({
            id: 'sc-gql-health-typename',
            name: 'POST { __typename } → $.data.__typename === "Query"',
            url: 'https://countries.trevorblades.com/graphql',
            method: 'POST',
            headers: GQL_HEADERS,
            bodyType: 'json',
            body: JSON.stringify({ query: '{ __typename }' }),
            assertions: [
              { type: 'status', expected: '200' },
              { type: 'existence', jsonPath: '$.data', expectExists: true },
              { type: 'existence', jsonPath: '$.errors', expectExists: false },
              { type: 'regex', jsonPath: '$.data.__typename', pattern: '^Query$' },
            ],
            sampleJson: JSON.stringify({ data: { __typename: 'Query' } }),
          }),
        ],
      }),
    ],
  };
}

// ─── TG-GQL-02: GraphQL Query & Mutation ────────────────────────────────────

export function createGraphQLQueryMutationTest(): FeatureGroup {
  return {
    id: 'test-graphql-crud',
    name: 'GraphQL: Query & Mutation',
    scenarios: [
      ts({
        id: 'sc-gql-query',
        name: 'Query: List Posts',
        tests: [
          s({
            id: 'sc-gql-query-posts',
            name: 'query { posts { data { id title } } } → array length ≥ 1',
            url: 'https://graphqlzero.almansi.me/api',
            method: 'POST',
            headers: GQL_HEADERS,
            bodyType: 'json',
            body: JSON.stringify({ query: '{ posts { data { id title } } }' }),
            assertions: [
              { type: 'status', expected: '200' },
              { type: 'existence', jsonPath: '$.data.posts.data', expectExists: true },
              { type: 'arrayLength', jsonPath: '$.data.posts.data', operator: '>=', value: 1 },
              { type: 'existence', jsonPath: '$.errors', expectExists: false },
            ],
            sampleJson: JSON.stringify({
              data: { posts: { data: [{ id: '1', title: 'sunt aut facere repellat provident occaecati' }] } },
            }),
          }),
        ],
      }),
      ts({
        id: 'sc-gql-mutation',
        name: 'Mutation: Create Post',
        tests: [
          s({
            id: 'sc-gql-mutation-create',
            name: 'mutation createPost → $.data.createPost.id exists',
            url: 'https://graphqlzero.almansi.me/api',
            method: 'POST',
            headers: GQL_HEADERS,
            bodyType: 'json',
            body: JSON.stringify({
              query: `mutation {
  createPost(input: { title: "Test Post", body: "Gallery sample mutation" }) {
    id
    title
  }
}`,
            }),
            assertions: [
              { type: 'status', expected: '200' },
              { type: 'existence', jsonPath: '$.data.createPost', expectExists: true },
              { type: 'existence', jsonPath: '$.data.createPost.id', expectExists: true },
              { type: 'existence', jsonPath: '$.errors', expectExists: false },
            ],
            extractions: [
              { name: 'createdPostId', source: 'body', expression: '$.data.createPost.id' },
            ],
            sampleJson: JSON.stringify({
              data: { createPost: { id: '101', title: 'Test Post' } },
            }),
          }),
        ],
      }),
    ],
  };
}
