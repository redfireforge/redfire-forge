import { useState, useCallback, useRef } from 'react';

/**
 * Shared state and handlers for the variable-insert picker modal.
 *
 * Used by WorkflowNodeConfigModal and WorkflowDefaultsModal to avoid
 * duplicating the same set of state variables and callbacks.
 */
export function useVariableInsertModal() {
  const [variableInsertOpen, setVariableInsertOpen] = useState(false);
  const [variableInsertShortRef, setVariableInsertShortRef] = useState(false);
  const [variableInsertInitialSearch, setVariableInsertInitialSearch] = useState('');
  const insertApplyRef = useRef<(snippet: string) => void>(() => {});

  const requestVariableInsert = useCallback(
    (apply: (snippet: string) => void, shortRef = false, initialSearch = '') => {
      insertApplyRef.current = apply;
      setVariableInsertShortRef(shortRef);
      setVariableInsertInitialSearch(initialSearch);
      setVariableInsertOpen(true);
    },
    [],
  );

  const handleVariableInsertPicked = useCallback((template: string) => {
    insertApplyRef.current(template);
    setVariableInsertOpen(false);
  }, []);

  const closeVariableInsert = useCallback(() => setVariableInsertOpen(false), []);

  return {
    variableInsertOpen,
    variableInsertShortRef,
    variableInsertInitialSearch,
    requestVariableInsert,
    handleVariableInsertPicked,
    closeVariableInsert,
  };
}
