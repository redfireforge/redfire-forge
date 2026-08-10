import { useRef, useMemo, useCallback, useState } from 'react';
import type { WorkflowVariableHint } from '../../utils/workflowVariableHints';

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  variableHints?: WorkflowVariableHint[];
  /** Variables map for live preview resolution. */
  variableValues?: Record<string, string>;
  onRequestVariableInsert?: (apply: (snippet: string) => void, shortRef?: boolean, initialSearch?: string) => void;
  rows?: number;
}

const VAR_REGEX = /\{\{([^}]+)\}\}/g;

function highlightTemplate(template: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const regex = new RegExp(VAR_REGEX.source, 'g');

  while ((match = regex.exec(template)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={`t-${lastIndex}`} className="mte-text">{template.slice(lastIndex, match.index)}</span>);
    }
    parts.push(
      <span key={`v-${match.index}`} className="mte-var-token">{match[0]}</span>,
    );
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < template.length) {
    parts.push(<span key={`t-${lastIndex}`} className="mte-text">{template.slice(lastIndex)}</span>);
  }
  return parts;
}

function resolvePreview(template: string, vars: Record<string, string>): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const regex = new RegExp(VAR_REGEX.source, 'g');

  while ((match = regex.exec(template)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={`pt-${lastIndex}`}>{template.slice(lastIndex, match.index)}</span>);
    }
    const varName = match[1].trim();
    const resolved = vars[varName];
    if (resolved !== undefined) {
      parts.push(<span key={`pv-${match.index}`} className="mte-preview-resolved">{resolved}</span>);
    } else {
      parts.push(<span key={`pv-${match.index}`} className="mte-preview-unresolved">{match[0]}</span>);
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < template.length) {
    parts.push(<span key={`pt-${lastIndex}`}>{template.slice(lastIndex)}</span>);
  }
  return parts;
}

/**
 * Enhanced Message Template editor with:
 *  1. Clickable variable chips above the textarea
 *  2. Syntax-highlighted overlay for {{var}} tokens
 *  3. Live resolved preview strip
 *  4. Monospace font (code-editor feel)
 *  5. Better variable insertion UX
 */
export default function MessageTemplateEditor({
  value,
  onChange,
  placeholder,
  variableHints = [],
  variableValues = {},
  onRequestVariableInsert,
  rows = 3,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  const insertAtCursor = useCallback((varRef: string) => {
    const ta = textareaRef.current;
    const snippet = `{{${varRef}}}`;
    if (ta) {
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const before = value.slice(0, start);
      const after = value.slice(end);
      onChange(before + snippet + after);
      requestAnimationFrame(() => {
        ta.focus();
        const pos = start + snippet.length;
        ta.setSelectionRange(pos, pos);
      });
    } else {
      onChange(value + snippet);
    }
  }, [value, onChange]);

  const chipVars = useMemo(() => {
    const seen = new Set<string>();
    return variableHints
      .filter((h) => {
        if (seen.has(h.ref)) return false;
        seen.add(h.ref);
        return true;
      })
      .slice(0, 12);
  }, [variableHints]);

  const hasVars = VAR_REGEX.test(value);
  const overlayContent = useMemo(() => highlightTemplate(value), [value]);
  const previewContent = useMemo(() => {
    if (!value) return null;
    return resolvePreview(value, variableValues);
  }, [value, variableValues]);

  const hasPreviewValues = Object.keys(variableValues).length > 0;

  const showChipBar = chipVars.length > 0;
  const showStandaloneInsert = !showChipBar && !!onRequestVariableInsert;

  return (
    <div className="mte-root">
      {/* Variable chip bar */}
      {showChipBar && (
        <div className="mte-chip-bar">
          <span className="mte-chip-label">Variables</span>
          <div className="mte-chips">
            {chipVars.map((h) => (
              <button
                key={h.ref}
                type="button"
                className="mte-chip"
                title={h.description || `Insert {{${h.ref}}}`}
                onClick={() => insertAtCursor(h.ref)}
              >
                {h.ref}
              </button>
            ))}
          </div>
          {onRequestVariableInsert && (
            <button
              type="button"
              className="mte-browse-btn"
              title="Browse all variables"
              onClick={() => onRequestVariableInsert(
                (snippet) => {
                  onChange(value + snippet);
                },
                false,
                '',
              )}
            >
              + More
            </button>
          )}
        </div>
      )}

      {/* Editor area with overlay */}
      <div className={`mte-editor ${isFocused ? 'mte-editor--focused' : ''}`}>
        {showStandaloneInsert && (
          <button
            type="button"
            className="mte-insert-float-btn"
            title="Insert variable from workflow or upstream step"
            onClick={() => onRequestVariableInsert!(
              (snippet) => { onChange(value + snippet); },
              false,
              '',
            )}
          >
            Insert…
          </button>
        )}
        <div className="mte-highlight-overlay" aria-hidden="true">
          {overlayContent}
          <span>&nbsp;</span>
        </div>
        <textarea
          ref={textareaRef}
          className="mte-textarea"
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder || 'e.g. Status is {{status}}, user {{userId}} created'}
          spellCheck={false}
        />
      </div>

      {/* Live preview strip */}
      {hasVars && (
        <div className="mte-preview">
          <span className="mte-preview-label">Preview</span>
          <span className="mte-preview-value">
            {hasPreviewValues ? previewContent : (
              <span className="mte-preview-hint">Run a Quick Test to see resolved values</span>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
