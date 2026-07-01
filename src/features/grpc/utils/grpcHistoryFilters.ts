/**
 * Phase 5D — structured call history filter helpers.
 */
import type { GrpcCallType } from '../../../shared/grpc/contracts';
import type { GrpcCallHistoryEntryV1 } from '../../../shared/grpc/grpcPersistenceSchema';

export interface GrpcCallHistoryFilters {
  service?: string;
  method?: string;
  callType?: GrpcCallType;
  grpcStatus?: number;
  /** Mockup 05 — coarse outcome filter (OK vs errors). */
  outcome?: 'ok' | 'error';
  capturedAfter?: string;
  capturedBefore?: string;
  /** Case-insensitive match on target, service, method. */
  text?: string;
}

function isGrpcHistoryEntryOk(entry: GrpcCallHistoryEntryV1): boolean {
  if (entry.record.error) return false;
  if (typeof entry.grpcStatus === 'number') return entry.grpcStatus === 0;
  return true;
}

function matchesText(entry: GrpcCallHistoryEntryV1, text: string): boolean {
  const needle = text.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [
    entry.target,
    entry.service,
    entry.method,
    entry.descriptorKey,
  ].join(' ').toLowerCase();
  return haystack.includes(needle);
}

export function filterGrpcCallHistoryEntries(
  entries: GrpcCallHistoryEntryV1[],
  filters: GrpcCallHistoryFilters,
): GrpcCallHistoryEntryV1[] {
  return entries.filter((entry) => {
    if (filters.service && entry.service !== filters.service) return false;
    if (filters.method && entry.method !== filters.method) return false;
    if (filters.callType && entry.callType !== filters.callType) return false;
    if (filters.grpcStatus !== undefined && entry.grpcStatus !== filters.grpcStatus) return false;
    if (filters.outcome === 'ok' && !isGrpcHistoryEntryOk(entry)) return false;
    if (filters.outcome === 'error' && isGrpcHistoryEntryOk(entry)) return false;
    if (filters.capturedAfter && entry.capturedAt < filters.capturedAfter) return false;
    if (filters.capturedBefore && entry.capturedAt > filters.capturedBefore) return false;
    if (filters.text && !matchesText(entry, filters.text)) return false;
    return true;
  });
}

export function collectGrpcCallHistoryFilterOptions(entries: GrpcCallHistoryEntryV1[]): {
  services: string[];
  methods: string[];
  grpcStatuses: number[];
  hasOkEntries: boolean;
  hasErrorEntries: boolean;
} {
  const services = new Set<string>();
  const methods = new Set<string>();
  const grpcStatuses = new Set<number>();
  let hasOkEntries = false;
  let hasErrorEntries = false;

  for (const entry of entries) {
    services.add(entry.service);
    methods.add(entry.method);
    if (typeof entry.grpcStatus === 'number') grpcStatuses.add(entry.grpcStatus);
    if (isGrpcHistoryEntryOk(entry)) hasOkEntries = true;
    else hasErrorEntries = true;
  }

  return {
    services: Array.from(services).sort(),
    methods: Array.from(methods).sort(),
    grpcStatuses: Array.from(grpcStatuses).sort((a, b) => a - b),
    hasOkEntries,
    hasErrorEntries,
  };
}
