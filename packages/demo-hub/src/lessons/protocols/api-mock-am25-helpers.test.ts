/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { API_MOCK } from '@shared/selectors';
import { makeCtx, makeVisible } from './ws-test-utils';

const wipeApiMockWorkspace = vi.fn(async () => true);
const ensureBlankApiMockServer = vi.fn(async () => true);
const prepareApiMockStudioChrome = vi.fn();
const sendApiMockRequest = vi.fn(async () => ({ status: 200, body: '{"ok":true}' }));

vi.mock('../../adapters', () => ({
  wipeApiMockWorkspace: (...a: unknown[]) => wipeApiMockWorkspace(...(a as [])),
  ensureBlankApiMockServer: (...a: unknown[]) => ensureBlankApiMockServer(...(a as [])),
  prepareApiMockStudioChrome: (...a: unknown[]) => prepareApiMockStudioChrome(...(a as [])),
  sendApiMockRequest: (...a: unknown[]) => sendApiMockRequest(...(a as [])),
}));

import {
  AM25_PATH_SESSION,
  AM25_PATH_PROFILE,
  hasAm25HarDraft,
  hasAm25JournalRow,
  isAm25CompareModalOpen,
  prepareAm25Workspace,
  cleanupAm25,
  ensureAm25ForImport,
  ensureAm25ForEnable,
  ensureAm25ForReplay,
  ensureAm25ForCompare,
  ensureAm25ForModal,
  ensureAm25ForReport,
  runAm25Import,
  runAm25Enable,
  runAm25Replay,
  runAm25Compare,
  runAm25Modal,
  runAm25Report,
} from './api-mock-am25-helpers';

/** Create an element with a data-testid, append to body, and make it visible. */
function elWithTestid(tag: string, testid: string, extraClasses?: string): HTMLElement {
  const node = document.createElement(tag);
  node.setAttribute('data-testid', testid);
  if (extraClasses) node.className = extraClasses;
  document.body.appendChild(node);
  makeVisible(node);
  return node;
}

describe('AM-25 constants', () => {
  it('exports fixture path constants', () => {
    expect(AM25_PATH_SESSION).toBe('/session');
    expect(AM25_PATH_PROFILE).toBe('/session/me');
  });
});

describe('AM-25 probe helpers', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('hasAm25HarDraft returns false when no draft route is visible', () => {
    expect(hasAm25HarDraft()).toBe(false);
  });

  it('hasAm25HarDraft returns true when a draft route element is present', () => {
    // DRAFT_ROUTE = '[data-testid="api-mock-route-explorer"] button.am-route-item.disabled[role="treeitem"]'
    const explorer = document.createElement('div');
    explorer.setAttribute('data-testid', 'api-mock-route-explorer');
    const btn = document.createElement('button');
    btn.className = 'am-route-item disabled';
    btn.setAttribute('role', 'treeitem');
    explorer.appendChild(btn);
    document.body.appendChild(explorer);
    makeVisible(btn);
    expect(hasAm25HarDraft()).toBe(true);
  });

  it('hasAm25JournalRow returns false when journal is empty', () => {
    expect(hasAm25JournalRow()).toBe(false);
  });

  it('hasAm25JournalRow returns true when a journal row is present', () => {
    const dock = document.createElement('div');
    dock.setAttribute('data-testid', 'api-mock-dock');
    const table = document.createElement('table');
    const tbody = document.createElement('tbody');
    const tr = document.createElement('tr');
    tr.setAttribute('data-testid', 'api-mock-tx-0');
    makeVisible(tr);
    tbody.appendChild(tr);
    table.appendChild(tbody);
    dock.appendChild(table);
    document.body.appendChild(dock);
    expect(hasAm25JournalRow()).toBe(true);
  });

  it('isAm25CompareModalOpen returns false when modal is absent', () => {
    expect(isAm25CompareModalOpen()).toBe(false);
  });

  it('isAm25CompareModalOpen returns true when modal element is present', () => {
    elWithTestid('div', 'api-mock-har-compare-modal');
    expect(isAm25CompareModalOpen()).toBe(true);
  });
});

describe('AM-25 workspace lifecycle', () => {
  it('prepareAm25Workspace wipes the workspace', async () => {
    await prepareAm25Workspace();
    expect(wipeApiMockWorkspace).toHaveBeenCalled();
  });

  it('cleanupAm25 wipes the workspace', async () => {
    await cleanupAm25();
    expect(wipeApiMockWorkspace).toHaveBeenCalled();
  });
});

describe('AM-25 ensure helpers (preAction)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('ensureAm25ForImport calls ensureBlankApiMockServer and prepareApiMockStudioChrome', async () => {
    const ctx = makeCtx();
    await ensureAm25ForImport(ctx);
    expect(ensureBlankApiMockServer).toHaveBeenCalled();
    expect(prepareApiMockStudioChrome).toHaveBeenCalled();
  });

  it('ensureAm25ForEnable calls ensureBlankApiMockServer', async () => {
    const ctx = makeCtx();
    await ensureAm25ForEnable(ctx);
    expect(ensureBlankApiMockServer).toHaveBeenCalled();
  });

  it('ensureAm25ForReplay calls ensureBlankApiMockServer', async () => {
    const ctx = makeCtx();
    await ensureAm25ForReplay(ctx);
    expect(ensureBlankApiMockServer).toHaveBeenCalled();
  });

  it('ensureAm25ForCompare calls ensureBlankApiMockServer', async () => {
    const ctx = makeCtx();
    await ensureAm25ForCompare(ctx);
    expect(ensureBlankApiMockServer).toHaveBeenCalled();
  });

  it('ensureAm25ForModal calls ensureBlankApiMockServer', async () => {
    const ctx = makeCtx();
    await ensureAm25ForModal(ctx);
    expect(ensureBlankApiMockServer).toHaveBeenCalled();
  });

  it('ensureAm25ForReport calls ensureBlankApiMockServer', async () => {
    const ctx = makeCtx();
    await ensureAm25ForReport(ctx);
    expect(ensureBlankApiMockServer).toHaveBeenCalled();
  });

  it('ensureAm25ForReport closes compare modal if open before returning', async () => {
    elWithTestid('div', 'api-mock-har-compare-modal');
    elWithTestid('button', 'api-mock-har-compare-close');
    const ctx = makeCtx();
    let closed = false;
    ctx.click = vi.fn(async (sel: string) => {
      if (sel === API_MOCK.HAR_COMPARE_CLOSE) closed = true;
    });
    await ensureAm25ForReport(ctx);
    expect(closed).toBe(true);
  });
});

describe('AM-25 run helpers (action)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('runAm25Replay sends both fixture requests and opens Runtime transactions when present', async () => {
    elWithTestid('button', 'api-mock-stop'); // server already running
    elWithTestid('button', 'api-mock-view-runtime');
    elWithTestid('button', 'api-mock-dock-tab-transactions');
    const ctx = makeCtx();
    await runAm25Replay(ctx);
    expect(sendApiMockRequest).toHaveBeenCalledWith(
      expect.objectContaining({ path: AM25_PATH_SESSION, method: 'GET' }),
    );
    expect(sendApiMockRequest).toHaveBeenCalledWith(
      expect.objectContaining({ path: AM25_PATH_PROFILE, method: 'GET' }),
    );
    // When the Transactions tab is already in the DOM, AM-25 selects it directly.
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.DOCK_TAB_TRANSACTIONS);
  });

  it('runAm25Import completes without throwing when no HAR paste area is present', async () => {
    const ctx = makeCtx();
    await expect(runAm25Import(ctx)).resolves.not.toThrow();
  });

  it('runAm25Enable completes without throwing when no draft route is present', async () => {
    const ctx = makeCtx();
    await expect(runAm25Enable(ctx)).resolves.not.toThrow();
  });

  it('runAm25Compare completes without throwing when no journal row is present', async () => {
    const ctx = makeCtx();
    await expect(runAm25Compare(ctx)).resolves.not.toThrow();
  });

  it('runAm25Modal closes the modal when close button is present', async () => {
    elWithTestid('div', 'api-mock-har-compare-modal');
    elWithTestid('button', 'api-mock-har-compare-close');
    const ctx = makeCtx();
    let closeCalled = false;
    ctx.click = vi.fn(async (sel: string) => {
      if (sel === API_MOCK.HAR_COMPARE_CLOSE) closeCalled = true;
    });
    await runAm25Modal(ctx);
    expect(closeCalled).toBe(true);
  });

  it('runAm25Report completes without throwing when compare-report button is absent', async () => {
    const ctx = makeCtx();
    await expect(runAm25Report(ctx)).resolves.not.toThrow();
  });

  it('runAm25Report clicks the compare-report button when present', async () => {
    elWithTestid('button', 'api-mock-journal-compare-report');
    const ctx = makeCtx();
    let clicked = false;
    ctx.click = vi.fn(async (sel: string) => {
      if (sel === API_MOCK.JOURNAL_COMPARE_REPORT) clicked = true;
    });
    await runAm25Report(ctx);
    expect(clicked).toBe(true);
  });
});
