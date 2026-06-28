import { normalizeGraphqlEndpoint } from '../../../../adapters';

/** HTTP GraphQL endpoint for the Docker test server (port 4010). */
export const GQL_DEMO_HTTP = 'http://localhost:4010/graphql';
/**
 * Canonical connection id for GraphQL Studio history, snapshots, and mock config.
 * Web resolves loopback to 127.0.0.1; Tauri prefers localhost — must match Studio normalization.
 */
export const GQL_DEMO_CONNECTION_ID = normalizeGraphqlEndpoint(GQL_DEMO_HTTP);

/** All loopback variants that may hold legacy demo snapshot rows. */
export function gqlDemoSnapshotConnectionIds(): string[] {
  return [...new Set([
    GQL_DEMO_CONNECTION_ID,
    GQL_DEMO_HTTP,
    'http://localhost:4010/graphql',
    'http://127.0.0.1:4010/graphql',
  ])];
}
/** Template variable resolved from Environment Manager GraphQL tab. */
export const GQL_DEMO_VAR = '{{graphqlUrl}}';
/** Health probe URL for PrerequisiteGate. */
export const GQL_DEMO_HEALTH = 'http://localhost:4010/health';
/**
 * Tabs setup may visit (Environment Manager for demo env seeding).
 * Include on every GraphQL Studio lesson so useDemoShortcuts does not auto-exit live demo.
 */
export const GQL_STUDIO_LESSON_ALLOWED_TABS = ['environments', 'graphql-studio'];
/** Minimal query used in Lesson 1 — no variables required. */
export const GQL_HEALTH_QUERY = 'query { health }';

/** Parameterized query used in Lesson 2 — requires `$id` variable. */
export const GQL_USER_QUERY = `query GetUser($id: ID!) {
  user(id: $id) {
    id
    name
    email
  }
}`;
