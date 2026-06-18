/**
 * schemaParser.ts
 *
 * Converts a raw GraphQL introspection result into a structured GraphqlSchemaInfo
 * that can be displayed in the Schema Explorer UI.
 *
 * Uses the `graphql` npm package (buildClientSchema, printSchema) for accurate
 * type resolution and SDL generation.
 */

import {
  buildClientSchema,
  printSchema,
  printType,
  isObjectType,
  isInputObjectType,
  isEnumType,
  isInterfaceType,
  isUnionType,
  isScalarType,
} from 'graphql';
import type { IntrospectionQuery } from 'graphql';
import type {
  GraphqlSchemaInfo,
  GraphqlTypeNode,
  GraphqlFieldNode,
  GraphqlArgNode,
} from '../../../shared/types/graphql';

// Built-in scalar names excluded from the displayed type list
const BUILT_IN_SCALARS = new Set(['String', 'Int', 'Float', 'Boolean', 'ID']);

/**
 * Converts an introspection response `data` object into a navigable GraphqlSchemaInfo.
 *
 * @param introspectionData - The raw `data` field from a GraphQL introspection response,
 *   i.e. an object with `__schema: { ... }`. Pass `response.data` directly.
 * @returns Parsed schema info including types, SDL, and root type names.
 * @throws If introspectionData is not a valid introspection result.
 */
export function parseIntrospectionResult(
  introspectionData: Record<string, unknown>,
): GraphqlSchemaInfo {
  const schema = buildClientSchema(introspectionData as unknown as IntrospectionQuery);
  const sdl = printSchema(schema);
  const typeMap = schema.getTypeMap();

  const types: GraphqlTypeNode[] = [];

  for (const [name, type] of Object.entries(typeMap)) {
    // Skip built-in introspection types (__Schema, __Type, __Field, etc.)
    if (name.startsWith('__')) continue;
    // Skip built-in scalar types (shown separately by default in all tools)
    if (BUILT_IN_SCALARS.has(name)) continue;

    if (isObjectType(type)) {
      const rawFields = Object.values(type.getFields());
      const fields: GraphqlFieldNode[] = rawFields.map((f) => ({
        name: f.name,
        type: String(f.type),
        description: f.description ?? undefined,
        args: f.args.map((a): GraphqlArgNode => ({
          name: a.name,
          type: String(a.type),
          description: a.description ?? undefined,
          defaultValue: a.defaultValue !== undefined ? String(a.defaultValue) : undefined,
        })),
        isDeprecated: Boolean(f.deprecationReason),
        deprecationReason: f.deprecationReason ?? undefined,
      }));
      types.push({
        name,
        kind: 'OBJECT',
        description: type.description ?? undefined,
        fields,
        interfaces: type.getInterfaces().map((i) => i.name),
        sdlFragment: printType(type),
      });
    } else if (isInputObjectType(type)) {
      const rawFields = Object.values(type.getFields());
      const fields: GraphqlFieldNode[] = rawFields.map((f) => ({
        name: f.name,
        type: String(f.type),
        description: f.description ?? undefined,
        isDeprecated: Boolean((f as { deprecationReason?: string | null }).deprecationReason),
        deprecationReason: (f as { deprecationReason?: string | null }).deprecationReason ?? undefined,
      }));
      types.push({
        name,
        kind: 'INPUT_OBJECT',
        description: type.description ?? undefined,
        fields,
        sdlFragment: printType(type),
      });
    } else if (isEnumType(type)) {
      types.push({
        name,
        kind: 'ENUM',
        description: type.description ?? undefined,
        enumValues: type.getValues().map((v) => v.name),
        sdlFragment: printType(type),
      });
    } else if (isInterfaceType(type)) {
      const rawFields = Object.values(type.getFields());
      const fields: GraphqlFieldNode[] = rawFields.map((f) => ({
        name: f.name,
        type: String(f.type),
        description: f.description ?? undefined,
        args: f.args.map((a): GraphqlArgNode => ({
          name: a.name,
          type: String(a.type),
          description: a.description ?? undefined,
          defaultValue: a.defaultValue !== undefined ? String(a.defaultValue) : undefined,
        })),
        isDeprecated: Boolean(f.deprecationReason),
        deprecationReason: f.deprecationReason ?? undefined,
      }));
      types.push({
        name,
        kind: 'INTERFACE',
        description: type.description ?? undefined,
        fields,
        possibleTypes: (schema.getPossibleTypes(type) ?? []).map((t) => t.name),
        sdlFragment: printType(type),
      });
    } else if (isUnionType(type)) {
      types.push({
        name,
        kind: 'UNION',
        description: type.description ?? undefined,
        possibleTypes: type.getTypes().map((t) => t.name),
        sdlFragment: printType(type),
      });
    } else if (isScalarType(type)) {
      types.push({
        name,
        kind: 'SCALAR',
        description: type.description ?? undefined,
        sdlFragment: printType(type),
      });
    }
  }

  // Sort alphabetically within each kind for consistent display order
  types.sort((a, b) => {
    if (a.kind !== b.kind) {
      const kindOrder: GraphqlTypeNode['kind'][] = [
        'OBJECT', 'INTERFACE', 'UNION', 'INPUT_OBJECT', 'ENUM', 'SCALAR',
      ];
      return kindOrder.indexOf(a.kind) - kindOrder.indexOf(b.kind);
    }
    return a.name.localeCompare(b.name);
  });

  return {
    sdl,
    types,
    queryType: schema.getQueryType()?.name,
    mutationType: schema.getMutationType()?.name,
    subscriptionType: schema.getSubscriptionType()?.name,
    fetchedAt: Date.now(),
  };
}
