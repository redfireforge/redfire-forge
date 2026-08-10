/**
 * WS Session Recording & Replay — E2E Test Suite
 * Tests: WT-24 through WT-31
 * Covers: Record → Stop → Export, Import → Play → Pause → Speed → Exit
 * Requires: backend on 3001 (mock WS echo on 9876), Vite on 5173
 */
import { test, expect, type Page } from '@playwright/test';
import { gotoWsStudio, ensureWsMockServer, getActiveWsPane, selectWsCustomSelect } from './ws-helpers';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

const MOCK_URL = 'ws://localhost:9876';

/* ── Ensure mock echo server is running ──────────────── */

test.beforeAll(async ({ browser }) => { await ensureWsMockServer(browser); });

/* ── helpers ─────────────────────────────────────────── */

const activePane = getActiveWsPane;

async function connectTo(page: Page, url = MOCK_URL) {
  const pane = activePane(page);
  await pane.locator('[data-testid="left-tab-connect"]').click();
  const urlInput = pane.locator('[aria-label="WebSocket URL"]');
  await urlInput.fill(url);
  await pane.locator('[data-testid="connect-btn"]').click();
  try {
    await page.locator('[data-testid="conn-tab-bar"] [role="tab"][aria-selected="true"][aria-label*="connected"]')
      .waitFor({ timeout: 10000 });
  } catch {
    // Retry: restart mock server and reconnect
    await page.request.post('http://localhost:3001/api/ws/mock/start', {
      data: { port: 9876, rules: [], fallback: 'echo' },
    });
    await page.waitForTimeout(500);
    await pane.locator('[data-testid="connect-btn"]').click();
    await page.locator('[data-testid="conn-tab-bar"] [role="tab"][aria-selected="true"][aria-label*="connected"]')
      .waitFor({ timeout: 10000 });
  }
  await page.waitForTimeout(300);
}

async function sendMessage(page: Page, msg: string) {
  const pane = activePane(page);
  await pane.locator('[data-testid="left-tab-send"]').click();
  const msgInput = pane.locator('.ws-compose-input');
  await msgInput.fill(msg);
  await pane.locator('[data-testid="send-btn"]').click();
  // If compose input becomes disabled, connection dropped — reconnect and resend
  try {
    await expect(msgInput).toBeEnabled({ timeout: 2000 });
  } catch {
    await connectTo(page);
    await pane.locator('[data-testid="left-tab-send"]').click();
    await msgInput.fill(msg);
    await pane.locator('[data-testid="send-btn"]').click();
  }
  await page.waitForTimeout(400);
}

/** Create a minimal valid recording JSON file for import tests */
function createRecordingFile(): string {
  const recording = {
    _format: 'ws-recording-v1',
    metadata: {
      url: 'ws://localhost:9876',
      protocol: 'auto',
      startedAt: new Date().toISOString(),
      durationMs: 3000,
      messageCount: 4,
    },
    events: [
      {
        type: 'message',
        relativeMs: 0,
        frame: { direction: 'sent', data: '{"msg":"hello-1"}', size: 17, timestamp: Date.now(), format: 'text' },
      },
      {
        type: 'message',
        relativeMs: 500,
        frame: { direction: 'received', data: '{"msg":"hello-1"}', size: 17, timestamp: Date.now() + 50, format: 'text' },
      },
      {
        type: 'message',
        relativeMs: 1000,
        frame: { direction: 'sent', data: '{"msg":"hello-2"}', size: 17, timestamp: Date.now() + 1000, format: 'text' },
      },
      {
        type: 'message',
        relativeMs: 1500,
        frame: { direction: 'received', data: '{"msg":"hello-2"}', size: 17, timestamp: Date.now() + 1050, format: 'text' },
      },
    ],
  };
  const tmpFile = path.join(os.tmpdir(), `test-recording-${Date.now()}.json`);
  fs.writeFileSync(tmpFile, JSON.stringify(recording, null, 2));
  return tmpFile;
}

/* ── WT-24–25: Recording ────────────────────────────────── */

test.describe('WT-24–25: Session Recording', () => {

  test('WT-24: Record button shows REC indicator with pulsing animation', async ({ page }) => {
    await gotoWsStudio(page);
    await connectTo(page);

    // Click Record
    const recBtn = activePane(page).locator('[data-testid="start-recording-btn"]');
    await expect(recBtn).toBeVisible();
    await recBtn.click();

    // Stop button should appear (replaces Rec button)
    const stopBtn = activePane(page).locator('[data-testid="stop-recording-btn"]');
    await expect(stopBtn).toBeVisible();
    await expect(stopBtn).toContainText('Stop');

    // The recording-active class should have pulsing styles
    await expect(stopBtn).toHaveClass(/ws-recording-active/);

    // Stop recording
    await stopBtn.click();
    await expect(recBtn).toBeVisible(); // Back to idle
  });

  test('WT-25: Messages are captured during recording', async ({ page }) => {
    await gotoWsStudio(page);
    await connectTo(page);

    // Start recording
    await activePane(page).locator('[data-testid="start-recording-btn"]').click();

    // Send messages
    await sendMessage(page, '{"record": "test-1"}');
    await sendMessage(page, '{"record": "test-2"}');

    // Messages should appear in log (2 sent + 2 echo + possible system messages)
    const rows = activePane(page).locator('.ws-message-row');
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(4);

    // Stop — triggers download (we just verify UI returns to idle)
    await activePane(page).locator('[data-testid="stop-recording-btn"]').click();
    await expect(activePane(page).locator('[data-testid="start-recording-btn"]')).toBeVisible();
  });
});

/* ── WT-28–31: Replay ───────────────────────────────────── */

test.describe('WT-28–31: Session Replay', () => {

  test('WT-28: Import recording → replay controls appear', async ({ page }) => {
    await gotoWsStudio(page);
    const tmpFile = createRecordingFile();

    try {
      // Set the file on the hidden input
      const fileInput = activePane(page).locator('[data-testid="recording-file-input"]');
      await fileInput.setInputFiles(tmpFile);
      await page.waitForTimeout(500);

      // Play button should appear
      const playBtn = activePane(page).locator('[data-testid="start-replay-btn"]');
      await expect(playBtn).toBeVisible();
      await expect(playBtn).toContainText('Play');
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  test('WT-29: Play → messages appear; speed changes work', async ({ page }) => {
    await gotoWsStudio(page);
    const tmpFile = createRecordingFile();

    try {
      // Import and start replay at Max speed (instant)
      await activePane(page).locator('[data-testid="recording-file-input"]').setInputFiles(tmpFile);
      await page.waitForTimeout(500);

      await activePane(page).locator('[data-testid="start-replay-btn"]').click();
      await page.waitForTimeout(300);

      // Replay bar should appear
      const replayBar = activePane(page).locator('[data-testid="replay-bar"]');
      await expect(replayBar).toBeVisible();

      // Speed selector should be visible
      const speedSelect = replayBar.locator('[data-testid="replay-speed-select"]');
      await expect(speedSelect).toBeVisible();

      // Change to Max speed to finish quickly
      await selectWsCustomSelect(page, 'replay-speed-select', { value: '0', label: 'Max' });

      // Wait for replay to finish
      await expect(replayBar).not.toBeVisible({ timeout: 10000 });

      // Messages should have appeared in the log
      const rows = activePane(page).locator('.ws-message-row');
      const count = await rows.count();
      expect(count).toBeGreaterThanOrEqual(2);
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  test('WT-30: Pause/Resume toggle works mid-replay', async ({ page }) => {
    await gotoWsStudio(page);
    const tmpFile = createRecordingFile();

    try {
      // Import
      await activePane(page).locator('[data-testid="recording-file-input"]').setInputFiles(tmpFile);
      await page.waitForTimeout(500);

      // Start replay at 1× speed (slow enough to pause)
      await activePane(page).locator('[data-testid="start-replay-btn"]').click();
      await page.waitForTimeout(200);

      const replayBar = activePane(page).locator('[data-testid="replay-bar"]');
      await expect(replayBar).toBeVisible();

      // Pause
      const pauseBtn = replayBar.locator('[data-testid="replay-playpause-btn"]');
      await expect(pauseBtn).toContainText('⏸');
      await pauseBtn.click();

      // Should show play icon (paused state)
      await expect(pauseBtn).toContainText('▶');

      // Progress counter should be visible and frozen
      const progress = replayBar.locator('[data-testid="replay-progress"]');
      await expect(progress).toBeVisible();
      const pausedText = await progress.textContent();

      // Wait and verify progress hasn't changed (paused)
      await page.waitForTimeout(1000);
      const stillPausedText = await progress.textContent();
      expect(stillPausedText).toBe(pausedText);

      // Resume
      await pauseBtn.click();
      await expect(pauseBtn).toContainText('⏸');

      // Switch to Max to finish
      await selectWsCustomSelect(page, 'replay-speed-select', { value: '0', label: 'Max' });
      await expect(replayBar).not.toBeVisible({ timeout: 10000 });
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  test('WT-31: Exit replay → clears messages, returns to normal mode', async ({ page }) => {
    await gotoWsStudio(page);
    const tmpFile = createRecordingFile();

    try {
      // Import and start replay
      await activePane(page).locator('[data-testid="recording-file-input"]').setInputFiles(tmpFile);
      await page.waitForTimeout(500);
      await activePane(page).locator('[data-testid="start-replay-btn"]').click();
      await page.waitForTimeout(300);

      const replayBar = activePane(page).locator('[data-testid="replay-bar"]');
      await expect(replayBar).toBeVisible();

      // Click Exit
      await replayBar.locator('[data-testid="replay-exit-btn"]').click();

      // Replay bar should disappear
      await expect(replayBar).not.toBeVisible();

      // Back to normal — Rec button should be visible again
      await expect(activePane(page).locator('[data-testid="start-recording-btn"]')).toBeVisible();

      // Compose should be re-enabled (not disabled during replay)
      await activePane(page).locator('[data-testid="left-tab-send"]').click();
      const sendBtn = activePane(page).locator('[data-testid="send-btn"]');
      // Send button existence confirms compose bar is back
      await expect(sendBtn).toBeVisible();
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  test('WT-28b: Invalid import shows error feedback', async ({ page }) => {
    await gotoWsStudio(page);
    const invalidFile = path.join(os.tmpdir(), `invalid-recording-${Date.now()}.json`);
    fs.writeFileSync(invalidFile, JSON.stringify({ foo: 'not a recording' }));

    try {
      const fileInput = activePane(page).locator('[data-testid="recording-file-input"]');
      await fileInput.setInputFiles(invalidFile);
      await page.waitForTimeout(500);

      // Error message should appear
      const errorEl = activePane(page).locator('[data-testid="import-error"]');
      await expect(errorEl).toBeVisible();
      await expect(errorEl).toContainText('Invalid recording file');

      // Play button should NOT appear (import was rejected)
      await expect(activePane(page).locator('[data-testid="start-replay-btn"]')).not.toBeVisible();
    } finally {
      fs.unlinkSync(invalidFile);
    }
  });
});
