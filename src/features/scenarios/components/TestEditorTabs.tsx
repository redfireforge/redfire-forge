import type { Scenario } from '../../../shared/types';
import type { ScenarioKind } from '../../../shared/types';
import type { TestEditorTab } from './TestEditorModal';

export function TestEditorTabs({
  isHttp,
  isWs,
  draft,
  activeTab,
  onActiveTabChange,
  paramCount,
  headerCount,
  scenarioKind,
  isNew,
  defVersionCount,
}: {
  isHttp: boolean;
  isWs: boolean;
  draft: Scenario;
  activeTab: TestEditorTab;
  onActiveTabChange: (tab: TestEditorTab) => void;
  paramCount: number;
  headerCount: number;
  scenarioKind?: ScenarioKind;
  isNew: boolean;
  defVersionCount: number;
}) {
  return (
    <div className="builder-tabs">
      {isHttp && (
        <button type="button" className={`builder-tab ${activeTab === 'params' ? 'active' : ''}`} onClick={() => onActiveTabChange('params')}>
          Params {paramCount > 0 && <span className="tab-badge">{paramCount}</span>}
        </button>
      )}
      {isHttp && draft.method !== 'GET' && (
        <button type="button" className={`builder-tab ${activeTab === 'body' ? 'active' : ''}`} onClick={() => onActiveTabChange('body')}>
          Body {(draft.body || (draft.bodyForm ?? []).some((kv) => kv.key.trim())) ? <span className="tab-badge-dot" /> : null}
        </button>
      )}
      {isHttp && (
        <button type="button" className={`builder-tab ${activeTab === 'auth' ? 'active' : ''}`} onClick={() => onActiveTabChange('auth')}>
          Auth {draft.auth.type !== 'none' && <span className="tab-badge-dot" />}
        </button>
      )}
      {isHttp && (
        <button type="button" className={`builder-tab ${activeTab === 'headers' ? 'active' : ''}`} onClick={() => onActiveTabChange('headers')}>
          Headers {headerCount > 0 && <span className="tab-badge">{headerCount}</span>}
        </button>
      )}
      {!(draft.dataSource?.columns.some((c) => c.type === 'validate')) && (
        <button type="button" className={`builder-tab ${activeTab === 'validation' ? 'active' : ''}`} onClick={() => onActiveTabChange('validation')}>
          Validation {(draft.validation.mode === 'selective' || (draft.validation.mode === 'full' && !!draft.validation.expectedJson?.trim()) || (draft.validation.assertions?.length ?? 0) > 0) && <span className="tab-badge-dot" />}
        </button>
      )}
      {(isHttp || isWs) && !(draft.dataSource?.columns.some((c) => c.type === 'validate')) && (
        <button type="button" className={`builder-tab ${activeTab === 'extract' ? 'active' : ''}`} onClick={() => onActiveTabChange('extract')}>
          Extract {(draft.extractions?.length ?? 0) > 0 && <span className="tab-badge">{draft.extractions!.length}</span>}
        </button>
      )}
      {scenarioKind !== 'standard' && !draft.dataSource && (
        <button type="button" className={`builder-tab ${activeTab === 'data' ? 'active' : ''}`} onClick={() => onActiveTabChange('data')}>
          Parameterize
        </button>
      )}
      {scenarioKind !== 'standard' && draft.dataSource && (
        <button type="button" className={`builder-tab ${activeTab === 'data' ? 'active' : ''}`} onClick={() => onActiveTabChange('data')} data-testid="har-te-ds-tab">
          Data Source {(draft.dataSource.rows.filter((r) => r.enabled).length ?? 0) > 0 && <span className="tab-badge">{draft.dataSource.rows.filter((r) => r.enabled).length}</span>}
        </button>
      )}
      {!isNew && (
        <button type="button" className={`builder-tab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => onActiveTabChange('history')}>
          History {defVersionCount > 0 && <span className="tab-badge">{defVersionCount}</span>}
        </button>
      )}
    </div>
  );
}
