/**
 * queryBuilderGenerator.ts — Phase 2.1 Sprint 6 (2F-2)
 *
 * SDL generator: takes the current QueryBuilderState (selected field paths,
 * argument values, operation type/name) and the loaded GraphQL schema, and
 * produces a valid GraphQL operation string + the corresponding variables JSON.
 *
 * Design goals:
 *   - Zero external dependencies (no `graphql` package at runtime).
 *   - Correct variable promotion: {{varName}} / $varName patterns become
 *     $varName: Type in the operation's variable definitions.
 *   - Handles nested object fields, list types, required/optional args.
 *   - Returns a human-readable empty-state placeholder when nothing is selected.
 */

import type {
  GraphqlSchemaInfo,
  GraphqlTypeNode,
  GraphqlArgNode,
} from '../../../shared/types/graphql';
import type { BuilderArgValues, BuilderFieldDirectives, BuilderState } from '../hooks/useGraphqlQueryBuilder';

// ─── Public output type ───────────────────────────────────────────────────────

export interface GeneratedQuery {
  /** Formatted GraphQL operation document string. */
  sdl: string;
  /** Initial variable values for the Variables panel (empty strings as placeholders). */
  variables: Record<string, unknown>;
  /** Ordered variable declarations extracted from arg value patterns. */
  variableDeclarations: Array<{ name: string; type: string }>;
}

// ─── Schema helper types ──────────────────────────────────────────────────────

type FieldTree = { [key: string]: FieldTree | true };

// ─── Schema helpers (exported for unit tests) ─────────────────────────────────

/** Strips all GraphQL type modifier characters from a type string. */
export function stripTypeModifiers(type: string): string {
  return type.replace(/[![\]\s]/g, '');
}

const BUILTIN_SCALARS = new Set(['String', 'Int', 'Float', 'Boolean', 'ID']);

/** Returns true when a GraphQL type string resolves to a leaf (scalar or enum). */
export function isLeafType(typeString: string, types: GraphqlTypeNode[]): boolean {
  const base = stripTypeModifiers(typeString);
  if (BUILTIN_SCALARS.has(base)) return true;
  const node = types.find((t) => t.name === base);
  return node?.kind === 'SCALAR' || node?.kind === 'ENUM';
}

/** Returns the type name for the root Query/Mutation/Subscription type. */
export function getRootTypeName(
  opType: 'query' | 'mutation' | 'subscription',
  schemaInfo: GraphqlSchemaInfo,
): string {
  if (opType === 'mutation')     return schemaInfo.mutationType     ?? 'Mutation';
  if (opType === 'subscription') return schemaInfo.subscriptionType ?? 'Subscription';
  return schemaInfo.queryType ?? 'Query';
}

/** Finds a named type in the schema, or undefined if not present. */
export function findType(name: string, types: GraphqlTypeNode[]): GraphqlTypeNode | undefined {
  return types.find((t) => t.name === name);
}

/**
 * Traverses a dot-separated field path from the root type and returns the
 * resolved type name at the end of the path.  Returns null if any segment
 * of the path is unknown.
 */
export function resolvePathFieldType(
  path: string,
  rootTypeName: string,
  types: GraphqlTypeNode[],
): string | null {
  const parts = path.split('.');
  let currentTypeName = rootTypeName;

  for (const part of parts) {
    const type = findType(currentTypeName, types);
    if (!type?.fields) return null;
    const field = type.fields.find((f) => f.name === part);
    if (!field) return null;
    currentTypeName = stripTypeModifiers(field.type);
  }

  return currentTypeName;
}

/**
 * Finds the GraphQL arg definition for a named argument on a field located at
 * the given dot-path from the root type.  Returns null if unresolvable.
 */
function resolveArgDef(
  fieldPath: string,
  argName: string,
  rootTypeName: string,
  types: GraphqlTypeNode[],
): GraphqlArgNode | null {
  const parts = fieldPath.split('.');
  const fieldName   = parts[parts.length - 1];
  const parentPath  = parts.slice(0, -1).join('.');

  const parentTypeName =
    parts.length === 1
      ? rootTypeName
      : resolvePathFieldType(parentPath, rootTypeName, types);

  if (!parentTypeName) return null;

  const parentType = findType(parentTypeName, types);
  if (!parentType?.fields) return null;

  const field = parentType.fields.find((f) => f.name === fieldName);
  return field?.args?.find((a) => a.name === argName) ?? null;
}

// ─── Path-tree builder ────────────────────────────────────────────────────────

/**
 * Converts a flat list of dot-path strings into a nested tree structure
 * suitable for recursive SDL rendering.
 *
 * Example:
 *   ["user.id", "user.name", "user.orders.nodes.id"]
 *   →  { user: { id: true, name: true, orders: { nodes: { id: true } } } }
 */
export function buildFieldTree(selectedPaths: string[]): FieldTree {
  const tree: FieldTree = {};
  for (const path of selectedPaths) {
    const parts = path.split('.');
    let node: FieldTree = tree;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      const existing = node[part];
      if (existing === undefined || existing === true) {
        node[part] = {};
      }
      node = node[part] as FieldTree;
    }
    const leaf = parts[parts.length - 1];
    if (!node[leaf]) {
      node[leaf] = true;
    }
  }
  return tree;
}

// ─── Arg string builder ───────────────────────────────────────────────────────

/** Detects and extracts a variable name from a raw value string. */
function extractVarName(raw: string): string | null {
  const m = raw.match(/^\{\{(.+?)\}\}$/) ?? raw.match(/^\$(\w+)$/);
  return m ? m[1] : null;
}

/** Formats a literal arg value for inline SDL embedding. */
function formatLiteralArgValue(
  raw: string,
  argTypeName: string,
  types: GraphqlTypeNode[],
): string {
  const base = stripTypeModifiers(argTypeName);
  if (base === 'Int' || base === 'Float') return raw;
  if (base === 'Boolean') return raw === 'true' || raw === '1' ? 'true' : 'false';
  const enumNode = types.find((t) => t.name === base && t.kind === 'ENUM');
  if (enumNode) return raw; // enum values are unquoted in GraphQL
  // Treat as String — add double quotes, escape any existing double quotes.
  return `"${raw.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/**
 * Builds the arg clause for a field.  As a side-effect, collects any
 * variable names into the `variables` Map (varName → GQL type string).
 */
function buildArgString(
  fieldPath:   string,
  pathArgs:    Record<string, string> | undefined,
  rootTypeName: string,
  types:       GraphqlTypeNode[],
  variables:   Map<string, string>,
): string {
  if (!pathArgs || Object.keys(pathArgs).length === 0) return '';

  const parts: string[] = [];
  for (const [argName, rawValue] of Object.entries(pathArgs)) {
    if (!rawValue.trim()) continue;

    const varName = extractVarName(rawValue);
    if (varName) {
      if (!variables.has(varName)) {
        const argDef = resolveArgDef(fieldPath, argName, rootTypeName, types);
        variables.set(varName, argDef?.type ?? 'String');
      }
      parts.push(`${argName}: $${varName}`);
    } else {
      const argDef   = resolveArgDef(fieldPath, argName, rootTypeName, types);
      const argType  = argDef?.type ?? 'String';
      const formatted = formatLiteralArgValue(rawValue, argType, types);
      parts.push(`${argName}: ${formatted}`);
    }
  }

  return parts.length > 0 ? `(${parts.join(', ')})` : '';
}

// ─── Recursive SDL renderer ───────────────────────────────────────────────────

/**
 * Builds the directive clause for a field (e.g. `@include(if: $showOrders)`).
 * As a side-effect, registers Boolean variables for {{varRef}} / $varRef patterns.
 */
function buildDirectiveString(
  directives:  BuilderFieldDirectives | undefined,
  variables:   Map<string, string>,
): string {
  if (!directives) return '';
  const parts: string[] = [];

  for (const which of ['include', 'skip'] as const) {
    const dir = directives[which];
    if (!dir?.enabled) continue;
    const trimmed = dir.ifVar.trim();
    // Enabled with no condition → sensible literal so SDL preview and Edit in Editor match.
    const ifVar = trimmed || (which === 'include' ? 'true' : 'false');

    const m = ifVar.match(/^\{\{(.+?)\}\}$/) ?? ifVar.match(/^\$(\w+)$/);
    if (m) {
      const varName = m[1];
      if (!variables.has(varName)) {
        variables.set(varName, 'Boolean!');
      }
      parts.push(`@${which}(if: $${varName})`);
    } else {
      // bare true / false literal
      const lit = ifVar === 'false' ? 'false' : 'true';
      parts.push(`@${which}(if: ${lit})`);
    }
  }

  return parts.length > 0 ? ' ' + parts.join(' ') : '';
}

function renderNode(
  tree:         FieldTree,
  fieldPath:    string,
  argValues:    BuilderArgValues,
  fieldAliases: Record<string, string>,
  fieldDirectives: Record<string, BuilderFieldDirectives>,
  rootTypeName: string,
  types:        GraphqlTypeNode[],
  variables:    Map<string, string>,
  indent:       number,
): string {
  const ind  = '  '.repeat(indent);
  const lines: string[] = [];

  for (const [fieldName, subtree] of Object.entries(tree)) {
    const path   = fieldPath ? `${fieldPath}.${fieldName}` : fieldName;
    const argStr = buildArgString(path, argValues[path], rootTypeName, types, variables);

    // Alias prefix: "alias: fieldName"
    const alias = fieldAliases[path]?.trim();
    const nameStr = alias ? `${alias}: ${fieldName}` : fieldName;

    // Directive clause: " @include(if: $var)"
    const dirStr = buildDirectiveString(fieldDirectives[path], variables);

    if (subtree === true) {
      lines.push(`${ind}${nameStr}${argStr}${dirStr}`);
    } else {
      const children = renderNode(
        subtree, path, argValues, fieldAliases, fieldDirectives, rootTypeName, types, variables, indent + 1,
      );
      if (children.trim()) {
        lines.push(`${ind}${nameStr}${argStr}${dirStr} {`);
        lines.push(children);
        lines.push(`${ind}}`);
      }
    }
  }

  return lines.join('\n');
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Generates a GraphQL operation document from the current builder state.
 *
 * When no fields are selected, returns a commented placeholder so the editor
 * always has syntactically valid content.
 */
export function generateQuery(
  state: Pick<
    BuilderState,
    'operationType' | 'operationName' | 'selectedFields' | 'argValues' | 'fieldAliases' | 'fieldDirectives' | 'fragments' | 'activeFragmentSpreads'
  >,
  schemaInfo: GraphqlSchemaInfo | null,
): GeneratedQuery {
  const selectedPaths = Object.keys(state.selectedFields).filter(
    (k) => state.selectedFields[k],
  );

  const activeSpreads = state.activeFragmentSpreads ?? [];
  const fragments = state.fragments ?? {};
  const hasContent = selectedPaths.length > 0 || activeSpreads.length > 0;

  if (!hasContent) {
    const placeholder = [
      `${state.operationType} ${state.operationName} {`,
      `  # Select fields from the tree on the left`,
      `}`,
    ].join('\n');
    return { sdl: placeholder, variables: {}, variableDeclarations: [] };
  }

  const types        = schemaInfo?.types ?? [];
  const rootTypeName = schemaInfo
    ? getRootTypeName(state.operationType, schemaInfo)
    : 'Query';

  const variables = new Map<string, string>(); // varName → GQL type
  const bodyLines: string[] = [];

  // Main field selection
  if (selectedPaths.length > 0) {
    const tree = buildFieldTree(selectedPaths);
    const body = renderNode(
      tree, '', state.argValues, state.fieldAliases ?? {}, state.fieldDirectives ?? {},
      rootTypeName, types, variables, 1,
    );
    if (body.trim()) bodyLines.push(body);
  }

  // Active fragment spreads (always at the root of the operation)
  for (const name of activeSpreads) {
    if (fragments[name]) {
      bodyLines.push(`  ...${name}`);
    }
  }

  // Build the operation variable declaration string
  const varDecls = Array.from(variables.entries()).map(([name, type]) => ({ name, type }));
  const varStr   = varDecls.length > 0
    ? `(${varDecls.map(({ name, type }) => `$${name}: ${type}`).join(', ')})`
    : '';

  let sdl = `${state.operationType} ${state.operationName}${varStr} {\n${bodyLines.join('\n')}\n}`;

  // Emit fragment definitions after the main operation
  const fragmentDefs: string[] = [];
  for (const frag of Object.values(fragments)) {
    if (frag.fieldPaths.length === 0) continue;
    const fragTree = buildFieldTree(frag.fieldPaths);
    const fragBody = renderNode(
      fragTree, '', state.argValues, state.fieldAliases ?? {}, state.fieldDirectives ?? {},
      frag.onType, types, variables, 1,
    );
    if (fragBody.trim()) {
      fragmentDefs.push(`\nfragment ${frag.name} on ${frag.onType} {\n${fragBody}\n}`);
    }
  }
  if (fragmentDefs.length > 0) {
    sdl += fragmentDefs.join('\n');
  }

  // Build initial variable JSON for the Variables panel (empty placeholders)
  const variableValues: Record<string, unknown> = {};
  for (const { name } of varDecls) {
    variableValues[name] = '';
  }

  return { sdl, variables: variableValues, variableDeclarations: varDecls };
}

// ─── Schema search helper (2F-5) ──────────────────────────────────────────────

export interface FieldSearchResult {
  /** Full dot-path from the root operation type, e.g. "user.orders.nodes.id" */
  path:        string;
  /** Simple field name, e.g. "id" */
  fieldName:   string;
  /** The containing type name, e.g. "Order" */
  parentType:  string;
  /** Field type string, e.g. "ID!" */
  fieldType:   string;
  description?: string;
}

/**
 * Searches all fields reachable from the given root type for names containing
 * the query string (case-insensitive).  Stops recursion at a fixed depth to
 * prevent infinite loops on recursive schemas (max depth = 5 levels).
 */
export function searchFields(
  query:        string,
  rootTypeName: string,
  types:        GraphqlTypeNode[],
  maxDepth = 5,
): FieldSearchResult[] {
  if (!query.trim()) return [];

  const lowerQuery = query.toLowerCase();
  const results: FieldSearchResult[] = [];
  const visited   = new Set<string>(); // prevent circular type references

  function traverse(typeName: string, prefix: string, depth: number) {
    if (depth > maxDepth) return;
    if (visited.has(typeName)) return;
    visited.add(typeName);

    const type = findType(typeName, types);
    if (!type?.fields) return;

    for (const field of type.fields) {
      const path = prefix ? `${prefix}.${field.name}` : field.name;

      if (field.name.toLowerCase().includes(lowerQuery)) {
        results.push({
          path,
          fieldName:  field.name,
          parentType: typeName,
          fieldType:  field.type,
          description: field.description,
        });
      }

      const childTypeName = stripTypeModifiers(field.type);
      if (!isLeafType(field.type, types)) {
        traverse(childTypeName, path, depth + 1);
      }
    }

    visited.delete(typeName);
  }

  traverse(rootTypeName, '', 0);
  return results;
}

/**
 * Computes the full dot-path from the root type to a field at a given path
 * and returns all ancestor paths needed to expand the tree to reveal it.
 */
export function getAncestorPaths(path: string): string[] {
  const parts = path.split('.');
  const ancestors: string[] = [];
  for (let i = 1; i < parts.length; i++) {
    ancestors.push(parts.slice(0, i).join('.'));
  }
  return ancestors;
}
