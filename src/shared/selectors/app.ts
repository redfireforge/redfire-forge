// ─── App-level Navigation ───────────────────────────────────────
export const APP = {
  AB_SETTINGS:         '[data-testid="ab-settings"]',
  AB_PROTOCOLS:        '[data-testid="ab-protocols"]',
  NAV_TAB_ENVS:        '[data-testid="nav-tab-environments"]',
  NAV_TAB_WS:          '[data-testid="nav-tab-websocket-studio"]',
  NAV_TAB_SSE:         '[data-testid="nav-tab-sse-studio"]',
  NAV_TAB_GQL:         '[data-testid="nav-tab-graphql-studio"]',
  ENV_MANAGER:         '.env-manager',
  SVC_ENV_TABLE:       '.svc-env-table',
  HEADER_SELECTORS:    '[data-testid="header-selectors"]',
  HEADER_ENV_SELECT:   '[data-testid="header-env-select"]',
  HEADER_SVC_SELECT:   '[data-testid="header-svc-select"]',
} as const;
