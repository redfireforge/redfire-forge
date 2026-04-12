#!/usr/bin/env node
/**
 * Capture step-by-step screenshots from the running RedfireForge web app.
 * Requires: npm install --save-dev playwright && npx playwright install chromium
 */

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const IMG_DIR = join(__dirname, '..', 'training-ppt', 'manual', 'images');
mkdirSync(IMG_DIR, { recursive: true });

const BASE = 'http://localhost:5173';
let stepNum = 0;

async function shot(page, name) {
  stepNum++;
  const padded = String(stepNum).padStart(2, '0');
  const filename = `${padded}-${name}.png`;
  const path = join(IMG_DIR, filename);
  await page.screenshot({ path });
  console.log(`  ✅ ${filename}`);
  return filename;
}

const delay = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
  console.log('🚀 Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 });

  try {
    // ────────────────────────────────────────────
    // 1. App Overview — Feature Groups tab (default)
    // ────────────────────────────────────────────
    console.log('\n📸 Section: App Overview');
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 });
    await delay(1500);
    await shot(page, 'app-overview');

    // ────────────────────────────────────────────
    // 2. Sidebar with environments
    // ────────────────────────────────────────────
    console.log('\n📸 Section: Sidebar');
    // Click different environment items if they exist
    const envButtons = page.locator('.sidebar .env-list button, .sidebar .env-item');
    const envCount = await envButtons.count();
    if (envCount > 1) {
      await envButtons.nth(1).click();
      await delay(800);
    }
    await shot(page, 'sidebar-env-selected');

    // Switch microservices tab if present
    const microTab = page.locator('button:has-text("Microservices")');
    if (await microTab.isVisible({ timeout: 1000 }).catch(() => false)) {
      await microTab.click();
      await delay(500);
      await shot(page, 'sidebar-microservices');
      // Switch back
      const envTab = page.locator('button:has-text("Environments")');
      if (await envTab.isVisible({ timeout: 500 }).catch(() => false)) {
        await envTab.click();
        await delay(300);
      }
    }

    // ────────────────────────────────────────────
    // 3. Expand All feature groups
    // ────────────────────────────────────────────
    console.log('\n📸 Section: Feature Groups');
    const expandAll = page.locator('button:has-text("Expand All")');
    if (await expandAll.isVisible({ timeout: 1000 }).catch(() => false)) {
      await expandAll.click();
      await delay(800);
    }
    await shot(page, 'feature-groups-expanded');

    // ────────────────────────────────────────────
    // 4. Click on a scenario header to expand it
    // ────────────────────────────────────────────
    const scenarioHeaders = page.locator('.scenario-header, [class*="scenario-head"], summary:has-text("Scenario"), details summary');
    const scCount = await scenarioHeaders.count();
    if (scCount > 0) {
      await scenarioHeaders.first().click();
      await delay(800);
      await shot(page, 'scenario-expanded');

      // Click on a test inside the scenario
      const testEntries = page.locator('.test-entry, .test-item, [class*="test-head"]');
      const testCount = await testEntries.count();
      if (testCount > 0) {
        await testEntries.first().click();
        await delay(800);
        await shot(page, 'test-editor');

        // Scroll down to see more of the test
        await page.evaluate(() => {
          const main = document.querySelector('.main-content, main, .content');
          if (main) main.scrollTop += 500;
          else window.scrollBy(0, 500);
        });
        await delay(500);
        await shot(page, 'test-editor-scroll');
      }
    }

    // ────────────────────────────────────────────
    // 5. Settings
    // ────────────────────────────────────────────
    console.log('\n📸 Section: Settings');
    // Scroll back to top
    await page.evaluate(() => {
      const main = document.querySelector('.main-content, main, .content');
      if (main) main.scrollTop = 0;
      else window.scrollTo(0, 0);
    });
    await delay(300);

    const settingsBtn = page.locator('button:has-text("Settings")');
    if (await settingsBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await settingsBtn.click();
      await delay(1000);
      await shot(page, 'settings-overview');

      // Scroll down in settings to see more
      await page.evaluate(() => {
        const modal = document.querySelector('.settings-modal, .modal-body, [class*="settings"]');
        if (modal) modal.scrollTop += 400;
      });
      await delay(500);
      await shot(page, 'settings-auth-section');

      // Scroll more to see Export/Import buttons
      await page.evaluate(() => {
        const modal = document.querySelector('.settings-modal, .modal-body, [class*="settings"]');
        if (modal) modal.scrollTop += 400;
      });
      await delay(500);
      await shot(page, 'settings-export-import');

      // Try Export Center - use force click if disabled
      const exportBtn = page.locator('button:has-text("Export Center"), button:has-text("Export")').first();
      if (await exportBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        const isDisabled = await exportBtn.isDisabled();
        if (!isDisabled) {
          await exportBtn.click();
          await delay(800);
          await shot(page, 'export-center');

          // Close export
          const closeExport = page.locator('.modal button:has-text("Close"), .modal button:has-text("×")').first();
          if (await closeExport.isVisible({ timeout: 500 }).catch(() => false)) {
            await closeExport.click();
            await delay(500);
          }
        }
      }

      // Try Import Center
      const importBtn = page.locator('button:has-text("Import Center"), button:has-text("Import")').first();
      if (await importBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        const isDisabled = await importBtn.isDisabled();
        if (!isDisabled) {
          await importBtn.click();
          await delay(800);
          await shot(page, 'import-center');

          const closeImport = page.locator('.modal button:has-text("Close"), .modal button:has-text("×")').first();
          if (await closeImport.isVisible({ timeout: 500 }).catch(() => false)) {
            await closeImport.click();
            await delay(500);
          }
        }
      }

      // Close settings
      const closeSettings = page.locator('button:has-text("Close"), button.modal-close, button:has-text("×")').first();
      if (await closeSettings.isVisible({ timeout: 1000 }).catch(() => false)) {
        await closeSettings.click();
        await delay(500);
      }
    }

    // ────────────────────────────────────────────
    // 6. Test Runner tab
    // ────────────────────────────────────────────
    console.log('\n📸 Section: Test Runner');
    const testRunnerTab = page.locator('.tab:has-text("Test Runner"), button:has-text("Test Runner")');
    if (await testRunnerTab.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await testRunnerTab.first().click();
      await delay(1000);
      await shot(page, 'test-runner-overview');

      // Scroll to see configuration options
      await page.evaluate(() => {
        const main = document.querySelector('.main-content, main, .content');
        if (main) main.scrollTop += 400;
        else window.scrollBy(0, 400);
      });
      await delay(500);
      await shot(page, 'test-runner-config');
    }

    // ────────────────────────────────────────────
    // 7. Results tab
    // ────────────────────────────────────────────
    console.log('\n📸 Section: Results Dashboard');
    const resultsTab = page.locator('.tab:has-text("Results"), button:has-text("Results")');
    if (await resultsTab.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await resultsTab.first().click();
      await delay(1000);
      await shot(page, 'results-dashboard');

      // Scroll to see result details
      await page.evaluate(() => {
        const main = document.querySelector('.main-content, main, .content');
        if (main) main.scrollTop += 400;
        else window.scrollBy(0, 400);
      });
      await delay(500);
      await shot(page, 'results-detail');
    }

    console.log(`\n✅ Done! ${stepNum} screenshots saved to training-ppt/manual/images/`);

  } catch (err) {
    console.error(`\n❌ Error at step ${stepNum + 1}:`, err.message);
    await shot(page, 'error-state').catch(() => {});
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();
