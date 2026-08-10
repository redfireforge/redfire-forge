/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  clickHostMode,
  findHostModeLabel,
  tourHostMode,
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

function mountHostSelector(active: 'Original' | 'Settings' | 'Custom' = 'Original'): void {
  document.body.innerHTML = `
    <div class="runner-host-selector" data-testid="har-host-selector">
      <label class="radio-label">
        <input type="radio" name="hostMode" ${active === 'Original' ? 'checked' : ''} />
        Original
      </label>
      <label class="radio-label">
        <input type="radio" name="hostMode" ${active === 'Settings' ? 'checked' : ''} />
        Settings
        <code class="runner-host-url">https://jsonplaceholder.typicode.com</code>
      </label>
      <label class="radio-label">
        <input type="radio" name="hostMode" ${active === 'Custom' ? 'checked' : ''} />
        Custom
      </label>
      <input class="runner-custom-url-input" type="text" placeholder="https://my-host.example.com:8080" />
    </div>
  `;
  for (const radio of document.querySelectorAll<HTMLInputElement>('input[type="radio"]')) {
    radio.addEventListener('change', () => {
      document.querySelectorAll<HTMLInputElement>('input[name="hostMode"]').forEach((r) => {
        r.checked = r === radio;
      });
    });
    radio.addEventListener('click', () => {
      document.querySelectorAll<HTMLInputElement>('input[name="hostMode"]').forEach((r) => {
        r.checked = r === radio;
      });
    });
  }
  HTMLElement.prototype.scrollIntoView = vi.fn();
}

describe('host mode tour helpers', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('findHostModeLabel matches Settings even when a URL is present', () => {
    mountHostSelector();
    expect(findHostModeLabel('Settings')?.textContent).toContain('Settings');
    expect(findHostModeLabel('Original')?.textContent?.trim()).toBe('Original');
  });

  it('clickHostMode selects Settings', () => {
    mountHostSelector('Original');
    clickHostMode('Settings');
    const radio = findHostModeLabel('Settings')?.querySelector<HTMLInputElement>('input');
    expect(radio?.checked).toBe(true);
  });

  it('tourHostMode clicks Custom then spotlights label and input', async () => {
    mountHostSelector('Original');
    const ctx = makeCtx();
    await tourHostMode(ctx, 'Custom', { holdLabel: 10, holdCustomInput: 10 });
    const radio = findHostModeLabel('Custom')?.querySelector<HTMLInputElement>('input');
    expect(radio?.checked).toBe(true);
    expect(ctx.delay).toHaveBeenCalled();
  });
});
