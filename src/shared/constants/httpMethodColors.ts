/** Standard HTTP method colors used across the application. */
export const METHOD_COLORS: Record<string, string> = {
  GET: '#22c55e',
  POST: '#f59e0b',
  PUT: '#3b82f6',
  PATCH: '#8b5cf6',
  DELETE: '#ef4444',
};

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
