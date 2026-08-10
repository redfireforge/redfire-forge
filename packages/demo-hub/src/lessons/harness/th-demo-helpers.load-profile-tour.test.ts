/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  clickProfileType,
  findProfileTypeBtn,
  tourLoadProfileType,
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

function mountProfileTypes(active: 'Ramp-Up' | 'Sustained' | 'Spike' = 'Ramp-Up'): void {
  document.body.innerHTML = `
    <div class="load-profile-section">
      <div class="profile-type-selector">
        <button class="profile-type-btn${active === 'Ramp-Up' ? ' active' : ''}">Ramp-Up</button>
        <button class="profile-type-btn${active === 'Sustained' ? ' active' : ''}">Sustained</button>
        <button class="profile-type-btn${active === 'Spike' ? ' active' : ''}">Spike</button>
      </div>
      <div class="profile-type-desc">Profile description</div>
      <div class="profile-fields"><div class="profile-field">fields</div></div>
      <div class="profile-preview-container">chart</div>
    </div>
  `;
  for (const btn of document.querySelectorAll<HTMLElement>('.profile-type-btn')) {
    btn.scrollIntoView = vi.fn();
    btn.addEventListener('click', () => {
      document.querySelectorAll('.profile-type-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    });
  }
  HTMLElement.prototype.scrollIntoView = vi.fn();
}

describe('load profile type helpers', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('findProfileTypeBtn returns the matching button', () => {
    mountProfileTypes();
    expect(findProfileTypeBtn('Sustained')?.textContent).toBe('Sustained');
    expect(findProfileTypeBtn('Missing')).toBeNull();
  });

  it('clickProfileType activates a non-active type', () => {
    mountProfileTypes('Ramp-Up');
    clickProfileType('Spike');
    expect(findProfileTypeBtn('Spike')?.classList.contains('active')).toBe(true);
  });

  it('tourLoadProfileType visits button → description → fields → preview', async () => {
    mountProfileTypes('Ramp-Up');
    const ctx = makeCtx();
    await tourLoadProfileType(ctx, 'Sustained', {
      holdBtn: 10,
      holdDesc: 10,
      holdFields: 10,
      holdPreview: 10,
    });

    expect(findProfileTypeBtn('Sustained')?.classList.contains('active')).toBe(true);
    expect(ctx.delay).toHaveBeenCalled();
  });
});
