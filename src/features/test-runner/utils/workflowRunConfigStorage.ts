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
/** Cap total history entries so orphaned workflow ids cannot fill localStorage. */
const MAX_TOTAL_CONFIGS = 100;

function isQuotaExceededError(err: unknown): boolean {
  if (err instanceof DOMException && (err.name === 'QuotaExceededError' || err.code === 22)) {
    return true;
  }
  return err instanceof Error && err.name === 'QuotaExceededError';
}

function trimConfigsGlobally(
  configs: WorkflowRunConfig[],
  maxPerWorkflow: number,
  maxTotal: number,
): WorkflowRunConfig[] {
  const byWorkflow = new Map<string, WorkflowRunConfig[]>();
  for (const config of configs) {
    const list = byWorkflow.get(config.workflowId) ?? [];
    list.push(config);
    byWorkflow.set(config.workflowId, list);
  }

  const trimmed: WorkflowRunConfig[] = [];
  for (const list of byWorkflow.values()) {
    list.sort((a, b) => b.usedAt - a.usedAt);
    trimmed.push(...list.slice(0, maxPerWorkflow));
  }

  trimmed.sort((a, b) => b.usedAt - a.usedAt);
  return trimmed.slice(0, maxTotal);
}

function persistWorkflowRunConfigs(configs: WorkflowRunConfig[], mustKeep?: WorkflowRunConfig): boolean {
  const attempts = [
    configs,
    trimConfigsGlobally(configs, MAX_CONFIGS_PER_WORKFLOW, MAX_TOTAL_CONFIGS),
    trimConfigsGlobally(configs, 5, 25),
    trimConfigsGlobally(configs, 1, 10),
    mustKeep ? [mustKeep] : configs.slice(0, 1),
  ];

  for (const batch of attempts) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(batch));
      return true;
    } catch (err) {
      if (!isQuotaExceededError(err)) throw err;
    }
  }

  console.warn(
    '[workflowRunConfigStorage] Could not persist run config history — localStorage quota exceeded.',
  );
  return false;
}

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
 * Keeps the most recent MAX_CONFIGS_PER_WORKFLOW per workflow and MAX_TOTAL_CONFIGS overall.
 * Never throws on quota errors — run execution must not be blocked by history persistence.
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

  const trimmed = trimConfigsGlobally(all, MAX_CONFIGS_PER_WORKFLOW, MAX_TOTAL_CONFIGS);
  persistWorkflowRunConfigs(trimmed, newConfig);
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
  const trimmed = trimConfigsGlobally(all, MAX_CONFIGS_PER_WORKFLOW, MAX_TOTAL_CONFIGS);
  persistWorkflowRunConfigs(trimmed, newConfig);
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
    persistWorkflowRunConfigs(all, all[idx]);
  }
}

/**
 * Delete a saved config.
 */
export function deleteWorkflowRunConfig(configId: string): void {
  const all = loadWorkflowRunConfigs().filter(c => c.id !== configId);
  persistWorkflowRunConfigs(all);
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
