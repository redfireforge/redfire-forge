/**
 * useGqlKeyboardShortcuts — registers the keyboard shortcut handler for the
 * GraphQL Studio page (Cmd+Enter, Cmd+W, Cmd+T, Cmd+Shift+I, Escape).
 *
 * Uses stable refs so the event listener is only attached once.
 *
 * Extracted from GraphqlStudioPage.tsx to reduce its line count.
 */
import { useEffect, useRef } from 'react';
import { isTauri } from '@shared/utils/platform';
import { findUnresolvedVars } from '../utils/envUtils';
import type { GraphqlEnvironment, SubscriptionState as SubState } from '@shared/types/graphql';

interface GqlKeyboardShortcutsArgs {
  handleExecute: () => void;
  handleSubscribe: () => void;
  handleStopSubscription: () => void;
  introspect: () => void;
  introspecting: boolean;
  cancel: () => void;
  addTab: () => void;
  closeActiveTab: () => void;
  subscriptionState: SubState;
  subscriptionDisconnect: () => void;
  activeTabOperationType: string | null | undefined;
  execStatus: string;
  endpoint: string;
  activeEnvironment: GraphqlEnvironment | null | undefined;
  globalEnvMap?: Record<string, string>;
  profileModalOpen: boolean;
  envModalOpen: boolean;
  /** Phase 6F — block introspect shortcut while profile endpoint is resolving. */
  endpointLinkPending?: boolean;
}

export function useGqlKeyboardShortcuts({
  handleExecute,
  handleSubscribe,
  handleStopSubscription,
  introspect,
  introspecting,
  cancel,
  addTab,
  closeActiveTab,
  subscriptionState,
  subscriptionDisconnect,
  activeTabOperationType,
  execStatus,
  endpoint,
  activeEnvironment,
  globalEnvMap,
  profileModalOpen,
  envModalOpen,
  endpointLinkPending = false,
}: GqlKeyboardShortcutsArgs): void {
  // Stable refs so the listener closure captures current values without re-binding
  const handleExecuteRef        = useRef(handleExecute);
  handleExecuteRef.current      = handleExecute;
  const handleSubscribeRef      = useRef(handleSubscribe);
  handleSubscribeRef.current    = handleSubscribe;
  const handleStopSubRef        = useRef(handleStopSubscription);
  handleStopSubRef.current      = handleStopSubscription;
  const introspectRef           = useRef(introspect);
  introspectRef.current         = introspect;
  const introspectingRef        = useRef(introspecting);
  introspectingRef.current      = introspecting;
  const cancelKbdRef            = useRef(cancel);
  cancelKbdRef.current          = cancel;
  const addTabRef               = useRef(addTab);
  addTabRef.current             = addTab;
  const closeActiveTabRef       = useRef(closeActiveTab);
  closeActiveTabRef.current     = closeActiveTab;
  const subStateRef             = useRef(subscriptionState);
  subStateRef.current           = subscriptionState;
  const subDisconnectRef        = useRef(subscriptionDisconnect);
  subDisconnectRef.current      = subscriptionDisconnect;
  const activeTabOpTypeRef      = useRef(activeTabOperationType);
  activeTabOpTypeRef.current    = activeTabOperationType;
  const execStatusRef           = useRef(execStatus);
  execStatusRef.current         = execStatus;
  const endpointRef             = useRef(endpoint);
  endpointRef.current           = endpoint;
  const activeEnvironmentRef    = useRef(activeEnvironment);
  activeEnvironmentRef.current  = activeEnvironment;
  const globalEnvMapRef         = useRef(globalEnvMap);
  globalEnvMapRef.current       = globalEnvMap;
  const profileModalOpenRef     = useRef(profileModalOpen);
  profileModalOpenRef.current   = profileModalOpen;
  const envModalOpenRef         = useRef(envModalOpen);
  envModalOpenRef.current       = envModalOpen;
  const endpointLinkPendingRef  = useRef(endpointLinkPending);
  endpointLinkPendingRef.current = endpointLinkPending;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') {
        const hasOpenDialog =
          profileModalOpenRef.current ||
          envModalOpenRef.current ||
          !!document.querySelector('.gql-studio [role="dialog"][aria-modal="true"]');
        if (hasOpenDialog) return;
      }
      const isCmd = e.metaKey || e.ctrlKey;
      if (isCmd && e.key === 'Enter') {
        e.preventDefault();
        if (activeTabOpTypeRef.current === 'subscription') {
          const subState = subStateRef.current;
          if (subState === 'connecting' || subState === 'active' || subState === 'reconnecting') {
            handleStopSubRef.current();
          } else {
            handleSubscribeRef.current();
          }
        } else {
          handleExecuteRef.current();
        }
        return;
      }
      if (isCmd && e.key === 'w' && isTauri()) {
        e.preventDefault();
        closeActiveTabRef.current();
        return;
      }
      if (isCmd && e.key === 't' && isTauri()) {
        e.preventDefault();
        addTabRef.current();
        return;
      }
      if (isCmd && e.shiftKey && e.key === 'I') {
        e.preventDefault();
        if (endpointLinkPendingRef.current) return;
        if (introspectingRef.current) return;
        if (findUnresolvedVars(endpointRef.current, activeEnvironmentRef.current, globalEnvMapRef.current).length > 0) return;
        introspectRef.current();
        return;
      }
      if (e.key === 'Escape' && execStatusRef.current === 'loading') {
        cancelKbdRef.current();
      }
      if (e.key === 'Escape') {
        const subState = subStateRef.current;
        if (subState === 'active' || subState === 'connecting' || subState === 'reconnecting') {
          subDisconnectRef.current();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
