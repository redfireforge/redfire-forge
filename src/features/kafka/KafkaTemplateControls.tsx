import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface KafkaTemplate {
  id: string;
  name: string;
}

interface KafkaTemplateControlsProps {
  templates: KafkaTemplate[];
  templatesLoading: boolean;
  onLoad: (id: string) => void;
  onSave: (name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  /** Unique prefix for data-testid attributes (e.g. "pub" or "con") */
  testIdPrefix: string;
}

// ── Toast state ────────────────────────────────────────────────────────────
interface TemplateToast {
  message: string;
  kind: 'load' | 'save' | 'delete';
}

export function KafkaTemplateControls({
  templates,
  templatesLoading,
  onLoad,
  onSave,
  onDelete,
  testIdPrefix,
}: KafkaTemplateControlsProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [toast, setToast] = useState<TemplateToast | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const saveInputRef = useRef<HTMLInputElement>(null);

  const showToast = useCallback((message: string, kind: TemplateToast['kind']) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, kind });
    toastTimerRef.current = setTimeout(() => setToast(null), 2500);
  }, []);

  useEffect(() => {
    return () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); };
  }, []);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => { document.removeEventListener('mousedown', handler); };
  }, [dropdownOpen]);

  const handleSaveSubmit = useCallback(async () => {
    const name = saveName.trim();
    if (!name) return;
    await onSave(name);
    setSaveName('');
    setShowSaveInput(false);
    showToast(`Template "${name}" saved`, 'save');
  }, [saveName, onSave, showToast]);

  const handleSaveKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') void handleSaveSubmit();
      if (e.key === 'Escape') { setSaveName(''); setShowSaveInput(false); }
    },
    [handleSaveSubmit],
  );

  const handleDeleteTemplate = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      const tpl = templates.find((t) => t.id === id);
      void onDelete(id).then(() => {
        setDropdownOpen(false);
        showToast(`Template "${tpl?.name ?? id}" deleted`, 'delete');
      });
    },
    [onDelete, templates, showToast],
  );

  const handleOpenSave = useCallback(() => {
    setShowSaveInput(true);
    // focus via ref after state flush
    setTimeout(() => saveInputRef.current?.focus(), 0);
  }, []);

  return (
    <div className="kafka-ms-template-controls">
      {/* ── Load dropdown ── */}
      <div className="kafka-ms-template-dropdown-anchor" ref={dropdownRef}>
        <button
          type="button"
          className="kafka-ms-template-btn kafka-ms-template-btn--load"
          onClick={() => setDropdownOpen((o) => !o)}
          disabled={templatesLoading}
          title="Load a saved template"
          data-testid={`${testIdPrefix}-tmpl-load-btn`}
          aria-haspopup="listbox"
          aria-expanded={dropdownOpen}
        >
          <span className="kafka-ms-tmpl-load-icon">⊞</span>
          Load
          {templates.length > 0 && (
            <span className="kafka-ms-template-count">{templates.length}</span>
          )}
          <span className="kafka-ms-template-chevron" aria-hidden>▾</span>
        </button>

        {dropdownOpen && (
          <div
            className="kafka-ms-template-dropdown"
            role="listbox"
            aria-label="Saved templates"
            data-testid={`${testIdPrefix}-tmpl-dropdown`}
          >
            <div className="kafka-ms-template-dropdown-header">
              <span>Saved Templates</span>
              {templates.length > 0 && (
                <span className="kafka-ms-template-dropdown-count">{templates.length}</span>
              )}
            </div>
            {templates.length === 0 ? (
              <div className="kafka-ms-template-empty">
                <span className="kafka-ms-template-empty-icon">◫</span>
                No saved templates yet
              </div>
            ) : (
              <div className="kafka-ms-template-list">
                {templates.map((t) => (
                  <div
                    key={t.id}
                    className="kafka-ms-template-item"
                    role="option"
                    aria-selected={false}
                    onClick={() => { onLoad(t.id); setDropdownOpen(false); showToast(`Template "${t.name}" loaded`, 'load'); }}
                    data-testid={`${testIdPrefix}-tmpl-item-${t.id}`}
                  >
                    <span className="kafka-ms-template-item-icon" aria-hidden>◈</span>
                    <span className="kafka-ms-template-item-name" title={t.name}>{t.name}</span>
                    <button
                      className="kafka-ms-template-item-delete"
                      onClick={(e) => handleDeleteTemplate(e, t.id)}
                      title={`Delete "${t.name}"`}
                      aria-label={`Delete template ${t.name}`}
                      data-testid={`${testIdPrefix}-tmpl-delete-${t.id}`}
                    >×</button>
                  </div>
                ))}
              </div>
            )}
            {templates.length > 0 && (
              <div className="kafka-ms-template-dropdown-hint">
                Click to load · × to delete
              </div>
            )}
          </div>
        )}
      </div>

      <span className="kafka-ms-template-sep" aria-hidden />

      {/* ── Save / inline input ── */}
      {showSaveInput ? (
        <div className="kafka-ms-template-save-row">
          <input
            ref={saveInputRef}
            className="kafka-ms-template-save-input"
            type="text"
            placeholder="Template name…"
            value={saveName}
            autoFocus
            onChange={(e) => setSaveName(e.target.value)}
            onKeyDown={handleSaveKeyDown}
            data-testid={`${testIdPrefix}-tmpl-save-input`}
            aria-label="Template name"
          />
          <button
            type="button"
            className="kafka-ms-template-confirm-btn"
            onClick={() => void handleSaveSubmit()}
            disabled={!saveName.trim()}
            title="Save (Enter)"
            aria-label="Confirm save"
            data-testid={`${testIdPrefix}-tmpl-save-confirm`}
          >✓</button>
          <button
            type="button"
            className="kafka-ms-template-cancel-btn"
            onClick={() => { setSaveName(''); setShowSaveInput(false); }}
            aria-label="Cancel"
            data-testid={`${testIdPrefix}-tmpl-save-cancel`}
          >✕</button>
        </div>
      ) : (
        <button
          type="button"
          className="kafka-ms-template-btn kafka-ms-template-btn--save"
          onClick={handleOpenSave}
          title="Save current settings as a template"
          data-testid={`${testIdPrefix}-tmpl-save-btn`}
        >
          Save
        </button>
      )}

      {/* ── Template toast notification (portal to body to avoid clipping) ── */}
      {toast && createPortal(
        <div
          className={`kafka-ms-template-toast kafka-ms-template-toast--${toast.kind}`}
          role="status"
          aria-live="polite"
          data-testid={`${testIdPrefix}-tmpl-toast`}
        >
          <span className="kafka-ms-template-toast-icon">
            {toast.kind === 'load' ? '↻' : toast.kind === 'save' ? '✓' : '🗑'}
          </span>
          {toast.message}
        </div>,
        document.body,
      )}
    </div>
  );
}
