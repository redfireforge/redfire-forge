/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GRPC } from '@shared/selectors';
import { makeCtx, makeVisible } from '../ws-test-utils';
import {
  spotlightAndPause,
  spotlightElementAndPause,
  spotlightGrpcRequestComposer,
  spotlightRequestJsonContentTight,
  spotlightResponseJsonContentTight,
} from './spotlight';

const removeRing = vi.hoisted(() => vi.fn());
const showSpotlightRing = vi.hoisted(() => vi.fn(() => removeRing));
const purgeAllSpotlightRings = vi.hoisted(() => vi.fn());

vi.mock('../../../demoRipple', () => ({
  showSpotlightRing,
  purgeAllSpotlightRings,
}));

const resumeDemoAutoScroll = vi.hoisted(() => vi.fn());
const scrollDemoTargetIntoView = vi.hoisted(() => vi.fn());
const clearLiveDemoPanelFromTarget = vi.hoisted(() => vi.fn());

vi.mock('../../../demoSpotlightUtils', () => ({
  resumeDemoAutoScroll,
  scrollDemoTargetIntoView,
  clearLiveDemoPanelFromTarget,
}));

describe('grpc-lesson-helpers/spotlight', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    removeRing.mockClear();
    showSpotlightRing.mockClear();
    purgeAllSpotlightRings.mockClear();
    resumeDemoAutoScroll.mockClear();
    scrollDemoTargetIntoView.mockClear();
    clearLiveDemoPanelFromTarget.mockClear();
  });

  it('spotlightAndPause uses first visible element when multiple matches exist', async () => {
    document.body.innerHTML = `
      <div data-testid="grpc-reflect-btn" style="display:none"></div>
      <button data-testid="grpc-reflect-btn"></button>
    `;
    const visible = document.querySelectorAll<HTMLElement>('[data-testid="grpc-reflect-btn"]')[1]!;
    makeVisible(visible);
    const ctx = makeCtx();

    await spotlightAndPause(ctx, GRPC.REFLECT_BTN, 500);

    expect(purgeAllSpotlightRings).toHaveBeenCalled();
    expect(resumeDemoAutoScroll).toHaveBeenCalled();
    expect(scrollDemoTargetIntoView).toHaveBeenCalledWith(visible, { block: 'center' });
    expect(showSpotlightRing).toHaveBeenCalledWith(visible, { steady: true });
    expect(removeRing).toHaveBeenCalledTimes(1);
    expect(ctx.delay).toHaveBeenCalledWith(280);
    expect(ctx.delay).toHaveBeenCalledWith(500);
  });

  it('spotlightAndPause is a no-op when selector matches nothing', async () => {
    const ctx = makeCtx();
    await spotlightAndPause(ctx, GRPC.REFLECT_BTN);
    expect(showSpotlightRing).not.toHaveBeenCalled();
    expect(removeRing).not.toHaveBeenCalled();
  });

  it('spotlightElementAndPause scrolls into view then removes the ring after delay', async () => {
    const el = document.createElement('div');
    makeVisible(el);
    const ctx = makeCtx();

    await spotlightElementAndPause(ctx, el, 250);

    expect(purgeAllSpotlightRings).toHaveBeenCalled();
    expect(resumeDemoAutoScroll).toHaveBeenCalled();
    expect(scrollDemoTargetIntoView).toHaveBeenCalledWith(el, { block: 'center' });
    expect(showSpotlightRing).toHaveBeenCalledWith(el, { steady: true });
    expect(removeRing).toHaveBeenCalledTimes(1);
    expect(ctx.delay).toHaveBeenCalledWith(280);
    expect(ctx.delay).toHaveBeenCalledWith(250);
  });

  it('spotlightElementAndPause with skipScroll clears panel instead of scrolling', async () => {
    const el = document.createElement('div');
    makeVisible(el);
    const ctx = makeCtx();

    await spotlightElementAndPause(ctx, el, 300, { skipScroll: true });

    expect(purgeAllSpotlightRings).toHaveBeenCalled();
    expect(resumeDemoAutoScroll).toHaveBeenCalled();
    expect(scrollDemoTargetIntoView).not.toHaveBeenCalled();
    expect(clearLiveDemoPanelFromTarget).toHaveBeenCalledWith(el);
    expect(showSpotlightRing).toHaveBeenCalledWith(el, { steady: true });
    expect(removeRing).toHaveBeenCalledTimes(1);
    expect(ctx.delay).toHaveBeenCalledWith(80);
    expect(ctx.delay).toHaveBeenCalledWith(300);
  });

  it('spotlightGrpcRequestComposer spotlights hybrid JSON composer with tight ring', async () => {
    document.body.innerHTML = `
      <div data-testid="grpc-request-tab-form"></div>
      <div data-testid="grpc-request-json-compact"></div>
      <textarea data-testid="grpc-request-json">{"message":"hello"}</textarea>
    `;
    document.querySelectorAll<HTMLElement>('[data-testid]').forEach((node) => makeVisible(node));
    const ctx = makeCtx();

    await spotlightGrpcRequestComposer(ctx);

    expect(ctx.delay).toHaveBeenCalledWith(750);
    expect(ctx.delay).toHaveBeenCalledWith(900);
    expect(removeRing).toHaveBeenCalled();
  });

  it('spotlightRequestJsonContentTight creates a tight proxy ring over content', async () => {
    document.body.innerHTML = `
      <textarea data-testid="grpc-request-json">{"a":1}</textarea>
    `;
    makeVisible(document.querySelector<HTMLElement>('[data-testid="grpc-request-json"]')!);
    const ctx = makeCtx();

    await spotlightRequestJsonContentTight(ctx, 600);

    expect(ctx.delay).toHaveBeenCalledWith(600);
    expect(removeRing).toHaveBeenCalledTimes(1);
    expect(document.querySelector('div[style*="position:fixed"]')).toBeNull();
  });

  it('spotlightRequestJsonContentTight falls back to regular spotlight if textarea missing', async () => {
    document.body.innerHTML = '';
    const ctx = makeCtx();

    await spotlightRequestJsonContentTight(ctx, 500);

    expect(removeRing).not.toHaveBeenCalled();
  });

  it('spotlightRequestJsonContentTight waits for non-empty request JSON before highlighting', async () => {
    document.body.innerHTML = `
      <textarea data-testid="grpc-request-json"></textarea>
    `;
    const textarea = document.querySelector<HTMLTextAreaElement>('[data-testid="grpc-request-json"]')!;
    makeVisible(textarea);
    const ctx = makeCtx();
    let delayCallCount = 0;
    vi.mocked(ctx.delay).mockImplementation(async (_ms: number) => {
      delayCallCount += 1;
      if (delayCallCount === 1) {
        textarea.value = '{"message":"ready"}';
      }
    });

    await spotlightRequestJsonContentTight(ctx, 600);

    expect(delayCallCount).toBeGreaterThanOrEqual(2);
    expect(removeRing).toHaveBeenCalledTimes(1);
    expect(document.querySelector('div[style*="position:fixed"]')).toBeNull();
  });

  it('spotlightResponseJsonContentTight creates a tight proxy ring over response JSON content', async () => {
    document.body.innerHTML = `
      <pre data-testid="grpc-response-body">{\n  "message": "hello"\n}</pre>
    `;
    makeVisible(document.querySelector<HTMLElement>('[data-testid="grpc-response-body"]')!);
    const ctx = makeCtx();

    await spotlightResponseJsonContentTight(ctx, 650);

    expect(ctx.delay).toHaveBeenCalledWith(650);
    expect(removeRing).toHaveBeenCalledTimes(1);
    expect(document.querySelector('div[style*="position:fixed"]')).toBeNull();
  });

  it('spotlightResponseJsonContentTight falls back to regular spotlight if response body is missing', async () => {
    document.body.innerHTML = '';
    const ctx = makeCtx();

    await spotlightResponseJsonContentTight(ctx, 500);

    expect(removeRing).not.toHaveBeenCalled();
  });

  it('spotlightResponseJsonContentTight waits for non-empty response JSON before highlighting', async () => {
    document.body.innerHTML = `
      <pre data-testid="grpc-response-body"></pre>
    `;
    const body = document.querySelector<HTMLElement>('[data-testid="grpc-response-body"]')!;
    makeVisible(body);
    const ctx = makeCtx();
    let delayCallCount = 0;
    vi.mocked(ctx.delay).mockImplementation(async (_ms: number) => {
      delayCallCount += 1;
      if (delayCallCount === 1) {
        body.textContent = '{"message":"ready"}';
      }
    });

    await spotlightResponseJsonContentTight(ctx, 650);

    expect(delayCallCount).toBeGreaterThanOrEqual(2);
    expect(removeRing).toHaveBeenCalledTimes(1);
    expect(document.querySelector('div[style*="position:fixed"]')).toBeNull();
  });

  it('spotlightGrpcRequestComposer spotlights classic proto form when hybrid is inactive', async () => {
    document.body.innerHTML = `
      <div data-testid="grpc-request-tab-form"></div>
      <div data-testid="grpc-proto-form"></div>
      <div data-testid="grpc-proto-guided-card-core"></div>
    `;
    document.querySelectorAll<HTMLElement>('[data-testid]').forEach((node) => makeVisible(node));
    const ctx = makeCtx();

    await spotlightGrpcRequestComposer(ctx);

    expect(ctx.delay).toHaveBeenCalledWith(750);
    expect(removeRing).toHaveBeenCalled();
  });
});
