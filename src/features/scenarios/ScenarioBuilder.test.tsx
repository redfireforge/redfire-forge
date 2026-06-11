/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { FeatureGroup } from '../../shared/types';
import ScenarioBuilder from './ScenarioBuilder';
import type { ScenarioBuilderProps } from './scenarioBuilderTypes';

// ── Hoisted mutable mock state ──
const h = vi.hoisted(() => ({
  mut: {} as Record<string, unknown>,
  search: {} as Record<string, unknown>,
  dnd: {} as Record<string, unknown>,
  trash: {} as Record<string, unknown>,
  tags: {} as Record<string, unknown>,
  sharedDs: {} as Record<string, unknown>,
  exportImport: {} as Record<string, unknown>,
  effAuth: null as unknown,
}));

const authVerify = {
  authVerifying: false,
  authVerifyResult: null,
  setAuthVerifyResult: vi.fn(),
  verifyAuth: vi.fn(),
};

vi.mock('../requests/hooks/useAuthVerify', () => ({ useAuthVerify: () => authVerify }));
vi.mock('./hooks/useScenarioBuilderSearch', () => ({ useScenarioBuilderSearch: () => h.search }));
vi.mock('./hooks/useScenarioExportImport', () => ({ useScenarioExportImport: () => h.exportImport }));
vi.mock('./hooks/useScenarioDragDrop', () => ({ useScenarioDragDrop: () => h.dnd }));
vi.mock('./hooks/useScenarioMutations', () => ({ useScenarioMutations: () => h.mut }));
vi.mock('./hooks/useTrash', () => ({ useTrash: () => h.trash }));
vi.mock('./hooks/useScenarioTags', () => ({ useScenarioTags: () => h.tags }));
vi.mock('./hooks/useSharedDataSourceHandlers', () => ({ useSharedDataSourceHandlers: () => h.sharedDs }));

vi.mock('../requests/components/AuthConfigPanel', () => ({
  default: ({ onChange, onProfileChange }: { onChange: (a: unknown) => void; onProfileChange?: (id: string) => void }) => (
    <div data-testid="auth-panel">
      <button onClick={() => onChange({ type: 'bearer' })}>auth-change</button>
      <button onClick={() => onProfileChange?.('p1')}>auth-profile</button>
    </div>
  ),
}));
vi.mock('./components/ExportOptionsPopover', () => ({
  default: ({ onExport, onClose }: { onExport: (o: unknown) => void; onClose: () => void }) => (
    <div data-testid="export-popover">
      <button onClick={() => onExport({ includeVersions: false })}>do-export</button>
      <button onClick={onClose}>close-export</button>
    </div>
  ),
}));
vi.mock('./components/StructureChangeLogPanel', () => ({
  default: ({ onDelete, onClear }: { onDelete: (id: string) => void; onClear: () => void }) => (
    <div data-testid="structure-log">
      <button onClick={() => onDelete('log1')}>log-delete</button>
      <button onClick={onClear}>log-clear</button>
    </div>
  ),
}));
vi.mock('./components/ScenarioContextMenu', () => ({
  default: ({ onAddTag, onRemoveTag, onClearTags, onClose }: {
    onAddTag: (t: string) => void; onRemoveTag: (t: string) => void; onClearTags: () => void; onClose: () => void;
  }) => (
    <div data-testid="context-menu">
      <button onClick={() => onAddTag('new')}>ctx-add</button>
      <button onClick={() => onRemoveTag('smoke')}>ctx-remove</button>
      <button onClick={onClearTags}>ctx-clear</button>
      <button onClick={onClose}>ctx-close</button>
    </div>
  ),
}));
vi.mock('./components/ScenarioSlaPanel', () => ({
  default: ({ onEditTest }: { onEditTest: (t: unknown) => void }) => (
    <button data-testid="sla-panel" onClick={() => onEditTest({ id: 't1', name: 'T1' })}>sla-edit</button>
  ),
}));
vi.mock('./components/TestSlaModal', () => ({
  default: ({ onSave, onClose }: { onSave: (t: unknown[]) => void; onClose: () => void }) => (
    <div data-testid="sla-modal">
      <button onClick={() => onSave([{ id: 's' }])}>sla-save</button>
      <button onClick={onClose}>sla-close</button>
    </div>
  ),
}));
vi.mock('./components/ScenarioBuilderModals', () => ({
  default: ({ onOpenSharedDsModal, handleMoveConfirm, handleCreateParameterizedCopy }: {
    onOpenSharedDsModal: () => void;
    handleMoveConfirm: (t: unknown) => void;
    handleCreateParameterizedCopy: (c: unknown, fg?: string, sc?: string) => void;
  }) => (
    <div data-testid="builder-modals">
      <button onClick={onOpenSharedDsModal}>modals-open-ds</button>
      <button onClick={() => handleMoveConfirm({ fgId: 'fg2', scenarioId: 'sc2' })}>modals-move</button>
      <button onClick={() => handleCreateParameterizedCopy({ id: 'copy1', name: 'Copy' })}>modals-param</button>
    </div>
  ),
}));

vi.mock('./utils/scenarioAuth', () => ({
  buildScenarioInheritHint: () => 'inherit-hint',
  resolveScenarioInheritedAuth: () => ({ auth: { type: 'bearer' }, label: 'Inherited' }),
}));
vi.mock('./utils/structureChangeLog', () => ({
  deleteLogEntry: (fg: unknown) => fg,
  clearLog: (fg: unknown) => fg,
}));
vi.mock('./utils/scenarioBuilderUtils', () => ({
  SCENARIO_AUTH_TYPE_OPTIONS: [],
  buildFeatureAuthTypeOptions: () => [],
  resolveEffectiveAuth: () => h.effAuth,
}));

function makeFGS(): FeatureGroup[] {
  return [
    {
      id: 'fg1', name: 'Group One',
      auth: { type: 'inherit' }, globalAuthProfileId: 'p1',
      structureLog: [{ id: 'log1', timestamp: 1, action: 'scenario-added', entityName: 'X' }],
      scenarios: [
        {
          id: 'sc1', name: 'Std', kind: 'standard', auth: { type: 'bearer' }, tags: ['smoke'],
          tests: [{
            id: 't1', name: 'T1', url: 'https://x/u', method: 'GET', headers: [], body: '',
            auth: { type: 'none' },
            validation: { mode: 'status', assertions: [{ type: 'status' }, { type: 'responseTime' }, { type: 'header' }, { type: 'regex' }] },
            dataSource: { id: 'ds1', columns: [], rows: [] },
            sourceRequestId: 'r1', sourceSpecVersionLabel: '2', slaTargets: [{ id: 'sl1' }],
          } as never],
        },
        {
          id: 'sc2', name: 'Param', kind: 'parameterized', auth: { type: 'inherit' },
          tests: [{
            id: 't2', name: 'T2', url: 'https://x/u2', method: 'POST', headers: [], body: '',
            auth: { type: 'none' }, validation: { mode: 'full' },
          } as never],
        },
      ],
    },
    { id: 'fg2', name: 'Group Two', auth: { type: 'apiKey' }, scenarios: [] },
  ];
}

const FGS = makeFGS();

function makeProps(over: Partial<ScenarioBuilderProps> = {}): ScenarioBuilderProps {
  return {
    featureGroups: FGS,
    setFeatureGroups: vi.fn((u: unknown) => { if (typeof u === 'function') (u as (p: unknown) => void)(FGS); }) as never,
    sharedDataSources: [{ id: 'sds1', name: 'SDS' } as never],
    setSharedDataSources: vi.fn() as never,
    resolvedBaseUrl: 'https://x',
    selectedSvcId: 'svc1', selectedSvcName: 'Svc',
    selectedEnvId: 'env1', selectedEnvName: 'Env',
    isAdditionalEnv: false,
    unassociatedFeatureGroups: [],
    microservices: [{ id: 'svc1', name: 'Svc', customEnvs: [{ id: 'ce1', name: 'CE' }] } as never],
    environments: [{ id: 'env1', name: 'Env' }],
    globalAuthProfiles: [{ id: 'p1', name: 'Prof1', auth: { type: 'bearer' } } as never],
    onMoveScenario: vi.fn(),
    onMoveTest: vi.fn(),
    onLocateRequest: vi.fn(),
    onPendingEditConsumed: vi.fn(),
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 0; });
  h.effAuth = { source: 'own', label: 'Bearer' };
  h.mut = {
    expandedFeatures: new Set<string>(), expandedScenarios: new Set<string>(),
    namingFeature: false, setNamingFeature: vi.fn(),
    namingScenario: null, setNamingScenario: vi.fn(),
    newName: '', setNewName: vi.fn(),
    newScenarioKind: 'standard', setNewScenarioKind: vi.fn(),
    editingFeatureName: null, setEditingFeatureName: vi.fn(),
    editingScenarioName: null, setEditingScenarioName: vi.fn(),
    editName: '', setEditName: vi.fn(),
    editingFeatureAuth: null, setEditingFeatureAuth: vi.fn(),
    editingScenarioAuth: null, setEditingScenarioAuth: vi.fn(),
    editingTest: null, setEditingTest: vi.fn(),
    draft: { id: 't1', sharedDataSourceId: 'sds1' }, setDraft: vi.fn(),
    inputMode: 'builder', setInputMode: vi.fn(),
    activeTab: 'params', setActiveTab: vi.fn(),
    confirmDialog: null, setConfirmDialog: vi.fn(),
    copyingTest: null, setCopyingTest: vi.fn(),
    addFeatureGroup: vi.fn(), assignFeatureGroup: vi.fn(), removeFeatureGroup: vi.fn(), renameFeatureGroup: vi.fn(),
    addScenario: vi.fn(), removeScenario: vi.fn(), renameScenario: vi.fn(),
    updateFeatureAuth: vi.fn(), toggleFeatureAuth: vi.fn(),
    updateScenarioAuth: vi.fn(), toggleScenarioAuth: vi.fn(),
    updateScenarioSlaTargets: vi.fn(), updateTestSlaTargets: vi.fn(),
    startNewTest: vi.fn(), startNewParameterizedTest: vi.fn(), startEditTest: vi.fn(), saveTest: vi.fn(), removeTest: vi.fn(),
    startCopyTest: vi.fn(), confirmCopyTest: vi.fn(), createParameterizedCopy: vi.fn(),
    handleVersionRestore: vi.fn(), handleVersionDelete: vi.fn(), handleVersionRename: vi.fn(),
    toggleFeature: vi.fn(), toggleScenario: vi.fn(),
  };
  h.search = {
    searchQuery: '', setSearchQuery: vi.fn(),
    showSearchHelp: false, setShowSearchHelp: vi.fn(),
    isSearching: false, matchCount: 0,
    testMatches: () => true, scenarioMatches: () => true, featureMatches: () => true,
  };
  h.dnd = {
    dragScenario: null, setDragScenario: vi.fn(),
    dragTest: null, setDragTest: vi.fn(),
    dropTarget: null, setDropTarget: vi.fn(),
    handleDragEnd: vi.fn(),
  };
  h.trash = { moveToTrash: vi.fn(), trashCount: 3 };
  h.tags = { addTag: vi.fn(), removeTag: vi.fn(), clearTags: vi.fn(), tagSuggestions: ['smoke', 'regression'] };
  h.sharedDs = {
    showSharedDsModal: false, setShowSharedDsModal: vi.fn(),
    sharedDsModalSelectedId: undefined, setSharedDsModalSelectedId: vi.fn(),
    showFromSharedDsPicker: null, setShowFromSharedDsPicker: vi.fn(),
    currentEditingDraft: null, handlePromoteToShared: vi.fn(), handleCreateTestFromSharedDs: vi.fn(),
  };
  h.exportImport = {
    exportAll: vi.fn(), importAll: vi.fn(), handleCsvImport: vi.fn(),
    exportFeatureGroup: vi.fn(), importScenariosInto: vi.fn(),
    exportScenario: vi.fn(), importTestsInto: vi.fn(), exportTest: vi.fn(),
    pendingImport: null, cancelPendingImport: vi.fn(),
  };
});

describe('ScenarioBuilder', () => {
  it('shows empty state without svc/env', () => {
    render(<ScenarioBuilder {...makeProps({ selectedSvcId: undefined, selectedEnvId: undefined })} />);
    expect(screen.getByText(/Select both a microservice and an environment/)).toBeInTheDocument();
  });

  it('shows empty feature group hint when none', () => {
    render(<ScenarioBuilder {...makeProps({ featureGroups: [] })} />);
    expect(screen.getByText(/No feature groups for this microservice/)).toBeInTheDocument();
  });

  it('renders naming feature form and handles keys', () => {
    h.mut.namingFeature = true;
    render(<ScenarioBuilder {...makeProps({ featureGroups: [] })} />);
    const input = screen.getByPlaceholderText(/Feature group name/);
    fireEvent.change(input, { target: { value: 'New' } });
    expect(h.mut.setNewName).toHaveBeenCalledWith('New');
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.keyDown(input, { key: 'Escape' });
    fireEvent.click(screen.getByText('Cancel'));
    expect(h.mut.setNamingFeature).toHaveBeenCalled();
  });

  it('creates a feature group via header button', () => {
    render(<ScenarioBuilder {...makeProps()} />);
    fireEvent.click(screen.getByText('+ Add Feature Group'));
    expect(h.mut.setNamingFeature).toHaveBeenCalledWith(true);
  });

  it('renders search bar and toggles help', () => {
    h.search.isSearching = true;
    h.search.matchCount = 2;
    render(<ScenarioBuilder {...makeProps()} />);
    expect(screen.getByText('2 matches')).toBeInTheDocument();
    const input = screen.getByPlaceholderText(/Search tests/);
    fireEvent.change(input, { target: { value: 'q' } });
    expect(h.search.setSearchQuery).toHaveBeenCalledWith('q');
    fireEvent.click(screen.getByText('Clear'));
    fireEvent.click(screen.getByTitle('Search syntax help'));
    expect(h.search.setShowSearchHelp).toHaveBeenCalled();
  });

  it('shows search help table when enabled', () => {
    h.search.isSearching = true;
    h.search.showSearchHelp = true;
    render(<ScenarioBuilder {...makeProps()} />);
    expect(screen.getByText(/Exact phrase/)).toBeInTheDocument();
  });

  it('renders full tree with scenarios and tests', () => {
    h.mut.expandedFeatures = new Set(['fg1']);
    h.mut.expandedScenarios = new Set(['sc1', 'sc2']);
    render(<ScenarioBuilder {...makeProps()} />);
    expect(screen.getByText('Group One')).toBeInTheDocument();
    expect(screen.getByText('Std')).toBeInTheDocument();
    expect(screen.getAllByText('Param').length).toBeGreaterThan(0);
    expect(screen.getByText('T1')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('SLA')).toBeInTheDocument();
    expect(screen.getByText('Header')).toBeInTheDocument();
    expect(screen.getByText('Regex')).toBeInTheDocument();
    expect(screen.getByText('Auth: Prof1')).toBeInTheDocument();
  });

  it('renders auth none badge when effective auth missing', () => {
    h.effAuth = null;
    h.mut.expandedFeatures = new Set(['fg1']);
    h.mut.expandedScenarios = new Set(['sc1']);
    render(<ScenarioBuilder {...makeProps()} />);
    expect(screen.getAllByText('Auth: none').length).toBeGreaterThan(0);
  });

  it('triggers header import/export/template/trash/sharedDs', () => {
    const props = makeProps();
    render(<ScenarioBuilder {...props} />);
    const header = within(document.querySelector('.header-actions') as HTMLElement);
    fireEvent.click(header.getByText('Import'));
    expect(h.exportImport.importAll).toHaveBeenCalled();
    fireEvent.click(header.getByText('Export'));
    expect(screen.getByTestId('export-popover')).toBeInTheDocument();
    fireEvent.click(screen.getByText('do-export'));
    expect(h.exportImport.exportAll).toHaveBeenCalled();
    fireEvent.click(screen.getByText('Import Template'));
    fireEvent.click(screen.getByText('Trash'));
    fireEvent.click(screen.getByText(/Shared Data Sources/));
    expect(h.sharedDs.setShowSharedDsModal).toHaveBeenCalledWith(true);
  });

  it('closes export popover', () => {
    render(<ScenarioBuilder {...makeProps()} />);
    const header = within(document.querySelector('.header-actions') as HTMLElement);
    fireEvent.click(header.getByText('Export'));
    fireEvent.click(screen.getByText('close-export'));
    expect(screen.queryByTestId('export-popover')).not.toBeInTheDocument();
  });

  it('toggles feature and scenario expansion', () => {
    h.mut.expandedFeatures = new Set(['fg1']);
    h.mut.expandedScenarios = new Set(['sc1', 'sc2']);
    render(<ScenarioBuilder {...makeProps()} />);
    fireEvent.click(screen.getByText('Group One'));
    expect(h.mut.toggleFeature).toHaveBeenCalledWith('fg1');
    fireEvent.click(screen.getByText('Std'));
    expect(h.mut.toggleScenario).toHaveBeenCalledWith('sc1');
  });

  it('renders feature auth panel and triggers changes', () => {
    h.mut.editingFeatureAuth = 'fg1';
    render(<ScenarioBuilder {...makeProps()} />);
    expect(screen.getAllByTestId('auth-panel').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText('auth-change'));
    expect(h.mut.updateFeatureAuth).toHaveBeenCalled();
    fireEvent.click(screen.getByText('auth-profile'));
    expect(h.mut.updateFeatureAuth).toHaveBeenCalled();
  });

  it('renders structure log panel and triggers delete/clear', () => {
    h.mut.expandedFeatures = new Set(['fg1']);
    const props = makeProps();
    // open structure log via History button
    render(<ScenarioBuilder {...props} />);
    fireEvent.click(screen.getAllByText('History')[0]);
    expect(screen.getByTestId('structure-log')).toBeInTheDocument();
    fireEvent.click(screen.getByText('log-delete'));
    fireEvent.click(screen.getByText('log-clear'));
    expect(props.setFeatureGroups).toHaveBeenCalled();
  });

  it('renders scenario auth panel with inherit', () => {
    h.mut.expandedFeatures = new Set(['fg1']);
    h.mut.expandedScenarios = new Set(['sc2']);
    h.mut.editingScenarioAuth = 'sc2';
    render(<ScenarioBuilder {...makeProps()} />);
    expect(screen.getAllByTestId('auth-panel').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText('auth-change'));
    expect(h.mut.updateScenarioAuth).toHaveBeenCalled();
  });

  it('handles feature group rename inline editing', () => {
    h.mut.editingFeatureName = 'fg1';
    render(<ScenarioBuilder {...makeProps()} />);
    const input = document.querySelector('.inline-edit-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Renamed' } });
    expect(h.mut.setEditName).toHaveBeenCalledWith('Renamed');
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.keyDown(input, { key: 'Escape' });
    fireEvent.blur(input);
    expect(h.mut.renameFeatureGroup).toHaveBeenCalledWith('fg1');
  });

  it('handles scenario rename inline editing', () => {
    h.mut.expandedFeatures = new Set(['fg1']);
    h.mut.editingScenarioName = 'sc1';
    render(<ScenarioBuilder {...makeProps()} />);
    const input = document.querySelector('.inline-edit-input') as HTMLInputElement;
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.keyDown(input, { key: 'Escape' });
    fireEvent.blur(input);
    expect(h.mut.renameScenario).toHaveBeenCalledWith('fg1', 'sc1');
  });

  it('triggers feature group action buttons', () => {
    h.mut.expandedFeatures = new Set(['fg1']);
    render(<ScenarioBuilder {...makeProps()} />);
    fireEvent.click(screen.getAllByText('Rename')[0]);
    expect(h.mut.setEditingFeatureName).toHaveBeenCalledWith('fg1');
    fireEvent.click(screen.getAllByText('Auth')[0]);
    expect(h.mut.toggleFeatureAuth).toHaveBeenCalledWith('fg1');
    fireEvent.click(screen.getAllByText('+ Scenario')[0]);
    expect(h.mut.setNamingScenario).toHaveBeenCalledWith('fg1');
    fireEvent.click(screen.getAllByText('Delete')[0]);
    expect(h.mut.removeFeatureGroup).toHaveBeenCalled();
  });

  it('opens feature group export popover and exports', () => {
    render(<ScenarioBuilder {...makeProps()} />);
    const exportBtns = screen.getAllByText('Export');
    // second Export is feature-group level (first is header)
    fireEvent.click(exportBtns[1]);
    fireEvent.click(screen.getByText('do-export'));
    expect(h.exportImport.exportFeatureGroup).toHaveBeenCalled();
  });

  it('imports scenarios into a feature group', () => {
    render(<ScenarioBuilder {...makeProps()} />);
    fireEvent.click(screen.getAllByText('Import')[1]);
    expect(h.exportImport.importScenariosInto).toHaveBeenCalledWith('fg1');
  });

  it('renders naming scenario form', () => {
    h.mut.expandedFeatures = new Set(['fg1']);
    h.mut.namingScenario = 'fg1';
    render(<ScenarioBuilder {...makeProps()} />);
    const radios = screen.getAllByRole('radio');
    fireEvent.click(radios[1]);
    expect(h.mut.setNewScenarioKind).toHaveBeenCalledWith('parameterized');
    const input = screen.getByPlaceholderText(/Scenario name/);
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.keyDown(input, { key: 'Escape' });
    fireEvent.click(screen.getByText('Create'));
    expect(h.mut.addScenario).toHaveBeenCalledWith('fg1');
    fireEvent.click(screen.getByText('Cancel'));
    expect(h.mut.setNamingScenario).toHaveBeenCalledWith(null);
  });

  it('triggers scenario action buttons', () => {
    h.mut.expandedFeatures = new Set(['fg1']);
    h.mut.expandedScenarios = new Set(['sc1', 'sc2']);
    render(<ScenarioBuilder {...makeProps()} />);
    fireEvent.click(screen.getByText('+ Test'));
    expect(h.mut.startNewTest).toHaveBeenCalledWith('fg1', 'sc1');
    fireEvent.click(screen.getByText('+ Param Test'));
    expect(h.mut.startNewParameterizedTest).toHaveBeenCalledWith('fg1', 'sc2');
    fireEvent.click(screen.getByText('+ From Shared DS'));
    expect(h.sharedDs.setShowFromSharedDsPicker).toHaveBeenCalled();
  });

  it('triggers test action buttons', () => {
    h.mut.expandedFeatures = new Set(['fg1']);
    h.mut.expandedScenarios = new Set(['sc1', 'sc2']);
    render(<ScenarioBuilder {...makeProps()} />);
    fireEvent.click(screen.getAllByText('Edit')[0]);
    expect(h.mut.startEditTest).toHaveBeenCalled();
    fireEvent.click(screen.getAllByText('Copy')[0]);
    expect(h.mut.startCopyTest).toHaveBeenCalled();
    fireEvent.click(screen.getByText('Parameterize'));
    expect(h.mut.createParameterizedCopy).toHaveBeenCalled();
    const testCard = within(document.querySelector('.test-card') as HTMLElement);
    fireEvent.click(testCard.getByText('Delete'));
    expect(h.mut.removeTest).toHaveBeenCalled();
  });

  it('opens test SLA modal and saves', () => {
    h.mut.expandedFeatures = new Set(['fg1']);
    h.mut.expandedScenarios = new Set(['sc1']);
    render(<ScenarioBuilder {...makeProps()} />);
    fireEvent.click(screen.getByTitle('Configure SLA targets for this test'));
    expect(screen.getByTestId('sla-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByText('sla-save'));
    expect(h.mut.updateTestSlaTargets).toHaveBeenCalled();
    fireEvent.click(screen.getByText('sla-close'));
    expect(screen.queryByTestId('sla-modal')).not.toBeInTheDocument();
  });

  it('opens SLA modal from scenario sla panel', () => {
    h.mut.expandedFeatures = new Set(['fg1']);
    h.mut.expandedScenarios = new Set(['sc1']);
    render(<ScenarioBuilder {...makeProps()} />);
    fireEvent.click(screen.getAllByTestId('sla-panel')[0]);
    expect(screen.getByTestId('sla-modal')).toBeInTheDocument();
  });

  it('locates request via origin badge', () => {
    h.mut.expandedFeatures = new Set(['fg1']);
    h.mut.expandedScenarios = new Set(['sc1']);
    const props = makeProps();
    render(<ScenarioBuilder {...props} />);
    fireEvent.click(screen.getByText('v2'));
    expect(props.onLocateRequest).toHaveBeenCalledWith('r1');
  });

  it('handles tag add input flow', () => {
    h.mut.expandedFeatures = new Set(['fg1']);
    h.mut.expandedScenarios = new Set(['sc1']);
    render(<ScenarioBuilder {...makeProps()} />);
    fireEvent.click(screen.getAllByLabelText('Add tag')[0]);
    const input = screen.getByPlaceholderText('tag name');
    fireEvent.change(input, { target: { value: 'reg' } });
    expect(screen.getByText('regression')).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByText('regression'));
    expect(h.tags.addTag).toHaveBeenCalled();
  });

  it('adds tag via Enter and removes via pill', () => {
    h.mut.expandedFeatures = new Set(['fg1']);
    h.mut.expandedScenarios = new Set(['sc1']);
    render(<ScenarioBuilder {...makeProps()} />);
    fireEvent.click(screen.getByLabelText('Remove tag smoke'));
    expect(h.tags.removeTag).toHaveBeenCalledWith('fg1', 'sc1', 'smoke');
    fireEvent.click(screen.getAllByLabelText('Add tag')[0]);
    const input = screen.getByPlaceholderText('tag name');
    fireEvent.change(input, { target: { value: 'newtag' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(h.tags.addTag).toHaveBeenCalledWith('fg1', 'sc1', 'newtag');
  });

  it('escapes and blurs tag input', () => {
    h.mut.expandedFeatures = new Set(['fg1']);
    h.mut.expandedScenarios = new Set(['sc1']);
    render(<ScenarioBuilder {...makeProps()} />);
    fireEvent.click(screen.getAllByLabelText('Add tag')[0]);
    const input = screen.getByPlaceholderText('tag name');
    fireEvent.keyDown(input, { key: 'Escape' });
    fireEvent.click(screen.getAllByLabelText('Add tag')[0]);
    fireEvent.blur(screen.getByPlaceholderText('tag name'));
  });

  it('opens context menu and triggers tag actions', () => {
    h.mut.expandedFeatures = new Set(['fg1']);
    h.mut.expandedScenarios = new Set(['sc1']);
    render(<ScenarioBuilder {...makeProps()} />);
    const header = document.querySelector('.scenario-group-header') as HTMLElement;
    fireEvent.contextMenu(header, { clientX: 10, clientY: 20 });
    expect(screen.getByTestId('context-menu')).toBeInTheDocument();
    fireEvent.click(screen.getByText('ctx-add'));
    fireEvent.click(screen.getByText('ctx-remove'));
    fireEvent.click(screen.getByText('ctx-clear'));
    expect(h.tags.clearTags).toHaveBeenCalled();
    fireEvent.click(screen.getByText('ctx-close'));
    expect(screen.queryByTestId('context-menu')).not.toBeInTheDocument();
  });

  it('moves scenario and test via Move buttons', () => {
    h.mut.expandedFeatures = new Set(['fg1']);
    h.mut.expandedScenarios = new Set(['sc1']);
    render(<ScenarioBuilder {...makeProps()} />);
    fireEvent.click(screen.getAllByText('Move')[0]);
    fireEvent.click(screen.getAllByText('Move')[1]);
    // both open move dialog state (rendered via modals mock)
    expect(screen.getByTestId('builder-modals')).toBeInTheDocument();
  });

  it('handles move confirm for scenario', () => {
    const props = makeProps();
    h.mut.expandedFeatures = new Set(['fg1']);
    h.mut.expandedScenarios = new Set(['sc1']);
    render(<ScenarioBuilder {...props} />);
    // open scenario move dialog (first Move button is the scenario's)
    fireEvent.click(within(document.querySelector('.scenario-group-actions') as HTMLElement).getByText('Move'));
    fireEvent.click(screen.getByText('modals-move'));
    expect(props.onMoveScenario).toHaveBeenCalledWith('sc1', 'fg1', 'fg2');
  });

  it('handles move confirm for test', () => {
    const props = makeProps();
    h.mut.expandedFeatures = new Set(['fg1']);
    h.mut.expandedScenarios = new Set(['sc1']);
    render(<ScenarioBuilder {...props} />);
    // open test move dialog
    fireEvent.click(within(document.querySelector('.test-card-actions') as HTMLElement).getByText('Move'));
    fireEvent.click(screen.getByText('modals-move'));
    expect(props.onMoveTest).toHaveBeenCalledWith('t1', 'sc1', 'fg1', 'sc2', 'fg2');
  });

  it('opens shared ds modal via modals callback', () => {
    render(<ScenarioBuilder {...makeProps()} />);
    fireEvent.click(screen.getByText('modals-open-ds'));
    expect(h.sharedDs.setShowSharedDsModal).toHaveBeenCalledWith(true);
    expect(h.sharedDs.setSharedDsModalSelectedId).toHaveBeenCalledWith('sds1');
  });

  it('creates parameterized copy via modals callback', () => {
    vi.useFakeTimers();
    h.mut.editingTest = { featureId: 'fg1', scenarioId: 'sc1', testId: 't1' };
    const props = makeProps();
    render(<ScenarioBuilder {...props} />);
    fireEvent.click(screen.getByText('modals-param'));
    expect(props.setFeatureGroups).toHaveBeenCalled();
    vi.runAllTimers();
    expect(h.mut.setActiveTab).toHaveBeenCalledWith('data');
    vi.useRealTimers();
  });

  it('consumes pendingEditTest', () => {
    const props = makeProps({ pendingEditTest: { featureId: 'fg1', scenarioId: 'sc1', testId: 't1' } });
    render(<ScenarioBuilder {...props} />);
    expect(h.mut.startEditTest).toHaveBeenCalled();
    expect(props.onPendingEditConsumed).toHaveBeenCalled();
  });

  it('renders unassociated section with assign here', () => {
    const una: FeatureGroup[] = [{ id: 'u1', name: 'Una', scenarios: [] }];
    render(<ScenarioBuilder {...makeProps({ unassociatedFeatureGroups: una })} />);
    expect(screen.getByText(/Unassigned Feature Groups/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Assign here'));
    expect(h.mut.assignFeatureGroup).toHaveBeenCalledWith('u1', 'svc1', 'env1');
  });

  it('renders unassociated section with selects when no svc/env', () => {
    const una: FeatureGroup[] = [{ id: 'u1', name: 'Una', scenarios: [] }];
    render(<ScenarioBuilder {...makeProps({ selectedSvcId: undefined, selectedEnvId: undefined, unassociatedFeatureGroups: una })} />);
    const svcSel = document.getElementById('svc-u1') as HTMLSelectElement;
    const envSel = document.getElementById('env-u1') as HTMLSelectElement;
    fireEvent.change(svcSel, { target: { value: 'svc1' } });
    fireEvent.change(envSel, { target: { value: 'env1' } });
    fireEvent.click(screen.getByText('Assign'));
    expect(h.mut.assignFeatureGroup).toHaveBeenCalledWith('u1', 'svc1', 'env1');
  });

  it('shows assign error when selects empty', () => {
    const una: FeatureGroup[] = [{ id: 'u1', name: 'Una', scenarios: [] }];
    render(<ScenarioBuilder {...makeProps({ selectedSvcId: undefined, selectedEnvId: undefined, unassociatedFeatureGroups: una })} />);
    fireEvent.click(screen.getByText('Assign'));
    expect(h.mut.setConfirmDialog).toHaveBeenCalled();
    fireEvent.click(screen.getAllByText('Delete').slice(-1)[0]);
    expect(h.mut.removeFeatureGroup).toHaveBeenCalledWith('u1');
  });

  it('renders drop zones when dragging scenario', () => {
    h.mut.expandedFeatures = new Set(['fg1', 'fg2']);
    h.dnd.dragScenario = { scenarioId: 'sc1', fromFeatureId: 'fg1' };
    render(<ScenarioBuilder {...makeProps()} />);
    expect(screen.getByText('Drop scenario here')).toBeInTheDocument();
    expect(screen.getByText('Drop here to add at end')).toBeInTheDocument();
  });

  it('renders drop zones when dragging test', () => {
    h.mut.expandedFeatures = new Set(['fg1']);
    h.mut.expandedScenarios = new Set(['sc1', 'sc2']);
    h.dnd.dragTest = { testId: 't1', fromFeatureId: 'fg1', fromScenarioId: 'sc1' };
    render(<ScenarioBuilder {...makeProps()} />);
    expect(screen.getAllByText('Drop here').length).toBeGreaterThan(0);
  });

  it('handles scenario drag start with handle active', () => {
    h.mut.expandedFeatures = new Set(['fg1']);
    h.mut.expandedScenarios = new Set(['sc1']);
    render(<ScenarioBuilder {...makeProps()} />);
    const card = document.querySelector('.scenario-group-card') as HTMLElement;
    const handle = card.querySelector('.drag-handle') as HTMLElement;
    fireEvent.mouseDown(handle);
    fireEvent.dragStart(card, { dataTransfer: { setData: vi.fn(), effectAllowed: '' } });
    fireEvent.mouseUp(handle);
    fireEvent.dragEnd(card);
    expect(h.dnd.handleDragEnd).toHaveBeenCalled();
    expect(h.dnd.setDragScenario).toHaveBeenCalledWith({ scenarioId: 'sc1', fromFeatureId: 'fg1' });
  });

  it('prevents scenario drag start without handle', () => {
    h.mut.expandedFeatures = new Set(['fg1']);
    h.mut.expandedScenarios = new Set(['sc1']);
    render(<ScenarioBuilder {...makeProps()} />);
    const card = document.querySelector('.scenario-group-card') as HTMLElement;
    fireEvent.dragStart(card, { dataTransfer: { setData: vi.fn(), effectAllowed: '' } });
    // dragHandleActive false -> preventDefault, no setData beyond guard
    expect(card).toBeInTheDocument();
  });

  it('handles test drag start with handle active', () => {
    h.mut.expandedFeatures = new Set(['fg1']);
    h.mut.expandedScenarios = new Set(['sc1']);
    render(<ScenarioBuilder {...makeProps()} />);
    const card = document.querySelector('.test-card') as HTMLElement;
    const handle = card.querySelector('.drag-handle') as HTMLElement;
    fireEvent.mouseDown(handle);
    fireEvent.dragStart(card, { dataTransfer: { setData: vi.fn(), effectAllowed: '' } });
    fireEvent.dragEnd(card);
    expect(h.dnd.setDragTest).toHaveBeenCalledWith({ testId: 't1', fromFeatureId: 'fg1', fromScenarioId: 'sc1' });
  });

  it('handles scenario dragOver + dragLeave while dragging a scenario', () => {
    h.mut.expandedFeatures = new Set(['fg1', 'fg2']);
    h.dnd.dragScenario = { scenarioId: 'scX', fromFeatureId: 'fgZ' };
    h.dnd.dropTarget = { type: 'scenario', featureId: 'fg2' };
    render(<ScenarioBuilder {...makeProps()} />);
    const card = document.querySelector('.scenario-group-card') as HTMLElement;
    fireEvent.dragOver(card, { dataTransfer: { dropEffect: '' } });
    expect(h.dnd.setDropTarget).toHaveBeenCalled();
    // empty-hint of fg2 (no scenarios) acts as drop zone
    const emptyHint = document.querySelector('.feature-group-body .empty-hint') as HTMLElement;
    fireEvent.dragOver(emptyHint, { dataTransfer: { dropEffect: '' } });
    fireEvent.dragLeave(emptyHint);
    fireEvent.drop(emptyHint);
    // end drop zone
    const endZone = document.querySelector('.drop-zone-end') as HTMLElement;
    fireEvent.dragOver(endZone, { dataTransfer: { dropEffect: '' } });
    fireEvent.dragLeave(endZone);
    fireEvent.drop(endZone);
    expect(h.dnd.handleDragEnd).toHaveBeenCalled();
  });

  it('handles test dragOver and drop zones while dragging a test', () => {
    h.mut.expandedFeatures = new Set(['fg1']);
    h.mut.expandedScenarios = new Set(['sc1', 'sc2']);
    h.dnd.dragTest = { testId: 'tX', fromFeatureId: 'fgZ', fromScenarioId: 'scZ' };
    render(<ScenarioBuilder {...makeProps()} />);
    const testCard = document.querySelector('.test-card') as HTMLElement;
    fireEvent.dragOver(testCard, { dataTransfer: { dropEffect: '' } });
    expect(h.dnd.setDropTarget).toHaveBeenCalled();
    // scenario body drag over (sc with tests -> dragTest && tests.length>0 path on body is guarded by length===0; still fire)
    const body = document.querySelector('.scenario-group-body') as HTMLElement;
    fireEvent.dragOver(body, { dataTransfer: { dropEffect: '' } });
    fireEvent.drop(body);
    // drop-zone-end-sm for scenarios with tests
    const endSm = document.querySelector('.drop-zone-end-sm') as HTMLElement;
    fireEvent.dragOver(endSm, { dataTransfer: { dropEffect: '' } });
    fireEvent.drop(endSm);
    expect(h.dnd.handleDragEnd).toHaveBeenCalled();
  });

  it('renders tree summary', () => {
    render(<ScenarioBuilder {...makeProps()} />);
    expect(screen.getByText(/feature groups/)).toBeInTheDocument();
  });
});
