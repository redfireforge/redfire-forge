import type { RequestCollection, RequestItem, RequestFolder, HttpMethod } from '../../../shared/types';

export interface CoverageLocation {
  collectionId: string;
  collectionName: string;
  folderId?: string;
  folderPath: string;
  requestId: string;
  requestName: string;
}

export interface EndpointCoverage {
  exported: boolean;
  count: number;
  locations: CoverageLocation[];
}

interface RequestWithPath {
  req: RequestItem;
  folderPath: string;
  folderId?: string;
}

/**
 * Build a map of coverage for all endpoints in a catalog entry,
 * keyed by `"METHOD /path"` (e.g. `"GET /pets/{petId}"`).
 * Matches requests by catalogEntryId first, falls back to sourceSpec prefix match.
 */
export function buildCoverageMap(
  entryId: string,
  entryName: string,
  collections: RequestCollection[],
): Map<string, EndpointCoverage> {
  const map = new Map<string, EndpointCoverage>();

  for (const col of collections) {
    for (const { req, folderPath, folderId } of getAllRequestsWithPath(col)) {
      const meta = req.catalogMeta;
      if (!meta?.originalPath) continue;

      const matches = meta.catalogEntryId
        ? meta.catalogEntryId === entryId
        : meta.sourceSpec?.startsWith(entryName) ?? false;
      if (!matches) continue;

      const fullPath = folderPath
        ? `${col.name} / ${folderPath} / ${req.name}`
        : `${col.name} / ${req.name}`;

      const loc: CoverageLocation = {
        collectionId: col.id,
        collectionName: col.name,
        folderId,
        folderPath: fullPath,
        requestId: req.id,
        requestName: req.name,
      };

      const key = coverageKey(req.method, meta.originalPath);
      const prev = map.get(key);
      if (prev) {
        prev.count++;
        prev.locations.push(loc);
      } else {
        map.set(key, { exported: true, count: 1, locations: [loc] });
      }
    }
  }

  return map;
}

export function coverageKey(method: HttpMethod | string, path: string): string {
  return `${method} ${path}`;
}

export function getEndpointCoverage(
  method: HttpMethod | string,
  path: string,
  coverageMap: Map<string, EndpointCoverage>,
): EndpointCoverage {
  return coverageMap.get(coverageKey(method, path)) ?? { exported: false, count: 0, locations: [] };
}

function getAllRequestsWithPath(collection: RequestCollection): RequestWithPath[] {
  const results: RequestWithPath[] = collection.requests.map(r => ({
    req: r, folderPath: '', folderId: undefined,
  }));

  const walkFolders = (folders: RequestFolder[] | undefined, pathParts: string[]) => {
    if (!folders) return;
    for (const f of folders) {
      const currentPath = [...pathParts, f.name];
      for (const r of f.requests) {
        results.push({ req: r, folderPath: currentPath.join(' / '), folderId: f.id });
      }
      walkFolders(f.folders, currentPath);
    }
  };

  walkFolders(collection.folders, []);
  return results;
}
