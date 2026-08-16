/** Standard HTTP method colors used across the application. */
export const METHOD_COLORS: Record<string, string> = {
  GET: '#22c55e',
  POST: '#f59e0b',
  PUT: '#3b82f6',
  PATCH: '#8b5cf6',
  DELETE: '#ef4444',
};

const EXTRA_METHOD_COLORS: Record<string, string> = {
  ANY: '#94a3b8',
  HEAD: '#64748b',
  OPTIONS: '#78716c',
  TRACE: '#14b8a6',
};

export const METHOD_DESCRIPTIONS: Record<string, string> = {
  GET: 'Retrieve data',
  POST: 'Create resource',
  PUT: 'Replace resource',
  PATCH: 'Partial update',
  DELETE: 'Remove resource',
  ANY: 'Match any method',
  HEAD: 'Headers only',
  OPTIONS: 'Allowed methods',
  TRACE: 'Echo request',
};

export function methodSwatch(method: string): string {
  return METHOD_COLORS[method] ?? EXTRA_METHOD_COLORS[method] ?? '#94a3b8';
}

export function httpMethodSelectOptions(
  methods: readonly string[],
  opts?: { detail?: boolean },
): Array<{ value: string; label: string; detail?: string; swatch: string }> {
  return methods.map(m => ({
    value: m,
    label: m,
    ...(opts?.detail === false ? {} : { detail: METHOD_DESCRIPTIONS[m] ?? '' }),
    swatch: methodSwatch(m),
  }));
}

/** Swagger-UI–style colors used in API catalog views. */
export const SWAGGER_METHOD_COLORS: Record<string, string> = {
  GET: '#49cc90',
  POST: '#fca130',
  PUT: '#61affe',
  PATCH: '#50e3c2',
  DELETE: '#f93e3e',
};

/** Workflow node colors (POST=blue, PUT=amber to match node styling). */
export const WORKFLOW_METHOD_COLORS: Record<string, string> = {
  GET: '#22c55e',
  POST: '#3b82f6',
  PUT: '#f59e0b',
  PATCH: '#a855f7',
  DELETE: '#ef4444',
};
