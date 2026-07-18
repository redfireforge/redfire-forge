/** Lesson REQ-6: Definition Versioning & History */
import type { DemoLesson } from '../../types';
import { REQ } from '@shared/selectors';
import { fillControlledInput } from '../setup-helpers';
import {
  ensureRequestsTab,
  navigateToGalleryRequests,
  selectGalleryCard,
  importGallerySample,
  selectRequestByName,
  cleanupRequestsInCollection,
  shrinkAllCollections,
} from './req-demo-helpers';

const SAMPLE_ID = 'req-get-all-users';
const SAMPLE_NAME = 'Get All Users';
const SECOND_SAMPLE_ID = 'req-create-post';
const SECOND_SAMPLE_NAME = 'Create a New Post';
const GALLERY_COL = 'Gallery Samples';
const EDITED_URL_SUFFIX = '?_limit=5';
const HEADER_KEY = 'X-Demo-Version';
const HEADER_VALUE = 'v2';

/**
 * Import a gallery sample silently if it doesn't exist.
 */
async function ensureSampleImported(
  ctx: { delay: (ms: number) => Promise<void>; navigateToTab: (tab: string) => void; waitFor: (sel: string, timeout?: number) => Promise<void>; click: (sel: string) => Promise<void> },
  sampleId: string,
  sampleName: string,
): Promise<void> {
  const existing = document.querySelector(REQ.reqByName(sampleName));
  if (existing) return;
  await navigateToGalleryRequests(ctx as never);
  await selectGalleryCard(ctx as never, sampleId);
  await ctx.delay(150);
  await importGallerySample(ctx as never);
  await ctx.delay(200);
}

export const reqVersioningLesson: DemoLesson = {
  id: 'req-versioning',
  domainId: 'api',
  category: 'requests',
  name: 'Definition Versioning & History',
  description:
    'Never lose a working request. Learn how auto-snapshots, version diff, and restore ' +
    'keep a full audit trail of every change you make.',
  estimatedMinutes: 4,
  initialTab: 'requests',
  allowedTabs: ['requests', 'gallery'],

  concept: {
    title: 'Never Lose a Working Request',
    body:
      'RedfireForge **auto-snapshots** your request definitions whenever you navigate away.\n\n' +
      '**How it works:**\n' +
      '- Edit a request (URL, headers, body, auth)\n' +
      '- Navigate to another request → snapshot fires silently\n' +
      '- Up to **15 versions** per request (oldest pruned automatically)\n\n' +
      '**What you can do with versions:**\n' +
      '- **Compare** any two versions side-by-side (URL, headers, body, auth diffs)\n' +
      '- **Restore** to any previous snapshot with one click\n' +
      '- **Rename** versions for easy identification ("before pagination", "v1-stable")\n\n' +
      'The snapshot is a frozen copy of: name, URL, method, headers, body, body type, and auth.',
    keyTerms: [
      { term: 'Auto-Snapshot', definition: 'Invisible save triggered when you navigate away from an edited request' },
      { term: 'Definition Version', definition: 'A frozen point-in-time copy of URL, method, headers, body, params' },
      { term: 'Version Diff', definition: 'Side-by-side comparison highlighting what changed between two versions' },
      { term: 'Restore', definition: 'One-click revert to any previous definition version' },
    ],
    diagram: `<svg viewBox="0 0 400 100" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="10" width="90" height="30" rx="4" fill="#1e293b" stroke="#3b82f6" stroke-width="1.5"/>
      <text x="55" y="29" text-anchor="middle" fill="#3b82f6" font-size="8">Edit Request</text>
      <path d="M100 25 L135 25" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#arr6)"/>
      <rect x="135" y="10" width="80" height="30" rx="4" fill="#1e293b" stroke="#f59e0b" stroke-width="1.5"/>
      <text x="175" y="29" text-anchor="middle" fill="#f59e0b" font-size="8">Navigate</text>
      <path d="M215 25 L250 25" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#arr6)"/>
      <rect x="250" y="10" width="70" height="30" rx="4" fill="#1e293b" stroke="#10b981" stroke-width="1.5"/>
      <text x="285" y="29" text-anchor="middle" fill="#10b981" font-size="8">Snapshot</text>
      <path d="M320 25 L355 25" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#arr6)"/>
      <rect x="330" y="10" width="60" height="30" rx="4" fill="#1e293b" stroke="#a855f7" stroke-width="1.5"/>
      <text x="360" y="29" text-anchor="middle" fill="#a855f7" font-size="8">History</text>
      <rect x="10" y="55" width="380" height="35" rx="4" fill="#1e293b" stroke="#94a3b8" stroke-width="1" stroke-dasharray="3"/>
      <text x="200" y="71" text-anchor="middle" fill="#94a3b8" font-size="7">Compare ← Diff → Restore</text>
      <text x="200" y="83" text-anchor="middle" fill="#64748b" font-size="6">max 15 versions · oldest auto-pruned</text>
      <defs><marker id="arr6" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6" fill="none" stroke="#94a3b8" stroke-width="1"/></marker></defs>
    </svg>`,
  },

  setup: async (ctx) => {
    ctx.navigateToTab('requests');
    await ctx.delay(150);
    await cleanupRequestsInCollection(ctx, GALLERY_COL, [SAMPLE_NAME, SECOND_SAMPLE_NAME]);
    await shrinkAllCollections();
  },

  cleanup: async (ctx) => {
    await cleanupRequestsInCollection(ctx, GALLERY_COL, [SAMPLE_NAME, SECOND_SAMPLE_NAME]);
    ctx.navigateToTab('requests');
    await ctx.delay(100);
  },

  steps: [
    // ── Step 1: Import Sample ──
    {
      id: 'req6-import',
      title: 'Import a Request to Track',
      description:
        'Import the **"Get All Users"** sample — a simple GET to `jsonplaceholder.typicode.com/users`. ' +
        'We\'ll edit it and watch the versioning system capture every change.',
      highlight: REQ.galleryCard(SAMPLE_ID),
      preAction: async (ctx) => {
        const existing = document.querySelector(REQ.reqByName(SAMPLE_NAME));
        if (existing) return;
        await navigateToGalleryRequests(ctx);
      },
      action: async (ctx) => {
        if (document.querySelector(REQ.reqByName(SAMPLE_NAME))) {
          ensureRequestsTab(ctx);
          await selectRequestByName(ctx, SAMPLE_NAME);
          return;
        }
        await selectGalleryCard(ctx, SAMPLE_ID);
        await ctx.delay(300);
        await importGallerySample(ctx);
        await ctx.delay(400);
      },
    },

    // ── Step 2: Edit the URL ──
    {
      id: 'req6-edit-url',
      title: 'Edit the URL',
      description:
        'Add `?_limit=5` to the URL to fetch only 5 users. This change will be ' +
        'captured in the next auto-snapshot when you navigate away.\n\n' +
        'The versioning system tracks: **URL**, **method**, **headers**, **body**, **auth** — ' +
        'any edit to these fields creates a new version.',
      highlight: REQ.URL_INPUT,
      preAction: async (ctx) => {
        ensureRequestsTab(ctx);
        if (!document.querySelector(REQ.reqByName(SAMPLE_NAME))) {
          await ensureSampleImported(ctx as never, SAMPLE_ID, SAMPLE_NAME);
          ensureRequestsTab(ctx);
        }
        if (!document.querySelector(REQ.reqByName(SECOND_SAMPLE_NAME))) {
          await ensureSampleImported(ctx as never, SECOND_SAMPLE_ID, SECOND_SAMPLE_NAME);
          ensureRequestsTab(ctx);
        }
        await selectRequestByName(ctx, SAMPLE_NAME);
        await ctx.delay(50);
        const secondReq = document.querySelector<HTMLElement>(REQ.reqByName(SECOND_SAMPLE_NAME));
        if (secondReq) { secondReq.click(); await ctx.delay(50); }
        await selectRequestByName(ctx, SAMPLE_NAME);
      },
      action: async (ctx) => {
        const urlInput = document.querySelector<HTMLInputElement>(REQ.URL_INPUT);
        if (!urlInput) return;
        const currentUrl = urlInput.value;
        if (!currentUrl.includes(EDITED_URL_SUFFIX)) {
          fillControlledInput(urlInput, currentUrl + EDITED_URL_SUFFIX);
        }
        await ctx.delay(500);
      },
    },

    // ── Step 3: Add a Header ──
    {
      id: 'req6-edit-header',
      title: 'Add a Custom Header',
      description:
        'Switch to the **Headers** tab and add `X-Demo-Version: v2`. ' +
        'This is a second change that will be captured in the snapshot — ' +
        'the version diff will show both the URL change AND the new header.',
      highlight: REQ.TAB_HEADERS,
      preAction: async (ctx) => {
        ensureRequestsTab(ctx);
        if (!document.querySelector(REQ.reqByName(SAMPLE_NAME))) {
          await ensureSampleImported(ctx as never, SAMPLE_ID, SAMPLE_NAME);
          ensureRequestsTab(ctx);
        }
        await selectRequestByName(ctx, SAMPLE_NAME);
      },
      action: async (ctx) => {
        const headersTab = document.querySelector<HTMLElement>(REQ.TAB_HEADERS);
        if (headersTab) headersTab.click();
        await ctx.delay(300);

        const addBtn = document.querySelector<HTMLElement>('[data-testid="req-headers-add-btn"]');
        if (addBtn) addBtn.click();
        await ctx.delay(250);

        const rows = document.querySelectorAll('[data-testid^="req-headers-row-"]');
        const lastRow = rows[rows.length - 1];
        if (lastRow) {
          const keyInput = lastRow.querySelector<HTMLInputElement>('.ws-connect-kv-key');
          const valueInput = lastRow.querySelector<HTMLInputElement>('.ws-connect-kv-value');
          if (keyInput) fillControlledInput(keyInput, HEADER_KEY);
          await ctx.delay(250);
          if (valueInput) fillControlledInput(valueInput, HEADER_VALUE);
          await ctx.delay(350);
        }
      },
    },

    // ── Step 4: Navigate Away (Auto-Snapshot) ──
    {
      id: 'req6-switch-away',
      title: 'Navigate Away → Auto-Snapshot',
      description:
        'Now click another request (or import one). When you **leave** the edited request, ' +
        'the system automatically creates a **definition snapshot** in the background.\n\n' +
        'This is invisible to you — no save button needed. The snapshot captures the ' +
        'exact state of the request at the moment you navigated away.',
      highlight: REQ.reqByName(SECOND_SAMPLE_NAME),
      preAction: async (ctx) => {
        ensureRequestsTab(ctx);
        if (!document.querySelector(REQ.reqByName(SECOND_SAMPLE_NAME))) {
          await ensureSampleImported(ctx as never, SECOND_SAMPLE_ID, SECOND_SAMPLE_NAME);
          ensureRequestsTab(ctx);
        }
      },
      action: async (ctx) => {
        const secondReq = document.querySelector<HTMLElement>(REQ.reqByName(SECOND_SAMPLE_NAME));
        if (secondReq) {
          secondReq.click();
          await ctx.delay(600);
        }
      },
    },

    // ── Step 5: Return & Open History ──
    {
      id: 'req6-return',
      title: 'Return & Open History Tab',
      description:
        'Click back on **"Get All Users"** and open the **History** tab. You\'ll see the ' +
        'version list with timestamps and a **change summary** showing what was modified.\n\n' +
        'Each entry shows: "url changed, headers added" — so you know what\'s different ' +
        'without opening a full diff.',
      highlight: REQ.TAB_HISTORY,
      preAction: async (ctx) => {
        ensureRequestsTab(ctx);
      },
      action: async (ctx) => {
        await selectRequestByName(ctx, SAMPLE_NAME);
        await ctx.delay(400);
        const historyTab = document.querySelector<HTMLElement>(REQ.TAB_HISTORY);
        if (historyTab) historyTab.click();
        await ctx.delay(600);
      },
      verify: REQ.VERSION_PANEL,
    },

    // ── Step 6: Compare Two Versions ──
    {
      id: 'req6-diff',
      title: 'Compare Two Versions',
      description:
        'Select **two versions** using the checkboxes, then click **"Compare"**. ' +
        'The diff modal shows side-by-side changes across tabs:\n\n' +
        '- **Overview** — URL, method, name changes\n' +
        '- **Headers** — added, removed, modified headers\n' +
        '- **Body** — JSON diff with line-by-line changes\n' +
        '- **Auth** — authentication configuration changes',
      highlight: REQ.VERSION_COMPARE_BTN,
      pauseAfter: true,
      preAction: async (ctx) => {
        ensureRequestsTab(ctx);
        await selectRequestByName(ctx, SAMPLE_NAME);
        const historyTab = document.querySelector<HTMLElement>(REQ.TAB_HISTORY);
        if (historyTab && !document.querySelector(REQ.VERSION_PANEL)) {
          historyTab.click();
          await ctx.delay(150);
        }
      },
      action: async (ctx) => {
        const items = document.querySelectorAll<HTMLElement>(REQ.VERSION_ITEM);
        if (items.length >= 2) {
          items[0].click();
          await ctx.delay(300);
          items[1].click();
          await ctx.delay(300);

          const compareBtn = document.querySelector<HTMLElement>(REQ.VERSION_COMPARE_BTN);
          if (compareBtn) {
            compareBtn.click();
            await ctx.delay(800);
          }
          const diffModal = document.querySelector('.test-def-diff-modal');
          if (diffModal) {
            const closeBtn = diffModal.querySelector<HTMLElement>('.test-def-diff-header .btn');
            if (closeBtn) closeBtn.click();
            await ctx.delay(300);
          }
        }
      },
    },

    // ── Step 7: Restore Original Version ──
    {
      id: 'req6-restore',
      title: 'Restore a Previous Version',
      description:
        'Click **"↩ Restore"** on the original version. The request instantly reverts to ' +
        'its clean state — `/users` without the `?_limit=5` suffix, and without the ' +
        'extra header.\n\n' +
        'Restore is **non-destructive**: it creates a NEW version entry for the current ' +
        'state before reverting, so you can always undo.',
      highlight: REQ.VERSION_RESTORE_BTN,
      preAction: async (ctx) => {
        ensureRequestsTab(ctx);
        await selectRequestByName(ctx, SAMPLE_NAME);
        const historyTab = document.querySelector<HTMLElement>(REQ.TAB_HISTORY);
        if (historyTab && !document.querySelector(REQ.VERSION_PANEL)) {
          historyTab.click();
          await ctx.delay(150);
        }
      },
      action: async (ctx) => {
        const items = document.querySelectorAll<HTMLElement>(REQ.VERSION_ITEM);
        if (items.length > 0) {
          const lastItem = items[items.length - 1];
          const restoreBtn = lastItem.querySelector<HTMLElement>(REQ.VERSION_RESTORE_BTN);
          if (restoreBtn) {
            restoreBtn.click();
            await ctx.delay(600);
          }
        }
      },
    },

    // ── Step 8: Rename a Version ──
    {
      id: 'req6-rename',
      title: 'Rename a Version',
      description:
        'Click **"✏ Rename"** on any version to give it a meaningful label like ' +
        '"before pagination" or "v1-stable".\n\n' +
        'Named versions are easier to find when the list grows. The rename is instant — ' +
        'just type and press Enter.\n\n' +
        '**Tip:** Double-click the version label for quick inline editing.',
      highlight: REQ.VERSION_RENAME_BTN,
      preAction: async (ctx) => {
        ensureRequestsTab(ctx);
        await selectRequestByName(ctx, SAMPLE_NAME);
        const historyTab = document.querySelector<HTMLElement>(REQ.TAB_HISTORY);
        if (historyTab && !document.querySelector(REQ.VERSION_PANEL)) {
          historyTab.click();
          await ctx.delay(150);
        }
      },
      action: async (ctx) => {
        const items = document.querySelectorAll<HTMLElement>(REQ.VERSION_ITEM);
        if (items.length > 0) {
          const firstItem = items[0];
          const renameBtn = firstItem.querySelector<HTMLElement>(REQ.VERSION_RENAME_BTN);
          if (renameBtn) {
            renameBtn.click();
            await ctx.delay(300);
          }
          const renameInput = document.querySelector<HTMLInputElement>(REQ.VERSION_RENAME_INPUT);
          if (renameInput) {
            fillControlledInput(renameInput, 'before pagination');
            await ctx.delay(400);
            renameInput.blur();
            await ctx.delay(400);
          }
        }
      },
    },
  ],
};
