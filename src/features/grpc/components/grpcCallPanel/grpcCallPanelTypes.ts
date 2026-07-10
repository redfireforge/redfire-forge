import type { GlobalAuthProfile } from '../../../../shared/types';
import type { GrpcMethodInfo, GrpcMessageSchema } from '../../../../shared/grpc/contracts';
import type { GrpcStudioTabState, GrpcExecuteOverrides } from '../../grpcStudioTypes';
import type { GrpcAuthSecretFieldKey } from '../../utils/grpcSecretFieldUi';

export type { GrpcComposerTab } from '../../utils/grpcComposerTabState';

export type GrpcMobileStage = 'request' | 'response' | 'metadata' | 'auth';

export interface GrpcCallPanelProps {
  tab: GrpcStudioTabState;
  method?: GrpcMethodInfo;
  messageTypes?: GrpcMessageSchema[];
  descriptorSource?: import('../../../../shared/grpc/contracts').GrpcDescriptor['source'];
  serviceFullName?: string;
  targetValid?: boolean;
  tlsValid?: boolean;
  targetAddress?: string;
  disabled?: boolean;
  /** Blocks Send/Start stream while still allowing request editing (schema drift). */
  executeBlocked?: boolean;
  descriptorLoading?: boolean;
  onPatch: (patch: Partial<GrpcStudioTabState>) => void;
  onSendUnary?: (overrides?: GrpcExecuteOverrides) => void;
  onCancelUnary?: () => void;
  onStartStream?: (overrides?: GrpcExecuteOverrides) => void;
  onCancelStream?: () => void;
  onSendStreamMessage?: (overrides?: GrpcExecuteOverrides) => void;
  onEnqueueStreamMessage?: (overrides?: GrpcExecuteOverrides) => void;
  onRemovePendingStreamMessage?: (index: number) => void;
  onSendAllPendingStreamMessages?: () => void | Promise<void>;
  onEndStream?: () => void;
  onClearStreamLog?: () => void;
  onRetryUnaryWithExpress?: () => void;
  onRetryStreamWithExpress?: () => void;
  onUnmaskAuthSecretField?: (field: GrpcAuthSecretFieldKey) => void;
  onClearAuthSecretField?: (field: GrpcAuthSecretFieldKey) => void;
  globalAuthProfiles?: GlobalAuthProfile[];
  defaultAuthProfileId?: string | null;
  /** Increment from connection bar to focus Auth tab (Phase 4J-A). */
  authTabFocusRequest?: number;
}
