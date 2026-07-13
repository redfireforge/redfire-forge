import { useState } from 'react';
import { createPortal } from 'react-dom';
import type { Microservice } from '../../../../shared/types';
import { VarRow } from './VarRow';
import { useDraggableModal } from './useDraggableModal';

export function ProtocolVarsModal({
  svc,
  onClose,
  onSetGlobalVar,
  onDeleteGlobalVar,
}: {
  svc: Microservice;
  onClose: () => void;
  onSetGlobalVar: (key: string, value: string) => void;
  onDeleteGlobalVar: (key: string) => void;
}) {
  const { offset, size, setSize, onHeaderMouseDown } = useDraggableModal();
  const [newKey, setNewKey] = useState('');
  const [newVal, setNewVal] = useState('');
  const [localVars, setLocalVars] = useState<Record<string, string>>(() => ({ ...(svc.globalVars ?? {}) }));

  const add = () => {
    const k = newKey.trim();
    if (!k) return;
    setLocalVars((prev) => ({ ...prev, [k]: newVal }));
    setNewKey('');
    setNewVal('');
  };

  const save = () => {
    const existing = svc.globalVars ?? {};
    for (const key of Object.keys(existing)) {
      if (!(key in localVars)) onDeleteGlobalVar(key);
    }
    for (const [k, v] of Object.entries(localVars)) {
      onSetGlobalVar(k, v);
    }
    onClose();
  };

  const sorted = Object.entries(localVars).sort(([a], [b]) => a.localeCompare(b));

  return createPortal(
    <div
      className="em-vars-modal-overlay"
      data-testid="protocol-vars-modal-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="em-vars-modal"
        data-testid="protocol-vars-modal"
        style={{ transform: `translate(${offset.dx}px, ${offset.dy}px)`, width: size.width, height: size.height }}
      >
        <div
          className="em-vars-modal-header"
          data-testid="protocol-vars-modal-header"
          onMouseDown={onHeaderMouseDown}
        >
          <div className="em-vars-modal-title-group">
            <span className="em-vars-modal-title">Protocol Variables</span>
            <span className="em-vars-modal-subtitle">Available in all environments for <strong>{svc.name}</strong></span>
          </div>
        </div>

        <div className="em-vars-modal-body">
          <div className="em-vars-modal-add-row">
            <input
              className="em-vars-modal-key-input"
              placeholder="Key  (e.g. requestId)"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && newKey.trim()) add(); }}
              data-testid="protocol-vars-key-input"
              spellCheck={false}
              autoComplete="off"
            />
            <input
              className="em-vars-modal-val-input"
              placeholder="Value"
              value={newVal}
              onChange={(e) => setNewVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && newKey.trim()) add(); }}
              data-testid="protocol-vars-val-input"
              spellCheck={false}
              autoComplete="off"
            />
            <button
              type="button"
              className="btn btn-primary btn-xs"
              onClick={add}
              disabled={!newKey.trim()}
              data-testid="protocol-vars-add-btn"
            >Add</button>
          </div>

          <div className="em-vars-modal-list">
            {sorted.length === 0 && (
              <div className="em-vars-modal-empty">
                <span className="em-vars-modal-empty-icon">⊘</span>
                <span>No protocol variables yet.<br/>Add a key above — it will be available in all environments.</span>
              </div>
            )}
            {sorted.map(([k, v]) => (
              <VarRow
                key={k}
                varKey={k}
                value={v}
                testIdPrefix="protocol-var"
                onChange={(val) => setLocalVars((prev) => ({ ...prev, [k]: val }))}
                onDelete={() => setLocalVars((prev) => { const next = { ...prev }; delete next[k]; return next; })}
              />
            ))}
          </div>
        </div>

        <div className="em-vars-modal-footer em-vars-modal-footer--right">
          {sorted.length > 0 && (
            <span className="em-vars-modal-footer-hint">{sorted.length} variable{sorted.length !== 1 ? 's' : ''}</span>
          )}
          <button type="button" className="btn btn-sm" onClick={onClose} data-testid="protocol-vars-close-btn">Cancel</button>
          <button type="button" className="btn btn-primary btn-sm" onClick={save} data-testid="protocol-vars-save-btn">Save changes</button>
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
