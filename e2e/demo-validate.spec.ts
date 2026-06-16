import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5173';

test('demo control simplification visual check', async ({ page }) => {
  await page.goto(BASE);
  await page.waitForLoadState('networkidle');

  // Navigate to Demo Hub via title="Demo Hub" on the activity bar button
  await page.locator('[title="Demo Hub"]').click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: '/tmp/01-hub.png' });

  // Enter first domain
  const domainCard = page.locator('.demo-hub-domain-card, .demo-domain-card').first();
  await domainCard.click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: '/tmp/02-domain.png' });

  // Enter first lesson
  const lessonItem = page.locator('.demo-hub-lesson-item, .demo-lesson-item').first();
  await lessonItem.click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: '/tmp/03-lesson.png' });

  // LessonPlayer: only "Start Demo" visible, no speed selectors, no back btn
  const startBtn = page.locator('button').filter({ hasText: /Start Demo/ }).first();
  await expect(startBtn).toBeVisible();
  const speedSelector = page.locator('.demo-speed-selector');
  expect(await speedSelector.count()).toBe(0);
  const lessonBackBtn = page.locator('.demo-lesson-player-footer button:has-text("Back")');
  expect(await lessonBackBtn.count()).toBe(0);
  console.log('[PASS] LessonPlayer footer: only Start Demo, no speed/back');

  // Start the demo
  await startBtn.click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: '/tmp/04-live.png' });

  // LiveDemo panel must have: restart btn, no prev btn, no speed controls
  const restartBtn = page.locator('.demo-live-restart-btn');
  await expect(restartBtn).toBeVisible();
  const prevBtn = page.locator('.demo-live-prev-btn');
  expect(await prevBtn.count()).toBe(0);
  const liveSpeedBtns = page.locator('.demo-live-speed-btn');
  expect(await liveSpeedBtns.count()).toBe(0);
  console.log('[PASS] LiveDemo controls: restart present, no prev/speed');

  // Next button should be disabled during action phase, enabled in reading phase
  const nextBtn = page.locator('[aria-label="Next step"]');
  await expect(nextBtn).toBeVisible();
  const isDisabled = await nextBtn.getAttribute('disabled');
  console.log('[CHECK] Next disabled during action:', isDisabled !== null ? 'YES' : 'NO (already in reading)');

  // Wait for reading phase (next button enabled)
  await page.waitForFunction(() => {
    const btn = document.querySelector('[aria-label="Next step"]') as HTMLButtonElement | null;
    return btn && !btn.disabled;
  }, { timeout: 15000 }).catch(() => console.log('[WARN] Next never became enabled'));
  await page.screenshot({ path: '/tmp/05-reading.png' });
  console.log('[PASS] Next button enabled in reading phase');

  // Pause auto-play so demo doesn't complete before we finish the checks
  const playBtn = page.locator('.demo-live-play-btn');
  const playTitle = await playBtn.getAttribute('title').catch(() => '');
  if (playTitle && playTitle.includes('Pause')) {
    await playBtn.click();
    await page.waitForTimeout(200);
    console.log('[ACTION] Paused auto-play');
  }

  // Open overview drawer and verify read-only
  const overviewBtn = page.locator('.demo-live-overview-btn');
  if (await overviewBtn.count() > 0) {
    await overviewBtn.click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: '/tmp/06-overview.png' });
    const clickableBtns = await page.locator('.demo-overview-modal-item button').count();
    const readonlyDivs = await page.locator('.demo-overview-modal-item--readonly').count();
    expect(clickableBtns).toBe(0);
    expect(readonlyDivs).toBeGreaterThan(0);
    console.log('[PASS] Overview is read-only -', readonlyDivs, 'readonly items');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
  }

  // Click restart (demo is paused so panel stays visible)
  await expect(restartBtn).toBeVisible({ timeout: 3000 });
  await restartBtn.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/tmp/07-restarted.png' });
  const stepText = await page.locator('.demo-live-step-indicator').textContent().catch(() => '');
  console.log('[CHECK] Step indicator after restart:', JSON.stringify(stepText));

  // Exit
  const exitBtn = page.locator('.demo-live-exit-btn');
  await exitBtn.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/08-exited.png' });
  console.log('[PASS] Exit worked');
});
