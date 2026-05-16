import { chromium } from '@playwright/test';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto('http://localhost:5173');
await page.waitForTimeout(2000);

// Take a full page screenshot first to see the app state
await page.screenshot({ path: 'test-app-full.png', fullPage: false });
console.log('Full app screenshot saved');

await browser.close();
