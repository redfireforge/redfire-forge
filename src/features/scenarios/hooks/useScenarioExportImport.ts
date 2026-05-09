import { useCallback, useState, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { FeatureGroup, TestScenario, Scenario, SharedDataSource } from '../../../shared/types';
import { saveJsonFile, buildExportFilename } from '../../../shared/utils/fileSaver';
import { pickJsonFile, reIdScenarios, unwrapImport, wrapExport, stripVersions, hasVersionData } from '../utils/scenarioImportExport';
import type { VersionExportOptions } from '../utils/scenarioImportExport';

interface UseScenarioExportImportParams {
  featureGroups: FeatureGroup[];
  setFeatureGroups: React.Dispatch<React.SetStateAction<FeatureGroup[]>>;
  sharedDataSources?: SharedDataSource[];
  setSharedDataSources?: React.Dispatch<React.SetStateAction<SharedDataSource[]>>;
  selectedSvcId?: string;
  selectedSvcName?: string;
  selectedEnvId?: string;
  selectedEnvName?: string;
  setCsvImportOpen: (open: boolean) => void;
  confirm: (title: string, message: string, onConfirm: () => void) => void;
}

export interface VersionImportOptions {
  importResponseVersions: boolean;
  importRulesVersions: boolean;
  importDefinitionVersions: boolean;
  importStructureLog: boolean;
}

export interface PendingImport {
  data: unknown;
  finalize: (opts: VersionImportOptions) => void;
}

export function useScenarioExportImport({
  featureGroups,
  setFeatureGroups,
  sharedDataSources,
  setSharedDataSources,
  selectedSvcId,
  selectedSvcName,
  selectedEnvId,
  selectedEnvName,
  setCsvImportOpen,
  confirm,
}: UseScenarioExportImportParams) {
  const exportMeta = useMemo(
    () => ({ microservice: selectedSvcName || undefined, environment: selectedEnvName || undefined }),
    [selectedSvcName, selectedEnvName],
  );
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);

  const fname = useCallback((level: string, name?: string) =>
    buildExportFilename({ env: selectedEnvName, svc: selectedSvcName, level, name }),
  [selectedEnvName, selectedSvcName]);

  const downloadJson = (data: unknown, filename: string) => saveJsonFile(data, filename);

  /** Strip versions from imported data based on user-chosen import options. */
  const applyImportVersionOpts = useCallback((data: unknown, opts?: VersionImportOptions): unknown => {
    if (!opts) return data;
    return stripVersions(data, {
      includeResponseVersions: opts.importResponseVersions,
      includeRulesVersions: opts.importRulesVersions,
      includeDefinitionVersions: opts.importDefinitionVersions,
      includeStructureLog: opts.importStructureLog,
    });
  }, []);

  /** Shared import pipeline: pick file → validate → version prompt → do import. */
  const importWithVersionPrompt = useCallback(<T,>(
    validate: (items: T[]) => boolean,
    errorMsg: string,
    doImport: (items: T[]) => void,
  ) => {
    pickJsonFile((raw) => {
      const data = unwrapImport(raw);
      const items = Array.isArray(data) ? data as T[] : [data as T];
      if (!validate(items)) { confirm('Import Error', errorMsg, () => {}); return; }

      if (hasVersionData(items)) {
        setPendingImport({
          data: items,
          finalize: (opts) => {
            const stripped = applyImportVersionOpts(items, opts) as T[];
            doImport(stripped);
            setPendingImport(null);
          },
        });
      } else {
        doImport(items);
      }
    }, (msg) => confirm('Import Error', msg, () => {}));
  }, [applyImportVersionOpts, confirm]);

  const exportAll = useCallback((versionOpts?: VersionExportOptions) => {
    const payload = wrapExport(featureGroups, 'feature-groups', exportMeta, versionOpts);
    if (sharedDataSources && sharedDataSources.length > 0) {
      (payload as unknown as Record<string, unknown>).sharedDataSources = sharedDataSources;
    }
    downloadJson(payload, fname('feature-groups'));
  }, [featureGroups, sharedDataSources, exportMeta, fname]);

  const importAll = useCallback(() => {
    if (!selectedSvcId || !selectedEnvId) { confirm('Import Error', 'Select a microservice and environment first.', () => {}); return; }
    pickJsonFile((raw) => {
      // Extract sharedDataSources from the wrapper before unwrapping
      let importedSharedDs: SharedDataSource[] | undefined;
      if (raw && typeof raw === 'object' && 'sharedDataSources' in raw) {
        const ds = (raw as Record<string, unknown>).sharedDataSources;
        if (Array.isArray(ds) && ds.length > 0) importedSharedDs = ds as SharedDataSource[];
      }

      const data = unwrapImport(raw);
      const items = Array.isArray(data) ? data as FeatureGroup[] : [data as FeatureGroup];
      if (!items.every((fg) => fg.name && Array.isArray(fg.scenarios))) { confirm('Import Error', 'Invalid file: expected feature group(s).', () => {}); return; }

      const doFeatureGroupImport = (finalItems: FeatureGroup[]) => {
        const existingNames = new Set(featureGroups.map((fg) => fg.name.toLowerCase()));
        const existingIds = new Set(featureGroups.map((fg) => fg.id));
        const conflicts = finalItems.filter((fg) => existingNames.has(fg.name.toLowerCase()) || existingIds.has(fg.id));
        if (conflicts.length > 0) {
          const names = conflicts.map((fg) => `  • "${fg.name}"`).join('\n');
          confirm('Import Conflicts', `The following feature groups already exist:\n${names}\n\nImport as new copies with fresh IDs?`, () => {
            const imported = finalItems.map((fg) => ({ ...fg, id: uuidv4(), microserviceId: selectedSvcId, environmentId: selectedEnvId, scenarios: reIdScenarios(fg.scenarios) }));
            setFeatureGroups((prev) => [...prev, ...imported]);
          });
        } else {
          const imported = finalItems.map((fg) => ({ ...fg, id: uuidv4(), microserviceId: selectedSvcId, environmentId: selectedEnvId, scenarios: reIdScenarios(fg.scenarios) }));
          setFeatureGroups((prev) => [...prev, ...imported]);
        }
        // Merge shared data sources (deduplicate by id)
        if (importedSharedDs && setSharedDataSources) {
          setSharedDataSources((prev) => {
            const existingDsIds = new Set(prev.map((ds) => ds.id));
            const newDs = importedSharedDs!.filter((ds) => !existingDsIds.has(ds.id));
            return newDs.length > 0 ? [...prev, ...newDs] : prev;
          });
        }
      };

      if (hasVersionData(items)) {
        setPendingImport({
          data: items,
          finalize: (opts) => {
            const stripped = applyImportVersionOpts(items, opts) as FeatureGroup[];
            doFeatureGroupImport(stripped);
            setPendingImport(null);
          },
        });
      } else {
        doFeatureGroupImport(items);
      }
    }, (msg) => confirm('Import Error', msg, () => {}));
  }, [featureGroups, selectedSvcId, selectedEnvId, setFeatureGroups, setSharedDataSources, applyImportVersionOpts, confirm]);

  const handleCsvImport = useCallback((fgId: string, scenarioId: string, tests: Scenario[]) => {
    const scenName = scenarioId.startsWith('__new__:') ? scenarioId.slice('__new__:'.length) : '';

    if (fgId.startsWith('__new_fg__:')) {
      const fgName = fgId.slice('__new_fg__:'.length);
      const newScenario: TestScenario = {
        id: uuidv4(),
        name: scenName || 'Imported Tests',
        tests,
      };
      const newFg: FeatureGroup = {
        id: uuidv4(),
        name: fgName,
        scenarios: [newScenario],
      };
      setFeatureGroups((prev) => [...prev, newFg]);
      setCsvImportOpen(false);
      return;
    }

    setFeatureGroups((prev) => prev.map((fg) => {
      if (fg.id !== fgId) return fg;

      if (scenName) {
        const newScenario: TestScenario = {
          id: uuidv4(),
          name: scenName,
          tests,
        };
        return { ...fg, scenarios: [...fg.scenarios, newScenario] };
      }

      return {
        ...fg,
        scenarios: fg.scenarios.map((sc) => {
          if (sc.id !== scenarioId) return sc;
          return { ...sc, tests: [...sc.tests, ...tests] };
        }),
      };
    }));
    setCsvImportOpen(false);
  }, [setFeatureGroups, setCsvImportOpen]);

  const exportFeatureGroup = useCallback((fg: FeatureGroup, versionOpts?: VersionExportOptions) => {
    downloadJson(wrapExport(fg, 'feature-group', exportMeta, versionOpts), fname('feature', fg.name));
  }, [exportMeta, fname]);

  const importScenariosInto = useCallback((featureId: string) => {
    importWithVersionPrompt<TestScenario>(
      (items) => items.every((sc) => sc.name && Array.isArray(sc.tests)),
      'Invalid file: expected scenario(s) with a name and tests array.',
      (finalItems) => {
        const fg = featureGroups.find((f) => f.id === featureId);
        if (fg) {
          const existingNames = new Set(fg.scenarios.map((sc) => sc.name.toLowerCase()));
          const dupes = finalItems.filter((sc) => existingNames.has(sc.name.toLowerCase()));
          if (dupes.length > 0) {
            const names = dupes.map((sc) => `  • "${sc.name}"`).join('\n');
            confirm('Import Conflicts', `These scenarios already exist in "${fg.name}":\n${names}\n\nImport as new copies?`, () => {
              const imported = reIdScenarios(finalItems);
              setFeatureGroups((prev) => prev.map((f) =>
                f.id === featureId ? { ...f, scenarios: [...f.scenarios, ...imported] } : f
              ));
            });
            return;
          }
        }
        const imported = reIdScenarios(finalItems);
        setFeatureGroups((prev) => prev.map((f) =>
          f.id === featureId ? { ...f, scenarios: [...f.scenarios, ...imported] } : f
        ));
      },
    );
  }, [featureGroups, setFeatureGroups, importWithVersionPrompt, confirm]);

  const exportScenario = useCallback((sc: TestScenario, versionOpts?: VersionExportOptions) => {
    downloadJson(wrapExport(sc, 'scenario', exportMeta, versionOpts), fname('scenario', sc.name));
  }, [exportMeta, fname]);

  const importTestsInto = useCallback((featureId: string, scenarioId: string) => {
    importWithVersionPrompt<Scenario>(
      (items) => items.every((t) => t.name && t.url && t.method),
      'Invalid file: expected test(s) with name, url, and method.',
      (finalItems) => {
        const fg = featureGroups.find((f) => f.id === featureId);
        const sc = fg?.scenarios.find((s) => s.id === scenarioId);
        if (sc) {
          const existingNames = new Set(sc.tests.map((t) => t.name.toLowerCase()));
          const dupes = finalItems.filter((t) => existingNames.has(t.name.toLowerCase()));
          if (dupes.length > 0) {
            const names = dupes.map((t) => `  • "${t.name}"`).join('\n');
            confirm('Import Conflicts', `These tests already exist in "${sc.name}":\n${names}\n\nImport as new copies?`, () => {
              const imported = finalItems.map((t) => ({ ...t, id: uuidv4() }));
              setFeatureGroups((prev) => prev.map((f) => {
                if (f.id !== featureId) return f;
                return { ...f, scenarios: f.scenarios.map((s) =>
                  s.id === scenarioId ? { ...s, tests: [...s.tests, ...imported] } : s
                )};
              }));
            });
            return;
          }
        }
        const imported = finalItems.map((t) => ({ ...t, id: uuidv4() }));
        setFeatureGroups((prev) => prev.map((f) => {
          if (f.id !== featureId) return f;
          return { ...f, scenarios: f.scenarios.map((s) =>
            s.id === scenarioId ? { ...s, tests: [...s.tests, ...imported] } : s
          )};
        }));
      },
    );
  }, [featureGroups, setFeatureGroups, importWithVersionPrompt, confirm]);

  const exportTest = useCallback((t: Scenario, versionOpts?: VersionExportOptions) => {
    downloadJson(wrapExport(t, 'test', exportMeta, versionOpts), fname('test', t.name));
  }, [exportMeta, fname]);

  return {
    exportAll,
    importAll,
    handleCsvImport,
    exportFeatureGroup,
    importScenariosInto,
    exportScenario,
    importTestsInto,
    exportTest,
    pendingImport,
    cancelPendingImport: useCallback(() => setPendingImport(null), []),
  };
}
