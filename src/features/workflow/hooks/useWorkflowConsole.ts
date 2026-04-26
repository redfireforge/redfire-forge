import { useState, useCallback, useEffect, useRef } from 'react';
import { loadConsoleRunBehavior, loadConsoleOpen, saveConsoleOpen, type ConsoleRunBehavior } from '../utils/workflowSessionStorage';

interface UseWorkflowConsoleOptions {
  hasWebhookNode: boolean;
  pushConsoleLine: (line: { prefix?: string; text: string; ts: number }) => void;
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
    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/logs/stream');
      es.onmessage = (event) => {
        try {
          const line = JSON.parse(event.data);
          pushConsoleLine(line);
        } catch { /* ignore malformed */ }
      };
      es.onerror = () => {
        // Server may not be running; silently reconnect or close
      };
    } catch { /* EventSource creation failed */ }
    return () => { es?.close(); };
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
