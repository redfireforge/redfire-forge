/**
 * Validates Space inserts in GraphQL Monaco editor (live demo + normal studio).
 * Run: npx playwright test e2e/demo-gql-editor-space.spec.ts --reporter=html --workers=1
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

async function ensureGqlEditorMode(page: import('@playwright/test').Page): Promise<void> {
  const editorBtn = page.locator('[data-testid="gql-mode-editor"]');
  await editorBtn.waitFor({ state: 'visible', timeout: 30_000 });
  const isActive = await editorBtn.evaluate((el) => el.classList.contains('gql-mode-btn--active'));
  if (!isActive) {
    await editorBtn.click();
    await page.waitForSelector('.gql-mode-pane--editor:not(.gql-mode-pane--hidden)', { timeout: 15_000 });
  }
}

async function focusGqlEditor(page: import('@playwright/test').Page): Promise<void> {
  await ensureGqlEditorMode(page);
  await page.waitForSelector('[data-testid="gql-editor"] .monaco-editor', { timeout: 30_000 });
  const editor = page.locator('[data-testid="gql-editor"] .monaco-editor').first();
  await editor.click();
  await page.waitForSelector('[data-testid="gql-editor"] .monaco-editor.focused', { timeout: 5_000 }).catch(() => {});
  await page.waitForTimeout(300);
}

async function positionQueryEditorAtLineStart(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(() => {
    const monaco = (window as unknown as {
      monaco?: {
        editor?: {
          getModels?: () => Array<{ uri: { toString: () => string } }>;
          getEditors?: () => Array<{
            getModel: () => { uri: { toString: () => string } } | null;
            setPosition: (pos: { lineNumber: number; column: number }) => void;
            setSelection: (sel: {
              startLineNumber: number;
              startColumn: number;
              endLineNumber: number;
              endColumn: number;
            }) => void;
            focus: () => void;
          }>;
        };
      };
    }).monaco;
    const models = monaco?.editor?.getModels?.() ?? [];
    const model = models.find((m) => {
      const uri = m.uri.toString();
      return uri.includes('inmemory://graphql/') && !uri.includes('graphql-vars');
    });
    const editors = monaco?.editor?.getEditors?.() ?? [];
    const ed = editors.find((e) => e.getModel() === model);
    if (!ed) return;
    ed.setPosition({ lineNumber: 1, column: 1 });
    ed.setSelection({
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: 1,
      endColumn: 1,
    });
    ed.focus();
  });
}

async function typeHashThenSpace(page: import('@playwright/test').Page): Promise<void> {
  await positionQueryEditorAtLineStart(page);
  await page.waitForTimeout(100);
  await page.keyboard.type('#', { delay: 50 });
  await page.waitForFunction(
    () => {
      const monaco = (window as unknown as {
        monaco?: { editor?: { getModels?: () => Array<{ uri: { toString: () => string }; getValue: () => string }> } };
      }).monaco;
      const models = monaco?.editor?.getModels?.() ?? [];
      const model = models.find((m) => {
        const uri = m.uri.toString();
        return uri.includes('inmemory://graphql/') && !uri.includes('graphql-vars');
      });
      return (model?.getValue()?.split('\n')[0] ?? '').startsWith('#');
    },
    { timeout: 5_000 },
  );
  await page.keyboard.press('Space');
  await page.waitForTimeout(200);
}

async function getEditorState(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const active = document.activeElement as HTMLElement | null;
    const models = (
      window as unknown as {
        monaco?: {
          editor?: {
            getModels?: () => Array<{ getValue: () => string; uri?: { toString: () => string } }>;
          };
        };
      }
    ).monaco?.editor?.getModels?.() ?? [];
    const queryModel = models.find((m) => {
      const uri = m.uri?.toString?.() ?? '';
      return uri.includes('inmemory://graphql/') && !uri.includes('graphql-vars');
    }) ?? models[0];
    const suggestVisible = !!document.querySelector('.suggest-widget.visible');
    return {
      firstLine: queryModel?.getValue()?.split('\n')[0] ?? '',
      fullValue: queryModel?.getValue() ?? '',
      modelUri: queryModel?.uri?.toString?.() ?? null,
      activeTag: active?.tagName ?? null,
      activeClass: typeof active?.className === 'string' ? active.className : null,
      suggestVisible,
      liveDemoVisible: !!document.querySelector('.demo-live-panel'),
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
  expect(state.firstLine.startsWith('# '), JSON.stringify(state)).toBe(true);
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
  expect(state.firstLine.startsWith('# '), JSON.stringify(state)).toBe(true);
  expect(state.liveDemoVisible).toBe(false);
});

test('Space after # still inserts when autocomplete was recently active', async ({ page, request }) => {
  test.setTimeout(120_000);
  await prepareGql8DockerLesson(page, request);
  await page.waitForSelector('.demo-live-panel', { timeout: 15_000 });
  await focusGqlEditor(page);
  await page.keyboard.type('user', { delay: 40 });
  await page.waitForTimeout(400);
  await page.keyboard.press('Escape');
  await typeHashThenSpace(page);
  const state = await getEditorState(page);
  expect(state.firstLine.startsWith('# '), JSON.stringify(state)).toBe(true);
});
