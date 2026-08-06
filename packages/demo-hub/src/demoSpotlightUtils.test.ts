/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  findFirstVisibleElement,
  findScrollableParent,
  findVisibleAppModal,
  hasDemoHubTextSelection,
  installDemoUserScrollListeners,
  isDemoAutoScrollPaused,
  isDemoElementVisible,
  isDemoTargetVisible,
  isSpotlightSuppressedForModal,
  pauseDemoAutoScroll,
  resumeDemoAutoScroll,
  scrollDemoTargetIntoView,
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

  it('findFirstVisibleElement returns null for invalid selector syntax', () => {
    expect(findFirstVisibleElement(']invalid-selector[')).toBeNull();
  });

  it('findFirstVisibleElement skips elements inside hidden ancestors', () => {
    const wrapper = document.createElement('div');
    wrapper.hidden = true;
    const target = document.createElement('div');
    target.className = 'hidden-parent-target';
    mockRect(target, 10, 10);
    wrapper.append(target);
    document.body.append(wrapper);
    expect(findFirstVisibleElement('.hidden-parent-target')).toBeNull();
    expect(isDemoTargetVisible('.hidden-parent-target')).toBe(false);
  });

  it('isDemoTargetVisible returns true for visible matches', () => {
    const target = document.createElement('div');
    target.className = 'visible-target';
    mockRect(target, 12, 12);
    document.body.append(target);
    expect(isDemoTargetVisible('.visible-target')).toBe(true);
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

  it('findVisibleAppModal returns the topmost stacked modal (nested Data Mapper)', () => {
    const editOverlay = document.createElement('div');
    editOverlay.className = 'modal-overlay rf-builder-overlay';
    mockRect(editOverlay, 400, 400);
    const editDialog = document.createElement('div');
    editDialog.setAttribute('role', 'dialog');
    editDialog.setAttribute('aria-modal', 'true');
    const validationRules = document.createElement('div');
    validationRules.className = 'validation-fields-summary';
    mockRect(validationRules, 200, 80);
    editDialog.appendChild(validationRules);

    const dmOverlay = document.createElement('div');
    dmOverlay.className = 'dm-modal-overlay';
    mockRect(dmOverlay, 300, 300);
    const dmDialog = document.createElement('div');
    dmDialog.setAttribute('role', 'dialog');
    dmDialog.setAttribute('aria-modal', 'true');
    dmOverlay.appendChild(dmDialog);
    editDialog.appendChild(dmOverlay);
    editOverlay.appendChild(editDialog);
    document.body.appendChild(editOverlay);

    expect(findVisibleAppModal()).toBe(dmDialog);
    expect(isSpotlightSuppressedForModal(validationRules)).toBe(true);
  });

  it('findVisibleAppModal prefers Expression Editor overlay when stacked on body', () => {
    const dmOverlay = document.createElement('div');
    dmOverlay.className = 'dm-modal-overlay';
    mockRect(dmOverlay, 300, 300);
    const dmDialog = document.createElement('div');
    dmDialog.setAttribute('role', 'dialog');
    dmDialog.setAttribute('aria-modal', 'true');
    dmOverlay.appendChild(dmDialog);

    const exprOverlay = document.createElement('div');
    exprOverlay.className = 'dm-expr-overlay';
    mockRect(exprOverlay, 280, 280);
    const exprDialog = document.createElement('div');
    exprDialog.setAttribute('role', 'dialog');
    exprDialog.setAttribute('aria-modal', 'true');
    exprOverlay.appendChild(exprDialog);

    document.body.append(dmOverlay, exprOverlay);
    expect(findVisibleAppModal()).toBe(exprDialog);
    expect(isSpotlightSuppressedForModal(dmDialog)).toBe(true);
    expect(isSpotlightSuppressedForModal(exprDialog)).toBe(false);
  });

  it('findVisibleAppModal prefers Schema Diff overlay when stacked on body', () => {
    const dmOverlay = document.createElement('div');
    dmOverlay.className = 'dm-modal-overlay';
    mockRect(dmOverlay, 300, 300);
    const dmDialog = document.createElement('div');
    dmDialog.setAttribute('role', 'dialog');
    dmDialog.setAttribute('aria-modal', 'true');
    dmOverlay.appendChild(dmDialog);

    const diffOverlay = document.createElement('div');
    diffOverlay.className = 'dm-diff-overlay';
    diffOverlay.setAttribute('role', 'dialog');
    diffOverlay.setAttribute('aria-modal', 'true');
    mockRect(diffOverlay, 280, 280);

    document.body.append(dmOverlay, diffOverlay);
    expect(findVisibleAppModal()).toBe(diffOverlay);
    expect(isSpotlightSuppressedForModal(dmDialog)).toBe(true);
    expect(isSpotlightSuppressedForModal(diffOverlay)).toBe(false);
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

  it('isSpotlightSuppressedForModal is true when Validation Rules panel covers a toolbar target', () => {
    const toolbarBtn = document.createElement('button');
    toolbarBtn.setAttribute('data-testid', 'dm-view-rules');
    mockRect(toolbarBtn, 40, 20);
    const dmOverlay = document.createElement('div');
    dmOverlay.className = 'dm-modal-overlay';
    mockRect(dmOverlay, 400, 400);
    const dmDialog = document.createElement('div');
    dmDialog.setAttribute('role', 'dialog');
    dmDialog.setAttribute('aria-modal', 'true');
    dmDialog.appendChild(toolbarBtn);
    const vrPanel = document.createElement('div');
    vrPanel.className = 'vr-modal-panel';
    mockRect(vrPanel, 300, 300);
    dmDialog.append(toolbarBtn, vrPanel);
    dmOverlay.appendChild(dmDialog);
    document.body.appendChild(dmOverlay);
    expect(isSpotlightSuppressedForModal(toolbarBtn)).toBe(true);
  });

  it('isSpotlightSuppressedForModal is false when target is inside Validation Rules panel', () => {
    const dmOverlay = document.createElement('div');
    dmOverlay.className = 'dm-modal-overlay';
    mockRect(dmOverlay, 400, 400);
    const dmDialog = document.createElement('div');
    dmDialog.setAttribute('role', 'dialog');
    dmDialog.setAttribute('aria-modal', 'true');
    const vrPanel = document.createElement('div');
    vrPanel.className = 'vr-modal-panel';
    mockRect(vrPanel, 300, 300);
    const verifyBtn = document.createElement('button');
    verifyBtn.className = 'vr-modal-action-btn--verify';
    mockRect(verifyBtn, 60, 24);
    vrPanel.appendChild(verifyBtn);
    dmDialog.appendChild(vrPanel);
    dmOverlay.appendChild(dmDialog);
    document.body.appendChild(dmOverlay);
    expect(isSpotlightSuppressedForModal(verifyBtn)).toBe(false);
  });

  it('isSpotlightSuppressedForModal is false when no modal is open', () => {
    const target = document.createElement('button');
    mockRect(target, 20, 20);
    document.body.appendChild(target);
    expect(isSpotlightSuppressedForModal(target)).toBe(false);
  });

  it('findScrollableParent returns nearest overflow container', () => {
    const scroll = document.createElement('div');
    scroll.style.overflowY = 'auto';
    Object.defineProperty(scroll, 'scrollHeight', { value: 400, configurable: true });
    Object.defineProperty(scroll, 'clientHeight', { value: 100, configurable: true });
    const child = document.createElement('span');
    scroll.appendChild(child);
    document.body.appendChild(scroll);
    expect(findScrollableParent(child)).toBe(scroll);
  });

  it('scrollDemoTargetIntoView scrolls nested metadata container', () => {
    const scroll = document.createElement('div');
    scroll.style.overflowY = 'auto';
    Object.defineProperty(scroll, 'scrollHeight', { value: 800, configurable: true });
    Object.defineProperty(scroll, 'clientHeight', { value: 200, configurable: true });
    scroll.getBoundingClientRect = () => ({
      top: 100, left: 0, width: 400, height: 200,
      right: 400, bottom: 300, x: 0, y: 100, toJSON: () => ({}),
    });
    scroll.scrollTo = vi.fn();

    const row = document.createElement('td');
    row.getBoundingClientRect = () => ({
      top: 320, left: 20, width: 300, height: 24,
      right: 320, bottom: 344, x: 20, y: 320, toJSON: () => ({}),
    });
    scroll.appendChild(row);
    document.body.appendChild(scroll);

    scrollDemoTargetIntoView(row, { block: 'center' });
    expect(scroll.scrollTo).toHaveBeenCalled();
  });

  it('pauseDemoAutoScroll blocks scrollDemoTargetIntoView', () => {
    const scroll = document.createElement('div');
    scroll.className = 'gql-rv-metadata';
    scroll.style.overflowY = 'auto';
    Object.defineProperty(scroll, 'scrollHeight', { value: 800, configurable: true });
    Object.defineProperty(scroll, 'clientHeight', { value: 200, configurable: true });
    scroll.getBoundingClientRect = () => ({
      top: 100, left: 0, width: 400, height: 200,
      right: 400, bottom: 300, x: 0, y: 100, toJSON: () => ({}),
    });
    scroll.scrollTo = vi.fn();

    const row = document.createElement('td');
    row.getBoundingClientRect = () => ({
      top: 320, left: 20, width: 300, height: 24,
      right: 320, bottom: 344, x: 20, y: 320, toJSON: () => ({}),
    });
    scroll.appendChild(row);
    document.body.appendChild(scroll);

    pauseDemoAutoScroll(5000);
    expect(isDemoAutoScrollPaused()).toBe(true);
    scrollDemoTargetIntoView(row, { block: 'center' });
    expect(scroll.scrollTo).not.toHaveBeenCalled();

    resumeDemoAutoScroll();
    expect(isDemoAutoScrollPaused()).toBe(false);
    scrollDemoTargetIntoView(row, { block: 'center' });
    expect(scroll.scrollTo).toHaveBeenCalled();
  });

  it('installDemoUserScrollListeners pauses auto-scroll on auth panel wheel', () => {
    vi.useFakeTimers();
    const cleanup = installDemoUserScrollListeners();
    const scroll = document.createElement('div');
    scroll.className = 'gql-auth-panel-scroll';
    document.body.appendChild(scroll);

    scroll.dispatchEvent(new WheelEvent('wheel', { bubbles: true }));
    expect(isDemoAutoScrollPaused()).toBe(true);

    cleanup();
    vi.useRealTimers();
  });
});
