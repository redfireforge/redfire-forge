/**
 * HAR-to-Workflow converter (Track A — L-10, Phase 2).
 *
 * Converts ParsedHarEntry[] (from harParser.ts) into a set of workflow nodes,
 * edges, and variables that can be injected directly into an existing Workflow
 * via useWorkflows().update().
 *
 * Design decisions:
 * - One Start node + one HTTP node per entry, connected sequentially.
 * - When all entries share the same host, the host is extracted into a
 *   {{baseUrl}} workflow variable and all node URLs are parameterized.
 * - When entries span multiple hosts, full URLs are preserved as-is.
 * - Query params stay in the URL (not promoted to workflow variables); they are
 *   preserved in the URL string so the user can parameterize them manually.
 * - Redacted header values ({{authToken}} etc.) remain as-is; matching keys are
 *   seeded as empty workflow variables so the Variables panel lists them. The
 *   original secrets are never stored — the user pastes real values there.
 * - initialVariables on each HTTP node is not set here — it would duplicate
 *   query params that already appear in the URL.
 */

import { v4 as uuidv4 } from 'uuid';
import type { WorkflowNode, WorkflowEdge } from '../types/workflow/model-core';
import type { BodyType, KeyValue } from '@shared/types';
import type { ParsedHarEntry } from './harParser';
import { detectChains } from './harChainDetector';
import type { ChainLink } from './harChainDetector';

export interface HarWorkflowResult {
  /** Start node + one HTTP node per entry, in order */
  nodes: WorkflowNode[];
  /** Sequential edges: Start → http[0] → http[1] → … */
  edges: WorkflowEdge[];
  /**
   * Workflow-level variables to merge into the created workflow.
   * Contains `baseUrl` when all entries share the same host, plus empty
   * placeholders for every unique redacted header variable (e.g. `authToken`).
   */
  variables: Record<string, string>;
  /** Human-readable summary of what was extracted, for display in the preview modal */
  extractionSummary: string[];
}

// ── Layout constants ──────────────────────────────────────────────────────────

/** Horizontal centre of the canvas (matches the Start node placed by create()) */
const NODE_X = 250;
/** Y position of the Start node */
const START_NODE_Y = 50;
/** Y position of the first HTTP node */
const NODE_Y_START = 240;
/** Vertical gap between consecutive HTTP nodes */
const NODE_GAP = 160;

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Convert a list of parsed HAR entries into workflow nodes, edges, and variables.
 *
 * @param entries - Accepted entries from parseHarEntries(). May be empty.
 * @returns HarWorkflowResult — always returns a valid result, never throws.
 */
export function harToWorkflow(entries: ParsedHarEntry[]): HarWorkflowResult {
  const variables: Record<string, string> = {};
  const extractionSummary: string[] = [];

  // ── Step 1: Run chain detection to parameterize URLs ─────────────────────
  const { entries: chainedEntries, chains, summary: chainSummary } = detectChains(entries);

  // Build a lookup: sourceIndex → chain links (for attaching extractions to nodes)
  const chainsBySource = new Map<number, ChainLink[]>();
  for (const link of chains) {
    const existing = chainsBySource.get(link.sourceIndex) ?? [];
    existing.push(link);
    chainsBySource.set(link.sourceIndex, existing);
  }

  // ── Step 2: Detect common host → {{baseUrl}} ─────────────────────────────
  const hosts = new Set(chainedEntries.map((e) => e.host));
  let baseUrlValue: string | undefined;

  if (hosts.size === 1 && chainedEntries.length > 0) {
    // Use URL.origin so port numbers are preserved (e.g. https://api.example.com:8443).
    // Phase 1 (harParser) already validated all URLs are parseable, so this never throws.
    const origin = new URL(chainedEntries[0].url).origin;
    baseUrlValue = origin;
    variables['baseUrl'] = baseUrlValue;
    extractionSummary.push(`Common host extracted → {{baseUrl}} = "${baseUrlValue}"`);
  } else if (hosts.size > 1) {
    extractionSummary.push(
      `Multiple hosts detected (${hosts.size}) — full URLs preserved, no {{baseUrl}} extracted.`,
    );
  }

  // ── Step 2b: Seed empty Variables rows for redacted header placeholders ──
  const redactedVarNames = collectRedactedVariableNames(chainedEntries);
  for (const name of redactedVarNames) {
    if (!(name in variables)) variables[name] = '';
  }
  if (redactedVarNames.length > 0) {
    extractionSummary.push(
      `Redacted headers added to Variables (empty): ${redactedVarNames.map((n) => `{{${n}}}`).join(', ')}`,
    );
  }

  // Add chain detection summary lines
  extractionSummary.push(...chainSummary);

  // ── Step 3: Build Start node ──────────────────────────────────────────────
  const startNodeId = uuidv4();
  const startNode: WorkflowNode = {
    id: startNodeId,
    type: 'start',
    position: { x: NODE_X, y: START_NODE_Y },
    data: { label: 'Start', inputVariables: {} },
  };

  // ── Step 4: Build one HTTP node per entry ─────────────────────────────────
  const httpNodes: WorkflowNode[] = chainedEntries.map((entry, index) => {
    const nodeId = uuidv4();

    // Build the URL — parameterize host when a common baseUrl was detected
    const nodeUrl = baseUrlValue
      ? `{{baseUrl}}${entry.path}${buildQueryString(entry.query)}`
      : `${entry.url}`;

    // Map entry headers to KeyValue[]
    const headers: KeyValue[] = Object.entries(entry.headers).map(([key, value]) => ({
      key,
      value,
      enabled: true,
    }));

    // Map MIME type to BodyType
    const bodyType = mimeToBodyType(entry.bodyMimeType);

    // Attach extractions from chain detection (if this node is a chain source)
    const nodeChains = chainsBySource.get(index) ?? [];
    const extractions = nodeChains.map((link) => link.extraction);

    const node: WorkflowNode = {
      id: nodeId,
      type: 'http',
      position: { x: NODE_X, y: NODE_Y_START + index * NODE_GAP },
      data: {
        label: `${entry.method} ${entry.path}`,
        scenario: {
          id: uuidv4(),
          name: `${entry.method} ${entry.path}`,
          url: nodeUrl,
          method: entry.method as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
          headers,
          body: entry.body ?? '',
          bodyType,
          auth: { type: 'none' },
          validation: { mode: 'none', assertions: [] },
          extractions,
        },
      },
    };

    return node;
  });

  // ── Step 5: Build sequential edges ───────────────────────────────────────
  const edges: WorkflowEdge[] = [];

  if (httpNodes.length > 0) {
    // Start → first HTTP node
    edges.push({ id: uuidv4(), source: startNodeId, target: httpNodes[0].id });

    // http[i] → http[i+1]
    for (let i = 0; i < httpNodes.length - 1; i++) {
      edges.push({ id: uuidv4(), source: httpNodes[i].id, target: httpNodes[i + 1].id });
    }
  }

  return {
    nodes: [startNode, ...httpNodes],
    edges,
    variables,
    extractionSummary,
  };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

const REDACTED_PLACEHOLDER_RE = /^\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}$/;

/**
 * Unique variable names from redacted header placeholders (e.g. `{{authToken}}` → `authToken`).
 * Original secret values are never copied — callers seed empty Variables rows.
 */
export function collectRedactedVariableNames(entries: ParsedHarEntry[]): string[] {
  const names = new Set<string>();
  for (const entry of entries) {
    for (const headerName of entry.redactedHeaderNames) {
      const value = entry.headers[headerName];
      const match = value?.match(REDACTED_PLACEHOLDER_RE);
      if (match) names.add(match[1]);
    }
  }
  return [...names];
}

/**
 * Build a query string from a key→value map.
 * Returns an empty string when the map is empty.
 */
function buildQueryString(query: Record<string, string>): string {
  const params = new URLSearchParams(query).toString();
  return params ? `?${params}` : '';
}

/**
 * Map a MIME type string to the closest RedfireForge BodyType.
 *
 * BodyType values: 'none' | 'json' | 'xml' | 'text' | 'form-urlencoded' | 'form-data' | 'file'
 */
export function mimeToBodyType(mime?: string): BodyType {
  if (!mime) return 'none';
  const m = mime.toLowerCase();
  if (m.includes('json')) return 'json';
  if (m.includes('xml')) return 'xml';
  if (m.includes('x-www-form-urlencoded')) return 'form-urlencoded';
  if (m.includes('form-data') || m.includes('multipart')) return 'form-data';
  if (m.startsWith('text/')) return 'text';
  // octet-stream, binary, etc. → 'text' as the closest editable type
  return 'text';
}
