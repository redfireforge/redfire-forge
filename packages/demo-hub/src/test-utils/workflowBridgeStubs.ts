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
  return { deleteByName, insertWorkflow };
}

export function clearWorkflowSeedBridge(): void {
  const win = window as unknown as Record<string, unknown>;
  delete win.__wfDeleteByName;
  delete win.__wfInsertWorkflow;
  delete win.__wfWorkflowsLoaded;
  delete win.__wfGetWorkflowByName;
  delete win.__wfSelectByName;
}
