import { useState, useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Scenario, FeatureGroup, SharedDataSource, DataSource, KeyValue, AuthConfig } from '../../../shared/types';
import type { TestEditorInputMode, TestEditorTab } from '../components/TestEditorModal';

interface EditingTest {
  featureId: string;
  scenarioId: string;
  testId: string;
  parameterized?: boolean;
  openDataSourceWizard?: boolean;
}

interface UseSharedDataSourceHandlersParams {
  featureGroups: FeatureGroup[];
  setFeatureGroups: React.Dispatch<React.SetStateAction<FeatureGroup[]>>;
  setSharedDataSources?: React.Dispatch<React.SetStateAction<SharedDataSource[]>>;
  editingTest: EditingTest | null;
  draft: Scenario | null;
  setDraft: React.Dispatch<React.SetStateAction<Scenario>>;
  setEditingTest: React.Dispatch<React.SetStateAction<EditingTest | null>>;
  setInputMode: React.Dispatch<React.SetStateAction<TestEditorInputMode>>;
  setActiveTab: React.Dispatch<React.SetStateAction<TestEditorTab>>;
}

export function useSharedDataSourceHandlers({
  featureGroups,
  setFeatureGroups,
  setSharedDataSources,
  editingTest,
  draft,
  setDraft,
  setEditingTest,
  setInputMode,
  setActiveTab,
}: UseSharedDataSourceHandlersParams) {
  const [showSharedDsModal, setShowSharedDsModal] = useState(false);
  const [sharedDsModalSelectedId, setSharedDsModalSelectedId] = useState<string | undefined>(undefined);
  const [showFromSharedDsPicker, setShowFromSharedDsPicker] = useState<{ fgId: string; scId: string } | null>(null);

  const currentEditingDraft = useMemo(() => {
    if (!editingTest || !draft) return undefined;
    const fg = featureGroups.find(f => f.id === editingTest.featureId);
    const sc = fg?.scenarios.find(s => s.id === editingTest.scenarioId);
    if (!fg || !sc) return undefined;
    return { fgName: fg.name, scenarioName: sc.name, test: draft };
  }, [editingTest, draft, featureGroups]);

  const handlePromoteToShared = useCallback((
    dataSource: DataSource,
    name: string,
    tags?: string[],
    fetchConfig?: { url: string; method: string; headers: KeyValue[]; auth?: AuthConfig }
  ): string => {
    if (!setSharedDataSources) {
      console.warn('handlePromoteToShared: setSharedDataSources not available');
      return '';
    }
    const newSharedDs: SharedDataSource = {
      id: uuidv4(),
      name,
      tags,
      dataSource,
      updatedAt: Date.now(),
      fetchConfig: fetchConfig ? {
        url: fetchConfig.url,
        method: (fetchConfig.method as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE') || 'GET',
        headers: fetchConfig.headers || [],
        auth: fetchConfig.auth,
      } : undefined,
    };
    setSharedDataSources(prev => [...prev, newSharedDs]);
    return newSharedDs.id;
  }, [setSharedDataSources]);

  const handleCreateTestFromSharedDs = useCallback((
    sharedDs: SharedDataSource,
    targetFgId: string,
    targetScenarioId: string,
    testName: string,
    openWizard?: boolean
  ) => {
    const newTest: Scenario = {
      id: uuidv4(),
      name: testName,
      url: sharedDs.fetchConfig?.url || '',
      method: sharedDs.fetchConfig?.method || 'GET',
      headers: sharedDs.fetchConfig?.headers || [],
      body: '',
      auth: sharedDs.fetchConfig?.auth || { type: 'none' },
      validation: { mode: 'none' },
      sharedDataSourceId: sharedDs.id,
    };
    setFeatureGroups(prev => prev.map(fg => {
      if (fg.id !== targetFgId) return fg;
      return {
        ...fg,
        scenarios: fg.scenarios.map(sc => {
          if (sc.id !== targetScenarioId) return sc;
          return { ...sc, tests: [...sc.tests, newTest] };
        }),
      };
    }));
    setDraft(newTest);
    setEditingTest({ featureId: targetFgId, scenarioId: targetScenarioId, testId: newTest.id, parameterized: true, openDataSourceWizard: !!openWizard });
    setInputMode('builder');
    setActiveTab('data');
  }, [setFeatureGroups, setDraft, setEditingTest, setInputMode, setActiveTab]);

  return {
    showSharedDsModal,
    setShowSharedDsModal,
    sharedDsModalSelectedId,
    setSharedDsModalSelectedId,
    showFromSharedDsPicker,
    setShowFromSharedDsPicker,
    currentEditingDraft,
    handlePromoteToShared,
    handleCreateTestFromSharedDs,
  };
}
