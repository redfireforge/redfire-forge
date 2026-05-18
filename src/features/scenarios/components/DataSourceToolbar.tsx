/**
 * DataSourceToolbar — Unified toolbar for DataSourceEditor.
 * Extracted to reduce DataSourceEditor.tsx line count.
 */
import type { DataSource, SharedDataSource } from '../../../shared/types';
import ColumnOrderPopover from './ColumnOrderPopover';

interface DataSourceToolbarProps {
  dt: DataSource;
  linkedSharedDs: SharedDataSource | null;
  availableSharedDs: SharedDataSource[];
  enabledCount: number;
  refetchingAll: boolean;
  showDetachDropdown: boolean;
  setShowDetachDropdown: (v: boolean) => void;
  showColumnOrder: boolean;
  setShowColumnOrder: (v: boolean) => void;
  showContract: boolean;
  setShowContract: (v: boolean | ((v: boolean) => boolean)) => void;
  detachDropdownRef: React.RefObject<HTMLDivElement | null>;
  onDetachWithCopy: () => void;
  onDetachUnlinkOnly: () => void;
  onLinkSharedDs: (sharedId: string) => void;
  onAddRow: () => void;
  onAddSampleRow: () => void;
  onAddColumn: () => void;
  onShowPopulateModal: () => void;
  onShowColumnMapper: () => void;
  onShowVerifyModal: () => void;
  onRefetchAllRows: () => void;
  onDistributionChange: (distribution: DataSource['distribution']) => void;
  onValidationModeChange: (mode: DataSource['validationMode']) => void;
  onShowSetupModal: () => void;
  onShowPromoteModal: () => void;
  onDeleteAllRows: () => void;
  onRemoveTable: () => void;
  onColumnOrderApply: (cols: DataSource['columns']) => void;
  onOpenSharedDsModal?: () => void;
  onPromoteToShared?: unknown;
}

export default function DataSourceToolbar({
  dt,
  linkedSharedDs,
  availableSharedDs,
  enabledCount,
  refetchingAll,
  showDetachDropdown,
  setShowDetachDropdown,
  showColumnOrder,
  setShowColumnOrder,
  showContract,
  setShowContract,
  detachDropdownRef,
  onDetachWithCopy,
  onDetachUnlinkOnly,
  onLinkSharedDs,
  onAddRow,
  onAddSampleRow,
  onAddColumn,
  onShowPopulateModal,
  onShowColumnMapper,
  onShowVerifyModal,
  onRefetchAllRows,
  onDistributionChange,
  onValidationModeChange,
  onShowSetupModal,
  onShowPromoteModal,
  onDeleteAllRows,
  onRemoveTable,
  onColumnOrderApply,
  onOpenSharedDsModal,
  onPromoteToShared,
}: DataSourceToolbarProps) {
  return (
    <div className="data-source-toolbar-unified">
      <div className="data-source-toolbar-title">
        <span className="params-section-label">DATA SOURCE</span>
        {linkedSharedDs && (
          <button
            type="button"
            className="data-source-toolbar-badge shared-ds-badge shared-ds-badge-link"
            title={`Linked to shared: ${linkedSharedDs.name} — Click to open Shared Data Sources`}
            onClick={onOpenSharedDsModal}
          >
            📋 {linkedSharedDs.name}
          </button>
        )}
        {enabledCount > 0 && <span className="data-source-toolbar-badge">{enabledCount}</span>}
        <span className="data-source-row-info">
          {enabledCount} of {dt.rows.length} rows enabled
          {linkedSharedDs && ' (read-only — linked to shared data source)'}
        </span>
      </div>
      <div className="data-source-toolbar-actions">
        {/* Shared data source link/unlink/promote */}
        <div className="data-source-toolbar-group">
          {linkedSharedDs ? (
            <div ref={detachDropdownRef} className="data-source-detach-dropdown" style={{ position: 'relative' }}>
              <button
                type="button"
                className="data-source-toolbar-btn"
                onClick={() => setShowDetachDropdown(!showDetachDropdown)}
                title="Detach from shared data source"
              >
                ✂ Detach ▾
              </button>
              {showDetachDropdown && (
                <div className="detach-dropdown-menu" onClick={() => setShowDetachDropdown(false)}>
                  <button
                    type="button"
                    className="detach-dropdown-item"
                    onClick={onDetachWithCopy}
                    title="Copy shared data to this test's inline data, then unlink"
                  >
                    <span className="detach-dropdown-icon">📋</span>
                    <span className="detach-dropdown-text">
                      <strong>Copy to Inline</strong>
                      <small>Keep a copy of the data in this test</small>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="detach-dropdown-item"
                    onClick={onDetachUnlinkOnly}
                    title="Just remove the link, test will have no data"
                  >
                    <span className="detach-dropdown-icon">🔗</span>
                    <span className="detach-dropdown-text">
                      <strong>Unlink Only</strong>
                      <small>Remove link without copying data</small>
                    </span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              {availableSharedDs.length > 0 && (
                <select
                  className="data-source-toolbar-select"
                  value=""
                  onChange={e => { if (e.target.value) onLinkSharedDs(e.target.value); }}
                  title="Link to a shared data source"
                >
                  <option value="">📋 Use Shared…</option>
                  {availableSharedDs.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.dataSource.rows.length} rows)</option>
                  ))}
                </select>
              )}
              {onPromoteToShared && dt && dt.rows.length > 0 && (
                <button
                  type="button"
                  className="data-source-toolbar-btn"
                  onClick={onShowPromoteModal}
                  title="Promote inline data to a shared data source"
                >
                  ⬆ Promote to Shared
                </button>
              )}
            </>
          )}
        </div>
        <div className="data-source-toolbar-group">
          <button type="button" className="data-source-toolbar-btn" onClick={onAddRow} title="Add a new row" disabled={!!linkedSharedDs}>
            + Row
          </button>
          <button type="button" className="data-source-toolbar-btn" onClick={onAddSampleRow} title="Add a sample row (dev-curated example with expected values)" disabled={!!linkedSharedDs}>
            + Sample Row
          </button>
          <button type="button" className="data-source-toolbar-btn" onClick={onAddColumn} title="Add a new column" disabled={!!linkedSharedDs}>
            + Column
          </button>
          <button type="button" className="data-source-toolbar-btn" onClick={onShowPopulateModal} title="Send a request and populate rows from an array in the response" disabled={!!linkedSharedDs}>
            ⬇ From API
          </button>
          <button type="button" className="data-source-toolbar-btn" onClick={onShowColumnMapper} title="Data Mapper: drag columns to URL path, query, body, header, or validate slots" disabled={!!linkedSharedDs || dt.columns.length === 0}>
            🔗 Map Columns
          </button>
        </div>
        <div className="data-source-toolbar-group">
          <button
            type="button"
            className="data-source-toolbar-btn data-source-toolbar-btn-primary"
            onClick={onShowVerifyModal}
            disabled={refetchingAll || enabledCount === 0}
            title="Verify all enabled rows against the real API"
          >
            ▶ Verify All
          </button>
          <button
            type="button"
            className="data-source-toolbar-btn"
            onClick={onRefetchAllRows}
            disabled={refetchingAll || enabledCount === 0}
            title="Re-fetch all enabled rows and repopulate validate columns"
          >
            {refetchingAll ? '⏳ Fetching…' : '↻ Re-fetch'}
          </button>
        </div>
        <div className="data-source-toolbar-group">
          <select
            className="data-source-toolbar-select"
            value={dt.distribution ?? 'sequential'}
            onChange={(e) => onDistributionChange(e.target.value as DataSource['distribution'])}
            title="Row distribution strategy"
          >
            <option value="sequential">Sequential</option>
            <option value="random">Random</option>
            <option value="round-robin">Round Robin</option>
          </select>
          <select
            className="data-source-toolbar-select"
            value={dt.validationMode ?? 'selective'}
            onChange={(e) => onValidationModeChange(e.target.value as DataSource['validationMode'])}
            title="Which rows to validate — No Rows: skip validation, Sample Rows Only: validate 📌 sample rows, All Rows: validate every row"
          >
            <option value="none">Validate: No Rows</option>
            <option value="selective">Validate: Sample Rows Only</option>
            <option value="full">Validate: All Rows</option>
          </select>
        </div>
        <div className="data-source-toolbar-group data-source-toolbar-meta">
          {dt.columns.length > 1 && (
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className={`data-source-toolbar-btn ${showColumnOrder ? 'active' : ''}`}
                onClick={() => setShowColumnOrder(!showColumnOrder)}
                disabled={!!linkedSharedDs}
                title="Configure column order"
              >
                ↕ Column Order
              </button>
              {showColumnOrder && (
                <ColumnOrderPopover
                  items={dt.columns}
                  onApply={onColumnOrderApply}
                  onClose={() => setShowColumnOrder(false)}
                />
              )}
            </div>
          )}
          <button type="button" className="data-source-toolbar-btn" onClick={onShowSetupModal} title="Configure data source columns">
            ⚙ Configure
          </button>
          <button type="button" className={`data-source-toolbar-btn ${showContract ? 'active' : ''}`} onClick={() => setShowContract((v: boolean) => !v)} title="Toggle validation contract">
            Contract
          </button>
          <button type="button" className="data-source-toolbar-btn data-source-toolbar-btn-danger" onClick={onDeleteAllRows} title="Delete all rows">
            🗑
          </button>
          <button type="button" className="data-source-toolbar-btn data-source-toolbar-btn-danger" onClick={onRemoveTable} title="Remove entire data source">
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
