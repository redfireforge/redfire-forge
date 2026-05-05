import { useMemo, useCallback } from 'react';
import type { Scenario, DataSource } from '../../../shared/types';

interface ContractPattern {
  pattern: string;
  count: number;
  isDynamic: boolean;
}

/**
 * Hook for managing validation contract patterns on a DataSource.
 * Handles dynamic/fixed toggle, pattern removal, and array validation mode.
 */
export function useValidationContract(
  dt: DataSource | undefined,
  draft: Scenario,
  onDraftChange: (d: Scenario) => void,
) {
  /** Computed contract patterns from validate columns with array indices */
  const contractPatterns = useMemo<ContractPattern[]>(() => {
    if (!dt) return [];
    const dynamicSet = new Set(dt.validationContract ?? []);
    const patternMap = new Map<string, number>();
    for (const col of dt.columns) {
      if (col.type === 'validate' && col.mapping.match(/\[\d+\]/)) {
        const pattern = col.mapping.replace(/\[\d+\]/g, '[*]');
        patternMap.set(pattern, (patternMap.get(pattern) || 0) + 1);
      }
    }
    return Array.from(patternMap.entries()).map(([pattern, count]) => ({
      pattern,
      count,
      isDynamic: dynamicSet.has(pattern),
    }));
  }, [dt]);

  /** Toggle a pattern between dynamic and fixed */
  const toggleContractPattern = useCallback((pattern: string, makeDynamic: boolean) => {
    if (!dt) return;
    const existing = dt.validationContract ?? [];
    const updatedContract = makeDynamic
      ? [...existing, pattern]
      : existing.filter(p => p !== pattern);
    onDraftChange({ ...draft, dataSource: { ...dt, validationContract: updatedContract.length > 0 ? updatedContract : undefined } });
  }, [dt, draft, onDraftChange]);

  /** Add a new pattern to the stored validation contract */
  const addContractPattern = useCallback((pattern: string) => {
    if (!dt) return;
    const existing = dt.validationContract ?? [];
    if (existing.includes(pattern)) return;
    onDraftChange({ ...draft, dataSource: { ...dt, validationContract: [...existing, pattern] } });
  }, [dt, draft, onDraftChange]);

  /** Remove a pattern and all its columns */
  const removeContractPattern = useCallback((pattern: string) => {
    if (!dt) return;
    const existing = dt.validationContract ?? [];
    const updatedContract = existing.filter(p => p !== pattern);
    const patternRegex = pattern.replace(/\[\*\]/g, '\\[\\d+\\]').replace(/\./g, '\\.');
    const re = new RegExp(`^${patternRegex}$`);
    const removeIds = new Set(dt.columns.filter(c => c.type === 'validate' && re.test(c.mapping)).map(c => c.id));
    const columns = dt.columns.filter(c => !removeIds.has(c.id));
    const rows = dt.rows.map(r => {
      const values = { ...r.values };
      for (const id of removeIds) delete values[id];
      return { ...r, values };
    });
    onDraftChange({ ...draft, dataSource: { ...dt, columns, rows, validationContract: updatedContract.length > 0 ? updatedContract : undefined } });
  }, [dt, draft, onDraftChange]);

  /** Toggle array validation mode between ordered and unordered */
  const toggleArrayMode = useCallback((arrayPrefix: string) => {
    if (!dt) return;
    const modes = { ...(dt.arrayValidationMode ?? {}) };
    modes[arrayPrefix] = modes[arrayPrefix] === 'unordered' ? 'ordered' : 'unordered';
    onDraftChange({ ...draft, dataSource: { ...dt, arrayValidationMode: modes } });
  }, [dt, draft, onDraftChange]);

  return {
    contractPatterns,
    toggleContractPattern,
    addContractPattern,
    removeContractPattern,
    toggleArrayMode,
  };
}
