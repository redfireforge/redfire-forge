/**
 * complexityEstimator.ts — Sprint 7 (2G-2)
 *
 * Pre-execution query complexity estimator.
 *
 * Traverses the GraphQL query AST and assigns costs to each selected field
 * based on its type in the schema. The cost is displayed as a badge near the
 * Execute button; execution is blocked (with a confirmation dialog) when the
 * cost exceeds 2× the configured threshold.
 *
 * Cost model:
 *   - Scalar / enum field:          +1
 *   - Object-type field:            +2
 *   - List-type field:              sub-tree cost × listMultiplier (default 10)
 *   - Depth beyond maxDepth:        sub-tree cost doubled per excess level
 *   - Named fragment spreads:       cost = sum of all fields within the fragment
 *   - Inline fragments:             same cost as their fields
 *   - @defer on a fragment spread:  reduce its cost contribution by 50%
 *
 * Returns 0 for unparseable queries or when no schema is available.
 */

import { parse, visit, Kind } from 'graphql';
import type {
  DocumentNode,
  SelectionSetNode,
  FieldNode,
  InlineFragmentNode,
  FragmentSpreadNode,
  FragmentDefinitionNode,
} from 'graphql';
import type { GraphqlSchemaInfo, GraphqlTypeNode } from '../../../shared/types/graphql';

// ─── Options / defaults ────────────────────────────────────────────────────────

export interface ComplexityOptions {
  /** Cost threshold — badge turns red above this value (default 500) */
  threshold?: number;
  /** Cost multiplier for list-type fields (default 10) */
  listMultiplier?: number;
  /** Depth beyond which sub-tree cost is doubled per excess level (default 10) */
  maxDepth?: number;
}

const DEFAULT_THRESHOLD        = 500;
const DEFAULT_LIST_MULTIPLIER  = 10;
const DEFAULT_MAX_DEPTH        = 10;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Strip Non-Null (`!`) and List (`[]`) wrappers from a type string. */
function stripTypeModifiers(typeStr: string): string {
  return typeStr.replace(/[![\]]/g, '');
}

/** Return true if the type string includes `[` — i.e. it is a list type. */
function isListType(typeStr: string): boolean {
  return typeStr.includes('[');
}

/** Look up a type by name in the schema types array. */
function findType(name: string, types: GraphqlTypeNode[]): GraphqlTypeNode | undefined {
  return types.find((t) => t.name === name);
}

/** Return true if the named type is a leaf (SCALAR, ENUM) in the schema. */
function isLeafTypeName(name: string, types: GraphqlTypeNode[]): boolean {
  const t = findType(name, types);
  return !t || t.kind === 'SCALAR' || t.kind === 'ENUM';
}

// ─── Core recursion ───────────────────────────────────────────────────────────

/**
 * Compute the cost of a selection set starting from `parentTypeName`.
 *
 * @param selectionSet  The AST selection set node.
 * @param parentTypeName  The schema type name of the parent object (e.g. "Query").
 * @param types  All schema types from GraphqlSchemaInfo.
 * @param fragments  Named fragment definitions from the document.
 * @param depth  Current nesting depth (starts at 0 for root).
 * @param maxDepth  Depth beyond which costs are doubled per extra level.
 * @param listMul  The list multiplier.
 * @param visited  Set of type names visited in this path (prevents infinite loops on circular schemas).
 */
function scoreSelectionSet(
  selectionSet: SelectionSetNode,
  parentTypeName: string,
  types: GraphqlTypeNode[],
  fragments: Record<string, FragmentDefinitionNode>,
  depth: number,
  maxDepth: number,
  listMul: number,
  visited: Set<string>,
): number {
  const parentType = findType(parentTypeName, types);
  let total = 0;

  for (const selection of selectionSet.selections) {
    if (selection.kind === Kind.FIELD) {
      total += scoreField(selection, parentType, types, fragments, depth, maxDepth, listMul, visited);
    } else if (selection.kind === Kind.INLINE_FRAGMENT) {
      total += scoreInlineFragment(selection, parentTypeName, types, fragments, depth, maxDepth, listMul, visited);
    } else if (selection.kind === Kind.FRAGMENT_SPREAD) {
      total += scoreFragmentSpread(selection, types, fragments, depth, maxDepth, listMul, visited);
    }
  }

  return total;
}

function scoreField(
  node: FieldNode,
  parentType: GraphqlTypeNode | undefined,
  types: GraphqlTypeNode[],
  fragments: Record<string, FragmentDefinitionNode>,
  depth: number,
  maxDepth: number,
  listMul: number,
  visited: Set<string>,
): number {
  if (!node.selectionSet) {
    // Leaf scalar/enum field
    return depthMultiplier(1, depth, maxDepth);
  }

  // Object or list-of-object field — look up return type
  const fieldDef = parentType?.fields?.find((f) => f.name === node.name.value);
  const typeStr  = fieldDef?.type ?? '';
  const baseType = stripTypeModifiers(typeStr);
  const isList   = isListType(typeStr);

  // Avoid infinite recursion on circular schemas
  if (visited.has(baseType)) return depthMultiplier(2, depth, maxDepth);
  const nextVisited = new Set(visited);
  nextVisited.add(baseType);

  const fieldCost = isLeafTypeName(baseType, types) ? 1 : 2;
  const subCost   = node.selectionSet
    ? scoreSelectionSet(node.selectionSet, baseType, types, fragments, depth + 1, maxDepth, listMul, nextVisited)
    : 0;

  const rawCost = fieldCost + subCost;
  const withDepth = depthMultiplier(rawCost, depth, maxDepth);
  return isList ? withDepth * listMul : withDepth;
}

function scoreInlineFragment(
  node: InlineFragmentNode,
  parentTypeName: string,
  types: GraphqlTypeNode[],
  fragments: Record<string, FragmentDefinitionNode>,
  depth: number,
  maxDepth: number,
  listMul: number,
  visited: Set<string>,
): number {
  const onType = node.typeCondition?.name.value ?? parentTypeName;
  const cost   = scoreSelectionSet(node.selectionSet, onType, types, fragments, depth, maxDepth, listMul, visited);

  // @defer reduces cost contribution by 50%
  const hasDefer = node.directives?.some((d) => d.name.value === 'defer') ?? false;
  return hasDefer ? Math.ceil(cost * 0.5) : cost;
}

function scoreFragmentSpread(
  node: FragmentSpreadNode,
  types: GraphqlTypeNode[],
  fragments: Record<string, FragmentDefinitionNode>,
  depth: number,
  maxDepth: number,
  listMul: number,
  visited: Set<string>,
): number {
  const def = fragments[node.name.value];
  if (!def) return 0;

  const onType = def.typeCondition.name.value;
  const cost   = scoreSelectionSet(def.selectionSet, onType, types, fragments, depth, maxDepth, listMul, visited);

  // @defer on the spread reduces cost by 50%
  const hasDefer = node.directives?.some((d) => d.name.value === 'defer') ?? false;
  return hasDefer ? Math.ceil(cost * 0.5) : cost;
}

/** Apply depth penalty: doubles cost for each level beyond maxDepth. */
function depthMultiplier(cost: number, depth: number, maxDepth: number): number {
  const excess = Math.max(0, depth - maxDepth);
  return cost * Math.pow(2, excess);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Per-field cost entry shown in the complexity gate modal breakdown table. */
export interface FieldCostEntry {
  /** Field name as it appears in the query (e.g. "users", "orders") */
  fieldName: string;
  /** Parent type name (e.g. "Query", "User") */
  typeName: string;
  /** Estimated cost contribution of this field and its subtree */
  cost: number;
  /** True if this field is a list type (contributing to high cost via multiplier) */
  isList: boolean;
}

export interface ComplexityResult {
  /** Estimated cost score (integer ≥ 0). */
  score: number;
  /** 'ok' | 'warn' | 'danger' based on threshold. */
  level: 'ok' | 'warn' | 'danger';
  /** Whether execution should be blocked (score > 2 × threshold). */
  shouldBlock: boolean;
  /** The configured threshold used for level computation. */
  threshold: number;
  /** Top-level field cost breakdown — populated when score > 0. */
  fieldBreakdown: FieldCostEntry[];
}

/**
 * Compute the estimated complexity score for a GraphQL query.
 *
 * @param query  The raw GraphQL query string.
 * @param schemaInfo  Loaded schema info from introspection. Pass `null` or
 *   `undefined` to get a score of 0 (badge is hidden when no schema is loaded).
 * @param options  Optional overrides for threshold, listMultiplier, maxDepth.
 */
export function computeQueryComplexity(
  query: string,
  schemaInfo: GraphqlSchemaInfo | null | undefined,
  options?: ComplexityOptions,
  operationName?: string,
): ComplexityResult {
  const threshold   = options?.threshold       ?? DEFAULT_THRESHOLD;
  const listMul     = options?.listMultiplier  ?? DEFAULT_LIST_MULTIPLIER;
  const maxDepth    = options?.maxDepth        ?? DEFAULT_MAX_DEPTH;

  const noResult: ComplexityResult = { score: 0, level: 'ok', shouldBlock: false, threshold, fieldBreakdown: [] };

  if (!schemaInfo?.types?.length || !query.trim()) return noResult;

  let doc: DocumentNode;
  try {
    doc = parse(query);
  } catch {
    return noResult;
  }

  // Collect named fragment definitions
  const fragments: Record<string, FragmentDefinitionNode> = {};
  visit(doc, {
    FragmentDefinition(node) { fragments[node.name.value] = node; },
  });

  const types  = schemaInfo.types;
  const qType  = schemaInfo.queryType    ?? 'Query';
  const mType  = schemaInfo.mutationType ?? 'Mutation';

  let totalScore = 0;
  const fieldBreakdown: FieldCostEntry[] = [];

  for (const def of doc.definitions) {
    if (def.kind !== Kind.OPERATION_DEFINITION) continue;
    if (operationName && def.name?.value !== operationName) continue;

    const rootTypeName =
      def.operation === 'mutation'     ? mType :
      def.operation === 'subscription' ? (schemaInfo.subscriptionType ?? 'Subscription') :
      qType;

    const rootType = findType(rootTypeName, types);
    const visited = new Set<string>([rootTypeName]);

    // Collect per-top-level-field costs for the breakdown table
    for (const selection of def.selectionSet.selections) {
      if (selection.kind === Kind.FIELD) {
        const fieldCost = scoreField(selection, rootType, types, fragments, 0, maxDepth, listMul, visited);
        const fieldDef = rootType?.fields?.find((f) => f.name === selection.name.value);
        const typeStr = fieldDef?.type ?? '';
        fieldBreakdown.push({
          fieldName: selection.name.value,
          typeName: rootTypeName,
          cost: Math.round(fieldCost),
          isList: isListType(typeStr),
        });
        totalScore += fieldCost;
      } else {
        // Inline fragments and fragment spreads — score without breakdown
        let fragmentCost = 0;
        if (selection.kind === Kind.INLINE_FRAGMENT) {
          fragmentCost = scoreInlineFragment(selection, rootTypeName, types, fragments, 0, maxDepth, listMul, visited);
        } else if (selection.kind === Kind.FRAGMENT_SPREAD) {
          fragmentCost = scoreFragmentSpread(selection, types, fragments, 0, maxDepth, listMul, visited);
        }
        totalScore += fragmentCost;
      }
    }
  }

  // Sort breakdown by cost descending so the most expensive fields appear first
  fieldBreakdown.sort((a, b) => b.cost - a.cost);

  const score = Math.round(totalScore);
  const level: ComplexityResult['level'] =
    score > threshold       ? 'danger' :
    score > threshold / 2   ? 'warn'   :
    'ok';

  return {
    score,
    level,
    shouldBlock: score > threshold * 2,
    threshold,
    fieldBreakdown,
  };
}
