/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { collapseAppSidebar, expandAppSidebar, beginDemoAppSidebarSession, endDemoAppSidebarSession } from './appShellAdapter';
import { DEMO_SIDEBAR_PIN_KEY, DEMO_SIDEBAR_SESSION_KEY } from '@shared/demoAppSidebarSession';

describe('appShellAdapter', () => {
  beforeEach(() => {
    delete (window as unknown as Record<string, unknown>).__demoCollapseAppSidebar;
    delete (window as unknown as Record<string, unknown>).__demoExpandAppSidebar;
    delete (window as unknown as Record<string, unknown>).__demoBeginAppSidebarSession;
    delete (window as unknown as Record<string, unknown>).__demoEndAppSidebarSession;
    sessionStorage.removeItem(DEMO_SIDEBAR_PIN_KEY);
    sessionStorage.removeItem(DEMO_SIDEBAR_SESSION_KEY);
  });

  it('collapseAppSidebar invokes bridge when present', () => {
    let called = false;
    (window as unknown as Record<string, unknown>).__demoCollapseAppSidebar = () => {
      called = true;
    };
    collapseAppSidebar();
    expect(called).toBe(true);
  });

  it('expandAppSidebar is a no-op when bridge missing', () => {
    expect(() => expandAppSidebar()).not.toThrow();
  });

  it('beginDemoAppSidebarSession writes flags and invokes the bridge', () => {
    let began = false;
    (window as unknown as Record<string, unknown>).__demoBeginAppSidebarSession = () => {
      began = true;
    };
    beginDemoAppSidebarSession();
    expect(sessionStorage.getItem(DEMO_SIDEBAR_SESSION_KEY)).toBe('1');
    expect(sessionStorage.getItem(DEMO_SIDEBAR_PIN_KEY)).toBeNull();
    expect(began).toBe(true);
  });

  it('endDemoAppSidebarSession clears flags and invokes the bridge', () => {
    sessionStorage.setItem(DEMO_SIDEBAR_SESSION_KEY, '1');
    sessionStorage.setItem(DEMO_SIDEBAR_PIN_KEY, '1');
    let ended = false;
    (window as unknown as Record<string, unknown>).__demoEndAppSidebarSession = () => {
      ended = true;
    };
    endDemoAppSidebarSession();
    expect(sessionStorage.getItem(DEMO_SIDEBAR_SESSION_KEY)).toBeNull();
    expect(sessionStorage.getItem(DEMO_SIDEBAR_PIN_KEY)).toBeNull();
    expect(ended).toBe(true);
  });
});
