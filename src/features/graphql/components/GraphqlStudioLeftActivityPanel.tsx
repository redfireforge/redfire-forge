/**
 * GraphqlStudioLeftActivityPanel — history, mock, and collections panels
 * in the GraphQL Studio activity sidebar.
 */
import type {
  GraphqlCollectionItem,
  GraphqlEnvironment,
  GraphqlHistoryItem,
  GraphqlSchemaInfo,
  GraphqlStudioActivityTab,
} from '@shared/types/graphql';
import { GraphqlHistoryPanel } from './GraphqlHistoryPanel';
import { GraphqlMockPanel } from './GraphqlMockPanel';
import { GraphqlCollections } from './GraphqlCollections';
import type { UseGraphqlHistoryResult } from '../hooks/useGraphqlHistory';
import type { UseGraphqlCollectionsResult } from '../hooks/useGraphqlCollections';
import type { UseGraphqlMockServerResult } from '../hooks/useGraphqlMockServer';
import type { GqlStudioTab } from '../utils/tabPersistence';
import { parseLatestHistoryRfResponse, buildGraphqlEnvSnapshot } from '../utils/graphqlStudioUiUtils';

export interface GraphqlStudioLeftActivityPanelProps {
  activityTab: GraphqlStudioActivityTab | null;
  activityPanelWidth: number;
  history: UseGraphqlHistoryResult;
  historyMaxItems: number;
  onHistoryMaxItemsChange: (max: number) => void;
  tabSchemaConnectionId: string | null;
  handleLoadHistoryItem: (item: GraphqlHistoryItem) => void;
  handleRunHistoryItem: (item: GraphqlHistoryItem) => void;
  setSaveToColItem: (item: GraphqlHistoryItem | null) => void;
  mockServer: UseGraphqlMockServerResult;
  schemaInfo: GraphqlSchemaInfo | null;
  collections: UseGraphqlCollectionsResult;
  invalidItemIds: Set<string>;
  handleRunCollection: (
    collectionId: string,
    folderId?: string,
    itemOverride?: GraphqlCollectionItem,
  ) => void;
  handleLoadCollectionItem: (item: GraphqlCollectionItem) => void;
  saveToColItem: GraphqlHistoryItem | null;
  activeTab: GqlStudioTab;
  activeEnvironment: GraphqlEnvironment | null;
}

export function GraphqlStudioLeftActivityPanel({
  activityTab,
  activityPanelWidth,
  history,
  historyMaxItems,
  onHistoryMaxItemsChange,
  tabSchemaConnectionId,
  handleLoadHistoryItem,
  handleRunHistoryItem,
  setSaveToColItem,
  mockServer,
  schemaInfo,
  collections,
  invalidItemIds,
  handleRunCollection,
  handleLoadCollectionItem,
  saveToColItem,
  activeTab,
  activeEnvironment,
}: GraphqlStudioLeftActivityPanelProps) {
  return (
    <div
      className={`gql-studio-left-panel${activityTab ? '' : ' gql-studio-left-panel--hidden'}`}
      style={activityTab ? { width: activityPanelWidth, flexShrink: 0 } : undefined}
      data-testid="gql-studio-left-panel"
    >
      {activityTab === 'history' && (
        <GraphqlHistoryPanel
          history={history}
          onLoadIntoEditor={handleLoadHistoryItem}
          onRunInEditor={handleRunHistoryItem}
          onSaveToCollection={(item) => setSaveToColItem(item)}
          maxItems={historyMaxItems}
          onMaxItemsChange={onHistoryMaxItemsChange}
          endpoint={tabSchemaConnectionId ?? ''}
        />
      )}
      {activityTab === 'mock' && (
        <GraphqlMockPanel mockServer={mockServer} schemaInfo={schemaInfo} />
      )}
      {activityTab === 'collections' && (
        <GraphqlCollections
          collections={collections}
          loading={collections.loading}
          invalidItemIds={invalidItemIds}
          onRunItem={(item) => handleRunCollection(item.collectionId, undefined, item)}
          onRunAll={(colId, folderId) => handleRunCollection(colId, folderId)}
          onLoadItem={handleLoadCollectionItem}
          currentOperation={
            saveToColItem
              ? saveToColItem.operation
              : {
                  id: activeTab.id,
                  name: activeTab.selectedOperation ?? undefined,
                  query: activeTab.query,
                  variables: activeTab.variables,
                  operationType: (activeTab.operationType ?? 'query') as 'query' | 'mutation' | 'subscription',
                }
          }
          onSaveComplete={() => setSaveToColItem(null)}
          lastRfResponse={parseLatestHistoryRfResponse(history.items)}
          envSnapshot={buildGraphqlEnvSnapshot(activeEnvironment)}
        />
      )}
    </div>
  );
}
