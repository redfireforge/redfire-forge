/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GRPC } from '@shared/selectors';
import { makeCtx, makeVisible } from './ws-test-utils';
import { spotlightTlsVaultSetBadges } from './grpc-tls-helpers';

const spotlightElementAndPause = vi.hoisted(() => vi.fn(async () => {}));
const scrollDemoTargetIntoView = vi.hoisted(() => vi.fn());
const resumeDemoAutoScroll = vi.hoisted(() => vi.fn());

vi.mock('./grpc-lesson-helpers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./grpc-lesson-helpers')>();
  return {
    ...actual,
    spotlightElementAndPause,
  };
});

vi.mock('../../demoSpotlightUtils', () => ({
  resumeDemoAutoScroll,
  scrollDemoTargetIntoView,
}));

function mountTlsModalWithSetBadges(opts?: { includeOutsideBadge?: boolean }) {
  document.body.innerHTML = `
    <div data-testid="grpc-tls-body" class="ws-tls-modal-body">
      <div class="ws-tls-field">
        <div class="ws-tls-field-header">
          <label>Server CA</label>
          <span class="ws-tls-field-set-badge">Set</span>
        </div>
        <textarea data-testid="grpc-tls-server-ca">ca</textarea>
      </div>
      <div class="ws-tls-field">
        <div class="ws-tls-field-header">
          <label>Client Certificate</label>
          <span class="ws-tls-field-set-badge">Set</span>
        </div>
        <textarea data-testid="grpc-tls-client-cert">cert</textarea>
      </div>
      <div class="ws-tls-field">
        <div class="ws-tls-field-header">
          <label>Client Key</label>
          <span class="ws-tls-field-set-badge">Set</span>
        </div>
        <textarea data-testid="grpc-tls-client-key">key</textarea>
      </div>
    </div>
    ${opts?.includeOutsideBadge ? `
      <div class="ws-tls-field" data-outside="1">
        <div class="ws-tls-field-header">
          <span class="ws-tls-field-set-badge">Set</span>
        </div>
      </div>
    ` : ''}
  `;
  document.querySelectorAll<HTMLElement>('.ws-tls-field-header, [data-testid]').forEach(makeVisible);
}

describe('spotlightTlsVaultSetBadges', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    spotlightElementAndPause.mockClear();
    scrollDemoTargetIntoView.mockClear();
    resumeDemoAutoScroll.mockClear();
  });

  it('scrolls each modal PEM field and spotlights its Set header (ignores outside badges)', async () => {
    mountTlsModalWithSetBadges({ includeOutsideBadge: true });
    const ctx = makeCtx();

    await spotlightTlsVaultSetBadges(ctx, 900);

    expect(scrollDemoTargetIntoView).toHaveBeenCalledTimes(3);
    expect(spotlightElementAndPause).toHaveBeenCalledTimes(3);

    const spotlit = spotlightElementAndPause.mock.calls.map((c) => c[1] as HTMLElement);
    for (const el of spotlit) {
      expect(el.classList.contains('ws-tls-field-header')).toBe(true);
      expect(document.querySelector(GRPC.TLS_MODAL_BODY)?.contains(el)).toBe(true);
    }
    expect(spotlit.some((el) => el.closest('[data-outside="1"]'))).toBe(false);
  });

  it('is a no-op when the TLS modal is closed', async () => {
    document.body.innerHTML = `<span class="ws-tls-field-set-badge">Set</span>`;
    const ctx = makeCtx();

    await spotlightTlsVaultSetBadges(ctx);

    expect(spotlightElementAndPause).not.toHaveBeenCalled();
    expect(scrollDemoTargetIntoView).not.toHaveBeenCalled();
  });
});
