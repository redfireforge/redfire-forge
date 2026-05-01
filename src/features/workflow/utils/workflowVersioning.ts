import { v4 as uuidv4 } from 'uuid';
import type { WorkflowNode, WorkflowEdge, WorkflowService, WorkflowVersion } from '../types/workflow';

/** Default max versions kept per workflow (FIFO eviction). */
export const MAX_WORKFLOW_VERSIONS = 30;

/**
 * Compute a fingerprint of workflow content so duplicate saves don't create new versions.
 * Uses a deterministic JSON stringify of the relevant data.
 */
export function computeWorkflowFingerprint(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  variables: Record<string, string>,
  services?: WorkflowService[],
): string {
  const data = {
    nodes: nodes.map((n) => ({ id: n.id, type: n.type, position: n.position, data: n.data })),
    edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle, label: e.label })),
    variables,
    services: services?.map((s) => ({ id: s.id, name: s.name, endpoints: s.endpoints, defaultAuth: s.defaultAuth, microserviceId: s.microserviceId })) ?? [],
  };
  return simpleHash(JSON.stringify(data));
}

/**
 * Fast 53-bit hash (cyrb53) — not cryptographic, just for dedup fingerprinting.
 * @see https://github.com/bryc/code/blob/master/jshash/experimental/cyrb53.js
 */
function simpleHash(str: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/**
 * Create a new version snapshot from the current workflow state.
 * Returns null if the fingerprint matches the latest version (no changes).
 */
export function createWorkflowVersion(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  variables: Record<string, string>,
  services: WorkflowService[] | undefined,
  existingVersions: WorkflowVersion[],
  label?: string,
): WorkflowVersion | null {
  const fingerprint = computeWorkflowFingerprint(nodes, edges, variables, services);

  // Skip if fingerprint matches the latest version (no actual change)
  if (existingVersions.length > 0 && existingVersions[0].fingerprint === fingerprint) {
    return null;
  }

  return {
    id: uuidv4(),
    timestamp: Date.now(),
    label,
    fingerprint,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    nodes: structuredClone(nodes),
    edges: structuredClone(edges),
    variables: structuredClone(variables),
    services: services ? structuredClone(services) : undefined,
  };
}

/**
 * Add a version to the list, keeping newest-first order and capping at max.
 */
export function addVersionToList(
  versions: WorkflowVersion[],
  version: WorkflowVersion,
  max = MAX_WORKFLOW_VERSIONS,
): WorkflowVersion[] {
  const next = [version, ...versions];
  return next.length > max ? next.slice(0, max) : next;
}

/**
 * Generate a human-readable change summary comparing two versions.
 */
export function generateChangeSummary(
  older: Pick<WorkflowVersion, 'nodeCount' | 'edgeCount' | 'nodes' | 'edges' | 'variables'>,
  newer: Pick<WorkflowVersion, 'nodeCount' | 'edgeCount' | 'nodes' | 'edges' | 'variables'>,
): string {
  const parts: string[] = [];

  const nodeDiff = newer.nodeCount - older.nodeCount;
  if (nodeDiff > 0) parts.push(`${nodeDiff} node${nodeDiff > 1 ? 's' : ''} added`);
  else if (nodeDiff < 0) parts.push(`${Math.abs(nodeDiff)} node${Math.abs(nodeDiff) > 1 ? 's' : ''} removed`);

  const edgeDiff = newer.edgeCount - older.edgeCount;
  if (edgeDiff > 0) parts.push(`${edgeDiff} edge${edgeDiff > 1 ? 's' : ''} added`);
  else if (edgeDiff < 0) parts.push(`${Math.abs(edgeDiff)} edge${Math.abs(edgeDiff) > 1 ? 's' : ''} removed`);

  const oldVarKeys = Object.keys(older.variables);
  const newVarKeys = Object.keys(newer.variables);
  const addedVars = newVarKeys.filter((k) => !oldVarKeys.includes(k)).length;
  const removedVars = oldVarKeys.filter((k) => !newVarKeys.includes(k)).length;
  const changedVars = oldVarKeys.filter((k) => newVarKeys.includes(k) && older.variables[k] !== newer.variables[k]).length;

  if (addedVars > 0) parts.push(`${addedVars} var${addedVars > 1 ? 's' : ''} added`);
  if (removedVars > 0) parts.push(`${removedVars} var${removedVars > 1 ? 's' : ''} removed`);
  if (changedVars > 0) parts.push(`${changedVars} var${changedVars > 1 ? 's' : ''} changed`);

  // Check for node config changes (same node count but different content)
  if (nodeDiff === 0 && newer.nodeCount > 0) {
    const olderNodeMap = new Map(older.nodes.map((n) => [n.id, n]));
    let configChanges = 0;
    for (const n of newer.nodes) {
      const old = olderNodeMap.get(n.id);
      if (old && JSON.stringify(old.data) !== JSON.stringify(n.data)) configChanges++;
    }
    if (configChanges > 0) parts.push(`${configChanges} node${configChanges > 1 ? 's' : ''} modified`);
  }

  return parts.length > 0 ? parts.join(', ') : 'No structural changes';
}

/**
 * Compute detailed diff between two versions for the diff viewer.
 */
export interface VersionDiffResult {
  addedNodes: WorkflowNode[];
  removedNodes: WorkflowNode[];
  modifiedNodes: Array<{ id: string; label: string; old: WorkflowNode; new: WorkflowNode }>;
  addedEdges: WorkflowEdge[];
  removedEdges: WorkflowEdge[];
  variableChanges: {
    added: Array<{ key: string; value: string }>;
    removed: Array<{ key: string; value: string }>;
    modified: Array<{ key: string; oldValue: string; newValue: string }>;
  };
  serviceChanges: {
    added: WorkflowService[];
    removed: WorkflowService[];
    modified: Array<{ id: string; name: string; old: WorkflowService; new: WorkflowService }>;
  };
}

export function computeVersionDiff(older: WorkflowVersion, newer: WorkflowVersion): VersionDiffResult {
  // Nodes
  const olderNodeMap = new Map(older.nodes.map((n) => [n.id, n]));
  const newerNodeMap = new Map(newer.nodes.map((n) => [n.id, n]));

  const addedNodes = newer.nodes.filter((n) => !olderNodeMap.has(n.id));
  const removedNodes = older.nodes.filter((n) => !newerNodeMap.has(n.id));
  const modifiedNodes: VersionDiffResult['modifiedNodes'] = [];
  for (const n of newer.nodes) {
    const old = olderNodeMap.get(n.id);
    if (old && JSON.stringify(old) !== JSON.stringify(n)) {
      modifiedNodes.push({
        id: n.id,
        label: (n.data as { label?: string }).label ?? n.id,
        old,
        new: n,
      });
    }
  }

  // Edges
  const olderEdgeIds = new Set(older.edges.map((e) => e.id));
  const newerEdgeIds = new Set(newer.edges.map((e) => e.id));
  const addedEdges = newer.edges.filter((e) => !olderEdgeIds.has(e.id));
  const removedEdges = older.edges.filter((e) => !newerEdgeIds.has(e.id));

  // Variables
  const addedVars: VersionDiffResult['variableChanges']['added'] = [];
  const removedVars: VersionDiffResult['variableChanges']['removed'] = [];
  const modifiedVars: VersionDiffResult['variableChanges']['modified'] = [];
  for (const [k, v] of Object.entries(newer.variables)) {
    if (!(k in older.variables)) addedVars.push({ key: k, value: v });
    else if (older.variables[k] !== v) modifiedVars.push({ key: k, oldValue: older.variables[k], newValue: v });
  }
  for (const [k, v] of Object.entries(older.variables)) {
    if (!(k in newer.variables)) removedVars.push({ key: k, value: v });
  }

  // Services
  const olderSvcs = older.services ?? [];
  const newerSvcs = newer.services ?? [];
  const olderSvcMap = new Map(olderSvcs.map((s) => [s.id, s]));
  const newerSvcMap = new Map(newerSvcs.map((s) => [s.id, s]));

  const addedServices = newerSvcs.filter((s) => !olderSvcMap.has(s.id));
  const removedServices = olderSvcs.filter((s) => !newerSvcMap.has(s.id));
  const modifiedServices: VersionDiffResult['serviceChanges']['modified'] = [];
  for (const s of newerSvcs) {
    const old = olderSvcMap.get(s.id);
    if (old && JSON.stringify(old) !== JSON.stringify(s)) {
      modifiedServices.push({ id: s.id, name: s.name, old, new: s });
    }
  }

  return {
    addedNodes,
    removedNodes,
    modifiedNodes,
    addedEdges,
    removedEdges,
    variableChanges: { added: addedVars, removed: removedVars, modified: modifiedVars },
    serviceChanges: { added: addedServices, removed: removedServices, modified: modifiedServices },
  };
}

/**
 * Strip version history from workflow(s) for export.
 */
export function stripWorkflowVersions<T extends { versions?: WorkflowVersion[] }>(wf: T): Omit<T, 'versions'> {
  const { versions: _, ...rest } = wf;
  return rest;
}

/**
 * Count versions in a workflow.
 */
export function countWorkflowVersions(wf: { versions?: WorkflowVersion[] }): number {
  return wf.versions?.length ?? 0;
}
