import { test, expect, type Page } from '@playwright/test';

const BASE = 'http://localhost:5173/?tab=websocket-studio';

async function goto(page: Page) {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="mode-client"]', { timeout: 8000 });
}

test('DEBUG: single tab mock log appears after send', async ({ page }) => {
  await goto(page);

  // 1. Switch to Mock mode and start server
  await page.click('[data-testid="mode-mock"]');
  await page.waitForTimeout(300);

  // Stop if running
  const stopBtn = page.locator('[data-testid="mock-stop-btn"]');
  if (await stopBtn.isVisible({ timeout: 400 }).catch(() => false)) {
    await stopBtn.click();
    await page.waitForTimeout(600);
  }

  // Start
  await page.click('[data-testid="mock-start-btn"]');
  await expect(page.locator('[data-testid="mock-status-label"]')).toContainText(/running/i, { timeout: 6000 });
  console.log('[DEBUG] Mock server started');

  // 2. Switch to Server Log tab  
  const logTabBtn = page.locator('[data-testid="mock-tab-log"]');
  if (await logTabBtn.isVisible({ timeout: 500 }).catch(() => false)) {
    await logTabBtn.click();
    await page.waitForTimeout(200);
  }
  const initialLogCount = await page.locator('[data-testid^="mock-log-"]').count();
  console.log(`[DEBUG] Initial log entry count: ${initialLogCount}`);

  // 3. Add Tab2 and connect client to 9876
  await page.click('[data-testid="conn-tab-add"]');
  await page.waitForTimeout(300);

  const pane2 = page.locator('[data-testid^="conn-tab-pane-"]:visible');
  await pane2.locator('[data-testid="mode-client"]').click();
  await page.waitForTimeout(200);
  await pane2.locator('[data-testid="left-tab-connect"]').click();
  await page.waitForTimeout(200);
  const urlInput = pane2.locator('[aria-label="WebSocket URL"]');
  await urlInput.fill('ws://localhost:9876');
  await pane2.locator('[data-testid="connect-btn"]').click();

  // wait for connection (with longer timeout)
  try {
    await page.locator('[data-testid="conn-tab-bar"] [role="tab"][aria-selected="true"][aria-label*="connected"]')
      .waitFor({ timeout: 10000 });
    console.log('[DEBUG] Client connected to ws://localhost:9876');
  } catch (e) {
    // Log what we have
    const activeLbl = await page.locator('[data-testid="conn-tab-bar"] [role="tab"][aria-selected="true"]').getAttribute('aria-label');
    console.log(`[DEBUG] Connection FAILED. Active tab label: ${activeLbl}`);
    // Check the backend status
    const resp = await page.request.get('http://localhost:3001/api/ws/mock/status?port=9876');
    const status = await resp.text();
    console.log(`[DEBUG] Backend status: ${status}`);
    throw e;
  }

  // 4. Send a message
  await pane2.locator('[data-testid="left-tab-send"]').click();
  await page.waitForTimeout(150);
  await pane2.locator('.ws-compose-input').fill('debug-probe-message');
  await pane2.locator('[data-testid="send-btn"]').click();
  console.log('[DEBUG] Message sent');
  await page.waitForTimeout(500);

  // 5. Check echo in Tab2 Events
  await pane2.locator('[data-testid="right-tab-events"]').click();
  await page.waitForTimeout(200);
  const eventsText = await pane2.locator('[data-testid="message-list"]').innerText().catch(() => 'N/A');
  console.log(`[DEBUG] Tab2 Events: ${eventsText.substring(0, 200)}`);

  // 6. Switch to Tab1 and check mock log
  const tabs = page.locator('[data-testid="conn-tab-bar"] [role="tab"]');
  await tabs.first().click();
  await page.waitForTimeout(300);
  console.log('[DEBUG] Switched to Tab1');

  // Re-open mock mode and log
  await page.locator('[data-testid^="conn-tab-pane-"]:visible [data-testid="mode-mock"]').click();
  await page.waitForTimeout(300);

  // Check backend log directly
  const backendLog = await page.request.get('http://localhost:3001/api/ws/mock/log?port=9876&sinceCursor=-1');
  const backendLogData = await backendLog.json() as { ok: boolean; data: { entries: Array<{ event: string; data?: string }> } };
  console.log(`[DEBUG] Backend log entries: ${JSON.stringify(backendLogData.data?.entries?.map(e => `${e.event}:${e.data ?? ''}`) ?? [])}`);

  const logTabBtn2 = page.locator('[data-testid^="conn-tab-pane-"]:visible [data-testid="mock-tab-log"]');
  if (await logTabBtn2.isVisible({ timeout: 500 }).catch(() => false)) {
    await logTabBtn2.click();
    await page.waitForTimeout(200);
  }

  // Wait up to 3 seconds and check every 500ms
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(500);
    const logEntries = page.locator('[data-testid^="conn-tab-pane-"]:visible [data-testid^="mock-log-"]');
    const count = await logEntries.count();
    const texts: string[] = [];
    for (let j = 0; j < count; j++) {
      texts.push(await logEntries.nth(j).innerText().catch(() => '?'));
    }
    console.log(`[DEBUG] t+${(i+1)*500}ms: ${count} log entries: ${JSON.stringify(texts)}`);
    if (texts.some(t => t.includes('debug-probe-message'))) {
      console.log('[DEBUG] SUCCESS: found message in log!');
      break;
    }
  }

  // Final check
  const finalLogEntries = page.locator('[data-testid^="conn-tab-pane-"]:visible [data-testid^="mock-log-"]');
  const finalCount = await finalLogEntries.count();
  console.log(`[DEBUG] Final log entry count: ${finalCount}`);
  expect(finalCount).toBeGreaterThan(0);
});
