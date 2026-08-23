import type { ApiMockRouteV1 } from '@shared/api-mock/contracts';

export const TX_FLASH_MS = 2200;

export function httpStatusTone(status?: number): 'success' | 'warning' | 'danger' | 'info' | '' {
  if (status == null) return '';
  if (status >= 500) return 'danger';
  if (status >= 400) return 'warning';
  if (status >= 300) return 'info';
  if (status >= 200) return 'success';
  return 'info';
}

export function timeOf(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleTimeString();
}

/** Collect scenario states and counter keys declared across route transitions. */
export function deriveScenarioModel(routes: ApiMockRouteV1[]): { states: string[]; counters: string[] } {
  const states = new Set<string>();
  const counters = new Set<string>();
  for (const route of routes) {
    for (const variant of route.responses) {
      const t = variant.transition;
      if (!t) continue;
      if (t.currentState) states.add(t.currentState);
      if (t.targetState) states.add(t.targetState);
      for (const c of t.counterUpdates ?? []) counters.add(c.key);
    }
  }
  return { states: [...states], counters: [...counters] };
}
