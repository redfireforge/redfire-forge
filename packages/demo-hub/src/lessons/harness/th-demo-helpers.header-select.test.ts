/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ensureDemoHarnessTargetEntities,
  pickHeaderCustomSelectVisibly,
  selectDemoEnvAndServiceVisibly,
} from './th-demo-helpers';
import type { DemoActionContext } from '../../types';

vi.mock('../../demoRipple', () => ({
  showSpotlightRing: vi.fn(() => vi.fn()),
}));

function makeCtx(): DemoActionContext {
  return {
    delay: vi.fn(async () => {}),
    click: vi.fn(async () => {}),
    fill: vi.fn(async () => {}),
    waitFor: vi.fn(async () => document.createElement('div')),
    navigateToTab: vi.fn(),
  } as unknown as DemoActionContext;
}

describe('header env/svc visible selection', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    Element.prototype.scrollIntoView = vi.fn();
    delete (window as unknown as Record<string, unknown>).__demoSeedHarnessTarget;
    delete (window as unknown as Record<string, unknown>).__demoSelectEnvSvc;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('ensureDemoHarnessTargetEntities returns bridge ids without selecting', () => {
    const seed = vi.fn(() => ({ envId: 'e1', svcId: 's1' }));
    (window as unknown as Record<string, unknown>).__demoSeedHarnessTarget = seed;
    expect(ensureDemoHarnessTargetEntities()).toEqual({ envId: 'e1', svcId: 's1' });
    expect(seed).toHaveBeenCalled();
  });

  it('pickHeaderCustomSelectVisibly opens the menu and clicks the option', async () => {
    document.body.innerHTML = `
      <div data-testid="header-env-select" data-value="other" class="cs-wrapper">
        <button class="cs-trigger" aria-expanded="false">other</button>
      </div>
      <button class="cs-item" data-value="demo-env">demo</button>
    `;
    const item = document.querySelector<HTMLElement>('.cs-item[data-value="demo-env"]')!;
    const clickSpy = vi.spyOn(item, 'click');
    const ok = await pickHeaderCustomSelectVisibly(
      makeCtx(),
      '[data-testid="header-env-select"]',
      'demo-env',
      50,
    );
    expect(ok).toBe(true);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('selectDemoEnvAndServiceVisibly picks env then svc by id', async () => {
    (window as unknown as Record<string, unknown>).__demoSeedHarnessTarget = () => ({
      envId: 'env-demo',
      svcId: 'svc-jp',
    });
    document.body.innerHTML = `
      <div data-testid="header-env-select" data-value="env-other" class="cs-wrapper">
        <button class="cs-trigger">other</button>
      </div>
      <div data-testid="header-svc-select" data-value="svc-other" class="cs-wrapper">
        <button class="cs-trigger">other</button>
      </div>
      <button class="cs-item" data-value="env-demo">demo</button>
      <button class="cs-item" data-value="svc-jp">jsonplaceholder</button>
    `;
    const envClick = vi.spyOn(
      document.querySelector<HTMLElement>('.cs-item[data-value="env-demo"]')!,
      'click',
    );
    const svcClick = vi.spyOn(
      document.querySelector<HTMLElement>('.cs-item[data-value="svc-jp"]')!,
      'click',
    );
    const ids = await selectDemoEnvAndServiceVisibly(makeCtx());
    expect(ids).toEqual({ envId: 'env-demo', svcId: 'svc-jp' });
    expect(envClick).toHaveBeenCalled();
    expect(svcClick).toHaveBeenCalled();
  });
});
