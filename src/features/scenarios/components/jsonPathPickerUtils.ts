export interface PathEntry {
  path: string;
  type: string;
  preview: string;
}

function collectPaths(value: unknown, prefix: string, out: PathEntry[]): void {
  if (value === null || value === undefined) {
    out.push({ path: prefix, type: 'null', preview: 'null' });
    return;
  }
  if (Array.isArray(value)) {
    out.push({ path: prefix, type: 'array', preview: `[${value.length} items]` });
    if (value.length > 0) {
      collectPaths(value[0], `${prefix}[0]`, out);
    }
    return;
  }
  if (typeof value === 'object') {
    out.push({ path: prefix, type: 'object', preview: `{${Object.keys(value).length} keys}` });
    for (const key of Object.keys(value)) {
      collectPaths((value as Record<string, unknown>)[key], `${prefix}.${key}`, out);
    }
    return;
  }
  const t = typeof value;
  const preview = t === 'string'
    ? `"${String(value).length > 30 ? String(value).slice(0, 30) + '…' : value}"`
    : String(value);
  out.push({ path: prefix, type: t, preview });
}

export function extractJsonPaths(json: string): PathEntry[] {
  try {
    const parsed = JSON.parse(json);
    const out: PathEntry[] = [];
    collectPaths(parsed, '$', out);
    return out;
  } catch {
    return [];
  }
}
