/** Side-by-side field comparison for two marked history entries. */
import { useEffect } from 'react';
import type { GraphqlHistoryItem } from '@shared/types/graphql';
import { compareHistoryItems, type HistoryCompareFieldRow } from '../utils/historyCompare';

export interface GraphqlHistoryComparePanelProps {
  itemA: GraphqlHistoryItem;
  itemB: GraphqlHistoryItem;
  onClose: () => void;
  onBack: () => void;
}

function formatWhen(ts: number): string {
  return new Date(ts).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function CompareFieldTable({
  title,
  rows,
  testId,
}: {
  title: string;
  rows: HistoryCompareFieldRow[];
  testId: string;
}) {
  if (rows.length === 0) {
    return (
      <section className="gql-history-compare-section" aria-label={title}>
        <h4 className="gql-history-compare-section-title">{title}</h4>
        <p className="gql-history-compare-empty">No fields to compare.</p>
      </section>
    );
  }

  return (
    <section className="gql-history-compare-section" aria-label={title}>
      <h4 className="gql-history-compare-section-title">{title}</h4>
      <div className="gql-history-compare-table-wrap">
        <table className="gql-history-compare-table" data-testid={testId}>
          <thead>
            <tr>
              <th scope="col">Field</th>
              <th scope="col">Run A</th>
              <th scope="col">Run B</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.path}
                className={row.same ? 'gql-history-compare-row--same' : 'gql-history-compare-row--diff'}
                data-testid="gql-history-compare-row"
                data-diff={row.same ? 'false' : 'true'}
              >
                <td className="gql-history-compare-path">{row.path}</td>
                <td className="gql-history-compare-val">{row.valueA}</td>
                <td className="gql-history-compare-val">{row.valueB}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function GraphqlHistoryComparePanel({
  itemA,
  itemB,
  onClose,
  onBack,
}: GraphqlHistoryComparePanelProps) {
  const result = compareHistoryItems(itemA, itemB);
  const labelA = `${result.nameA} · ${formatWhen(itemA.timestamp)}`;
  const labelB = `${result.nameB} · ${formatWhen(itemB.timestamp)}`;
  const diffCount = [...result.variablesRows, ...result.responseRows].filter((r) => !r.same).length;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack]);

  return (
    <div
      className="gql-history-compare-panel"
      data-testid="gql-history-compare-panel"
      role="complementary"
      aria-label="History entry comparison"
    >
      <div className="gql-history-compare-header">
        <button
          type="button"
          className="gql-history-preview-back"
          onClick={onBack}
          aria-label="Back to history list"
          title="Back to list"
          data-testid="gql-history-compare-back"
        >
          ←
        </button>
        <div className="gql-history-compare-heading">
          <h3 className="gql-history-compare-title">Compare runs</h3>
          <span className="gql-history-compare-subtitle">
            {diffCount} differing field{diffCount === 1 ? '' : 's'}
            {result.querySame ? ' · same query text' : ' · query text differs'}
          </span>
        </div>
      </div>

      <div className="gql-history-compare-body">
        <CompareFieldTable
          title="Variables"
          rows={result.variablesRows}
          testId="gql-history-compare-vars-table"
        />
        <CompareFieldTable
          title="Response data"
          rows={result.responseRows}
          testId="gql-history-compare-table"
        />
      </div>

      <div className="gql-history-compare-labels" aria-hidden="true">
        <span className="gql-history-compare-slot-label gql-history-compare-slot-label--a">A — {labelA}</span>
        <span className="gql-history-compare-slot-label gql-history-compare-slot-label--b">B — {labelB}</span>
      </div>
      <div className="gql-history-compare-footer">
        <button type="button" className="btn btn-primary" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
