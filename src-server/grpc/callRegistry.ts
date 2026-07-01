export type GrpcCallRegistryStatus = 'active' | 'completed' | 'cancelled';

export interface GrpcCallRegistryEntry {
  requestId: string;
  tabId?: string;
  abortController: AbortController;
  status: GrpcCallRegistryStatus;
  startedAt: number;
}

const registry = new Map<string, GrpcCallRegistryEntry>();

export function tryRegisterGrpcCall(
  requestId: string,
  tabId?: string,
): { ok: true; signal: AbortSignal } | { ok: false; reason: 'duplicate_active' } {
  const existing = registry.get(requestId);
  if (existing?.status === 'active') {
    return { ok: false, reason: 'duplicate_active' };
  }
  if (existing) {
    registry.delete(requestId);
  }

  const abortController = new AbortController();
  registry.set(requestId, {
    requestId,
    tabId,
    abortController,
    status: 'active',
    startedAt: Date.now(),
  });
  return { ok: true, signal: abortController.signal };
}

/** @deprecated Prefer tryRegisterGrpcCall — kept for tests that need unconditional registration. */
export function registerGrpcCall(
  requestId: string,
  tabId?: string,
): { abortController: AbortController; signal: AbortSignal } {
  const result = tryRegisterGrpcCall(requestId, tabId);
  if (!result.ok) {
    throw new Error(`requestId ${requestId} is already in use`);
  }
  const entry = registry.get(requestId)!;
  return { abortController: entry.abortController, signal: result.signal };
}

export function getGrpcCallEntry(requestId: string): GrpcCallRegistryEntry | undefined {
  return registry.get(requestId);
}

export function markGrpcCallCompleted(requestId: string): void {
  const entry = registry.get(requestId);
  if (!entry || entry.status !== 'active') return;
  entry.status = 'completed';
}

export function markGrpcCallCancelled(requestId: string): void {
  const entry = registry.get(requestId);
  if (!entry || entry.status !== 'active') return;
  entry.status = 'cancelled';
}

export function cancelGrpcCall(requestId: string, tabId?: string): 'cancelled' | 'not_found' | 'already_completed' | 'tab_mismatch' {
  const entry = registry.get(requestId);
  if (!entry) return 'not_found';
  if (entry.tabId && tabId !== entry.tabId) return 'tab_mismatch';
  if (entry.status !== 'active') {
    registry.delete(requestId);
    return 'already_completed';
  }
  entry.status = 'cancelled';
  entry.abortController.abort();
  return 'cancelled';
}

export function removeGrpcCallEntry(requestId: string): void {
  registry.delete(requestId);
}

export function clearGrpcCallRegistry(): void {
  registry.clear();
}
