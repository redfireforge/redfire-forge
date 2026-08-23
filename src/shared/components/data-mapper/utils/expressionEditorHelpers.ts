import type { ExpressionFunction } from '@workflow/utils/expressionFunctions/types';
import type { MapperSource } from '../types';
import { buildJsonTree, getAllLeafPaths, getAllPaths } from '../../../utils/jsonTreeModel';
import { isValidJson } from '../../../utils/helpers';
import { coerceSampleData } from './mapperParsing';

export function getSourceLeafPaths(sources: MapperSource[], activeSourceId: string): string[] {
  const src = sources.find((s) => s.id === activeSourceId);
  if (src?.sampleData == null) return [];
  const parsed = coerceSampleData(src.sampleData);
  if (parsed == null) return [];
  try {
    const tree = buildJsonTree(parsed, '', '');
    const leaves = getAllLeafPaths(tree);
    const all = getAllPaths(tree);
    const parentPaths = all.filter((p) => p && !leaves.includes(p));
    return [...parentPaths, ...leaves];
  } catch {
    return [];
  }
}

export function toExpressionReference(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '$.value';
  if (trimmed.startsWith('$')) return trimmed;
  const normalized = trimmed.replace(/^\.+/, '');
  return `$.${normalized}`;
}

export function extractTemplateFunctionNames(template: string): string[] {
  const matches = template.match(/\$[a-zA-Z_][a-zA-Z0-9_]*/g) ?? [];
  return Array.from(new Set(matches));
}

const LAMBDA_SNIPPETS: Record<string, string> = {
  $map: '$map(${1:array}, ${2:x} => ${3:expr})',
  $filter: '$filter(${1:array}, ${2:x} => ${3:condition})',
  $reduce: '$reduce(${1:array}, (${2:acc}, ${3:x}) => ${4:expr}, ${5:initial})',
  $sortBy: '$sortBy(${1:array}, ${2:x} => ${3:x.key})',
  $minBy: '$minBy(${1:array}, ${2:x} => ${3:x.key})',
  $maxBy: '$maxBy(${1:array}, ${2:x} => ${3:x.key})',
  $distinctBy: '$distinctBy(${1:array}, ${2:x} => ${3:x.key})',
  $zip: '$zip(${1:array1}, ${2:array2}, (${3:a}, ${4:b}) => ${5:expr})',
  $mapValues: '$mapValues(${1:object}, ${2:v} => ${3:expr})',
  $mapKeys: '$mapKeys(${1:object}, ${2:k} => ${3:expr})',
  $withEntries: '$withEntries(${1:object}, ${2:e} => ${3:e})',
};

export const LAMBDA_INSERT_TEMPLATES: Record<string, string> = {
  $map: '$map(ARRAY, x => x)',
  $filter: '$filter(ARRAY, x => $gt(x, 0))',
  $reduce: '$reduce(ARRAY, (acc, x) => $add(acc, x), 0)',
  $sortBy: '$sortBy(ARRAY, x => x)',
  $minBy: '$minBy(ARRAY, x => x)',
  $maxBy: '$maxBy(ARRAY, x => x)',
  $distinctBy: '$distinctBy(ARRAY, x => x)',
  $zip: '$zip(ARRAY, [], (a, b) => a)',
  $mapValues: '$mapValues(ARRAY, v => v)',
  $mapKeys: '$mapKeys(ARRAY, k => k)',
  $withEntries: '$withEntries(ARRAY, e => e)',
};

export function buildFunctionSnippet(fnCall: string, fn: ExpressionFunction): string {
  if (LAMBDA_SNIPPETS[fnCall]) return LAMBDA_SNIPPETS[fnCall];
  if (fn.args.length > 0) return `${fnCall}(\${1:${fn.args[0].name}})`;
  return `${fnCall}()`;
}

export function fixedValueToExpression(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed === 'true' || trimmed === 'false' || trimmed === 'null') return trimmed;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return trimmed;
  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    if (isValidJson(trimmed)) return trimmed;
  }
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith('\'') && trimmed.endsWith('\''))
  ) {
    return JSON.stringify(trimmed.slice(1, -1));
  }
  return JSON.stringify(trimmed);
}
