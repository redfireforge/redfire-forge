/**
 * GraphqlStudioPageOverlays — batch results, toasts, schema diff, and save-to-collection
 * modals extracted from GraphqlStudioPage for maintainability.
 */
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type {
  GraphqlBatchResult,
  GraphqlHistoryItem,
  GraphqlOperation,
  GraphqlSchemaInfo,
  GraphqlSchemaSnapshot,
  GraphqlStudioActivityTab,
} from '../../../shared/types/graphql';
import type { DiffModalState } from '../hooks/useGraphqlSchemaSnapshots';
import type { CollectionTree } from '../hooks/useGraphqlCollections';
import { GraphqlBatchResults } from './GraphqlBatchResults';
import { GqlPageToasts } from './GqlPageToasts';
import { GraphqlSchemaDiff } from './GraphqlSchemaDiff';
import { SaveToCollectionModal } from './GraphqlCollections';
import { resolveSaveToCollectionDefaultName } from '../utils/graphqlStudioUiUtils';

export interface GraphqlStudioPageOverlaysProps {
  batchResult: GraphqlBatchResult | null;
  batchResultsOpen: boolean;
  dismissBatchResults: () => void;
  schemaDiffToast: boolean;
  snapshots: GraphqlSchemaSnapshot[];
  toastBaselineSnapshotIdRef: MutableRefObject<string | null>;
  schemaInfo: GraphqlSchemaInfo | null;
  handleOpenDiff: (snapshot: GraphqlSchemaSnapshot) => void | Promise<void>;
  setRightView: (view: 'response' | 'schema') => void;
  setSchemaDiffToast: (v: boolean) => void;
  apqUnsupportedToast: boolean;
  setApqUnsupportedToast: (v: boolean) => void;
  batchUnsupportedToast: boolean;
  setBatchUnsupportedToast: (v: boolean) => void;
  diffModal: DiffModalState | null;
  setDiffModal: Dispatch<SetStateAction<DiffModalState | null>>;
  invalidItemIds: Set<string>;
  handleAcknowledge: (changePath: string, note: string) => void | Promise<void>;
  handleUnacknowledge: (changePath: string) => void | Promise<void>;
  saveToColItem: GraphqlHistoryItem | null;
  setSaveToColItem: Dispatch<SetStateAction<GraphqlHistoryItem | null>>;
  collectionTrees: CollectionTree[];
  onSaveToCollection: (
    collectionId: string,
    folderId: string | undefined,
    name: string,
    operation: GraphqlOperation,
  ) => Promise<unknown>;
  setActivityTab: (tab: GraphqlStudioActivityTab | null) => void;
}

export function GraphqlStudioPageOverlays({
  batchResult,
  batchResultsOpen,
  dismissBatchResults,
  schemaDiffToast,
  snapshots,
  toastBaselineSnapshotIdRef,
  schemaInfo,
  handleOpenDiff,
  setRightView,
  setSchemaDiffToast,
  apqUnsupportedToast,
  setApqUnsupportedToast,
  batchUnsupportedToast,
  setBatchUnsupportedToast,
  diffModal,
  setDiffModal,
  invalidItemIds,
  handleAcknowledge,
  handleUnacknowledge,
  saveToColItem,
  setSaveToColItem,
  collectionTrees,
  onSaveToCollection,
  setActivityTab,
}: GraphqlStudioPageOverlaysProps) {
  return (
    <>
      {batchResult && batchResultsOpen && (
        <GraphqlBatchResults result={batchResult} onDismiss={dismissBatchResults} />
      )}

      <GqlPageToasts
        schemaDiffToast={schemaDiffToast}
        snapshots={snapshots}
        toastBaselineSnapshotId={toastBaselineSnapshotIdRef.current}
        schemaInfo={schemaInfo}
        onViewDiff={handleOpenDiff}
        onSaveSnapshot={() => setRightView('schema')}
        onDismissSchemaDiff={() => setSchemaDiffToast(false)}
        apqUnsupportedToast={apqUnsupportedToast}
        onDismissApq={() => setApqUnsupportedToast(false)}
        batchUnsupportedToast={batchUnsupportedToast}
        onDismissBatch={() => setBatchUnsupportedToast(false)}
      />

      {diffModal && (
        <GraphqlSchemaDiff
          result={diffModal.result}
          oldSdl={diffModal.oldSdl}
          newSdl={diffModal.newSdl}
          oldLabel={diffModal.oldLabel}
          newLabel={diffModal.newLabel}
          snapshotId={diffModal.snapshotId}
          brokenItemCount={invalidItemIds.size}
          onAcknowledge={handleAcknowledge}
          onUnacknowledge={handleUnacknowledge}
          onClose={() => setDiffModal(null)}
        />
      )}

      {saveToColItem && (
        <SaveToCollectionModal
          defaultName={resolveSaveToCollectionDefaultName(saveToColItem.operation)}
          trees={collectionTrees}
          operationVariables={saveToColItem.operation.variables}
          onSave={(collectionId, folderId, name) => {
            onSaveToCollection(collectionId, folderId, name, saveToColItem.operation).catch(() => {});
            setSaveToColItem(null);
            setActivityTab('collections');
          }}
          onCancel={() => setSaveToColItem(null)}
        />
      )}
    </>
  );
}
