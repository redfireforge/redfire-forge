/**
 * Unit tests for WS selector constants.
 *
 * The only executable code in ws.ts is the `authTypeOpt` function — it must
 * be exercised so V8 coverage records it as covered (otherwise funcs=0%).
 */
import { describe, it, expect } from 'vitest';
import { WS } from './ws';

describe('WS selectors', () => {
  it('authTypeOpt builds a [data-testid] selector for the given value', () => {
    expect(WS.authTypeOpt('bearer')).toBe('[data-testid="ws-auth-type-opt-bearer"]');
    expect(WS.authTypeOpt('none')).toBe('[data-testid="ws-auth-type-opt-none"]');
    expect(WS.authTypeOpt('basic')).toBe('[data-testid="ws-auth-type-opt-basic"]');
  });

  it('WS object contains expected static selector strings', () => {
    expect(WS.MODE_CLIENT).toBe('[data-testid="mode-client"]');
    expect(WS.SEARCH_INPUT).toBe('[data-testid="search-input"]');
    expect(WS.FILTER_TOGGLE_BTN).toBe('[data-testid="filter-toggle-btn"]');
  });
});
