/**
 * Phase 4E — regression scanner for accidental secret leakage in serialized payloads.
 */
import { GRPC_REDACTED_PLACEHOLDER, GRPC_REDACTED_PEM_PLACEHOLDER } from './grpcRedaction';
import {
  GRPC_FORBIDDEN_SECRET_PERSIST_TARGETS,
  GRPC_SECRET_FIELD_PATHS,
  isGrpcSecretFieldPath,
  isGrpcSecretMetadataKey,
} from './grpcSecretPolicy';

export interface GrpcSecretLeakFinding {
  path: string;
  reason: string;
}

const PEM_PATTERN = /-----BEGIN [A-Z0-9 ]+-----[\s\S]*?-----END [A-Z0-9 ]+-----/;
const BEARER_PATTERN = /^Bearer\s+[A-Za-z0-9\-._~+/]{8,}=*$/i;
const BASIC_PATTERN = /^Basic\s+[A-Za-z0-9+/=]{8,}$/i;
const BEARER_IN_TEXT_PATTERN = /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi;
const BASIC_IN_TEXT_PATTERN = /Basic\s+[A-Za-z0-9+/=]+/gi;
const PEM_IN_TEXT_PATTERN = /-----BEGIN [A-Z0-9 ]+-----[\s\S]*?-----END [A-Z0-9 ]+-----/g;

const REDACTED_VALUES = new Set([
  GRPC_REDACTED_PLACEHOLDER,
  GRPC_REDACTED_PEM_PLACEHOLDER,
  '[base64]',
  '[REDACTED]',
  '[REDACTED_PEM]',
]);

const SECRET_LEAF_KEYS = new Set([
  'bearerToken',
  'basicPassword',
  'apiKeyValue',
  'clientSecret',
  'serverCaPem',
  'clientCertPem',
  'clientKeyPem',
  'bsrToken',
]);

function isRedactedOrEmpty(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (REDACTED_VALUES.has(trimmed)) return true;
  if (trimmed.startsWith('Bearer ') && trimmed.includes('…')) return true;
  if (trimmed === 'Basic ••••') return true;
  return false;
}

function looksLikeRawSecretString(value: string): string | null {
  if (isRedactedOrEmpty(value)) return null;
  if (PEM_PATTERN.test(value)) return 'raw PEM block';
  if (BEARER_PATTERN.test(value.trim())) return 'raw Bearer token';
  if (BASIC_PATTERN.test(value.trim())) return 'raw Basic credentials';
  return null;
}

/** Phase 8H — detect bearer/basic/PEM patterns in arbitrary strings (export hardening). */
export function detectGrpcSecretLikeString(value: string): boolean {
  return looksLikeRawSecretString(value) !== null;
}

function looksLikeStandaloneCredentialFragment(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length < 20) return false;
  if (/\s/.test(trimmed)) return false;
  return /(?:token|secret|apikey|api_key|password|credential)/i.test(trimmed);
}

/** Phase 11H — detect inline or standalone secret material in export diagnostic text. */
export function detectGrpcSecretMaterialInDiagnosticText(text: string): boolean {
  if (detectGrpcSecretLikeString(text)) return true;
  if (BEARER_IN_TEXT_PATTERN.test(text)) return true;
  if (BASIC_IN_TEXT_PATTERN.test(text)) return true;
  if (PEM_IN_TEXT_PATTERN.test(text)) return true;
  return looksLikeStandaloneCredentialFragment(text);
}

function getValueAtPath(obj: unknown, dotPath: string): unknown {
  const parts = dotPath.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (!current || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function scanGrpcObjectForSecretLeakage(
  obj: unknown,
  options?: { rootPath?: string },
): GrpcSecretLeakFinding[] {
  const findings: GrpcSecretLeakFinding[] = [];
  const rootPath = options?.rootPath ?? '';

  for (const fieldPath of GRPC_SECRET_FIELD_PATHS) {
    const value = getValueAtPath(obj, fieldPath);
    if (typeof value === 'string') {
      if (isRedactedOrEmpty(value)) continue;
      const reason = looksLikeRawSecretString(value) ?? 'raw secret field value';
      findings.push({
        path: rootPath ? `${rootPath}.${fieldPath}` : fieldPath,
        reason: `classified secret field contains ${reason}`,
      });
    }
  }

  walkObject(obj, rootPath, findings);
  return findings;
}

function walkObject(value: unknown, path: string, findings: GrpcSecretLeakFinding[]): void {
  if (typeof value === 'string') {
    const reason = looksLikeRawSecretString(value);
    if (reason && pathLooksSecret(path)) {
      findings.push({ path: path || '(root)', reason: `string at secret-like path contains ${reason}` });
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      walkObject(entry, path ? `${path}[${index}]` : `[${index}]`, findings);
    });
    return;
  }

  if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      const nextPath = path ? `${path}.${key}` : key;
      if (typeof entry === 'string') {
        const dotPath = nextPath.replace(/\[(\d+)\]/g, '.$1');
        const isSecretKey = SECRET_LEAF_KEYS.has(key)
          || isGrpcSecretFieldPath(dotPath)
          || isGrpcSecretMetadataKey(key);
        if (isSecretKey && !isRedactedOrEmpty(entry)) {
          const reason = looksLikeRawSecretString(entry) ?? 'raw secret value';
          findings.push({ path: nextPath, reason: `secret field contains ${reason}` });
        } else if (!isSecretKey) {
          const reason = looksLikeRawSecretString(entry);
          if (reason && (key.toLowerCase().includes('pem') || key.toLowerCase().includes('secret'))) {
            findings.push({ path: nextPath, reason: `key name suggests secret: ${reason}` });
          }
        }
      } else {
        walkObject(entry, nextPath, findings);
      }
    }
  }
}

function pathLooksSecret(path: string): boolean {
  const lower = path.toLowerCase();
  return lower.includes('secret')
    || lower.includes('password')
    || lower.includes('token')
    || lower.includes('pem')
    || lower.includes('authorization')
    || lower.includes('bsrtoken');
}

export function assertNoGrpcSecretLeakage(obj: unknown, context: string): void {
  const findings = scanGrpcObjectForSecretLeakage(obj);
  if (findings.length > 0) {
    const summary = findings.map((f) => `${f.path}: ${f.reason}`).join('; ');
    throw new Error(`gRPC secret leakage in ${context}: ${summary}`);
  }
}

export function scanForbiddenGrpcPersistTargets(
  payloadsByTarget: Record<string, unknown>,
): GrpcSecretLeakFinding[] {
  const findings: GrpcSecretLeakFinding[] = [];
  for (const forbiddenKey of GRPC_FORBIDDEN_SECRET_PERSIST_TARGETS) {
    const payload = payloadsByTarget[forbiddenKey];
    if (payload === undefined) continue;
    for (const finding of scanGrpcObjectForSecretLeakage(payload, { rootPath: forbiddenKey })) {
      findings.push(finding);
    }
  }
  return findings;
}
