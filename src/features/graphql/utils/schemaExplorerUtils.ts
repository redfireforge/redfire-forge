/**
 * schemaExplorerUtils.ts — pure helpers and constants for the Schema Explorer.
 *
 * Extracted from component files to satisfy react-refresh/only-export-components.
 */

import type { GraphqlTypeNode } from '../../../shared/types/graphql';

// ─── Kind metadata ────────────────────────────────────────────────────────────

export const KIND_LABEL: Record<GraphqlTypeNode['kind'], string> = {
  OBJECT: 'Object',
  INTERFACE: 'Interface',
  UNION: 'Union',
  INPUT_OBJECT: 'Input',
  ENUM: 'Enum',
  SCALAR: 'Scalar',
};

export const KIND_CSS: Record<GraphqlTypeNode['kind'], string> = {
  OBJECT: 'gql-se-kind--object',
  INTERFACE: 'gql-se-kind--interface',
  UNION: 'gql-se-kind--union',
  INPUT_OBJECT: 'gql-se-kind--input',
  ENUM: 'gql-se-kind--enum',
  SCALAR: 'gql-se-kind--scalar',
};

export const KIND_ABBR: Record<GraphqlTypeNode['kind'], string> = {
  OBJECT: 'T',
  INTERFACE: 'IF',
  UNION: 'U',
  INPUT_OBJECT: 'I',
  ENUM: 'E',
  SCALAR: 'S',
};

// ─── Field count text ─────────────────────────────────────────────────────────

export function fieldCountText(type: GraphqlTypeNode): string {
  const n = type.fields?.length ?? type.enumValues?.length ?? type.possibleTypes?.length ?? 0;
  if (n === 0) return '';
  if (type.kind === 'ENUM') return `${n} value${n === 1 ? '' : 's'}`;
  if (type.kind === 'UNION') return `${n} type${n === 1 ? '' : 's'}`;
  return `${n} field${n === 1 ? '' : 's'}`;
}

// ─── Type name extractor ──────────────────────────────────────────────────────

/** Strips [, ], ! wrappers to get the bare named type (e.g. "[OrderItem!]!" → "OrderItem") */
export function extractTypeName(typeStr: string): string {
  return typeStr.replace(/[[\]!]/g, '');
}
