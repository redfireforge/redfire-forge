import { useMemo } from 'react';
import type { ExpressionFunction, Mapping, MapperSource } from '../types';
import { evaluateMapperExpression, resolveMapperPath } from '../utils/mapperExpressionEvaluator';

function toDisplay(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function useMappingOverlay(
  mappings: Mapping[],
  activeSourceId: string,
  effectiveSources: MapperSource[],
  customFunctions?: ExpressionFunction[],
): Map<string, { value: string; isError: boolean }> | undefined {
  return useMemo(() => {
    if (mappings.length === 0) return undefined;

    const overlay = new Map<string, { value: string; isError: boolean }>();

    for (const mapping of mappings) {
      const sourceId = mapping.sourceId || activeSourceId;
      if (!mapping.targetPath) continue;
      try {
        if (mapping.expression) {
          const result = evaluateMapperExpression(
            mapping.expression,
            effectiveSources,
            sourceId,
            customFunctions,
          );
          if (result.error) {
            overlay.set(mapping.targetPath, { value: result.error, isError: true });
          } else {
            overlay.set(mapping.targetPath, {
              value: toDisplay(result.value),
              isError: result.value === undefined,
            });
          }
          continue;
        }
        const resolved = resolveMapperPath(mapping.sourcePath, effectiveSources, sourceId);
        overlay.set(mapping.targetPath, {
          value: toDisplay(resolved),
          isError: resolved === undefined,
        });
      } catch (e) {
        overlay.set(mapping.targetPath, {
          value: e instanceof Error ? e.message : 'Evaluation failed',
          isError: true,
        });
      }
    }

    return overlay.size > 0 ? overlay : undefined;
  }, [mappings, activeSourceId, effectiveSources, customFunctions]);
}
