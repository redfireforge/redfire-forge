/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as adapters from '../../adapters';
import { makeCtx } from '../protocols/ws-test-utils';
import {
  findRequestTabIndexByLabel,
  forceDeleteCollectionsByExactName,
  renameRequestTabByLabel,
  shrinkAllCollections,
} from './req-demo-helpers';

describe('req-demo-helpers silent cleanup (no Collections flash)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('forceDeleteCollectionsByExactName uses the bridge and never expands the tree', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="req-sidebar-expand-all" aria-label="Expand all">Expand</button>
      <div data-testid="req-col-item" data-col-name="My API"></div>
    `;
    const expandBtn = document.querySelector<HTMLButtonElement>('[data-testid="req-sidebar-expand-all"]')!;
    const expandClick = vi.spyOn(expandBtn, 'click');

    const bridge = vi.fn((name: string) => {
      if (name === 'My API') {
        document.querySelector('[data-col-name="My API"]')?.remove();
        return 1;
      }
      return 0;
    });
    vi.spyOn(adapters, 'getDemoBridgeWindow').mockReturnValue({
      __demoDeleteCollectionsByName: bridge,
    } as ReturnType<typeof adapters.getDemoBridgeWindow>);
    vi.spyOn(adapters, 'deleteCollectionsByName').mockImplementation((name) => bridge(name));

    await forceDeleteCollectionsByExactName(ctx, 'My API');

    expect(bridge).toHaveBeenCalledWith('My API');
    expect(expandClick).not.toHaveBeenCalled();
    expect(document.querySelector('[data-col-name="My API"]')).toBeNull();
  });

  it('forceDeleteCollectionsByExactName is a no-op when the name is absent (no expand)', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="req-sidebar-expand-all" aria-label="Expand all">Expand</button>
      <div data-testid="req-col-item" data-col-name="Keep Me"></div>
    `;
    const expandBtn = document.querySelector<HTMLButtonElement>('[data-testid="req-sidebar-expand-all"]')!;
    const expandClick = vi.spyOn(expandBtn, 'click');
    const bridge = vi.fn(() => 0);
    vi.spyOn(adapters, 'getDemoBridgeWindow').mockReturnValue({
      __demoDeleteCollectionsByName: bridge,
    } as ReturnType<typeof adapters.getDemoBridgeWindow>);
    vi.spyOn(adapters, 'deleteCollectionsByName').mockImplementation((name) => bridge(name));

    await forceDeleteCollectionsByExactName(ctx, 'My API');

    expect(bridge).not.toHaveBeenCalled();
    expect(expandClick).not.toHaveBeenCalled();
    expect(document.querySelector('[data-col-name="Keep Me"]')).not.toBeNull();
  });

  it('shrinkAllCollections does not expand-then-shrink when already collapsed', async () => {
    document.body.innerHTML = `
      <button data-testid="req-sidebar-expand-all" aria-label="Expand all collections">Expand</button>
    `;
    const btn = document.querySelector<HTMLButtonElement>('[data-testid="req-sidebar-expand-all"]')!;
    const click = vi.spyOn(btn, 'click');

    await shrinkAllCollections();

    expect(click).not.toHaveBeenCalled();
  });

  it('shrinkAllCollections clicks once when currently expanded', async () => {
    document.body.innerHTML = `
      <button data-testid="req-sidebar-expand-all" aria-label="Shrink all collections">Shrink</button>
    `;
    const btn = document.querySelector<HTMLButtonElement>('[data-testid="req-sidebar-expand-all"]')!;
    const click = vi.spyOn(btn, 'click');

    await shrinkAllCollections();

    expect(click).toHaveBeenCalledTimes(1);
  });

  it('renameRequestTabByLabel double-clicks the matching tab, not index 0', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <div data-testid="req-tab-bar">
        <div role="tab" data-testid="req-tab-item">
          <span data-testid="req-tab-label">Sales leftover</span>
        </div>
        <div role="tab" data-testid="req-tab-item">
          <span data-testid="req-tab-label">Get Users</span>
        </div>
      </div>
    `;
    expect(findRequestTabIndexByLabel('Get Users')).toBe(1);

    const tabs = Array.from(document.querySelectorAll<HTMLElement>('[role="tab"]'));
    const leftoverDbl = vi.fn();
    const demoDbl = vi.fn();
    tabs[0].addEventListener('dblclick', leftoverDbl);
    tabs[1].addEventListener('dblclick', () => {
      demoDbl();
      const input = document.createElement('input');
      input.className = 'req-tab-bar__rename';
      tabs[1].appendChild(input);
    });

    const renamed = await renameRequestTabByLabel(ctx, 'Get Users', 'Users API');
    expect(renamed).toBe(true);
    expect(leftoverDbl).not.toHaveBeenCalled();
    expect(demoDbl).toHaveBeenCalledTimes(1);
  });

  it('renameRequestTabByLabel returns false when the label is absent (no index-0 fallback)', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <div data-testid="req-tab-bar">
        <div role="tab" data-testid="req-tab-item">
          <span data-testid="req-tab-label">Sales leftover</span>
        </div>
      </div>
    `;
    const leftover = document.querySelector<HTMLElement>('[role="tab"]')!;
    const leftoverDbl = vi.fn();
    leftover.addEventListener('dblclick', leftoverDbl);

    const renamed = await renameRequestTabByLabel(ctx, 'Get Users', 'Users API');
    expect(renamed).toBe(false);
    expect(leftoverDbl).not.toHaveBeenCalled();
    expect(findRequestTabIndexByLabel('Sales leftover')).toBe(0);
  });
});
