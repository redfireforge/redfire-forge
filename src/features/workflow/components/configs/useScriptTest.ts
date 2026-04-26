import { useState, useMemo, useCallback } from 'react';
import type { ScriptNodeData, ScriptMode } from '../../types/workflow';
import type { ScriptResult } from '../../engine/scriptSandbox';
import { executeScript } from '../../engine/scriptSandbox';
import { detectOutputVariables, analyzeScriptComplexity, inferMockInputs } from '../../engine/scriptAnalysis';
import { loadScriptLibraries, buildLibraryPreamble } from '../../engine/scriptLibraries';
import type { ScriptLibrary } from '../../engine/scriptLibraries';

/** Shared mode options for script node dropdowns. */
export const SCRIPT_MODE_OPTIONS: { value: ScriptMode; label: string; description: string }[] = [
  { value: 'transform', label: 'Transform', description: 'Transform data from input to output variables' },
  { value: 'validate', label: 'Validate', description: 'Validate data — set output.result to true/false' },
  { value: 'generate', label: 'Generate', description: 'Generate new data from scratch' },
];

/** Initialize mock inputs from workflow variables for the given input variable list. */
export function initMockInputs(
  inputVariables: string[],
  workflowVariables: Record<string, string>,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const v of inputVariables) {
    if (v && workflowVariables[v]) result[v] = workflowVariables[v];
  }
  return result;
}

/**
 * Hook encapsulating shared script testing logic used by both ScriptConfig and ScriptCodeModal.
 */
export function useScriptTest(
  data: ScriptNodeData,
  workflowVariables: Record<string, string>,
) {
  const [testResult, setTestResult] = useState<ScriptResult | null>(null);
  const [mockInputs, setMockInputs] = useState<Record<string, string>>(
    () => initMockInputs(data.inputVariables, workflowVariables),
  );

  const libraries = useMemo<ScriptLibrary[]>(() => loadScriptLibraries(), []);

  const inferredDefaults = useMemo(
    () => inferMockInputs(data.code, data.inputVariables),
    [data.code, data.inputVariables],
  );

  const complexityWarnings = useMemo(
    () => analyzeScriptComplexity(data.code),
    [data.code],
  );

  const handleTestScript = useCallback(() => {
    const inputs: Record<string, string> = {};
    for (const v of data.inputVariables) {
      if (v) inputs[v] = mockInputs[v] || workflowVariables[v] || inferredDefaults[v] || 'test';
    }
    const result = executeScript(data, inputs,
      data.libraryIds?.length ? buildLibraryPreamble(libraries, data.libraryIds) : undefined,
    );
    setTestResult(result);
  }, [data, mockInputs, workflowVariables, inferredDefaults, libraries]);

  const handleAutoDetect = useCallback((): string[] => {
    return detectOutputVariables(data.code);
  }, [data.code]);

  const handleMockInputChange = useCallback((name: string, value: string) => {
    setMockInputs(prev => ({ ...prev, [name]: value }));
  }, []);

  return {
    testResult,
    setTestResult,
    mockInputs,
    setMockInputs,
    libraries,
    inferredDefaults,
    complexityWarnings,
    handleTestScript,
    handleAutoDetect,
    handleMockInputChange,
  };
}
