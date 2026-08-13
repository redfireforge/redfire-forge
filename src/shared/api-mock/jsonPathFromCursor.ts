import { resolveSimpleJsonPath } from './predicateEvaluatorHelpers';

export interface JsonPathFromCursorResult {
  path: string;
  value: string;
}

interface PathSpan {
  path: string;
  /** Inclusive start index in the JSON source. */
  start: number;
  /** Exclusive end index in the JSON source. */
  end: number;
}

/** Format a resolved JSON value for Expected / Resolved UI (runtime String() parity for scalars). */
export function formatJsonPathValue(resolved: unknown): string {
  if (resolved === undefined) return '';
  if (resolved === null) return 'null';
  if (typeof resolved === 'string') return resolved;
  if (typeof resolved === 'number' || typeof resolved === 'boolean') return String(resolved);
  return JSON.stringify(resolved);
}

function keySegment(key: string): string {
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return key;
  return `[${key}]`;
}

function joinPath(segments: string[]): string {
  let dotPath = '$';
  for (const seg of segments) {
    if (seg.startsWith('[')) dotPath += seg;
    else dotPath += '.' + seg;
  }
  return dotPath;
}

function toResult(parsed: unknown, path: string): JsonPathFromCursorResult {
  return { path, value: formatJsonPathValue(resolveSimpleJsonPath(parsed, path)) };
}

function pickTightest(spans: PathSpan[], predicate: (span: PathSpan) => boolean): PathSpan | null {
  let best: PathSpan | null = null;
  for (const span of spans) {
    if (!predicate(span)) continue;
    const size = span.end - span.start;
    if (!best || size < best.end - best.start) best = span;
  }
  return best;
}

/**
 * Collect source spans for every JSON value / property so selection can pick the
 * tightest node that contains the highlight (select-all → `$`, not a deep leaf).
 */
function collectPathSpans(json: string): PathSpan[] | null {
  const spans: PathSpan[] = [];
  let cursor = 0;
  const segments: string[] = [];

  function skipWhitespace() { while (cursor < json.length && /\s/.test(json[cursor])) cursor++; }

  function readString(): string {
    if (json[cursor] !== '"') return '';
    cursor++;
    let result = '';
    while (cursor < json.length && json[cursor] !== '"') {
      if (json[cursor] === '\\') {
        const escaped = json[cursor + 1];
        if (escaped === undefined) { cursor++; break; }
        if (escaped === '"' || escaped === '\\' || escaped === '/') { result += escaped; }
        else if (escaped === 'n') { result += '\n'; }
        else if (escaped === 'r') { result += '\r'; }
        else if (escaped === 't') { result += '\t'; }
        else if (escaped === 'u' && cursor + 5 < json.length) {
          const hex = json.slice(cursor + 2, cursor + 6);
          const code = Number.parseInt(hex, 16);
          result += Number.isFinite(code) ? String.fromCharCode(code) : json.slice(cursor, cursor + 6);
          cursor += 6;
          continue;
        } else {
          result += escaped;
        }
        cursor += 2;
      } else {
        result += json[cursor];
        cursor++;
      }
    }
    cursor++;
    return result;
  }

  function readPrimitive(): void {
    while (cursor < json.length && !/[,\]}\s]/.test(json[cursor])) cursor++;
  }

  function walkValue(): boolean {
    skipWhitespace();
    const start = cursor;
    const path = joinPath(segments);

    if (json[cursor] === '"') {
      readString();
      spans.push({ path, start, end: cursor });
      return true;
    }
    if (json[cursor] === '{') {
      if (!walkObject()) return false;
      spans.push({ path, start, end: cursor });
      return true;
    }
    if (json[cursor] === '[') {
      if (!walkArray()) return false;
      spans.push({ path, start, end: cursor });
      return true;
    }
    if (cursor >= json.length) return false;
    readPrimitive();
    spans.push({ path, start, end: cursor });
    return true;
  }

  function walkObject(): boolean {
    if (json[cursor] !== '{') return false;
    cursor++; // {
    skipWhitespace();
    while (cursor < json.length && json[cursor] !== '}') {
      skipWhitespace();
      if (json[cursor] === ',') { cursor++; skipWhitespace(); continue; }
      if (json[cursor] === '}') break;
      if (json[cursor] !== '"') return false;

      const propStart = cursor;
      const key = readString();
      skipWhitespace();
      if (json[cursor] === ':') cursor++;
      skipWhitespace();
      const beforeValue = cursor;

      segments.push(keySegment(key));
      if (!walkValue()) return false;
      let propEnd = cursor;
      // Include trailing comma so selecting `"key": value,` still binds to the property.
      if (json[cursor] === ',') propEnd = cursor + 1;
      const path = joinPath(segments);

      spans.push({ path, start: propStart, end: propEnd });
      // Key / colon region (same path) — tight target when clicking the key.
      if (beforeValue > propStart) {
        spans.push({ path, start: propStart, end: beforeValue });
      }
      segments.pop();
      skipWhitespace();
    }
    if (cursor < json.length && json[cursor] === '}') cursor++;
    return true;
  }

  function walkArray(): boolean {
    if (json[cursor] !== '[') return false;
    cursor++; // [
    skipWhitespace();
    let idx = 0;
    while (cursor < json.length && json[cursor] !== ']') {
      skipWhitespace();
      if (json[cursor] === ',') { cursor++; skipWhitespace(); idx++; continue; }
      if (json[cursor] === ']') break;

      segments.push(`[${idx}]`);
      if (!walkValue()) return false;
      if (json[cursor] === ',') {
        // Trailing comma after an element binds to that element path.
        spans.push({
          path: joinPath(segments),
          start: cursor,
          end: cursor + 1,
        });
      }
      segments.pop();
      skipWhitespace();
    }
    if (cursor < json.length && json[cursor] === ']') cursor++;
    return true;
  }

  skipWhitespace();
  if (!walkValue()) return null;
  return spans;
}

/**
 * Given pretty-printed JSON and a cursor offset, derive the JSONPath for the
 * key or value at that position.
 */
export function jsonPathFromCursorOffset(json: string, offset: number): JsonPathFromCursorResult | null {
  let parsed: unknown;
  try { parsed = JSON.parse(json); } catch { return null; }
  if (offset < 0 || offset > json.length) return null;

  const spans = collectPathSpans(json);
  if (!spans) return null;

  const chosen = pickTightest(spans, (span) => offset >= span.start && offset < span.end);
  if (!chosen) return null;
  return toResult(parsed, chosen.path);
}

/**
 * Resolve JSONPath from an editor selection.
 * - Collapsed caret → tightest node under the caret
 * - Range → tightest node whose source span fully contains the selection
 *   (select-all → `$`, not a deep leaf like `$.items`)
 */
export function jsonPathFromSelection(
  json: string,
  selectionStart: number,
  selectionEnd: number = selectionStart,
): JsonPathFromCursorResult | null {
  let parsed: unknown;
  try { parsed = JSON.parse(json); } catch { return null; }

  const start = Math.max(0, Math.min(selectionStart, selectionEnd));
  const end = Math.max(selectionStart, selectionEnd);
  if (start === end) return jsonPathFromCursorOffset(json, start);

  const spans = collectPathSpans(json);
  if (!spans) return null;

  // Trim whitespace-only edges so select-all still matches the root value span.
  let selStart = start;
  let selEnd = end;
  while (selStart < selEnd && /\s/.test(json[selStart])) selStart++;
  while (selEnd > selStart && /\s/.test(json[selEnd - 1])) selEnd--;
  if (selStart >= selEnd) return jsonPathFromCursorOffset(json, start);

  const hit = pickTightest(spans, (span) => span.start <= selStart && selEnd <= span.end);
  if (!hit) return jsonPathFromCursorOffset(json, start);
  return toResult(parsed, hit.path);
}
