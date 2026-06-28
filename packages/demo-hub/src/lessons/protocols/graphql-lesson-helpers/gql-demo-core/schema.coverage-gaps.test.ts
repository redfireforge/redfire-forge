/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeCtx } from '../../ws-test-utils';
import { GQL } from '@shared/selectors';
import {
  schemaBadgeShowsEmpty,
  hasUsableSchemaBadge,
  openSchemaTabWhenCached,
  syncSchemaTabWhenCachedDuringReading,
} from './schema';

describe('gql-demo-core/schema — coverage gaps', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('schemaBadgeShowsEmpty detects empty badge state', () => {
    document.body.innerHTML = `<span data-testid="gql-schema-badge-ok">Schema (0)</span>`;
    expect(schemaBadgeShowsEmpty()).toBe(true);
  });

  it('hasUsableSchemaBadge returns true for ok badge', () => {
    document.body.innerHTML = `<span data-testid="gql-schema-badge-ok"></span>`;
    expect(hasUsableSchemaBadge()).toBe(true);
  });

  it('openSchemaTabWhenCached opens schema tab when badge ok', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <span data-testid="gql-schema-badge-ok">Schema (12)</span>
      <button data-testid="gql-right-tab-schema" aria-selected="false"></button>
      <div data-testid="gql-schema-explorer"></div>
      <div data-testid="gql-se-type-list"></div>
    `;
    expect(await openSchemaTabWhenCached(ctx)).toBe(true);
    expect(ctx.click).toHaveBeenCalledWith(GQL.RIGHT_TAB_SCHEMA);
  });

  it('syncSchemaTabWhenCachedDuringReading no-ops when aborted', async () => {
    const ctx = makeCtx();
    const ac = new AbortController();
    ac.abort();
    await syncSchemaTabWhenCachedDuringReading(ctx, ac.signal);
  });

  it('schemaBadgeShowsEmpty returns false when badge missing', () => {
    expect(schemaBadgeShowsEmpty()).toBe(false);
  });

  it('hasUsableSchemaBadge returns false for empty type count badge', () => {
    document.body.innerHTML = `<span data-testid="gql-schema-badge-ok">Schema (0)</span>`;
    expect(hasUsableSchemaBadge()).toBe(false);
  });

  it('openSchemaTabWhenCached returns false when badge missing', async () => {
    const ctx = makeCtx();
    expect(await openSchemaTabWhenCached(ctx)).toBe(false);
  });

  it('openSchemaTabWhenCached skips tab click when schema tab already selected', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <span data-testid="gql-schema-badge-ok">Schema (5)</span>
      <button data-testid="gql-right-tab-schema" aria-selected="true"></button>
      <div data-testid="gql-schema-explorer"></div>
      <div data-testid="gql-se-type-list"></div>
    `;
    expect(await openSchemaTabWhenCached(ctx)).toBe(true);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('setGqlRightTabSchema uses demo bridge when available', async () => {
    const ctx = makeCtx();
    const bridge = vi.fn();
    (window as unknown as Record<string, unknown>).__demoSetGqlRightView = bridge;
    const { setGqlRightTabSchema } = await import('./schema');
    await setGqlRightTabSchema(ctx);
    expect(bridge).toHaveBeenCalledWith('schema');
    delete (window as unknown as Record<string, unknown>).__demoSetGqlRightView;
  });

  it('syncSchemaTabWhenCachedDuringReading opens schema when cache finishes', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <span data-testid="gql-schema-badge-ok">Schema (3)</span>
      <button data-testid="gql-right-tab-schema" aria-selected="false"></button>
      <div data-testid="gql-schema-explorer"></div>
      <div data-testid="gql-se-type-list"></div>
    `;
    await syncSchemaTabWhenCachedDuringReading(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.RIGHT_TAB_SCHEMA);
  });

  it('waitForSchemaCached returns false when aborted before badge appears', async () => {
    const ctx = makeCtx();
    const ac = new AbortController();
    ac.abort();
    const { waitForSchemaCached } = await import('./schema');
    expect(await waitForSchemaCached(ctx, 1000, ac.signal)).toBe(false);
  });
});
