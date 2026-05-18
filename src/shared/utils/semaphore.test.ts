import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Semaphore } from './semaphore';

describe('Semaphore', () => {
  describe('constructor', () => {
    it('creates semaphore with given permits', () => {
      const sem = new Semaphore(5);
      expect(sem.available).toBe(5);
      expect(sem.waitingCount).toBe(0);
    });

    it('throws if maxConcurrent is less than 1', () => {
      expect(() => new Semaphore(0)).toThrow('must be at least 1');
      expect(() => new Semaphore(-1)).toThrow('must be at least 1');
    });
  });

  describe('acquire/release', () => {
    it('acquires immediately when permits available', async () => {
      const sem = new Semaphore(2);
      
      await sem.acquire();
      expect(sem.available).toBe(1);
      
      await sem.acquire();
      expect(sem.available).toBe(0);
    });

    it('releases permit and increments available', async () => {
      const sem = new Semaphore(1);
      
      await sem.acquire();
      expect(sem.available).toBe(0);
      
      sem.release();
      expect(sem.available).toBe(1);
    });

    it('queues waiters when no permits available', async () => {
      const sem = new Semaphore(1);
      await sem.acquire();
      
      let acquired = false;
      const waitPromise = sem.acquire().then(() => { acquired = true; });
      
      // Should be waiting
      expect(sem.waitingCount).toBe(1);
      expect(acquired).toBe(false);
      
      // Release permit
      sem.release();
      await waitPromise;
      
      expect(acquired).toBe(true);
      expect(sem.waitingCount).toBe(0);
    });

    it('processes waiters in FIFO order', async () => {
      const sem = new Semaphore(1);
      await sem.acquire();
      
      const order: number[] = [];
      
      const p1 = sem.acquire().then(() => order.push(1));
      const p2 = sem.acquire().then(() => order.push(2));
      const p3 = sem.acquire().then(() => order.push(3));
      
      expect(sem.waitingCount).toBe(3);
      
      sem.release();
      await p1;
      expect(order).toEqual([1]);
      
      sem.release();
      await p2;
      expect(order).toEqual([1, 2]);
      
      sem.release();
      await p3;
      expect(order).toEqual([1, 2, 3]);
    });
  });

  describe('concurrent operations', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('limits concurrent operations to maxConcurrent', async () => {
      const sem = new Semaphore(2);
      let running = 0;
      let maxRunning = 0;

      const doWork = async (id: number) => {
        await sem.acquire();
        running++;
        maxRunning = Math.max(maxRunning, running);
        
        // Simulate async work
        await new Promise(r => setTimeout(r, 100));
        
        running--;
        sem.release();
        return id;
      };

      // Start 5 concurrent operations
      const promises = [
        doWork(1),
        doWork(2),
        doWork(3),
        doWork(4),
        doWork(5),
      ];

      // Let all work complete
      await vi.advanceTimersByTimeAsync(500);
      await Promise.all(promises);

      expect(maxRunning).toBe(2); // Should never exceed semaphore limit
    });

    it('handles rapid acquire/release cycles', async () => {
      const sem = new Semaphore(3);
      const results: number[] = [];

      const doWork = async (id: number) => {
        await sem.acquire();
        results.push(id);
        await new Promise(r => setTimeout(r, 10));
        sem.release();
      };

      // Start many operations
      const promises = Array.from({ length: 10 }, (_, i) => doWork(i));

      await vi.advanceTimersByTimeAsync(100);
      await Promise.all(promises);

      // All should complete
      expect(results.length).toBe(10);
      expect(sem.available).toBe(3); // All permits returned
      expect(sem.waitingCount).toBe(0);
    });
  });
});
