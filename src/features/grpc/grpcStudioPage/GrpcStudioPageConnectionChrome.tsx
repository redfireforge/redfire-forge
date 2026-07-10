import { GrpcConnectionBar } from '../components/GrpcConnectionBar';
import { GrpcTargetPanel } from '../components/GrpcTargetPanel';
import type { UseGrpcStudioReturn } from '../hooks/useGrpcStudio';
import type { GrpcTabConnectionPageDefaults } from '../utils/resolveGrpcTabConnection';
import type { useGrpcStudioPageConnectionState } from './useGrpcStudioPageConnectionState';

type ConnectionState = ReturnType<typeof useGrpcStudioPageConnectionState>;

export interface GrpcStudioPageConnectionChromeProps {
  studio: UseGrpcStudioReturn;
  envVarMap: Record<string, string>;
  workspaceDefaults: Record<string, string>;
  pageDefaults: GrpcTabConnectionPageDefaults;
  connection: ConnectionState;
  onSaveRequestClick: () => void;
  onImportGrpcurlClick: () => void;
}

export function GrpcStudioPageConnectionChrome({
  studio,
  envVarMap,
  workspaceDefaults,
  pageDefaults,
  connection,
  onSaveRequestClick,
  onImportGrpcurlClick,
}: GrpcStudioPageConnectionChromeProps) {
  const {
    activeTab,
    activeConnection,
    connectionEditingDisabled,
    handleDeadlineBadgeClick,
    handleFocusAuthTab,
    handleSettingsClick,
    handleTlsBadgeClick,
    reflectionLoadedCount,
    resolvedActiveAuthState,
    resolvedTlsMode,
    rawConnectionTarget,
    tlsState,
  } = connection;

  return (
    <>
      <GrpcConnectionBar
        target={activeTab.target}
        targetInvalid={!activeConnection.targetValidation.valid}
        tlsMode={resolvedTlsMode}
        tlsValid={tlsState.valid}
        auth={resolvedActiveAuthState.auth}
        timeoutMs={activeTab.timeoutMs}
        targetConnection={activeTab.targetConnection}
        disabled={connectionEditingDisabled}
        reflectionLoadedCount={reflectionLoadedCount}
        onTargetChange={(value) => studio.updateTab(activeTab.id, { target: value })}
        onConnectionToggle={() => studio.toggleTargetConnection(activeTab.id)}
        onTlsBadgeClick={handleTlsBadgeClick}
        onAuthBadgeClick={handleFocusAuthTab}
        onDeadlineBadgeClick={handleDeadlineBadgeClick}
        onSettingsClick={handleSettingsClick}
        onSaveRequestClick={onSaveRequestClick}
        onImportGrpcurlClick={onImportGrpcurlClick}
        saveRequestDisabled={!activeTab.service || !activeTab.method}
      />
      <GrpcTargetPanel
        target={activeTab.target}
        tlsMode={activeTab.tlsMode ?? activeConnection.tlsMode}
        fallbackTarget={
          activeTab.target.trim()
            ? ''
            : rawConnectionTarget
        }
        envVarMap={envVarMap}
        workspaceDefaults={workspaceDefaults}
        profiles={studio.profiles}
        connectionId={activeTab.connectionId}
        tabOverrides={activeTab.envVarOverrides}
        body={activeTab.body}
        metadata={activeTab.metadata}
        auth={activeTab.auth}
        pageDefaults={pageDefaults}
      />
    </>
  );
}
