import type { ApiMockRouteFolderV1, ApiMockServerDefinitionV1 } from '../../shared/api-mock/contracts';

export type ImportRoutesOptions = {
  mode: 'merge' | 'replace' | 'copy';
  newFolderName?: string;
};

export function prepareImportedRoutes(args: {
  activeServer: ApiMockServerDefinitionV1;
  routes: ApiMockServerDefinitionV1['routes'];
  options: ImportRoutesOptions;
}): {
  nextRoutes: ApiMockServerDefinitionV1['routes'];
  nextFolders: ApiMockRouteFolderV1[];
  selectedRouteId: string;
  importedCount: number;
} {
  const { activeServer, routes, options } = args;
  let nextFolders = activeServer.folders;
  let assignFolderId: string | undefined;

  if (options.newFolderName) {
    const newFolder: ApiMockRouteFolderV1 = {
      id: `fld-${crypto.randomUUID().slice(0, 8)}`,
      name: options.newFolderName,
      expanded: true,
      sortOrder: activeServer.folders.length,
    };
    nextFolders = [...activeServer.folders, newFolder];
    assignFolderId = newFolder.id;
  }

  let prepared = options.mode === 'copy'
    ? routes.map(r => ({
      ...r,
      id: `rte-${crypto.randomUUID().slice(0, 8)}`,
      name: `${r.name} (copy)`,
      responses: r.responses.map(resp => ({ ...resp, id: `rsp-${crypto.randomUUID().slice(0, 8)}` })),
    }))
    : routes;

  if (assignFolderId) {
    prepared = prepared.map(r => ({ ...r, folderId: assignFolderId }));
  }

  const nextRoutes = options.mode === 'replace'
    ? prepared
    : [...activeServer.routes, ...prepared];

  return {
    nextRoutes,
    nextFolders,
    selectedRouteId: prepared[0].id,
    importedCount: prepared.length,
  };
}