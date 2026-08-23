/**
 * Shared node factory helpers for Gallery workflow sample factories.
 *
 * These functions eliminate the repeated boilerplate (auth, validation,
 * content-type headers, bodyType) present across every workflow factory file.
 * Each helper produces a fully-typed WorkflowNode object.
 */

import type { WorkflowNode, SetVariableAssignment } from '../../../features/workflow/types/workflow';
import type { Extraction } from '@shared/types';

// ── Types ──────────────────────────────────────────────────────────────────

export interface GetNodeOptions {
  /** Extra headers beyond Accept:application/json */
  extraHeaders?: Array<{ key: string; value: string }>;
  extractions?: Extraction[];
  x?: number;
  y?: number;
}

export interface PostNodeOptions {
  extraHeaders?: Array<{ key: string; value: string }>;
  extractions?: Extraction[];
  x?: number;
  y?: number;
}

export interface ConditionNodeOptions {
  operator?: '==' | '!=' | '>' | '<' | '>=' | '<=' | 'contains' | 'not-contains' | 'regex';
  x?: number;
  y?: number;
}

export interface LogDebugNodeOptions {
  x?: number;
  y?: number;
  snapshotVariables?: boolean;
}

// ── Shared defaults ────────────────────────────────────────────────────────

const NO_AUTH = { type: 'none' } as const;
const NO_VALIDATION = { mode: 'none' } as const;
const JSON_CONTENT_TYPE = { key: 'Content-Type', value: 'application/json' };
const ACCEPT_JSON = { key: 'Accept', value: 'application/json' };

// ── HTTP GET node ──────────────────────────────────────────────────────────

/**
 * Create a GET HTTP workflow node with default Accept header, no-auth,
 * and no-validation — the standard pattern for gallery sample GET requests.
 */
export function makeGetNode(
  id: string,
  label: string,
  url: string,
  opts: GetNodeOptions = {},
): WorkflowNode {
  const { extraHeaders = [], extractions = [], x = 300, y = 140 } = opts;
  return {
    id,
    type: 'http',
    position: { x, y },
    data: {
      label,
      scenario: {
        id: `${id}-sc`,
        name: label,
        url,
        method: 'GET',
        headers: [ACCEPT_JSON, ...extraHeaders],
        body: '',
        auth: NO_AUTH,
        validation: NO_VALIDATION,
        ...(extractions.length > 0 ? { extractions } : {}),
      },
    },
  };
}

// ── HTTP POST node ─────────────────────────────────────────────────────────

/**
 * Create a POST HTTP workflow node with Content-Type:application/json header,
 * JSON body, no-auth, and no-validation.
 */
export function makePostNode(
  id: string,
  label: string,
  url: string,
  body: string,
  opts: PostNodeOptions = {},
): WorkflowNode {
  const { extraHeaders = [], extractions = [], x = 300, y = 140 } = opts;
  return {
    id,
    type: 'http',
    position: { x, y },
    data: {
      label,
      scenario: {
        id: `${id}-sc`,
        name: label,
        url,
        method: 'POST',
        headers: [JSON_CONTENT_TYPE, ...extraHeaders],
        body,
        bodyType: 'json',
        auth: NO_AUTH,
        validation: NO_VALIDATION,
        ...(extractions.length > 0 ? { extractions } : {}),
      },
    },
  };
}

// ── HTTP PUT node ──────────────────────────────────────────────────────────

/**
 * Create a PUT HTTP workflow node with Content-Type:application/json header,
 * JSON body, no-auth, and no-validation.
 */
export function makePutNode(
  id: string,
  label: string,
  url: string,
  body: string,
  opts: PostNodeOptions = {},
): WorkflowNode {
  const { extraHeaders = [], extractions = [], x = 300, y = 140 } = opts;
  return {
    id,
    type: 'http',
    position: { x, y },
    data: {
      label,
      scenario: {
        id: `${id}-sc`,
        name: label,
        url,
        method: 'PUT',
        headers: [JSON_CONTENT_TYPE, ...extraHeaders],
        body,
        bodyType: 'json',
        auth: NO_AUTH,
        validation: NO_VALIDATION,
        ...(extractions.length > 0 ? { extractions } : {}),
      },
    },
  };
}

// ── HTTP DELETE node ───────────────────────────────────────────────────────

/**
 * Create a DELETE HTTP workflow node with no-auth and no-validation.
 */
export function makeDeleteNode(
  id: string,
  label: string,
  url: string,
  opts: GetNodeOptions = {},
): WorkflowNode {
  const { extraHeaders = [], extractions = [], x = 300, y = 140 } = opts;
  return {
    id,
    type: 'http',
    position: { x, y },
    data: {
      label,
      scenario: {
        id: `${id}-sc`,
        name: label,
        url,
        method: 'DELETE',
        headers: extraHeaders,
        body: '',
        auth: NO_AUTH,
        validation: NO_VALIDATION,
        ...(extractions.length > 0 ? { extractions } : {}),
      },
    },
  };
}

// ── Start node ─────────────────────────────────────────────────────────────

/**
 * Create a Start workflow node.
 */
export function makeStartNode(
  id: string,
  inputVariables: Record<string, string> = {},
  opts: { x?: number; y?: number } = {},
): WorkflowNode {
  const { x = 300, y = 0 } = opts;
  return {
    id,
    type: 'start',
    position: { x, y },
    data: {
      label: 'Start',
      inputVariables,
    },
  };
}

// ── End node ───────────────────────────────────────────────────────────────

/**
 * Create an End workflow node.
 */
export function makeEndNode(
  id: string,
  label = 'Done',
  opts: { x?: number; y?: number } = {},
): WorkflowNode {
  const { x = 300, y = 0 } = opts;
  return {
    id,
    type: 'end',
    position: { x, y },
    data: { label },
  };
}

// ── Condition node ─────────────────────────────────────────────────────────

/**
 * Create a Condition (if/else branch) workflow node.
 */
export function makeConditionNode(
  id: string,
  label: string,
  left: string,
  right: string,
  opts: ConditionNodeOptions = {},
): WorkflowNode {
  const { operator = '==', x = 300, y = 140 } = opts;
  return {
    id,
    type: 'condition',
    position: { x, y },
    data: { label, left, operator, right },
  };
}

// ── LogDebug node ──────────────────────────────────────────────────────────

/**
 * Create a LogDebug workflow node.
 */
export function makeLogDebugNode(
  id: string,
  label: string,
  message: string,
  level: 'info' | 'warn' | 'error' | 'debug' = 'info',
  opts: LogDebugNodeOptions = {},
): WorkflowNode {
  const { x = 300, y = 140, snapshotVariables = false } = opts;
  return {
    id,
    type: 'logDebug',
    position: { x, y },
    data: { label, message, logLevel: level, snapshotVariables },
  };
}

// ── SetVariable node ───────────────────────────────────────────────────────

/**
 * Create a SetVariable workflow node.
 */
export function makeSetVariableNode(
  id: string,
  label: string,
  assignments: SetVariableAssignment[],
  opts: { x?: number; y?: number } = {},
): WorkflowNode {
  const { x = 300, y = 140 } = opts;
  return {
    id,
    type: 'setVariable',
    position: { x, y },
    data: { label, assignments },
  };
}

// ── Delay node ─────────────────────────────────────────────────────────────

/**
 * Create a Delay workflow node.
 */
export function makeDelayNode(
  id: string,
  label: string,
  delayMs: number,
  opts: { x?: number; y?: number } = {},
): WorkflowNode {
  const { x = 300, y = 140 } = opts;
  return {
    id,
    type: 'delay',
    position: { x, y },
    data: { label, delayMs, mode: 'fixed' },
  };
}

// ── Fork node ──────────────────────────────────────────────────────────────

/**
 * Create a Fork workflow node (parallel branch start).
 */
export function makeForkNode(
  id: string,
  label: string,
  opts: { x?: number; y?: number } = {},
): WorkflowNode {
  const { x = 300, y = 140 } = opts;
  return {
    id,
    type: 'fork',
    position: { x, y },
    data: { label },
  };
}

// ── Join node ──────────────────────────────────────────────────────────────

/**
 * Create a Join workflow node (parallel branch merge).
 */
export function makeJoinNode(
  id: string,
  label: string,
  opts: { x?: number; y?: number } = {},
): WorkflowNode {
  const { x = 300, y = 140 } = opts;
  return {
    id,
    type: 'join',
    position: { x, y },
    data: { label },
  };
}

// ── Edge helper ────────────────────────────────────────────────────────────

/**
 * Create a workflow edge. Optionally include a label (for condition branches).
 */
export function makeEdge(
  id: string,
  source: string,
  target: string,
  label?: string,
): { id: string; source: string; target: string; label?: string } {
  return label !== undefined ? { id, source, target, label } : { id, source, target };
}

// ── Body helpers ───────────────────────────────────────────────────────────

/**
 * Serialize a plain object to a pretty-printed JSON string body.
 * Uses null/2 as the standard pretty-print format across all gallery factories.
 */
export function jsonBody(obj: Record<string, unknown>): string {
  return JSON.stringify(obj, null, 2);
}

// ── Extraction shorthand ───────────────────────────────────────────────────

/**
 * Create a body extraction rule — the most common extraction type in gallery samples.
 */
export function bodyExtraction(name: string, expression: string): Extraction {
  return { name, source: 'body', expression };
}

/**
 * Create a header extraction rule.
 */
export function headerExtraction(name: string, expression: string): Extraction {
  return { name, source: 'header', expression };
}
