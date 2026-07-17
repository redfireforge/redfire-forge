/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { makeVisible } from '../lessons/protocols/ws-test-utils';
import { firstVisibleElement, firstVisibleSelector } from './domVisibility';

describe('domVisibility', () => {
  it('firstVisibleElement returns the first element with non-zero dimensions', () => {
    const hidden = document.createElement('button');
    hidden.setAttribute('data-testid', 'hidden-btn');
    document.body.appendChild(hidden);

    const visible = document.createElement('button');
    visible.setAttribute('data-testid', 'visible-btn');
    makeVisible(visible);
    document.body.appendChild(visible);

    expect(firstVisibleElement('[data-testid="visible-btn"]')).toBe(visible);
    hidden.remove();
    visible.remove();
  });

  it('firstVisibleElement returns null when no matching elements are visible', () => {
    const hidden = document.createElement('button');
    hidden.setAttribute('data-testid', 'only-hidden');
    document.body.appendChild(hidden);
    expect(firstVisibleElement('[data-testid="only-hidden"]')).toBeNull();
    hidden.remove();
  });

  it('firstVisibleElement skips non-HTMLElement nodes', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('data-testid', 'svg-node');
    makeVisible(svg);
    document.body.appendChild(svg);

    const btn = document.createElement('button');
    btn.setAttribute('data-testid', 'btn');
    makeVisible(btn);
    document.body.appendChild(btn);

    expect(firstVisibleElement('[data-testid="svg-node"], [data-testid="btn"]')).toBe(btn);
    svg.remove();
    btn.remove();
  });

  it('firstVisibleSelector returns selector for visible match', () => {
    const visible = document.createElement('button');
    visible.setAttribute('data-testid', 'visible-btn');
    makeVisible(visible);
    document.body.appendChild(visible);
    expect(firstVisibleSelector('[data-testid="visible-btn"]')).toBe('[data-testid="visible-btn"]');
    visible.remove();
  });

  it('firstVisibleSelector falls back to selector when matches exist but are hidden', () => {
    const hidden = document.createElement('button');
    hidden.setAttribute('data-testid', 'hidden-btn');
    document.body.appendChild(hidden);
    expect(firstVisibleSelector('[data-testid="hidden-btn"]')).toBe('[data-testid="hidden-btn"]');
    hidden.remove();
  });

  it('firstVisibleSelector returns null when nothing matches', () => {
    document.body.innerHTML = '';
    expect(firstVisibleSelector('[data-testid="missing"]')).toBeNull();
  });
});
