/**
 * Phase 4H — saved gRPC request contract (Phase 5 collections prep).
 *
 * Saved requests persist execution inputs only; secrets are stripped at the
 * persist boundary and rehydrated from the active tab vault at replay time.
 */
import type {
  GrpcAuthConfig,
  GrpcCallType,
  GrpcTabExecuteSnapshot,
  GrpcTlsConfig,
  GrpcTlsMode,
} from './contracts';
import { normalizeGrpcMetadata } from './contracts';
import { buildAuthMetadataHeaders, getGrpcAuthMetadataKeys } from './grpcAuthPolicy';
import {
  GRPC_REDACTED_PLACEHOLDER,
  GRPC_REDACTED_PEM_PLACEHOLDER,
  redactGrpcAuthConfig,
  redactGrpcTlsConfig,
} from './grpcRedaction';
import { isGrpcSecretMetadataKey } from './grpcSecretPolicy';
import {
  sanitizeGrpcSavedRequestForTemplatePersist,
  type GrpcInterpolationTemplateSource,
} from './grpcInterpolationPersistGuard';
import {
  buildGrpcSavedRequestTemplateSource,
  type GrpcSavedRequestTabContext,
} from './grpcReplayTemplateCompatibility';
import { containsGrpcInterpolationToken } from './grpcInterpolationGrammar';

export type { GrpcSavedRequestTabContext };

export interface GrpcResponseSnapshotBaseline {
  capturedAt: string;
  grpcStatus: number;
  statusMessage?: string;
  body: Record<string, unknown>;
}

export interface GrpcSavedRequestRunStats {
  totalRuns: number;
  successRuns: number;
  errorRuns: number;
  lastRunAt?: string;
  lastGrpcStatus?: number;
  lastDurationMs?: number;
}

export interface GrpcSavedRequest {
  id: string;
  /** Display label — defaults to `${service}/${method}` when omitted at create. */
  name: string;
  revisionId: string;
  /** Immutable first-save timestamp (ISO-8601). */
  createdAt: string;
  updatedAt: string;
  callType: GrpcCallType;
  target?: string;
  connectionId?: string;
  tlsMode?: GrpcTlsMode;
  /** Non-secret TLS fields only; PEM material lives in tab vault. */
  tlsConfig?: GrpcTlsConfig;
  service: string;
  method: string;
  descriptorKey: string;
  body: Record<string, unknown>;
  metadata: Record<string, string>;
  timeoutMs: number;
  auth?: GrpcAuthConfig;
  notes?: string;
  /** Phase 5I — optional unary response baseline for snapshot diff. */
  responseBaseline?: GrpcResponseSnapshotBaseline;
  /** Phase 5 deferred — aggregate run counters for saved request executions. */
  runStats?: GrpcSavedRequestRunStats;
}

/** Default display name when user does not provide one at save time. */
export function defaultGrpcSavedRequestName(service: string, method: string): string {
  const svc = service.trim() || 'UnknownService';
  const mtd = method.trim() || 'UnknownMethod';
  return `${svc}/${mtd}`;
}

/** Prefer tab template / profile binding over env-resolved snapshot address at save time. */
export function resolveSavedRequestTargetForPersist(
  snapshot: GrpcTabExecuteSnapshot,
  tabContext?: Pick<GrpcSavedRequestTabContext, 'connectionId' | 'rawTarget'>,
): string | undefined {
  const raw = tabContext?.rawTarget?.trim();
  const resolved = snapshot.target.address?.trim();

  if (raw && containsGrpcInterpolationToken(raw)) {
    return raw;
  }
  if (tabContext?.connectionId?.trim() && !raw) {
    return undefined;
  }
  if (raw) {
    return raw;
  }
  return resolved || undefined;
}

export function isGrpcRedactedPersistValue(value: string | undefined): boolean {
  const trimmed = value?.trim();
  return trimmed === GRPC_REDACTED_PLACEHOLDER
    || trimmed === GRPC_REDACTED_PEM_PLACEHOLDER
    || trimmed === '[REDACTED]'
    || trimmed === '[REDACTED_PEM]';
}

/** Strip secret metadata/auth fields but preserve literal non-secret metadata for replay. */
export function redactGrpcSavedRequestMetadataForPersist(
  metadata: Record<string, string> | undefined,
  auth?: GrpcAuthConfig,
): Record<string, string> {
  if (!metadata) return {};
  const authHeaderKeys = new Set<string>(getGrpcAuthMetadataKeys(auth));
  const authResult = buildAuthMetadataHeaders(auth);
  if (authResult.ok) {
    for (const key of Object.keys(authResult.metadata)) {
      authHeaderKeys.add(key);
    }
  }
  const redacted: Record<string, string> = {};
  for (const [key, value] of Object.entries(normalizeGrpcMetadata(metadata))) {
    if (authHeaderKeys.has(key) || isGrpcSecretMetadataKey(key)) {
      redacted[key] = GRPC_REDACTED_PLACEHOLDER;
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

/** Strip secret material before writing to collections/history/export bundles. */
export function redactGrpcSavedRequestForPersist(
  saved: GrpcSavedRequest,
  templateSource?: GrpcInterpolationTemplateSource,
): GrpcSavedRequest {
  const templated = sanitizeGrpcSavedRequestForTemplatePersist(saved, templateSource);
  return {
    ...templated,
    tlsConfig: redactGrpcTlsConfig(templated.tlsConfig),
    auth: redactGrpcAuthConfig(templated.auth),
    metadata: redactGrpcSavedRequestMetadataForPersist(templated.metadata, templated.auth),
    body: structuredClone(templated.body),
  };
}

export function createGrpcSavedRequestFromSnapshot(
  snapshot: GrpcTabExecuteSnapshot,
  identity: { id: string; revisionId: string; createdAt?: string; updatedAt: string; name?: string },
  tabContext?: GrpcSavedRequestTabContext,
): GrpcSavedRequest {
  const templateSource = buildGrpcSavedRequestTemplateSource(tabContext);
  const draft: GrpcSavedRequest = {
    id: identity.id,
    name: identity.name?.trim() || defaultGrpcSavedRequestName(snapshot.service, snapshot.method),
    revisionId: identity.revisionId,
    createdAt: identity.createdAt ?? identity.updatedAt,
    updatedAt: identity.updatedAt,
    callType: snapshot.callType,
    connectionId: tabContext?.connectionId,
    target: resolveSavedRequestTargetForPersist(snapshot, tabContext),
    tlsMode: snapshot.target.tlsMode,
    tlsConfig: snapshot.target.tlsConfig,
    service: snapshot.service,
    method: snapshot.method,
    descriptorKey: snapshot.descriptorKey,
    body: structuredClone(snapshot.body),
    metadata: { ...(snapshot.metadata ?? {}) },
    timeoutMs: snapshot.timeoutMs,
    auth: snapshot.auth ? structuredClone(snapshot.auth) : undefined,
  };
  return redactGrpcSavedRequestForPersist(draft, templateSource);
}

/** True when persisted saved auth cannot execute without tab vault material. */
function savedAuthNeedsTabVaultSecrets(savedAuth: GrpcAuthConfig): boolean {
  switch (savedAuth.type) {
    case 'bearer':
      return isGrpcRedactedPersistValue(savedAuth.bearerToken) || !savedAuth.bearerToken?.trim();
    case 'basic':
      return isGrpcRedactedPersistValue(savedAuth.basicPassword) || !savedAuth.basicPassword?.trim();
    case 'api_key':
      return isGrpcRedactedPersistValue(savedAuth.apiKeyValue) || !savedAuth.apiKeyValue?.trim();
    case 'oauth2': {
      const oauth = savedAuth.oauth2;
      if (!oauth) return true;
      return isGrpcRedactedPersistValue(oauth.clientSecret) || !oauth.clientSecret?.trim();
    }
    default:
      return false;
  }
}

/** Tab vault PEM always wins at replay; saved PEM only when tab has none (Phase 4H). */
function resolveTlsPemForReplay(
  savedPem: string | undefined,
  tabPem: string | undefined,
): string | undefined {
  if (tabPem?.trim()) return tabPem;
  if (savedPem?.trim() && !isGrpcRedactedPersistValue(savedPem)) return savedPem;
  return undefined;
}

/**
 * Merge saved auth shape with tab runtime secrets for replay.
 * Saved non-secret fields win; secrets come from tab when types match.
 */
export function mergeAuthForReplay(
  savedAuth: GrpcAuthConfig | undefined,
  tabAuth: GrpcAuthConfig | undefined,
): GrpcAuthConfig | undefined {
  if (!savedAuth || savedAuth.type === 'none') {
    return tabAuth?.type === 'none' ? { type: 'none' } : tabAuth;
  }
  if (!tabAuth || tabAuth.type !== savedAuth.type) {
    if (tabAuth && tabAuth.type !== 'none' && savedAuthNeedsTabVaultSecrets(savedAuth)) {
      return tabAuth;
    }
    return savedAuth;
  }

  switch (savedAuth.type) {
    case 'bearer': {
      const token = isGrpcRedactedPersistValue(savedAuth.bearerToken)
        ? tabAuth.bearerToken
        : (savedAuth.bearerToken ?? tabAuth.bearerToken);
      return { type: 'bearer', bearerToken: token };
    }
    case 'basic': {
      const password = isGrpcRedactedPersistValue(savedAuth.basicPassword)
        ? tabAuth.basicPassword
        : (savedAuth.basicPassword ?? tabAuth.basicPassword);
      return {
        type: 'basic',
        basicUsername: savedAuth.basicUsername ?? tabAuth.basicUsername,
        basicPassword: password,
      };
    }
    case 'api_key': {
      const value = isGrpcRedactedPersistValue(savedAuth.apiKeyValue)
        ? tabAuth.apiKeyValue
        : (savedAuth.apiKeyValue ?? tabAuth.apiKeyValue);
      return {
        type: 'api_key',
        apiKeyName: savedAuth.apiKeyName ?? tabAuth.apiKeyName,
        apiKeyValue: value,
      };
    }
    case 'oauth2': {
      const savedOauth = savedAuth.oauth2;
      const tabOauth = tabAuth.oauth2;
      if (!savedOauth) return savedAuth;
      const clientSecret = isGrpcRedactedPersistValue(savedOauth.clientSecret)
        ? (tabOauth?.clientSecret ?? '')
        : (savedOauth.clientSecret || tabOauth?.clientSecret || '');
      return {
        type: 'oauth2',
        oauth2: {
          tokenUrl: savedOauth.tokenUrl ?? tabOauth?.tokenUrl ?? '',
          clientId: savedOauth.clientId ?? tabOauth?.clientId ?? '',
          clientSecret,
          scope: savedOauth.scope ?? tabOauth?.scope,
        },
      };
    }
    default:
      return savedAuth;
  }
}

/** Tab runtime wins over saved when the tab sets serverNameOverride (Phase 4H replay rule). */
function resolveServerNameOverrideForReplay(
  savedTls: GrpcTlsConfig | undefined,
  tabTls: GrpcTlsConfig | undefined,
): string | undefined {
  const tabOverride = tabTls?.serverNameOverride?.trim();
  if (tabOverride) return tabOverride;
  return savedTls?.serverNameOverride?.trim() || undefined;
}

/** Merge saved TLS non-secret fields with tab vault PEM at replay. */
export function mergeTlsConfigForReplay(
  savedTls: GrpcTlsConfig | undefined,
  tabTls: GrpcTlsConfig | undefined,
): GrpcTlsConfig | undefined {
  const serverNameOverride = resolveServerNameOverrideForReplay(savedTls, tabTls);
  const serverCaPem = resolveTlsPemForReplay(savedTls?.serverCaPem, tabTls?.serverCaPem);
  const clientCertPem = resolveTlsPemForReplay(savedTls?.clientCertPem, tabTls?.clientCertPem);
  const clientKeyPem = resolveTlsPemForReplay(savedTls?.clientKeyPem, tabTls?.clientKeyPem);

  if (!serverCaPem && !clientCertPem && !clientKeyPem && !serverNameOverride) {
    return undefined;
  }

  return {
    serverCaPem,
    clientCertPem,
    clientKeyPem,
    serverNameOverride,
  };
}
