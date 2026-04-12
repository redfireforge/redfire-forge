import { useState, useEffect, useRef, useCallback } from 'react';
import type { FeatureGroup, GlobalAuthProfile, Project } from '../types';
import {
  loadProjects, saveProjects,
  loadSelectedProject, saveSelectedProject,
  loadGlobalAuthProfiles, saveGlobalAuthProfiles,
  migrateLegacyData,
  getMaxRuns, getStorageUsage,
  loadTestRuns,
  loadTheme,
} from '../utils/storage';
import { createEmptyProject } from '../utils/helpers';

export interface UseProjectsReturn {
  loading: boolean;
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  selectedProjectId: string;
  setSelectedProjectId: React.Dispatch<React.SetStateAction<string>>;
  selectedProject: Project | undefined;
  appGlobalAuthProfiles: GlobalAuthProfile[];
  setAppGlobalAuthProfiles: React.Dispatch<React.SetStateAction<GlobalAuthProfile[]>>;

  // Derived project-scoped state
  environments: Project['environments'];
  microservices: Project['microservices'];
  globalAuthProfiles: Project['globalAuthProfiles'];
  featureGroups: Project['featureGroups'];
  selectedEnvId: string;
  selectedSvcId: string;

  // Project-scoped setter wrappers
  updateCurrentProject: (updater: (p: Project) => Partial<Project>) => void;
  setFeatureGroups: React.Dispatch<React.SetStateAction<FeatureGroup[]>>;
  setSelectedEnvId: (envId: string) => void;
  setSelectedSvcId: (svcId: string) => void;
  modifyProject: (projectId: string, fn: (p: Project) => Project) => void;

  // Cross-project move handlers
  moveFeatureGroup: (fgId: string, sourceProjectId: string, targetProjectId: string) => void;
  moveScenario: (scenarioId: string, sourceFgId: string, sourceProjectId: string, targetFgId: string, targetProjectId: string) => void;
  moveTest: (testId: string, sourceScenarioId: string, sourceFgId: string, sourceProjectId: string, targetScenarioId: string, targetFgId: string, targetProjectId: string) => void;

  // Init extras (loaded once)
  initialMaxRuns: number;
  initialStorageUsage: { usedBytes: number; entries: Record<string, number> };
  initialTheme: string;
  initialTestRuns: import('../types').TestRun[];
}

export function useProjects(): UseProjectsReturn {
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [appGlobalAuthProfiles, setAppGlobalAuthProfiles] = useState<GlobalAuthProfile[]>([]);

  const [initialMaxRuns, setInitialMaxRuns] = useState(50);
  const [initialStorageUsage, setInitialStorageUsage] = useState<{ usedBytes: number; entries: Record<string, number> }>({ usedBytes: 0, entries: {} });
  const [initialTheme, setInitialTheme] = useState('dark');
  const [initialTestRuns, setInitialTestRuns] = useState<import('../types').TestRun[]>([]);

  // Derived
  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const environments = selectedProject?.environments ?? [];
  const microservices = selectedProject?.microservices ?? [];
  const globalAuthProfiles = selectedProject?.globalAuthProfiles ?? [];
  const featureGroups = selectedProject?.featureGroups ?? [];
  const selectedEnvId = selectedProject?.selectedEnvId ?? '';
  const selectedSvcId = selectedProject?.selectedSvcId ?? '';

  // Project-scoped setters
  const updateCurrentProject = useCallback((updater: (p: Project) => Partial<Project>) => {
    setProjects((prev) => prev.map((p) =>
      p.id === selectedProjectId ? { ...p, ...updater(p) } : p
    ));
  }, [selectedProjectId]);

  const setFeatureGroups: React.Dispatch<React.SetStateAction<FeatureGroup[]>> = useCallback((action) => {
    updateCurrentProject((p) => ({
      featureGroups: typeof action === 'function' ? action(p.featureGroups) : action,
    }));
  }, [updateCurrentProject]);

  const setSelectedEnvId = useCallback((envId: string) => {
    updateCurrentProject(() => ({ selectedEnvId: envId }));
  }, [updateCurrentProject]);

  const setSelectedSvcId = useCallback((svcId: string) => {
    updateCurrentProject(() => ({ selectedSvcId: svcId }));
  }, [updateCurrentProject]);

  const modifyProject = useCallback((projectId: string, fn: (p: Project) => Project) => {
    setProjects((prev) => prev.map((p) => p.id === projectId ? fn(p) : p));
  }, []);

  // Init: load persisted data + migrate legacy
  const initDone = useRef(false);
  useEffect(() => {
    if (initDone.current) return;
    initDone.current = true;
    (async () => {
      const [prjs, prjId, globalAuth, maxR, usage, savedTheme, runs] = await Promise.all([
        loadProjects(),
        loadSelectedProject(),
        loadGlobalAuthProfiles(),
        getMaxRuns(),
        getStorageUsage(),
        loadTheme(),
        loadTestRuns(),
      ]);

      let finalProjects = prjs;
      let finalSelectedId = prjId;

      if (finalProjects.length === 0) {
        const migrated = await migrateLegacyData();
        if (migrated) {
          finalProjects = [migrated];
          finalSelectedId = migrated.id;
          await saveProjects(finalProjects);
          await saveSelectedProject(finalSelectedId);
        }
      }

      if (finalProjects.length === 0) {
        const def = createEmptyProject('Default Project');
        finalProjects = [def];
        finalSelectedId = def.id;
        await saveProjects(finalProjects);
        await saveSelectedProject(finalSelectedId);
      }

      if (!finalProjects.some((p) => p.id === finalSelectedId)) {
        finalSelectedId = finalProjects[0].id;
      }

      setProjects(finalProjects);
      setSelectedProjectId(finalSelectedId);
      setAppGlobalAuthProfiles(globalAuth);
      setInitialMaxRuns(maxR);
      setInitialStorageUsage(usage);
      setInitialTheme(savedTheme);
      setInitialTestRuns(runs);
      document.documentElement.setAttribute('data-theme', savedTheme);
      setLoading(false);
    })();
  }, []);

  // Persistence
  useEffect(() => { if (!loading) void saveProjects(projects); }, [projects, loading]);
  useEffect(() => { if (!loading) void saveSelectedProject(selectedProjectId); }, [selectedProjectId, loading]);
  useEffect(() => { if (!loading) void saveGlobalAuthProfiles(appGlobalAuthProfiles); }, [appGlobalAuthProfiles, loading]);

  // Cross-project move handlers
  const moveFeatureGroup = useCallback((fgId: string, sourceProjectId: string, targetProjectId: string) => {
    if (sourceProjectId === targetProjectId) return;
    setProjects((prev) => {
      const srcProject = prev.find((p) => p.id === sourceProjectId);
      const tgtProject = prev.find((p) => p.id === targetProjectId);
      const fg = srcProject?.featureGroups.find((f) => f.id === fgId);
      if (!fg || !srcProject || !tgtProject) return prev;

      const envToCopy = fg.environmentId && !tgtProject.environments.some((e) => e.id === fg.environmentId)
        ? srcProject.environments.find((e) => e.id === fg.environmentId)
        : undefined;
      const svcToCopy = fg.microserviceId && !tgtProject.microservices.some((s) => s.id === fg.microserviceId)
        ? srcProject.microservices.find((s) => s.id === fg.microserviceId)
        : undefined;
      const isAppGlobalAuth = fg.globalAuthProfileId && appGlobalAuthProfiles.some((a) => a.id === fg.globalAuthProfileId);
      const authToCopy = fg.globalAuthProfileId && !isAppGlobalAuth && !tgtProject.globalAuthProfiles.some((a) => a.id === fg.globalAuthProfileId)
        ? srcProject.globalAuthProfiles.find((a) => a.id === fg.globalAuthProfileId)
        : undefined;

      const extraEnvs: typeof srcProject.environments = [];
      if (svcToCopy) {
        for (const envId of Object.keys(svcToCopy.baseUrls)) {
          const alreadyExists = tgtProject.environments.some((e) => e.id === envId) || envToCopy?.id === envId;
          if (!alreadyExists) {
            const env = srcProject.environments.find((e) => e.id === envId);
            if (env) extraEnvs.push(env);
          }
        }
      }

      return prev.map((p) => {
        if (p.id === sourceProjectId) {
          return { ...p, featureGroups: p.featureGroups.filter((f) => f.id !== fgId) };
        }
        if (p.id === targetProjectId) {
          return {
            ...p,
            environments: [...p.environments, ...(envToCopy ? [envToCopy] : []), ...extraEnvs],
            microservices: svcToCopy ? [...p.microservices, svcToCopy] : p.microservices,
            globalAuthProfiles: authToCopy ? [...p.globalAuthProfiles, authToCopy] : p.globalAuthProfiles,
            featureGroups: [...p.featureGroups, fg],
          };
        }
        return p;
      });
    });
  }, [appGlobalAuthProfiles]);

  const moveScenario = useCallback((scenarioId: string, sourceFgId: string, sourceProjectId: string, targetFgId: string, targetProjectId: string) => {
    setProjects((prev) => {
      const srcProject = prev.find((p) => p.id === sourceProjectId);
      const srcFg = srcProject?.featureGroups.find((f) => f.id === sourceFgId);
      const scenario = srcFg?.scenarios.find((s) => s.id === scenarioId);
      if (!scenario) return prev;

      if (sourceProjectId === targetProjectId) {
        return prev.map((p) => {
          if (p.id !== sourceProjectId) return p;
          return {
            ...p,
            featureGroups: p.featureGroups.map((fg) => {
              if (fg.id === sourceFgId) return { ...fg, scenarios: fg.scenarios.filter((s) => s.id !== scenarioId) };
              if (fg.id === targetFgId) return { ...fg, scenarios: [...fg.scenarios, scenario] };
              return fg;
            }),
          };
        });
      }

      return prev.map((p) => {
        if (p.id === sourceProjectId) {
          return { ...p, featureGroups: p.featureGroups.map((fg) => fg.id === sourceFgId ? { ...fg, scenarios: fg.scenarios.filter((s) => s.id !== scenarioId) } : fg) };
        }
        if (p.id === targetProjectId) {
          return { ...p, featureGroups: p.featureGroups.map((fg) => fg.id === targetFgId ? { ...fg, scenarios: [...fg.scenarios, scenario] } : fg) };
        }
        return p;
      });
    });
  }, []);

  const moveTest = useCallback((testId: string, sourceScenarioId: string, sourceFgId: string, sourceProjectId: string, targetScenarioId: string, targetFgId: string, targetProjectId: string) => {
    setProjects((prev) => {
      const srcProject = prev.find((p) => p.id === sourceProjectId);
      const srcFg = srcProject?.featureGroups.find((f) => f.id === sourceFgId);
      const srcScenario = srcFg?.scenarios.find((s) => s.id === sourceScenarioId);
      const test = srcScenario?.tests.find((t) => t.id === testId);
      if (!test || !srcFg) return prev;

      type Scenarios = typeof srcFg.scenarios;
      const removeFromScenario = (scenarios: Scenarios) =>
        scenarios.map((sc) => sc.id === sourceScenarioId ? { ...sc, tests: sc.tests.filter((t) => t.id !== testId) } : sc);
      const addToScenario = (scenarios: Scenarios) =>
        scenarios.map((sc) => sc.id === targetScenarioId ? { ...sc, tests: [...sc.tests, test] } : sc);

      if (sourceProjectId === targetProjectId) {
        return prev.map((p) => {
          if (p.id !== sourceProjectId) return p;
          return {
            ...p,
            featureGroups: p.featureGroups.map((fg) => {
              if (sourceFgId === targetFgId && fg.id === sourceFgId) {
                let scenarios = removeFromScenario(fg.scenarios);
                scenarios = addToScenario(scenarios);
                return { ...fg, scenarios };
              }
              if (fg.id === sourceFgId) return { ...fg, scenarios: removeFromScenario(fg.scenarios) };
              if (fg.id === targetFgId) return { ...fg, scenarios: addToScenario(fg.scenarios) };
              return fg;
            }),
          };
        });
      }

      return prev.map((p) => {
        if (p.id === sourceProjectId) {
          return { ...p, featureGroups: p.featureGroups.map((fg) => fg.id === sourceFgId ? { ...fg, scenarios: removeFromScenario(fg.scenarios) } : fg) };
        }
        if (p.id === targetProjectId) {
          return { ...p, featureGroups: p.featureGroups.map((fg) => fg.id === targetFgId ? { ...fg, scenarios: addToScenario(fg.scenarios) } : fg) };
        }
        return p;
      });
    });
  }, []);

  return {
    loading, projects, setProjects, selectedProjectId, setSelectedProjectId, selectedProject,
    appGlobalAuthProfiles, setAppGlobalAuthProfiles,
    environments, microservices, globalAuthProfiles, featureGroups, selectedEnvId, selectedSvcId,
    updateCurrentProject, setFeatureGroups, setSelectedEnvId, setSelectedSvcId, modifyProject,
    moveFeatureGroup, moveScenario, moveTest,
    initialMaxRuns, initialStorageUsage, initialTheme, initialTestRuns,
  };
}
