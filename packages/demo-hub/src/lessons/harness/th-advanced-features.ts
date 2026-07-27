/**
 * TH-9: Advanced — Versioning, Trash & Organization
 *
 * Teaches search, scenario tags, test definition version history,
 * and the Trash recovery flow. Each step demonstrates a real feature
 * with human-paced interactions.
 */
import type { DemoLesson, DemoActionContext } from '../../types';
import { HAR } from '@shared/selectors';
import {
  seedDemoEnvAndService,
  seedTh9FeatureGroup,
  deleteTh9DemoFg,
  ensureTh9FgExists,
  expandFirstFg,
  expandFirstScenario,
  spotlight,
  spotlightSel,
  fillSearchBar,
  clearSearchBar,
  isTestEditorOpen,
  closeTestEditorQuiet,
  closeTrashPanel,
} from './th-demo-helpers';

async function ensureTh9Ready(ctx: DemoActionContext): Promise<void> {
  await ensureTh9FgExists(ctx);
  if (!document.querySelector(HAR.FG_CARD)) {
    ctx.navigateToTab('scenarios');
    await ctx.delay(500);
  }
  await expandFirstFg(ctx);
}

/** Find the Trash button in the Scenario Builder header by label text. */
function findTrashButton(): HTMLElement | null {
  const btns = document.querySelectorAll<HTMLElement>('.header-actions .btn');
  return Array.from(btns).find(b => b.textContent?.includes('Trash')) ?? null;
}

/** Find the Undo button inside the trash toast by label text. */
function findUndoButton(): HTMLElement | null {
  const toast = document.querySelector<HTMLElement>(HAR.TRASH_TOAST);
  if (!toast) return null;
  const btns = toast.querySelectorAll<HTMLElement>('button');
  return Array.from(btns).find(b => b.textContent?.trim() === 'Undo') ?? btns[0] ?? null;
}

export const thAdvancedFeaturesLesson: DemoLesson = {
  id: 'th-advanced-features',
  domainId: 'harness',
  category: 'analysis',
  name: 'Versioning, Trash & Organization',
  description:
    'Search across all tests, tag scenarios for organization, explore definition version history, ' +
    'and recover deleted items from the Trash.',
  estimatedMinutes: 5,
  initialTab: 'scenarios',
  allowedTabs: ['scenarios'],
  concept: {
    title: 'Organizing Your Test Suite',
    body:
      'As your test suite grows, RedfireForge provides tools to keep it manageable:\n\n' +
      '- **Search** finds tests by name, URL, method, or scenario tags with boolean operators\n' +
      '- **Tags** on scenarios (smoke, regression, critical) help categorize and filter runs\n' +
      '- **Version History** automatically snapshots test definitions on save so you can compare and restore\n' +
      '- **Trash** with a 5-second undo and a recovery panel protects against accidental deletion',
    keyTerms: [
      { term: 'Tags', definition: 'Labels on scenarios (smoke, regression) for filtering and organizing runs.' },
      { term: 'Version History', definition: 'Auto-saved snapshots of test definitions with compare and restore.' },
      { term: 'Trash', definition: 'Soft-delete with 5-second undo and a recovery panel.' },
    ],
    diagram: `<svg viewBox="0 0 380 80" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="10" width="70" height="60" rx="5" fill="#1e293b" stroke="#3b82f6" stroke-width="1.5"/>
      <text x="40" y="28" text-anchor="middle" fill="#3b82f6" font-size="7" font-weight="700">Search</text>
      <text x="40" y="42" text-anchor="middle" fill="#94a3b8" font-size="5.5">AND / OR</text>
      <text x="40" y="54" text-anchor="middle" fill="#94a3b8" font-size="5.5">NOT / ( )</text>
      <rect x="90" y="10" width="65" height="60" rx="5" fill="#1e293b" stroke="#10b981" stroke-width="1.5"/>
      <text x="122" y="28" text-anchor="middle" fill="#10b981" font-size="7" font-weight="700">Tags</text>
      <text x="122" y="42" text-anchor="middle" fill="#94a3b8" font-size="5.5">smoke</text>
      <text x="122" y="54" text-anchor="middle" fill="#94a3b8" font-size="5.5">regression</text>
      <rect x="170" y="10" width="80" height="60" rx="5" fill="#1e293b" stroke="#a855f7" stroke-width="1.5"/>
      <text x="210" y="28" text-anchor="middle" fill="#a855f7" font-size="7" font-weight="700">Versions</text>
      <text x="210" y="42" text-anchor="middle" fill="#94a3b8" font-size="5.5">Compare</text>
      <text x="210" y="54" text-anchor="middle" fill="#94a3b8" font-size="5.5">Restore</text>
      <rect x="265" y="10" width="55" height="60" rx="5" fill="#1e293b" stroke="#ef4444" stroke-width="1.5"/>
      <text x="292" y="28" text-anchor="middle" fill="#ef4444" font-size="7" font-weight="700">Trash</text>
      <text x="292" y="42" text-anchor="middle" fill="#94a3b8" font-size="5.5">Undo 5s</text>
      <text x="292" y="54" text-anchor="middle" fill="#94a3b8" font-size="5.5">Recover</text>
      <rect x="335" y="10" width="40" height="60" rx="5" fill="#1e293b" stroke="#f59e0b" stroke-width="1.5"/>
      <text x="355" y="35" text-anchor="middle" fill="#f59e0b" font-size="7" font-weight="700">Suite</text>
      <text x="355" y="49" text-anchor="middle" fill="#94a3b8" font-size="5.5">Organized</text>
    </svg>`,
  },

  setup: async (ctx) => {
    deleteTh9DemoFg();
    await ctx.delay(200);
    await seedDemoEnvAndService(ctx);
    await seedTh9FeatureGroup(ctx);
    await ctx.delay(300);
    ctx.navigateToTab('scenarios');
    await ctx.delay(500);
    await expandFirstFg(ctx);
  },

  cleanup: async (ctx) => {
    closeTrashPanel();
    await ctx.delay(100);
    if (isTestEditorOpen()) {
      await closeTestEditorQuiet(ctx);
    }
    clearSearchBar();
    await ctx.delay(100);
    deleteTh9DemoFg();
    await ctx.delay(200);
  },

  steps: [
    // ── Step 1: Search & Filter ──────────────────────────────────
    {
      id: 'th9-search',
      title: 'Search & Filter',
      description:
        'The **search bar** above the Feature Groups tree finds tests by name, URL, HTTP method, ' +
        'and scenario tags. Type a query and matching test cards are highlighted with an accent border. ' +
        'Use boolean operators (`AND`, `OR`, `NOT`) for complex queries.',
      highlight: HAR.SEARCH_WRAPPER,
      action: async (ctx) => {
        fillSearchBar('user');
        await ctx.delay(800);

        const count = document.querySelector<HTMLElement>(HAR.SEARCH_COUNT);
        if (count) await spotlight(count, 1200, ctx);

        const match = document.querySelector<HTMLElement>(HAR.SEARCH_MATCH);
        if (match) await spotlight(match, 1500, ctx);

        clearSearchBar();
        await ctx.delay(500);
      },
      preAction: async (ctx) => {
        await ensureTh9Ready(ctx);
        clearSearchBar();
      },
      verify: HAR.SEARCH_WRAPPER,
    },

    // ── Step 2: Scenario Tags ────────────────────────────────────
    {
      id: 'th9-tags',
      title: 'Scenario Tags',
      description:
        'Tags on scenarios (like **smoke**, **regression**, **critical**) help categorize your test suite. ' +
        'They are searchable and can be used to filter runs in the Parameterized Runner. ' +
        'Click the **+** button on any scenario header to add a tag.',
      highlight: HAR.TAG_PILL,
      action: async (ctx) => {
        const addBtn = document.querySelector<HTMLElement>(HAR.TAG_ADD_BTN);
        if (addBtn) {
          addBtn.click();
          await ctx.delay(500);

          const tagInput = document.querySelector<HTMLInputElement>(HAR.TAG_INPUT);
          if (tagInput) {
            const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
            nativeSetter?.call(tagInput, 'regression');
            tagInput.dispatchEvent(new Event('input', { bubbles: true }));
            await ctx.delay(400);
            tagInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
            await ctx.delay(600);
          }
        }

        const pills = document.querySelectorAll<HTMLElement>(HAR.TAG_PILL);
        const newPill = pills.length > 1 ? pills[pills.length - 1] : pills[0];
        if (newPill) await spotlight(newPill, 1000, ctx);
      },
      preAction: async (ctx) => {
        await ensureTh9Ready(ctx);
        clearSearchBar();
      },
      verify: HAR.TAG_PILL,
    },

    // ── Step 3: Version History ──────────────────────────────────
    {
      id: 'th9-versioning',
      title: 'Test Definition Versions',
      description:
        'RedfireForge automatically snapshots test definitions when you save changes. The **History** tab ' +
        'in the Test Editor shows all snapshots with timestamps and change summaries. Select two versions ' +
        'to **Compare** them, or click **↩ Restore** to load an older snapshot into the editor.',
      highlight: HAR.TEST_EDIT_BTN,
      action: async (ctx) => {
        if (!isTestEditorOpen()) {
          await expandFirstFg(ctx);
          await expandFirstScenario(ctx);
          await ctx.delay(300);
          const editBtn = document.querySelector<HTMLElement>(HAR.TEST_EDIT_BTN);
          if (editBtn) {
            editBtn.click();
            await ctx.delay(700);
          }
        }

        const historyTab = Array.from(document.querySelectorAll<HTMLElement>('.builder-tab'))
          .find(t => t.textContent?.includes('History'));
        if (historyTab) {
          historyTab.click();
          await ctx.delay(600);
        }

        await spotlightSel(ctx, HAR.VERSION_PANEL, 1500);

        const items = document.querySelectorAll<HTMLElement>(HAR.VERSION_ITEM);
        if (items.length > 0) {
          await spotlight(items[0], 800, ctx);
          if (items.length > 1) {
            await spotlight(items[1], 800, ctx);
          }
        }

        const restoreBtn = document.querySelector<HTMLElement>(HAR.VERSION_RESTORE_BTN);
        if (restoreBtn) await spotlight(restoreBtn, 1000, ctx);

        await closeTestEditorQuiet(ctx);
        await ctx.delay(300);
      },
      preAction: async (ctx) => {
        await ensureTh9Ready(ctx);
        clearSearchBar();
        if (isTestEditorOpen()) await closeTestEditorQuiet(ctx);
      },
      verify: HAR.FG_CARD,
    },

    // ── Step 4: Delete & Undo ────────────────────────────────────
    {
      id: 'th9-delete-undo',
      title: 'Delete & Undo',
      description:
        'When you delete a test, a **5-second undo toast** appears at the bottom of the screen. ' +
        'Click **Undo** to immediately restore the test to its original location. If the toast ' +
        'expires, the item moves to the **Trash** for later recovery.',
      highlight: HAR.TEST_ACTIONS,
      action: async (ctx) => {
        await expandFirstFg(ctx);
        await expandFirstScenario(ctx);
        await ctx.delay(300);

        const deleteBtn = document.querySelector<HTMLElement>(HAR.TEST_DELETE_BTN);
        if (deleteBtn) {
          deleteBtn.click();
          await ctx.delay(500);

          const confirmBtn = document.querySelector<HTMLElement>('.confirm-modal .btn-danger');
          if (confirmBtn) {
            confirmBtn.click();
            await ctx.delay(800);
          }
        }

        const toast = document.querySelector<HTMLElement>(HAR.TRASH_TOAST);
        if (toast) await spotlight(toast, 1500, ctx);

        const undoBtn = findUndoButton();
        if (undoBtn) {
          undoBtn.click();
          await ctx.delay(600);
        }

        await spotlightSel(ctx, HAR.TEST_CARD, 1000);
      },
      preAction: async (ctx) => {
        await ensureTh9Ready(ctx);
        clearSearchBar();
        if (isTestEditorOpen()) await closeTestEditorQuiet(ctx);
      },
      verify: HAR.TEST_CARD,
    },

    // ── Step 5: Trash Panel ──────────────────────────────────────
    {
      id: 'th9-trash-panel',
      title: 'The Trash Panel',
      description:
        'Items that pass the undo window move to the **Trash**. Click the Trash button in the header ' +
        'to browse deleted items — each has **Restore** and **Permanent Delete** options. ' +
        'Trash has configurable retention and max-item limits.',
      highlight: HAR.PAGE_HEADER,
      action: async (ctx) => {
        await expandFirstFg(ctx);
        const scHeaders = document.querySelectorAll<HTMLElement>(HAR.SCENARIO_HEADER);
        if (scHeaders.length > 1) {
          const expandIcon = scHeaders[1].querySelector('.expand-icon');
          if (expandIcon && !expandIcon.classList.contains('expanded')) {
            scHeaders[1].click();
            await ctx.delay(400);
          }
        }

        const allDeleteBtns = document.querySelectorAll<HTMLElement>(HAR.TEST_DELETE_BTN);
        const lastDeleteBtn = allDeleteBtns[allDeleteBtns.length - 1];
        if (lastDeleteBtn) {
          lastDeleteBtn.click();
          await ctx.delay(500);
          const confirmBtn = document.querySelector<HTMLElement>('.confirm-modal .btn-danger');
          if (confirmBtn) {
            confirmBtn.click();
            await ctx.delay(6000);
          }
        }

        const trashBtn = findTrashButton();
        if (trashBtn) {
          await spotlight(trashBtn, 1200, ctx);
          trashBtn.click();
          await ctx.delay(700);
        }

        const trashItem = document.querySelector<HTMLElement>(HAR.TRASH_ITEM);
        if (trashItem) await spotlight(trashItem, 1500, ctx);

        const restoreBtn = document.querySelector<HTMLElement>(HAR.TRASH_ITEM_RESTORE);
        if (restoreBtn) {
          restoreBtn.click();
          await ctx.delay(600);
        }

        closeTrashPanel();
        await ctx.delay(300);
      },
      preAction: async (ctx) => {
        await ensureTh9Ready(ctx);
        clearSearchBar();
        if (isTestEditorOpen()) await closeTestEditorQuiet(ctx);
        closeTrashPanel();
      },
      verify: HAR.FG_CARD,
    },
  ],
};
