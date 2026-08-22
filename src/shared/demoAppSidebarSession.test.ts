/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach } from 'vitest';
import {
  DEMO_LIVE_SESSION_KEY,
  DEMO_SIDEBAR_PIN_KEY,
  DEMO_SIDEBAR_SESSION_KEY,
  beginDemoAppSidebarSession,
  endDemoAppSidebarSession,
  isDemoAppSidebarPinned,
  isDemoAppSidebarSession,
  isDemoLiveSessionActive,
  markDemoAppSidebarUserCollapsed,
  markDemoAppSidebarUserExpanded,
} from './demoAppSidebarSession';

describe('demoAppSidebarSession', () => {
  afterEach(() => {
    sessionStorage.removeItem(DEMO_LIVE_SESSION_KEY);
    sessionStorage.removeItem(DEMO_SIDEBAR_PIN_KEY);
    sessionStorage.removeItem(DEMO_SIDEBAR_SESSION_KEY);
  });

  it('starts a demo session unpinned and ends it', () => {
    beginDemoAppSidebarSession();
    expect(isDemoAppSidebarSession()).toBe(true);
    expect(isDemoAppSidebarPinned()).toBe(false);

    markDemoAppSidebarUserExpanded();
    expect(isDemoAppSidebarPinned()).toBe(true);

    endDemoAppSidebarSession();
    expect(isDemoAppSidebarSession()).toBe(false);
    expect(isDemoAppSidebarPinned()).toBe(false);
  });

  it('does not pin Show outside a demo session', () => {
    markDemoAppSidebarUserExpanded();
    expect(isDemoAppSidebarPinned()).toBe(false);
  });

  it('treats a live lesson session as an active sidebar session', () => {
    sessionStorage.setItem(DEMO_LIVE_SESSION_KEY, '{"lessonId":"am-01"}');
    expect(isDemoLiveSessionActive()).toBe(true);
    expect(isDemoAppSidebarSession()).toBe(true);
  });

  it('Hide during a demo drops the pin', () => {
    beginDemoAppSidebarSession();
    markDemoAppSidebarUserExpanded();
    markDemoAppSidebarUserCollapsed();
    expect(isDemoAppSidebarPinned()).toBe(false);
    expect(isDemoAppSidebarSession()).toBe(true);
  });

  it('swallows sessionStorage errors', () => {
    const proto = Object.getPrototypeOf(sessionStorage) as Storage;
    const originalGet = proto.getItem;
    const originalSet = proto.setItem;
    const originalRemove = proto.removeItem;
    proto.getItem = () => {
      throw new Error('blocked');
    };
    proto.setItem = () => {
      throw new Error('blocked');
    };
    proto.removeItem = () => {
      throw new Error('blocked');
    };
    try {
      expect(isDemoLiveSessionActive()).toBe(false);
      expect(() => beginDemoAppSidebarSession()).not.toThrow();
      expect(() => endDemoAppSidebarSession()).not.toThrow();
      expect(() => markDemoAppSidebarUserExpanded()).not.toThrow();
      expect(() => markDemoAppSidebarUserCollapsed()).not.toThrow();
    } finally {
      proto.getItem = originalGet;
      proto.setItem = originalSet;
      proto.removeItem = originalRemove;
    }
  });
});
