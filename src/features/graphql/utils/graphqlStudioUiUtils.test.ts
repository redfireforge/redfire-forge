import { describe, it, expect } from 'vitest';
import {
  resolveSaveToCollectionDefaultName,
  parseLatestHistoryRfResponse,
  buildGraphqlEnvSnapshot,
} from './graphqlStudioUiUtils';
import type { GraphqlHistoryItem } from '../../../shared/types/graphql';

describe('resolveSaveToCollectionDefaultName', () => {
  it('prefers operation name when present', () => {
    expect(resolveSaveToCollectionDefaultName({ name: 'MyQuery', operationType: 'query' })).toBe('MyQuery');
  });

  it('falls back to operationType when name is missing', () => {
    expect(resolveSaveToCollectionDefaultName({ operationType: 'mutation' })).toBe('mutation');
  });

  it('uses Unnamed operation when both name and operationType are missing', () => {
    expect(resolveSaveToCollectionDefaultName({})).toBe('Unnamed operation');
  });
});

describe('parseLatestHistoryRfResponse', () => {
  it('parses the newest history item', () => {
    const items = [{
      id: 'h1',
      connectionId: 'conn',
      operation: { id: 'op', query: 'q', variables: '{}', operationType: 'query' as const },
      response: JSON.stringify({ data: { ok: true }, httpStatus: 201 }),
      latencyMs: 42,
      timestamp: Date.now(),
    }] satisfies GraphqlHistoryItem[];

    expect(parseLatestHistoryRfResponse(items)).toEqual({
      httpStatus: 201,
      httpHeaders: {},
      data: { ok: true },
      errors: undefined,
      latencyMs: 42,
    });
  });

  it('returns undefined for empty history or invalid JSON', () => {
    expect(parseLatestHistoryRfResponse([])).toBeUndefined();
    expect(parseLatestHistoryRfResponse([{
      id: 'h1',
      connectionId: 'conn',
      operation: { id: 'op', query: 'q', variables: '{}', operationType: 'query' as const },
      response: 'not-json',
      latencyMs: 1,
      timestamp: Date.now(),
    }])).toBeUndefined();
  });
});

describe('buildGraphqlEnvSnapshot', () => {
  it('includes only enabled variables with non-blank keys', () => {
    expect(buildGraphqlEnvSnapshot({
      id: 'env-1',
      name: 'Dev',
      variables: [
        { key: 'API_KEY', value: 'secret', enabled: true },
        { key: '  ', value: 'x', enabled: true },
        { key: 'OFF', value: 'nope', enabled: false },
      ],
    })).toEqual({ API_KEY: 'secret' });
  });

  it('returns empty snapshot when environment is missing', () => {
    expect(buildGraphqlEnvSnapshot(null)).toEqual({});
    expect(buildGraphqlEnvSnapshot(undefined)).toEqual({});
  });
});
