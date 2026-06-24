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

vi.mock('./gql-demo-tab', () => ({
  ensureGqlDemoTab: vi.fn(async () => 'demo-tab-gql9'),
  closeGqlDemoTabs: vi.fn(async () => {}),
}));

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
    ? '<div data-testid="gql-history-context-menu"><button>Copy as cURL</button></div>'
    : '<div data-testid="gql-history-entry">Run 1</div>';
}

describe('lesson9-export-share helpers', () => {
  beforeEach(() => {
    resetGqlLesson9SessionFlags();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('prepareGql9CurlReading returns early when context menu is already open', async () => {
    stubHistoryMenu(true);
    const ctx = makeCtx();
    await expect(prepareGql9CurlReading(ctx)).resolves.toBeUndefined();
  });

  it('copyHistoryAsCurl completes when context menu is already open', async () => {
    stubHistoryMenu(true);
    const ctx = makeCtx();
    await expect(copyHistoryAsCurl(ctx)).resolves.toBeUndefined();
    await expect(copyHistoryAsCurl(ctx)).resolves.toBeUndefined();
  });
});
