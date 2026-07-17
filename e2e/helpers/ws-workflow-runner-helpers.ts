/**
 * Shared helpers for WebSocket workflow runner E2E specs.
 */
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { seedAppData } from '../helpers';
import type { Workflow } from '../../src/features/workflow/types/workflow';

export function makeWsWorkflow(): Workflow {
  return {
    id: 'wf-ws-e2e',
    name: 'WS E2E Workflow',
    schemaVersion: 4,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    variables: {},
    hostProfiles: [],
    authProfiles: [],
    services: [],
    nodes: [
      {
        id: 'start',
        type: 'start',
        position: { x: 100, y: 200 },
        data: { label: 'Start' },
      },
    ],
    edges: [],
  };
}

export function makeWsWorkflowWired(): Workflow {
  return {
    id: 'wf-ws-wired',
    name: 'WS Wired Flow',
    schemaVersion: 4,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    variables: {},
    hostProfiles: [],
    authProfiles: [],
    services: [],
    nodes: [
      {
        id: 'start',
        type: 'start',
        position: { x: 100, y: 200 },
        data: { label: 'Start' },
      },
      {
        id: 'ws-conn',
        type: 'wsConnect',
        position: { x: 350, y: 200 },
        data: {
          label: 'WS Connect',
          url: 'ws://localhost:9882',
          headers: [],
          queryParams: [],
          subprotocols: [],
          connectionId: 'ws1',
          timeoutMs: 10000,
          outputBindings: [],
        },
      },
      {
        id: 'ws-send',
        type: 'wsSend',
        position: { x: 600, y: 200 },
        data: {
          label: 'WS Send',
          connectionId: 'ws1',
          message: 'hello',
          messageType: 'text',
          waitForResponse: true,
          responseTimeoutMs: 5000,
          outputBindings: [],
        },
      },
      {
        id: 'ws-recv',
        type: 'wsReceive',
        position: { x: 850, y: 200 },
        data: {
          label: 'WS Receive',
          connectionId: 'ws1',
          timeoutMs: 30000,
          matchCriteria: { contentContains: 'hello' },
          extractionRules: [],
          outputBindings: [],
        },
      },
    ],
    edges: [
      { id: 'e1', source: 'start', target: 'ws-conn' },
      { id: 'e2', source: 'ws-conn', target: 'ws-send' },
      { id: 'e3', source: 'ws-send', target: 'ws-recv' },
    ],
  };
}

/* ─── Seed helpers ───────────────────────────────────────────────────── */

export async function seedWorkflow(page: import('@playwright/test').Page, wf: Workflow) {
  await seedAppData(page);
  await page.addInitScript((workflowJson: string) => {
    localStorage.setItem('workflows', workflowJson);
    localStorage.setItem('workflows_selected_id', 'wf-ws-e2e');
  }, JSON.stringify([wf]));
}

export async function seedWiredWorkflow(page: import('@playwright/test').Page) {
  await seedAppData(page);
  const wf = makeWsWorkflowWired();
  await page.addInitScript((workflowJson: string) => {
    localStorage.setItem('workflows', workflowJson);
    localStorage.setItem('workflows_selected_id', 'wf-ws-wired');
  }, JSON.stringify([wf]));
}

export async function seedHarnessWithWsTest(page: import('@playwright/test').Page) {
  await seedAppData(page);
  await page.addInitScript(() => {
    localStorage.setItem('perf-test-v3-feature-groups', JSON.stringify([{
      id: 'fg-ws',
      name: 'WS Tests',
      microserviceId: 'svc-1',
      environmentId: 'env-1',
      scenarios: [{
        id: 'sc-ws',
        name: 'WS Connect Scenario',
        tests: [{
          id: 'test-ws-connect',
          name: 'Connect to echo',
          url: 'ws://localhost:9882',
          method: 'WEBSOCKET',
          actionType: 'wsConnect',
          headers: [],
          body: '',
          auth: { type: 'none' },
          validation: { mode: 'none' },
          wsConfig: {
            connectionId: 'ws1',
            subprotocols: '',
            timeoutMs: 10000,
          },
        }],
      }],
    }]));
  });
}

/* ─── Start mock server helper ───────────────────────────────────────── */

// Use a dedicated port to avoid cross-spec mock server interference (ws-core-connect uses 9876)
const WR_MOCK_PORT = 9882;

export async function startMockServer(page: import('@playwright/test').Page) {
  // Start mock server via API (reliable across parallel workers)
  await page.request.post('http://localhost:3001/api/ws/mock/start', {
    data: { port: WR_MOCK_PORT },
  }).catch(() => {});
  await page.waitForTimeout(500);
}

/* ─── Palette helper: search + add node ──────────────────────────────── */

export async function addNodeFromPalette(page: import('@playwright/test').Page, searchTerm: string, blockClass: string) {
  const { openWorkflowBlocksTab } = await import('../helpers');
  await openWorkflowBlocksTab(page);
  const searchBox = page.locator('.wf-palette-search');
  await searchBox.fill(searchTerm);
  await page.waitForTimeout(300);
  await page.locator(`.${blockClass}`).click();
  await page.waitForTimeout(500);
  // Clear search so categories reset
  await searchBox.clear();
}

export function makeWsWorkflowWithAuth(): Workflow {
  return {
    id: 'wf-ws-auth',
    name: 'WS Auth Flow',
    schemaVersion: 4,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    variables: { authToken: 'test-bearer-token-123', apiKey: 'key-abc-456' },
    hostProfiles: [],
    authProfiles: [],
    services: [],
    nodes: [
      {
        id: 'start',
        type: 'start',
        position: { x: 100, y: 200 },
        data: { label: 'Start' },
      },
      {
        id: 'ws-auth-conn',
        type: 'wsConnect',
        position: { x: 350, y: 200 },
        data: {
          label: 'WS Auth Connect',
          url: 'ws://localhost:9882',
          headers: [
            { key: 'Authorization', value: 'Bearer {{authToken}}' },
            { key: 'X-API-Key', value: '{{apiKey}}' },
          ],
          queryParams: [{ key: 'token', value: '{{authToken}}' }],
          subprotocols: [],
          connectionId: 'ws-auth',
          timeoutMs: 10000,
          outputBindings: [],
        },
      },
    ],
    edges: [
      { id: 'e1', source: 'start', target: 'ws-auth-conn' },
    ],
  };
}

export async function seedAuthWorkflow(page: import('@playwright/test').Page) {
  await seedAppData(page);
  const wf = makeWsWorkflowWithAuth();
  await page.addInitScript((workflowJson: string) => {
    localStorage.setItem('workflows', workflowJson);
    localStorage.setItem('workflows_selected_id', 'wf-ws-auth');
  }, JSON.stringify([wf]));
}

export async function openHarness(page: Page) {
  await page.goto('/?tab=scenarios');
  await page.waitForSelector('.app-header', { timeout: 25000 });
  await page.waitForLoadState('networkidle');
}

export async function expandFeatureGroup(page: Page) {
  const fgName = page.locator('.feature-group-name', { hasText: 'WS Tests' });
  await expect(fgName).toBeVisible({ timeout: 5000 });
  await fgName.click();
  await page.waitForTimeout(300);
}
