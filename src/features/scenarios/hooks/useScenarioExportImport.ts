import { useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { FeatureGroup, TestScenario, Scenario } from '../../../shared/types';
import { saveJsonFile, buildExportFilename } from '../../../shared/utils/fileSaver';
import { pickJsonFile, reIdScenarios, unwrapImport, wrapExport } from '../utils/scenarioImportExport';

interface UseScenarioExportImportParams {
  featureGroups: FeatureGroup[];
  setFeatureGroups: React.Dispatch<React.SetStateAction<FeatureGroup[]>>;
  selectedSvcId?: string;
  selectedSvcName?: string;
  selectedEnvId?: string;
  selectedEnvName?: string;
  setCsvImportOpen: (open: boolean) => void;
  confirm: (title: string, message: string, onConfirm: () => void) => void;
}

export function useScenarioExportImport({
  featureGroups,
  setFeatureGroups,
  selectedSvcId,
  selectedSvcName,
  selectedEnvId,
  selectedEnvName,
  setCsvImportOpen,
  confirm,
}: UseScenarioExportImportParams) {
  const exportMeta = { microservice: selectedSvcName || undefined, environment: selectedEnvName || undefined };

  const fname = (level: string, name?: string) =>
    buildExportFilename({ env: selectedEnvName, svc: selectedSvcName, level, name });

  const downloadJson = (data: unknown, filename: string) => saveJsonFile(data, filename);

  const exportAll = useCallback(() => {
    downloadJson(wrapExport(featureGroups, 'feature-groups', exportMeta), fname('feature-groups'));
  }, [featureGroups, exportMeta]);

  const importAll = useCallback(() => {
    if (!selectedSvcId || !selectedEnvId) { confirm('Import Error', 'Select a microservice and environment first.', () => {}); return; }
    pickJsonFile((raw) => {
      const data = unwrapImport(raw);
      const items = Array.isArray(data) ? data as FeatureGroup[] : [data as FeatureGroup];
      if (!items.every((fg) => fg.name && Array.isArray(fg.scenarios))) {
        confirm('Import Error', 'Invalid file: expected feature group(s).', () => {}); return;
      }
      const existingNames = new Set(featureGroups.map((fg) => fg.name.toLowerCase()));
      const existingIds = new Set(featureGroups.map((fg) => fg.id));
      const conflicts = items.filter((fg) => existingNames.has(fg.name.toLowerCase()) || existingIds.has(fg.id));
      if (conflicts.length > 0) {
        const names = conflicts.map((fg) => `  • "${fg.name}"`).join('\n');
        confirm('Import Conflicts', `The following feature groups already exist:\n${names}\n\nImport as new copies with fresh IDs?`, () => {
          const imported = items.map((fg) => ({ ...fg, id: uuidv4(), microserviceId: selectedSvcId, environmentId: selectedEnvId, scenarios: reIdScenarios(fg.scenarios) }));
          setFeatureGroups((prev) => [...prev, ...imported]);
        });
        return;
      }
      const imported = items.map((fg) => ({ ...fg, id: uuidv4(), microserviceId: selectedSvcId, environmentId: selectedEnvId, scenarios: reIdScenarios(fg.scenarios) }));
      setFeatureGroups((prev) => [...prev, ...imported]);
    });
  }, [featureGroups, selectedSvcId, selectedEnvId, setFeatureGroups]);

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

  const exportFeatureGroup = useCallback((fg: FeatureGroup) => {
    downloadJson(wrapExport(fg, 'feature-group', exportMeta), fname('feature', fg.name));
  }, [exportMeta]);

  const importScenariosInto = useCallback((featureId: string) => pickJsonFile((raw) => {
    const data = unwrapImport(raw);
    const items = Array.isArray(data) ? data as TestScenario[] : [data as TestScenario];
    if (!items.every((sc) => sc.name && Array.isArray(sc.tests))) {
      confirm('Import Error', 'Invalid file: expected scenario(s) with a name and tests array.', () => {}); return;
    }
    const fg = featureGroups.find((f) => f.id === featureId);
    if (fg) {
      const existingNames = new Set(fg.scenarios.map((sc) => sc.name.toLowerCase()));
      const dupes = items.filter((sc) => existingNames.has(sc.name.toLowerCase()));
      if (dupes.length > 0) {
        const names = dupes.map((sc) => `  • "${sc.name}"`).join('\n');
        confirm('Import Conflicts', `These scenarios already exist in "${fg.name}":\n${names}\n\nImport as new copies?`, () => {
          const imported = reIdScenarios(items);
          setFeatureGroups((prev) => prev.map((f) =>
            f.id === featureId ? { ...f, scenarios: [...f.scenarios, ...imported] } : f
          ));
        });
        return;
      }
    }
    const imported = reIdScenarios(items);
    setFeatureGroups((prev) => prev.map((f) =>
      f.id === featureId ? { ...f, scenarios: [...f.scenarios, ...imported] } : f
    ));
  }), [featureGroups, setFeatureGroups]);

  const exportScenario = useCallback((sc: TestScenario) => {
    downloadJson(wrapExport(sc, 'scenario', exportMeta), fname('scenario', sc.name));
  }, [exportMeta]);

  const importTestsInto = useCallback((featureId: string, scenarioId: string) => pickJsonFile((raw) => {
    const data = unwrapImport(raw);
    const items = Array.isArray(data) ? data as Scenario[] : [data as Scenario];
    if (!items.every((t) => t.name && t.url && t.method)) {
      confirm('Import Error', 'Invalid file: expected test(s) with name, url, and method.', () => {}); return;
    }
    const fg = featureGroups.find((f) => f.id === featureId);
    const sc = fg?.scenarios.find((s) => s.id === scenarioId);
    if (sc) {
      const existingNames = new Set(sc.tests.map((t) => t.name.toLowerCase()));
      const dupes = items.filter((t) => existingNames.has(t.name.toLowerCase()));
      if (dupes.length > 0) {
        const names = dupes.map((t) => `  • "${t.name}"`).join('\n');
        confirm('Import Conflicts', `These tests already exist in "${sc.name}":\n${names}\n\nImport as new copies?`, () => {
          const imported = items.map((t) => ({ ...t, id: uuidv4() }));
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
    const imported = items.map((t) => ({ ...t, id: uuidv4() }));
    setFeatureGroups((prev) => prev.map((f) => {
      if (f.id !== featureId) return f;
      return { ...f, scenarios: f.scenarios.map((s) =>
        s.id === scenarioId ? { ...s, tests: [...s.tests, ...imported] } : s
      )};
    }));
  }), [featureGroups, setFeatureGroups]);

  const exportTest = useCallback((t: Scenario) => {
    downloadJson(wrapExport(t, 'test', exportMeta), fname('test', t.name));
  }, [exportMeta]);

  return {
    exportAll,
    importAll,
    handleCsvImport,
    exportFeatureGroup,
    importScenariosInto,
    exportScenario,
    importTestsInto,
    exportTest,
  };
}
