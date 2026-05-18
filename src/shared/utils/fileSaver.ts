import { isTauri } from './platform';

const EXPORT_DIR_NAME = 'RedfireForge';

async function getDefaultExportDir(): Promise<string | undefined> {
  if (!isTauri()) return undefined;
  try {
    const { documentDir } = await import('@tauri-apps/api/path');
    const { mkdir, exists } = await import('@tauri-apps/plugin-fs');
    const docDir = await documentDir();
    const sep = docDir.endsWith('/') || docDir.endsWith('\\') ? '' : '/';
    const exportDir = `${docDir}${sep}${EXPORT_DIR_NAME}`;
    if (!(await exists(exportDir))) {
      await mkdir(exportDir, { recursive: true });
    }
    return exportDir;
  } catch {
    return undefined;
  }
}

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
  const exportDir = await getDefaultExportDir();
  const sep = exportDir?.endsWith('/') || exportDir?.endsWith('\\') ? '' : '/';
  const defaultPath = exportDir ? `${exportDir}${sep}${opts.filename}` : opts.filename;
  const path = await save({
    defaultPath,
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

export async function savePngFile(dataUrl: string, filename: string): Promise<void> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  await saveFile(blob, { filename, mimeType: 'image/png', description: 'PNG image' });
}

export async function saveSvgFile(dataUrl: string, filename: string): Promise<void> {
  const decoded = decodeURIComponent(dataUrl.split(',')[1] || '');
  const blob = new Blob([decoded], { type: 'image/svg+xml' });
  await saveFile(blob, { filename, mimeType: 'image/svg+xml', description: 'SVG image' });
}

export async function openJsonFile(): Promise<{ name: string; content: string } | null> {
  if (!isTauri()) return null;
  const { open } = await import('@tauri-apps/plugin-dialog');
  const { readTextFile } = await import('@tauri-apps/plugin-fs');
  const exportDir = await getDefaultExportDir();
  const path = await open({
    defaultPath: exportDir ?? undefined,
    filters: [{ name: 'JSON file', extensions: ['json'] }],
    multiple: false,
    directory: false,
  });
  if (!path) return null;
  const content = await readTextFile(path as string);
  const name = (path as string).split('/').pop() || (path as string).split('\\').pop() || 'import.json';
  return { name, content };
}
