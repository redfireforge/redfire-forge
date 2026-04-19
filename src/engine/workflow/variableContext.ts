import { v4 as uuidv4 } from 'uuid';

/**
 * Layered runtime variable store for workflow execution.
 *
 * Resolution priority (highest → lowest):
 *   1. Extracted variables (from prior responses)
 *   2. Manual / initial variables (user-defined)
 *   3. Environment variables
 *   4. Built-in generators ($uuid, $timestamp, etc.)
 */
export class VariableContext {
  private extracted = new Map<string, string>();
  private manual = new Map<string, string>();
  private environment = new Map<string, string>();

  constructor(initial?: Record<string, string>, env?: Record<string, string>) {
    if (initial) for (const [k, v] of Object.entries(initial)) this.manual.set(k, v);
    if (env) for (const [k, v] of Object.entries(env)) this.environment.set(k, v);
  }

  set(name: string, value: string): void {
    this.extracted.set(name, value);
  }

  get(name: string): string | undefined {
    return this.extracted.get(name)
      ?? this.manual.get(name)
      ?? this.environment.get(name);
  }

  /**
   * Replace all `{{varName}}` placeholders in a template string.
   * Supports built-in generators: `{{$uuid}}`, `{{$timestamp}}`, etc.
   * Generator arguments: `{{$randomInt(1,100)}}`.
   * Unresolved placeholders are left as-is.
   */
  resolve(template: string): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (_match, key: string) => {
      const trimmed = key.trim();
      if (trimmed.startsWith('$')) return resolveGenerator(trimmed);
      return this.get(trimmed) ?? _match;
    });
  }

  /** Create an isolated child for per-virtual-user execution. Inherits manual + env; gets its own extracted layer. */
  child(): VariableContext {
    const c = new VariableContext();
    c.manual = new Map(this.manual);
    c.environment = new Map(this.environment);
    return c;
  }

  /** Snapshot all variables for UI display. */
  snapshot(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, v] of this.environment) out[k] = v;
    for (const [k, v] of this.manual) out[k] = v;
    for (const [k, v] of this.extracted) out[k] = v;
    return out;
  }

  /** Number of variables across all layers. */
  get size(): number {
    const keys = new Set<string>();
    for (const k of this.environment.keys()) keys.add(k);
    for (const k of this.manual.keys()) keys.add(k);
    for (const k of this.extracted.keys()) keys.add(k);
    return keys.size;
  }
}

// ── Built-in generators ──────────────────────────────

const GENERATOR_RE = /^\$(\w+)(?:\(([^)]*)\))?$/;

function resolveGenerator(expr: string): string {
  const m = GENERATOR_RE.exec(expr);
  if (!m) return `{{${expr}}}`;
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
      return `{{${expr}}}`;
  }
}
