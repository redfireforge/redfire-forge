import { useState, useMemo, useCallback } from 'react';
import type { MapperSource } from '../types';

interface TemporarySourceOverride {
  effectiveSources: MapperSource[];
  showSourceEditor: boolean;
  tempSourceJson: string;
  sourceJsonError: string | null;
  setTempSourceJson: (json: string) => void;
  handleToggleSourceEditor: () => void;
}

export function useTemporarySourceOverride(
  sources: MapperSource[],
  activeSourceId: string,
): TemporarySourceOverride {
  const [showSourceEditor, setShowSourceEditor] = useState(false);
  const [tempSourceJson, setTempSourceJson] = useState('');

  const { effectiveSources, sourceJsonError } = useMemo<{
    effectiveSources: MapperSource[];
    sourceJsonError: string | null;
  }>(() => {
    if (!showSourceEditor || !tempSourceJson.trim()) {
      return { effectiveSources: sources, sourceJsonError: null };
    }
    try {
      const parsed = JSON.parse(tempSourceJson);
      return {
        effectiveSources: sources.map((s) =>
          s.id === activeSourceId ? { ...s, sampleData: parsed } : s,
        ),
        sourceJsonError: null,
      };
    } catch {
      return { effectiveSources: sources, sourceJsonError: 'Invalid JSON' };
    }
  }, [sources, activeSourceId, showSourceEditor, tempSourceJson]);

  const handleToggleSourceEditor = useCallback(() => {
    setShowSourceEditor((prev) => {
      if (!prev) {
        const active = sources.find((s) => s.id === activeSourceId);
        setTempSourceJson(JSON.stringify(active?.sampleData ?? {}, null, 2));
      }
      return !prev;
    });
  }, [sources, activeSourceId]);

  return {
    effectiveSources,
    showSourceEditor,
    tempSourceJson,
    sourceJsonError,
    setTempSourceJson,
    handleToggleSourceEditor,
  };
}
