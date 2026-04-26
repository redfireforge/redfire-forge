import { v4 as uuidv4 } from 'uuid';
import type { TestScenario } from '../../../shared/types';

export function reIdScenarios(scenarios: TestScenario[]): TestScenario[] {
  return scenarios.map((sc) => ({ ...sc, id: uuidv4(), tests: sc.tests.map((t) => ({ ...t, id: uuidv4() })) }));
}

export interface ScenarioExportWrap {
  _exportMeta: {
    microservice?: string;
    environment?: string;
    exportedAt: string;
    level: string;
  };
  data: unknown;
}

export function wrapExport(
  data: unknown,
  level: string,
  opts: { microservice?: string; environment?: string },
): ScenarioExportWrap {
  return {
    _exportMeta: {
      microservice: opts.microservice,
      environment: opts.environment,
      exportedAt: new Date().toISOString(),
      level,
    },
    data,
  };
}

export function unwrapImport(raw: unknown): unknown {
  if (raw && typeof raw === 'object' && '_exportMeta' in raw && 'data' in raw) {
    return (raw as { data: unknown }).data;
  }
  return raw;
}

export function pickJsonFile(onLoad: (data: unknown) => void): void {
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
      } catch { alert('Failed to parse JSON file.'); }
    };
    reader.readAsText(file);
  };
  input.click();
}
