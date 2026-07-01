/**
 * Phase 3C — proto import path resolution (user files + import roots + bundled WKT).
 */
import { PROTO_WKT_BUNDLE } from './protoWktBundle.js';

export interface ProtoFileInput {
  path: string;
  content: string;
}

export interface ProtoImportResolverOptions {
  protoFiles: ProtoFileInput[];
  importPaths?: string[];
  includeWktBundle?: boolean;
}

export interface ProtoImportResolutionDiagnostics {
  unresolvedImport: string;
  fromFile?: string;
  searchedPaths: string[];
}

export class ProtoImportResolutionError extends Error {
  readonly diagnostics: ProtoImportResolutionDiagnostics;

  constructor(message: string, diagnostics: ProtoImportResolutionDiagnostics) {
    super(message);
    this.name = 'ProtoImportResolutionError';
    this.diagnostics = diagnostics;
  }
}

export function normalizeProtoPath(path: string): string {
  return path.trim().replace(/\\/g, '/').replace(/\/+/g, '/');
}

/** Collapse `.` / `..` segments after joining import paths (e.g. `api/../common/x.proto`). */
export function normalizeResolvedProtoPath(path: string): string {
  const parts = normalizeProtoPath(path).split('/');
  const stack: string[] = [];
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (stack.length > 0) stack.pop();
      continue;
    }
    stack.push(part);
  }
  return stack.join('/');
}

export function buildProtoFileMap(options: ProtoImportResolverOptions): Map<string, string> {
  const fileMap = new Map<string, string>();

  const addFile = (rawPath: string, content: string) => {
    const path = normalizeProtoPath(rawPath);
    if (!path) {
      throw new Error('each proto file requires a non-empty path');
    }
    if (fileMap.has(path)) {
      throw new Error(`Duplicate proto file path: ${path}`);
    }
    fileMap.set(path, content);
  };

  if (options.includeWktBundle !== false) {
    for (const [path, content] of Object.entries(PROTO_WKT_BUNDLE)) {
      fileMap.set(path, content);
    }
  }

  for (const file of options.protoFiles) {
    addFile(file.path, file.content);
  }

  return fileMap;
}

export function resolveProtoImportPath(
  origin: string | undefined,
  target: string,
  fileMap: ReadonlyMap<string, string>,
  importPaths: string[] = [],
): string | null {
  const normalizedTarget = normalizeProtoPath(target);
  if (fileMap.has(normalizedTarget)) {
    return normalizedTarget;
  }

  const originDir = origin?.includes('/')
    ? origin.slice(0, origin.lastIndexOf('/') + 1)
    : '';
  const relativeCandidate = normalizeResolvedProtoPath(`${originDir}${normalizedTarget}`);
  if (fileMap.has(relativeCandidate)) {
    return relativeCandidate;
  }

  for (const importRoot of importPaths.map((entry) => normalizeProtoPath(entry))) {
    const trimmedRoot = importRoot.replace(/\/$/, '');
    const candidate = trimmedRoot
      ? normalizeResolvedProtoPath(`${trimmedRoot}/${normalizedTarget}`)
      : normalizeResolvedProtoPath(normalizedTarget);
    if (fileMap.has(candidate)) {
      return candidate;
    }
  }

  return null;
}

export function buildProtoResolvePath(
  fileMap: ReadonlyMap<string, string>,
  importPaths: string[] = [],
): (origin: string | undefined, target: string) => string | null {
  return (origin, target) => resolveProtoImportPath(origin, target, fileMap, importPaths);
}

const PROTO_IMPORT_PATTERN = /import\s+(?:(public|weak)\s+)?["']([^"']+)["']\s*;/g;

export interface ProtoImportRef {
  target: string;
  modifier?: 'public' | 'weak';
}

export function extractProtoImportRefs(content: string): ProtoImportRef[] {
  const imports: ProtoImportRef[] = [];
  for (const match of content.matchAll(PROTO_IMPORT_PATTERN)) {
    const modifier = match[1] as 'public' | 'weak' | undefined;
    imports.push({
      target: match[2]!,
      ...(modifier ? { modifier } : {}),
    });
  }
  return imports;
}

export function extractProtoImports(content: string): string[] {
  return extractProtoImportRefs(content).map((entry) => entry.target);
}

export function assertProtoFileImportsResolvable(
  fromFile: string,
  content: string,
  fileMap: ReadonlyMap<string, string>,
  importPaths: string[] = [],
): void {
  for (const { target, modifier } of extractProtoImportRefs(content)) {
    if (modifier === 'weak') continue;
    const resolved = resolveProtoImportPath(fromFile, target, fileMap, importPaths);
    if (resolved) continue;
    const diagnostics: ProtoImportResolutionDiagnostics = {
      unresolvedImport: normalizeProtoPath(target),
      fromFile: normalizeProtoPath(fromFile),
      searchedPaths: [...importPaths],
    };
    throw new ProtoImportResolutionError(
      formatImportResolutionMessage(diagnostics),
      diagnostics,
    );
  }
}

const IMPORT_FAILURE_PATTERN = /(?:import\s+)?["']([^"']+\.proto)["']\s*(?:not found|ENOENT)/i;

export function extractUnresolvedImport(message: string): string | undefined {
  const match = IMPORT_FAILURE_PATTERN.exec(message);
  return match?.[1];
}

export function formatImportResolutionMessage(diagnostics: ProtoImportResolutionDiagnostics): string {
  const from = diagnostics.fromFile ? ` (required by ${diagnostics.fromFile})` : '';
  return `Unresolved import "${diagnostics.unresolvedImport}"${from}`;
}

export function classifyProtoParseFailure(
  error: unknown,
  fromFile: string,
  importPaths: string[],
): ProtoImportResolutionError | null {
  const message = error instanceof Error ? error.message : String(error);
  const unresolvedImport = extractUnresolvedImport(message);
  if (!unresolvedImport) {
    return null;
  }
  return new ProtoImportResolutionError(
    formatImportResolutionMessage({
      unresolvedImport,
      fromFile,
      searchedPaths: importPaths,
    }),
    {
      unresolvedImport,
      fromFile,
      searchedPaths: [...importPaths],
    },
  );
}
