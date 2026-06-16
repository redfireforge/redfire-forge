/**
 * kafka-secure.spec.ts — E2E tests for K11: Secure Cluster (SASL/SCRAM-256)
 *
 * Prerequisites (must be running before this suite):
 *   - Dev servers:  npm run dev  (Vite :5173, Express :3001)
 *   - Docker stack: cd docker/kafka/secure && docker compose up -d
 *       redfireforge-redpanda-secure  → SASL Kafka on localhost:19093
 *       redfireforge-redpanda-secure-init → creates users + topics
 *       Admin API health probe        → localhost:19645
 *
 * Pre-created SASL users (via init container):
 *   admin            / admin-secret    (superuser)
 *   redfireforge-app / app-password    (standard)
 *
 * Coverage:
 *   1. Settings page renders and shows empty state (no clusters yet)
 *   2. Create a SASL/SCRAM-256 cluster config → editor form renders
 *   3. Fill broker + auth fields (SCRAM-SHA-256, user/pass) → Test Connection succeeds
 *   4. Save cluster → cluster card appears in list
 *   5. Connect to the SASL broker → status badge shows connected
 *   6. Navigate to Message Studio → Publish → send to secure topic → success result
 *
 * Run with:
 *   npx playwright test e2e/kafka-secure.spec.ts --reporter=list
 */

import { expect, test, type Page } from '@playwright/test';
import { seedAppData } from './helpers';

// ── Skip guard ────────────────────────────────────────────────────────────────

async function isBackendReachable(): Promise<boolean> {
  try {
    const r = await fetch('http://localhost:3001/health', { signal: AbortSignal.timeout(2000) });
    return r.ok;
  } catch {
    return false;
  }
}

async function isSecureStackReachable(): Promise<boolean> {
  try {
    // Redpanda Admin API on the secure stack — does not require SASL
    const r = await fetch('http://localhost:19645/', { signal: AbortSignal.timeout(3000) });
    // 200 or any non-network-error response means the stack is up
    return r.status < 600;
  } catch {
    return false;
  }
}

const infraUp = Promise.all([isBackendReachable(), isSecureStackReachable()]).then(
  ([backend, docker]) => backend && docker,
);

// ── Constants ─────────────────────────────────────────────────────────────────

const SASL_BROKER = '127.0.0.1:19093';
const SASL_CLUSTER_NAME = 'Secure Demo';
const SASL_USERNAME = 'redfireforge-app';
const SASL_PASSWORD = 'app-password';
// Must match the <option value="scram-sha-256"> in KafkaClusterEditor
const SASL_MECHANISM_VALUE = 'scram-sha-256';
const SASL_TOPIC = 'redfireforge.debug.consume'; // pre-created by init container

// ── Helper: save cluster and wait for it to appear in the list ───────────────
// The Test Connection and Connect buttons are only rendered when
// clusters.length > 0 (left panel). Save must come before testing/connecting.
async function saveCluster(page: Page): Promise<void> {
  await page.locator('[data-testid="kafka-save-cluster-btn"]').click();
  await page.waitForTimeout(800);
  // Cluster card should now be visible in the list
  await expect(page.locator(`text=${SASL_CLUSTER_NAME}`)).toBeVisible({ timeout: 6000 });
}

// ── Helper: navigate to Kafka Settings ────────────────────────────────────────

async function gotoKafkaSettings(page: Page): Promise<void> {
  await page.goto('/?tab=kafka-settings', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
}

// ── Helper: open the cluster editor (handles empty state or toolbar button) ───

async function openClusterEditor(page: Page): Promise<void> {
  const emptyBtn = page.locator('[data-testid="kafka-empty-create-btn"]');
  const addBtn = page.locator('[data-testid="kafka-add-cluster-btn"]');
  if (await emptyBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await emptyBtn.click();
  } else {
    await expect(addBtn).toBeVisible({ timeout: 5000 });
    await addBtn.click();
  }
  await expect(page.locator('[data-testid="kafka-cluster-editor"]')).toBeVisible({ timeout: 5000 });
}

// ── Helper: fill the cluster editor form for a SASL cluster ──────────────────

async function fillSaslClusterForm(page: Page): Promise<void> {
  const editor = page.locator('[data-testid="kafka-cluster-editor"]');

  // Cluster name
  await editor.locator('#kafka-cluster-name').fill(SASL_CLUSTER_NAME);
  await page.waitForTimeout(200);

  // Broker address — placeholder is '127.0.0.1:19092', clear first
  const brokerInput = editor.locator('input[placeholder="127.0.0.1:19092"]');
  await expect(brokerInput).toBeVisible({ timeout: 5000 });
  await brokerInput.fill('');
  await brokerInput.fill(SASL_BROKER);
  await page.waitForTimeout(200);

  // Auth Mode → scram-sha-256 (matches the option value attribute, not label text)
  const authSelect = editor.locator('#kafka-auth-mode');
  await expect(authSelect).toBeVisible({ timeout: 5000 });
  await authSelect.selectOption(SASL_MECHANISM_VALUE);
  await page.waitForTimeout(300);

  // Username + password (revealed after selecting SCRAM)
  await editor.locator('#kafka-auth-username').fill(SASL_USERNAME);
  await editor.locator('#kafka-auth-password').fill(SASL_PASSWORD);
  await page.waitForTimeout(200);
}

// ══════════════════════════════════════════════════════════════════════════════
// Test suite
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Kafka Secure Cluster — SASL/SCRAM-256 (Live Docker)', () => {
  test.beforeEach(async ({ page }) => {
    const up = await infraUp;
    test.skip(!up, 'Skipped: backend (port 3001) or SASL Docker stack (port 19645) not running');
    await seedAppData(page);
  });

  // ── 1. Empty state ──────────────────────────────────────────────────────────
  test('settings page shows empty state when no clusters are configured', async ({ page }) => {
    await gotoKafkaSettings(page);
    await expect(page.locator('[data-testid="kafka-settings-empty"]')).toBeVisible({ timeout: 8000 });
  });

  // ── 2. Cluster editor opens ─────────────────────────────────────────────────
  test('clicking Create opens the cluster editor form', async ({ page }) => {
    await gotoKafkaSettings(page);
    await openClusterEditor(page);
    await expect(page.locator('[data-testid="kafka-cluster-editor"]')).toBeVisible({ timeout: 5000 });
  });

  // ── 3. SCRAM fields revealed after selecting SCRAM-SHA-256 ─────────────────
  test('selecting SCRAM-SHA-256 reveals username and password fields', async ({ page }) => {
    await gotoKafkaSettings(page);
    await openClusterEditor(page);

    const authSelect = page.locator('#kafka-auth-mode');
    await authSelect.selectOption(SASL_MECHANISM_VALUE);
    await page.waitForTimeout(300);

    await expect(page.locator('#kafka-auth-username')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#kafka-auth-password')).toBeVisible({ timeout: 3000 });
  });

  // ── 4. Test Connection succeeds with valid SASL credentials ────────────────
  test('Test Connection shows success result with correct SASL credentials', async ({ page }) => {
    await gotoKafkaSettings(page);
    await openClusterEditor(page);
    await fillSaslClusterForm(page);
    // Save first — Test Connection button is only visible when clusters.length > 0
    await saveCluster(page);

    await page.locator('[data-testid="kafka-test-btn"]').click();

    // Wait for the test result element — ok variant means success
    await expect(page.locator('[data-testid="kafka-test-result"].kafka-test-result--ok')).toBeVisible({
      timeout: 15000,
    });
  });

  // ── 5. Test Connection fails with wrong password ────────────────────────────
  test('Test Connection shows failure result with wrong SASL password', async ({ page }) => {
    await gotoKafkaSettings(page);
    await openClusterEditor(page);
    await fillSaslClusterForm(page);

    // Override password with a wrong value before saving
    await page.locator('#kafka-auth-password').fill('wrong-password');
    await page.waitForTimeout(200);

    // Save first — Test Connection button only appears after a cluster exists
    await saveCluster(page);

    await page.locator('[data-testid="kafka-test-btn"]').click();

    // Should show the fail variant
    await expect(page.locator('[data-testid="kafka-test-result"].kafka-test-result--fail')).toBeVisible({
      timeout: 15000,
    });
  });

  // ── 6. Save cluster → card appears in list ──────────────────────────────────
  test('saving SASL cluster adds a card to the cluster list', async ({ page }) => {
    await gotoKafkaSettings(page);
    await openClusterEditor(page);
    await fillSaslClusterForm(page);

    await page.locator('[data-testid="kafka-save-cluster-btn"]').click();
    await page.waitForTimeout(800);

    // The cluster list should now contain the new cluster name
    await expect(page.locator(`text=${SASL_CLUSTER_NAME}`)).toBeVisible({ timeout: 6000 });
  });

  // ── 7. Connect → status badge shows connected ───────────────────────────────
  test('connecting to the SASL broker shows a connected status badge', async ({ page }) => {
    await gotoKafkaSettings(page);
    await openClusterEditor(page);
    await fillSaslClusterForm(page);

    // Save first
    await page.locator('[data-testid="kafka-save-cluster-btn"]').click();
    await page.waitForTimeout(800);

    // Connect
    const connectBtn = page.locator('[data-testid="kafka-connect-btn"]').first();
    await expect(connectBtn).toBeVisible({ timeout: 6000 });
    await connectBtn.click();

    // Status badge should flip to connected
    await expect(page.locator('.kafka-status-badge.state-connected')).toBeVisible({ timeout: 15000 });
  });

  // ── 8. Publish a message to the secure broker ───────────────────────────────
  test('can publish a message to the secured broker after connecting', async ({ page }) => {
    await gotoKafkaSettings(page);
    await openClusterEditor(page);
    await fillSaslClusterForm(page);

    // Save + Connect
    await page.locator('[data-testid="kafka-save-cluster-btn"]').click();
    await page.waitForTimeout(800);
    const connectBtn = page.locator('[data-testid="kafka-connect-btn"]').first();
    await expect(connectBtn).toBeVisible({ timeout: 6000 });
    await connectBtn.click();
    await expect(page.locator('.kafka-status-badge.state-connected')).toBeVisible({ timeout: 15000 });

    // Navigate to Message Studio
    await page.goto('/?tab=kafka-message-studio', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    // Click Kafka sub-nav button if visible (multi-protocol page)
    const kafkaBtn = page.locator('main button:has-text("Kafka")').first();
    if (await kafkaBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await kafkaBtn.click();
      await page.waitForTimeout(500);
    }

    // Open Publish tab
    await page.locator('[data-testid="tab-publish"]').click();
    await page.waitForTimeout(400);

    // Fill topic + body
    await page.locator('input[placeholder="e.g. orders.events"]').fill(SASL_TOPIC);
    await page.locator('textarea[placeholder*="key"]').fill(
      JSON.stringify({ demo: 'sasl-e2e', cluster: SASL_CLUSTER_NAME }),
    );

    // Send
    await page.locator('[data-testid="pub-send-btn"]').click();

    // Expect a success result
    await expect(page.locator('[data-testid="pub-result"]')).toBeVisible({ timeout: 12000 });
    const resultText = await page.locator('[data-testid="pub-result"]').textContent();
    expect(resultText).toContain(SASL_TOPIC);
    expect(resultText).not.toContain('Error');
  });

  // ── 9. Disconnect returns badge to disconnected ─────────────────────────────
  test('clicking Disconnect returns the status badge to disconnected', async ({ page }) => {
    await gotoKafkaSettings(page);
    await openClusterEditor(page);
    await fillSaslClusterForm(page);

    await page.locator('[data-testid="kafka-save-cluster-btn"]').click();
    await page.waitForTimeout(800);

    const connectBtn = page.locator('[data-testid="kafka-connect-btn"]').first();
    await expect(connectBtn).toBeVisible({ timeout: 6000 });
    await connectBtn.click();
    await expect(page.locator('.kafka-status-badge.state-connected')).toBeVisible({ timeout: 15000 });

    const disconnectBtn = page.locator('[data-testid="kafka-disconnect-btn"]').first();
    await expect(disconnectBtn).toBeVisible({ timeout: 5000 });
    await disconnectBtn.click();

    await expect(page.locator('.kafka-status-badge.state-disconnected')).toBeVisible({ timeout: 8000 });
  });
});
