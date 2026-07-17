/** Auth panel helpers for GraphQL Studio demo lessons. */
import type { DemoActionContext } from '../../../types';
import { GQL } from '@shared/selectors';

/** True when the bottom Auth tab is the active bottom-panel tab (Slice 7.3+). */
export function isAuthEditorOpen(): boolean {
  const authTab = document.querySelector(GQL.BOTTOM_TAB_AUTH);
  return authTab?.getAttribute('aria-selected') === 'true';
}

/** Open the bottom Auth panel when it is not already visible. */
export async function openAuthPanelQuiet(ctx: DemoActionContext): Promise<void> {
  if (isAuthEditorOpen()) return;
  await ctx.waitFor(GQL.AUTH_BADGE_BTN, 5000);
  await ctx.click(GQL.AUTH_BADGE_BTN);
  await ctx.waitFor(GQL.AUTH_PANEL, 5000);
  await ctx.delay(400);
}

/** Leave the Auth panel by switching back to Variables. */
export async function closeAuthPanelQuiet(ctx: DemoActionContext): Promise<void> {
  if (!isAuthEditorOpen()) return;
  const authTab = document.querySelector(GQL.BOTTOM_TAB_AUTH);
  if (authTab?.getAttribute('aria-selected') === 'true') {
    await ctx.click(GQL.BOTTOM_TAB_VARS);
  }
  await ctx.delay(300);
}

export type GqlAuthPanelType = 'bearer' | 'apiKey' | 'basic' | 'oauth2' | 'inherit' | 'none';

export async function waitForAuthTypeFields(
  ctx: DemoActionContext,
  type: GqlAuthPanelType,
): Promise<void> {
  switch (type) {
    case 'bearer':
      await ctx.waitFor(GQL.AUTH_BEARER_INPUT, 5000);
      break;
    case 'apiKey':
      await ctx.waitFor(GQL.AUTH_APIKEY_NAME, 5000);
      break;
    case 'basic':
      await ctx.waitFor(GQL.AUTH_BASIC_USER, 5000);
      break;
    case 'oauth2':
      await ctx.waitFor(GQL.AUTH_OAUTH_TOKEN_URL, 5000);
      break;
    case 'inherit':
      await ctx.waitFor(GQL.AUTH_PROFILE_SELECT, 5000);
      break;
    default:
      break;
  }
}

/** Open the bottom Auth panel (visible lesson actions). */
export async function openAuthPanel(ctx: DemoActionContext): Promise<void> {
  await openAuthPanelQuiet(ctx);
}

/** Switch away from the Auth bottom tab when it is active. */
export async function closeAuthPanelIfOpen(ctx: DemoActionContext): Promise<void> {
  await closeAuthPanelQuiet(ctx);
}

/** Keep the Auth bottom tab visible after execute/Metadata demo beats. */
export async function ensureAuthPanelVisible(ctx: DemoActionContext): Promise<void> {
  if (isAuthEditorOpen()) return;
  await openAuthPanelQuiet(ctx);
}

/** Open the Auth panel and select an auth type in the bottom editor. */
export async function selectAuthInPanel(
  ctx: DemoActionContext,
  type: GqlAuthPanelType,
): Promise<void> {
  await openAuthPanel(ctx);
  await ctx.waitFor(GQL.AUTH_TYPE_SELECT, 5000);
  await ctx.selectOption(GQL.AUTH_TYPE_SELECT, type);
  await ctx.delay(400);
  await waitForAuthTypeFields(ctx, type);
}

/** Explicit No Auth — stored as `null` on the tab (multi-tab) or page default (single tab). */
export async function selectNoAuthInPanel(ctx: DemoActionContext): Promise<void> {
  await selectAuthInPanel(ctx, 'none');
}

/**
 * Clear a per-tab auth override (Reset to inherit workspace) when the control is available.
 * No-op when the active tab already inherits workspace auth.
 */
export async function clearActiveTabAuthOverride(ctx: DemoActionContext): Promise<void> {
  await openAuthPanelQuiet(ctx);
  if (!document.querySelector(GQL.AUTH_RESET_INHERIT_BTN)) {
    await closeAuthPanelQuiet(ctx);
    return;
  }
  await ctx.click(GQL.AUTH_RESET_INHERIT_BTN);
  await ctx.delay(400);
  await closeAuthPanelQuiet(ctx);
}

/**
 * Demo tab should inherit page-level auth without storing a per-tab override
 * (required when the user already has tabs open — §11.0).
 */
export async function configureDemoTabInheritPageAuth(ctx: DemoActionContext): Promise<void> {
  await ctx.waitFor(GQL.AUTH_BADGE_BTN, 5000);
  await clearActiveTabAuthOverride(ctx);
}
