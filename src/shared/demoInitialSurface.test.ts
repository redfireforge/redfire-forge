import { afterEach, describe, expect, it } from 'vitest';
import {
  clearDemoInitialSurface,
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
});
