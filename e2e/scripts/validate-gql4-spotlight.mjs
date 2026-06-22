#!/usr/bin/env node
/** One-off GQL-4 spotlight validator — run: node e2e/scripts/validate-gql4-spotlight.mjs */
import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const STEPS = [
  { id: 'gql6-intro', highlight: '[data-testid="gql-auth-badge-btn"]', title: 'Auth on the Connection Bar' },
  { id: 'gql6-bearer', highlight: '[data-testid="gql-auth-bearer-input"]', title: 'Bearer Token' },
  { id: 'gql6-env', highlight: '[data-testid="gql-env-badge"]', title: 'Store the Secret' },
  { id: 'gql6-execute-bearer', highlight: '[data-testid="gql-execute-btn"]', title: 'Execute & Verify the Bearer' },
  { id: 'gql6-apikey', highlight: '[data-testid="gql-auth-type-select"]', title: 'Switch to API Key' },
  { id: 'gql6-execute-apikey', highlight: '[data-testid="gql-execute-btn"]', title: 'Verify the API Key' },
  { id: 'gql6-basic', highlight: '[data-testid="gql-auth-type-select"]', title: 'Basic Auth' },
  { id: 'gql6-basic-exec', highlight: '[data-testid="gql-execute-btn"]', title: 'Execute & Confirm Basic' },
  { id: 'gql6-inherit', highlight: '[data-testid="gql-auth-profile-select"]', title: 'Inherit from Auth Profile' },
  { id: 'gql6-inherit-exec', highlight: '[data-testid="gql-execute-btn"]', title: 'Execute with Inherited' },
  { id: 'gql6-profile', highlight: '[data-testid="gql-profile-badge"]', title: 'Save a Connection Profile' },
  { id: 'gql6-subscription-auth', highlight: '[data-testid="gql-auth-badge-btn"]', title: 'Auth Carries into Subscriptions' },
];

const ACTION_TIMEOUT = 180_000;
const shotDir = path.resolve('e2e/screenshots');
if (!fs.existsSync(shotDir)) fs.mkdirSync(shotDir, { recursive: true });

async function waitReading(page, isLast = false) {
  if (isLast) {
    await page.waitForFunction(() => {
      const phase = document.querySelector('[data-testid="demo-live-panel"]')?.getAttribute('data-step-phase');
      return phase === 'reading' || phase === 'done';
    }, { timeout: ACTION_TIMEOUT });
    return;
  }
  await page.waitForFunction(() => {
    const btn = document.querySelector('[aria-label="Next step"]');
    return btn && !btn.disabled;
  }, { timeout: ACTION_TIMEOUT });
}

async function skipReading(page) {
  const badge = page.locator('.demo-live-phase-badge.skippable');
  if (await badge.isVisible().catch(() => false)) await badge.click();
}

async function completeStep(page) {
  await waitReading(page);
  await skipReading(page);
  await page.waitForFunction(
    () => document.querySelector('[data-testid="demo-live-panel"]')?.getAttribute('data-step-phase') === 'done',
    { timeout: ACTION_TIMEOUT },
  );
}

async function checkSpotlight(page, selector) {
  return page.evaluate((sel) => {
    const phase = document.querySelector('[data-testid="demo-live-panel"]')?.getAttribute('data-step-phase');
    const ring = document.querySelector('.demo-spotlight-ring');
    const guide = !!document.querySelector('.demo-live-guide-badge');
    const all = document.querySelectorAll(sel);
    const target = Array.from(all).find((e) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 || r.height > 0;
    }) ?? null;
    let overlaps = false;
    if (ring && target) {
      const rr = ring.getBoundingClientRect();
      const tr = target.getBoundingClientRect();
      overlaps =
        rr.left <= tr.left + 2 &&
        rr.top <= tr.top + 2 &&
        rr.right >= tr.right - 2 &&
        rr.bottom >= tr.bottom - 2;
    }
    return { phase, ringVisible: !!ring, targetVisible: !!target, overlaps, guide };
  }, selector);
}

async function waitSpotlight(page, selector, timeoutMs = 20_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const c = await checkSpotlight(page, selector);
    if (c.phase === 'reading' && c.ringVisible && c.overlaps) return c;
    await page.waitForTimeout(150);
  }
  return checkSpotlight(page, selector);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const request = context.request;
page.setDefaultTimeout(ACTION_TIMEOUT);

async function seedEnv() {
  await page.addInitScript(({ envName, svcName }) => {
    const envId = 'env-gql-demo';
    const svcId = 'svc-gql-demo';
    localStorage.setItem('perf-test-v3-environments', JSON.stringify([{ id: envId, name: envName }]));
    localStorage.setItem('perf-test-v3-microservices', JSON.stringify([{
      id: svcId, name: svcName,
      baseUrls: { [envId]: 'http://localhost:4010' },
      enabledProtocols: ['graphql'],
      protocolEndpoints: { graphql: { [envId]: { baseUrl: 'http://localhost:4010', path: '/graphql' } } },
    }]));
    localStorage.setItem('perf-test-v3-selected-env', envId);
    localStorage.setItem('perf-test-v3-selected-svc', svcId);
    localStorage.setItem('perf-test-v3-migrated', 'true');
  }, { envName: 'GraphQL Demo', svcName: 'graphql-demo' });
}

async function setupProxy() {
  await page.route('**/__proxy', async (route) => {
    const bodyStr = route.request().postData() ?? '';
    if (!bodyStr.includes('4010')) return route.abort('failed');
    try {
      const payload = JSON.parse(bodyStr);
      const url = payload.url || 'http://localhost:4010/graphql';
      const res = await request.post(url, {
        headers: { 'Content-Type': 'application/json', ...(payload.headers ?? {}) },
        data: payload.body ? JSON.parse(payload.body) : {},
      });
      const text = await res.text();
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: res.status(), statusText: res.statusText(), headers: {}, body: text }),
      });
    } catch {
      return route.abort('failed');
    }
  });
}

try {
  await seedEnv();
  await setupProxy();
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Demo Hub' }).click();
  await page.locator('.demo-domain-card').filter({ hasNot: page.locator('.coming-soon') }).first().click();
  await page.locator('.demo-category-tab').filter({ hasText: /GraphQL/i }).click();
  await page.locator('.demo-lesson-item').filter({ hasText: 'Authentication & Headers' }).first().click();
  const gate = page.locator('[data-testid="prereq-gate"]');
  if (await gate.count()) {
    await page.waitForFunction(
      () => document.querySelector('[data-testid="prereq-status"]')?.classList.contains('prereq-status--up'),
      { timeout: 60_000 },
    );
  }
  await page.getByRole('button', { name: 'Start Demo →' }).click();
  await page.waitForSelector('[data-testid="gql-studio-page"]', { timeout: ACTION_TIMEOUT });
  await page.locator('[data-testid="header-env-select"]').selectOption({ label: 'GraphQL Demo' });
  await page.locator('[data-testid="header-svc-select"]').selectOption({ label: 'graphql-demo' });
  await waitReading(page);

  const results = [];
  for (let i = 0; i < STEPS.length; i++) {
    const exp = STEPS[i];
    console.log(`Checking step ${i + 1}/${STEPS.length}: ${exp.id}…`);
    const isLast = i === STEPS.length - 1;
    await waitReading(page, isLast);
    await page.waitForTimeout(600);
    const title = (await page.locator('.demo-live-step-title').textContent())?.trim() ?? '';
    const check = await waitSpotlight(page, exp.highlight);
    const ok =
      title.includes(exp.title.split(' ')[0]) &&
      check.phase === 'reading' &&
      check.ringVisible &&
      check.targetVisible &&
      check.overlaps &&
      !check.guide;
    const row = { step: i + 1, id: exp.id, title, expected: exp.highlight, ok, ...check };
    results.push(row);
    console.log(ok ? '  ✓ OK' : '  ✗ FAIL', JSON.stringify(row));
    if (!ok) {
      await page.screenshot({ path: path.join(shotDir, `gql4-spotlight-fail-${exp.id}.png`), fullPage: true });
    }
    if (i < STEPS.length - 1) {
      await completeStep(page);
      await page.locator('[aria-label="Next step"]').click();
    } else {
      await skipReading(page);
    }
  }

  const failures = results.filter((r) => !r.ok);
  console.log('\n=== SUMMARY ===');
  console.log(`Passed: ${results.length - failures.length}/${results.length}`);
  if (failures.length) {
    console.log('Failures:', failures.map((f) => f.id).join(', '));
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}
