import type { Page } from '@playwright/test';
import { GQL } from '../../src/shared/selectors';

/** Wait until the docked Auth panel is visible (after badge click or tab switch). */
export async function waitForGqlAuthPanel(page: Page, timeout = 15_000): Promise<void> {
  await page.locator(GQL.AUTH_PANEL).waitFor({ state: 'visible', timeout });
}
