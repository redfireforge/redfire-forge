import { describe, it, expect, vi } from 'vitest';
import type { GraphqlBatchResult, GraphqlResponse } from '@shared/types/graphql';
import type { GqlStudioTab } from './tabPersistence';
import {
  applyBatchTabResponseSyncs,
  buildBatchTabResponseSyncs,
  deriveExecutionStatusFromGraphqlResponse,
  syncBatchResultsToTabResponses,
} from './syncBatchResultsToTabResponses';

const makeResponse = (overrides: Partial<GraphqlResponse> = {}): GraphqlResponse => ({
  httpStatus: 200,
  httpHeaders: {},
  latencyMs: 10,
  timestamp: Date.now(),
  data: { ok: true },
  ...overrides,
});

const makeTab = (id: string): GqlStudioTab => ({
  id,
  label: id,
  query: 'query { test }',
  variables: '',
  headers: [],
  selectedOperation: '',
  operationType: 'query',
  connectionId: null,
  schemaStatus: 'none',
  activeEnvironmentId: null,
});

describe('deriveExecutionStatusFromGraphqlResponse', () => {
  it('returns success for 200 with data', () => {
    expect(deriveExecutionStatusFromGraphqlResponse(makeResponse())).toBe('success');
  });

  it('returns success for partial errors with data', () => {
    expect(deriveExecutionStatusFromGraphqlResponse(makeResponse({
      errors: [{ message: 'field failed' }],
    }))).toBe('success');
  });

  it('returns error for errors-only response', () => {
    expect(deriveExecutionStatusFromGraphqlResponse(makeResponse({
      data: null,
      errors: [{ message: 'bad' }],
    }))).toBe('error');
  });

  it('returns error for HTTP failures', () => {
    expect(deriveExecutionStatusFromGraphqlResponse(makeResponse({ httpStatus: 500, data: null }))).toBe('error');
    expect(deriveExecutionStatusFromGraphqlResponse(makeResponse({ httpStatus: 0, data: null }))).toBe('error');
  });

  it('returns success for Apollo-style batch HTTP 400 when operation has data', () => {
    expect(deriveExecutionStatusFromGraphqlResponse(makeResponse({
      httpStatus: 400,
      data: { health: 'ok' },
    }))).toBe('success');
  });

  it('returns error for Apollo-style batch HTTP 400 when operation has errors only', () => {
    expect(deriveExecutionStatusFromGraphqlResponse(makeResponse({
      httpStatus: 400,
      data: null,
      errors: [{ message: 'Cannot query field "nonexistent"' }],
    }))).toBe('error');
  });
});

describe('buildBatchTabResponseSyncs', () => {
  it('maps batch results to tabs by index', () => {
    const tabs = [makeTab('a'), makeTab('b')];
    const batchResult: GraphqlBatchResult = {
      batchUnsupported: false,
      results: [
        { index: 0, response: makeResponse({ data: { n: 1 } }) },
        { index: 1, response: makeResponse({ data: null, errors: [{ message: 'fail' }] }) },
      ],
    };

    expect(buildBatchTabResponseSyncs(tabs, batchResult)).toEqual([
      { tabId: 'a', status: 'success', response: batchResult.results[0]!.response },
      { tabId: 'b', status: 'error', response: batchResult.results[1]!.response },
    ]);
  });
});

describe('syncBatchResultsToTabResponses', () => {
  it('updates cache and tab execution for each batched tab', () => {
    const cacheExecutionResult = vi.fn();
    const applyTabResult = vi.fn();
    const tabs = [makeTab('a'), makeTab('b')];
    const batchResult: GraphqlBatchResult = {
      batchUnsupported: false,
      results: [
        { index: 0, response: makeResponse({ data: { n: 1 } }) },
        { index: 1, response: makeResponse({ data: { n: 2 } }) },
      ],
    };

    syncBatchResultsToTabResponses(tabs, batchResult, { cacheExecutionResult, applyTabResult });

    expect(cacheExecutionResult).toHaveBeenCalledTimes(2);
    expect(applyTabResult).toHaveBeenCalledTimes(2);
    expect(cacheExecutionResult).toHaveBeenCalledWith('a', 'success', batchResult.results[0]!.response);
    expect(applyTabResult).toHaveBeenCalledWith('b', 'success', batchResult.results[1]!.response);
  });

  it('applyBatchTabResponseSyncs is a thin wrapper over sync entries', () => {
    const cacheExecutionResult = vi.fn();
    const applyTabResult = vi.fn();
    applyBatchTabResponseSyncs(
      [{ tabId: 'x', status: 'error', response: makeResponse({ httpStatus: 400, data: null }) }],
      { cacheExecutionResult, applyTabResult },
    );
    expect(cacheExecutionResult).toHaveBeenCalledWith('x', 'error', expect.objectContaining({ httpStatus: 400 }));
    expect(applyTabResult).toHaveBeenCalledWith('x', 'error', expect.objectContaining({ httpStatus: 400 }));
  });
});
