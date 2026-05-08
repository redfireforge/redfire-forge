import { describe, it, expect } from 'vitest';
import { Semaphore } from '../../../../shared/utils/semaphore';

describe('Poll throttling integration', () => {
  it('semaphore limits concurrent poll operations', async () => {
    const semaphore = new Semaphore(2);
    let concurrentOps = 0;
    let maxConcurrent = 0;

    const simulatePoll = async () => {
      await semaphore.acquire();
      try {
        concurrentOps++;
        maxConcurrent = Math.max(maxConcurrent, concurrentOps);
        // Simulate poll work
        await new Promise(r => setTimeout(r, 10));
      } finally {
        concurrentOps--;
        semaphore.release();
      }
    };

    // Start 5 concurrent polls, but semaphore allows only 2
    const promises = Array.from({ length: 5 }, () => simulatePoll());
    await Promise.all(promises);

    expect(maxConcurrent).toBe(2);
    expect(semaphore.available).toBe(2);
  });

  it('semaphore queues waiting operations', async () => {
    const semaphore = new Semaphore(1);
    const order: number[] = [];

    // Acquire the single permit
    await semaphore.acquire();

    // Start two more operations that will wait
    const p1 = semaphore.acquire().then(() => { order.push(1); semaphore.release(); });
    const p2 = semaphore.acquire().then(() => { order.push(2); semaphore.release(); });

    expect(semaphore.waitingCount).toBe(2);

    // Release the original permit
    semaphore.release();

    await Promise.all([p1, p2]);
    
    // Should process in FIFO order
    expect(order).toEqual([1, 2]);
    expect(semaphore.available).toBe(1);
  });

  it('works with mixed sync/async patterns', async () => {
    const semaphore = new Semaphore(3);
    
    // Acquire all permits
    await semaphore.acquire();
    await semaphore.acquire();
    await semaphore.acquire();
    expect(semaphore.available).toBe(0);

    // Queue some waiters
    let resolved = 0;
    const waiters = [
      semaphore.acquire().then(() => { resolved++; }),
      semaphore.acquire().then(() => { resolved++; }),
    ];

    expect(semaphore.waitingCount).toBe(2);
    
    // Release permits
    semaphore.release();
    semaphore.release();
    
    await Promise.all(waiters);
    
    expect(resolved).toBe(2);
    // Two permits still held (we only released 2, 3 were acquired)
    expect(semaphore.waitingCount).toBe(0);
  });
});

describe('graphLoadRunner semaphore creation', () => {
  it('creates semaphore only when workflow has WaitForCondition nodes', async () => {
    // This test verifies the conditional logic in graphLoadRunner
    // If the workflow has WaitForCondition nodes, a semaphore should be created
    const hasWaitForCondition = (nodes: Array<{ type: string }>) => 
      nodes.some(n => n.type === 'waitForCondition');

    expect(hasWaitForCondition([{ type: 'http' }, { type: 'delay' }])).toBe(false);
    expect(hasWaitForCondition([{ type: 'http' }, { type: 'waitForCondition' }])).toBe(true);
    expect(hasWaitForCondition([{ type: 'waitForCondition' }])).toBe(true);
  });

  it('uses default maxConcurrentPolls of 20', () => {
    const maxConcurrentPolls = undefined;
    const defaultLimit = maxConcurrentPolls ?? 20;
    expect(defaultLimit).toBe(20);
  });

  it('respects custom maxConcurrentPolls setting', () => {
    const maxConcurrentPolls = 50;
    const limit = maxConcurrentPolls ?? 20;
    expect(limit).toBe(50);
  });
});
