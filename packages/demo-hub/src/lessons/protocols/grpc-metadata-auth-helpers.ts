/** GRPC-4 Metadata & Auth — lesson helpers */
import { GRPC } from '@shared/selectors';
import type { GrpcDemoLesson } from './grpc-lesson-contract';
import {
  closeGrpcSettingsDrawerQuiet,
  ensureEchoMethodSelected,
  ensureGrpcStudioSubNavQuiet,
  spotlightElementAndPause,
} from './grpc-lesson-helpers';
import { navigateToGrpcStudio } from '../env-manager-lesson-helpers';

export type LessonCtx = Parameters<NonNullable<GrpcDemoLesson['steps'][number]['action']>>[0];
export type PreCtx = Parameters<NonNullable<GrpcDemoLesson['steps'][number]['preAction']>>[0];

export const GRPC4_ROSTER_ID = 'grpc-metadata-auth' as const;

export const DEMO_REQUEST_ID = 'lesson-4-demo';
export const DEMO_BEARER_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.demo';
export const DEMO_BASIC_USERNAME = 'demo';
export const DEMO_BASIC_PASSWORD = 'secret';
export const DEMO_API_KEY_NAME = 'x-api-key';
export const DEMO_API_KEY_VALUE = 'my-key-123';
export const DEMO_OAUTH2_TOKEN_URL = 'http://127.0.0.1:50560/oauth2/token';
export const DEMO_OAUTH2_CLIENT_ID = 'client-id-demo';
export const DEMO_OAUTH2_CLIENT_SECRET = 'client-secret-demo';
export const DEMO_ENV_METADATA_KEY = 'x-env-token';
export const DEMO_ENV_METADATA_VALUE = '{{authToken}}';
export const DEMO_ENV_AUTH_TOKEN = 'rf-demo-auth-token-lesson4';

// spotlightAndPause / spotlightElementAndPause moved to grpc-lesson-helpers.ts (GRPC-19)
// for reuse across lessons — re-imported above.

/** Open gRPC session settings quietly if not already open. */
export async function openSettingsDrawerQuiet(ctx: LessonCtx | PreCtx): Promise<void> {
  if (document.querySelector(GRPC.SETTINGS_DRAWER)) return;
  const btn = document.querySelector<HTMLButtonElement>(GRPC.CONNECTION_SETTINGS_BTN);
  if (btn && !btn.disabled) {
    btn.click();
    try {
      await ctx.waitFor(GRPC.SETTINGS_DRAWER, 5_000);
    } catch {
      // Best-effort.
    }
  }
}

/**
 * Open the Auth tab in the call panel by clicking the Auth badge in the connection bar.
 * The Auth badge is always visible in the connection bar and clicking it closes any open
 * gRPC session settings panel and activates the Auth tab in the call panel.
 */
export async function openAuthTabQuiet(ctx: LessonCtx | PreCtx): Promise<void> {
  await closeGrpcSettingsDrawerQuiet(ctx);
  const authTabBtn = document.querySelector<HTMLButtonElement>(GRPC.REQUEST_TAB_AUTH);
  if (authTabBtn && !authTabBtn.disabled) {
    const authTabActive = authTabBtn.getAttribute('aria-pressed') === 'true';
    if (!authTabActive) {
      authTabBtn.click();
      await ctx.delay(150);
    }
  }
}

/** Select auth type using the AUTH_TYPE_SELECT dropdown. Caller must ensure auth tab is active. */
export async function selectAuthType(
  ctx: LessonCtx | PreCtx,
  type: 'none' | 'bearer' | 'basic' | 'api_key' | 'oauth2',
): Promise<void> {
  const authSelect = document.querySelector<HTMLSelectElement>(GRPC.AUTH_TYPE_SELECT);
  if (authSelect && authSelect.value !== type) {
    await ctx.selectOption(GRPC.AUTH_TYPE_SELECT, type);
  }
}

export function authBadgeLooksLikeType(type: 'none' | 'bearer' | 'basic' | 'api_key' | 'oauth2'): boolean {
  const badgeText = (document.querySelector<HTMLElement>(GRPC.AUTH_BADGE)?.textContent ?? '').toLowerCase();
  if (!badgeText) return false;
  if (type === 'api_key') {
    return badgeText.includes('api key') || badgeText.includes('apikey');
  }
  if (type === 'oauth2') {
    return badgeText.includes('oauth2') || badgeText.includes('oauth 2');
  }
  return badgeText.includes(type);
}

export type AuthFieldExpectation = {
  testId: string;
  value: string;
};

export function isAuthStepAlreadyConfigured(
  type: 'none' | 'bearer' | 'basic' | 'api_key' | 'oauth2',
  fields: AuthFieldExpectation[],
): boolean {
  const authSelect = document.querySelector<HTMLSelectElement>(GRPC.AUTH_TYPE_SELECT);
  if (authSelect) {
    if (authSelect.value !== type) return false;
    for (const field of fields) {
      const input = document.querySelector<HTMLInputElement>(`[data-testid="${field.testId}"]`);
      if (!input) return false;
      if ((input.value ?? '').trim() !== field.value.trim()) return false;
    }
    return true;
  }

  // When the auth panel is not open, fall back to badge type text so replayed
  // steps do not forcibly pull viewers back into Auth if already configured.
  return authBadgeLooksLikeType(type);
}

/** Reset auth back to 'none' for preAction guards that need a clean slate. */
export async function resetAuthToNoneQuiet(ctx: PreCtx): Promise<void> {
  const authBadgeText = document.querySelector<HTMLElement>(GRPC.AUTH_BADGE)?.textContent ?? '';
  if (/\bnone\b/i.test(authBadgeText)) {
    return;
  }

  await openAuthTabQuiet(ctx);
  const authSelect = document.querySelector<HTMLSelectElement>(GRPC.AUTH_TYPE_SELECT);
  if (authSelect && authSelect.value !== 'none') {
    await ctx.selectOption(GRPC.AUTH_TYPE_SELECT, 'none');
    await ctx.delay(200);
  }
}

/**
 * Add a key-value row to the metadata editor.
 * Clicks METADATA_ADD_BTN, then fills the last empty key/value inputs in the editor.
 */
export async function addMetadataRowQuiet(ctx: LessonCtx | PreCtx, key: string, value: string): Promise<void> {
  const editor = document.querySelector<HTMLElement>(GRPC.METADATA_EDITOR);
  if (!editor) return;
  const targetKey = key.trim().toLowerCase();
  const targetValue = value.trim();

  const setInputValue = (input: HTMLInputElement, next: string) => {
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )?.set;
    if (valueSetter) {
      valueSetter.call(input, next);
    } else {
      input.value = next;
    }
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const readRow = (row: HTMLElement) => {
    const rowKey = row.querySelector<HTMLInputElement>('input.ws-connect-kv-key');
    const rowValue = row.querySelector<HTMLInputElement>('input.ws-connect-kv-value');
    return {
      keyInput: rowKey,
      valueInput: rowValue,
      keyText: rowKey?.value.trim().toLowerCase() ?? '',
      valueText: rowValue?.value.trim() ?? '',
    };
  };

  const getRows = () => Array.from(editor.querySelectorAll<HTMLElement>('.ws-connect-kv-row'));

  const removeRow = async (row: HTMLElement) => {
    const removeBtn = row.querySelector<HTMLButtonElement>('button.ws-connect-kv-remove-btn');
    if (removeBtn && !removeBtn.disabled) {
      removeBtn.click();
      await ctx.delay(100);
    }
  };

  const findEmptyRow = () => {
    const rows = getRows();
    return rows.find((row) => {
      const { keyText, valueText } = readRow(row);
      return keyText === '' && valueText === '';
    });
  };

  const matchingKeyRows = getRows().filter((row) => readRow(row).keyText === targetKey);
  if (matchingKeyRows.length > 0) {
    const primary = matchingKeyRows[0]!;
    const { keyInput, valueInput, valueText } = readRow(primary);
    if (keyInput && keyInput.value.trim().toLowerCase() !== targetKey) {
      keyInput.focus();
      setInputValue(keyInput, key);
      await ctx.delay(120);
    }
    if (valueInput && valueText !== targetValue) {
      valueInput.focus();
      setInputValue(valueInput, value);
      await ctx.delay(120);
    }

    for (const extraRow of matchingKeyRows.slice(1)) {
      await removeRow(extraRow);
    }
  }

  let targetRow = findEmptyRow();

  if (!targetRow && matchingKeyRows.length === 0) {
    const addBtn = document.querySelector<HTMLButtonElement>(GRPC.METADATA_ADD_BTN);
    if (addBtn && !addBtn.disabled) {
      addBtn.click();
      await ctx.delay(300);
    }
    targetRow = findEmptyRow();
  }

  // Fallback: use the last row when we cannot identify an empty row.
  if (!targetRow && matchingKeyRows.length === 0) {
    const rows = getRows();
    targetRow = rows.at(-1);
  }
  if (!targetRow && matchingKeyRows.length === 0) return;

  const keyInput = targetRow?.querySelector<HTMLInputElement>('input.ws-connect-kv-key');
  const valInput = targetRow?.querySelector<HTMLInputElement>('input.ws-connect-kv-value');

  if (keyInput && matchingKeyRows.length === 0) {
    keyInput.focus();
    setInputValue(keyInput, key);
    await ctx.delay(150);
  }

  if (valInput && matchingKeyRows.length === 0) {
    valInput.focus();
    setInputValue(valInput, value);
    await ctx.delay(150);
  }

  // Remove any leftover fully-empty rows so the demo ends with a clean metadata list.
  const rows = getRows();
  for (const row of rows) {
    const { keyText, valueText } = readRow(row);
    const isEmpty = keyText === '' && valueText === '';
    if (!isEmpty) continue;
    await removeRow(row);
  }
}

/**
 * Fill a labelled field in the auth panel by its exact data-testid.
 * Uses React-compatible input event dispatch so state updates correctly.
 */
export async function tryFillAuthField(_ctx: LessonCtx | PreCtx, testId: string, value: string): Promise<void> {
  const selector = `[data-testid="${testId}"]`;
  const input = document.querySelector<HTMLInputElement>(selector);
  if (!input || input.disabled) {
    return;
  }

  const setInputValue = (input: HTMLInputElement, next: string) => {
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (valueSetter) {
      valueSetter.call(input, next);
    } else {
      input.value = next;
    }
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };

  input.focus();
  setInputValue(input, value);
}

/** Lightweight echo readiness guard for step preAction timing. */
export async function ensureEchoReadyFast(ctx: PreCtx): Promise<void> {
  await navigateToGrpcStudio(ctx);
  await closeGrpcSettingsDrawerQuiet(ctx);
  await ensureGrpcStudioSubNavQuiet(ctx);

  const hasComposer = Boolean(document.querySelector(GRPC.REQUEST_TAB_METADATA));
  const hasMessageInput = Boolean(document.querySelector(GRPC.PROTO_FIELD_INPUT_MESSAGE));
  const hasMethodDetail = Boolean(document.querySelector(GRPC.CALL_METHOD_NAME));
  // Method detail is stable across composer tabs; message input only exists in Form tab.
  // Treat either as ready to avoid replaying full reflect/select during Auth/Metadata steps.
  if (hasComposer && (hasMessageInput || hasMethodDetail)) {
    return;
  }
  await ensureEchoMethodSelected(ctx);
}

/** Fast guard for auth-only steps: do not trigger reflection/method setup in preAction. */
export async function ensureAuthReadyFast(ctx: PreCtx): Promise<void> {
  await navigateToGrpcStudio(ctx);
  await closeGrpcSettingsDrawerQuiet(ctx);
  await ensureGrpcStudioSubNavQuiet(ctx);

  // Compatibility fallback for sparse/mocked runtimes: if the connection bar is
  // not mounted yet, reuse echo-method readiness to bootstrap the composer.
  // Restrict this to test runtimes so live browser playback doesn't take the slow path.
  const isJsdomRuntime =
    typeof navigator !== 'undefined'
    && typeof navigator.userAgent === 'string'
    && /jsdom/i.test(navigator.userAgent);
  if (isJsdomRuntime && !document.querySelector(GRPC.AUTH_BADGE)) {
    await ensureEchoMethodSelected(ctx);
  }
}

export async function waitForIfMissing(ctx: LessonCtx | PreCtx, selector: string, timeoutMs: number): Promise<void> {
  if (document.querySelector(selector)) return;
  await ctx.waitFor(selector, timeoutMs);
}

export async function spotlightAuthField(ctx: LessonCtx | PreCtx, testId: string, holdMs = 550): Promise<void> {
  const el = document.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  if (!el) return;
  await spotlightElementAndPause(ctx, el, holdMs);
}

export async function spotlightMetadataRowKeyValue(
  ctx: LessonCtx | PreCtx,
  metadataKey: string,
  holdMs = 700,
): Promise<void> {
  const editor = document.querySelector<HTMLElement>(GRPC.METADATA_EDITOR);
  if (!editor) return;

  const targetKey = metadataKey.trim().toLowerCase();
  const rows = Array.from(editor.querySelectorAll<HTMLElement>('.ws-connect-kv-row'));
  const row = rows.find((candidate) => {
    const keyInput = candidate.querySelector<HTMLInputElement>('input.ws-connect-kv-key');
    return (keyInput?.value.trim().toLowerCase() ?? '') === targetKey;
  });
  if (!row) return;

  const keyInput = row.querySelector<HTMLElement>('input.ws-connect-kv-key');
  const valueInput = row.querySelector<HTMLElement>('input.ws-connect-kv-value');
  if (keyInput) {
    await spotlightElementAndPause(ctx, keyInput, holdMs);
  }
  if (valueInput) {
    await spotlightElementAndPause(ctx, valueInput, holdMs);
  }
}

export async function removeMetadataRowsByKey(ctx: LessonCtx | PreCtx, metadataKey: string): Promise<void> {
  const editor = document.querySelector<HTMLElement>(GRPC.METADATA_EDITOR);
  if (!editor) return;

  const targetKey = metadataKey.trim().toLowerCase();
  const rows = Array.from(editor.querySelectorAll<HTMLElement>('.ws-connect-kv-row'));
  for (const row of rows) {
    const keyInput = row.querySelector<HTMLInputElement>('input.ws-connect-kv-key');
    const rowKey = keyInput?.value.trim().toLowerCase() ?? '';
    if (rowKey !== targetKey) continue;

    const removeBtn = row.querySelector<HTMLButtonElement>('button.ws-connect-kv-remove-btn');
    if (!removeBtn || removeBtn.disabled) continue;
    removeBtn.click();
    await ctx.delay(120);
  }
}

export async function clearAllMetadataRowsQuiet(ctx: LessonCtx | PreCtx): Promise<void> {
  const metadataTab = document.querySelector<HTMLButtonElement>(GRPC.REQUEST_TAB_METADATA);
  if (metadataTab && !metadataTab.disabled) {
    metadataTab.click();
    await ctx.delay(140);
  }

  const editor = document.querySelector<HTMLElement>(GRPC.METADATA_EDITOR);
  if (!editor) return;

  const removeButtons = Array.from(editor.querySelectorAll<HTMLButtonElement>('button.ws-connect-kv-remove-btn'));
  for (const btn of removeButtons) {
    if (btn.disabled) continue;
    btn.click();
    await ctx.delay(100);
  }
}

export async function switchToFormTabQuiet(ctx: LessonCtx | PreCtx): Promise<void> {
  const formTabBtn = document.querySelector<HTMLButtonElement>(GRPC.REQUEST_TAB_FORM);
  if (!formTabBtn || formTabBtn.disabled) return;
  formTabBtn.click();
  await ctx.delay(140);
}
