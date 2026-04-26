import { useState } from 'react';

interface Props {
  variables: Record<string, string>;
  onChange: (variables: Record<string, string>) => void;
  disabled?: boolean;
}

/**
 * Editor for initial workflow variables — shown when workflow mode is selected.
 * Lets users define key/value pairs that will be available as {{varName}} in all steps.
 */
export default function WorkflowVariablesInput({ variables, onChange, disabled }: Props) {
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  const entries = Object.entries(variables);

  const add = () => {
    const key = newKey.trim().replace(/[{}]/g, '');
    if (!key) return;
    onChange({ ...variables, [key]: newValue });
    setNewKey('');
    setNewValue('');
  };

  const remove = (key: string) => {
    const next = { ...variables };
    delete next[key];
    onChange(next);
  };

  const update = (oldKey: string, value: string) => {
    onChange({ ...variables, [oldKey]: value });
  };

  return (
    <div className="wf-vars-input">
      <div className="var-panel-title">Initial Variables</div>
      <p className="extraction-hint" style={{ marginBottom: 6 }}>
        Define variables available to all steps via <code>{'{{name}}'}</code>.
        Built-in generators: <code>{'{{$uuid}}'}</code>, <code>{'{{$timestamp}}'}</code>, <code>{'{{$randomInt(1,100)}}'}</code>.
      </p>

      {entries.length > 0 && (
        <div className="wf-vars-list">
          {entries.map(([key, value]) => (
            <div key={key} className="wf-var-row">
              <span className="extraction-brace">{'{{'}</span>
              <span className="wf-var-key">{key}</span>
              <span className="extraction-brace">{'}}'}</span>
              <span className="var-chip-eq">=</span>
              <input
                className="wf-var-value-input"
                value={value}
                onChange={(e) => update(key, e.target.value)}
                disabled={disabled}
              />
              <button type="button" className="btn btn-sm btn-danger" onClick={() => remove(key)} disabled={disabled}>×</button>
            </div>
          ))}
        </div>
      )}

      {!disabled && (
        <div className="wf-var-add-row">
          <input
            placeholder="name"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            className="wf-var-add-key"
          />
          <input
            placeholder="value"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            className="wf-var-add-value"
          />
          <button type="button" className="btn btn-sm" onClick={add}>+ Add</button>
        </div>
      )}
    </div>
  );
}
