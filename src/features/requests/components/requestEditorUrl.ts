import type { ParamEntry } from './ParamsEditor';

export function buildRequestEditorUrl(base: string, params: ParamEntry[]): string {
  const q = params.filter(p => p.enabled).map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&');
  if (!q) return base;
  return base.includes('?') ? `${base}&${q}` : `${base}?${q}`;
}
