import { useCallback, useEffect, useRef, useState } from 'react';
import { v4 as uuid } from 'uuid';
import {
  loadKafkaConsumeTemplates,
  loadKafkaPublishTemplates,
  saveKafkaConsumeTemplates,
  saveKafkaPublishTemplates,
  type KafkaConsumeTemplate,
  type KafkaPublishTemplate,
} from '@shared/kafka/kafkaStorage';
import type { KafkaConsumeDraft, KafkaPublishDraft } from '../../features/kafka/types';

// ── Public interface ───────────────────────────────────────────────────────

export interface UseKafkaTemplatesReturn {
  publishTemplates: KafkaPublishTemplate[];
  consumeTemplates: KafkaConsumeTemplate[];
  templatesLoading: boolean;
  /** Non-null when the last save/delete operation threw. Cleared on next successful op. */
  templateError: string | null;

  savePublishTemplate: (name: string, draft: KafkaPublishDraft) => Promise<void>;
  /** Returns the draft for the given id, or null if not found. */
  loadPublishTemplate: (id: string) => KafkaPublishDraft | null;
  deletePublishTemplate: (id: string) => Promise<void>;

  saveConsumeTemplate: (name: string, draft: KafkaConsumeDraft) => Promise<void>;
  /**
   * Returns the draft for the given id, or null if not found.
   * NOTE: `groupId` is stripped from the returned draft — each consume session
   * should use a fresh group ID to avoid inheriting committed offsets.
   */
  loadConsumeTemplate: (id: string) => Omit<KafkaConsumeDraft, 'groupId'> | null;
  deleteConsumeTemplate: (id: string) => Promise<void>;

  /**
   * Remove publish/consume templates whose names match (case-insensitive).
   * Used by demo lesson setup/cleanup so Restart does not leave stale Load ▾ entries.
   */
  removeTemplatesByNames: (names: string[]) => Promise<void>;
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useKafkaTemplates(): UseKafkaTemplatesReturn {
  const [publishTemplates, setPublishTemplates] = useState<KafkaPublishTemplate[]>([]);
  const [consumeTemplates, setConsumeTemplates] = useState<KafkaConsumeTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templateError, setTemplateError] = useState<string | null>(null);

  // ── Load on mount ────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [pub, con] = await Promise.all([
          loadKafkaPublishTemplates(),
          loadKafkaConsumeTemplates(),
        ]);
        if (cancelled) return;
        setPublishTemplates(pub);
        setConsumeTemplates(con);
      } catch (err) {
        if (cancelled) return;
        setTemplateError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setTemplatesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Publish ──────────────────────────────────────────────────────────────

  const savePublishTemplate = useCallback(
    async (name: string, draft: KafkaPublishDraft) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const existingIdx = publishTemplates.findIndex(
        (t) => t.name.toLowerCase() === trimmed.toLowerCase(),
      );
      let next: KafkaPublishTemplate[];
      if (existingIdx !== -1) {
        // Update existing entry with same name (preserve id and createdAt)
        next = publishTemplates.map((t, i) =>
          i === existingIdx ? { ...t, draft } : t,
        );
      } else {
        const entry: KafkaPublishTemplate = {
          id: uuid(),
          name: trimmed,
          createdAt: new Date().toISOString(),
          draft,
        };
        next = [...publishTemplates, entry];
      }
      try {
        setTemplateError(null);
        await saveKafkaPublishTemplates(next);
        setPublishTemplates(next);
      } catch (err) {
        setTemplateError(err instanceof Error ? err.message : String(err));
        throw err;
      }
    },
    [publishTemplates],
  );

  const loadPublishTemplate = useCallback(
    (id: string): KafkaPublishDraft | null => {
      const found = publishTemplates.find((t) => t.id === id);
      return found?.draft ?? null;
    },
    [publishTemplates],
  );

  const deletePublishTemplate = useCallback(
    async (id: string) => {
      const next = publishTemplates.filter((t) => t.id !== id);
      try {
        setTemplateError(null);
        await saveKafkaPublishTemplates(next);
        setPublishTemplates(next);
      } catch (err) {
        setTemplateError(err instanceof Error ? err.message : String(err));
        throw err;
      }
    },
    [publishTemplates],
  );

  // ── Consume ──────────────────────────────────────────────────────────────

  const saveConsumeTemplate = useCallback(
    async (name: string, draft: KafkaConsumeDraft) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const existingIdx = consumeTemplates.findIndex(
        (t) => t.name.toLowerCase() === trimmed.toLowerCase(),
      );
      let next: KafkaConsumeTemplate[];
      if (existingIdx !== -1) {
        // Update existing entry with same name (preserve id and createdAt)
        next = consumeTemplates.map((t, i) =>
          i === existingIdx ? { ...t, draft } : t,
        );
      } else {
        const entry: KafkaConsumeTemplate = {
          id: uuid(),
          name: trimmed,
          createdAt: new Date().toISOString(),
          draft,
        };
        next = [...consumeTemplates, entry];
      }
      try {
        setTemplateError(null);
        await saveKafkaConsumeTemplates(next);
        setConsumeTemplates(next);
      } catch (err) {
        setTemplateError(err instanceof Error ? err.message : String(err));
        throw err;
      }
    },
    [consumeTemplates],
  );

  const loadConsumeTemplate = useCallback(
    (id: string): Omit<KafkaConsumeDraft, 'groupId'> | null => {
      const found = consumeTemplates.find((t) => t.id === id);
      if (!found) return null;
      // Strip groupId — each consume session must start with a fresh group ID
      // to avoid reusing committed offsets from previous sessions.
      const { groupId: _omit, ...rest } = found.draft;
      return rest;
    },
    [consumeTemplates],
  );

  const deleteConsumeTemplate = useCallback(
    async (id: string) => {
      const next = consumeTemplates.filter((t) => t.id !== id);
      try {
        setTemplateError(null);
        await saveKafkaConsumeTemplates(next);
        setConsumeTemplates(next);
      } catch (err) {
        setTemplateError(err instanceof Error ? err.message : String(err));
        throw err;
      }
    },
    [consumeTemplates],
  );

  const removeTemplatesByNames = useCallback(
    async (names: string[]) => {
      const nameSet = new Set(
        names.map((n) => n.trim().toLowerCase()).filter(Boolean),
      );
      if (nameSet.size === 0) return;

      const nextPub = publishTemplates.filter(
        (t) => !nameSet.has(t.name.toLowerCase()),
      );
      const nextCon = consumeTemplates.filter(
        (t) => !nameSet.has(t.name.toLowerCase()),
      );
      const pubChanged = nextPub.length !== publishTemplates.length;
      const conChanged = nextCon.length !== consumeTemplates.length;
      if (!pubChanged && !conChanged) return;

      try {
        setTemplateError(null);
        await Promise.all([
          pubChanged ? saveKafkaPublishTemplates(nextPub) : Promise.resolve(),
          conChanged ? saveKafkaConsumeTemplates(nextCon) : Promise.resolve(),
        ]);
        if (pubChanged) setPublishTemplates(nextPub);
        if (conChanged) setConsumeTemplates(nextCon);
      } catch (err) {
        setTemplateError(err instanceof Error ? err.message : String(err));
        throw err;
      }
    },
    [publishTemplates, consumeTemplates],
  );

  // Demo-player bridge: clear stale lesson templates without a UI tour.
  const removeTemplatesByNamesRef = useRef(removeTemplatesByNames);
  removeTemplatesByNamesRef.current = removeTemplatesByNames;
  useEffect(() => {
    const w = window as unknown as {
      __demoRemoveKafkaTemplatesByName?: (names: string[]) => Promise<void>;
    };
    w.__demoRemoveKafkaTemplatesByName = (names) =>
      removeTemplatesByNamesRef.current(names);
    return () => {
      delete w.__demoRemoveKafkaTemplatesByName;
    };
  }, []);

  return {
    publishTemplates,
    consumeTemplates,
    templatesLoading,
    templateError,
    savePublishTemplate,
    loadPublishTemplate,
    deletePublishTemplate,
    saveConsumeTemplate,
    loadConsumeTemplate,
    deleteConsumeTemplate,
    removeTemplatesByNames,
  };
}
