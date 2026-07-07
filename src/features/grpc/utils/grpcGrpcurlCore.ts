/**
 * Phase 5F/5G — grpcurl import parser, export builder, and normalization.
 */
import type { GrpcCallType, GrpcMethodInfo, GrpcTlsMode } from '../../../shared/grpc/contracts';
import { normalizeGrpcMetadata } from '../../../shared/grpc/contracts';
import { isGrpcRedactedPersistValue } from '../../../shared/grpc/grpcSavedRequest';
import { isGrpcSecretMetadataKey } from '../../../shared/grpc/grpcSecretPolicy';
import type {
  GrpcGrpcurlDescriptorFlags,
  GrpcGrpcurlExportOptions,
  GrpcGrpcurlImportResult,
  GrpcGrpcurlImportSuccess,
  GrpcGrpcurlTlsFilePaths,
} from './grpcGrpcurlTypes';

export function formatGrpcStreamKeyword(callType: GrpcCallType, direction: 'request' | 'response'): string {
  const streaming = callType === 'server_streaming' && direction === 'response'
    || callType === 'client_streaming' && direction === 'request'
    || callType === 'bidi_streaming';
  return streaming ? 'stream ' : '';
}

export function formatGrpcMethodSignature(
  _serviceFullName: string,
  method: GrpcMethodInfo,
): string {
  const requestPrefix = formatGrpcStreamKeyword(method.callType, 'request');
  const responsePrefix = formatGrpcStreamKeyword(method.callType, 'response');
  return `rpc ${method.name}(${requestPrefix}${method.requestTypeName}) returns (${responsePrefix}${method.responseTypeName});`;
}

const PEM_IN_METADATA_VALUE = /-----BEGIN [A-Z0-9 ]+-----[\s\S]*?-----END [A-Z0-9 ]+-----/;
const BEARER_IN_METADATA_VALUE = /^Bearer\s+[A-Za-z0-9\-._~+/]{8,}=*$/i;
const BASIC_IN_METADATA_VALUE = /^Basic\s+[A-Za-z0-9+/=]{8,}$/i;

const KNOWN_UNSUPPORTED_FLAGS = new Set([
  '-insecure',
  '-emit-defaults',
  '-vv',
  '-v',
  '-max-time',
  '-max-msg-sz',
  '-reflect-header',
  '-help',
  '-version',
]);

function looksLikeSecretMetadataValue(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (isGrpcRedactedPersistValue(trimmed)) return true;
  if (BEARER_IN_METADATA_VALUE.test(trimmed)) return true;
  if (BASIC_IN_METADATA_VALUE.test(trimmed)) return true;
  return PEM_IN_METADATA_VALUE.test(trimmed);
}

/** Omit auth/secret metadata from grpcurl CLI export (Phase 4H — never embed tokens). */
export function filterMetadataForGrpcurlExport(
  metadata: Record<string, string> | undefined,
  options?: {
    includeSecretMetadata?: boolean;
    includeRedactedSecretMetadata?: boolean;
    includeRedactedSecretMetadataHints?: boolean;
  },
): Record<string, string> {
  if (!metadata) return {};
  const includeSecretMetadata = options?.includeSecretMetadata ?? false;
  const includeRedactedSecretMetadata = options?.includeRedactedSecretMetadata ?? false;
  const includeRedactedSecretMetadataHints = options?.includeRedactedSecretMetadataHints ?? false;
  const safe: Record<string, string> = {};
  const toSecretHint = (key: string): string => {
    const normalized = key.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    return `<SET_${normalized || 'SECRET_VALUE'}>`;
  };
  for (const [key, value] of Object.entries(metadata)) {
    const isRedactedPlaceholder = isGrpcRedactedPersistValue(value);
    if (isGrpcSecretMetadataKey(key) || looksLikeSecretMetadataValue(value)) {
      if (includeRedactedSecretMetadata && isRedactedPlaceholder) {
        safe[key] = value;
      } else if (includeRedactedSecretMetadataHints && isRedactedPlaceholder) {
        safe[key] = toSecretHint(key);
      } else if (includeSecretMetadata && !isRedactedPlaceholder) {
        safe[key] = value;
      }
      continue;
    }
    safe[key] = value;
  }
  return safe;
}

function shellQuote(value: string): string {
  if (/^[A-Za-z0-9_./:@-]+$/.test(value)) {
    return value;
  }
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/** Collapse shell line continuations before tokenizing pasted multi-line commands. */
export function normalizeGrpcurlCommandInput(input: string): string {
  return input.replace(/[ \t]*\\\r?\n[ \t]*/g, ' ').trim();
}

function resolveExportTlsMode(
  tlsMode: GrpcTlsMode,
  tlsFilePaths: GrpcGrpcurlTlsFilePaths | undefined,
): GrpcTlsMode {
  if (tlsMode === 'disabled') return 'disabled';
  if (tlsFilePaths?.certPath?.trim() && tlsFilePaths?.keyPath?.trim()) return 'mtls';
  return tlsMode;
}

function appendDescriptorFlags(parts: string[], flags: GrpcGrpcurlDescriptorFlags | undefined): void {
  if (!flags) return;
  for (const importPath of flags.importPaths.slice().sort()) {
    parts.push('-import-path', shellQuote(importPath));
  }
  for (const protoPath of flags.protoPaths.slice().sort()) {
    parts.push('-proto', shellQuote(protoPath));
  }
  if (flags.protosetPath?.trim()) {
    parts.push('-protoset', shellQuote(flags.protosetPath.trim()));
  }
}

function appendTlsFilePaths(
  parts: string[],
  tlsMode: GrpcTlsMode,
  tlsFilePaths: GrpcGrpcurlTlsFilePaths | undefined,
): void {
  if (!tlsFilePaths || tlsMode === 'disabled') return;
  if (tlsFilePaths.caCertPath?.trim()) {
    parts.push('-cacert', shellQuote(tlsFilePaths.caCertPath.trim()));
  }
  if (tlsMode === 'mtls') {
    if (tlsFilePaths.certPath?.trim()) {
      parts.push('-cert', shellQuote(tlsFilePaths.certPath.trim()));
    }
    if (tlsFilePaths.keyPath?.trim()) {
      parts.push('-key', shellQuote(tlsFilePaths.keyPath.trim()));
    }
  }
}

export function buildGrpcurlInvokeCommand(options: GrpcGrpcurlExportOptions): string {
  const parts: string[] = ['grpcurl'];
  const tlsMode = resolveExportTlsMode(options.tlsMode ?? 'disabled', options.tlsFilePaths);

  appendDescriptorFlags(parts, options.descriptorFlags);
  appendTlsFilePaths(parts, tlsMode, options.tlsFilePaths);

  if (tlsMode === 'disabled') {
    parts.push('-plaintext');
  }
  if (options.serverNameOverride?.trim()) {
    parts.push('-authority', shellQuote(options.serverNameOverride.trim()));
  }
  const exportMetadata = normalizeGrpcMetadata(filterMetadataForGrpcurlExport(options.metadata, {
    includeSecretMetadata: options.includeSecretMetadata,
    includeRedactedSecretMetadata: options.includeRedactedSecretMetadata,
    includeRedactedSecretMetadataHints: options.includeRedactedSecretMetadataHints,
  }));
  for (const [key, value] of Object.entries(exportMetadata).sort(([a], [b]) => a.localeCompare(b))) {
    parts.push('-H', shellQuote(`${key}: ${value}`));
  }
  if (options.body && Object.keys(options.body).length > 0) {
    parts.push('-d', shellQuote(JSON.stringify(options.body)));
  }

  parts.push(options.targetAddress.trim());
  parts.push(`${options.serviceFullName}/${options.methodName}`);
  return parts.join(' ');
}

/** Split grpcurl CLI respecting single- and double-quoted segments. */
export function tokenizeGrpcurlCommand(input: string): string[] {
  const trimmed = input.trim();
  const tokens: string[] = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let i = 0; i < trimmed.length; i += 1) {
    const ch = trimmed[i]!;
    if (ch === '\'' && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      continue;
    }
    if (ch === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }
    if (!inSingleQuote && !inDoubleQuote && /\s/.test(ch)) {
      if (current.length > 0) {
        tokens.push(current);
        current = '';
      }
      continue;
    }
    current += ch;
  }
  if (current.length > 0) {
    tokens.push(current);
  }
  return tokens;
}

function parseHeaderFlag(value: string): { key: string; headerValue: string } | undefined {
  const colon = value.indexOf(':');
  if (colon <= 0) return undefined;
  const key = value.slice(0, colon).trim().toLowerCase();
  const headerValue = value.slice(colon + 1).trim();
  if (!key) return undefined;
  return { key, headerValue };
}

function parseServiceMethodToken(token: string): { serviceFullName: string; methodName: string } | undefined {
  const slash = token.lastIndexOf('/');
  if (slash <= 0 || slash >= token.length - 1) return undefined;
  return {
    serviceFullName: token.slice(0, slash),
    methodName: token.slice(slash + 1),
  };
}

function looksLikeTarget(token: string): boolean {
  if (/^\{\{[^}]+\}\}$/.test(token)) return true;
  if (/^\[[^\]]+\]:\d+$/.test(token)) return true;
  return /^[^\s/]+:\d+$/.test(token);
}

function inferTlsModeFromImportFlags(
  hasPlaintext: boolean,
  tlsFilePaths: GrpcGrpcurlTlsFilePaths,
): GrpcTlsMode {
  if (hasPlaintext) return 'disabled';
  if (tlsFilePaths.certPath?.trim() && tlsFilePaths.keyPath?.trim()) return 'mtls';
  return 'tls';
}

function buildDescriptorFlags(
  protoPaths: string[],
  importPaths: string[],
  protosetPath: string | undefined,
): GrpcGrpcurlDescriptorFlags | undefined {
  const hasDescriptor = protoPaths.length > 0
    || importPaths.length > 0
    || Boolean(protosetPath?.trim());
  if (!hasDescriptor) return undefined;
  return {
    protoPaths: protoPaths.slice().sort((a, b) => a.localeCompare(b)),
    importPaths: importPaths.slice().sort((a, b) => a.localeCompare(b)),
    protosetPath: protosetPath?.trim() || undefined,
  };
}

function buildTlsFilePaths(
  tlsFilePaths: GrpcGrpcurlTlsFilePaths,
): GrpcGrpcurlTlsFilePaths | undefined {
  const hasPaths = Boolean(
    tlsFilePaths.certPath?.trim()
    || tlsFilePaths.keyPath?.trim()
    || tlsFilePaths.caCertPath?.trim(),
  );
  if (!hasPaths) return undefined;
  return {
    certPath: tlsFilePaths.certPath?.trim() || undefined,
    keyPath: tlsFilePaths.keyPath?.trim() || undefined,
    caCertPath: tlsFilePaths.caCertPath?.trim() || undefined,
  };
}

/** Phase 5F — parse grpcurl invoke commands into Studio-normalized fields. */
export function parseGrpcurlCommand(input: string): GrpcGrpcurlImportResult {
  const warnings: string[] = [];
  const unsupportedFlags: string[] = [];
  let tokens = tokenizeGrpcurlCommand(normalizeGrpcurlCommandInput(input));
  if (tokens[0] === 'grpcurl') {
    tokens = tokens.slice(1);
  }
  if (tokens.length === 0) {
    return { ok: false, error: 'Empty grpcurl command', unsupportedFlags, warnings };
  }

  let hasPlaintext = false;
  let body: Record<string, unknown> = {};
  const metadata: Record<string, string> = {};
  let serverNameOverride: string | undefined;
  const tlsFilePaths: GrpcGrpcurlTlsFilePaths = {};
  const protoPaths: string[] = [];
  const importPaths: string[] = [];
  let protosetPath: string | undefined;

  const positional: string[] = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i]!;
    if (!token.startsWith('-')) {
      positional.push(token);
      continue;
    }

    if (token === '-plaintext') {
      hasPlaintext = true;
      continue;
    }

    if (token === '-d' || token === '-format') {
      const next = tokens[i + 1];
      if (!next) {
        return { ok: false, error: `Missing value for ${token}`, unsupportedFlags, warnings };
      }
      if (token === '-format' && next !== 'json') {
        warnings.push(`Unsupported ${token} value "${next}" — only json body import is supported`);
      }
      if (token === '-d') {
        if (next === '@') {
          return {
            ok: false,
            error: 'Request body file references (@file) are not supported — paste JSON with -d',
            unsupportedFlags,
            warnings,
          };
        }
        try {
          const parsed = JSON.parse(next) as unknown;
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return { ok: false, error: 'Request body must be a JSON object', unsupportedFlags, warnings };
          }
          body = parsed as Record<string, unknown>;
        } catch {
          return { ok: false, error: 'Request body (-d) is not valid JSON', unsupportedFlags, warnings };
        }
      }
      i += 1;
      continue;
    }

    if (token === '-H') {
      const next = tokens[i + 1];
      if (!next) {
        return { ok: false, error: 'Missing value for -H header flag', unsupportedFlags, warnings };
      }
      const header = parseHeaderFlag(next);
      if (!header) {
        return { ok: false, error: `Invalid -H header format: ${next}`, unsupportedFlags, warnings };
      }
      if (Object.prototype.hasOwnProperty.call(metadata, header.key)) {
        warnings.push(`Duplicate -H header for "${header.key}" — last value wins`);
      }
      metadata[header.key] = header.headerValue;
      i += 1;
      continue;
    }

    if (token === '-authority') {
      const next = tokens[i + 1];
      if (!next) {
        return { ok: false, error: 'Missing value for -authority', unsupportedFlags, warnings };
      }
      serverNameOverride = next;
      i += 1;
      continue;
    }

    if (token === '-cert' || token === '-key' || token === '-cacert') {
      const next = tokens[i + 1];
      if (!next) {
        return { ok: false, error: `Missing value for ${token}`, unsupportedFlags, warnings };
      }
      if (token === '-cert') tlsFilePaths.certPath = next;
      if (token === '-key') tlsFilePaths.keyPath = next;
      if (token === '-cacert') tlsFilePaths.caCertPath = next;
      i += 1;
      continue;
    }

    if (token === '-proto') {
      const next = tokens[i + 1];
      if (!next) {
        return { ok: false, error: 'Missing value for -proto', unsupportedFlags, warnings };
      }
      protoPaths.push(next);
      i += 1;
      continue;
    }

    if (token === '-import-path') {
      const next = tokens[i + 1];
      if (!next) {
        return { ok: false, error: 'Missing value for -import-path', unsupportedFlags, warnings };
      }
      importPaths.push(next);
      i += 1;
      continue;
    }

    if (token === '-protoset') {
      const next = tokens[i + 1];
      if (!next) {
        return { ok: false, error: 'Missing value for -protoset', unsupportedFlags, warnings };
      }
      protosetPath = next;
      i += 1;
      continue;
    }

    unsupportedFlags.push(token);
  }

  if (unsupportedFlags.includes('-insecure')) {
    warnings.push('-insecure is not imported — configure trust settings in the gRPC Studio TLS modal');
  }
  if (unsupportedFlags.some((flag) => KNOWN_UNSUPPORTED_FLAGS.has(flag))) {
    warnings.push('Some grpcurl flags are not mapped to Studio fields — invoke options were partially imported');
  }
  if (buildTlsFilePaths(tlsFilePaths)) {
    warnings.push('TLS certificate flags import file paths only — load PEM material via the TLS modal or settings drawer');
    const hasCert = Boolean(tlsFilePaths.certPath?.trim());
    const hasKey = Boolean(tlsFilePaths.keyPath?.trim());
    if (hasCert !== hasKey) {
      warnings.push('-cert and -key must both be present for mTLS — partial client cert paths are hints only');
    }
  }
  if (buildDescriptorFlags(protoPaths, importPaths, protosetPath)) {
    warnings.push('Descriptor flags import file paths — attach protos via Proto Management after import');
  }
  if (hasPlaintext && buildTlsFilePaths(tlsFilePaths)) {
    warnings.push('-plaintext conflicts with TLS cert flags — tlsMode set to disabled; cert paths preserved as hints');
  }

  const serviceToken = positional.find((token) => parseServiceMethodToken(token));
  const serviceMethod = serviceToken ? parseServiceMethodToken(serviceToken) : undefined;
  const targetToken = positional.find((token) => token !== serviceToken && looksLikeTarget(token));

  if (!serviceMethod) {
    return { ok: false, error: 'Could not find Service/Method token (expected package.Service/Method)', unsupportedFlags, warnings };
  }
  if (!targetToken) {
    return { ok: false, error: 'Could not find host:port target address', unsupportedFlags, warnings };
  }

  const tlsMode = inferTlsModeFromImportFlags(hasPlaintext, tlsFilePaths);

  return {
    ok: true,
    targetAddress: targetToken,
    serviceFullName: serviceMethod.serviceFullName,
    methodName: serviceMethod.methodName,
    tlsMode,
    body,
    metadata: normalizeGrpcMetadata(metadata),
    serverNameOverride,
    tlsFilePaths: buildTlsFilePaths(tlsFilePaths),
    descriptorFlags: buildDescriptorFlags(protoPaths, importPaths, protosetPath),
    unsupportedFlags,
    warnings,
  };
}

/** Map import result to partial tab patch (Phase 5H UI consumes this). */
export function grpcGrpcurlImportToTabPatch(result: GrpcGrpcurlImportSuccess): {
  target: string;
  tlsMode: GrpcTlsMode;
  tlsConfig?: { serverNameOverride?: string };
  tlsFilePaths?: GrpcGrpcurlTlsFilePaths;
  descriptorImport?: GrpcGrpcurlDescriptorFlags;
  service: string;
  method: string;
  body: Record<string, unknown>;
  metadata: Record<string, string>;
} {
  return {
    target: result.targetAddress,
    tlsMode: result.tlsMode,
    tlsConfig: result.serverNameOverride
      ? { serverNameOverride: result.serverNameOverride }
      : undefined,
    tlsFilePaths: result.tlsFilePaths,
    descriptorImport: result.descriptorFlags,
    service: result.serviceFullName,
    method: result.methodName,
    body: structuredClone(result.body),
    metadata: normalizeGrpcMetadata(result.metadata),
  };
}
