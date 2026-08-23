/**
 * Apollo tracing waterfall helpers — pure functions (no React).
 */
import type { ApolloTracingData } from '@shared/types/graphql';

export type PhaseVariant = 'parse' | 'validate' | 'execution' | 'overhead';

export interface PhaseSegment {
  key: string;
  label: string;
  start: number;
  duration: number;
  variant: PhaseVariant;
}

/** Convert nanoseconds to a compact human-readable string. */
export function nsToMs(ns: number): string {
  const ms = ns / 1_000_000;
  if (ms < 0.1) return `${(ns / 1000).toFixed(0)} µs`;
  if (ms < 1) return `${ms.toFixed(2)} ms`;
  if (ms < 100) return `${ms.toFixed(1)} ms`;
  return `${ms.toFixed(0)} ms`;
}

/** Color class based on duration in nanoseconds. */
export function durationColorClass(ns: number): string {
  const ms = ns / 1_000_000;
  if (ms < 50) return 'gql-trace-bar--ok';
  if (ms < 200) return 'gql-trace-bar--warn';
  return 'gql-trace-bar--slow';
}

export function durationTextClass(ns: number): string {
  const ms = ns / 1_000_000;
  if (ms < 50) return 'gql-trace-duration--ok';
  if (ms < 200) return 'gql-trace-duration--warn';
  return 'gql-trace-duration--slow';
}

export function pctOfTotal(value: number, total: number): number {
  if (total <= 0) return 0;
  return (value / total) * 100;
}

export function buildPhaseSegments(tracing: ApolloTracingData): PhaseSegment[] {
  const total = tracing.duration;
  const resolvers = tracing.execution?.resolvers ?? [];
  const segments: PhaseSegment[] = [];

  if (tracing.parsing?.duration) {
    segments.push({
      key: 'parse',
      label: 'Parse',
      start: tracing.parsing.startOffset,
      duration: tracing.parsing.duration,
      variant: 'parse',
    });
  }
  if (tracing.validation?.duration) {
    segments.push({
      key: 'validate',
      label: 'Validate',
      start: tracing.validation.startOffset,
      duration: tracing.validation.duration,
      variant: 'validate',
    });
  }
  if (resolvers.length) {
    const execStart = Math.min(...resolvers.map((r) => r.startOffset));
    const execEnd = Math.max(...resolvers.map((r) => r.startOffset + r.duration));
    if (execEnd > execStart) {
      segments.push({
        key: 'execution',
        label: 'Execution',
        start: execStart,
        duration: execEnd - execStart,
        variant: 'execution',
      });
    }
  }

  const phaseEnds = segments.map((s) => s.start + s.duration);
  const lastEnd = phaseEnds.length ? Math.max(...phaseEnds) : 0;
  if (lastEnd < total) {
    segments.push({
      key: 'overhead-tail',
      label: 'Other',
      start: lastEnd,
      duration: total - lastEnd,
      variant: 'overhead',
    });
  }

  const firstStart = segments.length ? Math.min(...segments.map((s) => s.start)) : 0;
  if (firstStart > 0) {
    segments.unshift({
      key: 'overhead-head',
      label: 'Other',
      start: 0,
      duration: firstStart,
      variant: 'overhead',
    });
  }

  return segments.sort((a, b) => a.start - b.start);
}

export function computeOverheadNs(tracing: ApolloTracingData): number {
  const resolvers = tracing.execution?.resolvers ?? [];
  const ends = [
    tracing.parsing ? tracing.parsing.startOffset + tracing.parsing.duration : 0,
    tracing.validation ? tracing.validation.startOffset + tracing.validation.duration : 0,
    ...resolvers.map((r) => r.startOffset + r.duration),
  ];
  const lastEnd = ends.length ? Math.max(...ends) : 0;
  return Math.max(0, tracing.duration - lastEnd);
}

export function formatTracePath(path: Array<string | number>): string {
  return path.join(' → ');
}
