#!/usr/bin/env node
/**
 * Capture hero screenshots for the README: app landing, Workflow Designer,
 * the Kafka/GraphQL/gRPC protocol studios, and Test Runner results. Requires
 * the dev server running on localhost:5173 (`npm run dev`) and Playwright's
 * Chromium browser installed.
 *
 * Usage:
 *   npm run dev                                  # in one terminal
 *   npx tsx scripts/capture-readme-screenshots.ts # in another
 *
 * Output: docs/assets/screenshots/*.png
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const IMG_DIR = join(__dirname, '..', 'docs', 'assets', 'screenshots');
mkdirSync(IMG_DIR, { recursive: true });

const BASE = 'http://localhost:5173';
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function shot(page: import('playwright').Page, name: string): Promise<void> {
  const filename = `${name}.png`;
  await page.screenshot({ path: join(IMG_DIR, filename) });
  console.log(`  ✅ ${filename}`);
}

async function main() {
  console.log('🚀 Launching browser...\n');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });

  try {
    console.log('📸 1. App landing view');
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 });
    await wait(1200);
    await shot(page, 'app-landing');

    console.log('📸 2. Workflow Designer');
    const workflowTab = page.locator('button:has-text("Workflow")').first();
    if (await workflowTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await workflowTab.click();
      await wait(1200);
      await shot(page, 'workflow-designer');
    } else {
      console.warn('  ⚠️  Workflow tab not found — skipped');
    }

    console.log('📸 3. Protocol studios (Kafka / GraphQL / gRPC)');
    const protocolsBtn = page.locator('[title="Protocols"]').first();
    if (await protocolsBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await protocolsBtn.click();
      await wait(500);
      for (const { testId, name } of [
        { testId: 'nav-tab-kafka-message-studio', name: 'kafka-studio' },
        { testId: 'nav-tab-graphql-studio', name: 'graphql-studio' },
        { testId: 'nav-tab-grpc-studio', name: 'grpc-studio' },
      ]) {
        const subTab = page.locator(`[data-testid="${testId}"]`).first();
        if (await subTab.isVisible({ timeout: 3000 }).catch(() => false)) {
          await subTab.click();
          await wait(1200);
          await shot(page, name);
        } else {
          console.warn(`  ⚠️  ${testId} not found — skipped`);
        }
      }
    } else {
      console.warn('  ⚠️  Protocols domain button not found — skipped');
    }

    console.log('📸 4. Test Runner results');
    const harnessBtn = page.locator('[title="Harness"]').first();
    if (await harnessBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await harnessBtn.click();
      await wait(500);
      const resultsTab = page.locator('[data-testid="nav-tab-results"]').first();
      if (await resultsTab.isVisible({ timeout: 3000 }).catch(() => false)) {
        await resultsTab.click();
        await wait(1200);
        await shot(page, 'test-runner-results');
      } else {
        console.warn('  ⚠️  Results tab not found — skipped');
      }
    } else {
      console.warn('  ⚠️  Harness domain button not found — skipped');
    }

    console.log(`\n✅ Done — screenshots saved to docs/assets/screenshots/`);
  } catch (err) {
    console.error('\n❌ Error:', (err as Error).message);
    await shot(page, 'error-state').catch(() => {});
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();
