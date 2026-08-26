import { chromium, expect, test } from '@playwright/test';
import {
  finishDemoStep,
  openDemoHub,
  runNextStep,
  startLesson,
} from './demo-player-helpers';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
/** Step 2–3 include live jsonplaceholder fetches — allow extra headroom beyond default 60s. */
const STEP_TIMEOUT_MS = 120_000;

test('TH-18 completes at step 6 in native Google Chrome', async () => {
  test.setTimeout(480_000);

  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: false,
  });

  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await openDemoHub(page);

    const identity = await page.evaluate(() => ({
      userAgent: navigator.userAgent,
      vendor: navigator.vendor,
    }));
    expect(identity.vendor).toBe('Google Inc.');
    expect(identity.userAgent).toContain('Chrome/');
    expect(identity.userAgent).not.toContain('Electron/');

    await page.locator('.demo-domain-card').filter({ hasText: 'Test Harness' }).click();
    await page.locator('.demo-category-tab').filter({ hasText: 'Data-Driven Testing' }).click();
    await page
      .locator('.demo-lesson-item')
      .filter({ hasText: 'Data Source Advanced Features' })
      .click();
    await startLesson(page);

    for (let completedStep = 1; completedStep < 6; completedStep += 1) {
      console.log(`\n=== Running step ${completedStep} ===`);
      await runNextStep(page, STEP_TIMEOUT_MS);
      console.log(`✓ Step ${completedStep} complete`);
    }

    console.log('\n=== Step counter check ===');
    await expect(page.locator('.demo-live-step-counter')).toHaveText(/6\s*\/\s*6/);
    console.log('✓ Counter shows 6 / 6');

    console.log('\n=== Finishing step 6 ===');
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await finishDemoStep(page, STEP_TIMEOUT_MS);
    console.log(`✓ Step 6 action finished. Console errors: ${errors.length}`);
    if (errors.length > 0) {
      console.log('Errors:', errors.slice(0, 3).join(' | '));
    }

    const livePanel = page.locator('[data-testid="demo-live-panel"]');
    await expect(livePanel).toBeVisible();
    await expect(livePanel).toHaveAttribute('data-step-phase', 'done');
    await expect(livePanel).toContainText('Map Columns & Row Modes');
    await expect(page.locator('[aria-label="Complete lesson"]')).toBeVisible();

    const panelBox = await livePanel.boundingBox();
    expect(panelBox?.width ?? 0).toBeGreaterThanOrEqual(400);
    expect(panelBox?.height ?? 0).toBeGreaterThan(200);
  } finally {
    await browser.close();
  }
});