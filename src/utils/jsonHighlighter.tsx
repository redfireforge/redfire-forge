import React from 'react';

export function highlightJson(json: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const tokenRegex = /("(?:\\.|[^"\\])*")\s*:/g;
  const stringRegex = /"(?:\\.|[^"\\])*"/g;
  const numberRegex = /\b(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b/g;

  const lines = json.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) nodes.push('\n');
    const line = lines[i];
    const parts: { start: number; end: number; type: string }[] = [];

    let m: RegExpExecArray | null;
    const keyRe = new RegExp(tokenRegex.source, 'g');
    while ((m = keyRe.exec(line)) !== null) {
      parts.push({ start: m.index, end: m.index + m[1].length, type: 'key' });
    }

    const strRe = new RegExp(stringRegex.source, 'g');
    while ((m = strRe.exec(line)) !== null) {
      const isKey = parts.some(p => p.start === m!.index && p.type === 'key');
      if (!isKey) {
        parts.push({ start: m.index, end: m.index + m[0].length, type: 'string' });
      }
    }

    const numRe = new RegExp(numberRegex.source, 'g');
    while ((m = numRe.exec(line)) !== null) {
      const overlap = parts.some(p => m!.index >= p.start && m!.index < p.end);
      if (!overlap) {
        parts.push({ start: m.index, end: m.index + m[0].length, type: 'number' });
      }
    }

    for (const kw of ['true', 'false', 'null']) {
      let idx = line.indexOf(kw);
      while (idx !== -1) {
        const overlap = parts.some(p => idx >= p.start && idx < p.end);
        if (!overlap) {
          parts.push({ start: idx, end: idx + kw.length, type: kw === 'null' ? 'null' : 'boolean' });
        }
        idx = line.indexOf(kw, idx + 1);
      }
    }

    parts.sort((a, b) => a.start - b.start);

    let cursor = 0;
    for (const part of parts) {
      if (part.start > cursor) {
        nodes.push(line.slice(cursor, part.start));
      }
      const text = line.slice(part.start, part.end);
      const cls = `jhl-${part.type}`;
      nodes.push(<span key={`${i}-${part.start}`} className={cls}>{text}</span>);
      cursor = part.end;
    }
    if (cursor < line.length) {
      nodes.push(line.slice(cursor));
    }
  }
  return nodes;
}
