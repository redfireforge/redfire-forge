import { useCallback, useEffect, useRef, useState } from 'react';
import type { GrpcDescriptor, GrpcServiceInfo, GrpcTlsMode } from '../../../shared/grpc/contracts';
import { validateResolvedGrpcTargetAddress } from '../../../shared/grpc/targetValidation';
import { reflectGrpcWorkflowTarget } from '../utils/grpcWorkflowReflection';

export type GrpcWorkflowReflectionStatus = 'idle' | 'loading' | 'ready' | 'error';

export function useGrpcWorkflowTargetReflection(
  target: string,
  tlsMode: GrpcTlsMode = 'disabled',
): {
  descriptor: GrpcDescriptor | null;
  services: GrpcServiceInfo[];
  status: GrpcWorkflowReflectionStatus;
  errorMessage?: string;
  reflectNow: () => Promise<void>;
} {
  const [descriptor, setDescriptor] = useState<GrpcDescriptor | null>(null);
  const [status, setStatus] = useState<GrpcWorkflowReflectionStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const reflectTokenRef = useRef(0);

  const resetReflection = useCallback(() => {
    setDescriptor(null);
    setStatus('idle');
    setErrorMessage(undefined);
  }, []);

  const reflectNow = useCallback(async () => {
    const validation = validateResolvedGrpcTargetAddress(target.trim());
    if (!validation.valid) {
      resetReflection();
      return;
    }

    const token = ++reflectTokenRef.current;
    setStatus('loading');
    setErrorMessage(undefined);

    try {
      const nextDescriptor = await reflectGrpcWorkflowTarget(target, tlsMode);
      if (token !== reflectTokenRef.current) return;
      setDescriptor(nextDescriptor);
      setStatus('ready');
    } catch (error) {
      if (token !== reflectTokenRef.current) return;
      setDescriptor(null);
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : String(error));
    }
  }, [resetReflection, target, tlsMode]);

  useEffect(() => {
    const validation = validateResolvedGrpcTargetAddress(target.trim());
    if (!validation.valid) {
      resetReflection();
      return;
    }

    const timer = window.setTimeout(() => {
      void reflectNow();
    }, 450);

    return () => window.clearTimeout(timer);
  }, [target, tlsMode, reflectNow, resetReflection]);

  return {
    descriptor,
    services: descriptor?.services ?? [],
    status,
    errorMessage,
    reflectNow,
  };
}
