import { useCallback } from 'react';

export interface PathParamEntry {
  key: string;
  value: string;
  description?: string;
  required?: boolean;
}

interface PathParamsEditorProps {
  params: PathParamEntry[];
  onChange: (params: PathParamEntry[]) => void;
}

export function PathParamsEditor({ params, onChange }: PathParamsEditorProps) {
  const update = useCallback(
    (idx: number, value: string) => {
      const next = [...params];
      next[idx] = { ...next[idx], value };
      onChange(next);
    },
    [params, onChange],
  );

  if (params.length === 0) return null;

  return (
    <div className="path-params-editor">
      <div className="params-toolbar">
        <div className="params-toolbar-left">
          <span className="params-section-label">PATH PARAMETERS</span>
          <span className="tab-badge">{params.length}</span>
        </div>
      </div>

      <div className="path-params-grid-header">
        <span>name</span>
        <span>value</span>
        <span>description</span>
      </div>

      {params.map((p, i) => (
        <div key={p.key} className="path-params-row">
          <div className="path-params-name">
            <code>{p.key}</code>
            {p.required && <span className="path-params-required">*</span>}
          </div>
          <input
            className="params-input"
            value={p.value}
            onChange={(e) => update(i, e.target.value)}
            placeholder={`Enter ${p.key}`}
          />
          <span className="path-params-desc">{p.description || '—'}</span>
        </div>
      ))}
    </div>
  );
}
