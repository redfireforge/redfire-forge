/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import DataSourceSetupModal from './DataSourceSetupModal';
import type { Scenario, FeatureGroup } from '../../../shared/types';
import type { TestEditingContext } from './TestEditorModal';
import { proxyFetch } from '../../../engine/executor';
import { applyAuthHeaders } from '../../../shared/utils/applyAuthHeaders';
import { downloadExcel, generateExcelTemplate } from '../utils/csvTemplate';
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
  default: ({ analysis, selections, toggleSegment, setVarName }: {
    analysis: { segments: { index: number; segment: string; variableName: string }[] };
    selections: Record<number, { checked: boolean; name: string }>;
    toggleSegment: (idx: number) => void;
    setVarName: (idx: number, name: string) => void;
  }) => (
    <div data-testid="step-variables">
      <span data-testid="segment-count">{analysis.segments.length}</span>
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
    handleFetchForValidate,
    fetching,
    fetchError,
  }: {
    validationMode: string;
    setValidationMode: (m: 'none' | 'selective' | 'full') => void;
    validateFields: { jsonPath: string; expectedValue?: string }[];
    setValidateFields: (next: { jsonPath: string; expectedValue?: string }[]) => void;
    handleFetchForValidate: () => void | Promise<void>;
    fetching?: boolean;
    fetchError?: string | null;
  }) => (
    <div data-testid="step-validate">
      <span data-testid="val-mode">{validationMode}</span>
      <span data-testid="val-field-count">{validateFields.length}</span>
      <span data-testid="fetching">{fetching ? 'yes' : 'no'}</span>
      <span data-testid="fetch-error">{fetchError ?? ''}</span>
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
  }: {
    mode: string;
    test: Scenario;
    pathVars: { segmentIndex: number; variableName: string }[];
    urlParams?: { key: string; value: string }[];
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
      out.push({
        type: 'param',
        mapping: p.key,
        fullKey: `param:${p.key}`,
        autoName: p.key,
        customName: p.key,
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

  describe('Rendering', () => {
    it('renders modal with configure title', () => {
      render(<DataSourceSetupModal {...defaultProps} />);
      expect(screen.getByText('Configure Data Source')).toBeInTheDocument();
    });

    it('renders modal with export title', () => {
      render(<DataSourceSetupModal {...defaultProps} mode="export" />);
      expect(screen.getByText('Export Template')).toBeInTheDocument();
    });

    it('renders modal with parameterize title', () => {
      render(<DataSourceSetupModal {...defaultProps} mode="parameterize" />);
      expect(screen.getByText('Create Parameterized Copy')).toBeInTheDocument();
    });

    it('shows test name and method badge', () => {
      render(<DataSourceSetupModal {...defaultProps} />);
      expect(screen.getByText('GET')).toBeInTheDocument();
      expect(screen.getByText('Get User')).toBeInTheDocument();
    });

    it('shows step bar with correct labels for configure mode', () => {
      render(<DataSourceSetupModal {...defaultProps} />);
      expect(screen.getByText('Path Variables')).toBeInTheDocument();
      expect(screen.getByText('Columns')).toBeInTheDocument();
    });

    it('shows step bar with all labels for parameterize mode', () => {
      render(<DataSourceSetupModal {...defaultProps} mode="parameterize" />);
      expect(screen.getByText('Detect Variables')).toBeInTheDocument();
      expect(screen.getByText('Configure Columns')).toBeInTheDocument();
      expect(screen.getByText('Validate Fields')).toBeInTheDocument();
      expect(screen.getByText('Column Order')).toBeInTheDocument();
      expect(screen.getByText('Review')).toBeInTheDocument();
    });
  });

  describe('Step 1: Variables', () => {
    it('renders SetupStepVariables on initial load', () => {
      render(<DataSourceSetupModal {...defaultProps} />);
      expect(screen.getByTestId('step-variables')).toBeInTheDocument();
    });

    it('shows URL segments', () => {
      render(<DataSourceSetupModal {...defaultProps} />);
      expect(screen.getByText('users')).toBeInTheDocument();
      expect(screen.getByText('123')).toBeInTheDocument();
      expect(screen.getByText('orders')).toBeInTheDocument();
    });

    it('shows Next: Columns button', () => {
      render(<DataSourceSetupModal {...defaultProps} />);
      expect(screen.getByText('Next: Columns')).toBeInTheDocument();
    });

    it('shows Cancel button', () => {
      render(<DataSourceSetupModal {...defaultProps} />);
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('calls onClose when Cancel clicked', () => {
      render(<DataSourceSetupModal {...defaultProps} />);
      fireEvent.click(screen.getByText('Cancel'));
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('allows toggling segment variable', () => {
      render(<DataSourceSetupModal {...defaultProps} />);
      const checkbox = screen.getByTestId('check-1');
      fireEvent.click(checkbox);
      expect(checkbox).toBeChecked();
    });

    it('allows setting variable name', () => {
      render(<DataSourceSetupModal {...defaultProps} />);
      const checkbox = screen.getByTestId('check-1');
      fireEvent.click(checkbox);
      const nameInput = screen.getByTestId('name-1');
      fireEvent.change(nameInput, { target: { value: 'userId' } });
      expect(nameInput).toHaveValue('userId');
    });
  });

  describe('Step 2: Columns', () => {
    it('navigates to columns step on Next click', () => {
      render(<DataSourceSetupModal {...defaultProps} />);
      // Select a segment first
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      
      fireEvent.click(screen.getByText('Next: Columns'));
      expect(screen.getByText('Configure Columns')).toBeInTheDocument();
    });

    it('shows columns table after navigating', () => {
      render(<DataSourceSetupModal {...defaultProps} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      
      expect(screen.getByText('Configure Columns')).toBeInTheDocument();
      expect(screen.getByText(/Column Name/)).toBeInTheDocument();
    });

    it('shows Apply to Data Source button in configure mode', () => {
      render(<DataSourceSetupModal {...defaultProps} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      
      expect(screen.getByText('Apply to Data Source')).toBeInTheDocument();
    });

    it('shows Export .xlsx button in export mode', () => {
      render(<DataSourceSetupModal {...defaultProps} mode="export" />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      
      expect(screen.getByText('Export .xlsx')).toBeInTheDocument();
    });

    it('shows Back button on columns step', () => {
      render(<DataSourceSetupModal {...defaultProps} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      
      expect(screen.getByText(/Back/)).toBeInTheDocument();
    });

    it('navigates back to variables step', () => {
      render(<DataSourceSetupModal {...defaultProps} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      
      fireEvent.click(screen.getByText(/Back/));
      expect(screen.getByTestId('step-variables')).toBeInTheDocument();
    });

    it('shows Next: Validate Fields in parameterize mode', () => {
      render(<DataSourceSetupModal {...defaultProps} mode="parameterize" />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      
      expect(screen.getByText('Next: Validate Fields')).toBeInTheDocument();
    });

    it('allows editing column name', () => {
      render(<DataSourceSetupModal {...defaultProps} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      
      const inputs = screen.getAllByDisplayValue('userId');
      expect(inputs.length).toBeGreaterThan(0);
    });

    it('allows removing a column', () => {
      render(<DataSourceSetupModal {...defaultProps} test={scenarioWithExtraValidateColumn()} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));

      const removeButtons = screen.getAllByTitle('Remove column');
      const initialCount = removeButtons.length;
      expect(initialCount).toBeGreaterThan(0);
      fireEvent.click(removeButtons[removeButtons.length - 1]);
      expect(screen.getAllByTitle('Remove column').length).toBe(initialCount - 1);
    });

    it('calls onApply when Apply clicked', () => {
      const onApply = vi.fn();
      render(<DataSourceSetupModal {...defaultProps} onApply={onApply} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      
      fireEvent.click(screen.getByText('Apply to Data Source'));
      expect(onApply).toHaveBeenCalled();
    });
  });

  describe('Parameterize mode - Steps 3-5', () => {
    function goToStep3() {
      const result = render(
        <DataSourceSetupModal {...defaultProps} mode="parameterize" test={scenarioWithExtraValidateColumn()} />,
      );
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      fireEvent.click(screen.getByText('Next: Validate Fields'));
      return result;
    }

    it('navigates to validate step', () => {
      goToStep3();
      expect(screen.getByTestId('step-validate')).toBeInTheDocument();
    });

    it('shows validation mode', () => {
      goToStep3();
      expect(screen.getByTestId('val-mode')).toHaveTextContent('selective');
    });

    it('navigates to order step', () => {
      goToStep3();
      fireEvent.click(screen.getByText('Next: Column Order'));
      expect(screen.getByTestId('col-order-popover')).toBeInTheDocument();
    });

    it('navigates to review step', () => {
      goToStep3();
      fireEvent.click(screen.getByText('Next: Column Order'));
      fireEvent.click(screen.getByText('Next: Review'));
      expect(screen.getByTestId('step-review')).toBeInTheDocument();
    });

    it('shows Create & Open button on review step', () => {
      goToStep3();
      fireEvent.click(screen.getByText('Next: Column Order'));
      fireEvent.click(screen.getByText('Next: Review'));
      expect(screen.getByText('Create & Open')).toBeInTheDocument();
    });

    it('calls onApply with parameterize options on Create', () => {
      const onApply = vi.fn();
      render(
        <DataSourceSetupModal
          {...defaultProps}
          mode="parameterize"
          onApply={onApply}
          sourceName="My Test"
          test={scenarioWithExtraValidateColumn()}
        />,
      );
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      fireEvent.click(screen.getByText('Next: Validate Fields'));
      fireEvent.click(screen.getByText('Next: Column Order'));
      fireEvent.click(screen.getByText('Next: Review'));
      fireEvent.click(screen.getByText('Create & Open'));
      
      expect(onApply).toHaveBeenCalledWith(
        expect.objectContaining({ columns: expect.any(Array), rows: expect.any(Array) }),
        expect.any(String),
        expect.objectContaining({ copyName: expect.any(String) }),
      );
    });
  });

  describe('Column Order in columns step', () => {
    it('shows Column Order button when multiple columns', () => {
      render(<DataSourceSetupModal {...defaultProps} test={scenarioWithExtraValidateColumn()} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));

      expect(screen.getByText('↕ Column Order')).toBeInTheDocument();
    });

    it('opens column order popover', () => {
      render(<DataSourceSetupModal {...defaultProps} test={scenarioWithExtraValidateColumn()} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));

      fireEvent.click(screen.getByText('↕ Column Order'));
      expect(screen.getByTestId('col-order-popover')).toBeInTheDocument();
    });

    it('closes column order popover when toggled again', () => {
      render(<DataSourceSetupModal {...defaultProps} test={scenarioWithExtraValidateColumn()} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      fireEvent.click(screen.getByText('↕ Column Order'));
      expect(screen.getByTestId('col-order-popover')).toBeInTheDocument();
      fireEvent.click(screen.getByText('↕ Column Order'));
      expect(screen.queryByTestId('col-order-popover')).not.toBeInTheDocument();
    });

    it('applies column order from popover', () => {
      render(<DataSourceSetupModal {...defaultProps} test={scenarioWithExtraValidateColumn()} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      fireEvent.click(screen.getByText('↕ Column Order'));
      fireEvent.click(screen.getByTestId('col-order-apply'));
      expect(screen.getByTestId('col-order-popover')).toBeInTheDocument();
    });

    it('closes column order popover via ColumnOrderPopover onClose', () => {
      render(<DataSourceSetupModal {...defaultProps} test={scenarioWithExtraValidateColumn()} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      fireEvent.click(screen.getByText('↕ Column Order'));
      expect(screen.getByTestId('col-order-popover')).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('col-order-close'));
      expect(screen.queryByTestId('col-order-popover')).not.toBeInTheDocument();
    });
  });

  describe('Existing data source', () => {
    it('pre-populates selections from existing data source', () => {
      const test = createTestScenario({
        url: 'https://api.example.com/users/{{userId}}/orders',
        dataSource: {
          columns: [
            { id: 'c1', name: 'userId', type: 'path', mapping: 'userId' },
          ],
          rows: [{ id: 'r1', values: { c1: '42' }, enabled: true }],
          source: { type: 'inline' },
          urlTemplate: 'https://api.example.com/users/{{userId}}/orders',
        },
      });
      render(<DataSourceSetupModal {...defaultProps} test={test} />);
      expect(screen.getByTestId('step-variables')).toBeInTheDocument();
    });

    it('preserves existing rows on Apply', () => {
      const onApply = vi.fn();
      const test = createTestScenario({
        dataSource: {
          columns: [
            { id: 'c1', name: 'userId', type: 'path', mapping: 'userId' },
          ],
          rows: [
            { id: 'r1', values: { c1: '1' }, enabled: true },
            { id: 'r2', values: { c1: '2' }, enabled: true },
          ],
          source: { type: 'inline' },
          urlTemplate: 'https://api.example.com/users/{{userId}}/orders',
        },
      });
      render(<DataSourceSetupModal {...defaultProps} test={test} onApply={onApply} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      fireEvent.click(screen.getByText('Apply to Data Source'));
      
      expect(onApply).toHaveBeenCalled();
      const appliedDataTable = onApply.mock.calls[0][0];
      expect(appliedDataTable.rows.length).toBe(2);
    });
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
function validateColumnNameInput(value: string): { change: (v: string) => void } {
  const el = screen.getAllByRole('textbox').find(i => (i as HTMLInputElement).value === value);
  expect(el).toBeTruthy();
  return {
    change: (v: string) => fireEvent.change(el!, { target: { value: v } }),
  };
}
