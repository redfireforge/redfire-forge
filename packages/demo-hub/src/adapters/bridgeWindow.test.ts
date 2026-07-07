/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { getDemoBridgeWindow } from './bridgeWindow';

describe('bridgeWindow', () => {
  it('returns the browser window reference', () => {
    expect(getDemoBridgeWindow()).toBe(window);
  });

  it('preserves demo bridge properties set on window', () => {
    const demoOpen = () => true;
    (window as unknown as { __demoOpenGqlProfileModal?: () => boolean }).__demoOpenGqlProfileModal = demoOpen;

    const bridge = getDemoBridgeWindow();
    expect(bridge.__demoOpenGqlProfileModal).toBe(demoOpen);
    expect(bridge.__demoOpenGqlProfileModal?.()).toBe(true);

    delete (window as unknown as { __demoOpenGqlProfileModal?: () => boolean }).__demoOpenGqlProfileModal;
  });
});