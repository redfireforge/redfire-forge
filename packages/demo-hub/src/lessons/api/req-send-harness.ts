/** Lesson REQ-5: Send to Harness (Promotion) */
import type { DemoLesson } from '../../types';
import { EM, REQ } from '@shared/selectors';
import {
  emEnvByNameSel,
  emSvcByNameSel,
  emSvcConfigureByNameSel,
  emSvcEnvChipByNameSel,
} from '@shared/selectors';
import { fillControlledInput } from '../setup-helpers';
import {
  ensureRequestsTab,
  navigateToGalleryRequests,
  selectGalleryCard,
  importGallerySample,
  selectRequestByName,
  triggerContextMenu,
  dismissContextMenu,
  findRequestCollectionName,
  cleanupRequestsInCollection,
  shrinkAllCollections,
} from './req-demo-helpers';
import {
  REQ_DEMO_ENV_NAME,
  REQ_DEMO_SVC_NAME,
  REQ_DEMO_HTTP_BASE_URL,
  createDemoEnvAndSvcVisible,
  ensureDemoEnvAndSvcOnEnvironmentPage,
  ensureJsonplaceholderHttpConfigured,
  ensureDemoBaseUrlConfigured,
  resolveHarnessTargetByName,
} from './req-env-helpers';
import { getDemoBridgeWindow } from '../../adapters/bridgeWindow';

const SAMPLE_ID = 'req-get-all-users';
const SAMPLE_NAME = 'Get All Users';
const GALLERY_COL = 'Gallery Samples';

/**
 * Seed / resolve demo + jsonplaceholder so Send-to-Harness cascade selects
 * have options. Prefer names created in Environment Manager steps.
 */
function seedHarnessTarget(): { envId: string; svcId: string } | null {
  const byName = resolveHarnessTargetByName();
  if (byName?.envId && byName.svcId) return byName;
  return getDemoBridgeWindow().__demoSeedHarnessTarget?.() ?? byName;
}

/**
 * Programmatically fill cascade select values (silent — for preAction recovery).
 */
async function fillCascadeSelections(
  ctx: { delay: (ms: number) => Promise<void> },
  target: { envId: string; svcId: string },
): Promise<void> {
  const envSelect = document.querySelector<HTMLSelectElement>(`${REQ.HARNESS_CASCADE_ENV} select`);
  if (envSelect && envSelect.value !== target.envId) {
    envSelect.value = target.envId;
    envSelect.dispatchEvent(new Event('change', { bubbles: true }));
  }
  await ctx.delay(80);

  // Re-resolve svc after env change (options may refresh).
  const resolved = resolveHarnessTargetByName() ?? target;
  const svcSelect = document.querySelector<HTMLSelectElement>(`${REQ.HARNESS_CASCADE_SVC} select`);
  if (svcSelect) {
    const svcId = resolved.svcId || target.svcId;
    if (svcId && svcSelect.value !== svcId) {
      svcSelect.value = svcId;
      svcSelect.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (!svcId) {
      const opt = Array.from(svcSelect.options).find(
        (o) => o.textContent?.trim().toLowerCase() === REQ_DEMO_SVC_NAME,
      );
      if (opt) {
        svcSelect.value = opt.value;
        svcSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  }
  await ctx.delay(80);

  const groupSelect = document.querySelector<HTMLSelectElement>(`${REQ.HARNESS_CASCADE_GROUP} select`);
  if (groupSelect && !groupSelect.value) {
    groupSelect.value = '__new__';
    groupSelect.dispatchEvent(new Event('change', { bubbles: true }));
    await ctx.delay(50);
    const groupInput = document.querySelector<HTMLInputElement>(`${REQ.HARNESS_CASCADE_GROUP} input`);
    if (groupInput) fillControlledInput(groupInput, 'API Tests');
    await ctx.delay(50);
    const scenarioInput = document.querySelector<HTMLInputElement>(`${REQ.HARNESS_CASCADE_SCENARIO} input`);
    if (scenarioInput) fillControlledInput(scenarioInput, 'User Endpoints');
  }
  await ctx.delay(50);
}

/**
 * Ensure the Gallery Samples collection has at least one request imported.
 */
async function ensureGallerySampleImported(ctx: {
  delay: (ms: number) => Promise<void>;
  navigateToTab: (tab: string) => void;
  waitFor: (sel: string, timeout?: number) => Promise<void>;
  click: (sel: string) => Promise<void>;
}): Promise<void> {
  const existing = document.querySelector(REQ.reqByName(SAMPLE_NAME));
  if (existing) return;

  await navigateToGalleryRequests(ctx as never);
  await selectGalleryCard(ctx as never, SAMPLE_ID);
  await ctx.delay(150);
  await importGallerySample(ctx as never);
  await ctx.delay(200);
}

function resolveHarnessCollectionName(): string {
  return findRequestCollectionName(SAMPLE_NAME) ?? 'Gallery Samples';
}

export const reqSendHarnessLesson: DemoLesson = {
  id: 'req-send-harness',
  domainId: 'api',
  category: 'requests',
  name: 'Send to Harness (Promotion)',
  description:
    'Set up a demo environment target, then promote requests into the Test Harness. ' +
    'Learn the promotion flow, target selection, and the IN HARNESS badge.',
  estimatedMinutes: 7,
  initialTab: 'requests',
  allowedTabs: ['requests', 'gallery', 'environments', 'scenarios'],

  concept: {
    title: 'From Exploration to Automated Testing',
    body:
      '**Requests** are for exploring APIs. The **Test Harness** runs repeatable, validated suites.\n\n' +
      'Promotion needs a place to land: an **Environment** and **Microservice** in Settings. ' +
      'We create **demo** + **jsonplaceholder** once, then reuse them as harness targets.\n\n' +
      '**Send to Harness** creates a one-time **snapshot** of your request:\n' +
      '- Absolute URL (resolved from env when relative)\n' +
      '- Frozen auth config\n' +
      '- Body, headers, method\n\n' +
      'The snapshot is **independent** — editing the original request does NOT change the test.\n\n' +
      '**Promotion path:**\n' +
      'Request → Environment → Microservice → Feature Group → Scenario → Test',
    keyTerms: [
      { term: 'Promotion', definition: 'Snapshot a request configuration into a test scenario (one-time copy)' },
      { term: 'Feature Group', definition: 'Target container in Test Harness that holds scenarios and tests' },
      { term: 'IN HARNESS Badge', definition: 'Visual indicator that a request has been promoted to the Test Harness' },
      { term: 'Batch Promote', definition: 'Send an entire collection at once, preserving folder → scenario structure' },
    ],
    diagram: `<svg viewBox="0 0 400 100" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="10" width="100" height="35" rx="5" fill="#1e293b" stroke="#3b82f6" stroke-width="1.5"/>
      <text x="60" y="31" text-anchor="middle" fill="#3b82f6" font-size="9">Request</text>
      <path d="M110 27 L155 27" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#arr5)"/>
      <text x="133" y="22" text-anchor="middle" fill="#f59e0b" font-size="7">snapshot</text>
      <rect x="155" y="10" width="90" height="35" rx="5" fill="#1e293b" stroke="#f59e0b" stroke-width="1.5"/>
      <text x="200" y="31" text-anchor="middle" fill="#f59e0b" font-size="9">Promotion</text>
      <path d="M245 27 L290 27" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#arr5)"/>
      <rect x="290" y="10" width="100" height="35" rx="5" fill="#1e293b" stroke="#10b981" stroke-width="1.5"/>
      <text x="340" y="31" text-anchor="middle" fill="#10b981" font-size="9">Test Harness</text>
      <rect x="10" y="60" width="380" height="30" rx="4" fill="#1e293b" stroke="#94a3b8" stroke-width="1" stroke-dasharray="3"/>
      <text x="200" y="79" text-anchor="middle" fill="#94a3b8" font-size="8">Env → Microservice → Feature Group → Scenario → Test</text>
      <defs><marker id="arr5" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6" fill="none" stroke="#94a3b8" stroke-width="1"/></marker></defs>
    </svg>`,
  },

  setup: async (ctx) => {
    // Keep demo/jsonplaceholder for reuse — do not delete them.
    ctx.navigateToTab('requests');
    await ctx.delay(150);
    await cleanupRequestsInCollection(ctx, GALLERY_COL, [SAMPLE_NAME]);
    await shrinkAllCollections();
  },

  cleanup: async (ctx) => {
    dismissContextMenu();
    const modal = document.querySelector(REQ.HARNESS_MODAL) || document.querySelector(REQ.BATCH_HARNESS_MODAL);
    if (modal) {
      const cancel = modal.querySelector<HTMLElement>('[data-testid="send-harness-cancel"]');
      if (cancel) cancel.click();
      await ctx.delay(150);
    }
    await cleanupRequestsInCollection(ctx, GALLERY_COL, [SAMPLE_NAME]);
    ctx.navigateToTab('requests');
    await ctx.delay(100);
  },

  steps: [
    // ── Step 1: Ensure Sample Imported ──
    {
      id: 'req5-setup',
      title: 'Import a Request to Promote',
      description:
        'First, import the **"Get All Users"** sample from the Gallery. ' +
        'This lands in **Gallery Samples** with an absolute URL — next we create the ' +
        'Environment + Microservice that the Test Harness needs as a promotion target.',
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

    // ── Step 2: Create demo env + jsonplaceholder ──
    {
      id: 'req5-create-env',
      title: 'Create Harness Target Environment',
      description:
        'Send to Harness needs an **Environment** and **Microservice** destination. ' +
        'Open **Environments** and set up a reusable public-API target:\n\n' +
        '1. Add environment **demo**\n' +
        '2. Highlight the new **demo** chip\n' +
        '3. Add microservice **jsonplaceholder**\n' +
        '4. Highlight the **jsonplaceholder** card\n\n' +
        'You can reuse these later for other promotions and relative-URL collections.',
      highlight: EM.ADD_ENV_INPUT,
      preAction: async (ctx) => {
        ctx.navigateToTab('environments');
        await ctx.delay(250);
      },
      action: async (ctx) => {
        await createDemoEnvAndSvcVisible(ctx);
      },
      verify: emSvcByNameSel(REQ_DEMO_SVC_NAME),
    },

    // ── Step 3: Configure HTTP protocol ──
    {
      id: 'req5-configure-svc',
      title: 'Configure jsonplaceholder HTTP',
      description:
        'Open **jsonplaceholder** settings. Click **Configure**, then **+ Add protocol** → **HTTP** ' +
        'so this microservice has an endpoint table the harness can attach to.',
      highlight: emSvcConfigureByNameSel(REQ_DEMO_SVC_NAME),
      pauseAfter: 5200,
      preAction: async (ctx) => {
        ctx.navigateToTab('environments');
        await ctx.delay(400);
        await ensureDemoEnvAndSvcOnEnvironmentPage(ctx as never);
      },
      action: async (ctx) => {
        await ensureJsonplaceholderHttpConfigured(ctx as never);
        await ctx.delay(500);
      },
    },

    // ── Step 4: Set demo Base URL ──
    {
      id: 'req5-base-url',
      title: 'Set demo Base URL',
      description:
        'In the HTTP table, select the **demo** row and set Base URL to ' +
        `\`${REQ_DEMO_HTTP_BASE_URL}\`. This pairs the environment with the same public API ` +
        'our Gallery sample uses — ready as a harness promotion target.',
      highlight: emSvcEnvChipByNameSel(REQ_DEMO_SVC_NAME, REQ_DEMO_ENV_NAME),
      pauseAfter: 6200,
      preAction: async (ctx) => {
        ctx.navigateToTab('environments');
        await ctx.delay(400);
        await ensureDemoEnvAndSvcOnEnvironmentPage(ctx as never);
        await ensureJsonplaceholderHttpConfigured(ctx as never);
      },
      action: async (ctx) => {
        await ensureDemoBaseUrlConfigured(ctx as never);
      },
      verify: emEnvByNameSel(REQ_DEMO_ENV_NAME),
    },

    // ── Step 5: Show Send to Harness Button ──
    {
      id: 'req5-show-btn',
      title: 'The "Send to Harness" Button',
      description:
        'Back on the request, look at the editor toolbar. The **"Send to Harness"** button ' +
        'promotes this request into the Test Harness as an automated test.\n\n' +
        'The promotion creates a **snapshot** — a frozen copy of the URL, method, headers, ' +
        'body, and auth at this moment in time.',
      highlight: REQ.SEND_HARNESS_BTN,
      pauseAfter: true,
      preAction: async (ctx) => {
        ensureRequestsTab(ctx);
        if (!document.querySelector(REQ.reqByName(SAMPLE_NAME))) {
          await ensureGallerySampleImported(ctx as never);
          ensureRequestsTab(ctx);
        }
        await selectRequestByName(ctx, SAMPLE_NAME);
      },
    },

    // ── Step 6: Open the Modal ──
    {
      id: 'req5-open-modal',
      title: 'Open the Promotion Modal',
      description:
        'Click **"Send to Harness"** to open the promotion modal. It has a **2-step flow**:\n\n' +
        '**Step 1 — Target:** Select where the test will live:\n' +
        `- Environment (**${REQ_DEMO_ENV_NAME}**)\n` +
        `- Microservice (**${REQ_DEMO_SVC_NAME}**)\n` +
        '- Feature Group (create new or pick existing)\n' +
        '- Test Scenario (create new or pick existing)',
      highlight: REQ.SEND_HARNESS_BTN,
      preAction: async (ctx) => {
        ensureRequestsTab(ctx);
        if (!document.querySelector(REQ.reqByName(SAMPLE_NAME))) {
          await ensureGallerySampleImported(ctx as never);
          ensureRequestsTab(ctx);
        }
        await selectRequestByName(ctx, SAMPLE_NAME);
        seedHarnessTarget();
        if (document.querySelector(REQ.HARNESS_MODAL)) {
          const cancel = document.querySelector<HTMLElement>('[data-testid="send-harness-cancel"]');
          if (cancel) cancel.click();
          await ctx.delay(150);
        }
      },
      action: async (ctx) => {
        if (document.querySelector(REQ.HARNESS_MODAL)) return;
        await ctx.click(REQ.SEND_HARNESS_BTN);
        await ctx.delay(400);
        await ctx.waitFor(REQ.HARNESS_MODAL, 2000);
        await ctx.delay(600);
      },
      verify: REQ.HARNESS_MODAL,
    },

    // ── Step 7: Select Target ──
    {
      id: 'req5-select-target',
      title: 'Pick the Target Location',
      description:
        `Select **${REQ_DEMO_ENV_NAME}** and **${REQ_DEMO_SVC_NAME}** — the targets we just configured. ` +
        'These determine where your test lives in the Test Harness hierarchy.\n\n' +
        'Then create a new **Feature Group** (the top-level container) and a new ' +
        '**Test Scenario** (groups related tests together).',
      highlight: REQ.HARNESS_MODAL,
      preAction: async (ctx) => {
        ensureRequestsTab(ctx);
        if (!document.querySelector(REQ.reqByName(SAMPLE_NAME))) {
          await ensureGallerySampleImported(ctx as never);
          ensureRequestsTab(ctx);
        }
        await selectRequestByName(ctx, SAMPLE_NAME);
        seedHarnessTarget();
        if (!document.querySelector(REQ.HARNESS_MODAL)) {
          const btn = document.querySelector<HTMLElement>(REQ.SEND_HARNESS_BTN);
          if (btn) btn.click();
          await ctx.delay(200);
        }
      },
      action: async (ctx) => {
        const target = seedHarnessTarget();
        if (!target?.envId) return;

        const envSelect = document.querySelector<HTMLSelectElement>(`${REQ.HARNESS_CASCADE_ENV} select`);
        if (envSelect) {
          envSelect.value = target.envId;
          envSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }
        await ctx.delay(400);

        const resolved = resolveHarnessTargetByName() ?? target;
        const svcSelect = document.querySelector<HTMLSelectElement>(`${REQ.HARNESS_CASCADE_SVC} select`);
        if (svcSelect) {
          const svcId = resolved.svcId || target.svcId;
          if (svcId) {
            svcSelect.value = svcId;
            svcSelect.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
        await ctx.delay(400);

        const groupSelect = document.querySelector<HTMLSelectElement>(`${REQ.HARNESS_CASCADE_GROUP} select`);
        if (groupSelect) {
          groupSelect.value = '__new__';
          groupSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }
        await ctx.delay(300);
        const groupInput = document.querySelector<HTMLInputElement>(`${REQ.HARNESS_CASCADE_GROUP} input`);
        if (groupInput) fillControlledInput(groupInput, 'API Tests');
        await ctx.delay(300);

        const scenarioInput = document.querySelector<HTMLInputElement>(`${REQ.HARNESS_CASCADE_SCENARIO} input`);
        if (scenarioInput) fillControlledInput(scenarioInput, 'User Endpoints');
        await ctx.delay(400);
      },
    },

    // ── Step 8: Options & Preview ──
    {
      id: 'req5-options',
      title: 'Options & Preview',
      description:
        'Click **Next** to see the options step:\n\n' +
        '- **Auth Mode**: "Concrete" freezes the current auth; "Inherit" uses the harness profile\n' +
        '- **Validation Preset**: "Status 200" auto-adds a status check assertion\n' +
        '- **Preview**: Shows the snapshot that will be created (URL, method, auth)',
      highlight: REQ.HARNESS_NEXT_BTN,
      preAction: async (ctx) => {
        if (!document.querySelector(REQ.HARNESS_MODAL)) {
          ensureRequestsTab(ctx);
          if (!document.querySelector(REQ.reqByName(SAMPLE_NAME))) {
            await ensureGallerySampleImported(ctx as never);
            ensureRequestsTab(ctx);
          }
          await selectRequestByName(ctx, SAMPLE_NAME);
          const target = seedHarnessTarget();
          const btn = document.querySelector<HTMLElement>(REQ.SEND_HARNESS_BTN);
          if (btn) btn.click();
          await ctx.delay(200);
          if (target) await fillCascadeSelections(ctx, target);
        } else {
          const nextBtn = document.querySelector<HTMLButtonElement>('[data-testid="send-harness-next"]');
          if (nextBtn?.disabled) {
            const target = seedHarnessTarget();
            if (target) await fillCascadeSelections(ctx, target);
          }
        }
      },
      action: async (ctx) => {
        const nextBtn = document.querySelector<HTMLButtonElement>('[data-testid="send-harness-next"]');
        if (nextBtn && !nextBtn.disabled) {
          nextBtn.click();
          await ctx.delay(600);
        }
      },
    },

    // ── Step 9: Confirm Promotion ──
    {
      id: 'req5-confirm',
      title: 'Confirm the Promotion',
      description:
        'Click **"Send to Harness"** to complete the promotion. The request is now ' +
        'an automated test in the Test Harness under **demo / jsonplaceholder**.\n\n' +
        'After confirmation, notice the **IN HARNESS** badge appears on the request ' +
        'in the sidebar — a visual reminder that this request has been promoted.',
      highlight: REQ.HARNESS_CONFIRM_BTN,
      preAction: async (ctx) => {
        if (document.querySelector('[data-testid="send-harness-confirm"]')) return;
        if (!document.querySelector(REQ.HARNESS_MODAL)) {
          ensureRequestsTab(ctx);
          if (!document.querySelector(REQ.reqByName(SAMPLE_NAME))) {
            await ensureGallerySampleImported(ctx as never);
            ensureRequestsTab(ctx);
          }
          await selectRequestByName(ctx, SAMPLE_NAME);
          const target = seedHarnessTarget();
          const btn = document.querySelector<HTMLElement>(REQ.SEND_HARNESS_BTN);
          if (btn) btn.click();
          await ctx.delay(200);
          if (target) await fillCascadeSelections(ctx, target);
        }
        const nextBtn = document.querySelector<HTMLButtonElement>('[data-testid="send-harness-next"]');
        if (nextBtn && !nextBtn.disabled) {
          nextBtn.click();
          await ctx.delay(150);
        }
      },
      action: async (ctx) => {
        const confirmBtn = document.querySelector<HTMLButtonElement>('[data-testid="send-harness-confirm"]');
        if (confirmBtn) {
          confirmBtn.click();
          await ctx.delay(400);
        }
      },
    },

    // ── Step 10: IN HARNESS Badge ──
    {
      id: 'req5-badge',
      title: 'The IN HARNESS Badge',
      description:
        'Back on the requests tab, notice the request now shows an **IN HARNESS** badge. ' +
        'This tells you at a glance which requests have been promoted to automated testing.\n\n' +
        'The badge is **read-only** — it doesn\'t create a live link. The test in the Harness ' +
        'is an independent snapshot. Editing the request here won\'t change the test.',
      highlight: REQ.reqByName(SAMPLE_NAME),
      pauseAfter: true,
      preAction: async (ctx) => {
        ensureRequestsTab(ctx);
        if (document.querySelector(REQ.HARNESS_MODAL)) {
          const cancel = document.querySelector<HTMLElement>('[data-testid="send-harness-cancel"]');
          if (cancel) cancel.click();
          await ctx.delay(150);
        }
      },
    },

    // ── Step 11: Batch Promote ──
    {
      id: 'req5-batch',
      title: 'Batch Promote a Collection',
      description:
        'For bulk workflows, right-click a collection and select **"Send to Harness"**. ' +
        'This opens the batch promotion modal where you can:\n\n' +
        '- Select/deselect individual requests with checkboxes\n' +
        '- See a preview of what will be created (Feature Group, Scenarios, Tests)\n' +
        '- Apply validation presets to all tests at once\n\n' +
        'Folder structure is preserved: each folder becomes a Test Scenario.',
      highlight: REQ.SIDEBAR,
      preAction: async (ctx) => {
        ensureRequestsTab(ctx);
        if (!document.querySelector(REQ.reqByName(SAMPLE_NAME))) {
          await ensureGallerySampleImported(ctx as never);
          ensureRequestsTab(ctx);
        }
        if (document.querySelector(REQ.HARNESS_MODAL) || document.querySelector(REQ.BATCH_HARNESS_MODAL)) {
          const cancel = document.querySelector<HTMLElement>('[data-testid="send-harness-cancel"]');
          if (cancel) cancel.click();
          await ctx.delay(150);
        }
        dismissContextMenu();
      },
      action: async (ctx) => {
        const colName = resolveHarnessCollectionName();
        const colEl = document.querySelector<HTMLElement>(REQ.colByName(colName));
        if (!colEl) return;
        triggerContextMenu(colEl);
        await ctx.delay(400);
        await ctx.waitFor(REQ.CONTEXT_MENU, 2000);

        const menu = document.querySelector(REQ.CONTEXT_MENU);
        if (menu) {
          const batchBtn = Array.from(menu.querySelectorAll('button'))
            .find(b => b.textContent?.trim() === 'Send to Harness');
          if (batchBtn) (batchBtn as HTMLElement).click();
        }
        await ctx.delay(400);
        await ctx.delay(700);

        const modal = document.querySelector(REQ.BATCH_HARNESS_MODAL);
        if (modal) {
          const cancel = modal.querySelector<HTMLElement>('[data-testid="send-harness-cancel"]');
          if (cancel) cancel.click();
        }
        await ctx.delay(300);
      },
    },

    // ── Step 12: Summary ──
    {
      id: 'req5-summary',
      title: 'Exploration → Automation',
      description:
        'You\'ve learned the complete promotion workflow:\n\n' +
        '- **Environment setup** — create reusable **demo** / **jsonplaceholder** targets\n' +
        '- **Single promotion** — "Send to Harness" creates a frozen test snapshot\n' +
        '- **Target selection** — Environment → Microservice → Feature Group → Scenario\n' +
        '- **Batch promote** — right-click collection for bulk promotion\n' +
        '- **IN HARNESS badge** — tracks which requests have been promoted\n\n' +
        'Keep **demo** / **jsonplaceholder** for later lessons — they\'re reusable harness targets.',
      highlight: REQ.reqByName(SAMPLE_NAME),
      pauseAfter: true,
      preAction: async (ctx) => {
        ensureRequestsTab(ctx);
        dismissContextMenu();
        if (document.querySelector(REQ.HARNESS_MODAL) || document.querySelector(REQ.BATCH_HARNESS_MODAL)) {
          const cancel = document.querySelector<HTMLElement>('[data-testid="send-harness-cancel"]');
          if (cancel) cancel.click();
          await ctx.delay(150);
        }
      },
    },
  ],
};
