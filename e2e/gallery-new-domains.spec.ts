/**
 * E2E: gallery domain tabs + entries introduced in Phase A–D
 *
 * Covers:
 *  - gRPC and WebSocket domain filter buttons are present
 *  - gRPC/WebSocket domain tabs show protocol + workflow samples
 *  - GraphQL subscription workflow entries appear under GraphQL
 *  - gRPC and WebSocket workflow entries appear under their protocol tabs
 *  - Search crosses all domains correctly for new entries
 *  - DomainBadge colour is rendered for gRPC workflow cards
 */
import { test, expect } from '@playwright/test';
import { seedAppData } from './helpers';

async function selectGalleryDomain(
  page: import('@playwright/test').Page,
  label: string,
) {
  await page.locator('.gallery-domain-btn', { hasText: label }).click();
  await page.waitForTimeout(200);
}

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

  // ── Protocol domain tabs ────────────────────────────────────────────────

  test('filtering by gRPC domain shows harness and workflow samples', async ({ page }) => {
    await selectGalleryDomain(page, 'gRPC');
    await expect(page.locator('.gallery-card', { hasText: 'gRPC Unary Smoke Test' })).toBeVisible();
    await expect(page.locator('.gallery-card', { hasText: 'gRPC: Health Check' })).toBeVisible();
  });

  test('filtering by WebSocket domain shows harness and workflow samples', async ({ page }) => {
    await selectGalleryDomain(page, 'WebSocket');
    await expect(page.locator('.gallery-card', { hasText: 'WebSocket Echo Smoke Test' })).toBeVisible();
    await expect(page.locator('.gallery-card', { hasText: 'WebSocket: Echo Ping' })).toBeVisible();
  });

  // ── GraphQL subscription workflow entries ───────────────────────────────

  test('GraphQL subscription WS entry appears in GraphQL tab', async ({ page }) => {
    await selectGalleryDomain(page, 'GraphQL');
    await expect(
      page.locator('.gallery-card', { hasText: 'GraphQL: Subscription over WebSocket' }),
    ).toBeVisible();
  });

  test('GraphQL subscription SSE entry appears in GraphQL tab', async ({ page }) => {
    await selectGalleryDomain(page, 'GraphQL');
    await expect(
      page.locator('.gallery-card', { hasText: 'GraphQL: Subscription over SSE' }),
    ).toBeVisible();
  });

  test('detail panel for GQL subscription WS shows correct metadata', async ({ page }) => {
    await selectGalleryDomain(page, 'GraphQL');
    await page.locator('.gallery-card', { hasText: 'GraphQL: Subscription over WebSocket' }).click();
    const panel = page.locator('.gallery-detail-panel');
    await expect(panel).toBeVisible({ timeout: 5000 });
    await expect(panel).toContainText('graphql-ws');
    await expect(panel.locator('.gallery-detail-actions')).toBeVisible();
  });

  // ── gRPC workflow entries ───────────────────────────────────────────────

  test('gRPC health-check workflow entry appears in gRPC tab', async ({ page }) => {
    await selectGalleryDomain(page, 'gRPC');
    await expect(
      page.locator('.gallery-card', { hasText: 'gRPC: Health Check' }),
    ).toBeVisible();
  });

  test('gRPC harness samples can be loaded from the gallery detail panel', async ({ page }) => {
    await selectGalleryDomain(page, 'gRPC');
    await page.locator('.gallery-card', { hasText: 'gRPC Unary Smoke Test' }).click();
    const loadBtn = page.locator('.gallery-detail-btn-primary');
    await expect(loadBtn).toHaveText('Load Sample');
    await loadBtn.click();
    await expect(page).toHaveURL(/tab=scenarios/, { timeout: 5000 });
  });

  // ── WebSocket workflow entries ──────────────────────────────────────────

  test('WebSocket Echo workflow entry appears in WebSocket tab', async ({ page }) => {
    await selectGalleryDomain(page, 'WebSocket');
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
    await selectGalleryDomain(page, 'gRPC');
    const card = page.locator('.gallery-card', { hasText: 'gRPC: Health Check' });
    await expect(card.locator('.gallery-domain-badge')).toBeVisible();
  });
});
