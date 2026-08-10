/** @vitest-environment jsdom */
import { describe, it, expect, afterEach } from 'vitest';
import { closeTestDefDiffModal } from './th-demo-helpers';

describe('closeTestDefDiffModal', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('clicks the footer Close button when the compare modal is open', () => {
    let closed = false;
    document.body.innerHTML = `
      <div class="test-def-diff-modal">
        <div class="test-def-diff-footer">
          <button class="btn btn-primary">Close</button>
        </div>
      </div>
    `;
    document.querySelector('.btn')!.addEventListener('click', () => {
      closed = true;
    });

    closeTestDefDiffModal();
    expect(closed).toBe(true);
  });

  it('is a no-op when the compare modal is not present', () => {
    expect(() => closeTestDefDiffModal()).not.toThrow();
  });

  it('ignores non-Close footer buttons', () => {
    let closed = false;
    document.body.innerHTML = `
      <div class="test-def-diff-footer">
        <button class="btn">Cancel</button>
      </div>
    `;
    document.querySelector('.btn')!.addEventListener('click', () => {
      closed = true;
    });

    closeTestDefDiffModal();
    expect(closed).toBe(false);
  });
});
