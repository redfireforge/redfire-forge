/**
 * Hook for managing onboarding hint state and localStorage persistence.
 */
import { useState, useCallback, useMemo } from 'react';
import { ONBOARDING_HINTS, ONBOARDING_STORAGE_KEY, type OnboardingHint } from '../data/onboardingHints';

export function loadDismissedHints(): Set<string> {
  try {
    const stored = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

function saveDismissedHints(ids: Set<string>): void {
  try {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // Ignore storage errors
  }
}

export function useOnboardingHints() {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(loadDismissedHints);
  const [activeHint, setActiveHint] = useState<OnboardingHint | null>(null);

  const dismiss = useCallback((hintId: string) => {
    setDismissedIds(prev => {
      const next = new Set(prev).add(hintId);
      saveDismissedHints(next);
      return next;
    });
    setActiveHint(null);
  }, []);

  const dismissAll = useCallback(() => {
    const allIds = new Set(ONBOARDING_HINTS.map(h => h.id));
    setDismissedIds(allIds);
    saveDismissedHints(allIds);
    setActiveHint(null);
  }, []);

  const resetHints = useCallback(() => {
    setDismissedIds(new Set());
    localStorage.removeItem(ONBOARDING_STORAGE_KEY);
    setActiveHint(null);
  }, []);

  const showHint = useCallback((hintId: string) => {
    if (dismissedIds.has(hintId)) return false;
    const hint = ONBOARDING_HINTS.find(h => h.id === hintId);
    if (hint) {
      setActiveHint(hint);
      return true;
    }
    return false;
  }, [dismissedIds]);

  const hideHint = useCallback(() => {
    setActiveHint(null);
  }, []);

  const getNextHint = useCallback((trigger: OnboardingHint['triggerOn']): OnboardingHint | null => {
    return ONBOARDING_HINTS
      .filter(h => h.triggerOn === trigger && !dismissedIds.has(h.id))
      .sort((a, b) => a.priority - b.priority)[0] ?? null;
  }, [dismissedIds]);

  const showNextHint = useCallback((trigger: OnboardingHint['triggerOn']): boolean => {
    const hint = getNextHint(trigger);
    if (hint) {
      setActiveHint(hint);
      return true;
    }
    return false;
  }, [getNextHint]);

  const isComplete = useMemo(
    () => dismissedIds.size >= ONBOARDING_HINTS.length,
    [dismissedIds],
  );

  const remainingCount = useMemo(
    () => ONBOARDING_HINTS.length - dismissedIds.size,
    [dismissedIds],
  );

  return {
    activeHint,
    dismissedIds,
    dismiss,
    dismissAll,
    resetHints,
    showHint,
    hideHint,
    getNextHint,
    showNextHint,
    isComplete,
    remainingCount,
  };
}

export type OnboardingHintsHook = ReturnType<typeof useOnboardingHints>;
