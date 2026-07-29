/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DS_COLUMN_TYPE_LABELS,
  tourDsColumnTypeDropdown,
} from './th-demo-helpers';
import type { DemoActionContext } from '../../types';
import { HAR } from '@shared/selectors';

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

function makeCtx(): DemoActionContext {
  return {
    navigateToTab: vi.fn(),
    click: vi.fn(),
    fill: vi.fn(),
    selectOption: vi.fn(),
    waitFor: vi.fn(),
    delay: (ms: number) => new Promise<void>((r) => setTimeout(r, Math.min(ms, 5))),
  };
}

function mountTypeSelect(open = false): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'cs-wrapper data-source-col-type-select';
  wrap.innerHTML = `
    <button type="button" class="cs-trigger" aria-label="Column type">Path</button>
    ${open ? '<div class="cs-menu" role="listbox"></div>' : ''}
  `;
  if (open) {
    const menu = wrap.querySelector('.cs-menu')!;
    for (const label of DS_COLUMN_TYPE_LABELS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cs-item';
      btn.dataset.value = label.toLowerCase();
      btn.innerHTML = `<span class="cs-item-label">${label}</span>`;
      menu.appendChild(btn);
    }
  } else {
    wrap.querySelector('.cs-trigger')!.addEventListener('click', () => {
      if (wrap.querySelector('.cs-menu')) {
        wrap.querySelector('.cs-menu')?.remove();
        return;
      }
      const menu = document.createElement('div');
      menu.className = 'cs-menu';
      menu.setAttribute('role', 'listbox');
      for (const label of DS_COLUMN_TYPE_LABELS) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'cs-item';
        btn.dataset.value = label.toLowerCase();
        btn.innerHTML = `<span class="cs-item-label">${label}</span>`;
        menu.appendChild(btn);
      }
      wrap.appendChild(menu);
    });
  }
  document.body.appendChild(wrap);
  return wrap;
}

describe('tourDsColumnTypeDropdown', () => {
  it('exposes the five column type labels in order', () => {
    expect([...DS_COLUMN_TYPE_LABELS]).toEqual([
      'Path', 'Param', 'Body', 'Header', 'Validate',
    ]);
  });

  it('opens the menu, spotlights the whole list, and closes without selecting', async () => {
    const wrap = mountTypeSelect(false);
    const trigger = wrap.querySelector<HTMLElement>('.cs-trigger')!;
    const clickSpy = vi.spyOn(trigger, 'click');

    await tourDsColumnTypeDropdown(makeCtx(), { holdMs: 5 });

    // Open + close
    expect(clickSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(wrap.querySelector('.cs-menu')).toBeNull();
    expect(document.querySelector(HAR.DS_COL_TYPE_SELECT)).toBe(wrap);
  });

  it('is a no-op when the type select is missing', async () => {
    await expect(tourDsColumnTypeDropdown(makeCtx(), { holdMs: 5 })).resolves.toBeUndefined();
  });
});
