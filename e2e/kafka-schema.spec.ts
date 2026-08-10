/**
 * Phase 10C — E2E Playwright spec for the Kafka Schema Registry UX.
 *
 * Known open item: a real integration test against a live Confluent Schema
 * Registry requires Docker (`docker compose up schema-registry`).  All
 * network calls in this suite are intercepted via Playwright route mocking
 * against `/__proxy`, so no Docker process is needed.
 *
 * Entry point: open the KafkaProduceNode config modal via the Workflow
 * Designer (seed a workflow → navigate to /?tab=workflow → dblclick the node).
 *
 * Coverage:
 *   1. "Schema Registry" toggle shows/hides the config fields
 *   2. Format dropdown exposes Avro, Protobuf, and JSON Schema options
 *   3. Auth fields (username + password) are visible when schema is enabled
 *   4. Subject load button calls /api/kafka/schema-subjects → populates dropdown
 *   5. Version load button calls /api/kafka/schema-versions → populates dropdown
 *   6. Subject load error is displayed when the proxy returns ok:false
 *   7. Version load error is displayed when the proxy returns ok:false
 *   8. Disabling the toggle clears and hides all schema fields
 *   9. KafkaConsumeConfig also renders the Schema Registry section
 */

import { expect, test } from '@playwright/test';
import { seedAppData } from './helpers';

// ── Constants ─────────────────────────────────────────────────────────────────

const REGISTRY_URL = 'http://schema-registry:8081';
const WORKFLOW_ID = 'wf-schema-e2e';

// ── Workflow seeds ─────────────────────────────────────────────────────────────

const PRODUCE_WORKFLOW = {
  id: WORKFLOW_ID,
  name: 'Schema E2E Workflow',
  schemaVersion: 6,
  createdAt: 1748736000000,
  updatedAt: 1748736000000,
  variables: {},
  hostProfiles: [],
  authProfiles: [],
  services: [],
  nodes: [
    { id: 'start', type: 'start', position: { x: 100, y: 200 }, data: { label: 'Start', inputVariables: {} } },
    {
      id: 'produce1',
      type: 'kafkaProduce',
      position: { x: 400, y: 200 },
      data: {
        label: 'Produce Message',
        clusterId: 'schema-test-cluster',
        topic: 'orders.created',
        bodyTemplate: '{"id":"{{orderId}}"}',
      },
    },
    { id: 'end', type: 'end', position: { x: 700, y: 200 }, data: { label: 'End' } },
  ],
  edges: [
    { id: 'e1', source: 'start', target: 'produce1' },
    { id: 'e2', source: 'produce1', target: 'end' },
  ],
};

const CONSUME_WORKFLOW = {
  id: 'wf-schema-consume-e2e',
  name: 'Schema Consume E2E',
  schemaVersion: 6,
  createdAt: 1748736000000,
  updatedAt: 1748736000000,
  variables: {},
  hostProfiles: [],
  authProfiles: [],
  services: [],
  nodes: [
    { id: 'start', type: 'start', position: { x: 100, y: 200 }, data: { label: 'Start', inputVariables: {} } },
    {
      id: 'consume1',
      type: 'kafkaConsume',
      position: { x: 400, y: 200 },
      data: {
        label: 'Consume Message',
        clusterId: 'schema-test-cluster',
        topic: 'orders.created',
        maxMessages: 5,
        timeoutMs: 5000,
      },
    },
    { id: 'end', type: 'end', position: { x: 700, y: 200 }, data: { label: 'End' } },
  ],
  edges: [
    { id: 'e1', source: 'start', target: 'consume1' },
    { id: 'e2', source: 'consume1', target: 'end' },
  ],
};

// ── Mock API response builders ─────────────────────────────────────────────────

function subjectsEnvelope(subjects: string[]) {
  return {
    ok: true,
    op: 'schema-subjects',
    data: { subjects },
    meta: { timestamp: new Date().toISOString(), durationMs: 12 },
  };
}

function versionsEnvelope(versions: number[]) {
  return {
    ok: true,
    op: 'schema-versions',
    data: { versions },
    meta: { timestamp: new Date().toISOString(), durationMs: 8 },
  };
}

function errorEnvelope(op: string, message: string) {
  return {
    ok: false,
    op,
    error: { code: 'ECONNREFUSED', message, retryable: true },
    meta: { timestamp: new Date().toISOString() },
  };
}


// ── Helpers ────────────────────────────────────────────────────────────────────

/** Seed localStorage with a single workflow and navigate to the designer. */
async function seedAndOpenDesigner(
  page: import('@playwright/test').Page,
  workflow: unknown,
) {
  await seedAppData(page);
  await page.addInitScript(
    ({ wfJson, selectedId }: { wfJson: string; selectedId: string }) => {
      localStorage.setItem('workflows', wfJson);
      localStorage.setItem('workflows_selected_id', selectedId);
    },
    { wfJson: JSON.stringify([workflow]), selectedId: (workflow as { id: string }).id },
  );
  await page.goto('/?tab=workflow', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.wf-designer')).toBeVisible({ timeout: 15000 });
}

/** Double-click a workflow node to open its config modal. */
async function openNodeConfig(
  page: import('@playwright/test').Page,
  nodeClass: string,
) {
  const node = page.locator(nodeClass);
  await expect(node).toBeVisible({ timeout: 10000 });
  await node.dispatchEvent('dblclick');
  await expect(page.locator('.wf-config-modal')).toBeVisible({ timeout: 8000 });
}

// ── Test suite ─────────────────────────────────────────────────────────────────

test.describe('Kafka Schema Registry UX — KafkaProduceConfig', () => {

  async function getCustomSelectMenuLabels(page: import('@playwright/test').Page): Promise<string[]> {
    return page.locator('.cs-menu .cs-item .cs-item-label').allTextContents();
  }

  // ── 1. Toggle shows/hides fields ───────────────────────────────────────────
  test('Schema Registry toggle shows config fields when checked', async ({ page }) => {
    await seedAndOpenDesigner(page, PRODUCE_WORKFLOW);
    await openNodeConfig(page, '.wf-node-kafkaProduce');

    // Schema fields should be hidden by default
    await expect(page.locator('input[placeholder*="schema-registry"]')).not.toBeVisible();

    // Enable the toggle
    const toggle = page.getByRole('checkbox', { name: /Schema Registry/ });
    await toggle.check();

    // Schema fields should now be visible
    await expect(page.locator('input[placeholder*="schema-registry"]')).toBeVisible();
  });

  // ── 2. Format dropdown ─────────────────────────────────────────────────────
  test('Format dropdown exposes Avro, Protobuf and JSON Schema options', async ({ page }) => {
    await seedAndOpenDesigner(page, PRODUCE_WORKFLOW);
    await openNodeConfig(page, '.wf-node-kafkaProduce');

    const toggle = page.getByRole('checkbox', { name: /Schema Registry/ });
    await toggle.check();

    const formatSelect = page.locator('[data-testid="schema-format-select"]');
    await expect(formatSelect).toBeVisible();

    await formatSelect.locator('.cs-trigger').click();
    const options = await getCustomSelectMenuLabels(page);
    expect(options).toContain('Avro');
    expect(options).toContain('Protobuf');
    expect(options).toContain('JSON Schema');
    await page.keyboard.press('Escape');
  });

  // ── 3. Auth fields ─────────────────────────────────────────────────────────
  test('Username and password fields are visible when schema is enabled', async ({ page }) => {
    await seedAndOpenDesigner(page, PRODUCE_WORKFLOW);
    await openNodeConfig(page, '.wf-node-kafkaProduce');

    await page.getByRole('checkbox', { name: /Schema Registry/ }).check();

    await expect(page.locator('[data-testid="schema-username"]')).toBeVisible();
    await expect(page.locator('[data-testid="schema-password"]')).toBeVisible();
  });

  // ── 4. Subject load button fires the proxy call ────────────────────────────
  test('Subject load button calls /api/kafka/schema-subjects and populates the dropdown', async ({ page }) => {
    const subjects = ['orders.created-value', 'payments-value', 'users-key'];
    let subjectsCalled = false;

    // schema-subjects is a POST with relative URL → native fetch → intercept directly
    await page.route('**/api/kafka/schema-subjects*', async (route) => {
      subjectsCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(subjectsEnvelope(subjects)),
      });
    });

    await seedAndOpenDesigner(page, PRODUCE_WORKFLOW);
    await openNodeConfig(page, '.wf-node-kafkaProduce');
    await page.getByRole('checkbox', { name: /Schema Registry/ }).check();

    // Fill registry URL so the load button becomes enabled
    await page.locator('input[placeholder*="schema-registry"]').fill(REGISTRY_URL);

    const loadSubjectsBtn = page.locator('button[title="Load subjects from registry"]');
    await expect(loadSubjectsBtn).toBeEnabled({ timeout: 3000 });
    await loadSubjectsBtn.click();

    // Dropdown with loaded subjects should appear
    await expect(page.locator('[data-testid="schema-subjects-dropdown"]')).toBeVisible({ timeout: 6000 });
    await page.locator('[data-testid="schema-subjects-dropdown"] .cs-trigger').click();
    const subjectOptions = await getCustomSelectMenuLabels(page);
    expect(subjectOptions.some((o) => o.includes('orders.created-value'))).toBe(true);
    await page.keyboard.press('Escape');
    expect(subjectsCalled).toBe(true);
  });

  // ── 5. Version load button fires the proxy call ────────────────────────────
  test('Version load button calls /api/kafka/schema-versions and populates the dropdown', async ({ page }) => {
    let versionsCalled = false;

    // Both relative-URL calls use native fetch → intercept directly
    await page.route('**/api/kafka/schema-subjects*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(subjectsEnvelope(['orders.created-value'])),
      });
    });
    await page.route('**/api/kafka/schema-versions*', async (route) => {
      versionsCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(versionsEnvelope([1, 2, 3])),
      });
    });

    await seedAndOpenDesigner(page, PRODUCE_WORKFLOW);
    await openNodeConfig(page, '.wf-node-kafkaProduce');
    await page.getByRole('checkbox', { name: /Schema Registry/ }).check();
    await page.locator('input[placeholder*="schema-registry"]').fill(REGISTRY_URL);

    const loadVersionsBtn = page.locator('button[title="Load versions from registry"]');
    await expect(loadVersionsBtn).toBeEnabled({ timeout: 3000 });
    await loadVersionsBtn.click();

    // Dropdown with loaded versions should appear
    await expect(page.locator('[data-testid="schema-versions-dropdown"]')).toBeVisible({ timeout: 6000 });
    await page.locator('[data-testid="schema-versions-dropdown"] .cs-trigger').click();
    const versionOptions = await getCustomSelectMenuLabels(page);
    expect(versionOptions.some((o) => o.includes('1'))).toBe(true);
    expect(versionOptions.some((o) => o.includes('3'))).toBe(true);
    await page.keyboard.press('Escape');
    expect(versionsCalled).toBe(true);
  });

  // ── 6. Subject load error ──────────────────────────────────────────────────
  test('Subject load error from /api/kafka/schema-subjects is displayed', async ({ page }) => {
    // schema-subjects uses native fetch (relative URL) → intercept directly
    await page.route('**/api/kafka/schema-subjects*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(errorEnvelope('schema-subjects', 'Connection refused to schema registry')),
      });
    });

    await seedAndOpenDesigner(page, PRODUCE_WORKFLOW);
    await openNodeConfig(page, '.wf-node-kafkaProduce');
    await page.getByRole('checkbox', { name: /Schema Registry/ }).check();
    await page.locator('input[placeholder*="schema-registry"]').fill(REGISTRY_URL);

    await page.locator('button[title="Load subjects from registry"]').click();

    // Error message should appear below the subject field
    await expect(page.locator('.wf-config-error')).toBeVisible({ timeout: 6000 });
    await expect(page.locator('.wf-config-error').first()).toContainText('Connection refused');
  });

  // ── 7. Version load error ──────────────────────────────────────────────────
  test('Version load error from /api/kafka/schema-versions is displayed', async ({ page }) => {
    // schema-versions uses native fetch (relative URL) → intercept directly
    await page.route('**/api/kafka/schema-versions*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(errorEnvelope('schema-versions', 'Subject not found')),
      });
    });

    await seedAndOpenDesigner(page, PRODUCE_WORKFLOW);
    await openNodeConfig(page, '.wf-node-kafkaProduce');
    await page.getByRole('checkbox', { name: /Schema Registry/ }).check();
    await page.locator('input[placeholder*="schema-registry"]').fill(REGISTRY_URL);

    await page.locator('button[title="Load versions from registry"]').click();

    await expect(page.locator('.wf-config-error')).toBeVisible({ timeout: 6000 });
    await expect(page.locator('.wf-config-error').first()).toContainText('Subject not found');
  });

  // ── 8. Disabling toggle hides schema fields ────────────────────────────────
  test('Disabling the toggle hides all schema fields', async ({ page }) => {
    await seedAndOpenDesigner(page, PRODUCE_WORKFLOW);
    await openNodeConfig(page, '.wf-node-kafkaProduce');

    const toggle = page.getByRole('checkbox', { name: /Schema Registry/ });
    await toggle.check();
    await expect(page.locator('input[placeholder*="schema-registry"]')).toBeVisible();

    // Disable again
    await toggle.uncheck();
    await expect(page.locator('input[placeholder*="schema-registry"]')).not.toBeVisible();
    await expect(page.locator('button[title="Load subjects from registry"]')).not.toBeVisible();
    await expect(page.locator('button[title="Load versions from registry"]')).not.toBeVisible();
  });

  // ── 9. Subject input placeholder derives from topic name ──────────────────
  test('Subject placeholder shows topic-derived default when enabled', async ({ page }) => {
    await seedAndOpenDesigner(page, PRODUCE_WORKFLOW);
    await openNodeConfig(page, '.wf-node-kafkaProduce');
    await page.getByRole('checkbox', { name: /Schema Registry/ }).check();

    // The produce node has topic 'orders.created', so placeholder is 'orders.created-value'
    const subjectInput = page.locator('[data-testid="schema-subject-input"]');
    const placeholder = await subjectInput.getAttribute('placeholder');
    expect(placeholder).toContain('orders.created-value');
  });

});

// ── KafkaConsumeConfig also renders the schema section ─────────────────────────

test.describe('Kafka Schema Registry UX — KafkaConsumeConfig', () => {

  test('KafkaConsumeConfig exposes Schema Registry toggle', async ({ page }) => {
    await seedAndOpenDesigner(page, CONSUME_WORKFLOW);
    await openNodeConfig(page, '.wf-node-kafkaConsume');

    const toggle = page.getByRole('checkbox', { name: /Schema Registry/ });
    await expect(toggle).toBeVisible();
    expect(await toggle.isChecked()).toBe(false);
  });

  test('Schema fields appear in KafkaConsumeConfig when enabled', async ({ page }) => {
    await seedAndOpenDesigner(page, CONSUME_WORKFLOW);
    await openNodeConfig(page, '.wf-node-kafkaConsume');

    await page.getByRole('checkbox', { name: /Schema Registry/ }).check();

    await expect(page.locator('input[placeholder*="schema-registry"]')).toBeVisible();
    await expect(page.locator('button[title="Load subjects from registry"]')).toBeVisible();
    await expect(page.locator('button[title="Load versions from registry"]')).toBeVisible();
  });

  test('Subject load in KafkaConsumeConfig calls /api/kafka/schema-subjects', async ({ page }) => {
    let subjectsCalled = false;

    // schema-subjects uses native fetch (relative URL) → intercept directly
    await page.route('**/api/kafka/schema-subjects*', async (route) => {
      subjectsCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(subjectsEnvelope(['orders.created-value'])),
      });
    });

    await seedAndOpenDesigner(page, CONSUME_WORKFLOW);
    await openNodeConfig(page, '.wf-node-kafkaConsume');
    await page.getByRole('checkbox', { name: /Schema Registry/ }).check();
    await page.locator('input[placeholder*="schema-registry"]').fill(REGISTRY_URL);

    await page.locator('button[title="Load subjects from registry"]').click();

    await expect(page.locator('[data-testid="schema-subjects-dropdown"]')).toBeVisible({ timeout: 6000 });
    expect(subjectsCalled).toBe(true);
  });

});
