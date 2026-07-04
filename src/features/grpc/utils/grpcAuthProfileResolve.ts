import type { GrpcAuthConfig } from '../../../shared/grpc/contracts';
import { GRPC_ERROR_CODES } from '../../../shared/grpc/contracts';
import type { GrpcAuthPreviewResult } from './grpcAuthPreview';
import { previewGrpcAuthMerge } from './grpcAuthPreview';
import type { AuthConfig, GlobalAuthProfile } from '../../../shared/types';

interface ResolvedGrpcAuthResult {
  auth: GrpcAuthConfig | undefined;
  profileName: string | null;
  issue?: string;
}

function authConfigToGrpcAuth(config: AuthConfig): GrpcAuthConfig | undefined {
  switch (config.type) {
    case 'none':
      return undefined;
    case 'bearer': {
      const prefix = config.prefix?.trim();
      if (prefix && prefix.toLowerCase() !== 'bearer') {
        return undefined;
      }
      return { type: 'bearer', bearerToken: config.token };
    }
    case 'basic':
      return {
        type: 'basic',
        basicUsername: config.username,
        basicPassword: config.password,
      };
    case 'apikey':
      if ((config.apiKeyIn ?? 'header') !== 'header') {
        return undefined;
      }
      return {
        type: 'api_key',
        apiKeyName: config.apiKeyName,
        apiKeyValue: config.apiKeyValue,
      };
    case 'oauth2':
      return {
        type: 'oauth2',
        oauth2: {
          tokenUrl: config.tokenUrl ?? '',
          clientId: config.clientId ?? '',
          clientSecret: config.clientSecret ?? '',
        },
      };
    case 'inherit':
    case 'digest':
    default:
      return undefined;
  }
}

function resolveProfileAuth(
  profileId: string,
  profiles: GlobalAuthProfile[],
  seen: Set<string>,
): ResolvedGrpcAuthResult {
  if (seen.has(profileId)) {
    return {
      auth: undefined,
      profileName: null,
      issue: 'Auth profile inheritance loop detected.',
    };
  }
  const profile = profiles.find((entry) => entry.id === profileId);
  if (!profile) {
    return {
      auth: undefined,
      profileName: null,
      issue: 'Selected auth profile was not found.',
    };
  }

  seen.add(profileId);
  const mapped = authConfigToGrpcAuth(profile.auth);
  if (mapped) {
    return { auth: mapped, profileName: profile.name };
  }

  if (profile.auth.type === 'none') {
    return { auth: undefined, profileName: profile.name };
  }

  if (profile.auth.type === 'inherit') {
    const inheritedId = profile.auth.globalProfileId?.trim();
    if (!inheritedId) {
      return {
        auth: undefined,
        profileName: profile.name,
        issue: `Auth profile "${profile.name}" does not point to another profile.`,
      };
    }
    return resolveProfileAuth(inheritedId, profiles, seen);
  }

  return {
    auth: undefined,
    profileName: profile.name,
    issue: `Auth profile "${profile.name}" uses an auth mode not supported by gRPC Studio.`,
  };
}

export function getGrpcCompatibleGlobalAuthProfiles(
  profiles: GlobalAuthProfile[],
): GlobalAuthProfile[] {
  return profiles.filter((profile) => {
    if (profile.auth.type === 'none' || profile.auth.type === 'inherit') {
      return true;
    }
    return !!authConfigToGrpcAuth(profile.auth);
  });
}

export function resolveEffectiveGrpcAuth(
  auth: GrpcAuthConfig | undefined,
  profiles: GlobalAuthProfile[] = [],
  defaultAuthProfileId: string | null = null,
): ResolvedGrpcAuthResult {
  if (!auth || auth.type === 'none') {
    return { auth, profileName: null };
  }
  if (auth.type !== 'inherit') {
    return { auth, profileName: null };
  }

  const profileId = auth.globalProfileId?.trim() || defaultAuthProfileId?.trim() || '';
  if (!profileId) {
    return {
      auth: undefined,
      profileName: null,
      issue: 'Select an auth profile to inherit credentials.',
    };
  }

  return resolveProfileAuth(profileId, profiles, new Set());
}

export function buildGrpcAuthPreviewWithProfiles(
  manualMetadata: Record<string, string>,
  auth: GrpcAuthConfig | undefined,
  profiles: GlobalAuthProfile[] = [],
  defaultAuthProfileId: string | null = null,
): { preview: GrpcAuthPreviewResult; resolvedAuth: GrpcAuthConfig | undefined; profileName: string | null } {
  const resolved = resolveEffectiveGrpcAuth(auth, profiles, defaultAuthProfileId);
  if (resolved.issue) {
    return {
      resolvedAuth: resolved.auth,
      profileName: resolved.profileName,
      preview: {
        ok: false,
        issues: [{
          field: 'auth.globalProfileId',
          code: GRPC_ERROR_CODES.INVALID_REQUEST,
          message: resolved.issue,
        }],
        conflicts: [],
        previewEntries: [],
      },
    };
  }

  return {
    resolvedAuth: resolved.auth,
    profileName: resolved.profileName,
    preview: previewGrpcAuthMerge(manualMetadata, resolved.auth),
  };
}
