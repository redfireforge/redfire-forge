/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeCtx } from '../protocols/ws-test-utils';

vi.mock('../../demoRipple', () => ({ showSpotlightRing: () => () => {} }));
vi.mock('../../adapters', () => ({
  seedSwagger2CatalogEntry: vi.fn().mockResolvedValue('e1'),
  seedCatalogEntry: vi.fn().mockResolvedValue('e1'),
  deleteCatalogEntryByName: vi.fn(),
  selectCatalogEntryByName: vi.fn().mockReturnValue(true),
  addVersionByName: vi.fn().mockResolvedValue(true),
  deleteCollectionsByName: vi.fn().mockReturnValue(0),
}));

import {
  DEMO_CATALOG_NAME,
  DEMO_SWAGGER2_SPEC,
  spotlight,
  ensureCatalogTab,
  closeConvertModalIfOpen,
  resetDemoCatalog,
  ensureSeededEntryExists,
  ensureSeededAndSelected,
  ensureConvertModalOpen,
  ensureConvertEngineScalar,
  ensureConvertTarget,
  ensureConvertPrettyToggle,
  ensureCatalogOverviewView,
  cleanupDemoCatalog,
} from './cat-demo-helpers';
import { seedSwagger2CatalogEntry, deleteCatalogEntryByName, selectCatalogEntryByName } from '../../adapters';

function addEntryEl(): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('data-testid', 'catalog-entry-item');
  el.setAttribute('data-cat-entry-name', DEMO_CATALOG_NAME);
  document.body.appendChild(el);
  return el;
}

function addConvertBtn(): HTMLElement {
  const el = document.createElement('button');
  el.setAttribute('data-testid', 'catalog-convert-btn');
  document.body.appendChild(el);
  return el;
}

function addConvertModalWithCancel(): void {
  const modal = document.createElement('div');
  modal.className = 'cat-convert-modal';
  const inner = document.createElement('div');
  inner.setAttribute('data-testid', 'catalog-convert-modal');
  const cancel = document.createElement('button');
  cancel.className = 'cat-btn';
  cancel.textContent = 'Cancel';
  modal.appendChild(inner);
  modal.appendChild(cancel);
  document.body.appendChild(modal);
}

describe('cat-demo-helpers', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
    // jsdom does not implement scrollIntoView — the spotlight helper calls it.
    Element.prototype.scrollIntoView = vi.fn();
    vi.mocked(seedSwagger2CatalogEntry).mockResolvedValue('e1');
    vi.mocked(selectCatalogEntryByName).mockReturnValue(true);
  });

  it('exposes a valid Swagger 2.0 spec constant', () => {
    expect(DEMO_SWAGGER2_SPEC).toContain('swagger: "2.0"');
    expect(DEMO_SWAGGER2_SPEC).toContain('definitions:');
  });

  describe('spotlight', () => {
    it('is a no-op when the selector matches nothing', async () => {
      const ctx = makeCtx();
      await spotlight(ctx, '[data-testid="nope"]', 100);
      expect(ctx.delay).not.toHaveBeenCalled();
    });

    it('holds for the given duration when the element exists', async () => {
      addEntryEl();
      const ctx = makeCtx();
      await spotlight(ctx, '[data-testid="catalog-entry-item"]', 250);
      expect(ctx.delay).toHaveBeenCalledWith(250);
    });
  });

  it('ensureCatalogTab navigates to the catalog tab', () => {
    const ctx = makeCtx();
    ensureCatalogTab(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('catalog');
  });

  describe('closeConvertModalIfOpen', () => {
    it('does nothing when no modal is open', async () => {
      const ctx = makeCtx();
      await closeConvertModalIfOpen(ctx);
      expect(ctx.delay).not.toHaveBeenCalled();
    });

    it('clicks Cancel when the modal is open', async () => {
      addConvertModalWithCancel();
      const cancel = document.querySelector<HTMLButtonElement>('.cat-convert-modal .cat-btn')!;
      const spy = vi.spyOn(cancel, 'click');
      const ctx = makeCtx();
      await closeConvertModalIfOpen(ctx);
      expect(spy).toHaveBeenCalled();
    });

    it('is a no-op when the modal is present but has no Cancel button', async () => {
      const inner = document.createElement('div');
      inner.setAttribute('data-testid', 'catalog-convert-modal');
      document.body.appendChild(inner);
      const ctx = makeCtx();
      await closeConvertModalIfOpen(ctx);
      expect(ctx.delay).not.toHaveBeenCalled();
    });
  });

  describe('resetDemoCatalog', () => {
    it('navigates, deletes the prior entry, seeds fresh, and selects it', async () => {
      addEntryEl();
      const ctx = makeCtx();
      await resetDemoCatalog(ctx);
      expect(ctx.navigateToTab).toHaveBeenCalledWith('catalog');
      expect(deleteCatalogEntryByName).toHaveBeenCalledWith(DEMO_CATALOG_NAME);
      expect(seedSwagger2CatalogEntry).toHaveBeenCalledWith(DEMO_CATALOG_NAME, DEMO_SWAGGER2_SPEC);
      expect(selectCatalogEntryByName).toHaveBeenCalledWith(DEMO_CATALOG_NAME);
    });
  });

  describe('ensureSeededAndSelected', () => {
    it('ensureSeededEntryExists seeds when the entry is missing from the DOM', async () => {
      const ctx = makeCtx();
      await ensureSeededEntryExists(ctx);
      expect(seedSwagger2CatalogEntry).toHaveBeenCalled();
    });

    it('ensureSeededEntryExists does not re-seed when the entry already exists', async () => {
      addEntryEl();
      const ctx = makeCtx();
      await ensureSeededEntryExists(ctx);
      expect(seedSwagger2CatalogEntry).not.toHaveBeenCalled();
    });

    it('seeds when the entry is missing from the DOM', async () => {
      const ctx = makeCtx();
      await ensureSeededAndSelected(ctx);
      expect(seedSwagger2CatalogEntry).toHaveBeenCalled();
      expect(selectCatalogEntryByName).toHaveBeenCalledWith(DEMO_CATALOG_NAME);
    });

    it('does not re-seed when the entry already exists', async () => {
      addEntryEl();
      const ctx = makeCtx();
      await ensureSeededAndSelected(ctx);
      expect(seedSwagger2CatalogEntry).not.toHaveBeenCalled();
      expect(selectCatalogEntryByName).toHaveBeenCalledWith(DEMO_CATALOG_NAME);
    });
  });

  describe('ensureConvertModalOpen', () => {
    it('returns early when the modal is already open', async () => {
      addConvertModalWithCancel();
      const ctx = makeCtx();
      await ensureConvertModalOpen(ctx);
      expect(seedSwagger2CatalogEntry).not.toHaveBeenCalled();
    });

    it('seeds, selects, and clicks the convert button when the modal is closed', async () => {
      addEntryEl();
      const btn = addConvertBtn();
      const spy = vi.spyOn(btn, 'click');
      const ctx = makeCtx();
      await ensureConvertModalOpen(ctx);
      expect(selectCatalogEntryByName).toHaveBeenCalledWith(DEMO_CATALOG_NAME);
      expect(spy).toHaveBeenCalled();
    });

    it('does not throw when the convert button is not yet in the DOM', async () => {
      addEntryEl(); // entry present, but no convert button rendered
      const ctx = makeCtx();
      await expect(ensureConvertModalOpen(ctx)).resolves.toBeUndefined();
    });

    it('ensureConvertEngineScalar clicks scalar only when not already selected', async () => {
      addEntryEl();
      addConvertBtn();
      const scalar = document.createElement('button');
      scalar.setAttribute('data-testid', 'catalog-convert-engine-scalar');
      scalar.setAttribute('aria-checked', 'false');
      document.body.appendChild(scalar);
      const clickSpy = vi.spyOn(scalar, 'click');

      const ctx = makeCtx();
      await ensureConvertEngineScalar(ctx);
      expect(clickSpy).toHaveBeenCalled();

      clickSpy.mockClear();
      scalar.setAttribute('aria-checked', 'true');
      await ensureConvertEngineScalar(ctx);
      expect(clickSpy).not.toHaveBeenCalled();
    });

    it('ensureConvertTarget clicks the target only when not already selected', async () => {
      addConvertModalWithCancel();
      const target = document.createElement('button');
      target.setAttribute('data-testid', 'catalog-convert-target-3.1');
      target.setAttribute('aria-checked', 'false');
      document.body.appendChild(target);
      const clickSpy = vi.spyOn(target, 'click');

      const ctx = makeCtx();
      await ensureConvertTarget(ctx, '3.1');
      expect(clickSpy).toHaveBeenCalled();

      clickSpy.mockClear();
      target.setAttribute('aria-checked', 'true');
      await ensureConvertTarget(ctx, '3.1');
      expect(clickSpy).not.toHaveBeenCalled();
    });

    it('ensureConvertTarget is a no-op when the target button is absent', async () => {
      addConvertModalWithCancel();
      const ctx = makeCtx();
      await expect(ensureConvertTarget(ctx, '3.0')).resolves.toBeUndefined();
    });

    it('ensureConvertPrettyToggle clicks only when the checkbox differs from the target state', async () => {
      addConvertModalWithCancel();
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.setAttribute('data-testid', 'catalog-convert-pretty-toggle');
      box.checked = true;
      document.body.appendChild(box);
      const clickSpy = vi.spyOn(box, 'click');

      const ctx = makeCtx();
      // Already on → requesting on is a no-op.
      await ensureConvertPrettyToggle(ctx, true);
      expect(clickSpy).not.toHaveBeenCalled();

      // On → requesting off clicks once.
      await ensureConvertPrettyToggle(ctx, false);
      expect(clickSpy).toHaveBeenCalledTimes(1);
    });

    it('ensureConvertPrettyToggle is a no-op when the toggle is absent', async () => {
      addConvertModalWithCancel();
      const ctx = makeCtx();
      await expect(ensureConvertPrettyToggle(ctx, true)).resolves.toBeUndefined();
    });

    it('ensureCatalogOverviewView clicks the Overview sub-tab only when it is not active', async () => {
      const tab = document.createElement('button');
      tab.setAttribute('data-testid', 'catalog-view-overview');
      tab.className = 'cat-view-tab';
      document.body.appendChild(tab);
      const clickSpy = vi.spyOn(tab, 'click');

      const ctx = makeCtx();
      await ensureCatalogOverviewView(ctx);
      expect(clickSpy).toHaveBeenCalled();

      clickSpy.mockClear();
      tab.classList.add('active');
      await ensureCatalogOverviewView(ctx);
      expect(clickSpy).not.toHaveBeenCalled();
    });

    it('ensureCatalogOverviewView is a no-op when the Overview sub-tab is absent', async () => {
      const ctx = makeCtx();
      await expect(ensureCatalogOverviewView(ctx)).resolves.toBeUndefined();
    });
  });

  describe('cleanupDemoCatalog', () => {
    it('closes any modal and deletes the entry', async () => {
      addConvertModalWithCancel();
      const ctx = makeCtx();
      await cleanupDemoCatalog(ctx);
      expect(deleteCatalogEntryByName).toHaveBeenCalledWith(DEMO_CATALOG_NAME);
    });
  });
});
