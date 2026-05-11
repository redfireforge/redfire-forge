/**
 * React hook wrapping the body template sync engine.
 *
 * Manages bi-directional sync between a raw body string and visual
 * Mapping[] for the Request Body Builder (Phase 6C).
 *
 * Usage:
 *   const sync = useBodyBuilderSync(body, onChange, sources);
 *   // sync.mappings — current visual mappings
 *   // sync.onBodyChange(newBody) — call when textarea changes
 *   // sync.onMappingsChange(newMappings) — call when mapper DnD changes
 */

import { useState, useCallback, useRef, useMemo } from 'react';
import type { Mapping, MapperSource } from '../types';
import {
  createSyncState,
  syncFromTemplate,
  syncFromVisual,
  applyTemplateDiff,
  mappingsEqual,
} from '../utils/bodyTemplateSync';
import type { BodySyncState } from '../utils/bodyTemplateSync';
import { parseBodyJson } from '../adapters/requestBodyAdapter';

export interface UseBodyBuilderSyncOptions {
  sources: MapperSource[];
}

export interface UseBodyBuilderSyncReturn {
  mappings: Mapping[];
  onBodyChange: (newBody: string) => void;
  onMappingsChange: (newMappings: Mapping[]) => void;
  resetSync: (body: string, mappings?: Mapping[]) => void;
}

/**
 * Bi-directional sync hook for body builder.
 *
 * @param body        Current body string (controlled externally).
 * @param onBodyPush  Callback to push body changes upstream (e.g. `update({ body: ... })`).
 * @param opts        Available mapper sources for ref resolution.
 */
export function useBodyBuilderSync(
  body: string,
  onBodyPush: (newBody: string) => void,
  opts: UseBodyBuilderSyncOptions,
): UseBodyBuilderSyncReturn {
  const [syncState, setSyncState] = useState<BodySyncState>(() => {
    const base = createSyncState(body);
    // Pre-parse existing body to initialize mappings from any {{var}} refs
    if (parseBodyJson(body)) {
      const initial = syncFromTemplate(body, [], { sources: opts.sources });
      return { ...base, mappings: initial.mappings, lastSyncedMappings: initial.mappings };
    }
    return base;
  });
  const lastBodyRef = useRef(body);
  const sourcesRef = useRef(opts.sources);
  sourcesRef.current = opts.sources;

  const syncOpts = useMemo(() => ({ sources: opts.sources }), [opts.sources]);

  // Detect external body changes (e.g. undo, paste from outside).
  // When the old body is unparseable, fall back to syncFromTemplate to
  // derive fresh mappings instead of carrying forward stale ones.
  if (body !== lastBodyRef.current) {
    lastBodyRef.current = body;
    if (body !== syncState.body) {
      const oldParseable = !!parseBodyJson(syncState.body);
      const result = oldParseable
        ? applyTemplateDiff(syncState.body, body, syncState.mappings, syncOpts)
        : syncFromTemplate(body, [], syncOpts);
      setSyncState({
        body,
        mappings: result.mappings,
        lastOrigin: 'template',
        lastSyncedBody: body,
        lastSyncedMappings: result.mappings,
      });
    }
  }

  const onBodyChange = useCallback(
    (newBody: string) => {
      const result = syncFromTemplate(newBody, syncState.mappings, { sources: sourcesRef.current });
      lastBodyRef.current = newBody;
      setSyncState({
        body: newBody,
        mappings: result.mappings,
        lastOrigin: 'template',
        lastSyncedBody: newBody,
        lastSyncedMappings: result.mappings,
      });
      onBodyPush(newBody);
    },
    [syncState.mappings, onBodyPush],
  );

  const onMappingsChange = useCallback(
    (newMappings: Mapping[]) => {
      if (mappingsEqual(syncState.mappings, newMappings)) return;
      const result = syncFromVisual(newMappings, syncState.body);
      lastBodyRef.current = result.body;
      setSyncState({
        body: result.body,
        mappings: newMappings,
        lastOrigin: 'visual',
        lastSyncedBody: result.body,
        lastSyncedMappings: newMappings,
      });
      if (result.bodyChanged) {
        onBodyPush(result.body);
      }
    },
    [syncState.mappings, syncState.body, onBodyPush],
  );

  const resetSync = useCallback(
    (newBody: string, newMappings: Mapping[] = []) => {
      lastBodyRef.current = newBody;
      setSyncState(createSyncState(newBody, newMappings));
    },
    [],
  );

  return {
    mappings: syncState.mappings,
    onBodyChange,
    onMappingsChange,
    resetSync,
  };
}
