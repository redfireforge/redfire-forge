import type { ExpectedField } from '../../../shared/types';

interface PivotedRules {
  columns: string[];
  rows: Array<{ key: string; cells: Map<string, { value?: string }> }>;
  arrayPrefix: string | null;
}

interface ValidationRulesSummaryProps {
  expectedFields: ExpectedField[];
  pivotedRules: PivotedRules;
  canPivot: boolean;
  rulesViewMode: 'flat' | 'pivot';
  onViewModeChange: (mode: 'flat' | 'pivot') => void;
  onRemoveField: (index: number) => void;
  onRemoveRowPrefix: (prefix: string) => void;
}

export default function ValidationRulesSummary({
  expectedFields,
  pivotedRules,
  canPivot,
  rulesViewMode,
  onViewModeChange,
  onRemoveField,
  onRemoveRowPrefix,
}: ValidationRulesSummaryProps) {
  if (expectedFields.length === 0) return null;

  return (
    <div className="validation-fields-summary">
      <div className="validation-fields-summary-header">
        <span className="validation-fields-summary-title">
          Validation Rules
          <span className="validation-fields-summary-count">
            ({expectedFields.length})
          </span>
        </span>
        {canPivot && (
          <div className="validation-fields-view-toggle" role="tablist" aria-label="Rules view mode">
            <button
              type="button"
              role="tab"
              aria-selected={rulesViewMode === 'flat'}
              className={`validation-fields-view-btn ${rulesViewMode === 'flat' ? 'is-active' : ''}`}
              onClick={() => onViewModeChange('flat')}
            >
              List
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={rulesViewMode === 'pivot'}
              className={`validation-fields-view-btn ${rulesViewMode === 'pivot' ? 'is-active' : ''}`}
              onClick={() => onViewModeChange('pivot')}
            >
              Table
            </button>
          </div>
        )}
      </div>
      {(!canPivot || rulesViewMode === 'flat') ? (
        <table className="validation-fields-table">
          <thead>
            <tr>
              <th>JSON Path</th>
              <th>Operator</th>
              <th>Expected Value</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {expectedFields.map((f: ExpectedField, idx: number) => (
              <tr key={idx}>
                <td><code>{f.jsonPath}</code></td>
                <td>
                  <span className={`validation-field-op-badge validation-field-op-badge--${f.operator ?? 'equals'}`}>
                    {f.operator ? f.operator.replace(/_/g, ' ') : 'equals'}
                  </span>
                </td>
                <td><code>{f.operatorValue ?? f.expectedValue}</code></td>
                <td className="validation-fields-actions-cell">
                  <button
                    type="button"
                    className="validation-fields-remove-btn"
                    title={`Remove ${f.jsonPath}`}
                    aria-label={`Remove ${f.jsonPath}`}
                    onClick={() => onRemoveField(idx)}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                      <path d="M3 3 L9 9 M9 3 L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="validation-fields-pivot-wrapper">
          <table className="validation-fields-pivot-table">
            <thead>
              <tr>
                <th className="validation-fields-pivot-row-header">
                  {pivotedRules.arrayPrefix || 'Path'}
                </th>
                {pivotedRules.columns.map((col) => (
                  <th key={col}>{col}</th>
                ))}
                <th aria-label="Actions" className="validation-fields-pivot-actions-header" />
              </tr>
            </thead>
            <tbody>
              {pivotedRules.rows.map((row) => {
                const indexMatch = row.key.match(/\[(\d+)\]$/);
                const label = pivotedRules.arrayPrefix && indexMatch ? `#${indexMatch[1]}` : row.key;
                return (
                  <tr key={row.key}>
                    <td className="validation-fields-pivot-row-header"><code>{label}</code></td>
                    {pivotedRules.columns.map((col) => {
                      const cell = row.cells.get(col);
                      return (
                        <td key={col}>
                          {cell ? (
                            <code className="validation-fields-pivot-val">
                              {String(cell.value ?? '').startsWith('"') && String(cell.value ?? '').endsWith('"') && String(cell.value ?? '').length >= 2
                                ? String(cell.value ?? '').slice(1, -1)
                                : String(cell.value ?? '')}
                            </code>
                          ) : (
                            <span className="validation-fields-pivot-empty">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="validation-fields-actions-cell">
                      <button
                        type="button"
                        className="validation-fields-remove-btn"
                        title={`Remove ${row.key}`}
                        aria-label={`Remove ${row.key}`}
                        onClick={() => onRemoveRowPrefix(row.key)}
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                          <path d="M3 3 L9 9 M9 3 L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
