/**
 * State and logic for the DataSourceSetupModal wizard.
 *
 * Extracted from DataSourceSetupModal.tsx to keep the component thin (JSX only).
 * All wizard state, computed values, and action handlers live here.
 */
import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { FetchErrorDetail } from '@shared/components/data-mapper/types';
import type {
  Scenario, DataSource, DataSourceColumn, DataSourceRow,
  FeatureGroup, ExpectedField, AuthConfig,
} from '@shared/types';
import type { HttpResponse } from '@shared/utils/httpClient';
import type { TestEditingContext } from '../components/TestEditorModal';
import {
  analyzeUrlPath,
  generateExcelTemplate,
  downloadExcel,
  parseUrl,
} from '../utils/csvTemplate';
import type { ColumnDef } from '../utils/csvTemplate';
import { proxyFetch } from '../../../engine/executor';
import { applyAuthHeaders } from '@shared/utils/applyAuthHeaders';
import { extractJsonPath } from '../utils/dataSourceImport';
import {
  toVariableName,
  getTemplateSegments,
  parseTemplateParamVariables,
  buildConfiguredColumnDefs,
  buildUrlTemplate,
} from '../utils/dataSourceSetupUtils';
import { isTemplateToken } from '@shared/utils/templateHelpers';
import { toErrorMessage } from '@shared/utils/helpers';
import type { SetupMode } from '../utils/dataSourceSetupUtils';

// ─── Public types ────────────────────────────────────────────────────────────

export type { SetupMode };

export type Step = 'variables' | 'columns' | 'validate' | 'order' | 'create';

export interface DataSourceSetupProps {
  test: Scenario;
  mode: SetupMode;
  onApply: (
    dataTable: DataSource,
    urlTemplate: string,
    parameterizeOptions?: {
      copyName?: string;
      targetFgId?: string;
      targetScenarioId?: string;
      newScenarioName?: string;
      auth?: Scenario['auth'];
    },
  ) => void;
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

// ─── Internal helpers ─────────────────────────────────────────────────────────

function patchSelectionRecord(
  prev: Record<string, { enabled: boolean; name: string }>,
  key: string,
  patch: Partial<{ enabled: boolean; name: string }>,
): Record<string, { enabled: boolean; name: string }> {
  return { ...prev, [key]: { ...prev[key], ...patch } };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDataSourceSetupState({
  test, mode, onApply, onClose, onFetchRow, featureGroups, editingTest, sourceName,
}: DataSourceSetupProps) {
  const existingDt = test.dataSource;
  const analysisUrl = existingDt?.urlTemplate || test.url;
  const analysis = useMemo(() => analyzeUrlPath(analysisUrl), [analysisUrl]);
  const { params: urlParams } = useMemo(() => parseUrl(test.url), [test.url]);

  const [step, setStep] = useState<Step>('variables');

  // ── Validation mode ──────────────────────────────────────────────────────────
  const [validationMode, setValidationMode] = useState<'none' | 'selective' | 'full'>(
    existingDt?.validationMode ?? 'selective',
  );

  // ── Validation contract patterns ─────────────────────────────────────────────
  const [contractPatterns, setContractPatterns] = useState<Set<string>>(
    () => new Set(existingDt?.validationContract ?? []),
  );
  const initialContractRef = useRef<Set<string>>(new Set(existingDt?.validationContract ?? []));

  // ── Step 1: path segment selections ──────────────────────────────────────────
  const [selections, setSelections] = useState<Record<number, { checked: boolean; name: string }>>(() => {
    const init: Record<number, { checked: boolean; name: string }> = {};
    const existingPathCols = existingDt?.columns.filter(c => c.type === 'path') ?? [];
    const existingPathNames = new Set(existingPathCols.map(c => c.mapping));
    for (const seg of analysis.segments) {
      const matchesExisting = existingPathCols.some(c =>
        seg.segment === `{{${c.mapping}}}` || seg.variableName === c.mapping,
      );
      const templateSegments = getTemplateSegments(existingDt?.urlTemplate);
      const templateMatch = templateSegments[seg.index]?.match(/^\{\{(\w+)\}\}$/);
      const segmentIsPlaceholder = seg.segment.match(/^\{\{(\w+)\}\}$/);
      const isChecked = matchesExisting || !!templateMatch || !!segmentIsPlaceholder;
      const name =
        templateMatch?.[1] ||
        segmentIsPlaceholder?.[1] ||
        (matchesExisting
          ? [...existingPathNames].find(n => seg.variableName === n || seg.segment === `{{${n}}}`)
          : '') ||
        (seg.suggestedVariable ? seg.variableName : '');
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
        enabled: hasRememberedParamColumns ? (rememberedName !== undefined || !!templateName) : true,
        name: rememberedName || templateName || p.key,
      };
    }
    return initial;
  });

  const headerCandidates = useMemo(
    () =>
      test.headers
        .filter(h => h.key.trim())
        .map(h => {
          const varMatch = h.value.match(/^\{\{([a-zA-Z0-9_]+)\}\}$/);
          return {
            key: h.key.trim(),
            value: h.value,
            suggestedName: varMatch?.[1] || toVariableName(h.key),
            suggestedEnabled: !!varMatch,
          };
        }),
    [test.headers],
  );

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
    while ((m = re.exec(test.body)) !== null) found.add(m[1]);
    return Array.from(found);
  }, [test.body]);

  const [bodySelections, setBodySelections] = useState<Record<string, { enabled: boolean; name: string }>>(() => {
    const initial: Record<string, { enabled: boolean; name: string }> = {};
    const existingBodyCols = (existingDt?.columns ?? []).filter(c => c.type === 'body');
    const existingBodyNameByMapping = new Map(existingBodyCols.map(c => [c.mapping, c.name]));
    const placeholderKeys = new Set<string>();
    const re = /\{\{([a-zA-Z0-9_]+)\}\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(test.body ?? '')) !== null) placeholderKeys.add(m[1]);
    const combinedKeys = new Set<string>([...placeholderKeys, ...existingBodyNameByMapping.keys()]);
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
    setSelections(prev => ({ ...prev, [idx]: { ...prev[idx], checked: !prev[idx].checked } }));
  };
  const setVarName = (idx: number, name: string) => {
    setSelections(prev => ({ ...prev, [idx]: { ...prev[idx], name } }));
  };
  const setParamSelection = (key: string, patch: Partial<{ enabled: boolean; name: string }>) => {
    setParamSelections(prev => patchSelectionRecord(prev, key, patch));
  };
  const setHeaderSelection = (key: string, patch: Partial<{ enabled: boolean; name: string }>) => {
    setHeaderSelections(prev => patchSelectionRecord(prev, key, patch));
  };
  const setBodySelection = (key: string, patch: Partial<{ enabled: boolean; name: string }>) => {
    setBodySelections(prev => patchSelectionRecord(prev, key, patch));
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
    if (!isTemplateCustomized) setUrlTemplateInput(autoUrlTemplate);
  }, [autoUrlTemplate, isTemplateCustomized]);

  const setWorkingAuthType = useCallback((type: Scenario['auth']['type']) => {
    setWorkingAuth({ type } as Scenario['auth']);
  }, []);
  const patchWorkingAuth = useCallback((patch: Partial<AuthConfig>) => {
    setWorkingAuth(prev => ({ ...prev, ...patch } as Scenario['auth']));
  }, []);

  // ── Step 2: column definitions ───────────────────────────────────────────────
  const [columnDefs, setColumnDefs] = useState<ColumnDef[]>([]);
  const [showColOrder, setShowColOrder] = useState<false | 'step2'>(false);

  const enterStep2 = () => {
    const defs = buildConfiguredColumnDefs({
      mode, test, pathVars, urlParams, paramSelections, headerSelections, bodySelections,
    });
    setColumnDefs(defs);
    setStep('columns');
  };

  const updateColumnName = (idx: number, name: string) => {
    setColumnDefs(prev => prev.map((d, i) => (i === idx ? { ...d, customName: name } : d)));
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

  // ── Step 3: validate field selection ─────────────────────────────────────────
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
  const [arrayModes, setArrayModes] = useState<Record<string, 'ordered' | 'unordered'>>(
    existingDt?.arrayValidationMode ?? {},
  );

  const arrayPrefixes = useMemo(() => {
    const prefixes = new Set<string>();
    for (const f of validateFields) {
      const match = f.jsonPath.match(/^(.+?\[\d+\])/);
      if (match) prefixes.add(match[1].replace(/\[\d+\]/, '[*]'));
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
      setFetchError({ message: toErrorMessage(err) });
    }
    setFetching(false);
  }, [test, onFetchRow, workingAuth]);

  const enterStep3Validate = () => setStep('validate');

  // ── Step 4/5: review & create (parameterize mode) ────────────────────────────
  const [copyName, setCopyName] = useState(`${sourceName ?? test.name} (Parameterized)`);
  const [targetFgId, setTargetFgId] = useState(editingTest?.fgId ?? '');
  const [targetScenarioId, setTargetScenarioId] = useState('__new__');
  const [newScenarioName, setNewScenarioName] = useState('Parameterized Tests');

  const targetFg = featureGroups?.find(fg => fg.id === targetFgId);
  const targetScenario = targetFg?.scenarios.find(sc => sc.id === targetScenarioId);

  const enterStep4Create = () => {
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

  // ── Render helpers ────────────────────────────────────────────────────────────
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
    .map(p => ({ variableName: p.variableName, sourceValue: pathParts[p.segmentIndex] ?? '' }))
    .sort((a, b) => a.variableName.localeCompare(b.variableName));
  const queryParamsForReview = columnDefs.filter(d => d.type === 'param');
  const validationModeLabel =
    validationMode === 'none' ? 'No Rows' : validationMode === 'full' ? 'All Rows' : 'Sample Rows Only';
  const getReviewUrlTemplate = useCallback(
    () => buildUrlTemplate(urlTemplateInput, columnDefs, previewUrl, urlParams),
    [urlTemplateInput, columnDefs, previewUrl, urlParams],
  );

  // ── Actions ───────────────────────────────────────────────────────────────────

  const handleClose = useCallback(() => {
    const initial = initialContractRef.current;
    const changed =
      contractPatterns.size !== initial.size || [...contractPatterns].some(p => !initial.has(p));
    if (changed && existingDt) {
      const updatedDt: DataSource = {
        ...existingDt,
        validationContract: contractPatterns.size > 0 ? Array.from(contractPatterns) : undefined,
      };
      onApply(updatedDt, existingDt.urlTemplate || test.url);
    }
    onClose();
  }, [contractPatterns, existingDt, onApply, onClose, test.url]);

  const findExistingColId = (def: ColumnDef): string | undefined =>
    existingDt?.columns.find(c => c.type === def.type && c.mapping === def.mapping)?.id;

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

    const columns: DataSourceColumn[] = columnDefs
      .filter(d => d.type !== 'name')
      .map(d => ({
        id: findExistingColId(d) || uuidv4(),
        name: d.customName.trim(),
        type: d.type as DataSourceColumn['type'],
        mapping: d.mapping,
      }));

    let rows: DataSourceRow[];
    if (existingDt && existingDt.rows.length > 0) {
      rows = existingDt.rows.map((row, rowIdx) => {
        const values: Record<string, string> = {};
        for (const col of columns) {
          const oldCol =
            existingDt.columns.find(c => c.mapping === col.mapping && c.type === col.type) ||
            existingDt.columns.find(
              c => c.type === col.type && c.name.trim().toLowerCase() === col.name.trim().toLowerCase(),
            );
          const currentRaw = oldCol ? row.values[oldCol.id] : '';
          const current = isTemplateToken(currentRaw || '') ? '' : currentRaw || '';
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
      const values: Record<string, string> = {};
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
      const hasValidate = columns.some(c => c.type === 'validate' && values[c.id]);
      const hasRequestValues = columns.some(
        (c) => c.type !== 'validate' && String(values[c.id] ?? '').trim() !== '',
      );
      rows = [{
        id: uuidv4(),
        values,
        // Blank starter rows stay unchecked until the user fills values.
        enabled: hasRequestValues || hasValidate,
        ...(hasValidate ? { isSample: true } : {}),
      }];
    }

    const dataTable: DataSource = {
      id: existingDt?.id || uuidv4(),
      columns,
      rows,
      source: existingDt?.source || { type: 'inline' },
      distribution: existingDt?.distribution || 'sequential',
      urlTemplate,
      validationContract: contractPatterns.size > 0 ? Array.from(contractPatterns) : undefined,
      arrayValidationMode:
        mode === 'parameterize'
          ? Object.keys(arrayModes).length > 0 ? arrayModes : undefined
          : existingDt?.arrayValidationMode,
      validationMode: mode === 'parameterize' ? validationMode : existingDt?.validationMode,
    };

    if (mode === 'parameterize') {
      onApply(dataTable, urlTemplate, {
        copyName: copyName.trim(),
        targetFgId,
        targetScenarioId: targetScenarioId === '__new__' ? undefined : targetScenarioId,
        newScenarioName:
          targetScenarioId === '__new__' ? newScenarioName.trim() || 'Parameterized Tests' : undefined,
        auth: workingAuth,
      });
    } else {
      onApply(dataTable, urlTemplate, { auth: workingAuth });
    }
    onClose();
  };

  const handleExport = async () => {
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
          const existingCol = existingDt.columns.find(
            c => c.type === def.type && c.mapping === def.mapping,
          );
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

  // ─────────────────────────────────────────────────────────────────────────────

  return {
    // Step navigation
    step, setStep,
    stepLabels, currentStepIdx, prevStep, prevStepLabel, isParamMode,
    // Step 1
    analysis, urlParams, pathVars, pathParts,
    selections, toggleSegment, setVarName,
    paramSelections, setParamSelection,
    headerCandidates,
    headerSelections, setHeaderSelection,
    bodyVariableCandidates,
    bodySelections, setBodySelection,
    autoUrlTemplate, urlTemplateInput, setUrlTemplateInput,
    isTemplateCustomized, setIsTemplateCustomized,
    workingAuth, setWorkingAuthType, patchWorkingAuth,
    enterStep2,
    // Step 2
    columnDefs, setColumnDefs, updateColumnName,
    columnNamesValid, duplicateNames,
    showColOrder, setShowColOrder,
    contractPatterns, setContractPatterns,
    // Step 3
    validationMode, setValidationMode,
    validateFields, setValidateFields,
    validateExcluded, setValidateExcluded,
    sampleJson, setSampleJson,
    fetching, fetchError,
    arrayPrefixes, arrayModes, setArrayModes,
    handleFetchForValidate,
    enterStep3Validate,
    // Step 4/5
    copyName, setCopyName,
    targetFgId, setTargetFgId,
    targetFg, targetScenario,
    targetScenarioId, setTargetScenarioId,
    newScenarioName, setNewScenarioName,
    enterStep4Create,
    // Review
    inputColumnsForReview, validateColumnsForReview,
    reviewPathVariables, queryParamsForReview,
    validationModeLabel, getReviewUrlTemplate,
    // Actions
    handleClose, handleApply, handleExport,
  };
}
