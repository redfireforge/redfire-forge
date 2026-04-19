import { useState, useCallback, useRef, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Scenario, TestScenario, FeatureGroup, Microservice, AuthType, AuthConfig, GlobalAuthProfile } from '../types';
import MoveDialog, { type MoveType, type MoveTarget } from '../components/MoveDialog';
import CsvImportModal from '../components/CsvImportModal';
import { useAuthVerify } from '../hooks/useAuthVerify';
import { saveJsonFile, buildExportFilename } from '../utils/fileSaver';
import { pickJsonFile, reIdScenarios, unwrapImport, wrapExport } from '../utils/scenarioImportExport';
import { buildSearchText, evaluateQuery, parseSearchQuery } from '../utils/scenarioSearch';
import TestEditorModal, { emptyTest, type TestEditorInputMode, type TestEditorTab } from '../components/TestEditorModal';
import AuthConfigPanel from '../components/AuthConfigPanel';
import CopyTestModal from '../components/CopyTestModal';

const SCENARIO_AUTH_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'inherit', label: 'Inherit from Feature' },
  { value: 'none', label: 'No Auth' },
  { value: 'basic', label: 'Basic Auth' },
  { value: 'bearer', label: 'Bearer Token' },
  { value: 'apikey', label: 'API Key' },
  { value: 'digest', label: 'Digest Auth' },
  { value: 'oauth2', label: 'OAuth2 Client Credentials' },
];

function buildScenarioInheritHint(fg: FeatureGroup, allAuthProfiles: GlobalAuthProfile[]): string {
  const fgAuth = fg.auth;
  const authLabel: Record<string, string> = {
    basic: 'Basic Auth', bearer: 'Bearer Token', apikey: 'API Key',
    digest: 'Digest Auth', oauth2: 'OAuth2 Client Credentials',
  };
  if (fgAuth && fgAuth.type !== 'none' && fgAuth.type !== 'inherit') {
    return `Will use feature-level ${authLabel[fgAuth.type] ?? fgAuth.type}`;
  }
  if (fgAuth?.type === 'inherit' && fg.globalAuthProfileId) {
    const profile = allAuthProfiles.find((p) => p.id === fg.globalAuthProfileId);
    return profile
      ? `Will use global profile "${profile.name}" (${authLabel[profile.auth.type] ?? profile.auth.type})`
      : 'Feature references a missing global profile.';
  }
  return 'No auth configured at feature level. Configure it via the "Auth" button on the feature group.';
}

function resolveScenarioInheritedAuth(
  fg: FeatureGroup,
  allAuthProfiles: GlobalAuthProfile[],
): { auth: AuthConfig; label: string } | null {
  const fgAuth = fg.auth;
  if (!fgAuth || fgAuth.type === 'none') return null;
  let resolvedAuth: AuthConfig = fgAuth;
  let resolvedLabel = 'feature';
  if (fgAuth.type === 'inherit' && fg.globalAuthProfileId) {
    const profile = allAuthProfiles.find((p) => p.id === fg.globalAuthProfileId);
    if (!profile) return null;
    resolvedAuth = profile.auth;
    resolvedLabel = profile.name;
  }
  if (resolvedAuth.type === 'none' || resolvedAuth.type === 'inherit') return null;
  return { auth: resolvedAuth, label: resolvedLabel };
}

interface Props {
  featureGroups: FeatureGroup[];
  setFeatureGroups: React.Dispatch<React.SetStateAction<FeatureGroup[]>>;
  resolvedBaseUrl?: string;
  selectedSvcId?: string;
  selectedSvcName?: string;
  selectedEnvId?: string;
  selectedEnvName?: string;
  unassociatedFeatureGroups?: FeatureGroup[];
  microservices?: Microservice[];
  environments?: { id: string; name: string }[];
  globalAuthProfiles?: GlobalAuthProfile[];
  onMoveScenario?: (scenarioId: string, sourceFgId: string, targetFgId: string) => void;
  onMoveTest?: (testId: string, sourceScenarioId: string, sourceFgId: string, targetScenarioId: string, targetFgId: string) => void;
}

export default function ScenarioBuilder({ featureGroups, setFeatureGroups, resolvedBaseUrl, selectedSvcId, selectedSvcName, selectedEnvId, selectedEnvName, unassociatedFeatureGroups = [], microservices = [], environments = [], globalAuthProfiles = [], onMoveScenario, onMoveTest }: Props) {
  const allAuthProfiles = globalAuthProfiles;

  const featureAuthTypeOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    if (allAuthProfiles.length > 0) {
      opts.push({ value: 'inherit', label: 'Inherit from Auth Profile' });
    }
    opts.push(
      { value: 'none', label: 'No Auth' },
      { value: 'basic', label: 'Basic Auth' },
      { value: 'bearer', label: 'Bearer Token' },
      { value: 'apikey', label: 'API Key' },
      { value: 'digest', label: 'Digest Auth' },
      { value: 'oauth2', label: 'OAuth2 Client Credentials' },
    );
    return opts;
  }, [globalAuthProfiles]);

  const resolveEffectiveAuth = useCallback((t: Scenario, sc: TestScenario, fg: FeatureGroup): { label: string; source: string } | null => {
    if (t.auth.type !== 'none' && t.auth.type !== 'inherit') {
      return { label: t.auth.type, source: 'own' };
    }
    const scAuth = sc.auth || { type: 'none' as AuthType };
    if (scAuth.type !== 'none' && scAuth.type !== 'inherit') {
      return { label: scAuth.type, source: 'scenario' };
    }
    const fgAuth = fg.auth;
    if (fgAuth && fgAuth.type !== 'none' && fgAuth.type !== 'inherit') {
      return { label: fgAuth.type, source: 'feature' };
    }
    if (fgAuth?.type === 'inherit' && fg.globalAuthProfileId) {
      const p = allAuthProfiles.find((gp) => gp.id === fg.globalAuthProfileId);
      return p ? { label: `${p.auth.type} (${p.name})`, source: 'global' } : { label: 'global (missing)', source: 'global' };
    }
    return null;
  }, [allAuthProfiles]);
  const [expandedFeatures, setExpandedFeatures] = useState<Set<string>>(new Set());
  const [expandedScenarios, setExpandedScenarios] = useState<Set<string>>(new Set());

  const [namingFeature, setNamingFeature] = useState(false);
  const [namingScenario, setNamingScenario] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  const [editingFeatureName, setEditingFeatureName] = useState<string | null>(null);
  const [editingScenarioName, setEditingScenarioName] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  // Feature auth editing
  const [editingFeatureAuth, setEditingFeatureAuth] = useState<string | null>(null);

  // Scenario auth editing
  const [editingScenarioAuth, setEditingScenarioAuth] = useState<string | null>(null);

  const [editingTest, setEditingTest] = useState<{ featureId: string; scenarioId: string; testId: string | 'new' } | null>(null);
  const [draft, setDraft] = useState<Scenario>(emptyTest());

  // Test editor modal (controlled by parent; UI lives in TestEditorModal)
  const [inputMode, setInputMode] = useState<TestEditorInputMode>('builder');
  const [activeTab, setActiveTab] = useState<TestEditorTab>('params');

  // Move dialog state
  const [moveDialog, setMoveDialog] = useState<{
    type: MoveType;
    itemName: string;
    fgId: string;
    scenarioId?: string;
    testId?: string;
    fgEnvironmentId?: string;
    fgMicroserviceId?: string;
    fgAuthProfileId?: string;
  } | null>(null);

  // CSV Import modal state
  const [csvImportOpen, setCsvImportOpen] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchHelp, setShowSearchHelp] = useState(false);

  // Drag-and-drop state
  const [dragScenario, setDragScenario] = useState<{ scenarioId: string; fromFeatureId: string } | null>(null);
  const [dragTest, setDragTest] = useState<{ testId: string; fromFeatureId: string; fromScenarioId: string } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ type: 'scenario' | 'test'; featureId: string; scenarioId?: string; position?: 'before' | 'after'; targetId?: string } | null>(null);
  const dragHandleActive = useRef(false);

  // load/save is handled by App.tsx to avoid overwriting unfiltered groups

  // Feature Group CRUD
  const addFeatureGroup = () => {
    if (!newName.trim() || !selectedSvcId || !selectedEnvId) return;
    const fg: FeatureGroup = { id: uuidv4(), name: newName.trim(), microserviceId: selectedSvcId, environmentId: selectedEnvId, scenarios: [] };
    setFeatureGroups((prev) => [...prev, fg]);
    setExpandedFeatures((prev) => new Set(prev).add(fg.id));
    setNamingFeature(false);
    setNewName('');
  };

  const assignFeatureGroup = (fgId: string, svcId: string, envId: string) => {
    setFeatureGroups((prev) => prev.map((fg) =>
      fg.id === fgId ? { ...fg, microserviceId: svcId, environmentId: envId } : fg
    ));
  };

  const removeFeatureGroup = (id: string) => {
    const fg = [...featureGroups, ...unassociatedFeatureGroups].find((f) => f.id === id);
    const testCount = fg ? fg.scenarios.reduce((s, sc) => s + sc.tests.length, 0) : 0;
    const detail = testCount > 0 ? ` It contains ${fg!.scenarios.length} scenario(s) and ${testCount} test(s).` : '';
    if (!window.confirm(`Delete feature group "${fg?.name}"?${detail} This cannot be undone.`)) return;
    setFeatureGroups((prev) => prev.filter((f) => f.id !== id));
  };

  const renameFeatureGroup = (id: string) => {
    if (!editName.trim()) return;
    setFeatureGroups((prev) => prev.map((fg) => fg.id === id ? { ...fg, name: editName.trim() } : fg));
    setEditingFeatureName(null);
    setEditName('');
  };

  const addScenario = (featureId: string) => {
    if (!newName.trim()) return;
    const sc: TestScenario = { id: uuidv4(), name: newName.trim(), tests: [] };
    setFeatureGroups((prev) => prev.map((fg) =>
      fg.id === featureId ? { ...fg, scenarios: [...fg.scenarios, sc] } : fg
    ));
    setExpandedScenarios((prev) => new Set(prev).add(sc.id));
    setNamingScenario(null);
    setNewName('');
  };

  const removeScenario = (featureId: string, scenarioId: string) => {
    setFeatureGroups((prev) => prev.map((fg) =>
      fg.id === featureId ? { ...fg, scenarios: fg.scenarios.filter((sc) => sc.id !== scenarioId) } : fg
    ));
  };

  const renameScenario = (featureId: string, scenarioId: string) => {
    if (!editName.trim()) return;
    setFeatureGroups((prev) => prev.map((fg) =>
      fg.id === featureId
        ? { ...fg, scenarios: fg.scenarios.map((sc) => sc.id === scenarioId ? { ...sc, name: editName.trim() } : sc) }
        : fg
    ));
    setEditingScenarioName(null);
    setEditName('');
  };

  // Feature auth
  const updateFeatureAuth = (featureId: string, auth: AuthConfig, globalAuthProfileId?: string) => {
    setFeatureGroups((prev) => prev.map((fg) =>
      fg.id === featureId ? { ...fg, auth, globalAuthProfileId: globalAuthProfileId ?? (auth.type === 'inherit' ? fg.globalAuthProfileId : undefined) } : fg
    ));
  };

  const toggleFeatureAuth = (featureId: string) => {
    setAuthVerifyResult(null);
    if (editingFeatureAuth === featureId) {
      setEditingFeatureAuth(null);
    } else {
      setEditingFeatureAuth(featureId);
      const fg = featureGroups.find((f) => f.id === featureId);
      if (fg && !fg.auth) {
        updateFeatureAuth(featureId, { type: 'none' });
      }
    }
  };

  // Scenario auth
  const updateScenarioAuth = (featureId: string, scenarioId: string, auth: AuthConfig) => {
    setFeatureGroups((prev) => prev.map((fg) =>
      fg.id === featureId
        ? { ...fg, scenarios: fg.scenarios.map((sc) => sc.id === scenarioId ? { ...sc, auth } : sc) }
        : fg
    ));
  };

  const toggleScenarioAuth = (featureId: string, scenarioId: string) => {
    setAuthVerifyResult(null);
    setEditingFeatureAuth(null);
    if (editingScenarioAuth === scenarioId) {
      setEditingScenarioAuth(null);
    } else {
      setEditingScenarioAuth(scenarioId);
      const fg = featureGroups.find((f) => f.id === featureId);
      const sc = fg?.scenarios.find((s) => s.id === scenarioId);
      if (sc && !sc.auth) {
        updateScenarioAuth(featureId, scenarioId, { type: 'none' });
      }
    }
  };

  // Test CRUD
  const startNewTest = (featureId: string, scenarioId: string) => {
    const t = emptyTest();
    setDraft(t);
    setEditingTest({ featureId, scenarioId, testId: 'new' });
    setInputMode('builder');
    setActiveTab('params');
    setAuthVerifyResult(null);
  };

  const startEditTest = (featureId: string, scenarioId: string, test: Scenario) => {
    setDraft({
      ...test,
      headers: [...test.headers],
      validation: { ...test.validation, expectedFields: test.validation.expectedFields ? [...test.validation.expectedFields] : [] },
    });
    setEditingTest({ featureId, scenarioId, testId: test.id });
    setInputMode('builder');
    setActiveTab('params');
  };

  const saveTest = () => {
    if (!editingTest || !draft.name.trim() || !draft.url.trim()) return;
    const { featureId, scenarioId, testId } = editingTest;
    setFeatureGroups((prev) => prev.map((fg) => {
      if (fg.id !== featureId) return fg;
      return {
        ...fg,
        scenarios: fg.scenarios.map((sc) => {
          if (sc.id !== scenarioId) return sc;
          if (testId === 'new') return { ...sc, tests: [...sc.tests, draft] };
          return { ...sc, tests: sc.tests.map((t) => t.id === draft.id ? draft : t) };
        }),
      };
    }));
    setEditingTest(null);
  };

  const removeTest = (featureId: string, scenarioId: string, testId: string) => {
    setFeatureGroups((prev) => prev.map((fg) => {
      if (fg.id !== featureId) return fg;
      return {
        ...fg,
        scenarios: fg.scenarios.map((sc) => {
          if (sc.id !== scenarioId) return sc;
          return { ...sc, tests: sc.tests.filter((t) => t.id !== testId) };
        }),
      };
    }));
  };

  const [copyingTest, setCopyingTest] = useState<{ test: Scenario; sourceFeatureId: string; sourceScenarioId: string } | null>(null);

  const startCopyTest = (featureId: string, scenarioId: string, test: Scenario) => {
    setCopyingTest({ test, sourceFeatureId: featureId, sourceScenarioId: scenarioId });
  };

  const confirmCopyTest = (targetFeatureId: string, targetScenarioId: string) => {
    if (!copyingTest) return;
    const copy: Scenario = {
      ...copyingTest.test,
      id: uuidv4(),
      name: `${copyingTest.test.name} (copy)`,
      headers: copyingTest.test.headers.map((h) => ({ ...h })),
      validation: { ...copyingTest.test.validation, expectedFields: copyingTest.test.validation.expectedFields?.map((f) => ({ ...f })) },
    };
    setFeatureGroups((prev) => prev.map((fg) => {
      if (fg.id !== targetFeatureId) return fg;
      return {
        ...fg,
        scenarios: fg.scenarios.map((sc) => {
          if (sc.id !== targetScenarioId) return sc;
          return { ...sc, tests: [...sc.tests, copy] };
        }),
      };
    }));
    setCopyingTest(null);
  };

  const { authVerifying, authVerifyResult, setAuthVerifyResult, verifyAuth } = useAuthVerify();
  const [showSecret, setShowSecret] = useState(false);

  // ── Export / Import helpers ──
  const downloadJson = (data: unknown, filename: string) => saveJsonFile(data, filename);

  const exportMeta = { microservice: selectedSvcName || undefined, environment: selectedEnvName || undefined };

  const fname = (level: string, name?: string) =>
    buildExportFilename({ env: selectedEnvName, svc: selectedSvcName, level, name });

  // All feature groups
  const exportAll = () => downloadJson(wrapExport(featureGroups, 'feature-groups', exportMeta), fname('feature-groups'));

  const importAll = () => {
    if (!selectedSvcId || !selectedEnvId) { alert('Select a microservice and environment first.'); return; }
    pickJsonFile((raw) => {
      const data = unwrapImport(raw);
      const items = Array.isArray(data) ? data as FeatureGroup[] : [data as FeatureGroup];
      if (!items.every((fg) => fg.name && Array.isArray(fg.scenarios))) {
        alert('Invalid file: expected feature group(s).'); return;
      }
      const existingNames = new Set(featureGroups.map((fg) => fg.name.toLowerCase()));
      const existingIds = new Set(featureGroups.map((fg) => fg.id));
      const conflicts = items.filter((fg) => existingNames.has(fg.name.toLowerCase()) || existingIds.has(fg.id));
      if (conflicts.length > 0) {
        const names = conflicts.map((fg) => `  • "${fg.name}"`).join('\n');
        if (!window.confirm(`The following feature groups already exist:\n${names}\n\nImport as new copies with fresh IDs?`)) return;
      }
      const imported = items.map((fg) => ({ ...fg, id: uuidv4(), microserviceId: selectedSvcId, environmentId: selectedEnvId, scenarios: reIdScenarios(fg.scenarios) }));
      setFeatureGroups((prev) => [...prev, ...imported]);
    });
  };

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
  }, [setFeatureGroups]);

  // Single feature group
  const exportFeatureGroup = (fg: FeatureGroup) =>
    downloadJson(wrapExport(fg, 'feature-group', exportMeta), fname('feature', fg.name));

  const importScenariosInto = (featureId: string) => pickJsonFile((raw) => {
    const data = unwrapImport(raw);
    const items = Array.isArray(data) ? data as TestScenario[] : [data as TestScenario];
    if (!items.every((sc) => sc.name && Array.isArray(sc.tests))) {
      alert('Invalid file: expected scenario(s) with a name and tests array.'); return;
    }
    const fg = featureGroups.find((f) => f.id === featureId);
    if (fg) {
      const existingNames = new Set(fg.scenarios.map((sc) => sc.name.toLowerCase()));
      const dupes = items.filter((sc) => existingNames.has(sc.name.toLowerCase()));
      if (dupes.length > 0) {
        const names = dupes.map((sc) => `  • "${sc.name}"`).join('\n');
        if (!window.confirm(`These scenarios already exist in "${fg.name}":\n${names}\n\nImport as new copies?`)) return;
      }
    }
    const imported = reIdScenarios(items);
    setFeatureGroups((prev) => prev.map((f) =>
      f.id === featureId ? { ...f, scenarios: [...f.scenarios, ...imported] } : f
    ));
  });

  // Single scenario
  const exportScenario = (sc: TestScenario) =>
    downloadJson(wrapExport(sc, 'scenario', exportMeta), fname('scenario', sc.name));

  const importTestsInto = (featureId: string, scenarioId: string) => pickJsonFile((raw) => {
    const data = unwrapImport(raw);
    const items = Array.isArray(data) ? data as Scenario[] : [data as Scenario];
    if (!items.every((t) => t.name && t.url && t.method)) {
      alert('Invalid file: expected test(s) with name, url, and method.'); return;
    }
    const fg = featureGroups.find((f) => f.id === featureId);
    const sc = fg?.scenarios.find((s) => s.id === scenarioId);
    if (sc) {
      const existingNames = new Set(sc.tests.map((t) => t.name.toLowerCase()));
      const dupes = items.filter((t) => existingNames.has(t.name.toLowerCase()));
      if (dupes.length > 0) {
        const names = dupes.map((t) => `  • "${t.name}"`).join('\n');
        if (!window.confirm(`These tests already exist in "${sc.name}":\n${names}\n\nImport as new copies?`)) return;
      }
    }
    const imported = items.map((t) => ({ ...t, id: uuidv4() }));
    setFeatureGroups((prev) => prev.map((f) => {
      if (f.id !== featureId) return f;
      return { ...f, scenarios: f.scenarios.map((s) =>
        s.id === scenarioId ? { ...s, tests: [...s.tests, ...imported] } : s
      )};
    }));
  });

  // Single test
  const exportTest = (t: Scenario) =>
    downloadJson(wrapExport(t, 'test', exportMeta), fname('test', t.name));

  const toggleFeature = (id: string) => {
    setExpandedFeatures((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleScenario = (id: string) => {
    setExpandedScenarios((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const totalTests = featureGroups.reduce((sum, fg) => sum + fg.scenarios.reduce((s2, sc) => s2 + sc.tests.length, 0), 0);

  // ── Drag-and-drop handlers ──
  const moveScenario = useCallback((scenarioId: string, fromFgId: string, toFgId: string, beforeScId?: string) => {
    if (fromFgId === toFgId && !beforeScId) return;
    setFeatureGroups((prev) => {
      let scenario: TestScenario | undefined;
      const without = prev.map((fg) => {
        if (fg.id !== fromFgId) return fg;
        scenario = fg.scenarios.find((sc) => sc.id === scenarioId);
        return { ...fg, scenarios: fg.scenarios.filter((sc) => sc.id !== scenarioId) };
      });
      if (!scenario) return prev;
      return without.map((fg) => {
        if (fg.id !== toFgId) return fg;
        const scenarios = fg.scenarios.filter((sc) => sc.id !== scenarioId);
        if (beforeScId) {
          const idx = scenarios.findIndex((sc) => sc.id === beforeScId);
          if (idx >= 0) { scenarios.splice(idx, 0, scenario!); return { ...fg, scenarios }; }
        }
        scenarios.push(scenario!);
        return { ...fg, scenarios };
      });
    });
  }, [setFeatureGroups]);

  const moveTest = useCallback((testId: string, fromFgId: string, fromScId: string, toFgId: string, toScId: string, beforeTestId?: string) => {
    if (fromFgId === toFgId && fromScId === toScId && !beforeTestId) return;
    setFeatureGroups((prev) => {
      let test: Scenario | undefined;
      const without = prev.map((fg) => {
        if (fg.id !== fromFgId) return fg;
        return {
          ...fg,
          scenarios: fg.scenarios.map((sc) => {
            if (sc.id !== fromScId) return sc;
            test = sc.tests.find((t) => t.id === testId);
            return { ...sc, tests: sc.tests.filter((t) => t.id !== testId) };
          }),
        };
      });
      if (!test) return prev;
      return without.map((fg) => {
        if (fg.id !== toFgId) return fg;
        return {
          ...fg,
          scenarios: fg.scenarios.map((sc) => {
            if (sc.id !== toScId) return sc;
            const tests = sc.tests.filter((t) => t.id !== testId);
            if (beforeTestId) {
              const idx = tests.findIndex((t) => t.id === beforeTestId);
              if (idx >= 0) { tests.splice(idx, 0, test!); return { ...sc, tests }; }
            }
            tests.push(test!);
            return { ...sc, tests };
          }),
        };
      });
    });
  }, [setFeatureGroups]);

  const handleDragEnd = useCallback(() => {
    if (dragScenario && dropTarget?.type === 'scenario') {
      moveScenario(dragScenario.scenarioId, dragScenario.fromFeatureId, dropTarget.featureId, dropTarget.targetId);
    }
    if (dragTest && dropTarget?.type === 'test' && dropTarget.scenarioId) {
      moveTest(dragTest.testId, dragTest.fromFeatureId, dragTest.fromScenarioId, dropTarget.featureId, dropTarget.scenarioId, dropTarget.targetId);
    }
    setDragScenario(null);
    setDragTest(null);
    setDropTarget(null);
  }, [dragScenario, dragTest, dropTarget, moveScenario, moveTest]);

  const handleMoveConfirm = useCallback((target: MoveTarget) => {
    if (!moveDialog) return;
    const { type, fgId, scenarioId, testId } = moveDialog;

    if (type === 'scenario' && scenarioId && target.fgId && onMoveScenario) {
      onMoveScenario(scenarioId, fgId, target.fgId);
    } else if (type === 'test' && testId && scenarioId && target.fgId && target.scenarioId && onMoveTest) {
      onMoveTest(testId, scenarioId, fgId, target.scenarioId, target.fgId);
    }

    setMoveDialog(null);
  }, [moveDialog, onMoveScenario, onMoveTest]);

  const parsedQuery = useMemo(() => parseSearchQuery(searchQuery), [searchQuery]);
  const isSearching = parsedQuery !== null;

  const testMatches = useCallback((t: Scenario): boolean => {
    if (!parsedQuery) return true;
    return evaluateQuery(parsedQuery, buildSearchText(t));
  }, [parsedQuery]);

  const scenarioMatches = useCallback((sc: TestScenario): boolean => {
    if (!parsedQuery) return true;
    if (evaluateQuery(parsedQuery, sc.name)) return true;
    return sc.tests.some((t) => testMatches(t));
  }, [parsedQuery, testMatches]);

  const featureMatches = useCallback((fg: FeatureGroup): boolean => {
    if (!parsedQuery) return true;
    if (evaluateQuery(parsedQuery, fg.name)) return true;
    return fg.scenarios.some((sc) => scenarioMatches(sc));
  }, [parsedQuery, scenarioMatches]);

  const matchCount = useMemo(() => {
    if (!isSearching) return 0;
    let count = 0;
    for (const fg of featureGroups) {
      if (!featureMatches(fg)) continue;
      for (const sc of fg.scenarios) {
        if (!scenarioMatches(sc)) continue;
        count += sc.tests.filter(testMatches).length;
      }
    }
    return count;
  }, [featureGroups, isSearching, featureMatches, scenarioMatches, testMatches]);

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title-block">
          <h2>Feature Groups</h2>
          <div className="context-tags">
            {selectedSvcName && <span className="context-tag svc-tag">{selectedSvcName}</span>}
            {selectedEnvName && <span className="context-tag env-tag">{selectedEnvName}</span>}
          </div>
        </div>
        <div className="header-actions">
          <button className="btn" onClick={importAll} disabled={!selectedSvcId || !selectedEnvId}>Import</button>
          <button className="btn" onClick={exportAll} disabled={featureGroups.length === 0}>Export</button>
          <button className="btn" onClick={() => setCsvImportOpen(true)} disabled={!selectedSvcId || !selectedEnvId || featureGroups.length === 0}>Import Template</button>
          <button className="btn btn-primary" onClick={() => { setNamingFeature(true); setNewName(''); }} disabled={!selectedSvcId || !selectedEnvId}>+ Add Feature Group</button>
        </div>
      </div>

      {(!selectedSvcId || !selectedEnvId) && (
        <div className="empty-state">Select both a microservice and an environment from the sidebar to view and manage feature groups.</div>
      )}

      {selectedSvcId && selectedEnvId && namingFeature && (
        <div className="inline-name-form">
          <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addFeatureGroup(); if (e.key === 'Escape') setNamingFeature(false); }}
            placeholder="Feature group name (e.g. Onboarding)" />
          <button className="btn btn-primary btn-sm" onClick={addFeatureGroup} disabled={!newName.trim()}>Create</button>
          <button className="btn btn-sm" onClick={() => setNamingFeature(false)}>Cancel</button>
        </div>
      )}

      {selectedSvcId && selectedEnvId && featureGroups.length === 0 && !namingFeature && (
        <div className="empty-state">No feature groups for this microservice + environment. Click "+ Add Feature Group" to get started.</div>
      )}

      {selectedSvcId && selectedEnvId && featureGroups.length > 0 && (
        <div className="builder-search-wrapper">
          <div className="builder-search-bar">
            <input
              className="builder-search-input"
              type="text"
              placeholder='Search: terms, "exact phrase", AND, OR, NOT, -exclude, (group)...'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {isSearching && (
              <>
                <span className="builder-search-count">{matchCount} match{matchCount !== 1 ? 'es' : ''}</span>
                <button className="btn btn-xs btn-ghost" onClick={() => setSearchQuery('')}>Clear</button>
              </>
            )}
            <button className="btn btn-xs btn-ghost" onClick={() => setShowSearchHelp((v) => !v)} title="Search syntax help">?</button>
          </div>
          {showSearchHelp && (
            <div className="search-help">
              <table className="search-help-table">
                <tbody>
                  <tr><td><code>trial</code></td><td>Substring match (case-insensitive)</td></tr>
                  <tr><td><code>"OnStar One"</code></td><td>Exact phrase (word boundary)</td></tr>
                  <tr><td><code>trial AND US</code></td><td>Both terms must match</td></tr>
                  <tr><td><code>trial OR spike</code></td><td>Either term matches</td></tr>
                  <tr><td><code>NOT CA</code> or <code>-CA</code></td><td>Exclude term</td></tr>
                  <tr><td><code>(US OR CA) AND trial</code></td><td>Group with parentheses</td></tr>
                  <tr><td><code>onboard US -FL</code></td><td>Implicit AND between terms</td></tr>
                </tbody>
              </table>
              <div className="search-help-fields">Searches: name, URL, method, headers, body, auth, validation rules &amp; expected values</div>
            </div>
          )}
        </div>
      )}

      <div className="feature-tree">
        {featureGroups.filter((fg) => !isSearching || featureMatches(fg)).map((fg) => (
          <div key={fg.id} className="feature-group-card">
            <div className="feature-group-header" onClick={() => toggleFeature(fg.id)}>
              <span className={`expand-icon ${(expandedFeatures.has(fg.id) || isSearching) ? 'expanded' : ''}`}>&#9654;</span>
              {editingFeatureName === fg.id ? (
                <input className="inline-edit-input" autoFocus value={editName}
                  onClick={(e) => e.stopPropagation()} onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') renameFeatureGroup(fg.id); if (e.key === 'Escape') setEditingFeatureName(null); }}
                  onBlur={() => renameFeatureGroup(fg.id)} />
              ) : (
                <strong className="feature-group-name">{fg.name}</strong>
              )}
              <span className="count-badge">{fg.scenarios.length} scenario{fg.scenarios.length !== 1 ? 's' : ''}</span>
              <span className="count-badge">{fg.scenarios.reduce((s, sc) => s + sc.tests.length, 0)} test{fg.scenarios.reduce((s, sc) => s + sc.tests.length, 0) !== 1 ? 's' : ''}</span>
              {fg.auth && fg.auth.type === 'inherit' && fg.globalAuthProfileId && (() => {
                const profile = allAuthProfiles.find((p) => p.id === fg.globalAuthProfileId);
                return profile
                  ? <span className="count-badge auth-badge auth-badge-global">Auth: {profile.name}</span>
                  : <span className="count-badge auth-badge auth-badge-feature">Auth: inherit (missing profile)</span>;
              })()}
              {fg.auth && fg.auth.type !== 'none' && fg.auth.type !== 'inherit' && <span className="count-badge auth-badge auth-badge-feature">Auth: {fg.auth.type}</span>}
              <div className="feature-group-actions" onClick={(e) => e.stopPropagation()}>
                <button className="btn btn-sm" onClick={() => { setEditingFeatureName(fg.id); setEditName(fg.name); }}>Rename</button>
                <button
                  className={`btn btn-sm ${editingFeatureAuth === fg.id ? 'btn-active' : ''}`}
                  onClick={() => toggleFeatureAuth(fg.id)}
                >Auth</button>
                <button className="btn btn-sm" onClick={() => { setNamingScenario(fg.id); setNewName(''); }}>+ Scenario</button>

                <button className="btn btn-sm" onClick={() => importScenariosInto(fg.id)} title="Import scenarios into this feature group">Import</button>
                <button className="btn btn-sm" onClick={() => exportFeatureGroup(fg)} title="Export this feature group">Export</button>
                <button className="btn btn-sm btn-danger" onClick={() => removeFeatureGroup(fg.id)}>Delete</button>
              </div>
            </div>

            {/* Feature-level auth config panel */}
            {editingFeatureAuth === fg.id && (
              <AuthConfigPanel
                panelClassName="scenario-auth-panel feature-auth-panel"
                auth={fg.auth || { type: 'none' as AuthType }}
                onChange={(next) => updateFeatureAuth(fg.id, next)}
                title="Feature Auth"
                hint="Inherited by all scenarios in this feature (unless overridden)"
                showProfileSelector
                globalAuthProfileId={fg.globalAuthProfileId}
                onProfileChange={(profileId) => updateFeatureAuth(fg.id, fg.auth || { type: 'none' }, profileId)}
                allAuthProfiles={allAuthProfiles}
                authVerifying={authVerifying}
                authVerifyResult={authVerifyResult}
                setAuthVerifyResult={setAuthVerifyResult}
                verifyAuth={verifyAuth}
                showSecret={showSecret}
                setShowSecret={setShowSecret}
                authTypeOptions={featureAuthTypeOptions}
              />
            )}

            {(expandedFeatures.has(fg.id) || isSearching) && (
              <div className="feature-group-body">
                {namingScenario === fg.id && (
                  <div className="inline-name-form nested">
                    <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') addScenario(fg.id); if (e.key === 'Escape') setNamingScenario(null); }}
                      placeholder="Scenario name (e.g. Happy Path)" />
                    <button className="btn btn-primary btn-sm" onClick={() => addScenario(fg.id)} disabled={!newName.trim()}>Create</button>
                    <button className="btn btn-sm" onClick={() => setNamingScenario(null)}>Cancel</button>
                  </div>
                )}
                {fg.scenarios.length === 0 && namingScenario !== fg.id && (
                  <div
                    className={`empty-hint ${dragScenario && dragScenario.fromFeatureId !== fg.id ? 'drop-zone-active' : ''} ${dropTarget?.type === 'scenario' && dropTarget.featureId === fg.id && !dropTarget.targetId ? 'drop-zone-hover' : ''}`}
                    onDragOver={(e) => { if (dragScenario) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDropTarget({ type: 'scenario', featureId: fg.id }); } }}
                    onDragLeave={() => { if (dropTarget?.featureId === fg.id && !dropTarget.targetId) setDropTarget(null); }}
                    onDrop={handleDragEnd}
                  >
                    {dragScenario ? 'Drop scenario here' : 'No scenarios. Click "+ Scenario" to add one.'}
                  </div>
                )}
                {fg.scenarios.filter((sc) => !isSearching || scenarioMatches(sc)).map((sc) => {
                  const scAuth = sc.auth || { type: 'none' as AuthType };
                  const isScDragOver = dropTarget?.type === 'scenario' && dropTarget.featureId === fg.id && dropTarget.targetId === sc.id;
                  const isSelfScDrag = dragScenario?.scenarioId === sc.id && dragScenario?.fromFeatureId === fg.id;
                  return (
                  <div
                    key={`${fg.id}-${sc.id}`}
                    className={`scenario-group-card ${isSelfScDrag ? 'dragging' : ''} ${isScDragOver ? 'drop-target-before' : ''}`}
                    draggable
                    onDragStart={(e) => {
                      if (!dragHandleActive.current) { e.preventDefault(); return; }
                      dragHandleActive.current = false;
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', `sc:${fg.id}:${sc.id}`);
                      requestAnimationFrame(() => {
                        setDragScenario({ scenarioId: sc.id, fromFeatureId: fg.id });
                        setDragTest(null);
                      });
                    }}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => {
                      if (!dragScenario || isSelfScDrag) return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      setDropTarget({ type: 'scenario', featureId: fg.id, targetId: sc.id });
                    }}
                  >
                    <div className="scenario-group-header" onClick={() => toggleScenario(sc.id)}>
                      <span className="drag-handle" title="Drag to reorder or move" onMouseDown={() => { dragHandleActive.current = true; }} onMouseUp={() => { dragHandleActive.current = false; }}>⠿</span>
                      <span className={`expand-icon small ${(expandedScenarios.has(sc.id) || isSearching) ? 'expanded' : ''}`}>&#9654;</span>
                      {editingScenarioName === sc.id ? (
                        <input className="inline-edit-input" autoFocus value={editName}
                          onClick={(e) => e.stopPropagation()} onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') renameScenario(fg.id, sc.id); if (e.key === 'Escape') setEditingScenarioName(null); }}
                          onBlur={() => renameScenario(fg.id, sc.id)} />
                      ) : (
                        <span className="scenario-group-name">{sc.name}</span>
                      )}
                      <span className="count-badge">{sc.tests.length} test{sc.tests.length !== 1 ? 's' : ''}</span>
                      {scAuth.type !== 'none' && scAuth.type !== 'inherit' && <span className="count-badge auth-badge auth-badge-scenario">Auth: {scAuth.type}</span>}
                      {scAuth.type === 'inherit' && <span className="count-badge auth-badge auth-badge-scenario-inherit">Auth: inherit</span>}
                      <div className="scenario-group-actions" onClick={(e) => e.stopPropagation()}>
                        <button className="btn btn-sm" onClick={() => { setEditingScenarioName(sc.id); setEditName(sc.name); }}>Rename</button>
                        <button
                          className={`btn btn-sm ${editingScenarioAuth === sc.id ? 'btn-active' : ''}`}
                          onClick={() => toggleScenarioAuth(fg.id, sc.id)}
                        >Auth</button>
                        <button className="btn btn-sm" onClick={() => startNewTest(fg.id, sc.id)}>+ Test</button>
                        <button className="btn btn-sm" onClick={() => setMoveDialog({ type: 'scenario', itemName: sc.name, fgId: fg.id, scenarioId: sc.id })} title="Move to another feature group">Move</button>
                        <button className="btn btn-sm" onClick={() => importTestsInto(fg.id, sc.id)} title="Import tests into this scenario">Import</button>
                        <button className="btn btn-sm" onClick={() => exportScenario(sc)} title="Export this scenario">Export</button>
                        <button className="btn btn-sm btn-danger" onClick={() => removeScenario(fg.id, sc.id)}>Delete</button>
                      </div>
                    </div>

                    {/* Scenario-level auth config panel */}
                    {editingScenarioAuth === sc.id && (() => {
                      const inherited = resolveScenarioInheritedAuth(fg, allAuthProfiles);
                      return (
                        <AuthConfigPanel
                          auth={scAuth}
                          onChange={(next) => updateScenarioAuth(fg.id, sc.id, next)}
                          title="Scenario Auth"
                          hint="Applied to all tests in this scenario (unless overridden at test level)"
                          inheritHint={scAuth.type === 'inherit' ? buildScenarioInheritHint(fg, allAuthProfiles) : null}
                          inheritedAuth={inherited?.auth ?? null}
                          inheritedLabel={inherited?.label}
                          allAuthProfiles={allAuthProfiles}
                          authVerifying={authVerifying}
                          authVerifyResult={authVerifyResult}
                          setAuthVerifyResult={setAuthVerifyResult}
                          verifyAuth={verifyAuth}
                          showSecret={showSecret}
                          setShowSecret={setShowSecret}
                          authTypeOptions={SCENARIO_AUTH_TYPE_OPTIONS}
                        />
                      );
                    })()}

                    {(expandedScenarios.has(sc.id) || isSearching) && (
                      <div
                        className="scenario-group-body"
                        onDragOver={(e) => { if (dragTest && sc.tests.length === 0) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDropTarget({ type: 'test', featureId: fg.id, scenarioId: sc.id }); } }}
                        onDrop={() => { if (dragTest && sc.tests.length === 0) handleDragEnd(); }}
                      >
                        {sc.tests.length === 0 && (
                          <div className={`empty-hint ${dragTest ? 'drop-zone-active' : ''} ${dropTarget?.type === 'test' && dropTarget.scenarioId === sc.id && !dropTarget.targetId ? 'drop-zone-hover' : ''}`}>
                            {dragTest ? 'Drop test here' : 'No tests. Click "+ Test" to add an HTTP request.'}
                          </div>
                        )}
                        {sc.tests.filter((t) => !isSearching || testMatches(t)).map((t, tIdx) => {
                          const isTestDragOver = dropTarget?.type === 'test' && dropTarget.scenarioId === sc.id && dropTarget.targetId === t.id;
                          const isSelfTestDrag = dragTest?.testId === t.id && dragTest?.fromFeatureId === fg.id && dragTest?.fromScenarioId === sc.id;
                          return (
                          <div
                            key={`${fg.id}-${sc.id}-${t.id}`}
                            className={`test-card ${isSelfTestDrag ? 'dragging' : ''} ${isTestDragOver ? 'drop-target-before' : ''} ${isSearching && testMatches(t) ? 'search-match' : ''}`}
                            draggable
                            onDragStart={(e) => {
                              if (!dragHandleActive.current) { e.preventDefault(); return; }
                              dragHandleActive.current = false;
                              e.stopPropagation();
                              e.dataTransfer.effectAllowed = 'move';
                              e.dataTransfer.setData('text/plain', `t:${fg.id}:${sc.id}:${t.id}`);
                              requestAnimationFrame(() => {
                                setDragTest({ testId: t.id, fromFeatureId: fg.id, fromScenarioId: sc.id });
                                setDragScenario(null);
                              });
                            }}
                            onDragEnd={handleDragEnd}
                            onDragOver={(e) => { if (dragTest && !isSelfTestDrag) { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'move'; setDropTarget({ type: 'test', featureId: fg.id, scenarioId: sc.id, targetId: t.id }); } }}
                          >
                            <div className="test-card-info">
                              <span className="drag-handle" title="Drag to reorder or move" onMouseDown={() => { dragHandleActive.current = true; }} onMouseUp={() => { dragHandleActive.current = false; }}>⠿</span>
                              <span className="test-number">{tIdx + 1}</span>
                              <span className={`method-badge method-${t.method.toLowerCase()}`}>{t.method}</span>
                              <strong>{t.name}</strong>
                            </div>
                            <div className="test-card-meta">
                              {(() => {
                                const resolved = resolveEffectiveAuth(t, sc, fg);
                                if (!resolved) return <span className="tag auth-badge auth-badge-test-none">Auth: none</span>;
                                const cls = resolved.source === 'own' ? 'auth-badge-test-own'
                                  : resolved.source === 'scenario' ? 'auth-badge-test-scenario'
                                  : resolved.source === 'feature' ? 'auth-badge-test-feature'
                                  : 'auth-badge-test-global';
                                return <span className={`tag auth-badge ${cls}`}>Auth: {resolved.label} ({resolved.source})</span>;
                              })()}
                              <span className="tag">Validation: {t.validation.mode}</span>
                              {(t.validation.assertions ?? []).length > 0 && (() => {
                                const types = new Set((t.validation.assertions ?? []).map(a => a.type));
                                return (
                                  <>
                                    {types.has('status') && <span className="tag assertion-badge assertion-badge-status">Status</span>}
                                    {types.has('responseTime') && <span className="tag assertion-badge assertion-badge-time">SLA</span>}
                                    {types.has('header') && <span className="tag assertion-badge assertion-badge-header">Header</span>}
                                    {types.has('regex') && <span className="tag assertion-badge assertion-badge-regex">Regex</span>}
                                  </>
                                );
                              })()}
                            </div>
                            <div className="test-card-actions">
                              <button className="btn btn-sm" onClick={() => startEditTest(fg.id, sc.id, t)}>Edit</button>
                              <button className="btn btn-sm" onClick={() => startCopyTest(fg.id, sc.id, t)} title="Copy to another scenario">Copy</button>
                              <button className="btn btn-sm" onClick={() => setMoveDialog({ type: 'test', itemName: t.name || t.url, fgId: fg.id, scenarioId: sc.id, testId: t.id })} title="Move to another scenario">Move</button>
                              <button className="btn btn-sm" onClick={() => exportTest(t)} title="Export this test">Export</button>
                              <button className="btn btn-sm btn-danger" onClick={() => removeTest(fg.id, sc.id, t.id)}>Delete</button>
                            </div>
                          </div>
                          );
                        })}
                        {dragTest && sc.tests.length > 0 && (
                          <div
                            className={`drop-zone-end drop-zone-end-sm ${dropTarget?.type === 'test' && dropTarget.scenarioId === sc.id && !dropTarget.targetId ? 'drop-zone-hover' : ''}`}
                            onDragOver={(e) => { if (dragTest) { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'move'; setDropTarget({ type: 'test', featureId: fg.id, scenarioId: sc.id }); } }}
                            onDrop={handleDragEnd}
                          >
                            Drop here
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  );
                })}
                {dragScenario && fg.scenarios.length > 0 && (
                  <div
                    className={`drop-zone-end ${dropTarget?.type === 'scenario' && dropTarget.featureId === fg.id && !dropTarget.targetId ? 'drop-zone-hover' : ''}`}
                    onDragOver={(e) => { if (dragScenario) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDropTarget({ type: 'scenario', featureId: fg.id }); } }}
                    onDragLeave={() => { if (dropTarget?.featureId === fg.id && !dropTarget.targetId) setDropTarget(null); }}
                    onDrop={handleDragEnd}
                  >
                    Drop here to add at end
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {featureGroups.length > 0 && (
        <div className="tree-summary">
          {featureGroups.length} feature group{featureGroups.length !== 1 ? 's' : ''} &middot; {featureGroups.reduce((s, fg) => s + fg.scenarios.length, 0)} scenario{featureGroups.reduce((s, fg) => s + fg.scenarios.length, 0) !== 1 ? 's' : ''} &middot; {totalTests} test{totalTests !== 1 ? 's' : ''}
        </div>
      )}

      {unassociatedFeatureGroups.length > 0 && (
        <div className="unassociated-section">
          <h3>Unassigned Feature Groups ({unassociatedFeatureGroups.length})</h3>
          <p className="unassociated-hint">These feature groups need a microservice and environment assignment. {selectedSvcId && selectedEnvId ? 'Click "Assign here" to assign to the current selection.' : 'Select both from the sidebar, or use the dropdowns below.'}</p>
          {unassociatedFeatureGroups.map((fg) => (
            <div key={fg.id} className="unassociated-card">
              <div className="unassociated-info">
                <strong>{fg.name}</strong>
                <span className="count-badge">{fg.scenarios.length} scenario{fg.scenarios.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="unassociated-actions">
                {selectedSvcId && selectedEnvId ? (
                  <button className="btn btn-sm btn-primary" onClick={() => assignFeatureGroup(fg.id, selectedSvcId, selectedEnvId)}>
                    Assign here
                  </button>
                ) : (
                  <>
                    <select id={`svc-${fg.id}`} defaultValue="">
                      <option value="" disabled>Microservice…</option>
                      {microservices.map((svc) => (
                        <option key={svc.id} value={svc.id}>{svc.name}</option>
                      ))}
                    </select>
                    <select id={`env-${fg.id}`} defaultValue="">
                      <option value="" disabled>Environment…</option>
                      {environments.map((env) => (
                        <option key={env.id} value={env.id}>{env.name}</option>
                      ))}
                    </select>
                    <button className="btn btn-sm btn-primary" onClick={() => {
                      const svcEl = document.getElementById(`svc-${fg.id}`) as HTMLSelectElement;
                      const envEl = document.getElementById(`env-${fg.id}`) as HTMLSelectElement;
                      if (svcEl?.value && envEl?.value) assignFeatureGroup(fg.id, svcEl.value, envEl.value);
                      else alert('Select both a microservice and an environment.');
                    }}>Assign</button>
                  </>
                )}

                <button className="btn btn-sm btn-danger" onClick={() => removeFeatureGroup(fg.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {copyingTest && (
        <CopyTestModal
          test={copyingTest.test}
          sourceFeatureId={copyingTest.sourceFeatureId}
          sourceScenarioId={copyingTest.sourceScenarioId}
          featureGroups={featureGroups}
          onConfirm={confirmCopyTest}
          onClose={() => setCopyingTest(null)}
        />
      )}

      {editingTest && (
        <TestEditorModal
          key={`${editingTest.featureId}-${editingTest.scenarioId}-${editingTest.testId}-${draft.id}`}
          draft={draft}
          onDraftChange={(d) => setDraft(d)}
          onSave={saveTest}
          onCancel={() => setEditingTest(null)}
          isNew={editingTest.testId === 'new'}
          inputMode={inputMode}
          onInputModeChange={setInputMode}
          activeTab={activeTab}
          onActiveTabChange={setActiveTab}
          resolvedBaseUrl={resolvedBaseUrl ?? ''}
          allAuthProfiles={allAuthProfiles}
          featureGroups={featureGroups}
          editingTest={{ fgId: editingTest.featureId, scenarioId: editingTest.scenarioId, testId: editingTest.testId }}
          onExportTest={exportTest}
        />
      )}

      {moveDialog && (
        <MoveDialog
          type={moveDialog.type}
          itemName={moveDialog.itemName}
          featureGroups={featureGroups}
          currentFgId={moveDialog.fgId}
          currentScenarioId={moveDialog.scenarioId}
          onMove={handleMoveConfirm}
          onClose={() => setMoveDialog(null)}
        />
      )}

      {csvImportOpen && (
        <CsvImportModal
          featureGroups={featureGroups}
          onImport={handleCsvImport}
          onClose={() => setCsvImportOpen(false)}
        />
      )}
    </div>
  );
}

