/**
 * Common transformation library (Phase 10C.2).
 *
 * Pre-built expression templates for frequent data transformations.
 * Each template uses `$.PATH` as a placeholder that gets replaced
 * with the actual source path at suggestion time.
 */

export interface TransformationTemplate {
  id: string;
  label: string;
  template: string;
  description: string;
  category: TransformCategory;
  fromType: string;
  toType: string;
  priority: number;
}

export type TransformCategory =
  | 'conversion'
  | 'date'
  | 'string'
  | 'math'
  | 'array'
  | 'null-handling'
  | 'composite';

export const TRANSFORMATION_LIBRARY: readonly TransformationTemplate[] = [
  // ─── Type Conversions ──────────────────────────────────
  { id: 'str-to-num',       label: 'Parse number',       template: '$parseFloat($.PATH)',           description: 'Parse string to floating-point number',          category: 'conversion', fromType: 'string',  toType: 'number',  priority: 95 },
  { id: 'str-to-int',       label: 'Parse integer',      template: '$toInt($.PATH)',                description: 'Parse string to integer (truncates decimals)',   category: 'conversion', fromType: 'string',  toType: 'number',  priority: 90 },
  { id: 'str-to-bool',      label: 'String → boolean',   template: '$toBool($.PATH)',               description: 'Convert "true"/"false"/truthy string to boolean', category: 'conversion', fromType: 'string',  toType: 'boolean', priority: 95 },
  { id: 'num-to-str',       label: 'Number → string',    template: '$toString($.PATH)',             description: 'Convert number to string',                       category: 'conversion', fromType: 'number',  toType: 'string',  priority: 95 },
  { id: 'bool-to-str',      label: 'Boolean → string',   template: '$toString($.PATH)',             description: 'Convert boolean to "true"/"false" string',       category: 'conversion', fromType: 'boolean', toType: 'string',  priority: 95 },
  { id: 'bool-to-num',      label: 'Boolean → integer',  template: '$toInt($.PATH)',                description: 'Convert boolean to 0/1',                         category: 'conversion', fromType: 'boolean', toType: 'number',  priority: 95 },
  { id: 'num-to-bool',      label: 'Number → boolean',   template: '$toBool($.PATH)',               description: 'Convert number to boolean (0=false)',             category: 'conversion', fromType: 'number',  toType: 'boolean', priority: 95 },
  { id: 'obj-to-str',       label: 'Stringify',          template: '$toString($.PATH)',             description: 'JSON stringify an object',                        category: 'conversion', fromType: 'object',  toType: 'string',  priority: 70 },

  // ─── Date Conversions ──────────────────────────────────
  { id: 'date-iso',         label: 'ISO date',           template: '$formatDate($.PATH, "YYYY-MM-DD")',           description: 'Format date as ISO (YYYY-MM-DD)',                 category: 'date', fromType: 'string', toType: 'string', priority: 85 },
  { id: 'date-datetime',    label: 'ISO datetime',       template: '$formatDate($.PATH, "YYYY-MM-DDTHH:mm:ss")', description: 'Format date with time (ISO 8601)',                category: 'date', fromType: 'string', toType: 'string', priority: 80 },
  { id: 'date-unix',        label: 'Unix timestamp',     template: '$toInt($formatDate($.PATH, "X"))',            description: 'Convert date string to Unix timestamp (seconds)', category: 'date', fromType: 'string', toType: 'number', priority: 80 },
  { id: 'date-unix-ms',     label: 'Unix ms',            template: '$toInt($formatDate($.PATH, "x"))',            description: 'Convert date string to Unix milliseconds',        category: 'date', fromType: 'string', toType: 'number', priority: 75 },

  // ─── String Operations ─────────────────────────────────
  { id: 'str-trim',         label: 'Trim',               template: '$trim($.PATH)',                  description: 'Remove leading/trailing whitespace',              category: 'string', fromType: 'string', toType: 'string', priority: 70 },
  { id: 'str-lower',        label: 'Lowercase',          template: '$lowercase($.PATH)',             description: 'Convert to lowercase',                            category: 'string', fromType: 'string', toType: 'string', priority: 65 },
  { id: 'str-upper',        label: 'Uppercase',          template: '$uppercase($.PATH)',             description: 'Convert to uppercase',                            category: 'string', fromType: 'string', toType: 'string', priority: 65 },
  { id: 'str-concat',       label: 'Concatenate',        template: '$concat($.PATH, " ", $.PATH)',   description: 'Concatenate strings with separator',              category: 'string', fromType: 'string', toType: 'string', priority: 50 },
  { id: 'str-substr',       label: 'Substring',          template: '$substring($.PATH, 0, 10)',      description: 'Extract substring (start, length)',               category: 'string', fromType: 'string', toType: 'string', priority: 50 },
  { id: 'str-replace',      label: 'Replace',            template: '$replace($.PATH, "old", "new")', description: 'Replace substring occurrences',                   category: 'string', fromType: 'string', toType: 'string', priority: 50 },

  // ─── Array Operations ──────────────────────────────────
  { id: 'arr-join',          label: 'Join',               template: '$join($.PATH, ", ")',            description: 'Join array elements with separator',              category: 'array', fromType: 'array',  toType: 'string',  priority: 90 },
  { id: 'arr-count',         label: 'Count',              template: '$count($.PATH)',                 description: 'Count array elements',                            category: 'array', fromType: 'array',  toType: 'number',  priority: 90 },
  { id: 'arr-first',         label: 'First element',      template: '$.PATH[0]',                      description: 'Get first element of array',                      category: 'array', fromType: 'array',  toType: 'string',  priority: 75 },
  { id: 'arr-has-items',     label: 'Has items?',         template: '$toBool($count($.PATH))',        description: 'True if array is non-empty',                      category: 'array', fromType: 'array',  toType: 'boolean', priority: 80 },
  { id: 'str-split',         label: 'Split',              template: '$split($.PATH, ",")',            description: 'Split string by delimiter into array',            category: 'array', fromType: 'string', toType: 'array',   priority: 90 },

  // ─── Null Handling ─────────────────────────────────────
  { id: 'null-default-str',  label: 'Default (string)',   template: '$ifNull($.PATH, "")',            description: 'Use empty string if source is null/undefined',    category: 'null-handling', fromType: '*', toType: 'string',  priority: 60 },
  { id: 'null-default-num',  label: 'Default (number)',   template: '$ifNull($.PATH, 0)',             description: 'Use 0 if source is null/undefined',               category: 'null-handling', fromType: '*', toType: 'number',  priority: 60 },
  { id: 'null-default-bool', label: 'Default (boolean)',  template: '$ifNull($.PATH, false)',         description: 'Use false if source is null/undefined',           category: 'null-handling', fromType: '*', toType: 'boolean', priority: 60 },

  // ─── Math ──────────────────────────────────────────────
  { id: 'math-round',        label: 'Round',              template: '$round($.PATH)',                 description: 'Round number to nearest integer',                 category: 'math', fromType: 'number', toType: 'number', priority: 65 },
  { id: 'math-abs',          label: 'Absolute',           template: '$abs($.PATH)',                   description: 'Absolute value',                                  category: 'math', fromType: 'number', toType: 'number', priority: 60 },
  { id: 'math-ceil',         label: 'Ceiling',            template: '$ceil($.PATH)',                  description: 'Round up to nearest integer',                     category: 'math', fromType: 'number', toType: 'number', priority: 55 },
  { id: 'math-floor',        label: 'Floor',              template: '$floor($.PATH)',                 description: 'Round down to nearest integer',                   category: 'math', fromType: 'number', toType: 'number', priority: 55 },
];

/**
 * Find templates that convert from sourceType to targetType.
 * Includes wildcard ('*') fromType entries.
 */
export function findTemplatesForConversion(
  sourceType: string,
  targetType: string,
): TransformationTemplate[] {
  return TRANSFORMATION_LIBRARY.filter(
    (t) => (t.fromType === sourceType || t.fromType === '*') && t.toType === targetType,
  );
}

/**
 * Get all templates grouped by category.
 */
export function getTemplatesByCategory(): Map<TransformCategory, TransformationTemplate[]> {
  const grouped = new Map<TransformCategory, TransformationTemplate[]>();
  for (const t of TRANSFORMATION_LIBRARY) {
    const list = grouped.get(t.category) ?? [];
    list.push(t);
    grouped.set(t.category, list);
  }
  return grouped;
}

/**
 * Search templates by label or description.
 */
export function searchTemplates(query: string): TransformationTemplate[] {
  const q = query.toLowerCase();
  return TRANSFORMATION_LIBRARY.filter(
    (t) => t.label.toLowerCase().includes(q) || t.description.toLowerCase().includes(q),
  );
}
