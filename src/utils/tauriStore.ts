/**
 * Tauri file-system backed storage.
 * Stores each key as a separate JSON file under $APPDATA/redfireforge/.
 * The API mirrors localStorage's getItem/setItem/removeItem pattern.
 */

let fsModule: typeof import('@tauri-apps/plugin-fs') | null = null;
let appDirPath: string | null = null;
let ready = false;

async function ensureReady(): Promise<void> {
  if (ready) return;
  const fs = await import('@tauri-apps/plugin-fs');
  const { appDataDir } = await import('@tauri-apps/api/path');
  fsModule = fs;
  appDirPath = await appDataDir();
  try {
    await fs.mkdir(appDirPath, { recursive: true });
  } catch {
    // already exists
  }
  ready = true;
}

function keyToFile(key: string): string {
  const sep = appDirPath!.endsWith('/') ? '' : '/';
  return `${appDirPath}${sep}${key}.json`;
}

export async function getItem(key: string): Promise<string | null> {
  await ensureReady();
  try {
    return await fsModule!.readTextFile(keyToFile(key));
  } catch {
    return null;
  }
}

export async function setItem(key: string, value: string): Promise<void> {
  await ensureReady();
  await fsModule!.writeTextFile(keyToFile(key), value);
}

export async function removeItem(key: string): Promise<void> {
  await ensureReady();
  try {
    await fsModule!.remove(keyToFile(key));
  } catch {
    // file may not exist
  }
}

export async function listKeys(): Promise<string[]> {
  await ensureReady();
  try {
    const entries = await fsModule!.readDir(appDirPath!);
    return entries
      .filter((e) => e.name?.endsWith('.json'))
      .map((e) => e.name!.replace(/\.json$/, ''));
  } catch {
    return [];
  }
}

export async function getUsageBytes(): Promise<{ usedBytes: number; entries: Record<string, number> }> {
  await ensureReady();
  const entries: Record<string, number> = {};
  let total = 0;
  try {
    const dirEntries = await fsModule!.readDir(appDirPath!);
    for (const entry of dirEntries) {
      if (entry.name?.endsWith('.json')) {
        const key = entry.name.replace(/\.json$/, '');
        if (key.startsWith('perf-test')) {
          try {
            const content = await fsModule!.readTextFile(keyToFile(key));
            const size = content.length * 2;
            entries[key] = size;
            total += size;
          } catch { /* skip */ }
        }
      }
    }
  } catch { /* empty dir */ }
  return { usedBytes: total, entries };
}
