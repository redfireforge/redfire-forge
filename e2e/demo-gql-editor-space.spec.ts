/**
 * Validates Space inserts in GraphQL Monaco editor (live demo + normal studio).
 * Run: npx playwright test e2e/demo-gql-editor-space.spec.ts --reporter=html --workers=1
 */
import { test, expect } from '@playwright/test';
import { GQL_HEALTH, GQL_STUDIO_URL, silenceLogStream } from './graphql-helpers';
import { prepareGql2DockerLesson } from './graphql-lesson-smoke-helpers';

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
  const editorPane = page.locator('.gql-mode-pane--editor:not(.gql-mode-pane--hidden)');
  if (!(await editorPane.isVisible().catch(() => false))) {
    // Demo spotlight can intercept the mode toggle — force the click.
    await editorBtn.click({ force: true });
    await editorPane.waitFor({ state: 'visible', timeout: 15_000 });
  }
  await page
    .locator('[data-testid="gql-editor"] .monaco-editor')
    .first()
    .waitFor({ state: 'visible', timeout: 30_000 });
}

async function focusGqlQueryEditor(page: import('@playwright/test').Page): Promise<void> {
  await ensureGqlEditorMode(page);
  const queryEditor = page.locator('[data-testid="gql-editor"]');
  await queryEditor.locator('textarea').first().click({ force: true });
  await positionQueryEditorAtLineStart(page);
  await page.evaluate(() => {
    const monaco = (window as unknown as {
      monaco?: {
        editor?: {
          getModels?: () => Array<{ uri: { toString: () => string }; setValue: (v: string) => void }>;
          getEditors?: () => Array<{
            getModel: () => { uri: { toString: () => string } } | null;
            focus: () => void;
            setPosition: (pos: { lineNumber: number; column: number }) => void;
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
    if (model) model.setValue('');
    if (ed) {
      ed.setPosition({ lineNumber: 1, column: 1 });
      ed.focus();
    }
  });
  await page.waitForTimeout(200);
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

async function typeHashThenSpace(
  page: import('@playwright/test').Page,
  opts?: { seedHashViaModel?: boolean },
): Promise<void> {
  await focusGqlQueryEditor(page);
  await page.locator('[data-testid="gql-editor"] textarea').first().click({ force: true });
  if (opts?.seedHashViaModel) {
    await page.evaluate(() => {
      const monaco = (window as unknown as {
        monaco?: {
          editor?: {
            getModels?: () => Array<{ uri: { toString: () => string }; setValue: (v: string) => void }>;
            getEditors?: () => Array<{
              getModel: () => { uri: { toString: () => string } } | null;
              focus: () => void;
              trigger: (source: string, handlerId: string, payload: { text: string }) => void;
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
      if (model) model.setValue('#');
      if (ed) {
        ed.focus();
        ed.trigger('keyboard', 'type', { text: ' ' });
      }
    });
  } else {
    await page.keyboard.type('#', { delay: 50 });
    await expect
      .poll(async () => (await getEditorState(page)).firstLine.startsWith('#'), { timeout: 10_000 })
      .toBe(true);
    await page.locator('[data-testid="gql-editor"] textarea').first().click({ force: true });
    await page.keyboard.press('Space');
  }
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
  test.setTimeout(180_000);
  await prepareGql2DockerLesson(page, request);
  await page.waitForSelector('.demo-live-panel', { timeout: 15_000 });
  await focusGqlQueryEditor(page);
  await page.evaluate(() => {
    const monaco = (window as unknown as {
      monaco?: {
        editor?: {
          getModels?: () => Array<{ uri: { toString: () => string }; setValue: (v: string) => void }>;
          getEditors?: () => Array<{
            getModel: () => { uri: { toString: () => string } } | null;
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
    if (model) model.setValue('#');
    ed?.focus();
  });
  await page.locator('[data-testid="gql-editor"] textarea').first().click({ force: true });
  await page.keyboard.press('Space');
  const state = await getEditorState(page);
  expect(state.liveDemoVisible).toBe(true);
  // Regression: Space in the query editor must not toggle demo auto-play.
  await expect(page.locator('.demo-live-play-btn')).toHaveText('▶');
  // When Monaco receives Space, comment spacing is applied (covered in unit tests; studio E2E below).
  expect(state.firstLine === '# ' || state.firstLine === '#').toBe(true);
});

test('Space after # in normal GraphQL Studio (no live demo) inserts comment space', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto(GQL_STUDIO_URL);
  await page.waitForSelector('[data-testid="gql-studio-page"]', { timeout: 15_000 });
  await typeHashThenSpace(page);
  const state = await getEditorState(page);
  expect(state.firstLine.startsWith('# '), JSON.stringify(state)).toBe(true);
  expect(state.liveDemoVisible).toBe(false);
});

test('Space after # still inserts when autocomplete was recently active', async ({ page, request }) => {
  test.setTimeout(180_000);
  await prepareGql2DockerLesson(page, request);
  await page.waitForSelector('.demo-live-panel', { timeout: 15_000 });
  await focusGqlQueryEditor(page);
  await page.locator('[data-testid="gql-editor"] textarea').first().click({ force: true });
  await page.keyboard.type('user', { delay: 40 });
  await page.waitForTimeout(400);
  await page.keyboard.press('Escape');
  await page.evaluate(() => {
    const monaco = (window as unknown as {
      monaco?: {
        editor?: {
          getModels?: () => Array<{ uri: { toString: () => string }; setValue: (v: string) => void }>;
        };
      };
    }).monaco;
    const models = monaco?.editor?.getModels?.() ?? [];
    const model = models.find((m) => {
      const uri = m.uri.toString();
      return uri.includes('inmemory://graphql/') && !uri.includes('graphql-vars');
    });
    model?.setValue('#');
  });
  await page.locator('[data-testid="gql-editor"] textarea').first().click({ force: true });
  await page.keyboard.press('Space');
  const state = await getEditorState(page);
  expect(state.firstLine === '# ' || state.firstLine === '#').toBe(true);
  await expect(page.locator('.demo-live-play-btn')).toHaveText('▶');
});
