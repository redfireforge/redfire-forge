import { test, expect } from '@playwright/test';

test.describe('Training Tracks', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to Training Tracks
    await page.goto('/?tab=training');
    // Wait for loading to complete
    await expect(page.getByRole('heading', { name: /Training Manual Tracks/ })).toBeVisible();
  });

  test('displays page header and stats dashboard', async ({ page }) => {
    // Check header
    await expect(page.getByRole('heading', { name: /Training Manual Tracks/ })).toBeVisible();
    await expect(page.getByText(/Master RedfireForge through structured learning paths/)).toBeVisible();

    // Check dashboard cards (use locator within dashboard to avoid matching other elements)
    const dashboard = page.locator('.training-dashboard');
    await expect(dashboard.getByText('Completed')).toBeVisible();
    await expect(dashboard.getByText('In Progress')).toBeVisible();
    await expect(dashboard.getByText('Paths Started')).toBeVisible();
    await expect(dashboard.getByText('Day Streak')).toBeVisible();
  });

  test('displays learning paths section', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Learning Paths' })).toBeVisible();
    await expect(page.getByText(/paths available/)).toBeVisible();
    await expect(page.getByText(/manuals total/)).toBeVisible();
  });

  test('shows collapsed paths by default', async ({ page }) => {
    // Find a path card
    const pathCard = page.locator('.training-path-card').first();
    await expect(pathCard).toBeVisible();

    // Should be collapsed (no phases visible)
    const phases = pathCard.locator('.training-path-phases');
    await expect(phases).not.toBeVisible();
  });

  test('expands path when clicked', async ({ page }) => {
    // Click on first path header
    const pathHeader = page.locator('.training-path-header').first();
    await pathHeader.click();

    // Should now see phases
    const phases = page.locator('.training-path-phases').first();
    await expect(phases).toBeVisible();

    // Should see phase headers
    await expect(page.locator('.training-phase-header').first()).toBeVisible();
  });

  test('expands/collapses phase within path', async ({ page }) => {
    // Expand first path
    await page.locator('.training-path-header').first().click();
    await expect(page.locator('.training-path-phases').first()).toBeVisible();

    // Find first phase and verify it has manuals visible (expanded by default)
    const firstPhase = page.locator('.training-phase').first();
    const phaseHeader = firstPhase.locator('.training-phase-header');
    await expect(phaseHeader).toBeVisible();

    // Verify chevron state changes on click
    const chevron = phaseHeader.locator('.training-phase-chevron');
    await expect(chevron).toHaveClass(/expanded/);

    // Click to collapse - check chevron loses expanded class
    await phaseHeader.click();
    await expect(chevron).not.toHaveClass(/expanded/);

    // Click to expand again
    await phaseHeader.click();
    await expect(chevron).toHaveClass(/expanded/);
  });

  test('displays manual rows with status indicators', async ({ page }) => {
    // Expand first path
    await page.locator('.training-path-header').first().click();

    // Find a manual row
    const manualRow = page.locator('.training-manual-row').first();
    await expect(manualRow).toBeVisible();

    // Should have status button
    const statusBtn = manualRow.locator('.training-manual-status');
    await expect(statusBtn).toBeVisible();

    // Should have title
    const title = manualRow.locator('.training-manual-title');
    await expect(title).toBeVisible();
  });

  test('cycles manual status on click', async ({ page }) => {
    // Expand first path
    await page.locator('.training-path-header').first().click();

    // Find first status button
    const statusBtn = page.locator('.training-manual-status').first();

    // Initially not_started (○)
    await expect(statusBtn).toHaveClass(/training-manual-status-not_started/);

    // Click to mark in_progress
    await statusBtn.click();
    await expect(statusBtn).toHaveClass(/training-manual-status-in_progress/);

    // Click to mark completed
    await statusBtn.click();
    await expect(statusBtn).toHaveClass(/training-manual-status-completed/);

    // Click to reset to not_started
    await statusBtn.click();
    await expect(statusBtn).toHaveClass(/training-manual-status-not_started/);
  });

  test('search filters manuals', async ({ page }) => {
    // Type in search box
    const searchInput = page.getByPlaceholder('Search manuals...');
    await searchInput.fill('basics');

    // Should show results count
    await expect(page.getByText(/Showing \d+ of \d+ manuals/)).toBeVisible();

    // Should show match count badge in path cards
    await expect(page.locator('.training-path-match-count').first()).toBeVisible();
  });

  test('difficulty filter works', async ({ page }) => {
    // Click Easy filter
    await page.getByRole('button', { name: 'Easy' }).click();

    // Should show filtered results
    await expect(page.getByText(/Showing \d+ of \d+ manuals/)).toBeVisible();

    // Click All Levels to reset
    await page.getByRole('button', { name: 'All Levels' }).click();

    // Should not show results count when no filters
    await expect(page.getByText(/Showing \d+ of \d+ manuals/)).not.toBeVisible();
  });

  test('status filter works', async ({ page }) => {
    // Click In Progress filter
    await page.getByRole('button', { name: 'In Progress' }).click();

    // Should show filtered results
    await expect(page.getByText(/Showing \d+ of \d+ manuals/)).toBeVisible();

    // Click All to reset (use exact match to avoid "All Levels")
    await page.getByRole('button', { name: 'All', exact: true }).click();
  });

  test('clear filters button works', async ({ page }) => {
    // Apply some filters
    await page.getByPlaceholder('Search manuals...').fill('test');
    await page.getByRole('button', { name: 'Medium' }).click();

    // Should see clear filters button
    const clearBtn = page.getByRole('button', { name: 'Clear filters' });
    await expect(clearBtn).toBeVisible();

    // Click clear
    await clearBtn.click();

    // Filters should be reset
    await expect(page.getByPlaceholder('Search manuals...')).toHaveValue('');
    await expect(clearBtn).not.toBeVisible();
  });

  test('no results state shows when no matches', async ({ page }) => {
    // Search for something that won't match
    await page.getByPlaceholder('Search manuals...').fill('xyznonexistent12345');

    // Should show no results message
    await expect(page.getByText('No manuals found')).toBeVisible();
    await expect(page.getByText('Try adjusting your search or filters')).toBeVisible();
  });

  test('keyboard navigation works for path expansion', async ({ page }) => {
    // Focus first path header
    const pathHeader = page.locator('.training-path-header').first();
    await pathHeader.focus();

    // Press Enter to expand
    await page.keyboard.press('Enter');
    await expect(page.locator('.training-path-phases').first()).toBeVisible();

    // Press Space to collapse
    await page.keyboard.press('Space');
    await expect(page.locator('.training-path-phases').first()).not.toBeVisible();
  });

  test('navigates between Samples and Training Tracks tabs', async ({ page }) => {
    // Should be on Training Tracks
    await expect(page.getByRole('heading', { name: /Training Manual Tracks/ })).toBeVisible();

    // Click Samples tab (use exact match to avoid matching path cards)
    await page.locator('.sub-nav-tab').filter({ hasText: 'Samples' }).click();

    // Should navigate away from Training Tracks
    await expect(page.getByRole('heading', { name: /Training Manual Tracks/ })).not.toBeVisible();

    // Click Training Tracks tab
    await page.locator('.sub-nav-tab').filter({ hasText: 'Training Tracks' }).click();

    // Should be back
    await expect(page.getByRole('heading', { name: /Training Manual Tracks/ })).toBeVisible();
  });

  test('progress persists after refresh', async ({ page }) => {
    // Expand first path
    await page.locator('.training-path-header').first().click();

    // Mark first manual as in_progress
    const statusBtn = page.locator('.training-manual-status').first();
    await statusBtn.click();
    await expect(statusBtn).toHaveClass(/training-manual-status-in_progress/);

    // Refresh page
    await page.reload();
    await expect(page.getByRole('heading', { name: /Training Manual Tracks/ })).toBeVisible();

    // Expand first path again
    await page.locator('.training-path-header').first().click();

    // Status should be preserved
    const statusBtnAfter = page.locator('.training-manual-status').first();
    await expect(statusBtnAfter).toHaveClass(/training-manual-status-in_progress/);
  });
});
