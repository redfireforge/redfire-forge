/**
 * GraphQL query parsing and Monaco model URI helpers — no Monaco imports.
 * Shared by tabPersistence, demo workspace, and monacoGraphqlSetup.
 */

export interface ExtractedOperation {
  name: string;
  type: 'query' | 'mutation' | 'subscription';
}

/** Stable Monaco model URI for an operation tab. */
export function buildModelUri(tabId: string): string {
  return `inmemory://graphql/${tabId}`;
}

/** Stable Monaco model URI for a tab's variables JSON editor. */
export function buildVarsModelUri(tabId: string): string {
  return `inmemory://graphql-vars/${tabId}`;
}

/**
 * Extracts named operations from a GraphQL document string using regex.
 * Returns an empty array for anonymous operations.
 */
export function extractOperations(query: string): ExtractedOperation[] {
  if (!query.trim()) return [];
  const ops: ExtractedOperation[] = [];
  const stripped = query.replace(/#[^\n]*/g, '').replace(/"""[\s\S]*?"""/g, '');
  const pattern = /(?:^|\s)(query|mutation|subscription)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(stripped)) !== null) {
    ops.push({
      type: match[1] as 'query' | 'mutation' | 'subscription',
      name: match[2],
    });
  }
  return ops;
}

/** Returns the first operation name, or "Untitled" for anonymous operations. */
export function deriveTabLabel(query: string): string {
  const ops = extractOperations(query);
  return ops.length > 0 ? ops[0].name : 'Untitled';
}

/**
 * Resolves the GraphQL operationName to send on the wire.
 * Returns undefined for anonymous documents or when the stored name does not
 * appear in the query (e.g. tab labels saved as operation.name by mistake).
 */
export function resolveGraphqlRequestOperationName(
  query: string,
  storedName?: string | null,
): string | undefined {
  const ops = extractOperations(query);
  if (ops.length === 0) return undefined;
  if (storedName && ops.some((o) => o.name === storedName)) return storedName;
  if (ops.length === 1) return ops[0].name;
  return undefined;
}

/** Derives the primary operation type from the query text. */
export function deriveOperationType(
  query: string,
): 'query' | 'mutation' | 'subscription' | undefined {
  const ops = extractOperations(query);
  if (ops.length > 0) return ops[0].type;

  const stripped = query.replace(/#[^\n]*/g, '').trim();
  if (!stripped) return undefined;
  if (stripped.startsWith('{')) return 'query';

  const anonMatch = /^(query|mutation|subscription)\s*[({]/.exec(stripped);
  if (anonMatch) return anonMatch[1] as 'query' | 'mutation' | 'subscription';

  return undefined;
}
