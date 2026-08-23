import type { GlobalAuthProfile } from '@shared/types';
import type { EndpointRowStatus } from '../environments/utils/protocolEndpointUtils';
import type {
  WsConnectionDraft,
  WsLeftTab,
  WsRightTab,
  WsStudioMode,
  WsTlsConfig,
  WsConnectionHistoryEntry,
  WsProtocolMode,
} from '@shared/websocket/types';
import type { UseWebSocketProfilesReturn } from '@app/hooks/useWebSocketProfiles';
import type { UseWebSocketTemplatesReturn } from '@app/hooks/useWebSocketTemplates';
import type { ConnectionStateHint } from './WsConnectionTabBar';

export interface WsConnectionTabContentHandle {
  getConnectionState: () => ConnectionStateHint;
  getUrl: () => string;
  getMessageCount: () => number;
  getDraft: () => WsConnectionDraft;
  prepareForTlsLesson: () => void;
  applyTlsConfig: (patch: Partial<WsTlsConfig>) => void;
}

export interface WsConnectionTabContentProps {
  tabId: string;
  envVarMap: Record<string, string>;
  endpointProtocolStatus?: EndpointRowStatus;
  globalAuthProfiles?: GlobalAuthProfile[];
  profilesHook: UseWebSocketProfilesReturn;
  templatesHook: UseWebSocketTemplatesReturn;
  mockPort: number;
  onMockPortChange?: (tabId: string, newPort: number) => void;
  onConnectionStateChange: (tabId: string, state: ConnectionStateHint, protocolMode?: WsProtocolMode) => void;
  onUrlChange: (tabId: string, url: string) => void;
  onDraftChange?: (tabId: string) => void;
  initialUrl?: string;
  initialProtocol?: WsProtocolMode;
  initialDraft?: Partial<WsConnectionDraft>;
  controlledLeftTab?: WsLeftTab;
  controlledMode: WsStudioMode;
  controlledRightTab?: WsRightTab;
  onModeChange?: (mode: WsStudioMode) => void;
  onLeftTabChange?: (tab: WsLeftTab) => void;
  onRightTabChange?: (tab: WsRightTab) => void;
  history?: WsConnectionHistoryEntry[];
  onClearHistory?: () => void;
}
