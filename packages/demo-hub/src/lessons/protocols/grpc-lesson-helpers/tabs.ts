import type { DemoActionContext } from '../../../types';
import { GRPC } from '@shared/selectors';
import { GRPC_DEMO_TARGET } from './constants';
import { ensureGrpcStudioSubNavQuiet } from './navigation';

/**
 * Open a fresh gRPC tab so the active call panel has no orphaned method
 * binding before a descriptor source switch (Protoset/BSR/URL).
 * Idempotent: if a blank tab already exists it stays in place.
 */
export async function openFreshGrpcTabQuiet(ctx: DemoActionContext): Promise<void> {
  await openFreshGrpcTabQuietWithOptions(ctx);
}

export async function openFreshGrpcTabQuietWithOptions(
  ctx: DemoActionContext,
  options?: { forceFresh?: boolean },
): Promise<void> {
  await ensureGrpcStudioSubNavQuiet(ctx);
  const forceFresh = options?.forceFresh === true;
  const tabBar = document.querySelector<HTMLElement>(GRPC.TAB_BAR);
  const tabs = tabBar ? Array.from(tabBar.querySelectorAll<HTMLElement>('[role="tab"]')) : [];
  const demoTabs = tabs.filter((tab) => {
    const label = tab.querySelector<HTMLElement>('.grpc-tab-label')?.textContent?.trim().toLowerCase();
    return label === 'demo';
  });

  if (demoTabs.length > 0 && !forceFresh) {
    const keepDemoTab = demoTabs.find((tab) => tab.getAttribute('aria-selected') === 'true') ?? demoTabs[0]!;
    // Close duplicate demo tabs if present.
    for (const tab of demoTabs) {
      if (tab === keepDemoTab) continue;
      const tabId = tab.getAttribute('data-testid');
      if (!tabId) continue;
      const closeBtn = document.querySelector<HTMLButtonElement>(`[data-testid="grpc-tab-close-${tabId}"]`);
      if (closeBtn && !closeBtn.disabled) {
        closeBtn.click();
        await ctx.delay(120);
      }
    }
    if (keepDemoTab.getAttribute('aria-selected') !== 'true') {
      keepDemoTab.click();
      await ctx.delay(100);
    }
  } else {
    const addTabBtn = document.querySelector<HTMLButtonElement>(GRPC.ADD_TAB);
    if (!addTabBtn || addTabBtn.disabled) return;
    addTabBtn.click();
    await ctx.delay(240);

    // Rename the active tab to "demo" so all lessons target a consistent demo tab.
    const activeTab = document.querySelector<HTMLElement>(`${GRPC.TAB_BAR} [role="tab"][aria-selected="true"]`);
    if (activeTab) {
      activeTab.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, detail: 2 }));
      let renameInput: HTMLInputElement | null = null;
      const startedAt = Date.now();
      while (Date.now() - startedAt < 1_000) {
        renameInput = document.querySelector<HTMLInputElement>('.grpc-tab-rename-input');
        if (renameInput) break;
        await ctx.delay(50);
      }
      if (renameInput) {
        const nativeSet = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
        nativeSet?.set?.call(renameInput, 'demo');
        renameInput.dispatchEvent(new Event('input', { bubbles: true }));
        renameInput.dispatchEvent(new Event('change', { bubbles: true }));
        renameInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        renameInput.blur();
        await ctx.delay(100);
      }
    }
  }

  // Copy the target so the new tab connects to the same server.
  const targetInput = document.querySelector<HTMLInputElement>(GRPC.TARGET_INPUT);
  if (targetInput && !targetInput.value.trim()) {
    const nativeSet = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
    nativeSet?.set?.call(targetInput, GRPC_DEMO_TARGET);
    targetInput.dispatchEvent(new Event('input', { bubbles: true }));
    targetInput.dispatchEvent(new Event('change', { bubbles: true }));
    await ctx.delay(200);
  }
}

/**
 * Normalize gRPC demo lesson tabs to a stable set: keep first user tab + demo tab.
 * Prevents leaked lesson-created tabs from carrying into later lessons.
 */
export async function normalizeGrpcDemoTabsQuiet(ctx: DemoActionContext): Promise<void> {
  await ensureGrpcStudioSubNavQuiet(ctx);
  const tabBar = document.querySelector<HTMLElement>(GRPC.TAB_BAR);
  if (!tabBar) return;

  const tabs = Array.from(tabBar.querySelectorAll<HTMLElement>('[role="tab"]'));
  if (tabs.length <= 2) return;

  const firstTabId = tabs[0]?.getAttribute('data-testid') ?? null;
  const demoTab = tabs.find((tab) => {
    const label = tab.querySelector<HTMLElement>('.grpc-tab-label')?.textContent?.trim().toLowerCase();
    return label === 'demo';
  }) ?? null;
  const demoTabId = demoTab?.getAttribute('data-testid') ?? null;
  const keepIds = new Set([firstTabId, demoTabId].filter((id): id is string => Boolean(id)));

  for (const tab of tabs.slice().reverse()) {
    const tabId = tab.getAttribute('data-testid');
    if (!tabId || keepIds.has(tabId)) continue;
    const closeBtn = document.querySelector<HTMLButtonElement>(`[data-testid="grpc-tab-close-${tabId}"]`);
    if (closeBtn && !closeBtn.disabled) {
      closeBtn.click();
      await ctx.delay(120);
    }
  }

  if (demoTab && demoTab.getAttribute('aria-selected') !== 'true') {
    demoTab.click();
    await ctx.delay(100);
  }
}

/**
 * Close all non-active gRPC tabs and keep the currently active one.
 * This is safer for demo isolation sessions where the active tab is the
 * temporary demo tab and user tabs should remain untouched unless explicitly
 * cleaned by the isolation lifecycle.
 */
export async function closeExtraGrpcTabsQuiet(ctx: DemoActionContext): Promise<void> {
  await ensureGrpcStudioSubNavQuiet(ctx);
  const tabBar = document.querySelector<HTMLElement>(GRPC.TAB_BAR);
  if (!tabBar) return;
  const tabEls = Array.from(tabBar.querySelectorAll<HTMLElement>('[role="tab"]'));
  const activeTab = tabEls.find((tabEl) => tabEl.getAttribute('aria-selected') === 'true') ?? tabEls[0] ?? null;
  const activeTabId = activeTab?.getAttribute('data-testid') ?? null;

  // Close all tabs except the active tab, in reverse order so indices stay stable.
  for (const tabEl of tabEls.slice().reverse()) {
    const tabId = tabEl.getAttribute('data-testid');
    if (!tabId || tabId === activeTabId) continue;
    const closeBtn = document.querySelector<HTMLButtonElement>(`[data-testid="grpc-tab-close-${tabId}"]`);
    if (closeBtn && !closeBtn.disabled) {
      closeBtn.click();
      await ctx.delay(120);
    }
  }

  // Keep active focus on the preserved tab when possible.
  const preservedTab = activeTabId
    ? tabBar.querySelector<HTMLElement>(`[role="tab"][data-testid="${activeTabId}"]`)
    : tabBar.querySelector<HTMLElement>('[role="tab"]');
  if (preservedTab && preservedTab.getAttribute('aria-selected') !== 'true') {
    preservedTab.click();
    await ctx.delay(100);
  }
}
