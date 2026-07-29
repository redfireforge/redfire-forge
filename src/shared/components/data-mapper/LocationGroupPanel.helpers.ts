import type { TargetField, TargetFieldLocation } from './types';

/** Column-mapping style target paths: `path::userId`, `validate::$.name`, … */
const TYPED_SLOT_PREFIX_RE = /^(path|param|body|header|validate)::/;

const SLOT_TYPE_LABELS: Record<string, string> = {
  path: 'URL Path',
  param: 'Query Param',
  body: 'Request Body',
  header: 'Header',
  validate: 'Validation',
};

function locationToSlotType(location: TargetFieldLocation): string {
  switch (location) {
    case 'path': return 'path';
    case 'query': return 'param';
    case 'header': return 'header';
    case 'body':
    case 'bodyForm':
      return 'body';
    default:
      return 'body';
  }
}

function usesTypedSlotPaths(fields: TargetField[]): boolean {
  return fields.some((f) => TYPED_SLOT_PREFIX_RE.test(f.path));
}

/**
 * When the target already uses `type::name` paths (Map Columns), prefix newly
 * added custom fields the same way so drag/drop + serialize can resolve them.
 */
export function withTypedSlotPath(
  field: TargetField,
  location: TargetFieldLocation,
  allFields: TargetField[],
): TargetField {
  if (!usesTypedSlotPaths(allFields)) return field;
  if (TYPED_SLOT_PREFIX_RE.test(field.path)) return field;

  const type = locationToSlotType(location);
  const name = field.path;
  const typeLabel = SLOT_TYPE_LABELS[type] ?? type;
  const plainLabel = !field.label || field.label === name;

  return {
    ...field,
    path: `${type}::${name}`,
    label: plainLabel ? `${name} (${typeLabel})` : field.label,
    location: field.location ?? location,
  };
}