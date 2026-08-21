/**
 * Folder hierarchy for the API Mock sidebar.
 *
 * Servers carry a single `serverFolder` string.  To support nesting *without*
 * a separate persisted folder registry, that string is treated as a `/`-joined
 * path — e.g. `"Team APIs/QA/Smoke"`.  A server always belongs to the leaf-most
 * folder in its path; every ancestor prefix is an implied folder.
 *
 * These helpers are pure so they can be unit-tested in isolation and reused by
 * the sidebar for create / rename / move / delete operations.
 */

export const FOLDER_SEP = '/';

export interface FolderTreeNode {
  /** Full `/`-joined path, e.g. "A/B". */
  path: string;
  /** Leaf display name, e.g. "B". */
  name: string;
  /** Nesting depth (0 = top level). */
  depth: number;
  children: FolderTreeNode[];
}

/** Split a folder path into its segments. */
export function folderSegments(path: string): string[] {
  return path.split(FOLDER_SEP).filter(Boolean);
}

/** Leaf display name for a folder path. */
export function folderLeafName(path: string): string {
  const segs = folderSegments(path);
  return segs[segs.length - 1] ?? path;
}

/** Parent path, or undefined for a top-level folder. */
export function folderParentPath(path: string): string | undefined {
  const segs = folderSegments(path);
  if (segs.length <= 1) return undefined;
  return segs.slice(0, -1).join(FOLDER_SEP);
}

/** Join a parent path and a leaf name into a full path. */
export function joinFolderPath(parent: string | undefined, name: string): string {
  const clean = name.trim();
  return parent ? `${parent}${FOLDER_SEP}${clean}` : clean;
}

/** All ancestor prefixes of a path, e.g. "A/B/C" → ["A", "A/B", "A/B/C"]. */
export function folderAncestors(path: string): string[] {
  const segs = folderSegments(path);
  const out: string[] = [];
  for (let i = 0; i < segs.length; i++) {
    out.push(segs.slice(0, i + 1).join(FOLDER_SEP));
  }
  return out;
}

/** True when `path` is `ancestor` or nested somewhere beneath it. */
export function isSameOrDescendant(path: string, ancestor: string): boolean {
  return path === ancestor || path.startsWith(`${ancestor}${FOLDER_SEP}`);
}

/**
 * Expand a set of "known" folder paths (from server labels + explicit empty
 * folders) into the complete set including every ancestor prefix.
 */
export function collectFolderPaths(serverFolders: Array<string | undefined>, emptyFolders: Iterable<string>): Set<string> {
  const all = new Set<string>();
  const add = (p: string | undefined) => {
    if (!p) return;
    for (const anc of folderAncestors(p)) all.add(anc);
  };
  serverFolders.forEach(add);
  for (const p of emptyFolders) add(p);
  return all;
}

/**
 * Build an ordered nested tree from a flat set of folder paths.
 * `order` gives a preferred ordering of full paths; unknown paths fall back to
 * case-insensitive alphabetical by leaf name.
 */
export function buildFolderTree(paths: Iterable<string>, order: string[]): FolderTreeNode[] {
  const orderIndex = new Map<string, number>();
  order.forEach((p, i) => orderIndex.set(p, i));

  const nodes = new Map<string, FolderTreeNode>();
  const ensure = (path: string): FolderTreeNode => {
    let node = nodes.get(path);
    if (!node) {
      node = { path, name: folderLeafName(path), depth: folderSegments(path).length - 1, children: [] };
      nodes.set(path, node);
    }
    return node;
  };

  // Materialise every path (ancestors already included by collectFolderPaths).
  for (const p of paths) ensure(p);

  const roots: FolderTreeNode[] = [];
  for (const node of nodes.values()) {
    const parent = folderParentPath(node.path);
    if (parent && nodes.has(parent)) nodes.get(parent)!.children.push(node);
    else roots.push(node);
  }

  const sortNodes = (list: FolderTreeNode[]) => {
    list.sort((a, b) => {
      const ai = orderIndex.has(a.path) ? orderIndex.get(a.path)! : Number.MAX_SAFE_INTEGER;
      const bi = orderIndex.has(b.path) ? orderIndex.get(b.path)! : Number.MAX_SAFE_INTEGER;
      if (ai !== bi) return ai - bi;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
    list.forEach(n => sortNodes(n.children));
  };
  sortNodes(roots);
  return roots;
}

/** Direct child folder names of `parent` (undefined = top level). */
export function childFolderNames(paths: Iterable<string>, parent: string | undefined): string[] {
  const out: string[] = [];
  for (const p of paths) {
    if (folderParentPath(p) === parent) out.push(folderLeafName(p));
  }
  return out;
}

/**
 * Compute the old→new path remap when renaming `path`'s leaf to `newName`.
 * Covers the folder itself and every descendant. Returns null on a no-op.
 */
export function renameFolderPaths(path: string, newName: string, allPaths: Iterable<string>): Map<string, string> | null {
  const trimmed = newName.trim();
  if (!trimmed) return null;
  const parent = folderParentPath(path);
  const newPath = joinFolderPath(parent, trimmed);
  if (newPath === path) return null;
  const remap = new Map<string, string>();
  for (const p of allPaths) {
    if (isSameOrDescendant(p, path)) remap.set(p, newPath + p.slice(path.length));
  }
  return remap;
}

/**
 * Compute the old→new path remap when moving `src` under `destParent`
 * (undefined = top level). Returns null if the move is illegal (into itself or
 * a descendant) or a no-op.
 */
export function moveFolderPaths(src: string, destParent: string | undefined, allPaths: Iterable<string>): Map<string, string> | null {
  if (destParent && isSameOrDescendant(destParent, src)) return null; // into self/descendant
  if (folderParentPath(src) === destParent) return null; // already there
  const newPath = joinFolderPath(destParent, folderLeafName(src));
  const remap = new Map<string, string>();
  for (const p of allPaths) {
    if (isSameOrDescendant(p, src)) remap.set(p, newPath + p.slice(src.length));
  }
  return remap;
}

/**
 * Where a folder path should land after `deleted` is dissolved.
 * Direct members of `deleted` become ungrouped (or the parent folder).
 * Descendants keep the remainder of the path, promoted one level.
 * Unrelated paths are returned unchanged.
 */
export function pathAfterDeletingFolder(folderPath: string, deleted: string): string | undefined {
  if (folderPath === deleted) return undefined;
  const prefix = `${deleted}${FOLDER_SEP}`;
  if (!folderPath.startsWith(prefix)) return folderPath;
  const rest = folderPath.slice(prefix.length);
  const parent = folderParentPath(deleted);
  return parent ? `${parent}${FOLDER_SEP}${rest}` : rest;
}
