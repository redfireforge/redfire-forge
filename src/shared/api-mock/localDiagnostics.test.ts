import { describe, expect, it } from 'vitest';
import { createDefaultResponse } from './defaults';
import {
  ListenerDiagnosticsCollector,
  countRoutePredicates,
  emptyOutcomeCounts,
  summarizeMatchDurations,
} from './localDiagnostics';
import type { ApiMockRouteV1 } from './contracts';

const ts = '2026-08-13T00:00:00.000Z';

describe('localDiagnostics', () => {
  it('summarizes an empty window and a populated p95', () => {
    expect(summarizeMatchDurations([])).toEqual({ lastMs: 0, p95Ms: 0, count: 0 });
    const summary = summarizeMatchDurations([1, 2, 3, 4, 10]);
    expect(summary.lastMs).toBe(10);
    expect(summary.count).toBe(5);
    expect(summary.p95Ms).toBeGreaterThanOrEqual(4);
  });

  it('counts predicate leaves and records rolling outcomes', () => {
    const route: ApiMockRouteV1 = {
      id: 'r1', name: 'R', enabled: true, method: 'GET', path: { kind: 'exact', value: '/' },
      priority: 0, predicates: {
        id: 'pg', combinator: 'all',
        children: [{ id: 'p1', source: 'header', operator: 'exact', expected: 'a' }],
      },
      responseMode: 'rules', responses: [createDefaultResponse('v1')],
      tags: [], createdAt: ts, updatedAt: ts,
    };
    expect(countRoutePredicates([route])).toBe(1);
    expect(emptyOutcomeCounts().matched).toBe(0);

    const collector = new ListenerDiagnosticsCollector();
    collector.recordMatch(-3, 'matched');
    expect(collector.snapshot().matchDuration.lastMs).toBe(0);
    collector.recordMatch(8, 'unmatched');
    collector.addTemplateErrors(2);
    collector.addTemplateErrors(0);
    const snap = collector.snapshot();
    expect(snap.outcomes.matched).toBe(1);
    expect(snap.outcomes.unmatched).toBe(1);
    expect(snap.templateErrors).toBe(2);
    expect(snap.matchDuration.count).toBe(2);
    expect(snap.matchDuration.lastMs).toBe(8);
  });

  it('drops oldest samples after 100 recordings', () => {
    const collector = new ListenerDiagnosticsCollector();
    for (let i = 0; i < 105; i++) collector.recordMatch(i, 'matched');
    const snap = collector.snapshot();
    expect(snap.matchDuration.count).toBe(100);
    expect(snap.outcomes.matched).toBe(105);
  });

  it('resets samples, outcomes, and template errors', () => {
    const collector = new ListenerDiagnosticsCollector();
    collector.recordMatch(4, 'matched');
    collector.addTemplateErrors(3);
    collector.reset();
    expect(collector.snapshot()).toEqual({
      matchDuration: { lastMs: 0, p95Ms: 0, count: 0 },
      outcomes: emptyOutcomeCounts(),
      templateErrors: 0,
    });
  });
});
