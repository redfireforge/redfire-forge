/**
 * XPath 1.0 evaluation for XML body predicates.
 *
 * Uses `@xmldom/xmldom` + `xpath` in every environment rather than the browser's
 * native `document.evaluate`, so the Simulate preview and the Node listener
 * agree exactly — a rule that matches in one must match in the other.
 */
import { DOMParser } from '@xmldom/xmldom';
import { select } from 'xpath';
import { BoundedCache } from './perfBudgets';

/** Parsing the same SOAP envelope per predicate is the hot path here. */
const docCache = new BoundedCache<string, unknown | null>(128);

function parseXml(body: string): unknown | null {
  const cached = docCache.get(body);
  if (cached !== undefined) return cached;
  let doc: unknown | null = null;
  try {
    // xmldom reports recoverable problems through these handlers rather than
    // throwing, and still returns a usable document — stay quiet and rely on
    // the XPath result instead.
    const parser = new DOMParser({
      onError: () => {},
    } as ConstructorParameters<typeof DOMParser>[0]);
    const parsed = parser.parseFromString(body, 'text/xml');
    doc = parsed ?? null;
  } catch {
    doc = null;
  }
  docCache.set(body, doc);
  return doc;
}

function nodeText(node: unknown): string {
  if (node == null) return '';
  if (typeof node === 'string' || typeof node === 'number' || typeof node === 'boolean') return String(node);
  const n = node as { nodeValue?: string | null; textContent?: string | null };
  return n.nodeValue ?? n.textContent ?? '';
}

export interface XPathResult {
  /** False when the body is not XML or the expression is invalid. */
  ok: boolean;
  /** Text of every node the expression selected. */
  values: string[];
  matched: boolean;
}

export function evaluateXPath(body: unknown, expression: string): XPathResult {
  if (typeof body !== 'string' || !body.trim() || !expression.trim()) {
    return { ok: false, values: [], matched: false };
  }
  const doc = parseXml(body);
  if (!doc) return { ok: false, values: [], matched: false };

  try {
    const result = select(expression, doc as never);
    if (typeof result === 'boolean') return { ok: true, values: [String(result)], matched: result };
    if (typeof result === 'number' || typeof result === 'string') {
      return { ok: true, values: [String(result)], matched: String(result).length > 0 };
    }
    const nodes = Array.isArray(result) ? result : [result];
    const values = nodes.filter(n => n != null).map(nodeText);
    return { ok: true, values, matched: values.length > 0 };
  } catch {
    return { ok: false, values: [], matched: false };
  }
}

/** `xpath_exists` — the expression must select at least one node. */
export function matchXPathExists(value: unknown, expected: unknown): boolean {
  const expr = Array.isArray(expected) ? String(expected[0] ?? '') : String(expected ?? '');
  return evaluateXPath(value, expr).matched;
}

/**
 * `xpath_equals` — `expected` is `[expression, value]`. `matchStyle: 'subset'`
 * switches the comparison to substring, which is how WireMock's
 * `matchesXPath: { expression, contains }` behaves.
 */
export function matchXPathEquals(
  value: unknown,
  expected: unknown,
  matchStyle?: 'subset' | 'exact',
): boolean {
  if (!Array.isArray(expected)) return false;
  const [expr, wanted] = [String(expected[0] ?? ''), String(expected[1] ?? '')];
  const res = evaluateXPath(value, expr);
  if (!res.ok || !res.matched) return false;
  return matchStyle === 'subset'
    ? res.values.some(v => v.includes(wanted))
    : res.values.some(v => v === wanted);
}
