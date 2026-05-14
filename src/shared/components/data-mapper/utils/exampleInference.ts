/**
 * Example-based mapping inference engine (Phase 10C.3).
 *
 * Given 1–5 input/output example pairs (JSON), infers mapping rules
 * by comparing field values between inputs and outputs using:
 *  1. Exact value matching (highest confidence)
 *  2. Substring / containment matching
 *  3. Type + position heuristics
 *
 * Results are returned as inference candidates with confidence scores,
 * ready to be converted to pending auto-map suggestions.
 */

export interface ExamplePair {
  input: unknown;
  output: unknown;
}

export interface InferredMapping {
  sourcePath: string;
  targetPath: string;
  confidence: number;
  reason: string;
  expression?: string;
}

/**
 * Flatten a JSON object into a map of dot-separated paths → values.
 */
function flattenObject(
  obj: unknown,
  prefix: string = '',
  result: Map<string, unknown> = new Map(),
): Map<string, unknown> {
  if (obj === null || obj === undefined) {
    if (prefix) result.set(prefix, obj);
    return result;
  }
  if (Array.isArray(obj)) {
    if (prefix) result.set(prefix, obj);
    if (obj.length > 0 && typeof obj[0] === 'object' && obj[0] !== null) {
      flattenObject(obj[0], `${prefix}[0]`, result);
    }
    return result;
  }
  if (typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const path = prefix ? `${prefix}.${key}` : key;
      flattenObject(value, path, result);
    }
    return result;
  }
  if (prefix) result.set(prefix, obj);
  return result;
}

/**
 * Check if two values are strictly equal (deep for primitives).
 */
function valuesMatch(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a === 'string' && typeof b === 'string') return a === b;
  if (typeof a === 'number' && typeof b === 'number') return a === b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return a === b;
  return false;
}

/**
 * Check if source string value is contained within target string value
 * or vice versa (for substring transformations).
 */
function substringMatch(source: unknown, target: unknown): 'contained' | 'contains' | null {
  if (typeof source !== 'string' || typeof target !== 'string') return null;
  if (source.length < 2 || target.length < 2) return null;
  if (target.includes(source) && target !== source) return 'contained';
  if (source.includes(target) && source !== target) return 'contains';
  return null;
}

/**
 * Detect if a value was transformed from source to target via a common operation.
 */
function detectTransformation(source: unknown, target: unknown): { expression: string; reason: string } | null {
  if (typeof source === 'string' && typeof target === 'string') {
    if (source.toLowerCase() === target) return { expression: '$lower($.PATH)', reason: 'lowercase transformation' };
    if (source.toUpperCase() === target) return { expression: '$upper($.PATH)', reason: 'uppercase transformation' };
    if (source.trim() === target && source !== target) return { expression: '$trim($.PATH)', reason: 'trim transformation' };
  }
  if (typeof source === 'string' && typeof target === 'number') {
    if (parseFloat(source) === target) return { expression: '$parseFloat($.PATH)', reason: 'string→number parse' };
  }
  if (typeof source === 'number' && typeof target === 'string') {
    if (String(source) === target) return { expression: '$toString($.PATH)', reason: 'number→string conversion' };
  }
  if (typeof source === 'boolean' && typeof target === 'string') {
    if (String(source) === target) return { expression: '$toString($.PATH)', reason: 'boolean→string conversion' };
  }
  if (typeof source === 'string' && typeof target === 'boolean') {
    if ((source === 'true' && target === true) || (source === 'false' && target === false)) {
      return { expression: '$toBool($.PATH)', reason: 'string→boolean conversion' };
    }
  }
  if (Array.isArray(source) && typeof target === 'string') {
    const joined = source.join(', ');
    if (joined === target) return { expression: '$join($.PATH, ", ")', reason: 'array join' };
    const joined2 = source.join(',');
    if (joined2 === target) return { expression: '$join($.PATH, ",")', reason: 'array join' };
  }
  if (typeof source === 'string' && Array.isArray(target)) {
    const split = source.split(',').map((s) => s.trim());
    if (split.length === target.length && split.every((v, i) => v === String(target[i]))) {
      return { expression: '$split($.PATH, ",")', reason: 'string split' };
    }
  }
  if (Array.isArray(source) && typeof target === 'number') {
    if (source.length === target) return { expression: '$count($.PATH)', reason: 'array count' };
  }
  return null;
}

/**
 * Infer mappings from a set of input/output example pairs.
 *
 * Algorithm:
 * 1. Flatten all inputs and outputs to leaf paths
 * 2. For each output path, search for matching input paths across all examples
 * 3. Exact value matches across all examples → high confidence (95)
 * 4. Exact match in most examples → medium-high confidence (80)
 * 5. Transformation detected → medium confidence (75)
 * 6. Substring match → lower confidence (60)
 */
export function inferMappingsFromExamples(examples: ExamplePair[]): InferredMapping[] {
  if (examples.length === 0) return [];

  const flatExamples = examples.map((ex) => ({
    inputs: flattenObject(ex.input),
    outputs: flattenObject(ex.output),
  }));

  const allOutputPaths = new Set<string>();
  for (const flat of flatExamples) {
    for (const path of flat.outputs.keys()) {
      allOutputPaths.add(path);
    }
  }

  const allInputPaths = new Set<string>();
  for (const flat of flatExamples) {
    for (const path of flat.inputs.keys()) {
      allInputPaths.add(path);
    }
  }

  const inferred: InferredMapping[] = [];
  const usedTargets = new Set<string>();
  const usedSources = new Set<string>();

  for (const targetPath of allOutputPaths) {
    if (usedTargets.has(targetPath)) continue;

    let bestMatch: InferredMapping | null = null;

    for (const sourcePath of allInputPaths) {
      if (usedSources.has(sourcePath)) continue;

      let exactMatchCount = 0;
      let transformMatch: { expression: string; reason: string } | null = null;
      let subMatch: 'contained' | 'contains' | null = null;
      let totalComparisons = 0;

      for (const flat of flatExamples) {
        const srcVal = flat.inputs.get(sourcePath);
        const tgtVal = flat.outputs.get(targetPath);

        if (srcVal === undefined || tgtVal === undefined) continue;
        totalComparisons++;

        if (valuesMatch(srcVal, tgtVal)) {
          exactMatchCount++;
        } else {
          if (!transformMatch) {
            transformMatch = detectTransformation(srcVal, tgtVal);
          }
          if (!subMatch) {
            subMatch = substringMatch(srcVal, tgtVal);
          }
        }
      }

      if (totalComparisons === 0) continue;

      const exactRatio = exactMatchCount / totalComparisons;

      if (exactRatio === 1 && totalComparisons >= 1) {
        const confidence = totalComparisons >= 2 ? 95 : 85;
        if (!bestMatch || confidence > bestMatch.confidence) {
          bestMatch = {
            sourcePath,
            targetPath,
            confidence,
            reason: totalComparisons >= 2
              ? `Exact value match across ${totalComparisons} examples`
              : 'Exact value match in 1 example',
          };
        }
      } else if (exactRatio >= 0.5 && totalComparisons >= 2) {
        const confidence = 80;
        if (!bestMatch || confidence > bestMatch.confidence) {
          bestMatch = {
            sourcePath,
            targetPath,
            confidence,
            reason: `Exact match in ${exactMatchCount}/${totalComparisons} examples`,
          };
        }
      } else if (transformMatch && exactMatchCount === 0) {
        const confidence = 75;
        if (!bestMatch || confidence > bestMatch.confidence) {
          bestMatch = {
            sourcePath,
            targetPath,
            confidence,
            reason: transformMatch.reason,
            expression: transformMatch.expression.replace(/\$\.PATH/g, sourcePath.startsWith('$.') ? sourcePath : `$.${sourcePath}`),
          };
        }
      } else if (subMatch && exactMatchCount === 0) {
        const confidence = 60;
        if (!bestMatch || confidence > bestMatch.confidence) {
          bestMatch = {
            sourcePath,
            targetPath,
            confidence,
            reason: subMatch === 'contained' ? 'Source value contained in target' : 'Target value contained in source',
          };
        }
      }
    }

    if (bestMatch) {
      inferred.push(bestMatch);
      usedTargets.add(targetPath);
      usedSources.add(bestMatch.sourcePath);
    }
  }

  inferred.sort((a, b) => b.confidence - a.confidence);
  return inferred;
}

/**
 * Validate that a JSON string can be parsed and is a plain object.
 */
export function parseExampleJson(json: string): { data: unknown; error?: string } {
  const trimmed = json.trim();
  if (!trimmed) return { data: null, error: 'Empty input' };
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed === null || typeof parsed !== 'object') {
      return { data: null, error: 'Expected a JSON object or array' };
    }
    return { data: parsed };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Invalid JSON' };
  }
}
