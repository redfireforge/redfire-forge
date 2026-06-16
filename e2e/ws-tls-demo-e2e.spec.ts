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

const APP_BASE = 'http://localhost:5173';
const WS_URL_INPUT = WS.URL_INPUT;          // '[data-testid="url-input"]'
const TLS_TOGGLE = WS.TLS_TOGGLE;          // '[data-testid="tls-toggle"]'
const TLS_PANEL = WS.TLS_PANEL;            // '[data-testid="tls-panel"]'
const SKIP_CERT_CHECKBOX = `${WS.TLS_SKIP_CERT} input[type="checkbox"]`;

// ── Helpers ────────────────────────────────────────────────────────────────

async function gotoApp(page: import('@playwright/test').Page) {
  await page.goto(APP_BASE, { waitUntil: 'networkidle' });
}

/** Navigate to WebSocket studio and dirty the state: enable skip-cert. */
async function enableSkipCertInWsStudio(page: import('@playwright/test').Page) {
  await page.goto(`${APP_BASE}/?tab=websocket-studio`, { waitUntil: 'networkidle' });

  // Fill wss:// URL so the TLS panel appears
  await page.fill(WS_URL_INPUT, 'wss://echo.websocket.org');
  await page.waitForSelector(TLS_PANEL, { timeout: 3000 });

  // Expand TLS panel
  const toggle = page.locator(TLS_TOGGLE);
  if (await toggle.getAttribute('aria-expanded') !== 'true') {
    await toggle.click();
    await page.waitForTimeout(300);
  }

  // Enable skip-cert (check the checkbox)
  const checkbox = page.locator(SKIP_CERT_CHECKBOX);
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
  const nextBtn = page.locator('button[title="Next (→)"]');
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
  await page.locator('button[title="Exit (Esc)"]').click();
  await page.waitForTimeout(500);
}

test.describe('TLS Demo — Full Demo Player E2E', () => {

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

    // STEP D: The demo's step 1 preAction fills the URL with wss://echo.websocket.org.
    // Expand TLS panel and verify skip-cert is now false (tlsSetup reset it).
    await page.waitForSelector(TLS_PANEL, { timeout: 3000 });
    const toggle = page.locator(TLS_TOGGLE);
    if (await toggle.getAttribute('aria-expanded') !== 'true') {
      await toggle.click();
      await page.waitForTimeout(300);
    }

    const skipCert = await page.locator(SKIP_CERT_CHECKBOX).isChecked();
    console.log(`[test 1] skip-cert after tlsSetup = ${skipCert} (should be false)`);
    expect(skipCert).toBe(false); // THE CRITICAL ASSERTION
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

    // Wait for step 3's action to complete (it connects to wss://echo.websocket.org)
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

  test('4. full demo run through step 5 (skip-cert enabled) then cleanup resets it', async ({ page }) => {
    // This covers the EXACT user scenario: demo runs step 5 which enables skip-cert,
    // then the demo ends and tlsCleanup MUST reset it so the next connect works.
    await gotoApp(page);
    await navigateToDemoHub(page);
    await waitForDemoOverlay(page);

    // Advance through all 7 steps:
    // step 1: wss:// vs ws://
    // step 2: TLS Configuration Panel
    // step 3: Connect Over TLS
    // step 4: Send & Receive Over TLS
    // step 5: Skip Certificate Validation  ← enables skip-cert!
    // step 6: CA Certificate & mTLS
    // step 7: Transport Modes & Desktop TLS
    const steps = [
      'wss:// vs ws://',
      'TLS Configuration Panel',
      'Connect Over TLS',
      'Send & Receive Over TLS',
      'Skip Certificate Validation',
      'CA Certificate & mTLS',
      'Transport Modes & Desktop TLS',
    ];

    for (let i = 0; i < steps.length; i++) {
      const title = await getStepTitle(page);
      console.log(`[test 4] Step ${i + 1}: "${title}"`);
      expect(title).toContain(steps[i].split(' ').slice(0, 3).join(' ')); // partial match

      const isLast = i === steps.length - 1;
      if (!isLast) {
        await clickNext(page);
      }
    }

    // At step 5 skip-cert gets ENABLED by the demo. By step 7 it's still enabled.
    // Now EXIT the demo → tlsCleanup runs and MUST reset skip-cert.
    await exitDemo(page);

    // Wait for cleanup to finish
    await page.waitForTimeout(3000);

    // Navigate back to WebSocket studio and check skip-cert state
    await page.goto(`${APP_BASE}/?tab=websocket-studio`, { waitUntil: 'networkidle' });
    await page.click(WS.MODE_CLIENT);
    await page.click(WS.LEFT_TAB_CONNECT);

    // Fill wss:// URL so TLS panel renders
    await page.fill(WS.URL_INPUT, 'wss://echo.websocket.org');
    await page.waitForSelector(WS.TLS_PANEL, { timeout: 3000 });
    const toggle = page.locator(WS.TLS_TOGGLE);
    if (await toggle.getAttribute('aria-expanded') !== 'true') {
      await toggle.click();
      await page.waitForTimeout(300);
    }

    const skipCertAfterCleanup = await page.locator(`${WS.TLS_SKIP_CERT} input[type="checkbox"]`).isChecked();
    console.log(`[test 4] skip-cert after full demo + cleanup = ${skipCertAfterCleanup} (MUST be false)`);
    expect(skipCertAfterCleanup).toBe(false); // THE CRITICAL CLEANUP ASSERTION

    // Verify connection works (no 504)
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
    await page.fill(WS.URL_INPUT, 'wss://echo.websocket.org');
    await page.waitForTimeout(300);
    const proxyBeforeDemo: string[] = [];
    const proxyAfterDemo: string[] = [];
    page.on('request', req => {
      if (req.url().includes('/api/ws/')) proxyBeforeDemo.push(req.url());
    });
    await page.locator(WS.CONNECT_BTN).click();
    await page.waitForTimeout(2000);
    const before504 = await page.locator('text=504 Gateway Timeout').isVisible().catch(() => false);
    console.log(`[test 5] Before demo — proxy triggered by custom header: ${before504} (expect true OR connection used proxy)`);
    // Disconnect
    const disconnectBtn = page.locator(WS.DISCONNECT_BTN);
    if (await disconnectBtn.isVisible().catch(() => false)) await disconnectBtn.click();
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
