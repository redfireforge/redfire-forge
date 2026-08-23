import type { TraceCaptureLevel } from '@shared/types';

export type WorkflowRunnerBridgeWindow = Window & {
  __wfRunnerApplySelection?: (name: string) => boolean;
  __wfRunnerApplyBatchConfig?: (iterations: number, concurrency: number, traceLevel?: TraceCaptureLevel) => boolean;
  __wfRunnerTriggerRun?: () => boolean;
  __wfRunnerSelectAndRun?: (name: string) => boolean;
};

export function getWorkflowRunnerBridgeWindow(): WorkflowRunnerBridgeWindow {
  return window as WorkflowRunnerBridgeWindow;
}
