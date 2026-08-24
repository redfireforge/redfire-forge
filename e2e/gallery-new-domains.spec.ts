/**
 * E2E: gallery domain tabs + entries introduced in Phase A–D
 *
 * Covers:
 *  - gRPC and WebSocket domain filter buttons are present
 *  - gRPC/WebSocket scaffold tabs render (0 cards — catalogs are intentionally empty)
 *  - New GraphQL subscription workflow entries appear under Workflows
 *  - New gRPC workflow entries appear under Workflows
 *  - New WebSocket workflow entries appear under Workflows
 *  - Search crosses all domains correctly for new entries
 *  - DomainBadge colour is rendered for gRPC and WebSocket cards (badge present)
 */
import { test, expect } from '@playwright/test';
import { seedAppData } from './helpers';

test.describe('Gallery — new domains and entries', () => {
  test.beforeEach(async ({ page }) => {
    await seedAppData(page);
    await page.goto('/?tab=gallery');
    await page.waitForSelector('.gallery-domain-btn', { timeout: 10000 });
  });

  // ── Domain buttons ──────────────────────────────────────────────────────

  test('gRPC domain filter button is visible', async ({ page }) => {
    await expect(page.locator('.gallery-domain-btn', { hasText: 'gRPC' })).toBeVisible();
  });

  test('WebSocket domain filter button is visible', async ({ page }) => {
    await expect(page.locator('.gallery-domain-btn', { hasText: 'WebSocket' })).toBeVisible();
  });

  // ── Scaffold tabs (empty catalogs) ─────────────────────────────────────

  test('filtering by gRPC domain shows no cards (scaffold only)', async ({ page }) => {
    await page.locator('.gallery-domain-btn', { hasText: 'gRPC' }).click();
    await page.waitForTimeout(200);
    const cards = page.locator('.gallery-card');
    await expect(cards).toHaveCount(0);
  });

  test('filtering by WebSocket domain shows no cards (scaffold only)', async ({ page }) => {
    await page.locator('.gallery-domain-btn', { hasText: 'WebSocket' }).click();
    await page.waitForTimeout(200);
    const cards = page.locator('.gallery-card');
    await expect(cards).toHaveCount(0);
  });

  // ── GraphQL subscription workflow entries ───────────────────────────────

  test('GraphQL subscription WS entry appears in Workflows tab', async ({ page }) => {
    await page.locator('.gallery-domain-btn', { hasText: 'Workflows' }).click();
    await page.waitForTimeout(200);
    await expect(
      page.locator('.gallery-card', { hasText: 'Subscription over WebSocket' }),
    ).toBeVisible();
  });

  test('GraphQL subscription SSE entry appears in Workflows tab', async ({ page }) => {
    await page.locator('.gallery-domain-btn', { hasText: 'Workflows' }).click();
    await page.waitForTimeout(200);
    await expect(
      page.locator('.gallery-card', { hasText: 'Subscription over SSE' }),
    ).toBeVisible();
  });

  test('detail panel for GQL subscription WS shows correct metadata', async ({ page }) => {
    await page.locator('.gallery-domain-btn', { hasText: 'Workflows' }).click();
    await page.waitForTimeout(200);
    await page.locator('.gallery-card', { hasText: 'Subscription over WebSocket' }).click();
    const panel = page.locator('.gallery-detail-panel');
    await expect(panel).toBeVisible({ timeout: 5000 });
    await expect(panel).toContainText('graphql-ws');
    await expect(panel.locator('.gallery-detail-actions')).toBeVisible();
  });

  // ── gRPC workflow entries ───────────────────────────────────────────────

  test('gRPC health-check workflow entry appears in Workflows tab', async ({ page }) => {
    await page.locator('.gallery-domain-btn', { hasText: 'Workflows' }).click();
    await page.waitForTimeout(200);
    await expect(
      page.locator('.gallery-card', { hasText: 'gRPC: Health Check' }),
    ).toBeVisible();
  });

  test('gRPC workflow entries can be loaded', async ({ page }) => {
    await page.locator('.gallery-domain-btn', { hasText: 'Workflows' }).click();
    await page.waitForTimeout(200);
    await page.locator('.gallery-card', { hasText: 'gRPC: Health Check' }).click();
    await page.locator('.gallery-detail-btn-primary', { hasText: 'Load Workflow' }).click();
    await page.waitForTimeout(500);
    const url = page.url();
    expect(url).toContain('tab=workflow');
  });

  // ── WebSocket workflow entries ──────────────────────────────────────────

  test('WebSocket Echo workflow entry appears in Workflows tab', async ({ page }) => {
    await page.locator('.gallery-domain-btn', { hasText: 'Workflows' }).click();
    await page.waitForTimeout(200);
    await expect(
      page.locator('.gallery-card', { hasText: 'WebSocket: Echo Ping' }),
    ).toBeVisible();
  });

  // ── Cross-domain search ─────────────────────────────────────────────────

  test('searching "subscription" returns GraphQL subscription entries', async ({ page }) => {
    const searchInput = page.locator('[aria-label="Search gallery"]');
    await searchInput.fill('subscription');
    await page.waitForTimeout(200);
    const cards = page.locator('.gallery-card');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(2);
    // Both subscription variants should be present in the results
    await expect(page.locator('.gallery-card', { hasText: 'WebSocket' }).first()).toBeVisible();
    await expect(page.locator('.gallery-card', { hasText: 'SSE' }).first()).toBeVisible();
  });

  test('searching "grpc" returns gRPC workflow entries', async ({ page }) => {
    const searchInput = page.locator('[aria-label="Search gallery"]');
    await searchInput.fill('grpc');
    await page.waitForTimeout(200);
    const cards = page.locator('.gallery-card');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  // ── DomainBadge rendered ────────────────────────────────────────────────

  test('gRPC workflow cards show a domain badge', async ({ page }) => {
    await page.locator('.gallery-domain-btn', { hasText: 'Workflows' }).click();
    await page.waitForTimeout(200);
    const card = page.locator('.gallery-card', { hasText: 'gRPC: Health Check' });
    await expect(card.locator('.gallery-domain-badge')).toBeVisible();
  });
});
