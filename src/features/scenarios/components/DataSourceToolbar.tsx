/**
 * DataSourceToolbar — Unified toolbar for DataSourceEditor.
 * Extracted to reduce DataSourceEditor.tsx line count.
 */
import { useRef } from 'react';
import type { DataSource, SharedDataSource } from '../../../shared/types';
import { CustomSelect } from '../../../shared/components/CustomSelect';
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
  const columnOrderBtnRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="data-source-toolbar-unified">
      <div className="data-source-toolbar-title">
        <span className="params-section-label">Data Source</span>
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
                <CustomSelect
                  className="data-source-toolbar-select"
                  value=""
                  onChange={(v) => { if (v) onLinkSharedDs(v); }}
                  placeholder="📋 Use Shared…"
                  options={availableSharedDs.map((s) => ({
                    value: s.id,
                    label: `${s.name} (${s.dataSource.rows.length} rows)`,
                  }))}
                />
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
          <button type="button" className="data-source-toolbar-btn" onClick={onShowPopulateModal} title="Fetch a live API response and map fields into data-source rows" disabled={!!linkedSharedDs}>
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
          <CustomSelect
            className="data-source-toolbar-select"
            value={dt.distribution ?? 'sequential'}
            onChange={(v) => onDistributionChange(v as DataSource['distribution'])}
            options={[
              { value: 'sequential', label: 'Sequential' },
              { value: 'random', label: 'Random' },
              { value: 'round-robin', label: 'Round Robin' },
            ]}
          />
          <CustomSelect
            className="data-source-toolbar-select"
            value={dt.validationMode ?? 'selective'}
            onChange={(v) => onValidationModeChange(v as DataSource['validationMode'])}
            options={[
              { value: 'none', label: 'Validate: No Rows' },
              { value: 'selective', label: 'Validate: Sample Rows Only' },
              { value: 'full', label: 'Validate: All Rows' },
            ]}
          />
        </div>
        <div className="data-source-toolbar-group data-source-toolbar-meta">
          {dt.columns.length > 1 && (
            <div style={{ position: 'relative' }}>
              <button
                ref={columnOrderBtnRef}
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
                  anchorRef={columnOrderBtnRef}
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
