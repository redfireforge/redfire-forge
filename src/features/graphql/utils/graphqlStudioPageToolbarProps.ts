import type { ComponentProps, Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { GlobalAuthProfile } from '../../../shared/types';
import type {
  GraphqlAuth,
  GraphqlEnvironment,
  GraphqlSchemaInfo,
  SubscriptionState,
} from '../../../shared/types/graphql';
import type { EndpointRowStatus } from '../../environments/utils/protocolEndpointUtils';
import type { ComplexityResult } from './complexityEstimator';
import type { ConnectionProfile } from './connectionProfileStorage';
import type { GqlStudioTab } from './tabPersistence';
import { buildStudioTabLinkSlices } from './profileTabUsage';
import type { AdvancedSettingsValues } from '../components/GraphqlAdvancedSettings';
import type { GqlBatchSettingsPanelProps } from '../components/GqlBatchSettingsPanel';
import { GqlConnectionModals } from '../components/GqlConnectionModals';
import { GraphqlConnectionBar } from '../components/GraphqlConnectionBar';
import { GraphqlAdvancedSettings } from '../components/GraphqlAdvancedSettings';
import { GraphqlStudioPageDialogs } from '../components/GraphqlStudioPageDialogs';
import type { GqlAuthBadgePresentation } from './authUtils';

type ConnectionModalsProps = ComponentProps<typeof GqlConnectionModals>;

export interface GraphqlStudioPageToolbarSections {
  connectionBar: ComponentProps<typeof GraphqlConnectionBar>;
  advancedSettings: ComponentProps<typeof GraphqlAdvancedSettings>;
  dialogs: ComponentProps<typeof GraphqlStudioPageDialogs>;
}

export interface GraphqlStudioPageToolbarBuilderInput {
  tab: {
    activeTab: GqlStudioTab;
    activeTabId: string;
    tabs: GqlStudioTab[];
    operations: string[];
    selectedOperation: string | null | undefined;
    varsError: string | null | undefined;
    queryValidationErrorCount: number;
    fileEntries: Array<{ error: unknown }>;
  };
  connection: {
    resolvedTabEndpoint: string;
    resolvedTabAuth: GraphqlAuth | null;
    resolvedTabSkipTlsVerify: boolean;
    resolvedTabTls: { caCert?: string; clientCert?: string; clientKey?: string };
    resolvedTabPollingEnabled: boolean;
    resolvedTabPollingIntervalSeconds: number;
    hasActiveTabEndpointOverride: boolean;
    hasActiveTabProfileLink: boolean;
    hasActiveTabPollingOverride: boolean;
    hasPendingProfileEndpoint: boolean;
    endpoint: string;
    pageDefaultEndpointResolved: string;
    recentEndpoints: string[];
    profiles: ConnectionProfile[];
    activeEnvironment: GraphqlEnvironment | null;
    globalEnvMap: Record<string, string>;
    endpointProtocolStatus: EndpointRowStatus | undefined;
    pollErrorMessage: string | null;
    globalAuthProfiles: GlobalAuthProfile[];
    authBadgePresentation: GqlAuthBadgePresentation;
  };
  execution: {
    handleExecute: () => void;
    handleCancel: () => void;
    isActiveTabExecuting: boolean;
    handleSubscribe: () => void;
    handleStopSubscription: () => void;
    handleSelectOperation: (name: string) => void;
    handleSubscriptionTransportChange: (
      transport: 'auto' | 'graphql-transport-ws' | 'graphql-ws' | 'sse',
    ) => void;
    subscriptionState: SubscriptionState;
    complexityResult: ComplexityResult | null;
    activeTabApqInfo: { cacheHit?: boolean; hash?: string; unsupported?: boolean } | null | undefined;
  };
  schema: {
    connectionBarSchemaStatus: 'loaded' | 'error' | 'none';
    schemaInfo: GraphqlSchemaInfo | null;
    introspecting: boolean;
    handleIntrospect: () => void;
  };
  connectionHandlers: {
    handleConnectionEndpointChange: (url: string) => void;
    clearActiveTabEndpoint: () => void;
    handleConnectionSkipTlsChange: (skip: boolean) => void;
    handleConnectionTlsChange: (patch: Partial<{
      skipTlsVerify: boolean;
      caCert?: string;
      clientCert?: string;
      clientKey?: string;
    }>) => void;
    handleConnectionPollingChange: (enabled: boolean, intervalSeconds: number) => void;
    clearActiveTabPolling: () => void;
    removeRecentEndpoint: (url: string) => void;
    focusAuthPanel: () => void;
  };
  batch: {
    advSettings: AdvancedSettingsValues;
    advSettingsOpen: boolean;
    advSettingsBtnRef: MutableRefObject<HTMLButtonElement | null>;
    setAdvSettingsOpen: Dispatch<SetStateAction<boolean>>;
    batchSettingsProps: GqlBatchSettingsPanelProps;
    batchSummaryLabel: string | null;
    batchExecuting: boolean;
    batchEndpointMismatch: boolean;
    batchEndpointReady: boolean;
    batchProfileLinkPending: boolean;
    effectiveBatchedTabs: GqlStudioTab[];
    handleSendBatch: () => void;
    handleAdvSettingsSave: (saved: AdvancedSettingsValues) => void;
    handleAdvSettingsCancel: () => void;
  };
  dialogs: {
    complexityGatePending: boolean;
    complexityResult: ComplexityResult | null;
    pendingExecuteAfterGateRef: MutableRefObject<(() => void) | null>;
    sessionBypassComplexityGateRef: MutableRefObject<boolean>;
    skipComplexityGateRef: MutableRefObject<boolean>;
    setComplexityGatePending: (v: boolean) => void;
    setComplexityWarningPending: (v: boolean) => void;
    isDuplicate: boolean;
    duplicateSourceTabId: string | null;
    resolveDedupChoice: (choice: 'wait' | 'cancel' | 'sendAnyway') => void;
  };
  modals: {
    profileModalOpen: boolean;
    setProfileModalOpen: (open: boolean) => void;
    envModalOpen: boolean;
    setEnvModalOpen: (open: boolean) => void;
    saveProfile: (name: string, endpoint: string, auth: GraphqlAuth | null) => unknown;
    deleteProfile: (id: string) => void;
    clearConnectionIdsForProfile: (id: string) => void;
    applyProfileToActiveTab: ConnectionModalsProps['onApplyProfileToActiveTab'];
    prevBaseUrlRef: ConnectionModalsProps['prevBaseUrlRef'];
    createEnvironment: ConnectionModalsProps['onCreateEnvironment'];
    deleteEnvironment: ConnectionModalsProps['onDeleteEnvironment'];
    setActiveEnvironment: ConnectionModalsProps['onSetActiveEnvironment'];
    updateEnvironmentName: ConnectionModalsProps['onRenameEnvironment'];
    updateVariables: ConnectionModalsProps['onUpdateVariables'];
    importEnvironment: ConnectionModalsProps['onImportEnvironment'];
    exportEnvironment: ConnectionModalsProps['onExportEnvironment'];
    environments: ConnectionModalsProps['environments'];
  };
}

export function buildGraphqlStudioPageToolbarProps(
  input: GraphqlStudioPageToolbarBuilderInput,
): GraphqlStudioPageToolbarSections {
  const { tab, connection, execution, schema, connectionHandlers, batch, dialogs, modals } = input;
  const { activeTab, activeTabId, tabs, operations, selectedOperation, varsError, queryValidationErrorCount, fileEntries } = tab;
  const {
    resolvedTabEndpoint,
    resolvedTabAuth,
    resolvedTabSkipTlsVerify,
    resolvedTabTls,
    resolvedTabPollingEnabled,
    resolvedTabPollingIntervalSeconds,
    hasActiveTabEndpointOverride,
    hasActiveTabProfileLink,
    hasActiveTabPollingOverride,
    hasPendingProfileEndpoint,
    endpoint,
    pageDefaultEndpointResolved,
    recentEndpoints,
    profiles,
    activeEnvironment,
    globalEnvMap,
    endpointProtocolStatus,
    pollErrorMessage,
    globalAuthProfiles,
    authBadgePresentation,
  } = connection;

  return {
    connectionBar: {
      endpoint: resolvedTabEndpoint,
      onEndpointChange: connectionHandlers.handleConnectionEndpointChange,
      hasEndpointOverride: hasActiveTabEndpointOverride || hasActiveTabProfileLink,
      onClearEndpoint: connectionHandlers.clearActiveTabEndpoint,
      onExecute: execution.handleExecute,
      onCancel: execution.handleCancel,
      executing: execution.isActiveTabExecuting,
      introspecting: schema.introspecting,
      onIntrospect: schema.handleIntrospect,
      schemaStatus: schema.connectionBarSchemaStatus,
      typesCount: schema.schemaInfo?.types?.length,
      schemaPolling: resolvedTabPollingEnabled,
      operations,
      selectedOperation: selectedOperation ?? undefined,
      onSelectOperation: execution.handleSelectOperation,
      varsInvalid: varsError != null,
      queryEmpty: !activeTab.query.trim(),
      fileErrors: fileEntries.some((e) => e.error !== null),
      queryValidationErrors: queryValidationErrorCount,
      auth: resolvedTabAuth,
      onFocusAuthPanel: connectionHandlers.focusAuthPanel,
      authBadgePresentation,
      globalAuthProfiles,
      recentEndpoints,
      onRemoveRecentEndpoint: connectionHandlers.removeRecentEndpoint,
      activeEnvName: activeEnvironment?.name ?? null,
      activeEnvironment,
      globalEnvMap,
      endpointProtocolStatus,
      onEnvBadgeClick: () => modals.setEnvModalOpen(true),
      profiles,
      onProfileBadgeClick: () => modals.setProfileModalOpen(true),
      skipTlsVerify: resolvedTabSkipTlsVerify,
      onSkipTlsVerifyChange: connectionHandlers.handleConnectionSkipTlsChange,
      tlsCaCert: resolvedTabTls.caCert,
      tlsClientCert: resolvedTabTls.clientCert,
      tlsClientKey: resolvedTabTls.clientKey,
      onTlsSettingsChange: connectionHandlers.handleConnectionTlsChange,
      pollingEnabled: resolvedTabPollingEnabled,
      pollingIntervalSeconds: resolvedTabPollingIntervalSeconds,
      onPollingChange: connectionHandlers.handleConnectionPollingChange,
      hasPollingOverride: hasActiveTabPollingOverride,
      onClearPolling: connectionHandlers.clearActiveTabPolling,
      endpointLinkPending: hasPendingProfileEndpoint,
      pollErrorMessage,
      activeOperationType: activeTab.operationType ?? null,
      subscriptionState: execution.subscriptionState,
      onSubscribe: execution.handleSubscribe,
      onStop: execution.handleStopSubscription,
      subscriptionTransport: activeTab.subscriptionTransport ?? 'auto',
      onSubscriptionTransportChange: execution.handleSubscriptionTransportChange,
      complexityScore: execution.complexityResult?.score,
      complexityLevel: execution.complexityResult?.level,
      advancedSettingsOpen: batch.advSettingsOpen,
      onAdvancedSettingsClick: () => batch.setAdvSettingsOpen((v) => !v),
      advSettingsBtnRef: batch.advSettingsBtnRef,
      batchEnabled: batch.advSettings.batchEnabled,
      batchedTabCount: batch.effectiveBatchedTabs.length,
      batchSummaryLabel: batch.batchSummaryLabel,
      batchExecuting: batch.batchExecuting,
      batchEndpointMismatch: batch.batchEndpointMismatch,
      batchEndpointReady: batch.batchEndpointReady,
      batchProfileLinkPending: batch.batchProfileLinkPending,
      onSendBatch: batch.handleSendBatch,
      apqCacheHit: execution.activeTabApqInfo?.cacheHit,
      apqHash: execution.activeTabApqInfo?.hash,
      apqUnsupported: execution.activeTabApqInfo?.unsupported,
    },
    advancedSettings: {
      values: batch.advSettings,
      onSave: batch.handleAdvSettingsSave,
      onClose: batch.handleAdvSettingsCancel,
      anchorRef: batch.advSettingsBtnRef,
      open: batch.advSettingsOpen,
      batchSettings: batch.advSettingsOpen ? batch.batchSettingsProps : null,
    },
    dialogs: {
      complexityGatePending: dialogs.complexityGatePending,
      complexityResult: dialogs.complexityResult,
      advSettings: batch.advSettings,
      pendingExecuteAfterGateRef: dialogs.pendingExecuteAfterGateRef,
      sessionBypassComplexityGateRef: dialogs.sessionBypassComplexityGateRef,
      skipComplexityGateRef: dialogs.skipComplexityGateRef,
      setComplexityGatePending: dialogs.setComplexityGatePending,
      setComplexityWarningPending: dialogs.setComplexityWarningPending,
      isDuplicate: dialogs.isDuplicate,
      duplicateSourceTabId: dialogs.duplicateSourceTabId,
      activeTabId,
      resolveDedupChoice: dialogs.resolveDedupChoice,
      connectionModals: {
        profileModalOpen: modals.profileModalOpen,
        onProfileModalClose: () => modals.setProfileModalOpen(false),
        profiles,
        studioTabs: buildStudioTabLinkSlices(tabs, profiles, endpoint, pageDefaultEndpointResolved),
        activeTabId,
        activeConnectionId: activeTab.connectionId ?? null,
        endpoint: resolvedTabEndpoint,
        auth: resolvedTabAuth,
        globalAuthProfiles,
        onSaveProfile: (name) => modals.saveProfile(name, resolvedTabEndpoint, resolvedTabAuth),
        onDeleteProfile: (id) => {
          modals.deleteProfile(id);
          modals.clearConnectionIdsForProfile(id);
        },
        onApplyProfileToActiveTab: modals.applyProfileToActiveTab,
        prevBaseUrlRef: modals.prevBaseUrlRef,
        envModalOpen: modals.envModalOpen,
        onEnvModalClose: () => modals.setEnvModalOpen(false),
        environments: modals.environments,
        activeEnvironmentId: activeEnvironment?.id ?? null,
        onCreateEnvironment: modals.createEnvironment,
        onDeleteEnvironment: modals.deleteEnvironment,
        onSetActiveEnvironment: modals.setActiveEnvironment,
        onRenameEnvironment: modals.updateEnvironmentName,
        onUpdateVariables: modals.updateVariables,
        onImportEnvironment: modals.importEnvironment,
        onExportEnvironment: modals.exportEnvironment,
      },
    },
  };
}
