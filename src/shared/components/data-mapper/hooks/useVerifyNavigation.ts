import { useMemo, useCallback, useRef } from 'react';
import type { VerifyResult } from './useValidationVerify';
import { stripJsonPathPrefix } from '../../../utils/jsonPath';
import { flashTreeNode } from '../utils/targetTreeHelpers';

export function useVerifyNavigation(verifyResult: VerifyResult) {
  const targetPanelRef = useRef<HTMLDivElement>(null);

  const verifyFailuresList = useMemo(() => {
    if (verifyResult.status !== 'complete') return [];
    const list: { path: string; expected?: string; actual?: string }[] = [];
    for (const [path, r] of verifyResult.fieldResults) {
      if (!r.passed) {
        list.push({ path, expected: r.expected, actual: r.actual });
      }
    }
    for (const ar of verifyResult.assertionResults) {
      if (!ar.passed) {
        const aPath = 'jsonPath' in ar.assertion ? (ar.assertion as { jsonPath: string }).jsonPath : ar.assertion.type;
        list.push({ path: aPath, expected: ar.expected, actual: ar.actual });
      }
    }
    return list;
  }, [verifyResult]);

  const handleNavigateToFailure = useCallback((path: string) => {
    const container = targetPanelRef.current;
    if (!container) return;
    const stripped = stripJsonPathPrefix(path);
    const el =
      container.querySelector(`[data-path="${path}"]`) ??
      container.querySelector(`[data-path="${stripped}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      flashTreeNode(el);
    }
  }, []);

  return { targetPanelRef, verifyFailuresList, handleNavigateToFailure };
}
