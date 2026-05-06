/**
 * CLI workflow file loader.
 * Loads workflow definitions from YAML or JSON files for load testing.
 */

import { readFileSync } from 'fs';
import { parse as parseYaml } from 'yaml';
import type { Workflow, WorkflowNode, WorkflowEdge, HttpNodeData } from '../src/features/workflow/types/workflow';
import type { Scenario } from '../src/shared/types';

/**
 * Simplified HTTP node format for CLI YAML files.
 * This is transformed into a full HttpNodeData with scenario.
 */
interface SimplifiedHttpNodeData {
  label: string;
  method?: string;
  url: string;
  headers?: Array<{ key: string; value: string }> | Record<string, string>;
  body?: string;
  scenario?: Scenario;
}

/**
 * Transform a simplified HTTP node to the full format expected by graphRunner.
 * Supports both simplified (method/url at top level) and full (nested scenario) formats.
 */
function normalizeHttpNode(node: WorkflowNode): WorkflowNode {
  if (node.type !== 'http') return node;

  const data = node.data as SimplifiedHttpNodeData;
  
  // If scenario already exists, node is in full format
  if (data.scenario) return node;

  // Transform simplified format to full format
  const headers = Array.isArray(data.headers)
    ? data.headers
    : data.headers
      ? Object.entries(data.headers).map(([key, value]) => ({ key, value }))
      : [];

  const scenario: Scenario = {
    id: `${node.id}-scenario`,
    name: data.label,
    url: data.url,
    method: (data.method?.toUpperCase() || 'GET') as Scenario['method'],
    headers,
    body: data.body || '',
    auth: { type: 'none' },
    validation: { mode: 'none' },
  };

  const fullData: HttpNodeData = {
    label: data.label,
    scenario,
  };

  return { ...node, data: fullData };
}

/**
 * Load a workflow from a YAML or JSON file.
 * The file should contain a valid Workflow object with at minimum:
 * - name: string
 * - nodes: WorkflowNode[]
 * - edges: WorkflowEdge[]
 * 
 * HTTP nodes can use either:
 * - Full format: data.scenario with complete Scenario object
 * - Simplified format: data.method, data.url, data.headers, data.body
 */
export function loadWorkflowFile(filePath: string): Workflow {
  const content = readFileSync(filePath, 'utf-8');
  const ext = filePath.toLowerCase();

  let parsed: unknown;
  if (ext.endsWith('.yaml') || ext.endsWith('.yml')) {
    parsed = parseYaml(content);
  } else {
    parsed = JSON.parse(content);
  }

  const workflow = parsed as Partial<Workflow>;

  // Validate required fields
  if (!workflow.name || typeof workflow.name !== 'string') {
    throw new Error('Workflow must have a "name" string field.');
  }
  if (!workflow.nodes || !Array.isArray(workflow.nodes)) {
    throw new Error('Workflow must have a "nodes" array.');
  }
  if (!workflow.edges || !Array.isArray(workflow.edges)) {
    throw new Error('Workflow must have an "edges" array.');
  }

  // Validate and normalize nodes
  const normalizedNodes: WorkflowNode[] = [];
  for (const node of workflow.nodes) {
    if (!node.id || typeof node.id !== 'string') {
      throw new Error(`Workflow node missing required "id" field.`);
    }
    if (!node.type || typeof node.type !== 'string') {
      throw new Error(`Workflow node "${node.id}" missing required "type" field.`);
    }
    if (!node.position || typeof node.position.x !== 'number' || typeof node.position.y !== 'number') {
      throw new Error(`Workflow node "${node.id}" missing or invalid "position" field.`);
    }
    if (!node.data || typeof node.data !== 'object') {
      throw new Error(`Workflow node "${node.id}" missing "data" field.`);
    }
    normalizedNodes.push(normalizeHttpNode(node as WorkflowNode));
  }

  // Validate edges
  for (const edge of workflow.edges) {
    if (!edge.id || typeof edge.id !== 'string') {
      throw new Error(`Workflow edge missing required "id" field.`);
    }
    if (!edge.source || typeof edge.source !== 'string') {
      throw new Error(`Workflow edge "${edge.id}" missing required "source" field.`);
    }
    if (!edge.target || typeof edge.target !== 'string') {
      throw new Error(`Workflow edge "${edge.id}" missing required "target" field.`);
    }
  }

  // Ensure optional fields have defaults
  return {
    id: workflow.id || crypto.randomUUID(),
    name: workflow.name,
    description: workflow.description,
    variables: workflow.variables || {},
    nodes: normalizedNodes,
    edges: workflow.edges as WorkflowEdge[],
    services: workflow.services || [],
    createdAt: workflow.createdAt || Date.now(),
    updatedAt: workflow.updatedAt || Date.now(),
  };
}
