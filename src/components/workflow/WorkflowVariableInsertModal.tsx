import { useState, useMemo, useLayoutEffect, useCallback } from 'react';
import type { WorkflowVariableHint } from '../../utils/workflowVariableHints';

interface Props {
  open: boolean;
  hints: WorkflowVariableHint[];
  /** When true, insert short variable name (e.g. {{channel}}) instead of scoped ref. Used for URL/body fields. */
  shortRef?: boolean;
  /** Pre-fill the search box when the modal opens (e.g. the variable name being edited). */
  initialSearch?: string;
  onClose: () => void;
  /** Called with full template including braces, e.g. `{{node:uuid.vin}}` */
  onPick: (template: string) => void;
}

interface VarGroup {
  key: string;
  label: string;
  icon: string;
  hints: WorkflowVariableHint[];
}

/** Parse a scoped ref like `node:"Step Name".varName` to extract step label and var name. */
function parseScopedRef(ref: string): { stepLabel: string; varName: string } | null {
  const m = ref.match(/^node:"([^"]+)"\.(.+)$/) ?? ref.match(/^node:([^.]+)\.(.+)$/);
  if (!m) return null;
  return { stepLabel: m[1], varName: m[2] };
}

/** Extract the variable name (last segment) from any ref. */
function varName(ref: string): string {
  const parsed = parseScopedRef(ref);
  return parsed ? parsed.varName : ref;
}

/**
 * Two-column modal: left = step/source list, right = variables for selected source.
 * Search filters across all sources and shows grouped results on the right.
 */
export default function WorkflowVariableInsertModal({ open, hints, shortRef = false, initialSearch = '', onClose, onPick }: Props) {
  const [q, setQ] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  /** Group hints by source. */
  const groups = useMemo((): VarGroup[] => {
    const workflowHints: WorkflowVariableHint[] = [];
    const stepMap = new Map<string, WorkflowVariableHint[]>();
    const stepOrder: string[] = [];

    for (const h of hints) {
      const parsed = parseScopedRef(h.ref);
      if (parsed) {
        if (!stepMap.has(parsed.stepLabel)) {
          stepMap.set(parsed.stepLabel, []);
          stepOrder.push(parsed.stepLabel);
        }
        stepMap.get(parsed.stepLabel)!.push(h);
      } else {
        workflowHints.push(h);
      }
    }

    const result: VarGroup[] = [];
    if (workflowHints.length > 0) {
      result.push({ key: '__workflow__', label: 'Workflow Defaults', icon: '⚡', hints: workflowHints });
    }
    for (const sl of stepOrder) {
      result.push({ key: sl, label: sl, icon: '↗', hints: stepMap.get(sl)! });
    }
    return result;
  }, [hints]);

  // Runs before browser paint so user never sees a flash of empty search
  useLayoutEffect(() => {
    if (open) {
      setQ(initialSearch);
      setSelectedGroup((prev) => prev ?? (groups.length > 0 ? groups[0].key : null));
    } else {
      setQ('');
      setSelectedGroup(null);
    }
  }, [open, initialSearch]);

  const isSearching = q.trim().length > 0;

  /** Filter groups by search query. */
  const filteredGroups = useMemo((): VarGroup[] => {
    const t = q.trim().toLowerCase();
    if (!t) return groups;
    return groups
      .map((g) => ({
        ...g,
        hints: g.hints.filter(
          (h) =>
            varName(h.ref).toLowerCase().includes(t) ||
            h.label.toLowerCase().includes(t) ||
            h.ref.toLowerCase().includes(t),
        ),
      }))
      .filter((g) => g.hints.length > 0);
  }, [groups, q]);

  /** Source list items — in search mode, highlight sources with matches. */
  const sourceMatchSet = useMemo(() => new Set(filteredGroups.map((g) => g.key)), [filteredGroups]);

  /** Variables to show on the right panel. */
  const rightPanelGroups = useMemo((): VarGroup[] => {
    if (isSearching) return filteredGroups;
    if (!selectedGroup) return [];
    const g = groups.find((g) => g.key === selectedGroup);
    return g ? [g] : [];
  }, [isSearching, filteredGroups, selectedGroup, groups]);

  const handleGroupClick = useCallback((key: string) => {
    setSelectedGroup(key);
    setQ('');
  }, []);

  if (!open) return null;

  return (
    <div
      className="modal-overlay wf-var-insert-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wf-var-insert-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } }}
    >
      <div className="modal ram-modal wf-var-insert-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ram-header">
          <h3 id="wf-var-insert-title">Insert variable</h3>
          <input
            className="ram-input wf-var-insert-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search all variables…"
            autoFocus
            aria-label="Search variables"
          />
          <button type="button" className="ram-modal-close" onClick={onClose} aria-label="Close">&times;</button>
        </div>
        {initialSearch && (
          <div className="wf-var-insert-context-hint">
            <span className="wf-var-insert-context-icon">⚑</span>
            Setting value for <code>{'{{' + initialSearch + '}}'}</code> — pick a variable below to reference it
          </div>
        )}

        {hints.length === 0 ? (
          <div className="wf-var-insert-empty-state">
            <div className="wf-var-insert-empty-icon">📋</div>
            <p>No variables available yet.</p>
            <p className="wf-var-insert-empty-hint">
              Add variables under <strong>Initial Variables</strong> or <strong>Workflow Defaults</strong>,
              or connect upstream HTTP steps with extractions.
            </p>
          </div>
        ) : (
          <div className="wf-var-insert-columns">
            {/* ── Left: source / step list ── */}
            <div className="wf-var-insert-left">
              <div className="wf-var-insert-left-title">Sources</div>
              <div className="wf-var-insert-source-list">
                {groups.map((g) => {
                  const isActive = !isSearching && selectedGroup === g.key;
                  const hasMatch = isSearching && sourceMatchSet.has(g.key);
                  const dimmed = isSearching && !hasMatch;
                  return (
                    <button
                      key={g.key}
                      type="button"
                      className={`wf-var-insert-source-item ${isActive ? 'active' : ''} ${dimmed ? 'dimmed' : ''}`}
                      onClick={() => handleGroupClick(g.key)}
                    >
                      <span className="wf-var-insert-source-icon">{g.icon}</span>
                      <span className="wf-var-insert-source-name">{g.label}</span>
                      <span className="wf-var-insert-source-count">
                        {isSearching && hasMatch
                          ? filteredGroups.find((fg) => fg.key === g.key)!.hints.length
                          : g.hints.length}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Right: variables ── */}
            <div className="wf-var-insert-right">
              {rightPanelGroups.length === 0 ? (
                <div className="wf-var-insert-right-empty">
                  {isSearching
                    ? <>No variables match "<strong>{q.trim()}</strong>"</>
                    : 'Select a source on the left'}
                </div>
              ) : (
                rightPanelGroups.map((g) => (
                  <div key={g.key} className="wf-var-insert-group">
                    {isSearching && (
                      <div className="wf-var-insert-group-header">
                        <span className="wf-var-insert-source-icon">{g.icon}</span>
                        <span>{g.label}</span>
                      </div>
                    )}
                    {g.hints.map((h) => {
                      const name = varName(h.ref);
                      const insertRef = shortRef ? name : h.ref;
                      return (
                        <button
                          key={h.ref}
                          type="button"
                          className="wf-var-insert-var-row"
                          onClick={() => onPick(`{{${insertRef}}}`)}
                          title={`Click to insert {{${insertRef}}}`}
                        >
                          <span className="wf-var-insert-var-name">{name}</span>
                          <code className="wf-var-insert-var-ref">{`→ {{${insertRef}}}`}</code>
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
