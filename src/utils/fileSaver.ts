import { isTauri } from './platform';

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function buildExportFilename(parts: {
  env?: string;
  svc?: string;
  level: string;
  name?: string;
  date?: string;
  ext?: string;
}): string {
  const date = parts.date || new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const ext = parts.ext || 'json';
  const segments = [
    parts.env && slugify(parts.env),
    parts.svc && slugify(parts.svc),
    slugify(parts.level),
    parts.name && slugify(parts.name),
    date,
  ].filter(Boolean);
  return `${segments.join('-')}.${ext}`;
}

interface SaveOptions {
  filename: string;
  mimeType: string;
  description?: string;
}

function getExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot >= 0 ? filename.slice(dot) : '';
}

export async function saveFile(blob: Blob, opts: SaveOptions): Promise<void> {
  if (isTauri()) {
    return tauriSaveFile(blob, opts);
  }
  return browserSaveFile(blob, opts);
}

async function tauriSaveFile(blob: Blob, opts: SaveOptions): Promise<void> {
  const { save } = await import('@tauri-apps/plugin-dialog');
  const { writeTextFile } = await import('@tauri-apps/plugin-fs');
  const ext = getExtension(opts.filename).replace('.', '') || 'json';
  const path = await save({
    defaultPath: opts.filename,
    filters: [{ name: opts.description ?? 'File', extensions: [ext] }],
  });
  if (!path) return;
  const text = await blob.text();
  await writeTextFile(path, text);
}

async function browserSaveFile(blob: Blob, opts: SaveOptions): Promise<void> {
  if ('showSaveFilePicker' in window) {
    try {
      const ext = getExtension(opts.filename) || '.json';
      const handle = await (window as unknown as { showSaveFilePicker: (o: unknown) => Promise<FileSystemFileHandle> })
        .showSaveFilePicker({
          suggestedName: opts.filename,
          types: [{
            description: opts.description ?? 'File',
            accept: { [opts.mimeType]: [ext] },
          }],
        });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = opts.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function saveJsonFile(data: unknown, filename: string): Promise<void> {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  await saveFile(blob, { filename, mimeType: 'application/json', description: 'JSON file' });
}

export async function saveCsvFile(content: string, filename: string): Promise<void> {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  await saveFile(blob, { filename, mimeType: 'text/csv', description: 'CSV file' });
}
