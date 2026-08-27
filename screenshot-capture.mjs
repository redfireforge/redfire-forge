import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const SCREENSHOTS_DIR = '/Users/dz5jxr/workspace/gmai/redfire-forge/docs/assets/screenshots';

// Ensure screenshots directory exists
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function captureScreenshots() {
  const browser = await chromium.launch({
    headless: true,
  });

  try {
    const context = await browser.createContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
    });

    const page = await context.newPage();

    // Navigate to the app
    console.log('Navigating to http://localhost:5173...');
    try {
      await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 30000 });
    } catch (err) {
      console.log('Navigation timeout - trying with load state instead...');
      await page.goto('http://localhost:5173', { waitUntil: 'load', timeout: 30000 });
    }

    // Wait for page to stabilize
    await page.waitForTimeout(2000);

    // FIRST SCREENSHOT: Protocols Tab
    console.log('Looking for Protocols tab...');
    
    // Try to find and click the Protocols tab - look in sidebar nav
    const protocolsTabSelectors = [
      'a:has-text("Protocols")',
      'button:has-text("Protocols")',
      '[role="tab"]:has-text("Protocols")',
      'text=Protocols',
      'a[href*="protocol"]',
      '.nav-item:has-text("Protocols")',
    ];

    let protocolsClicked = false;
    for (const selector of protocolsTabSelectors) {
      try {
        const element = page.locator(selector).first();
        if (await element.isVisible()) {
          console.log(`Found Protocols with selector: ${selector}`);
          await element.click({ timeout: 5000 });
          protocolsClicked = true;
          break;
        }
      } catch (e) {
        // Continue to next selector
      }
    }

    if (!protocolsClicked) {
      console.log('Could not find Protocols tab, dumping page content...');
      const bodyText = await page.locator('body').textContent();
      console.log('Page text (first 500 chars):', bodyText?.substring(0, 500));
    }

    // Wait for protocols view to load
    await page.waitForTimeout(1500);

    // Look for sub-tabs (GraphQL, gRPC, Kafka, WebSocket, SSE)
    console.log('Looking for protocol sub-tabs...');
    const subTabSelectors = [
      'text=GraphQL',
      'text=Kafka',
      'text=gRPC',
      'text=WebSocket',
      'text=SSE',
      '[role="tab"]',
    ];

    let clickedSubTab = false;
    for (const selector of subTabSelectors) {
      try {
        const elements = page.locator(selector);
        const count = await elements.count();
        if (count > 0) {
          for (let i = 0; i < count; i++) {
            const element = elements.nth(i);
            if (await element.isVisible()) {
              const text = await element.textContent();
              console.log(`Found tab: ${text}`);
              
              // Click Kafka or GraphQL if available to show richer view
              if ((text?.includes('Kafka') || text?.includes('GraphQL')) && !clickedSubTab) {
                console.log(`Clicking into ${text} for richer view...`);
                await element.click({ timeout: 5000 });
                await page.waitForTimeout(1500);
                clickedSubTab = true;
                break;
              }
            }
          }
          if (clickedSubTab) break;
        }
      } catch (e) {
        // Continue
      }
    }

    // Take Protocols screenshot
    const protocolsPath = path.join(SCREENSHOTS_DIR, 'protocols-studios.png');
    console.log(`Saving Protocols screenshot to ${protocolsPath}...`);
    await page.screenshot({ path: protocolsPath, fullPage: false });
    console.log('Protocols screenshot saved');

    // SECOND SCREENSHOT: Test Runner / Results
    console.log('\nLooking for API/Harness/Test Runner tab...');
    
    const apiTabSelectors = [
      'a:has-text("API")',
      'button:has-text("API")',
      '[role="tab"]:has-text("API")',
      'text=API',
      'a:has-text("Harness")',
      'button:has-text("Harness")',
      'text=Harness',
      'a:has-text("Test Runner")',
      'button:has-text("Test Runner")',
      'text=Test Runner',
      'a:has-text("Results")',
      'button:has-text("Results")',
      'text=Results',
    ];

    let apiClicked = false;
    for (const selector of apiTabSelectors) {
      try {
        const element = page.locator(selector).first();
        if (await element.isVisible()) {
          console.log(`Found tab with selector: ${selector}`);
          await element.click({ timeout: 5000 });
          apiClicked = true;
          await page.waitForTimeout(1500);
          break;
        }
      } catch (e) {
        // Continue to next selector
      }
    }

    if (!apiClicked) {
      console.log('Could not find API/Harness/Test Runner tab');
    }

    // Look for Test Runner or Results sub-tabs
    console.log('Looking for Test Runner/Results sub-tabs...');
    const resultsTabSelectors = [
      'text=Results',
      'text=Test Runner',
      'text=Runs',
      'text=Report',
      '[role="tab"]',
    ];

    for (const selector of resultsTabSelectors) {
      try {
        const elements = page.locator(selector);
        const count = await elements.count();
        if (count > 0) {
          for (let i = 0; i < count; i++) {
            const element = elements.nth(i);
            if (await element.isVisible()) {
              const text = await element.textContent();
              console.log(`Found sub-tab: ${text}`);
              
              // Click Results or Test Runner if available
              if ((text?.includes('Results') || text?.includes('Test Runner')) && i === 0) {
                console.log(`Clicking into ${text}...`);
                await element.click({ timeout: 5000 });
                await page.waitForTimeout(1500);
                break;
              }
            }
          }
        }
      } catch (e) {
        // Continue
      }
    }

    // Take Test Runner/Results screenshot
    const resultsPath = path.join(SCREENSHOTS_DIR, 'test-runner-results.png');
    console.log(`Saving Test Runner/Results screenshot to ${resultsPath}...`);
    await page.screenshot({ path: resultsPath, fullPage: false });
    console.log('Test Runner/Results screenshot saved');

    await context.close();
    console.log('\n✓ Screenshots captured successfully!');
  } finally {
    await browser.close();
  }
}

captureScreenshots().catch(err => {
  console.error('Error capturing screenshots:', err);
  process.exit(1);
});
