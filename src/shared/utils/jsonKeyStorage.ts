import { readKey, writeKey } from './storage';

export async function readJsonArray<T>(key: string): Promise<T[]> {
  try {
    const raw = await readKey(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export async function readJsonObject<T>(key: string): Promise<T | null> {
  try {
    const raw = await readKey(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await writeKey(key, JSON.stringify(value));
  } catch {
    // storage quota exceeded or private browsing — no-op
  }
}
