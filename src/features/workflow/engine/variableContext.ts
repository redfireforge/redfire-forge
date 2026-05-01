import { v4 as uuidv4 } from 'uuid';
import type { HttpNodeData, WorkflowNode } from '../types/workflow';
import { httpStepDisplayLabel, isHttpWorkflowNode } from '../utils/workflowVariableHints';
import { EXPRESSION_FUNCTION_MAP } from '../utils/expressionFunctions';

/**
 * Parsed inner template for node-scoped refs:
 * - `node:"Step label".var` — human-readable (resolved via workflow registration)
 * - `node:<id>.var` — legacy / disambiguation (raw node id)
 */
export type ParsedNodeScoped =
  | { kind: 'id'; nodeId: string; name: string }
  | { kind: 'label'; label: string; name: string };

export function parseNodeScopedInner(trimmed: string): ParsedNodeScoped | null {
  const quoted = /^node:"([^"]*)"\.(.+)$/.exec(trimmed);
  if (quoted) return { kind: 'label', label: quoted[1], name: quoted[2] };
  const plain = /^node:([^.]+)\.(.+)$/.exec(trimmed);
  if (plain) return { kind: 'id', nodeId: plain[1], name: plain[2] };
  return null;
}

/**
 * Layered runtime variable store for workflow execution.
 *
 * Resolution priority (highest → lowest):
 *   1. Extracted variables (from prior responses)
 *   2. Manual / initial variables (user-defined)
 *   3. Environment variables
 *   4. Built-in generators ($uuid, $timestamp, etc.)
 *
 * Additionally, `{{node:"Step Name".<name>}}` or `{{node:<id>.<name>}}` resolve from per-node bindings.
 */
export class VariableContext {
  private extracted = new Map<string, string>();
  private manual = new Map<string, string>();
  private environment = new Map<string, string>();
  /** Per React Flow node id → extracted variable name → value */
  private byNode = new Map<string, Map<string, string>>();
  /** Step label (exact) → node id when unambiguous among registered HTTP nodes */
  private labelToNodeId = new Map<string, string>();
  /** Labels shared by 2+ HTTP steps — `node:"Label".x` cannot resolve */
  private ambiguousLabels = new Set<string>();
  /** Node id → display label (for snapshot keys) */
  private nodeIdToLabel = new Map<string, string>();

  constructor(initial?: Record<string, string>, env?: Record<string, string>) {
    if (initial) for (const [k, v] of Object.entries(initial)) this.manual.set(k, v);
    if (env) for (const [k, v] of Object.entries(env)) this.environment.set(k, v);
  }

  /**
   * Call before running a workflow graph so `{{node:"My Step".var}}` resolves.
   * Duplicate step titles mark the label ambiguous (use node id form for those steps).
   */
  registerWorkflowNodes(nodes: WorkflowNode[]): void {
    this.labelToNodeId.clear();
    this.ambiguousLabels.clear();
    this.nodeIdToLabel.clear();
    const idsByLabel = new Map<string, string[]>();
    for (const n of nodes) {
      if (!isHttpWorkflowNode(n)) continue;
      const data = n.data as HttpNodeData;
      if (!data.scenario) continue;
      const title = httpStepDisplayLabel(data);
      this.nodeIdToLabel.set(n.id, title);
      if (!idsByLabel.has(title)) idsByLabel.set(title, []);
      idsByLabel.get(title)!.push(n.id);
    }
    for (const [title, ids] of idsByLabel) {
      if (ids.length === 1) this.labelToNodeId.set(title, ids[0]);
      else this.ambiguousLabels.add(title);
    }
  }

  /**
   * Bind a variable to a specific HTTP step id. Use with `{{node:"Step".<name>}}` or `{{node:<id>.<name>}}`.
   */
  setForNode(nodeId: string, name: string, value: string): void {
    let m = this.byNode.get(nodeId);
    if (!m) {
      m = new Map();
      this.byNode.set(nodeId, m);
    }
    m.set(name, value);
  }

  getFromNode(nodeId: string, name: string): string | undefined {
    return this.byNode.get(nodeId)?.get(name);
  }

  private resolveParsedScoped(p: ParsedNodeScoped): string | undefined {
    if (p.kind === 'id') {
      return this.getFromNode(p.nodeId, p.name);
    }
    if (this.ambiguousLabels.has(p.label)) return undefined;
    const id = this.labelToNodeId.get(p.label);
    if (!id) return undefined;
    return this.getFromNode(id, p.name);
  }

  set(name: string, value: string): void {
    this.extracted.set(name, value);
  }

  get(name: string): string | undefined {
    const scoped = parseNodeScopedInner(name);
    if (scoped) {
      return this.resolveParsedScoped(scoped) ?? undefined;
    }
    return this.extracted.get(name)
      ?? this.manual.get(name)
      ?? this.environment.get(name);
  }

  /**
   * Replace all `{{varName}}` placeholders in a template string.
   */
  resolve(template: string): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (_match, key: string) => {
      const trimmed = key.trim();
      if (trimmed.startsWith('$')) return this.resolveExpression(trimmed);
      const scoped = parseNodeScopedInner(trimmed);
      if (scoped) {
        const v = this.resolveParsedScoped(scoped);
        return v ?? _match;
      }
      return this.get(trimmed) ?? _match;
    });
  }

  /**
   * Resolve a `$name(...)` expression. Tries built-in generators first,
   * then falls back to expression functions from the registry.
   */
  private resolveExpression(expr: string): string {
    // Try built-in generators first (simple $name or $name(args))
    const builtIn = resolveBuiltInGenerator(expr);
    if (builtIn !== undefined) return builtIn;

    // Try expression function registry with variable resolution
    return resolveExpressionFunction(expr, (name: string) => {
      const scoped = parseNodeScopedInner(name);
      if (scoped) return this.resolveParsedScoped(scoped) ?? undefined;
      return this.get(name) ?? undefined;
    });
  }

  child(): VariableContext {
    const c = new VariableContext();
    c.manual = new Map(this.manual);
    for (const [k, v] of this.extracted) {
      c.manual.set(k, v);
    }
    c.environment = new Map(this.environment);
    for (const [nodeId, inner] of this.byNode) {
      c.byNode.set(nodeId, new Map(inner));
    }
    c.labelToNodeId = new Map(this.labelToNodeId);
    c.ambiguousLabels = new Set(this.ambiguousLabels);
    c.nodeIdToLabel = new Map(this.nodeIdToLabel);
    return c;
  }

  /** Prefer `node:"Step".name` in keys when the label is unique; else `node:id.name`. */
  private snapshotKeyForNodeVar(nodeId: string, varName: string): string {
    const label = this.nodeIdToLabel.get(nodeId);
    if (
      label
      && !this.ambiguousLabels.has(label)
      && !label.includes('"')
      && !label.includes('\n')
    ) {
      return `node:"${label}".${varName}`;
    }
    return `node:${nodeId}.${varName}`;
  }

  snapshot(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, v] of this.environment) out[k] = v;
    for (const [k, v] of this.manual) out[k] = v;
    for (const [k, v] of this.extracted) out[k] = v;
    for (const [nodeId, inner] of this.byNode) {
      for (const [name, v] of inner) {
        out[this.snapshotKeyForNodeVar(nodeId, name)] = v;
      }
    }
    return out;
  }

  get size(): number {
    const keys = new Set<string>();
    for (const k of this.environment.keys()) keys.add(k);
    for (const k of this.manual.keys()) keys.add(k);
    for (const k of this.extracted.keys()) keys.add(k);
    for (const [nodeId, inner] of this.byNode) {
      for (const name of inner.keys()) keys.add(this.snapshotKeyForNodeVar(nodeId, name));
    }
    return keys.size;
  }
}

// ── Built-in generators ──────────────────────────────

const GENERATOR_RE = /^\$(\w+)(?:\(([^)]*)\))?$/;

/**
 * Try to resolve as a built-in generator ($uuid, $timestamp, etc.).
 * Returns the resolved string or undefined if not a known generator.
 */
function resolveBuiltInGenerator(expr: string): string | undefined {
  const m = GENERATOR_RE.exec(expr);
  if (!m) return undefined;
  const [, name, rawArgs] = m;
  const args = rawArgs?.split(',').map(s => s.trim()) ?? [];

  switch (name) {
    case 'uuid': return uuidv4();
    case 'timestamp': return String(Date.now());
    case 'isoDate': return new Date().toISOString();
    case 'randomInt': {
      const min = parseInt(args[0] ?? '0', 10);
      const max = parseInt(args[1] ?? '1000', 10);
      return String(Math.floor(Math.random() * (max - min + 1)) + min);
    }
    case 'randomEmail': {
      const id = Math.random().toString(36).slice(2, 8);
      return `user_${id}@test.com`;
    }
    case 'randomString': {
      const len = parseInt(args[0] ?? '8', 10);
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let s = '';
      for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
      return s;
    }
    default:
      return undefined;
  }
}

/**
 * Resolve an expression using the expression function registry.
 * Parses `$fnName(arg1, arg2, ...)` and evaluates with variable resolution.
 */
function resolveExpressionFunction(
  expr: string,
  resolveVar: (name: string) => string | undefined,
): string {
  const m = GENERATOR_RE.exec(expr);
  if (!m) return `{{${expr}}}`;

  const [, name, rawArgs] = m;
  const fn = EXPRESSION_FUNCTION_MAP.get(`$${name}`);
  if (!fn) return `{{${expr}}}`;

  // Parse args: split by comma but respect quoted strings
  const args = rawArgs ? parseExpressionArgs(rawArgs, resolveVar) : [];

  try {
    const result = fn.evaluate(...args);
    if (result === null || result === undefined) return '';
    if (typeof result === 'object') {
      try { return JSON.stringify(result); } catch { return String(result); }
    }
    return String(result);
  } catch {
    return `{{${expr}}}`;
  }
}

/**
 * Parse comma-separated args, resolving variable references.
 * Handles: quoted strings, numbers, booleans, and bare variable names.
 */
function parseExpressionArgs(
  raw: string,
  resolveVar: (name: string) => string | undefined,
): unknown[] {
  const args: unknown[] = [];
  let i = 0;
  const s = raw.trim();

  while (i < s.length) {
    // Skip whitespace
    while (i < s.length && /\s/.test(s[i])) i++;
    if (i >= s.length) break;

    // Skip comma
    if (s[i] === ',') { i++; continue; }

    // Quoted string
    if (s[i] === '"' || s[i] === "'") {
      const q = s[i];
      let val = '';
      i++;
      while (i < s.length && s[i] !== q) {
        if (s[i] === '\\' && i + 1 < s.length) { val += s[i + 1]; i += 2; }
        else { val += s[i]; i++; }
      }
      i++; // skip closing quote
      args.push(val);
      continue;
    }

    // Bare token (number, bool, or variable reference)
    let token = '';
    while (i < s.length && s[i] !== ',') { token += s[i]; i++; }
    token = token.trim();
    if (!token) continue;

    if (token === 'true') { args.push(true); continue; }
    if (token === 'false') { args.push(false); continue; }
    if (!isNaN(Number(token))) { args.push(Number(token)); continue; }

    // Try as variable reference
    const resolved = resolveVar(token);
    args.push(resolved ?? token);
  }

  return args;
}
