import { readKey, writeKey } from '../utils/storage';
import type { WsConnectionProfile, WsMessageTemplate } from './types';

export const WS_PROFILES_KEY = 'redfire-ws-profiles-v1';
export const WS_TEMPLATES_KEY = 'redfire-ws-templates-v1';

function isValidProfile(entry: unknown): entry is WsConnectionProfile {
  if (typeof entry !== 'object' || entry === null) return false;
  const e = entry as Record<string, unknown>;
  return (
    typeof e.id === 'string' &&
    typeof e.name === 'string' &&
    typeof e.url === 'string'
  );
}

function isValidTemplate(entry: unknown): entry is WsMessageTemplate {
  if (typeof entry !== 'object' || entry === null) return false;
  const e = entry as Record<string, unknown>;
  return (
    typeof e.id === 'string' &&
    typeof e.name === 'string' &&
    typeof e.body === 'string'
  );
}

function parseArray<T>(raw: string, validator: (v: unknown) => v is T): T[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(validator);
  } catch {
    return [];
  }
}

export async function loadWsProfiles(): Promise<WsConnectionProfile[]> {
  const raw = await readKey(WS_PROFILES_KEY);
  if (!raw) return [];
  return parseArray(raw, isValidProfile);
}

export async function saveWsProfiles(profiles: WsConnectionProfile[]): Promise<void> {
  await writeKey(WS_PROFILES_KEY, JSON.stringify(profiles));
}

export async function loadWsTemplates(): Promise<WsMessageTemplate[]> {
  const raw = await readKey(WS_TEMPLATES_KEY);
  if (!raw) return [];
  return parseArray(raw, isValidTemplate);
}

export async function saveWsTemplates(templates: WsMessageTemplate[]): Promise<void> {
  await writeKey(WS_TEMPLATES_KEY, JSON.stringify(templates));
}
