import { useEffect, useRef, useState } from 'react';

/** Debounced JSON-object validation for the active tab's GraphQL variables editor. */
export function useGqlVariablesValidation(
  variables: string,
  activeTabId: string,
): string | null {
  const [varsError, setVarsError] = useState<string | null>(null);
  const prevVarsTabIdRef = useRef(activeTabId);

  useEffect(() => {
    const isTabSwitch = activeTabId !== prevVarsTabIdRef.current;
    prevVarsTabIdRef.current = activeTabId;
    const validateVars = () => {
      const trimmed = variables.trim();
      if (!trimmed || trimmed === '{}') { setVarsError(null); return; }
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        setVarsError(parsed === null || Array.isArray(parsed) || typeof parsed !== 'object'
          ? 'Variables must be a JSON object — e.g. {"id": "1"}' : null);
      } catch { setVarsError('Invalid JSON'); }
    };
    if (isTabSwitch) { validateVars(); return; }
    const timer = setTimeout(validateVars, 300);
    return () => clearTimeout(timer);
  }, [variables, activeTabId]);

  return varsError;
}
