/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  findFirstVisibleElement,
  findVisibleAppModal,
  hasDemoHubTextSelection,
  isDemoElementVisible,
  isSpotlightSuppressedForModal,
} from './demoSpotlightUtils';

function mockRect(el: Element, width: number, height: number): void {
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    top: 0,
    left: 0,
    width,
    height,
    right: width,
    bottom: height,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
}

describe('demoSpotlightUtils', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('findFirstVisibleElement returns the first visible match', () => {
    const hidden = document.createElement('div');
    hidden.className = 'pick-me';
    hidden.style.display = 'none';
    const visible = document.createElement('div');
    visible.className = 'pick-me';
    mockRect(visible, 10, 10);
    document.body.append(hidden, visible);
    expect(findFirstVisibleElement('.pick-me')).toBe(visible);
  });

  it('findVisibleAppModal detects open modal-overlay dialogs', () => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    mockRect(overlay, 100, 100);
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('data-testid', 'gql-tls-body');
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    expect(findVisibleAppModal()).toBe(dialog);
  });

  it('isSpotlightSuppressedForModal is true when modal covers a toolbar target', () => {
    const target = document.createElement('button');
    target.setAttribute('data-testid', 'gql-tls-configure');
    mockRect(target, 40, 20);
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    mockRect(overlay, 200, 200);
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    overlay.appendChild(dialog);
    document.body.append(target, overlay);
    expect(isSpotlightSuppressedForModal(target)).toBe(true);
  });

  it('isSpotlightSuppressedForModal is false when target is inside the modal', () => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    mockRect(overlay, 200, 200);
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    const target = document.createElement('textarea');
    target.setAttribute('data-testid', 'gql-tls-ca-cert');
    mockRect(target, 100, 40);
    dialog.appendChild(target);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    expect(isSpotlightSuppressedForModal(target)).toBe(false);
  });

  it('isDemoElementVisible rejects zero-size elements', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    expect(isDemoElementVisible(el)).toBe(false);
  });

  it('hasDemoHubTextSelection detects selection inside overview modal', () => {
    document.body.innerHTML = `
      <div class="demo-overview-modal">
        <span class="demo-overview-modal-item-desc">Copy me</span>
      </div>
    `;
    const desc = document.querySelector('.demo-overview-modal-item-desc')!;
    const range = document.createRange();
    range.selectNodeContents(desc);
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);
    expect(hasDemoHubTextSelection()).toBe(true);
    sel.removeAllRanges();
  });

  it('findFirstVisibleElement returns null when all matches are hidden', () => {
    const hidden = document.createElement('div');
    hidden.className = 'pick-me';
    hidden.style.display = 'none';
    document.body.appendChild(hidden);
    expect(findFirstVisibleElement('.pick-me')).toBeNull();
  });

  it('findVisibleAppModal falls back to overlay when dialog role is absent', () => {
    const overlay = document.createElement('div');
    overlay.className = 'ws-tls-overlay';
    mockRect(overlay, 100, 100);
    document.body.appendChild(overlay);
    expect(findVisibleAppModal()).toBe(overlay);
  });

  it('isSpotlightSuppressedForModal is false when target is null', () => {
    expect(isSpotlightSuppressedForModal(null)).toBe(false);
  });

  it('isDemoElementVisible rejects hidden visibility and zero opacity', () => {
    const hidden = document.createElement('div');
    mockRect(hidden, 10, 10);
    hidden.style.visibility = 'hidden';
    document.body.appendChild(hidden);
    expect(isDemoElementVisible(hidden)).toBe(false);

    const faded = document.createElement('div');
    mockRect(faded, 10, 10);
    faded.style.opacity = '0';
    document.body.appendChild(faded);
    expect(isDemoElementVisible(faded)).toBe(false);
  });

  it('hasDemoHubTextSelection is false for collapsed selection', () => {
    document.body.innerHTML = `<div class="demo-live-panel"><span id="t">x</span></div>`;
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    expect(hasDemoHubTextSelection()).toBe(false);
  });

  it('findVisibleAppModal skips hidden overlays', () => {
    const hidden = document.createElement('div');
    hidden.className = 'modal-overlay';
    hidden.style.display = 'none';
    const visible = document.createElement('div');
    visible.className = 'dm-modal-overlay';
    mockRect(visible, 80, 80);
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    visible.appendChild(dialog);
    document.body.append(hidden, visible);
    expect(findVisibleAppModal()).toBe(dialog);
  });

  it('hasDemoHubTextSelection detects selection in demo-live-panel via text node parent', () => {
    document.body.innerHTML = `
      <div class="demo-live-panel"><p id="narration">Step text</p></div>
    `;
    const p = document.querySelector('#narration')!;
    const range = document.createRange();
    range.selectNodeContents(p.firstChild!);
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);
    expect(hasDemoHubTextSelection()).toBe(true);
    sel.removeAllRanges();
  });

  it('isSpotlightSuppressedForModal is false when no modal is open', () => {
    const target = document.createElement('button');
    mockRect(target, 20, 20);
    document.body.appendChild(target);
    expect(isSpotlightSuppressedForModal(target)).toBe(false);
  });
});
