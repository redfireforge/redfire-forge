/**
 * @vitest-environment jsdom
 * Branch-coverage tests for lesson9-export-share helpers.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeCtx } from '../ws-test-utils';
import {
  resetGqlLesson9SessionFlags,
  prepareGql9CurlReading,
  copyHistoryAsCurl,
} from './lesson9-export-share';

vi.mock('./gql-demo-tab', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./gql-demo-tab')>();
  return {
    ...actual,
    ensureGqlDemoTab: vi.fn(async () => 'demo-tab-gql9'),
    closeGqlDemoTabs: vi.fn(async () => {}),
    activateGqlDemoTabQuiet: vi.fn(async () => {}),
  };
});

vi.mock('./core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./core')>();
  return {
    ...actual,
    ensureIntrospected: vi.fn(async () => {}),
    ensureEditorMode: vi.fn(async () => {}),
    executeGqlQuery: vi.fn(async () => {}),
    openHistoryPanel: vi.fn(async () => {}),
  };
});

function stubHistoryMenu(open: boolean): void {
  document.body.innerHTML = open
    ? '<div data-testid="gql-history-entry">Run 1</div><div data-testid="gql-history-context-menu"><button data-testid="gql-history-ctx-copy-curl">Copy as cURL</button></div>'
    : '<div data-testid="gql-history-entry">Run 1</div>';
}

describe('lesson9-export-share helpers', () => {
  beforeEach(() => {
    resetGqlLesson9SessionFlags();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    resetAllMocks();
  });

  it('prepareGql9CurlReading dismisses an open context menu during reading', async () => {
    stubHistoryMenu(true);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') document.querySelector('[data-testid="gql-history-context-menu"]')?.remove();
    });
    const ctx = makeCtx();
    await expect(prepareGql9CurlReading(ctx)).resolves.toBeUndefined();
    expect(document.querySelector('[data-testid="gql-history-context-menu"]')).toBeNull();
  });

  it('copyHistoryAsCurl completes when context menu is already open', async () => {
    stubHistoryMenu(true);
    const ctx = makeCtx();
    await expect(copyHistoryAsCurl(ctx)).resolves.toBeUndefined();
    await expect(copyHistoryAsCurl(ctx)).resolves.toBeUndefined();
  });
});
