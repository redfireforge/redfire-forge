/**
 * schemaDiff.ts — Phase 3D (task 3D-3)
 *
 * Schema diff engine using graphql v17 built-ins:
 *   findBreakingChanges, findDangerousChanges, findSchemaChanges
 *
 * Note: The plan specified @graphql-inspector/core but that package requires
 * graphql ^14/15/16 and is incompatible with the project's graphql@17.0.1.
 * graphql v17 ships equivalent built-ins: findSchemaChanges + SafeChangeType +
 * BreakingChangeType + DangerousChangeType, so no external package is needed.
 *
 * DEPRECATED detection: the built-in inspector does not emit a DEPRECATED
 * change type. We run a separate traversal comparing @deprecated directives
 * on fields and arguments between old and new schema.
 */

import {
  buildSchema,
  findBreakingChanges,
  findDangerousChanges,
  findSchemaChanges,
  isObjectType,
  isInterfaceType,
  isEnumType,
  isInputObjectType,
  BreakingChangeType,
  DangerousChangeType,
} from 'graphql';
import type { GraphqlSchemaDiffChange, GraphqlSchemaDiffResult } from '../../../shared/types/graphql';
import type { DiffAck } from './schemaDiffAck';

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Compute the diff between two SDL strings.
 *
 * @param oldSdl  — baseline SDL (saved snapshot or empty string for "first diff")
 * @param newSdl  — current SDL
 * @param acks    — optional list of acknowledgements to merge into the result
 *                  (only relevant for snapshot-vs-current diffs)
 */
export function computeSchemaDiff(
  oldSdl: string,
  newSdl: string,
  acks: DiffAck[] = [],
): GraphqlSchemaDiffResult {
  // Guard against empty or invalid SDL — buildSchema('') throws a SyntaxError.
  // When oldSdl is empty ("no baseline"), we treat it as "first diff": no breaking
  // or dangerous changes can exist because there is nothing to remove or change.
  // We still run deprecated detection against the new schema with no old schema.
  let oldSchema: ReturnType<typeof buildSchema>;
  let newSchema: ReturnType<typeof buildSchema>;
  const noBaseline = !oldSdl.trim();
  try {
    // When there is no baseline, use an empty minimal schema so graphql built-ins
    // can be called — but we will discard breaking/dangerous results below.
    const effectiveOld = noBaseline
      ? 'type Query { _placeholder: Boolean }'
      : oldSdl;
    oldSchema = buildSchema(effectiveOld);
    newSchema = buildSchema(newSdl || 'type Query { _placeholder: Boolean }');
  } catch (err) {
    throw new Error(
      `schemaDiff: failed to parse SDL — ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // Build ack lookup: changePath → DiffAck (must be before noBaseline branch)
  const ackMap = new Map<string, DiffAck>(acks.map((a) => [a.changePath, a]));

  // With no baseline, all changes are either additions (SAFE) or new deprecations.
  // Never report BREAKING or DANGEROUS against an empty baseline.
  if (noBaseline) {
    // Compute SAFE additions by comparing placeholder→new; filter out BREAKING (placeholder
    // removals that are artifacts of using a minimal stub schema) and DANGEROUS.
    const breakingTypesNb  = new Set<string>(Object.values(BreakingChangeType)  as string[]);
    const dangerousTypesNb = new Set<string>(Object.values(DangerousChangeType) as string[]);
    const safeChangesNb: GraphqlSchemaDiffChange[] = findAllChanges(oldSchema, newSchema)
      .filter((c) => !breakingTypesNb.has(c.type) && !dangerousTypesNb.has(c.type))
      .map((c) => {
        const path = extractPath(c.description);
        const ack = ackMap.get(path);
        return {
          criticality: 'SAFE' as const,
          path,
          description: c.description,
          acknowledged: !!ack,
          acknowledgeNote: ack?.note,
        };
      });

    const deprecatedChanges = detectDeprecationChanges(oldSchema, newSchema).map((c) => {
      const ack = ackMap.get(c.path);
      return { ...c, acknowledged: !!ack, acknowledgeNote: ack?.note };
    });

    // Same deduplication as the normal path: when a field is added already @deprecated,
    // findAllChanges emits it as SAFE and detectDeprecationChanges emits it as DEPRECATED.
    // Prefer DEPRECATED: drop any SAFE entry whose path matches a DEPRECATED entry.
    const deprecatedPathsNb = new Set(deprecatedChanges.map((c) => c.path));
    const dedupedSafeChangesNb = safeChangesNb.filter((c) => !deprecatedPathsNb.has(c.path));

    return {
      changes: [...dedupedSafeChangesNb, ...deprecatedChanges],
      breakingCount: 0,
      dangerousCount: 0,
      safeCount: dedupedSafeChangesNb.length,
      deprecatedCount: deprecatedChanges.length,
    };
  }

  // ── Breaking changes ──────────────────────────────────────────────────────
  const breakingRaw = findBreakingChanges(oldSchema, newSchema);
  const breakingChanges: GraphqlSchemaDiffChange[] = breakingRaw.map((c) => {
    const path = extractPath(c.description);
    const ack = ackMap.get(path);
    return {
      criticality: 'BREAKING',
      path,
      description: c.description,
      acknowledged: !!ack,
      acknowledgeNote: ack?.note,
    };
  });

  // ── Dangerous changes ─────────────────────────────────────────────────────
  const dangerousRaw = findDangerousChanges(oldSchema, newSchema);
  const dangerousChanges: GraphqlSchemaDiffChange[] = dangerousRaw.map((c) => {
    const path = extractPath(c.description);
    const ack = ackMap.get(path);
    return {
      criticality: 'DANGEROUS',
      path,
      description: c.description,
      acknowledged: !!ack,
      acknowledgeNote: ack?.note,
    };
  });

  // ── Safe changes ──────────────────────────────────────────────────────────
  // findSchemaChanges returns all changes; subtract breaking + dangerous to get safe
  const allRaw = findAllChanges(oldSchema, newSchema);
  const breakingTypes  = new Set<string>(Object.values(BreakingChangeType)  as string[]);
  const dangerousTypes = new Set<string>(Object.values(DangerousChangeType) as string[]);
  const safeChanges: GraphqlSchemaDiffChange[] = allRaw
    .filter((c) => !breakingTypes.has(c.type) && !dangerousTypes.has(c.type))
    .map((c) => {
      const path = extractPath(c.description);
      const ack = ackMap.get(path);
      return {
        criticality: 'SAFE' as const,
        path,
        description: c.description,
        acknowledged: !!ack,
        acknowledgeNote: ack?.note,
      };
    });

  // ── DEPRECATED detection ──────────────────────────────────────────────────
  // Pass pre-built schemas to avoid re-parsing the SDL strings
  const deprecatedChanges = detectDeprecationChanges(oldSchema, newSchema).map((c) => {
    const ack = ackMap.get(c.path);
    return { ...c, acknowledged: !!ack, acknowledgeNote: ack?.note };
  });

  // ── Deduplication ────────────────────────────────────────────────────────
  // When a field/enum-value is ADDED already @deprecated, findSchemaChanges
  // classifies it as SAFE while detectDeprecationChanges also emits it as
  // DEPRECATED (same path, two entries). Prefer DEPRECATED: drop any SAFE row
  // whose path matches a DEPRECATED row.
  const deprecatedPaths = new Set(deprecatedChanges.map((c) => c.path));
  const dedupedSafeChanges = safeChanges.filter((c) => !deprecatedPaths.has(c.path));

  const changes: GraphqlSchemaDiffChange[] = [
    ...breakingChanges,
    ...dangerousChanges,
    ...dedupedSafeChanges,
    ...deprecatedChanges,
  ];

  return {
    changes,
    breakingCount:   breakingChanges.length,
    dangerousCount:  dangerousChanges.length,
    safeCount:       dedupedSafeChanges.length,
    deprecatedCount: deprecatedChanges.length,
  };
}

// ─── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Detects newly-deprecated fields and arguments between two SDL versions.
 *
 * A DEPRECATED change is emitted only when a field/arg gains @deprecated
 * between oldSdl and newSdl — NOT for fields already deprecated in oldSdl.
 *
 * Accepts either SDL strings or pre-built GraphQLSchema objects to avoid double-parsing.
 */
export function detectDeprecationChanges(
  oldSdlOrSchema: string | ReturnType<typeof buildSchema>,
  newSdlOrSchema: string | ReturnType<typeof buildSchema>,
): GraphqlSchemaDiffChange[] {
  const oldSchema = typeof oldSdlOrSchema === 'string' ? buildSchema(oldSdlOrSchema) : oldSdlOrSchema;
  const newSchema = typeof newSdlOrSchema === 'string' ? buildSchema(newSdlOrSchema) : newSdlOrSchema;
  const results: GraphqlSchemaDiffChange[] = [];

  const typeMap = newSchema.getTypeMap();
  for (const typeName of Object.keys(typeMap)) {
    if (typeName.startsWith('__')) continue; // skip introspection types
    const newType = typeMap[typeName];
    const oldType = oldSchema.getType(typeName);

    // ── Object / Interface fields and their arguments ─────────────────────────
    if (isObjectType(newType) || isInterfaceType(newType)) {
      const oldFields =
        (isObjectType(oldType) || isInterfaceType(oldType)) ? oldType.getFields() : {};

      for (const [fieldName, newField] of Object.entries(newType.getFields())) {
        const oldField = oldFields[fieldName];
        const wasDeprecated = oldField?.deprecationReason != null;
        const isDeprecated  = newField.deprecationReason != null;

        if (isDeprecated && !wasDeprecated) {
          const reason = newField.deprecationReason || 'No reason provided.';
          results.push({
            criticality: 'DEPRECATED',
            path: `${typeName}.${fieldName}`,
            description: `Field ${typeName}.${fieldName} was marked @deprecated: ${reason}`,
          });
        }

        // Check arguments
        for (const arg of newField.args) {
          const oldArg = oldField?.args.find((a) => a.name === arg.name);
          if (arg.deprecationReason != null && oldArg?.deprecationReason == null) {
            results.push({
              criticality: 'DEPRECATED',
              path: `${typeName}.${fieldName}(${arg.name}:)`,
              description: `Argument ${arg.name} on ${typeName}.${fieldName} was marked @deprecated`,
            });
          }
        }
      }
      continue;
    }

    // ── Enum values ──────────────────────────────────────────────────────────
    if (isEnumType(newType)) {
      const oldValues = isEnumType(oldType)
        ? Object.fromEntries(oldType.getValues().map((v) => [v.name, v]))
        : {};
      for (const value of newType.getValues()) {
        const oldValue = oldValues[value.name];
        if (value.deprecationReason != null && oldValue?.deprecationReason == null) {
          const reason = value.deprecationReason || 'No reason provided.';
          results.push({
            criticality: 'DEPRECATED',
            path: `${typeName}.${value.name}`,
            description: `Enum value ${typeName}.${value.name} was marked @deprecated: ${reason}`,
          });
        }
      }
      continue;
    }

    // ── Input object fields ──────────────────────────────────────────────────
    if (isInputObjectType(newType)) {
      const oldInputFields = isInputObjectType(oldType) ? oldType.getFields() : {};
      for (const [fieldName, newField] of Object.entries(newType.getFields())) {
        const oldField = oldInputFields[fieldName];
        if (newField.deprecationReason != null && oldField?.deprecationReason == null) {
          const reason = newField.deprecationReason || 'No reason provided.';
          results.push({
            criticality: 'DEPRECATED',
            path: `${typeName}.${fieldName}`,
            description: `Input field ${typeName}.${fieldName} was marked @deprecated: ${reason}`,
          });
        }
      }
    }
  }
  return results;
}

// Keywords that appear in descriptions but are not schema element names.
// Also includes "Standard" which appears in "Standard scalar Foo was removed…".
const DESCRIPTION_KEYWORDS = new Set([
  'Field', 'Type', 'Argument', 'Enum', 'Input', 'Directive', 'Scalar',
  'Interface', 'Union', 'Value', 'Object', 'Standard',
]);

/**
 * Extract a concise path from a change description.
 *
 * Handles both graphql v17 description formats and legacy formats.
 *
 * graphql v17 examples:
 *   "Field User.name was removed."                         → "User.name"
 *   "Enum value Status.ACTIVE was added."                  → "Status.ACTIVE"
 *   "Argument Query.search(q:) was removed."               → "Query.search(q:)"
 *   "A required argument Query.user(id:) was added."       → "Query.user(id:)"
 *   "Query.search(limit:) has changed defaultValue…"       → "Query.search(limit:)"
 *   "Type Foo was removed."                                → "Foo"
 *
 * Legacy format (kept for backward compat):
 *   "Argument limit on Query.users was removed."           → "Query.users(limit:)"
 */
export function extractPath(description: string): string {
  // graphql v17: TypeName.field(arg:) path with parenthesised argument name.
  // Matches "Argument Query.search(q:) was removed." and
  //         "Query.search(limit:) has changed defaultValue…" and
  //         "A required argument Query.user(id:) was added."
  const v17ArgMatch = description.match(
    /\b([A-Z][a-zA-Z_0-9]*(?:\.[a-zA-Z_0-9]+)+\([a-zA-Z_0-9]+:\))/,
  );
  if (v17ArgMatch) return v17ArgMatch[1];

  // Legacy format: "Argument X on Type.field" (graphql inspector / older graphql-js)
  const legacyArgMatch = description.match(/Argument\s+(\w+)\s+on\s+([\w.]+)/);
  if (legacyArgMatch) return `${legacyArgMatch[2]}(${legacyArgMatch[1]}:)`;

  // "TypeName.fieldName" dotted path (most specific match, no parens)
  const pathMatch = description.match(/\b([A-Z][a-zA-Z_0-9]*(?:\.[a-zA-Z_0-9]+)+)\b/);
  if (pathMatch) return pathMatch[1];

  // Simple capitalized type name — skip description prose words
  const typeMatches = [...description.matchAll(/\b([A-Z][a-zA-Z_0-9]+)\b/g)].map((m) => m[1]);
  const typeName = typeMatches.find((m) => !DESCRIPTION_KEYWORDS.has(m));
  if (typeName) return typeName;

  return description.slice(0, 60);
}

/** Returns all schema changes (breaking + dangerous + safe) using graphql v17's findSchemaChanges */
function findAllChanges(
  oldSchema: ReturnType<typeof buildSchema>,
  newSchema: ReturnType<typeof buildSchema>,
): Array<{ type: string; description: string }> {
  return findSchemaChanges(oldSchema, newSchema);
}
