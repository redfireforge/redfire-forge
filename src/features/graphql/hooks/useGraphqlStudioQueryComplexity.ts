/**
 * Query complexity estimation + warning dismiss on query edit.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { computeQueryComplexity } from '../utils/complexityEstimator';
import type { GraphqlSchemaInfo } from '../../../shared/types/graphql';

export function useGraphqlStudioQueryComplexity(
  schemaStatus: string,
  schemaInfo: GraphqlSchemaInfo | null,
  query: string,
  selectedOperation: string | undefined,
) {
  const complexityResult = useMemo(() => {
    if (schemaStatus !== 'loaded' || !schemaInfo) return null;
    if (!query.trim()) return null;
    return computeQueryComplexity(query, schemaInfo, undefined, selectedOperation);
  }, [query, selectedOperation, schemaInfo, schemaStatus]);

  const [complexityWarningPending, setComplexityWarningPending] = useState(false);
  const prevComplexityQueryRef = useRef('');
  useEffect(() => {
    if (query !== prevComplexityQueryRef.current) {
      prevComplexityQueryRef.current = query;
      setComplexityWarningPending(false);
    }
  }, [query]);

  return { complexityResult, complexityWarningPending, setComplexityWarningPending };
}
