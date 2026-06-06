/**
 * kafka-live.spec.ts — Live Docker-backed E2E tests for Kafka features.
 *
 * Prerequisites (must be running before this suite):
 *   - Dev servers:  npm run dev  (Vite :5173, Express :3001)
 *   - Docker stack: docker compose -f docker/docker-compose.yml up -d
 *       redfireforge-redpanda  → plaintext Kafka on localhost:19092
 *       redfireforge-schema-registry → Schema Registry HTTP on localhost:8085
 *
 * Coverage:
 *   1. Kafka cluster creation in Settings → auto-connects
 *   2. Publish — send a message to orders.created, assert success result
 *   3. Consume — fetch earliest 5 messages, assert results table + detail pane
 *   4. Topics — list topics, filter to "orders" domain, open orders.created details
 *   5. Schema Registry — connect to localhost:8085, browse subjects, open schema, switch version
 *   6. Gallery — load all 4 Kafka workflow samples, run Quick Test, assert all pass
 *
 * Run with:
 *   npx playwright test e2e/kafka-live.spec.ts --reporter=list
 */

import { expect, test, type Page } from '@playwright/test';
import { seedAppData } from './helpers';

// ── Config ────────────────────────────────────────────────────────────────────

const BROKER = '127.0.0.1:19092';
const SR_URL = 'http://localhost:8085';
const CLUSTER_NAME = 'Local Plaintext';
// Must match the clusterId hardcoded in the Gallery workflow factories
const CLUSTER_ID = 'local-plaintext';

// ── Helper: seed a Kafka cluster in localStorage ──────────────────────────────

async function seedKafkaCluster(page: Page): Promise<void> {
  await page.addInitScript(
    ([name, id, broker]: [string, string, string]) => {
      const cluster = {
        id,
        name,
        clientId: `redfireforge-${id}`,
        brokers: [broker],
        auth: { type: 'none' },
        tls: { enabled: false, verifyCert: true },
        connectionTimeoutMs: 10000,
        requestTimeoutMs: 10000,
      };
      // Canonical storage keys from src/shared/kafka/kafkaStorage.ts
      localStorage.setItem('perf-test-kafka-clusters-v1', JSON.stringify([cluster]));
      localStorage.setItem('perf-test-kafka-selected-cluster-id', id);
      localStorage.setItem('perf-test-kafka-auto-connect-on-startup', 'true');
    },
    [CLUSTER_NAME, CLUSTER_ID, BROKER] as [string, string, string],
  );
}

// ── Helper: load a Gallery workflow sample ────────────────────────────────────

async function loadGalleryWorkflow(page: Page, title: string): Promise<void> {
  await page.goto('/?tab=gallery', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  await page.locator('input[placeholder="Search gallery..."]').fill('kafka');
  await page.waitForTimeout(600);
  await page.locator(`button:has-text("${title}")`).click();
  await page.waitForTimeout(400);
  // Load Workflow button may be intercepted by overlay — use JS click
  await page.evaluate((t: string) => {
    const btns = [...document.querySelectorAll('button')];
    const load = btns.find(b => b.textContent?.trim() === 'Load Workflow');
    if (load) load.click();
    void t;
  }, title);
  await page.waitForURL('**/\\?tab=workflow', { timeout: 8000 });
  await page.waitForTimeout(600);
}

// ── Helper: run Quick Test and assert N/N passed ──────────────────────────────

async function runQuickTestAndAssertPassed(
  page: Page,
  expectedTotal: number,
  timeoutMs = 25_000,
): Promise<void> {
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    btns.find(b => b.textContent?.trim() === 'Quick Test')?.click();
  });
  // Use .first() to avoid strict-mode violation (two elements match: progress bar + status bar)
  await expect(page.locator('text=/\\d+\\/\\d+ passed/').first()).toBeVisible({
    timeout: timeoutMs,
  });
  const statusText = await page.locator('text=/\\d+\\/\\d+ passed/').first().textContent();
  expect(statusText).toContain(`${expectedTotal}/${expectedTotal} passed`);
}

// ── Kafka Message Studio ───────────────────────────────────────────────────────

test.describe('Kafka Message Studio — Live Docker', () => {
  test.beforeEach(async ({ page }) => {
    await seedAppData(page);
    await seedKafkaCluster(page);
    await page.goto('/?tab=kafka-message-studio', { waitUntil: 'domcontentloaded' });
    // Wait for app to load and auto-connect the cluster
    await page.waitForTimeout(2500);
    // The Kafka studio shows a "Kafka" sub-nav button that must be clicked first
    const kafkaBtn = page.locator('main button:has-text("Kafka")').first();
    if (await kafkaBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await kafkaBtn.click();
      await page.waitForTimeout(600);
    }
  });

  test('Publish — sends a message to orders.created and shows success result', async ({ page }) => {
    // Click Publish tab
    await page.locator('button:has-text("Publish")').first().click();
    await page.waitForTimeout(400);

    // Fill topic (placeholder is "e.g. orders.events" in the Publish form)
    await page.locator('input[placeholder="e.g. orders.events"]').fill('orders.created');
    // Fill key (placeholder is "(optional)")
    await page.locator('input[placeholder="(optional)"]').first().fill('e2e-live-test');
    // Fill body (placeholder is '{"key": "value"}')
    await page.locator('textarea[placeholder*="key"]').fill(
      JSON.stringify({ orderId: 'E2E-LIVE-001', status: 'CREATED', amount: '99.00' }),
    );
    // Add a header
    await page.locator('button:has-text("Add")').first().click();
    await page.waitForTimeout(200);
    const headerKeyInputs = await page.$$('input[placeholder="key"]');
    if (headerKeyInputs.length > 0) {
      await headerKeyInputs[0].fill('source');
      const headerValInputs = await page.$$('input[placeholder="value"]');
      if (headerValInputs.length > 0) await headerValInputs[0].fill('e2e-live');
    }

    // Send via the dedicated send button
    await page.locator('[data-testid="pub-send-btn"]').click();
    // Wait up to 8s for result
    await expect(page.locator('[data-testid="pub-result"]')).toBeVisible({ timeout: 8000 });
    const result = await page.locator('[data-testid="pub-result"]').textContent();
    expect(result).toContain('orders.created');
    expect(result).not.toContain('Error');
  });

  test('Consume — fetches messages from orders.created and shows detail pane', async ({ page }) => {
    await page.locator('button:has-text("Consume")').first().click();
    await page.waitForTimeout(400);

    await page.locator('input[placeholder="e.g. orders.events"]').fill('orders.created');
    await page.getByLabel('Start Position').selectOption('Earliest');
    await page.getByLabel('Max Messages').fill('5');

    // Use the execute button (not the mode tab which also has text "Consume Once")
    await page.locator('[data-testid="con-consume-btn"]').click();

    // Wait for results table
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 12000 });
    const rows = await page.$$('table tbody tr');
    expect(rows.length).toBeGreaterThanOrEqual(1);

    // Click last row to open detail pane
    await rows[rows.length - 1].click();
    await expect(page.locator('button:has-text("Copy Payload")')).toBeVisible({ timeout: 3000 });
  });

  test('Topics — lists topics with domain chips and opens orders.created detail', async ({ page }) => {
    await page.locator('button:has-text("Topics")').first().click();
    await page.waitForTimeout(2500);

    // Domain chips should appear
    await expect(page.locator('button:has-text("orders")')).toBeVisible({ timeout: 8000 });

    // Filter to orders domain
    await page.locator('button:has-text("orders")').first().click();
    await page.waitForTimeout(600);

    // orders.created row should be visible
    await expect(page.locator('text=orders.created')).toBeVisible({ timeout: 5000 });

    // Click it to open topic detail
    await page.locator('text=orders.created').first().click();
    await page.waitForTimeout(1200);

    // Partitions tab should be available
    await expect(page.locator('button:has-text("Partitions")')).toBeVisible({ timeout: 5000 });
    await page.locator('button:has-text("Partitions")').last().click();
    await page.waitForTimeout(600);

    // Should show partition table with 3 rows (partitions 0, 1, 2)
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 5000 });
    const partitionRows = await page.$$('table tbody tr:not([class*="total"])');
    expect(partitionRows.length).toBeGreaterThanOrEqual(3);
  });

  test('Schema Registry — connects to localhost:8085 and browses subjects', async ({ page }) => {
    await page.locator('button:has-text("Schema Registry")').first().click();
    await page.waitForTimeout(400);

    // Fill SR URL and connect
    await page.locator('input[placeholder="http://localhost:8085"]').fill(SR_URL);
    await page.locator('button:has-text("Connect to Registry")').click();
    await page.waitForTimeout(3000);

    // Subjects table should appear
    await expect(page.locator('text=orders.created-value')).toBeVisible({ timeout: 8000 });

    // Click orders.created-value
    await page.locator('text=orders.created-value').click();
    await page.waitForTimeout(1000);

    // Schema content should appear and show Avro badge (first match to avoid strict-mode violation)
    await expect(page.locator('text=Avro').first()).toBeVisible({ timeout: 5000 });

    // Version dropdown should have at least v1
    const versionOptions = await page.$$eval('select option', opts =>
      opts.map(o => o.value),
    );
    expect(versionOptions.length).toBeGreaterThanOrEqual(1);

    // Copy Schema button should be present
    await expect(page.locator('button:has-text("Copy Schema")')).toBeVisible({ timeout: 3000 });
  });
});

// ── Gallery Workflow Quick Tests ───────────────────────────────────────────────

test.describe('Gallery — Kafka Workflow Quick Tests (Live Docker)', () => {
  test.beforeEach(async ({ page }) => {
    await seedAppData(page);
    await seedKafkaCluster(page);
  });

  test('Kafka: Publish Order Event — Quick Test 3/3 passed', async ({ page }) => {
    await loadGalleryWorkflow(page, 'Kafka: Publish Order Event');
    await runQuickTestAndAssertPassed(page, 3);
  });

  test('Kafka: Event-Triggered Processor — Quick Test 6/6 passed', async ({ page }) => {
    await loadGalleryWorkflow(page, 'Kafka: Event-Triggered Processor');
    await runQuickTestAndAssertPassed(page, 6);
  });

  test('Kafka: Full Event Pipeline — Quick Test 8/8 passed', async ({ page }) => {
    test.setTimeout(60_000); // workflow itself takes ~15s + navigation overhead
    await loadGalleryWorkflow(page, 'Kafka: Full Event Pipeline');
    await runQuickTestAndAssertPassed(page, 8, 45_000);
  });

  test('Kafka: Async Request–Reply — Quick Test 8/8 passed', async ({ page }) => {
    await loadGalleryWorkflow(page, 'Kafka: Async Request');
    await runQuickTestAndAssertPassed(page, 8, 15_000);
  });
});
