/**
 * GraphqlEnvModal — Phase 1E
 *
 * Two-panel modal for managing named GraphQL environments and their variables.
 *
 * Layout:
 *   Left sidebar  (210px) — scrollable environment list + [+ New] + [↑ Import]
 *   Right panel   (flex 1) — selected env name (editable) + variable table
 *
 * Variable table columns: Enabled ☑ | Key | Value (secret-masked by default) | Actions
 *
 * Design rules followed:
 *   - Modal overlay: background: transparent (per project modal rules)
 *   - Escape key closes (with stopPropagation to avoid double-fires)
 *   - Click outside does NOT close — use footer Close button (demo-safe)
 *   - Footer Close button only (no × in header)
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useModalEscapeClose } from '../../../shared/hooks/useModalEscapeClose';
import { useModalDrag } from '../../../shared/hooks/useModalDrag';
import type { GraphqlEnvironment, GraphqlEnvironmentVariable } from '../../../shared/types/graphql';
import { generateVarId } from '../hooks/useGraphqlEnvironments';

// ─── Props ────────────────────────────────────────────────────────────────────

interface GraphqlEnvModalProps {
  environments: GraphqlEnvironment[];
  activeEnvironmentId: string | null;
  onClose: () => void;
  onCreate: (name: string) => string;
  onDelete: (id: string) => void;
  onSetActive: (id: string | null) => void;
  onRename: (id: string, name: string) => void;
  onUpdateVariables: (id: string, variables: GraphqlEnvironmentVariable[]) => void;
  onImport: (json: string) => { success: boolean; error?: string };
  onExport: (id: string) => string | null;
}

// ─── Masked input (password toggle) ──────────────────────────────────────────
// BUG-R2-7 fix: only wrap in the border-providing div when `masked = true`.
// Non-masked variables render a plain gql-input to avoid a double-container look.

function MaskedInput({
  value,
  onChange,
  placeholder,
  masked,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  masked: boolean;
  disabled?: boolean;
}) {
  const [visible, setVisible] = useState(false);

  if (!masked) {
    return (
      <input
        type="text"
        className="gql-env-var-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        aria-label="Variable value"
      />
    );
  }

  return (
    <div className="gql-env-masked-wrap">
      <input
        type={visible ? 'text' : 'password'}
        className="gql-env-var-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="new-password"
        spellCheck={false}
        disabled={disabled}
        aria-label="Variable value (secret)"
      />
      <button
        type="button"
        className="gql-env-masked-toggle"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide value' : 'Show value'}
        title={visible ? 'Hide' : 'Show'}
      >
        {visible ? (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        ) : (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}

function isVariableMasked(variable: GraphqlEnvironmentVariable): boolean {
  return variable.masked !== false;
}

function VarRow({
  variable,
  onChange,
  onRemove,
}: {
  variable: GraphqlEnvironmentVariable & { _id: string };
  onChange: (patch: Partial<GraphqlEnvironmentVariable>) => void;
  onRemove: () => void;
}) {
  return (
    <div className={`gql-env-var-row${variable.enabled ? '' : ' gql-env-var-row--disabled'}`} data-testid="gql-env-var-row">
      <label className="gql-env-var-enable" title={variable.enabled ? 'Enabled — included in {{KEY}} resolution' : 'Disabled — skipped at runtime'}>
        <input
          type="checkbox"
          className="gql-env-var-enable__input"
          checked={variable.enabled}
          onChange={(e) => onChange({ enabled: e.target.checked })}
          aria-label={`Enable variable ${variable.key || 'row'}`}
        />
        <span className="gql-env-var-enable__box" aria-hidden="true" />
      </label>

      <input
        type="text"
        className="gql-env-var-key"
        value={variable.key}
        onChange={(e) => onChange({ key: e.target.value })}
        placeholder="variableName"
        spellCheck={false}
        autoComplete="off"
        aria-label="Variable key"
        data-testid="gql-env-var-key"
      />

      <div className="gql-env-var-value-cell">
        <MaskedInput
          value={variable.value}
          onChange={(v) => onChange({ value: v })}
          placeholder="Enter value"
          masked={isVariableMasked(variable)}
        />
      </div>

      <div className="gql-env-var-row-actions">
        <button
          type="button"
          className={`gql-env-var-secret-toggle${isVariableMasked(variable) ? ' gql-env-var-secret-toggle--active' : ''}`}
          onClick={() => onChange({ masked: !isVariableMasked(variable) })}
          aria-label={
            isVariableMasked(variable)
              ? 'Show value in plain text (still editable)'
              : 'Hide value as secret (mask with dots)'
          }
          title={
            isVariableMasked(variable)
              ? 'Secret — value hidden in UI (click to show plain text; field stays editable)'
              : 'Mark as secret — hide value with •••• in the UI'
          }
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </button>

        <button
          type="button"
          className="gql-env-var-remove"
          onClick={onRemove}
          aria-label={`Remove variable ${variable.key || 'row'}`}
          title="Remove variable"
        >
          Remove
        </button>
      </div>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export function GraphqlEnvModal({
  environments,
  activeEnvironmentId,
  onClose,
  onCreate,
  onDelete,
  onSetActive,
  onRename,
  onUpdateVariables,
  onImport,
  onExport,
}: GraphqlEnvModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const { onDragStart, isDragged, overlayStyle, modalStyle } = useModalDrag(true);

  // BUG-R6-2 fix: move focus inside the modal on open so keyboard/screen-reader
  // users are not stranded outside. Focus the panel itself (tabIndex=-1) which
  // announces the dialog label ("Environment Variables") to screen readers, then
  // the user can Tab through the modal's interactive elements naturally.
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  // Default to the active env, or the first in the list
  const [selectedId, setSelectedId] = useState<string | null>(
    () => activeEnvironmentId ?? environments[0]?.id ?? null,
  );
  const [importError, setImportError] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  // BUG-GQL-R8-8 fix: track which env is awaiting delete confirmation.
  // First click arms the confirm state; second click (within 2.5s) executes delete.
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const deleteConfirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // BUG-GQL-R9-10 fix: clear delete-confirm timer on unmount to prevent setState after unmount
  useEffect(() => () => { if (deleteConfirmTimerRef.current) clearTimeout(deleteConfirmTimerRef.current); }, []);

  // BUG-R2-4 fix: auto-clear import error after 5s so stale messages don't persist
  useEffect(() => {
    if (!importError) return;
    const t = setTimeout(() => setImportError(null), 5000);
    return () => clearTimeout(t);
  }, [importError]);

  const selectedEnv = environments.find((e) => e.id === selectedId) ?? null;

  // When set to true, the sync effect below skips resetting editingName.
  // Used by handleCreate so the "just-created" env goes straight into edit mode
  // without a flash of the static name button (BUG-R2-1 fix).
  const skipNextResetRef = useRef(false);

  // Sync nameValue when selected env changes
  useEffect(() => {
    if (skipNextResetRef.current) {
      // Create action already staged editingName=true; don't reset it here
      skipNextResetRef.current = false;
      setNameValue(selectedEnv?.name ?? '');
      return;
    }
    setNameValue(selectedEnv?.name ?? '');
    setEditingName(false);
  }, [selectedId, selectedEnv?.name]);

  // When the selected env is deleted from outside, switch to first remaining
  useEffect(() => {
    if (selectedId && !environments.find((e) => e.id === selectedId)) {
      setSelectedId(environments[0]?.id ?? null);
    }
  }, [environments, selectedId]);

  // BUG-1E-R4-15 fix: restore focus to the env badge trigger when the modal is
  // explicitly closed (Escape key or × button). Click-outside does NOT restore focus
  // because the user's intent is to move focus to wherever they clicked.
  const restoreFocusToTrigger = () => {
    requestAnimationFrame(() => {
      (document.querySelector<HTMLButtonElement>('[data-testid="gql-env-badge"]'))?.focus();
    });
  };

  const handleEscapeClose = useCallback(() => {
    if (editingName) {
      setEditingName(false);
      setNameValue(selectedEnv?.name ?? '');
    } else {
      restoreFocusToTrigger();
      onClose();
    }
  }, [editingName, onClose, selectedEnv?.name]);

  useModalEscapeClose(handleEscapeClose, { capture: true });

  // ── Name editing ────────────────────────────────────────────────────────────
  const startEditingName = useCallback(() => {
    setEditingName(true);
    setTimeout(() => nameInputRef.current?.select(), 0);
  }, []);

  const commitName = useCallback(() => {
    const trimmed = nameValue.trim();
    if (selectedId && trimmed) {
      onRename(selectedId, trimmed);
    } else {
      // BUG-R3-3 fix: user cleared the name and blurred — reset nameValue to the
      // existing name so the next time they click to edit, the input is not blank.
      setNameValue(selectedEnv?.name ?? '');
    }
    setEditingName(false);
  }, [nameValue, onRename, selectedEnv?.name, selectedId]);

  // ── Create new environment ───────────────────────────────────────────────────
  // BUG-R2-1 fix: set skipNextResetRef before setSelectedId so the sync effect
  // doesn't flash editingName=false before RAF sets it to true.
  const handleCreate = useCallback(() => {
    const id = onCreate('New Environment');
    skipNextResetRef.current = true;
    setSelectedId(id);
    // RAF fires after React has painted the new env in the sidebar,
    // then we transition directly into name-edit mode with no flash.
    requestAnimationFrame(() => {
      setEditingName(true);
      setNameValue('New Environment');
      requestAnimationFrame(() => nameInputRef.current?.select());
    });
  }, [onCreate]);

  // ── Delete environment (two-click confirm) ───────────────────────────────────
  // BUG-GQL-R8-8 fix: one-click delete caused immediate data loss on misclick.
  // Now follows the same "Delete?" confirm pattern as GraphqlProfileModal.
  const handleDeleteClick = useCallback(
    (id: string) => {
      if (confirmingDeleteId === id) {
        // Second click: execute delete
        if (deleteConfirmTimerRef.current) clearTimeout(deleteConfirmTimerRef.current);
        deleteConfirmTimerRef.current = null;
        setConfirmingDeleteId(null);
        onDelete(id);
        if (selectedId === id) {
          const remaining = environments.filter((e) => e.id !== id);
          setSelectedId(remaining[0]?.id ?? null);
        }
      } else {
        // First click: arm confirmation
        if (deleteConfirmTimerRef.current) clearTimeout(deleteConfirmTimerRef.current);
        setConfirmingDeleteId(id);
        deleteConfirmTimerRef.current = setTimeout(() => {
          setConfirmingDeleteId(null);
          deleteConfirmTimerRef.current = null;
        }, 2500);
      }
    },
    [confirmingDeleteId, environments, onDelete, selectedId],
  );

  // ── Import ───────────────────────────────────────────────────────────────────
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        const result = onImport(text);
        if (result.success) {
          setImportError(null);
        } else {
          setImportError(result.error ?? 'Import failed');
        }
      };
      // BUG-GQL-R9-22 fix: handle file read failures (corrupted/unreadable files)
      reader.onerror = () => {
        setImportError('Could not read the selected file');
      };
      reader.readAsText(file);
      // Reset input so the same file can be imported again
      e.target.value = '';
    },
    [onImport],
  );

  // After import, the new env is last in the list — select it
  const prevEnvCountRef = useRef(environments.length);
  useEffect(() => {
    if (environments.length > prevEnvCountRef.current) {
      setSelectedId(environments[environments.length - 1].id);
    }
    prevEnvCountRef.current = environments.length;
  }, [environments]);

  // ── Export ───────────────────────────────────────────────────────────────────
  const handleExport = useCallback(() => {
    if (!selectedId) return;
    const json = onExport(selectedId);
    if (!json) return;
    const env = environments.find((e) => e.id === selectedId);
    const filename = `${(env?.name ?? 'environment').replace(/[^a-z0-9]/gi, '-').toLowerCase()}-env.json`;
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    // BUG-GQL-R6-1 fix: append to body so Firefox can initiate the download,
    // then remove the anchor and delay revoke to let the browser start the transfer
    // (same pattern as handleExportSDL in GraphqlSchemaExplorer).
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 150);
  }, [environments, onExport, selectedId]);

  // ── Variable helpers ─────────────────────────────────────────────────────────
  type VarWithId = GraphqlEnvironmentVariable & { _id: string };

  // Add stable _id fields to variables for React keys
  const [localVars, setLocalVars] = useState<VarWithId[]>(() =>
    (selectedEnv?.variables ?? []).map((v) => ({ ...v, _id: generateVarId() })),
  );

  // BUG-GQL-R11-2 fix: skip one flush cycle after an env switch. Without this,
  // the sync effect's setLocalVars triggers the flush effect in the next render,
  // which could flush stale/new-env vars redundantly or — under React batching —
  // flush the OLD env's vars to the NEW env's id if both state updates are batched.
  const skipFlushForEnvSwitchRef = useRef(false);

  // Sync localVars when the selected env changes (only on ID change, not on content edits)
  useEffect(() => {
    skipFlushForEnvSwitchRef.current = true;
    setLocalVars(
      (selectedEnv?.variables ?? []).map((v) => ({
        ...v,
        _id: generateVarId(),
        masked: v.masked !== false,
      })),
    );
  // Only re-sync when the selected env's ID changes; content changes originate from here
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // Ref so the flush effect can read the current selectedId without adding it to deps
  // (prevents the BUG-1E-V1 scenario where env-switch causes old vars to flush to new env)
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  // Skip the very first flush (initial mount) — no user edit has happened yet
  const flushInitRef = useRef(false);

  // Flush localVars → parent when the user edits variables.
  // BUG-1E-V1 fix: use selectedIdRef.current (not a dep) so the flush always uses
  // the correct id. Exclude selectedId from deps entirely to avoid flushing old vars
  // when switching envs (the sync effect above replaces localVars on that render).
  useEffect(() => {
    if (!flushInitRef.current) {
      flushInitRef.current = true;
      return;
    }
    // BUG-GQL-R11-2 fix: the sync effect above set localVars for the new env —
    // skip this flush cycle so we don't redundantly (or incorrectly) persist.
    if (skipFlushForEnvSwitchRef.current) {
      skipFlushForEnvSwitchRef.current = false;
      return;
    }
    const id = selectedIdRef.current;
    if (!id) return;
    // Strip internal _id fields before saving
    const clean = localVars.map(({ _id: _, ...rest }) => ({
      ...rest,
      masked: rest.masked !== false,
    }));
    onUpdateVariables(id, clean);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localVars]); // intentionally excludes selectedId — uses ref

  const addVariable = useCallback(() => {
    setLocalVars((prev) => [
      ...prev,
      { _id: generateVarId(), key: '', value: '', enabled: true, masked: true },
    ]);
  }, []);

  const updateVariable = useCallback(
    (varId: string, patch: Partial<GraphqlEnvironmentVariable>) => {
      setLocalVars((prev) =>
        prev.map((v) => (v._id === varId ? { ...v, ...patch } : v)),
      );
    },
    [],
  );

  const removeVariable = useCallback((varId: string) => {
    setLocalVars((prev) => prev.filter((v) => v._id !== varId));
  }, []);

  const enabledVarCount = localVars.filter((v) => v.enabled).length;
  const envCountLabel =
    environments.length === 0
      ? 'No environments'
      : environments.length === 1
        ? '1 environment'
        : `${environments.length} environments`;

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div
      className={`gql-env-modal-overlay${isDragged ? ' gql-env-modal-overlay--dragged' : ''}`}
      style={overlayStyle}
      data-testid="gql-env-modal-overlay"
    >
      <div
        ref={panelRef}
        className={`gql-env-modal${isDragged ? ' gql-env-modal--dragged' : ''}`}
        style={modalStyle}
        role="dialog"
        aria-label="Environment variables"
        aria-modal="true"
        data-testid="gql-env-modal"
        tabIndex={-1}
      >
        <div
          className="gql-env-modal-header gql-env-modal-header--draggable"
          onMouseDown={onDragStart}
          data-testid="gql-env-modal-header"
        >
          <span className="gql-env-modal__drag-grip" aria-hidden="true" title="Drag to move">
            <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
              <circle cx="2" cy="2" r="1.2" /><circle cx="8" cy="2" r="1.2" />
              <circle cx="2" cy="8" r="1.2" /><circle cx="8" cy="8" r="1.2" />
              <circle cx="2" cy="14" r="1.2" /><circle cx="8" cy="14" r="1.2" />
            </svg>
          </span>
          <div className="gql-env-modal-header__text">
            <div className="gql-env-modal-title-row">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
              </svg>
              <span className="gql-env-modal-title">Environment variables</span>
            </div>
            <p className="gql-env-modal-subtitle">
              Define named sets of values for{' '}
              <code className="gql-env-inline-code">{'{{KEY}}'}</code>{' '}
              placeholders in URLs, headers, and variables JSON.
            </p>
          </div>
        </div>

        {/* Modal body: sidebar + main */}
        <div className="gql-env-modal-body">
          {/* ── Left sidebar: environment list ── */}
          <div className="gql-env-sidebar">
            <div className="gql-env-sidebar-header">
              <div className="gql-env-sidebar-heading">
                <span className="gql-env-sidebar-title">Environments</span>
                <span className="gql-env-sidebar-count">{envCountLabel}</span>
              </div>
              <button
                type="button"
                className="gql-env-sidebar-new"
                onClick={handleCreate}
                aria-label="Create new environment"
                title="New environment"
                data-testid="gql-env-new-btn"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                New
              </button>
            </div>

            {environments.length === 0 ? (
              <div className="gql-env-sidebar-empty">
                No environments yet.
                <br />
                Click <strong>New</strong> to create one.
              </div>
            ) : (
              // BUG-R6-1 fix: plain <ul role="list"> — role="listbox" with nested buttons is
              // an ARIA violation. Use aria-current on the selected button instead.
              <ul className="gql-env-sidebar-list" role="list" aria-label="Environments">
                {environments.map((env) => {
                  const isActive = env.id === activeEnvironmentId;
                  const isSelected = env.id === selectedId;
                  return (
                    <li
                      key={env.id}
                      className={`gql-env-sidebar-item${isSelected ? ' gql-env-sidebar-item--selected' : ''}`}
                      data-testid={`gql-env-item-${env.id}`}
                    >
                      <button
                        type="button"
                        className="gql-env-sidebar-item-btn"
                        onClick={() => setSelectedId(env.id)}
                        title={env.name}
                        aria-current={isSelected ? 'true' : undefined}
                      >
                        <span
                          className={`gql-env-active-dot${isActive ? ' gql-env-active-dot--on' : ''}`}
                          aria-label={isActive ? 'Active environment' : ''}
                          title={isActive ? 'Active' : 'Inactive'}
                        />
                        <span className="gql-env-sidebar-name">{env.name}</span>
                      </button>
                      {/* BUG-GQL-R8-8 fix: two-click delete confirm to prevent accidental data loss */}
                      <button
                        type="button"
                        className={`gql-env-sidebar-delete${confirmingDeleteId === env.id ? ' gql-env-sidebar-delete--confirming' : ''}`}
                        onClick={() => handleDeleteClick(env.id)}
                        aria-label={confirmingDeleteId === env.id ? `Confirm delete environment ${env.name}` : `Delete environment ${env.name}`}
                        title={confirmingDeleteId === env.id ? 'Click again to confirm delete' : 'Delete environment'}
                        data-testid={`gql-env-delete-${env.id}`}
                      >
                        {confirmingDeleteId === env.id ? (
                          <span className="gql-env-delete-confirm-label">Delete?</span>
                        ) : (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                            <path d="M10 11v6M14 11v6" />
                            <path d="M9 6V4h6v2" />
                          </svg>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* Import */}
            <div className="gql-env-sidebar-footer">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                style={{ display: 'none' }}
                onChange={handleFileChange}
                aria-label="Import environment JSON file"
              />
              <button
                type="button"
                className="gql-env-import-btn"
                onClick={() => fileInputRef.current?.click()}
                data-testid="gql-env-import-btn"
                title="Import environment from JSON (Postman or native format)"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Import
              </button>
              {importError && (
                // BUG-GQL-R8-17 fix: raw Unicode ⚠ replaced with SVG for consistent rendering
                <div className="gql-env-import-error" role="alert" title={importError}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="gql-env-import-error-icon">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  {importError}
                </div>
              )}
            </div>
          </div>

          {/* ── Right panel: environment editor ── */}
          <div className="gql-env-main">
            {!selectedEnv ? (
              <div className="gql-env-main-empty">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.3" aria-hidden="true">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
                </svg>
                <p>Select an environment from the sidebar,<br />or create a new one to get started.</p>
              </div>
            ) : (
              <>
                {/* Env name + actions */}
                <div className="gql-env-main-header">
                  <div className="gql-env-name-wrap">
                    {editingName ? (
                      <input
                        ref={nameInputRef}
                        type="text"
                        className="gql-env-name-input"
                        value={nameValue}
                        onChange={(e) => setNameValue(e.target.value)}
                        onBlur={commitName}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitName();
                          if (e.key === 'Escape') {
                            setEditingName(false);
                            setNameValue(selectedEnv.name);
                          }
                        }}
                        aria-label="Environment name"
                        data-testid="gql-env-name-input"
                      />
                    ) : (
                      <button
                        type="button"
                        className="gql-env-name-display"
                        onClick={startEditingName}
                        title="Click to rename"
                        aria-label={`Rename ${selectedEnv.name}`}
                        data-testid="gql-env-name-display"
                      >
                        {selectedEnv.name}
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="gql-env-name-edit-icon" aria-hidden="true">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                    )}
                    {localVars.length > 0 && (
                      <span className="gql-env-var-summary" data-testid="gql-env-var-summary">
                        {enabledVarCount} of {localVars.length} variable{localVars.length === 1 ? '' : 's'} enabled
                      </span>
                    )}
                  </div>

                  <div className="gql-env-main-actions">
                    {selectedEnv.id === activeEnvironmentId ? (
                      <span className="gql-env-active-badge" data-testid="gql-env-active-badge">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Active
                      </span>
                    ) : (
                      // BUG-P1-R3-3 fix: aria-label includes env name so screen readers
                      // announce "Set Staging as active environment" instead of just "Set Active"
                      <button
                        type="button"
                        className="gql-btn gql-btn--sm gql-btn--secondary"
                        onClick={() => onSetActive(selectedEnv.id)}
                        data-testid="gql-env-set-active-btn"
                        title="Use this environment for all requests"
                        aria-label={`Set ${selectedEnv.name} as active environment`}
                      >
                        Set Active
                      </button>
                    )}
                    <button
                      type="button"
                      className="gql-btn gql-btn--sm gql-btn--secondary gql-env-export-btn"
                      onClick={handleExport}
                      data-testid="gql-env-export-btn"
                      title="Download this environment as a JSON file"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      Export
                    </button>
                  </div>
                </div>

                {/* Variable table */}
                <div className="gql-env-var-section">
                  {localVars.length === 0 ? (
                    // BUG-R3-2 fix: embed the Add Variable CTA inside the empty state so
                    // the action is visually co-located with the contextual message, not
                    // disconnected at the bottom-left corner of the panel.
                    <div className="gql-env-var-empty">
                      <p>
                        No variables yet. Use{' '}
                        <code className="gql-env-inline-code">{'{{KEY}}'}</code>{' '}
                        in your URL, headers, or variables JSON, then define the values here.
                      </p>
                      <button
                        type="button"
                        className="gql-env-var-add gql-env-var-add--centered"
                        onClick={addVariable}
                        data-testid="gql-env-var-add-btn"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <line x1="12" y1="5" x2="12" y2="19" />
                          <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        Add variable
                      </button>
                    </div>
                  ) : (
                    <div className="gql-env-var-card">
                      <div className="gql-env-var-table" role="list" data-testid="gql-env-var-table">
                        <div className="gql-env-var-head" role="listitem" aria-hidden="true">
                          <span className="gql-env-var-col-enable">On</span>
                          <span className="gql-env-var-col-key">Key</span>
                          <span className="gql-env-var-col-value">Value</span>
                          <span className="gql-env-var-col-actions">Actions</span>
                        </div>
                        {localVars.map((v) => (
                          <VarRow
                            key={v._id}
                            variable={v}
                            onChange={(patch) => updateVariable(v._id, patch)}
                            onRemove={() => removeVariable(v._id)}
                          />
                        ))}
                      </div>
                      <div className="gql-env-var-card-footer">
                        <button
                          type="button"
                          className="gql-env-var-add"
                          onClick={addVariable}
                          data-testid="gql-env-var-add-btn"
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                          </svg>
                          Add variable
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="gql-env-modal-footer">
          <button
            type="button"
            className="gql-btn gql-btn--secondary gql-env-modal-close-btn"
            onClick={() => { restoreFocusToTrigger(); onClose(); }}
            data-testid="gql-env-close-btn"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
