/**
 * REQ-5 v2: Send to Harness (Promotion)
 *
 * 5 steps: create request from scratch → set up env + microservice →
 * open promotion modal + select target → confirm + see badge → batch promote.
 * Public API: JSONPlaceholder. Follows v2 principles: create from scratch, rich spotlights.
 */
import type { DemoLesson, DemoActionContext } from '../../types';
import { EM, REQ } from '@shared/selectors';
import {
  emSvcByNameSel,
  emSvcConfigureByNameSel,
  emAddProtocolItemSel,
  emEnvByNameSel,
} from '@shared/selectors';
import { showSpotlightRing } from '../../demoRipple';
import { fillControlledInput } from '../setup-helpers';
import {
  ensureRequestsTab,
  triggerContextMenu,
  dismissContextMenu,
  shrinkAllCollections,
  selectRequestByName,
  ensureCollectionExpanded,
  closeExtraRequestTabs,
} from './req-demo-helpers';
import {
  ensureSettingsEnvironment,
  removeSettingsEnvironment,
  ensureSettingsMicroservice,
  removeSettingsMicroservice,
} from '../../adapters';
import { getDemoBridgeWindow } from '../../adapters/bridgeWindow';

const COLLECTION_NAME = 'Promotion Demo';
const REQUEST_NAME = 'Get Users';
const REQUEST_URL = 'https://jsonplaceholder.typicode.com/users';
const ENV_NAME = 'demo';
const SVC_NAME = 'jsonplaceholder';
const SVC_BASE_URL = 'https://jsonplaceholder.typicode.com';

let activeSpotlightCleanup: (() => void) | null = null;

async function spotlight(ctx: DemoActionContext, selector: string, holdMs: number): Promise<void> {
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) return;
  activeSpotlightCleanup?.();
  activeSpotlightCleanup = null;
  el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  const remove = showSpotlightRing(el);
  activeSpotlightCleanup = remove;
  try { await ctx.delay(holdMs); } finally { remove(); if (activeSpotlightCleanup === remove) activeSpotlightCleanup = null; }
}

async function spotlightEl(ctx: DemoActionContext, el: HTMLElement, holdMs: number): Promise<void> {
  activeSpotlightCleanup?.();
  activeSpotlightCleanup = null;
  el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  const remove = showSpotlightRing(el);
  activeSpotlightCleanup = remove;
  try { await ctx.delay(holdMs); } finally { remove(); if (activeSpotlightCleanup === remove) activeSpotlightCleanup = null; }
}

async function spotlightElNoScroll(ctx: DemoActionContext, el: HTMLElement, holdMs: number): Promise<void> {
  activeSpotlightCleanup?.();
  activeSpotlightCleanup = null;
  const remove = showSpotlightRing(el);
  activeSpotlightCleanup = remove;
  try { await ctx.delay(holdMs); } finally { remove(); if (activeSpotlightCleanup === remove) activeSpotlightCleanup = null; }
}

function isVisible(el: Element | null): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;
  const style = getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
}

function firstVisible(selector: string): HTMLElement | null {
  return Array.from(document.querySelectorAll<HTMLElement>(selector)).find(isVisible) ?? null;
}

async function openContextMenuForElement(ctx: DemoActionContext, el: HTMLElement): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    triggerContextMenu(el);
    await ctx.waitFor(REQ.CONTEXT_MENU, 700);
    if (firstVisible(REQ.CONTEXT_MENU)) return true;
    await ctx.delay(120);
  }
  return !!firstVisible(REQ.CONTEXT_MENU);
}

async function clickContextItemVisible(ctx: DemoActionContext, text: string): Promise<boolean> {
  const menu = firstVisible(REQ.CONTEXT_MENU);
  if (!menu) return false;
  const btn = Array.from(menu.querySelectorAll<HTMLButtonElement>('button'))
    .find(b => b.textContent?.trim() === text);
  if (!btn) return false;
  btn.click();
  await ctx.delay(180);
  return true;
}

async function deleteCollectionByName(ctx: DemoActionContext, collectionName: string): Promise<void> {
  ensureRequestsTab(ctx);
  await ctx.delay(40);
  let guard = 0;
  while (document.querySelector(REQ.colByName(collectionName)) && guard < 4) {
    const col = firstVisible(REQ.colByName(collectionName));
    if (!col) break;
    col.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const opened = await openContextMenuForElement(ctx, col);
    if (!opened) break;
    const clicked = await clickContextItemVisible(ctx, 'Delete Collection');
    if (!clicked) { dismissContextMenu(); break; }
    const confirmBtn = document.querySelector<HTMLElement>('.req-confirm-dialog .req-confirm-ok');
    if (confirmBtn) { confirmBtn.click(); await ctx.delay(120); }
    guard += 1;
  }
}

async function closeOpenOverlays(ctx: DemoActionContext): Promise<void> {
  dismissContextMenu();
  const modalClose = document.querySelector<HTMLElement>('.req-col-modal .btn-secondary')
    ?? document.querySelector<HTMLElement>('.req-col-modal .btn-ghost');
  if (modalClose) { modalClose.click(); await ctx.delay(60); }
  const harness = document.querySelector(REQ.HARNESS_MODAL) || document.querySelector(REQ.BATCH_HARNESS_MODAL);
  if (harness) {
    const cancel = harness.querySelector<HTMLElement>('[data-testid="send-harness-cancel"]');
    if (cancel) { cancel.click(); await ctx.delay(150); }
  }
}

async function createCollectionIfNeeded(ctx: DemoActionContext): Promise<void> {
  if (document.querySelector(REQ.colByName(COLLECTION_NAME))) return;
  await ctx.click(REQ.SIDEBAR_ADD_BTN);
  await ctx.waitFor(REQ.ADD_DROPDOWN, 1500);
  await ctx.click(REQ.ADD_URL_COLLECTION);
  await ctx.waitFor(REQ.COLLECTION_MODAL, 2000);
  const nameInput = document.querySelector<HTMLInputElement>('.req-col-modal .req-input');
  if (nameInput) fillControlledInput(nameInput, COLLECTION_NAME);
  await ctx.delay(80);
  document.querySelector<HTMLButtonElement>('.req-col-modal .btn-primary')?.click();
  await ctx.delay(200);
}

async function ensureRequestExists(ctx: DemoActionContext): Promise<void> {
  await createCollectionIfNeeded(ctx);
  const existing = document.querySelector(REQ.reqByName(REQUEST_NAME));
  if (existing) { await selectRequestByName(ctx, REQUEST_NAME, COLLECTION_NAME); return; }
  const col = firstVisible(REQ.colByName(COLLECTION_NAME));
  if (!col) return;
  const opened = await openContextMenuForElement(ctx, col);
  if (!opened) return;
  await clickContextItemVisible(ctx, 'Add Request');
  await ctx.waitFor(REQ.URL_INPUT, 2200);
  const nameDisplay = firstVisible('.req-req-name-display');
  if (nameDisplay) {
    nameDisplay.click();
    await ctx.delay(60);
    const nameInput = firstVisible('.req-req-name-input') as HTMLInputElement | null;
    if (nameInput) { fillControlledInput(nameInput, REQUEST_NAME); nameInput.blur(); await ctx.delay(60); }
  }
  const urlInput = document.querySelector<HTMLInputElement>(REQ.URL_INPUT);
  if (urlInput) fillControlledInput(urlInput, REQUEST_URL);
}

function seedHarnessTarget(): { envId: string; svcId: string } | null {
  return getDemoBridgeWindow().__demoSeedHarnessTarget?.() ?? null;
}

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
  const svcSelect = document.querySelector<HTMLSelectElement>(`${REQ.HARNESS_CASCADE_SVC} select`);
  if (svcSelect && target.svcId && svcSelect.value !== target.svcId) {
    svcSelect.value = target.svcId;
    svcSelect.dispatchEvent(new Event('change', { bubbles: true }));
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

export const reqSendHarnessLesson: DemoLesson = {
  id: 'req-send-harness',
  domainId: 'api',
  category: 'requests',
  name: 'Send to Harness (Promotion)',
  description:
    'Create a request, set up a demo environment and microservice target, then promote ' +
    'into the Test Harness. Learn the full promotion flow: target selection, confirmation, ' +
    'the IN HARNESS badge, and batch collection promotion.',
  estimatedMinutes: 4,
  initialTab: 'requests',
  allowedTabs: ['requests', 'environments'],

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
    ctx.navigateToTab('requests');
    await ctx.delay(80);
    await closeExtraRequestTabs(ctx);
    await closeOpenOverlays(ctx);
    await deleteCollectionByName(ctx, COLLECTION_NAME);
    removeSettingsMicroservice(SVC_NAME);
    removeSettingsEnvironment(ENV_NAME);
    await shrinkAllCollections();
  },

  cleanup: async (ctx) => {
    await closeOpenOverlays(ctx);
    await closeExtraRequestTabs(ctx);
    await deleteCollectionByName(ctx, COLLECTION_NAME);
    removeSettingsMicroservice(SVC_NAME);
    removeSettingsEnvironment(ENV_NAME);
    ctx.navigateToTab('requests');
    await ctx.delay(60);
  },

  steps: [
    // ── Step 1: Create Collection & Request ──
    {
      id: 'req5-setup',
      title: 'Create Collection & Request',
      description:
        'Create a **"Promotion Demo"** URL Collection and add a **"Get Users"** request ' +
        'pointed at `jsonplaceholder.typicode.com/users` — notice it opens in its own **tab**. ' +
        'Send it to confirm it returns **200 OK**.\n\n' +
        'Once we have a working request, we\'ll promote it into the Test Harness.',
      highlight: REQ.SIDEBAR_ADD_BTN,
      preAction: async (ctx) => {
        ensureRequestsTab(ctx);
        await closeOpenOverlays(ctx);
        await deleteCollectionByName(ctx, COLLECTION_NAME);
        removeSettingsMicroservice(SVC_NAME);
        removeSettingsEnvironment(ENV_NAME);
      },
      action: async (ctx) => {
        // Create collection
        await spotlight(ctx, REQ.SIDEBAR_ADD_BTN, 800);
        await ctx.click(REQ.SIDEBAR_ADD_BTN);
        await ctx.waitFor(REQ.ADD_DROPDOWN, 1500);
        await ctx.click(REQ.ADD_URL_COLLECTION);
        await ctx.waitFor(REQ.COLLECTION_MODAL, 2000);
        const nameInput = document.querySelector<HTMLInputElement>('.req-col-modal .req-input');
        if (nameInput) {
          nameInput.focus();
          fillControlledInput(nameInput, COLLECTION_NAME);
          await ctx.delay(200);
        }
        document.querySelector<HTMLButtonElement>('.req-col-modal .btn-primary')?.click();
        await ctx.delay(300);

        // Add request
        const col = firstVisible(REQ.colByName(COLLECTION_NAME));
        if (!col) return;
        const opened = await openContextMenuForElement(ctx, col);
        if (!opened) return;
        await clickContextItemVisible(ctx, 'Add Request');
        await ctx.waitFor(REQ.URL_INPUT, 2200);
        await ctx.delay(200);

        const reqNameDisplay = firstVisible('.req-req-name-display');
        if (reqNameDisplay) {
          reqNameDisplay.click();
          await ctx.delay(80);
          const reqNameInput = firstVisible('.req-req-name-input') as HTMLInputElement | null;
          if (reqNameInput) { fillControlledInput(reqNameInput, REQUEST_NAME); reqNameInput.blur(); await ctx.delay(80); }
        }

        const urlInput = document.querySelector<HTMLInputElement>(REQ.URL_INPUT);
        if (urlInput) {
          urlInput.focus();
          fillControlledInput(urlInput, REQUEST_URL);
          await ctx.delay(300);
          await spotlightElNoScroll(ctx, urlInput, 900);
        }

        // Send
        await spotlight(ctx, REQ.SEND_BTN, 800);
        await ctx.click(REQ.SEND_BTN);
        await ctx.waitFor(REQ.STATUS_PILL, 5000);
        await spotlight(ctx, REQ.STATUS_PILL, 1100);
      },
    },

    // ── Step 2: Create Demo Environment & Microservice ──
    {
      id: 'req5-env',
      title: 'Create Demo Environment',
      description:
        'Open **Settings** and create the promotion target. Add environment **"demo"**, ' +
        'then add microservice **"jsonplaceholder"**. Click **Configure**, add the **HTTP** ' +
        'protocol, enable the deploy checkbox, and set the base URL to ' +
        '`https://jsonplaceholder.typicode.com`.\n\n' +
        'This gives the Test Harness a destination for promoted requests.',
      highlight: EM.ADD_ENV_INPUT,
      preAction: async (ctx) => {
        ensureRequestsTab(ctx);
        await closeOpenOverlays(ctx);
        if (!document.querySelector(REQ.colByName(COLLECTION_NAME))) {
          await createCollectionIfNeeded(ctx);
        }
        removeSettingsMicroservice(SVC_NAME);
        removeSettingsEnvironment(ENV_NAME);
      },
      action: async (ctx) => {
        // Navigate to Settings
        ctx.navigateToTab('environments');
        await ctx.delay(700);
        await ctx.waitFor(EM.ADD_ENV_INPUT, 2200);

        // Create environment "demo"
        if (!document.querySelector(emEnvByNameSel(ENV_NAME))) {
          const envInput = document.querySelector<HTMLInputElement>(EM.ADD_ENV_INPUT);
          if (envInput) {
            await spotlight(ctx, EM.ADD_ENV_INPUT, 900);
            envInput.focus();
            fillControlledInput(envInput, ENV_NAME);
            await ctx.delay(400);
            await spotlight(ctx, EM.ADD_ENV_BTN, 700);
            await ctx.click(EM.ADD_ENV_BTN);
            await ctx.waitFor(emEnvByNameSel(ENV_NAME), 2200);
            await ctx.delay(300);
          }
        }
        const envRow = document.querySelector<HTMLElement>(emEnvByNameSel(ENV_NAME));
        if (envRow) { envRow.click(); await spotlightEl(ctx, envRow, 1100); }

        // Create microservice "jsonplaceholder"
        await ctx.waitFor(EM.ADD_SVC_INPUT, 2200);
        if (!document.querySelector(emSvcByNameSel(SVC_NAME))) {
          const svcInput = document.querySelector<HTMLInputElement>(EM.ADD_SVC_INPUT);
          if (svcInput) {
            await spotlight(ctx, EM.ADD_SVC_INPUT, 900);
            svcInput.focus();
            fillControlledInput(svcInput, SVC_NAME);
            await ctx.delay(400);
            await spotlight(ctx, EM.ADD_SVC_BTN, 700);
            await ctx.click(EM.ADD_SVC_BTN);
            await ctx.waitFor(emSvcByNameSel(SVC_NAME), 2200);
            await ctx.delay(300);
          }
        }
        const svcRow = document.querySelector<HTMLElement>(emSvcByNameSel(SVC_NAME));
        if (svcRow) await spotlightEl(ctx, svcRow, 1100);

        // Configure → Add HTTP protocol
        const configureBtn = document.querySelector<HTMLButtonElement>(emSvcConfigureByNameSel(SVC_NAME));
        if (configureBtn?.textContent?.includes('Configure')) {
          await spotlight(ctx, emSvcConfigureByNameSel(SVC_NAME), 900);
          await ctx.click(emSvcConfigureByNameSel(SVC_NAME));
          await ctx.delay(850);
        }
        await ctx.waitFor(EM.PROTOCOL_PANEL, 2200);
        if (!document.querySelector(EM.PROTOCOL_TAB_HTTP)) {
          await ctx.waitFor(EM.ADD_PROTOCOL_BTN, 2200);
          await spotlight(ctx, EM.ADD_PROTOCOL_BTN, 900);
          await ctx.click(EM.ADD_PROTOCOL_BTN);
          await ctx.delay(600);
          await ctx.waitFor(emAddProtocolItemSel('http'), 2200);
          await spotlight(ctx, emAddProtocolItemSel('http'), 800);
          await ctx.click(emAddProtocolItemSel('http'));
          await ctx.delay(900);
        }
        await ctx.waitFor(EM.PROTOCOL_TAB_HTTP, 2200);
        await ctx.click(EM.PROTOCOL_TAB_HTTP);
        await ctx.delay(600);
        await spotlight(ctx, EM.PROTOCOL_TAB_HTTP, 800);

        // Enable deploy + set base URL for "demo"
        const svcSel = emSvcByNameSel(SVC_NAME);
        const envChip = document.querySelector<HTMLElement>(
          `${svcSel} .svc-env-table [data-env-name="${ENV_NAME}"]`,
        );
        const row = envChip?.closest('tr');
        if (row) {
          const checkbox = row.querySelector<HTMLInputElement>('input[type="checkbox"]');
          if (checkbox && !checkbox.checked) {
            await spotlightElNoScroll(ctx, checkbox, 800);
            checkbox.click();
            await ctx.delay(600);
          }
          const urlText = row.querySelector<HTMLElement>('.em-url-text')?.textContent ?? '';
          if (!urlText.includes(SVC_BASE_URL)) {
            const editBtn = row.querySelector<HTMLButtonElement>('[data-testid="em-endpoint-edit-btn"]');
            if (editBtn) { editBtn.click(); await ctx.delay(500); }
            const editInput = document.querySelector<HTMLInputElement>(EM.ENDPOINT_EDIT_INPUT);
            if (editInput) {
              fillControlledInput(editInput, SVC_BASE_URL);
              await spotlightElNoScroll(ctx, editInput, 1000);
            }
            const saveBtn = document.querySelector<HTMLButtonElement>(EM.ENDPOINT_SAVE);
            if (saveBtn) { saveBtn.click(); await ctx.delay(700); }
          }
        }

        // Pause on configured table
        const envTable = document.querySelector<HTMLElement>(`${svcSel} .svc-env-table`);
        if (envTable) await spotlightEl(ctx, envTable, 1200);
      },
    },

    // ── Step 3: Open Promotion Modal & Select Target ──
    {
      id: 'req5-promote',
      title: 'Open Promotion Modal',
      description:
        'Back on the request, click **"Send to Harness"**. The promotion modal has a **2-step flow**:\n\n' +
        '**Step 1 — Target:** Select where the test will live:\n' +
        '- Environment (**demo**)\n' +
        '- Microservice (**jsonplaceholder**)\n' +
        '- Feature Group (create **"API Tests"**)\n' +
        '- Scenario (create **"User Endpoints"**)\n\n' +
        'Each cascade narrows the next — like a folder path for your test.',
      highlight: REQ.SEND_HARNESS_BTN,
      preAction: async (ctx) => {
        ensureRequestsTab(ctx);
        await closeOpenOverlays(ctx);
        // Ensure env + svc exist via bridge (rapid-Next recovery)
        const envId = ensureSettingsEnvironment(ENV_NAME);
        if (envId) ensureSettingsMicroservice(SVC_NAME, { [envId]: SVC_BASE_URL });
        if (!document.querySelector(REQ.colByName(COLLECTION_NAME))) {
          await createCollectionIfNeeded(ctx);
        }
        await ensureRequestExists(ctx);
      },
      action: async (ctx) => {
        ctx.navigateToTab('requests');
        await ctx.delay(400);
        await ensureCollectionExpanded(ctx, COLLECTION_NAME);
        await selectRequestByName(ctx, REQUEST_NAME, COLLECTION_NAME);
        await ctx.delay(300);

        // Click Send to Harness
        await spotlight(ctx, REQ.SEND_HARNESS_BTN, 1000);
        await ctx.click(REQ.SEND_HARNESS_BTN);
        await ctx.waitFor(REQ.HARNESS_MODAL, 2000);
        await ctx.delay(600);
        await spotlight(ctx, REQ.HARNESS_MODAL, 1000);

        // Fill cascade selections
        const target = seedHarnessTarget();
        if (target) {
          await fillCascadeSelections(ctx, target);
        } else {
          // Fallback: resolve by option labels
          const envSelect = document.querySelector<HTMLSelectElement>(`${REQ.HARNESS_CASCADE_ENV} select`);
          if (envSelect) {
            const envOpt = Array.from(envSelect.options).find(o => o.textContent?.trim().toLowerCase() === ENV_NAME);
            if (envOpt) { envSelect.value = envOpt.value; envSelect.dispatchEvent(new Event('change', { bubbles: true })); }
          }
          await ctx.delay(200);
          const svcSelect = document.querySelector<HTMLSelectElement>(`${REQ.HARNESS_CASCADE_SVC} select`);
          if (svcSelect) {
            const svcOpt = Array.from(svcSelect.options).find(o => o.textContent?.trim().toLowerCase() === SVC_NAME);
            if (svcOpt) { svcSelect.value = svcOpt.value; svcSelect.dispatchEvent(new Event('change', { bubbles: true })); }
          }
          await ctx.delay(200);
          const groupSelect = document.querySelector<HTMLSelectElement>(`${REQ.HARNESS_CASCADE_GROUP} select`);
          if (groupSelect) {
            groupSelect.value = '__new__';
            groupSelect.dispatchEvent(new Event('change', { bubbles: true }));
            await ctx.delay(50);
            const groupInput = document.querySelector<HTMLInputElement>(`${REQ.HARNESS_CASCADE_GROUP} input`);
            if (groupInput) fillControlledInput(groupInput, 'API Tests');
            await ctx.delay(50);
            const scenarioInput = document.querySelector<HTMLInputElement>(`${REQ.HARNESS_CASCADE_SCENARIO} input`);
            if (scenarioInput) fillControlledInput(scenarioInput, 'User Endpoints');
          }
        }
        await ctx.delay(300);

        // Spotlight each cascade
        await spotlight(ctx, REQ.HARNESS_CASCADE_ENV, 900);
        await spotlight(ctx, REQ.HARNESS_CASCADE_SVC, 900);
        await spotlight(ctx, REQ.HARNESS_CASCADE_GROUP, 900);
        await spotlight(ctx, REQ.HARNESS_CASCADE_SCENARIO, 900);
      },
    },

    // ── Step 4: Confirm & See Badge ──
    {
      id: 'req5-confirm',
      title: 'Confirm & See Badge',
      description:
        'Click **Next** to see the preview panel — it shows the snapshot that will be created ' +
        '(method, URL, auth). Click **"Send to Harness"** to confirm.\n\n' +
        'After confirmation, notice the **IN HARNESS** badge on the request in the sidebar — ' +
        'a visual reminder that this request has been promoted to automated testing.',
      highlight: REQ.HARNESS_NEXT_BTN,
      preAction: async (ctx) => {
        ensureRequestsTab(ctx);
        const envId = ensureSettingsEnvironment(ENV_NAME);
        if (envId) ensureSettingsMicroservice(SVC_NAME, { [envId]: SVC_BASE_URL });
        if (!document.querySelector(REQ.HARNESS_MODAL)) {
          if (!document.querySelector(REQ.colByName(COLLECTION_NAME))) await createCollectionIfNeeded(ctx);
          await ensureRequestExists(ctx);
          const btn = document.querySelector<HTMLElement>(REQ.SEND_HARNESS_BTN);
          if (btn) btn.click();
          await ctx.delay(200);
          const target = seedHarnessTarget();
          if (target) await fillCascadeSelections(ctx, target);
        }
      },
      action: async (ctx) => {
        // Click Next
        const nextBtn = document.querySelector<HTMLButtonElement>(REQ.HARNESS_NEXT_BTN);
        if (nextBtn && !nextBtn.disabled) {
          await spotlight(ctx, REQ.HARNESS_NEXT_BTN, 900);
          nextBtn.click();
          await ctx.delay(700);
        }

        // Spotlight confirm
        const confirmBtn = document.querySelector<HTMLButtonElement>(REQ.HARNESS_CONFIRM_BTN);
        if (confirmBtn) {
          await spotlight(ctx, REQ.HARNESS_CONFIRM_BTN, 1000);
          confirmBtn.click();
          await ctx.delay(500);
        }

        // Badge spotlight
        await ctx.delay(400);
        const reqItem = firstVisible(REQ.reqByName(REQUEST_NAME));
        if (reqItem) await spotlightEl(ctx, reqItem, 1200);
      },
    },

    // ── Step 5: Batch Promotion ──
    {
      id: 'req5-batch',
      title: 'Batch Promote a Collection',
      description:
        'For bulk workflows, right-click the collection and select **"Send to Harness"**. ' +
        'This opens the batch modal where you can:\n\n' +
        '- Select/deselect individual requests with checkboxes\n' +
        '- See a preview of what will be created\n' +
        '- Apply validation presets to all tests at once\n\n' +
        'Folder structure is preserved: each folder becomes a Test Scenario.',
      highlight: REQ.colByName(COLLECTION_NAME),
      preAction: async (ctx) => {
        ensureRequestsTab(ctx);
        await closeOpenOverlays(ctx);
        const envId = ensureSettingsEnvironment(ENV_NAME);
        if (envId) ensureSettingsMicroservice(SVC_NAME, { [envId]: SVC_BASE_URL });
        if (!document.querySelector(REQ.colByName(COLLECTION_NAME))) {
          await createCollectionIfNeeded(ctx);
          await ensureRequestExists(ctx);
        }
      },
      action: async (ctx) => {
        const col = firstVisible(REQ.colByName(COLLECTION_NAME));
        if (!col) return;
        await spotlightEl(ctx, col, 800);

        const opened = await openContextMenuForElement(ctx, col);
        if (!opened) return;
        await ctx.delay(400);

        const menu = firstVisible(REQ.CONTEXT_MENU);
        if (menu) {
          const batchBtn = Array.from(menu.querySelectorAll<HTMLButtonElement>('button'))
            .find(b => b.textContent?.trim() === 'Send to Harness');
          if (batchBtn) {
            await spotlightElNoScroll(ctx, batchBtn, 900);
            batchBtn.click();
          }
        }
        await ctx.delay(600);
        await ctx.waitFor(REQ.BATCH_HARNESS_MODAL, 2000);
        await spotlight(ctx, REQ.BATCH_HARNESS_MODAL, 1500);

        // Close batch modal
        const modal = document.querySelector(REQ.BATCH_HARNESS_MODAL);
        if (modal) {
          const cancel = modal.querySelector<HTMLElement>('[data-testid="send-harness-cancel"]');
          if (cancel) { cancel.click(); await ctx.delay(300); }
        }
      },
    },
  ],
};
