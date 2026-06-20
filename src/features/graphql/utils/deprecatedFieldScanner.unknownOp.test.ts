/**
 * Isolated coverage for getRootTypeForOp fallthrough (line 91).
 * Uses a dedicated vi.mock so deprecatedFieldScanner loads with a patched parse.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('graphql', async (importOriginal) => {
  const actual = await importOriginal<typeof import('graphql')>();
  const origParse = actual.parse;
  return {
    ...actual,
    parse: (source: Parameters<typeof origParse>[0], options?: Parameters<typeof origParse>[1]) => {
      const doc = origParse(source, options);
      return actual.visit(doc, {
        OperationDefinition(node) {
          return { ...node, operation: 'unknown' as typeof node.operation };
        },
      });
    },
  };
});

import { buildSchema, introspectionFromSchema } from 'graphql';
import { scanDeprecatedFieldUsages } from './deprecatedFieldScanner';

describe('scanDeprecatedFieldUsages — unknown operation type (line 91)', () => {
  it('returns empty usages when operation type is unrecognized', () => {
    const introspection = introspectionFromSchema(buildSchema(`
      type Query { user: User }
      type User { name: String @deprecated(reason: "use fullName") }
    `));
    const result = scanDeprecatedFieldUsages(introspection, [
      { id: 'i1', name: 'Op', operation: { query: 'query { user { name } }' } as never },
    ]);
    expect(result).toEqual([]);
  });
});
