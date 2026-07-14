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
} from './spotlight';

const removeRing = vi.hoisted(() => vi.fn());

vi.mock('../../../demoRipple', () => ({
  showSpotlightRing: () => removeRing,
}));

describe('grpc-lesson-helpers/spotlight', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    removeRing.mockClear();
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

    expect(removeRing).toHaveBeenCalledTimes(1);
    expect(ctx.delay).toHaveBeenCalledWith(500);
  });

  it('spotlightAndPause is a no-op when selector matches nothing', async () => {
    const ctx = makeCtx();
    await spotlightAndPause(ctx, GRPC.REFLECT_BTN);
    expect(removeRing).not.toHaveBeenCalled();
  });

  it('spotlightElementAndPause always removes the ring after delay', async () => {
    const el = document.createElement('div');
    makeVisible(el);
    const ctx = makeCtx();

    await spotlightElementAndPause(ctx, el, 250);

    expect(removeRing).toHaveBeenCalledTimes(1);
    expect(ctx.delay).toHaveBeenCalledWith(250);
  });

  it('spotlightGrpcRequestComposer spotlights hybrid JSON composer fields', async () => {
    document.body.innerHTML = `
      <div data-testid="grpc-request-tab-form"></div>
      <div data-testid="grpc-request-json-compact"></div>
      <textarea data-testid="grpc-request-json"></textarea>
    `;
    document.querySelectorAll<HTMLElement>('[data-testid]').forEach((node) => makeVisible(node));
    const ctx = makeCtx();

    await spotlightGrpcRequestComposer(ctx);

    expect(ctx.delay).toHaveBeenCalledWith(750);
    expect(ctx.delay).toHaveBeenCalledWith(800);
    expect(ctx.delay).toHaveBeenCalledWith(900);
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
