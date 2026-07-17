import type { GrpcTlsMode } from '../../../shared/grpc/contracts';
import { normalizeGrpcTlsConfig } from '../../../shared/grpc/grpcTlsPolicy';
import type { GrpcStudioTabState } from '../grpcStudioTypes';
import { withoutTlsMaskFields } from './grpcSecretFieldUi';
import type { GrpcTabConnectionResolution } from './resolveGrpcTabConnection';

export interface GrpcTlsTabPatchContext {
  tab: GrpcStudioTabState;
  activeConnection: GrpcTabConnectionResolution;
}

export function buildGrpcTlsModeTabPatch(
  { tab }: GrpcTlsTabPatchContext,
  mode: GrpcTlsMode,
): Partial<GrpcStudioTabState> {
  return {
    tlsMode: mode,
    ...(mode === 'disabled'
      ? {
          tlsConfig: undefined,
          maskedSecretFields: withoutTlsMaskFields(tab.maskedSecretFields),
        }
      : {}),
  };
}

export function buildGrpcTlsConfigTabPatch(
  { tab, activeConnection }: GrpcTlsTabPatchContext,
  patch: NonNullable<GrpcStudioTabState['tlsConfig']>,
): Partial<GrpcStudioTabState> {
  const mode = tab.tlsMode ?? activeConnection.tlsMode;
  return {
    tlsConfig: normalizeGrpcTlsConfig(
      { ...tab.tlsConfig, ...patch },
      mode,
    ),
  };
}

export function buildGrpcTlsStateRestoreTabPatch(
  tab: GrpcStudioTabState,
  restore: { tlsMode: GrpcTlsMode; tlsConfig?: GrpcStudioTabState['tlsConfig'] },
): Partial<GrpcStudioTabState> {
  return {
    tlsMode: restore.tlsMode,
    tlsConfig: restore.tlsConfig,
    ...(restore.tlsMode === 'disabled'
      ? { maskedSecretFields: withoutTlsMaskFields(tab.maskedSecretFields) }
      : {}),
  };
}
