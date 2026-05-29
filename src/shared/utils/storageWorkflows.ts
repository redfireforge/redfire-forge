import type { Workflow, WorkflowFolder } from '../../features/workflow/types/workflow';
import {
  idbLoadWorkflows, idbSaveWorkflows, idbMigrateWorkflows,
  idbLoadWorkflowFolders, idbSaveWorkflowFolders, idbMigrateWorkflowFolders,
} from './idbWorkflows';
import { createDualModeArrayStorage } from './storageDualMode';

export const WORKFLOWS_KEY = 'workflows';
export const WORKFLOW_FOLDERS_KEY = 'workflow_folders';

const workflowsStorage = createDualModeArrayStorage<Workflow>({
  key: WORKFLOWS_KEY,
  idbLoad: idbLoadWorkflows,
  idbSave: idbSaveWorkflows,
  idbMigrate: idbMigrateWorkflows,
  swallowWriteErrors: true,
});

const workflowFoldersStorage = createDualModeArrayStorage<WorkflowFolder>({
  key: WORKFLOW_FOLDERS_KEY,
  idbLoad: idbLoadWorkflowFolders,
  idbSave: idbSaveWorkflowFolders,
  idbMigrate: idbMigrateWorkflowFolders,
});

export const loadWorkflows = workflowsStorage.load;
export const saveWorkflows = workflowsStorage.save;

export const loadWorkflowFolders = workflowFoldersStorage.load;
export const saveWorkflowFolders = workflowFoldersStorage.save;

/**
 * Trim version history from all stored workflows to free up localStorage space.
 * Keeps only the N most recent versions per workflow (default 5).
 */
export async function compactWorkflowStorage(maxVersionsPerWorkflow = 5): Promise<{ beforeKB: number; afterKB: number }> {
  const workflows = await loadWorkflows();
  if (workflows.length === 0) return { beforeKB: 0, afterKB: 0 };
  const beforeStr = JSON.stringify(workflows);
  const beforeKB = Math.round(beforeStr.length * 2 / 1024);
  try {
    for (const wf of workflows) {
      if (wf.versions && wf.versions.length > maxVersionsPerWorkflow) {
        wf.versions = wf.versions.slice(0, maxVersionsPerWorkflow);
      }
    }
    await saveWorkflows(workflows);
    const afterStr = JSON.stringify(workflows);
    const afterKB = Math.round(afterStr.length * 2 / 1024);
    return { beforeKB, afterKB };
  } catch {
    return { beforeKB, afterKB: beforeKB };
  }
}

/** Migrate workflow localStorage keys to IndexedDB (browser only). */
export async function migrateWorkflowKeysToIdb(): Promise<void> {
  const migrations: Array<{ check: string; fn: () => Promise<boolean | number> }> = [
    { check: WORKFLOWS_KEY, fn: () => idbMigrateWorkflows(WORKFLOWS_KEY) },
    { check: WORKFLOW_FOLDERS_KEY, fn: () => idbMigrateWorkflowFolders(WORKFLOW_FOLDERS_KEY) },
  ];
  for (const { check, fn } of migrations) {
    if (localStorage.getItem(check)) {
      try { await fn(); } catch { /* ignore */ }
    }
  }
}
