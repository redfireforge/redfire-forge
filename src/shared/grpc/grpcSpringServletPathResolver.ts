/**
 * Spring Servlet service/method path resolver — Phase 10D.
 *
 * Maps descriptor service names to `POST /{service}/{method}` paths for
 * official Spring gRPC servlet mode and net.devh servlet configurations.
 */
import type { GrpcTarget } from './contracts';

export class SpringServletPathResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SpringServletPathResolutionError';
  }
}

/** Strip leading slashes/dots and reject empty segments or traversal. */
export function normalizeSpringServletServiceSegment(service: string): string {
  let normalized = service.trim();
  if (!normalized) {
    throw new SpringServletPathResolutionError('Service name is required for Spring Servlet routing');
  }
  while (normalized.startsWith('/')) {
    normalized = normalized.slice(1);
  }
  while (normalized.startsWith('.')) {
    normalized = normalized.slice(1);
  }
  normalized = normalized.trim();
  if (!normalized) {
    throw new SpringServletPathResolutionError('Service name is empty after normalization');
  }
  if (normalized.includes('..') || normalized.includes('/') || normalized.includes('\\')) {
    throw new SpringServletPathResolutionError(
      `Invalid Spring Servlet service segment: ${service}`,
    );
  }
  return normalized;
}

/** Strip leading slashes and validate method segment. */
export function normalizeSpringServletMethodSegment(method: string): string {
  let normalized = method.trim();
  if (!normalized) {
    throw new SpringServletPathResolutionError('Method name is required for Spring Servlet routing');
  }
  while (normalized.startsWith('/')) {
    normalized = normalized.slice(1);
  }
  normalized = normalized.trim();
  if (!normalized) {
    throw new SpringServletPathResolutionError('Method name is empty after normalization');
  }
  if (normalized.includes('..') || normalized.includes('/') || normalized.includes('\\')) {
    throw new SpringServletPathResolutionError(
      `Invalid Spring Servlet method segment: ${method}`,
    );
  }
  return normalized;
}

/** Build canonical servlet path `/{service}/{method}`. */
export function buildSpringServletMethodPath(service: string, method: string): string {
  const serviceSegment = normalizeSpringServletServiceSegment(service);
  const methodSegment = normalizeSpringServletMethodSegment(method);
  return `/${serviceSegment}/${methodSegment}`;
}

/**
 * Candidate paths for diagnostics — canonical first, then short service name
 * when package-qualified (net.devh / Spring both accept full name; short name
 * helps troubleshooting misconfigured descriptors).
 */
export function resolveSpringServletPathCandidates(service: string, method: string): string[] {
  const canonical = buildSpringServletMethodPath(service, method);
  const serviceSegment = normalizeSpringServletServiceSegment(service);
  const methodSegment = normalizeSpringServletMethodSegment(method);
  const shortService = serviceSegment.includes('.')
    ? serviceSegment.split('.').pop() ?? serviceSegment
    : serviceSegment;
  const shortPath = shortService !== serviceSegment
    ? `/${shortService}/${methodSegment}`
    : null;

  const candidates = [canonical];
  if (shortPath && !candidates.includes(shortPath)) {
    candidates.push(shortPath);
  }
  return candidates;
}

export function buildSpringServletMethodUrl(
  target: GrpcTarget,
  service: string,
  method: string,
): string {
  const scheme = target.tlsMode === 'disabled' ? 'http' : 'https';
  const path = buildSpringServletMethodPath(service, method);
  return `${scheme}://${target.address}${path}`;
}

/** Ordered servlet URLs — canonical first, then short service name when package-qualified. */
export function buildSpringServletMethodUrls(
  target: GrpcTarget,
  service: string,
  method: string,
): string[] {
  const scheme = target.tlsMode === 'disabled' ? 'http' : 'https';
  return resolveSpringServletPathCandidates(service, method).map(
    (path) => `${scheme}://${target.address}${path}`,
  );
}

export function resetSpringServletPathResolverForTests(): void {
  // Stateless module — symmetry hook for test suites.
}
