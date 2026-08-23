import type { GlobalAuthProfile } from '@shared/types';
import { GrpcAdvancedFeaturesShell } from '../components/GrpcAdvancedFeaturesShell';
import { GrpcCollectionsPanel } from '../components/GrpcCollectionsPanel';
import { GrpcExplorerPane } from '../components/GrpcExplorerPane';
import { GrpcHistoryPanel } from '../components/GrpcHistoryPanel';
import type { useGrpcCallHistory } from '../hooks/useGrpcCallHistory';
import type { useGrpcCollections } from '../hooks/useGrpcCollections';
import type { UseGrpcStudioAdvancedFeaturesReturn } from '../hooks/useGrpcStudioAdvancedFeatures';
import type { UseGrpcStudioReturn } from '../hooks/useGrpcStudio';
import type { useGrpcStudioReplayActions, GrpcStudioPanelView } from '../hooks/useGrpcStudioReplayActions';
import type { GrpcTabConnectionPageDefaults } from '../utils/resolveGrpcTabConnection';
import type { useGrpcStudioPageConnectionState } from './useGrpcStudioPageConnectionState';
import type { useGrpcStudioPageHistoryActions } from './useGrpcStudioPageHistoryActions';

type ConnectionState = ReturnType<typeof useGrpcStudioPageConnectionState>;
type HistoryActions = ReturnType<typeof useGrpcStudioPageHistoryActions>;

export interface GrpcStudioPagePanelsProps {
  panelView: GrpcStudioPanelView;
  studio: UseGrpcStudioReturn;
  collections: ReturnType<typeof useGrpcCollections>;
  callHistory: ReturnType<typeof useGrpcCallHistory>;
  advancedFeatures: UseGrpcStudioAdvancedFeaturesReturn;
  replayActions: ReturnType<typeof useGrpcStudioReplayActions>;
  connection: ConnectionState;
  historyActions: HistoryActions;
  envVarMap: Record<string, string>;
  pageDefaults: GrpcTabConnectionPageDefaults;
  globalAuthProfiles: GlobalAuthProfile[];
  defaultAuthProfileId: string | null;
  connectionChrome: React.ReactNode;
  selectedSavedId: string | null;
  onSelectSavedId: (id: string | null) => void;
  onSavedReplaySource: (tabId: string, source: { collectionId: string; savedId: string }) => void;
  lastUnaryResultForSelected: ReturnType<typeof import('../hooks/useGrpcStudioPageCollections').useGrpcSelectedSavedRequest>['lastUnaryResultForSelected'];
  openInStudioStatusForSelected: ReturnType<typeof import('../hooks/useGrpcStudioPageCollections').useGrpcSelectedSavedRequest>['openInStudioStatusForSelected'];
  compareSchemaStatusForSelected: ReturnType<typeof import('../hooks/useGrpcStudioPageCollections').useGrpcSelectedSavedRequest>['compareSchemaStatusForSelected'];
  runLoadTestStatusForSelected: ReturnType<typeof import('../hooks/useGrpcStudioPageCollections').useGrpcSelectedSavedRequest>['runLoadTestStatusForSelected'];
}

export function GrpcStudioPagePanels({
  panelView,
  studio,
  collections,
  callHistory,
  advancedFeatures,
  replayActions,
  connection,
  historyActions,
  envVarMap,
  pageDefaults,
  globalAuthProfiles,
  defaultAuthProfileId,
  connectionChrome,
  selectedSavedId,
  onSelectSavedId,
  onSavedReplaySource,
  lastUnaryResultForSelected,
  openInStudioStatusForSelected,
  compareSchemaStatusForSelected,
  runLoadTestStatusForSelected,
}: GrpcStudioPagePanelsProps) {
  const {
    activeConnection,
    authTabFocusRequest,
    canReflect,
    handleClearAuthSecretField,
    handleUnmaskAuthSecretField,
    incrementTabCallCount,
    openProtoModal,
    tlsState,
  } = connection;

  const {
    compareSavedRequestSchemaInAdvanced,
    copyTextToClipboard,
    grpcurlForHistoryEntry,
    grpcurlForSaved,
    openHistorySchemaDiff,
    replayHistoryEntryWithRestoredMetadata,
  } = historyActions;

  return (
    <>
      {replayActions.lastActionError && (
        <p
          className="grpc-panel-action-error"
          role="alert"
          data-testid="grpc-replay-action-error"
        >
          {replayActions.lastActionError}
        </p>
      )}
      {panelView === 'collections' && (
        <GrpcCollectionsPanel
          collections={collections}
          selectedSavedId={selectedSavedId}
          onSelectSaved={(saved) => onSelectSavedId(saved.id)}
          grpcurlForSaved={grpcurlForSaved}
          onOpenInStudio={(saved, collectionId) => {
            replayActions.clearLastActionError();
            replayActions.openSavedRequestInStudio(saved);
            onSavedReplaySource(studio.activeTab.id, { collectionId, savedId: saved.id });
          }}
          onCompareSchema={(saved, collectionId) => {
            replayActions.clearLastActionError();
            const opened = replayActions.openSavedRequestInStudio(saved);
            if (!opened) return;
            void compareSavedRequestSchemaInAdvanced(saved);
            onSavedReplaySource(studio.activeTab.id, { collectionId, savedId: saved.id });
          }}
          onRunLoadTest={(saved, collectionId) => {
            replayActions.clearLastActionError();
            const opened = replayActions.openSavedRequestForLoadTest(saved);
            if (!opened) return;
            advancedFeatures.setActiveFeatureTab('load_test');
            onSavedReplaySource(studio.activeTab.id, { collectionId, savedId: saved.id });
          }}
          onCopyGrpcurl={(command) => { void copyTextToClipboard(command); }}
          lastUnaryResult={lastUnaryResultForSelected}
          activeTab={studio.activeTab}
          openInStudioDisabled={!openInStudioStatusForSelected.executable}
          openInStudioTitle={openInStudioStatusForSelected.title}
          compareSchemaDisabled={!compareSchemaStatusForSelected.executable}
          compareSchemaTitle={compareSchemaStatusForSelected.title}
          runLoadTestDisabled={!runLoadTestStatusForSelected.executable}
          runLoadTestTitle={runLoadTestStatusForSelected.title}
          onSavedDeleted={(id) => {
            if (selectedSavedId === id) onSelectSavedId(null);
          }}
        />
      )}
      {panelView === 'history' && (
        <GrpcHistoryPanel
          history={callHistory}
          studio={studio}
          envVarMap={envVarMap}
          pageDefaults={pageDefaults}
          profiles={studio.profiles}
          onReplay={(entry) => {
            replayActions.clearLastActionError();
            replayHistoryEntryWithRestoredMetadata(entry);
          }}
          onOpenDiff={(entry) => {
            replayActions.clearLastActionError();
            const replayed = replayHistoryEntryWithRestoredMetadata(entry);
            if (!replayed) return;
            void openHistorySchemaDiff(entry);
          }}
          onCopyGrpcurl={(command) => { void copyTextToClipboard(command); }}
          grpcurlForEntry={grpcurlForHistoryEntry}
        />
      )}
      {panelView === 'advanced' && (
        <GrpcAdvancedFeaturesShell advanced={advancedFeatures} />
      )}
      {panelView === 'studio' && (() => {
        const tab = studio.activeTab;
        return (
          <div key={tab.id} className="grpc-tab-pane-wrapper">
            <GrpcExplorerPane
              tab={tab}
              tabPanelId={`grpc-tab-pane-${tab.id}`}
              connectionChrome={connectionChrome}
              descriptorState={studio.activeTabDescriptor}
              canReflect={canReflect}
              targetValid={activeConnection.targetValidation.valid}
              tlsValid={tlsState.valid}
              targetAddress={activeConnection.targetValidation.valid
                ? activeConnection.target
                : undefined}
              onReflect={() => { void studio.reflectTab(tab.id); }}
              onManageSchemas={() => openProtoModal()}
              onSelectMethod={(serviceFullName, methodName) => {
                studio.selectMethod(tab.id, serviceFullName, methodName);
              }}
              onToggleServiceExpanded={(serviceFullName) => {
                studio.toggleServiceExpanded(tab.id, serviceFullName);
              }}
              onTabPatch={(patch) => studio.updateTab(tab.id, patch)}
              onUnmaskAuthSecretField={handleUnmaskAuthSecretField}
              onClearAuthSecretField={handleClearAuthSecretField}
              onSendUnary={(overrides) => {
                incrementTabCallCount(tab.id);
                void studio.executeUnaryCall(tab.id, overrides);
              }}
              onCancelUnary={() => { void studio.cancelUnaryCall(tab.id); }}
              onStartStream={(overrides) => {
                incrementTabCallCount(tab.id);
                void studio.startStreamCall(tab.id, overrides);
              }}
              onCancelStream={() => { void studio.cancelStreamCall(tab.id); }}
              onSendStreamMessage={(overrides) => { void studio.sendStreamMessageCall(tab.id, overrides); }}
              onEnqueueStreamMessage={(overrides) => {
                studio.enqueueStreamMessage(tab.id, overrides?.body ?? tab.body);
              }}
              onRemovePendingStreamMessage={(index) => {
                studio.removePendingStreamMessage(tab.id, index);
              }}
              onSendAllPendingStreamMessages={() => studio.sendAllPendingStreamMessages(tab.id)}
              onEndStream={() => { void studio.endStreamCall(tab.id); }}
              onClearStreamLog={() => studio.clearStreamLog(tab.id)}
              onRetryUnaryWithExpress={() => studio.retryUnaryWithExpress(tab.id)}
              onRetryStreamWithExpress={() => studio.retryStreamWithExpress(tab.id)}
              onDismissSchemaDrift={() => studio.dismissSchemaDrift(tab.id)}
              onPruneSchemaDriftBody={() => studio.pruneSchemaDriftBody(tab.id)}
              onRebindSchemaDriftMethod={(serviceFullName, methodName) => {
                studio.rebindSchemaDriftMethod(tab.id, serviceFullName, methodName);
              }}
              authTabFocusRequest={authTabFocusRequest}
              globalAuthProfiles={globalAuthProfiles}
              defaultAuthProfileId={defaultAuthProfileId}
            />
          </div>
        );
      })()}
    </>
  );
}
