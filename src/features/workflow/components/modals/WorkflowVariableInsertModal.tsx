import { useState, useMemo, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { WorkflowVariableHint } from '../../utils/workflowVariableHints';
import { NODE_TYPE_DISPLAY } from '../../utils/workflowVariableHints';
import type { VariableSourceCategory } from '../../utils/workflowVariableHints';
import { useModalFrame } from '../../../../shared/hooks/useModalFrame';
import ModalExpandButton from '../../../../shared/components/ModalExpandButton';
import ModalResizeHandles from '../../../../shared/components/ModalResizeHandles';
import ComposeStrip from '../ComposeStrip';
import type { ComposeToken } from '../ComposeStrip';
import ExpressionBuilderView from '../expression/ExpressionBuilderView';

type ModalView = 'browse' | 'expression';

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
  category: VariableSourceCategory;
  hints: WorkflowVariableHint[];
}

/** Extract the variable name (last segment) from any ref. */
function varName(ref: string): string {
  const m = ref.match(/^node:"([^"]+)"\.(.+)$/) ?? ref.match(/^node:([^.]+)\.(.+)$/);
  return m ? m[2] : ref;
}

/** Category display order. */
const CATEGORY_ORDER: VariableSourceCategory[] = ['Triggers', 'HTTP Steps', 'Logic', 'Integrations', 'Workflow'];

/**
 * Two-column modal: left = source list grouped by category, right = variables for selected source.
 * Search filters across all sources and shows grouped results on the right.
 */
export default function WorkflowVariableInsertModal({ open, hints, shortRef = false, initialSearch = '', onClose, onPick }: Props) {
  const [q, setQ] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [hoveredHint, setHoveredHint] = useState<WorkflowVariableHint | null>(null);
  const [activeCategory, setActiveCategory] = useState<VariableSourceCategory | 'All'>('All');
  const [composeMode, setComposeMode] = useState(false);
  const [composeTokens, setComposeTokens] = useState<ComposeToken[]>([]);
  const [view, setView] = useState<ModalView>('browse');
  const { expanded, setExpanded, toggleExpand, expandClass, overlayStyle, dialogStyle, headerDragStyle, onHeaderMouseDown, onRightEdge, onCorner } = useModalFrame({ open, expandMode: 'fullscreen' });

  /** Group hints by source. */
  const groups = useMemo((): VarGroup[] => {
    const groupMap = new Map<string, VarGroup>();
    const groupOrder: string[] = [];

    for (const h of hints) {
      const src = h.source;
      const key = src ? (src.nodeId ?? src.nodeLabel) : '__workflow__';
      const label = src?.nodeLabel ?? 'Workflow Defaults';
      const nodeType = src?.nodeType ?? 'workflow';
      const category = src?.category ?? 'Workflow';
      const display = NODE_TYPE_DISPLAY[nodeType];
      const icon = display?.icon ?? '⚡';

      if (!groupMap.has(key)) {
        groupMap.set(key, { key, label, icon, category, hints: [] });
        groupOrder.push(key);
      }
      groupMap.get(key)!.hints.push(h);
    }

    // Sort groups by category order, then by label within category
    const result = groupOrder.map((k) => groupMap.get(k)!);
    result.sort((a, b) => {
      const ca = CATEGORY_ORDER.indexOf(a.category);
      const cb = CATEGORY_ORDER.indexOf(b.category);
      if (ca !== cb) return ca - cb;
      return a.label.localeCompare(b.label);
    });

    // Deduplicate: when a group has both "(latest)" and "(scoped)" for the same variable,
    // keep only the scoped version to avoid duplicated variable names.
    return result.map((g) => {
      const nameMap = new Map<string, WorkflowVariableHint>();
      for (const h of g.hints) {
        const base = varName(h.ref);
        const existing = nameMap.get(base);
        if (!existing) {
          nameMap.set(base, h);
        } else {
          const isScoped = h.ref.startsWith('node:');
          const existingIsScoped = existing.ref.startsWith('node:');
          if (isScoped && !existingIsScoped) nameMap.set(base, h);
        }
      }
      return { ...g, hints: Array.from(nameMap.values()) };
    });
  }, [hints]);

  /** Categories present in the data. */
  const presentCategories = useMemo((): VariableSourceCategory[] => {
    const cats = new Set(groups.map((g) => g.category));
    return CATEGORY_ORDER.filter((c) => cats.has(c));
  }, [groups]);

  /** Groups filtered by active category. */
  const categoryFilteredGroups = useMemo((): VarGroup[] => {
    if (activeCategory === 'All') return groups;
    return groups.filter((g) => g.category === activeCategory);
  }, [groups, activeCategory]);

  // Runs before browser paint so user never sees a flash of empty search
  useLayoutEffect(() => {
    if (open) {
      setQ(initialSearch); // eslint-disable-line react-hooks/set-state-in-effect -- reset UI on modal open
      setActiveCategory('All');  
      setSelectedGroup((prev) => prev ?? (groups.length > 0 ? groups[0].key : null));  
      setView('browse');  
    } else {
      setQ('');  
      setSelectedGroup(null);  
      setHoveredHint(null);  
      setActiveCategory('All');  
      setComposeMode(false);  
      setComposeTokens([]);  
      setView('browse');
      setExpanded(false);
    }
  }, [open, initialSearch, groups, setExpanded]);

  const isSearching = q.trim().length > 0;

  /** Filter groups by search query. */
  const filteredGroups = useMemo((): VarGroup[] => {
    const t = q.trim().toLowerCase();
    if (!t) return categoryFilteredGroups;
    return categoryFilteredGroups
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
  }, [categoryFilteredGroups, q]);

  /** Source list items — in search mode, highlight sources with matches. */
  const sourceMatchSet = useMemo(() => new Set(filteredGroups.map((g) => g.key)), [filteredGroups]);

  /** Variables to show on the right panel. */
  const rightPanelGroups = useMemo((): VarGroup[] => {
    return isSearching ? filteredGroups
      : !selectedGroup ? []
      : (() => { const g = categoryFilteredGroups.find((g) => g.key === selectedGroup); return g ? [g] : []; })();
  }, [isSearching, filteredGroups, selectedGroup, categoryFilteredGroups]);

  const handleGroupClick = useCallback((key: string) => {
    setSelectedGroup(key);
    setQ('');
  }, []);

  /** Set of compose token values for quick "is checked?" lookup. */
  const composeTokenSet = useMemo(() => new Set(composeTokens.map((t) => t.value)), [composeTokens]);

  /** Toggle a variable into/out of compose tokens. */
  const toggleComposeToken = useCallback((h: WorkflowVariableHint, insertRef: string, displayName: string) => {
    const value = `{{${insertRef}}}`;
    if (composeTokenSet.has(value)) {
      setComposeTokens((prev) => prev.filter((t) => t.value !== value));
    } else {
      const token: ComposeToken = {
        id: `var-${h.ref}-${Date.now()}`,
        kind: 'variable',
        value,
        displayLabel: displayName,
        source: h.source,
      };
      setComposeTokens((prev) => [...prev, token]);
    }
  }, [composeTokenSet]);

  const handleInsertAll = useCallback(() => {
    const template = composeTokens.map((t) => t.value).join('');
    if (template) {
      onPick(template);
    }
  }, [composeTokens, onPick]);

  const handleComposeClear = useCallback(() => {
    setComposeTokens([]);
  }, []);

  /** Handle expression insert — either add as compose token or directly insert. */
  const handleExpressionInsert = useCallback((template: string) => {
    if (composeMode) {
      const token: ComposeToken = {
        id: `expr-${Date.now()}`,
        kind: 'expression',
        value: template,
        displayLabel: template.replace(/^\{\{/, '').replace(/\}\}$/, ''),
      };
      setComposeTokens((prev) => [...prev, token]);
    } else {
      onPick(template);
    }
  }, [composeMode, onPick]);

  if (!open) return null;

  /** Render the left-panel source items, grouped by category with headers. */
  const renderSourceList = () => {
    const sourceGroups = categoryFilteredGroups;
    let lastCategory: VariableSourceCategory | null = null;
    const items: React.ReactNode[] = [];

    for (const g of sourceGroups) {
      if (g.category !== lastCategory) {
        lastCategory = g.category;
        items.push(
          <div key={`cat-${g.category}`} className="wf-var-insert-category-header">
            {g.category}
          </div>,
        );
      }
      const isActive = !isSearching && selectedGroup === g.key;
      const hasMatch = isSearching && sourceMatchSet.has(g.key);
      const dimmed = isSearching && !hasMatch;
      items.push(
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
        </button>,
      );
    }
    return items;
  };

  return createPortal(
    <div
      className="modal-overlay wf-var-insert-modal-overlay"
      role="presentation"
      onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } }}
      style={overlayStyle}
    >
      <div className={`modal ram-modal wf-var-insert-modal ${expandClass}`} role="dialog" aria-modal="true" aria-labelledby="wf-var-insert-title" onClick={(e) => e.stopPropagation()} style={dialogStyle}>
        <div className="ram-header" style={headerDragStyle} onMouseDown={onHeaderMouseDown}>
          <h3 id="wf-var-insert-title">Insert variable</h3>
          <input
            className="ram-input wf-var-insert-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search all variables…"
            autoFocus
            aria-label="Search variables"
          />
          <label className="wf-var-insert-compose-toggle" title="Toggle Compose mode to build multi-variable templates">
            <input
              type="checkbox"
              checked={composeMode}
              onChange={(e) => setComposeMode(e.target.checked)}
              aria-label="Compose mode"
            />
            <span className="wf-var-insert-compose-toggle-label">Compose</span>
          </label>
          <ModalExpandButton expanded={expanded} onToggle={toggleExpand} />
          <button type="button" className="ram-modal-close" onClick={onClose} aria-label="Close">&times;</button>
        </div>
        {/* View toggle tabs */}
        <div className="wf-var-insert-view-tabs">
          <button
            type="button"
            className={`wf-var-insert-view-tab ${view === 'browse' ? 'active' : ''}`}
            onClick={() => setView('browse')}
          >Browse</button>
          <button
            type="button"
            className={`wf-var-insert-view-tab ${view === 'expression' ? 'active' : ''}`}
            onClick={() => setView('expression')}
          >Expression</button>
        </div>
        {/* Category filter toolbar */}
        {view === 'browse' && presentCategories.length > 1 && (
          <div className="wf-var-insert-category-toolbar">
            <button
              type="button"
              className={`wf-var-insert-cat-btn ${activeCategory === 'All' ? 'active' : ''}`}
              onClick={() => setActiveCategory('All')}
            >All</button>
            {presentCategories.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`wf-var-insert-cat-btn ${activeCategory === cat ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat)}
              >{cat}</button>
            ))}
          </div>
        )}
        {initialSearch && (
          <div className="wf-var-insert-context-hint">
            <span className="wf-var-insert-context-icon">⚑</span>
            Setting value for <code>{'{{' + initialSearch + '}}'}</code> — pick a variable below to reference it
          </div>
        )}

        {view === 'expression' ? (
          <>
          <ExpressionBuilderView hints={hints} onInsert={handleExpressionInsert} />
          {composeMode && (
            <ComposeStrip
              tokens={composeTokens}
              onTokensChange={setComposeTokens}
              onInsertAll={handleInsertAll}
              onClear={handleComposeClear}
            />
          )}
          </>
        ) : hints.length === 0 ? (
          <div className="wf-var-insert-empty-state">
            <div className="wf-var-insert-empty-icon">📋</div>
            <p>No variables available yet.</p>
            <p className="wf-var-insert-empty-hint">
              Add variables under <strong>Initial Variables</strong> or <strong>Workflow Defaults</strong>,
              or connect upstream HTTP steps with extractions.
            </p>
          </div>
        ) : (
          <>
          <div className="wf-var-insert-columns">
            {/* ── Left: source / step list with category headers ── */}
            <div className="wf-var-insert-left">
              <div className="wf-var-insert-left-title">Sources</div>
              <div className="wf-var-insert-source-list">
                {renderSourceList()}
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
                      const sourceIcon = h.source ? (NODE_TYPE_DISPLAY[h.source.nodeType]?.icon ?? '⚡') : null;
                      const isChecked = composeMode && composeTokenSet.has(`{{${insertRef}}}`);
                      return (
                        <button
                          key={h.ref}
                          type="button"
                          className={`wf-var-insert-var-row ${isChecked ? 'checked' : ''}`}
                          onClick={() => {
                            if (composeMode) {
                              toggleComposeToken(h, insertRef, name);
                            } else {
                              onPick(`{{${insertRef}}}`);
                            }
                          }}
                          onMouseEnter={() => setHoveredHint(h)}
                          onMouseLeave={() => setHoveredHint((prev) => prev === h ? null : prev)}
                          title={composeMode ? `Toggle ${name} in compose` : `Click to insert {{${insertRef}}}`}
                        >
                          {composeMode && (
                            <span className={`wf-compose-checkbox ${isChecked ? 'checked' : ''}`} aria-hidden="true">
                              {isChecked ? '☑' : '☐'}
                            </span>
                          )}
                          <span className="wf-var-insert-var-name">{name}</span>
                          {h.type && <span className="wf-var-insert-var-type">{h.type}</span>}
                          {isSearching && h.source && (
                            <span className="wf-var-insert-source-pill">
                              {sourceIcon && <span className="wf-var-insert-source-pill-icon">{sourceIcon}</span>}
                              {h.source.nodeLabel}
                            </span>
                          )}
                          <code className="wf-var-insert-var-ref">{`→ {{${insertRef}}}`}</code>
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="wf-var-insert-detail-bar">
            {hoveredHint ? (
              <>
                <span className="wf-var-insert-detail-name"><code>{`{{${hoveredHint.ref}}}`}</code></span>
                {hoveredHint.type && <span className="wf-var-insert-detail-type">{hoveredHint.type}</span>}
                {hoveredHint.source && <span className="wf-var-insert-detail-source">{hoveredHint.source.nodeLabel}</span>}
                {hoveredHint.description && <span className="wf-var-insert-detail-desc">{hoveredHint.description}</span>}
              </>
            ) : (
              <span className="wf-var-insert-detail-placeholder">Hover a variable to see details</span>
            )}
            <ModalExpandButton expanded={expanded} onToggle={toggleExpand} position="footer" />
          </div>
          {composeMode && (
            <ComposeStrip
              tokens={composeTokens}
              onTokensChange={setComposeTokens}
              onInsertAll={handleInsertAll}
              onClear={handleComposeClear}
            />
          )}
          </>
        )}
        <ModalResizeHandles onRightEdge={onRightEdge} onCorner={onCorner} />
      </div>
    </div>,
    document.body,
  );
}
