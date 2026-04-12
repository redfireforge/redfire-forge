#!/usr/bin/env node
import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await new Promise(r => setTimeout(r, 1500));

  // Dump key UI elements
  const sections = [
    { label: 'Header buttons/tabs', selector: 'header button, .tab-nav button, .tab' },
    { label: 'Sidebar buttons', selector: 'aside button, .sidebar button' },
    { label: 'Sidebar env items', selector: '.env-list *, .sidebar li, .sidebar .env-item' },
    { label: 'Add buttons', selector: 'button[class*="add"], button:has-text("Add"), button:has-text("+")' },
    { label: 'Settings button', selector: 'button:has-text("Settings")' },
    { label: 'All visible buttons', selector: 'button:visible' },
    { label: 'All inputs', selector: 'input:visible, select:visible, textarea:visible' },
    { label: 'Feature group elements', selector: '[class*="feature"], [class*="group"]' },
  ];

  for (const { label, selector } of sections) {
    const els = await page.locator(selector).all();
    console.log(`\n=== ${label} (${els.length}) ===`);
    for (const el of els.slice(0, 15)) {
      const tag = await el.evaluate(e => e.tagName);
      const cls = await el.evaluate(e => e.className);
      const text = await el.evaluate(e => e.textContent?.trim().slice(0, 80));
      const type = await el.evaluate(e => e.type || '');
      console.log(`  <${tag.toLowerCase()} class="${cls}" type="${type}"> ${text}`);
    }
  }

  // Now click Settings and inspect
  console.log('\n\n=== OPENING SETTINGS ===');
  const settingsBtn = page.locator('button:has-text("Settings")').first();
  if (await settingsBtn.isVisible()) {
    await settingsBtn.click();
    await new Promise(r => setTimeout(r, 1000));
    
    const modalEls = await page.locator('.settings-modal button, .settings-modal input, .settings-modal select, .settings-modal textarea, .modal button, .modal input').all();
    console.log(`\n=== Settings modal elements (${modalEls.length}) ===`);
    for (const el of modalEls.slice(0, 30)) {
      const tag = await el.evaluate(e => e.tagName);
      const cls = await el.evaluate(e => e.className);
      const text = await el.evaluate(e => e.textContent?.trim().slice(0, 80));
      const placeholder = await el.evaluate(e => e.placeholder || '');
      const type = await el.evaluate(e => e.type || '');
      console.log(`  <${tag.toLowerCase()} class="${cls}" type="${type}" placeholder="${placeholder}"> ${text}`);
    }
  }

  // Close settings and go to Feature Groups - check add buttons
  console.log('\n\n=== CHECKING FEATURE GROUPS UI ===');
  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 500));
  
  // Get the full DOM structure of main content area
  const mainHTML = await page.evaluate(() => {
    const main = document.querySelector('.main-content') || document.querySelector('main') || document.querySelector('.content');
    if (!main) return 'NO MAIN FOUND';
    // Get a summarized version
    const summarize = (el, depth = 0) => {
      if (depth > 4) return '';
      const indent = '  '.repeat(depth);
      const tag = el.tagName?.toLowerCase() || '';
      const cls = el.className || '';
      const text = el.childNodes.length === 1 && el.childNodes[0].nodeType === 3 
        ? el.textContent.trim().slice(0, 40) : '';
      let result = `${indent}<${tag} class="${cls}">${text}\n`;
      for (const child of el.children || []) {
        result += summarize(child, depth + 1);
      }
      return result;
    };
    return summarize(main);
  });
  console.log(mainHTML.slice(0, 3000));

  await browser.close();
}

main();
