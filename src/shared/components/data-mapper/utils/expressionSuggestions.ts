/**
 * Expression suggestions engine (Phase 10C.1).
 *
 * When a user creates a mapping between incompatible types, this module
 * produces a ranked list of transformation suggestions that can fix the
 * mismatch. Suggestions are shown as chips on the connection line.
 */

import type { Mapping, MapperSource, MapperTarget } from '../types';
import { inferType, looksLikeDate, typesCompatible, resolveTargetType } from './typeMismatch';
import { resolveSourceValue, resolveTargetValue, toJsonPathRef } from './mapperParsing';
import { findTemplatesForConversion } from './transformationLibrary';

export interface ExpressionSuggestion {
  mappingId: string;
  label: string;
  expression: string;
  description: string;
  category: string;
  priority: number;
}

/**
 * Generate expression suggestions for a single mapping.
 */
export function suggestExpressionsForMapping(
  mapping: Mapping,
  sources: MapperSource[],
  target: MapperTarget,
): ExpressionSuggestion[] {
  if (mapping.expression) return [];

  const sourceValue = resolveSourceValue(mapping, sources);
  const targetValue = resolveTargetValue(mapping.targetPath, target);
  const sourceType = sourceValue !== undefined ? inferType(sourceValue) : null;
  const targetType = resolveTargetType(mapping.targetPath, target);

  if (!sourceType || !targetType) return [];
  if (typesCompatible(sourceType, targetType)) {
    if (sourceType === 'string' && targetType === 'string') {
      return suggestStringToStringSuggestions(mapping, sourceValue, targetValue);
    }
    return [];
  }

  const suggestions: ExpressionSuggestion[] = [];
  const pathRef = toJsonPathRef(mapping.sourcePath);
  const conversionKey = `${sourceType}→${targetType}`;

  const templates = findTemplatesForConversion(sourceType, targetType);
  for (const tmpl of templates) {
    suggestions.push({
      mappingId: mapping.id,
      label: tmpl.label,
      expression: tmpl.template.replace(/\$\.PATH/g, pathRef),
      description: tmpl.description,
      category: tmpl.category,
      priority: tmpl.priority,
    });
  }

  if (suggestions.length === 0) {
    const fallback = getFallbackSuggestion(conversionKey, pathRef);
    if (fallback) {
      suggestions.push({
        mappingId: mapping.id,
        ...fallback,
      });
    }
  }

  suggestions.sort((a, b) => b.priority - a.priority);
  return suggestions;
}

function suggestStringToStringSuggestions(
  mapping: Mapping,
  sourceValue: unknown,
  targetValue: unknown,
): ExpressionSuggestion[] {
  const suggestions: ExpressionSuggestion[] = [];
  const pathRef = toJsonPathRef(mapping.sourcePath);

  const srcIsDate = looksLikeDate(sourceValue);
  const tgtIsDate = looksLikeDate(targetValue);

  if (srcIsDate && !tgtIsDate) {
    suggestions.push({
      mappingId: mapping.id,
      label: 'Format date',
      expression: `$formatDate(${pathRef}, "YYYY-MM-DD")`,
      description: 'Reformat date string to target format',
      category: 'date',
      priority: 80,
    });
  } else if (srcIsDate && tgtIsDate) {
    suggestions.push({
      mappingId: mapping.id,
      label: 'Normalize date',
      expression: `$formatDate(${pathRef}, "YYYY-MM-DD")`,
      description: 'Normalize both date formats',
      category: 'date',
      priority: 70,
    });
  }

  if (typeof sourceValue === 'string' && typeof targetValue === 'string') {
    if (sourceValue.includes(' ') && !targetValue.includes(' ')) {
      suggestions.push({
        mappingId: mapping.id,
        label: 'Trim',
        expression: `$trim(${pathRef})`,
        description: 'Trim whitespace from string',
        category: 'string',
        priority: 50,
      });
    }
    if (sourceValue !== sourceValue.toLowerCase() && targetValue === targetValue.toLowerCase()) {
      suggestions.push({
        mappingId: mapping.id,
        label: 'Lowercase',
        expression: `$lowercase(${pathRef})`,
        description: 'Convert to lowercase',
        category: 'string',
        priority: 40,
      });
    }
    if (sourceValue !== sourceValue.toUpperCase() && targetValue === targetValue.toUpperCase()) {
      suggestions.push({
        mappingId: mapping.id,
        label: 'Uppercase',
        expression: `$uppercase(${pathRef})`,
        description: 'Convert to uppercase',
        category: 'string',
        priority: 40,
      });
    }
  }

  return suggestions;
}

const FALLBACK_MAP: Record<string, Omit<ExpressionSuggestion, 'mappingId'>> = {
  'string→number': { label: 'Parse number', expression: '$parseFloat($.PATH)', description: 'Parse string to number', category: 'conversion', priority: 90 },
  'string→boolean': { label: 'To boolean', expression: '$toBool($.PATH)', description: 'Convert string to boolean', category: 'conversion', priority: 90 },
  'number→string': { label: 'To string', expression: '$toString($.PATH)', description: 'Convert number to string', category: 'conversion', priority: 90 },
  'boolean→string': { label: 'To string', expression: '$toString($.PATH)', description: 'Convert boolean to string', category: 'conversion', priority: 90 },
  'boolean→number': { label: 'To int', expression: '$toInt($.PATH)', description: 'Convert boolean to integer', category: 'conversion', priority: 90 },
  'number→boolean': { label: 'To boolean', expression: '$toBool($.PATH)', description: 'Convert number to boolean', category: 'conversion', priority: 90 },
  'array→string': { label: 'Join', expression: '$join($.PATH, ", ")', description: 'Join array to comma-separated string', category: 'conversion', priority: 85 },
  'string→array': { label: 'Split', expression: '$split($.PATH, ",")', description: 'Split string into array', category: 'conversion', priority: 85 },
  'array→number': { label: 'Count', expression: '$count($.PATH)', description: 'Count array elements', category: 'conversion', priority: 85 },
  'array→boolean': { label: 'Has items', expression: '$toBool($count($.PATH))', description: 'True if array is non-empty', category: 'conversion', priority: 80 },
  'object→string': { label: 'Stringify', expression: '$toString($.PATH)', description: 'Convert object to JSON string', category: 'conversion', priority: 70 },
};

function getFallbackSuggestion(conversionKey: string, pathRef: string): Omit<ExpressionSuggestion, 'mappingId'> | null {
  const tmpl = FALLBACK_MAP[conversionKey];
  if (!tmpl) return null;
  return {
    ...tmpl,
    expression: tmpl.expression.replace(/\$\.PATH/g, pathRef),
  };
}

/**
 * Generate suggestions for all mappings that have type mismatches.
 */
export function suggestExpressionsForAll(
  mappings: Mapping[],
  sources: MapperSource[],
  target: MapperTarget,
): Map<string, ExpressionSuggestion[]> {
  const result = new Map<string, ExpressionSuggestion[]>();
  for (const mapping of mappings) {
    const suggestions = suggestExpressionsForMapping(mapping, sources, target);
    if (suggestions.length > 0) {
      result.set(mapping.id, suggestions);
    }
  }
  return result;
}
