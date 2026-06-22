/**
 * Wires GraphQL Studio keyboard shortcuts with current tab/connection state.
 */
import { useGqlKeyboardShortcuts } from './useGqlKeyboardShortcuts';
import type { SubscriptionState } from '../../../shared/types/graphql';
import type { ExecutionStatus } from './useGraphqlExecution';

interface ShortcutsBridgeInput {
  handleExecute: () => void;
  handleSubscribe: () => void;
  handleStopSubscription: () => void;
  handleIntrospect: () => void;
  introspecting: boolean;
  handleCancel: () => void;
  addTab: () => void;
  closeActiveTab: () => void;
  subscriptionState: SubscriptionState;
  subscriptionDisconnect: () => void;
  activeTabOperationType: string | null | undefined;
  execStatus: ExecutionStatus;
  endpoint: string;
  activeEnvironment: Parameters<typeof useGqlKeyboardShortcuts>[0]['activeEnvironment'];
  globalEnvMap: Record<string, string>;
  profileModalOpen: boolean;
  envModalOpen: boolean;
  endpointLinkPending: boolean;
}

export function useGraphqlStudioShortcutsBridge(input: ShortcutsBridgeInput): void {
  useGqlKeyboardShortcuts({
    handleExecute: input.handleExecute,
    handleSubscribe: input.handleSubscribe,
    handleStopSubscription: input.handleStopSubscription,
    introspect: input.handleIntrospect,
    introspecting: input.introspecting,
    cancel: input.handleCancel,
    addTab: input.addTab,
    closeActiveTab: input.closeActiveTab,
    subscriptionState: input.subscriptionState,
    subscriptionDisconnect: input.subscriptionDisconnect,
    activeTabOperationType: input.activeTabOperationType,
    execStatus: input.execStatus,
    endpoint: input.endpoint,
    activeEnvironment: input.activeEnvironment,
    globalEnvMap: input.globalEnvMap,
    profileModalOpen: input.profileModalOpen,
    envModalOpen: input.envModalOpen,
    endpointLinkPending: input.endpointLinkPending,
  });
}
