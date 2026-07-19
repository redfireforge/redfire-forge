import { describe, it, expect } from 'vitest';
import { SSE } from './sse';

describe('SSE selectors', () => {
  it('exposes the expected base selectors', () => {
    expect(SSE.NAV_TAB).toBe('[data-testid="nav-tab-sse-studio"]');
    expect(SSE.STUDIO).toBe('[data-testid="sse-studio"]');
    expect(SSE.CONN_TAB_BAR).toBe('[data-testid="sse-conn-tab-bar"]');
    expect(SSE.CONN_TAB_CLOSE).toBe('[data-testid="sse-conn-tab-close"]');
  });

  it('builds a connection tab selector by id', () => {
    expect(SSE.connTabById('conn-1')).toBe(
      '[data-testid="sse-conn-tab-item"][data-tab-id="conn-1"]',
    );
  });
});