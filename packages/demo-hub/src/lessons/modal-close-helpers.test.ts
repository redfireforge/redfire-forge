/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { clickElementQuiet, closeModalByButtonQuiet } from './modal-close-helpers';

describe('modal-close-helpers', () => {
  it('clickElementQuiet clicks and delays when element exists', async () => {
    document.body.innerHTML = `<button data-testid="close-btn">Close</button>`;
    const delay = vi.fn().mockResolvedValue(undefined);
    const clicked = await clickElementQuiet({ delay }, '[data-testid="close-btn"]', 100);
    expect(clicked).toBe(true);
    expect(delay).toHaveBeenCalledWith(100);
  });

  it('clickElementQuiet is a no-op when element is missing', async () => {
    document.body.innerHTML = '';
    const delay = vi.fn().mockResolvedValue(undefined);
    const clicked = await clickElementQuiet({ delay }, '[data-testid="missing"]');
    expect(clicked).toBe(false);
    expect(delay).not.toHaveBeenCalled();
  });

  it('closeModalByButtonQuiet delegates to clickElementQuiet', async () => {
    document.body.innerHTML = `<button data-testid="modal-close">Close</button>`;
    const delay = vi.fn().mockResolvedValue(undefined);
    await closeModalByButtonQuiet({ delay }, '[data-testid="modal-close"]', 250);
    expect(delay).toHaveBeenCalledWith(250);
  });
});
