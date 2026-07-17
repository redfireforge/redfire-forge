import { buildClientSchema, validate, parse as gqlParseDoc } from 'graphql';
import type { IntrospectionQuery } from 'graphql';
import type { GraphqlCollectionItem } from '../../../shared/types/graphql';

/** Returns collection item ids whose operations fail schema validation. */
export function computeInvalidCollectionItemIds(
  rawIntrospection: unknown,
  items: GraphqlCollectionItem[],
): Set<string> {
  if (!rawIntrospection || items.length === 0) return new Set();
  let schema: ReturnType<typeof buildClientSchema>;
  try {
    schema = buildClientSchema(rawIntrospection as IntrospectionQuery);
  } catch {
    return new Set();
  }
  const invalid = new Set<string>();
  for (const item of items) {
    if (!item.operation.query.trim()) continue;
    try {
      const errors = validate(schema, gqlParseDoc(item.operation.query));
      if (errors.length > 0) invalid.add(item.id);
    } catch {
      invalid.add(item.id);
    }
  }
  return invalid;
}
