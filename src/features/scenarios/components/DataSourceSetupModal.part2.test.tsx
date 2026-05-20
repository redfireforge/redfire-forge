/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import DataSourceSetupModal from './DataSourceSetupModal';
import type { Scenario } from '../../../shared/types';
import { proxyFetch } from '../../../engine/executor';
import { applyAuthHeaders } from '../../../shared/utils/applyAuthHeaders';
import { downloadExcel, generateExcelTemplate } from '../utils/csvTemplate';
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

  describe('handleClose with contract changes', () => {
    it('persists validationContract updates when modal closes via FullPanelModal', () => {
      const onApply = vi.fn();
      const onClose = vi.fn();
      const test = createTestScenario({
        validation: { mode: 'none', expectedFields: [{ jsonPath: 'items[0].code', expectedValue: '' }] },
        dataSource: {
          columns: [
            { id: 'c1', name: 'userId', type: 'path', mapping: 'userId' },
          ],
          rows: [{ id: 'r1', values: { c1: '1' }, enabled: true }],
          source: { type: 'inline' },
          urlTemplate: 'https://api.example.com/users/{{userId}}/orders',
        },
      });
      render(<DataSourceSetupModal {...defaultProps} test={test} onApply={onApply} onClose={onClose} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      fireEvent.click(screen.getByRole('button', { name: /fixed → dynamic\?/i }));
      fireEvent.click(screen.getByTestId('full-panel-close'));
      expect(onApply).toHaveBeenCalledWith(
        expect.objectContaining({ validationContract: expect.arrayContaining(['items[*].code']) }),
        expect.any(String),
      );
      expect(onClose).toHaveBeenCalled();
    });

    it('removes a dynamic contract pattern when dynamic badge is clicked', () => {
      const onApply = vi.fn();
      const test = createTestScenario({
        validation: { mode: 'none', expectedFields: [{ jsonPath: 'items[0].code', expectedValue: '' }] },
        dataSource: {
          columns: [{ id: 'c1', name: 'userId', type: 'path', mapping: 'userId' }],
          rows: [{ id: 'r1', values: { c1: '1' }, enabled: true }],
          source: { type: 'inline' },
          urlTemplate: 'https://api.example.com/users/{{userId}}/orders',
          validationContract: ['items[*].code'],
        },
      });
      render(<DataSourceSetupModal {...defaultProps} test={test} onApply={onApply} onClose={vi.fn()} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      fireEvent.click(screen.getByText('dynamic'));
      fireEvent.click(screen.getByTestId('full-panel-close'));
      expect(onApply).toHaveBeenCalledWith(
        expect.objectContaining({ validationContract: undefined }),
        expect.any(String),
      );
    });
  });

  describe('Export mode', () => {
    it('shows Export .xlsx and Apply & Close buttons', () => {
      render(<DataSourceSetupModal {...defaultProps} mode="export" />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      
      expect(screen.getByText('Export .xlsx')).toBeInTheDocument();
      expect(screen.getByText('Apply & Close')).toBeInTheDocument();
    });
  });

  describe('Query params', () => {
    it('handles URL with query params', () => {
      const test = createTestScenario({
        url: 'https://api.example.com/users?page=1&limit=10',
      });
      render(<DataSourceSetupModal {...defaultProps} test={test} />);
      expect(screen.getByTestId('step-variables')).toBeInTheDocument();
    });
  });

  describe('Body variables', () => {
    it('detects body template variables', () => {
      const test = createTestScenario({
        method: 'POST',
        body: '{"name": "{{userName}}", "age": {{userAge}}}',
      });
      render(<DataSourceSetupModal {...defaultProps} test={test} />);
      expect(screen.getByTestId('step-variables')).toBeInTheDocument();
    });
  });

  describe('Column name validation', () => {
    it('disables Apply when column names are empty', () => {
      render(<DataSourceSetupModal {...defaultProps} test={scenarioWithExtraValidateColumn()} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      const nameInputs = screen.getAllByRole('textbox');
      const emptyCandidate = nameInputs.find(el => (el as HTMLInputElement).value === 'meta');
      expect(emptyCandidate).toBeTruthy();
      fireEvent.change(emptyCandidate!, { target: { value: '' } });
      const applyBtn = screen.getByText('Apply to Data Source');
      expect(applyBtn).toBeDisabled();
    });

    it('shows column type badges', () => {
      render(<DataSourceSetupModal {...defaultProps} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      
      expect(screen.getAllByText('path').length).toBeGreaterThan(0);
    });

    it('shows column stats', () => {
      render(<DataSourceSetupModal {...defaultProps} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      
      expect(screen.getByText(/total/)).toBeInTheDocument();
    });

    it('edits column name and strips special chars', () => {
      render(<DataSourceSetupModal {...defaultProps} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));

      const inputs = screen.getAllByRole('textbox');
      const colInput = inputs.find(i => (i as HTMLInputElement).value === 'userId');
      expect(colInput).toBeTruthy();
      fireEvent.change(colInput!, { target: { value: 'bad$name' } });
      expect((colInput as HTMLInputElement).value).toBe('badname');
    });

    it('shows duplicate column name errors', () => {
      render(<DataSourceSetupModal {...defaultProps} test={scenarioWithExtraValidateColumn()} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      validateColumnNameInput('meta').change('userId');
      expect(screen.getAllByText('duplicate').length).toBeGreaterThan(0);
      expect(screen.getByText('Apply to Data Source')).toBeDisabled();
    });
  });

  describe('handleFetchForValidate', () => {
    beforeEach(() => {
      vi.mocked(applyAuthHeaders).mockResolvedValue({});
    });

    it('returns immediately when URL is blank', async () => {
      render(
        <DataSourceSetupModal
          {...defaultProps}
          mode="parameterize"
          test={createTestScenario({
            url: '   ',
            validation: { mode: 'none', expectedFields: [{ jsonPath: 'a', expectedValue: '' }] },
          })}
        />,
      );
      ensurePathVariableChecked(0);
      fireEvent.change(screen.getByTestId('name-0'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      fireEvent.click(screen.getByText('Next: Validate Fields'));
      await act(async () => {
        fireEvent.click(screen.getByTestId('run-fetch-validate'));
      });
      expect(proxyFetch).not.toHaveBeenCalled();
    });

    it('uses onFetchRow when provided and completes without error', async () => {
      const onFetchRow = vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: {},
        body: '{"x":1}',
      });
      render(
        <DataSourceSetupModal
          {...defaultProps}
          mode="parameterize"
          onFetchRow={onFetchRow}
          test={scenarioWithExtraValidateColumn()}
        />,
      );
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      fireEvent.click(screen.getByText('Next: Validate Fields'));
      await act(async () => {
        fireEvent.click(screen.getByTestId('run-fetch-validate'));
      });
      expect(onFetchRow).toHaveBeenCalled();
      await waitFor(() => expect(screen.getByTestId('fetching')).toHaveTextContent('no'));
    });

    it('sets fetchError when onFetchRow returns error', async () => {
      const onFetchRow = vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: {},
        body: '',
        error: 'boom',
      });
      render(
        <DataSourceSetupModal
          {...defaultProps}
          mode="parameterize"
          onFetchRow={onFetchRow}
          test={scenarioWithExtraValidateColumn()}
        />,
      );
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      fireEvent.click(screen.getByText('Next: Validate Fields'));
      await act(async () => {
        fireEvent.click(screen.getByTestId('run-fetch-validate'));
      });
      await waitFor(() => expect(screen.getByTestId('fetch-error')).toHaveTextContent('boom'));
    });

    it('sets fetchError on HTTP error status', async () => {
      const onFetchRow = vi.fn().mockResolvedValue({
        status: 500,
        statusText: 'Err',
        headers: {},
        body: '',
      });
      render(
        <DataSourceSetupModal
          {...defaultProps}
          mode="parameterize"
          onFetchRow={onFetchRow}
          test={scenarioWithExtraValidateColumn()}
        />,
      );
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      fireEvent.click(screen.getByText('Next: Validate Fields'));
      await act(async () => {
        fireEvent.click(screen.getByTestId('run-fetch-validate'));
      });
      await waitFor(() => expect(screen.getByTestId('fetch-error')).toHaveTextContent('HTTP 500'));
    });

    it('uses proxyFetch when onFetchRow is omitted', async () => {
      vi.mocked(proxyFetch).mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: {},
        body: '{}',
      });
      render(<DataSourceSetupModal {...defaultProps} mode="parameterize" test={scenarioWithExtraValidateColumn()} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      fireEvent.click(screen.getByText('Next: Validate Fields'));
      await act(async () => {
        fireEvent.click(screen.getByTestId('run-fetch-validate'));
      });
      expect(applyAuthHeaders).toHaveBeenCalled();
      expect(proxyFetch).toHaveBeenCalled();
    });

    it('captures thrown Error in fetchError', async () => {
      const onFetchRow = vi.fn().mockRejectedValue(new Error('network'));
      render(
        <DataSourceSetupModal
          {...defaultProps}
          mode="parameterize"
          onFetchRow={onFetchRow}
          test={scenarioWithExtraValidateColumn()}
        />,
      );
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      fireEvent.click(screen.getByText('Next: Validate Fields'));
      await act(async () => {
        fireEvent.click(screen.getByTestId('run-fetch-validate'));
      });
      await waitFor(() => expect(screen.getByTestId('fetch-error')).toHaveTextContent('network'));
    });

    it('captures non-Error rejection in fetchError', async () => {
      const onFetchRow = vi.fn().mockRejectedValue('raw');
      render(
        <DataSourceSetupModal
          {...defaultProps}
          mode="parameterize"
          onFetchRow={onFetchRow}
          test={scenarioWithExtraValidateColumn()}
        />,
      );
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      fireEvent.click(screen.getByText('Next: Validate Fields'));
      await act(async () => {
        fireEvent.click(screen.getByTestId('run-fetch-validate'));
      });
      await waitFor(() => expect(screen.getByTestId('fetch-error')).toHaveTextContent('raw'));
    });

    it('captures errors when proxyFetch throws', async () => {
      vi.mocked(applyAuthHeaders).mockResolvedValue({});
      vi.mocked(proxyFetch).mockRejectedValue(new Error('proxy down'));
      render(<DataSourceSetupModal {...defaultProps} mode="parameterize" test={scenarioWithExtraValidateColumn()} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      fireEvent.click(screen.getByText('Next: Validate Fields'));
      await act(async () => {
        fireEvent.click(screen.getByTestId('run-fetch-validate'));
      });
      await waitFor(() => expect(screen.getByTestId('fetch-error')).toHaveTextContent('proxy down'));
    });
  });

  describe('handleExport', () => {
    it('downloads template and closes in export mode', async () => {
      const onClose = vi.fn();
      render(<DataSourceSetupModal {...defaultProps} mode="export" onClose={onClose} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      await act(async () => {
        fireEvent.click(screen.getByText('Export .xlsx'));
      });
      expect(downloadExcel).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });

    it('passes dataRows into generateExcelTemplate when rows exist', async () => {
      const onClose = vi.fn();
      const test = createTestScenario({
        dataSource: {
          columns: [{ id: 'c1', name: 'userId', type: 'path', mapping: 'userId' }],
          rows: [{ id: 'r1', label: 'Row A', values: { c1: '9' }, enabled: true }],
          source: { type: 'inline' },
          urlTemplate: 'https://api.example.com/users/{{userId}}',
        },
      });
      render(<DataSourceSetupModal {...defaultProps} mode="export" test={test} onClose={onClose} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      await act(async () => {
        fireEvent.click(screen.getByText('Export .xlsx'));
      });
      expect(generateExcelTemplate).toHaveBeenCalledWith(
        expect.objectContaining({ dataRows: expect.any(Array) }),
      );
    });
  });

});

/** Find column table textbox by current display value */
function validateColumnNameInput(value: string): { change: (v: string) => void } {
  const el = screen.getAllByRole('textbox').find(i => (i as HTMLInputElement).value === value);
  expect(el).toBeTruthy();
  return {
    change: (v: string) => fireEvent.change(el!, { target: { value: v } }),
  };
}
