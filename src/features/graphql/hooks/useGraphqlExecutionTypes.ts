/**
 * Types for useGraphqlExecution — extracted to keep the hook module under 900 lines.
 */
import type { GraphqlResponse } from '../../../shared/types/graphql';
import type { GqlTlsSettings } from '../../../shared/types/gqlTls';
import type { DedupChoice } from '../utils/dedupExecution';
import type { AuthSentStampInput } from '../utils/graphqlExecutionResponseParsing';

export type ExecutionStatus = 'idle' | 'loading' | 'success' | 'error';

export interface ExecuteParams {
  endpoint: string;
  query: string;
  variables: string;
  operationName?: string;
  headers: Record<string, string>;
  skipTlsVerify?: boolean;
  tls?: GqlTlsSettings;
  formData?: FormData;
  onUploadProgress?: (loaded: number, total: number) => void;
  connectionId?: string;
  apqEnabled?: boolean;
  apqUseGet?: boolean;
  dedupEnabled?: boolean;
  operationType?: 'query' | 'mutation';
  _skipDedupCheck?: boolean;
  _skipDedupCheckOnly?: boolean;
  sourceTabId?: string;
  /** Phase 6H — auth provenance for Metadata "auth sent" row. */
  authSentStamp?: AuthSentStampInput;
  onExecutionStarted?: (tabId: string) => void;
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
  connectionId?: string;
}

export interface UseGraphqlExecution {
  status: ExecutionStatus;
  response: GraphqlResponse | null;
  execute: (params: ExecuteParams) => void;
  cancel: () => void;
  isDuplicate: boolean;
  duplicateSourceTabId: string | null;
  apqInfo: ApqInfo | null;
  resolveDedupChoice: (choice: DedupChoice) => void;
}
