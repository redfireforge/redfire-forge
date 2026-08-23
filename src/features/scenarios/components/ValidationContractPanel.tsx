import type { DataSource } from '@shared/types';

interface ContractPattern {
  pattern: string;
  count: number;
  isDynamic: boolean;
}

interface ValidationContractPanelProps {
  dataSource: DataSource;
  contractPatterns: ContractPattern[];
  toggleContractPattern: (pattern: string, makeDynamic: boolean) => void;
  removeContractPattern: (pattern: string) => void;
  toggleArrayMode: (arrayPrefix: string) => void;
}

export default function ValidationContractPanel({
  dataSource: dt,
  contractPatterns,
  toggleContractPattern,
  removeContractPattern,
  toggleArrayMode,
}: ValidationContractPanelProps) {
  return (
    <div className="data-source-contract-panel">
      <div className="data-source-contract-header">
        <span className="data-source-contract-title">Validation Contract</span>
        <span className="data-source-contract-hint">
          Dynamic fields auto-expand columns based on API response array length. Fixed fields keep only the defined columns.
        </span>
      </div>
      {contractPatterns.length === 0 ? (
        <div className="data-source-contract-empty">
          No array validate columns found. Add validate columns with array paths (e.g. offers[0].fieldName) to manage here.
        </div>
      ) : (
        <div className="data-source-contract-list">
          {contractPatterns.map(({ pattern, count, isDynamic }) => {
            const prefixMatch = pattern.match(/^(.+?\[\*\])/);
            const arrayPrefix = prefixMatch ? prefixMatch[1] : null;
            const arrayMode = arrayPrefix ? (dt.arrayValidationMode?.[arrayPrefix] ?? 'ordered') : 'ordered';
            return (
              <div key={pattern} className={`data-source-contract-item ${isDynamic ? 'contract-dynamic' : 'contract-fixed'}`}>
                <code className="data-source-contract-pattern">{pattern}</code>
                <span className="data-source-contract-count">{count} col{count !== 1 ? 's' : ''}</span>
                <button
                  type="button"
                  className={`data-source-contract-mode-btn ${isDynamic ? 'mode-dynamic' : 'mode-fixed'}`}
                  title={isDynamic ? 'Dynamic: columns expand from API response. Click to make fixed.' : 'Fixed: only these columns exist. Click to make dynamic.'}
                  onClick={() => toggleContractPattern(pattern, !isDynamic)}
                >
                  {isDynamic ? '⚡ dynamic' : '📌 fixed'}
                </button>
                {arrayPrefix && (
                  <button
                    type="button"
                    className={`data-source-contract-mode-btn ${arrayMode === 'ordered' ? 'mode-ordered' : 'mode-unordered'}`}
                    title={arrayMode === 'ordered' ? 'Ordered: validates by index position. Click for unordered.' : 'Unordered: validates values exist anywhere in array. Click for ordered.'}
                    onClick={() => toggleArrayMode(arrayPrefix)}
                  >
                    {arrayMode === 'ordered' ? '↕ ordered' : '⟳ unordered'}
                  </button>
                )}
                <button
                  type="button"
                  className="data-source-contract-remove"
                  title="Remove this pattern and all its columns"
                  onClick={() => removeContractPattern(pattern)}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
