/**
 * Subscription lifecycle: switch to response view on subscribe, disconnect on tab change.
 */
import { useCallback, useEffect, useRef } from 'react';
import type { SubscriptionState } from '@shared/types/graphql';
import type { GqlStudioTab } from '../utils/tabPersistence';

interface SubscriptionGuardInput {
  activeTabId: string;
  activeTab: GqlStudioTab | undefined;
  subscription: { state: SubscriptionState; disconnect: () => void };
  onSubscribe: () => void;
  setRightView: (view: 'response' | 'schema') => void;
}

export function useGraphqlStudioSubscriptionGuard({
  activeTabId,
  activeTab,
  subscription,
  onSubscribe,
  setRightView,
}: SubscriptionGuardInput) {
  const handleSubscribe = useCallback(() => {
    setRightView('response');
    onSubscribe();
  }, [onSubscribe, setRightView]);

  const prevTabIdForSubRef = useRef(activeTabId);
  useEffect(() => {
    const tabChanged = prevTabIdForSubRef.current !== activeTabId;
    prevTabIdForSubRef.current = activeTabId;
    if (subscription.state === 'idle') return;
    if (activeTab?.operationType !== 'subscription' || tabChanged) {
      subscription.disconnect();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabId, activeTab?.operationType]);

  return { handleSubscribe };
}
