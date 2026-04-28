import { useState, useMemo } from 'react';
import { sampleWorkflowCatalog, type SampleWorkflowEntry, type SampleCategory } from '../../../../data/sampleWorkflows';

const CATEGORIES: { key: SampleCategory | 'all'; label: string }[] = [
  { key: 'all', label: 'All Templates' },
  { key: 'api-patterns', label: 'API Patterns' },
  { key: 'flow-control', label: 'Flow Control' },
  { key: 'event-driven', label: 'Event-Driven' },
  { key: 'orchestration', label: 'Orchestration' },
];

const NODE_TYPES = [
  { value: '', label: 'All Nodes' },
  { value: 'HTTP', label: 'HTTP Request' },
  { value: 'Condition', label: 'Condition' },
  { value: 'Switch', label: 'Switch' },
  { value: 'Loop', label: 'Loop' },
  { value: 'Fork', label: 'Fork/Join' },
  { value: 'Join', label: 'Fork/Join' },
  { value: 'Aggregate', label: 'Aggregate' },
  { value: 'Script', label: 'Script' },
  { value: 'Delay', label: 'Delay' },
  { value: 'Error', label: 'Error Handler' },
  { value: 'LogDebug', label: 'Log/Debug' },
  { value: 'SetVariable', label: 'Set Variable' },
  { value: 'SubWorkflow', label: 'Sub-Workflow' },
  { value: 'WaitCondition', label: 'Wait for Condition' },
  { value: 'Webhook', label: 'Webhook Trigger' },
  { value: 'Schedule', label: 'Schedule Trigger' },
] as const;

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (entry: SampleWorkflowEntry) => void;
}

/** Standalone gallery content — used directly in the Gallery tab pane. */
export function TemplateGalleryContent({ onSelect }: { onSelect: (entry: SampleWorkflowEntry) => void }) {
  const [category, setCategory] = useState<SampleCategory | 'all'>('all');
  const [nodeFilter, setNodeFilter] = useState<string>('');

  const nodeOptions = useMemo(() => {
    const nodeCounts = new Map<string, number>();
    sampleWorkflowCatalog.forEach(entry => {
      [...entry.primaryNodes, ...entry.secondaryNodes].forEach(node => {
        nodeCounts.set(node, (nodeCounts.get(node) || 0) + 1);
      });
    });
    return NODE_TYPES.map(opt => ({
      ...opt,
      count: opt.value ? nodeCounts.get(opt.value) || 0 : 0,
    }));
  }, []);

  const filtered = useMemo(() => {
    let result = sampleWorkflowCatalog;
    if (category !== 'all') {
      result = result.filter(e => e.category === category);
    }
    if (nodeFilter) {
      result = result.filter(e =>
        e.primaryNodes.includes(nodeFilter) || e.secondaryNodes.includes(nodeFilter)
      );
    }
    return result;
  }, [category, nodeFilter]);

  const selectedNodeLabel = nodeOptions.find(opt => opt.value === nodeFilter)?.label;

  return (
    <div className="tg-content">
      <div className="tg-pane-header">
        <h3 className="tg-pane-title">Template Gallery</h3>
      </div>
      <div className="tg-filters">
        <div className="tg-tabs">
          {CATEGORIES.map(cat => (
            <button
              key={cat.key}
              className={`tg-tab ${category === cat.key ? 'active' : ''}`}
              onClick={() => setCategory(cat.key)}
            >
              {cat.label}
              {cat.key !== 'all' && (
                <span className="tg-tab-count">
                  {sampleWorkflowCatalog.filter(e => e.category === cat.key).length}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="tg-node-filter">
          <label className="tg-node-filter-label">Find by Node:</label>
          <select
            value={nodeFilter}
            onChange={e => setNodeFilter(e.target.value)}
            aria-label="Filter by node type"
            className="tg-node-filter-select"
          >
            {nodeOptions.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.value ? `${opt.label} (${opt.count})` : opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {nodeFilter && (
        <div className="tg-active-filter">
          🔍 Showing samples using: <strong>{selectedNodeLabel}</strong> ({filtered.length} {filtered.length === 1 ? 'result' : 'results'})
          <button
            className="tg-active-filter-clear"
            onClick={() => setNodeFilter('')}
            aria-label="Clear node filter"
            title="Clear filter"
          >
            ✕
          </button>
        </div>
      )}

      <div className="tg-grid">
        {filtered.map(entry => {
          const catKey = entry.category === 'api-patterns' ? 'api'
            : entry.category === 'flow-control' ? 'flow'
            : entry.category === 'event-driven' ? 'event'
            : 'orch';
          return (
            <button
              key={entry.id}
              className="tg-card"
              data-cat={catKey}
              onClick={() => onSelect(entry)}
            >
              <div className="tg-card-top">
                <div className="tg-card-icon">{entry.icon}</div>
                <div className="tg-card-body">
                  <div className="tg-card-name">{entry.name}</div>
                  <div className="tg-card-desc">{entry.description}</div>
                </div>
              </div>

              <div className="tg-card-node-pills">
                {entry.primaryNodes.map(node => (
                  <span key={node} className="tg-node-pill primary">
                    {node}
                  </span>
                ))}
                {entry.secondaryNodes.map(node => (
                  <span key={node} className="tg-node-pill">
                    {node}
                  </span>
                ))}
              </div>

              <div className="tg-card-meta">
                <span className="tg-card-count">{entry.nodeCount} nodes</span>
                <span className="tg-meta-spacer" />
                <div className="tg-difficulty-dots" data-level={entry.difficulty}>
                  <span className="tg-dot" />
                  <span className="tg-dot" />
                  <span className="tg-dot" />
                </div>
                <span className="tg-difficulty-label">{entry.difficulty}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Modal wrapper — kept for backward compat but Gallery tab uses TemplateGalleryContent directly. */
export default function TemplateGalleryModal({ open, onClose, onSelect }: Props) {
  if (!open) return null;
  return (
    <TemplateGalleryContent onSelect={onSelect} />
  );
}
