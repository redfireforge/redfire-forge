import { describe, it, expect } from 'vitest';
import {
  buildModelUri,
  buildVarsModelUri,
  extractOperations,
  deriveTabLabel,
  deriveOperationType,
  resolveGraphqlRequestOperationName,
} from './graphqlQueryParseUtils';

describe('graphql model URIs', () => {
  it('buildModelUri returns stable query model URI', () => {
    expect(buildModelUri('tab-1')).toBe('inmemory://graphql/tab-1');
  });

  it('buildVarsModelUri returns stable variables model URI', () => {
    expect(buildVarsModelUri('tab-1')).toBe('inmemory://graphql-vars/tab-1');
  });
});

describe('extractOperations', () => {
  it('returns empty array for blank query', () => {
    expect(extractOperations('   ')).toEqual([]);
  });

  it('extracts named query, mutation, and subscription operations', () => {
    const query = [
      'query GetUsers { users { id } }',
      'mutation CreateUser { createUser { id } }',
      'subscription WatchUsers { usersChanged { id } }',
    ].join('\n');
    expect(extractOperations(query)).toEqual([
      { type: 'query', name: 'GetUsers' },
      { type: 'mutation', name: 'CreateUser' },
      { type: 'subscription', name: 'WatchUsers' },
    ]);
  });

  it('ignores operation-like text in comments and block strings', () => {
    const query = '# mutation Fake { x }\n"""query Hidden { y }"""\nquery RealOp { ok }';
    expect(extractOperations(query)).toEqual([{ type: 'query', name: 'RealOp' }]);
  });
});

describe('deriveTabLabel', () => {
  it('returns first operation name when present', () => {
    expect(deriveTabLabel('query HealthCheck { health }')).toBe('HealthCheck');
  });

  it('returns Untitled for anonymous operations', () => {
    expect(deriveTabLabel('query { health }')).toBe('Untitled');
  });
});

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

describe('deriveOperationType', () => {
  it('returns undefined for blank query', () => {
    expect(deriveOperationType('   ')).toBeUndefined();
  });

  it('derives type from first named operation', () => {
    expect(deriveOperationType('mutation CreateUser { createUser { id } }')).toBe('mutation');
  });

  it('derives query for bare selection-set documents', () => {
    expect(deriveOperationType('{ health }')).toBe('query');
  });

  it('derives type from anonymous operation keyword', () => {
    expect(deriveOperationType('subscription { updates { id } }')).toBe('subscription');
  });

  it('returns undefined when no operation shape is recognized', () => {
    expect(deriveOperationType('fragment UserFields on User { id }')).toBeUndefined();
  });
});
