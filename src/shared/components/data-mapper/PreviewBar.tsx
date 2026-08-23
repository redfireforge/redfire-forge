import { useState, useEffect, useMemo } from 'react';
import { computePreview } from './utils/previewCompute';
import type { Mapping, MapperSource } from './types';
import type { ExpressionFunction } from '@workflow/utils/expressionFunctions/types';

interface PreviewBarProps {
  mappings: Mapping[];
  sources: MapperSource[];
  activeSourceId: string;
  targetSampleData: unknown;
  customFunctions?: ExpressionFunction[];
}

export default function PreviewBar({
  mappings,
  sources,
  activeSourceId,
  targetSampleData,
  customFunctions,
}: PreviewBarProps) {
  const [preview, setPreview] = useState<ReturnType<typeof computePreview> | null>(null);

  useEffect(() => {
    if (mappings.length === 0) {
      setPreview(null);
      return;
    }
    const timer = setTimeout(() => {
      setPreview(computePreview(mappings, sources, activeSourceId, targetSampleData, customFunctions));
    }, 250);
    return () => clearTimeout(timer);
  }, [mappings, sources, activeSourceId, targetSampleData, customFunctions]);

  const sourceJson = useMemo(() => {
    const src = sources.find((s) => s.id === activeSourceId);
    if (!src?.sampleData) return '';
    try {
      const data = typeof src.sampleData === 'string'
        ? JSON.parse(src.sampleData)
        : src.sampleData;
      return JSON.stringify(data, null, 2);
    } catch {
      return '';
    }
  }, [sources, activeSourceId]);

  const targetJson = useMemo(() => {
    if (!preview) return '';
    try {
      return JSON.stringify(normalizePreviewDisplayJson(preview.targetObject), null, 2);
    } catch {
      return '{}';
    }
  }, [preview]);

  if (mappings.length === 0) {
    return (
      <div className="dm-preview-bar">
        <div className="dm-preview-empty">
          Add mappings to see a live preview of the mapped output.
        </div>
      </div>
    );
  }

  return (
    <div className="dm-preview-bar">
      <div className="dm-preview-header">
        <span className="dm-preview-title">Preview</span>
        {preview && preview.errorCount > 0 && (
          <span className="dm-preview-errors">{preview.errorCount} error{preview.errorCount !== 1 ? 's' : ''}</span>
        )}
        <span className="dm-preview-count">{mappings.length} mapping{mappings.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="dm-preview-columns">
        <div className="dm-preview-column">
          <div className="dm-preview-col-label">Source Sample</div>
          <pre className="dm-preview-json">{sourceJson || '(no data)'}</pre>
        </div>
        <div className="dm-preview-divider" />
        <div className="dm-preview-column">
          <div className="dm-preview-col-label">Mapped Output</div>
          <pre className="dm-preview-json dm-preview-json--output" aria-label="Mapped output" aria-live="polite">{targetJson || '(evaluating…)'}</pre>
        </div>
      </div>
      {preview && preview.fields.some((f) => f.error) && (
        <div className="dm-preview-error-list" aria-live="polite">
          {preview.fields
            .filter((f) => f.error)
            .map((f) => (
              <div key={`${f.targetPath}-${f.error}`} className="dm-preview-error-item">
                <span className="dm-preview-error-path">{f.targetPath}</span>
                <span className="dm-preview-error-msg">{f.error}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function normalizePreviewDisplayJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizePreviewDisplayJson(item));
  }

  if (value != null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      result[normalizePreviewKey(key)] = normalizePreviewDisplayJson(item);
    }
    return result;
  }

  if (typeof value === 'string') {
    return normalizePreviewStringValue(value);
  }

  return value;
}

function normalizePreviewKey(key: string): string {
  const trimmed = key.trim();
  if (!(trimmed.startsWith('"') && trimmed.endsWith('"'))) return key;
  try {
    const parsed = JSON.parse(trimmed);
    return typeof parsed === 'string' ? parsed : key;
  } catch {
    return key;
  }
}

function normalizePreviewStringValue(value: string): unknown {
  const trimmed = value.trim();
  const looksQuoted = trimmed.startsWith('"') && trimmed.endsWith('"');
  const looksContainer = (
    (trimmed.startsWith('{') && trimmed.endsWith('}'))
    || (trimmed.startsWith('[') && trimmed.endsWith(']'))
  );
  if (!looksQuoted && !looksContainer) return value;

  try {
    const parsed = JSON.parse(trimmed);
    return normalizePreviewDisplayJson(parsed);
  } catch {
    return value;
  }
}
