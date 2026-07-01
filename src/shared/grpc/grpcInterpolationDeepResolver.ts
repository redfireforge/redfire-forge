/**
 * Phase 9B — deep JSON/metadata/auth interpolation using a shared template resolver.
 */
import type { GrpcAuthConfig } from './contracts';
import {
  hasUnresolvedGrpcInterpolationTokens,
  inspectGrpcInterpolationTemplate,
} from './grpcInterpolationGrammar';
import type { GrpcInterpolationTemplateResolver } from './grpcInterpolationResolver';

export type { GrpcInterpolationTemplateResolver };

/** Reject leftover tokens or invalid syntax in a resolved string leaf. */
export function assertGrpcInterpolationTemplatesResolved(
  label: string,
  value: string,
): void {
  const inspected = inspectGrpcInterpolationTemplate(value);
  if (!inspected.ok) {
    throw new Error(`${label}: ${inspected.error.message}`);
  }
  if (hasUnresolvedGrpcInterpolationTokens(value)) {
    throw new Error(`${label} contains unresolved template variables: ${value}`);
  }
}

/** Walk JSON-like values and reject leftover tokens in string leaves and object keys. */
export function assertGrpcInterpolationJsonTemplatesResolved(
  value: unknown,
  label = 'gRPC body',
): void {
  if (typeof value === 'string') {
    assertGrpcInterpolationTemplatesResolved(label, value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      assertGrpcInterpolationJsonTemplatesResolved(entry, `${label}[${index}]`);
    });
    return;
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) {
      assertGrpcInterpolationTemplatesResolved(`${label} key`, key);
      assertGrpcInterpolationJsonTemplatesResolved(entry, `${label}.${key}`);
    }
  }
}

export function assertGrpcInterpolationMetadataNormalizeUnique(
  metadata: Record<string, string>,
): void {
  const seen = new Map<string, string>();
  for (const key of Object.keys(metadata)) {
    const normalizedKey = key.trim().toLowerCase();
    if (!normalizedKey) {
      throw new Error('gRPC metadata key is required');
    }
    if (seen.has(normalizedKey)) {
      throw new Error(
        `gRPC metadata key collision after normalization: ${normalizedKey}`,
      );
    }
    seen.set(normalizedKey, key);
  }
}

export function assertGrpcInterpolationAuthTemplatesResolved(
  auth: GrpcAuthConfig | undefined,
): void {
  if (!auth || auth.type === 'none') return;
  if (auth.bearerToken !== undefined) {
    assertGrpcInterpolationTemplatesResolved('Bearer token', auth.bearerToken);
  }
  if (auth.basicUsername !== undefined) {
    assertGrpcInterpolationTemplatesResolved('Basic auth username', auth.basicUsername);
  }
  if (auth.basicPassword !== undefined) {
    assertGrpcInterpolationTemplatesResolved('Basic auth password', auth.basicPassword);
  }
  if (auth.apiKeyName !== undefined) {
    assertGrpcInterpolationTemplatesResolved('API key name', auth.apiKeyName);
  }
  if (auth.apiKeyValue !== undefined) {
    assertGrpcInterpolationTemplatesResolved('API key value', auth.apiKeyValue);
  }
  if (auth.oauth2) {
    assertGrpcInterpolationTemplatesResolved('OAuth2 token URL', auth.oauth2.tokenUrl);
    assertGrpcInterpolationTemplatesResolved('OAuth2 client ID', auth.oauth2.clientId);
    assertGrpcInterpolationTemplatesResolved('OAuth2 client secret', auth.oauth2.clientSecret);
    if (auth.oauth2.scope !== undefined) {
      assertGrpcInterpolationTemplatesResolved('OAuth2 scope', auth.oauth2.scope);
    }
  }
}

/** Deep-interpolate string leaves in JSON-like values. */
export function resolveGrpcInterpolationJsonValue(
  value: unknown,
  resolveTemplate: GrpcInterpolationTemplateResolver,
): unknown {
  if (typeof value === 'string') {
    return resolveTemplate(value);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => resolveGrpcInterpolationJsonValue(entry, resolveTemplate));
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      const resolvedKey = resolveTemplate(key);
      if (Object.prototype.hasOwnProperty.call(out, resolvedKey)) {
        throw new Error(`gRPC body key collision after template resolution: ${resolvedKey}`);
      }
      out[resolvedKey] = resolveGrpcInterpolationJsonValue(entry, resolveTemplate);
    }
    return out;
  }
  return value;
}

export function resolveGrpcInterpolationMetadata(
  metadata: Record<string, string> | undefined,
  resolveTemplate: GrpcInterpolationTemplateResolver,
): Record<string, string> {
  if (!metadata) return {};
  const resolved: Record<string, string> = {};
  for (const [key, value] of Object.entries(metadata)) {
    const resolvedKey = resolveTemplate(key);
    if (Object.prototype.hasOwnProperty.call(resolved, resolvedKey)) {
      throw new Error(`gRPC metadata key collision after template resolution: ${resolvedKey}`);
    }
    resolved[resolvedKey] = resolveTemplate(value);
  }
  return resolved;
}

export function resolveGrpcInterpolationAuthConfig(
  auth: GrpcAuthConfig | undefined,
  resolveTemplate: GrpcInterpolationTemplateResolver,
): GrpcAuthConfig | undefined {
  if (!auth || auth.type === 'none') return auth;
  const resolved = structuredClone(auth);
  if (resolved.bearerToken !== undefined) {
    resolved.bearerToken = resolveTemplate(resolved.bearerToken);
  }
  if (resolved.basicUsername !== undefined) {
    resolved.basicUsername = resolveTemplate(resolved.basicUsername);
  }
  if (resolved.basicPassword !== undefined) {
    resolved.basicPassword = resolveTemplate(resolved.basicPassword);
  }
  if (resolved.apiKeyName !== undefined) {
    resolved.apiKeyName = resolveTemplate(resolved.apiKeyName);
  }
  if (resolved.apiKeyValue !== undefined) {
    resolved.apiKeyValue = resolveTemplate(resolved.apiKeyValue);
  }
  if (resolved.oauth2) {
    resolved.oauth2 = {
      ...resolved.oauth2,
      tokenUrl: resolveTemplate(resolved.oauth2.tokenUrl),
      clientId: resolveTemplate(resolved.oauth2.clientId),
      clientSecret: resolveTemplate(resolved.oauth2.clientSecret),
      scope: resolved.oauth2.scope ? resolveTemplate(resolved.oauth2.scope) : undefined,
    };
  }
  return resolved;
}
