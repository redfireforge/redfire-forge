import { useState, useMemo } from 'react';
import { Differ, Viewer } from 'json-diff-kit';
import 'json-diff-kit/dist/viewer.css';
import 'json-diff-kit/dist/viewer-monokai.css';
import type { WorkflowVersion } from '../../types/workflow';
import { computeVersionDiff, type VersionDiffResult } from '../../utils/workflowVersioning';

type DiffTab = 'nodes' | 'edges' | 'variables' | 'services';

interface Props {
  open: boolean;
  older: WorkflowVersion;
  newer: WorkflowVersion;
  onClose: () => void;
}

const differ = new Differ({ detectCircular: false, arrayDiffMethod: 'lcs' });

export default function WorkflowVersionDiff({ open, older, newer, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<DiffTab>('nodes');
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null);

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

  return (
    <div className="wf-version-diff-overlay modal-overlay" onClick={onClose}>
      <div className="wf-version-diff-modal" onClick={(e) => e.stopPropagation()}>
        <div className="wf-version-diff-header">
          <h3>Version Comparison</h3>
          <span className="wf-version-diff-range">
            {olderLabel} → {newerLabel}
          </span>
          <button className="btn btn-sm" onClick={onClose}>×</button>
        </div>

        <div className="wf-version-diff-tabs">
          {tabs.map((t) => (
            <button
              key={t.key}
              className={`wf-version-diff-tab ${activeTab === t.key ? 'active' : ''}`}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}
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

  if (!hasChanges) return <div className="wf-version-diff-empty">No node changes</div>;

  return (
    <div className="wf-version-diff-section">
      {diff.addedNodes.length > 0 && (
        <DiffGroup title={`Added (${diff.addedNodes.length})`} variant="added">
          {diff.addedNodes.map((n) => (
            <div key={n.id} className="wf-version-diff-row added">
              <span className="wf-version-diff-badge added">+</span>
              <span className="wf-version-diff-node-type">{n.type}</span>
              <span>{(n.data as { label?: string }).label ?? n.id}</span>
            </div>
          ))}
        </DiffGroup>
      )}

      {diff.removedNodes.length > 0 && (
        <DiffGroup title={`Removed (${diff.removedNodes.length})`} variant="removed">
          {diff.removedNodes.map((n) => (
            <div key={n.id} className="wf-version-diff-row removed">
              <span className="wf-version-diff-badge removed">−</span>
              <span className="wf-version-diff-node-type">{n.type}</span>
              <span>{(n.data as { label?: string }).label ?? n.id}</span>
            </div>
          ))}
        </DiffGroup>
      )}

      {diff.modifiedNodes.length > 0 && (
        <DiffGroup title={`Modified (${diff.modifiedNodes.length})`} variant="modified">
          {diff.modifiedNodes.map((m) => {
            const isExpanded = expandedNodeId === m.id;
            return (
              <div key={m.id} className="wf-version-diff-row-group">
                <button
                  className="wf-version-diff-row modified"
                  onClick={() => onToggleExpand(isExpanded ? null : m.id)}
                >
                  <span className="wf-version-diff-badge modified">~</span>
                  <span className="wf-version-diff-node-type">{m.new.type}</span>
                  <span>{m.label}</span>
                  <span className="wf-version-diff-expand-icon">{isExpanded ? '▾' : '▸'}</span>
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

  if (!hasChanges) return <div className="wf-version-diff-empty">No edge changes</div>;

  return (
    <div className="wf-version-diff-section">
      {diff.addedEdges.map((e) => (
        <div key={e.id} className="wf-version-diff-row added">
          <span className="wf-version-diff-badge added">+</span>
          <span>{e.source} → {e.target}</span>
          {e.label && <span className="wf-version-diff-edge-label">{e.label}</span>}
        </div>
      ))}
      {diff.removedEdges.map((e) => (
        <div key={e.id} className="wf-version-diff-row removed">
          <span className="wf-version-diff-badge removed">−</span>
          <span>{e.source} → {e.target}</span>
          {e.label && <span className="wf-version-diff-edge-label">{e.label}</span>}
        </div>
      ))}
    </div>
  );
}

function VariablesDiffView({ diff }: { diff: VersionDiffResult }) {
  const { added, removed, modified } = diff.variableChanges;
  const hasChanges = added.length > 0 || removed.length > 0 || modified.length > 0;

  if (!hasChanges) return <div className="wf-version-diff-empty">No variable changes</div>;

  return (
    <div className="wf-version-diff-section">
      {added.map((v) => (
        <div key={v.key} className="wf-version-diff-row added">
          <span className="wf-version-diff-badge added">+</span>
          <span className="wf-version-diff-var-key">{`{{${v.key}}}`}</span>
          <span className="wf-version-diff-var-val">{v.value}</span>
        </div>
      ))}
      {removed.map((v) => (
        <div key={v.key} className="wf-version-diff-row removed">
          <span className="wf-version-diff-badge removed">−</span>
          <span className="wf-version-diff-var-key">{`{{${v.key}}}`}</span>
          <span className="wf-version-diff-var-val">{v.value}</span>
        </div>
      ))}
      {modified.map((v) => (
        <div key={v.key} className="wf-version-diff-row modified">
          <span className="wf-version-diff-badge modified">~</span>
          <span className="wf-version-diff-var-key">{`{{${v.key}}}`}</span>
          <span className="wf-version-diff-var-val">
            <span className="wf-diff-old">{v.oldValue}</span>
            <span className="wf-diff-arrow">→</span>
            <span className="wf-diff-new">{v.newValue}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

function ServicesDiffView({ diff }: { diff: VersionDiffResult }) {
  const { added, removed, modified } = diff.serviceChanges;
  const hasChanges = added.length > 0 || removed.length > 0 || modified.length > 0;

  if (!hasChanges) return <div className="wf-version-diff-empty">No service changes</div>;

  return (
    <div className="wf-version-diff-section">
      {added.map((s) => (
        <div key={s.id} className="wf-version-diff-row added">
          <span className="wf-version-diff-badge added">+</span>
          <span>{s.name}</span>
        </div>
      ))}
      {removed.map((s) => (
        <div key={s.id} className="wf-version-diff-row removed">
          <span className="wf-version-diff-badge removed">−</span>
          <span>{s.name}</span>
        </div>
      ))}
      {modified.map((m) => (
        <div key={m.id} className="wf-version-diff-row-group">
          <div className="wf-version-diff-row modified">
            <span className="wf-version-diff-badge modified">~</span>
            <span>{m.name}</span>
          </div>
          <div className="wf-version-diff-inline">
            <InlineDiff oldObj={m.old} newObj={m.new} />
          </div>
        </div>
      ))}
    </div>
  );
}

function DiffGroup({ title, variant, children }: { title: string; variant: string; children: React.ReactNode }) {
  return (
    <div className={`wf-version-diff-group ${variant}`}>
      <div className="wf-version-diff-group-title">{title}</div>
      {children}
    </div>
  );
}

function InlineDiff({ oldObj, newObj }: { oldObj: unknown; newObj: unknown }) {
  const result = useMemo(() => differ.diff(oldObj, newObj), [oldObj, newObj]);
  return (
    <div className="wf-version-diff-json-viewer" data-theme="monokai">
      <Viewer diff={result} indent={2} lineNumbers highlightInlineDiff />
    </div>
  );
}

import { formatTimestamp } from '../../../../shared/utils/formatRelativeTime';
