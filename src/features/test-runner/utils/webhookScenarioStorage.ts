import type { WebhookScenario } from '../components/MultiWebhookTestingPanel';

const STORAGE_KEY_PREFIX = 'webhook_scenarios_';

/**
 * Get the storage key for a workflow's webhook scenarios
 */
function getStorageKey(workflowId: string): string {
  return `${STORAGE_KEY_PREFIX}${workflowId}`;
}

/**
 * Load saved webhook scenarios for a workflow
 */
export function loadWebhookScenarios(workflowId: string): WebhookScenario[] {
  try {
    const stored = localStorage.getItem(getStorageKey(workflowId));
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Save a new webhook scenario for a workflow
 */
export function saveWebhookScenario(
  workflowId: string,
  scenario: Omit<WebhookScenario, 'id' | 'createdAt'>
): WebhookScenario {
  const scenarios = loadWebhookScenarios(workflowId);
  
  const newScenario: WebhookScenario = {
    id: crypto.randomUUID(),
    name: scenario.name,
    description: scenario.description,
    payloads: scenario.payloads,
    createdAt: Date.now(),
  };
  
  scenarios.push(newScenario);
  
  try {
    localStorage.setItem(getStorageKey(workflowId), JSON.stringify(scenarios));
  } catch {
    // Storage quota exceeded — try to clean up old scenarios
    if (scenarios.length > 10) {
      const trimmed = scenarios.slice(-10);
      trimmed.push(newScenario);
      localStorage.setItem(getStorageKey(workflowId), JSON.stringify(trimmed));
    }
  }
  
  return newScenario;
}

/**
 * Update an existing webhook scenario
 */
export function updateWebhookScenario(
  workflowId: string,
  scenarioId: string,
  updates: Partial<Omit<WebhookScenario, 'id' | 'createdAt'>>
): WebhookScenario | null {
  const scenarios = loadWebhookScenarios(workflowId);
  const index = scenarios.findIndex(s => s.id === scenarioId);
  
  if (index === -1) return null;
  
  const updated: WebhookScenario = {
    ...scenarios[index],
    ...updates,
  };
  
  scenarios[index] = updated;
  localStorage.setItem(getStorageKey(workflowId), JSON.stringify(scenarios));
  
  return updated;
}

/**
 * Delete a webhook scenario
 */
export function deleteWebhookScenario(workflowId: string, scenarioId: string): boolean {
  const scenarios = loadWebhookScenarios(workflowId);
  const filtered = scenarios.filter(s => s.id !== scenarioId);
  
  if (filtered.length === scenarios.length) return false;
  
  localStorage.setItem(getStorageKey(workflowId), JSON.stringify(filtered));
  return true;
}

/**
 * Clear all webhook scenarios for a workflow
 */
export function clearWebhookScenarios(workflowId: string): void {
  localStorage.removeItem(getStorageKey(workflowId));
}

/**
 * Export webhook scenarios as JSON
 */
export function exportWebhookScenarios(workflowId: string): string {
  const scenarios = loadWebhookScenarios(workflowId);
  return JSON.stringify(scenarios, null, 2);
}

/**
 * Import webhook scenarios from JSON
 */
export function importWebhookScenarios(workflowId: string, json: string): WebhookScenario[] {
  const imported = JSON.parse(json) as WebhookScenario[];
  
  if (!Array.isArray(imported)) {
    throw new Error('Invalid format: expected array of scenarios');
  }
  
  // Validate each scenario
  const validated: WebhookScenario[] = imported.map(s => ({
    id: s.id || crypto.randomUUID(),
    name: s.name || 'Imported Scenario',
    description: s.description,
    payloads: Array.isArray(s.payloads) ? s.payloads : [],
    createdAt: s.createdAt || Date.now(),
  }));
  
  // Merge with existing scenarios (avoid duplicates by ID)
  const existing = loadWebhookScenarios(workflowId);
  const existingIds = new Set(existing.map(s => s.id));
  
  for (const scenario of validated) {
    if (!existingIds.has(scenario.id)) {
      existing.push(scenario);
    }
  }
  
  localStorage.setItem(getStorageKey(workflowId), JSON.stringify(existing));
  return existing;
}

/**
 * Fire a webhook to resume a paused correlation
 */
export async function fireWebhook(
  correlationId: string,
  payload: Record<string, unknown>,
  webhookPath?: string
): Promise<void> {
  const host = window.location.hostname || 'localhost';
  const url = `http://${host}:3001/api/correlations/resume`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      correlationId,
      webhookData: payload,
      webhookPath,
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fire webhook: ${response.status} ${error}`);
  }
}

/**
 * Build payload with correlation ID substituted
 */
export function buildPayloadWithCorrelationId(
  template: Record<string, unknown>,
  correlationId: string
): Record<string, unknown> {
  const json = JSON.stringify(template);
  const resolved = json.replace(/\{\{correlationId\}\}/g, correlationId);
  return JSON.parse(resolved);
}
