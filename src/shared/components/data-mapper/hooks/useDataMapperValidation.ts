import { useRef, useCallback, useMemo, useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { MapperAdapter, Mapping } from '../types';
import { buildJsonTree, getAllPaths } from '../../../utils/jsonTreeModel';
import { useValidationCodeSync } from './useValidationCodeSync';
import { useValidationVerify } from './useValidationVerify';
import { normalizeMapperPath } from '../utils/pathNormalization';
import type { Assertion, ExpectedField } from '../../../types';

export interface DataMapperValidationDeps {
  caps: { codeEditor?: boolean };
  adapter: MapperAdapter;
  mappings: Mapping[];
  activeSourceId: string;
  setMappings: (mappings: Mapping[]) => void;
  onChange?: (mappings: Mapping[]) => void;
  skipNextOnChangeRef: React.MutableRefObject<boolean>;
  initialData?: unknown;
  effectiveTarget: { sampleData?: unknown };
  onAssertionsChange?: (assertions: Assertion[]) => void;
  flushRef?: React.RefObject<(() => void) | null>;
  showRulesView: boolean;
  handleFetchTargetSchema: () => Promise<void>;
  setSourceSample: (sourceId: string, data: unknown) => void;
  setToast: (msg: string) => void;
  unorderedArrays?: boolean;
}

export function useDataMapperValidation(deps: DataMapperValidationDeps) {
  const {
    caps,
    adapter,
    mappings,
    activeSourceId,
    setMappings,
    onChange,
    skipNextOnChangeRef,
    initialData,
    effectiveTarget,
    onAssertionsChange,
    flushRef,
    showRulesView,
    handleFetchTargetSchema,
    setSourceSample,
    setToast,
    unorderedArrays,
  } = deps;

  const validationSamplePaths = useMemo(() => {
    const paths: string[] = [];
    try {
      if (effectiveTarget.sampleData) {
        const parsed = typeof effectiveTarget.sampleData === 'string'
          ? JSON.parse(effectiveTarget.sampleData)
          : effectiveTarget.sampleData;
        const tree = buildJsonTree(parsed, '');
        paths.push(...getAllPaths(tree));
      }
    } catch { /* ignore */ }
    return paths;
  }, [effectiveTarget.sampleData]);

  const validationFields = useMemo(() => {
    if (!caps.codeEditor || !adapter.serialize) return [];
    try {
      const output = adapter.serialize(mappings);
      if (output && typeof output === 'object' && 'expectedFields' in output) {
        return (output as { expectedFields?: ExpectedField[] }).expectedFields ?? [];
      }
    } catch { /* ignore */ }
    return [];
  }, [caps.codeEditor, adapter, mappings]);

  const [validationAssertions, setValidationAssertions] = useState<Assertion[]>(() => {
    if (initialData && typeof initialData === 'object' && 'assertions' in initialData) {
      const data = initialData as { assertions?: Assertion[] };
      return data.assertions ?? [];
    }
    return [];
  });

  const onAssertionsChangeRef = useRef(onAssertionsChange);
  onAssertionsChangeRef.current = onAssertionsChange;

  useEffect(() => {
    if (validationAssertions.length > 0) {
      onAssertionsChangeRef.current?.(validationAssertions);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const prevInitialAssertionsRef = useRef(initialData);
  useEffect(() => {
    if (prevInitialAssertionsRef.current === initialData) return;
    prevInitialAssertionsRef.current = initialData;
    if (initialData && typeof initialData === 'object' && 'assertions' in initialData) {
      const data = initialData as { assertions?: Assertion[] };
      const newAssertions = data.assertions ?? [];
      setValidationAssertions(newAssertions);
      onAssertionsChangeRef.current?.(newAssertions);
    }
  }, [initialData]);

  const handleUpdateValidationFields = useCallback((fields: ExpectedField[]) => {
    const prev = mappings;

    const pm = (fieldPath: string, mappingPath: string): boolean =>
      normalizeMapperPath(fieldPath) === normalizeMapperPath(mappingPath);

    const fieldKey = (f: ExpectedField) => `${f.jsonPath}::${f.operator ?? 'equals'}::${f.negate ? 'NOT' : ''}`;
    const matchedFieldKeys = new Set<string>();

    const kept: Mapping[] = [];
    for (const m of prev) {
      const matchingField = fields.find(f =>
        !matchedFieldKeys.has(fieldKey(f)) &&
        (pm(f.jsonPath, m.targetPath) || pm(f.jsonPath, m.sourcePath)) &&
        (f.operator ?? 'equals') === (m.operator ?? 'equals') &&
        (!!f.negate) === (!!m.negate),
      );
      if (matchingField) {
        matchedFieldKeys.add(fieldKey(matchingField));
        kept.push({
          ...m,
          operator: matchingField.operator ?? m.operator,
          operatorValue: matchingField.operatorValue ?? matchingField.expectedValue ?? m.operatorValue,
          negate: matchingField.negate || undefined,
        });
      } else if (m.expression) {
        kept.push(m);
      }
    }

    const newFields: Mapping[] = fields
      .filter(f => !matchedFieldKeys.has(fieldKey(f)))
      .map(f => ({
        id: uuidv4(),
        sourcePath: f.jsonPath,
        sourceId: activeSourceId,
        targetPath: f.jsonPath,
        operator: f.operator,
        operatorValue: f.operatorValue ?? f.expectedValue,
        ...(f.negate && { negate: true }),
      }));

    const merged = [...kept, ...newFields];
    skipNextOnChangeRef.current = true;
    setMappings(merged);
    onChange?.(merged);
  }, [mappings, activeSourceId, setMappings, onChange, skipNextOnChangeRef]);

  const handleUpdateValidationAssertions = useCallback((assertions: Assertion[]) => {
    setValidationAssertions(assertions);
    onAssertionsChange?.(assertions);
  }, [onAssertionsChange]);

  const validationSync = useValidationCodeSync({
    mappings,
    assertions: validationAssertions,
    fields: validationFields,
    onUpdateFields: handleUpdateValidationFields,
    onUpdateAssertions: handleUpdateValidationAssertions,
    enabled: showRulesView,
  });

  useEffect(() => {
    if (flushRef && 'current' in flushRef) {
      (flushRef as React.MutableRefObject<(() => void) | null>).current = validationSync.flushPending;
    }
    return () => {
      if (flushRef && 'current' in flushRef) {
        (flushRef as React.MutableRefObject<(() => void) | null>).current = null;
      }
    };
  }, [flushRef, validationSync.flushPending]);

  // ── Verification ──
  const [verifyEnabled, setVerifyEnabled] = useState(false);
  const [autoVerifyEnabled, setAutoVerifyEnabled] = useState(false);

  const verifyHook = useValidationVerify({
    mappings,
    assertions: validationAssertions,
    sampleResponseData: effectiveTarget.sampleData,
    adapter,
    enabled: verifyEnabled,
    autoVerify: autoVerifyEnabled,
    unorderedArrays,
  });

  const handleVerifyAll = useCallback(() => {
    // Mirror target sample into source so the overlay resolves values (not "undefined")
    if (effectiveTarget.sampleData != null) {
      setSourceSample(activeSourceId, effectiveTarget.sampleData);
    }
    setVerifyEnabled(true);
    verifyHook.verifyAll();
  }, [verifyHook, effectiveTarget.sampleData, setSourceSample, activeSourceId]);

  const handleFetchAndVerify = useCallback(async () => {
    if (!adapter.fetchTargetSchema) return;
    try {
      setToast('Fetching live response…');
      await handleFetchTargetSchema();
      // For validation adapter, the fetched response is the same data used for source panel.
      // Mirror it into the source so the tree and value overlay populate correctly.
      if (adapter.fetchSampleData) {
        try {
          const srcData = await adapter.fetchSampleData();
          if (srcData != null) setSourceSample(activeSourceId, srcData);
        } catch { /* source fetch is best-effort */ }
      }
      setVerifyEnabled(true);
      setAutoVerifyEnabled(true);
    } catch (e) {
      setToast(`Fetch failed: ${e instanceof Error ? e.message : 'unknown error'}`);
    }
  }, [handleFetchTargetSchema, adapter, setToast, setSourceSample, activeSourceId]);

  const handleToggleAutoVerify = useCallback(() => {
    setAutoVerifyEnabled(prev => {
      const next = !prev;
      if (next) setVerifyEnabled(true);
      return next;
    });
  }, []);

  const handleAddArrayAssertion = useCallback((arrayPath: string, assertionType: 'length' | 'contains' | 'each' | 'subset') => {
    const jsonPath = arrayPath.startsWith('$') ? arrayPath : `$.${arrayPath}`;
    let newAssertion: Assertion;
    switch (assertionType) {
      case 'length':
        newAssertion = { type: 'arrayLength', jsonPath, operator: '>=', value: 1 };
        break;
      case 'contains':
        newAssertion = { type: 'arrayContains', jsonPath, value: '', mode: 'any' };
        break;
      case 'each':
        newAssertion = { type: 'each', jsonPath, fieldPath: '', operator: 'exists', value: undefined };
        break;
      case 'subset':
        newAssertion = { type: 'containsSubset', jsonPath, expected: '{}' };
        break;
    }
    setValidationAssertions(prev => {
      const updated = [...prev, newAssertion];
      onAssertionsChangeRef.current?.(updated);
      return updated;
    });
  }, []);

  const handleUpdateArrayAssertion = useCallback((index: number, patch: Partial<Assertion>) => {
    setValidationAssertions(prev => {
      if (index < 0 || index >= prev.length) return prev;
      const updated = [...prev];
      updated[index] = { ...updated[index], ...patch } as Assertion;
      onAssertionsChangeRef.current?.(updated);
      return updated;
    });
  }, []);

  const handleRemoveArrayAssertion = useCallback((index: number) => {
    setValidationAssertions(prev => {
      if (index < 0 || index >= prev.length) return prev;
      const updated = prev.filter((_, i) => i !== index);
      onAssertionsChangeRef.current?.(updated);
      return updated;
    });
  }, []);

  return {
    validationSamplePaths,
    validationFields,
    validationAssertions,
    validationSync,
    verifyEnabled,
    autoVerifyEnabled,
    verifyHook,
    handleVerifyAll,
    handleFetchAndVerify,
    handleToggleAutoVerify,
    handleAddArrayAssertion,
    handleUpdateArrayAssertion,
    handleRemoveArrayAssertion,
    handleUpdateValidationFields,
    handleUpdateValidationAssertions,
  };
}
