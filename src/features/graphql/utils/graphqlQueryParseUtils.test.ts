import { describe, it, expect } from 'vitest';
import { extractOperations, resolveGraphqlRequestOperationName } from './graphqlQueryParseUtils';

describe('resolveGraphqlRequestOperationName', () => {
  it('returns undefined for anonymous queries regardless of stored name', () => {
    expect(resolveGraphqlRequestOperationName('query { health }', 'HealthCheck')).toBeUndefined();
    expect(resolveGraphqlRequestOperationName('query { health }', 'Demo: Collections & History')).toBeUndefined();
    expect(resolveGraphqlRequestOperationName('query { health }')).toBeUndefined();
  });

  it('returns stored name when it matches a named operation in the document', () => {
    const query = 'query GetUsers { users { id } }';
    expect(resolveGraphqlRequestOperationName(query, 'GetUsers')).toBe('GetUsers');
  });

  it('returns the sole named operation when stored name is missing', () => {
    const query = 'query GetUsers { users { id } }';
    expect(resolveGraphqlRequestOperationName(query)).toBe('GetUsers');
  });

  it('returns undefined when stored name does not match any operation', () => {
    const query = 'query GetUsers { users { id } } mutation CreateUser { createUser { id } }';
    expect(resolveGraphqlRequestOperationName(query, 'WrongName')).toBeUndefined();
  });

  it('returns stored name for multi-operation documents when it matches', () => {
    const query = 'query GetUsers { users { id } } mutation CreateUser { createUser { id } }';
    expect(resolveGraphqlRequestOperationName(query, 'CreateUser')).toBe('CreateUser');
  });

  it('ignores names extracted from comments and strings', () => {
    expect(extractOperations('# query Fake { x }\nquery { health }')).toEqual([]);
    expect(resolveGraphqlRequestOperationName('# query Fake { x }\nquery { health }', 'Fake')).toBeUndefined();
  });
});
