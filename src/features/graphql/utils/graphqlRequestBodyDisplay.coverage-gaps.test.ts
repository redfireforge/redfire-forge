import { describe, it, expect } from 'vitest';
import {
  formatGraphqlQueryForDisplay,
  serializeGraphqlRequestBody,
} from './graphqlRequestBodyDisplay';

describe('graphqlRequestBodyDisplay — coverage gaps', () => {
  it('formatGraphqlQueryForDisplay prepends keyword when parse drops it', () => {
    const result = formatGraphqlQueryForDisplay('query { hello }');
    expect(result.toLowerCase()).toContain('query');
    expect(result).toContain('hello');
  });

  it('formatGraphqlQueryForDisplay returns normalized text on parse failure', () => {
    expect(formatGraphqlQueryForDisplay('not valid graphql {{{')).toBe('not valid graphql {{{');
  });

  it('formatGraphqlQueryForDisplay handles escaped newlines without keyword', () => {
    const result = formatGraphqlQueryForDisplay('{ hello }');
    expect(result).toContain('hello');
  });

  it('serializeGraphqlRequestBody graphqlView includes operation name and extras', () => {
    const body = {
      operationName: 'GetUser',
      query: 'query GetUser { user { id } }',
      variables: { id: '1' },
      extensions: { persistedQuery: { version: 1 } },
    };
    const text = serializeGraphqlRequestBody(body, { graphqlView: true });
    expect(text).toContain('Operation: GetUser');
    expect(text).toContain('Variables');
    expect(text).toContain('Additional fields');
    expect(text).toContain('persistedQuery');
  });

  it('serializeGraphqlRequestBody graphqlView skips empty operationName', () => {
    const text = serializeGraphqlRequestBody(
      { query: 'query { x }', variables: {}, operationName: '   ' },
      { graphqlView: true },
    );
    expect(text).not.toContain('Operation:');
    expect(text).toContain('query');
  });

  it('serializeGraphqlRequestBody returns fallback when JSON.stringify throws', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(serializeGraphqlRequestBody(circular)).toBe('// Could not serialize request body');
  });

  it('formatGraphqlQueryForDisplay returns printed query when keyword already present', () => {
    const result = formatGraphqlQueryForDisplay('query GetUser {\n  user { id }\n}');
    expect(result).toContain('GetUser');
    expect(result.toLowerCase()).toMatch(/^query/);
  });

  it('formatGraphqlQueryForDisplay prepends keyword when parse drops it from anonymous query', () => {
    const result = formatGraphqlQueryForDisplay('mutation { createUser { id } }');
    expect(result.toLowerCase()).toContain('mutation');
    expect(result).toContain('createUser');
  });

  it('serializeGraphqlRequestBody graphqlView without query shows operation only', () => {
    const text = serializeGraphqlRequestBody(
      { operationName: 'Ping', extensions: { trace: true } },
      { graphqlView: true },
    );
    expect(text).toContain('Operation: Ping');
    expect(text).toContain('Additional fields');
    expect(text).not.toContain('// Variables');
  });

  it('serializeGraphqlRequestBody graphqlView with empty variables object', () => {
    const text = serializeGraphqlRequestBody(
      { query: '{ ping }', variables: {} },
      { graphqlView: true },
    );
    expect(text).toContain('// Variables');
    expect(text).toContain('{}');
  });
});
