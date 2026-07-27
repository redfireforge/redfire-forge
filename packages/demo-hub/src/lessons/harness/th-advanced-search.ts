/**
 * TH-16: Advanced Search & Drag-Drop
 *
 * Boolean search operators, copy/move test modals, test card action bar,
 * and drag handles for reorganizing the test hierarchy.
 */
import type { DemoLesson, DemoActionContext } from '../../types';
import { HAR } from '@shared/selectors';
import {
  seedDemoEnvAndService,
  seedTh16FeatureGroups,
  deleteTh16DemoFgs,
  ensureTh16FgsExist,
  expandFirstFg,
  expandFirstScenario,
  spotlight,
  fillSearchBar,
  clearSearchBar,
  closePopupModal,
  findTestCardAction,
} from './th-demo-helpers';

/* ── local helpers ──────────────────────────────────────────── */

async function ensureTh16Ready(ctx: DemoActionContext): Promise<void> {
  await ensureTh16FgsExist(ctx);
  if (!document.querySelector(HAR.FG_CARD)) {
    ctx.navigateToTab('scenarios');
    await ctx.delay(500);
  }
  await expandFirstFg(ctx);
  await expandFirstScenario(ctx);
}

function isSearchHelpOpen(): boolean {
  return !!document.querySelector(HAR.SEARCH_HELP);
}

function closeSearchHelp(): void {
  if (!isSearchHelpOpen()) return;
  const btn = document.querySelector<HTMLElement>(HAR.SEARCH_HELP_BTN);
  if (btn) btn.click();
}

function isPopupModalOpen(): boolean {
  return !!document.querySelector('.popup-modal');
}

function getFirstTestCard(): HTMLElement | null {
  return document.querySelector<HTMLElement>(HAR.TEST_CARD);
}

/* ── lesson definition ──────────────────────────────────────── */

export const thAdvancedSearchLesson: DemoLesson = {
  id: 'th-advanced-search',
  domainId: 'harness',
  category: 'analysis',
  name: 'Advanced Search & Drag-Drop',
  description:
    'Use boolean search operators to find tests across all properties, copy and move tests ' +
    'between scenarios and Feature Groups, and discover the inline action bar and drag handles.',
  estimatedMinutes: 5,
  initialTab: 'scenarios',
  allowedTabs: ['scenarios'],
  concept: {
    title: 'Search & Reorganize',
    body:
      'As your test suite grows, you need tools to find and reorganize:\n\n' +
      '- **Search** with AND/OR/NOT and parentheses across name, URL, method, tags, and more\n' +
      '- **Copy** to duplicate a test to any scenario in any Feature Group\n' +
      '- **Move** to relocate a test permanently\n' +
      '- **Drag handles** (⠿) for quick reorder within scenarios or cross-scenario moves',
    keyTerms: [
      { term: 'Boolean Search', definition: 'AND, OR, NOT operators with parentheses for complex queries.' },
      { term: 'Copy / Move', definition: 'Duplicate or relocate tests across scenarios and Feature Groups.' },
      { term: 'Drag Handle', definition: 'Grip icon for reordering tests within or between scenarios.' },
    ],
    diagram: `<svg viewBox="0 0 380 80" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="10" width="100" height="60" rx="5" fill="#1e293b" stroke="#3b82f6" stroke-width="1.5"/>
      <text x="55" y="28" text-anchor="middle" fill="#3b82f6" font-size="7" font-weight="700">Search Bar</text>
      <text x="55" y="42" text-anchor="middle" fill="#94a3b8" font-size="5.5">GET AND users</text>
      <text x="55" y="54" text-anchor="middle" fill="#94a3b8" font-size="5.5">NOT auth OR admin</text>
      <path d="M110 40 L140 40" stroke="#64748b" stroke-width="1.2" marker-end="url(#th16arr)"/>
      <rect x="145" y="10" width="80" height="60" rx="5" fill="#1e293b" stroke="#10b981" stroke-width="1.5"/>
      <text x="185" y="28" text-anchor="middle" fill="#10b981" font-size="7" font-weight="700">Results</text>
      <text x="185" y="42" text-anchor="middle" fill="#94a3b8" font-size="5.5">Filtered tests</text>
      <text x="185" y="54" text-anchor="middle" fill="#94a3b8" font-size="5.5">Highlighted</text>
      <path d="M230 25 L260 15" stroke="#64748b" stroke-width="1" marker-end="url(#th16arr)"/>
      <path d="M230 55 L260 65" stroke="#64748b" stroke-width="1" marker-end="url(#th16arr)"/>
      <rect x="265" y="5" width="50" height="25" rx="4" fill="#1e293b" stroke="#a855f7" stroke-width="1.2"/>
      <text x="290" y="21" text-anchor="middle" fill="#a855f7" font-size="6.5" font-weight="600">Copy</text>
      <rect x="265" y="50" width="50" height="25" rx="4" fill="#1e293b" stroke="#f59e0b" stroke-width="1.2"/>
      <text x="290" y="66" text-anchor="middle" fill="#f59e0b" font-size="6.5" font-weight="600">Move</text>
      <rect x="330" y="20" width="45" height="40" rx="4" fill="#1e293b" stroke="#64748b" stroke-width="1.2"/>
      <text x="352" y="37" text-anchor="middle" fill="#94a3b8" font-size="6.5">⠿</text>
      <text x="352" y="51" text-anchor="middle" fill="#94a3b8" font-size="5.5">Drag</text>
      <defs><marker id="th16arr" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
        <polygon points="0 0, 8 3, 0 6" fill="#64748b"/></marker></defs>
    </svg>`,
  },

  setup: async (ctx) => {
    deleteTh16DemoFgs();
    await ctx.delay(200);
    await seedDemoEnvAndService(ctx);
    await seedTh16FeatureGroups(ctx);
    await ctx.delay(300);
    ctx.navigateToTab('scenarios');
    await ctx.delay(500);
    await expandFirstFg(ctx);
    await expandFirstScenario(ctx);
  },

  cleanup: async (ctx) => {
    clearSearchBar();
    closeSearchHelp();
    closePopupModal();
    await ctx.delay(200);
    deleteTh16DemoFgs();
    await ctx.delay(200);
  },

  steps: [
    // ── Step 1: Search & Boolean Operators ───────────────────────
    {
      id: 'th16-search-filter',
      title: 'Search & Boolean Operators',
      description:
        'The **search bar** filters the entire tree in real time. Type a term and only matching ' +
        'Feature Groups, scenarios, and tests remain visible — matches highlighted with an accent ' +
        'border. Use **AND**, **OR**, **NOT**, and parentheses for precise filtering. The search ' +
        'covers name, URL, method, headers, body, auth type, and tags.',
      highlight: HAR.SEARCH_INPUT,
      action: async (ctx) => {
        fillSearchBar('user');
        await ctx.delay(800);

        const matchCount = document.querySelector<HTMLElement>(HAR.SEARCH_COUNT);
        if (matchCount) await spotlight(matchCount, 800, ctx);

        const firstMatch = document.querySelector<HTMLElement>(HAR.SEARCH_MATCH);
        if (firstMatch) await spotlight(firstMatch, 1000, ctx);

        clearSearchBar();
        await ctx.delay(400);

        fillSearchBar('POST AND users');
        await ctx.delay(800);

        const postMatch = document.querySelector<HTMLElement>(HAR.SEARCH_MATCH);
        if (postMatch) await spotlight(postMatch, 1200, ctx);

        clearSearchBar();
        await ctx.delay(400);
      },
      preAction: async (ctx) => {
        await ensureTh16Ready(ctx);
        closeSearchHelp();
        closePopupModal();
        clearSearchBar();
      },
      verify: HAR.SEARCH_INPUT,
    },

    // ── Step 2: Search Syntax Help Panel ────────────────────────
    {
      id: 'th16-search-help',
      title: 'Search Syntax Help Panel',
      description:
        'Click the **?** button next to the search bar to open the syntax reference. ' +
        'It shows all supported operators: substring match, **"exact phrase"** with word ' +
        'boundaries, **AND**/**OR**/**NOT** boolean operators, parentheses for grouping, ' +
        'and **-term** exclusion shorthand.',
      highlight: HAR.SEARCH_HELP,
      action: async (ctx) => {
        const helpPanel = document.querySelector<HTMLElement>(HAR.SEARCH_HELP);
        if (helpPanel) await spotlight(helpPanel, 1500, ctx);

        closeSearchHelp();
        await ctx.delay(400);
      },
      preAction: async (ctx) => {
        await ensureTh16Ready(ctx);
        closePopupModal();
        clearSearchBar();
        if (!isSearchHelpOpen()) {
          const btn = document.querySelector<HTMLElement>(HAR.SEARCH_HELP_BTN);
          if (btn) {
            btn.click();
            await ctx.delay(400);
          }
        }
      },
      verify: HAR.SEARCH_WRAPPER,
    },

    // ── Step 3: Copy Test to Another Scenario ───────────────────
    {
      id: 'th16-copy-test',
      title: 'Copy Test to Another Scenario',
      description:
        'The **Copy** button on a test card opens a modal where you choose the target ' +
        '**Feature Group** and **Scenario**. Copy creates an independent duplicate — ' +
        'changes to the copy don\'t affect the original. This is useful for creating ' +
        'variations of a test across different scenarios.',
      highlight: '.popup-modal',
      action: async (ctx) => {
        const modal = document.querySelector<HTMLElement>('.popup-modal');
        if (modal) {
          const banner = modal.querySelector<HTMLElement>('.popup-modal-banner');
          if (banner) await spotlight(banner, 800, ctx);

          const fields = modal.querySelectorAll<HTMLElement>('.popup-modal-field');
          for (const field of fields) {
            await spotlight(field, 800, ctx);
          }
        }

        closePopupModal();
        await ctx.delay(400);
      },
      preAction: async (ctx) => {
        await ensureTh16Ready(ctx);
        clearSearchBar();
        closeSearchHelp();
        if (isPopupModalOpen()) {
          const modalText = document.querySelector<HTMLElement>('.popup-modal')?.textContent ?? '';
          if (modalText.includes('Copy Test')) return;
          closePopupModal();
          await ctx.delay(300);
        }
        const card = getFirstTestCard();
        if (card) {
          const copyBtn = findTestCardAction(card, 'Copy');
          if (copyBtn) {
            copyBtn.click();
            await ctx.delay(500);
          }
        }
      },
      verify: HAR.FG_CARD,
    },

    // ── Step 4: Move Test Between Scenarios ─────────────────────
    {
      id: 'th16-move-test',
      title: 'Move Test Between Scenarios',
      description:
        'The **Move** button opens a modal to relocate the test permanently. Select a ' +
        '**Target Feature Group** and **Target Scenario** — the test disappears from its ' +
        'original location and appears in the new one. Same-location moves are blocked ' +
        'with a warning. This is how you reorganize as your suite grows.',
      highlight: '.popup-modal',
      action: async (ctx) => {
        const modal = document.querySelector<HTMLElement>('.popup-modal');
        if (modal) {
          const banner = modal.querySelector<HTMLElement>('.popup-modal-banner');
          if (banner) await spotlight(banner, 800, ctx);

          const fields = modal.querySelectorAll<HTMLElement>('.popup-modal-field');
          for (const field of fields) {
            await spotlight(field, 800, ctx);
          }
        }

        closePopupModal();
        await ctx.delay(400);
      },
      preAction: async (ctx) => {
        await ensureTh16Ready(ctx);
        clearSearchBar();
        closeSearchHelp();
        if (isPopupModalOpen()) {
          closePopupModal();
          await ctx.delay(300);
        }
        const card = getFirstTestCard();
        if (card) {
          const moveBtn = findTestCardAction(card, 'Move');
          if (moveBtn) {
            moveBtn.click();
            await ctx.delay(500);
          }
        }
      },
      verify: HAR.FG_CARD,
    },

    // ── Step 5: Test Card Action Bar & Drag Handle ──────────────
    {
      id: 'th16-test-actions',
      title: 'Test Card Action Bar',
      description:
        'Every test card has an inline action bar: **Edit**, **Copy**, **Move**, **Export**, ' +
        'and **Delete**. The **drag handle** (⠿) on the left of each test and scenario card ' +
        'lets you reorder within a scenario or drag between scenarios and Feature Groups — ' +
        'all without opening any modal.',
      highlight: HAR.TEST_ACTIONS,
      action: async (ctx) => {
        const card = getFirstTestCard();
        if (!card) return;

        const actions = card.querySelector<HTMLElement>('.test-card-actions');
        if (actions) await spotlight(actions, 1500, ctx);

        const dragHandle = card.querySelector<HTMLElement>(HAR.DRAG_HANDLE);
        if (dragHandle) await spotlight(dragHandle, 1000, ctx);
      },
      preAction: async (ctx) => {
        await ensureTh16Ready(ctx);
        clearSearchBar();
        closeSearchHelp();
        if (isPopupModalOpen()) {
          closePopupModal();
          await ctx.delay(300);
        }
      },
      verify: HAR.TEST_CARD,
    },
  ],
};
