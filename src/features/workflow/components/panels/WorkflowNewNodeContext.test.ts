import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { markNodeAsNew, isNodeNew } from './WorkflowNewNodeContext';

describe('WorkflowNewNodeContext', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('markNodeAsNew', () => {
    it('marks a node as new', () => {
      markNodeAsNew('node-1');
      expect(isNodeNew('node-1')).toBe(true);
    });

    it('node is no longer new after 300ms', () => {
      markNodeAsNew('node-2');
      expect(isNodeNew('node-2')).toBe(true);
      
      vi.advanceTimersByTime(299);
      expect(isNodeNew('node-2')).toBe(true);
      
      vi.advanceTimersByTime(1);
      expect(isNodeNew('node-2')).toBe(false);
    });

    it('calling markNodeAsNew again resets the timer', () => {
      markNodeAsNew('node-3');
      vi.advanceTimersByTime(200);
      expect(isNodeNew('node-3')).toBe(true);
      
      markNodeAsNew('node-3');
      vi.advanceTimersByTime(200);
      expect(isNodeNew('node-3')).toBe(true);
      
      vi.advanceTimersByTime(100);
      expect(isNodeNew('node-3')).toBe(false);
    });

    it('handles multiple nodes independently', () => {
      markNodeAsNew('node-a');
      vi.advanceTimersByTime(100);
      markNodeAsNew('node-b');
      
      vi.advanceTimersByTime(199);
      expect(isNodeNew('node-a')).toBe(true);
      expect(isNodeNew('node-b')).toBe(true);
      
      vi.advanceTimersByTime(1);
      expect(isNodeNew('node-a')).toBe(false);
      expect(isNodeNew('node-b')).toBe(true);
      
      vi.advanceTimersByTime(100);
      expect(isNodeNew('node-b')).toBe(false);
    });
  });

  describe('isNodeNew', () => {
    it('returns false for unknown nodes', () => {
      expect(isNodeNew('unknown-node')).toBe(false);
    });

    it('returns true for recently marked nodes', () => {
      markNodeAsNew('new-node');
      expect(isNodeNew('new-node')).toBe(true);
    });

    it('returns false after timeout expires', () => {
      markNodeAsNew('temp-node');
      vi.advanceTimersByTime(300);
      expect(isNodeNew('temp-node')).toBe(false);
    });
  });
});
