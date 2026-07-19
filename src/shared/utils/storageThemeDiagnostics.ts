import { THEME_KEY } from './storageKeys';
import { formatStorageDiagnostics } from './storageUiPrefs';
import { getStorageUsage, readKey, writeKey } from './storage';

export async function saveTheme(theme: string): Promise<void> {
  await writeKey(THEME_KEY, theme);
}

export async function loadTheme(): Promise<string> {
  return (await readKey(THEME_KEY)) ?? 'dark';
}

export async function getStorageDiagnostics(): Promise<string> {
  const usage = await getStorageUsage();
  return formatStorageDiagnostics(usage);
}
