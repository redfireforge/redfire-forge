/** Monaco-style line/column position (1-based). */
export interface EditorPosition {
  lineNumber: number;
  column: number;
}

const OPERATION_RE = /\b(query|mutation|subscription)\b[^{]*\{/;

export function offsetToPosition(text: string, offset: number): EditorPosition {
  let lineNumber = 1;
  let column = 1;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text[i] === '\n') {
      lineNumber++;
      column = 1;
    } else {
      column++;
    }
  }
  return { lineNumber, column };
}

export function positionToOffset(text: string, pos: EditorPosition): number {
  const lines = text.split('\n');
  let offset = 0;
  for (let i = 0; i < pos.lineNumber - 1; i++) {
    offset += (lines[i]?.length ?? 0) + 1;
  }
  return offset + pos.column - 1;
}

function findMatchingCloseBrace(text: string, openIndex: number): number {
  let depth = 0;
  for (let i = openIndex; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return text.length;
}

export function isInsideSelectionSet(
  _text: string,
  cursorOffset: number,
  openBrace: number,
  closeBrace: number,
): boolean {
  if (cursorOffset <= openBrace || cursorOffset >= closeBrace) return false;
  return true;
}

export function defaultInsertInsideBlock(text: string, openBrace: number, closeBrace: number): EditorPosition {
  const openPos = offsetToPosition(text, openBrace);
  const closePos = offsetToPosition(text, closeBrace);
  const lines = text.split('\n');
  const openLine = lines[openPos.lineNumber - 1] ?? '';
  const firstInnerLine = openPos.lineNumber + (openLine.trimEnd().endsWith('{') ? 1 : 0);

  for (let lineIdx = firstInnerLine - 1; lineIdx < closePos.lineNumber - 1; lineIdx++) {
    const line = lines[lineIdx];
    if (line === undefined) continue;
    if (line.trim() === '') {
      const indent = line.match(/^(\s*)/)![1];
      const column = Math.max(indent.length, 1) + 1;
      return { lineNumber: lineIdx + 1, column };
    }
  }

  const closeLineIdx = closePos.lineNumber - 1;
  const prevLine = lines[closeLineIdx - 1] ?? '';
  const baseIndent = prevLine.match(/^(\s*)/)![1];
  const indent = baseIndent.length >= 2 ? baseIndent : '  ';
  return { lineNumber: closePos.lineNumber, column: indent.length + 1 };
}

/**
 * Resolve where a schema "Try →" field should be inserted.
 * When the cursor is outside the operation selection set (e.g. line 1 col 1 on
 * `query {\\n  \\n}`), inserts inside the braces instead of before `query`.
 */
export function resolveFieldInsertPosition(
  text: string,
  cursor: EditorPosition,
): EditorPosition {
  const match = OPERATION_RE.exec(text);
  if (!match || match.index === undefined) return cursor;

  const openBrace = match.index + match[0].length - 1;
  const closeBrace = findMatchingCloseBrace(text, openBrace);
  const cursorOffset = positionToOffset(text, cursor);

  if (isInsideSelectionSet(text, cursorOffset, openBrace, closeBrace)) {
    return cursor;
  }

  return defaultInsertInsideBlock(text, openBrace, closeBrace);
}
