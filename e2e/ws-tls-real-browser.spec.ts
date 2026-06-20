/**
 * TLS Demo — Real Browser State Test
 *
 * Uses a PERSISTENT browser user data directory that accumulates state across
 * test runs (just like a real Chrome user). This simulates the user scenario
 * where state from a previous demo run leaks into the next session.
 *
 * Unlike the other tests which use a fresh isolated context, this one
 * deliberately preserves localStorage between runs.
 *
 * Run twice to see the effect:
 *   1st run: sets skip-cert=true in localStorage-persisted state
 *   2nd run: verifies the demo resets it even with accumulated dirty state
 */
import { test, expect, chromium } from '@playwright/test';
import path from 'path';
import os from 'os';
import { WS } from '../src/shared/selectors';

const APP_BASE = 'http://localhost:5173';
// Persistent user data dir — state accumulates across runs (like real Chrome)
const USER_DATA_DIR = path.join(os.tmpdir(), 'redfire-forge-real-browser-test');

const SKIP_CERT_CHECKBOX = `${WS.TLS_SKIP_CERT} input[type="checkbox"]`;

test.describe('TLS Demo — Persistent Browser State', () => {
  test.describe.configure({ timeout: 120_000 });

  test('full scenario: dirty state + demo + cleanup + direct connect all work', async () => {
    // Launch a persistent browser (NOT isolated — state survives between launches)
    const browser = await chromium.launchPersistentContext(USER_DATA_DIR, {
      headless: true,
      args: ['--no-sandbox'],
    });

    try {
      const page = await browser.newPage();

      // === PHASE 1: Create dirty state in the persistent browser ===
      await page.goto(`${APP_BASE}/?tab=websocket-studio`, { waitUntil: 'networkidle' });
      await page.click(WS.MODE_CLIENT);
      await page.click(WS.LEFT_TAB_CONNECT);
      await page.fill(WS.URL_INPUT, 'wss://echo.websocket.org');
      await page.waitForSelector(WS.TLS_PANEL, { timeout: 3000 });

      const toggle = page.locator(WS.TLS_TOGGLE);
      if (await toggle.getAttribute('aria-expanded') !== 'true') {
        await toggle.click();
        await page.waitForTimeout(300);
      }

      // Enable skip-cert (dirty state)
      const cb = page.locator(SKIP_CERT_CHECKBOX);
      if (!await cb.isChecked()) {
        await cb.check();
        await page.waitForTimeout(200);
      }
      expect(await cb.isChecked()).toBe(true);
      console.log('[phase 1] skip-cert=true (dirty state set)');

      // Dump the localStorage to confirm what's actually saved
      const ls = await page.evaluate(() => {
        const result: Record<string, string> = {};
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i)!;
          result[k] = localStorage.getItem(k) ?? '';
        }
        return result;
      });
      console.log('\n[phase 1] localStorage keys:', Object.keys(ls));
      for (const [k, v] of Object.entries(ls)) {
        if (v.includes('rejectUnauthorized') || v.includes('tls') || v.includes('cert')) {
          console.log(`  ⚠️  TLS data found: [${k}] = ${v.slice(0, 400)}`);
        }
      }

      // === PHASE 2: Hard reload (simulates user hitting F5) ===
      await page.reload({ waitUntil: 'networkidle' });
      await page.click(WS.MODE_CLIENT);
      await page.click(WS.LEFT_TAB_CONNECT);

      // Check skip-cert state after reload
      const urlAfterReload = await page.locator(WS.URL_INPUT).inputValue();
      console.log(`\n[phase 2] URL after reload: "${urlAfterReload}"`);

      await page.fill(WS.URL_INPUT, 'wss://echo.websocket.org');
      await page.waitForSelector(WS.TLS_PANEL, { timeout: 3000 });
      if (await toggle.getAttribute('aria-expanded') !== 'true') {
        await toggle.click();
        await page.waitForTimeout(300);
      }

      const skipCertAfterReload = await page.locator(SKIP_CERT_CHECKBOX).isChecked();
      console.log(`[phase 2] skip-cert after reload = ${skipCertAfterReload}`);

      if (skipCertAfterReload) {
        // Find what storage key caused it
        const ls2 = await page.evaluate(() => {
          const result: Record<string, string> = {};
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i)!;
            result[k] = localStorage.getItem(k) ?? '';
          }
          return result;
        });
        console.log('⚠️  SKIP-CERT PERSISTS AFTER RELOAD. Storage at this point:');
        for (const [k, v] of Object.entries(ls2)) {
          console.log(`  [${k}] = ${v.slice(0, 400)}`);
        }
      }

      // === PHASE 3: Navigate to Demo Hub and start TLS demo ===
      // Clear persisted demo navigation state so we always land on the domains grid
      // (a previous failed run can leave lastView='concept' in localStorage).
      await page.evaluate(() => { localStorage.removeItem('redfire-demo-progress-v2'); });
      await page.goto(`${APP_BASE}/?tab=demo-hub`, { waitUntil: 'networkidle' });
      await page.waitForSelector('.demo-domain-grid', { timeout: 10000 });
      await page.locator('.demo-domain-card').filter({ hasText: 'Protocols' }).click();
      await page.waitForSelector('.demo-category-tabs', { timeout: 5000 });
      await page.locator('.demo-category-tab').filter({ hasText: 'WebSocket' }).click();
      await page.waitForSelector('.demo-lesson-item', { timeout: 3000 });
      await page.locator('.demo-lesson-item').filter({ hasText: 'Secure WebSocket' }).first().click();
      await page.waitForSelector('.demo-start-btn', { timeout: 5000 });
      await page.locator('.demo-start-btn').click();
      console.log('\n[phase 3] Started TLS demo');

      // Wait for demo overlay + setup to complete
      await page.waitForSelector('.demo-live-panel', { timeout: 15000 });
      await page.waitForTimeout(1500);

      const step1 = await page.locator('.demo-live-step-title').textContent();
      console.log(`[phase 3] Step 1: "${step1}"`);

      // Verify skip-cert was reset by tlsSetup
      await page.fill(WS.URL_INPUT, 'wss://echo.websocket.org');
      await page.waitForSelector(WS.TLS_PANEL, { timeout: 3000 });
      if (await toggle.getAttribute('aria-expanded') !== 'true') {
        await toggle.click();
        await page.waitForTimeout(300);
      }

      const skipCertAfterSetup = await page.locator(SKIP_CERT_CHECKBOX).isChecked();
      console.log(`[phase 3] skip-cert after tlsSetup = ${skipCertAfterSetup} (should be false)`);
      expect(skipCertAfterSetup).toBe(false);

      // === PHASE 4: Direct connect AFTER demo exit — no 504 ===
      const proxyRequests: string[] = [];
      page.on('request', req => {
        if (req.url().includes('/api/ws/')) proxyRequests.push(req.url());
      });

      // Exit demo
      await page.locator('button[title="Close (Esc)"], button[title="Exit (Esc)"]').first().click();
      await page.waitForTimeout(2000);

      // Navigate to WS studio and connect
      await page.goto(`${APP_BASE}/?tab=websocket-studio`, { waitUntil: 'networkidle' });
      await page.click(WS.MODE_CLIENT);
      await page.click(WS.LEFT_TAB_CONNECT);
      await page.fill(WS.URL_INPUT, 'wss://echo.websocket.org');
      await page.waitForTimeout(300);
      await page.locator(WS.CONNECT_BTN).click();
      await page.waitForTimeout(4000);

      const has504 = await page.locator('text=504 Gateway Timeout').isVisible().catch(() => false);
      const isConnected = await page.locator('text=Connected').first().isVisible().catch(() => false);
      console.log(`\n[phase 4] 504 visible = ${has504} (should be false)`);
      console.log(`[phase 4] Connected = ${isConnected} (should be true)`);
      console.log(`[phase 4] Proxy requests = ${proxyRequests.length} (should be 0)`);

      expect(has504).toBe(false);
      expect(isConnected).toBe(true);
      expect(proxyRequests.length).toBe(0);

    } finally {
      await browser.close();
    }
  });
});
