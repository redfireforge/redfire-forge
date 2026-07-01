/**
 * Phase 3B — client helpers for proto file / protoset ingest.
 */

export interface GrpcProtoFileDraft {
  path: string;
  content: string;
  sizeBytes: number;
}

export function normalizeUploadedProtoPath(file: File): string {
  const relative = (file as File & { webkitRelativePath?: string }).webkitRelativePath?.trim();
  const raw = relative || file.name;
  return raw.trim().replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\.\//, '');
}

export function normalizeImportRoot(path: string): string {
  return path.trim().replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/+$/, '');
}

export async function readProtoFilesFromFileList(files: FileList | File[]): Promise<GrpcProtoFileDraft[]> {
  const list = Array.from(files).filter((file) => file.name.endsWith('.proto'));
  if (list.length === 0) {
    throw new Error('Select at least one .proto file');
  }
  const drafts: GrpcProtoFileDraft[] = [];
  for (const file of list) {
    const content = await file.text();
    drafts.push({
      path: normalizeUploadedProtoPath(file),
      content,
      sizeBytes: file.size,
    });
  }
  return drafts;
}

export async function readProtosetBase64FromFile(file: File): Promise<{ base64: string; fileName: string }> {
  const name = file.name.trim();
  if (!name.endsWith('.pb') && !name.endsWith('.protoset')) {
    throw new Error('Protoset file must use .pb or .protoset extension');
  }
  const buffer = await file.arrayBuffer();
  if (buffer.byteLength === 0) {
    throw new Error('Protoset file is empty');
  }
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return {
    base64: btoa(binary),
    fileName: name,
  };
}

export function formatProtoFileSize(sizeBytes: number): string {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function mergeProtoFileDrafts(
  existing: Array<{ path: string; content: string; sizeBytes?: number }>,
  incoming: GrpcProtoFileDraft[],
): Array<{ path: string; content: string; sizeBytes: number }> {
  const byPath = new Map<string, { path: string; content: string; sizeBytes: number }>();
  for (const file of existing) {
    byPath.set(file.path, {
      path: file.path,
      content: file.content,
      sizeBytes: file.sizeBytes ?? file.content.length,
    });
  }
  for (const draft of incoming) {
    byPath.set(draft.path, {
      path: draft.path,
      content: draft.content,
      sizeBytes: draft.sizeBytes,
    });
  }
  return [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path));
}
