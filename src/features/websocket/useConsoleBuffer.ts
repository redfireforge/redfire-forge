/**
 * Phase 9 — generic console ring buffer + settings hook, reused by the WS and
 * SSE observers. Owns the entry list (capped) and the persisted settings.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { WsConsoleEntry, WsConsoleSettings } from './wsConsoleTypes';
import { WS_CONSOLE_DEFAULT_SETTINGS } from './wsConsoleTypes';
import { appendCapped } from './wsConsoleEntries';
import { loadConsoleSettings, saveConsoleSettings } from './wsConsoleStorage';

export interface UseConsoleBufferReturn {
  entries: WsConsoleEntry[];
  settings: WsConsoleSettings;
  append: (entry: WsConsoleEntry) => void;
  clear: () => void;
  setSettings: (next: WsConsoleSettings) => void;
  settingsLoaded: boolean;
}

const SAVE_DEBOUNCE_MS = 300;

/**
 * @param storageKey localStorage key for the persisted settings.
 */
export function useConsoleBuffer(storageKey: string): UseConsoleBufferReturn {
  const [entries, setEntries] = useState<WsConsoleEntry[]>([]);
  const [settings, setSettingsState] = useState<WsConsoleSettings>(WS_CONSOLE_DEFAULT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // maxEntries read from a ref so `append` stays a stable callback.
  const maxEntriesRef = useRef(settings.maxEntries);
  maxEntriesRef.current = settings.maxEntries;

  // Latest settings/loaded/key snapshot for the unmount flush below.
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const settingsLoadedRef = useRef(settingsLoaded);
  settingsLoadedRef.current = settingsLoaded;
  const storageKeyRef = useRef(storageKey);
  storageKeyRef.current = storageKey;

  // Load persisted settings once on mount.
  useEffect(() => {
    let cancelled = false;
    void loadConsoleSettings(storageKey).then((loaded) => {
      if (cancelled) return;
      setSettingsState(loaded);
      setSettingsLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  // Debounced persistence (only after the initial load to avoid clobbering).
  useEffect(() => {
    if (!settingsLoaded) return;
    const handle = setTimeout(() => {
      void saveConsoleSettings(storageKey, settings);
    }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [settings, settingsLoaded, storageKey]);

  // Flush the latest settings on unmount so a change made within the debounce
  // window (then a quick tab switch / unmount) is not lost.
  useEffect(() => {
    return () => {
      if (settingsLoadedRef.current) {
        void saveConsoleSettings(storageKeyRef.current, settingsRef.current);
      }
    };
  }, []);

  const append = useCallback((entry: WsConsoleEntry) => {
    setEntries((prev) => appendCapped(prev, entry, maxEntriesRef.current));
  }, []);

  const clear = useCallback(() => setEntries([]), []);

  const setSettings = useCallback((next: WsConsoleSettings) => {
    setSettingsState(next);
  }, []);

  return { entries, settings, append, clear, setSettings, settingsLoaded };
}
