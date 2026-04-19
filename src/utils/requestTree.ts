import { v4 as uuidv4 } from 'uuid';
import type { RequestFolder, RequestItem, RequestCollection } from '../types';

export function countGroupRequests(groupId: string, collections: RequestCollection[]): number {
  let total = 0;
  for (const c of collections) {
    if (c.groupId !== groupId) continue;
    if (c.mode === 'group') {
      total += countGroupRequests(c.id, collections);
    } else {
      total += countAllRequests(c);
    }
  }
  return total;
}

export function collectGroupIds(groupId: string, collections: RequestCollection[]): string[] {
  const ids: string[] = [groupId];
  for (const c of collections) {
    if (c.groupId === groupId && c.mode === 'group') {
      ids.push(...collectGroupIds(c.id, collections));
    }
  }
  return ids;
}

export function collectAllGroups(collections: RequestCollection[], parentGroupId?: string, depth = 0): { group: RequestCollection; depth: number }[] {
  const result: { group: RequestCollection; depth: number }[] = [];
  for (const c of collections) {
    if (c.mode !== 'group') continue;
    if ((c.groupId ?? undefined) !== parentGroupId) continue;
    result.push({ group: c, depth });
    result.push(...collectAllGroups(collections, c.id, depth + 1));
  }
  return result;
}

export function findFolderDeep(folders: RequestFolder[], folderId: string): RequestFolder | null {
  for (const f of folders) {
    if (f.id === folderId) return f;
    const deep = findFolderDeep(f.folders ?? [], folderId);
    if (deep) return deep;
  }
  return null;
}

export function findReqInFolders(folders: RequestFolder[], reqId: string): RequestItem | null {
  for (const f of folders) {
    const r = f.requests.find((r) => r.id === reqId);
    if (r) return r;
    const deep = findReqInFolders(f.folders ?? [], reqId);
    if (deep) return deep;
  }
  return null;
}

export function findRequestInCollection(col: RequestCollection, reqId: string): RequestItem | null {
  return col.requests.find((r) => r.id === reqId) ?? findReqInFolders(col.folders ?? [], reqId);
}

export function countReqsInFolders(folders: RequestFolder[]): number {
  return folders.reduce((sum, f) => sum + f.requests.length + countReqsInFolders(f.folders ?? []), 0);
}

export function countAllRequests(col: RequestCollection): number {
  return col.requests.length + countReqsInFolders(col.folders ?? []);
}

export function mapReqInFolders(folders: RequestFolder[], reqId: string, fn: (r: RequestItem) => RequestItem): RequestFolder[] {
  return folders.map((f) => ({
    ...f,
    requests: f.requests.map((r) => r.id === reqId ? fn(r) : r),
    folders: mapReqInFolders(f.folders ?? [], reqId, fn),
  }));
}

export function mapRequests(col: RequestCollection, reqId: string, fn: (r: RequestItem) => RequestItem): RequestCollection {
  return {
    ...col,
    requests: col.requests.map((r) => r.id === reqId ? fn(r) : r),
    folders: mapReqInFolders(col.folders ?? [], reqId, fn),
  };
}

export function removeReqFromFolders(folders: RequestFolder[], reqId: string): RequestFolder[] {
  return folders.map((f) => ({
    ...f,
    requests: f.requests.filter((r) => r.id !== reqId),
    folders: removeReqFromFolders(f.folders ?? [], reqId),
  }));
}

export function removeRequestFrom(col: RequestCollection, reqId: string): RequestCollection {
  return {
    ...col,
    requests: col.requests.filter((r) => r.id !== reqId),
    folders: removeReqFromFolders(col.folders ?? [], reqId),
  };
}

export function mapFolderDeep(folders: RequestFolder[], folderId: string, fn: (f: RequestFolder) => RequestFolder): RequestFolder[] {
  return folders.map((f) => {
    if (f.id === folderId) return fn(f);
    return { ...f, folders: mapFolderDeep(f.folders ?? [], folderId, fn) };
  });
}

export function addToFolderDeep(folders: RequestFolder[], parentId: string, child: RequestFolder): RequestFolder[] {
  return folders.map((f) => {
    if (f.id === parentId) return { ...f, folders: [...(f.folders ?? []), child] };
    return { ...f, folders: addToFolderDeep(f.folders ?? [], parentId, child) };
  });
}

export function removeFolderDeep(folders: RequestFolder[], folderId: string): { folders: RequestFolder[]; orphaned: RequestItem[] } {
  const result: RequestFolder[] = [];
  let orphaned: RequestItem[] = [];
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

export function collectAllRequests(folder: RequestFolder): RequestItem[] {
  return [...folder.requests, ...(folder.folders ?? []).flatMap(collectAllRequests)];
}

export function cloneRequest(r: RequestItem): RequestItem {
  return { ...r, id: uuidv4() };
}

export function cloneFolder(f: RequestFolder): RequestFolder {
  return {
    ...f, id: uuidv4(),
    requests: f.requests.map(cloneRequest),
    folders: (f.folders ?? []).map(cloneFolder),
  };
}

export function extractFolderDeep(folders: RequestFolder[], folderId: string): { remaining: RequestFolder[]; extracted: RequestFolder | null } {
  const remaining: RequestFolder[] = [];
  let extracted: RequestFolder | null = null;
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

export function isDescendantOf(folders: RequestFolder[], ancestorId: string, descendantId: string): boolean {
  const ancestor = findFolderDeep(folders, ancestorId);
  if (!ancestor) return false;
  return !!findFolderDeep(ancestor.folders ?? [], descendantId);
}

export function addReqToFolderDeep(folders: RequestFolder[], folderId: string, req: RequestItem, beforeReqId?: string): RequestFolder[] {
  return folders.map((f) => {
    if (f.id === folderId) {
      if (beforeReqId) {
        const idx = f.requests.findIndex(r => r.id === beforeReqId);
        if (idx >= 0) {
          const reqs = [...f.requests];
          reqs.splice(idx, 0, req);
          return { ...f, requests: reqs };
        }
      }
      return { ...f, requests: [...f.requests, req] };
    }
    return { ...f, folders: addReqToFolderDeep(f.folders ?? [], folderId, req, beforeReqId) };
  });
}

export function addReqToFolderSafe(col: RequestCollection, folderId: string, req: RequestItem, beforeReqId?: string): RequestCollection {
  const updatedFolders = addReqToFolderDeep(col.folders ?? [], folderId, req, beforeReqId);
  const inserted = !!findReqInFolders(updatedFolders, req.id);
  if (inserted) return { ...col, folders: updatedFolders };
  return { ...col, requests: [...col.requests, req] };
}

export function addFolderToParentSafe(folders: RequestFolder[], parentId: string, child: RequestFolder): RequestFolder[] {
  const updated = addToFolderDeep(folders, parentId, child);
  if (findFolderDeep(updated, child.id)) return updated;
  return [...folders, child];
}

export function findReqParentFolder(folders: RequestFolder[], reqId: string): RequestFolder | null {
  for (const f of folders) {
    if (f.requests.some((r) => r.id === reqId)) return f;
    const deep = findReqParentFolder(f.folders ?? [], reqId);
    if (deep) return deep;
  }
  return null;
}

export function reorderInFolders(folders: RequestFolder[], folderId: string, beforeId: string | null): RequestFolder[] {
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

export function swapInFolders(folders: RequestFolder[], folderId: string, direction: 'up' | 'down'): RequestFolder[] {
  const arr = [...folders];
  const idx = arr.findIndex((f) => f.id === folderId);
  if (idx >= 0) {
    const swap = direction === 'up' ? idx - 1 : idx + 1;
    if (swap >= 0 && swap < arr.length) { [arr[idx], arr[swap]] = [arr[swap], arr[idx]]; }
    return arr;
  }
  return arr.map((f) => ({ ...f, folders: swapInFolders(f.folders ?? [], folderId, direction) }));
}
