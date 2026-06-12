import { v4 as uuid } from 'uuid';
import type { WsNodeHeaderRow, WsExtractionRule, WsMatchCriteria } from '../../types/workflow';

export function createWsHeaderRow(): WsNodeHeaderRow {
  return { id: uuid().slice(0, 8), key: '', value: '', enabled: true };
}

export function createWsExtractionRule(): WsExtractionRule {
  return { variableName: '', jsonPath: '' };
}

export const MSG_TYPE_FILTER_OPTIONS: { value: NonNullable<WsMatchCriteria['messageType']>; label: string }[] = [
  { value: 'any', label: 'Any' },
  { value: 'text', label: 'Text only' },
  { value: 'binary', label: 'Binary only' },
];
