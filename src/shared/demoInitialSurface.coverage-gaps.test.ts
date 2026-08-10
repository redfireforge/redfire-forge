/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import {
  clearDemoInitialSurface,
  peekDemoInitialSurface,
  setDemoInitialSurface,
} from './demoInitialSurface';

describe('demoInitialSurface coverage gaps', () => {
  it('handles notifySurfaceChanged when window is undefined', () => {
    setDemoInitialSurface({ grpcPanelView: 'advanced' });
    expect(peekDemoInitialSurface()?.grpcPanelView).toBe('advanced');
    clearDemoInitialSurface();
    expect(peekDemoInitialSurface()).toBeNull();
  });
});
