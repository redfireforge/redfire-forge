import { test, expect, type Page } from '@playwright/test';

const BASE = 'http://localhost:5173/?tab=websocket-studio';

async function goto(page: Page) {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="mode-client"]', { timeout: 8000 });
}

async function apiStatus(page: Page, port: number) {
  const r = await page.request.get(`http://localhost:3001/api/ws/mock/status?port=${port}`);
  const d = await r.json() as { ok: boolean; data: { running: boolean; port: number; clientCount: number } };
  return d.data;
}

test('DIAG: two-tab mock setup step-by-step', async ({ page }) => {
  await goto(page);
  
  // Step 1: Tab1 → mock mode → start 9876
  await page.click('[data-testid="mode-mock"]');
  await page.waitForTimeout(300);
  
  // Clear any running server first
  const stop1 = page.locator('[data-testid="mock-stop-btn"]');
  if (await stop1.isVisible({ timeout: 400 }).catch(() => false)) {
    await stop1.click(); await page.waitForTimeout(600);
  }
  await page.click('[data-testid="mock-start-btn"]');
  await expect(page.locator('[data-testid="mock-status-label"]')).toContainText(/running/i, { timeout: 6000 });
  
  const s1a = await apiStatus(page, 9876);
  console.log(`[DIAG] After Tab1 startMock: 9876.running=${s1a.running}, 9877.running=${(await apiStatus(page,9877)).running}`);
  expect(s1a.running, '9876 should be running after Tab1 start').toBe(true);

  // Step 2: Add Tab2
  await page.click('[data-testid="conn-tab-add"]');
  await page.waitForTimeout(300);
  
  const s2a = await apiStatus(page, 9876);
  console.log(`[DIAG] After addTab: 9876.running=${s2a.running}`);
  expect(s2a.running, '9876 should still be running after addTab').toBe(true);

  // What port did Tab2 get?
  const pane2 = page.locator('[data-testid^="conn-tab-pane-"]:visible');
  await pane2.locator('[data-testid="mode-mock"]').click();
  await page.waitForTimeout(300);
  const tab2Port = await pane2.locator('[data-testid="mock-port-input"]').inputValue();
  console.log(`[DIAG] Tab2 assigned port: ${tab2Port}`);
  expect(tab2Port, 'Tab2 should get 9877').toBe('9877');

  // Step 3: Start Tab2 mock server
  const stop2 = pane2.locator('[data-testid="mock-stop-btn"]');
  const stop2visible = await stop2.isVisible({ timeout: 400 }).catch(() => false);
  console.log(`[DIAG] Tab2 stop btn visible before start: ${stop2visible}`);
  
  if (stop2visible) {
    console.log('[DIAG] WARNING: Tab2 stop btn visible — will click stop first');
    // Check what port the stop button would stop
    const portOnDisplay = await pane2.locator('[data-testid="mock-port-input"]').inputValue();
    console.log(`[DIAG] Tab2 port input shows: ${portOnDisplay}`);
    await stop2.click(); 
    await page.waitForTimeout(600);
    const s3a = await apiStatus(page, 9876);
    const s3b = await apiStatus(page, 9877);
    console.log(`[DIAG] After Tab2 stop: 9876.running=${s3a.running}, 9877.running=${s3b.running}`);
  }
  
  await pane2.locator('[data-testid="mock-start-btn"]').click();
  await expect(pane2.locator('[data-testid="mock-status-label"]')).toContainText(/running/i, { timeout: 6000 });
  
  const s3c = await apiStatus(page, 9876);
  const s3d = await apiStatus(page, 9877);
  console.log(`[DIAG] After Tab2 startMock: 9876.running=${s3c.running}, 9877.running=${s3d.running}`);
  expect(s3c.running, '9876 must still be running after Tab2 start').toBe(true);
  expect(s3d.running, '9877 should be running after Tab2 start').toBe(true);

  // Step 4: Click Tab1
  const tabs = page.locator('[data-testid="conn-tab-bar"] [role="tab"]');
  await tabs.first().click();
  await page.waitForTimeout(300);

  const s4 = await apiStatus(page, 9876);
  console.log(`[DIAG] After clickTab1: 9876.running=${s4.running}`);
  expect(s4.running, '9876 must be running before connectClient').toBe(true);

  // Step 5: Connect Tab1 client to 9876
  const pane1 = page.locator('[data-testid^="conn-tab-pane-"]:visible');
  await pane1.locator('[data-testid="mode-client"]').click();
  await page.waitForTimeout(300);
  
  const s5 = await apiStatus(page, 9876);
  console.log(`[DIAG] After clicking mode-client on Tab1: 9876.running=${s5.running}`);
  
  await pane1.locator('[data-testid="left-tab-connect"]').click();
  await page.waitForTimeout(200);
  await pane1.locator('[aria-label="WebSocket URL"]').fill('ws://localhost:9876');
  await pane1.locator('[data-testid="connect-btn"]').click();
  
  const s5b = await apiStatus(page, 9876);
  console.log(`[DIAG] After clicking connect: 9876.running=${s5b.running}, clients=${s5b.clientCount}`);
  
  try {
    await page.locator('[data-testid="conn-tab-bar"] [role="tab"][aria-selected="true"][aria-label*="connected"]')
      .waitFor({ timeout: 10000 });
    console.log('[DIAG] SUCCESS: Tab1 client connected to 9876');
  } catch (e) {
    const s5c = await apiStatus(page, 9876);
    console.log(`[DIAG] FAIL: Connection failed. 9876.running=${s5c.running}`);
    // Also check the error in the UI
    const errorText = await page.locator('.ws-conn-error, [class*="error"]').first().innerText().catch(() => 'N/A');
    console.log(`[DIAG] UI error: ${errorText}`);
    throw e;
  }
  
  console.log('[DIAG] All steps passed!');
});
