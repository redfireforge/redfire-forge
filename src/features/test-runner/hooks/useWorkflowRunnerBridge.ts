import { useLayoutEffect, type MutableRefObject } from 'react';
import { flushSync } from 'react-dom';
import type { TraceCaptureLevel, ExecutionTraceOptions } from '@shared/types';
import type { Workflow } from '@workflow/types/workflow';
import { buildInitialRunnerVariables } from '@workflow/utils/countWorkflowDesignerVariables';
import { getWorkflowRunnerBridgeWindow } from '../workflowRunnerBridge';

export interface UseWorkflowRunnerBridgeParams {
  workflowsRef: MutableRefObject<Workflow[]>;
  selectedWorkflowIdRef: MutableRefObject<string | null>;
  workflowVariablesRef: MutableRefObject<Record<string, string>>;
  executionModeRef: MutableRefObject<string>;
  iterationsRef: MutableRefObject<number>;
  concurrencyRef: MutableRefObject<number>;
  traceOptionsRef: MutableRefObject<ExecutionTraceOptions>;
  handleRunRef: MutableRefObject<() => boolean>;
  setSelectedWorkflowId: (id: string | null) => void;
  setWorkflowVariables: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setVariablesInitialized: React.Dispatch<React.SetStateAction<boolean>>;
  setExecutionMode: (mode: 'batch' | 'load-profile') => void;
  setIterations: React.Dispatch<React.SetStateAction<number>>;
  setConcurrency: React.Dispatch<React.SetStateAction<number>>;
  setTraceOptions: React.Dispatch<React.SetStateAction<ExecutionTraceOptions>>;
}

export function useWorkflowRunnerBridge({
  workflowsRef,
  selectedWorkflowIdRef,
  workflowVariablesRef,
  executionModeRef,
  iterationsRef,
  concurrencyRef,
  traceOptionsRef,
  handleRunRef,
  setSelectedWorkflowId,
  setWorkflowVariables,
  setVariablesInitialized,
  setExecutionMode,
  setIterations,
  setConcurrency,
  setTraceOptions,
}: UseWorkflowRunnerBridgeParams): void {
  useLayoutEffect(() => {
    const win = getWorkflowRunnerBridgeWindow();
    const applySelection = (name: string): boolean => {
      const wf = workflowsRef.current.find((w) => w.name === name);
      if (!wf) return false;
      const vars = buildInitialRunnerVariables(wf);
      flushSync(() => {
        setSelectedWorkflowId(wf.id);
        setWorkflowVariables(vars);
        setVariablesInitialized(true);
      });
      selectedWorkflowIdRef.current = wf.id;
      workflowVariablesRef.current = vars;
      return true;
    };
    win.__wfRunnerApplySelection = applySelection;
    win.__wfRunnerApplyBatchConfig = (
      batchIterations: number,
      batchConcurrency: number,
      traceLevel: TraceCaptureLevel = 'standard',
    ) => {
      const nextTraceOptions = {
        ...traceOptionsRef.current,
        traceLevel,
        captureFullTrace: traceLevel === 'full' || traceLevel === 'debug',
      };
      flushSync(() => {
        setExecutionMode('batch');
        setIterations(batchIterations);
        setConcurrency(batchConcurrency);
        setTraceOptions(nextTraceOptions);
      });
      executionModeRef.current = 'batch';
      iterationsRef.current = batchIterations;
      concurrencyRef.current = batchConcurrency;
      traceOptionsRef.current = nextTraceOptions;
      return true;
    };
    win.__wfRunnerTriggerRun = () => handleRunRef.current();
    win.__wfRunnerSelectAndRun = (name: string) => {
      if (!applySelection(name)) return false;
      return handleRunRef.current();
    };
    return () => {
      delete win.__wfRunnerApplySelection;
      delete win.__wfRunnerApplyBatchConfig;
      delete win.__wfRunnerTriggerRun;
      delete win.__wfRunnerSelectAndRun;
    };
  }, [
    workflowsRef,
    selectedWorkflowIdRef,
    workflowVariablesRef,
    executionModeRef,
    iterationsRef,
    concurrencyRef,
    traceOptionsRef,
    handleRunRef,
    setSelectedWorkflowId,
    setWorkflowVariables,
    setVariablesInitialized,
    setExecutionMode,
    setIterations,
    setConcurrency,
    setTraceOptions,
  ]);
}
