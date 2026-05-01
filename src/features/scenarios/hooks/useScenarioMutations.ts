import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Scenario, TestScenario, FeatureGroup, AuthConfig } from '../../../shared/types';
import type { TestDefinitionVersion } from '../../../shared/types';
import { emptyTest } from '../utils/testEditorUtils';
import { autoSaveVersion } from '../utils/testDefinitionVersioning';
import {
  logScenarioAdded, logScenarioRemoved, logScenarioRenamed,
  logTestAdded, logTestRemoved, logTestCopied, logFgRenamed,
  logTestRenamed,
} from '../utils/structureChangeLog';
import type { TestEditorInputMode, TestEditorTab } from '../components/TestEditorModal';

export interface ConfirmDialog {
  title: string;
  message: string;
  onConfirm: () => void;
}

interface UseScenarioMutationsOpts {
  featureGroups: FeatureGroup[];
  setFeatureGroups: React.Dispatch<React.SetStateAction<FeatureGroup[]>>;
  unassociatedFeatureGroups: FeatureGroup[];
  selectedSvcId?: string;
  selectedEnvId?: string;
  clearAuthVerifyResult?: () => void;
}

export function useScenarioMutations({
  featureGroups,
  setFeatureGroups,
  unassociatedFeatureGroups,
  selectedSvcId,
  selectedEnvId,
  clearAuthVerifyResult,
}: UseScenarioMutationsOpts) {
  const [expandedFeatures, setExpandedFeatures] = useState<Set<string>>(new Set());
  const [expandedScenarios, setExpandedScenarios] = useState<Set<string>>(new Set());

  const [namingFeature, setNamingFeature] = useState(false);
  const [namingScenario, setNamingScenario] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  const [editingFeatureName, setEditingFeatureName] = useState<string | null>(null);
  const [editingScenarioName, setEditingScenarioName] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const [editingFeatureAuth, setEditingFeatureAuth] = useState<string | null>(null);
  const [editingScenarioAuth, setEditingScenarioAuth] = useState<string | null>(null);

  const [editingTest, setEditingTest] = useState<{ featureId: string; scenarioId: string; testId: string | 'new' } | null>(null);
  const [draft, setDraft] = useState<Scenario>(emptyTest());
  const [inputMode, setInputMode] = useState<TestEditorInputMode>('builder');
  const [activeTab, setActiveTab] = useState<TestEditorTab>('params');

  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog | null>(null);
  const [copyingTest, setCopyingTest] = useState<{ test: Scenario; sourceFeatureId: string; sourceScenarioId: string } | null>(null);

  const allFgs = [...featureGroups, ...unassociatedFeatureGroups];

  // ── Feature Group CRUD ──

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
    const fg = allFgs.find((f) => f.id === id);
    const testCount = fg ? fg.scenarios.reduce((s, sc) => s + sc.tests.length, 0) : 0;
    const detail = testCount > 0 ? ` It contains ${fg!.scenarios.length} scenario(s) and ${testCount} test(s).` : '';
    setConfirmDialog({
      title: 'Delete Feature Group',
      message: `Delete feature group "${fg?.name}"?${detail} This cannot be undone.`,
      onConfirm: () => {
        setFeatureGroups((prev) => prev.filter((f) => f.id !== id));
        setConfirmDialog(null);
      },
    });
  };

  const renameFeatureGroup = (id: string) => {
    if (!editName.trim()) return;
    setFeatureGroups((prev) => prev.map((fg) => {
      if (fg.id !== id) return fg;
      const updated = { ...fg, name: editName.trim() };
      return fg.name !== editName.trim() ? logFgRenamed(updated, fg.name, editName.trim()) : updated;
    }));
    setEditingFeatureName(null);
    setEditName('');
  };

  // ── Scenario CRUD ──

  const addScenario = (featureId: string) => {
    if (!newName.trim()) return;
    const sc: TestScenario = { id: uuidv4(), name: newName.trim(), tests: [] };
    setFeatureGroups((prev) => prev.map((fg) =>
      fg.id === featureId ? logScenarioAdded({ ...fg, scenarios: [...fg.scenarios, sc] }, sc.name) : fg
    ));
    setExpandedScenarios((prev) => new Set(prev).add(sc.id));
    setNamingScenario(null);
    setNewName('');
  };

  const removeScenario = (featureId: string, scenarioId: string) => {
    const fg = allFgs.find((f) => f.id === featureId);
    const sc = fg?.scenarios.find((s) => s.id === scenarioId);
    const testCount = sc ? sc.tests.length : 0;
    const detail = testCount > 0 ? ` It contains ${testCount} test(s).` : '';
    setConfirmDialog({
      title: 'Delete Scenario',
      message: `Delete scenario "${sc?.name}"?${detail} This cannot be undone.`,
      onConfirm: () => {
        setFeatureGroups((prev) => prev.map((f) =>
          f.id === featureId ? logScenarioRemoved({ ...f, scenarios: f.scenarios.filter((s) => s.id !== scenarioId) }, sc?.name ?? '') : f
        ));
        setConfirmDialog(null);
      },
    });
  };

  const renameScenario = (featureId: string, scenarioId: string) => {
    if (!editName.trim()) return;
    setFeatureGroups((prev) => prev.map((fg) =>
      fg.id === featureId
        ? (() => {
            const oldSc = fg.scenarios.find(s => s.id === scenarioId);
            const updated = { ...fg, scenarios: fg.scenarios.map((sc) => sc.id === scenarioId ? { ...sc, name: editName.trim() } : sc) };
            return oldSc && oldSc.name !== editName.trim() ? logScenarioRenamed(updated, oldSc.name, editName.trim()) : updated;
          })()
        : fg
    ));
    setEditingScenarioName(null);
    setEditName('');
  };

  // ── Auth ──

  const updateFeatureAuth = (featureId: string, auth: AuthConfig, globalAuthProfileId?: string) => {
    setFeatureGroups((prev) => prev.map((fg) =>
      fg.id === featureId ? { ...fg, auth, globalAuthProfileId: globalAuthProfileId ?? (auth.type === 'inherit' ? fg.globalAuthProfileId : undefined) } : fg
    ));
  };

  const toggleFeatureAuth = (featureId: string) => {
    clearAuthVerifyResult?.();
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

  const updateScenarioAuth = (featureId: string, scenarioId: string, auth: AuthConfig) => {
    setFeatureGroups((prev) => prev.map((fg) =>
      fg.id === featureId
        ? { ...fg, scenarios: fg.scenarios.map((sc) => sc.id === scenarioId ? { ...sc, auth } : sc) }
        : fg
    ));
  };

  const toggleScenarioAuth = (featureId: string, scenarioId: string) => {
    clearAuthVerifyResult?.();
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

  // ── Test CRUD ──

  const startNewTest = (featureId: string, scenarioId: string) => {
    const t = emptyTest();
    setDraft(t);
    setEditingTest({ featureId, scenarioId, testId: 'new' });
    setInputMode('builder');
    setActiveTab('params');
    clearAuthVerifyResult?.();
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

    let finalDraft = draft;

    // Auto-switch: if "Full JSON Match" is selected but no expected JSON is provided,
    // silently downgrade to 'none' to avoid a no-op validation mode
    if (finalDraft.validation.mode === 'full' && !finalDraft.validation.expectedJson?.trim()) {
      finalDraft = { ...finalDraft, validation: { ...finalDraft.validation, mode: 'none' } };
      setDraft(finalDraft);
    }

    if (testId !== 'new') {
      const newVersions = autoSaveVersion(draft);
      if (newVersions) {
        finalDraft = { ...draft, definitionVersions: newVersions };
        setDraft(finalDraft);
      }
    }

    setFeatureGroups((prev) => prev.map((fg) => {
      if (fg.id !== featureId) return fg;
      const sc = fg.scenarios.find(s => s.id === scenarioId);
      let updated = {
        ...fg,
        scenarios: fg.scenarios.map((sc) => {
          if (sc.id !== scenarioId) return sc;
          if (testId === 'new') return { ...sc, tests: [...sc.tests, finalDraft] };
          return { ...sc, tests: sc.tests.map((t) => t.id === finalDraft.id ? finalDraft : t) };
        }),
      };
      if (testId === 'new') {
        updated = logTestAdded(updated, finalDraft.name, sc?.name ?? '');
      } else {
        const oldTest = sc?.tests.find(t => t.id === finalDraft.id);
        if (oldTest && oldTest.name !== finalDraft.name) {
          updated = logTestRenamed(updated, oldTest.name, finalDraft.name, sc?.name ?? '');
        }
      }
      return updated;
    }));
    setEditingTest(null);
  };

  const handleVersionRestore = useCallback((version: TestDefinitionVersion) => {
    setDraft((prev) => ({
      ...prev,
      name: version.snapshot.name,
      url: version.snapshot.url,
      method: version.snapshot.method,
      headers: version.snapshot.headers,
      body: version.snapshot.body,
      bodyType: version.snapshot.bodyType,
      bodyForm: version.snapshot.bodyForm,
      auth: version.snapshot.auth,
      extractions: version.snapshot.extractions,
    }));
  }, []);

  const handleVersionDelete = useCallback((versionId: string) => {
    setDraft((prev) => ({
      ...prev,
      definitionVersions: (prev.definitionVersions ?? []).filter((v) => v.id !== versionId),
    }));
  }, []);

  const handleVersionRename = useCallback((versionId: string, label: string) => {
    setDraft((prev) => ({
      ...prev,
      definitionVersions: (prev.definitionVersions ?? []).map((v) =>
        v.id === versionId ? { ...v, label } : v
      ),
    }));
  }, []);

  const removeTest = (featureId: string, scenarioId: string, testId: string) => {
    const fg = allFgs.find((f) => f.id === featureId);
    const sc = fg?.scenarios.find((s) => s.id === scenarioId);
    const t = sc?.tests.find((test) => test.id === testId);
    setConfirmDialog({
      title: 'Delete Test',
      message: `Delete test "${t?.name}"? This cannot be undone.`,
      onConfirm: () => {
        setFeatureGroups((prev) => prev.map((f) => {
          if (f.id !== featureId) return f;
          const updated = {
            ...f,
            scenarios: f.scenarios.map((s) => {
              if (s.id !== scenarioId) return s;
              return { ...s, tests: s.tests.filter((test) => test.id !== testId) };
            }),
          };
          return logTestRemoved(updated, t?.name ?? '', sc?.name ?? '');
        }));
        setConfirmDialog(null);
      },
    });
  };

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
      const targetSc = fg.scenarios.find(s => s.id === targetScenarioId);
      const updated = {
        ...fg,
        scenarios: fg.scenarios.map((sc) => {
          if (sc.id !== targetScenarioId) return sc;
          return { ...sc, tests: [...sc.tests, copy] };
        }),
      };
      return logTestCopied(updated, copy.name, targetSc?.name ?? '');
    }));
    setCopyingTest(null);
  };

  // ── Toggle helpers ──

  const toggleFeature = (id: string) => {
    setExpandedFeatures((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };

  const toggleScenario = (id: string) => {
    setExpandedScenarios((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };

  return {
    // UI state
    expandedFeatures, expandedScenarios,
    namingFeature, setNamingFeature,
    namingScenario, setNamingScenario,
    newName, setNewName,
    editingFeatureName, setEditingFeatureName,
    editingScenarioName, setEditingScenarioName,
    editName, setEditName,
    editingFeatureAuth, setEditingFeatureAuth,
    editingScenarioAuth, setEditingScenarioAuth,
    editingTest, setEditingTest,
    draft, setDraft,
    inputMode, setInputMode,
    activeTab, setActiveTab,
    confirmDialog, setConfirmDialog,
    copyingTest, setCopyingTest,
    // Feature Group
    addFeatureGroup, assignFeatureGroup, removeFeatureGroup, renameFeatureGroup,
    // Scenario
    addScenario, removeScenario, renameScenario,
    // Auth
    updateFeatureAuth, toggleFeatureAuth,
    updateScenarioAuth, toggleScenarioAuth,
    // Test
    startNewTest, startEditTest, saveTest, removeTest,
    startCopyTest, confirmCopyTest,
    // Version
    handleVersionRestore, handleVersionDelete, handleVersionRename,
    // Toggle
    toggleFeature, toggleScenario,
  };
}
