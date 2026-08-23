import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type {
  AuthConfig,
  AuthType,
  FeatureGroup,
  GlobalAuthProfile,
  Scenario,
  SharedDataSource,
  TestScenario,
} from '@shared/types';
import AuthConfigPanel from '../../requests/components/AuthConfigPanel';
import type { AuthVerifyResult } from '../../requests/hooks/useAuthVerify';
import ExportOptionsPopover from './ExportOptionsPopover';
import StructureChangeLogPanel from './StructureChangeLogPanel';
import ScenarioSlaPanel from './ScenarioSlaPanel';
import type { MoveType } from './MoveModal';
import type { VersionExportOptions } from '../utils/scenarioImportExport';
import { buildScenarioInheritHint, resolveScenarioInheritedAuth } from '../utils/scenarioAuth';
import { SCENARIO_AUTH_TYPE_OPTIONS } from '../utils/scenarioBuilderUtils';
import { deleteLogEntry, clearLog } from '../utils/structureChangeLog';

type DragScenario = { scenarioId: string; fromFeatureId: string } | null;
type DragTest = { testId: string; fromFeatureId: string; fromScenarioId: string } | null;
type DropTarget = {
  type: 'scenario' | 'test';
  featureId: string;
  scenarioId?: string;
  position?: 'before' | 'after';
  targetId?: string;
} | null;

type ExportPopoverState = {
  id: string;
  data: unknown;
  exportFn: (opts: VersionExportOptions) => void;
} | null;

type MoveDialogState = {
  type: MoveType;
  itemName: string;
  fgId: string;
  scenarioId?: string;
  testId?: string;
  fgEnvironmentId?: string;
  fgMicroserviceId?: string;
  fgAuthProfileId?: string;
} | null;

export interface FeatureGroupCardProps {
  featureGroup: FeatureGroup;
  setFeatureGroups: React.Dispatch<React.SetStateAction<FeatureGroup[]>>;
  expandedFeatures: Set<string>;
  expandedScenarios: Set<string>;
  isSearching: boolean;
  editingFeatureName: string | null;
  editingScenarioName: string | null;
  editingFeatureAuth: string | null;
  editingScenarioAuth: string | null;
  editName: string;
  setEditName: (name: string) => void;
  namingScenario: string | null;
  newName: string;
  setNewName: (name: string) => void;
  newScenarioKind: 'standard' | 'parameterized';
  setNewScenarioKind: (kind: 'standard' | 'parameterized') => void;
  showStructureLog: string | null;
  setShowStructureLog: (id: string | null) => void;
  exportPopover: ExportPopoverState;
  setExportPopover: (state: ExportPopoverState) => void;
  editingTagScenario: { fgId: string; scId: string } | null;
  setEditingTagScenario: (state: { fgId: string; scId: string } | null) => void;
  tagInputValue: string;
  setTagInputValue: (value: string) => void;
  dragScenario: DragScenario;
  setDragScenario: (state: DragScenario) => void;
  dragTest: DragTest;
  setDragTest: (state: DragTest) => void;
  dropTarget: DropTarget;
  setDropTarget: (target: DropTarget) => void;
  dragHandleActive: MutableRefObject<boolean>;
  allAuthProfiles: GlobalAuthProfile[];
  sharedDataSources?: SharedDataSource[];
  featureAuthTypeOptions: { value: string; label: string }[];
  authVerifying: boolean;
  authVerifyResult: AuthVerifyResult | null;
  setAuthVerifyResult: Dispatch<SetStateAction<AuthVerifyResult | null>>;
  verifyAuth: (auth: AuthConfig) => void;
  showSecret: boolean;
  setShowSecret: Dispatch<SetStateAction<boolean>>;
  tagSuggestions: string[];
  toggleFeature: (fgId: string) => void;
  renameFeatureGroup: (fgId: string) => void;
  setEditingFeatureName: (id: string | null) => void;
  toggleFeatureAuth: (fgId: string) => void;
  updateFeatureAuth: (fgId: string, auth: AuthConfig, globalAuthProfileId?: string) => void;
  removeFeatureGroup: (fgId: string) => void;
  setNamingScenario: (id: string | null) => void;
  addScenario: (fgId: string) => void;
  importScenariosInto: (fgId: string) => void;
  exportFeatureGroup: (fg: FeatureGroup, opts: VersionExportOptions) => void;
  toggleScenario: (scId: string) => void;
  renameScenario: (fgId: string, scId: string) => void;
  setEditingScenarioName: (id: string | null) => void;
  setContextMenu: (menu: { x: number; y: number; fgId: string; scId: string } | null) => void;
  removeTag: (fgId: string, scId: string, tag: string) => void;
  addTag: (fgId: string, scId: string, tag: string) => void;
  toggleScenarioAuth: (fgId: string, scId: string) => void;
  updateScenarioAuth: (fgId: string, scId: string, auth: AuthConfig) => void;
  startNewTest: (fgId: string, scId: string) => void;
  startNewParameterizedTest: (fgId: string, scId: string) => void;
  setShowFromSharedDsPicker: (picker: { fgId: string; scId: string } | null) => void;
  setMoveDialog: (dialog: MoveDialogState) => void;
  importTestsInto: (fgId: string, scId: string) => void;
  exportScenario: (sc: TestScenario, opts: VersionExportOptions) => void;
  removeScenario: (fgId: string, scId: string) => void;
  handleDragEnd: () => void;
  scenarioMatches: (sc: TestScenario) => boolean;
  testMatches: (t: Scenario) => boolean;
  getEffectiveAuth: (t: Scenario, sc: TestScenario, fg: FeatureGroup) => { label: string; source: string } | null;
  onLocateRequest?: (requestId: string) => void;
  setSlaModalTest: (state: { fgId: string; scId: string; test: Scenario } | null) => void;
  startEditTest: (fgId: string, scId: string, test: Scenario) => void;
  startCopyTest: (fgId: string, scId: string, test: Scenario) => void;
  createParameterizedCopy: (fgId: string, scId: string, test: Scenario) => void;
  removeTest: (fgId: string, scId: string, testId: string) => void;
  exportTest: (test: Scenario, opts: VersionExportOptions) => void;
}

export default function FeatureGroupCard({
  featureGroup: fg,
  setFeatureGroups,
  expandedFeatures,
  expandedScenarios,
  isSearching,
  editingFeatureName,
  editingScenarioName,
  editingFeatureAuth,
  editingScenarioAuth,
  editName,
  setEditName,
  namingScenario,
  newName,
  setNewName,
  newScenarioKind,
  setNewScenarioKind,
  showStructureLog,
  setShowStructureLog,
  exportPopover,
  setExportPopover,
  editingTagScenario,
  setEditingTagScenario,
  tagInputValue,
  setTagInputValue,
  dragScenario,
  setDragScenario,
  dragTest,
  setDragTest,
  dropTarget,
  setDropTarget,
  dragHandleActive,
  allAuthProfiles,
  sharedDataSources,
  featureAuthTypeOptions,
  authVerifying,
  authVerifyResult,
  setAuthVerifyResult,
  verifyAuth,
  showSecret,
  setShowSecret,
  tagSuggestions,
  toggleFeature,
  renameFeatureGroup,
  setEditingFeatureName,
  toggleFeatureAuth,
  updateFeatureAuth,
  removeFeatureGroup,
  setNamingScenario,
  addScenario,
  importScenariosInto,
  exportFeatureGroup,
  toggleScenario,
  renameScenario,
  setEditingScenarioName,
  setContextMenu,
  removeTag,
  addTag,
  toggleScenarioAuth,
  updateScenarioAuth,
  startNewTest,
  startNewParameterizedTest,
  setShowFromSharedDsPicker,
  setMoveDialog,
  importTestsInto,
  exportScenario,
  removeScenario,
  handleDragEnd,
  scenarioMatches,
  testMatches,
  getEffectiveAuth,
  onLocateRequest,
  setSlaModalTest,
  startEditTest,
  startCopyTest,
  createParameterizedCopy,
  removeTest,
  exportTest,
}: FeatureGroupCardProps) {
  return (
    <div className="feature-group-card" data-testid="har-fg-card">
      <div className="feature-group-header" data-testid="har-fg-expand" onClick={() => toggleFeature(fg.id)}>
        <span className={`expand-icon ${(expandedFeatures.has(fg.id) || isSearching) ? 'expanded' : ''}`}>&#9654;</span>
        {editingFeatureName === fg.id ? (
          <input className="inline-edit-input" autoFocus value={editName}
            onClick={(e) => e.stopPropagation()} onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') renameFeatureGroup(fg.id); if (e.key === 'Escape') setEditingFeatureName(null); }}
            onBlur={() => renameFeatureGroup(fg.id)} />
        ) : (
          <strong className="feature-group-name" data-testid="har-fg-name">{fg.name}</strong>
        )}
        {(() => {
          const std = fg.scenarios.filter(sc => sc.kind !== 'parameterized').length;
          const param = fg.scenarios.filter(sc => sc.kind === 'parameterized').length;
          const total = fg.scenarios.length;
          const tests = fg.scenarios.reduce((s, sc) => s + sc.tests.length, 0);
          const fgTags = [...new Set(fg.scenarios.flatMap(sc => sc.tags ?? []))];
          return (
            <>
              <span className="count-badge" title={`${std} standard, ${param} parameterized`}>
                {total} scenario{total !== 1 ? 's' : ''}
                {total > 0 && <> ({std}S · {param}P)</>}
              </span>
              <span className="count-badge">{tests} test{tests !== 1 ? 's' : ''}</span>
              {fgTags.length > 0 && (
                <span className="fg-tag-summary" title={`Tags in this group: ${fgTags.join(', ')}`}>
                  {fgTags.length} tag{fgTags.length !== 1 ? 's' : ''}
                </span>
              )}
            </>
          );
        })()}
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
          <button className="btn btn-sm" data-testid="har-add-scenario-btn" onClick={() => { setNamingScenario(fg.id); setNewName(''); }}>+ Scenario</button>

          <button className="btn btn-sm" onClick={() => importScenariosInto(fg.id)} title="Import scenarios into this feature group">Import</button>
          <span className="export-opts-anchor">
            <button
              className="btn btn-sm"
              data-testid="har-fg-export-btn"
              onClick={() => setExportPopover({ id: fg.id, data: fg, exportFn: (o) => { exportFeatureGroup(fg, o); setExportPopover(null); } })}
              title="Export this feature group"
            >
              Export
            </button>
            {exportPopover?.id === fg.id && <ExportOptionsPopover data={exportPopover.data} onExport={exportPopover.exportFn} onClose={() => setExportPopover(null)} />}
          </span>
          <button
            className={`btn btn-sm ${showStructureLog === fg.id ? 'btn-active' : ''}`}
            onClick={() => setShowStructureLog(showStructureLog === fg.id ? null : fg.id)}
            title="Structure change history"
          >
            History {(fg.structureLog?.length ?? 0) > 0 && <span className="count-badge">{fg.structureLog!.length}</span>}
          </button>
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

      {/* Structure change log panel */}
      {showStructureLog === fg.id && (
        <StructureChangeLogPanel
          entries={fg.structureLog ?? []}
          onDelete={(entryId) => setFeatureGroups(prev => prev.map(f => f.id === fg.id ? deleteLogEntry(f, entryId) : f))}
          onClear={() => setFeatureGroups(prev => prev.map(f => f.id === fg.id ? clearLog(f) : f))}
        />
      )}

      {(expandedFeatures.has(fg.id) || isSearching) && (
        <div className="feature-group-body">
          {namingScenario === fg.id && (
            <div className="inline-name-form nested">
              <div className="scenario-kind-selector">
                <label className={`kind-option${newScenarioKind === 'standard' ? ' kind-option-active' : ''}`}>
                  <input type="radio" name="scenario-kind" value="standard" checked={newScenarioKind === 'standard'} onChange={() => setNewScenarioKind('standard')} />
                  Standard
                </label>
                <label className={`kind-option${newScenarioKind === 'parameterized' ? ' kind-option-active' : ''}`}>
                  <input type="radio" name="scenario-kind" value="parameterized" checked={newScenarioKind === 'parameterized'} onChange={() => setNewScenarioKind('parameterized')} />
                  Parameterized
                </label>
              </div>
              <input autoFocus data-testid="har-scenario-name-input" value={newName} onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addScenario(fg.id); if (e.key === 'Escape') setNamingScenario(null); }}
                placeholder={newScenarioKind === 'standard' ? 'Scenario name (e.g. Happy Path)' : 'Parameterized scenario name (e.g. User Sweep)'} />
              <button className="btn btn-primary btn-sm" onClick={() => addScenario(fg.id)} disabled={!newName.trim()}>Create</button>
              <button className="btn btn-sm" onClick={() => { setNamingScenario(null); setNewScenarioKind('standard'); }}>Cancel</button>
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
              data-testid="har-scenario-card"
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
              <div
                className="scenario-group-header"
                data-testid="har-scenario-header"
                onClick={() => toggleScenario(sc.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({ x: e.clientX, y: e.clientY, fgId: fg.id, scId: sc.id });
                }}
              >
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
                {sc.kind === 'parameterized' && <span className="count-badge kind-badge kind-badge-param">PARAM</span>}
                <span className="count-badge">{sc.tests.length} test{sc.tests.length !== 1 ? 's' : ''}</span>
                {scAuth.type !== 'none' && scAuth.type !== 'inherit' && <span className="count-badge auth-badge auth-badge-scenario">Auth: {scAuth.type}</span>}
                {scAuth.type === 'inherit' && <span className="count-badge auth-badge auth-badge-scenario-inherit">Auth: inherit</span>}
                {(() => {
                  const testSlaCount = sc.tests.reduce((sum, t) => sum + (t.slaTargets?.length ?? 0), 0);
                  return testSlaCount > 0 ? (
                    <span className="count-badge sla-count-badge" title={`${testSlaCount} SLA target${testSlaCount !== 1 ? 's' : ''} across tests`}>
                      🎯 {testSlaCount}
                    </span>
                  ) : null;
                })()}
                {/* Tag pills */}
                {sc.tags && sc.tags.length > 0 && (
                  <span className="scenario-tag-pills">
                    {sc.tags.map(tag => (
                      <span key={tag} className="scenario-tag-pill" title={`Tag: ${tag}`}>
                        <span className="scenario-tag-pill-text">{tag}</span>
                        <button
                          className="scenario-tag-pill-remove"
                          onClick={(e) => { e.stopPropagation(); removeTag(fg.id, sc.id, tag); }}
                          title={`Remove tag "${tag}"`}
                          aria-label={`Remove tag ${tag}`}
                        >×</button>
                      </span>
                    ))}
                  </span>
                )}
                {/* Add tag button/input */}
                {editingTagScenario?.fgId === fg.id && editingTagScenario?.scId === sc.id ? (
                  <span className="scenario-tag-input-wrap" onClick={(e) => e.stopPropagation()}>
                    <input
                      className="scenario-tag-input"
                      autoFocus
                      placeholder="tag name"
                      value={tagInputValue}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setTagInputValue(e.currentTarget.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && tagInputValue.trim()) {
                          addTag(fg.id, sc.id, tagInputValue.trim());
                          setTagInputValue('');
                          setEditingTagScenario(null);
                        }
                        if (e.key === 'Escape') { setTagInputValue(''); setEditingTagScenario(null); }
                      }}
                      onBlur={() => { setTagInputValue(''); setEditingTagScenario(null); }}
                    />
                    {tagInputValue.length > 0 && tagSuggestions.filter(t => t.includes(tagInputValue.toLowerCase()) && t !== tagInputValue).length > 0 && (
                      <ul className="scenario-tag-suggestions">
                        {tagSuggestions.filter(t => t.includes(tagInputValue.toLowerCase()) && t !== tagInputValue).map(t => (
                          <li key={t}
                            className="scenario-tag-suggestion-item"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              addTag(fg.id, sc.id, t);
                              setTagInputValue('');
                              setEditingTagScenario(null);
                            }}
                          >{t}</li>
                        ))}
                      </ul>
                    )}
                  </span>
                ) : (
                  <button
                    className="scenario-tag-add-btn"
                    onClick={(e) => { e.stopPropagation(); setEditingTagScenario({ fgId: fg.id, scId: sc.id }); }}
                    title="Add tag"
                    aria-label="Add tag"
                  >+</button>
                )}
                <div className="scenario-group-actions" onClick={(e) => e.stopPropagation()}>
                  <button className="btn btn-sm" onClick={() => { setEditingScenarioName(sc.id); setEditName(sc.name); }}>Rename</button>
                  <button
                    className={`btn btn-sm ${editingScenarioAuth === sc.id ? 'btn-active' : ''}`}
                    onClick={() => toggleScenarioAuth(fg.id, sc.id)}
                  >Auth</button>
                  {sc.kind !== 'parameterized' && (
                    <button className="btn btn-sm" data-testid="har-add-test-btn" onClick={() => startNewTest(fg.id, sc.id)}>+ Test</button>
                  )}
                  {sc.kind !== 'standard' && (
                    <>
                      <button className="btn btn-sm" data-testid="har-add-param-test-btn" onClick={() => startNewParameterizedTest(fg.id, sc.id)} title="Create a new parameterized test with inline data">+ Param Test</button>
                      <button
                        className="btn btn-sm"
                        onClick={() => setShowFromSharedDsPicker({ fgId: fg.id, scId: sc.id })}
                        disabled={!sharedDataSources || sharedDataSources.length === 0}
                        title={!sharedDataSources || sharedDataSources.length === 0 ? 'No shared data sources available' : 'Create test linked to a shared data source'}
                      >
                        + From Shared DS
                      </button>
                    </>
                  )}
                  <button className="btn btn-sm" onClick={() => setMoveDialog({ type: 'scenario', itemName: sc.name, fgId: fg.id, scenarioId: sc.id })} title="Move to another feature group">Move</button>
                  <button className="btn btn-sm" onClick={() => importTestsInto(fg.id, sc.id)} title="Import tests into this scenario">Import</button>
                  <span className="export-opts-anchor">
                    <button className="btn btn-sm" onClick={() => setExportPopover({ id: sc.id, data: sc, exportFn: (o) => { exportScenario(sc, o); setExportPopover(null); } })} title="Export this scenario">Export</button>
                    {exportPopover?.id === sc.id && <ExportOptionsPopover data={exportPopover.data} onExport={exportPopover.exportFn} onClose={() => setExportPopover(null)} />}
                  </span>
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
                      className={`test-card ${t.dataSource ? 'test-card-parameterized' : ''} ${isSelfTestDrag ? 'dragging' : ''} ${isTestDragOver ? 'drop-target-before' : ''} ${isSearching && testMatches(t) ? 'search-match' : ''}`}
                      data-testid="har-test-card"
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
                        {t.dataSource && <span className="tag data-source-badge" title="Has data source">📋</span>}
                        <strong>{t.name}</strong>
                        {t.sourceRequestId && (
                          <span
                            className={`test-origin-badge${onLocateRequest ? ' test-origin-badge--clickable' : ''}`}
                            title={`From: ${t.sourceSpecVersionLabel ? `v${t.sourceSpecVersionLabel}` : 'Request'}${onLocateRequest ? ' — click to locate' : ''}`}
                            onClick={onLocateRequest ? (e) => { e.stopPropagation(); onLocateRequest(t.sourceRequestId!); } : undefined}
                            role={onLocateRequest ? 'button' : undefined}
                          >
                            {t.sourceSpecVersionLabel ? `v${t.sourceSpecVersionLabel}` : 'From Requests'}
                          </span>
                        )}
                      </div>
                      <div className="test-card-meta">
                        {t.dataSource && <span className="tag parameterized-tag">Param</span>}
                        {(() => {
                          const resolved = getEffectiveAuth(t, sc, fg);
                          if (!resolved) return <span className="tag auth-badge auth-badge-test-none">Auth: none</span>;
                          const cls = resolved.source === 'own' ? 'auth-badge-test-own'
                            : resolved.source === 'scenario' ? 'auth-badge-test-scenario'
                            : resolved.source === 'feature' ? 'auth-badge-test-feature'
                            : 'auth-badge-test-global';
                          return <span className={`tag auth-badge ${cls}`}>Auth: {resolved.label} ({resolved.source})</span>;
                        })()}
                        <span className="tag">Validation: {t.validation?.mode ?? 'none'}</span>
                        {(t.validation?.assertions ?? []).length > 0 && (() => {
                          const types = new Set((t.validation?.assertions ?? []).map(a => a.type));
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
                        <button
                          className={`btn btn-sm${(t.slaTargets?.length ?? 0) > 0 ? ' btn-sla-active' : ''}`}
                          data-testid="har-test-sla-btn"
                          onClick={() => setSlaModalTest({ fgId: fg.id, scId: sc.id, test: t })}
                          title="Configure SLA targets for this test"
                        >
                          🎯{(t.slaTargets?.length ?? 0) > 0 ? ` ${t.slaTargets!.length}` : ''}
                        </button>
                        <button className="btn btn-sm" data-testid="har-test-edit-btn" onClick={() => startEditTest(fg.id, sc.id, t)}>Edit</button>
                        <button className="btn btn-sm" data-testid="har-test-copy-btn" onClick={() => startCopyTest(fg.id, sc.id, t)} title="Copy to another scenario">Copy</button>
                        {!t.dataSource && sc.kind !== 'standard' && (
                          <button className="btn btn-sm" onClick={() => createParameterizedCopy(fg.id, sc.id, t)} title="Create a parameterized copy with data source">Parameterize</button>
                        )}
                        <button className="btn btn-sm" data-testid="har-test-move-btn" onClick={() => setMoveDialog({ type: 'test', itemName: t.name || t.url, fgId: fg.id, scenarioId: sc.id, testId: t.id })} title="Move to another scenario">Move</button>
                        <span className="export-opts-anchor">
                          <button className="btn btn-sm" onClick={() => setExportPopover({ id: t.id, data: t, exportFn: (o) => { exportTest(t, o); setExportPopover(null); } })} title="Export this test">Export</button>
                          {exportPopover?.id === t.id && <ExportOptionsPopover data={exportPopover.data} onExport={exportPopover.exportFn} onClose={() => setExportPopover(null)} />}
                        </span>
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
                  <ScenarioSlaPanel
                    tests={sc.tests}
                    onEditTest={(test) => setSlaModalTest({ fgId: fg.id, scId: sc.id, test })}
                  />
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
  );
}
