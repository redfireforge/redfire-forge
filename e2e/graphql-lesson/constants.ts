import { GQL } from '../../src/shared/selectors';

export const GQL1_LESSON = { name: 'Your First GraphQL Query', steps: 12 } as const;
export const GQL2_LESSON = { name: 'Variables & Arguments', steps: 16 } as const;
export const GQL3_LESSON = { name: 'Schema Exploration', steps: 9 } as const;
export const GQL4_LESSON = { name: 'Authentication & Headers', steps: 13 } as const;
export const GQL5_LESSON = { name: 'HTTPS, TLS & Certificates', steps: 18 } as const;
export const GQL6_LESSON = { name: 'Mutations — Create, Update, Delete', steps: 19 } as const;
export const GQL7_LESSON = { name: 'Subscriptions — Real-Time Data', steps: 15 } as const;
export const GQL8_LESSON = { name: 'Query Builder — Visual Operations', steps: 11 } as const;
export const GQL9_LESSON = { name: 'Collections & History', steps: 11 } as const;
export const GQL10_LESSON = { name: 'Export & Share Queries', steps: 7 } as const;
export const GQL11_LESSON = { name: 'Performance Tracing', steps: 8 } as const;
export const GQL12_LESSON = { name: 'Schema Diff & Breaking Changes', steps: 7 } as const;
export const GQL13_LESSON = { name: 'Mock Server', steps: 15 } as const;
export const GQL14_LESSON = { name: 'Multi-Tab Workspaces', steps: 12 } as const;
export const GQL15_LESSON = { name: 'Batch Execution', steps: 10 } as const;
export const GQL16_LESSON = { name: 'Workflow Integration', steps: 12 } as const;
export const GQL17_LESSON = { name: 'Workflow Runner & Results', steps: 9 } as const;
export const GQL18_LESSON = { name: 'Mutation Node in Workflow', steps: 16 } as const;
export const GQL19_LESSON = { name: 'Subscription Node in Workflow', steps: 9 } as const;

/** Bottom Auth panel selectors for GQL-4 / GQL-14 lesson walks (Slice 7.6 — Option D). */
export const GQL_LESSON_AUTH = {
  badge: GQL.AUTH_BADGE_BTN,
  bottomTab: GQL.BOTTOM_TAB_AUTH,
  panel: GQL.AUTH_PANEL,
  typeSelect: GQL.AUTH_TYPE_SELECT,
} as const;

/** Mock proxy endpoint (desktop / Node proxy on port 3001). */
export const GQL13_MOCK_HTTP = 'http://localhost:3001/api/graphql/mock';
export const GQL13_PROXY_HEALTH = 'http://localhost:3001/health';
export const GQL13_MOCK_CONFIG_URL = 'http://localhost:3001/api/graphql/mock/config';

/** TLS health probe for GQL-5 PrerequisiteGate (docker/graphql/tls). */
export const GQL_TLS_HEALTH = 'http://127.0.0.1:4444/health';
export const GQL_TLS_MTLS_HEALTH = 'http://127.0.0.1:4446/health';
export const GQL_TLS_HTTPS = 'https://localhost:4443/graphql';
export const GQL_TLS_MTLS_HTTPS = 'https://localhost:4445/graphql';

export const DEMO_ACTION_TIMEOUT = 180_000;
export const HISTORY_TIMEOUT = 300_000;
export const MUTATION_TIMEOUT = 300_000;
