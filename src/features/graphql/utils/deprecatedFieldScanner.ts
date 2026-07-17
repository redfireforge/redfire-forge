/**
 * deprecatedFieldScanner.ts — Phase 3D (task 3D-7)
 *
 * Scans collection item queries for fields that are @deprecated in the
 * current schema. Used by Schema Explorer to display a "Deprecated field
 * usage" section.
 *
 * Re-scan triggers (called by GraphqlStudioPage):
 *  (a) After each successful schema introspection
 *  (b) When a schema diff detects changes
 *  (c) When a collection item is saved or updated
 */

import {
  buildClientSchema,
  parse,
  visit,
  isObjectType,
  isInterfaceType,
  type IntrospectionQuery,
  type OperationDefinitionNode,
} from 'graphql';
import type { GraphqlCollectionItem } from '../../../shared/types/graphql';

export interface DeprecatedFieldUsage {
  /** Collection item id */
  itemId: string;
  /** Collection item label / name */
  itemName: string;
  /** Type.fieldName that is deprecated */
  fieldPath: string;
  /** The @deprecated reason string from the schema */
  deprecationReason: string;
}

/**
 * Scans all collection items and returns usages of @deprecated fields.
 *
 * @param introspectionResult — raw introspection result from the server
 * @param items               — flattened list of all collection items
 */
export function scanDeprecatedFieldUsages(
  introspectionResult: unknown,
  items: Array<{ id: string; name: string; operation: GraphqlCollectionItem['operation'] }>,
): DeprecatedFieldUsage[] {
  let schema: ReturnType<typeof buildClientSchema>;
  try {
    schema = buildClientSchema(introspectionResult as unknown as IntrospectionQuery);
  } catch {
    return [];
  }

  // Build a flat map: "TypeName.fieldName" → deprecationReason
  const deprecatedFields = new Map<string, string>();
  const typeMap = schema.getTypeMap();
  for (const typeName of Object.keys(typeMap)) {
    if (typeName.startsWith('__')) continue;
    const type = typeMap[typeName];
    if (!isObjectType(type) && !isInterfaceType(type)) continue;
    for (const [fieldName, field] of Object.entries(type.getFields())) {
      if (field.deprecationReason != null) {
        deprecatedFields.set(`${typeName}.${fieldName}`, field.deprecationReason || 'Deprecated');
      }
    }
  }

  if (deprecatedFields.size === 0) return [];

  const usages: DeprecatedFieldUsage[] = [];

  for (const item of items) {
    const query = item.operation.query?.trim();
    if (!query) continue;

    let doc;
    try {
      doc = parse(query);
    } catch {
      continue;
    }

    // Track the current type stack as we traverse the query AST
    // We need to resolve which GraphQL type each selection set belongs to.
    // Use a stack of type names; start with Query/Mutation/Subscription root.
    const typeStack: (string | null)[] = [];

    const getRootTypeForOp = (node: OperationDefinitionNode): string | null => {
      if (node.operation === 'query')        return schema.getQueryType()?.name ?? null;
      if (node.operation === 'mutation')     return schema.getMutationType()?.name ?? null;
      if (node.operation === 'subscription') return schema.getSubscriptionType()?.name ?? null;
      return null;
    };

    const itemUsages = new Set<string>(); // avoid duplicates per item

    visit(doc, {
      OperationDefinition: {
        enter(node) { typeStack.push(getRootTypeForOp(node)); },
        leave() { typeStack.pop(); },
      },
      Field: {
        enter(node) {
          const parentTypeName = typeStack[typeStack.length - 1];
          if (parentTypeName) {
            const fieldKey = `${parentTypeName}.${node.name.value}`;
            const reason = deprecatedFields.get(fieldKey);
            if (reason && !itemUsages.has(fieldKey)) {
              itemUsages.add(fieldKey);
              usages.push({
                itemId: item.id,
                itemName: item.name,
                fieldPath: fieldKey,
                deprecationReason: reason,
              });
            }

            // Push the child type for nested selection sets
            const parentType = typeMap[parentTypeName];
            if (isObjectType(parentType) || isInterfaceType(parentType)) {
              const childField = parentType.getFields()[node.name.value];
              const childTypeName = unwrapType(childField?.type);
              typeStack.push(childTypeName);
            } else {
              typeStack.push(null);
            }
          } else {
            typeStack.push(null);
          }
        },
        leave() { typeStack.pop(); },
      },
      InlineFragment: {
        enter(node) {
          const typeCond = node.typeCondition?.name.value;
          typeStack.push(typeCond ?? (typeStack[typeStack.length - 1] ?? null));
        },
        leave() { typeStack.pop(); },
      },
      FragmentDefinition: {
        enter(node) {
          typeStack.push(node.typeCondition.name.value);
        },
        leave() { typeStack.pop(); },
      },
    });
  }

  return usages;
}

/** Unwrap NonNull / List wrappers to get the named type */
function unwrapType(type: unknown): string | null {
  if (!type) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let t: any = type;
  while (t.ofType) t = t.ofType;
  return t.name ?? null;
}
