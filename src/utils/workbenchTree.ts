import { v4 as uuidv4 } from 'uuid';
import type { WorkbenchFolder, WorkbenchRequest, WorkbenchCollection } from '../types';

export function findFolderDeep(folders: WorkbenchFolder[], folderId: string): WorkbenchFolder | null {
  for (const f of folders) {
    if (f.id === folderId) return f;
    const deep = findFolderDeep(f.folders ?? [], folderId);
    if (deep) return deep;
  }
  return null;
}

export function findReqInFolders(folders: WorkbenchFolder[], reqId: string): WorkbenchRequest | null {
  for (const f of folders) {
    const r = f.requests.find((r) => r.id === reqId);
    if (r) return r;
    const deep = findReqInFolders(f.folders ?? [], reqId);
    if (deep) return deep;
  }
  return null;
}

export function findRequestInCollection(col: WorkbenchCollection, reqId: string): WorkbenchRequest | null {
  return col.requests.find((r) => r.id === reqId) ?? findReqInFolders(col.folders ?? [], reqId);
}

export function countReqsInFolders(folders: WorkbenchFolder[]): number {
  return folders.reduce((sum, f) => sum + f.requests.length + countReqsInFolders(f.folders ?? []), 0);
}

export function countAllRequests(col: WorkbenchCollection): number {
  return col.requests.length + countReqsInFolders(col.folders ?? []);
}

export function mapReqInFolders(folders: WorkbenchFolder[], reqId: string, fn: (r: WorkbenchRequest) => WorkbenchRequest): WorkbenchFolder[] {
  return folders.map((f) => ({
    ...f,
    requests: f.requests.map((r) => r.id === reqId ? fn(r) : r),
    folders: mapReqInFolders(f.folders ?? [], reqId, fn),
  }));
}

export function mapRequests(col: WorkbenchCollection, reqId: string, fn: (r: WorkbenchRequest) => WorkbenchRequest): WorkbenchCollection {
  return {
    ...col,
    requests: col.requests.map((r) => r.id === reqId ? fn(r) : r),
    folders: mapReqInFolders(col.folders ?? [], reqId, fn),
  };
}

export function removeReqFromFolders(folders: WorkbenchFolder[], reqId: string): WorkbenchFolder[] {
  return folders.map((f) => ({
    ...f,
    requests: f.requests.filter((r) => r.id !== reqId),
    folders: removeReqFromFolders(f.folders ?? [], reqId),
  }));
}

export function removeRequestFrom(col: WorkbenchCollection, reqId: string): WorkbenchCollection {
  return {
    ...col,
    requests: col.requests.filter((r) => r.id !== reqId),
    folders: removeReqFromFolders(col.folders ?? [], reqId),
  };
}

export function mapFolderDeep(folders: WorkbenchFolder[], folderId: string, fn: (f: WorkbenchFolder) => WorkbenchFolder): WorkbenchFolder[] {
  return folders.map((f) => {
    if (f.id === folderId) return fn(f);
    return { ...f, folders: mapFolderDeep(f.folders ?? [], folderId, fn) };
  });
}

export function addToFolderDeep(folders: WorkbenchFolder[], parentId: string, child: WorkbenchFolder): WorkbenchFolder[] {
  return folders.map((f) => {
    if (f.id === parentId) return { ...f, folders: [...(f.folders ?? []), child] };
    return { ...f, folders: addToFolderDeep(f.folders ?? [], parentId, child) };
  });
}

export function removeFolderDeep(folders: WorkbenchFolder[], folderId: string): { folders: WorkbenchFolder[]; orphaned: WorkbenchRequest[] } {
  const result: WorkbenchFolder[] = [];
  let orphaned: WorkbenchRequest[] = [];
  for (const f of folders) {
    if (f.id === folderId) {
      orphaned = collectAllRequests(f);
      continue;
    }
    const sub = removeFolderDeep(f.folders ?? [], folderId);
    orphaned = [...orphaned, ...sub.orphaned];
    result.push({ ...f, folders: sub.folders });
  }
  return { folders: result, orphaned };
}

export function collectAllRequests(folder: WorkbenchFolder): WorkbenchRequest[] {
  return [...folder.requests, ...(folder.folders ?? []).flatMap(collectAllRequests)];
}

export function cloneRequest(r: WorkbenchRequest): WorkbenchRequest {
  return { ...r, id: uuidv4() };
}

export function cloneFolder(f: WorkbenchFolder): WorkbenchFolder {
  return {
    ...f, id: uuidv4(),
    requests: f.requests.map(cloneRequest),
    folders: (f.folders ?? []).map(cloneFolder),
  };
}

export function extractFolderDeep(folders: WorkbenchFolder[], folderId: string): { remaining: WorkbenchFolder[]; extracted: WorkbenchFolder | null } {
  const remaining: WorkbenchFolder[] = [];
  let extracted: WorkbenchFolder | null = null;
  for (const f of folders) {
    if (f.id === folderId) {
      extracted = f;
      continue;
    }
    const sub = extractFolderDeep(f.folders ?? [], folderId);
    if (sub.extracted) extracted = sub.extracted;
    remaining.push({ ...f, folders: sub.remaining });
  }
  return { remaining, extracted };
}

export function isDescendantOf(folders: WorkbenchFolder[], ancestorId: string, descendantId: string): boolean {
  const ancestor = findFolderDeep(folders, ancestorId);
  if (!ancestor) return false;
  return !!findFolderDeep(ancestor.folders ?? [], descendantId);
}

export function addReqToFolderDeep(folders: WorkbenchFolder[], folderId: string, req: WorkbenchRequest): WorkbenchFolder[] {
  return folders.map((f) => {
    if (f.id === folderId) return { ...f, requests: [...f.requests, req] };
    return { ...f, folders: addReqToFolderDeep(f.folders ?? [], folderId, req) };
  });
}

export function findReqParentFolder(folders: WorkbenchFolder[], reqId: string): WorkbenchFolder | null {
  for (const f of folders) {
    if (f.requests.some((r) => r.id === reqId)) return f;
    const deep = findReqParentFolder(f.folders ?? [], reqId);
    if (deep) return deep;
  }
  return null;
}

export function reorderInFolders(folders: WorkbenchFolder[], folderId: string, beforeId: string | null): WorkbenchFolder[] {
  const flat = [...folders];
  const srcIdx = flat.findIndex((f) => f.id === folderId);
  if (srcIdx < 0) {
    return flat.map((f) => ({ ...f, folders: reorderInFolders(f.folders ?? [], folderId, beforeId) }));
  }
  const [moved] = flat.splice(srcIdx, 1);
  if (beforeId === null) { flat.push(moved); }
  else { const tgt = flat.findIndex((f) => f.id === beforeId); tgt < 0 ? flat.push(moved) : flat.splice(tgt, 0, moved); }
  return flat;
}

export function swapInFolders(folders: WorkbenchFolder[], folderId: string, direction: 'up' | 'down'): WorkbenchFolder[] {
  const arr = [...folders];
  const idx = arr.findIndex((f) => f.id === folderId);
  if (idx >= 0) {
    const swap = direction === 'up' ? idx - 1 : idx + 1;
    if (swap >= 0 && swap < arr.length) { [arr[idx], arr[swap]] = [arr[swap], arr[idx]]; }
    return arr;
  }
  return arr.map((f) => ({ ...f, folders: swapInFolders(f.folders ?? [], folderId, direction) }));
}
