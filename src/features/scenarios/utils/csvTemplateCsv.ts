import Papa from 'papaparse';
import { saveFile } from '../../../shared/utils/fileSaver';
import {
  type TemplateMetadata,
  type ExportOptions,
  type ParsedRow,
  type CsvParseResult,
  META_LINE_PREFIX,
} from './csvTemplateTypes';
import { buildTemplateMetaAndSample, buildScenarioFromRow } from './csvTemplateShared';

export function generateCsvTemplate(opts: ExportOptions): string {
  const { meta, sampleRow, columns } = buildTemplateMetaAndSample(opts);

  const csvData = Papa.unparse({ fields: columns, data: [sampleRow] });
  const metaLine = `${META_LINE_PREFIX}${JSON.stringify(meta)}`;

  return `${metaLine}\n${csvData}`;
}

export async function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  await saveFile(blob, { filename, mimeType: 'text/csv', description: 'CSV file' });
}

export function parseCsvToScenarios(csvText: string): CsvParseResult {
  const lines = csvText.split('\n');
  let meta: TemplateMetadata | null = null;
  let csvBody = csvText;

  // Extract metadata line if present
  if (lines[0]?.startsWith(META_LINE_PREFIX)) {
    try {
      meta = JSON.parse(lines[0].slice(META_LINE_PREFIX.length));
    } catch { /* ignore parse error */ }
    csvBody = lines.slice(1).join('\n');
  }

  const parsed = Papa.parse<Record<string, string>>(csvBody, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim(),
  });

  const columns = parsed.meta.fields ?? [];
  const rows: ParsedRow[] = [];
  let validRows = 0;
  let errorRows = 0;

  for (let i = 0; i < parsed.data.length; i++) {
    const raw = parsed.data[i];
    const { scenario, errors } = buildScenarioFromRow(raw, { columns, meta });

    if (scenario) {
      validRows++;
      rows.push({ rowIndex: i + 1, scenario, errors: [], raw });
    } else {
      errorRows++;
      rows.push({ rowIndex: i + 1, scenario: null, errors, raw });
    }
  }

  return {
    rows,
    columns,
    totalRows: parsed.data.length,
    validRows,
    errorRows,
    meta,
    fileErrors: [],
    warnings: [],
  };
}
