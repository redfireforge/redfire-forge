/** Console log helpers for GraphQL workflow nodes — mirrors HTTP/Kafka detail level. */

export type GraphqlConsoleLogFn = (line: { prefix: string; text: string }) => void;

const DEFAULT_PREVIEW_LEN = 300;

export function previewForConsoleLog(value: unknown, maxLen = DEFAULT_PREVIEW_LEN): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  const raw = typeof value === 'string' ? value : JSON.stringify(value);
  if (!raw) return '';
  return raw.length > maxLen ? `${raw.slice(0, maxLen)}…` : raw;
}

/** Unwrap JSON-serialized scalars stored in workflow variables for readable console output. */
export function formatBindingValueForConsole(stored: string): string {
  const trimmed = stored.trim();
  if (!trimmed) return stored;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (typeof parsed === 'string' || typeof parsed === 'number' || typeof parsed === 'boolean') {
      return String(parsed);
    }
  } catch { /* keep raw */ }
  return stored;
}

export function logGraphqlVariables(
  label: string,
  log: GraphqlConsoleLogFn,
  variables: Record<string, unknown>,
): void {
  if (Object.keys(variables).length === 0) return;
  log({ prefix: '→', text: `[${label}]   Variables: ${previewForConsoleLog(variables)}` });
}

export function logGraphqlResponseData(
  label: string,
  log: GraphqlConsoleLogFn,
  opts: { httpStatus: number; durationMs: number; data?: unknown; errors?: unknown[] },
): void {
  log({ prefix: '←', text: `[${label}] HTTP ${opts.httpStatus} — ${opts.durationMs}ms` });
  if (opts.data !== undefined) {
    log({ prefix: '←', text: `[${label}]   Data: ${previewForConsoleLog(opts.data)}` });
  }
  if (opts.errors && opts.errors.length > 0) {
    log({ prefix: '!', text: `[${label}]   Errors: ${previewForConsoleLog(opts.errors)}` });
  }
}

export function logGraphqlSubscriptionMessage(
  label: string,
  log: GraphqlConsoleLogFn,
  index: number,
  payload: unknown,
): void {
  log({ prefix: '←', text: `[${label}]   Message ${index + 1}: ${previewForConsoleLog(payload)}` });
}

export function collectGraphqlBindingEntries(
  extracted: Record<string, string>,
  ctx: { get(name: string): string | undefined },
  variableNames: string[],
): Record<string, string> {
  const out = { ...extracted };
  for (const name of variableNames) {
    const trimmed = name.trim();
    if (!trimmed || out[trimmed] !== undefined) continue;
    const v = ctx.get(trimmed);
    if (v !== undefined) out[trimmed] = v;
  }
  return out;
}

export function logGraphqlVariableBindings(
  label: string,
  log: GraphqlConsoleLogFn,
  entries: Record<string, string>,
): void {
  for (const [k, v] of Object.entries(entries)) {
    if (!k.trim()) continue;
    log({ prefix: '#', text: `[${label}] ${k} = ${previewForConsoleLog(formatBindingValueForConsole(v), 120)}` });
  }
}

export function collectGraphqlNodeVariableNames(
  extractionRules: Array<{ variableName?: string }> | undefined,
  outputBindings: Array<{ variableName?: string; enabled?: boolean }> | undefined,
): string[] {
  const names: string[] = [];
  for (const r of extractionRules ?? []) {
    if (r.variableName?.trim()) names.push(r.variableName.trim());
  }
  for (const b of outputBindings ?? []) {
    if (b.enabled !== false && b.variableName?.trim()) names.push(b.variableName.trim());
  }
  return names;
}
