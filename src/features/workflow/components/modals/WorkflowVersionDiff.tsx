import type { ReactElement } from 'react';
import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Viewer } from 'json-diff-kit';
import { sharedDiffer } from '@shared/utils/jsonDiffKit';
import 'json-diff-kit/dist/viewer.css';
import 'json-diff-kit/dist/viewer-monokai.css';
import type { WorkflowVersion } from '../../types/workflow';
import { computeVersionDiff, type VersionDiffResult } from '../../utils/workflowVersioning';
import '../../../../styles/workflow-version-diff.css';

type DiffTab = 'nodes' | 'edges' | 'variables' | 'services';

interface Props {
  open: boolean;
  older: WorkflowVersion;
  newer: WorkflowVersion;
  onClose: () => void;
}

const TAB_ICONS: Record<DiffTab, ReactElement> = {
  nodes: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
      <circle cx="15.5" cy="8.5" r="1.5" fill="currentColor" />
      <circle cx="8.5" cy="15.5" r="1.5" fill="currentColor" />
      <circle cx="15.5" cy="15.5" r="1.5" fill="currentColor" />
    </svg>
  ),
  edges: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  ),
  variables: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 7V4h16v3M9 20h6M12 4v16" />
    </svg>
  ),
  services: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  ),
};

const MIN_WIDTH = 480;
const MIN_HEIGHT = 360;

export default function WorkflowVersionDiff({ open, older, newer, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<DiffTab>('nodes');
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; origW: number; origH: number; origX: number; origY: number; dir: string } | null>(null);

  // Reset position/size when modal opens
  useEffect(() => {
    if (open) { setPos(null); setSize(null); }
  }, [open]);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    const modal = modalRef.current;
    if (!modal) return;
    const rect = modal.getBoundingClientRect();
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: rect.left, origY: rect.top };
    // Lock the current size on first drag so the modal doesn't jump
    setSize((prev) => prev ?? { w: rect.width, h: rect.height });

    const onMove = (ev: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      setPos({ x: d.origX + (ev.clientX - d.startX), y: d.origY + (ev.clientY - d.startY) });
    };
    const onUp = () => {
      dragRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  const handleResizeStart = useCallback((e: React.MouseEvent, dir: string) => {
    e.preventDefault();
    e.stopPropagation();
    const modal = modalRef.current;
    if (!modal) return;
    const rect = modal.getBoundingClientRect();
    resizeRef.current = { startX: e.clientX, startY: e.clientY, origW: rect.width, origH: rect.height, origX: rect.left, origY: rect.top, dir };

    const onMove = (ev: MouseEvent) => {
      const r = resizeRef.current;
      if (!r) return;
      const dx = ev.clientX - r.startX;
      const dy = ev.clientY - r.startY;
      let newW = r.origW;
      let newH = r.origH;
      let newX = r.origX;
      let newY = r.origY;

      if (r.dir.includes('e')) newW = Math.max(MIN_WIDTH, r.origW + dx);
      if (r.dir.includes('w')) { newW = Math.max(MIN_WIDTH, r.origW - dx); newX = r.origX + (r.origW - newW); }
      if (r.dir.includes('s')) newH = Math.max(MIN_HEIGHT, r.origH + dy);
      if (r.dir.includes('n')) { newH = Math.max(MIN_HEIGHT, r.origH - dy); newY = r.origY + (r.origH - newH); }

      setSize({ w: newW, h: newH });
      setPos({ x: newX, y: newY });
    };
    const onUp = () => {
      resizeRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  const diff = useMemo(() => computeVersionDiff(older, newer), [older, newer]);

  if (!open) return null;

  const tabs: Array<{ key: DiffTab; label: string; count: number }> = [
    { key: 'nodes', label: 'Nodes', count: diff.addedNodes.length + diff.removedNodes.length + diff.modifiedNodes.length },
    { key: 'edges', label: 'Edges', count: diff.addedEdges.length + diff.removedEdges.length },
    { key: 'variables', label: 'Variables', count: diff.variableChanges.added.length + diff.variableChanges.removed.length + diff.variableChanges.modified.length },
    { key: 'services', label: 'Services', count: diff.serviceChanges.added.length + diff.serviceChanges.removed.length + diff.serviceChanges.modified.length },
  ];

  const olderLabel = older.label || formatTimestamp(older.timestamp);
  const newerLabel = newer.label || formatTimestamp(newer.timestamp);

  const totalChanges = tabs.reduce((sum, t) => sum + t.count, 0);

  const modalStyle: React.CSSProperties = pos || size ? {
    position: 'fixed',
    left: pos ? `${pos.x}px` : undefined,
    top: pos ? `${pos.y}px` : undefined,
    width: size ? `${size.w}px` : undefined,
    height: size ? `${size.h}px` : undefined,
    maxWidth: 'none',
    maxHeight: 'none',
  } : {};

  return (
    <div className="wf-version-diff-overlay modal-overlay" onClick={onClose}>
      <div
        ref={modalRef}
        className={`wf-version-diff-modal ${pos ? 'wf-version-diff-modal--positioned' : ''}`}
        style={modalStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="wf-version-diff-header" onMouseDown={handleDragStart} style={{ cursor: 'move' }}>
          <div className="wf-version-diff-header-left">
            <div className="wf-version-diff-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 3h5v5M8 3H3v5M3 16v5h5M21 16v5h-5M21 3l-7 7M3 21l7-7" />
              </svg>
            </div>
            <div className="wf-version-diff-title-block">
              <h3>Version Comparison</h3>
              <div className="wf-version-diff-range">
                <span className="wf-version-diff-label wf-version-diff-label-old">{olderLabel}</span>
                <svg className="wf-version-diff-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
                <span className="wf-version-diff-label wf-version-diff-label-new">{newerLabel}</span>
              </div>
            </div>
          </div>
          <div className="wf-version-diff-header-right">
            <div className="wf-version-diff-summary">
              <span className="wf-version-diff-summary-count">{totalChanges}</span>
              <span className="wf-version-diff-summary-text">change{totalChanges !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>

        <div className="wf-version-diff-tabs">
          {tabs.map((t) => (
            <button
              key={t.key}
              className={`wf-version-diff-tab ${activeTab === t.key ? 'active' : ''}`}
              onClick={() => setActiveTab(t.key)}
            >
              <span className="wf-version-diff-tab-icon">{TAB_ICONS[t.key]}</span>
              <span className="wf-version-diff-tab-label">{t.label}</span>
              {t.count > 0 && <span className="wf-version-diff-tab-count">{t.count}</span>}
            </button>
          ))}
        </div>

        <div className="wf-version-diff-body">
          {activeTab === 'nodes' && (
            <NodesDiffView diff={diff} expandedNodeId={expandedNodeId} onToggleExpand={setExpandedNodeId} />
          )}
          {activeTab === 'edges' && <EdgesDiffView diff={diff} />}
          {activeTab === 'variables' && <VariablesDiffView diff={diff} />}
          {activeTab === 'services' && <ServicesDiffView diff={diff} />}
        </div>
        <div className="wf-version-diff-footer">
          <button type="button" className="btn btn-primary" onClick={onClose}>Close</button>
        </div>

        {/* Resize handles */}
        <div className="wf-vd-resize wf-vd-resize-n" onMouseDown={(e) => handleResizeStart(e, 'n')} />
        <div className="wf-vd-resize wf-vd-resize-s" onMouseDown={(e) => handleResizeStart(e, 's')} />
        <div className="wf-vd-resize wf-vd-resize-e" onMouseDown={(e) => handleResizeStart(e, 'e')} />
        <div className="wf-vd-resize wf-vd-resize-w" onMouseDown={(e) => handleResizeStart(e, 'w')} />
        <div className="wf-vd-resize wf-vd-resize-ne" onMouseDown={(e) => handleResizeStart(e, 'ne')} />
        <div className="wf-vd-resize wf-vd-resize-nw" onMouseDown={(e) => handleResizeStart(e, 'nw')} />
        <div className="wf-vd-resize wf-vd-resize-se" onMouseDown={(e) => handleResizeStart(e, 'se')} />
        <div className="wf-vd-resize wf-vd-resize-sw" onMouseDown={(e) => handleResizeStart(e, 'sw')} />
      </div>
    </div>
  );
}

function NodesDiffView({
  diff,
  expandedNodeId,
  onToggleExpand,
}: {
  diff: VersionDiffResult;
  expandedNodeId: string | null;
  onToggleExpand: (id: string | null) => void;
}) {
  const hasChanges = diff.addedNodes.length > 0 || diff.removedNodes.length > 0 || diff.modifiedNodes.length > 0;

  if (!hasChanges) return <EmptyState message="No node changes" icon="nodes" />;

  return (
    <div className="wf-version-diff-section">
      {diff.addedNodes.length > 0 && (
        <DiffGroup title="Added" count={diff.addedNodes.length} variant="added">
          {diff.addedNodes.map((n) => (
            <DiffRow key={n.id} variant="added">
              <span className="wf-version-diff-node-type">{n.type}</span>
              <span className="wf-version-diff-node-name">{(n.data as { label?: string }).label ?? n.id}</span>
            </DiffRow>
          ))}
        </DiffGroup>
      )}

      {diff.removedNodes.length > 0 && (
        <DiffGroup title="Removed" count={diff.removedNodes.length} variant="removed">
          {diff.removedNodes.map((n) => (
            <DiffRow key={n.id} variant="removed">
              <span className="wf-version-diff-node-type">{n.type}</span>
              <span className="wf-version-diff-node-name">{(n.data as { label?: string }).label ?? n.id}</span>
            </DiffRow>
          ))}
        </DiffGroup>
      )}

      {diff.modifiedNodes.length > 0 && (
        <DiffGroup title="Modified" count={diff.modifiedNodes.length} variant="modified">
          {diff.modifiedNodes.map((m) => {
            const isExpanded = expandedNodeId === m.id;
            return (
              <div key={m.id} className="wf-version-diff-expandable">
                <button
                  className={`wf-version-diff-expandable-header ${isExpanded ? 'expanded' : ''}`}
                  onClick={() => onToggleExpand(isExpanded ? null : m.id)}
                >
                  <DiffBadge variant="modified" />
                  <span className="wf-version-diff-node-type">{m.new.type}</span>
                  <span className="wf-version-diff-node-name">{m.label}</span>
                  <span className="wf-version-diff-expand-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      {isExpanded ? <path d="M19 9l-7 7-7-7" /> : <path d="M9 5l7 7-7 7" />}
                    </svg>
                  </span>
                </button>
                {isExpanded && (
                  <div className="wf-version-diff-inline">
                    <InlineDiff oldObj={m.old.data} newObj={m.new.data} />
                  </div>
                )}
              </div>
            );
          })}
        </DiffGroup>
      )}
    </div>
  );
}

function EdgesDiffView({ diff }: { diff: VersionDiffResult }) {
  const hasChanges = diff.addedEdges.length > 0 || diff.removedEdges.length > 0;

  if (!hasChanges) return <EmptyState message="No edge changes" icon="edges" />;

  return (
    <div className="wf-version-diff-section">
      {diff.addedEdges.length > 0 && (
        <DiffGroup title="Added" count={diff.addedEdges.length} variant="added">
          {diff.addedEdges.map((e) => (
            <DiffRow key={e.id} variant="added">
              <span className="wf-version-diff-edge-path">
                <span className="wf-version-diff-edge-node">{e.source}</span>
                <svg className="wf-version-diff-edge-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
                <span className="wf-version-diff-edge-node">{e.target}</span>
              </span>
              {e.label && <span className="wf-version-diff-edge-label">{e.label}</span>}
            </DiffRow>
          ))}
        </DiffGroup>
      )}
      {diff.removedEdges.length > 0 && (
        <DiffGroup title="Removed" count={diff.removedEdges.length} variant="removed">
          {diff.removedEdges.map((e) => (
            <DiffRow key={e.id} variant="removed">
              <span className="wf-version-diff-edge-path">
                <span className="wf-version-diff-edge-node">{e.source}</span>
                <svg className="wf-version-diff-edge-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
                <span className="wf-version-diff-edge-node">{e.target}</span>
              </span>
              {e.label && <span className="wf-version-diff-edge-label">{e.label}</span>}
            </DiffRow>
          ))}
        </DiffGroup>
      )}
    </div>
  );
}

function VariablesDiffView({ diff }: { diff: VersionDiffResult }) {
  const { added, removed, modified } = diff.variableChanges;
  const hasChanges = added.length > 0 || removed.length > 0 || modified.length > 0;

  if (!hasChanges) return <EmptyState message="No variable changes" icon="variables" />;

  return (
    <div className="wf-version-diff-section">
      {added.length > 0 && (
        <DiffGroup title="Added" count={added.length} variant="added">
          {added.map((v) => (
            <DiffRow key={v.key} variant="added">
              <span className="wf-version-diff-var-key">{`{{${v.key}}}`}</span>
              <span className="wf-version-diff-var-eq">=</span>
              <span className="wf-version-diff-var-val">{v.value}</span>
            </DiffRow>
          ))}
        </DiffGroup>
      )}
      {removed.length > 0 && (
        <DiffGroup title="Removed" count={removed.length} variant="removed">
          {removed.map((v) => (
            <DiffRow key={v.key} variant="removed">
              <span className="wf-version-diff-var-key">{`{{${v.key}}}`}</span>
              <span className="wf-version-diff-var-eq">=</span>
              <span className="wf-version-diff-var-val">{v.value}</span>
            </DiffRow>
          ))}
        </DiffGroup>
      )}
      {modified.length > 0 && (
        <DiffGroup title="Modified" count={modified.length} variant="modified">
          {modified.map((v) => (
            <DiffRow key={v.key} variant="modified">
              <span className="wf-version-diff-var-key">{`{{${v.key}}}`}</span>
              <span className="wf-version-diff-var-change">
                <span className="wf-version-diff-var-old">{v.oldValue}</span>
                <svg className="wf-version-diff-var-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
                <span className="wf-version-diff-var-new">{v.newValue}</span>
              </span>
            </DiffRow>
          ))}
        </DiffGroup>
      )}
    </div>
  );
}

function ServicesDiffView({ diff }: { diff: VersionDiffResult }) {
  const { added, removed, modified } = diff.serviceChanges;
  const hasChanges = added.length > 0 || removed.length > 0 || modified.length > 0;

  if (!hasChanges) return <EmptyState message="No service changes" icon="services" />;

  return (
    <div className="wf-version-diff-section">
      {added.length > 0 && (
        <DiffGroup title="Added" count={added.length} variant="added">
          {added.map((s) => (
            <DiffRow key={s.id} variant="added">
              <span className="wf-version-diff-service-name">{s.name}</span>
            </DiffRow>
          ))}
        </DiffGroup>
      )}
      {removed.length > 0 && (
        <DiffGroup title="Removed" count={removed.length} variant="removed">
          {removed.map((s) => (
            <DiffRow key={s.id} variant="removed">
              <span className="wf-version-diff-service-name">{s.name}</span>
            </DiffRow>
          ))}
        </DiffGroup>
      )}
      {modified.length > 0 && (
        <DiffGroup title="Modified" count={modified.length} variant="modified">
          {modified.map((m) => (
            <div key={m.id} className="wf-version-diff-expandable expanded">
              <div className="wf-version-diff-expandable-header">
                <DiffBadge variant="modified" />
                <span className="wf-version-diff-service-name">{m.name}</span>
              </div>
              <div className="wf-version-diff-inline">
                <InlineDiff oldObj={m.old} newObj={m.new} />
              </div>
            </div>
          ))}
        </DiffGroup>
      )}
    </div>
  );
}

function DiffGroup({ title, count, variant, children }: { title: string; count: number; variant: string; children: React.ReactNode }) {
  return (
    <div className={`wf-version-diff-group wf-version-diff-group-${variant}`}>
      <div className="wf-version-diff-group-header">
        <span className="wf-version-diff-group-title">{title}</span>
        <span className={`wf-version-diff-group-count wf-version-diff-group-count-${variant}`}>{count}</span>
      </div>
      <div className="wf-version-diff-group-items">{children}</div>
    </div>
  );
}

function DiffRow({ variant, children }: { variant: 'added' | 'removed' | 'modified'; children: React.ReactNode }) {
  return (
    <div className={`wf-version-diff-row wf-version-diff-row-${variant}`}>
      <DiffBadge variant={variant} />
      {children}
    </div>
  );
}

function DiffBadge({ variant }: { variant: 'added' | 'removed' | 'modified' }) {
  const symbols = { added: '+', removed: '−', modified: '~' };
  return <span className={`wf-version-diff-badge wf-version-diff-badge-${variant}`}>{symbols[variant]}</span>;
}

function EmptyState({ message, icon }: { message: string; icon: DiffTab }) {
  return (
    <div className="wf-version-diff-empty">
      <span className="wf-version-diff-empty-icon">{TAB_ICONS[icon]}</span>
      <span className="wf-version-diff-empty-text">{message}</span>
    </div>
  );
}

function InlineDiff({ oldObj, newObj }: { oldObj: unknown; newObj: unknown }) {
  const result = useMemo(() => sharedDiffer.diff(oldObj, newObj), [oldObj, newObj]);
  return (
    <div className="wf-version-diff-json-viewer" data-theme="monokai">
      <Viewer diff={result} indent={2} lineNumbers highlightInlineDiff />
    </div>
  );
}

import { formatTimestamp } from '@shared/utils/formatRelativeTime';
