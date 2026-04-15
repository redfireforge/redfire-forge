import type { ErrorPolicy, RequestResult } from '../types';

export class CircuitBreaker {
  private errorCount = 0;
  private totalCount = 0;
  private tripped = false;
  private policy: ErrorPolicy;
  private maxErrors: number;
  private maxErrorRate: number;
  private minSampleSize: number;

  constructor(
    policy: ErrorPolicy = 'continue',
    maxErrors: number = 10,
    maxErrorRate: number = 50,
    minSampleSize: number = 10
  ) {
    this.policy = policy;
    this.maxErrors = maxErrors;
    this.maxErrorRate = maxErrorRate;
    this.minSampleSize = minSampleSize;
  }

  record(result: RequestResult): void {
    this.totalCount++;
    if (!result.passed) this.errorCount++;
    if (this.policy === 'continue') return;
    if (this.policy === 'stop-first' && !result.passed) {
      this.tripped = true;
      return;
    }
    if (this.policy === 'stop-threshold') {
      if (this.errorCount >= this.maxErrors) { this.tripped = true; return; }
      if (this.totalCount >= this.minSampleSize) {
        const rate = (this.errorCount / this.totalCount) * 100;
        if (rate >= this.maxErrorRate) this.tripped = true;
      }
    }
  }

  get shouldStop(): boolean { return this.tripped; }
  get reason(): string {
    if (this.policy === 'stop-first') return 'Stopped: first error encountered';
    if (this.errorCount >= this.maxErrors) return `Stopped: ${this.errorCount} errors reached max (${this.maxErrors})`;
    return `Stopped: error rate ${((this.errorCount / this.totalCount) * 100).toFixed(1)}% exceeded ${this.maxErrorRate}%`;
  }
}
