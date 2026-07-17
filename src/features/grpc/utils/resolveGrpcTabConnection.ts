/**
 * Phase 1A — per-tab gRPC connection resolution (tab → profile → page default).
 */
import type { GrpcTarget, GrpcTlsConfig, GrpcTlsMode } from '../../../shared/grpc/contracts';
import { prepareGrpcTarget } from '../../../shared/grpc/grpcTlsPolicy';
import { validateResolvedGrpcTargetAddress } from '../../../shared/grpc/targetValidation';

export interface GrpcConnectionProfile {
  id: string;
  name: string;
  target: string;
  tlsMode: GrpcTlsMode;
  /** Phase 9C — optional profile-scoped env vars (override active env). */
  variables?: Record<string, string>;
}

export interface GrpcTabConnectionPageDefaults {
  target: string;
  tlsMode: GrpcTlsMode;
}

export interface GrpcTabConnectionResolution {
  /** Raw target before env {{var}} substitution. */
  target: string;
  tlsMode: GrpcTlsMode;
  connectionProfileId?: string;
  profileName?: string;
  targetValidation: ReturnType<typeof validateResolvedGrpcTargetAddress>;
}

function findProfile(
  profiles: ReadonlyArray<GrpcConnectionProfile>,
  connectionId: string | undefined,
): GrpcConnectionProfile | undefined {
  if (!connectionId) return undefined;
  return profiles.find((profile) => profile.id === connectionId);
}

export function resolveGrpcTabConnection(
  tab: { target?: string; connectionId?: string; tlsMode?: GrpcTlsMode },
  profiles: ReadonlyArray<GrpcConnectionProfile>,
  pageDefaults: GrpcTabConnectionPageDefaults,
): GrpcTabConnectionResolution {
  const profile = findProfile(profiles, tab.connectionId);

  let target = pageDefaults.target;
  let tlsMode = pageDefaults.tlsMode;

  if (profile) {
    if (profile.target.trim()) target = profile.target.trim();
    tlsMode = profile.tlsMode;
  }

  if (tab.target?.trim()) {
    target = tab.target.trim();
  }

  if (tab.tlsMode) {
    tlsMode = tab.tlsMode;
  }

  return {
    target,
    tlsMode,
    connectionProfileId: profile?.id,
    profileName: profile?.name,
    targetValidation: validateResolvedGrpcTargetAddress(target),
  };
}

export function resolveGrpcTabTarget(
  tab: { target?: string; connectionId?: string },
  profiles: ReadonlyArray<GrpcConnectionProfile>,
  pageDefaultTarget: string,
): string {
  if (tab.target?.trim()) return tab.target.trim();
  const profile = findProfile(profiles, tab.connectionId);
  if (profile?.target.trim()) return profile.target.trim();
  return pageDefaultTarget;
}

/** Build a GrpcTarget from resolved tab connection (uses normalized address when valid). */
export function resolutionToGrpcTarget(
  resolution: GrpcTabConnectionResolution,
  tlsConfig?: GrpcTlsConfig,
): GrpcTarget {
  const address = resolution.targetValidation.valid
    ? resolution.targetValidation.normalized
    : resolution.target;
  return prepareGrpcTarget({
    address,
    tlsMode: resolution.tlsMode,
    tlsConfig,
  }).target;
}

export function canConnectFromResolution(resolution: GrpcTabConnectionResolution): boolean {
  return resolution.targetValidation.valid;
}
