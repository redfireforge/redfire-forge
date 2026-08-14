import { useState, useCallback, useEffect, useRef } from 'react';
import { subscribeLogStream } from '../../../utils/logStream';
import { loadConsoleRunBehavior, loadConsoleOpen, saveConsoleOpen, type ConsoleRunBehavior } from '../utils/workflowSessionStorage';

import type { ConsoleLine } from '../../requests/hooks/useResponseCache';

interface UseWorkflowConsoleOptions {
  hasWebhookNode: boolean;
  pushConsoleLine: (line: ConsoleLine) => void;
}

export function useWorkflowConsole({ hasWebhookNode, pushConsoleLine }: UseWorkflowConsoleOptions) {
  const [consoleOpen, setConsoleOpen] = useState(loadConsoleOpen);
  const consoleOpenRef = useRef(consoleOpen);
  const [consoleRunBehavior, setConsoleRunBehavior] = useState<ConsoleRunBehavior>(loadConsoleRunBehavior);
  const consoleRunBehaviorRef = useRef(consoleRunBehavior);

  useEffect(() => { consoleRunBehaviorRef.current = consoleRunBehavior; }, [consoleRunBehavior]);

  const handleToggleConsole = useCallback(() => {
    setConsoleOpen(prev => {
      const next = !prev;
      consoleOpenRef.current = next;
      saveConsoleOpen(next);
      return next;
    });
  }, []);

  const handleCloseConsole = useCallback(() => {
    setConsoleOpen(false);
    consoleOpenRef.current = false;
    saveConsoleOpen(false);
  }, []);

  // Subscribe to server-side webhook execution logs via SSE
  useEffect(() => {
    if (!consoleOpen || !hasWebhookNode) return;
    return subscribeLogStream((data) => {
      try {
        pushConsoleLine(JSON.parse(data));
      } catch { /* ignore malformed */ }
    });
  }, [consoleOpen, hasWebhookNode, pushConsoleLine]);

  return {
    consoleOpen,
    consoleOpenRef,
    consoleRunBehavior,
    consoleRunBehaviorRef,
    setConsoleRunBehavior,
    handleToggleConsole,
    handleCloseConsole,
  };
}
