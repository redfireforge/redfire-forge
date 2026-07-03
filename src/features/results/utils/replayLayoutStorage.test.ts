/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  loadLayoutFromStorage,
  REPLAY_LAYOUT_STORAGE_PREFIX,
  saveLayoutToStorage,
} from './replayLayoutStorage';

describe('replayLayoutStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saves and loads layout positions', () => {
    const positions = {
      a: { x: 10, y: 20 },
      b: { x: 30, y: 40 },
    };
    saveLayoutToStorage('wf-1', positions);
    expect(loadLayoutFromStorage('wf-1')).toEqual(positions);
  });

  it('returns null when no stored layout exists', () => {
    expect(loadLayoutFromStorage('missing')).toBeNull();
  });

  it('returns null when stored layout JSON is invalid', () => {
    localStorage.setItem(`${REPLAY_LAYOUT_STORAGE_PREFIX}wf-1`, '{bad-json');
    expect(loadLayoutFromStorage('wf-1')).toBeNull();
  });

  it('swallows localStorage setItem failures', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => saveLayoutToStorage('wf-2', { a: { x: 1, y: 2 } })).not.toThrow();
    spy.mockRestore();
  });

  it('returns null when localStorage getItem throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(loadLayoutFromStorage('wf-3')).toBeNull();
    spy.mockRestore();
  });
});
