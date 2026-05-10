import { useState, useMemo } from 'react';
import { sampleWorkflowCatalog, type SampleWorkflowEntry, type SampleCategory } from '../../../../data/galleries/workflows';

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
  { value: 'CorrelationWait', label: 'Correlation Wait' },
  { value: 'Webhook', label: 'Webhook Trigger' },
  { value: 'Schedule', label: 'Schedule Trigger' },
] as const;

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (entry: SampleWorkflowEntry) => void;
}

/** Standalone gallery content — used directly in the Gallery tab pane. */
export function TemplateGalleryContent({ onSelect, loadedSampleIds }: { onSelect: (entry: SampleWorkflowEntry) => void; loadedSampleIds?: Set<string> }) {
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
      const directMatch = (e: SampleWorkflowEntry) =>
        e.primaryNodes.includes(nodeFilter) || e.secondaryNodes.includes(nodeFilter);
      // Pair-aware: if either half of a pair matches, include both halves.
      const matchedIds = new Set(result.filter(directMatch).map(e => e.id));
      const expandedIds = new Set(matchedIds);
      result.forEach(e => {
        if (matchedIds.has(e.id) && e.simulatorOf) {
          expandedIds.add(e.simulatorOf);
        }
        // If a main is matched and has a companion simulator in result, include it
        const sim = sampleWorkflowCatalog.find(s => s.simulatorOf === e.id);
        if (matchedIds.has(e.id) && sim) {
          expandedIds.add(sim.id);
        }
      });
      result = result.filter(e => expandedIds.has(e.id));
    }
    return result;
  }, [category, nodeFilter]);

  /**
   * Group entries so that each main + its simulator render together inside a
   * pair-wrapper. Standalone entries render as a single-item "group".
   * Output preserves catalog order.
   */
  const groups = useMemo(() => {
    const filteredIds = new Set(filtered.map(e => e.id));
    const consumed = new Set<string>();
    const out: Array<{ key: string; main: SampleWorkflowEntry; simulator?: SampleWorkflowEntry }> = [];
    for (const entry of filtered) {
      if (consumed.has(entry.id)) continue;
      // Skip simulators here — they are picked up via their main.
      if (entry.simulatorOf) {
        // Orphan simulator (its main not in filtered list) → render alone
        const main = sampleWorkflowCatalog.find(m => m.id === entry.simulatorOf);
        if (!main || !filteredIds.has(main.id)) {
          out.push({ key: entry.id, main: entry });
          consumed.add(entry.id);
        }
        continue;
      }
      const sim = sampleWorkflowCatalog.find(s => s.simulatorOf === entry.id && filteredIds.has(s.id));
      if (sim) {
        out.push({ key: entry.id, main: entry, simulator: sim });
        consumed.add(entry.id);
        consumed.add(sim.id);
      } else {
        out.push({ key: entry.id, main: entry });
        consumed.add(entry.id);
      }
    }
    return out;
  }, [filtered]);

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
        {groups.map(group => {
          if (group.simulator) {
            return (
              <div key={group.key} className="tg-pair" data-cat={catKeyOf(group.main.category)}>
                <div className="tg-pair-header">
                  <span className="tg-pair-icon"><svg className="wf-inline-icon" viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></span>
                  <span className="tg-pair-title">Paired Sample &amp; Simulator</span>
                  <span className="tg-pair-hint">Run main first → it pauses → run simulator → main resumes</span>
                </div>
                <div className="tg-pair-body">
                  <SampleCard entry={group.main} role="main" onSelect={onSelect} isLoaded={loadedSampleIds?.has(group.main.id)} />
                  <span className="tg-pair-arrow" aria-hidden>→</span>
                  <SampleCard entry={group.simulator} role="simulator" onSelect={onSelect} isLoaded={loadedSampleIds?.has(group.simulator.id)} />
                </div>
              </div>
            );
          }
          return <SampleCard key={group.key} entry={group.main} role="solo" onSelect={onSelect} isLoaded={loadedSampleIds?.has(group.main.id)} />;
        })}
      </div>
    </div>
  );
}

function catKeyOf(category: SampleCategory): string {
  return category === 'api-patterns' ? 'api'
    : category === 'flow-control' ? 'flow'
    : category === 'event-driven' ? 'event'
    : 'orch';
}

interface SampleCardProps {
  entry: SampleWorkflowEntry;
  role: 'main' | 'simulator' | 'solo';
  onSelect: (entry: SampleWorkflowEntry) => void;
  isLoaded?: boolean;
}

function SampleCard({ entry, role, onSelect, isLoaded }: SampleCardProps) {
  const catKey = catKeyOf(entry.category);
  return (
    <button
      className={`tg-card${role === 'simulator' ? ' tg-card-sim' : ''}${role === 'main' ? ' tg-card-paired-main' : ''}${isLoaded ? ' tg-card-loaded' : ''}`}
      data-cat={catKey}
      onClick={() => onSelect(entry)}
    >
      {isLoaded && (
        <div className="tg-card-loaded-badge">✓ Loaded</div>
      )}
      {role === 'simulator' && (
        <div className="tg-card-role-tag" data-role="simulator">SIMULATOR</div>
      )}
      {role === 'main' && (
        <div className="tg-card-role-tag" data-role="main">MAIN</div>
      )}
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
}

/** Modal wrapper — kept for backward compat but Gallery tab uses TemplateGalleryContent directly. */
export default function TemplateGalleryModal({ open, onClose: _onClose, onSelect }: Props) {
  if (!open) return null;
  return (
    <TemplateGalleryContent onSelect={onSelect} />
  );
}
