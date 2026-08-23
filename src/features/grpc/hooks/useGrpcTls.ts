import { useMemo } from 'react';
import type { GrpcTlsConfig, GrpcTlsMode } from '@shared/grpc/contracts';
import {
  prepareGrpcTarget,
  type GrpcTlsValidationIssue,
} from '@shared/grpc/grpcTlsPolicy';

export interface UseGrpcTlsResult {
  issues: GrpcTlsValidationIssue[];
  valid: boolean;
  normalizedTlsConfig: GrpcTlsConfig | undefined;
}

/** Phase 4B — TLS validation state for panels and send gates. */
export function useGrpcTls(
  tlsMode: GrpcTlsMode | undefined,
  tlsConfig: GrpcTlsConfig | undefined,
  address = 'localhost:50051',
): UseGrpcTlsResult {
  return useMemo(() => {
    const mode = tlsMode ?? 'disabled';
    const prepared = prepareGrpcTarget({ address, tlsMode: mode, tlsConfig });
    return {
      issues: prepared.issues,
      valid: prepared.issues.length === 0,
      normalizedTlsConfig: prepared.target.tlsConfig,
    };
  }, [address, tlsConfig, tlsMode]);
}
