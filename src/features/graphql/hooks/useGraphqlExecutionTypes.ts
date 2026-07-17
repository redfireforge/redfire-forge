import type { GraphqlResponse } from '../../../shared/types/graphql';
import type { GqlTlsSettings } from '../../../shared/types/gqlTls';
import type { DedupChoice } from '../utils/dedupExecution';
import type { AuthSentStampInput } from '../utils/graphqlExecutionResponseParsing';

export type ExecutionStatus = 'idle' | 'loading' | 'success' | 'error';

export interface ExecuteParams {
  endpoint: string;
  query: string;
  /** JSON string from the Variables panel — if malformed, execution still proceeds (server will reject it) */
  variables: string;
  /** Active operation name (only needed when document has multiple named operations) */
  operationName?: string;
  /** Resolved headers (enabled tab headers merged with any connection-level headers) */
  headers: Record<string, string>;
  /** Skip TLS certificate validation — for self-signed/dev endpoints (web mode: proxied via /__proxy) */
  skipTlsVerify?: boolean;
  /** Full TLS settings (CA + mTLS). When omitted, derived from skipTlsVerify. */
  tls?: GqlTlsSettings;
  /**
   * When present, sends the request as multipart/form-data via the upload proxy
   * instead of a standard JSON body. Used by the Files tab (2E-1/2E-2).
   */
  formData?: FormData;
  /**
   * Sprint 8 (2E-4): optional callback for file upload progress.
   * Called with `(loaded, total)` bytes as the request is being sent.
   * Only invoked when `formData` is also provided.
   */
  onUploadProgress?: (loaded: number, total: number) => void;
  /** Connection ID — required for request deduplication key isolation */
  connectionId?: string;
  /** Enable Automatic Persisted Queries two-step flow (default: false) */
  apqEnabled?: boolean;
  /** When APQ is on: use GET for hash-only query requests (default: false) */
  apqUseGet?: boolean;
  /** Enable request deduplication (default: false) */
  dedupEnabled?: boolean;
  /** Operation type — determines GET eligibility for APQ (default: 'query') */
  operationType?: 'query' | 'mutation';
  /** When true, skip the dedup check AND dedup registration (Send anyway — run alongside original) */
  _skipDedupCheck?: boolean;
  /** When true, skip only the dedup check but still register (Cancel original — replacement tracks as new dedup entry) */
  _skipDedupCheckOnly?: boolean;
  /** Owning studio tab — attributes in-flight state per tab (Phase 6A). */
  sourceTabId?: string;
  /** Phase 6H — auth provenance for Metadata "auth sent" row. */
  authSentStamp?: AuthSentStampInput;
  /** Invoked when execution actually starts loading (after dedup guard passes). */
  onExecutionStarted?: (tabId: string) => void;
  /** Invoked when a dedup waiter receives the shared result (Phase 6A — per-tab cache). */
  onExecutionCompleted?: (
    tabId: string,
    status: ExecutionStatus,
    response: GraphqlResponse | null,
    apqInfo?: ApqInfo | null,
  ) => void;
}

export interface ApqInfo {
  hash: string;
  cacheHit: boolean;
  unsupported: boolean;
  /** Endpoint/connection id that produced this APQ result (Phase 6 multi-tab). */
  connectionId?: string;
}

export interface UseGraphqlExecution {
  status: ExecutionStatus;
  response: GraphqlResponse | null;
  execute: (params: ExecuteParams) => void;
  cancel: () => void;
  /** true when a dedup situation is pending user choice */
  isDuplicate: boolean;
  /** Studio tab that triggered the pending dedup prompt (Phase 6A multi-tab). */
  duplicateSourceTabId: string | null;
  /** APQ metadata from the last completed APQ request */
  apqInfo: ApqInfo | null;
  /** Resolve a pending dedup situation */
  resolveDedupChoice: (choice: DedupChoice) => void;
  /** Apply a completed response without sending a network request (batch sync). */
  applyResult: (status: ExecutionStatus, response: GraphqlResponse | null) => void;
}
