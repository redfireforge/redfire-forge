import { useMemo, useCallback, useRef } from 'react';
import type { VerifyResult } from './useValidationVerify';

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
    const stripped = path.startsWith('$.') ? path.slice(2) : path;
    const el =
      container.querySelector(`[data-path="${path}"]`) ??
      container.querySelector(`[data-path="${stripped}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      (el as HTMLElement).classList.add('dm-tree-node--flash');
      setTimeout(() => (el as HTMLElement).classList.remove('dm-tree-node--flash'), 1500);
    }
  }, []);

  return { targetPanelRef, verifyFailuresList, handleNavigateToFailure };
}
