/**
 * Visual audit for the "Tabs & Multi-Connection" ws-tabs demo lesson.
 * Screenshots every step at: read phase, after-action phase.
 */
import { test, expect, Page } from '@playwright/test';
import * as path from 'path';

const BASE = 'http://localhost:5173';
const OUT = '/tmp/ws-tabs-audit';

async function shot(page: Page, name: string) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
}

async function openDemoHub(page: Page) {
  await page.goto(BASE);
  await page.waitForLoadState('networkidle');
  // Click the Demo Hub activity bar icon
  const demoHubBtn = page.locator('[data-testid="nav-demo-hub"]');
  if (await demoHubBtn.count() > 0) {
    await demoHubBtn.click();
  } else {
    // Try sidebar link
    await page.click('text=Demo Hub');
  }
  await page.waitForTimeout(500);
}

async function startWsTabsLesson(page: Page) {
  // Navigate to WebSocket domain
  const wsCard = page.locator('text=WebSocket').first();
  await wsCard.click();
  await page.waitForTimeout(400);

  // Find and click the Tabs & Multi-Connection lesson
  const lessonCard = page.locator('text=Tabs & Multi-Connection').first();
  await lessonCard.click();
  await page.waitForTimeout(400);

  // Click Start Demo
  const startBtn = page.locator('button:has-text("Start Demo")').first();
  await startBtn.click();
  await page.waitForTimeout(1500);
}

async function _waitForStep(page: Page, stepNum: number, timeout = 8000) {
  await page.waitForSelector(`text=${stepNum}/9`, { timeout });
}

async function _clickPlay(page: Page) {
  // Click the play (►) button in the demo player
  const playBtn = page.locator('.demo-ctrl-btn').filter({ hasText: '►' }).first();
  if (await playBtn.count() > 0) {
    await playBtn.click();
  }
}

async function clickSkip(page: Page) {
  // Click "Reading — click to skip" to skip the reading phase
  const skipText = page.locator('text=Reading').first();
  if (await skipText.count() > 0) {
    await skipText.click();
  }
}

async function waitForReadingPhase(page: Page, timeout = 15000) {
  await page.waitForSelector('text=Reading', { timeout });
}

async function _waitForPausedPhase(page: Page, timeout = 20000) {
  // After action completes + pauseAfter, it shows a pause indicator or "next" is available
  await page.waitForSelector('text=Reading', { timeout }).catch(() => {});
}

async function _clickNext(page: Page) {
  const nextBtn = page.locator('button:has-text("Next")').first();
  if (await nextBtn.count() > 0 && await nextBtn.isEnabled()) {
    await nextBtn.click();
  }
}

test.describe('ws-tabs demo visual audit', () => {
  test.setTimeout(180000);

  test('audit all 9 steps', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 768 });
    await openDemoHub(page);
    await shot(page, '00-demo-hub-open');

    await startWsTabsLesson(page);
    await shot(page, '01-demo-started');

    // Step 1: tabs-intro (no action, just reading)
    await waitForReadingPhase(page, 10000);
    await shot(page, 'step1-reading');
    await clickSkip(page);
    await page.waitForTimeout(500);
    await shot(page, 'step1-after');

    // Step 2: tabs-add
    await waitForReadingPhase(page, 10000).catch(() => {});
    await page.waitForTimeout(300);
    await shot(page, 'step2-reading');
    await clickSkip(page);
    await page.waitForTimeout(3000); // action runs (click + + MODE_MOCK)
    await shot(page, 'step2-after-action');

    // Step 3: tabs-mock-start-tab2
    await waitForReadingPhase(page, 10000).catch(() => {});
    await page.waitForTimeout(300);
    await shot(page, 'step3-reading');
    await clickSkip(page);
    await page.waitForTimeout(5000); // action: start server
    await shot(page, 'step3-after-action');

    // Step 4: tabs-connect-tab1
    await waitForReadingPhase(page, 10000).catch(() => {});
    await page.waitForTimeout(300);
    await shot(page, 'step4-reading');
    await clickSkip(page);
    await page.waitForTimeout(5000);
    await shot(page, 'step4-after-action');

    // Step 5: tabs-connect-tab2
    await waitForReadingPhase(page, 10000).catch(() => {});
    await page.waitForTimeout(300);
    await shot(page, 'step5-reading');
    await clickSkip(page);
    await page.waitForTimeout(5000);
    await shot(page, 'step5-after-action');

    // Step 6: tabs-send-tab1
    await waitForReadingPhase(page, 10000).catch(() => {});
    await page.waitForTimeout(300);
    await shot(page, 'step6-reading');
    await clickSkip(page);
    await page.waitForTimeout(4000);
    await shot(page, 'step6-after-action');

    // Step 7: tabs-mock-log-tab1
    await waitForReadingPhase(page, 10000).catch(() => {});
    await page.waitForTimeout(300);
    await shot(page, 'step7-reading');
    await clickSkip(page);
    await page.waitForTimeout(3000);
    await shot(page, 'step7-after-action');

    // Step 8: tabs-send-tab2
    await waitForReadingPhase(page, 10000).catch(() => {});
    await page.waitForTimeout(300);
    await shot(page, 'step8-reading');
    await clickSkip(page);
    await page.waitForTimeout(5000);
    await shot(page, 'step8-after-action');

    // Step 9: tabs-close
    await waitForReadingPhase(page, 10000).catch(() => {});
    await page.waitForTimeout(300);
    await shot(page, 'step9-reading');
    await clickSkip(page);
    await page.waitForTimeout(4000);
    await shot(page, 'step9-after-action');

    console.log('Screenshots saved to', OUT);
    expect(true).toBe(true);
  });
});
