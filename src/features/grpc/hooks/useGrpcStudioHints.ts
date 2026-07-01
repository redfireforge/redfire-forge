/**
 * Phase 4G — dismissible Studio hint persistence.
 */
import { useCallback, useState } from 'react';
import {
  persistDismissedGrpcStudioHints,
  readDismissedGrpcStudioHints,
  type GrpcStudioHintId,
} from '../utils/grpcSpringHints';

export interface UseGrpcStudioHintsResult {
  isDismissed: (id: GrpcStudioHintId) => boolean;
  dismiss: (id: GrpcStudioHintId) => void;
}

export function useGrpcStudioHints(): UseGrpcStudioHintsResult {
  const [dismissed, setDismissed] = useState<Set<GrpcStudioHintId>>(() => readDismissedGrpcStudioHints());

  const dismiss = useCallback((id: GrpcStudioHintId) => {
    setDismissed((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      persistDismissedGrpcStudioHints(next);
      return next;
    });
  }, []);

  const isDismissed = useCallback(
    (id: GrpcStudioHintId) => dismissed.has(id),
    [dismissed],
  );

  return { isDismissed, dismiss };
}

export function resetGrpcStudioHintsForTests(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem('grpc_studio_hints_dismissed_v1');
}
