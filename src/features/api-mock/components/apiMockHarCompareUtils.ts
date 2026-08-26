/** A single diff item comparing one field/line in original vs mock. */
export interface DiffItem {
  key: string;
  original: string | undefined;
  mock: string | undefined;
  /** 'match' | 'mismatch' | 'template' (mock uses {{helper}}) | 'only-original' | 'only-mock' */
  status: 'match' | 'mismatch' | 'template' | 'only-original' | 'only-mock';
}

const TEMPLATE_RE = /\{\{[^}]+\}\}/;

function hasTemplate(value: string): boolean {
  return TEMPLATE_RE.test(value);
}

function tryParseJson(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // not a JSON object
  }
  return null;
}

/** Compare two bodies. Returns a flat list of DiffItem entries for display. */
export function diffBodies(original: string | undefined, mock: string | undefined): DiffItem[] {
  if (!original && !mock) return [];

  const origObj = original ? tryParseJson(original) : null;
  const mockObj = mock ? tryParseJson(mock) : null;

  if (origObj && mockObj) {
    const allKeys = new Set([...Object.keys(origObj), ...Object.keys(mockObj)]);
    const items: DiffItem[] = [];
    for (const key of Array.from(allKeys).sort()) {
      const origVal = origObj[key] !== undefined ? String(JSON.stringify(origObj[key])) : undefined;
      const mockVal = mockObj[key] !== undefined ? String(JSON.stringify(mockObj[key])) : undefined;
      if (origVal === undefined) {
        items.push({ key, original: undefined, mock: mockVal, status: 'only-mock' });
      } else if (mockVal === undefined) {
        items.push({ key, original: origVal, mock: undefined, status: 'only-original' });
      } else if (origVal === mockVal) {
        items.push({ key, original: origVal, mock: mockVal, status: 'match' });
      } else if (mockVal && hasTemplate(mockVal)) {
        items.push({ key, original: origVal, mock: mockVal, status: 'template' });
      } else {
        items.push({ key, original: origVal, mock: mockVal, status: 'mismatch' });
      }
    }
    return items;
  }

  // Fallback: line-by-line text comparison
  const origLines = (original ?? '').split('\n');
  const mockLines = (mock ?? '').split('\n');
  const maxLen = Math.max(origLines.length, mockLines.length);
  const items: DiffItem[] = [];
  for (let i = 0; i < maxLen; i++) {
    const origLine = origLines[i];
    const mockLine = mockLines[i];
    if (origLine === undefined) {
      items.push({ key: String(i + 1), original: undefined, mock: mockLine, status: 'only-mock' });
    } else if (mockLine === undefined) {
      items.push({ key: String(i + 1), original: origLine, mock: undefined, status: 'only-original' });
    } else if (origLine === mockLine) {
      items.push({ key: String(i + 1), original: origLine, mock: mockLine, status: 'match' });
    } else if (hasTemplate(mockLine)) {
      items.push({ key: String(i + 1), original: origLine, mock: mockLine, status: 'template' });
    } else {
      items.push({ key: String(i + 1), original: origLine, mock: mockLine, status: 'mismatch' });
    }
  }
  return items;
}
