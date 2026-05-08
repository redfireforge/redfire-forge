/**
 * Storage utilities for workflow run configurations (variable history).
 * Tracks which variable values were used in past runs for each workflow.
 */

import { formatRelativeTime as formatRelativeTimeShared } from '../../../shared/utils/formatRelativeTime';

export interface WorkflowRunConfig {
  id: string;
  workflowId: string;
  variables: Record<string, string>;
  /** Optional user-friendly label (e.g., "Staging config", "Prod test") */
  label?: string;
  /** Timestamp when this config was used */
  usedAt: number;
}

const STORAGE_KEY = 'workflow-run-configs';
const MAX_CONFIGS_PER_WORKFLOW = 15;

/**
 * Load all stored workflow run configs.
 */
export function loadWorkflowRunConfigs(): WorkflowRunConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as WorkflowRunConfig[];
  } catch {
    return [];
  }
}

/**
 * Save a run config for a workflow. Deduplicates by variable values.
 * Keeps the most recent MAX_CONFIGS_PER_WORKFLOW per workflow.
 */
export function saveWorkflowRunConfig(config: Omit<WorkflowRunConfig, 'id' | 'usedAt'>): WorkflowRunConfig {
  const all = loadWorkflowRunConfigs();
  
  const varsKey = JSON.stringify(config.variables);
  const existingIdx = all.findIndex(
    c => c.workflowId === config.workflowId && JSON.stringify(c.variables) === varsKey
  );
  
  const newConfig: WorkflowRunConfig = {
    id: existingIdx >= 0 ? all[existingIdx].id : crypto.randomUUID(),
    workflowId: config.workflowId,
    variables: config.variables,
    label: config.label ?? all[existingIdx]?.label,
    usedAt: Date.now(),
  };
  
  if (existingIdx >= 0) {
    all.splice(existingIdx, 1);
  }
  all.unshift(newConfig);
  
  const forThisWorkflow = all.filter(c => c.workflowId === config.workflowId);
  const others = all.filter(c => c.workflowId !== config.workflowId);
  const trimmed = [...forThisWorkflow.slice(0, MAX_CONFIGS_PER_WORKFLOW), ...others];
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  return newConfig;
}

/**
 * Get run configs for a specific workflow, sorted by most recent first.
 */
export function getWorkflowRunConfigs(workflowId: string): WorkflowRunConfig[] {
  return loadWorkflowRunConfigs()
    .filter(c => c.workflowId === workflowId)
    .sort((a, b) => b.usedAt - a.usedAt);
}

/**
 * Manually save a named variable preset (not tied to a run).
 * Unlike saveWorkflowRunConfig, this always creates a new entry and keeps the label.
 */
export function saveWorkflowRunConfigManually(
  workflowId: string,
  variables: Record<string, string>,
  label: string
): WorkflowRunConfig {
  const all = loadWorkflowRunConfigs();
  const newConfig: WorkflowRunConfig = {
    id: crypto.randomUUID(),
    workflowId,
    variables,
    label: label.trim() || undefined,
    usedAt: Date.now(),
  };
  all.unshift(newConfig);
  const forThisWorkflow = all.filter(c => c.workflowId === workflowId);
  const others = all.filter(c => c.workflowId !== workflowId);
  const trimmed = [...forThisWorkflow.slice(0, MAX_CONFIGS_PER_WORKFLOW), ...others];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  return newConfig;
}

/**
 * Update the label of a saved config.
 */
export function updateWorkflowRunConfigLabel(configId: string, label: string): void {
  const all = loadWorkflowRunConfigs();
  const idx = all.findIndex(c => c.id === configId);
  if (idx >= 0) {
    all[idx].label = label || undefined;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  }
}

/**
 * Delete a saved config.
 */
export function deleteWorkflowRunConfig(configId: string): void {
  const all = loadWorkflowRunConfigs().filter(c => c.id !== configId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

/**
 * Format a config for display (shows label or variable summary).
 */
export function formatConfigLabel(config: WorkflowRunConfig): string {
  if (config.label) return config.label;
  const entries = Object.entries(config.variables);
  if (entries.length === 0) return 'No variables';
  if (entries.length <= 2) {
    return entries.map(([k, v]) => `${k}=${v.length > 15 ? v.slice(0, 12) + '...' : v}`).join(', ');
  }
  return `${entries.length} variables`;
}

/**
 * Format relative time (e.g., "2 hours ago", "3 days ago").
 */
export function formatRelativeTime(timestamp: number): string {
  return formatRelativeTimeShared(timestamp, ts => new Date(ts).toLocaleDateString());
}
