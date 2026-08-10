/**
 * END-TO-END: Secure WebSocket TLS Demo — Full Demo Player Test
 *
 * This test navigates through the ACTUAL Demo Hub UI and runs the
 * "Secure WebSocket — wss:// & TLS" demo from start to step 3.
 *
 * It specifically validates:
 * 1. tlsSetup correctly resets skip-cert (rejectUnauthorized) even when it
 *    was left enabled from a previous demo run.
 * 2. Step 3 (Connect Over TLS) connects successfully without a 504 error.
 */
import { test, expect } from '@playwright/test';
import { WS } from '../src/shared/selectors';
import { visibleWsUrlInput } from './helpers';
import { runNextStep, waitForReadingPhase, completeCurrentStepAction, finishDemoStep } from './demo-player-helpers';

const APP_BASE = 'http://localhost:5173';
const SKIP_CERT_CHECKBOX = `${WS.TLS_SKIP_CERT} input[type="checkbox"]`;

// ── Helpers ────────────────────────────────────────────────────────────────

async function gotoApp(page: import('@playwright/test').Page) {
  await page.goto(APP_BASE, { waitUntil: 'networkidle' });
}

/** Navigate to WebSocket studio and dirty the state: enable skip-cert. */
async function enableSkipCertInWsStudio(page: import('@playwright/test').Page) {
  await page.goto(`${APP_BASE}/?tab=websocket-studio`, { waitUntil: 'networkidle' });

  // Fill wss:// URL so the TLS panel appears
  await visibleWsUrlInput(page).fill('wss://ws.postman-echo.com/raw');
  await page.waitForSelector(WS.TLS_PANEL, { timeout: 3000 });

  // Open TLS config modal when the skip-cert control is not rendered yet.
  const checkbox = page.locator(SKIP_CERT_CHECKBOX);
  if (!await checkbox.isVisible().catch(() => false)) {
    await page.locator(WS.TLS_TOGGLE).click();
  }
  await checkbox.waitFor({ state: 'visible', timeout: 10_000 });

  // Enable skip-cert (check the checkbox)
  if (!await checkbox.isChecked()) {
    await checkbox.check();
    await page.waitForTimeout(200);
  }
  expect(await checkbox.isChecked()).toBe(true);
  console.log('[setup] skip-cert=true (dirty state confirmed)');
}

/** Navigate from any page to Demo Hub → Protocols → TLS lesson → Start. */
async function navigateToDemoHub(page: import('@playwright/test').Page) {
  // Click "Demo Hub" in the sidebar activity bar
  await page.locator('button[title="Demo Hub"]').click();
  // Wait for domain grid to appear
  await page.waitForSelector('.demo-domain-grid', { timeout: 5000 });

  // Click the "Protocols" domain card (not the sidebar button)
  await page.locator('.demo-domain-card').filter({ hasText: 'Protocols' }).click();
  // Wait for lesson list and category tabs to appear
  await page.waitForSelector('.demo-category-tabs', { timeout: 5000 });

  // Click the "WebSocket" category tab so the TLS lesson is visible
  await page.locator('.demo-category-tab').filter({ hasText: 'WebSocket' }).click();
  await page.waitForSelector('.demo-lesson-item', { timeout: 3000 });

  // Find and click "Secure WebSocket — wss:// & TLS" lesson item
  await page.locator('.demo-lesson-item').filter({ hasText: 'Secure WebSocket' }).first().click();
  // Wait for concept/player page
  await page.waitForSelector('.demo-start-btn', { timeout: 5000 });

  // Click "Start Demo →"
  await page.locator('.demo-start-btn').click();
  console.log('[nav] Clicked Start Demo →');
}

/** Wait for the demo overlay panel to appear (tlsSetup has completed). */
async function waitForDemoOverlay(page: import('@playwright/test').Page) {
  await page.waitForSelector('.demo-live-panel', { timeout: 15000 });
  // Wait a bit more for setup to fully complete
  await page.waitForTimeout(1000);
}

/** Click "Next (→)" in the demo player. */
async function clickNext(page: import('@playwright/test').Page) {
  const nextBtn = page.locator('[aria-label="Next step"], button[title="Next (→)"]').first();
  await nextBtn.waitFor({ timeout: 5000 });
  await nextBtn.click();
  await page.waitForTimeout(500);
}

/** Get current step title from the demo overlay. */
async function getStepTitle(page: import('@playwright/test').Page): Promise<string> {
  return page.locator('.demo-live-step-title').textContent() ?? '';
}

// ── Tests ──────────────────────────────────────────────────────────────────

/** Exit the live demo overlay. */
async function exitDemo(page: import('@playwright/test').Page) {
  // Button title changed from "Exit (Esc)" to "Close (Esc)" in LiveDemo.tsx
  await page.locator('button[title="Close (Esc)"], button[title="Exit (Esc)"]').first().click();
  await page.waitForTimeout(500);
}

test.describe('TLS Demo — Full Demo Player E2E', () => {
  test.describe.configure({ timeout: 120_000 });

  test('1. tlsSetup correctly resets skip-cert state before demo starts', async ({ page }) => {
    // STEP A: Create dirty state — skip-cert enabled from a previous session
    await enableSkipCertInWsStudio(page);

    // STEP B: Navigate to Demo Hub and start TLS demo
    await navigateToDemoHub(page);

    // STEP C: Wait for demo overlay (tlsSetup has completed by the time step 1 renders)
    await waitForDemoOverlay(page);

    const step1Title = await getStepTitle(page);
    console.log(`[test 1] Step 1 title: "${step1Title}"`);
    expect(step1Title).toContain('wss://'); // step 1: "wss:// vs ws://"

    // STEP D: Ensure TLS controls are present, then open the TLS config modal.
    // The current UI exposes skip-cert inside the modal body.
    await visibleWsUrlInput(page).fill('wss://ws.postman-echo.com/raw');
    await page.waitForSelector(WS.TLS_PANEL, { timeout: 10_000 });

    const skipCertLocator = page.locator(SKIP_CERT_CHECKBOX);
    if (!await skipCertLocator.isVisible().catch(() => false)) {
      await page.locator(WS.TLS_TOGGLE).click();
    }
    await skipCertLocator.waitFor({ state: 'visible', timeout: 30_000 });
    await expect.poll(
      async () => skipCertLocator.isChecked(),
      {
        timeout: 30_000,
        message: 'tlsSetup should reset skip-cert back to false before step 1 is considered ready.',
      },
    ).toBe(false);
    const skipCert = await skipCertLocator.isChecked();
    console.log(`[test 1] skip-cert after tlsSetup = ${skipCert} (should be false)`);
  });

  test('2. step 3 (Connect Over TLS) connects without 504 error', async ({ page }) => {
    // Start from clean state (no prior skip-cert)
    await gotoApp(page);
    await navigateToDemoHub(page);
    await waitForDemoOverlay(page);

    // Track proxy requests to detect if proxy mode was accidentally triggered
    const proxyRequests: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/api/ws/') || req.url().includes('/ws/connect')) {
        proxyRequests.push(req.url());
      }
    });

    // Advance through steps: step 1 → step 2 → step 3
    // Step 1: "wss:// vs ws://"
    let title = await getStepTitle(page);
    console.log(`[test 2] Current step: "${title}"`);
    expect(title).toContain('wss://');

    await clickNext(page);
    title = await getStepTitle(page);
    console.log(`[test 2] Step 2: "${title}"`);
    expect(title).toContain('TLS'); // "TLS Configuration Panel"

    await clickNext(page);
    title = await getStepTitle(page);
    console.log(`[test 2] Step 3: "${title}"`);
    expect(title).toContain('Connect Over TLS');

    // Wait for step 3's action to complete (it connects to wss://ws.postman-echo.com/raw)
    await page.waitForTimeout(5000); // step 3 preAction connects (2.5s) then has 1.5s delay

    // CRITICAL: Check there is no 504 error message in the WebSocket studio
    const errorText = page.locator('text=504 Gateway Timeout');
    const has504 = await errorText.isVisible().catch(() => false);
    console.log(`[test 2] 504 error visible: ${has504} (should be false)`);
    expect(has504).toBe(false);

    // Also verify we did NOT use the proxy
    console.log(`[test 2] Proxy requests made: ${proxyRequests.length} (should be 0)`);
    expect(proxyRequests.length).toBe(0);

    // Check the connection status is "Connected"
    const connectedText = page.locator('text=Connected').first();
    const isConnected = await connectedText.isVisible().catch(() => false);
    console.log(`[test 2] Connected status visible: ${isConnected}`);
    expect(isConnected).toBe(true);
  });

  test('3. dirty state: demo recovers from stuck skip-cert and connects at step 3', async ({ page }) => {
    // This is the exact scenario the user reported:
    // Previous session left skip-cert=true → next demo run gets 504 at step 3
    await enableSkipCertInWsStudio(page);

    // Track 504 errors
    const errors504: string[] = [];
    page.on('response', (resp) => {
      if (resp.status() === 504) errors504.push(resp.url());
    });
    const proxyRequests: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/api/ws/')) proxyRequests.push(req.url());
    });

    // Start the demo (tlsSetup should fix the dirty state)
    await navigateToDemoHub(page);
    await waitForDemoOverlay(page);

    // Advance to step 3
    await clickNext(page); // step 2
    await clickNext(page); // step 3

    const title = await getStepTitle(page);
    console.log(`[test 3] At step: "${title}"`);
    expect(title).toContain('Connect Over TLS');

    // Wait for the connection attempt
    await page.waitForTimeout(5000);

    // CRITICAL: No 504 errors
    console.log(`[test 3] 504 HTTP responses: ${errors504.length}`);
    console.log(`[test 3] Proxy requests: ${proxyRequests.length}`);
    expect(errors504.length).toBe(0);
    expect(proxyRequests.length).toBe(0);

    // No error message in UI
    const has504Text = await page.locator('text=504 Gateway Timeout').isVisible().catch(() => false);
    console.log(`[test 3] 504 text in UI: ${has504Text} (should be false)`);
    expect(has504Text).toBe(false);
  });

  test('4. full demo run through Proxy TLS round-trip then cleanup resets skip-cert', async ({ page }) => {
    test.slow();
    // Step 7 (tls-proxy-roundtrip) enables skip-cert for the public-echo Proxy path.
    // After exit, tlsCleanup / prepareWsTlsLessonQuiet MUST leave skip-cert off.
    await gotoApp(page);
    await navigateToDemoHub(page);
    await waitForDemoOverlay(page);

    // 8-step viewer arc (see packages/demo-hub/.../ws-tls.ts)
    const steps = [
      'wss:// vs ws://',
      'TLS Configuration Panel',
      'Connect Over TLS',
      'Send & Receive Over TLS',
      'CA Certificate',
      'Client Certificate',
      'Connect & Send with TLS',
      'Transport Modes',
    ];

    await waitForReadingPhase(page, 30_000);
    for (let i = 0; i < steps.length - 2; i++) {
      const title = await getStepTitle(page);
      console.log(`[test 4] Step ${i + 1}: "${title}"`);
      expect(title).toContain(steps[i]!.split(' ').slice(0, 2).join(' '));
      await runNextStep(page, 90_000);
    }

    // Penultimate step (7/8) — Proxy round-trip with skip-cert
    let title = await getStepTitle(page);
    console.log(`[test 4] Step ${steps.length - 1}: "${title}"`);
    expect(title).toContain(steps[steps.length - 2]!.split(' ').slice(0, 2).join(' '));
    await completeCurrentStepAction(page, 90_000);
    await page.locator('[aria-label="Next step"]').click();

    // Last step (8/8) — Next stays disabled; finish action then exit for cleanup.
    title = await getStepTitle(page);
    console.log(`[test 4] Step ${steps.length}: "${title}"`);
    expect(title).toContain(steps[steps.length - 1]!.split(' ').slice(0, 2).join(' '));
    await finishDemoStep(page, 60_000);

    await exitDemo(page);
    await page.waitForTimeout(3000);

    await page.goto(`${APP_BASE}/?tab=websocket-studio`, { waitUntil: 'networkidle' });
    await page.click(WS.MODE_CLIENT);
    await page.click(WS.LEFT_TAB_CONNECT);

    await visibleWsUrlInput(page).fill('wss://ws.postman-echo.com/raw');
    await page.waitForSelector(WS.TLS_PANEL, { timeout: 3000 });
    const toggle = page.locator(WS.TLS_TOGGLE);
    if (await toggle.getAttribute('aria-expanded') !== 'true') {
      await toggle.click();
      await page.waitForTimeout(300);
    }

    const skipCertAfterCleanup = await page.locator(`${WS.TLS_SKIP_CERT} input[type="checkbox"]`).isChecked();
    console.log(`[test 4] skip-cert after full demo + cleanup = ${skipCertAfterCleanup} (MUST be false)`);
    expect(skipCertAfterCleanup).toBe(false);

    const proxyRequests: string[] = [];
    page.on('request', req => { if (req.url().includes('/api/ws/')) proxyRequests.push(req.url()); });
    await page.locator(WS.CONNECT_BTN).click();
    await page.waitForTimeout(4000);

    const has504 = await page.locator('text=504 Gateway Timeout').isVisible().catch(() => false);
    console.log(`[test 4] 504 after cleanup + connect = ${has504} (should be false)`);
    console.log(`[test 4] proxy requests = ${proxyRequests.length} (should be 0)`);
    expect(has504).toBe(false);
    expect(proxyRequests.length).toBe(0);
  });

  test('5. user with custom headers in draft: demo clears them and connects without 504', async ({ page }) => {
    // This is the EXACT scenario from the user's screenshot:
    // Their environment has custom headers/auth configured → forces proxy mode → 504
    // The demo's tlsSetup must clear headers and auth before connecting.
    await page.goto(`${APP_BASE}/?tab=websocket-studio`, { waitUntil: 'networkidle' });
    await page.click(WS.MODE_CLIENT);
    await page.click(WS.LEFT_TAB_CONNECT);

    // Navigate to Headers tab and add a custom header (simulating user's env config)
    await page.click(WS.LEFT_TAB_HEADERS);
    await page.waitForTimeout(300);
    // Click "Add Header" button (the non-delete-all one)
    const addBtn = page.locator('.ws-connect-kv-add-btn:not(.ws-connect-kv-delete-all-btn)').first();
    await addBtn.click();
    await page.waitForTimeout(200);
    // Fill in the header key
    const keyInput = page.locator('.ws-connect-kv-key').first();
    await keyInput.fill('Authorization');
    await page.waitForTimeout(200);
    await page.click(WS.LEFT_TAB_CONNECT);

    // Verify custom header triggers proxy mode (sanity check)
    await visibleWsUrlInput(page).fill('wss://ws.postman-echo.com/raw');
    await page.waitForTimeout(300);
    const proxyBeforeDemo: string[] = [];
    const proxyAfterDemo: string[] = [];
    page.on('request', req => {
      if (req.url().includes('/api/ws/')) proxyBeforeDemo.push(req.url());
    });
    await page.locator(`${WS.CONNECT_BTN}:visible:enabled`).first().click();
    await page.waitForTimeout(2000);
    const before504 = await page.locator('text=504 Gateway Timeout').isVisible().catch(() => false);
    console.log(`[test 5] Before demo — proxy triggered by custom header: ${before504} (expect true OR connection used proxy)`);
    // Disconnect
    const disconnectBtn = page.locator(`${WS.DISCONNECT_BTN}:visible:enabled`).first();
    if (await disconnectBtn.isVisible().catch(() => false)) {
      await disconnectBtn.click();
    }
    await page.waitForTimeout(300);

    // Now start the TLS demo — tlsSetup should clear headers before connecting
    page.on('request', req => {
      if (req.url().includes('/api/ws/')) proxyAfterDemo.push(req.url());
    });
    await navigateToDemoHub(page);
    await waitForDemoOverlay(page);

    // Advance to step 3 (Connect Over TLS)
    await clickNext(page); // step 2
    await clickNext(page); // step 3
    await page.waitForTimeout(5000); // wait for connect

    const has504 = await page.locator('text=504 Gateway Timeout').isVisible().catch(() => false);
    const isConnected = await page.locator('text=Connected').first().isVisible().catch(() => false);
    console.log(`[test 5] After demo setup — 504 = ${has504} (should be false)`);
    console.log(`[test 5] After demo setup — Connected = ${isConnected} (should be true)`);
    console.log(`[test 5] Proxy requests after demo setup = ${proxyAfterDemo.length} (should be 0)`);

    expect(has504).toBe(false);
    expect(isConnected).toBe(true);
    expect(proxyAfterDemo.length).toBe(0);
  });
});
