import type { GraphqlBatchResult } from '../../../shared/types/graphql';
import type { SaveHistoryParams } from '../hooks/useGraphqlHistory';
import type { GqlStudioTab } from '../utils/tabPersistence';
import { resolveGraphqlRequestOperationName } from './graphqlQueryParseUtils';

export type SaveHistoryFn = (params: SaveHistoryParams) => Promise<void>;

/** Persist each operation in a batch run to the connection-scoped history ring buffer. */
export async function saveBatchResultsToHistory(
  saveHistory: SaveHistoryFn,
  connectionId: string,
  tabs: readonly GqlStudioTab[],
  batchResult: GraphqlBatchResult,
): Promise<void> {
  const cid = connectionId.trim();
  if (!cid) return;

  await Promise.all(
    batchResult.results.map(async (opResult, i) => {
      const tab = tabs[i];
      if (!tab) return;

      const opName = opResult.operationName
        ?? resolveGraphqlRequestOperationName(tab.query, tab.selectedOperation);

      await saveHistory({
        connectionId: cid,
        operation: {
          id: tab.id,
          name: opName,
          query: tab.query,
          variables: tab.variables,
          operationType: (tab.operationType ?? 'query') as 'query' | 'mutation' | 'subscription',
        },
        response: {
          ...opResult.response,
          extensions: {
            ...(opResult.response.extensions ?? {}),
            batchIndex: opResult.index,
            batchSize: batchResult.results.length,
            batchUnsupported: batchResult.batchUnsupported,
          },
        },
      });
    }),
  );
}
