import type { HttpNodeData, WorkflowEdge, WorkflowNode, SetVariableNodeData, AggregateNodeData, LoopNodeData, WaitForConditionNodeData, StartNodeData, ErrorHandlerNodeData, ScriptNodeData, KafkaProduceNodeData, KafkaConsumeNodeData, KafkaTriggerNodeData, KafkaWaitNodeData, WsConnectNodeData, WsSendNodeData, WsReceiveNodeData, WsTriggerNodeData } from '../types/workflow';

/** Category for grouping sources in the Insert Variable modal. */
export type VariableSourceCategory = 'Workflow' | 'Triggers' | 'HTTP Steps' | 'Logic' | 'Integrations' | 'Data';

/** Source metadata: which node (or workflow-level) produced this variable. */
export interface WorkflowVariableHintSource {
  nodeId?: string;
  nodeLabel: string;
  nodeType: string;
  category: VariableSourceCategory;
}

/** Node-type → icon + category mapping for the Insert Variable modal. */
export const NODE_TYPE_DISPLAY: Record<string, { icon: string; category: VariableSourceCategory }> = {
  workflow:          { icon: '⚡', category: 'Workflow' },
  start:             { icon: '▶',  category: 'Triggers' },
  webhook:           { icon: '🔔', category: 'Triggers' },
  schedule:          { icon: '📅', category: 'Triggers' },
  http:              { icon: '↗',  category: 'HTTP Steps' },
  condition:         { icon: '◇',  category: 'Logic' },
  switch:            { icon: '⑃',  category: 'Logic' },
  loop:              { icon: '↻',  category: 'Logic' },
  waitForCondition:  { icon: '⏳', category: 'Logic' },
  setVariable:       { icon: '⊕',  category: 'Logic' },
  aggregate:         { icon: 'Σ',  category: 'Logic' },
  delay:             { icon: '⏸',  category: 'Logic' },
  errorHandler:      { icon: '⚠',  category: 'Logic' },
  logDebug:          { icon: '📝', category: 'Logic' },
  script:            { icon: '⟨/⟩', category: 'Data' },
  correlationWait:   { icon: '🔗', category: 'Integrations' },
  kafkaProduce:      { icon: '⇢',  category: 'Integrations' },
  kafkaConsume:      { icon: '⇠',  category: 'Integrations' },
  kafkaTrigger:      { icon: '⚡', category: 'Triggers' },
  kafkaWait:         { icon: '⏸', category: 'Integrations' },
  wsConnect:         { icon: '⇌',  category: 'Integrations' },
  wsSend:            { icon: '⇢',  category: 'Integrations' },
  wsReceive:         { icon: '⇠',  category: 'Integrations' },
  wsTrigger:         { icon: '⚡', category: 'Triggers' },
  fork:              { icon: '⑂',  category: 'Logic' },
  join:              { icon: '⑂',  category: 'Logic' },
  end:               { icon: '⏹',  category: 'Logic' },
};

/** Dropdown entry: `ref` is the inner template key (no `{{ }}`), e.g. `channel` or `node:<id>.channel`. */
export interface WorkflowVariableHint {
  ref: string;
  label: string;
  /** Short human-readable description shown on hover in the Insert Variable modal. */
  description?: string;
  /** Data type hint, e.g. "string", "number", "boolean". */
  type?: string;
  /** Source node metadata — used for grouping and display in the Insert Variable modal. */
  source?: WorkflowVariableHintSource;
  /** Default value (for display in the detail pane). */
  defaultValue?: string;
}

/** All nodes that can execute before `nodeId` (reverse walk along incoming edges). */
export function collectAncestorNodeIds(edges: WorkflowEdge[], nodeId: string): Set<string> {
  const incoming = new Map<string, string[]>();
  for (const e of edges) {
    if (!incoming.has(e.target)) incoming.set(e.target, []);
    incoming.get(e.target)!.push(e.source);
  }
  const seen = new Set<string>();
  const stack = [...(incoming.get(nodeId) ?? [])];
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const p of incoming.get(id) ?? []) stack.push(p);
  }
  return seen;
}

/** Human-readable step title for hints, scoped refs, and label resolution. */
export function httpStepDisplayLabel(data: HttpNodeData): string {
  const d = data.label?.trim();
  if (d) return d;
  const n = data.scenario?.name?.trim();
  if (n) return n;
  return 'HTTP';
}

function stepLabel(data: HttpNodeData): string {
  return httpStepDisplayLabel(data);
}

const NON_HTTP_TYPES = new Set([
  'start', 'webhook', 'schedule', 'condition', 'delay', 'fork', 'join',
  'switch', 'loop', 'setVariable', 'script', 'aggregate', 'logDebug',
  'waitForCondition', 'correlationWait', 'errorHandler', 'subWorkflow', 'end',
  'kafkaProduce', 'kafkaConsume', 'kafkaTrigger', 'kafkaWait',
  'wsConnect', 'wsSend', 'wsReceive', 'wsTrigger',
]);

/** True if this canvas node is an HTTP step (React Flow may omit `type` in edge cases). */
export function isHttpWorkflowNode(n: { type?: string; data?: unknown }): n is { type: string; data: HttpNodeData } {
  if (n.type === 'http') return true;
  if (n.type && NON_HTTP_TYPES.has(n.type)) return false;
  return n.data != null && typeof n.data === 'object' && 'scenario' in (n.data as object);
}

/**
 * Scoped template inner ref: `node:"Step label".var` (readable) or `node:<uuid>.var` (legacy / fallback).
 */
export function formatNodeScopedRef(nodeId: string, stepLabel: string, varName: string): string {
  const safe = stepLabel.trim();
  if (!safe || safe.includes('"') || safe.includes('\n')) return `node:${nodeId}.${varName}`;
  return `node:"${safe}".${varName}`;
}

/** Guess the data type from a default value string. */
export function guessValueType(val: string): string {
  if (val === 'true' || val === 'false') return 'boolean';
  if (val !== '' && !isNaN(Number(val))) return 'number';
  return 'string';
}

/** Human description for aggregate strategies. */
function aggregateStrategyDescription(s: string): string {
  switch (s) {
    case 'concat': return 'Append each value into a JSON array';
    case 'first': return 'Keep the first value encountered';
    case 'last': return 'Keep the last value encountered';
    case 'count': return 'Count the number of occurrences';
    case 'sum': return 'Sum all numeric values';
    case 'custom': return 'Custom expression';
    default: return s;
  }
}

/** Infer result type for aggregate strategies. */
function aggregateStrategyType(s: string): string {
  switch (s) {
    case 'concat': return 'array';
    case 'count': return 'number';
    case 'sum': return 'number';
    default: return 'string';
  }
}

/**
 * Build picker hints from workflow-level default variables.
 * Used by WorkflowConfigPanel and WorkflowNodeConfigModal to provide Insert Variable hints.
 */
export function buildWorkflowOnlyHints(workflowVariables: Record<string, string>): WorkflowVariableHint[] {
  const wfSource: WorkflowVariableHintSource = { nodeLabel: 'Workflow Defaults', nodeType: 'workflow', category: 'Workflow' };
  return Object.keys(workflowVariables)
    .filter((k) => k.trim().length > 0)
    .sort((a, b) => a.localeCompare(b))
    .map((k) => {
      const t = k.trim();
      const val = workflowVariables[t];
      return { ref: t, label: `${t} (workflow)`, description: `Workflow default variable. Default: "${val}"`, type: guessValueType(val), source: wfSource, defaultValue: val };
    });
}

export function mergeWorkflowVariableHints(primaryHints: WorkflowVariableHint[], workflowHints: WorkflowVariableHint[]): WorkflowVariableHint[] {
  if (primaryHints.length === 0) return workflowHints;

  const byRef = new Map<string, WorkflowVariableHint>(primaryHints.map((hint) => [hint.ref, hint]));
  for (const hint of workflowHints) {
    if (!byRef.has(hint.ref)) byRef.set(hint.ref, hint);
  }
  return Array.from(byRef.values()).sort((a, b) => a.ref.localeCompare(b.ref));
}

export function buildConfigVariableInsertHints({
  node,
  workflowVariables,
  httpVariableHints = [],
  conditionVariableHints = [],
}: {
  node: WorkflowNode | null;
  workflowVariables: Record<string, string>;
  httpVariableHints?: WorkflowVariableHint[];
  conditionVariableHints?: WorkflowVariableHint[];
}): WorkflowVariableHint[] {
  const workflowHints = buildWorkflowOnlyHints(workflowVariables);

  if (!node || !isHttpWorkflowNode(node)) {
    return mergeWorkflowVariableHints(conditionVariableHints, workflowHints);
  }

  const httpHints = mergeHttpVariableHintsWithStepInitialVars(httpVariableHints, node.data as HttpNodeData);
  return mergeWorkflowVariableHints(httpHints, workflowHints);
}

/** Collect variable hints for a condition node. */
export function collectConditionVariableHints(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  conditionNodeId: string,
  workflowVariables: Record<string, string>,
): WorkflowVariableHint[] {
  const ancestors = collectAncestorNodeIds(edges, conditionNodeId);
  const out: WorkflowVariableHint[] = [];
  const seen = new Set<string>();

  const push = (ref: string, label: string, description?: string, type?: string, source?: WorkflowVariableHintSource, defaultValue?: string) => {
    if (seen.has(ref)) return;
    seen.add(ref);
    out.push({ ref, label, description, type, source, defaultValue });
  };

  const wfSource: WorkflowVariableHintSource = { nodeLabel: 'Workflow Defaults', nodeType: 'workflow', category: 'Workflow' };

  /** Must run before workflow keys so duplicate names prefer "(this step)" over "(workflow)". */
  const selfNode = nodes.find((n) => n.id === conditionNodeId);
  if (selfNode && isHttpWorkflowNode(selfNode)) {
    const data = selfNode.data as HttpNodeData;
    const selfLabel = stepLabel(data);
    const selfSource: WorkflowVariableHintSource = { nodeId: conditionNodeId, nodeLabel: selfLabel, nodeType: 'http', category: 'HTTP Steps' };
    for (const k of Object.keys(data.initialVariables ?? {})) {
      if (!k.trim()) continue;
      const kt = k.trim();
      const val = (data.initialVariables ?? {})[k];
      push(kt, `${kt} (this step)`, `Initial variable on this step. Default: "${val}"`, guessValueType(val), selfSource, val);
    }
  }

  for (const k of Object.keys(workflowVariables)) {
    if (k.trim().length > 0) {
      const val = workflowVariables[k];
      push(k.trim(), `${k.trim()} (workflow)`, `Workflow default variable. Default: "${val}"`, guessValueType(val), wfSource, val);
    }
  }

  let hasHttpAncestor = false;
  for (const n of nodes) {
    if (!isHttpWorkflowNode(n) || !ancestors.has(n.id)) continue;
    hasHttpAncestor = true;
    const data = n.data as HttpNodeData;
    if (!data.scenario) continue;
    const label = stepLabel(data);
    const httpSource: WorkflowVariableHintSource = { nodeId: n.id, nodeLabel: label, nodeType: 'http', category: 'HTTP Steps' };

    for (const k of Object.keys(data.initialVariables ?? {})) {
      if (!k.trim()) continue;
      const kt = k.trim();
      const val = (data.initialVariables ?? {})[k];
      push(kt, `${kt} (latest)`, `Initial variable from "${label}". Default: "${val}"`, guessValueType(val), httpSource, val);
      push(formatNodeScopedRef(n.id, label, kt), `${kt} ← "${label}" (scoped)`, `Scoped reference to initial variable on "${label}"`, guessValueType(val), httpSource, val);
    }
    for (const ex of data.scenario.extractions ?? []) {
      const nm = ex.name?.trim();
      if (nm) {
        const desc = `Extracted from ${ex.source} of "${label}" using ${ex.expression || 'expression'}`;
        push(nm, `${nm} (latest)`, desc, 'string', httpSource);
        push(formatNodeScopedRef(n.id, label, nm), `${nm} ← "${label}" (scoped)`, `Scoped: ${desc}`, 'string', httpSource);
      }
    }
  }

  if (hasHttpAncestor) {
    push('status', 'status (latest)', 'HTTP response status code of the last executed step', 'number');
    push('httpStatus', 'httpStatus (latest)', 'HTTP response status code of the last executed step (always set)', 'number');
    for (const n of nodes) {
      if (!isHttpWorkflowNode(n) || !ancestors.has(n.id)) continue;
      const data = n.data as HttpNodeData;
      const label = stepLabel(data);
      const httpSource: WorkflowVariableHintSource = { nodeId: n.id, nodeLabel: label, nodeType: 'http', category: 'HTTP Steps' };
      push(formatNodeScopedRef(n.id, label, 'status'), `status ← "${label}" (scoped)`, `HTTP response status code from "${label}". e.g. 200, 404`, 'number', httpSource);
      push(formatNodeScopedRef(n.id, label, 'httpStatus'), `httpStatus ← "${label}" (scoped)`, `HTTP response status code from "${label}". e.g. 200, 404`, 'number', httpSource);
    }
  }

  // ── Non-HTTP ancestor outputs ──
  for (const n of nodes) {
    if (!ancestors.has(n.id)) continue;

    if (n.type === 'setVariable') {
      const data = n.data as SetVariableNodeData;
      const label = data.label?.trim() || 'Set Variable';
      const svSource: WorkflowVariableHintSource = { nodeId: n.id, nodeLabel: label, nodeType: 'setVariable', category: 'Logic' };
      for (const a of data.assignments ?? []) {
        const nm = a.name?.trim();
        if (nm) push(nm, `${nm} ← "${label}"`, `Set by "${label}" node. Expression: ${a.expression || '(empty)'}`, 'string', svSource);
      }
    } else if (n.type === 'script') {
      const data = n.data as ScriptNodeData;
      const label = data.label?.trim() || 'Script';
      const scriptSource: WorkflowVariableHintSource = { nodeId: n.id, nodeLabel: label, nodeType: 'script', category: 'Data' };
      for (const ov of data.outputVariables ?? []) {
        const nm = ov?.trim();
        if (nm) push(nm, `${nm} ← "${label}"`, `Output variable from script "${label}"`, 'string', scriptSource);
      }
    } else if (n.type === 'aggregate') {
      const data = n.data as AggregateNodeData;
      const label = data.label?.trim() || 'Aggregate';
      const aggSource: WorkflowVariableHintSource = { nodeId: n.id, nodeLabel: label, nodeType: 'aggregate', category: 'Logic' };
      for (const m of data.mappings ?? []) {
        const nm = m.targetVariable?.trim();
        if (nm) {
          const stratDesc = aggregateStrategyDescription(m.strategy);
          push(nm, `${nm} ← "${label}"`, `Aggregated by "${label}". Strategy: ${stratDesc}`, aggregateStrategyType(m.strategy), aggSource);
        }
      }
    } else if (n.type === 'loop') {
      const data = n.data as LoopNodeData;
      const label = data.label?.trim() || 'Loop';
      const loopSource: WorkflowVariableHintSource = { nodeId: n.id, nodeLabel: label, nodeType: 'loop', category: 'Logic' };
      const item = data.itemVariable?.trim() || 'item';
      const idx = data.indexVariable?.trim() || 'i';
      if (data.mode === 'forEach') {
        push(item, `${item} ← "${label}" (current item)`, `Current element in each iteration of "${label}"`, 'any', loopSource);
      }
      push(idx, `${idx} ← "${label}" (index)`, `0-based iteration index of "${label}"`, 'number', loopSource);
    } else if (n.type === 'waitForCondition') {
      const data = n.data as WaitForConditionNodeData;
      const label = data.label?.trim() || 'Wait';
      const waitSource: WorkflowVariableHintSource = { nodeId: n.id, nodeLabel: label, nodeType: 'waitForCondition', category: 'Logic' };
      push('wait.attempts', `wait.attempts ← "${label}"`, `Number of poll iterations completed by "${label}"`, 'number', waitSource);
      push('wait.elapsed', `wait.elapsed ← "${label}"`, `Total polling time in milliseconds for "${label}"`, 'number', waitSource);
      push('wait.conditionMet', `wait.conditionMet ← "${label}"`, `Whether the poll condition was satisfied. Returns "true" or "false"`, 'boolean', waitSource);
    } else if (n.type === 'errorHandler') {
      const data = n.data as ErrorHandlerNodeData;
      const label = data.label?.trim() || 'Error Handler';
      const errSource: WorkflowVariableHintSource = { nodeId: n.id, nodeLabel: label, nodeType: 'errorHandler', category: 'Logic' };
      push('error.message', `error.message ← "${label}"`, `Error message from failed step in "${label}"`, 'string', errSource);
      push('error.statusCode', `error.statusCode ← "${label}"`, `HTTP status code of the failed request (e.g. 500, 0 for network error)`, 'number', errSource);
      push('error.nodeId', `error.nodeId ← "${label}"`, `Node ID of the step that failed inside "${label}"`, 'string', errSource);
      push('error.nodeLabel', `error.nodeLabel ← "${label}"`, `Label of the step that failed inside "${label}"`, 'string', errSource);
      push('error.retryCount', `error.retryCount ← "${label}"`, `Number of retry attempts before the error handler gave up`, 'number', errSource);
      push('error.type', `error.type ← "${label}"`, `Error classification: "http-error", "network-error", or "assertion-failure"`, 'string', errSource);
    } else if (n.type === 'start') {
      const data = n.data as StartNodeData;
      const label = data.label?.trim() || 'Start';
      const startSource: WorkflowVariableHintSource = { nodeId: n.id, nodeLabel: label, nodeType: 'start', category: 'Triggers' };
      for (const k of Object.keys(data.inputVariables ?? {})) {
        const kt = k.trim();
        if (!kt) continue;
        const val = (data.inputVariables ?? {})[k];
        push(kt, `${kt} ← "${label}" (trigger input)`, `Trigger input variable from "${label}" node. Default: "${val}"`, guessValueType(val), startSource, val);
      }
    } else if (n.type === 'kafkaProduce') {
      const data = n.data as KafkaProduceNodeData;
      const label = data.label?.trim() || 'Kafka Produce';
      const kafkaSource: WorkflowVariableHintSource = { nodeId: n.id, nodeLabel: label, nodeType: 'kafkaProduce', category: 'Integrations' };
      for (const b of data.outputBindings ?? []) {
        const nm = b.targetVariable?.trim();
        if (nm && b.enabled) {
          push(nm, `${nm} ← "${label}" (${b.source})`, `Kafka produce metadata (${b.source}) from "${label}"`, 'string', kafkaSource);
        }
      }
    } else if (n.type === 'kafkaConsume') {
      const data = n.data as KafkaConsumeNodeData;
      const label = data.label?.trim() || 'Kafka Consume';
      const kafkaSource: WorkflowVariableHintSource = { nodeId: n.id, nodeLabel: label, nodeType: 'kafkaConsume', category: 'Integrations' };
      for (const b of data.outputBindings ?? []) {
        const nm = b.targetVariable?.trim();
        if (nm && b.enabled) {
          push(nm, `${nm} ← "${label}" (${b.source})`, `Kafka consume metadata (${b.source}) from "${label}"`, 'string', kafkaSource);
        }
      }
    } else if (n.type === 'kafkaTrigger') {
      const data = n.data as KafkaTriggerNodeData;
      const label = data.label?.trim() || 'Kafka Trigger';
      const triggerSource: WorkflowVariableHintSource = { nodeId: n.id, nodeLabel: label, nodeType: 'kafkaTrigger', category: 'Triggers' };
      // Standard kafka.trigger.* context variables seeded from the triggering message
      const triggerKeys = [
        { ref: 'kafka.trigger.topic',     desc: 'Topic the triggering message was consumed from' },
        { ref: 'kafka.trigger.partition', desc: 'Partition the triggering message was in' },
        { ref: 'kafka.trigger.offset',    desc: 'Offset of the triggering message in its partition' },
        { ref: 'kafka.trigger.key',       desc: 'Message key of the triggering message (may be empty)' },
        { ref: 'kafka.trigger.value',     desc: 'Full message value (body) of the triggering message' },
      ];
      for (const { ref, desc } of triggerKeys) {
        push(ref, `${ref} ← "${label}"`, desc, 'string', triggerSource);
      }
      // User-defined extract variables from message body
      for (const ev of data.extractVariables ?? []) {
        const nm = ev.name?.trim();
        if (nm) {
          push(nm, `${nm} ← "${label}" (extracted)`, `Variable extracted from Kafka trigger message via JSONPath "${ev.jsonPath}"`, 'string', triggerSource);
        }
      }
    } else if (n.type === 'kafkaWait') {
      const data = n.data as KafkaWaitNodeData;
      const label = data.label?.trim() || 'Kafka Wait';
      const waitSource: WorkflowVariableHintSource = { nodeId: n.id, nodeLabel: label, nodeType: 'kafkaWait', category: 'Integrations' };
      // Standard kafka.wait.* context variables seeded on resume
      const waitKeys = [
        { ref: 'kafka.wait.topic',     desc: 'Topic the correlation message was consumed from' },
        { ref: 'kafka.wait.partition', desc: 'Partition the correlation message was in' },
        { ref: 'kafka.wait.offset',    desc: 'Offset of the correlation message in its partition' },
        { ref: 'kafka.wait.key',       desc: 'Message key of the correlation message (may be empty)' },
        { ref: 'kafka.wait.value',     desc: 'Full message value (body) of the correlation message' },
      ];
      for (const { ref, desc } of waitKeys) {
        push(ref, `${ref} ← "${label}"`, desc, 'string', waitSource);
      }
      // User-defined extract variables
      for (const ev of data.extractVariables ?? []) {
        const nm = ev.name?.trim();
        if (nm) {
          push(nm, `${nm} ← "${label}" (extracted)`, `Variable extracted from Kafka wait message via JSONPath "${ev.jsonPath}"`, 'string', waitSource);
        }
      }
    } else if (n.type === 'wsConnect') {
      const data = n.data as WsConnectNodeData;
      const label = data.label?.trim() || 'WS Connect';
      const wsSource: WorkflowVariableHintSource = { nodeId: n.id, nodeLabel: label, nodeType: 'wsConnect', category: 'Integrations' };
      for (const b of data.outputBindings ?? []) {
        const nm = b.variableName?.trim();
        if (nm && b.enabled) {
          push(nm, `${nm} ← "${label}" (${b.field})`, `WebSocket connection metadata (${b.field}) from "${label}"`, 'string', wsSource);
        }
      }
    } else if (n.type === 'wsSend') {
      const data = n.data as WsSendNodeData;
      const label = data.label?.trim() || 'WS Send';
      const wsSource: WorkflowVariableHintSource = { nodeId: n.id, nodeLabel: label, nodeType: 'wsSend', category: 'Integrations' };
      if (data.waitForResponse) {
        for (const b of data.outputBindings ?? []) {
          const nm = b.variableName?.trim();
          if (nm && b.enabled) {
            push(nm, `${nm} ← "${label}" (${b.field})`, `WebSocket send metadata (${b.field}) from "${label}"`, 'string', wsSource);
          }
        }
      }
    } else if (n.type === 'wsReceive') {
      const data = n.data as WsReceiveNodeData;
      const label = data.label?.trim() || 'WS Receive';
      const wsSource: WorkflowVariableHintSource = { nodeId: n.id, nodeLabel: label, nodeType: 'wsReceive', category: 'Integrations' };
      for (const b of data.outputBindings ?? []) {
        const nm = b.variableName?.trim();
        if (nm && b.enabled) {
          push(nm, `${nm} ← "${label}" (${b.field})`, `WebSocket received message metadata (${b.field}) from "${label}"`, 'string', wsSource);
        }
      }
      for (const er of data.extractionRules ?? []) {
        const nm = er.variableName?.trim();
        if (nm) {
          push(nm, `${nm} ← "${label}" (extracted)`, `Variable extracted from WebSocket message via JSONPath "${er.jsonPath}"`, 'string', wsSource);
        }
      }
    } else if (n.type === 'wsTrigger') {
      const data = n.data as WsTriggerNodeData;
      const label = data.label?.trim() || 'WS Trigger';
      const triggerSource: WorkflowVariableHintSource = { nodeId: n.id, nodeLabel: label, nodeType: 'wsTrigger', category: 'Triggers' };
      const triggerKeys = [
        { ref: 'ws.trigger.message',      desc: 'Full message body of the triggering WebSocket frame' },
        { ref: 'ws.trigger.messageType',  desc: 'Frame type of the triggering message (text or binary)' },
        { ref: 'ws.trigger.url',          desc: 'WebSocket URL the trigger is listening on' },
        { ref: 'ws.trigger.connectionId', desc: 'Connection ID from the triggering WebSocket message' },
      ];
      for (const { ref, desc } of triggerKeys) {
        push(ref, `${ref} ← "${label}"`, desc, 'string', triggerSource);
      }
      for (const er of data.extractionRules ?? []) {
        const nm = er.variableName?.trim();
        if (nm) {
          push(nm, `${nm} ← "${label}" (extracted)`, `Variable extracted from WebSocket trigger message via JSONPath "${er.jsonPath}"`, 'string', triggerSource);
        }
      }
    }
  }

  out.sort((a, b) => a.ref.localeCompare(b.ref));
  return out;
}

/**
 * Ensures names from the selected HTTP step’s `initialVariables` appear in the Insert picker even if
 * graph state used for {@link collectConditionVariableHints} is briefly out of sync with the panel.
 */
export function mergeHttpVariableHintsWithStepInitialVars(
  hints: WorkflowVariableHint[],
  httpData: HttpNodeData,
): WorkflowVariableHint[] {
  const byRef = new Map<string, WorkflowVariableHint>(hints.map((h) => [h.ref, h]));
  const selfLabel = httpStepDisplayLabel(httpData);
  const selfSource: WorkflowVariableHintSource = { nodeLabel: selfLabel, nodeType: 'http', category: 'HTTP Steps' };
  for (const k of Object.keys(httpData.initialVariables ?? {})) {
    const kt = k.trim();
    if (!kt) continue;
    if (!byRef.has(kt)) {
      const val = (httpData.initialVariables ?? {})[k];
      byRef.set(kt, { ref: kt, label: `${kt} (this step)`, description: `Initial variable on this step. Default: "${val}"`, type: guessValueType(val), source: selfSource, defaultValue: val });
    }
  }
  return Array.from(byRef.values()).sort((a, b) => a.ref.localeCompare(b.ref));
}

function hintRefSet(hints: WorkflowVariableHint[] | string[]): Set<string> {
  if (hints.length === 0) return new Set();
  if (typeof hints[0] === 'string') return new Set(hints as string[]);
  return new Set((hints as WorkflowVariableHint[]).map((h) => h.ref));
}

/** `{{name}}` placeholders excluding built-in generators (`{{$uuid}}`, …). */
export function parseNonGeneratorRefs(template: string): string[] {
  const refs: string[] = [];
  template.replace(/\{\{([^}]+)\}\}/g, (_m, inner: string) => {
    const t = inner.trim();
    if (t && !t.startsWith('$')) refs.push(t);
    return '';
  });
  return refs;
}

/**
 * If `left` is a single non-generator placeholder only, return its inner name; otherwise null.
 */
export function parseSingleVariableRef(left: string): string | null {
  const t = left.trim();
  const m = t.match(/^\{\{\s*([^}]+?)\s*\}\}$/);
  if (!m) return null;
  const inner = m[1].trim();
  if (inner.startsWith('$')) return null;
  return inner;
}

export function validateConditionLeftRefs(
  left: string,
  hints: WorkflowVariableHint[] | string[],
): { ok: boolean; unknown: string[] } {
  const refs = parseNonGeneratorRefs(left);
  const hintSet = hintRefSet(hints);
  const unknown = refs.filter((r) => !hintSet.has(r));
  return { ok: unknown.length === 0, unknown };
}

export function guessConditionLeftMode(left: string): 'pick' | 'expr' {
  return parseSingleVariableRef(left) !== null ? 'pick' : 'expr';
}

/**
 * Collect node IDs reachable from a specific node + source handle (forward walk).
 * Used to find the poll-body subgraph of a WaitForCondition node.
 */
export function collectDescendantNodeIds(
  edges: WorkflowEdge[],
  nodeId: string,
  sourceHandle?: string,
): Set<string> {
  const outgoing = new Map<string, string[]>();
  // Seed with edges from nodeId matching the specified sourceHandle
  const seedTargets: string[] = [];
  for (const e of edges) {
    if (e.source === nodeId && (sourceHandle === undefined || e.sourceHandle === sourceHandle)) {
      seedTargets.push(e.target);
    }
    // Build general outgoing map for forward walk
    if (!outgoing.has(e.source)) outgoing.set(e.source, []);
    outgoing.get(e.source)!.push(e.target);
  }
  const seen = new Set<string>();
  const stack = [...seedTargets];
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id) || id === nodeId) continue; // don't loop back
    seen.add(id);
    for (const t of outgoing.get(id) ?? []) stack.push(t);
  }
  return seen;
}

/**
 * Variable hints for a WaitForCondition node:
 * ancestors (same as condition) PLUS variables extracted by nodes in the poll-body subgraph.
 */
export function collectWaitForConditionVariableHints(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  waitNodeId: string,
  workflowVariables: Record<string, string>,
): WorkflowVariableHint[] {
  // Start with ancestor hints (same as condition node)
  const base = collectConditionVariableHints(nodes, edges, waitNodeId, workflowVariables);
  const seen = new Set(base.map(h => h.ref));

  const push = (ref: string, label: string, description?: string, type?: string, source?: WorkflowVariableHintSource) => {
    if (seen.has(ref)) return;
    seen.add(ref);
    base.push({ ref, label, description, type, source });
  };

  // Collect nodes reachable from the "body" (poll) handle
  const bodyDescendants = collectDescendantNodeIds(edges, waitNodeId, 'body');

  for (const n of nodes) {
    if (!bodyDescendants.has(n.id) || !isHttpWorkflowNode(n)) continue;
    const data = n.data as HttpNodeData;
    if (!data.scenario) continue;
    const label = httpStepDisplayLabel(data);
    const httpSource: WorkflowVariableHintSource = { nodeId: n.id, nodeLabel: label, nodeType: 'http', category: 'HTTP Steps' };

    for (const ex of data.scenario.extractions ?? []) {
      const nm = ex.name?.trim();
      if (nm) {
        push(nm, `${nm} ← "${label}" (poll body)`, `Extracted from ${ex.source} of "${label}" during polling`, 'string', httpSource);
      }
    }
    for (const k of Object.keys(data.initialVariables ?? {})) {
      const kt = k.trim();
      if (kt) {
        const val = (data.initialVariables ?? {})[k];
        push(kt, `${kt} ← "${label}" (poll body)`, `Initial variable from "${label}" in poll body. Default: "${val}"`, guessValueType(val), httpSource);
      }
    }
  }

  // Add built-in wait variables
  push('wait.attempts', 'wait.attempts (built-in)', 'Number of poll iterations completed', 'number');
  push('wait.elapsed', 'wait.elapsed (built-in)', 'Total polling time in milliseconds', 'number');
  push('wait.conditionMet', 'wait.conditionMet (built-in)', 'Whether the poll condition was satisfied. Returns "true" or "false"', 'boolean');

  base.sort((a, b) => a.ref.localeCompare(b.ref));
  return base;
}
