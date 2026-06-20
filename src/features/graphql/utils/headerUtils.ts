/**
 * headerUtils.ts — shared utilities for managing GraphQL header rows.
 *
 * Extracted to a separate module so GraphqlStudioPage and GraphqlHeadersPanel
 * can both import makeHeaderId without violating the
 * react-refresh/only-export-components ESLint rule.
 */

// Start the counter from the current Unix ms so IDs from different page
// sessions never collide with header IDs already persisted in localStorage.
let nextHeaderSeq = Date.now();

/**
 * Generates a stable, unique ID for a new GraphQL header row.
 * Called from both GraphqlHeadersPanel (add-row) and normalizeTab (migration).
 */
export function makeHeaderId(): string {
  return `gql-hdr-${nextHeaderSeq++}`;
}
