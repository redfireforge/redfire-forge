import type { Scenario, BodyType, KeyValue, AuthConfig, ValidationMode, SelectiveMode, DataSourceColumn } from '@shared/types';

// ---------------------------------------------------------------------------
// Column prefixes for CSV headers
// ---------------------------------------------------------------------------
export const PARAM_PREFIX = 'param:';
export const PATH_PREFIX = 'path:';
export const VALIDATE_PREFIX = 'validate:';
export const META_LINE_PREFIX = '#META:';

// ---------------------------------------------------------------------------
// Template metadata — stored as a JSON comment line at top of CSV
// ---------------------------------------------------------------------------

export interface TemplateMetadata {
  version: 1;
  method: string;
  urlPattern: string;
  headers: KeyValue[];
  body: string;
  bodyType?: BodyType;
  bodyForm?: KeyValue[];
  auth: AuthConfig;
  validationMode: ValidationMode;
  selectiveMode?: SelectiveMode;
  unorderedArrays?: boolean;
  excludedPaths?: string[];
  expectedJson?: string;
  pathVariables: string[];
}

export interface PathSegmentChoice {
  index: number;
  segment: string;
  suggestedVariable: boolean;
  variableName: string;
}

export interface ExportOptions {
  test: Scenario;
  pathVariables: { segmentIndex: number; variableName: string }[];
}

export interface ColumnDef {
  type: 'name' | 'path' | 'param' | 'validate';
  fullKey: string;      // e.g. "path:vin", "validate:$.offers[0].offerName"
  mapping: string;      // e.g. "vin", "channel", "$.offers[0].offerName"
  autoName: string;     // auto-generated short header
  customName: string;   // user-editable (defaults to autoName)
}

export interface ExcelExportOptions {
  test: Scenario;
  pathVariables: { segmentIndex: number; variableName: string }[];
  columnDefs: ColumnDef[];
  /** If provided, export these rows instead of a single sample row derived from the test. */
  dataRows?: { values: Record<string, string> }[];
}

export interface ParsedRow {
  rowIndex: number;
  scenario: Scenario | null;
  errors: string[];
  raw: Record<string, string>;
}

export interface CsvParseResult {
  rows: ParsedRow[];
  columns: string[];
  totalRows: number;
  validRows: number;
  errorRows: number;
  meta: TemplateMetadata | null;
  fileErrors: string[];
  warnings: string[];
  /** Column name → type mapping (from metadata). Available for Excel imports. */
  columnTypes?: Map<string, { type: string; mapping: string }>;
  /** Dynamic validation contract patterns (e.g. ["offers[*].code"]) */
  validationContract?: string[];
  /** Per-array validation mode for dynamic arrays */
  arrayValidationMode?: Record<string, 'ordered' | 'unordered'>;
}

// ---------------------------------------------------------------------------
// Formal parameterized test JSON schema
// ---------------------------------------------------------------------------

/** Row in a ParameterizedTestJson file */
export interface ParameterizedTestJsonRow {
  /** Column id → value */
  values: Record<string, string>;
  /** Optional user-provided row label */
  label?: string;
  /** Whether this row is enabled */
  enabled: boolean;
  /** Tags for categorization */
  tags?: string[];
  /** Optional note */
  note?: string;
  /** Whether this row is a sample row */
  isSample?: boolean;
}

/** Top-level structure for parameterized test JSON export/import */
export interface ParameterizedTestJson {
  version: 2;
  /** Column definitions */
  columns: DataSourceColumn[];
  /** Data rows with full metadata */
  rows: ParameterizedTestJsonRow[];
  /** URL template with {{variable}} placeholders */
  urlTemplate?: string;
  /** Validation contract patterns */
  validationContract?: string[];
  /** Per-array validation mode */
  arrayValidationMode?: Record<string, 'ordered' | 'unordered'>;
  /** Validation mode: none, selective, or full */
  validationMode?: 'none' | 'selective' | 'full';
}

export interface ExcelMeta {
  version: number;
  method: string;
  urlPattern: string;
  body: string;
  bodyType?: BodyType;
  bodyForm?: KeyValue[];
  auth: AuthConfig;
  validationMode: ValidationMode;
  selectiveMode: SelectiveMode;
  unorderedArrays: boolean;
  excludedPaths: string[];
  expectedJson: string;
  headers: KeyValue[];
  columnMap: Map<string, { type: string; mapping: string }>;
  /** Dynamic validation contract patterns (e.g. ["offers[*].code", "offers[*].name"]) */
  validationContract?: string[];
  /** Per-array validation mode for dynamic arrays */
  arrayValidationMode?: Record<string, 'ordered' | 'unordered'>;
}
