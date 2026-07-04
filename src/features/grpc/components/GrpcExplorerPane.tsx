import { useMemo, type ReactNode } from 'react';
import type { GlobalAuthProfile } from '../../../shared/types';
import type { GrpcStudioTabState, GrpcTabDescriptorState } from '../grpcStudioTypes';
import { isGrpcLifecycleInFlight } from '../grpcStudioTypes';
import { findGrpcMethod } from '../utils/grpcExplorerUtils';
import { isGrpcExecuteBlockedByDrift } from '../utils/grpcReplayBinding';
import { GrpcCallPanel } from './GrpcCallPanel';
import { GrpcMethodDetailPanel } from './GrpcMethodDetailPanel';
import { GrpcSchemaDriftBanner } from './GrpcSchemaDriftBanner';
import { GrpcServiceExplorer } from './GrpcServiceExplorer';

export interface GrpcExplorerPaneProps {
  tab: GrpcStudioTabState;
  tabPanelId: string;
  descriptorState: GrpcTabDescriptorState;
  canReflect: boolean;
  targetValid: boolean;
  tlsValid?: boolean;
  targetAddress?: string;
  onReflect: () => void;
  onManageSchemas: () => void;
  onSelectMethod: (serviceFullName: string, methodName: string) => void;
  onToggleServiceExpanded: (serviceFullName: string) => void;
  onTabPatch: (patch: Partial<GrpcStudioTabState>) => void;
  onUnmaskAuthSecretField?: (field: import('../utils/grpcSecretFieldUi').GrpcAuthSecretFieldKey) => void;
  onClearAuthSecretField?: (field: import('../utils/grpcSecretFieldUi').GrpcAuthSecretFieldKey) => void;
  onSendUnary?: (overrides?: import('../grpcStudioTypes').GrpcExecuteOverrides) => void;
  onCancelUnary?: () => void;
  onStartStream?: (overrides?: import('../grpcStudioTypes').GrpcExecuteOverrides) => void;
  onCancelStream?: () => void;
  onSendStreamMessage?: (overrides?: import('../grpcStudioTypes').GrpcExecuteOverrides) => void;
  onEnqueueStreamMessage?: (overrides?: import('../grpcStudioTypes').GrpcExecuteOverrides) => void;
  onRemovePendingStreamMessage?: (index: number) => void;
  onSendAllPendingStreamMessages?: () => void;
  onEndStream?: () => void;
  onClearStreamLog?: () => void;
  onRetryUnaryWithExpress?: () => void;
  onRetryStreamWithExpress?: () => void;
  onDismissSchemaDrift?: () => void;
  onPruneSchemaDriftBody?: () => void;
  onRebindSchemaDriftMethod?: (serviceFullName: string, methodName: string) => void;
  globalAuthProfiles?: GlobalAuthProfile[];
  defaultAuthProfileId?: string | null;
  /** Increment to focus the Auth composer tab (Phase 4J-A connection bar). */
  authTabFocusRequest?: number;
  /** Connection bar + validation + TLS block — rendered at top of main column (mockup 01). */
  connectionChrome?: ReactNode;
}

/**
 * Phase 1E explorer + Phase 1F call composer.
 * Layout follows `docs/plan/future/grpc/mockups/01-main-studio.html`.
 */
export function GrpcExplorerPane({
  tab,
  tabPanelId,
  descriptorState,
  canReflect,
  targetValid,
  tlsValid = true,
  targetAddress,
  onReflect,
  onManageSchemas,
  onSelectMethod,
  onToggleServiceExpanded,
  onTabPatch,
  onUnmaskAuthSecretField,
  onClearAuthSecretField,
  onSendUnary,
  onCancelUnary,
  onStartStream,
  onCancelStream,
  onSendStreamMessage,
  onEnqueueStreamMessage,
  onRemovePendingStreamMessage,
  onSendAllPendingStreamMessages,
  onEndStream,
  onClearStreamLog,
  onRetryUnaryWithExpress,
  onRetryStreamWithExpress,
  onDismissSchemaDrift,
  onPruneSchemaDriftBody,
  onRebindSchemaDriftMethod,
  globalAuthProfiles = [],
  defaultAuthProfileId = null,
  authTabFocusRequest,
  connectionChrome,
}: GrpcExplorerPaneProps) {
  const selectedMethod = useMemo(() => {
    if (!descriptorState.descriptor || !tab.service || !tab.method) return undefined;
    return findGrpcMethod(descriptorState.descriptor, tab.service, tab.method);
  }, [descriptorState.descriptor, tab.service, tab.method]);

  const composerMethod = useMemo(() => (
    selectedMethod
    ?? (descriptorState.driftState === 'blocking' ? descriptorState.driftStaleMethod : undefined)
  ), [descriptorState.driftStaleMethod, descriptorState.driftState, selectedMethod]);

  const executeBlocked = isGrpcExecuteBlockedByDrift(descriptorState.driftState);
  // Keep the composer editable during client/bidi streams so users can send messages mid-flight.
  const callPanelDisabled = isGrpcLifecycleInFlight(tab.lifecycle);

  return (
    <div
      className="grpc-studio-layout"
      id={tabPanelId}
      data-testid={tabPanelId}
      role="tabpanel"
    >
      <GrpcServiceExplorer
        loadState={descriptorState.loadState}
        descriptor={descriptorState.descriptor}
        errorMessage={descriptorState.errorMessage}
        selectedService={tab.service}
        selectedMethod={tab.method}
        collapsed={tab.servicesCollapsed ?? false}
        expandedServiceIds={descriptorState.expandedServiceIds}
        canReflect={canReflect}
        onReflect={onReflect}
        onManageSchemas={onManageSchemas}
        onSelectMethod={onSelectMethod}
        onToggleServiceExpanded={onToggleServiceExpanded}
        onToggleCollapsed={() => onTabPatch({ servicesCollapsed: !(tab.servicesCollapsed ?? false) })}
      />
      <div className="grpc-studio-main">
        {connectionChrome && (
          <div className="grpc-studio-connection-chrome" data-testid="grpc-connection-chrome">
            {connectionChrome}
          </div>
        )}
        <GrpcSchemaDriftBanner
          driftState={descriptorState.driftState}
          driftMessage={descriptorState.driftMessage}
          driftIssues={descriptorState.driftIssues}
          suggestedRebinds={descriptorState.suggestedRebinds}
          onRebind={(service, method) => onRebindSchemaDriftMethod?.(service, method)}
          onPruneBody={() => onPruneSchemaDriftBody?.()}
          onDismiss={() => onDismissSchemaDrift?.()}
        />
        <GrpcMethodDetailPanel
          descriptor={descriptorState.descriptor}
          selectedService={tab.service}
          selectedMethod={tab.method}
          staleMethod={descriptorState.driftStaleMethod}
        />
        <GrpcCallPanel
          tab={tab}
          method={composerMethod}
          messageTypes={descriptorState.descriptor?.messageTypes}
          descriptorSource={descriptorState.descriptor?.source}
          serviceFullName={tab.service}
          targetValid={targetValid}
          tlsValid={tlsValid}
          targetAddress={targetAddress}
          disabled={callPanelDisabled}
          executeBlocked={executeBlocked}
          descriptorLoading={descriptorState.loadState === 'loading'}
          authTabFocusRequest={authTabFocusRequest}
          globalAuthProfiles={globalAuthProfiles}
          defaultAuthProfileId={defaultAuthProfileId}
          onPatch={onTabPatch}
          onUnmaskAuthSecretField={onUnmaskAuthSecretField}
          onClearAuthSecretField={onClearAuthSecretField}
          onSendUnary={onSendUnary}
          onCancelUnary={onCancelUnary}
          onStartStream={onStartStream}
          onCancelStream={onCancelStream}
          onSendStreamMessage={onSendStreamMessage}
          onEnqueueStreamMessage={onEnqueueStreamMessage}
          onRemovePendingStreamMessage={onRemovePendingStreamMessage}
          onSendAllPendingStreamMessages={onSendAllPendingStreamMessages}
          onEndStream={onEndStream}
          onClearStreamLog={onClearStreamLog}
          onRetryUnaryWithExpress={onRetryUnaryWithExpress}
          onRetryStreamWithExpress={onRetryStreamWithExpress}
        />
      </div>
    </div>
  );
}
