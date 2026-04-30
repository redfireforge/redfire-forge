import { v4 as uuidv4 } from 'uuid';
import type { TestScenario, FeatureGroup, Scenario } from '../../../shared/types';

export interface VersionExportOptions {
  includeResponseVersions: boolean;
  includeRulesVersions: boolean;
}

export const DEFAULT_VERSION_EXPORT: VersionExportOptions = {
  includeResponseVersions: true,
  includeRulesVersions: true,
};

/** Strip version arrays from a single Scenario based on options. */
function stripTestVersions(test: Scenario, opts: VersionExportOptions): Scenario {
  if (opts.includeResponseVersions && opts.includeRulesVersions) return test;
  const validation = { ...test.validation };
  if (!opts.includeResponseVersions) delete validation.responseVersions;
  if (!opts.includeRulesVersions) delete validation.rulesVersions;
  return { ...test, validation };
}

/** Strip version arrays from scenarios. */
function stripScenarioVersions(scenarios: TestScenario[], opts: VersionExportOptions): TestScenario[] {
  return scenarios.map((sc) => ({
    ...sc,
    tests: sc.tests.map((t) => stripTestVersions(t, opts)),
  }));
}

/**
 * Strip response/rules version arrays from exported data at any level.
 * Handles FeatureGroup[], FeatureGroup, TestScenario[], TestScenario, Scenario.
 */
export function stripVersions(data: unknown, opts: VersionExportOptions): unknown {
  if (opts.includeResponseVersions && opts.includeRulesVersions) return data;

  // Single Scenario (test)
  if (data && typeof data === 'object' && 'url' in data && 'method' in data && 'validation' in data) {
    return stripTestVersions(data as Scenario, opts);
  }
  // Single TestScenario
  if (data && typeof data === 'object' && 'tests' in data && Array.isArray((data as TestScenario).tests) && !('scenarios' in data)) {
    const sc = data as TestScenario;
    return { ...sc, tests: sc.tests.map((t) => stripTestVersions(t, opts)) };
  }
  // Single FeatureGroup
  if (data && typeof data === 'object' && 'scenarios' in data && Array.isArray((data as FeatureGroup).scenarios)) {
    const fg = data as FeatureGroup;
    return { ...fg, scenarios: stripScenarioVersions(fg.scenarios, opts) };
  }
  // Array of FeatureGroups or TestScenarios
  if (Array.isArray(data)) {
    return data.map((item) => stripVersions(item, opts));
  }
  return data;
}

/** Count how many tests have version data in the given data structure. */
export function countVersions(data: unknown): { responseVersionCount: number; rulesVersionCount: number } {
  let responseVersionCount = 0;
  let rulesVersionCount = 0;

  function walkTest(t: Scenario) {
    if (t.validation?.responseVersions?.length) responseVersionCount += t.validation.responseVersions.length;
    if (t.validation?.rulesVersions?.length) rulesVersionCount += t.validation.rulesVersions.length;
  }
  function walkScenarios(scenarios: TestScenario[]) {
    for (const sc of scenarios) sc.tests.forEach(walkTest);
  }

  if (data && typeof data === 'object' && 'url' in data && 'method' in data && 'validation' in data) {
    walkTest(data as Scenario);
  } else if (data && typeof data === 'object' && 'tests' in data && Array.isArray((data as TestScenario).tests) && !('scenarios' in data)) {
    (data as TestScenario).tests.forEach(walkTest);
  } else if (data && typeof data === 'object' && 'scenarios' in data && Array.isArray((data as FeatureGroup).scenarios)) {
    walkScenarios((data as FeatureGroup).scenarios);
  } else if (Array.isArray(data)) {
    for (const item of data) {
      const c = countVersions(item);
      responseVersionCount += c.responseVersionCount;
      rulesVersionCount += c.rulesVersionCount;
    }
  }

  return { responseVersionCount, rulesVersionCount };
}

/** Returns true if data contains any response or rules version entries. */
export function hasVersionData(data: unknown): boolean {
  const c = countVersions(data);
  return c.responseVersionCount > 0 || c.rulesVersionCount > 0;
}

export function reIdScenarios(scenarios: TestScenario[]): TestScenario[] {
  return scenarios.map((sc) => ({ ...sc, id: uuidv4(), tests: sc.tests.map((t) => ({ ...t, id: uuidv4() })) }));
}

export interface ScenarioExportWrap {
  _exportMeta: {
    microservice?: string;
    environment?: string;
    exportedAt: string;
    level: string;
    includesResponseVersions?: boolean;
    includesRulesVersions?: boolean;
  };
  data: unknown;
}

export function wrapExport(
  data: unknown,
  level: string,
  opts: { microservice?: string; environment?: string },
  versionOpts?: VersionExportOptions,
): ScenarioExportWrap {
  const effectiveOpts = versionOpts ?? DEFAULT_VERSION_EXPORT;
  const stripped = stripVersions(data, effectiveOpts);
  return {
    _exportMeta: {
      microservice: opts.microservice,
      environment: opts.environment,
      exportedAt: new Date().toISOString(),
      level,
      includesResponseVersions: effectiveOpts.includeResponseVersions,
      includesRulesVersions: effectiveOpts.includeRulesVersions,
    },
    data: stripped,
  };
}

export interface UnwrapResult {
  data: unknown;
  meta?: ScenarioExportWrap['_exportMeta'];
}

export function unwrapImport(raw: unknown): unknown {
  if (raw && typeof raw === 'object' && '_exportMeta' in raw && 'data' in raw) {
    return (raw as { data: unknown }).data;
  }
  return raw;
}

export function unwrapImportWithMeta(raw: unknown): UnwrapResult {
  if (raw && typeof raw === 'object' && '_exportMeta' in raw && 'data' in raw) {
    const wrap = raw as ScenarioExportWrap;
    return { data: wrap.data, meta: wrap._exportMeta };
  }
  return { data: raw };
}

export function pickJsonFile(onLoad: (data: unknown) => void, onError?: (msg: string) => void): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        onLoad(JSON.parse(ev.target?.result as string));
      } catch { onError?.('Failed to parse JSON file.'); }
    };
    reader.readAsText(file);
  };
  input.click();
}
