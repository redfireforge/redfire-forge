import type { ProtocolKey } from '@shared/types';

export type ActiveEdit =
  | { svcId: string; kind: 'http'; envId: string; value: string }
  | { svcId: string; kind: 'protocol'; protocol: ProtocolKey; envId: string; value: string };

export function mergeEditValue(
  prev: ActiveEdit | null,
  svcId: string,
  value: string,
): ActiveEdit | null {
  return prev && prev.svcId === svcId ? { ...prev, value } : prev;
}

export interface SaveEditHandlers {
  saveHttp: (envId: string, value: string) => void;
  saveProtocol: (protocol: ProtocolKey, envId: string, value: string) => void;
}

export function runSaveEdit(
  editing: ActiveEdit | null,
  svcId: string,
  handlers: SaveEditHandlers,
): void {
  if (!editing || editing.svcId !== svcId) return;
  if (editing.kind === 'http') handlers.saveHttp(editing.envId, editing.value);
  else handlers.saveProtocol(editing.protocol, editing.envId, editing.value);
}

export function shouldClearEditingOnProtocolChange(
  editing: ActiveEdit | null,
  svcId: string,
): boolean {
  return !!editing && editing.svcId === svcId;
}
