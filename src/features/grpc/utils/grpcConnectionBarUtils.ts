import type { GrpcAuthConfig, GrpcTargetConnectionSession, GrpcTlsMode } from '../../../shared/grpc/contracts';

export type GrpcConnectionDotModifier = 'idle' | 'connecting' | 'connected' | 'error';

export type GrpcTlsBadgeVariant = 'plain' | 'tls' | 'mtls' | 'invalid';

export interface GrpcTlsBadgePresentation {
  label: string;
  variant: GrpcTlsBadgeVariant;
  icon: string;
}

const AUTH_TYPE_LABELS: Record<NonNullable<GrpcAuthConfig['type']>, string> = {
  none: 'None',
  bearer: 'Bearer',
  basic: 'Basic',
  api_key: 'API Key',
  oauth2: 'OAuth2',
};

/** Connection bar TLS badge label + style variant (Phase 4J-A). */
export function resolveGrpcTlsBadgePresentation(
  tlsMode: GrpcTlsMode,
  tlsValid: boolean,
): GrpcTlsBadgePresentation {
  if (!tlsValid && tlsMode !== 'disabled') {
    return { label: 'TLS invalid', variant: 'invalid', icon: '🔒' };
  }
  switch (tlsMode) {
    case 'disabled':
      return { label: 'Plaintext', variant: 'plain', icon: '🔓' };
    case 'mtls':
      return { label: 'mTLS', variant: 'mtls', icon: '🛡' };
    default:
      return { label: 'TLS', variant: 'tls', icon: '🔒' };
  }
}

/** Connection bar auth badge label (Phase 4J-A). */
export function resolveGrpcAuthBadgeLabel(auth: GrpcAuthConfig | undefined): string {
  const type = auth?.type ?? 'none';
  if (type === 'none' || !auth) {
    return 'Auth: None';
  }
  const short = AUTH_TYPE_LABELS[type] ?? 'Auth';
  return `Auth: ${short}`;
}

export function isGrpcAuthConfigured(auth: GrpcAuthConfig | undefined): boolean {
  return !!auth && auth.type !== 'none';
}

/** Human-readable deadline chip from tab timeoutMs. */
export function formatGrpcDeadlineLabel(timeoutMs: number): string {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return 'No deadline';
  }
  if (timeoutMs >= 60_000 && timeoutMs % 60_000 === 0) {
    const minutes = timeoutMs / 60_000;
    return minutes === 1 ? '1m' : `${minutes}m`;
  }
  if (timeoutMs >= 1000 && timeoutMs % 1000 === 0) {
    const seconds = timeoutMs / 1000;
    return seconds === 1 ? '1s' : `${seconds}s`;
  }
  return `${timeoutMs}ms`;
}

export function resolveGrpcConnectionDotModifier(
  session: GrpcTargetConnectionSession | undefined,
): GrpcConnectionDotModifier {
  switch (session?.state) {
    case 'connecting':
      return 'connecting';
    case 'connected':
      return 'connected';
    case 'error':
      return 'error';
    default:
      return 'idle';
  }
}

export function resolveGrpcConnectionToggleLabel(
  session: GrpcTargetConnectionSession | undefined,
): string {
  if (session?.state === 'connecting') return 'Cancel';
  if (session?.state === 'connected') return 'Disconnect';
  return 'Connect';
}
