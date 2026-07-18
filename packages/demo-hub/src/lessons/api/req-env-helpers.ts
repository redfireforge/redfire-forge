/**
 * Shared Environment Manager helpers for API demo lessons.
 * Used by REQ-5 (Send to Harness) where env + microservice are required
 * as promotion targets — not by Gallery-import lessons (absolute URLs).
 */
import type { DemoActionContext } from '../../types';
import { EM, REQ } from '@shared/selectors';
import {
  emAddProtocolItemSel,
  emEnvByNameSel,
  emSvcByNameSel,
  emSvcConfigureByNameSel,
} from '@shared/selectors';
import { fillControlledInput } from '../setup-helpers';
import { spotlightAndPause } from './req-demo-helpers';

export const REQ_DEMO_ENV_NAME = 'demo';
export const REQ_DEMO_SVC_NAME = 'jsonplaceholder';
export const REQ_DEMO_HTTP_BASE_URL = 'https://jsonplaceholder.typicode.com';

export async function ensureDemoEnvOnEnvironmentPage(
  ctx: { delay: (ms: number) => Promise<void> },
): Promise<void> {
  const envRow = document.querySelector(emEnvByNameSel(REQ_DEMO_ENV_NAME));
  if (envRow) return;
  const envInput = document.querySelector<HTMLInputElement>(EM.ADD_ENV_INPUT);
  if (!envInput) return;
  fillControlledInput(envInput, REQ_DEMO_ENV_NAME);
  await ctx.delay(200);
  const addEnvBtn = document.querySelector<HTMLButtonElement>(EM.ADD_ENV_BTN);
  if (addEnvBtn) addEnvBtn.click();
  await ctx.delay(400);
}

export async function ensureDemoSvcOnEnvironmentPage(
  ctx: { delay: (ms: number) => Promise<void> },
): Promise<void> {
  const svcCard = document.querySelector(emSvcByNameSel(REQ_DEMO_SVC_NAME));
  if (svcCard) return;
  const svcInput = document.querySelector<HTMLInputElement>(EM.ADD_SVC_INPUT);
  if (!svcInput) return;
  fillControlledInput(svcInput, REQ_DEMO_SVC_NAME);
  await ctx.delay(200);
  const addSvcBtn = document.querySelector<HTMLButtonElement>(EM.ADD_SVC_BTN);
  if (addSvcBtn) addSvcBtn.click();
  await ctx.delay(400);
}

export async function ensureDemoEnvAndSvcOnEnvironmentPage(
  ctx: { delay: (ms: number) => Promise<void> },
): Promise<void> {
  await ensureDemoEnvOnEnvironmentPage(ctx);
  await ensureDemoSvcOnEnvironmentPage(ctx);
}

/**
 * Visibly create demo env + jsonplaceholder svc with spotlights.
 * Skips create (still highlights) when they already exist — safe for reuse.
 */
export async function createDemoEnvAndSvcVisible(ctx: DemoActionContext): Promise<void> {
  ctx.navigateToTab('environments');
  await ctx.delay(400);
  await ctx.waitFor(EM.ADD_ENV_INPUT, 2200);

  // 1) Create (or reuse) environment "demo"
  if (!document.querySelector(emEnvByNameSel(REQ_DEMO_ENV_NAME))) {
    await spotlightAndPause(ctx, EM.ADD_ENV_INPUT, 700);
    const envInput = document.querySelector<HTMLInputElement>(EM.ADD_ENV_INPUT);
    if (envInput) {
      envInput.focus();
      await ctx.delay(200);
      fillControlledInput(envInput, REQ_DEMO_ENV_NAME);
      await ctx.delay(400);
    }
    await spotlightAndPause(ctx, EM.ADD_ENV_BTN, 500);
    await ctx.click(EM.ADD_ENV_BTN);
    await ctx.waitFor(emEnvByNameSel(REQ_DEMO_ENV_NAME), 2200);
    await ctx.delay(300);
  }

  // 2) Highlight demo environment
  await ctx.click(emEnvByNameSel(REQ_DEMO_ENV_NAME));
  await spotlightAndPause(ctx, emEnvByNameSel(REQ_DEMO_ENV_NAME), 1100);

  // 3) Create (or reuse) microservice "jsonplaceholder"
  await ctx.waitFor(EM.ADD_SVC_INPUT, 2200);
  if (!document.querySelector(emSvcByNameSel(REQ_DEMO_SVC_NAME))) {
    await spotlightAndPause(ctx, EM.ADD_SVC_INPUT, 700);
    const svcInput = document.querySelector<HTMLInputElement>(EM.ADD_SVC_INPUT);
    if (svcInput) {
      svcInput.focus();
      await ctx.delay(200);
      fillControlledInput(svcInput, REQ_DEMO_SVC_NAME);
      await ctx.delay(400);
    }
    await spotlightAndPause(ctx, EM.ADD_SVC_BTN, 500);
    await ctx.click(EM.ADD_SVC_BTN);
    await ctx.waitFor(emSvcByNameSel(REQ_DEMO_SVC_NAME), 2200);
    await ctx.delay(300);
  }

  // 4) Highlight jsonplaceholder microservice
  await ctx.click(emSvcByNameSel(REQ_DEMO_SVC_NAME));
  await spotlightAndPause(ctx, emSvcByNameSel(REQ_DEMO_SVC_NAME), 1200);
}

export async function ensureJsonplaceholderHttpConfigured(ctx: {
  click: (selector: string) => Promise<void>;
  delay: (ms: number) => Promise<void>;
  waitFor: (selector: string, timeout?: number) => Promise<void>;
}): Promise<void> {
  await ctx.waitFor(emSvcByNameSel(REQ_DEMO_SVC_NAME), 2200);

  const svcToggle = document.querySelector<HTMLButtonElement>(emSvcConfigureByNameSel(REQ_DEMO_SVC_NAME));
  if (svcToggle?.textContent?.includes('Configure')) {
    await ctx.click(emSvcConfigureByNameSel(REQ_DEMO_SVC_NAME));
    await ctx.delay(850);
  }

  await ctx.waitFor(EM.PROTOCOL_PANEL, 2200);

  if (!document.querySelector(EM.PROTOCOL_TAB_HTTP)) {
    await ctx.waitFor(EM.ADD_PROTOCOL_BTN, 2200);
    await ctx.click(EM.ADD_PROTOCOL_BTN);
    await ctx.delay(700);
    await ctx.waitFor(emAddProtocolItemSel('http'), 2200);
    await ctx.click(emAddProtocolItemSel('http'));
    await ctx.delay(900);
  }

  await ctx.waitFor(EM.PROTOCOL_TAB_HTTP, 2200);
  await ctx.click(EM.PROTOCOL_TAB_HTTP);
  await ctx.delay(700);
}

function findEnvBaseUrlRowByName(envName: string): HTMLTableRowElement | null {
  const chip = document.querySelector<HTMLElement>(
    `${emSvcByNameSel(REQ_DEMO_SVC_NAME)} .svc-env-table [data-env-name="${envName}"]`,
  );
  if (!chip) return null;
  return chip.closest('tr');
}

export async function ensureDemoBaseUrlConfigured(ctx: {
  click: (selector: string) => Promise<void>;
  delay: (ms: number) => Promise<void>;
  fill: (selector: string, value: string) => Promise<void>;
  waitFor: (selector: string, timeout?: number) => Promise<void>;
}): Promise<void> {
  await ensureJsonplaceholderHttpConfigured(ctx);
  const demoRow = findEnvBaseUrlRowByName(REQ_DEMO_ENV_NAME);
  if (!demoRow) return;

  const deployCheckbox = demoRow.querySelector<HTMLInputElement>('input[type="checkbox"]');
  if (deployCheckbox && !deployCheckbox.checked) {
    deployCheckbox.click();
    await ctx.delay(650);
  }

  const baseUrlLabel = demoRow.querySelector<HTMLElement>('.em-url-text, .svc-env-url-empty')?.textContent ?? '';
  if (baseUrlLabel.includes(REQ_DEMO_HTTP_BASE_URL)) {
    return;
  }

  const editButton = demoRow.querySelector<HTMLButtonElement>('[data-testid="em-endpoint-edit-btn"]');
  if (editButton) {
    editButton.click();
    await ctx.delay(520);
  }

  await ctx.waitFor(EM.ENDPOINT_EDIT_INPUT, 2200);
  await ctx.fill(EM.ENDPOINT_EDIT_INPUT, REQ_DEMO_HTTP_BASE_URL);
  await ctx.delay(900);
  await ctx.click(EM.ENDPOINT_SAVE);
  await ctx.delay(900);
}

/**
 * Resolve harness cascade target IDs by option label ("demo" / "jsonplaceholder").
 * Modal must be open. Returns null if the env option is missing.
 */
export function resolveHarnessTargetByName(
  envName = REQ_DEMO_ENV_NAME,
  svcName = REQ_DEMO_SVC_NAME,
): { envId: string; svcId: string } | null {
  const envSel = document.querySelector<HTMLSelectElement>(`${REQ.HARNESS_CASCADE_ENV} select`);
  const svcSel = document.querySelector<HTMLSelectElement>(`${REQ.HARNESS_CASCADE_SVC} select`);
  if (!envSel) return null;

  const envOpt = Array.from(envSel.options).find(
    (o) => o.textContent?.trim().toLowerCase() === envName.toLowerCase(),
  );
  if (!envOpt) return null;

  const svcOpt = svcSel
    ? Array.from(svcSel.options).find(
        (o) => o.textContent?.trim().toLowerCase() === svcName.toLowerCase(),
      )
    : undefined;

  return { envId: envOpt.value, svcId: svcOpt?.value ?? '' };
}
