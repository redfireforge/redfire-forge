import type { ThinkTimeConfig } from '@shared/types';

function gaussianRandom(mean: number, stdDev: number): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return mean + z * stdDev;
}

export function createThinkTimeDelay(config?: ThinkTimeConfig): () => number {
  if (!config || config.mode === 'none') return () => 0;

  switch (config.mode) {
    case 'constant': {
      const ms = Math.max(0, config.constantMs ?? 1000);
      return () => ms;
    }
    case 'uniform': {
      const min = Math.max(0, config.minMs ?? 500);
      const max = Math.max(min, config.maxMs ?? 2000);
      return () => min + Math.random() * (max - min);
    }
    case 'gaussian': {
      const mean = Math.max(0, config.meanMs ?? 1000);
      const stdDev = Math.max(0, config.stdDevMs ?? 300);
      return () => Math.max(0, gaussianRandom(mean, stdDev));
    }
    default:
      return () => 0;
  }
}

export function applyThinkTime(getDelayMs: () => number, abortSignal?: AbortSignal): Promise<void> {
  const delay = Math.round(getDelayMs());
  if (delay <= 0 || abortSignal?.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    let onAbort: (() => void) | undefined;
    const timer = setTimeout(() => {
      if (onAbort && abortSignal) abortSignal.removeEventListener('abort', onAbort);
      resolve();
    }, delay);
    if (abortSignal) {
      onAbort = () => { clearTimeout(timer); resolve(); };
      abortSignal.addEventListener('abort', onAbort, { once: true });
    }
  });
}
