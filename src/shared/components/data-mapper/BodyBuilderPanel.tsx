/**
 * BodyBuilderPanel — visual body construction panel for the Request Body Builder.
 *
 * Three modes:
 * - JSON:      structured JSON body with DataMapper tree view (drag variables onto fields)
 * - Form-data: key-value pair mapping for multipart/form-data or urlencoded bodies
 * - Raw:       plain text body with {{var}} template references
 *
 * Syncs bi-directionally with the raw body textarea via useBodyBuilderSync.
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import type { BodyType, KeyValue } from '../../types';
import type { Mapping } from './types';
import {
  createRequestBodyAdapter,
  extractBodyTemplateRefs,
} from './adapters/requestBodyAdapter';
import type { VariableHintForBody } from './adapters/requestBodyAdapter';
import DataMapper from './DataMapper';
import '../../../styles/data-mapper.css';

// ─── Types ────────────────────────────────────────────────

export type BodyBuilderMode = 'json' | 'form' | 'raw';

export interface BodyBuilderPanelProps {
  body: string;
  bodyType: BodyType;
  bodyForm?: KeyValue[];
  variableHints?: VariableHintForBody[];
  envVariables?: string[];
  onBodyChange: (newBody: string) => void;
  onMappingsChange: (newMappings: Mapping[]) => void;
  onBodyTypeChange?: (bodyType: BodyType) => void;
  onBodyFormChange?: (bodyForm: KeyValue[]) => void;
}

function resolveMode(bodyType: BodyType): BodyBuilderMode {
  if (bodyType === 'form-urlencoded' || bodyType === 'form-data') return 'form';
  if (bodyType === 'json') return 'json';
  return 'raw';
}

// ─── JSON Mode ────────────────────────────────────────────

function JsonBuilderMode({
  body,
  variableHints,
  envVariables,
  onMappingsChange,
}: {
  body: string;
  variableHints: VariableHintForBody[];
  envVariables: string[];
  onMappingsChange: (m: Mapping[]) => void;
}) {
  const adapter = useMemo(
    () =>
      createRequestBodyAdapter({
        existingBody: body,
        variableHints,
        envVariables,
      }),
    [body, variableHints, envVariables],
  );

  return (
    <div className="body-builder-json-mode">
      <DataMapper
        adapter={adapter}
        initialData={body}
        onChange={onMappingsChange}
      />
    </div>
  );
}

// ─── Form Mode ────────────────────────────────────────────

function FormBuilderMode({
  bodyForm,
  variableHints,
  onBodyFormChange,
}: {
  bodyForm: KeyValue[];
  variableHints: VariableHintForBody[];
  onBodyFormChange: (bodyForm: KeyValue[]) => void;
}) {
  const handleFieldChange = useCallback(
    (index: number, field: 'key' | 'value', newVal: string) => {
      const updated = bodyForm.map((kv, i) =>
        i === index ? { ...kv, [field]: newVal } : kv,
      );
      onBodyFormChange(updated);
    },
    [bodyForm, onBodyFormChange],
  );

  const handleAdd = useCallback(() => {
    onBodyFormChange([...bodyForm, { key: '', value: '' }]);
  }, [bodyForm, onBodyFormChange]);

  const handleRemove = useCallback(
    (index: number) => {
      onBodyFormChange(bodyForm.filter((_, i) => i !== index));
    },
    [bodyForm, onBodyFormChange],
  );

  const availableVars = useMemo(
    () => variableHints.map((h) => h.ref),
    [variableHints],
  );

  return (
    <div className="body-builder-form-mode">
      <div className="body-builder-form-list">
        {bodyForm.map((kv, i) => (
          <div key={i} className="body-builder-form-row">
            <input
              className="body-builder-form-key"
              value={kv.key}
              placeholder="Field name"
              onChange={(e) => handleFieldChange(i, 'key', e.target.value)}
            />
            <input
              className="body-builder-form-value"
              value={kv.value}
              placeholder="Value or {{variable}}"
              onChange={(e) => handleFieldChange(i, 'value', e.target.value)}
              list={`body-builder-var-list-${i}`}
            />
            {availableVars.length > 0 && (
              <datalist id={`body-builder-var-list-${i}`}>
                {availableVars.map((v) => (
                  <option key={v} value={`{{${v}}}`} />
                ))}
              </datalist>
            )}
            <button
              type="button"
              className="btn btn-sm btn-danger body-builder-form-remove"
              onClick={() => handleRemove(i)}
              title="Remove field"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="btn btn-sm body-builder-form-add"
        onClick={handleAdd}
      >
        + Add Field
      </button>
    </div>
  );
}

// ─── Raw Mode ─────────────────────────────────────────────

function RawBuilderMode({
  body,
  variableHints,
  onBodyChange,
}: {
  body: string;
  variableHints: VariableHintForBody[];
  onBodyChange: (body: string) => void;
}) {
  const refs = useMemo(() => extractBodyTemplateRefs(body), [body]);

  return (
    <div className="body-builder-raw-mode">
      <textarea
        className="body-builder-raw-textarea"
        value={body}
        onChange={(e) => onBodyChange(e.target.value)}
        placeholder="Enter raw body content with {{variable}} placeholders..."
        rows={8}
        spellCheck={false}
      />
      {refs.length > 0 && (
        <div className="body-builder-raw-refs">
          <span className="body-builder-raw-refs-label">Template refs:</span>
          {refs.map((ref, i) => (
            <code key={`${ref}-${i}`} className="body-builder-raw-ref-tag">
              {`{{${ref}}}`}
            </code>
          ))}
        </div>
      )}
      {variableHints.length > 0 && (
        <details className="body-builder-raw-vars">
          <summary>Available variables ({variableHints.length})</summary>
          <div className="body-builder-raw-vars-list">
            {variableHints.map((h) => (
              <button
                key={h.ref}
                type="button"
                className="body-builder-raw-var-chip"
                title={h.description ?? h.ref}
                onClick={() => onBodyChange(body + `{{${h.ref}}}`)}
              >
                {h.label}
              </button>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────

export default function BodyBuilderPanel({
  body,
  bodyType,
  bodyForm = [],
  variableHints = [],
  envVariables = [],
  onBodyChange,
  onMappingsChange,
  onBodyTypeChange,
  onBodyFormChange,
}: BodyBuilderPanelProps) {
  const [activeMode, setActiveMode] = useState<BodyBuilderMode>(() => resolveMode(bodyType));

  useEffect(() => {
    setActiveMode(resolveMode(bodyType));
  }, [bodyType]);

  const handleModeSwitch = useCallback(
    (mode: BodyBuilderMode) => {
      setActiveMode(mode);
      if (onBodyTypeChange) {
        switch (mode) {
          case 'json':
            onBodyTypeChange('json');
            break;
          case 'form':
            onBodyTypeChange('form-urlencoded');
            break;
          case 'raw':
            onBodyTypeChange('text');
            break;
        }
      }
    },
    [onBodyTypeChange],
  );

  const handleFormBodyFormChange = useCallback(
    (newForm: KeyValue[]) => {
      onBodyFormChange?.(newForm);
    },
    [onBodyFormChange],
  );

  return (
    <div className="body-builder-panel">
      <div className="body-builder-mode-tabs" role="tablist">
        {(
          [
            { mode: 'json' as const, label: 'JSON Builder' },
            { mode: 'form' as const, label: 'Form Fields' },
            { mode: 'raw' as const, label: 'Raw Template' },
          ] as const
        ).map(({ mode, label }) => (
          <button
            key={mode}
            role="tab"
            aria-selected={activeMode === mode}
            className={`body-builder-mode-tab ${activeMode === mode ? 'active' : ''}`}
            onClick={() => handleModeSwitch(mode)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="body-builder-content" role="tabpanel">
        {activeMode === 'json' && (
          <JsonBuilderMode
            body={body}
            variableHints={variableHints}
            envVariables={envVariables}
            onMappingsChange={onMappingsChange}
          />
        )}
        {activeMode === 'form' && (
          <FormBuilderMode
            bodyForm={bodyForm}
            variableHints={variableHints}
            onBodyFormChange={handleFormBodyFormChange}
          />
        )}
        {activeMode === 'raw' && (
          <RawBuilderMode
            body={body}
            variableHints={variableHints}
            onBodyChange={onBodyChange}
          />
        )}
      </div>
    </div>
  );
}
