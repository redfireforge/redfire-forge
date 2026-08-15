export interface HeaderDraftRow {
  id: string;
  name: string;
  value: string;
}

let nextRowId = 0;

export function resetHeaderDraftRowIds(): void {
  nextRowId = 0;
}

export function createHeaderDraftRow(name = '', value = ''): HeaderDraftRow {
  nextRowId += 1;
  return { id: `hdr-${nextRowId}`, name, value };
}

/** Parse `Name: value` lines. A line without `:` becomes a name-only row. */
export function headerTextToRows(text: string): HeaderDraftRow[] {
  const rows: HeaderDraftRow[] = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    const idx = line.indexOf(':');
    if (idx > 0) {
      rows.push(createHeaderDraftRow(line.slice(0, idx).trim(), line.slice(idx + 1).trimStart()));
    } else {
      rows.push(createHeaderDraftRow(line.trim(), ''));
    }
  }
  return rows.length > 0 ? rows : [createHeaderDraftRow()];
}

/** Skip unnamed rows so a blank table line does not become a header. */
export function headerRowsToText(rows: HeaderDraftRow[]): string {
  return rows
    .filter(r => r.name.trim())
    .map(r => `${r.name.trim()}: ${r.value}`)
    .join('\n');
}

export function countNamedHeaderRows(rows: HeaderDraftRow[]): number {
  return rows.filter(r => r.name.trim()).length;
}

export function findHeaderRowMatches(rows: HeaderDraftRow[], query: string): number[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return rows.reduce<number[]>((acc, row, i) => {
    if (row.name.toLowerCase().includes(needle) || row.value.toLowerCase().includes(needle)) {
      acc.push(i);
    }
    return acc;
  }, []);
}
