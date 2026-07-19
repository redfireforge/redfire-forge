import type { Dispatch, SetStateAction } from 'react';
import ColumnOrderPopover from './ColumnOrderPopover';
import type { ColumnDef } from '../utils/csvTemplate';

function applyReorderedColumns(
  reordered: Array<ColumnDef & { _idx: number; name: string }>,
  setColumnDefs: Dispatch<SetStateAction<ColumnDef[]>>,
) {
  setColumnDefs(reordered.map((row) => {
    const { name: _unusedName, _idx, ...rest } = row;
    return rest as ColumnDef;
  }));
}

export function DataSourceSetupColumnsStep({
  columnDefs,
  duplicateNames,
  contractPatterns,
  setContractPatterns,
  showColOrder,
  setShowColOrder,
  updateColumnName,
  setColumnDefs,
}: {
  columnDefs: ColumnDef[];
  duplicateNames: Set<string>;
  contractPatterns: Set<string>;
  setContractPatterns: Dispatch<SetStateAction<Set<string>>>;
  showColOrder: false | 'step2';
  setShowColOrder: Dispatch<SetStateAction<false | 'step2'>>;
  updateColumnName: (idx: number, name: string) => void;
  setColumnDefs: Dispatch<SetStateAction<ColumnDef[]>>;
}) {
  return (
    <div className="excel-step-content excel-step-columns">
      <div className="step-columns-header">
        <div>
          <div className="csv-panel-title">Configure Columns</div>
          <div className="csv-panel-desc" style={{ marginBottom: 0 }}>
            These become the data source columns. Edit names as needed. Names must be unique.
          </div>
        </div>
        <div className="step-columns-stats">
          {columnDefs.filter((d) => d.type === 'path').length > 0 && <span className="step-col-stat step-col-stat-path">{columnDefs.filter((d) => d.type === 'path').length} path</span>}
          {columnDefs.filter((d) => d.type === 'param').length > 0 && <span className="step-col-stat step-col-stat-param">{columnDefs.filter((d) => d.type === 'param').length} param</span>}
          {columnDefs.filter((d) => d.type === 'validate').length > 0 && <span className="step-col-stat step-col-stat-validate">{columnDefs.filter((d) => d.type === 'validate').length} validate</span>}
          <span className="step-col-stat-total">{columnDefs.length} total</span>
        </div>
      </div>
      {columnDefs.length > 1 && (
        <div className="excel-col-order-controls" style={{ position: 'relative' }}>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setShowColOrder((value) => value === 'step2' ? false : 'step2')}
          >
            ↕ Column Order
          </button>
          {showColOrder === 'step2' && (
            <ColumnOrderPopover
              items={columnDefs.map((d, i) => ({ ...d, name: d.customName, _idx: i }))}
              onApply={(reordered) => applyReorderedColumns(reordered, setColumnDefs)}
              onClose={() => setShowColOrder(false)}
            />
          )}
        </div>
      )}
      <div className="excel-col-table-wrap">
        <table className="excel-col-table">
          <thead>
            <tr>
              <th style={{ width: 40 }}>#</th>
              <th>Type</th>
              <th>Mapping</th>
              <th>Column Name</th>
              <th style={{ width: 36 }}></th>
            </tr>
          </thead>
          <tbody>
            {columnDefs.map((d, i) => {
              const isDup = duplicateNames.has(d.customName.trim());
              const isEmpty = !d.customName.trim();
              const hasError = isDup || isEmpty;
              const fieldPattern = d.type === 'validate' && d.mapping.match(/\[\d+\]/)
                ? d.mapping.replace(/\[\d+\]/g, '[*]')
                : null;
              const isDynamic = fieldPattern ? contractPatterns.has(fieldPattern) : false;
              return (
                <tr key={i} className={hasError ? 'excel-col-row-error' : ''}>
                  <td className="excel-col-num">{i + 1}</td>
                  <td>
                    <span className={`excel-col-type-badge type-${d.type}`}>{d.type}</span>
                  </td>
                  <td className="excel-col-path">
                    <code>{d.mapping}</code>
                    {isDynamic && <span className="excel-col-dynamic-badge" title="Dynamic array — columns expand automatically based on API response length. Click to make fixed." onClick={() => { const next = new Set(contractPatterns); next.delete(fieldPattern!); setContractPatterns(next); }}>dynamic</span>}
                    {fieldPattern && !isDynamic && <button type="button" className="excel-col-fixed-badge" title="Fixed array index — click to make dynamic (auto-expand based on API response)" onClick={() => { const next = new Set(contractPatterns); next.add(fieldPattern); setContractPatterns(next); }}>fixed → dynamic?</button>}
                  </td>
                  <td>
                    <input
                      type="text"
                      className={`excel-col-input ${hasError ? 'input-error' : ''}`}
                      value={d.customName}
                      onChange={(e) => updateColumnName(i, e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                    />
                    {isDup && <span className="excel-col-err">duplicate</span>}
                    {isEmpty && <span className="excel-col-err">required</span>}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="excel-col-delete-btn"
                      title="Remove column"
                      onClick={() => setColumnDefs((prev) => prev.filter((_, idx) => idx !== i))}
                    >×</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function DataSourceSetupColumnOrderStep({
  columnDefs,
  setColumnDefs,
}: {
  columnDefs: ColumnDef[];
  setColumnDefs: Dispatch<SetStateAction<ColumnDef[]>>;
}) {
  return (
    <div className="excel-step-content parameterize-order-step">
      <div className="parameterize-order-header">
        <div>
          <div className="csv-panel-title">Column Order</div>
          <div className="csv-panel-desc">
            Drag columns to reorder. This determines the column layout in the data source table.
          </div>
        </div>
        <div className="parameterize-order-stats">
          <span className="parameterize-order-stat">{columnDefs.filter((d) => d.type !== 'validate').length} input</span>
          <span className="parameterize-order-stat parameterize-order-stat-validate">{columnDefs.filter((d) => d.type === 'validate').length} validate</span>
          <span className="parameterize-order-stat-total">{columnDefs.length} total</span>
        </div>
      </div>
      <div className="parameterize-order-inline">
        <ColumnOrderPopover
          items={columnDefs.map((d, i) => ({ ...d, name: d.customName, _idx: i }))}
          onApply={(reordered) => applyReorderedColumns(reordered, setColumnDefs)}
          onClose={() => { /* no-op: inline, not a popover */ }}
          autoApply
        />
      </div>
    </div>
  );
}
