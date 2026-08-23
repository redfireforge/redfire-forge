import type { Scenario } from '@shared/types';

export type QNode =
  | { type: 'term'; value: string; exact: boolean }
  | { type: 'not'; child: QNode }
  | { type: 'and'; children: QNode[] }
  | { type: 'or'; children: QNode[] };

export function parseSearchQuery(raw: string): QNode | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const tokens: string[] = [];
  let i = 0;
  while (i < trimmed.length) {
    if (trimmed[i] === ' ') { i++; continue; }
    if (trimmed[i] === '(' || trimmed[i] === ')') { tokens.push(trimmed[i]); i++; continue; }
    if (trimmed[i] === '"') {
      const end = trimmed.indexOf('"', i + 1);
      if (end !== -1) { tokens.push(trimmed.slice(i, end + 1)); i = end + 1; }
      else { tokens.push(trimmed.slice(i)); i = trimmed.length; }
      continue;
    }
    let j = i;
    while (j < trimmed.length && trimmed[j] !== ' ' && trimmed[j] !== '(' && trimmed[j] !== ')') j++;
    tokens.push(trimmed.slice(i, j));
    i = j;
  }

  let pos = 0;
  const peek = () => tokens[pos] ?? '';
  const next = () => tokens[pos++] ?? '';

  const parseAtom = (): QNode => {
    const t = peek();
    if (t.toUpperCase() === 'NOT' || t === '-') {
      next();
      return { type: 'not', child: parseAtom() };
    }
    if (t.startsWith('-') && t.length > 1) {
      next();
      const val = t.slice(1);
      return { type: 'not', child: { type: 'term', value: val.toLowerCase(), exact: false } };
    }
    if (t === '(') {
      next();
      const node = parseOr();
      if (peek() === ')') next();
      return node;
    }
    next();
    if (t.startsWith('"') && t.endsWith('"') && t.length > 1) {
      return { type: 'term', value: t.slice(1, -1).toLowerCase(), exact: true };
    }
    return { type: 'term', value: t.toLowerCase(), exact: false };
  };

  const parseAnd = (): QNode => {
    const nodes: QNode[] = [parseAtom()];
    while (pos < tokens.length && peek() !== ')' && peek().toUpperCase() !== 'OR') {
      if (peek().toUpperCase() === 'AND') { next(); continue; }
      nodes.push(parseAtom());
    }
    return nodes.length === 1 ? nodes[0] : { type: 'and', children: nodes };
  };

  const parseOr = (): QNode => {
    const nodes: QNode[] = [parseAnd()];
    while (peek().toUpperCase() === 'OR') {
      next();
      nodes.push(parseAnd());
    }
    return nodes.length === 1 ? nodes[0] : { type: 'or', children: nodes };
  };

  if (tokens.length === 0) return null;
  const result = parseOr();
  return result;
}

export function evaluateQuery(node: QNode, text: string): boolean {
  switch (node.type) {
    case 'term':
      if (node.exact) {
        const re = new RegExp(`\\b${node.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        return re.test(text);
      }
      return text.toLowerCase().includes(node.value);
    case 'not':
      return !evaluateQuery(node.child, text);
    case 'and':
      return node.children.every((c) => evaluateQuery(c, text));
    case 'or':
      return node.children.some((c) => evaluateQuery(c, text));
  }
}

export function buildSearchText(t: Scenario): string {
  // Demo seeds and legacy imports may omit auth/validation/headers — never throw from search.
  const headers = t.headers ?? [];
  const auth = t.auth;
  const validation = t.validation;
  const parts = [
    t.name, t.url, t.method, t.body,
    ...headers.flatMap((h) => [h.key, h.value]),
    auth?.type ?? '',
    auth?.tokenUrl ?? '', auth?.clientId ?? '', auth?.username ?? '',
    validation?.mode ?? '',
    ...(validation?.expectedFields ?? []).flatMap((f) => [f.jsonPath ?? '', f.expectedValue ?? '']),
    validation?.expectedJson ?? '',
    ...(t.scenarioTags ?? []),
  ];
  return parts.join(' ');
}
