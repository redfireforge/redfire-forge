/**
 * Shared type definitions for GraphQL Collections sub-components.
 * Extracted from GraphqlCollections.tsx to reduce its line count.
 */

export type ContextMenuState =
  | { type: 'collection'; id: string; name: string; x: number; y: number }
  | { type: 'folder'; id: string; name: string; x: number; y: number }
  | { type: 'item'; id: string; name: string; x: number; y: number };
