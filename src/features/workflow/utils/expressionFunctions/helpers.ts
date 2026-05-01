export const s = (v: unknown): string => v == null ? '' : String(v);
export const n = (v: unknown): number => { const x = Number(v); return isNaN(x) ? 0 : x; };
