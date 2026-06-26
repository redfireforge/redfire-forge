/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { saveBatchResultsToHistory } from './saveBatchResultsToHistory';
import type { GraphqlBatchResult } from '../../../shared/types/graphql';
import type { GqlStudioTab } from '../utils/tabPersistence';

const makeTab = (id: string, query: string): GqlStudioTab => ({
  id,
  label: id,
  query,
  variables: '{}',
  headers: [],
  selectedOperation: undefined,
  operationType: 'query',
});

describe('saveBatchResultsToHistory', () => {
  it('saves one history entry per batch operation', async () => {
    const saveHistory = vi.fn().mockResolvedValue(undefined);
    const tabs = [makeTab('t1', 'query { health }'), makeTab('t2', 'query CheckHealth { health }')];
    const batchResult: GraphqlBatchResult = {
      batchUnsupported: false,
      results: [
        {
          index: 0,
          operationName: 'GetHealth',
          response: {
            data: { health: 'ok' },
            httpStatus: 200,
            httpHeaders: {},
            latencyMs: 12,
            timestamp: 1000,
          },
        },
        {
          index: 1,
          operationName: 'CheckHealth',
          response: {
            data: { health: 'ok' },
            httpStatus: 200,
            httpHeaders: {},
            latencyMs: 14,
            timestamp: 1001,
          },
        },
      ],
    };

    await saveBatchResultsToHistory(saveHistory, 'http://localhost:4010/graphql', tabs, batchResult);

    expect(saveHistory).toHaveBeenCalledTimes(2);
    expect(saveHistory).toHaveBeenNthCalledWith(1, expect.objectContaining({
      connectionId: 'http://localhost:4010/graphql',
      operation: expect.objectContaining({ id: 't1', name: 'GetHealth', query: 'query { health }' }),
    }));
    expect(saveHistory.mock.calls[0][0].response.extensions).toEqual({
      batchIndex: 0,
      batchSize: 2,
      batchUnsupported: false,
    });
  });

  it('no-ops when connection id is empty', async () => {
    const saveHistory = vi.fn();
    await saveBatchResultsToHistory(saveHistory, '  ', [makeTab('t1', 'q')], {
      batchUnsupported: false,
      results: [{
        index: 0,
        response: {
          data: null,
          httpStatus: 200,
          httpHeaders: {},
          latencyMs: 0,
          timestamp: 1,
        },
      }],
    });
    expect(saveHistory).not.toHaveBeenCalled();
  });
});
