import { GrpcConnectionSettingsDrawer } from '../components/GrpcConnectionSettingsDrawer';
import { GrpcConsoleModal } from '../components/GrpcConsoleModal';
import { GrpcGrpcurlImportModal } from '../components/GrpcGrpcurlImportModal';
import { GrpcProtoManageModal } from '../components/GrpcProtoManageModal';
import { GrpcSaveRequestModal } from '../components/GrpcSaveRequestModal';
import { GrpcTlsPanel } from '../components/GrpcTlsPanel';
import { canChangeGrpcTabTransportMode, resolveGrpcStudioTabTransportMode } from '../grpcStudioTypes';
import type { useGrpcCollections } from '../hooks/useGrpcCollections';
import type { UseGrpcStudioReturn } from '../hooks/useGrpcStudio';
import type { useGrpcStudioReplayActions } from '../hooks/useGrpcStudioReplayActions';
import { sanitizeGrpcErrorMessage } from '../../../shared/grpc/grpcRedaction';
import {
  buildGrpcTlsConfigTabPatch,
  buildGrpcTlsModeTabPatch,
  buildGrpcTlsStateRestoreTabPatch,
} from '../utils/grpcStudioTlsTabPatches';
import type { useGrpcStudioPageConnectionState } from './useGrpcStudioPageConnectionState';
import type { GrpcConsoleWireEvent } from '../components/GrpcConsoleModal';

type ConnectionState = ReturnType<typeof useGrpcStudioPageConnectionState>;

export interface GrpcStudioPageOverlaysProps {
  studio: UseGrpcStudioReturn;
  collections: ReturnType<typeof useGrpcCollections>;
  replayActions: ReturnType<typeof useGrpcStudioReplayActions>;
  connection: ConnectionState;
  consoleOpen: boolean;
  onConsoleOpenChange: (open: boolean) => void;
  consoleEvents: GrpcConsoleWireEvent[];
  onClearConsoleEvents: () => void;
  saveModalOpen: boolean;
  onSaveModalOpenChange: (open: boolean) => void;
  importModalOpen: boolean;
  onImportModalOpenChange: (open: boolean) => void;
  resolveSaveSnapshot: ReturnType<typeof import('../hooks/useGrpcStudioPageCollections').useGrpcStudioSaveSnapshot>;
  onSaveComplete: (savedId: string) => void;
}

export function GrpcStudioPageOverlays({
  studio,
  collections,
  replayActions,
  connection,
  consoleOpen,
  onConsoleOpenChange,
  consoleEvents,
  onClearConsoleEvents,
  saveModalOpen,
  onSaveModalOpenChange,
  importModalOpen,
  onImportModalOpenChange,
  resolveSaveSnapshot,
  onSaveComplete,
}: GrpcStudioPageOverlaysProps) {
  const {
    activeTab,
    activeConnection,
    activeProtoIngest,
    closeProtoModal,
    connectionEditingDisabled,
    exportError,
    exportProtosetBusy,
    handleClearTlsSecretField,
    handleHealthCheck,
    handleHealthWatch,
    handleUnmaskTlsSecretField,
    healthAvailable,
    healthWatchAvailable,
    canReflect,
    protoModalInitialTab,
    protoModalOpen,
    resolvedTlsMode,
    setExportError,
    setExportProtosetBusy,
    setSettingsDrawerNav,
    setSettingsDrawerOpen,
    settingsDrawerNav,
    settingsDrawerOpen,
    settingsDrawerOpenRequest,
    tabCallTypes,
    tlsModalCloseRequest,
    tlsModalOpenRequest,
    tlsState,
  } = connection;

  return (
    <>
      <button
        type="button"
        className={`grpc-console-launcher${consoleOpen ? ' grpc-console-launcher--active' : ''}`}
        data-testid="grpc-console-launcher"
        onClick={() => onConsoleOpenChange(!consoleOpen)}
        title="Toggle console"
        aria-pressed={consoleOpen}
      >
        Console
        {consoleEvents.length > 0 && (
          <span className="grpc-console-launcher__count" data-testid="grpc-console-launcher-count">
            {consoleEvents.length}
          </span>
        )}
      </button>

      {consoleOpen && (
        <GrpcConsoleModal
          events={consoleEvents}
          onClearEvents={onClearConsoleEvents}
          onClose={() => onConsoleOpenChange(false)}
        />
      )}

      <GrpcSaveRequestModal
        open={saveModalOpen}
        collections={collections.collections}
        resolveSnapshot={resolveSaveSnapshot}
        onClose={() => onSaveModalOpenChange(false)}
        onCreateCollection={(name) => collections.addCollection(name)}
        onSave={async (collectionId, saved) => {
          await collections.saveRequest(collectionId, saved);
          onSaveComplete(saved.id);
        }}
      />

      <GrpcGrpcurlImportModal
        open={importModalOpen}
        onClose={() => onImportModalOpenChange(false)}
        onImport={replayActions.applyGrpcurlImport}
      />

      <GrpcTlsPanel
        key={`tls-modal-${activeTab.id}`}
        tlsMode={activeTab.tlsMode ?? activeConnection.tlsMode}
        tlsConfig={activeTab.tlsConfig}
        issues={tlsState.issues}
        maskedSecretFields={activeTab.maskedSecretFields?.tls}
        disabled={connectionEditingDisabled}
        openRequest={tlsModalOpenRequest}
        closeRequest={tlsModalCloseRequest}
        onTlsModeChange={(mode) => {
          studio.updateTab(activeTab.id, buildGrpcTlsModeTabPatch({ tab: activeTab, activeConnection }, mode));
        }}
        onTlsConfigChange={(patch) => {
          studio.updateTab(activeTab.id, buildGrpcTlsConfigTabPatch({ tab: activeTab, activeConnection }, patch));
        }}
        onTlsStateRestore={({ tlsMode, tlsConfig }) => {
          studio.updateTab(activeTab.id, buildGrpcTlsStateRestoreTabPatch(activeTab, { tlsMode, tlsConfig }));
        }}
        onUnmaskSecretField={handleUnmaskTlsSecretField}
        onClearSecretField={handleClearTlsSecretField}
      />

      <GrpcConnectionSettingsDrawer
        key={`settings-drawer-${activeTab.id}`}
        open={settingsDrawerOpen}
        activeNav={settingsDrawerNav}
        timeoutMs={activeTab.timeoutMs}
        maxResponseSizeMb={activeTab.maxResponseSizeMb ?? 4}
        keepaliveIntervalSec={activeTab.keepaliveIntervalSec ?? 30}
        compression={activeTab.compression}
        healthAvailable={healthAvailable}
        healthWatchAvailable={healthWatchAvailable}
        healthProbeReady={canReflect}
        healthBusy={connectionEditingDisabled}
        disabled={connectionEditingDisabled}
        onNavChange={setSettingsDrawerNav}
        onClose={() => setSettingsDrawerOpen(false)}
        onTimeoutMsChange={(timeoutMs) => studio.updateTab(activeTab.id, { timeoutMs })}
        onMaxResponseSizeMbChange={(maxResponseSizeMb) => studio.updateTab(activeTab.id, { maxResponseSizeMb })}
        onKeepaliveIntervalSecChange={(keepaliveIntervalSec) => studio.updateTab(activeTab.id, { keepaliveIntervalSec })}
        onCompressionChange={(compression) => studio.updateTab(activeTab.id, { compression })}
        onHealthCheck={handleHealthCheck}
        onHealthWatch={handleHealthWatch}
        transportMode={resolveGrpcStudioTabTransportMode(activeTab)}
        transportChangeBlocked={!canChangeGrpcTabTransportMode(activeTab)}
        onTransportModeChange={(mode) => studio.setTabTransportMode(activeTab.id, mode)}
        callType={tabCallTypes[activeTab.id]}
        k8sPortForward={activeTab.k8sPortForward}
        k8sAutomationScopeId={activeTab.id}
        onK8sPortForwardChange={(session) => studio.updateTab(activeTab.id, { k8sPortForward: session })}
        onK8sApplyTarget={(target) => studio.updateTab(activeTab.id, { target })}
        openRequest={settingsDrawerOpenRequest}
      />

      <GrpcProtoManageModal
        open={protoModalOpen}
        ingest={activeProtoIngest}
        loadState={studio.activeTabDescriptor.loadState}
        loadError={
          protoModalOpen && studio.activeTabDescriptor.loadState === 'error'
            ? studio.activeTabDescriptor.errorMessage
            : undefined
        }
        descriptor={studio.activeTabDescriptor.descriptor}
        targetAddress={activeConnection.targetValidation.valid
          ? activeConnection.target
          : undefined}
        tlsMode={resolvedTlsMode}
        selectedService={studio.activeTab.service}
        selectedMethod={studio.activeTab.method}
        initialTab={protoModalInitialTab}
        onClose={closeProtoModal}
        onIngestChange={(patch) => studio.patchTabProtoIngest(studio.activeTab.id, patch)}
        onSelectMethod={(serviceFullName, methodName) => {
          studio.selectMethod(studio.activeTab.id, serviceFullName, methodName);
        }}
        onOpenMethodInTab={(serviceFullName, methodName, requestBody) => {
          studio.selectMethod(studio.activeTab.id, serviceFullName, methodName);
          studio.updateTab(studio.activeTab.id, { body: requestBody });
          closeProtoModal();
        }}
        onLoad={() => {
          void studio.describeFromIngest(studio.activeTab.id);
        }}
        onExportProtoset={studio.activeTabDescriptor.descriptor
          ? async () => {
            setExportError(undefined);
            setExportProtosetBusy(true);
            try {
              await studio.exportProtoset(studio.activeTab.id);
            } catch (error) {
              const raw = error instanceof Error ? error.message : 'Failed to export protoset';
              setExportError(sanitizeGrpcErrorMessage(raw));
            } finally {
              setExportProtosetBusy(false);
            }
          }
          : undefined}
        exportProtosetBusy={exportProtosetBusy}
        exportError={exportError}
        grpcurlExportContext={studio.activeTab.grpcurlExportContext}
      />
    </>
  );
}
