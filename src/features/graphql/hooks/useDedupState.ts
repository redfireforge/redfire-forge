/**
 * useDedupState.ts
 *
 * Extracts deduplication state management from useGraphqlExecution.
 * Manages: isDuplicate, duplicateSourceTabId, and resolveDedupChoice logic.
 * Reduces useGraphqlExecution's state declaration and handler complexity.
 */

import { useState, useCallback } from 'react';
import type { DedupChoice } from '../utils/dedupExecution';

export interface DedupState {
  isDuplicate: boolean;
  duplicateSourceTabId: string | null;
  setIsDuplicate: (isDuplicate: boolean) => void;
  setDuplicateSourceTabId: (tabId: string | null) => void;
  resolveDedupChoice: (choice: DedupChoice) => void;
  dedupChoiceResolver: ((choice: DedupChoice) => void) | null;
  setDedupChoiceResolver: (resolver: ((choice: DedupChoice) => void) | null) => void;
}

/**
 * Custom hook to manage deduplication state and resolution.
 * Centralizes the state logic that handles duplicate request detection and user choices.
 */
export function useDedupState(): DedupState {
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [duplicateSourceTabId, setDuplicateSourceTabId] = useState<string | null>(null);
  const [dedupChoiceResolver, setDedupChoiceResolverState] = useState<((choice: DedupChoice) => void) | null>(null);

  const setDedupChoiceResolver = useCallback((resolver: ((choice: DedupChoice) => void) | null) => {
    setDedupChoiceResolverState(resolver == null ? null : () => resolver);
  }, []);

  const resolveDedupChoice = useCallback((choice: DedupChoice) => {
    if (dedupChoiceResolver) {
      dedupChoiceResolver(choice);
      setDedupChoiceResolver(null);
      setIsDuplicate(false);
      setDuplicateSourceTabId(null);
    }
  }, [dedupChoiceResolver, setDedupChoiceResolver]);

  return {
    isDuplicate,
    duplicateSourceTabId,
    setIsDuplicate,
    setDuplicateSourceTabId,
    resolveDedupChoice,
    dedupChoiceResolver,
    setDedupChoiceResolver,
  };
}
