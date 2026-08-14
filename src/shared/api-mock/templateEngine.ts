/**
 * API Mock Studio — restricted template engine (Phase 4D).
 * Handlebars-compatible subset with curated helpers and safety limits.
 * No eval, Function, dynamic imports, filesystem, process, or network access.
 */
import type { ApiMockTemplateContextV1 } from './contracts';
import { HARD_CEILINGS } from './defaults';
import { renderFakerHelper } from './templateFaker';

const BLOCKED_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const MAX_OUTPUT_BYTES = HARD_CEILINGS.maxResponseBodyBytes;
const MAX_DEPTH = HARD_CEILINGS.maxTemplateNesting;
const MAX_OPS = HARD_CEILINGS.maxTemplateOperations;

export interface TemplateRenderResult {
  output: string;
  errors: string[];
  truncated: boolean;
  operationCount: number;
}

export function renderTemplate(template: string, context: ApiMockTemplateContextV1): TemplateRenderResult {
  const errors: string[] = [];
  let ops = 0;
  let truncated = false;

  function resolve(path: string): string {
    if (++ops > MAX_OPS) { errors.push(`Operation limit ${MAX_OPS} exceeded`); return ''; }
    const parts = path.split('.');
    if (parts.some(p => BLOCKED_KEYS.has(p))) { errors.push(`Blocked key in path: ${path}`); return ''; }

    let current: unknown = context;
    for (const part of parts) {
      if (current == null || typeof current !== 'object') return '';
      current = (current as Record<string, unknown>)[part];
    }
    return current == null ? '' : String(current);
  }

  function processHelper(name: string, args: string[]): string {
    if (++ops > MAX_OPS) { errors.push(`Operation limit ${MAX_OPS} exceeded`); return ''; }

    switch (name) {
      case 'pathParam': return args[0] ? (context.request.pathParams[args[0]] ?? '') : '';
      case 'query': return args[0] ? (context.request.query[args[0]]?.[0] ?? '') : '';
      case 'header': return args[0] ? (context.request.headers[args[0].toLowerCase()]?.[0] ?? '') : '';
      case 'cookie': return args[0] ? (context.request.cookies[args[0]] ?? '') : '';
      case 'state': return args[0] ? (context.state[args[0]] ?? '') : '';
      case 'counter': return args[0] ? String(context.counters[args[0]] ?? 0) : '0';
      case 'uuid': return crypto.randomUUID();
      case 'now': return context.now || new Date().toISOString();
      case 'randomInt': {
        const min = parseInt(args[0] ?? '0', 10);
        const max = parseInt(args[1] ?? '100', 10);
        if (context.seed) {
          return String(seededRandom(context.seed, min, max));
        }
        return String(Math.floor(Math.random() * (max - min + 1)) + min);
      }
      case 'oneOf': {
        if (args.length === 0) return '';
        if (context.seed) {
          return args[seededRandom(context.seed, 0, args.length - 1)];
        }
        return args[Math.floor(Math.random() * args.length)];
      }
      case 'repeat': {
        const count = Math.min(parseInt(args[0] ?? '1', 10), 100);
        const text = args[1] ?? '';
        return text.repeat(Math.max(0, count));
      }
      case 'base64': {
        const input = args[0] ?? '';
        const dir = args[1] ?? 'encode';
        try {
          return dir === 'decode' ? atob(input) : btoa(input);
        } catch { errors.push(`base64 ${dir} failed`); return ''; }
      }
      case 'jsonPath': {
        const body = context.request.body;
        const path = args[0] ?? '$';
        if (body == null || typeof body !== 'object') return '';
        const resolved = resolveJsonPath(body as Record<string, unknown>, path);
        return resolved == null ? '' : typeof resolved === 'object' ? JSON.stringify(resolved) : String(resolved);
      }
      case 'faker': {
        const path = args[0] ?? '';
        if (!path) { errors.push('faker requires a path, e.g. person.firstName'); return ''; }
        const draw = context.seed
          ? seededRandom(`${context.seed}:${path}:${ops}`, 0, 0x7fffffff)
          : Math.floor(Math.random() * 0x7fffffff);
        const value = renderFakerHelper(path, draw);
        if (!value) { errors.push(`Unknown faker helper: ${path}`); return ''; }
        return value;
      }
      default:
        errors.push(`Unknown helper: ${name}`);
        return '';
    }
  }

  function render(tmpl: string, depth: number): string {
    if (depth > MAX_DEPTH) { errors.push(`Nesting depth ${MAX_DEPTH} exceeded`); return tmpl; }

    let result = '';
    let i = 0;
    while (i < tmpl.length) {
      if (result.length > MAX_OUTPUT_BYTES) { truncated = true; break; }

      if (tmpl[i] === '{' && tmpl[i + 1] === '{') {
        const closeIdx = tmpl.indexOf('}}', i + 2);
        if (closeIdx === -1) { result += tmpl.slice(i); break; }

        const expr = tmpl.slice(i + 2, closeIdx).trim();
        i = closeIdx + 2;

        if (!expr) continue;

        const parts = parseExpression(expr);
        if (parts.length === 0) continue;

        const helperName = parts[0];
        const helperArgs = parts.slice(1);

        if (helperArgs.length === 0 && !isHelper(helperName)) {
          result += resolve(helperName);
        } else {
          result += processHelper(helperName, helperArgs);
        }
      } else {
        result += tmpl[i];
        i++;
      }
    }
    return result;
  }

  const output = render(template, 0);
  return { output, errors, truncated, operationCount: ops };
}

function parseExpression(expr: string): string[] {
  const parts: string[] = [];
  let current = '';
  let inQuote = false;
  let quoteChar = '';
  for (const ch of expr) {
    if (inQuote) {
      if (ch === quoteChar) { inQuote = false; parts.push(current); current = ''; }
      else current += ch;
    } else if (ch === "'" || ch === '"') {
      inQuote = true;
      quoteChar = ch;
      if (current.trim()) { parts.push(current.trim()); current = ''; }
    } else if (ch === ' ' || ch === '\t') {
      if (current.trim()) { parts.push(current.trim()); current = ''; }
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

const HELPER_NAMES = new Set([
  'pathParam', 'query', 'header', 'cookie', 'state', 'counter',
  'uuid', 'now', 'randomInt', 'oneOf', 'repeat', 'base64', 'jsonPath', 'faker',
]);

function isHelper(name: string): boolean {
  return HELPER_NAMES.has(name);
}

function seededRandom(seed: string, min: number, max: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  const normalized = ((hash & 0x7fffffff) % (max - min + 1));
  return min + normalized;
}

function resolveJsonPath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.replace(/^\$\.?/, '').split('.').filter(Boolean);
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    const indexed = part.match(/^([^[]+)\[(\d+)\]$/);
    if (indexed) {
      const key = indexed[1];
      const idx = Number(indexed[2]);
      if (BLOCKED_KEYS.has(key)) return undefined;
      const arr = (current as Record<string, unknown>)[key];
      if (!Array.isArray(arr)) return undefined;
      current = arr[idx];
      continue;
    }
    if (BLOCKED_KEYS.has(part)) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}
