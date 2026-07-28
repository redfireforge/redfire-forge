/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from 'vitest';
import {
  injectTh19OldSnapshot,
  TH19_TEST_ID,
  waitForDriftBanner,
  isDriftBannerVisible,
} from './th-demo-helpers';
import type { DemoActionContext } from '../../types';

afterEach(() => {
  localStorage.clear();
  document.body.innerHTML = '';
});

describe('TH-19 schema drift helpers', () => {
  it('injects a snapshot keyed to the validation test with response-body sourceId', () => {
    injectTh19OldSnapshot();

    const raw = localStorage.getItem(`dm-schema-snapshot-validation:${TH19_TEST_ID}`);
    expect(raw).toBeTruthy();

    const pair = JSON.parse(raw!);
    expect(pair.source).toHaveLength(1);
    expect(pair.source[0].sourceId).toBe('response-body');
    expect(pair.source[0].fields.some((f: { path: string }) => f.path === 'userName')).toBe(true);
    expect(pair.target).toBeNull();
  });

  it('waitForDriftBanner resolves true once the banner is in the DOM', async () => {
    const ctx = { delay: (ms: number) => new Promise<void>((r) => setTimeout(r, ms)) } as DemoActionContext;
    expect(isDriftBannerVisible()).toBe(false);

    setTimeout(() => {
      const banner = document.createElement('div');
      banner.className = 'dm-drift-banner';
      document.body.appendChild(banner);
    }, 50);

    await expect(waitForDriftBanner(ctx, 500)).resolves.toBe(true);
  });

  it('waitForDriftBanner resolves false when the banner never appears', async () => {
    const ctx = { delay: (ms: number) => new Promise<void>((r) => setTimeout(r, ms)) } as DemoActionContext;
    await expect(waitForDriftBanner(ctx, 120)).resolves.toBe(false);
  });
});
