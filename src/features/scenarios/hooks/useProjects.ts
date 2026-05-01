import { useState, useEffect, useRef, useCallback } from 'react';
import type { Environment, Microservice, FeatureGroup, GlobalAuthProfile, TestRun, TestScenario } from '../../../shared/types';
import {
  loadEnvironments, saveEnvironments,
  loadMicroservices, saveMicroservices,
  loadFeatureGroups, saveFeatureGroups,
  loadGlobalAuthProfiles, saveGlobalAuthProfiles,
  loadSelectedEnvId, saveSelectedEnvId,
  loadSelectedSvcId, saveSelectedSvcId,
  migrateToFlat,
  getMaxRuns, getStorageUsage,
  loadTestRuns,
  loadTheme,
} from '../../../shared/utils/storage';
import { isCustomThemeId, findSavedTheme, applyCustomTheme } from '../../../app/ThemeCustomizer';

export interface UseProjectsReturn {
  loading: boolean;

  environments: Environment[];
  setEnvironments: React.Dispatch<React.SetStateAction<Environment[]>>;
  microservices: Microservice[];
  setMicroservices: React.Dispatch<React.SetStateAction<Microservice[]>>;
  featureGroups: FeatureGroup[];
  setFeatureGroups: React.Dispatch<React.SetStateAction<FeatureGroup[]>>;
  appGlobalAuthProfiles: GlobalAuthProfile[];
  setAppGlobalAuthProfiles: React.Dispatch<React.SetStateAction<GlobalAuthProfile[]>>;

  selectedEnvId: string;
  setSelectedEnvId: (id: string) => void;
  selectedSvcId: string;
  setSelectedSvcId: (id: string) => void;

  moveScenario: (scenarioId: string, sourceFgId: string, targetFgId: string) => void;
  moveTest: (testId: string, sourceScenarioId: string, sourceFgId: string, targetScenarioId: string, targetFgId: string) => void;

  initialMaxRuns: number;
  initialStorageUsage: { usedBytes: number; entries: Record<string, number> };
  initialTheme: string;
  initialTestRuns: TestRun[];
}

export function useProjects(): UseProjectsReturn {
  const [loading, setLoading] = useState(true);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [microservices, setMicroservices] = useState<Microservice[]>([]);
  const [featureGroups, setFeatureGroups] = useState<FeatureGroup[]>([]);
  const [appGlobalAuthProfiles, setAppGlobalAuthProfiles] = useState<GlobalAuthProfile[]>([]);
  const [selectedEnvId, _setSelectedEnvId] = useState('');
  const [selectedSvcId, _setSelectedSvcId] = useState('');

  const [initialMaxRuns, setInitialMaxRuns] = useState(50);
  const [initialStorageUsage, setInitialStorageUsage] = useState<{ usedBytes: number; entries: Record<string, number> }>({ usedBytes: 0, entries: {} });
  const [initialTheme, setInitialTheme] = useState('dark');
  const [initialTestRuns, setInitialTestRuns] = useState<TestRun[]>([]);

  const setSelectedEnvId = useCallback((id: string) => _setSelectedEnvId(id), []);
  const setSelectedSvcId = useCallback((id: string) => _setSelectedSvcId(id), []);

  const initDone = useRef(false);
  useEffect(() => {
    if (initDone.current) return;
    initDone.current = true;
    (async () => {
      await migrateToFlat();

      const [envs, svcs, fgs, auth, selEnv, selSvc, maxR, usage, savedTheme, runs] = await Promise.all([
        loadEnvironments(),
        loadMicroservices(),
        loadFeatureGroups(),
        loadGlobalAuthProfiles(),
        loadSelectedEnvId(),
        loadSelectedSvcId(),
        getMaxRuns(),
        getStorageUsage(),
        loadTheme(),
        loadTestRuns(),
      ]);

      setEnvironments(envs);
      setMicroservices(svcs);
      setFeatureGroups(fgs);
      setAppGlobalAuthProfiles(auth);
      _setSelectedEnvId(selEnv);
      _setSelectedSvcId(selSvc);
      setInitialMaxRuns(maxR);
      setInitialStorageUsage(usage);
      setInitialTheme(savedTheme);
      setInitialTestRuns(runs);
      if (isCustomThemeId(savedTheme)) {
        const data = findSavedTheme(savedTheme);
        if (data) applyCustomTheme(data);
        else document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        document.documentElement.setAttribute('data-theme', savedTheme);
      }
      setLoading(false);
    })();
  }, []);

  // Persistence
  useEffect(() => { if (!loading) void saveEnvironments(environments); }, [environments, loading]);
  useEffect(() => { if (!loading) void saveMicroservices(microservices); }, [microservices, loading]);
  useEffect(() => { if (!loading) void saveFeatureGroups(featureGroups); }, [featureGroups, loading]);
  useEffect(() => { if (!loading) void saveGlobalAuthProfiles(appGlobalAuthProfiles); }, [appGlobalAuthProfiles, loading]);
  useEffect(() => { if (!loading) void saveSelectedEnvId(selectedEnvId); }, [selectedEnvId, loading]);
  useEffect(() => { if (!loading) void saveSelectedSvcId(selectedSvcId); }, [selectedSvcId, loading]);

  const moveScenario = useCallback((scenarioId: string, sourceFgId: string, targetFgId: string) => {
    if (sourceFgId === targetFgId) return;
    setFeatureGroups((prev) => {
      const srcFg = prev.find((f) => f.id === sourceFgId);
      const targetFg = prev.find((f) => f.id === targetFgId);
      const scenario = srcFg?.scenarios.find((s) => s.id === scenarioId);
      if (!scenario || !targetFg) return prev;
      return prev.map((fg) => {
        if (fg.id === sourceFgId) return { ...fg, scenarios: fg.scenarios.filter((s) => s.id !== scenarioId) };
        if (fg.id === targetFgId) return { ...fg, scenarios: [...fg.scenarios, scenario] };
        return fg;
      });
    });
  }, []);

  const moveTest = useCallback((testId: string, sourceScenarioId: string, sourceFgId: string, targetScenarioId: string, targetFgId: string) => {
    if (sourceFgId === targetFgId && sourceScenarioId === targetScenarioId) return;
    setFeatureGroups((prev) => {
      const srcFg = prev.find((f) => f.id === sourceFgId);
      const targetFg = prev.find((f) => f.id === targetFgId);
      const srcSc = srcFg?.scenarios.find((s) => s.id === sourceScenarioId);
      const targetSc = targetFg?.scenarios.find((s) => s.id === targetScenarioId);
      const test = srcSc?.tests.find((t) => t.id === testId);
      if (!test || !targetFg || !targetSc) return prev;

      const removeFromScenario = (scenarios: TestScenario[]) =>
        scenarios.map((sc) => sc.id === sourceScenarioId ? { ...sc, tests: sc.tests.filter((t) => t.id !== testId) } : sc);
      const addToScenario = (scenarios: TestScenario[]) =>
        scenarios.map((sc) => sc.id === targetScenarioId ? { ...sc, tests: [...sc.tests, test] } : sc);

      return prev.map((fg) => {
        if (sourceFgId === targetFgId && fg.id === sourceFgId) {
          let scenarios = removeFromScenario(fg.scenarios);
          scenarios = addToScenario(scenarios);
          return { ...fg, scenarios };
        }
        if (fg.id === sourceFgId) return { ...fg, scenarios: removeFromScenario(fg.scenarios) };
        if (fg.id === targetFgId) return { ...fg, scenarios: addToScenario(fg.scenarios) };
        return fg;
      });
    });
  }, []);

  return {
    loading,
    environments, setEnvironments,
    microservices, setMicroservices,
    featureGroups, setFeatureGroups,
    appGlobalAuthProfiles, setAppGlobalAuthProfiles,
    selectedEnvId, setSelectedEnvId,
    selectedSvcId, setSelectedSvcId,
    moveScenario, moveTest,
    initialMaxRuns, initialStorageUsage, initialTheme, initialTestRuns,
  };
}
