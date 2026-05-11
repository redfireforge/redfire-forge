import { useState, useCallback, useRef, useMemo } from 'react';
import DataMapper from './DataMapper';
import type { MapperAdapter, Mapping, ValidationIssue } from './types';
import '../../../styles/data-mapper-modal.css';

interface DataMapperModalProps<TOutput = unknown> {
  adapter: MapperAdapter<TOutput>;
  initialData?: TOutput;
  onSave: (output: TOutput) => void;
  onCancel: () => void;
  fullScreenDefault?: boolean;
}

/**
 * Detect unmapped required target fields.
 * Checks both fieldConstraints and target.fields for required markers.
 */
function findUnmappedRequired(
  adapter: MapperAdapter<unknown>,
  mappings: Mapping[],
): ValidationIssue[] {
  const mappedTargets = new Set(mappings.map((m) => m.targetPath));
  const issues: ValidationIssue[] = [];
  const reported = new Set<string>();

  const constraints = adapter.target.fieldConstraints;
  if (constraints) {
    for (const [path, constraint] of Object.entries(constraints)) {
      if (constraint.required && !mappedTargets.has(path)) {
        issues.push({
          targetPath: path,
          severity: 'warning',
          message: `Required field "${path}" is not mapped.`,
        });
        reported.add(path);
      }
    }
  }

  const fields = adapter.target.fields;
  if (fields) {
    for (const field of fields) {
      if (field.required && !mappedTargets.has(field.path) && !reported.has(field.path)) {
        issues.push({
          targetPath: field.path,
          severity: 'warning',
          message: `Required field "${field.path}" is not mapped.`,
        });
      }
    }
  }

  return issues;
}

export default function DataMapperModal<TOutput = unknown>({
  adapter,
  initialData,
  onSave,
  onCancel,
  fullScreenDefault = false,
}: DataMapperModalProps<TOutput>) {
  const [isFullScreen, setIsFullScreen] = useState(fullScreenDefault);
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
  const currentMappingsRef = useRef<Mapping[]>([]);

  const handleMappingsChange = useCallback((mappings: Mapping[]) => {
    currentMappingsRef.current = mappings;
    setValidationIssues([]);
  }, []);

  const handleDone = useCallback(() => {
    const mappings = currentMappingsRef.current;

    const adapterIssues = adapter.validate?.(mappings) ?? [];
    const requiredIssues = findUnmappedRequired(adapter, mappings);
    const allIssues = [...adapterIssues, ...requiredIssues];

    const errors = allIssues.filter((i) => i.severity === 'error');
    if (errors.length > 0) {
      setValidationIssues(allIssues);
      return;
    }

    if (allIssues.length > 0) {
      setValidationIssues(allIssues);
    }

    let output: TOutput;
    try {
      output = adapter.serialize(mappings);
    } catch (err) {
      setValidationIssues(prev => [
        ...prev.filter(i => !i.message.startsWith('Save failed:')),
        {
          severity: 'warning',
          message: `Save failed: ${err instanceof Error ? err.message : String(err)}. Try again or adjust mappings.`,
        },
      ]);
      return;
    }
    onSave(output);
  }, [adapter, onSave]);

  const errorCount = useMemo(
    () => validationIssues.filter((i) => i.severity === 'error').length,
    [validationIssues],
  );
  const warningCount = useMemo(
    () => validationIssues.filter((i) => i.severity === 'warning').length,
    [validationIssues],
  );

  return (
    <div
      className={`dm-modal-overlay ${isFullScreen ? 'dm-modal--fullscreen' : ''}`}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
    >
      <div className="dm-modal-shell">
        <div className="dm-modal-header">
          <h2 className="dm-modal-title">{adapter.title}</h2>
          <div className="dm-modal-header-actions">
            <button
              className="dm-btn-icon"
              onClick={() => setIsFullScreen((f) => !f)}
              title={isFullScreen ? 'Exit full screen' : 'Full screen'}
            >
              {isFullScreen ? '⊟' : '⊞'}
            </button>
            <button className="dm-btn-icon" onClick={onCancel} title="Close">
              ×
            </button>
          </div>
        </div>

        <div className="dm-modal-body">
          <DataMapper
            adapter={adapter}
            initialData={initialData}
            onChange={handleMappingsChange}
            height="100%"
          />
        </div>

        {validationIssues.length > 0 && (
          <div className="dm-validation-bar">
            {errorCount > 0 && (
              <span className="dm-validation-count dm-validation-count--error">
                {errorCount} error{errorCount !== 1 ? 's' : ''}
              </span>
            )}
            {warningCount > 0 && (
              <span className="dm-validation-count dm-validation-count--warning">
                {warningCount} warning{warningCount !== 1 ? 's' : ''}
              </span>
            )}
            <div className="dm-validation-issues">
              {validationIssues.map((issue, idx) => (
                <div
                  key={idx}
                  className={`dm-validation-issue dm-validation-issue--${issue.severity}`}
                >
                  <span className="dm-validation-icon">
                    {issue.severity === 'error' ? '✕' : issue.severity === 'warning' ? '⚠' : 'ℹ'}
                  </span>
                  <span className="dm-validation-msg">{issue.message}</span>
                  {issue.targetPath && (
                    <span className="dm-validation-path">{issue.targetPath}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="dm-modal-footer">
          <button className="dm-modal-btn dm-modal-btn--secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="dm-modal-btn dm-modal-btn--primary"
            onClick={handleDone}
            disabled={errorCount > 0}
            title={errorCount > 0 ? 'Fix errors before saving' : 'Save mappings'}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
