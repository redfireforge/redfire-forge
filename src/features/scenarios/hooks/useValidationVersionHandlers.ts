import { useCallback } from 'react';
import type { MutableRefObject } from 'react';
import type { Scenario } from '../../../shared/types';
import { createResponseVersion, createRulesVersion } from '../utils/versionFactory';

interface UseValidationVersionHandlersDeps {
  draftRef: MutableRefObject<Scenario>;
  onDraftChange: (updated: Scenario) => void;
}

export function useValidationVersionHandlers({ draftRef, onDraftChange }: UseValidationVersionHandlersDeps) {
  const handleSaveResponseVersion = useCallback(() => {
    const prev = draftRef.current;
    const v = prev.validation;
    const json = v.sampleJson || '';
    if (!json.trim()) return;
    const prevVersions = v.responseVersions || [];
    onDraftChange({ ...prev, validation: { ...v, responseVersions: [...prevVersions, createResponseVersion(v, json)] } });
  }, [draftRef, onDraftChange]);

  const handleRestoreResponseVersion = useCallback((ver: { json: string; validationMode?: string; selectiveMode?: string; expectedFields?: unknown[]; excludedPaths?: string[]; unorderedArrays?: boolean }) => {
    const prev = draftRef.current;
    onDraftChange({
      ...prev,
      validation: {
        ...prev.validation,
        sampleJson: ver.json,
        mode: (ver.validationMode as Scenario['validation']['mode']) || prev.validation.mode,
        selectiveMode: (ver.selectiveMode as Scenario['validation']['selectiveMode']) || prev.validation.selectiveMode,
        expectedFields: (ver.expectedFields as Scenario['validation']['expectedFields']) || [],
        excludedPaths: (ver.excludedPaths as string[]) || prev.validation.excludedPaths || [],
        unorderedArrays: ver.unorderedArrays ?? prev.validation.unorderedArrays,
      },
    });
  }, [draftRef, onDraftChange]);

  const handleDeleteResponseVersion = useCallback((id: string) => {
    const prev = draftRef.current;
    onDraftChange({ ...prev, validation: { ...prev.validation, responseVersions: (prev.validation.responseVersions || []).filter((v) => v.id !== id) } });
  }, [draftRef, onDraftChange]);

  const handleRenameResponseVersion = useCallback((id: string, label: string) => {
    const prev = draftRef.current;
    onDraftChange({ ...prev, validation: { ...prev.validation, responseVersions: (prev.validation.responseVersions || []).map((v) => v.id === id ? { ...v, label } : v) } });
  }, [draftRef, onDraftChange]);

  const handleSaveRulesVersion = useCallback(() => {
    const prev = draftRef.current;
    const v = prev.validation;
    if (!(v.expectedFields || []).length && !(v.assertions || []).length) return;
    const prevVersions = v.rulesVersions || [];
    onDraftChange({ ...prev, validation: { ...v, rulesVersions: [...prevVersions, createRulesVersion(v)] } });
  }, [draftRef, onDraftChange]);

  const handleRestoreRulesVersion = useCallback((ver: { validationMode?: string; selectiveMode?: string; expectedFields?: unknown[]; excludedPaths?: string[]; unorderedArrays?: boolean; assertions?: unknown[] }) => {
    const prev = draftRef.current;
    onDraftChange({
      ...prev,
      validation: {
        ...prev.validation,
        mode: (ver.validationMode as Scenario['validation']['mode']) || prev.validation.mode,
        selectiveMode: (ver.selectiveMode as Scenario['validation']['selectiveMode']) || prev.validation.selectiveMode,
        expectedFields: (ver.expectedFields as Scenario['validation']['expectedFields']) || [],
        excludedPaths: (ver.excludedPaths as string[]) || prev.validation.excludedPaths || [],
        unorderedArrays: ver.unorderedArrays ?? prev.validation.unorderedArrays,
        assertions: (ver.assertions as Scenario['validation']['assertions']) ?? prev.validation.assertions,
      },
    });
  }, [draftRef, onDraftChange]);

  const handleDeleteRulesVersion = useCallback((id: string) => {
    const prev = draftRef.current;
    onDraftChange({ ...prev, validation: { ...prev.validation, rulesVersions: (prev.validation.rulesVersions || []).filter((v) => v.id !== id) } });
  }, [draftRef, onDraftChange]);

  const handleRenameRulesVersion = useCallback((id: string, label: string) => {
    const prev = draftRef.current;
    onDraftChange({ ...prev, validation: { ...prev.validation, rulesVersions: (prev.validation.rulesVersions || []).map((v) => v.id === id ? { ...v, label } : v) } });
  }, [draftRef, onDraftChange]);

  return {
    handleSaveResponseVersion,
    handleRestoreResponseVersion,
    handleDeleteResponseVersion,
    handleRenameResponseVersion,
    handleSaveRulesVersion,
    handleRestoreRulesVersion,
    handleDeleteRulesVersion,
    handleRenameRulesVersion,
  };
}
