import type { DataSource, SharedDataSourceFetchConfig } from '@shared/types';

export type MappingKind = 'path' | 'param' | 'header' | 'body' | 'validate';

export interface MappingWarning {
  type: Exclude<MappingKind, 'validate'>;
  mapping: string;
  message: string;
}

export interface MappingSummary {
  counts: Record<MappingKind, number>;
  warnings: MappingWarning[];
}

export function extractTemplateVariables(value: string): string[] {
  if (!value) return [];
  const vars: string[] = [];
  const re = /\{\{\s*([^{}\s]+)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(value)) !== null) {
    const v = m[1].trim();
    if (v && !vars.includes(v)) vars.push(v);
  }
  return vars;
}

export function extractQueryKeys(url: string): string[] {
  if (!url) return [];
  const qIdx = url.indexOf('?');
  if (qIdx === -1) return [];
  const hashIdx = url.indexOf('#', qIdx);
  const query = (hashIdx === -1 ? url.slice(qIdx + 1) : url.slice(qIdx + 1, hashIdx)).trim();
  if (!query) return [];

  const keys = new Set<string>();
  for (const part of query.split('&')) {
    if (!part) continue;
    const eqIdx = part.indexOf('=');
    const rawKey = (eqIdx === -1 ? part : part.slice(0, eqIdx)).trim();
    if (!rawKey) continue;
    try {
      keys.add(decodeURIComponent(rawKey));
    } catch {
      keys.add(rawKey);
    }
  }
  return Array.from(keys);
}

export function buildMappingSummary(fetchConfig: SharedDataSourceFetchConfig | undefined, dataSource: DataSource | undefined): MappingSummary {
  const counts: Record<MappingKind, number> = {
    path: 0,
    param: 0,
    header: 0,
    body: 0,
    validate: 0,
  };
  const warnings: MappingWarning[] = [];

  const columns = dataSource?.columns ?? [];
  if (columns.length === 0) {
    return { counts, warnings };
  }

  const url = fetchConfig?.url ?? '';
  const pathOnly = url.split('?')[0] ?? '';
  const pathVarSet = new Set<string>([
    ...extractTemplateVariables(pathOnly),
    ...((fetchConfig?.pathVariables ?? []).map(v => v.variableName).filter(Boolean)),
  ]);
  const queryKeySet = new Set<string>(extractQueryKeys(url));
  const headerKeySet = new Set<string>((fetchConfig?.headers ?? []).map(h => h.key.trim().toLowerCase()).filter(Boolean));
  const bodyVarSet = new Set<string>(extractTemplateVariables(fetchConfig?.body ?? ''));

  for (const col of columns) {
    counts[col.type] += 1;
    const mapping = (col.mapping ?? '').trim();
    const name = (col.name ?? '').trim();
    if (!mapping) continue;

    if (col.type === 'path' && !pathVarSet.has(mapping) && (!name || !pathVarSet.has(name))) {
      warnings.push({
        type: 'path',
        mapping,
        message: `path:${mapping} has no matching URL placeholder`,
      });
    }

    if (col.type === 'param' && !queryKeySet.has(mapping) && (!name || !queryKeySet.has(name))) {
      warnings.push({
        type: 'param',
        mapping,
        message: `param:${mapping} has no matching query key`,
      });
    }

    if (col.type === 'header' && !headerKeySet.has(mapping.toLowerCase())) {
      warnings.push({
        type: 'header',
        mapping,
        message: `header:${mapping} has no matching request header key`,
      });
    }

    if (col.type === 'body' && !bodyVarSet.has(mapping)) {
      warnings.push({
        type: 'body',
        mapping,
        message: `body:${mapping} has no matching body placeholder`,
      });
    }
  }

  return { counts, warnings };
}
