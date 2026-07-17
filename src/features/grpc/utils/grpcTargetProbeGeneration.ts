/**
 * gRPC Studio — in-flight target probe generation tokens (Phase 1).
 * Prevents stale probe results from updating UI after cancel or connection edits.
 */
const targetProbeGenerationRef: Record<string, number> = {};

export function resetGrpcTargetProbeGenerationForTests(): void {
  for (const tabId of Object.keys(targetProbeGenerationRef)) {
    delete targetProbeGenerationRef[tabId];
  }
}

export function bumpGrpcTargetProbeGeneration(tabId: string): number {
  const next = (targetProbeGenerationRef[tabId] ?? 0) + 1;
  targetProbeGenerationRef[tabId] = next;
  return next;
}

export function isGrpcTargetProbeGenerationCurrent(tabId: string, generation: number): boolean {
  return targetProbeGenerationRef[tabId] === generation;
}
