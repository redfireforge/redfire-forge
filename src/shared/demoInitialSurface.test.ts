/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  clearDemoInitialSurface,
  DEMO_INITIAL_SURFACE_EVENT,
  peekDemoInitialSurface,
  setDemoInitialSurface,
} from './demoInitialSurface';

describe('demoInitialSurface', () => {
  afterEach(() => {
    clearDemoInitialSurface();
  });

  it('stores and peeks without consuming', () => {
    setDemoInitialSurface({ grpcPanelView: 'advanced', grpcAdvancedTab: 'mock_server' });
    expect(peekDemoInitialSurface()).toEqual({
      grpcPanelView: 'advanced',
      grpcAdvancedTab: 'mock_server',
    });
    expect(peekDemoInitialSurface()?.grpcAdvancedTab).toBe('mock_server');
  });

  it('clears after boot lands', () => {
    setDemoInitialSurface({ grpcPanelView: 'advanced' });
    clearDemoInitialSurface();
    expect(peekDemoInitialSurface()).toBeNull();
  });

  it('treats empty object as cleared', () => {
    setDemoInitialSurface({ grpcPanelView: 'advanced' });
    setDemoInitialSurface({});
    expect(peekDemoInitialSurface()).toBeNull();
  });

  it('stores catalogView for Catalog live-demo landing', () => {
    setDemoInitialSurface({ catalogView: 'endpoints' });
    expect(peekDemoInitialSurface()?.catalogView).toBe('endpoints');
  });

  it('stores wsStudioMode for WebSocket live-demo landing', () => {
    setDemoInitialSurface({ wsStudioMode: 'mock' });
    expect(peekDemoInitialSurface()?.wsStudioMode).toBe('mock');
  });

  it('notifies listeners when the armed surface changes', () => {
    const seen: string[] = [];
    const handler = () => {
      seen.push(peekDemoInitialSurface()?.catalogView ?? 'cleared');
    };
    window.addEventListener(DEMO_INITIAL_SURFACE_EVENT, handler);
    try {
      setDemoInitialSurface({ catalogView: 'overview' });
      clearDemoInitialSurface();
      expect(seen).toEqual(['overview', 'cleared']);
    } finally {
      window.removeEventListener(DEMO_INITIAL_SURFACE_EVENT, handler);
    }
  });
});
