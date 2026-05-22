/**
 * Shared test helpers for DataSourceSetupModal test splits.
 *
 * The hoisted vi.mock() calls must stay in each test file for Vitest to set
 * up module-level interception. This helper provides the FACTORY BODIES so
 * each test file only needs ~3 lines per mock instead of 100+.
 *
 * Usage pattern in test files:
 *
 *   vi.mock('./FullPanelModal', async () => {
 *     const h = await import('./__test-utils__/dataSourceSetupModalTestHelpers');
 *     return h.makeFullPanelModalMock();
 *   });
 *
 * IMPORTANT: This module must NOT import `../DataSourceSetupModal` (avoid
 * circular mock-resolution hangs).
 */
import type { JSX, ReactNode } from 'react';
import { fireEvent, screen } from '@testing-library/react';
import { vi } from 'vitest';
import type { Scenario } from '../../../../shared/types';

// ─── Mock factories ──────────────────────────────────────────────────

export function makeFullPanelModalMock() {
  return {
    default: ({
      title,
      children,
      footer,
      onClose,
    }: {
      title: ReactNode;
      children: ReactNode;
      footer: ReactNode;
      onClose?: () => void;
    }): JSX.Element => (
      <div data-testid="full-panel-modal">
        <div data-testid="modal-title">{title}</div>
        <button type="button" data-testid="full-panel-close" onClick={onClose}>
          Close modal
        </button>
        <div data-testid="modal-body">{children}</div>
        <div data-testid="modal-footer">{footer}</div>
      </div>
    ),
  };
}

interface SetupStepVariablesProps {
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
}

export function makeSetupStepVariablesMock() {
  return {
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
    }: SetupStepVariablesProps): JSX.Element => (
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
        {analysis.segments.map((seg) => (
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
  };
}

interface SetupStepValidateProps {
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
}

export function makeSetupStepValidateMock() {
  return {
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
    }: SetupStepValidateProps): JSX.Element => (
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
            setValidateFields([
              ...validateFields,
              { jsonPath: 'extra[0].field', expectedValue: '' },
            ])
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
  };
}

export function makeSetupStepReviewMock() {
  return {
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
    }): JSX.Element => (
      <div data-testid="step-review">
        <span data-testid="review-val-mode-label">{validationModeLabel}</span>
        <span data-testid="review-url-preview">{buildUrlTemplate?.() ?? ''}</span>
        <span data-testid="path-projection-order">
          {reviewPathVariables?.map((p) => p.variableName).join(',') ?? ''}
        </span>
        <input data-testid="copy-name" value={copyName} onChange={(e) => setCopyName(e.target.value)} />
      </div>
    ),
  };
}

export function makeColumnOrderPopoverMock() {
  return {
    default: ({
      items,
      onApply,
      onClose,
    }: {
      items: unknown[];
      onApply: (items: unknown[]) => void;
      onClose: () => void;
    }): JSX.Element => (
      <div data-testid="col-order-popover">
        <span>{items.length} items</span>
        <button data-testid="col-order-apply" onClick={() => onApply(items)}>
          Apply
        </button>
        <button data-testid="col-order-close" onClick={onClose}>
          Close
        </button>
      </div>
    ),
  };
}

// ─── Utility-module mock factories ────────────────────────────────────

export function makeCsvTemplateMock() {
  return {
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
      } catch {
        return { params: [] };
      }
    },
    generateExcelTemplate: vi.fn(() => ({ sheets: [] })),
    downloadExcel: vi.fn(),
  };
}

interface BuildConfiguredColumnDefsArgs {
  mode: string;
  test: Scenario;
  pathVars: { segmentIndex: number; variableName: string }[];
  urlParams?: { key: string; value: string }[];
  paramSelections?: Record<string, { enabled: boolean; name: string }>;
  headerSelections?: Record<string, { enabled: boolean; name: string }>;
  bodySelections?: Record<string, { enabled: boolean; name: string }>;
}

export function makeDataSourceSetupUtilsMock() {
  const shortFor = (path: string) =>
    path.replace(/\./g, '_').replace(/\[(\d+)\]/g, '$1').replace(/[^a-zA-Z0-9_]/g, '');

  return {
    toVariableName: (name: string) => name.replace(/[^a-zA-Z0-9]/g, ''),
    getTemplateSegments: (url?: string) =>
      url ? url.replace(/^https?:\/\/[^/]+\//, '').split('/') : [],
    parseTemplateParamVariables: () => ({}),
    buildConfiguredColumnDefs: ({
      mode,
      test,
      pathVars,
      urlParams = [],
      paramSelections = {},
      headerSelections = {},
      bodySelections = {},
    }: BuildConfiguredColumnDefsArgs) => {
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
        if (c.type === 'validate' && !out.some((d) => d.type === 'validate' && d.mapping === c.mapping)) {
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
  };
}

export function makeTemplateHelpersMock() {
  return {
    isTemplateToken: (v: string) => /^\{\{.+\}\}$/.test(v),
  };
}

export function makeExecutorMock() {
  return { proxyFetch: vi.fn() };
}

export function makeApplyAuthHeadersMock() {
  return { applyAuthHeaders: vi.fn() };
}

export function makeDataSourceImportMock() {
  return { extractJsonPath: vi.fn(() => '') };
}

export function makeUuidMock() {
  return {
    v4: () => 'mock-uuid-' + Math.random().toString(36).slice(2, 8),
  };
}

// ─── Scenario factory + test utilities ───────────────────────────────

export function createTestScenario(overrides: Partial<Scenario> = {}): Scenario {
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
  } as Scenario;
}

/** Path + at least one validate column ⇒ ≥2 defs in configure/parameterize mocks. */
export function scenarioWithExtraValidateColumn(): Scenario {
  return createTestScenario({
    validation: { mode: 'none', expectedFields: [{ jsonPath: 'meta', expectedValue: '' }] },
  });
}

/** Avoid toggling off when a segment is already pre-checked. */
export function ensurePathVariableChecked(segmentIndex: number): void {
  const el = screen.getByTestId(`check-${segmentIndex}`) as HTMLInputElement;
  if (!el.checked) fireEvent.click(el);
}
