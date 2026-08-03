import { useCallback, useEffect, useRef, useState } from 'react';
import type { WsMessageFormat, WsMessageTemplate } from '../../shared/websocket/types';
import { loadWsTemplates, saveWsTemplates } from '../../shared/websocket/websocketStorage';
import {
  applyLoadError,
  applyLoadedTemplates,
  applyPersistError,
  clearErrorIfMounted,
} from './wsTemplateMountGuards';

export interface UseWebSocketTemplatesReturn {
  templates: WsMessageTemplate[];
  loading: boolean;
  error: string | null;

  saveTemplate: (name: string, body: string, format: WsMessageFormat) => Promise<void>;
  updateTemplate: (id: string, patch: Partial<WsMessageTemplate>) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  /** Wipe all templates (storage + React state) — used by quiet demo setup. */
  clearAllTemplates: () => Promise<void>;
  loadTemplate: (id: string) => { body: string; format: WsMessageFormat } | null;
}

let templateIdCounter = 0;
function generateTemplateId(): string {
  templateIdCounter += 1;
  return `ws-tpl-${Date.now()}-${templateIdCounter}`;
}

export function useWebSocketTemplates(): UseWebSocketTemplatesReturn {
  const [templates, setTemplates] = useState<WsMessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    loadWsTemplates()
      .then((loaded) => {
        applyLoadedTemplates(mountedRef.current, loaded, setTemplates, setLoading);
      })
      .catch((err) => {
        applyLoadError(mountedRef.current, err, setError, setLoading);
      });
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const persist = useCallback(async (next: WsMessageTemplate[]) => {
    setTemplates(next);
    try {
      await saveWsTemplates(next);
      clearErrorIfMounted(mountedRef.current, setError);
    } catch (err) {
      applyPersistError(mountedRef.current, err, setError);
    }
  }, []);

  const saveTemplate = useCallback(
    async (name: string, body: string, format: WsMessageFormat) => {
      const now = new Date().toISOString();
      const newTemplate: WsMessageTemplate = {
        id: generateTemplateId(),
        name: name.trim(),
        body,
        format,
        createdAt: now,
        updatedAt: now,
      };
      await persist([...templates, newTemplate]);
    },
    [templates, persist],
  );

  const updateTemplate = useCallback(
    async (id: string, patch: Partial<WsMessageTemplate>) => {
      const idx = templates.findIndex((t) => t.id === id);
      if (idx === -1) return;
      const updated = { ...templates[idx], ...patch, updatedAt: new Date().toISOString() };
      const next = [...templates];
      next[idx] = updated;
      await persist(next);
    },
    [templates, persist],
  );

  const deleteTemplate = useCallback(
    async (id: string) => {
      await persist(templates.filter((t) => t.id !== id));
    },
    [templates, persist],
  );

  const clearAllTemplates = useCallback(async () => {
    await persist([]);
  }, [persist]);

  const loadTemplate = useCallback(
    (id: string): { body: string; format: WsMessageFormat } | null => {
      const tpl = templates.find((t) => t.id === id);
      if (!tpl) return null;
      return { body: tpl.body, format: tpl.format };
    },
    [templates],
  );

  return {
    templates,
    loading,
    error,
    saveTemplate,
    updateTemplate,
    deleteTemplate,
    clearAllTemplates,
    loadTemplate,
  };
}
