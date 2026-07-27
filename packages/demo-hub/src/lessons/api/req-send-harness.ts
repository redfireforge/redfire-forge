/**
 * REQ-5 v2: Send to Harness (Promotion)
 *
 * 7 steps: set up env + microservice → create request from scratch →
 * open promotion modal + select target → review options panel →
 * confirm + see badge + explore promoted test → edit test → batch promote.
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
  fillNewRequestPrompt,
  cleanupOtherRequestDemoCollections,
} from './req-demo-helpers';
import {
  ensureSettingsEnvironment,
  removeSettingsEnvironment,
  ensureSettingsMicroservice,
  removeSettingsMicroservice,
} from '../../adapters';
import { getDemoBridgeWindow } from '../../adapters/bridgeWindow';
import {
  reqSendHarnessConcept,
  reqSendHarnessLessonDescription,
  reqSendHarnessStepDescriptions,
} from './req-send-harness-content';

const COLLECTION_NAME = 'Promotion Demo';
const REQUEST_NAME = 'Get Users';
const REQUEST_URL = 'https://jsonplaceholder.typicode.com/users';
const REQUEST2_NAME = 'Get Todos';
const REQUEST2_URL = 'https://jsonplaceholder.typicode.com/todos';
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
    .find((button) => button.textContent?.trim() === text);
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
    const cancel = harness.querySelector<HTMLElement>('[data-testid="send-harness-cancel"]')
      ?? harness.querySelector<HTMLElement>('.send-harness-cancel-btn');
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
  await fillNewRequestPrompt(ctx, REQUEST_NAME);
  await ctx.waitFor(REQ.URL_INPUT, 2200);
  const urlInput = document.querySelector<HTMLInputElement>(REQ.URL_INPUT);
  if (urlInput) fillControlledInput(urlInput, REQUEST_URL);
}
const FG_NAME = 'API Tests';
function cleanupDemoFeatureGroups(): void {
  getDemoBridgeWindow().__demoDeleteFeatureGroupsByName?.(FG_NAME);
}
async function clickCascadeOption(
  ctx: { delay: (ms: number) => Promise<void> },
  containerSel: string,
  matchText: string,
): Promise<void> {
  const field = document.querySelector<HTMLElement>(containerSel);
  if (!field) return;
  const trigger = field.querySelector<HTMLButtonElement>('.cascade-dropdown-trigger');
  if (!trigger) return;
  trigger.click();
  await ctx.delay(120);
  const item = Array.from(field.querySelectorAll<HTMLButtonElement>('.cascade-dropdown-item'))
    .find(i => {
      const name = i.querySelector('.cascade-dropdown-item-name')?.textContent?.trim().toLowerCase();
      return name === matchText.toLowerCase();
    });
  if (item) { item.scrollIntoView({ block: 'nearest' }); await ctx.delay(60); item.click(); await ctx.delay(80); }
}
async function clickCascadeCreate(
  ctx: { delay: (ms: number) => Promise<void> },
  containerSel: string,
  newName: string,
): Promise<void> {
  const field = document.querySelector<HTMLElement>(containerSel);
  if (!field) return;
  const trigger = field.querySelector<HTMLButtonElement>('.cascade-dropdown-trigger');
  if (!trigger) return;
  trigger.click();
  await ctx.delay(120);
  const createBtn = field.querySelector<HTMLButtonElement>('.cascade-dropdown-create');
  if (createBtn) { createBtn.click(); await ctx.delay(80); }
  const input = field.querySelector<HTMLInputElement>('input');
  if (input) fillControlledInput(input, newName);
  await ctx.delay(50);
}
async function fillCascadeSelections(
  ctx: { delay: (ms: number) => Promise<void> },
): Promise<void> {
  await clickCascadeOption(ctx, REQ.HARNESS_CASCADE_ENV, ENV_NAME);
  await clickCascadeOption(ctx, REQ.HARNESS_CASCADE_SVC, SVC_NAME);
  await clickCascadeCreate(ctx, REQ.HARNESS_CASCADE_GROUP, FG_NAME);
  await clickCascadeCreate(ctx, REQ.HARNESS_CASCADE_SCENARIO, 'User Endpoints');
}
export const reqSendHarnessLesson: DemoLesson = {
  id: 'req-send-harness',
  domainId: 'api',
  category: 'requests',
  name: 'Send to Harness (Promotion)',
  description: reqSendHarnessLessonDescription,
  estimatedMinutes: 7,
  initialTab: 'requests',
  allowedTabs: ['requests', 'environments', 'scenarios'],
  concept: reqSendHarnessConcept,

  setup: async (ctx) => {
    ctx.navigateToTab('requests');
    await ctx.delay(80);
    await closeExtraRequestTabs(ctx);
    await closeOpenOverlays(ctx);
    await deleteCollectionByName(ctx, COLLECTION_NAME);
    await cleanupOtherRequestDemoCollections(ctx, [COLLECTION_NAME]);
    cleanupDemoFeatureGroups();
    removeSettingsMicroservice(SVC_NAME);
    removeSettingsEnvironment(ENV_NAME);
    await shrinkAllCollections();
  },

  cleanup: async (ctx) => {
    await closeOpenOverlays(ctx);
    await closeExtraRequestTabs(ctx);
    await deleteCollectionByName(ctx, COLLECTION_NAME);
    await cleanupOtherRequestDemoCollections(ctx, [COLLECTION_NAME]);
    cleanupDemoFeatureGroups();
    removeSettingsMicroservice(SVC_NAME);
    removeSettingsEnvironment(ENV_NAME);
    ctx.navigateToTab('requests');
    await ctx.delay(60);
  },
  steps: [
    {
      id: 'req5-env',
      title: 'Create Demo Environment',
      description: reqSendHarnessStepDescriptions.env,
      preAction: async (ctx) => {
        ensureRequestsTab(ctx);
        await closeOpenOverlays(ctx);
        await deleteCollectionByName(ctx, COLLECTION_NAME);
        removeSettingsMicroservice(SVC_NAME);
        removeSettingsEnvironment(ENV_NAME);
      },
      action: async (ctx) => {
        ctx.navigateToTab('environments');
        await ctx.delay(700);
        await ctx.waitFor(EM.ADD_ENV_INPUT, 2200);
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
        const envTable = document.querySelector<HTMLElement>(`${svcSel} .svc-env-table`);
        if (envTable) await spotlightEl(ctx, envTable, 1200);
      },
    },
    {
      id: 'req5-setup',
      title: 'Create Collection & Request',
      description: reqSendHarnessStepDescriptions.setup,
      preAction: async (ctx) => {
        ensureRequestsTab(ctx);
        await closeOpenOverlays(ctx);
        await deleteCollectionByName(ctx, COLLECTION_NAME);
        await shrinkAllCollections();
        const envId = ensureSettingsEnvironment(ENV_NAME);
        if (envId) ensureSettingsMicroservice(SVC_NAME, { [envId]: SVC_BASE_URL });
      },
      action: async (ctx) => {
        ctx.navigateToTab('requests');
        await ctx.delay(300);
        await shrinkAllCollections();
        await spotlight(ctx, REQ.SIDEBAR_ADD_BTN, 900);
        await ctx.click(REQ.SIDEBAR_ADD_BTN);
        await ctx.waitFor(REQ.ADD_DROPDOWN, 1500);
        await ctx.delay(400);
        const addColItem = firstVisible(REQ.ADD_URL_COLLECTION);
        if (addColItem) await spotlightElNoScroll(ctx, addColItem, 800);
        await ctx.click(REQ.ADD_URL_COLLECTION);
        await ctx.waitFor(REQ.COLLECTION_MODAL, 2000);
        await ctx.delay(500);
        const nameInput = document.querySelector<HTMLInputElement>('.req-col-modal .req-input');
        if (nameInput) {
          await spotlightElNoScroll(ctx, nameInput, 700);
          nameInput.focus();
          fillControlledInput(nameInput, COLLECTION_NAME);
          nameInput.blur();
          await ctx.delay(500);
          await spotlightElNoScroll(ctx, nameInput, 800);
        }
        const createBtn = document.querySelector<HTMLButtonElement>('.req-col-modal .btn-primary');
        if (createBtn) {
          await spotlightElNoScroll(ctx, createBtn, 700);
          createBtn.click();
        }
        await ctx.delay(500);
        const col = firstVisible(REQ.colByName(COLLECTION_NAME));
        if (!col) return;
        await spotlightEl(ctx, col, 900);
        const opened = await openContextMenuForElement(ctx, col);
        if (!opened) return;
        await ctx.delay(400);
        const menu = firstVisible(REQ.CONTEXT_MENU);
        if (menu) {
          const addReqItem = Array.from(menu.querySelectorAll<HTMLButtonElement>('button'))
            .find(b => b.textContent?.trim() === 'Add Request');
          if (addReqItem) await spotlightElNoScroll(ctx, addReqItem, 800);
        }
        await clickContextItemVisible(ctx, 'Add Request');
        await ctx.delay(500);
        await fillNewRequestPrompt(ctx, REQUEST_NAME);
        await ctx.waitFor(REQ.URL_INPUT, 2200);
        await ctx.delay(400);
        const reqItem = firstVisible(REQ.reqByName(REQUEST_NAME));
        if (reqItem) await spotlightEl(ctx, reqItem, 900);
        const urlInput = document.querySelector<HTMLInputElement>(REQ.URL_INPUT);
        if (urlInput) {
          await spotlightElNoScroll(ctx, urlInput, 700);
          urlInput.focus();
          fillControlledInput(urlInput, REQUEST_URL);
          urlInput.blur();
          await ctx.delay(400);
          await spotlightElNoScroll(ctx, urlInput, 900);
        }
        await spotlight(ctx, REQ.SEND_BTN, 900);
        await ctx.click(REQ.SEND_BTN);
        await ctx.waitFor(REQ.STATUS_PILL, 5000);
        await spotlight(ctx, REQ.STATUS_PILL, 1200);
      },
    },
    {
      id: 'req5-promote',
      title: 'Open Promotion Modal',
      description: reqSendHarnessStepDescriptions.promote,
      preAction: async (ctx) => {
        ensureRequestsTab(ctx);
        await closeOpenOverlays(ctx);
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
        await spotlight(ctx, REQ.SEND_HARNESS_BTN, 1000);
        await ctx.click(REQ.SEND_HARNESS_BTN);
        await ctx.waitFor(REQ.HARNESS_MODAL, 2000);
        await ctx.delay(600);
        await spotlight(ctx, REQ.HARNESS_CASCADE_ENV, 1000);
        const envField = document.querySelector<HTMLElement>(REQ.HARNESS_CASCADE_ENV);
        if (envField) {
          const envTrigger = envField.querySelector<HTMLButtonElement>('.cascade-dropdown-trigger');
          if (envTrigger) {
            envTrigger.click();
            await ctx.delay(500);
            const envItem = Array.from(envField.querySelectorAll<HTMLButtonElement>('.cascade-dropdown-item'))
              .find(i => i.querySelector('.cascade-dropdown-item-name')?.textContent?.trim().toLowerCase() === ENV_NAME);
            if (envItem) {
              envItem.scrollIntoView({ block: 'nearest' });
              await ctx.delay(300);
              await spotlightElNoScroll(ctx, envItem, 800);
              envItem.click();
              await ctx.delay(500);
            }
          }
        }
        await spotlight(ctx, REQ.HARNESS_CASCADE_ENV, 900);
        await spotlight(ctx, REQ.HARNESS_CASCADE_SVC, 1000);
        const svcField = document.querySelector<HTMLElement>(REQ.HARNESS_CASCADE_SVC);
        if (svcField) {
          const svcTrigger = svcField.querySelector<HTMLButtonElement>('.cascade-dropdown-trigger');
          if (svcTrigger) {
            svcTrigger.click();
            await ctx.delay(500);
            const svcItem = Array.from(svcField.querySelectorAll<HTMLButtonElement>('.cascade-dropdown-item'))
              .find(i => i.querySelector('.cascade-dropdown-item-name')?.textContent?.trim().toLowerCase() === SVC_NAME);
            if (svcItem) {
              svcItem.scrollIntoView({ block: 'nearest' });
              await ctx.delay(300);
              await spotlightElNoScroll(ctx, svcItem, 800);
              svcItem.click();
              await ctx.delay(500);
            }
          }
        }
        await spotlight(ctx, REQ.HARNESS_CASCADE_SVC, 900);
        await spotlight(ctx, REQ.HARNESS_CASCADE_GROUP, 1000);
        const groupField = document.querySelector<HTMLElement>(REQ.HARNESS_CASCADE_GROUP);
        if (groupField) {
          const groupTrigger = groupField.querySelector<HTMLButtonElement>('.cascade-dropdown-trigger');
          if (groupTrigger) {
            groupTrigger.click();
            await ctx.delay(400);
            const createBtn = groupField.querySelector<HTMLButtonElement>('.cascade-dropdown-create');
            if (createBtn) {
              await spotlightElNoScroll(ctx, createBtn, 700);
              createBtn.click();
              await ctx.delay(350);
            }
          }
          const groupInput = groupField.querySelector<HTMLInputElement>('input');
          if (groupInput) {
            fillControlledInput(groupInput, FG_NAME);
            groupInput.blur();
          }
        }
        await ctx.delay(500);
        await spotlight(ctx, REQ.HARNESS_CASCADE_GROUP, 900);
        await spotlight(ctx, REQ.HARNESS_CASCADE_SCENARIO, 1000);
        const scenarioField = document.querySelector<HTMLElement>(REQ.HARNESS_CASCADE_SCENARIO);
        if (scenarioField) {
          const scenarioTrigger = scenarioField.querySelector<HTMLButtonElement>('.cascade-dropdown-trigger');
          if (scenarioTrigger) {
            scenarioTrigger.click();
            await ctx.delay(400);
            const createBtn = scenarioField.querySelector<HTMLButtonElement>('.cascade-dropdown-create');
            if (createBtn) {
              await spotlightElNoScroll(ctx, createBtn, 700);
              createBtn.click();
              await ctx.delay(350);
            }
          }
          const scenarioInput = scenarioField.querySelector<HTMLInputElement>('input');
          if (scenarioInput) {
            fillControlledInput(scenarioInput, 'User Endpoints');
            scenarioInput.blur();
          }
        }
        await ctx.delay(500);
        await spotlight(ctx, REQ.HARNESS_CASCADE_SCENARIO, 900);
      },
    },
    {
      id: 'req5-confirm',
      title: 'Review Options & Preview',
      description: reqSendHarnessStepDescriptions.confirm,
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
          await fillCascadeSelections(ctx);
        }
      },
      action: async (ctx) => {
        const nextBtn = document.querySelector<HTMLButtonElement>(REQ.HARNESS_NEXT_BTN);
        if (nextBtn && !nextBtn.disabled) {
          await spotlight(ctx, REQ.HARNESS_NEXT_BTN, 900);
          nextBtn.click();
          await ctx.delay(800);
        }
        const summary = document.querySelector<HTMLElement>('.send-harness-target-summary');
        if (summary) await spotlightElNoScroll(ctx, summary, 1000);
        const previewCard = document.querySelector<HTMLElement>('.send-harness-preview-card');
        if (previewCard) await spotlightElNoScroll(ctx, previewCard, 1200);
        const authGroup = document.querySelector<HTMLElement>('.send-harness-option-group:first-child');
        if (authGroup) await spotlightElNoScroll(ctx, authGroup, 1100);
        const validationGroup = document.querySelector<HTMLElement>('.send-harness-option-group:last-child');
        if (validationGroup) await spotlightElNoScroll(ctx, validationGroup, 1100);
      },
    },
    {
      id: 'req5-explore',
      title: 'Confirm & Explore Promoted Test',
      description: reqSendHarnessStepDescriptions.explore,
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
          await fillCascadeSelections(ctx);
          const nextBtn = document.querySelector<HTMLButtonElement>(REQ.HARNESS_NEXT_BTN);
          if (nextBtn && !nextBtn.disabled) { nextBtn.click(); await ctx.delay(150); }
        }
      },
      action: async (ctx) => {
        await spotlight(ctx, REQ.HARNESS_CONFIRM_BTN, 1000);
        const confirmBtn = document.querySelector<HTMLButtonElement>(REQ.HARNESS_CONFIRM_BTN);
        if (confirmBtn) {
          confirmBtn.click();
          await ctx.delay(600);
        }
        await ctx.delay(400);
        const reqItem = firstVisible(REQ.reqByName(REQUEST_NAME));
        if (reqItem) await spotlightEl(ctx, reqItem, 1200);
        ctx.navigateToTab('scenarios');
        await ctx.delay(800);
        const fgHeader = Array.from(document.querySelectorAll<HTMLElement>('.feature-group-header'))
          .find(h => h.querySelector('.feature-group-name')?.textContent?.trim() === FG_NAME);
        if (fgHeader) {
          fgHeader.scrollIntoView({ block: 'nearest' });
          await spotlightElNoScroll(ctx, fgHeader, 1000);
          const expandIcon = fgHeader.querySelector<HTMLElement>('.expand-icon');
          if (expandIcon && !expandIcon.classList.contains('expanded')) {
            fgHeader.click();
            await ctx.delay(600);
          }
          const actions = fgHeader.querySelector<HTMLElement>('.feature-group-actions');
          if (actions) await spotlightElNoScroll(ctx, actions, 1200);
        }
        await ctx.delay(400);
        const scHeader = Array.from(document.querySelectorAll<HTMLElement>('.scenario-group-header'))
          .find(h => h.querySelector('.scenario-group-name')?.textContent?.trim() === 'User Endpoints');
        if (scHeader) {
          scHeader.scrollIntoView({ block: 'nearest' });
          await spotlightElNoScroll(ctx, scHeader, 1000);
          const expandIcon = scHeader.querySelector<HTMLElement>('.expand-icon');
          if (expandIcon && !expandIcon.classList.contains('expanded')) {
            scHeader.click();
            await ctx.delay(600);
          }
        }
        await ctx.delay(400);
        const testCard = Array.from(document.querySelectorAll<HTMLElement>('.test-card'))
          .find(tc => tc.querySelector('strong')?.textContent?.trim() === REQUEST_NAME);
        if (testCard) {
          testCard.scrollIntoView({ block: 'nearest' });
          await spotlightElNoScroll(ctx, testCard, 1200);
          const info = testCard.querySelector<HTMLElement>('.test-card-info');
          if (info) await spotlightElNoScroll(ctx, info, 1000);
          const meta = testCard.querySelector<HTMLElement>('.test-card-meta');
          if (meta) await spotlightElNoScroll(ctx, meta, 1000);
          const testActions = testCard.querySelector<HTMLElement>('.test-card-actions');
          if (testActions) await spotlightElNoScroll(ctx, testActions, 1200);
        }
      },
    },
    {
      id: 'req5-edit',
      title: 'Edit the Promoted Test',
      description: reqSendHarnessStepDescriptions.edit,
      preAction: async (ctx) => {
        const envId = ensureSettingsEnvironment(ENV_NAME);
        if (envId) ensureSettingsMicroservice(SVC_NAME, { [envId]: SVC_BASE_URL });
        ctx.navigateToTab('scenarios');
        await ctx.delay(300);
      },
      action: async (ctx) => {
        const testCard = Array.from(document.querySelectorAll<HTMLElement>('.test-card'))
          .find(tc => tc.querySelector('strong')?.textContent?.trim() === REQUEST_NAME);
        if (!testCard) return;
        testCard.scrollIntoView({ block: 'nearest' });
        const editBtn = Array.from(testCard.querySelectorAll<HTMLButtonElement>('.btn'))
          .find(b => b.textContent?.trim() === 'Edit');
        if (!editBtn) return;
        await spotlightElNoScroll(ctx, editBtn, 1000);
        editBtn.click();
        await ctx.delay(800);
        await ctx.waitFor('.rf-builder-modal .builder-panel', 3000);
        await ctx.delay(600);
        const propCard = document.querySelector<HTMLElement>('.rf-builder-modal .te-prop-card');
        if (propCard) await spotlightElNoScroll(ctx, propCard, 1200);
        const propRows = document.querySelectorAll<HTMLElement>('.rf-builder-modal .te-prop-row');
        if (propRows[0]) await spotlightElNoScroll(ctx, propRows[0], 900);
        const urlRow = Array.from(propRows).find(r =>
          r.querySelector('.te-prop-label')?.textContent?.trim() === 'URL',
        );
        if (urlRow) await spotlightElNoScroll(ctx, urlRow, 900);
        const toolbar = document.querySelector<HTMLElement>('.rf-builder-modal .mode-toggle');
        if (toolbar) await spotlightElNoScroll(ctx, toolbar, 1100);
        const tabBar = document.querySelector<HTMLElement>('.rf-builder-modal .builder-tabs');
        if (tabBar) await spotlightElNoScroll(ctx, tabBar, 1100);
        const validationTab = Array.from(
          document.querySelectorAll<HTMLButtonElement>('.rf-builder-modal .builder-tab'),
        ).find(t => t.textContent?.trim().startsWith('Validation'));
        if (validationTab) {
          validationTab.click();
          await ctx.delay(600);
          await spotlightElNoScroll(ctx, validationTab, 900);
        }
        const tabContent = document.querySelector<HTMLElement>('.rf-builder-modal .builder-tab-content');
        if (tabContent) await spotlightElNoScroll(ctx, tabContent, 1100);
        const saveBtn = document.querySelector<HTMLElement>('.rf-builder-modal .ram-modal-footer .btn-primary');
        if (saveBtn) await spotlightElNoScroll(ctx, saveBtn, 900);
        await ctx.delay(400);
        const cancelBtn = document.querySelector<HTMLElement>('.rf-builder-modal .ram-modal-footer .btn-secondary');
        if (cancelBtn) {
          await spotlightElNoScroll(ctx, cancelBtn, 700);
          cancelBtn.click();
          await ctx.delay(400);
        }
      },
    },
    {
      id: 'req5-batch',
      title: 'Batch Promote a Collection',
      description: reqSendHarnessStepDescriptions.batch,
      highlight: REQ.colByName(COLLECTION_NAME),
      preAction: async (ctx) => {
        dismissContextMenu();
        await closeOpenOverlays(ctx);
        const envId = ensureSettingsEnvironment(ENV_NAME);
        if (envId) ensureSettingsMicroservice(SVC_NAME, { [envId]: SVC_BASE_URL });
        ctx.navigateToTab('requests');
        await ctx.delay(120);
        if (!document.querySelector(REQ.colByName(COLLECTION_NAME))) {
          await createCollectionIfNeeded(ctx);
          await ensureRequestExists(ctx);
        }
        const existing2 = document.querySelector<HTMLElement>(REQ.reqByName(REQUEST2_NAME));
        if (existing2) {
          const opened = await openContextMenuForElement(ctx, existing2);
          if (opened) {
            await clickContextItemVisible(ctx, 'Delete Request');
            const confirmBtn = document.querySelector<HTMLElement>('.req-confirm-dialog .req-confirm-ok');
            if (confirmBtn) { confirmBtn.click(); await ctx.delay(120); }
          }
        }
      },
      action: async (ctx) => {
        ctx.navigateToTab('requests');
        await ctx.delay(300);
        await ensureCollectionExpanded(ctx, COLLECTION_NAME);
        {
          const col = firstVisible(REQ.colByName(COLLECTION_NAME));
          if (!col) return;
          const opened = await openContextMenuForElement(ctx, col);
          if (!opened) return;
          await ctx.delay(400);
          const menu = firstVisible(REQ.CONTEXT_MENU);
          if (menu) {
            const addReqItem = Array.from(menu.querySelectorAll<HTMLButtonElement>('button'))
              .find(b => b.textContent?.trim() === 'Add Request');
            if (addReqItem) await spotlightElNoScroll(ctx, addReqItem, 800);
          }
          await clickContextItemVisible(ctx, 'Add Request');
          await ctx.delay(500);
          await fillNewRequestPrompt(ctx, REQUEST2_NAME);
          await ctx.waitFor(REQ.URL_INPUT, 2200);
          await ctx.delay(400);

          const urlInput = document.querySelector<HTMLInputElement>(REQ.URL_INPUT);
          if (urlInput) {
            await spotlightElNoScroll(ctx, urlInput, 700);
            urlInput.focus();
            fillControlledInput(urlInput, REQUEST2_URL);
            urlInput.blur();
            await ctx.delay(400);
            await spotlightElNoScroll(ctx, urlInput, 800);
          }
        }
        const req2Item = firstVisible(REQ.reqByName(REQUEST2_NAME));
        if (req2Item) await spotlightEl(ctx, req2Item, 900);
        const req1Item = firstVisible(REQ.reqByName(REQUEST_NAME));
        if (req1Item) await spotlightEl(ctx, req1Item, 900);
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
        await ctx.delay(400);
        const envField = document.querySelector<HTMLElement>(REQ.HARNESS_CASCADE_ENV);
        if (envField) {
          await spotlightElNoScroll(ctx, envField, 900);
          const envTrigger = envField.querySelector<HTMLButtonElement>('.cascade-dropdown-trigger');
          if (envTrigger) {
            envTrigger.click();
            await ctx.delay(500);
            const envItem = Array.from(envField.querySelectorAll<HTMLButtonElement>('.cascade-dropdown-item'))
              .find(i => i.querySelector('.cascade-dropdown-item-name')?.textContent?.trim().toLowerCase() === ENV_NAME);
            if (envItem) {
              envItem.scrollIntoView({ block: 'nearest' });
              await ctx.delay(300);
              await spotlightElNoScroll(ctx, envItem, 800);
              envItem.click();
              await ctx.delay(500);
            }
          }
        }
        const svcField = document.querySelector<HTMLElement>(REQ.HARNESS_CASCADE_SVC);
        if (svcField) {
          await spotlightElNoScroll(ctx, svcField, 900);
          const svcTrigger = svcField.querySelector<HTMLButtonElement>('.cascade-dropdown-trigger');
          if (svcTrigger) {
            svcTrigger.click();
            await ctx.delay(500);
            const svcItem = Array.from(svcField.querySelectorAll<HTMLButtonElement>('.cascade-dropdown-item'))
              .find(i => i.querySelector('.cascade-dropdown-item-name')?.textContent?.trim().toLowerCase() === SVC_NAME);
            if (svcItem) {
              svcItem.scrollIntoView({ block: 'nearest' });
              await ctx.delay(300);
              await spotlightElNoScroll(ctx, svcItem, 800);
              svcItem.click();
              await ctx.delay(500);
            }
          }
        }
        const nextBtn = document.querySelector<HTMLButtonElement>('.send-harness-next-btn');
        if (nextBtn && !nextBtn.disabled) {
          await spotlightElNoScroll(ctx, nextBtn, 900);
          nextBtn.click();
          await ctx.delay(800);
        }
        const modal = document.querySelector<HTMLElement>(REQ.BATCH_HARNESS_MODAL);
        if (!modal) return;
        const summary = modal.querySelector<HTMLElement>('.send-harness-target-summary');
        if (summary) await spotlightElNoScroll(ctx, summary, 1000);
        const listHeader = modal.querySelector<HTMLElement>('.batch-harness-list-header');
        if (listHeader) await spotlightElNoScroll(ctx, listHeader, 1000);
        const rows = modal.querySelectorAll<HTMLElement>('.batch-harness-row');
        for (const row of rows) {
          await spotlightElNoScroll(ctx, row, 800);
        }
        const previewCard = modal.querySelector<HTMLElement>('.send-harness-preview-card');
        if (previewCard) await spotlightElNoScroll(ctx, previewCard, 1200);
        const optionsGrid = modal.querySelector<HTMLElement>('.send-harness-options-grid');
        if (optionsGrid) await spotlightElNoScroll(ctx, optionsGrid, 1200);
        const confirmBtn = modal.querySelector<HTMLElement>('.send-harness-confirm-btn');
        if (confirmBtn) await spotlightElNoScroll(ctx, confirmBtn, 1000);
        await ctx.delay(400);
        const cancel = modal.querySelector<HTMLElement>('[data-testid="send-harness-cancel"]');
        if (cancel) { cancel.click(); await ctx.delay(300); }
      },
    },
  ],
};
