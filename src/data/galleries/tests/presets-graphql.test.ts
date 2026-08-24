import { describe, it, expect } from 'vitest';
import {
  createGraphQLHealthTest,
  createGraphQLQueryMutationTest,
} from './presets-graphql';

describe('presets-graphql factories', () => {
  describe('createGraphQLHealthTest (TG-GQL-01)', () => {
    it('returns a valid FeatureGroup with id test-graphql-health', () => {
      const fg = createGraphQLHealthTest();
      expect(fg.id).toBe('test-graphql-health');
      expect(fg.name).toBe('GraphQL Health Check');
      expect(fg.scenarios).toHaveLength(1);
    });

    it('scenario has a POST request to countries.trevorblades.com/graphql', () => {
      const fg = createGraphQLHealthTest();
      const test = fg.scenarios[0].tests[0];
      expect(test.url).toBe('https://countries.trevorblades.com/graphql');
      expect(test.method).toBe('POST');
      expect(test.bodyType).toBe('json');
    });

    it('body contains { __typename } query', () => {
      const fg = createGraphQLHealthTest();
      const test = fg.scenarios[0].tests[0];
      const body = JSON.parse(test.body);
      expect(body.query).toBe('{ __typename }');
    });

    it('sets Content-Type: application/json header', () => {
      const fg = createGraphQLHealthTest();
      const test = fg.scenarios[0].tests[0];
      expect(test.headers).toContainEqual({ key: 'Content-Type', value: 'application/json' });
    });

    it('assertions include status 200, existence, and regex for Query', () => {
      const fg = createGraphQLHealthTest();
      const assertions = fg.scenarios[0].tests[0].validation.assertions ?? [];
      const types = assertions.map(a => a.type);
      expect(types).toContain('status');
      expect(types).toContain('existence');
      expect(types).toContain('regex');
    });

    it('asserts $.errors does not exist', () => {
      const fg = createGraphQLHealthTest();
      const assertions = fg.scenarios[0].tests[0].validation.assertions ?? [];
      const errorsAssertion = assertions.find(
        a => a.type === 'existence' && (a as { jsonPath?: string }).jsonPath === '$.errors',
      ) as { expectExists?: boolean } | undefined;
      expect(errorsAssertion?.expectExists).toBe(false);
    });
  });

  describe('createGraphQLQueryMutationTest (TG-GQL-02)', () => {
    it('returns a valid FeatureGroup with id test-graphql-crud', () => {
      const fg = createGraphQLQueryMutationTest();
      expect(fg.id).toBe('test-graphql-crud');
      expect(fg.name).toBe('GraphQL: Query & Mutation');
      expect(fg.scenarios).toHaveLength(2);
    });

    it('query scenario hits graphqlzero.almansi.me', () => {
      const fg = createGraphQLQueryMutationTest();
      const test = fg.scenarios[0].tests[0];
      expect(test.url).toBe('https://graphqlzero.almansi.me/api');
      expect(test.method).toBe('POST');
    });

    it('query body contains posts query', () => {
      const fg = createGraphQLQueryMutationTest();
      const test = fg.scenarios[0].tests[0];
      const body = JSON.parse(test.body);
      expect(body.query).toMatch(/posts/);
    });

    it('mutation scenario hits graphqlzero.almansi.me', () => {
      const fg = createGraphQLQueryMutationTest();
      const test = fg.scenarios[1].tests[0];
      expect(test.url).toBe('https://graphqlzero.almansi.me/api');
    });

    it('mutation body contains createPost', () => {
      const fg = createGraphQLQueryMutationTest();
      const test = fg.scenarios[1].tests[0];
      const body = JSON.parse(test.body);
      expect(body.query).toMatch(/createPost/);
    });

    it('mutation scenario extracts createdPostId', () => {
      const fg = createGraphQLQueryMutationTest();
      const test = fg.scenarios[1].tests[0];
      expect(test.extractions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'createdPostId' }),
        ]),
      );
    });

    it('mutation assertions include existence check on $.data.createPost', () => {
      const fg = createGraphQLQueryMutationTest();
      const assertions = fg.scenarios[1].tests[0].validation.assertions ?? [];
      const createPostAssertion = assertions.find(
        a => a.type === 'existence' && (a as { jsonPath?: string }).jsonPath === '$.data.createPost',
      );
      expect(createPostAssertion).toBeDefined();
    });
  });
});
