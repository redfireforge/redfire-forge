import type { DemoActionContext } from '../../types';
import { REQ } from '@shared/selectors';
import { showSpotlightRing } from '../../demoRipple';
import { triggerContextMenu } from './req-demo-helpers';

let activeSpotlightCleanup: (() => void) | null = null;

export async function spotlight(ctx: DemoActionContext, selector: string, holdMs: number): Promise<void> {
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) return;
  activeSpotlightCleanup?.();
  activeSpotlightCleanup = null;
  el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  const remove = showSpotlightRing(el);
  activeSpotlightCleanup = remove;
  try {
    await ctx.delay(holdMs);
  } finally {
    remove();
    if (activeSpotlightCleanup === remove) activeSpotlightCleanup = null;
  }
}

export async function spotlightEl(ctx: DemoActionContext, el: HTMLElement, holdMs: number): Promise<void> {
  activeSpotlightCleanup?.();
  activeSpotlightCleanup = null;
  el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  const remove = showSpotlightRing(el);
  activeSpotlightCleanup = remove;
  try {
    await ctx.delay(holdMs);
  } finally {
    remove();
    if (activeSpotlightCleanup === remove) activeSpotlightCleanup = null;
  }
}

export async function spotlightElNoScroll(ctx: DemoActionContext, el: HTMLElement, holdMs: number): Promise<void> {
  activeSpotlightCleanup?.();
  activeSpotlightCleanup = null;
  const remove = showSpotlightRing(el);
  activeSpotlightCleanup = remove;
  try {
    await ctx.delay(holdMs);
  } finally {
    remove();
    if (activeSpotlightCleanup === remove) activeSpotlightCleanup = null;
  }
}

export function isVisible(el: Element | null): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;
  const style = getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
}

export function firstVisible(selector: string): HTMLElement | null {
  return Array.from(document.querySelectorAll<HTMLElement>(selector)).find(isVisible) ?? null;
}

export function findRequestVisibleInCollection(collectionName: string, requestName: string): HTMLElement | null {
  const group = document.querySelector<HTMLElement>(REQ.colByName(collectionName))?.closest('.req-col-group');
  if (!group) return null;
  const requests = Array.from(group.querySelectorAll<HTMLElement>(REQ.REQ_ITEM));
  return requests.find((el) => el.getAttribute('data-req-name') === requestName && isVisible(el)) ?? null;
}

export async function openContextMenuForElement(ctx: DemoActionContext, el: HTMLElement): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    triggerContextMenu(el);
    await ctx.waitFor(REQ.CONTEXT_MENU, 700);
    if (firstVisible(REQ.CONTEXT_MENU)) return true;
    await ctx.delay(120);
  }
  return !!firstVisible(REQ.CONTEXT_MENU);
}

export async function clickContextItemVisible(ctx: DemoActionContext, text: string): Promise<boolean> {
  const menu = firstVisible(REQ.CONTEXT_MENU);
  if (!menu) return false;
  const btn = Array.from(menu.querySelectorAll<HTMLButtonElement>('button'))
    .find(b => b.textContent?.trim() === text);
  if (!btn) return false;
  btn.click();
  await ctx.delay(180);
  return true;
}

export async function spotlightContextItem(
  ctx: DemoActionContext,
  text: string,
  holdMs = 1000,
): Promise<HTMLButtonElement | null> {
  const menu = firstVisible(REQ.CONTEXT_MENU);
  if (!menu) return null;
  const btn = Array.from(menu.querySelectorAll<HTMLButtonElement>('button'))
    .find(b => b.textContent?.trim() === text);
  if (!btn) return null;
  await spotlightElNoScroll(ctx, btn, holdMs);
  return btn;
}
