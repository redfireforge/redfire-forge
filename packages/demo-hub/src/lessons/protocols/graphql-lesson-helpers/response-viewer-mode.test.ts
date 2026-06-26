/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GQL } from '@shared/selectors';
import { GQL_RV_DATA_ONLY_STORAGE_KEY } from '@graphql/hooks/useGraphqlResponseDataOnly';
import { ensureResponseDataOnlyMode } from './response-viewer-mode';

function makeCtx() {
  return {
    click: vi.fn(async () => {}),
    delay: vi.fn(async () => {}),
    waitFor: vi.fn(async () => {}),
    fill: vi.fn(async () => {}),
    selectOption: vi.fn(async () => {}),
  };
}

describe('ensureResponseDataOnlyMode', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '';
  });

  it('clicks toggle when checked state differs from enabled', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `<input type="checkbox" data-testid="gql-rv-data-only-toggle" />`;
    await ensureResponseDataOnlyMode(ctx as never, true);
    expect(ctx.click).toHaveBeenCalledWith(GQL.RV_DATA_ONLY_TOGGLE);
    expect(localStorage.getItem(GQL_RV_DATA_ONLY_STORAGE_KEY)).toBe('true');
  });

  it('skips click when toggle already matches enabled', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `<input type="checkbox" data-testid="gql-rv-data-only-toggle" checked />`;
    await ensureResponseDataOnlyMode(ctx as never, true);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('persists false when disabling data only', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `<input type="checkbox" data-testid="gql-rv-data-only-toggle" checked />`;
    await ensureResponseDataOnlyMode(ctx as never, false);
    expect(ctx.click).toHaveBeenCalledWith(GQL.RV_DATA_ONLY_TOGGLE);
    expect(localStorage.getItem(GQL_RV_DATA_ONLY_STORAGE_KEY)).toBe('false');
  });

  it('persists preference when toggle is absent', async () => {
    const ctx = makeCtx();
    await ensureResponseDataOnlyMode(ctx as never, true);
    expect(ctx.click).not.toHaveBeenCalled();
    expect(localStorage.getItem(GQL_RV_DATA_ONLY_STORAGE_KEY)).toBe('true');
  });
});
