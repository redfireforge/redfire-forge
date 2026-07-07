import { readFileSync } from 'node:fs';
import type { CoverageMapData } from 'istanbul-lib-coverage';
import { computeCoverageMetrics } from './coverageGateUtils';

type CoverageGap = {
  file: string;
  stmts: number;
  branches: number;
  funcs: number;
  lines: number;
  min: number;
};

type CoverageGateConfig = {
  inputPath: string;
  threshold: number;
  includePathFragment: string;
  successMessage: string;
  failureHeadline: (count: number) => string;
  pathFormatter: (file: string) => string;
  isExcluded: (file: string) => boolean;
  readErrorHint?: string;
};

function readCoverageMap(config: CoverageGateConfig): Record<string, CoverageMapData> {
  try {
    return JSON.parse(readFileSync(config.inputPath, 'utf8')) as Record<string, CoverageMapData>;
  } catch (error) {
    if (!config.readErrorHint) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ Could not read ${config.inputPath}:`, message);
    console.error(`   Run: ${config.readErrorHint}`);
    process.exit(1);
  }
}

function findCoverageGaps(raw: Record<string, CoverageMapData>, config: CoverageGateConfig): CoverageGap[] {
  const gaps: CoverageGap[] = [];

  for (const [file, cov] of Object.entries(raw)) {
    if (!file.includes(config.includePathFragment)) continue;
    if (config.isExcluded(file)) continue;

    const metrics = computeCoverageMetrics(cov);
    const min = Math.min(metrics.stmts, metrics.branches, metrics.funcs, metrics.lines);
    if (min < config.threshold) {
      gaps.push({
        file: config.pathFormatter(file),
        ...metrics,
        min,
      });
    }
  }

  gaps.sort((a, b) => a.min - b.min);
  return gaps;
}

export function runCoverageGate(config: CoverageGateConfig): void {
  const raw = readCoverageMap(config);
  const gaps = findCoverageGaps(raw, config);

  if (gaps.length === 0) {
    console.log(config.successMessage);
    process.exit(0);
  }

  console.error(config.failureHeadline(gaps.length));
  for (const gap of gaps) {
    console.error(
      `   ${gap.file} | stmts=${gap.stmts.toFixed(1)}% branches=${gap.branches.toFixed(1)}% `
      + `funcs=${gap.funcs.toFixed(1)}% lines=${gap.lines.toFixed(1)}%`,
    );
  }
  process.exit(1);
}