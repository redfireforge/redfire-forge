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
  spotlightSearchMatchGroups,
  fillSearchBar,
  clearSearchBar,
  closePopupModal,
  findTestCardAction,
  TH16_SC_USER,
  TH16_SC_PROFILE,
  TH16_SC_ADMIN,
  TH16_FG2_NAME,
  TH16_TEST_GET_USER,
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

function findScenarioCardByName(name: string): HTMLElement | null {
  return Array.from(document.querySelectorAll<HTMLElement>(HAR.SCENARIO_CARD))
    .find((card) => {
      const header = card.querySelector(HAR.SCENARIO_HEADER);
      return header?.textContent?.includes(name) ?? false;
    }) ?? null;
}

async function expandScenarioByName(ctx: DemoActionContext, name: string): Promise<void> {
  const card = findScenarioCardByName(name);
  if (!card) return;
  const header = card.querySelector<HTMLElement>(HAR.SCENARIO_HEADER);
  if (!header) return;
  const expandIcon = header.querySelector('.expand-icon');
  if (expandIcon && !expandIcon.classList.contains('expanded')) {
    header.click();
    await ctx.delay(400);
  }
}

function findTestCardInScenario(scenarioName: string, testName: string): HTMLElement | null {
  const sc = findScenarioCardByName(scenarioName);
  if (!sc) return null;
  return Array.from(sc.querySelectorAll<HTMLElement>(HAR.TEST_CARD))
    .find((card) => {
      const name = card.querySelector('strong')?.textContent?.trim() ?? '';
      return name === testName || card.textContent?.includes(testName);
    }) ?? null;
}

/** Wait for a test card after Copy/Move (React re-render). */
async function waitForTestCardInScenario(
  ctx: DemoActionContext,
  scenarioName: string,
  testName: string,
  attempts = 20,
): Promise<HTMLElement | null> {
  for (let i = 0; i < attempts; i++) {
    const card = findTestCardInScenario(scenarioName, testName);
    if (card) return card;
    await ctx.delay(200);
  }
  return null;
}

/** Scroll to and spotlight a test card, re-querying so the ring is never on a stale node. */
async function spotlightTestCardInScenario(
  ctx: DemoActionContext,
  scenarioName: string,
  testName: string,
  holdMs: number,
): Promise<boolean> {
  const card = await waitForTestCardInScenario(ctx, scenarioName, testName);
  if (!card) return false;
  card.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
  await ctx.delay(300);
  const fresh = findTestCardInScenario(scenarioName, testName);
  if (!fresh) return false;
  await spotlight(fresh, holdMs, ctx);
  return true;
}

/** Pick a CustomSelect option inside the open Copy/Move popup modal. */
async function selectPopupFieldOption(
  ctx: DemoActionContext,
  fieldLabel: string,
  optionLabel: string,
): Promise<void> {
  const modal = document.querySelector<HTMLElement>('.popup-modal');
  if (!modal) return;
  const field = Array.from(modal.querySelectorAll<HTMLElement>('.popup-modal-field'))
    .find((f) => f.querySelector('label')?.textContent?.includes(fieldLabel));
  if (!field) return;

  const trigger = field.querySelector<HTMLElement>('.cs-trigger');
  if (!trigger) return;
  await spotlight(trigger, 800, ctx);
  trigger.click();
  await ctx.delay(350);

  const menu = document.querySelector<HTMLElement>('body > .cs-menu');
  const options = Array.from(
    (menu ?? document).querySelectorAll<HTMLElement>('.cs-item, [role="option"]'),
  );
  const option = options.find((opt) => {
    const text = opt.textContent?.trim() ?? '';
    return text === optionLabel || text.startsWith(optionLabel);
  });
  if (option) {
    await spotlight(option, 700, ctx);
    option.click();
    await ctx.delay(400);
  }
}

async function confirmCopyHere(ctx: DemoActionContext): Promise<void> {
  const modal = document.querySelector<HTMLElement>('.popup-modal');
  if (!modal) return;
  const btn = Array.from(modal.querySelectorAll<HTMLElement>('.btn'))
    .find((b) => b.textContent?.trim() === 'Copy Here');
  if (btn && !(btn as HTMLButtonElement).disabled) {
    await spotlight(btn, 900, ctx);
    btn.click();
    await ctx.delay(700);
  }
}

async function confirmMove(ctx: DemoActionContext): Promise<void> {
  const modal = document.querySelector<HTMLElement>('.popup-modal');
  if (!modal) return;
  const btn = Array.from(modal.querySelectorAll<HTMLElement>('button.btn-primary, .btn'))
    .find((b) => b.textContent?.trim() === 'Move');
  if (btn && !(btn as HTMLButtonElement).disabled) {
    await spotlight(btn, 900, ctx);
    btn.click();
    await ctx.delay(700);
  }
}

async function expandFgByName(ctx: DemoActionContext, name: string): Promise<void> {
  const cards = Array.from(document.querySelectorAll<HTMLElement>(HAR.FG_CARD));
  const card = cards.find((c) => c.querySelector(HAR.FG_NAME)?.textContent?.trim() === name);
  if (!card) return;
  const expand = card.querySelector<HTMLElement>(HAR.FG_EXPAND);
  if (!expand) return;
  const expandIcon = expand.querySelector('.expand-icon');
  if (expandIcon && !expandIcon.classList.contains('expanded')) {
    expand.click();
    await ctx.delay(400);
  }
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
        'border. Use boolean operators for precise filtering — for example **`POST AND users`** ' +
        'matches only tests that contain both terms. Parentheses and **NOT** work too. Search ' +
        'covers name, URL, method, headers, body, auth type, and tags.',
      highlight: HAR.SEARCH_INPUT,
      action: async (ctx) => {
        // ── Simple term: "user" ──────────────────────────────────
        fillSearchBar('user');
        await ctx.delay(1400); // let the tree filter settle so the viewer can see it

        const matchCount = document.querySelector<HTMLElement>(HAR.SEARCH_COUNT);
        if (matchCount) {
          await spotlight(matchCount, 1600, ctx);
          await ctx.delay(400);
        }

        // Spotlight each scenario's matches as one group (e.g. 3 User + 2 Admin)
        await spotlightSearchMatchGroups(ctx, 2000);

        clearSearchBar();
        await ctx.delay(900); // show the full tree return before the boolean query

        // ── Boolean: "POST AND users" ────────────────────────────
        fillSearchBar('POST AND users');
        await ctx.delay(700);

        // Spotlight the query itself so viewers can read the AND expression
        const searchInput = document.querySelector<HTMLElement>(HAR.SEARCH_INPUT);
        if (searchInput) {
          await spotlight(searchInput, 2400, ctx);
          await ctx.delay(500);
        }

        const booleanCount = document.querySelector<HTMLElement>(HAR.SEARCH_COUNT);
        if (booleanCount) {
          await spotlight(booleanCount, 1600, ctx);
          await ctx.delay(400);
        }

        await spotlightSearchMatchGroups(ctx, 2000);

        clearSearchBar();
        await ctx.delay(800);
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
      highlight: HAR.SEARCH_HELP_BTN,
      action: async (ctx) => {
        // Ensure the help panel starts closed so viewers see ? → open
        if (isSearchHelpOpen()) {
          closeSearchHelp();
          await ctx.delay(300);
        }

        const helpBtn = document.querySelector<HTMLElement>(HAR.SEARCH_HELP_BTN);
        if (helpBtn) {
          await spotlight(helpBtn, 1200, ctx);
          helpBtn.click();
          await ctx.delay(800);
        }

        const helpPanel = document.querySelector<HTMLElement>(HAR.SEARCH_HELP);
        if (helpPanel) {
          await spotlight(helpPanel, 1800, ctx);
          await ctx.delay(400);
        }

        closeSearchHelp();
        await ctx.delay(400);
      },
      preAction: async (ctx) => {
        await ensureTh16Ready(ctx);
        closePopupModal();
        clearSearchBar();
        // Keep closed during reading so the spotlight targets the ? badge
        if (isSearchHelpOpen()) closeSearchHelp();
        await ctx.delay(100);
      },
      verify: HAR.SEARCH_WRAPPER,
    },

    // ── Step 3: Copy Test to Another Scenario ───────────────────
    {
      id: 'th16-copy-test',
      title: 'Copy Test to Another Scenario',
      description:
        'Click **Copy** on **Get User by ID**, then choose target scenario **Profile Endpoints** ' +
        'and confirm with **Copy Here**.\n\n' +
        'Copy creates an independent duplicate in the other scenario — changes to the copy ' +
        'don\'t affect the original. We then expand **Profile Endpoints** and highlight the ' +
        'new test card so you can see where it landed.',
      highlight: HAR.TEST_COPY_BTN,
      action: async (ctx) => {
        if (isPopupModalOpen()) {
          closePopupModal();
          await ctx.delay(300);
        }

        // Skip re-copy if a prior run already placed Get User by ID in Profile Endpoints
        let copied = findTestCardInScenario(TH16_SC_PROFILE, TH16_TEST_GET_USER);
        if (!copied) {
          await expandScenarioByName(ctx, TH16_SC_USER);

          const sourceCard = Array.from(document.querySelectorAll<HTMLElement>(HAR.TEST_CARD))
            .find((c) => c.textContent?.includes(TH16_TEST_GET_USER)
              && findScenarioCardByName(TH16_SC_USER)?.contains(c));
          const copyBtn = sourceCard
            ? (sourceCard.querySelector<HTMLElement>(HAR.TEST_COPY_BTN) ?? findTestCardAction(sourceCard, 'Copy'))
            : document.querySelector<HTMLElement>(HAR.TEST_COPY_BTN);

          if (copyBtn) {
            copyBtn.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
            await spotlight(copyBtn, 1400, ctx);
            copyBtn.click();
            await ctx.delay(700);
          }

          const modal = document.querySelector<HTMLElement>('.popup-modal');
          if (modal) {
            await spotlight(modal, 900, ctx);
            const banner = modal.querySelector<HTMLElement>('.popup-modal-banner');
            if (banner) await spotlight(banner, 700, ctx);

            await selectPopupFieldOption(ctx, 'Scenario', TH16_SC_PROFILE);
            await confirmCopyHere(ctx);
          }
        }

        await expandScenarioByName(ctx, TH16_SC_PROFILE);
        await ctx.delay(400);

        copied = findTestCardInScenario(TH16_SC_PROFILE, TH16_TEST_GET_USER);
        if (copied) {
          copied.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
          await spotlight(copied, 2400, ctx);
          await ctx.delay(500);

          const scHeader = findScenarioCardByName(TH16_SC_PROFILE)
            ?.querySelector<HTMLElement>(HAR.SCENARIO_HEADER);
          if (scHeader) {
            await spotlight(scHeader, 1200, ctx);
            await ctx.delay(300);
          }
          await spotlight(copied, 1600, ctx);
        }
      },
      preAction: async (ctx) => {
        await ensureTh16Ready(ctx);
        clearSearchBar();
        closeSearchHelp();
        if (isPopupModalOpen()) {
          closePopupModal();
          await ctx.delay(200);
        }
        await expandScenarioByName(ctx, TH16_SC_USER);
      },
      verify: HAR.TEST_CARD,
    },

    // ── Step 4: Move Test Between Scenarios ─────────────────────
    {
      id: 'th16-move-test',
      title: 'Move Test Between Scenarios',
      description:
        'Click **Move** on **Get User by ID** (still under **User Endpoints**), choose ' +
        '**Admin API Tests** → **Admin Operations**, then confirm **Move**.\n\n' +
        'The test leaves its original scenario permanently and appears in the new one. ' +
        'Same-location moves are blocked with a warning. We then expand the Admin group ' +
        'and highlight the moved test card.',
      highlight: HAR.TEST_MOVE_BTN,
      action: async (ctx) => {
        if (isPopupModalOpen()) {
          closePopupModal();
          await ctx.delay(300);
        }

        // Expand Admin first so a prior-run relocate is visible when the FG was collapsed
        await expandFgByName(ctx, TH16_FG2_NAME);
        await expandScenarioByName(ctx, TH16_SC_ADMIN);

        // Skip re-move if a prior run already relocated Get User by ID into Admin Operations
        const moved = findTestCardInScenario(TH16_SC_ADMIN, TH16_TEST_GET_USER);
        if (!moved) {
          await expandScenarioByName(ctx, TH16_SC_USER);

          const sourceCard = Array.from(document.querySelectorAll<HTMLElement>(HAR.TEST_CARD))
            .find((c) => c.textContent?.includes(TH16_TEST_GET_USER)
              && findScenarioCardByName(TH16_SC_USER)?.contains(c));
          const moveBtn = sourceCard
            ? (sourceCard.querySelector<HTMLElement>(HAR.TEST_MOVE_BTN) ?? findTestCardAction(sourceCard, 'Move'))
            : document.querySelector<HTMLElement>(HAR.TEST_MOVE_BTN);

          if (moveBtn) {
            moveBtn.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
            await spotlight(moveBtn, 1400, ctx);
            moveBtn.click();
            await ctx.delay(700);
          }

          const modal = document.querySelector<HTMLElement>('.popup-modal');
          if (modal) {
            await spotlight(modal, 900, ctx);
            const banner = modal.querySelector<HTMLElement>('.popup-modal-banner');
            if (banner) await spotlight(banner, 700, ctx);

            await selectPopupFieldOption(ctx, 'Target Feature Group', TH16_FG2_NAME);
            await selectPopupFieldOption(ctx, 'Target Scenario', TH16_SC_ADMIN);
            await confirmMove(ctx);
          }
        }

        // Payoff: expand destination and ring the moved test (re-query after React updates)
        await expandFgByName(ctx, TH16_FG2_NAME);
        await expandScenarioByName(ctx, TH16_SC_ADMIN);
        await ctx.delay(500);

        const highlighted = await spotlightTestCardInScenario(
          ctx,
          TH16_SC_ADMIN,
          TH16_TEST_GET_USER,
          2800,
        );
        if (highlighted) await ctx.delay(700);
      },
      preAction: async (ctx) => {
        await ensureTh16Ready(ctx);
        clearSearchBar();
        closeSearchHelp();
        if (isPopupModalOpen()) {
          closePopupModal();
          await ctx.delay(200);
        }
        await expandScenarioByName(ctx, TH16_SC_USER);
      },
      verify: HAR.TEST_CARD,
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
