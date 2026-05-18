/**
 * A simple counting semaphore for limiting concurrent operations.
 * Used to throttle parallel poll attempts in WaitForCondition nodes during load tests.
 */
export class Semaphore {
  private permits: number;
  private waiting: Array<() => void> = [];

  /**
   * Create a new semaphore with the given number of permits.
   * @param maxConcurrent Maximum number of concurrent operations allowed
   */
  constructor(maxConcurrent: number) {
    if (maxConcurrent < 1) {
      throw new Error('Semaphore maxConcurrent must be at least 1');
    }
    this.permits = maxConcurrent;
  }

  /**
   * Acquire a permit. If none available, wait until one is released.
   * Returns a promise that resolves when the permit is acquired.
   */
  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }

    return new Promise<void>((resolve) => {
      this.waiting.push(resolve);
    });
  }

  /**
   * Release a permit, allowing a waiting operation to proceed.
   */
  release(): void {
    const next = this.waiting.shift();
    if (next) {
      next();
    } else {
      this.permits++;
    }
  }

  /**
   * Get the current number of available permits.
   */
  get available(): number {
    return this.permits;
  }

  /**
   * Get the number of operations waiting for a permit.
   */
  get waitingCount(): number {
    return this.waiting.length;
  }
}
