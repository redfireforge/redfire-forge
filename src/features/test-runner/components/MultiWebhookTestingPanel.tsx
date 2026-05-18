import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Workflow, CorrelationWaitNodeData, SwitchNodeData, ConditionNodeData, WorkflowNode, WorkflowEdge } from '../../workflow/types/workflow';

interface PausedCorrelation {
  correlationId: string;
  webhookPath: string;
  pausedAt: number;
  workflowId?: string;
  pausedNodeId?: string;
}

interface CorrelationWaitNode {
  id: string;
  label: string;
  data: CorrelationWaitNodeData;
  position: { x: number; y: number };
}

export interface WebhookPayloadPreset {
  nodeId: string;
  payload: Record<string, unknown>;
}

export interface WebhookScenario {
  id: string;
  name: string;
  description?: string;
  payloads: WebhookPayloadPreset[];
  createdAt: number;
}

interface Props {
  workflow: Workflow;
  isRunning: boolean;
  onFireWebhook: (nodeId: string, correlationId: string, payload: Record<string, unknown>) => Promise<void>;
  scenarios?: WebhookScenario[];
  onSaveScenario?: (scenario: Omit<WebhookScenario, 'id' | 'createdAt'>) => void;
  onDeleteScenario?: (scenarioId: string) => void;
  onLoadScenario?: (scenario: WebhookScenario) => void;
}

type NodeState = 'pending' | 'running' | 'paused' | 'completed' | 'failed';

interface NodeStateInfo {
  state: NodeState;
  correlationId?: string;
  pausedAt?: number;
}

function buildDefaultPayload(data: CorrelationWaitNodeData): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (data.correlationSource === 'body' && data.correlationJsonPath) {
    const path = data.correlationJsonPath.replace(/^\$\.?/, '');
    setNestedValue(payload, path, '{{correlationId}}');
  }
  for (const ev of data.extractVariables ?? []) {
    if (ev.name && ev.jsonPath) {
      const path = ev.jsonPath.replace(/^\$\.?/, '');
      setNestedValue(payload, path, getSampleValue(ev.name));
    }
  }
  return payload;
}

function getSampleValue(fieldName: string): string {
  const lower = fieldName.toLowerCase();
  if (lower.includes('status')) return 'completed';
  if (lower.includes('state')) return 'success';
  if (lower.includes('amount')) return '100.00';
  if (lower.includes('currency')) return 'USD';
  if (lower.includes('timestamp') || lower.includes('date') || lower.includes('time')) return new Date().toISOString();
  if (lower.includes('message') || lower.includes('msg')) return 'Operation completed successfully';
  if (lower.includes('error')) return '';
  if (lower.includes('code')) return '200';
  return `sample_${fieldName}`;
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split('.');
  let current: unknown = obj;
  for (const key of keys) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current) || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  current[keys[keys.length - 1]] = value;
}

function buildNodeGraph(workflow: Workflow): { nodes: CorrelationWaitNode[]; allNodes: WorkflowNode[]; edges: WorkflowEdge[] } {
  const correlationNodes: CorrelationWaitNode[] = workflow.nodes
    .filter(n => n.type === 'correlationWait')
    .map(n => ({
      id: n.id,
      label: (n.data as CorrelationWaitNodeData).label || 'CorrelationWait',
      data: n.data as CorrelationWaitNodeData,
      position: n.position,
    }));
  return { nodes: correlationNodes, allNodes: workflow.nodes, edges: workflow.edges };
}

function computeExecutionOrder(nodes: WorkflowNode[], edges: WorkflowEdge[]): string[] {
  const order: string[] = [];
  const visited = new Set<string>();
  const inDegree = new Map<string, number>();
  for (const node of nodes) inDegree.set(node.id, 0);
  for (const edge of edges) inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
  const queue: string[] = [];
  for (const [nodeId, degree] of inDegree) {
    if (degree === 0) queue.push(nodeId);
  }
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);
    order.push(nodeId);
    for (const edge of edges) {
      if (edge.source === nodeId) {
        const newDegree = (inDegree.get(edge.target) ?? 1) - 1;
        inDegree.set(edge.target, newDegree);
        if (newDegree === 0 && !visited.has(edge.target)) queue.push(edge.target);
      }
    }
  }
  return order;
}

interface DecisionOption {
  jsonPath: string;
  label: string;
  options: { value: string; label: string }[];
}

/**
 * Walk the graph forward from a CorrelationWait node to find a downstream
 * Switch or Condition node. If found, map the Switch expression back to the
 * extract variable's JSON path so we know which payload field controls the
 * routing decision.
 */
function findDecisionOptions(
  cwNodeId: string,
  cwData: CorrelationWaitNodeData,
  allNodes: WorkflowNode[],
  edges: WorkflowEdge[],
): DecisionOption | null {
  const adjacency = new Map<string, string[]>();
  for (const e of edges) {
    const targets = adjacency.get(e.source) ?? [];
    targets.push(e.target);
    adjacency.set(e.source, targets);
  }
  const nodeMap = new Map(allNodes.map(n => [n.id, n]));

  // BFS forward from cwNode (max depth 5 to avoid deep traversal)
  const visited = new Set<string>();
  const queue: { id: string; depth: number }[] = [{ id: cwNodeId, depth: 0 }];

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;
    if (visited.has(id) || depth > 5) continue;
    visited.add(id);

    const node = nodeMap.get(id);
    if (!node) continue;

    if (node.type === 'switch') {
      const switchData = node.data as SwitchNodeData;
      const varRef = extractVariableRef(switchData.expression);
      if (!varRef) continue;

      const ev = (cwData.extractVariables ?? []).find(v => v.name === varRef);
      if (!ev) continue;

      const jsonPath = ev.jsonPath.replace(/^\$\.?/, '');
      const options = switchData.cases.map(c => ({
        value: c.value,
        label: c.label || c.value,
      }));
      options.push({ value: '__other__', label: 'Default (other)' });

      return { jsonPath, label: switchData.label || 'Decision', options };
    }

    if (node.type === 'condition') {
      const condData = node.data as ConditionNodeData;
      const varRef = extractVariableRef(condData.left);
      if (!varRef) continue;

      const ev = (cwData.extractVariables ?? []).find(v => v.name === varRef);
      if (!ev) continue;

      const jsonPath = ev.jsonPath.replace(/^\$\.?/, '');
      const rightVal = condData.right.replace(/^\{\{|\}\}$/g, '');
      return {
        jsonPath,
        label: condData.label || 'Condition',
        options: [
          { value: rightVal, label: `${condData.operator} ${rightVal} (true path)` },
          { value: `not_${rightVal}`, label: `Other value (false path)` },
        ],
      };
    }

    for (const next of adjacency.get(id) ?? []) {
      queue.push({ id: next, depth: depth + 1 });
    }
  }
  return null;
}

function extractVariableRef(expr: string): string | null {
  const match = expr.match(/^\{\{(\w+)\}\}$/);
  return match ? match[1] : null;
}

function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

const StatusIcon = ({ state }: { state: NodeState }) => {
  switch (state) {
    case 'paused':
      return (
        <svg className="mwt-status-icon mwt-status-paused" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" />
        </svg>
      );
    case 'completed':
      return (
        <svg className="mwt-status-icon mwt-status-completed" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      );
    case 'running':
      return <span className="mwt-status-icon mwt-status-running-dot" />;
    case 'failed':
      return (
        <svg className="mwt-status-icon mwt-status-failed" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      );
    default:
      return <span className="mwt-status-icon mwt-status-pending" />;
  }
};

export default function MultiWebhookTestingPanel({
  workflow,
  isRunning,
  onFireWebhook,
  scenarios = [],
  onSaveScenario,
  onDeleteScenario,
  onLoadScenario,
}: Props) {
  const [_pausedCorrelations, setPausedCorrelations] = useState<PausedCorrelation[]>([]);
  const [loadingPaused, setLoadingPaused] = useState(false);
  const [nodeStates, setNodeStates] = useState<Map<string, NodeStateInfo>>(new Map());
  const [editingPayloads, setEditingPayloads] = useState<Map<string, Record<string, unknown>>>(new Map());
  const [payloadText, setPayloadText] = useState<Map<string, string>>(new Map());
  const [payloadErrors, setPayloadErrors] = useState<Map<string, string>>(new Map());
  const [firingNodeId, setFiringNodeId] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [showScenarioModal, setShowScenarioModal] = useState(false);
  const [newScenarioName, setNewScenarioName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { nodes: correlationNodes, allNodes, edges } = useMemo(
    () => buildNodeGraph(workflow), [workflow]
  );
  const executionOrder = useMemo(
    () => computeExecutionOrder(allNodes, edges), [allNodes, edges]
  );
  const orderedCorrelationNodes = useMemo(() => {
    const nodeSet = new Set(correlationNodes.map(n => n.id));
    return executionOrder.filter(id => nodeSet.has(id)).map(id => correlationNodes.find(n => n.id === id)!);
  }, [executionOrder, correlationNodes]);

  // Detect downstream Switch/Condition nodes for each CorrelationWait
  const decisionMap = useMemo(() => {
    const map = new Map<string, DecisionOption>();
    for (const node of correlationNodes) {
      const dec = findDecisionOptions(node.id, node.data, allNodes, edges);
      if (dec) map.set(node.id, dec);
    }
    return map;
  }, [correlationNodes, allNodes, edges]);

  // Initialize payloads
  useEffect(() => {
    const newPayloads = new Map<string, Record<string, unknown>>();
    const newText = new Map<string, string>();
    for (const node of correlationNodes) {
      const existing = editingPayloads.get(node.id);
      const payload = existing ?? buildDefaultPayload(node.data);
      newPayloads.set(node.id, payload);
      if (!payloadText.has(node.id)) {
        newText.set(node.id, JSON.stringify(payload, null, 2));
      } else {
        newText.set(node.id, payloadText.get(node.id)!);
      }
    }
    setEditingPayloads(newPayloads);
    setPayloadText(prev => {
      const merged = new Map(prev);
      for (const [k, v] of newText) {
        if (!merged.has(k)) merged.set(k, v);
      }
      return merged;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [correlationNodes.map(n => n.id).join(',')]);

  // Auto-expand paused nodes
  useEffect(() => {
    const pausedIds = new Set<string>();
    for (const [nodeId, info] of nodeStates) {
      if (info.state === 'paused') pausedIds.add(nodeId);
    }
    if (pausedIds.size > 0) {
      setExpandedNodes(prev => new Set([...prev, ...pausedIds]));
    }
  }, [nodeStates]);

  const fetchPausedCorrelations = useCallback(async () => {
    setLoadingPaused(true);
    try {
      const host = window.location.hostname || 'localhost';
      const res = await fetch(`http://${host}:3001/api/correlations`);
      if (res.ok) {
        const data = await res.json();
        const correlations: PausedCorrelation[] = data.correlations ?? [];
        setPausedCorrelations(correlations);
        setNodeStates(prevStates => {
          const newStates = new Map<string, NodeStateInfo>();
          for (const node of correlationNodes) {
            const webhookPath = node.data.webhookPath || '/webhooks/callback';
            const fullPath = webhookPath.startsWith('/webhooks/callback')
              ? webhookPath
              : `/webhooks/callback${webhookPath.startsWith('/') ? '' : '/'}${webhookPath}`;
            const paused = correlations.find(
              pc => pc.webhookPath === fullPath && pc.pausedNodeId === node.id
            );
            if (paused) {
              newStates.set(node.id, { state: 'paused', correlationId: paused.correlationId, pausedAt: paused.pausedAt });
            } else if (prevStates.get(node.id)?.state === 'paused') {
              newStates.set(node.id, { state: 'completed' });
            } else {
              newStates.set(node.id, prevStates.get(node.id) ?? { state: 'pending' });
            }
          }
          return newStates;
        });
      }
    } catch { /* server may not be running */ }
    finally { setLoadingPaused(false); }
  }, [correlationNodes]);

  useEffect(() => {
    if (!isRunning) return;
    fetchPausedCorrelations();
    const interval = setInterval(fetchPausedCorrelations, 2000);
    return () => clearInterval(interval);
  }, [isRunning, fetchPausedCorrelations]);

  useEffect(() => {
    if (!isRunning) setNodeStates(new Map());
  }, [isRunning, workflow.id]);

  const handlePayloadTextChange = (nodeId: string, text: string) => {
    setPayloadText(prev => new Map(prev).set(nodeId, text));
    try {
      const parsed = JSON.parse(text);
      setEditingPayloads(prev => new Map(prev).set(nodeId, parsed));
      setPayloadErrors(prev => { const m = new Map(prev); m.delete(nodeId); return m; });
    } catch {
      setPayloadErrors(prev => new Map(prev).set(nodeId, 'Invalid JSON'));
    }
  };

  const applyDecision = (nodeId: string, jsonPath: string, value: string) => {
    const payload = { ...(editingPayloads.get(nodeId) ?? {}) };
    setNestedValue(payload, jsonPath, value);
    setEditingPayloads(prev => new Map(prev).set(nodeId, payload));
    setPayloadText(prev => new Map(prev).set(nodeId, JSON.stringify(payload, null, 2)));
    setPayloadErrors(prev => { const m = new Map(prev); m.delete(nodeId); return m; });
  };

  const handleFireWebhook = async (node: CorrelationWaitNode) => {
    const stateInfo = nodeStates.get(node.id);
    if (!stateInfo?.correlationId) {
      setError(`No correlation ID for "${node.label}". Workflow may not be paused at this node.`);
      return;
    }
    setFiringNodeId(node.id);
    setError(null);
    try {
      const payload = editingPayloads.get(node.id) ?? buildDefaultPayload(node.data);
      const resolvedPayload = JSON.parse(
        JSON.stringify(payload).replace(/\{\{correlationId\}\}/g, stateInfo.correlationId)
      );
      await onFireWebhook(node.id, stateInfo.correlationId, resolvedPayload);
      setNodeStates(prev => new Map(prev).set(node.id, { state: 'completed' }));
      await fetchPausedCorrelations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fire webhook');
    } finally {
      setFiringNodeId(null);
    }
  };

  const handleSaveScenario = () => {
    if (!newScenarioName.trim() || !onSaveScenario) return;
    const payloads: WebhookPayloadPreset[] = [];
    for (const [nodeId, payload] of editingPayloads) payloads.push({ nodeId, payload });
    onSaveScenario({ name: newScenarioName.trim(), payloads });
    setNewScenarioName('');
    setShowScenarioModal(false);
  };

  const handleLoadScenario = (scenario: WebhookScenario) => {
    const newPayloads = new Map(editingPayloads);
    const newText = new Map(payloadText);
    for (const preset of scenario.payloads) {
      if (newPayloads.has(preset.nodeId)) {
        newPayloads.set(preset.nodeId, preset.payload);
        newText.set(preset.nodeId, JSON.stringify(preset.payload, null, 2));
      }
    }
    setEditingPayloads(newPayloads);
    setPayloadText(newText);
    onLoadScenario?.(scenario);
  };

  const toggleExpand = (nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  if (correlationNodes.length === 0) return null;

  const pausedNodes = orderedCorrelationNodes.filter(n => nodeStates.get(n.id)?.state === 'paused');

  return (
    <div className="mwt-panel">
      {/* Header */}
      <div className="mwt-header">
        <div className="mwt-header-left">
          <svg className="mwt-header-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          <h3 className="mwt-title">Multi-Webhook Testing</h3>
          <span className="mwt-count-badge">{correlationNodes.length} webhook{correlationNodes.length > 1 ? 's' : ''}</span>
        </div>
        <div className="mwt-header-right">
          {onSaveScenario && (
            <button className="mwt-btn mwt-btn-secondary" onClick={() => setShowScenarioModal(true)} title="Save current payloads as a reusable scenario">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
                <polyline points="17,21 17,13 7,13 7,21" /><polyline points="7,3 7,8 15,8" />
              </svg>
              Save Scenario
            </button>
          )}
          <button className="mwt-btn mwt-btn-icon" onClick={fetchPausedCorrelations} disabled={loadingPaused} title="Refresh paused workflows">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={loadingPaused ? 'mwt-spin' : ''}>
              <path d="M23 4v6h-6M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Timeline: mini progress bar */}
      {orderedCorrelationNodes.length > 1 && (
        <div className="mwt-timeline">
          {orderedCorrelationNodes.map((node, idx) => {
            const state = nodeStates.get(node.id)?.state ?? 'pending';
            return (
              <div key={node.id} className="mwt-timeline-step">
                {idx > 0 && <div className={`mwt-timeline-line ${state === 'pending' ? '' : 'active'}`} />}
                <div className={`mwt-timeline-dot ${state}`} title={`${node.label} — ${state}`} />
              </div>
            );
          })}
        </div>
      )}

      {/* Node cards */}
      <div className="mwt-nodes">
        {orderedCorrelationNodes.map((node, idx) => {
          const stateInfo = nodeStates.get(node.id);
          const state = stateInfo?.state ?? 'pending';
          const isPaused = state === 'paused';
          const isExpanded = expandedNodes.has(node.id);
          const isFiring = firingNodeId === node.id;
          const hasError = payloadErrors.has(node.id);
          const webhookPath = node.data.webhookPath || '/webhooks/callback';
          const decision = decisionMap.get(node.id);
          const currentPayload = editingPayloads.get(node.id) ?? {};
          const currentDecisionValue = decision ? getNestedValue(currentPayload, decision.jsonPath) : undefined;

          return (
            <div key={node.id} className={`mwt-card ${state} ${isFiring ? 'firing' : ''}`}>
              {/* Card header — always visible */}
              <div className="mwt-card-header" onClick={() => toggleExpand(node.id)}>
                <div className="mwt-card-header-left">
                  <span className="mwt-card-index">{idx + 1}</span>
                  <StatusIcon state={state} />
                  <div className="mwt-card-title-group">
                    <span className="mwt-card-label">{node.label}</span>
                    <span className="mwt-card-path">{webhookPath}</span>
                  </div>
                </div>
                <div className="mwt-card-header-right">
                  {isPaused && stateInfo?.correlationId && (
                    <span className="mwt-card-corr-badge" title={stateInfo.correlationId}>
                      {stateInfo.correlationId.length > 20
                        ? stateInfo.correlationId.slice(0, 20) + '…'
                        : stateInfo.correlationId}
                    </span>
                  )}
                  {isPaused && stateInfo?.pausedAt && (
                    <span className="mwt-card-elapsed">{formatElapsed(Date.now() - stateInfo.pausedAt)} ago</span>
                  )}
                  <svg className={`mwt-card-chevron ${isExpanded ? 'open' : ''}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </div>

              {/* Expanded body */}
              {isExpanded && (
                <div className="mwt-card-body">
                  {isPaused && stateInfo?.correlationId && (
                    <div className="mwt-card-corr-row">
                      <span className="mwt-card-corr-label">Correlation ID</span>
                      <code className="mwt-card-corr-value">{stateInfo.correlationId}</code>
                    </div>
                  )}

                  {/* Decision quick-pick */}
                  {decision && (
                    <div className="mwt-decision-picker" data-testid="decision-picker">
                      <div className="mwt-decision-header">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                        </svg>
                        <span className="mwt-decision-label">{decision.label}</span>
                        <span className="mwt-decision-path">$.{decision.jsonPath}</span>
                      </div>
                      <div className="mwt-decision-options">
                        {decision.options.map(opt => {
                          const isDefault = opt.value === '__other__';
                          const isActive = isDefault
                            ? currentDecisionValue !== undefined && !decision.options.some(o => o.value !== '__other__' && o.value === String(currentDecisionValue))
                            : String(currentDecisionValue) === opt.value;
                          return (
                            <button
                              key={opt.value}
                              className={`mwt-decision-btn ${isActive ? 'active' : ''} ${isDefault ? 'mwt-decision-default' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isDefault) {
                                  applyDecision(node.id, decision.jsonPath, 'other');
                                } else {
                                  applyDecision(node.id, decision.jsonPath, opt.value);
                                }
                              }}
                              title={isDefault
                                ? `Set $.${decision.jsonPath} = "other" (triggers default path)`
                                : `Set $.${decision.jsonPath} = "${opt.value}"`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="mwt-card-payload">
                    <div className="mwt-card-payload-header">
                      <span className="mwt-card-payload-label">Webhook Payload</span>
                      {hasError && <span className="mwt-card-payload-error">Invalid JSON</span>}
                    </div>
                    <textarea
                      className={`mwt-card-editor ${hasError ? 'error' : ''}`}
                      value={payloadText.get(node.id) ?? '{}'}
                      onChange={(e) => handlePayloadTextChange(node.id, e.target.value)}
                      spellCheck={false}
                      rows={6}
                    />
                  </div>

                  {isPaused && (
                    <button
                      className="mwt-fire-btn"
                      onClick={() => handleFireWebhook(node)}
                      disabled={isFiring || hasError}
                    >
                      {isFiring ? (
                        <><span className="mwt-spinner" /> Sending...</>
                      ) : (
                        <>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="22" y1="2" x2="11" y2="13" />
                            <polygon points="22 2 15 22 11 13 2 9 22 2" />
                          </svg>
                          Fire Webhook
                        </>
                      )}
                    </button>
                  )}

                  {!isPaused && state === 'pending' && (
                    <div className="mwt-card-hint">
                      Waiting for workflow to reach this node...
                    </div>
                  )}

                  {state === 'completed' && (
                    <div className="mwt-card-completed-msg">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                      </svg>
                      Webhook fired successfully
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Batch fire */}
      {pausedNodes.length > 1 && (
        <button
          className="mwt-batch-btn"
          onClick={async () => { for (const node of pausedNodes) await handleFireWebhook(node); }}
          disabled={firingNodeId !== null}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
          Fire All Paused ({pausedNodes.length})
        </button>
      )}

      {/* Running status */}
      {isRunning && pausedNodes.length === 0 && (
        <div className="mwt-waiting">
          <span className="mwt-waiting-dot" />
          Waiting for workflow to pause at a CorrelationWait node...
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mwt-error">
          <span>{error}</span>
          <button onClick={() => setError(null)} aria-label="Dismiss error">×</button>
        </div>
      )}

      {/* Scenarios list */}
      {scenarios.length > 0 && (
        <div className="mwt-scenarios">
          <div className="mwt-scenarios-header">Saved Scenarios</div>
          {scenarios.map(scenario => (
            <div key={scenario.id} className="mwt-scenario-row">
              <span className="mwt-scenario-name">{scenario.name}</span>
              <div className="mwt-scenario-actions">
                <button className="mwt-btn mwt-btn-xs" onClick={() => handleLoadScenario(scenario)}>Load</button>
                {onDeleteScenario && (
                  <button className="mwt-btn mwt-btn-xs mwt-btn-danger" onClick={() => onDeleteScenario(scenario.id)}>×</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Save Scenario Modal */}
      {showScenarioModal && (
        <div className="mwt-modal-overlay" onClick={() => setShowScenarioModal(false)}>
          <div className="mwt-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mwt-modal-header">
              <h3>Save Webhook Scenario</h3>
              <button className="mwt-modal-close" onClick={() => setShowScenarioModal(false)}>×</button>
            </div>
            <div className="mwt-modal-body">
              <label className="mwt-modal-label">
                Scenario Name
                <input
                  type="text"
                  className="mwt-modal-input"
                  value={newScenarioName}
                  onChange={(e) => setNewScenarioName(e.target.value)}
                  placeholder="e.g., Happy Path, Error Case"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveScenario(); }}
                />
              </label>
              <p className="mwt-modal-hint">
                Saves the current payload for all {correlationNodes.length} webhook node{correlationNodes.length > 1 ? 's' : ''}.
              </p>
            </div>
            <div className="mwt-modal-footer">
              <button className="mwt-btn mwt-btn-secondary" onClick={() => setShowScenarioModal(false)}>Cancel</button>
              <button className="mwt-btn mwt-btn-primary" onClick={handleSaveScenario} disabled={!newScenarioName.trim()}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
