import { vi } from 'vitest';

/** Minimal window bridge stubs so seedNamedWorkflow completes without polling timeouts. */
export function stubWorkflowSeedBridge(
  workflowName: string,
  opts: {
    deleteByName?: ReturnType<typeof vi.fn>;
    insertWorkflow?: ReturnType<typeof vi.fn>;
  } = {},
): { deleteByName: ReturnType<typeof vi.fn>; insertWorkflow: ReturnType<typeof vi.fn> } {
  const win = window as unknown as Record<string, unknown>;
  const deleteByName = opts.deleteByName ?? vi.fn();
  const insertWorkflow = opts.insertWorkflow ?? vi.fn();
  win.__wfDeleteByName = deleteByName;
  win.__wfInsertWorkflow = insertWorkflow;
  win.__wfWorkflowsLoaded = true;
  win.__wfGetWorkflowByName = (name: string) => (name === workflowName ? { name } : null);
  win.__wfSelectByName = vi.fn(() => true);
  stubRunnerBridge();
  return { deleteByName, insertWorkflow };
}

/** Workflow Runner bridge stubs — avoids 8s waitForRunnerBridge polling in unit tests. */
export function stubRunnerBridge(
  opts: {
    selectAndRun?: boolean;
    applyBatchConfig?: boolean;
  } = {},
): void {
  const win = window as unknown as Record<string, unknown>;
  win.__wfRunnerSelectByName = vi.fn(() => true);
  win.__wfRunnerApplySelection = vi.fn(() => true);
  win.__wfRunnerApplyBatchConfig = vi.fn(() => opts.applyBatchConfig ?? true);
  win.__wfRunnerSelectAndRun = vi.fn(() => opts.selectAndRun ?? false);
  win.__wfRunnerTriggerRun = vi.fn(() => false);
}

export function clearWorkflowSeedBridge(): void {
  const win = window as unknown as Record<string, unknown>;
  delete win.__wfDeleteByName;
  delete win.__wfInsertWorkflow;
  delete win.__wfWorkflowsLoaded;
  delete win.__wfGetWorkflowByName;
  delete win.__wfSelectByName;
  delete win.__wfRunnerSelectByName;
  delete win.__wfRunnerApplySelection;
  delete win.__wfRunnerApplyBatchConfig;
  delete win.__wfRunnerSelectAndRun;
  delete win.__wfRunnerTriggerRun;
}
