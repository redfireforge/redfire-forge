/**
 * IndexedDB storage backend for workflows (browser only).
 * Same pattern as idbFeatureGroups.ts — single key "all" in "workflows" store.
 */

import type { Workflow, WorkflowFolder } from '../../features/workflow/types/workflow';
import { createIdbBlobStore } from './idbHelpers';

const STORE_WORKFLOWS = 'workflows';
const STORE_WORKFLOW_FOLDERS = 'workflowFolders';

const workflowsStore = createIdbBlobStore<Workflow[]>(
  STORE_WORKFLOWS,
  (d) => Array.isArray(d) && d.length > 0,
);

export const idbLoadWorkflows = workflowsStore.load;
export const idbSaveWorkflows = workflowsStore.save;
export const idbMigrateWorkflows = workflowsStore.migrate;

const workflowFoldersStore = createIdbBlobStore<WorkflowFolder[]>(
  STORE_WORKFLOW_FOLDERS,
  (d) => Array.isArray(d) && d.length > 0,
);

export const idbLoadWorkflowFolders = workflowFoldersStore.load;
export const idbSaveWorkflowFolders = workflowFoldersStore.save;
export const idbMigrateWorkflowFolders = workflowFoldersStore.migrate;
