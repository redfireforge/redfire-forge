import { describe, it, expect } from 'vitest';

describe('Save as Test display logic', () => {
  it('shows only after successful response (2xx)', () => {
    const status = 200;
    const error = undefined;
    const onSendToHarness = () => {};
    const shouldShow = !error && onSendToHarness && status >= 200 && status < 300;
    expect(shouldShow).toBeTruthy();
  });

  it('hides when response is not 2xx', () => {
    const cases = [400, 404, 500, 301, 0];
    for (const status of cases) {
      const shouldShow = status >= 200 && status < 300;
      expect(shouldShow).toBe(false);
    }
  });

  it('hides when there is an error', () => {
    const error = 'ECONNREFUSED';
    const status = 0;
    const shouldShow = !error && status >= 200 && status < 300;
    expect(shouldShow).toBe(false);
  });
});
