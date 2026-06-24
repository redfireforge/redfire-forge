/**
 * Validates Space inserts in GraphQL Monaco editor (live demo + normal studio).
 * Run: npx playwright test e2e/demo-gql-editor-space.spec.ts --reporter=list
 */
import { test, expect } from '@playwright/test';
import { GQL_HEALTH, GQL_STUDIO_URL, silenceLogStream } from './graphql-helpers';
import { prepareGql8DockerLesson } from './graphql-lesson-smoke-helpers';

async function mockGraphqlHealthProbe(page: import('@playwright/test').Page): Promise<void> {
  await page.route(GQL_HEALTH, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok' }),
    }),
  );
}

async function focusGqlEditor(page: import('@playwright/test').Page): Promise<void> {
  await page.waitForSelector('[data-testid="gql-editor"] .monaco-editor', { timeout: 30_000 });
  const editor = page.locator('[data-testid="gql-editor"] .monaco-editor').first();
  await editor.click();
  await page.waitForTimeout(300);
}

async function typeHashThenSpace(page: import('@playwright/test').Page): Promise<void> {
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await page.keyboard.type('#', { delay: 30 });
  await page.keyboard.press('Space');
  await page.waitForTimeout(200);
}

async function getEditorState(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const active = document.activeElement as HTMLElement | null;
    const model = (
      window as unknown as {
        monaco?: { editor?: { getModels?: () => { getValue: () => string }[] } };
      }
    ).monaco?.editor?.getModels?.()?.[0];
    const suggestVisible = !!document.querySelector('.suggest-widget.visible');
    return {
      firstLine: model?.getValue()?.split('\n')[0] ?? '',
      activeTag: active?.tagName ?? null,
      activeClass: typeof active?.className === 'string' ? active.className : null,
      suggestVisible,
      liveDemoVisible: !!document.querySelector('.demo-live-panel'),
      demoViewLive: !!(window as unknown as { __demoViewLive?: boolean }).__demoViewLive,
    };
  });
}

test.describe.configure({ retries: 0 });

test.beforeEach(async ({ page }) => {
  await silenceLogStream(page);
  await mockGraphqlHealthProbe(page);
});

test('Space after # during live demo inserts comment space', async ({ page, request }) => {
  test.setTimeout(120_000);
  await prepareGql8DockerLesson(page, request);
  await page.waitForSelector('.demo-live-panel', { timeout: 15_000 });
  await focusGqlEditor(page);
  await typeHashThenSpace(page);
  const state = await getEditorState(page);
  expect(state.firstLine, JSON.stringify(state)).toBe('# ');
  expect(state.liveDemoVisible).toBe(true);
  // Play button must stay on ▶ (not toggled to ⏸) when Space was typed in the editor
  await expect(page.locator('.demo-live-play-btn')).toHaveText('▶');
});

test('Space after # in normal GraphQL Studio (no live demo) inserts comment space', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto(GQL_STUDIO_URL);
  await page.waitForSelector('[data-testid="gql-studio-page"]', { timeout: 15_000 });
  await focusGqlEditor(page);
  await typeHashThenSpace(page);
  const state = await getEditorState(page);
  expect(state.firstLine, JSON.stringify(state)).toBe('# ');
  expect(state.liveDemoVisible).toBe(false);
});

test('Space after # with suggest widget open still inserts space', async ({ page, request }) => {
  test.setTimeout(120_000);
  await prepareGql8DockerLesson(page, request);
  await page.waitForSelector('.demo-live-panel', { timeout: 15_000 });
  await focusGqlEditor(page);
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await page.keyboard.type('#', { delay: 30 });
  const withHash = await getEditorState(page);
  // If suggest opened, log it — Space must still produce "# "
  await page.keyboard.press('Space');
  const after = await getEditorState(page);
  expect(after.firstLine, `hash=${JSON.stringify(withHash)} after=${JSON.stringify(after)}`).toBe('# ');
});
