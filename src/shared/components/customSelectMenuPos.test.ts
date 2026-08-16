import { describe, expect, it } from 'vitest';
import { computeSelectMenuPos } from './customSelectMenuPos';

const viewport = { width: 1200, height: 800 };

describe('computeSelectMenuPos', () => {
  it('opens below on the left half and upward when there is no room underneath', () => {
    const below = computeSelectMenuPos({
      rect: { left: 40, right: 160, top: 80, bottom: 108, width: 120 },
      viewport,
    });
    expect(below.left).toBe(40);
    expect(below.top).toBe(114);
    expect(below.openUp).toBe(false);

    const up = computeSelectMenuPos({
      rect: { left: 40, right: 160, top: 700, bottom: 728, width: 120 },
      viewport,
    });
    expect(up.openUp).toBe(true);
    expect(up.bottom).toBe(800 - 700 + 6);
  });

  it('pins below-start menus to the trigger left edge unless they would overflow', () => {
    const start = computeSelectMenuPos({
      rect: { left: 880, right: 1080, top: 50, bottom: 82, width: 200 },
      viewport: { width: 1400, height: 800 },
      menuAlign: 'start',
      menuMinWidth: 420,
    });
    expect(start.left).toBe(880);
    expect(start.right).toBeUndefined();
    expect(start.top).toBe(88);

    const flip = computeSelectMenuPos({
      rect: { left: 900, right: 1100, top: 50, bottom: 82, width: 200 },
      viewport: { width: 1200, height: 800 },
      menuAlign: 'start',
      menuMinWidth: 420,
    });
    expect(flip.right).toBe(100);
    expect(flip.left).toBeUndefined();
  });

  it('anchors below menus to the right edge in the right half of the viewport', () => {
    const pos = computeSelectMenuPos({
      rect: { left: 880, right: 960, top: 50, bottom: 60, width: 80 },
      viewport: { width: 1000, height: 800 },
    });
    expect(pos.right).toBe(40);
    expect(pos.left).toBeUndefined();
  });

  it('opens a wide panel to the right of the trigger', () => {
    const pos = computeSelectMenuPos({
      rect: { left: 200, right: 320, top: 120, bottom: 148, width: 120 },
      viewport,
      placement: 'end',
      menuMinWidth: 420,
    });
    expect(pos.left).toBe(326);
    expect(pos.width).toBe(420);
    expect(pos.minWidth).toBe(420);
    expect(pos.top).toBe(120);
    expect(pos.openUp).toBe(false);
  });

  it('flips the end panel to the left when the right side is tight', () => {
    const pos = computeSelectMenuPos({
      rect: { left: 900, right: 1100, top: 40, bottom: 68, width: 200 },
      viewport: { width: 1200, height: 800 },
      placement: 'end',
      menuMinWidth: 420,
    });
    expect(pos.right).toBe(1200 - 900 + 6);
    expect(pos.left).toBeUndefined();
  });
});
