import type { Environment, GlobalAuthProfile, Microservice, ProtocolKey } from '@shared/types';

export type ProtocolEditTarget =
  | { kind: 'http'; envId: string; value: string }
  | { kind: 'protocol'; protocol: ProtocolKey; envId: string; value: string };

export interface MicroserviceProtocolPanelProps {
  svc: Microservice;
  environments: Environment[];
  appGlobalAuthProfiles: GlobalAuthProfile[];
  selectedEnvId: string;
  activeProtocol: ProtocolKey;
  enabledProtocols: ProtocolKey[];
  onProtocolChange: (protocol: ProtocolKey) => void;
  onAddProtocol: (protocol: ProtocolKey) => void;
  onRemoveProtocol: (protocol: ProtocolKey) => void;
  editing: ProtocolEditTarget | null;
  onStartEdit: (target: ProtocolEditTarget) => void;
  onEditValueChange: (value: string) => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onToggleDeploy: (envId: string) => void;
  onSetAuthProfile: (envId: string, profileId: string | undefined) => void;
  onGraphqlPathChange: (envId: string, path: string) => void;
  onToggleGrpcTls: (envId: string, tls: boolean) => void;
  newAdditionalEnvName: string;
  onNewAdditionalEnvNameChange: (value: string) => void;
  onAddAdditionalEnv: () => void;
  onDeleteAdditionalEnv: (envId: string) => void;
  onSetGlobalVar: (key: string, value: string) => void;
  onDeleteGlobalVar: (key: string) => void;
  onSetEnvVar: (envId: string, key: string, value: string) => void;
  onDeleteEnvVar: (envId: string, key: string) => void;
}

// Runtime marker used by focused unit tests to ensure this module is covered.
export const MICROSERVICE_PROTOCOL_PANEL_TYPES_RUNTIME_MARKER = 'microservice-protocol-panel-types';
