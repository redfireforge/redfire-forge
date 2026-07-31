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
  ensureTh9VersionHistory,
  openTh9VersionedTestEditor,
  expandFgByName,
  expandScenarioByName,
  TH9_FG_NAME,
  TH9_SC1_NAME,
  TH9_SC2_NAME,
  expandFirstFg,
  expandFirstScenario,
  spotlight,
  spotlightSel,
  spotlightSearchMatchGroups,
  fillSearchBar,
  clearSearchBar,
  isTestEditorOpen,
  closeTestEditorQuiet,
  closeTestDefDiffModal,
  closeTrashPanel,
} from './th-demo-helpers';

async function ensureTh9Ready(ctx: DemoActionContext): Promise<void> {
  await ensureTh9FgExists(ctx);
  if (!document.querySelector(HAR.FG_CARD)) {
    ctx.navigateToTab('scenarios');
    await ctx.delay(500);
  }
  // Prefer Organization Demo — never expand an unrelated first FG (e.g. "test1")
  const hasOrgDemo = Array.from(document.querySelectorAll(HAR.FG_NAME))
    .some((el) => el.textContent?.trim() === TH9_FG_NAME);
  if (hasOrgDemo) {
    await expandFgByName(ctx, TH9_FG_NAME);
  } else {
    await expandFirstFg(ctx);
  }
}

/** Find the Trash button in the Scenario Builder header by label text. */
function findTrashButton(): HTMLElement | null {
  const btns = document.querySelectorAll<HTMLElement>('.header-actions .btn');
  return Array.from(btns).find(b => b.textContent?.includes('Trash')) ?? null;
}

/** Collapse expanded scenarios so test-row actions (Delete/Move) stay out of view. */
function collapseExpandedScenarios(): void {
  const headers = document.querySelectorAll<HTMLElement>(HAR.SCENARIO_HEADER);
  for (const header of headers) {
    const expandIcon = header.querySelector('.expand-icon');
    if (expandIcon?.classList.contains('expanded')) {
      header.click();
    }
  }
}

/**
 * Quietly ensure Trash has at least `minCount` items so step 5 can Restore one
 * and still click Empty Trash afterward.
 */
async function ensureTrashHasItemsQuiet(
  ctx: DemoActionContext,
  minCount = 2,
): Promise<void> {
  const trashBtn =
    document.querySelector<HTMLElement>(HAR.TRASH_BTN) ?? findTrashButton();
  const badge = trashBtn?.querySelector('.count-badge');
  let count = badge ? Number.parseInt(badge.textContent?.trim() || '0', 10) : 0;
  if (Number.isNaN(count)) count = 0;
  if (count >= minCount) return;

  for (let i = count; i < minCount; i++) {
    await expandFgByName(ctx, TH9_FG_NAME);
    if (i % 2 === 1) {
      await expandScenarioByName(ctx, TH9_SC2_NAME);
    } else {
      await expandScenarioByName(ctx, TH9_SC1_NAME);
    }
    await ctx.delay(150);

    const deleteBtn = document.querySelector<HTMLElement>(HAR.TEST_DELETE_BTN);
    if (!deleteBtn) return;
    deleteBtn.click();
    await ctx.delay(400);
    findPopupConfirmButton()?.click();
    await ctx.delay(500);

    document.querySelector<HTMLElement>('.trash-toast-dismiss')?.click();
    await ctx.delay(200);
  }
}

/** Pick a trash card to restore — prefer a TEST so we can spotlight it in the tree. */
function pickTrashRestoreTarget(): { card: HTMLElement; name: string; typeLabel: string } | null {
  const cards = Array.from(document.querySelectorAll<HTMLElement>(HAR.TRASH_ITEM));
  if (cards.length === 0) return null;
  const preferred = cards.find((c) => {
    const type = c.querySelector('.trash-card-type')?.textContent?.trim() ?? '';
    return /^TEST$/i.test(type);
  });
  const card = preferred ?? cards[0];
  return {
    card,
    name: card.querySelector('.trash-card-name')?.textContent?.trim() ?? '',
    typeLabel: card.querySelector('.trash-card-type')?.textContent?.trim() ?? '',
  };
}

/** After restore, expand the tree and spotlight the entity that came back. */
async function spotlightRestoredEntity(
  ctx: DemoActionContext,
  name: string,
  typeLabel: string,
): Promise<void> {
  if (!name) return;

  await expandFirstFg(ctx);
  const headers = document.querySelectorAll<HTMLElement>(HAR.SCENARIO_HEADER);
  for (const header of headers) {
    const expandIcon = header.querySelector('.expand-icon');
    if (!expandIcon?.classList.contains('expanded')) {
      header.click();
      await ctx.delay(250);
    }
  }
  await ctx.delay(500);

  if (/FEATURE\s*GROUP/i.test(typeLabel)) {
    const fgNames = document.querySelectorAll<HTMLElement>(HAR.FG_NAME);
    const match = Array.from(fgNames).find((el) => el.textContent?.trim() === name);
    if (match) {
      const card = match.closest<HTMLElement>(HAR.FG_CARD) ?? match;
      await spotlight(card, 2200, ctx);
      await ctx.delay(600);
      return;
    }
  }

  if (/SCENARIO/i.test(typeLabel)) {
    const scMatch = Array.from(headers).find((h) =>
      h.textContent?.toLowerCase().includes(name.toLowerCase()),
    );
    if (scMatch) {
      await spotlight(scMatch, 2200, ctx);
      await ctx.delay(600);
      return;
    }
  }

  const tests = document.querySelectorAll<HTMLElement>(HAR.TEST_CARD);
  const test = Array.from(tests).find(
    (t) => t.querySelector('strong')?.textContent?.trim() === name,
  );
  if (test) {
    await spotlight(test, 2200, ctx);
    await ctx.delay(600);
  }
}

/** Find the Undo button inside the trash toast by label text. */
function findUndoButton(): HTMLElement | null {
  const toast = document.querySelector<HTMLElement>(HAR.TRASH_TOAST);
  if (!toast) return null;
  const btns = toast.querySelectorAll<HTMLElement>('button');
  return Array.from(btns).find(b => b.textContent?.trim() === 'Undo') ?? btns[0] ?? null;
}

/** Find the danger confirm action inside popup confirm modals (e.g., Move to Trash). */
function findPopupConfirmButton(): HTMLElement | null {
  const btns = document.querySelectorAll<HTMLElement>('.popup-modal .popup-modal-footer .btn');
  return Array.from(btns).find((b) => {
    const label = b.textContent?.trim() ?? '';
    return b.classList.contains('btn-danger') || /move to trash|delete|confirm/i.test(label);
  }) ?? null;
}

/** Close any leftover popup confirm modal by pressing Cancel. */
function closePopupConfirmIfOpen(): void {
  const modal = document.querySelector<HTMLElement>('.popup-modal');
  if (!modal) return;
  const btns = modal.querySelectorAll<HTMLElement>('.popup-modal-footer .btn');
  const cancelBtn = Array.from(btns).find((b) => /cancel|close/i.test(b.textContent?.trim() ?? ''));
  cancelBtn?.click();
}

export const thAdvancedFeaturesLesson: DemoLesson = {
  id: 'th-advanced-features',
  domainId: 'harness',
  category: 'analysis',
  name: 'Versioning, Trash & Organization',
  description:
    'Search across all tests, tag scenarios for organization, explore definition version history, ' +
    'and recover deleted items from the Trash.',
  estimatedMinutes: 6,
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
      { term: 'Version Compare', definition: 'Select two History snapshots to open a side-by-side definition diff (Overview, Headers, Body, Auth, Extractions).' },
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

        await spotlightSearchMatchGroups(ctx, 1800);

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
        await expandScenarioByName(ctx, TH9_SC1_NAME);
      },
      verify: HAR.TAG_PILL,
    },

    // ── Step 3: Version History ──────────────────────────────────
    {
      id: 'th9-versioning',
      title: 'Test Definition Versions',
      description:
        'RedfireForge automatically snapshots test definitions when you save changes.\n\n' +
        '**Where to look:** click **Edit** on a test card, then open the **History** tab ' +
        'in the Test Editor.\n\n' +
        'History shows every snapshot with a timestamp and change summary. ' +
        '**Select two versions** with the checkboxes, then click **Compare** — the diff modal ' +
        'highlights name, URL, and header changes across Overview / Headers tabs. ' +
        'Click **↩ Restore** on an older snapshot to load it into the editor — a **Version restored** ' +
        'toast confirms the load (Save to persist).',
      highlight: HAR.TEST_EDIT_BTN,
      preAction: async (ctx) => {
        clearSearchBar();
        closeTestDefDiffModal();
        if (isTestEditorOpen()) await closeTestEditorQuiet(ctx);
        // Re-seed so History always has the 2 definition versions (upsert)
        await ensureTh9VersionHistory(ctx);
        await ctx.delay(400);
      },
      action: async (ctx) => {
        // Open the seeded versioned test — not whatever is first in the tree
        await openTh9VersionedTestEditor(ctx);

        // Point at the History tab before opening it
        await ctx.waitFor(HAR.TE_HISTORY_TAB);
        await spotlightSel(ctx, HAR.TE_HISTORY_TAB, 2200);
        await ctx.delay(500);
        await ctx.click(HAR.TE_HISTORY_TAB);
        await ctx.delay(1000);

        // Definition History panel — one panel spotlight, then straight into Compare
        // (do not spotlight each row first; that duplicates the select-for-compare tour)
        await spotlightSel(ctx, HAR.VERSION_PANEL, 2000);
        await ctx.delay(600);

        const items = document.querySelectorAll<HTMLElement>(HAR.VERSION_ITEM);

        // Select two versions → Compare → tour the definition diff modal
        if (items.length >= 2) {
          const check0 = items[0].querySelector<HTMLElement>('input[type="checkbox"]');
          const check1 = items[1].querySelector<HTMLElement>('input[type="checkbox"]');
          if (check0) {
            await spotlight(check0, 1200, ctx);
            await ctx.delay(400);
          }
          items[0].click();
          await ctx.delay(500);
          if (check1) {
            await spotlight(check1, 1200, ctx);
            await ctx.delay(400);
          }
          items[1].click();
          await ctx.delay(700);

          await ctx.waitFor(HAR.VERSION_COMPARE_BTN);
          await spotlightSel(ctx, HAR.VERSION_COMPARE_BTN, 1600);
          await ctx.delay(500);
          await ctx.click(HAR.VERSION_COMPARE_BTN);
          await ctx.delay(1200);

          const diffModal = document.querySelector<HTMLElement>(HAR.TEST_DEF_DIFF_MODAL);
          if (diffModal) {
            const overviewRows = diffModal.querySelectorAll<HTMLElement>(HAR.TEST_DEF_DIFF_ROW);
            for (const row of overviewRows) {
              await spotlight(row, 1400, ctx);
              await ctx.delay(450);
            }
            if (overviewRows.length === 0) {
              await spotlight(diffModal, 1600, ctx);
              await ctx.delay(500);
            }

            const hdrTab = Array.from(
              diffModal.querySelectorAll<HTMLElement>(HAR.TEST_DEF_DIFF_TAB),
            ).find((t) => t.textContent?.includes('Headers'));
            if (hdrTab) {
              await spotlight(hdrTab, 1000, ctx);
              await ctx.delay(400);
              hdrTab.click();
              await ctx.delay(1000);

              const hdrRows = diffModal.querySelectorAll<HTMLElement>(HAR.TEST_DEF_DIFF_HEADERS_ROW);
              for (const row of hdrRows) {
                await spotlight(row, 1400, ctx);
                await ctx.delay(450);
              }
            }

            closeTestDefDiffModal();
            await ctx.delay(800);
          }

          // Clear dual-row selection so Restore is not fighting blue selected highlights
          const clearBtn = document.querySelector<HTMLElement>(HAR.VERSION_CLEAR_SELECTION);
          if (clearBtn) {
            clearBtn.click();
            await ctx.delay(400);
          }
        }

        // Restore older snapshot → confirm with toast
        const versionItems = document.querySelectorAll<HTMLElement>(HAR.VERSION_ITEM);
        if (versionItems.length > 0) {
          const olderItem = versionItems[versionItems.length - 1];
          await spotlight(olderItem, 1400, ctx);
          await ctx.delay(500);

          const restoreBtn = olderItem.querySelector<HTMLElement>(HAR.VERSION_RESTORE_BTN);
          if (restoreBtn) {
            await spotlight(restoreBtn, 1800, ctx);
            await ctx.delay(600);
            restoreBtn.click();
            await ctx.delay(700);

            // Wait for the "Version restored" toast and spotlight it
            for (let i = 0; i < 20; i++) {
              const toast = document.querySelector<HTMLElement>(HAR.WF_TOAST);
              if (toast) {
                await spotlight(toast, 2200, ctx);
                await ctx.delay(600);
                break;
              }
              await ctx.delay(150);
            }
          }
        }

        await closeTestEditorQuiet(ctx);
        await ctx.delay(700);
      },
      verify: HAR.TEST_EDIT_BTN,
    },

    // ── Step 4: Delete & Undo ────────────────────────────────────
    {
      id: 'th9-delete-undo',
      title: 'Delete & Undo',
      description:
        'When you delete a test, a **5-second undo toast** appears at the bottom of the screen. ' +
        'Watch for the **Undo** button on the toast — click it to immediately restore the test. ' +
        'If the toast expires, the item moves to the **Trash** for later recovery.',
      highlight: HAR.TEST_ACTIONS,
      action: async (ctx) => {
        await expandFirstFg(ctx);
        await expandFirstScenario(ctx);
        await ctx.delay(300);

        const deleteBtn = document.querySelector<HTMLElement>(HAR.TEST_DELETE_BTN);
        if (deleteBtn) {
          deleteBtn.click();
          await ctx.delay(500);

          const confirmBtn = findPopupConfirmButton();
          if (confirmBtn) {
            confirmBtn.click();
            await ctx.delay(800);
          }
        }

        const toast = document.querySelector<HTMLElement>(HAR.TRASH_TOAST);
        if (toast) {
          await spotlight(toast, 1600, ctx);
          await ctx.delay(500);
        }

        const undoBtn =
          document.querySelector<HTMLElement>(HAR.TRASH_TOAST_UNDO) ?? findUndoButton();
        if (undoBtn) {
          await spotlight(undoBtn, 1800, ctx);
          await ctx.delay(500);
          undoBtn.click();
          await ctx.delay(700);
        }

        await spotlightSel(ctx, HAR.TEST_CARD, 1000);
      },
      preAction: async (ctx) => {
        await ensureTh9Ready(ctx);
        clearSearchBar();
        closeTestDefDiffModal();
        closePopupConfirmIfOpen();
        await ctx.delay(150);
        if (isTestEditorOpen()) await closeTestEditorQuiet(ctx);
      },
      verify: HAR.TEST_CARD,
    },

    // ── Step 5: Trash Panel ──────────────────────────────────────
    {
      id: 'th9-trash-panel',
      title: 'The Trash Panel',
      description:
        'Items that pass the undo window move to the **Trash**. Click the **Trash** button in the header ' +
        'to browse deleted items — each has **Restore** and **Permanent Delete** options. ' +
        'After **Restore**, the item reappears in the Feature Groups tree. ' +
        'At the bottom, open **Retention** and try **Empty Trash** — a confirmation modal asks before ' +
        'permanently deleting everything.',
      highlight: HAR.TRASH_BTN,
      action: async (ctx) => {
        // Spotlight Trash button before clicking so the user sees it's the target
        const trashBtn =
          document.querySelector<HTMLElement>(HAR.TRASH_BTN) ?? findTrashButton();
        if (trashBtn) {
          await spotlight(trashBtn, 900, ctx);
          await ctx.delay(150);
          trashBtn.click();
        }

        await ctx.waitFor(HAR.TRASH_PANEL);
        await ctx.delay(200);

        const restoreTarget = pickTrashRestoreTarget();
        if (restoreTarget) {
          await spotlight(restoreTarget.card, 1600, ctx);

          const permanentBtn = restoreTarget.card.querySelector<HTMLElement>(HAR.TRASH_ITEM_DELETE);
          if (permanentBtn) await spotlight(permanentBtn, 1400, ctx);

          const restoreBtn = restoreTarget.card.querySelector<HTMLElement>(HAR.TRASH_ITEM_RESTORE);
          if (restoreBtn) {
            await spotlight(restoreBtn, 1400, ctx);
            restoreBtn.click();
            await ctx.delay(800);
          }
        }

        // Retention dropdown — click to open, then spotlight the options list
        const retention = document.querySelector<HTMLElement>(HAR.TRASH_RETENTION_SELECT);
        const retentionTrigger = retention?.querySelector<HTMLElement>('.cs-trigger');
        if (retention && retentionTrigger) {
          await spotlight(retention, 1200, ctx);
          retentionTrigger.click();
          await ctx.waitFor(HAR.TRASH_SELECT_MENU);
          await ctx.delay(400);

          const menu = document.querySelector<HTMLElement>(HAR.TRASH_SELECT_MENU);
          if (menu) await spotlight(menu, 2000, ctx);

          // Close without changing the value (click trigger again)
          retentionTrigger.click();
          await ctx.delay(400);
        }

        // Empty Trash → confirmation modal (Cancel — do not actually empty)
        const emptyBtn = document.querySelector<HTMLElement>(HAR.TRASH_EMPTY_BTN);
        if (emptyBtn && !(emptyBtn as HTMLButtonElement).disabled) {
          await spotlight(emptyBtn, 1400, ctx);
          emptyBtn.click();
          await ctx.waitFor(HAR.TRASH_CONFIRM_MODAL);
          await ctx.delay(400);

          const confirmModal = document.querySelector<HTMLElement>(HAR.TRASH_CONFIRM_MODAL);
          if (confirmModal) await spotlight(confirmModal, 2200, ctx);

          closePopupConfirmIfOpen();
          await ctx.delay(400);
        }

        closeTrashPanel();
        await ctx.delay(500);

        // Payoff: show the restored entity back in the Feature Groups tree
        if (restoreTarget?.name) {
          await spotlightRestoredEntity(ctx, restoreTarget.name, restoreTarget.typeLabel);
        }
      },
      preAction: async (ctx) => {
        await ensureTh9Ready(ctx);
        clearSearchBar();
        closePopupConfirmIfOpen();
        await ctx.delay(150);
        if (isTestEditorOpen()) await closeTestEditorQuiet(ctx);
        closeTrashPanel();
        await ensureTrashHasItemsQuiet(ctx, 2);
        collapseExpandedScenarios();
      },
      verify: HAR.TRASH_BTN,
    },
  ],
};
