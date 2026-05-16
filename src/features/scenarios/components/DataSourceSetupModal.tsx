/**
 * Unified Data Source Setup / Export Template modal.
 *
 * Wizard steps:
 *  1. Path Variables — pick which URL segments are variables
 *  2. Columns — configure column names and types
 *  3. Apply (saves to inline data source) or Export (downloads .xlsx)
 */
import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import type { FetchErrorDetail } from '../../../shared/components/data-mapper/types';
import { v4 as uuidv4 } from 'uuid';
import type { Scenario, DataSource, DataSourceColumn, DataSourceRow, FeatureGroup, ExpectedField, AuthConfig } from '../../../shared/types';
import type { HttpResponse } from '../../../shared/utils/httpClient';
import type { TestEditingContext } from './TestEditorModal';
import {
  analyzeUrlPath,
  generateExcelTemplate,
  downloadExcel,
  parseUrl,
} from '../utils/csvTemplate';
import type { ColumnDef } from '../utils/csvTemplate';
import FullPanelModal from '../../../shared/components/FullPanelModal';
import ColumnOrderPopover from './ColumnOrderPopover';
import SetupStepVariables from './SetupStepVariables';
import SetupStepValidate from './SetupStepValidate';
import SetupStepReview from './SetupStepReview';
import { proxyFetch } from '../../../engine/executor';
import { applyAuthHeaders } from '../../../shared/utils/applyAuthHeaders';
import { extractJsonPath } from '../utils/dataSourceImport';
import {
  toVariableName,
  getTemplateSegments,
  parseTemplateParamVariables,
  buildConfiguredColumnDefs,
  buildUrlTemplate,
} from '../utils/dataSourceSetupUtils';
import { isTemplateToken } from '../../../shared/utils/templateHelpers';
import type { SetupMode } from '../utils/dataSourceSetupUtils';

export type { SetupMode };

interface Props {
  test: Scenario;
  mode: SetupMode;
  onApply: (dataTable: DataSource, urlTemplate: string, parameterizeOptions?: {
    copyName?: string;
    targetFgId?: string;
    targetScenarioId?: string;
    auth?: Scenario['auth'];
  }) => void;
  onClose: () => void;
  /** Auth-aware fetch for validate field detection */
  onFetchRow?: (
    url: string,
    method: string,
    headers: Record<string, string>,
    body?: string,
    authOverride?: Scenario['auth'],
  ) => Promise<HttpResponse>;
  /** All feature groups for destination picker (parameterize mode) */
  featureGroups?: FeatureGroup[];
  /** Current editing context (parameterize mode) */
  editingTest?: TestEditingContext;
  /** Source test name (parameterize mode) */
  sourceName?: string;
}

type Step = 'variables' | 'columns' | 'validate' | 'order' | 'create';

export default function DataSourceSetupModal({ test, mode, onApply, onClose, onFetchRow, featureGroups, editingTest, sourceName }: Props) {
  // Pre-populate from existing data table if available
  const existingDt = test.dataSource;

  // Use urlTemplate (if exists) for segment analysis so we remember which segments are variables.
  // Fall back to the literal test URL for fresh setup.
  const analysisUrl = existingDt?.urlTemplate || test.url;
  const analysis = useMemo(() => analyzeUrlPath(analysisUrl), [analysisUrl]);
  // Always parse the literal URL for query param values
  const { params: urlParams } = useMemo(() => parseUrl(test.url), [test.url]);

  const [step, setStep] = useState<Step>('variables');

  // --- Validation mode ---
  const [validationMode, setValidationMode] = useState<'none' | 'selective' | 'full'>(
    existingDt?.validationMode ?? 'selective',
  );

  // --- Validation contract state (dynamic array patterns) ---
  const [contractPatterns, setContractPatterns] = useState<Set<string>>(() => {
    return new Set(existingDt?.validationContract ?? []);
  });
  // Track whether contract patterns changed (to auto-save on close)
  const initialContractRef = useRef<Set<string>>(new Set(existingDt?.validationContract ?? []));

  // --- Step 1: path variable selections ---
  const [selections, setSelections] = useState<Record<number, { checked: boolean; name: string }>>(() => {
    const init: Record<number, { checked: boolean; name: string }> = {};
    // If existing data table has path columns, pre-check those segments
    const existingPathCols = existingDt?.columns.filter(c => c.type === 'path') ?? [];
    const existingPathNames = new Set(existingPathCols.map(c => c.mapping));

    for (const seg of analysis.segments) {
      // Check if this segment matches an existing path column variable
      const matchesExisting = existingPathCols.some(c => {
        // The segment value might be {{varName}} in the urlTemplate
        return seg.segment === `{{${c.mapping}}}` || seg.variableName === c.mapping;
      });
      // Also check if the url template has a {{var}} in this position
      const templateSegments = getTemplateSegments(existingDt?.urlTemplate);
      const templateMatch = templateSegments[seg.index]?.match(/^\{\{(\w+)\}\}$/);

      // Also check if the segment itself is already a {{varName}} placeholder in the URL
      const segmentIsPlaceholder = seg.segment.match(/^\{\{(\w+)\}\}$/);

      const isChecked = matchesExisting || !!templateMatch || !!segmentIsPlaceholder;
      const name = templateMatch?.[1] || segmentIsPlaceholder?.[1] || (matchesExisting ? [...existingPathNames].find(n => seg.variableName === n || seg.segment === `{{${n}}}`) : '') || (seg.suggestedVariable ? seg.variableName : '');

      init[seg.index] = { checked: isChecked, name: name || '' };
    }
    return init;
  });

  const [paramSelections, setParamSelections] = useState<Record<string, { enabled: boolean; name: string }>>(() => {
    const initial: Record<string, { enabled: boolean; name: string }> = {};
    const templateVars = parseTemplateParamVariables(existingDt?.urlTemplate || test.url);
    const existingParamCols = (existingDt?.columns ?? []).filter(c => c.type === 'param');
    const existingParamNameByMapping = new Map(existingParamCols.map(c => [c.mapping, c.name]));
    const hasRememberedParamColumns = existingParamCols.length > 0;
    for (const p of urlParams) {
      const rememberedName = existingParamNameByMapping.get(p.key);
      const templateName = templateVars[p.key];
      initial[p.key] = {
        // If we have no remembered param columns, default URL query params to enabled.
        enabled: hasRememberedParamColumns ? (rememberedName !== undefined || !!templateName) : true,
        name: rememberedName || templateName || p.key,
      };
    }
    return initial;
  });

  const headerCandidates = useMemo(() => {
    return test.headers
      .filter(h => h.key.trim())
      .map(h => {
        const varMatch = h.value.match(/^\{\{([a-zA-Z0-9_]+)\}\}$/);
        return {
          key: h.key.trim(),
          value: h.value,
          suggestedName: varMatch?.[1] || toVariableName(h.key),
          suggestedEnabled: !!varMatch,
        };
      });
  }, [test.headers]);

  const [headerSelections, setHeaderSelections] = useState<Record<string, { enabled: boolean; name: string }>>(() => {
    const initial: Record<string, { enabled: boolean; name: string }> = {};
    const existingHeaderCols = (existingDt?.columns ?? []).filter(c => c.type === 'header');
    const existingHeaderNameByMapping = new Map(existingHeaderCols.map(c => [c.mapping.toLowerCase(), c.name]));
    for (const h of test.headers.filter(x => x.key.trim())) {
      const key = h.key.trim();
      const varMatch = h.value.match(/^\{\{([a-zA-Z0-9_]+)\}\}$/);
      const rememberedName = existingHeaderNameByMapping.get(key.toLowerCase());
      initial[key] = {
        enabled: rememberedName !== undefined || !!varMatch,
        name: rememberedName || varMatch?.[1] || toVariableName(key),
      };
    }
    return initial;
  });

  const bodyVariableCandidates = useMemo(() => {
    if (!test.body) return [] as string[];
    const found = new Set<string>();
    const re = /\{\{([a-zA-Z0-9_]+)\}\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(test.body)) !== null) {
      found.add(m[1]);
    }
    return Array.from(found);
  }, [test.body]);

  const [bodySelections, setBodySelections] = useState<Record<string, { enabled: boolean; name: string }>>(() => {
    const initial: Record<string, { enabled: boolean; name: string }> = {};
    const existingBodyCols = (existingDt?.columns ?? []).filter(c => c.type === 'body');
    const existingBodyNameByMapping = new Map(existingBodyCols.map(c => [c.mapping, c.name]));
    const placeholderKeys = new Set<string>();
    const re = /\{\{([a-zA-Z0-9_]+)\}\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(test.body ?? '')) !== null) {
      placeholderKeys.add(m[1]);
    }
    const combinedKeys = new Set<string>([
      ...placeholderKeys,
      ...existingBodyNameByMapping.keys(),
    ]);
    for (const key of combinedKeys) {
      const rememberedName = existingBodyNameByMapping.get(key);
      initial[key] = {
        enabled: rememberedName !== undefined || placeholderKeys.has(key),
        name: rememberedName || key,
      };
    }
    return initial;
  });

  const toggleSegment = (idx: number) => {
    setSelections(prev => ({
      ...prev,
      [idx]: { ...prev[idx], checked: !prev[idx].checked },
    }));
  };

  const setVarName = (idx: number, name: string) => {
    setSelections(prev => ({
      ...prev,
      [idx]: { ...prev[idx], name },
    }));
  };

  const setParamSelection = (key: string, patch: Partial<{ enabled: boolean; name: string }>) => {
    setParamSelections(prev => ({
      ...prev,
      [key]: { ...prev[key], ...patch },
    }));
  };

  const setHeaderSelection = (key: string, patch: Partial<{ enabled: boolean; name: string }>) => {
    setHeaderSelections(prev => ({
      ...prev,
      [key]: { ...prev[key], ...patch },
    }));
  };

  const setBodySelection = (key: string, patch: Partial<{ enabled: boolean; name: string }>) => {
    setBodySelections(prev => ({
      ...prev,
      [key]: { ...prev[key], ...patch },
    }));
  };

  const pathVars = Object.entries(selections)
    .filter(([, v]) => v.checked && v.name.trim())
    .map(([k, v]) => ({ segmentIndex: parseInt(k), variableName: v.name.trim() }));

  const pathParts = analysis.segments.map(seg => seg.segment);
  const previewParts = pathParts.map((seg, i) => {
    const sel = selections[i];
    if (sel?.checked && sel.name.trim()) return `{{${sel.name.trim()}}}`;
    return seg;
  });
  const previewUrl = `${analysis.origin}/${previewParts.join('/')}`;
  const autoUrlTemplate = `${previewUrl}${urlParams.length > 0 ? `?${urlParams.map(p => `${p.key}={{${p.key}}}`).join('&')}` : ''}`;
  const [urlTemplateInput, setUrlTemplateInput] = useState<string>(() => existingDt?.urlTemplate || autoUrlTemplate);
  const [isTemplateCustomized, setIsTemplateCustomized] = useState<boolean>(() => {
    if (!existingDt?.urlTemplate) return false;
    return existingDt.urlTemplate !== autoUrlTemplate;
  });
  const [workingAuth, setWorkingAuth] = useState<Scenario['auth']>(test.auth ?? { type: 'none' });

  useEffect(() => {
    if (!isTemplateCustomized) {
      setUrlTemplateInput(autoUrlTemplate);
    }
  }, [autoUrlTemplate, isTemplateCustomized]);

  const setWorkingAuthType = useCallback((type: Scenario['auth']['type']) => {
    setWorkingAuth({ type } as Scenario['auth']);
  }, []);

  const patchWorkingAuth = useCallback((patch: Partial<AuthConfig>) => {
    setWorkingAuth(prev => ({ ...prev, ...patch } as Scenario['auth']));
  }, []);

  // --- Step 2: column definitions ---
  const [columnDefs, setColumnDefs] = useState<ColumnDef[]>([]);
  const [showColOrder, setShowColOrder] = useState<false | 'step2'>(false);

  const enterStep2 = () => {
    const defs = buildConfiguredColumnDefs({
      mode,
      test,
      pathVars,
      urlParams,
      paramSelections,
      headerSelections,
      bodySelections,
    });
    setColumnDefs(defs);
    setStep('columns');
  };

  // --- Step 3 (parameterize mode): validate field selection ---
  const [sampleJson, setSampleJson] = useState(() => {
    if (test.validation.sampleJson) return test.validation.sampleJson;
    const hasRememberedValidate = (existingDt?.columns ?? []).some(c => c.type === 'validate');
    return hasRememberedValidate ? '{}' : '';
  });
  const [validateFields, setValidateFields] = useState<ExpectedField[]>(() => {
    const firstRow = existingDt?.rows.find(r => r.enabled) ?? existingDt?.rows[0];
    const remembered = (existingDt?.columns ?? [])
      .filter(c => c.type === 'validate')
      .map(col => ({
        jsonPath: col.mapping,
        expectedValue: firstRow?.values[col.id] ?? '',
      }));
    if (remembered.length > 0) return remembered;
    return test.validation.expectedFields ?? [];
  });
  const [validateExcluded, setValidateExcluded] = useState<string[]>([]);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<FetchErrorDetail | null>(null);
  const [arrayModes, setArrayModes] = useState<Record<string, 'ordered' | 'unordered'>>(existingDt?.arrayValidationMode ?? {});

  // Detect unique array prefixes from selected validate fields
  const arrayPrefixes = useMemo(() => {
    const prefixes = new Set<string>();
    for (const f of validateFields) {
      const match = f.jsonPath.match(/^(.+?\[\d+\])/);
      if (match) {
        prefixes.add(match[1].replace(/\[\d+\]/, '[*]'));
      }
    }
    return Array.from(prefixes).sort();
  }, [validateFields]);

  const handleFetchForValidate = useCallback(async () => {
    if (!test.url.trim()) return;
    setFetching(true);
    setFetchError(null);
    try {
      const baseHeaders: Record<string, string> = {};
      for (const h of test.headers) {
        if (!h.key.trim()) continue;
        baseHeaders[h.key.trim()] = h.value;
      }

      let result: HttpResponse;
      if (onFetchRow) {
        result = await onFetchRow(test.url, test.method, baseHeaders, test.body || undefined, workingAuth);
      } else {
        const headers = { ...baseHeaders };
        await applyAuthHeaders(workingAuth, headers);
        result = await proxyFetch(test.url, test.method, headers, test.body || undefined);
      }

      if (result.error) {
        setFetchError({ message: result.error, status: result.status || undefined, headers: result.headers, body: result.body || undefined });
        setFetching(false);
        return;
      }
      if (result.status >= 400) {
        setFetchError({ message: `HTTP ${result.status}: ${result.statusText}`, status: result.status, statusText: result.statusText, headers: result.headers, body: result.body || undefined });
        setFetching(false);
        return;
      }
      setSampleJson(result.body);
    } catch (err) {
      setFetchError({ message: err instanceof Error ? err.message : String(err) });
    }
    setFetching(false);
  }, [test, onFetchRow, workingAuth]);

  const enterStep3Validate = () => {
    setStep('validate');
  };

  // --- Step 4 (parameterize mode): review & create ---
  const [copyName, setCopyName] = useState(`${sourceName ?? test.name} (Parameterized)`);
  const [targetFgId, setTargetFgId] = useState(editingTest?.fgId ?? '');
  const [targetScenarioId, setTargetScenarioId] = useState(editingTest?.scenarioId ?? '');

  const targetFg = featureGroups?.find(fg => fg.id === targetFgId);
  const targetScenario = targetFg?.scenarios.find(sc => sc.id === targetScenarioId);

  const enterStep4Create = () => {
    // Merge validate fields into columnDefs
    const existingMappings = new Set(columnDefs.map(d => d.mapping));
    const newValidateDefs: ColumnDef[] = validateFields
      .filter(f => !existingMappings.has(f.jsonPath))
      .map(f => ({
        type: 'validate' as const,
        mapping: f.jsonPath,
        fullKey: `validate:${f.jsonPath}`,
        autoName: f.jsonPath.replace(/\./g, '_').replace(/\[(\d+)\]/g, '$1').replace(/[^a-zA-Z0-9_]/g, ''),
        customName: f.jsonPath.replace(/\./g, '_').replace(/\[(\d+)\]/g, '$1').replace(/[^a-zA-Z0-9_]/g, ''),
        sampleValue: f.expectedValue ?? '',
      }));
    if (newValidateDefs.length > 0) {
      setColumnDefs(prev => [...prev, ...newValidateDefs]);
    }
  };

  const updateColumnName = (idx: number, name: string) => {
    setColumnDefs(prev => prev.map((d, i) => i === idx ? { ...d, customName: name } : d));
  };

  const columnNamesValid = useMemo(() => {
    if (columnDefs.length === 0) return false;
    const names = columnDefs.map(d => d.customName.trim());
    if (names.some(n => !n)) return false;
    if (new Set(names).size !== names.length) return false;
    return true;
  }, [columnDefs]);

  const duplicateNames = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const d of columnDefs) {
      const n = d.customName.trim();
      counts[n] = (counts[n] || 0) + 1;
    }
    return new Set(Object.entries(counts).filter(([, c]) => c > 1).map(([n]) => n));
  }, [columnDefs]);

  // --- Actions ---

  // Auto-persist contract pattern changes on close (even without Apply)
  const handleClose = useCallback(() => {
    // If contract patterns changed and we have an existing data table, persist just that change
    const initial = initialContractRef.current;
    const changed = contractPatterns.size !== initial.size || [...contractPatterns].some(p => !initial.has(p));
    if (changed && existingDt) {
      const updatedDt = {
        ...existingDt,
        validationContract: contractPatterns.size > 0 ? Array.from(contractPatterns) : undefined,
      };
      onApply(updatedDt, existingDt.urlTemplate || test.url);
    }
    onClose();
  }, [contractPatterns, existingDt, onApply, onClose, test.url]);

  const handleApply = () => {
    const urlTemplate = buildUrlTemplate(urlTemplateInput, columnDefs, previewUrl, urlParams);
    const literalPathSegments = analyzeUrlPath(test.url).segments.map(seg => seg.segment);

    const defaultValueForColumn = (col: DataSourceColumn): string => {
      if (col.type === 'path') {
        const pv = pathVars.find(p => p.variableName === col.mapping);
        if (!pv) return '';
        const v = pathParts[pv.segmentIndex] || '';
        if (!isTemplateToken(v)) return v;
        const literal = literalPathSegments[pv.segmentIndex] || '';
        return isTemplateToken(literal) ? '' : literal;
      }
      if (col.type === 'param') {
        const v = urlParams.find(p => p.key === col.mapping)?.value ?? '';
        return isTemplateToken(v) ? '' : v;
      }
      return '';
    };

    // Convert columnDefs to DataTableColumns
    const columns: DataSourceColumn[] = columnDefs
      .filter(d => d.type !== 'name')
      .map(d => ({
        id: findExistingColId(d) || uuidv4(),
        name: d.customName.trim(),
        type: d.type as DataSourceColumn['type'],
        mapping: d.mapping,
      }));

    // Preserve existing rows or create one with pre-filled values
    let rows: DataSourceRow[];
    if (existingDt && existingDt.rows.length > 0) {
      // Migrate existing rows — keep values for columns that still exist
      rows = existingDt.rows.map((row, rowIdx) => {
        const values: Record<string, string> = {};
        for (const col of columns) {
          // Try to find value from existing row by matching old column id or mapping
          const oldCol = existingDt.columns.find(c => c.mapping === col.mapping && c.type === col.type)
            || existingDt.columns.find(c => c.type === col.type && c.name.trim().toLowerCase() === col.name.trim().toLowerCase());
          const currentRaw = oldCol ? row.values[oldCol.id] : '';
          const current = isTemplateToken(currentRaw || '') ? '' : (currentRaw || '');
          // Seed first row path/param values from URL when empty so configured variables resolve immediately.
          if (!current && rowIdx === 0 && (col.type === 'path' || col.type === 'param')) {
            values[col.id] = defaultValueForColumn(col);
          } else if (!current && !oldCol && rowIdx === 0) {
            values[col.id] = defaultValueForColumn(col);
          } else {
            values[col.id] = current || '';
          }
        }
        return { ...row, values };
      });
    } else {
      // Create first row pre-filled from test URL
      const values: Record<string, string> = {};
      // Try to parse sample response for validate column pre-population
      let sampleObj: unknown = null;
      if (test.validation.sampleJson) {
        try { sampleObj = JSON.parse(test.validation.sampleJson); } catch { /* ignore */ }
      }
      for (const col of columns) {
        if (col.type === 'path') {
          const pv = pathVars.find(p => p.variableName === col.mapping);
          values[col.id] = pv ? pathParts[pv.segmentIndex] || '' : '';
        } else if (col.type === 'param') {
          values[col.id] = urlParams.find(p => p.key === col.mapping)?.value ?? '';
        } else if (col.type === 'validate' && sampleObj) {
          values[col.id] = extractJsonPath(sampleObj, col.mapping);
        } else {
          values[col.id] = '';
        }
      }
      // Mark as sample if validate columns have data
      const hasValidate = columns.some(c => c.type === 'validate' && values[c.id]);
      rows = [{ id: uuidv4(), values, enabled: true, ...(hasValidate ? { isSample: true } : {}) }];
    }

    const dataTable: DataSource = {
      id: existingDt?.id || uuidv4(),
      columns,
      rows,
      source: existingDt?.source || { type: 'inline' },
      distribution: existingDt?.distribution || 'sequential',
      urlTemplate,
      validationContract: contractPatterns.size > 0 ? Array.from(contractPatterns) : undefined,
      arrayValidationMode: mode === 'parameterize'
        ? (Object.keys(arrayModes).length > 0 ? arrayModes : undefined)
        : existingDt?.arrayValidationMode,
      validationMode: mode === 'parameterize' ? validationMode : existingDt?.validationMode,
    };

    if (mode === 'parameterize') {
      onApply(dataTable, urlTemplate, { copyName: copyName.trim(), targetFgId, targetScenarioId, auth: workingAuth });
    } else {
      onApply(dataTable, urlTemplate, { auth: workingAuth });
    }
    onClose();
  };

  const handleExport = async () => {
    // Build dataRows from existing data table rows (keyed by mapping)
    let dataRows: { values: Record<string, string> }[] | undefined;
    if (existingDt && existingDt.rows.length > 0) {
      dataRows = existingDt.rows.map(row => {
        const values: Record<string, string> = {};
        for (const def of columnDefs) {
          if (def.type === 'name') {
            values[def.mapping] = row.label || test.name;
            values[def.customName] = row.label || test.name;
            continue;
          }
          // Find the existing column by type + mapping to get its ID
          const existingCol = existingDt.columns.find(c => c.type === def.type && c.mapping === def.mapping);
          const val = existingCol ? (row.values[existingCol.id] ?? '') : '';
          values[def.mapping] = val;
          values[def.customName] = val;
        }
        return { values };
      });
    }
    const wb = generateExcelTemplate({ test, pathVariables: pathVars, columnDefs, dataRows });
    const safeName = test.name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60) || 'template';
    await downloadExcel(wb, `${safeName}_template.xlsx`);
    onClose();
  };

  const findExistingColId = (def: ColumnDef): string | undefined => {
    if (!existingDt) return undefined;
    return existingDt.columns.find(c => c.type === def.type && c.mapping === def.mapping)?.id;
  };

  // --- Render ---
  const isParamMode = mode === 'parameterize';
  const stepLabels: { key: Step; label: string; num: number }[] = isParamMode
    ? [
        { key: 'variables', label: 'Detect Variables', num: 1 },
        { key: 'columns', label: 'Configure Columns', num: 2 },
        { key: 'validate', label: 'Validate Fields', num: 3 },
        { key: 'order', label: 'Column Order', num: 4 },
        { key: 'create', label: 'Review', num: 5 },
      ]
    : [
        { key: 'variables', label: 'Path Variables', num: 1 },
        { key: 'columns', label: 'Columns', num: 2 },
      ];

  const currentStepIdx = stepLabels.findIndex(s => s.key === step);
  const prevStep = currentStepIdx > 0 ? stepLabels[currentStepIdx - 1].key : null;
  const prevStepLabel = prevStep ? stepLabels.find(s => s.key === prevStep)?.label : null;
  const inputColumnsForReview = columnDefs.filter(d => d.type !== 'validate' && d.type !== 'name');
  const validateColumnsForReview = columnDefs.filter(d => d.type === 'validate');

  const reviewPathVariables = pathVars
    .map(p => ({
      variableName: p.variableName,
      sourceValue: pathParts[p.segmentIndex] ?? '',
    }))
    .sort((a, b) => a.variableName.localeCompare(b.variableName));

  const queryParamsForReview = columnDefs.filter(d => d.type === 'param');

  const validationModeLabel = validationMode === 'none'
    ? 'No Rows'
    : validationMode === 'full'
      ? 'All Rows'
      : 'Sample Rows Only';

  return (
    <FullPanelModal
      title={(
        <div>
          <h3>{isParamMode ? 'Create Parameterized Copy' : mode === 'export' ? 'Export Template' : 'Configure Data Source'}</h3>
          <span className="csv-export-subtitle">
            <span className={`method-badge method-${test.method.toLowerCase()}`}>{test.method}</span>
            {test.name}
          </span>
        </div>
      )}
      onClose={handleClose}
      footer={(
        <>
          {prevStep && (
            <button className="btn" onClick={() => setStep(prevStep)}>
              {prevStepLabel ? `Back: ${prevStepLabel}` : 'Back'}
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button className="btn" onClick={onClose}>Cancel</button>
          {step === 'variables' && (
            <button className="btn btn-primary" onClick={enterStep2}>
              Next: Columns
            </button>
          )}
          {step === 'columns' && !isParamMode && (
            <>
              {mode === 'export' && (
                <button className="btn btn-primary" onClick={handleExport} disabled={!columnNamesValid}>
                  Export .xlsx
                </button>
              )}
              <button className="btn btn-primary" onClick={handleApply} disabled={!columnNamesValid}>
                {mode === 'export' ? 'Apply & Close' : 'Apply to Data Source'}
              </button>
            </>
          )}
          {step === 'columns' && isParamMode && (
            <button className="btn btn-primary" onClick={enterStep3Validate} disabled={!columnNamesValid}>
              Next: Validate Fields
            </button>
          )}
          {step === 'validate' && isParamMode && (
            <button className="btn btn-primary" onClick={() => { enterStep4Create(); setStep('order'); }}>
              Next: Column Order
            </button>
          )}
          {step === 'order' && isParamMode && (
            <button className="btn btn-primary" onClick={() => setStep('create')}>
              Next: Review
            </button>
          )}
          {step === 'create' && isParamMode && (
            <button className="btn btn-primary" onClick={handleApply} disabled={!columnNamesValid || !copyName.trim()}>
              Create & Open
            </button>
          )}
        </>
      )}
    >
      <div className="excel-steps-bar">
        {stepLabels.map((s, i) => (
          <div key={s.key} className={`excel-step-indicator ${step === s.key ? 'active' : ''} ${stepLabels.findIndex(x => x.key === step) > i ? 'done' : ''}`}>
            <span className="excel-step-num">{s.num}</span>
            <span className="excel-step-label">{s.label}</span>
          </div>
        ))}
      </div>

      <div className="csv-export-body">
        {/* ==================== Step 1: Path Variables ==================== */}
        {step === 'variables' && (
          <SetupStepVariables
            analysis={analysis}
            selections={selections}
            toggleSegment={toggleSegment}
            setVarName={setVarName}
            autoUrlTemplate={autoUrlTemplate}
            urlTemplateInput={urlTemplateInput}
            setUrlTemplateInput={setUrlTemplateInput}
            isTemplateCustomized={isTemplateCustomized}
            setIsTemplateCustomized={setIsTemplateCustomized}
            urlParams={urlParams}
            paramSelections={paramSelections}
            setParamSelection={setParamSelection}
            headerCandidates={headerCandidates}
            headerSelections={headerSelections}
            setHeaderSelection={setHeaderSelection}
            bodyVariableCandidates={bodyVariableCandidates}
            bodySelections={bodySelections}
            setBodySelection={setBodySelection}
            workingAuth={workingAuth}
            setWorkingAuthType={setWorkingAuthType}
            patchWorkingAuth={patchWorkingAuth}
            test={test}
          />
        )}

        {/* ==================== Step 2: Columns ==================== */}
        {step === 'columns' && (
          <div className="excel-step-content excel-step-columns">
            <div className="step-columns-header">
              <div>
                <div className="csv-panel-title">Configure Columns</div>
                <div className="csv-panel-desc" style={{ marginBottom: 0 }}>
                  These become the data source columns. Edit names as needed. Names must be unique.
                </div>
              </div>
              <div className="step-columns-stats">
                {columnDefs.filter(d => d.type === 'path').length > 0 && <span className="step-col-stat step-col-stat-path">{columnDefs.filter(d => d.type === 'path').length} path</span>}
                {columnDefs.filter(d => d.type === 'param').length > 0 && <span className="step-col-stat step-col-stat-param">{columnDefs.filter(d => d.type === 'param').length} param</span>}
                {columnDefs.filter(d => d.type === 'validate').length > 0 && <span className="step-col-stat step-col-stat-validate">{columnDefs.filter(d => d.type === 'validate').length} validate</span>}
                <span className="step-col-stat-total">{columnDefs.length} total</span>
              </div>
            </div>
            {/* Column ordering controls */}
            {columnDefs.length > 1 && (
              <div className="excel-col-order-controls" style={{ position: 'relative' }}>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setShowColOrder(v => v === 'step2' ? false : 'step2')}
                >
                  ↕ Column Order
                </button>
                {showColOrder === 'step2' && (
                  <ColumnOrderPopover
                    items={columnDefs.map((d, i) => ({ ...d, name: d.customName, _idx: i }))}
                    onApply={(reordered) => {
                      setColumnDefs(reordered.map(r => {
                        const { name: _n, _idx, ...rest } = r as ColumnDef & { _idx: number; name: string };
                        return rest as unknown as ColumnDef;
                      }));
                    }}
                    onClose={() => setShowColOrder(false)}
                  />
                )}
              </div>
            )}
            <div className="excel-col-table-wrap">
              <table className="excel-col-table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>#</th>
                    <th>Type</th>
                    <th>Mapping</th>
                    <th>Column Name</th>
                    <th style={{ width: 36 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {columnDefs.map((d, i) => {
                    const isDup = duplicateNames.has(d.customName.trim());
                    const isEmpty = !d.customName.trim();
                    const hasError = isDup || isEmpty;
                    // Determine if this validate column is part of a dynamic contract
                    const fieldPattern = d.type === 'validate' && d.mapping.match(/\[\d+\]/)
                      ? d.mapping.replace(/\[\d+\]/g, '[*]')
                      : null;
                    const isDynamic = fieldPattern ? contractPatterns.has(fieldPattern) : false;
                    return (
                      <tr key={i} className={hasError ? 'excel-col-row-error' : ''}>
                        <td className="excel-col-num">{i + 1}</td>
                        <td>
                          <span className={`excel-col-type-badge type-${d.type}`}>{d.type}</span>
                        </td>
                        <td className="excel-col-path">
                          <code>{d.mapping}</code>
                          {isDynamic && <span className="excel-col-dynamic-badge" title="Dynamic array — columns expand automatically based on API response length. Click to make fixed." onClick={() => { const next = new Set(contractPatterns); next.delete(fieldPattern!); setContractPatterns(next); }}>dynamic</span>}
                          {fieldPattern && !isDynamic && <button type="button" className="excel-col-fixed-badge" title="Fixed array index — click to make dynamic (auto-expand based on API response)" onClick={() => { const next = new Set(contractPatterns); next.add(fieldPattern); setContractPatterns(next); }}>fixed → dynamic?</button>}
                        </td>
                        <td>
                          <input
                            type="text"
                            className={`excel-col-input ${hasError ? 'input-error' : ''}`}
                            value={d.customName}
                            onChange={(e) => updateColumnName(i, e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                          />
                          {isDup && <span className="excel-col-err">duplicate</span>}
                          {isEmpty && <span className="excel-col-err">required</span>}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="excel-col-delete-btn"
                            title="Remove column"
                            onClick={() => setColumnDefs(prev => prev.filter((_, idx) => idx !== i))}
                          >×</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ==================== Step 3: Validate Fields (parameterize mode) ==================== */}
        {step === 'validate' && isParamMode && (
          <SetupStepValidate
            validationMode={validationMode}
            setValidationMode={setValidationMode}
            validateFields={validateFields}
            setValidateFields={setValidateFields}
            validateExcluded={validateExcluded}
            setValidateExcluded={setValidateExcluded}
            sampleJson={sampleJson}
            setSampleJson={setSampleJson}
            handleFetchForValidate={handleFetchForValidate}
            fetching={fetching}
            fetchError={fetchError}
            arrayPrefixes={arrayPrefixes}
            arrayModes={arrayModes}
            setArrayModes={setArrayModes}
            test={test}
          />
        )}

        {/* ==================== Step 4: Column Order (parameterize mode) ==================== */}
        {step === 'order' && isParamMode && (
          <div className="excel-step-content parameterize-order-step">
            <div className="parameterize-order-header">
              <div>
                <div className="csv-panel-title">Column Order</div>
                <div className="csv-panel-desc">
                  Drag columns to reorder. This determines the column layout in the data source table.
                </div>
              </div>
              <div className="parameterize-order-stats">
                <span className="parameterize-order-stat">{columnDefs.filter(d => d.type !== 'validate').length} input</span>
                <span className="parameterize-order-stat parameterize-order-stat-validate">{columnDefs.filter(d => d.type === 'validate').length} validate</span>
                <span className="parameterize-order-stat-total">{columnDefs.length} total</span>
              </div>
            </div>
            <div className="parameterize-order-inline">
              <ColumnOrderPopover
                items={columnDefs.map((d, i) => ({ ...d, name: d.customName, _idx: i }))}
                onApply={(reordered) => {
                  setColumnDefs(reordered.map(r => {
                    const { name: _n, _idx, ...rest } = r as ColumnDef & { _idx: number; name: string };
                    return rest as unknown as ColumnDef;
                  }));
                }}
                onClose={() => {/* no-op: inline, not a popover */}}
                autoApply
              />
            </div>
          </div>
        )}

        {/* ==================== Step 5: Review & Create (parameterize mode) ==================== */}
        {step === 'create' && isParamMode && (
          <SetupStepReview
            copyName={copyName}
            setCopyName={setCopyName}
            featureGroups={featureGroups}
            targetFgId={targetFgId}
            setTargetFgId={setTargetFgId}
            targetScenarioId={targetScenarioId}
            setTargetScenarioId={setTargetScenarioId}
            targetFg={targetFg}
            targetScenario={targetScenario}
            workingAuth={workingAuth}
            validationModeLabel={validationModeLabel}
            validateFieldCount={validateFields.length}
            reviewPathVariables={reviewPathVariables}
            queryParamsForReview={queryParamsForReview}
            inputColumnsForReview={inputColumnsForReview}
            validateColumnsForReview={validateColumnsForReview}
            buildUrlTemplate={() => buildUrlTemplate(urlTemplateInput, columnDefs, previewUrl, urlParams)}
            arrayPrefixes={arrayPrefixes}
            arrayModes={arrayModes}
            testName={test.name}
            columnDefs={columnDefs}
          />
        )}
      </div>
    </FullPanelModal>
  );
}
