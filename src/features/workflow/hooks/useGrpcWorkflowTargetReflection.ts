import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GrpcDescriptor, GrpcServiceInfo, GrpcTlsMode } from '@shared/grpc/contracts';
import { validateResolvedGrpcTargetAddress } from '@shared/grpc/targetValidation';
import { reflectGrpcWorkflowTarget } from '../utils/grpcWorkflowReflection';
import { resolveGrpcDesignTimeTarget } from '../utils/resolveGrpcDesignTimeTarget';

export type GrpcWorkflowReflectionStatus = 'idle' | 'loading' | 'ready' | 'error';

export function useGrpcWorkflowTargetReflection(
  target: string,
  tlsMode: GrpcTlsMode = 'disabled',
  workflowVariables: Record<string, string> = {},
): {
  descriptor: GrpcDescriptor | null;
  services: GrpcServiceInfo[];
  status: GrpcWorkflowReflectionStatus;
  errorMessage?: string;
  /** Target used for reflect after substituting workflow variable defaults. */
  resolvedTarget: string;
  /** True when reflection target came from substituting `{{var}}` defaults. */
  usedWorkflowDefaults: boolean;
  reflectNow: () => Promise<void>;
} {
  const [descriptor, setDescriptor] = useState<GrpcDescriptor | null>(null);
  const [status, setStatus] = useState<GrpcWorkflowReflectionStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const reflectTokenRef = useRef(0);

  const designTime = useMemo(
    () => resolveGrpcDesignTimeTarget(target, workflowVariables),
    [target, workflowVariables],
  );
  const resolvedTarget = designTime.resolved;

  const resetReflection = useCallback(() => {
    setDescriptor(null);
    setStatus('idle');
    setErrorMessage(undefined);
  }, []);

  const reflectNow = useCallback(async () => {
    const validation = validateResolvedGrpcTargetAddress(resolvedTarget.trim());
    if (!validation.valid) {
      resetReflection();
      return;
    }

    const token = ++reflectTokenRef.current;
    setStatus('loading');
    setErrorMessage(undefined);

    try {
      const nextDescriptor = await reflectGrpcWorkflowTarget(resolvedTarget, tlsMode);
      if (token !== reflectTokenRef.current) return;
      setDescriptor(nextDescriptor);
      setStatus('ready');
    } catch (error) {
      if (token !== reflectTokenRef.current) return;
      setDescriptor(null);
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : String(error));
    }
  }, [resetReflection, resolvedTarget, tlsMode]);

  useEffect(() => {
    const validation = validateResolvedGrpcTargetAddress(resolvedTarget.trim());
    if (!validation.valid) {
      resetReflection();
      return;
    }

    const timer = window.setTimeout(() => {
      void reflectNow();
    }, 450);

    return () => window.clearTimeout(timer);
  }, [resolvedTarget, tlsMode, reflectNow, resetReflection]);

  return {
    descriptor,
    services: descriptor?.services ?? [],
    status,
    errorMessage,
    resolvedTarget,
    usedWorkflowDefaults: designTime.usedWorkflowDefaults,
    reflectNow,
  };
}
