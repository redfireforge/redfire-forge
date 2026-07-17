/**
 * Phase 9F — template-only persistence guards for gRPC interpolation fields.
 */
import type { GrpcAuthConfig } from './contracts';
import {
  GRPC_INTERPOLATION_ERROR_CODES,
  type GrpcInterpolationValidationIssue,
} from './grpcInterpolationConstants';
import { containsGrpcInterpolationToken } from './grpcInterpolationGrammar';
import { GrpcInterpolationError } from './grpcInterpolationError';
import { createGrpcInterpolationTemplateResolver } from './grpcInterpolationResolver';
import type { GrpcSavedRequest } from './grpcSavedRequest';
import type { GrpcHarnessCallActionConfig } from '../types/grpc-harness';

export interface GrpcInterpolationTemplateSource {
  target?: string;
  body?: Record<string, unknown>;
  metadata?: Record<string, string>;
  auth?: GrpcAuthConfig;
  connectionId?: string;
  /** Merged env at persist boundary — used to detect resolved literal leaks. */
  interpolationEnv?: Readonly<Record<string, string>>;
}

export interface GrpcInterpolationPersistViolation {
  path: string;
  code: typeof GRPC_INTERPOLATION_ERROR_CODES.SERIALIZATION;
  message: string;
}

/** True when the string contains an unescaped Phase 9A interpolation token. */
export function hasGrpcInterpolationTemplateReference(value: string): boolean {
  return containsGrpcInterpolationToken(value);
}

/**
 * Prefer tab/scenario template source over execute snapshot values.
 * When source is an explicit literal (no tokens), it wins over snapshot templates.
 */
export function resolveGrpcPersistStringField(
  templateSource: string | undefined,
  snapshotValue: string | undefined,
): string | undefined {
  if (templateSource !== undefined) {
    const rawTemplate = templateSource.trim();
    if (rawTemplate && hasGrpcInterpolationTemplateReference(rawTemplate)) {
      return rawTemplate;
    }
    if (rawTemplate) {
      return rawTemplate;
    }
    return undefined;
  }
  const snapshot = snapshotValue?.trim();
  return snapshot || undefined;
}

function detectResolvedStringLeak(
  path: string,
  templateSource: string | undefined,
  persistedValue: string | undefined,
  env?: Readonly<Record<string, string>>,
): GrpcInterpolationPersistViolation | undefined {
  const template = templateSource?.trim();
  const persisted = persistedValue?.trim();
  if (!template || !persisted) return undefined;
  if (!hasGrpcInterpolationTemplateReference(template)) return undefined;
  if (hasGrpcInterpolationTemplateReference(persisted)) return undefined;

  if (env) {
    const resolver = createGrpcInterpolationTemplateResolver(env);
    const resolvedTemplate = resolver(template);
    if (resolvedTemplate === persisted) {
      return {
        path,
        code: GRPC_INTERPOLATION_ERROR_CODES.SERIALIZATION,
        message: `Persisted ${path} must keep template form (${template}), not resolved literal (${persisted}).`,
      };
    }
    // Env present but persisted differs from env resolution — intentional literal override.
    return undefined;
  }

  return {
    path,
    code: GRPC_INTERPOLATION_ERROR_CODES.SERIALIZATION,
    message: `Persisted ${path} lost interpolation template tokens from source (${template}).`,
  };
}

function collectJsonTemplateViolations(
  templateNode: unknown,
  persistedNode: unknown,
  path: string,
  env: Readonly<Record<string, string>> | undefined,
  violations: GrpcInterpolationPersistViolation[],
): void {
  if (typeof templateNode === 'string' && typeof persistedNode === 'string') {
    const violation = detectResolvedStringLeak(path, templateNode, persistedNode, env);
    if (violation) violations.push(violation);
    return;
  }
  if (Array.isArray(templateNode) && Array.isArray(persistedNode)) {
    const length = Math.max(templateNode.length, persistedNode.length);
    for (let index = 0; index < length; index += 1) {
      collectJsonTemplateViolations(
        templateNode[index],
        persistedNode[index],
        `${path}[${index}]`,
        env,
        violations,
      );
    }
    return;
  }
  if (
    templateNode
    && persistedNode
    && typeof templateNode === 'object'
    && typeof persistedNode === 'object'
    && !Array.isArray(templateNode)
    && !Array.isArray(persistedNode)
  ) {
    const templateRecord = templateNode as Record<string, unknown>;
    const persistedRecord = persistedNode as Record<string, unknown>;
    for (const key of new Set([...Object.keys(templateRecord), ...Object.keys(persistedRecord)])) {
      collectJsonTemplateViolations(
        templateRecord[key],
        persistedRecord[key],
        `${path}.${key}`,
        env,
        violations,
      );
    }
  }
}

function collectAuthTemplateViolations(
  templateAuth: GrpcAuthConfig | undefined,
  persistedAuth: GrpcAuthConfig | undefined,
  env: Readonly<Record<string, string>> | undefined,
  violations: GrpcInterpolationPersistViolation[],
): void {
  if (!templateAuth || !persistedAuth || templateAuth.type !== persistedAuth.type) return;

  switch (templateAuth.type) {
    case 'bearer': {
      const violation = detectResolvedStringLeak(
        'auth.bearerToken',
        templateAuth.bearerToken,
        persistedAuth.bearerToken,
        env,
      );
      if (violation) violations.push(violation);
      break;
    }
    case 'basic':
      for (const [field, templateValue, persistedValue] of [
        ['auth.basicUsername', templateAuth.basicUsername, persistedAuth.basicUsername],
        ['auth.basicPassword', templateAuth.basicPassword, persistedAuth.basicPassword],
      ] as const) {
        const violation = detectResolvedStringLeak(field, templateValue, persistedValue, env);
        if (violation) violations.push(violation);
      }
      break;
    case 'api_key':
      for (const [field, templateValue, persistedValue] of [
        ['auth.apiKeyName', templateAuth.apiKeyName, persistedAuth.apiKeyName],
        ['auth.apiKeyValue', templateAuth.apiKeyValue, persistedAuth.apiKeyValue],
      ] as const) {
        const violation = detectResolvedStringLeak(field, templateValue, persistedValue, env);
        if (violation) violations.push(violation);
      }
      break;
    case 'oauth2':
      if (templateAuth.oauth2 && persistedAuth.oauth2) {
        for (const [field, templateValue, persistedValue] of [
          ['auth.oauth2.tokenUrl', templateAuth.oauth2.tokenUrl, persistedAuth.oauth2.tokenUrl],
          ['auth.oauth2.clientId', templateAuth.oauth2.clientId, persistedAuth.oauth2.clientId],
          ['auth.oauth2.clientSecret', templateAuth.oauth2.clientSecret, persistedAuth.oauth2.clientSecret],
          ['auth.oauth2.scope', templateAuth.oauth2.scope, persistedAuth.oauth2.scope],
        ] as const) {
          const violation = detectResolvedStringLeak(field, templateValue, persistedValue, env);
          if (violation) violations.push(violation);
        }
      }
      break;
    default:
      break;
  }
}

function restoreAuthTemplateFields(
  templateAuth: GrpcAuthConfig | undefined,
  persistedAuth: GrpcAuthConfig | undefined,
): GrpcAuthConfig | undefined {
  if (!templateAuth || !persistedAuth || templateAuth.type !== persistedAuth.type) {
    return persistedAuth;
  }

  switch (templateAuth.type) {
    case 'bearer':
      return {
        type: 'bearer',
        bearerToken: resolveGrpcPersistStringField(
          templateAuth.bearerToken,
          persistedAuth.bearerToken,
        ) ?? persistedAuth.bearerToken,
      };
    case 'basic':
      return {
        type: 'basic',
        basicUsername: resolveGrpcPersistStringField(
          templateAuth.basicUsername,
          persistedAuth.basicUsername,
        ) ?? persistedAuth.basicUsername,
        basicPassword: resolveGrpcPersistStringField(
          templateAuth.basicPassword,
          persistedAuth.basicPassword,
        ) ?? persistedAuth.basicPassword,
      };
    case 'api_key':
      return {
        type: 'api_key',
        apiKeyName: resolveGrpcPersistStringField(
          templateAuth.apiKeyName,
          persistedAuth.apiKeyName,
        ) ?? persistedAuth.apiKeyName,
        apiKeyValue: resolveGrpcPersistStringField(
          templateAuth.apiKeyValue,
          persistedAuth.apiKeyValue,
        ) ?? persistedAuth.apiKeyValue,
      };
    case 'oauth2':
      if (!templateAuth.oauth2 || !persistedAuth.oauth2) {
        return persistedAuth;
      }
      return {
        type: 'oauth2',
        oauth2: {
          tokenUrl: resolveGrpcPersistStringField(
            templateAuth.oauth2.tokenUrl,
            persistedAuth.oauth2.tokenUrl,
          ) ?? persistedAuth.oauth2.tokenUrl,
          clientId: resolveGrpcPersistStringField(
            templateAuth.oauth2.clientId,
            persistedAuth.oauth2.clientId,
          ) ?? persistedAuth.oauth2.clientId,
          clientSecret: resolveGrpcPersistStringField(
            templateAuth.oauth2.clientSecret,
            persistedAuth.oauth2.clientSecret,
          ) ?? persistedAuth.oauth2.clientSecret,
          scope: resolveGrpcPersistStringField(
            templateAuth.oauth2.scope,
            persistedAuth.oauth2.scope,
          ) ?? persistedAuth.oauth2.scope,
        },
      };
    default:
      return persistedAuth;
  }
}

/** Collect template persistence violations for a saved request vs tab/scenario source. */
export function collectGrpcSavedRequestPersistViolations(
  saved: GrpcSavedRequest,
  templateSource?: GrpcInterpolationTemplateSource,
): GrpcInterpolationPersistViolation[] {
  if (!templateSource) return [];
  const env = templateSource.interpolationEnv;
  const violations: GrpcInterpolationPersistViolation[] = [];

  const targetViolation = detectResolvedStringLeak(
    'target',
    templateSource.target,
    saved.target,
    env,
  );
  if (targetViolation) violations.push(targetViolation);

  if (templateSource.body) {
    collectJsonTemplateViolations(templateSource.body, saved.body, 'body', env, violations);
  }

  if (templateSource.metadata) {
    for (const [key, templateValue] of Object.entries(templateSource.metadata)) {
      const violation = detectResolvedStringLeak(
        `metadata.${key}`,
        templateValue,
        saved.metadata[key],
        env,
      );
      if (violation) violations.push(violation);
    }
  }

  collectAuthTemplateViolations(templateSource.auth, saved.auth, env, violations);
  return violations;
}

/** Restore template form on interpolation-eligible saved request fields. */
export function sanitizeGrpcSavedRequestForTemplatePersist(
  saved: GrpcSavedRequest,
  templateSource?: GrpcInterpolationTemplateSource,
): GrpcSavedRequest {
  if (!templateSource) return saved;

  const next: GrpcSavedRequest = {
    ...saved,
    body: structuredClone(saved.body),
    metadata: { ...saved.metadata },
    auth: saved.auth ? structuredClone(saved.auth) : undefined,
  };

  if (templateSource.connectionId?.trim() && !templateSource.target?.trim()) {
    next.target = undefined;
    next.connectionId = templateSource.connectionId;
  } else {
    const target = resolveGrpcPersistStringField(templateSource.target, saved.target);
    if (target !== undefined) next.target = target;
  }

  if (templateSource.body) {
    next.body = structuredClone(templateSource.body);
  }

  if (templateSource.metadata) {
    for (const [key, templateValue] of Object.entries(templateSource.metadata)) {
      const restored = resolveGrpcPersistStringField(templateValue, next.metadata[key]);
      if (restored !== undefined) {
        next.metadata[key] = restored;
      }
    }
  }

  next.auth = restoreAuthTemplateFields(templateSource.auth, next.auth);
  return next;
}

function toValidationIssue(violation: GrpcInterpolationPersistViolation): GrpcInterpolationValidationIssue {
  return {
    field: violation.path,
    code: violation.code,
    message: violation.message,
  };
}

/** Fail fast when a saved request would persist resolved literals instead of templates. */
export function assertGrpcSavedRequestTemplatePersistSafe(
  saved: GrpcSavedRequest,
  templateSource?: GrpcInterpolationTemplateSource,
): void {
  const violations = collectGrpcSavedRequestPersistViolations(saved, templateSource);
  if (violations.length > 0) {
    throw new GrpcInterpolationError(toValidationIssue(violations[0]!));
  }
}

/** Collect template persistence violations for a harness grpcCallAction config. */
export function collectGrpcHarnessCallActionPersistViolations(
  action: GrpcHarnessCallActionConfig,
  templateSource?: GrpcInterpolationTemplateSource,
): GrpcInterpolationPersistViolation[] {
  if (!templateSource) return [];
  const env = templateSource.interpolationEnv;
  const violations: GrpcInterpolationPersistViolation[] = [];

  const targetViolation = detectResolvedStringLeak(
    'grpcCallAction.target',
    templateSource.target ?? action.target,
    action.target,
    env,
  );
  if (targetViolation) violations.push(targetViolation);

  if (templateSource.body && action.body) {
    collectJsonTemplateViolations(templateSource.body, action.body, 'grpcCallAction.body', env, violations);
  }

  if (templateSource.metadata && action.metadata) {
    for (const [key, templateValue] of Object.entries(templateSource.metadata)) {
      const violation = detectResolvedStringLeak(
        `grpcCallAction.metadata.${key}`,
        templateValue,
        action.metadata[key],
        env,
      );
      if (violation) violations.push(violation);
    }
  }

  collectAuthTemplateViolations(templateSource.auth, action.auth, env, violations);
  return violations;
}

/** Restore template form on harness grpcCallAction interpolation fields. */
export function sanitizeGrpcHarnessCallActionForTemplatePersist(
  action: GrpcHarnessCallActionConfig,
  templateSource?: GrpcInterpolationTemplateSource,
): GrpcHarnessCallActionConfig {
  if (!templateSource) return action;

  const next: GrpcHarnessCallActionConfig = {
    ...action,
    body: action.body ? structuredClone(action.body) : undefined,
    metadata: action.metadata ? { ...action.metadata } : undefined,
    auth: action.auth ? structuredClone(action.auth) : undefined,
  };

  if (templateSource.connectionId?.trim() && !templateSource.target?.trim()) {
    next.target = '';
    next.connectionId = templateSource.connectionId;
  } else {
    const target = resolveGrpcPersistStringField(templateSource.target, action.target);
    if (target !== undefined) next.target = target;
  }

  if (templateSource.body) {
    next.body = structuredClone(templateSource.body);
  }

  if (templateSource.metadata) {
    next.metadata = { ...(next.metadata ?? {}) };
    for (const [key, templateValue] of Object.entries(templateSource.metadata)) {
      const restored = resolveGrpcPersistStringField(templateValue, next.metadata[key]);
      if (restored !== undefined) {
        next.metadata[key] = restored;
      }
    }
  }

  next.auth = restoreAuthTemplateFields(templateSource.auth, next.auth);
  return next;
}

/** Fail fast when a harness action would persist resolved literals instead of templates. */
export function assertGrpcHarnessCallActionTemplatePersistSafe(
  action: GrpcHarnessCallActionConfig,
  templateSource?: GrpcInterpolationTemplateSource,
): void {
  const violations = collectGrpcHarnessCallActionPersistViolations(action, templateSource);
  if (violations.length > 0) {
    throw new GrpcInterpolationError(toValidationIssue(violations[0]!));
  }
}

/** Build template source from a harness scenario action for definition version snapshots. */
export function buildGrpcHarnessCallActionDefinitionTemplateSource(
  action: GrpcHarnessCallActionConfig,
): GrpcInterpolationTemplateSource {
  const source: GrpcInterpolationTemplateSource = {};
  if (action.connectionId?.trim()) {
    source.connectionId = action.connectionId;
    if (containsGrpcInterpolationToken(action.target ?? '')) {
      source.target = action.target;
    }
  } else if (action.target !== undefined) {
    source.target = action.target;
  }
  if (action.body !== undefined) {
    source.body = structuredClone(action.body);
  }
  if (action.metadata !== undefined) {
    source.metadata = { ...action.metadata };
  }
  if (action.auth !== undefined) {
    source.auth = structuredClone(action.auth);
  }
  return source;
}

/** Phase 9F — normalize harness grpcCallAction before definition version persist. */
export function prepareGrpcHarnessCallActionDefinitionSnapshot(
  action: GrpcHarnessCallActionConfig,
): GrpcHarnessCallActionConfig {
  const templateSource = buildGrpcHarnessCallActionDefinitionTemplateSource(action);
  if (Object.keys(templateSource).length === 0) {
    return structuredClone(action);
  }
  return sanitizeGrpcHarnessCallActionForTemplatePersist(action, templateSource);
}
