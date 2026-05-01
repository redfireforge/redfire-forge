import { useState, useCallback, useRef } from 'react';
import type { WorkflowVariableHintSource } from '../utils/workflowVariableHints';

export interface ComposeToken {
  id: string;
  kind: 'variable' | 'literal' | 'expression';
  value: string;
  displayLabel: string;
  source?: WorkflowVariableHintSource;
}

interface Props {
  tokens: ComposeToken[];
  onTokensChange: (tokens: ComposeToken[]) => void;
  onInsertAll: () => void;
  onClear: () => void;
}

let nextLiteralId = 0;

/** Generate a unique ID for literal tokens. */
// eslint-disable-next-line react-refresh/only-export-components
export function createLiteralId(): string {
  return `lit-${++nextLiteralId}-${Date.now()}`;
}

/**
 * Compose strip: shows accumulated tokens, allows reorder via drag, add literal text, clear, and insert all.
 */
export default function ComposeStrip({ tokens, onTokensChange, onInsertAll, onClear }: Props) {
  const [literalInput, setLiteralInput] = useState('');
  const [showLiteralInput, setShowLiteralInput] = useState(false);
  const dragIdx = useRef<number | null>(null);

  const removeToken = useCallback((id: string) => {
    onTokensChange(tokens.filter((t) => t.id !== id));
  }, [tokens, onTokensChange]);

  const addLiteral = useCallback(() => {
    if (!literalInput || !literalInput.trim()) return;
    const token: ComposeToken = {
      id: createLiteralId(),
      kind: 'literal',
      value: literalInput,
      displayLabel: literalInput,
    };
    onTokensChange([...tokens, token]);
    setLiteralInput('');
    setShowLiteralInput(false);
  }, [literalInput, tokens, onTokensChange]);

  const handleLiteralKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addLiteral();
    } else if (e.key === 'Escape') {
      setShowLiteralInput(false);
      setLiteralInput('');
    }
  }, [addLiteral]);

  // ── Drag-to-reorder ──
  const handleDragStart = useCallback((e: React.DragEvent, idx: number) => {
    dragIdx.current = idx;
    e.dataTransfer.effectAllowed = 'move';
    // Required for Firefox
    e.dataTransfer.setData('text/plain', String(idx));
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, dropIdx: number) => {
    e.preventDefault();
    const fromIdx = dragIdx.current;
    if (fromIdx === null || fromIdx === dropIdx) return;
    const updated = [...tokens];
    const [moved] = updated.splice(fromIdx, 1);
    updated.splice(dropIdx, 0, moved);
    onTokensChange(updated);
    dragIdx.current = null;
  }, [tokens, onTokensChange]);

  const preview = tokens.map((t) => t.value).join('');

  return (
    <div className="wf-compose-strip">
      <div className="wf-compose-strip-header">
        <span className="wf-compose-strip-label">Compose</span>
        <span className="wf-compose-strip-count">{tokens.length} token{tokens.length !== 1 ? 's' : ''}</span>
      </div>

      {tokens.length === 0 ? (
        <div className="wf-compose-strip-empty">
          Check variables above to add them here
        </div>
      ) : (
        <>
          <div className="wf-compose-strip-tokens">
            {tokens.map((t, idx) => (
              <div
                key={t.id}
                className={`wf-compose-token wf-compose-token-${t.kind}`}
                draggable
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, idx)}
              >
                <span className="wf-compose-token-drag" title="Drag to reorder">⠿</span>
                <span className="wf-compose-token-label">{t.displayLabel}</span>
                <button
                  type="button"
                  className="wf-compose-token-remove"
                  onClick={() => removeToken(t.id)}
                  aria-label={`Remove ${t.displayLabel}`}
                >×</button>
              </div>
            ))}
          </div>
          <div className="wf-compose-strip-preview">
            <span className="wf-compose-strip-preview-label">Preview:</span>
            <code className="wf-compose-strip-preview-value">{preview}</code>
          </div>
        </>
      )}

      <div className="wf-compose-strip-actions">
        {showLiteralInput ? (
          <div className="wf-compose-literal-input-row">
            <input
              className="wf-compose-literal-input"
              value={literalInput}
              onChange={(e) => setLiteralInput(e.target.value)}
              onKeyDown={handleLiteralKeyDown}
              placeholder="Type text…"
              autoFocus
              aria-label="Literal text"
            />
            <button type="button" className="wf-compose-literal-add" onClick={addLiteral}>Add</button>
            <button type="button" className="wf-compose-literal-cancel" onClick={() => { setShowLiteralInput(false); setLiteralInput(''); }}>Cancel</button>
          </div>
        ) : (
          <button type="button" className="wf-compose-add-literal-btn" onClick={() => setShowLiteralInput(true)}>
            + literal text
          </button>
        )}
        <div className="wf-compose-strip-btns">
          <button type="button" className="wf-compose-clear-btn" onClick={onClear} disabled={tokens.length === 0}>
            Clear
          </button>
          <button type="button" className="wf-compose-insert-btn" onClick={onInsertAll} disabled={tokens.length === 0}>
            Insert All ({tokens.length})
          </button>
        </div>
      </div>
    </div>
  );
}
