import { useState } from 'react';
import { createPortal } from 'react-dom';
import type { Microservice } from '@shared/types';
import { VarRow } from './VarRow';
import { useDraggableModal } from './useDraggableModal';

export function EnvVarsModal({
  svc,
  envId,
  envName,
  onClose,
  onSetEnvVar,
  onDeleteEnvVar,
}: {
  svc: Microservice;
  envId: string;
  envName: string;
  onClose: () => void;
  onSetEnvVar: (envId: string, key: string, value: string) => void;
  onDeleteEnvVar: (envId: string, key: string) => void;
}) {
  const { offset, size, setSize, onHeaderMouseDown } = useDraggableModal();
  const [newKey, setNewKey] = useState('');
  const [newVal, setNewVal] = useState('');
  const [localOverrides, setLocalOverrides] = useState<Record<string, string>>(() => ({ ...(svc.envVars?.[envId] ?? {}) }));

  const globalVars = svc.globalVars ?? {};
  const globalEntries = Object.entries(globalVars).sort(([a], [b]) => a.localeCompare(b));
  const overrideEntries = Object.entries(localOverrides).sort(([a], [b]) => a.localeCompare(b));

  const add = () => {
    const k = newKey.trim();
    if (!k) return;
    setLocalOverrides((prev) => ({ ...prev, [k]: newVal }));
    setNewKey('');
    setNewVal('');
  };

  const save = () => {
    // Flush any uncommitted add-row entry before saving
    const pending: Record<string, string> = {};
    if (newKey.trim()) pending[newKey.trim()] = newVal;
    const merged = { ...localOverrides, ...pending };

    const existing = svc.envVars?.[envId] ?? {};
    for (const key of Object.keys(existing)) {
      if (!(key in merged)) onDeleteEnvVar(envId, key);
    }
    for (const [k, v] of Object.entries(merged)) {
      onSetEnvVar(envId, k, v);
    }
    onClose();
  };

  return createPortal(
    <div
      className="em-vars-modal-overlay"
      data-testid="env-vars-modal-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="em-vars-modal"
        data-testid="env-vars-modal"
        style={{ transform: `translate(${offset.dx}px, ${offset.dy}px)`, width: size.width, height: size.height }}
      >
        <div
          className="em-vars-modal-header"
          data-testid="env-vars-modal-header"
          onMouseDown={onHeaderMouseDown}
        >
          <div className="em-vars-modal-title-group">
            <span className="em-vars-modal-title">Environment Variables</span>
            <span className="em-vars-modal-subtitle">Overrides for <strong>{envName}</strong></span>
          </div>
        </div>

        <div className="em-vars-modal-body">
          {globalEntries.length > 0 && (
            <div className="em-vars-modal-section">
              <div className="em-vars-modal-section-label">Global variables (read-only)</div>
              {globalEntries.map(([k, v]) => (
                <VarRow
                  key={k}
                  varKey={k}
                  value={v}
                  readOnly
                  overridden={k in localOverrides}
                  testIdPrefix="global-var-ref"
                />
              ))}
            </div>
          )}

          {globalEntries.length > 0 && <div className="em-vars-modal-divider" />}

          <div className="em-vars-modal-section">
            <div className="em-vars-modal-section-label">
              {envName} overrides
              <span className="em-vars-modal-section-hint"> — override or add to global variables</span>
            </div>
            <div className="em-vars-modal-add-row">
              <input
                className="em-vars-modal-key-input"
                placeholder="Key (e.g. authToken)"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && newKey.trim()) add(); }}
                data-testid="env-vars-key-input"
              />
              <input
                className="em-vars-modal-val-input"
                placeholder="Value"
                value={newVal}
                onChange={(e) => setNewVal(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && newKey.trim()) add(); }}
                data-testid="env-vars-val-input"
              />
              <button
                type="button"
                className="btn btn-primary btn-xs"
                onClick={add}
                disabled={!newKey.trim()}
                data-testid="env-vars-add-btn"
              >Add</button>
            </div>
            <div className="em-vars-modal-list">
              {overrideEntries.length === 0 && (
                <div className="em-vars-modal-empty">
                  <span className="em-vars-modal-empty-icon">≈</span>
                  <span>No overrides for <strong>{envName}</strong>.<br/>Add a key above to override or extend global variables.</span>
                </div>
              )}
              {overrideEntries.map(([k, v]) => (
                <VarRow
                  key={k}
                  varKey={k}
                  value={v}
                  testIdPrefix="env-var"
                  onChange={(val) => setLocalOverrides((prev) => ({ ...prev, [k]: val }))}
                  onDelete={() => setLocalOverrides((prev) => { const next = { ...prev }; delete next[k]; return next; })}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="em-vars-modal-footer em-vars-modal-footer--right">
          {overrideEntries.length > 0 && (
            <span className="em-vars-modal-footer-hint">{overrideEntries.length} override{overrideEntries.length !== 1 ? 's' : ''}</span>
          )}
          <button type="button" className="btn btn-sm" onClick={onClose} data-testid="env-vars-close-btn">Cancel</button>
          <button type="button" className="btn btn-primary btn-sm" onClick={save} data-testid="env-vars-save-btn">Save changes</button>
        </div>

        <div
          className="em-vars-modal-resize-handle"
          onMouseDown={(e) => {
            e.preventDefault();
            const startX = e.clientX;
            const startY = e.clientY;
            const startW = size.width;
            const startH = size.height;
            const onMove = (ev: MouseEvent) => setSize({
              width: Math.max(380, startW + ev.clientX - startX),
              height: Math.max(300, startH + ev.clientY - startY),
            });
            const onUp = () => {
              document.removeEventListener('mousemove', onMove);
              document.removeEventListener('mouseup', onUp);
            };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
          }}
        />
      </div>
    </div>
  , document.body);
}
