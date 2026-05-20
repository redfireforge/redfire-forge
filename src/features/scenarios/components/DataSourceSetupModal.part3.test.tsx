/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import DataSourceSetupModal from './DataSourceSetupModal';
import { Scenario, FeatureGroup } from '../../../shared/types';
import { TestEditingContext } from './TestEditorModal';
import { extractJsonPath } from '../utils/dataSourceImport';

vi.mock('../../../shared/components/FullPanelModal', () => ({
  default: ({
    title,
    children,
    footer,
    onClose,
  }: {
    title: React.ReactNode;
    children: React.ReactNode;
    footer: React.ReactNode;
    onClose?: () => void;
  }) => (
    <div data-testid="full-panel-modal">
      <div data-testid="modal-title">{title}</div>
      <button type="button" data-testid="full-panel-close" onClick={onClose}>
        Close modal
      </button>
      <div data-testid="modal-body">{children}</div>
      <div data-testid="modal-footer">{footer}</div>
    </div>
  ),
}));

vi.mock('./SetupStepVariables', () => ({
  default: ({
    analysis,
    selections,
    toggleSegment,
    setVarName,
    urlParams = [],
    setParamSelection,
    headerCandidates = [],
    setHeaderSelection,
    bodyVariableCandidates = [],
    setBodySelection,
    setWorkingAuthType,
    patchWorkingAuth,
    autoUrlTemplate,
    setUrlTemplateInput,
    setIsTemplateCustomized,
  }: {
    analysis: { segments: { index: number; segment: string; variableName: string }[] };
    selections: Record<number, { checked: boolean; name: string }>;
    toggleSegment: (idx: number) => void;
    setVarName: (idx: number, name: string) => void;
    urlParams?: { key: string; value: string }[];
    setParamSelection?: (key: string, patch: Partial<{ enabled: boolean; name: string }>) => void;
    headerCandidates?: { key: string; value: string }[];
    setHeaderSelection?: (key: string, patch: Partial<{ enabled: boolean; name: string }>) => void;
    bodyVariableCandidates?: string[];
    setBodySelection?: (key: string, patch: Partial<{ enabled: boolean; name: string }>) => void;
    setWorkingAuthType?: (type: string) => void;
    patchWorkingAuth?: (patch: Record<string, unknown>) => void;
    autoUrlTemplate?: string;
    setUrlTemplateInput?: (v: string) => void;
    setIsTemplateCustomized?: (v: boolean) => void;
  }) => (
    <div data-testid="step-variables">
      <span data-testid="segment-count">{analysis.segments.length}</span>
      <button
        type="button"
        data-testid="exercise-variable-callbacks"
        onClick={() => {
          setWorkingAuthType?.('bearer');
          patchWorkingAuth?.({ token: 'tok' });
          const pk = urlParams[0]?.key;
          if (pk) setParamSelection?.(pk, { name: 'paramRenamed' });
          const hk = headerCandidates[0]?.key;
          if (hk) setHeaderSelection?.(hk, { enabled: true });
          const bk = bodyVariableCandidates[0];
          if (bk) setBodySelection?.(bk, { enabled: false });
          setIsTemplateCustomized?.(true);
          setUrlTemplateInput?.(`${autoUrlTemplate ?? ''}#touched`);
          setIsTemplateCustomized?.(false);
        }}
      >
        Exercise variable callbacks
      </button>
      {analysis.segments.map(seg => (
        <div key={seg.index} data-testid={`segment-${seg.index}`}>
          <input
            type="checkbox"
            data-testid={`check-${seg.index}`}
            checked={selections[seg.index]?.checked ?? false}
            onChange={() => toggleSegment(seg.index)}
          />
          <input
            data-testid={`name-${seg.index}`}
            value={selections[seg.index]?.name ?? ''}
            onChange={(e) => setVarName(seg.index, e.target.value)}
          />
          <span>{seg.segment}</span>
        </div>
      ))}
    </div>
  ),
}));

vi.mock('./SetupStepValidate', () => ({
  default: ({
    validationMode,
    setValidationMode,
    validateFields,
    setValidateFields,
    sampleJson,
    handleFetchForValidate,
    fetching,
    fetchError,
    setArrayModes,
  }: {
    validationMode: string;
    setValidationMode: (m: 'none' | 'selective' | 'full') => void;
    validateFields: { jsonPath: string; expectedValue?: string }[];
    setValidateFields: (next: { jsonPath: string; expectedValue?: string }[]) => void;
    sampleJson?: string;
    handleFetchForValidate: () => void | Promise<void>;
    fetching?: boolean;
    fetchError?: { message: string } | null;
    setArrayModes?: (
      next:
        | Record<string, 'ordered' | 'unordered'>
        | ((prev: Record<string, 'ordered' | 'unordered'>) => Record<string, 'ordered' | 'unordered'>),
    ) => void;
  }) => (
    <div data-testid="step-validate">
      <span data-testid="val-mode">{validationMode}</span>
      <span data-testid="val-field-count">{validateFields.length}</span>
      <span data-testid="sample-json-preview">{sampleJson ?? ''}</span>
      <span data-testid="first-validate-path">{validateFields[0]?.jsonPath ?? ''}</span>
      <span data-testid="fetching">{fetching ? 'yes' : 'no'}</span>
      <span data-testid="fetch-error">{fetchError?.message ?? ''}</span>
      <button type="button" data-testid="set-mode-none" onClick={() => setValidationMode('none')}>
        None
      </button>
      <button type="button" data-testid="set-mode-full" onClick={() => setValidationMode('full')}>
        Full
      </button>
      <button
        type="button"
        data-testid="append-validate-field"
        onClick={() =>
          setValidateFields([...validateFields, { jsonPath: 'extra[0].field', expectedValue: '' }])
        }
      >
        Add validate
      </button>
      <button
        type="button"
        data-testid="set-array-unordered"
        onClick={() => setArrayModes?.({ arrPrefix: 'unordered' })}
      >
        Unordered items
      </button>
      <button type="button" data-testid="run-fetch-validate" onClick={() => void handleFetchForValidate()}>
        Fetch
      </button>
    </div>
  ),
}));

vi.mock('./SetupStepReview', () => ({
  default: ({
    copyName,
    setCopyName,
    validationModeLabel,
    buildUrlTemplate,
    reviewPathVariables,
  }: {
    copyName: string;
    setCopyName: (n: string) => void;
    validationModeLabel: string;
    buildUrlTemplate?: () => string;
    reviewPathVariables?: { variableName: string; sourceValue: string }[];
  }) => (
    <div data-testid="step-review">
      <span data-testid="review-val-mode-label">{validationModeLabel}</span>
      <span data-testid="review-url-preview">{buildUrlTemplate?.() ?? ''}</span>
      <span data-testid="path-projection-order">
        {reviewPathVariables?.map((p) => p.variableName).join(',') ?? ''}
      </span>
      <input data-testid="copy-name" value={copyName} onChange={(e) => setCopyName(e.target.value)} />
    </div>
  ),
}));

vi.mock('./ColumnOrderPopover', () => ({
  default: ({ items, onApply, onClose }: { items: unknown[]; onApply: (items: unknown[]) => void; onClose: () => void }) => (
    <div data-testid="col-order-popover">
      <span>{items.length} items</span>
      <button data-testid="col-order-apply" onClick={() => onApply(items)}>Apply</button>
      <button data-testid="col-order-close" onClick={onClose}>Close</button>
    </div>
  ),
}));

vi.mock('../utils/csvTemplate', () => ({
  analyzeUrlPath: (url: string) => {
    const parts = url.replace(/^https?:\/\/[^/]+\//, '').split('/').filter(Boolean);
    return {
      origin: 'https://api.example.com',
      segments: parts.map((seg, i) => ({
        index: i,
        segment: seg,
        suggestedVariable: /^\d+$/.test(seg),
        variableName: /^\d+$/.test(seg) ? `id${i}` : seg,
      })),
    };
  },
  parseUrl: (url: string) => {
    try {
      const u = new URL(url);
      const params: { key: string; value: string }[] = [];
      u.searchParams.forEach((v, k) => params.push({ key: k, value: v }));
      return { params };
    } catch { return { params: [] }; }
  },
  generateExcelTemplate: vi.fn(() => ({ sheets: [] })),
  downloadExcel: vi.fn(),
}));

vi.mock('../utils/dataSourceSetupUtils', () => ({
  toVariableName: (name: string) => name.replace(/[^a-zA-Z0-9]/g, ''),
  getTemplateSegments: (url?: string) => (url ? url.replace(/^https?:\/\/[^/]+\//, '').split('/') : []),
  parseTemplateParamVariables: () => ({}),
  buildConfiguredColumnDefs: ({
    mode,
    test,
    pathVars,
    urlParams = [],
    paramSelections = {},
    headerSelections = {},
    bodySelections = {},
  }: {
    mode: string;
    test: Scenario;
    pathVars: { segmentIndex: number; variableName: string }[];
    urlParams?: { key: string; value: string }[];
    paramSelections?: Record<string, { enabled: boolean; name: string }>;
    headerSelections?: Record<string, { enabled: boolean; name: string }>;
    bodySelections?: Record<string, { enabled: boolean; name: string }>;
  }) => {
    const shortFor = (path: string) =>
      path.replace(/\./g, '_').replace(/\[(\d+)\]/g, '$1').replace(/[^a-zA-Z0-9_]/g, '');
    const out: Array<{
      type: string;
      mapping: string;
      fullKey: string;
      autoName: string;
      customName: string;
      sampleValue: string;
    }> = [];
    if (mode === 'export') {
      out.push({
        type: 'name',
        mapping: 'name',
        fullKey: 'name',
        autoName: 'TestName',
        customName: 'TestName',
        sampleValue: '',
      });
    }
    for (const p of pathVars) {
      out.push({
        type: 'path',
        mapping: p.variableName,
        fullKey: `path:${p.variableName}`,
        autoName: p.variableName,
        customName: p.variableName,
        sampleValue: '',
      });
    }
    for (const p of urlParams) {
      if (!paramSelections[p.key]?.enabled) continue;
      out.push({
        type: 'param',
        mapping: p.key,
        fullKey: `param:${p.key}`,
        autoName: p.key,
        customName: p.key,
        sampleValue: '',
      });
    }
    for (const [headerKey, cfg] of Object.entries(headerSelections)) {
      if (!cfg?.enabled) continue;
      const n = cfg.name || headerKey.replace(/[^a-zA-Z0-9]/g, '');
      out.push({
        type: 'header',
        mapping: headerKey,
        fullKey: `header:${headerKey}`,
        autoName: n,
        customName: n,
        sampleValue: '',
      });
    }
    for (const [bodyKey, cfg] of Object.entries(bodySelections)) {
      if (!cfg?.enabled) continue;
      out.push({
        type: 'body',
        mapping: bodyKey,
        fullKey: `body:${bodyKey}`,
        autoName: bodyKey,
        customName: bodyKey,
        sampleValue: '',
      });
    }
    for (const f of test.validation?.expectedFields ?? []) {
      const s = shortFor(f.jsonPath);
      out.push({
        type: 'validate',
        mapping: f.jsonPath,
        fullKey: `validate:${f.jsonPath}`,
        autoName: s,
        customName: s,
        sampleValue: f.expectedValue ?? '',
      });
    }
    for (const c of test.dataSource?.columns ?? []) {
      if (c.type === 'validate' && !out.some(d => d.type === 'validate' && d.mapping === c.mapping)) {
        const s = shortFor(c.mapping);
        out.push({
          type: 'validate',
          mapping: c.mapping,
          fullKey: `validate:${c.mapping}`,
          autoName: s,
          customName: s,
          sampleValue: '',
        });
      }
    }
    return out;
  },
  buildUrlTemplate: (_input: string, _defs: unknown[], preview: string) => preview,
  isTemplateToken: (v: string) => /^\{\{.+\}\}$/.test(v),
}));

vi.mock('../../../shared/utils/templateHelpers', () => ({
  isTemplateToken: (v: string) => /^\{\{.+\}\}$/.test(v),
}));

vi.mock('../../../engine/executor', () => ({
  proxyFetch: vi.fn(),
}));

vi.mock('../../../shared/utils/applyAuthHeaders', () => ({
  applyAuthHeaders: vi.fn(),
}));

vi.mock('../utils/dataSourceImport', () => ({
  extractJsonPath: vi.fn(() => ''),
}));

vi.mock('uuid', () => ({
  v4: () => 'mock-uuid-' + Math.random().toString(36).slice(2, 8),
}));

function createTestScenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    id: 'test-1',
    name: 'Get User',
    url: 'https://api.example.com/users/123/orders',
    method: 'GET',
    headers: [{ key: 'Authorization', value: 'Bearer {{token}}' }],
    body: '',
    auth: { type: 'none' },
    validation: { mode: 'none' },
    ...overrides,
  };
}

/** Path + at least one validate column ⇒ ≥2 defs in configure/parameterize mocks */
function scenarioWithExtraValidateColumn(): Scenario {
  return createTestScenario({
    validation: { mode: 'none', expectedFields: [{ jsonPath: 'meta', expectedValue: '' }] },
  });
}

/** Avoid toggling off when a segment is already pre-checked (e.g. from `urlTemplate` / existing data source). */
function ensurePathVariableChecked(segmentIndex: number) {
  const el = screen.getByTestId(`check-${segmentIndex}`) as HTMLInputElement;
  if (!el.checked) fireEvent.click(el);
}

describe('DataSourceSetupModal', () => {
  const defaultProps = {
    test: createTestScenario(),
    mode: 'configure' as const,
    onApply: vi.fn(),
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleApply edge cases', () => {
    it('pre-fills validate cells via extractJsonPath when no data source rows exist', () => {
      vi.mocked(extractJsonPath).mockReturnValueOnce('extracted');
      const onApply = vi.fn();
      const test = createTestScenario({
        validation: {
          mode: 'none',
          sampleJson: '{"items":[{"id":"1"}]}',
          expectedFields: [{ jsonPath: 'items[0].id', expectedValue: '' }],
        },
      });
      render(<DataSourceSetupModal {...defaultProps} test={test} onApply={onApply} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      fireEvent.click(screen.getByText('Apply to Data Source'));
      expect(extractJsonPath).toHaveBeenCalled();
      expect(onApply).toHaveBeenCalled();
      const [dataTable] = onApply.mock.calls[0];
      expect(dataTable.rows[0].isSample).toBe(true);
    });

    it('ignores invalid sample JSON when parsing', () => {
      const onApply = vi.fn();
      const test = createTestScenario({
        validation: {
          mode: 'none',
          sampleJson: 'not-json',
          expectedFields: [{ jsonPath: 'items[0].id', expectedValue: '' }],
        },
      });
      render(<DataSourceSetupModal {...defaultProps} test={test} onApply={onApply} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      fireEvent.click(screen.getByText('Apply to Data Source'));
      expect(onApply).toHaveBeenCalled();
    });

    it('matches migrated columns by name when mapping changes', () => {
      const onApply = vi.fn();
      const test = createTestScenario({
        dataSource: {
          columns: [{ id: 'c1', name: 'userId', type: 'path', mapping: 'legacy' }],
          rows: [{ id: 'r1', values: { c1: 'migrated-value' }, enabled: true }],
          source: { type: 'inline' },
          urlTemplate: 'https://api.example.com/users/{{userId}}/orders',
        },
      });
      render(<DataSourceSetupModal {...defaultProps} test={test} onApply={onApply} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      fireEvent.click(screen.getByText('Apply to Data Source'));
      const [dataTable] = onApply.mock.calls[0];
      const pathCol = dataTable.columns.find((c: { type: string }) => c.type === 'path');
      expect(pathCol).toBeDefined();
      expect(dataTable.rows[0].values[pathCol!.id]).toBe('migrated-value');
    });

    it('passes working auth in configure mode', () => {
      const onApply = vi.fn();
      const test = createTestScenario({
        auth: { type: 'bearer', token: 'tok' },
      });
      render(<DataSourceSetupModal {...defaultProps} test={test} onApply={onApply} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      fireEvent.click(screen.getByText('Apply to Data Source'));
      expect(onApply).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(String),
        expect.objectContaining({ auth: expect.objectContaining({ type: 'bearer' }) }),
      );
    });

    it('seeds a new param column on the first migrated row when it did not exist before', () => {
      const onApply = vi.fn();
      const test = createTestScenario({
        url: 'https://api.example.com/users/123/orders?ref=abc',
        dataSource: {
          columns: [{ id: 'c1', name: 'userId', type: 'path', mapping: 'userId' }],
          rows: [{ id: 'r1', values: { c1: '1' }, enabled: true }],
          source: { type: 'inline' },
          urlTemplate: 'https://api.example.com/users/{{userId}}/orders',
        },
      });
      render(<DataSourceSetupModal {...defaultProps} test={test} onApply={onApply} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      fireEvent.click(screen.getByText('Apply to Data Source'));
      const [dataTable] = onApply.mock.calls[0];
      const paramCol = dataTable.columns.find((c: { type: string }) => c.type === 'param');
      expect(paramCol).toBeDefined();
      expect(dataTable.rows[0].values[paramCol!.id]).toBe('abc');
    });

    it('pre-fills param cells from the literal URL when creating the first data row', () => {
      const onApply = vi.fn();
      const test = createTestScenario({
        url: 'https://api.example.com/users/123/orders?ref=xyz',
      });
      render(<DataSourceSetupModal {...defaultProps} test={test} onApply={onApply} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      fireEvent.click(screen.getByText('Apply to Data Source'));
      const [dataTable] = onApply.mock.calls[0];
      const paramCol = dataTable.columns.find((c: { type: string }) => c.type === 'param');
      expect(paramCol).toBeDefined();
      expect(dataTable.rows[0].values[paramCol!.id]).toBe('xyz');
    });

    it('resolves target scenario when feature groups are provided', () => {
      const groups: FeatureGroup[] = [
        {
          id: 'fg1',
          name: 'G1',
          scenarios: [{ id: 'sc1', name: 'S1', tests: [] }],
        },
      ];
      const editingTest: TestEditingContext = { fgId: 'fg1', scenarioId: 'sc1', testId: 't1' };
      render(
        <DataSourceSetupModal
          {...defaultProps}
          mode="parameterize"
          test={scenarioWithExtraValidateColumn()}
          featureGroups={groups}
          editingTest={editingTest}
        />,
      );
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      fireEvent.click(screen.getByText('Next: Validate Fields'));
      fireEvent.click(screen.getByText('Next: Column Order'));
      fireEvent.click(screen.getByText('Next: Review'));
      expect(screen.getByTestId('step-review')).toBeInTheDocument();
    });
  });

  describe('handleApply defaultValueForColumn branches and handleClose', () => {
    it('fills path cell from literal URL when template path segment is a placeholder', () => {
      const onApply = vi.fn();
      const test = createTestScenario({
        url: 'https://api.example.com/users/123/orders',
        dataSource: {
          columns: [{ id: 'c1', name: 'userId', type: 'path', mapping: 'userId' }],
          rows: [{ id: 'r1', values: { c1: '' }, enabled: true }],
          source: { type: 'inline' },
          urlTemplate: 'https://api.example.com/users/{{userId}}/orders',
        },
      });
      render(<DataSourceSetupModal {...defaultProps} test={test} onApply={onApply} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      fireEvent.click(screen.getByText('Apply to Data Source'));
      const [dataTable] = onApply.mock.calls[0];
      const pathCol = dataTable.columns.find((c: { type: string }) => c.type === 'path');
      expect(pathCol).toBeDefined();
      expect(dataTable.rows[0].values[pathCol!.id]).toBe('123');
    });

    it('uses empty default when literal path is still a template token', () => {
      const onApply = vi.fn();
      const test = createTestScenario({
        url: 'https://api.example.com/users/{{userId}}/orders',
        dataSource: {
          columns: [{ id: 'c1', name: 'userId', type: 'path', mapping: 'userId' }],
          rows: [{ id: 'r1', values: { c1: '' }, enabled: true }],
          source: { type: 'inline' },
          urlTemplate: 'https://api.example.com/users/{{userId}}/orders',
        },
      });
      render(<DataSourceSetupModal {...defaultProps} test={test} onApply={onApply} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      fireEvent.click(screen.getByText('Apply to Data Source'));
      const [dataTable] = onApply.mock.calls[0];
      const pathCol = dataTable.columns.find((c: { type: string }) => c.type === 'path');
      expect(dataTable.rows[0].values[pathCol!.id]).toBe('');
    });

    it('seeds param cell as empty when query value is a placeholder', () => {
      const onApply = vi.fn();
      const test = createTestScenario({
        url: 'https://api.example.com/users/123/orders?ref={{dynVar}}',
        dataSource: {
          columns: [{ id: 'c1', name: 'userId', type: 'path', mapping: 'userId' }],
          rows: [{ id: 'r1', values: { c1: '1' }, enabled: true }],
          source: { type: 'inline' },
          urlTemplate: 'https://api.example.com/users/{{userId}}/orders',
        },
      });
      render(<DataSourceSetupModal {...defaultProps} test={test} onApply={onApply} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      fireEvent.click(screen.getByText('Apply to Data Source'));
      const [dataTable] = onApply.mock.calls[0];
      const paramCol = dataTable.columns.find((c: { type: string }) => c.type === 'param');
      expect(paramCol).toBeDefined();
      expect(dataTable.rows[0].values[paramCol!.id]).toBe('');
    });

    it('seeds new header column on migrated row via non-path defaultValue branch', () => {
      const onApply = vi.fn();
      const test = createTestScenario({
        headers: [{ key: 'X-Trace', value: '{{traceId}}' }],
        dataSource: {
          columns: [{ id: 'c1', name: 'userId', type: 'path', mapping: 'userId' }],
          rows: [{ id: 'r1', values: { c1: '1' }, enabled: true }],
          source: { type: 'inline' },
          urlTemplate: 'https://api.example.com/users/{{userId}}/orders',
        },
      });
      render(<DataSourceSetupModal {...defaultProps} test={test} onApply={onApply} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      fireEvent.click(screen.getByText('Apply to Data Source'));
      const [dataTable] = onApply.mock.calls[0];
      const headerCol = dataTable.columns.find((c: { type: string }) => c.type === 'header');
      expect(headerCol).toBeDefined();
      expect(dataTable.rows[0].values[headerCol!.id]).toBe('');
    });

    it('does not call onApply when closing panel without validation contract edits', () => {
      const onApply = vi.fn();
      const onClose = vi.fn();
      const test = createTestScenario({
        dataSource: {
          columns: [{ id: 'c1', name: 'userId', type: 'path', mapping: 'userId' }],
          rows: [{ id: 'r1', values: { c1: '1' }, enabled: true }],
          source: { type: 'inline' },
          urlTemplate: 'https://api.example.com/users/{{userId}}/orders',
        },
      });
      render(<DataSourceSetupModal {...defaultProps} test={test} onApply={onApply} onClose={onClose} />);
      fireEvent.click(screen.getByTestId('full-panel-close'));
      expect(onApply).not.toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });

    it('persists arrayValidationMode on parameterized create when array mode is set', () => {
      const onApply = vi.fn();
      render(
        <DataSourceSetupModal
          {...defaultProps}
          mode="parameterize"
          onApply={onApply}
          test={scenarioWithExtraValidateColumn()}
        />,
      );
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      fireEvent.click(screen.getByText('Next: Validate Fields'));
      fireEvent.click(screen.getByTestId('set-array-unordered'));
      fireEvent.click(screen.getByText('Next: Column Order'));
      fireEvent.click(screen.getByText('Next: Review'));
      fireEvent.click(screen.getByText('Create & Open'));
      expect(onApply).toHaveBeenCalledWith(
        expect.objectContaining({ arrayValidationMode: { arrPrefix: 'unordered' } }),
        expect.any(String),
        expect.objectContaining({ copyName: expect.any(String) }),
      );
    });
  });

  describe('Parameterize mode details', () => {
    function goToReview(validationMode?: 'none' | 'full') {
      render(
        <DataSourceSetupModal {...defaultProps} mode="parameterize" test={scenarioWithExtraValidateColumn()} />,
      );
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      fireEvent.click(screen.getByText('Next: Validate Fields'));
      if (validationMode === 'none') {
        fireEvent.click(screen.getByTestId('set-mode-none'));
      }
      if (validationMode === 'full') {
        fireEvent.click(screen.getByTestId('set-mode-full'));
      }
      fireEvent.click(screen.getByText('Next: Column Order'));
      fireEvent.click(screen.getByText('Next: Review'));
    }

    it('shows validation mode labels on review', () => {
      goToReview();
      expect(screen.getByTestId('review-val-mode-label')).toHaveTextContent('Sample Rows Only');
      expect(screen.getByTestId('review-url-preview').textContent).toContain('api.example.com');
    });

    it('sorts review path variables alphabetically', () => {
      render(<DataSourceSetupModal {...defaultProps} mode="parameterize" test={scenarioWithExtraValidateColumn()} />);
      ensurePathVariableChecked(0);
      fireEvent.change(screen.getByTestId('name-0'), { target: { value: 'zebra' } });
      ensurePathVariableChecked(2);
      fireEvent.change(screen.getByTestId('name-2'), { target: { value: 'alpha' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      fireEvent.click(screen.getByText('Next: Validate Fields'));
      fireEvent.click(screen.getByText('Next: Column Order'));
      fireEvent.click(screen.getByText('Next: Review'));
      expect(screen.getByTestId('path-projection-order')).toHaveTextContent('alpha,zebra');
    });

    it('shows No Rows label when validation mode is none', () => {
      goToReview('none');
      expect(screen.getByTestId('review-val-mode-label')).toHaveTextContent('No Rows');
    });

    it('shows All Rows label when validation mode is full', () => {
      goToReview('full');
      expect(screen.getByTestId('review-val-mode-label')).toHaveTextContent('All Rows');
    });

    it('disables Create & Open when copy name is empty', () => {
      goToReview();
      fireEvent.change(screen.getByTestId('copy-name'), { target: { value: '   ' } });
      expect(screen.getByText('Create & Open')).toBeDisabled();
    });

    it('merges extra validate fields when advancing from validate step', () => {
      render(<DataSourceSetupModal {...defaultProps} mode="parameterize" test={scenarioWithExtraValidateColumn()} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      fireEvent.click(screen.getByText('Next: Validate Fields'));
      fireEvent.click(screen.getByTestId('append-validate-field'));
      expect(screen.getByTestId('val-field-count')).toHaveTextContent('2');
      fireEvent.click(screen.getByText('Next: Column Order'));
      expect(screen.getAllByTestId('col-order-popover').length).toBeGreaterThan(0);
    });

    it('applies reorder on the column order step', () => {
      render(<DataSourceSetupModal {...defaultProps} mode="parameterize" test={scenarioWithExtraValidateColumn()} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      fireEvent.click(screen.getByText('Next: Validate Fields'));
      fireEvent.click(screen.getByText('Next: Column Order'));
      fireEvent.click(screen.getAllByTestId('col-order-apply')[0]);
      expect(screen.getByText('Next: Review')).toBeInTheDocument();
    });

    it('shows order step stats', () => {
      render(<DataSourceSetupModal {...defaultProps} mode="parameterize" test={scenarioWithExtraValidateColumn()} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      fireEvent.click(screen.getByText('Next: Validate Fields'));
      fireEvent.click(screen.getByText('Next: Column Order'));
      expect(screen.getByText(/input/)).toBeInTheDocument();
      expect(screen.getByText(/total/)).toBeInTheDocument();
    });
  });
});

/** Find column table textbox by current display value */
function _validateColumnNameInput(value: string): { change: (v: string) => void } {
  const el = screen.getAllByRole('textbox').find(i => (i as HTMLInputElement).value === value);
  expect(el).toBeTruthy();
  return {
    change: (v: string) => fireEvent.change(el!, { target: { value: v } }),
  };
}
