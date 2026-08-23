/**
 * graphqlTransportTypes.ts — Core transport interface types for GraphQL Studio.
 *
 * Extracted from graphqlClient.ts to allow graphqlProxyTransports.ts to import
 * these types without creating a circular dependency.
 *
 * All types are re-exported from graphqlClient.ts for backward compatibility.
 */
import type { GraphqlResponse, GraphqlAuth } from '@shared/types/graphql';

// ─── Operation params ─────────────────────────────────────────────────────────

/** All resolved (post-interpolation) parameters for a single operation. */
export interface GraphqlOperationParams {
  /** GraphQL endpoint URL. */
  endpoint: string;
  /** Resolved request headers (user headers + auth headers, already merged). */
  headers: Record<string, string>;
  /** Whether to skip TLS certificate validation for self-signed/dev endpoints. */
  skipTlsVerify?: boolean;
  /** Full TLS settings (CA + mTLS). When omitted, derived from skipTlsVerify. */
  tls?: import('../../../shared/types/gqlTls').GqlTlsSettings;
  /** Per-tab CA PEM for mTLS / internal CA validation. */
  tlsCaCert?: string;
  tlsClientCert?: string;
  tlsClientKey?: string;
  /** AbortSignal for cancellation. */
  signal?: AbortSignal;
}

// ─── Subscription callbacks ───────────────────────────────────────────────────

export interface GraphqlSubscribeCallbacks {
  /** Invoked for each `data` / `next` frame from the subscription stream. */
  onMessage: (data: unknown) => void;
  /** Invoked when the subscription encounters an error. */
  onError: (error: string) => void;
  /** Invoked when the subscription stream ends cleanly. */
  onComplete: () => void;
}

// ─── Transport interface ──────────────────────────────────────────────────────

export type GraphqlTransportType = 'http' | 'ws' | 'sse';

export interface GraphqlTransport {
  readonly type: GraphqlTransportType;

  execute(
    query: string,
    variables: Record<string, unknown>,
    operationName: string | undefined,
    params: GraphqlOperationParams,
  ): Promise<GraphqlResponse>;

  subscribe(
    query: string,
    variables: Record<string, unknown>,
    operationName: string | undefined,
    params: GraphqlOperationParams,
    callbacks: GraphqlSubscribeCallbacks,
  ): () => void;
}

// ─── Transport selector ───────────────────────────────────────────────────────

export interface GraphqlTransportSelector {
  auth?: GraphqlAuth | null;
  skipTlsVerify?: boolean;
  tlsCaCert?: string;
  tlsClientCert?: string;
  tlsClientKey?: string;
  endpoint?: string;
  subscriptionTransport?: 'auto' | 'graphql-transport-ws' | 'graphql-ws' | 'sse';
}
