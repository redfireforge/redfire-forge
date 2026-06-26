import { describe, expect, it } from 'vitest';
import {
  formatGraphqlQueryForDisplay,
  serializeGraphqlRequestBody,
} from './graphqlRequestBodyDisplay';

describe('graphqlRequestBodyDisplay', () => {
  const sampleBody = {
    query: 'query GetUser($id: ID!) {\\n  user(id: $id) {\\n    id\\n    name\\n  }\\n}',
    variables: { id: 'usr-3' },
    operationName: 'GetUser',
  };

  it('serializes raw JSON by default', () => {
    const text = serializeGraphqlRequestBody(sampleBody);
    expect(text).toContain('"query"');
    expect(text).toContain('"variables"');
    expect(text).toContain('usr-3');
  });

  it('graphql view expands query and always shows variables block', () => {
    const text = serializeGraphqlRequestBody(sampleBody, { graphqlView: true });
    expect(text).toContain('// Operation: GetUser');
    expect(text).toContain('query GetUser($id: ID!)');
    expect(text).toContain('user(id: $id)');
    expect(text).not.toContain('\\n');
    expect(text).toContain('// Variables');
    expect(text).toContain('"id": "usr-3"');
  });

  it('formatGraphqlQueryForDisplay keeps query keyword for anonymous operations', () => {
    const formatted = formatGraphqlQueryForDisplay('query { health }');
    expect(formatted).toMatch(/^query\s*\{/);
    expect(formatted).toContain('health');
    expect(formatted).toContain('\n');
  });

  it('formatGraphqlQueryForDisplay keeps mutation keyword', () => {
    const formatted = formatGraphqlQueryForDisplay('mutation { createUser }');
    expect(formatted).toMatch(/^mutation\s*\{/);
    expect(formatted).toContain('createUser');
  });

  it('formatGraphqlQueryForDisplay decodes escaped newlines on parse failure', () => {
    const formatted = formatGraphqlQueryForDisplay('not valid graphql\\nsecond line');
    expect(formatted).toBe('not valid graphql\nsecond line');
  });

  it('graphql view shows empty variables object', () => {
    const text = serializeGraphqlRequestBody(
      { query: 'query { health }', variables: {} },
      { graphqlView: true },
    );
    expect(text).toContain('query {');
    expect(text).toContain('health');
    expect(text).toContain('// Variables');
    expect(text).toContain('{}');
  });

  it('graphql view includes additional fields when present', () => {
    const text = serializeGraphqlRequestBody(
      { query: 'query { health }', variables: {}, extensions: { persistedQuery: { sha256Hash: 'abc' } } },
      { graphqlView: true },
    );
    expect(text).toContain('// Additional fields');
    expect(text).toContain('persistedQuery');
  });
});
