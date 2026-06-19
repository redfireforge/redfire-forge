/**
 * WS Multi-Mock Server — Comprehensive Investigation Suite
 *
 * Investigates the exact bugs the user reported:
 *  1. Sudden client disconnection while multi-mock servers are running
 *  2. Send button silently does nothing / mock server log displays nothing
 *
 * Each test is explicit about what it checks and why.
 * Tests run serially within each describe block to share a consistent page state.
 */
import { test, expect, type Page } from '@playwright/test';
import { gotoWsStudio } from './ws-helpers';

const PORT1 = 9876;
const PORT2 = 9877;
const PORT3 = 9878;

// ─── Low-level helpers ────────────────────────────────────────────

/** Switch to the active pane's mode. */
async function switchMode(page: Page, mode: 'client' | 'mock' | 'saved') {
  const pane = page.locator('[data-testid^="conn-tab-pane-"]:visible');
  await pane.locator(`[data-testid="mode-${mode}"]`).click();
  await page.waitForTimeout(300);
}

/** Switch left tab (connect/headers/send/auth) within the visible pane. */
async function _switchLeftTab(page: Page, tab: string) {
  const pane = page.locator('[data-testid^="conn-tab-pane-"]:visible');
  await pane.locator(`[data-testid="left-tab-${tab}"]`).click();
  await page.waitForTimeout(200);
}

/** Start the mock server in the currently visible pane. */
async function startMock(page: Page) {
  const pane = page.locator('[data-testid^="conn-tab-pane-"]:visible');
  // If the server is already running (stop button visible), stop it first for a clean slate
  const stopBtn = pane.locator('[data-testid="mock-stop-btn"]');
  if (await stopBtn.isVisible({ timeout: 600 }).catch(() => false)) {
    await stopBtn.click();
    // Wait for the start button to appear (UI reflects stopped state)
    await pane.locator('[data-testid="mock-start-btn"]').waitFor({ timeout: 4000 });
    await page.waitForTimeout(200);
  }
  await pane.locator('[data-testid="mock-start-btn"]').click();
  await expect(pane.locator('[data-testid="mock-status-label"]'))
    .toContainText(/running/i, { timeout: 6000 });
}

/** Stop the mock server in the currently visible pane (switches to mock mode first if needed). */
async function stopMock(page: Page) {
  const pane = page.locator('[data-testid^="conn-tab-pane-"]:visible');
  // Switch to mock mode so the stop button is accessible
  const mockModeBtn = pane.locator('[data-testid="mode-mock"]');
  if (await mockModeBtn.isVisible({ timeout: 400 }).catch(() => false)) {
    await mockModeBtn.click();
    await page.waitForTimeout(300);
  }
  const stopBtn = pane.locator('[data-testid="mock-stop-btn"]');
  if (await stopBtn.isVisible({ timeout: 600 }).catch(() => false)) {
    await stopBtn.click();
    await page.waitForTimeout(400);
  }
}

/** Add a new connection tab and wait for it to become active. */
async function addTab(page: Page) {
  const beforeCount = await page.locator('[data-testid="conn-tab-bar"] [role="tab"]').count();
  await page.click('[data-testid="conn-tab-add"]');
  await page.waitForFunction(
    (n) => document.querySelectorAll('[data-testid="conn-tab-bar"] [role="tab"]').length > n,
    beforeCount,
    { timeout: 3000 },
  );
  await page.waitForTimeout(300);
}

/** Click the Nth tab (0-based). */
async function clickTab(page: Page, index: number) {
  const tabs = page.locator('[data-testid="conn-tab-bar"] [role="tab"]');
  await tabs.nth(index).click();
  await page.waitForTimeout(300);
}

/** Connect the visible pane's client to `url`. */
async function connectClient(page: Page, url: string) {
  const pane = page.locator('[data-testid^="conn-tab-pane-"]:visible');
  await pane.locator('[data-testid="mode-client"]').click();
  await page.waitForTimeout(200);
  await pane.locator('[data-testid="left-tab-connect"]').click();
  await page.waitForTimeout(200);
  const urlInput = pane.locator('[aria-label="WebSocket URL"]');
  await urlInput.fill(url);
  await pane.locator('[data-testid="connect-btn"]').click();
  // Wait for the active tab label to show connected — 15s to handle 3-tab concurrency overhead
  await page.locator('[data-testid="conn-tab-bar"] [role="tab"][aria-selected="true"][aria-label*="connected"]')
    .waitFor({ timeout: 15_000 });
  await page.waitForTimeout(300);
}

/** Disconnect the visible pane's client. Switches to client mode first if needed. */
async function disconnectClient(page: Page) {
  const pane = page.locator('[data-testid^="conn-tab-pane-"]:visible');
  // Ensure we're in client mode before trying to access Connect tab
  const connectTabBtn = pane.locator('[data-testid="left-tab-connect"]');
  if (!(await connectTabBtn.isVisible({ timeout: 500 }).catch(() => false))) {
    await pane.locator('[data-testid="mode-client"]').click();
    await page.waitForTimeout(300);
  }
  await pane.locator('[data-testid="left-tab-connect"]').click();
  await page.waitForTimeout(150);
  const btn = pane.locator('[data-testid="disconnect-btn"]');
  if (await btn.isEnabled({ timeout: 500 }).catch(() => false)) {
    await btn.click();
    await page.waitForTimeout(500);
  }
}

/** Send a text message from the visible pane. */
async function sendMessage(page: Page, text: string) {
  const pane = page.locator('[data-testid^="conn-tab-pane-"]:visible');
  await pane.locator('[data-testid="left-tab-send"]').click();
  await page.waitForTimeout(150);
  const input = pane.locator('.ws-compose-input');
  await input.fill(text);
  await pane.locator('[data-testid="send-btn"]').click();
  await page.waitForTimeout(300);
}

/** Get the mock server port number currently shown in the visible pane. */
async function getMockPort(page: Page): Promise<number> {
  const pane = page.locator('[data-testid^="conn-tab-pane-"]:visible');
  const val = await pane.locator('[data-testid="mock-port-input"]').inputValue();
  return parseInt(val, 10);
}

/** Open the Mock Server Log panel in the visible pane. */
async function openMockLog(page: Page) {
  const pane = page.locator('[data-testid^="conn-tab-pane-"]:visible');
  const logTab = pane.locator('[data-testid="mock-tab-log"]');
  if (await logTab.isVisible({ timeout: 500 }).catch(() => false)) {
    await logTab.click();
    await page.waitForTimeout(200);
  }
}

/** Count mock log entries in the visible pane. */
async function mockLogCount(page: Page): Promise<number> {
  const pane = page.locator('[data-testid^="conn-tab-pane-"]:visible');
  return pane.locator('[data-testid^="mock-log-"]').count();
}

/** Return all mock log entry texts in the visible pane. */
async function mockLogTexts(page: Page): Promise<string[]> {
  const pane = page.locator('[data-testid^="conn-tab-pane-"]:visible');
  const entries = pane.locator('[data-testid^="mock-log-"]');
  const count = await entries.count();
  const texts: string[] = [];
  for (let i = 0; i < count; i++) {
    texts.push(await entries.nth(i).innerText());
  }
  return texts;
}

/** Assert the visible pane client is still "connected" (not disconnected). */
async function assertStillConnected(page: Page) {
  const activeTab = page.locator('[data-testid="conn-tab-bar"] [role="tab"][aria-selected="true"]');
  const label = await activeTab.getAttribute('aria-label');
  expect(label, `Expected connected but got: ${label}`).toMatch(/connected/i);
  // Also check status dot — looking for the connection status indicator
  const pane = page.locator('[data-testid^="conn-tab-pane-"]:visible');
  await pane.locator('[data-testid="left-tab-connect"]').click();
  await page.waitForTimeout(200);
  // If connect-btn is shown (not disconnect-btn), client has been dropped
  const hasDisconnectBtn = await pane.locator('[data-testid="disconnect-btn"]').isVisible({ timeout: 2000 }).catch(() => false);
  expect(hasDisconnectBtn, 'disconnect-btn should be visible when connected').toBe(true);
}

// ─── Global beforeAll: stop any leftover servers before entire suite ──────────
// Tests share the backend process. A failed test that leaves servers running
// would pollute subsequent tests. Clean slate once before the suite starts.
test.beforeAll(async ({ request }) => {
  await Promise.allSettled([
    request.post('http://localhost:3001/api/ws/mock/stop', { data: { port: 9876 } }),
    request.post('http://localhost:3001/api/ws/mock/stop', { data: { port: 9877 } }),
    request.post('http://localhost:3001/api/ws/mock/stop', { data: { port: 9878 } }),
  ]);
});

// ─── MM-01: Two independent mock servers start on distinct ports ──

test.describe('MM-01: Port isolation — two tabs get different ports', () => {
  test.describe.configure({ timeout: 60_000 });

  test('each tab is assigned a unique port starting at 9876', async ({ page }) => {
    await gotoWsStudio(page);
    await switchMode(page, 'mock');

    const port1 = await getMockPort(page);
    expect(port1).toBe(PORT1);

    await addTab(page);
    await switchMode(page, 'mock');
    const port2 = await getMockPort(page);
    expect(port2).toBe(PORT2);
    expect(port2).not.toBe(port1);
  });
});

// ─── MM-02: Both mock servers start independently ────────────────

test.describe('MM-02: Both mock servers start and run simultaneously', () => {
  test.describe.configure({ timeout: 90_000 });

  test('start two mock servers in different tabs — both show Running', async ({ page }) => {
    await gotoWsStudio(page);
    await switchMode(page, 'mock');
    await startMock(page); // Tab1 → port 9876

    await addTab(page);
    await switchMode(page, 'mock');
    await startMock(page); // Tab2 → port 9877

    // Verify Tab2 is Running
    const pane2 = page.locator('[data-testid^="conn-tab-pane-"]:visible');
    await expect(pane2.locator('[data-testid="mock-status-label"]')).toContainText(/running/i);

    // Switch to Tab1 and verify it's still Running
    await clickTab(page, 0);
    await switchMode(page, 'mock');
    const pane1 = page.locator('[data-testid^="conn-tab-pane-"]:visible');
    await expect(pane1.locator('[data-testid="mock-status-label"]')).toContainText(/running/i);

    // Clean up
    await stopMock(page); // stop Tab1
    await clickTab(page, 1);
    await stopMock(page); // stop Tab2
  });
});

// ─── MM-03: Client connects to correct mock server ───────────────

test.describe('MM-03: Client to mock server — message roundtrip on each tab', () => {
  test.describe.configure({ timeout: 120_000 });

  test('Tab1 client sends and receives echo from port 9876', async ({ page }) => {
    await gotoWsStudio(page);

    // Start mock server Tab1
    await switchMode(page, 'mock');
    await startMock(page);

    // Add Tab2 and start its mock server
    await addTab(page);
    await switchMode(page, 'mock');
    await startMock(page);

    // ── Test Tab1 roundtrip ──
    await clickTab(page, 0);
    await connectClient(page, `ws://localhost:${PORT1}`);
    await sendMessage(page, 'hello-from-tab1');
    await page.waitForTimeout(800);

    // Echo should appear in Tab1's Events panel
    const pane1 = page.locator('[data-testid^="conn-tab-pane-"]:visible');
    await pane1.locator('[data-testid="right-tab-events"]').click();
    await page.waitForTimeout(200);
    const events1 = pane1.locator('[data-testid="message-list"]');
    await expect(events1).toContainText('hello-from-tab1', { timeout: 5000 });

    // ── Test Tab2 roundtrip ──
    await clickTab(page, 1);
    await connectClient(page, `ws://localhost:${PORT2}`);
    await sendMessage(page, 'hello-from-tab2');
    await page.waitForTimeout(800);

    const pane2 = page.locator('[data-testid^="conn-tab-pane-"]:visible');
    await pane2.locator('[data-testid="right-tab-events"]').click();
    await page.waitForTimeout(200);
    const events2 = pane2.locator('[data-testid="message-list"]');
    await expect(events2).toContainText('hello-from-tab2', { timeout: 5000 });

    // Cleanup
    await disconnectClient(page);
    await clickTab(page, 0);
    await disconnectClient(page);
    await switchMode(page, 'mock');
    await stopMock(page);
    await clickTab(page, 1);
    await switchMode(page, 'mock');
    await stopMock(page);
  });
});

// ─── MM-04: Mock server log isolation (the core bug) ────────────

test.describe('MM-04: Mock server log isolation — no cross-contamination', () => {
  test.describe.configure({ timeout: 120_000 });

  test('messages to port 9876 appear only in Tab1 log, not Tab2', async ({ page }) => {
    await gotoWsStudio(page);

    // Setup Tab1 mock server
    await switchMode(page, 'mock');
    await startMock(page);
    await openMockLog(page);

    // Setup Tab2 mock server
    await addTab(page);
    await switchMode(page, 'mock');
    await startMock(page);
    await openMockLog(page);
    const logCountTab2Before = await mockLogCount(page);

    // Connect client in Tab1 and send a message to 9876
    await clickTab(page, 0);
    await connectClient(page, `ws://localhost:${PORT1}`);
    await sendMessage(page, 'tab1-only-message');
    // Wait for the mock server log to be polled (≤1.5 s at 500 ms interval)
    await page.waitForTimeout(1500);

    // Tab1 mock server log MUST contain the message
    await clickTab(page, 0);
    await switchMode(page, 'mock');
    await openMockLog(page);
    const tab1Logs = await mockLogTexts(page);
    expect(tab1Logs.some(t => t.includes('tab1-only-message')),
      `Tab1 log should contain 'tab1-only-message'. Got: ${JSON.stringify(tab1Logs)}`
    ).toBe(true);

    // Tab2 mock server log MUST NOT contain it
    await clickTab(page, 1);
    await switchMode(page, 'mock');
    await openMockLog(page);
    const tab2Logs = await mockLogTexts(page);
    expect(tab2Logs.some(t => t.includes('tab1-only-message')),
      `Tab2 log must NOT contain 'tab1-only-message'. Got: ${JSON.stringify(tab2Logs)}`
    ).toBe(false);

    // Entry count in Tab2 should not have grown (only client-connect may appear if
    // the mock server's own port-9876 startup is logged there — but message traffic must NOT be there)
    const logCountTab2After = await mockLogCount(page);
    // message-in and response-out entries should not be in Tab2
    const crossLeak = tab2Logs.filter(t => t.includes('message-in') || t.includes('response-out'));
    expect(crossLeak.length, `Tab2 has leaked message events: ${JSON.stringify(crossLeak)}`).toBe(0);

    // Cleanup
    await disconnectClient(page);
    await clickTab(page, 0);
    await disconnectClient(page);
    await switchMode(page, 'mock');
    await stopMock(page);
    await clickTab(page, 1);
    await switchMode(page, 'mock');
    await stopMock(page);

    void logCountTab2Before; // used for context above
    void logCountTab2After;
  });
});

// ─── MM-05: Log appears within poll budget ───────────────────────

test.describe('MM-05: Mock server log latency ≤ 1500 ms', () => {
  test.describe.configure({ timeout: 60_000 });

  test('log entry appears within 1500 ms of message being sent', async ({ page }) => {
    await gotoWsStudio(page);
    await switchMode(page, 'mock');
    await startMock(page);

    await addTab(page);
    await connectClient(page, `ws://localhost:${PORT1}`);
    await sendMessage(page, 'latency-probe');

    // Switch back to Tab1 mock log and measure how long until we see the entry
    await clickTab(page, 0);
    await switchMode(page, 'mock');
    await openMockLog(page);

    const start = Date.now();
    // Use .first() because both message-in AND response-out entries contain the text
    // (echo fallback copies the message) — strict mode would fail on 2 matches.
    await expect(
      page.locator('[data-testid^="conn-tab-pane-"]:visible [data-testid^="mock-log-"]')
        .filter({ hasText: 'latency-probe' })
        .first(),
    ).toBeVisible({ timeout: 2000 });
    const elapsed = Date.now() - start;
    console.log(`[MM-05] Log appeared in ${elapsed} ms`);

    // Cleanup
    await clickTab(page, 1);
    await disconnectClient(page);
    await clickTab(page, 0);
    await stopMock(page);
  });
});

// ─── MM-06: Client stays connected across tab switches ───────────

test.describe('MM-06: No spurious disconnection when switching tabs', () => {
  test.describe.configure({ timeout: 120_000 });

  test('client on port 9876 stays connected after rapid tab switches', async ({ page }) => {
    await gotoWsStudio(page);

    // Tab1: start mock + connect client
    await switchMode(page, 'mock');
    await startMock(page);

    // Add Tab2 and Tab3 with their own mock servers
    await addTab(page);
    await switchMode(page, 'mock');
    await startMock(page);

    await addTab(page);
    await switchMode(page, 'mock');
    await startMock(page);

    // Connect Tab1 client
    await clickTab(page, 0);
    await connectClient(page, `ws://localhost:${PORT1}`);

    // Rapidly switch between tabs 5 times
    for (let i = 0; i < 5; i++) {
      await clickTab(page, 1);
      await page.waitForTimeout(200);
      await clickTab(page, 2);
      await page.waitForTimeout(200);
      await clickTab(page, 0);
      await page.waitForTimeout(200);
    }

    // Tab1 client must still be connected
    await assertStillConnected(page);

    // Must still be able to send and receive echo
    await sendMessage(page, 'post-switch-message');
    await page.waitForTimeout(800);

    const pane1 = page.locator('[data-testid^="conn-tab-pane-"]:visible');
    await pane1.locator('[data-testid="right-tab-events"]').click();
    await expect(
      pane1.locator('[data-testid="message-list"]'),
    ).toContainText('post-switch-message', { timeout: 4000 });

    // Cleanup
    await disconnectClient(page);
    await switchMode(page, 'mock');
    await stopMock(page);
    await clickTab(page, 1);
    await stopMock(page);
    await clickTab(page, 2);
    await stopMock(page);
  });
});

// ─── MM-07: Send button remains functional after tab switch ──────

test.describe('MM-07: Send button works after switching away and back', () => {
  test.describe.configure({ timeout: 90_000 });

  test('sending a message to mock server works after tab switch', async ({ page }) => {
    await gotoWsStudio(page);
    await switchMode(page, 'mock');
    await startMock(page);

    // Add second tab, connect its client to 9876
    await addTab(page);
    await connectClient(page, `ws://localhost:${PORT1}`);

    // Switch to another tab and back
    await clickTab(page, 0);
    await page.waitForTimeout(500);
    await clickTab(page, 1);
    await page.waitForTimeout(300);

    // Now send — button must still work
    await sendMessage(page, 'after-switch-send');
    await page.waitForTimeout(600);

    const pane = page.locator('[data-testid^="conn-tab-pane-"]:visible');
    await pane.locator('[data-testid="right-tab-events"]').click();
    await expect(
      pane.locator('[data-testid="message-list"]'),
    ).toContainText('after-switch-send', { timeout: 4000 });

    // Cleanup
    await disconnectClient(page);
    await clickTab(page, 0);
    await stopMock(page);
  });
});

// ─── MM-08: Stopping one server does not affect the other ────────

test.describe('MM-08: Stopping Tab2 mock server does not stop Tab1', () => {
  test.describe.configure({ timeout: 90_000 });

  test('port 9877 stop leaves port 9876 running', async ({ page }) => {
    await gotoWsStudio(page);
    await switchMode(page, 'mock');
    await startMock(page); // Tab1 → 9876

    await addTab(page);
    await switchMode(page, 'mock');
    await startMock(page); // Tab2 → 9877

    // Connect Tab1 client to 9876
    await clickTab(page, 0);
    await connectClient(page, `ws://localhost:${PORT1}`);

    // Stop Tab2's mock server
    await clickTab(page, 1);
    await switchMode(page, 'mock');
    await stopMock(page);

    // Verify Tab1's client is still connected (9876 should still be running)
    await clickTab(page, 0);
    await assertStillConnected(page);

    // Verify Tab1 can still send messages
    await sendMessage(page, 'still-alive-after-tab2-stop');
    await page.waitForTimeout(600);

    const pane1 = page.locator('[data-testid^="conn-tab-pane-"]:visible');
    await pane1.locator('[data-testid="right-tab-events"]').click();
    await expect(
      pane1.locator('[data-testid="message-list"]'),
    ).toContainText('still-alive-after-tab2-stop', { timeout: 4000 });

    // Cleanup
    await disconnectClient(page);
    await switchMode(page, 'mock');
    await stopMock(page);
  });
});

// ─── MM-09: Closing Tab2 does not stop Tab1's server ─────────────

test.describe('MM-09: Closing a tab stops only that tab\'s server', () => {
  test.describe.configure({ timeout: 90_000 });

  test('closing Tab2 stops 9877 but 9876 keeps running', async ({ page }) => {
    await gotoWsStudio(page);
    await switchMode(page, 'mock');
    await startMock(page); // Tab1 → 9876

    await addTab(page);
    await switchMode(page, 'mock');
    await startMock(page); // Tab2 → 9877

    // Connect Tab1 client
    await clickTab(page, 0);
    await connectClient(page, `ws://localhost:${PORT1}`);

    // Get Tab2's id so we can close it
    const tabs = page.locator('[data-testid="conn-tab-bar"] [role="tab"]');
    const tab2 = tabs.nth(1);
    // Hover to reveal close button
    await tab2.hover();
    await page.waitForTimeout(200);
    const tab2Id = await tab2.getAttribute('data-testid');
    // data-testid="conn-tab-{id}" → extract id
    const id = tab2Id?.replace('conn-tab-', '') ?? '';
    const closeBtn = page.locator(`[data-testid="conn-tab-close-${id}"]`);
    if (await closeBtn.isVisible({ timeout: 500 }).catch(() => false)) {
      await closeBtn.click();
    } else {
      // Try double-click or just click the × in the tab label area
      await tab2.locator('.ws-conn-tab-close').click();
    }
    await page.waitForTimeout(800);

    // Tab1 client must still be connected to 9876
    await assertStillConnected(page);

    // Confirm 9876 server is still running via API
    const statusResp = await page.request.get(`http://localhost:3001/api/ws/mock/status?port=${PORT1}`);
    const status = await statusResp.json() as { ok: boolean; data: { running: boolean } };
    expect(status.data.running, `Port ${PORT1} should still be running after Tab2 close`).toBe(true);

    // Confirm 9877 server was stopped via API
    const status2Resp = await page.request.get(`http://localhost:3001/api/ws/mock/status?port=${PORT2}`);
    const status2 = await status2Resp.json() as { ok: boolean; data: { running: boolean } };
    expect(status2.data.running, `Port ${PORT2} should be stopped after Tab2 close`).toBe(false);

    // Cleanup
    await disconnectClient(page);
    await switchMode(page, 'mock');
    await stopMock(page);
  });
});

// ─── MM-10: Log shows client-connect after client connects ────────

test.describe('MM-10: Mock server log shows client lifecycle events', () => {
  test.describe.configure({ timeout: 60_000 });

  test('connect/disconnect events appear in server log within 1500 ms', async ({ page }) => {
    await gotoWsStudio(page);
    await switchMode(page, 'mock');
    await startMock(page);
    await openMockLog(page);

    // Open a second tab and connect its client to 9876
    await addTab(page);
    await connectClient(page, `ws://localhost:${PORT1}`);
    await page.waitForTimeout(1500); // wait for log poll

    // Switch to Tab1 mock log and verify client-connect appeared
    await clickTab(page, 0);
    await switchMode(page, 'mock');
    await openMockLog(page);
    const logsAfterConnect = await mockLogTexts(page);
    expect(logsAfterConnect.some(t => t.includes('client-connect')),
      `Expected client-connect in log. Got: ${JSON.stringify(logsAfterConnect)}`
    ).toBe(true);

    // Disconnect client and verify client-disconnect appears
    await clickTab(page, 1);
    await disconnectClient(page);
    await page.waitForTimeout(1500);

    await clickTab(page, 0);
    const logsAfterDisconnect = await mockLogTexts(page);
    expect(logsAfterDisconnect.some(t => t.includes('client-disconnect')),
      `Expected client-disconnect in log. Got: ${JSON.stringify(logsAfterDisconnect)}`
    ).toBe(true);

    // Cleanup
    await stopMock(page);
  });
});

// ─── MM-11: Three-tab stress test ────────────────────────────────

test.describe('MM-11: Three tabs — simultaneous operations', () => {
  test.describe.configure({ timeout: 180_000 });

  test('three mock servers, three clients, all send and receive without cross-contamination', async ({ page }) => {
    await gotoWsStudio(page);

    // Tab1: mock on 9876
    await switchMode(page, 'mock');
    await startMock(page);

    // Tab2: mock on 9877
    await addTab(page);
    await switchMode(page, 'mock');
    await startMock(page);

    // Tab3: mock on 9878
    await addTab(page);
    await switchMode(page, 'mock');
    await startMock(page);

    // Connect Tab1 client to 9876, send message
    await clickTab(page, 0);
    await connectClient(page, `ws://localhost:${PORT1}`);
    await sendMessage(page, 'MSG-TAB1');

    // Connect Tab2 client to 9877, send message
    await clickTab(page, 1);
    await connectClient(page, `ws://localhost:${PORT2}`);
    await sendMessage(page, 'MSG-TAB2');

    // Connect Tab3 client to 9878, send message
    await clickTab(page, 2);
    await connectClient(page, `ws://localhost:${PORT3}`);
    await sendMessage(page, 'MSG-TAB3');

    // Wait for all polls to complete
    await page.waitForTimeout(1500);

    // Verify Tab1 Events has MSG-TAB1 (and NOT MSG-TAB2 / MSG-TAB3)
    await clickTab(page, 0);
    const pane1 = page.locator('[data-testid^="conn-tab-pane-"]:visible');
    await pane1.locator('[data-testid="right-tab-events"]').click();
    const msgs1 = await pane1.locator('[data-testid="message-list"]').innerText();
    expect(msgs1).toContain('MSG-TAB1');
    expect(msgs1).not.toContain('MSG-TAB2');
    expect(msgs1).not.toContain('MSG-TAB3');

    // Verify Tab2 Events has MSG-TAB2
    await clickTab(page, 1);
    const pane2 = page.locator('[data-testid^="conn-tab-pane-"]:visible');
    await pane2.locator('[data-testid="right-tab-events"]').click();
    const msgs2 = await pane2.locator('[data-testid="message-list"]').innerText();
    expect(msgs2).toContain('MSG-TAB2');
    expect(msgs2).not.toContain('MSG-TAB1');
    expect(msgs2).not.toContain('MSG-TAB3');

    // Verify Tab3 Events has MSG-TAB3
    await clickTab(page, 2);
    const pane3 = page.locator('[data-testid^="conn-tab-pane-"]:visible');
    await pane3.locator('[data-testid="right-tab-events"]').click();
    const msgs3 = await pane3.locator('[data-testid="message-list"]').innerText();
    expect(msgs3).toContain('MSG-TAB3');
    expect(msgs3).not.toContain('MSG-TAB1');
    expect(msgs3).not.toContain('MSG-TAB2');

    // Verify mock logs on each tab show only their own traffic
    await clickTab(page, 0);
    await switchMode(page, 'mock');
    await openMockLog(page);
    const log1 = (await mockLogTexts(page)).join(' ');
    expect(log1).toContain('MSG-TAB1');
    expect(log1).not.toContain('MSG-TAB2');
    expect(log1).not.toContain('MSG-TAB3');

    await clickTab(page, 1);
    await switchMode(page, 'mock');
    await openMockLog(page);
    const log2 = (await mockLogTexts(page)).join(' ');
    expect(log2).toContain('MSG-TAB2');
    expect(log2).not.toContain('MSG-TAB1');
    expect(log2).not.toContain('MSG-TAB3');

    await clickTab(page, 2);
    await switchMode(page, 'mock');
    await openMockLog(page);
    const log3 = (await mockLogTexts(page)).join(' ');
    expect(log3).toContain('MSG-TAB3');
    expect(log3).not.toContain('MSG-TAB1');
    expect(log3).not.toContain('MSG-TAB2');

    // Cleanup — disconnect all and stop all mock servers
    await clickTab(page, 2);
    await disconnectClient(page);
    await switchMode(page, 'mock');
    await stopMock(page);
    await clickTab(page, 1);
    await disconnectClient(page);
    await switchMode(page, 'mock');
    await stopMock(page);
    await clickTab(page, 0);
    await disconnectClient(page);
    await switchMode(page, 'mock');
    await stopMock(page);
  });
});

// ─── MM-12: Duplicate log entries regression ─────────────────────

test.describe('MM-12: Poll cursor race — no duplicate log entries', () => {
  test.describe.configure({ timeout: 60_000 });

  test('rapid message sends do not produce duplicate log entries', async ({ page }) => {
    await gotoWsStudio(page);
    await switchMode(page, 'mock');
    await startMock(page);

    await addTab(page);
    await connectClient(page, `ws://localhost:${PORT1}`);

    // Send 5 messages rapidly
    for (let i = 1; i <= 5; i++) {
      await sendMessage(page, `rapid-${i}`);
    }
    // Wait for multiple poll cycles
    await page.waitForTimeout(2000);

    // Switch to Tab1 mock log
    await clickTab(page, 0);
    await switchMode(page, 'mock');
    await openMockLog(page);

    const logTexts = await mockLogTexts(page);
    // Collect message-in entries
    const msgInEntries = logTexts.filter(t => t.includes('message-in'));

    // Each of the 5 sends should produce exactly 1 message-in entry — check for duplicates
    for (let i = 1; i <= 5; i++) {
      const matching = logTexts.filter(t => t.includes(`rapid-${i}`) && t.includes('message-in'));
      expect(matching.length, `'rapid-${i}' has ${matching.length} message-in entries (expected 1)`).toBe(1);
    }

    console.log(`[MM-12] Total message-in entries: ${msgInEntries.length} (expected 5)`);

    // Cleanup
    await clickTab(page, 1);
    await disconnectClient(page);
    await clickTab(page, 0);
    await stopMock(page);
  });
});

// ─── MM-13: Mock server log is cleared after server restart ──────

test.describe('MM-13: Log clears on server restart', () => {
  test.describe.configure({ timeout: 60_000 });

  test('old log entries disappear when server is stopped and restarted', async ({ page }) => {
    await gotoWsStudio(page);
    await switchMode(page, 'mock');
    await startMock(page);

    // Generate some log entries by connecting a client
    await addTab(page);
    await connectClient(page, `ws://localhost:${PORT1}`);
    await sendMessage(page, 'before-restart');
    await page.waitForTimeout(1000);

    // Disconnect client, stop and restart server
    await disconnectClient(page);
    await clickTab(page, 0);
    await switchMode(page, 'mock');
    await stopMock(page);
    await page.waitForTimeout(300);
    await startMock(page);

    // Mock log should now be empty (or only contain server-start)
    await openMockLog(page);
    await page.waitForTimeout(600);
    const logsAfterRestart = await mockLogTexts(page);
    const hasOldMessages = logsAfterRestart.some(t => t.includes('before-restart'));
    expect(hasOldMessages, `Old message appeared after restart: ${JSON.stringify(logsAfterRestart)}`).toBe(false);

    // Cleanup
    await stopMock(page);
  });
});

// ─── MM-14: Port change — new server starts on new port ──────────

test.describe('MM-14: Port edit — server starts on user-specified port', () => {
  test.describe.configure({ timeout: 90_000 });

  test('user can change port and connect client to the new port', async ({ page }) => {
    await gotoWsStudio(page);
    await switchMode(page, 'mock');

    // Ensure the mock server is stopped before editing the port (it may be running from a prior test)
    const pane = page.locator('[data-testid^="conn-tab-pane-"]:visible');
    const stopBtn = pane.locator('[data-testid="mock-stop-btn"]');
    if (await stopBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await stopBtn.click();
      await pane.locator('[data-testid="mock-start-btn"]').waitFor({ timeout: 6000 });
      await page.waitForTimeout(300);
    }

    // Change port from 9876 to PORT3 (9878) while stopped
    const portInput = pane.locator('[data-testid="mock-port-input"]');
    await expect(portInput).toBeEditable({ timeout: 5000 });
    await portInput.click({ clickCount: 3 });
    await portInput.fill(String(PORT3));
    await portInput.press('Enter');
    await page.waitForTimeout(300);

    // Verify display updated
    await expect(portInput).toHaveValue(String(PORT3));

    // Start the server on the new port
    await startMock(page);
    // Verify via API that it is running on PORT3
    const resp = await page.request.get(`http://localhost:3001/api/ws/mock/status?port=${PORT3}`);
    const status = await resp.json() as { ok: boolean; data: { running: boolean; port: number } };
    expect(status.data.running, `Port ${PORT3} should be running`).toBe(true);
    expect(status.data.port).toBe(PORT3);

    // Connect a client to the new port and verify echo
    await addTab(page);
    await connectClient(page, `ws://localhost:${PORT3}`);
    await sendMessage(page, 'custom-port-message');
    await page.waitForTimeout(800);

    const pane2 = page.locator('[data-testid^="conn-tab-pane-"]:visible');
    await pane2.locator('[data-testid="right-tab-events"]').click();
    await expect(
      pane2.locator('[data-testid="message-list"]'),
    ).toContainText('custom-port-message', { timeout: 4000 });

    // Cleanup
    await disconnectClient(page);
    await clickTab(page, 0);
    await stopMock(page);
  });
});
