/**
 * Core types for the Data Mapper component.
 *
 * The Data Mapper is a reusable visual mapping surface that connects
 * source fields to target fields. It uses an adapter pattern so every
 * integration point (HTTP extraction, webhook, Slack, email, AI, etc.)
 * only needs to implement MapperAdapter without touching the core.
 */

// ─── Field Operators ─────────────────────────────────────

export type FieldOperator =
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'greater_than_or_equal'
  | 'less_than'
  | 'less_than_or_equal'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'regex'
  | 'is_true'
  | 'is_false'
  | 'is_null'
  | 'is_not_null'
  | 'is_empty'
  | 'is_not_empty'
  | 'exists'
  | 'not_exists'
  | 'is_type'
  | 'in'
  | 'not_in'
  | 'between'
  | 'close_to';

// ─── Mapping ──────────────────────────────────────────────

export interface Mapping {
  id: string;
  sourcePath: string;
  sourceId: string;
  targetPath: string;
  expression?: string;
  isAutoMapped?: boolean;
  isPending?: boolean;
  operator?: FieldOperator;
  operatorValue?: string;
  condition?: string;
  fallback?: string;
}

// ─── Validation ───────────────────────────────────────────

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  mappingId?: string;
  targetPath?: string;
  severity: ValidationSeverity;
  message: string;
}

// ─── Expression Functions ─────────────────────────────────

// Re-export the canonical ExpressionFunction type from the workflow engine.
// Adapter `customFunctions` use the same shape so they plug directly into the evaluator.
import type { ExpressionFunction } from '../../../features/workflow/utils/expressionFunctions/types';
export type { ExpressionFunction };

// ─── Source & Target ──────────────────────────────────────

export type SourceFormat = 'json' | 'xml' | 'csv' | 'protobuf' | 'graphql';

export interface MapperSource {
  id: string;
  label: string;
  icon?: string;
  sampleData?: unknown;
  format?: SourceFormat;
  supportsLiveFetch?: boolean;
  fieldDescriptions?: Record<string, string>;
}

export type TargetFieldOrigin = 'adapter' | 'custom' | 'fetched';
export type TargetFieldLocation = 'path' | 'query' | 'header' | 'body' | 'bodyForm';

export interface TargetField {
  path: string;
  label: string;
  type?: string;
  required?: boolean;
  origin?: TargetFieldOrigin;
  location?: TargetFieldLocation;
  defaultValue?: string;
}

export interface FieldConstraint {
  type?: string | string[];
  required?: boolean;
  maxLength?: number;
  pattern?: string;
}

export interface MapperTarget {
  label: string;
  sampleData?: unknown;
  fields?: TargetField[];
  allowCustomFields: boolean;
  fieldConstraints?: Record<string, FieldConstraint>;
}

// ─── Target Schema Result ────────────────────────────────

export interface TargetSchemaResult {
  sampleData?: unknown;
  fields?: TargetField[];
  label?: string;
}

// ─── Adapter Capabilities ─────────────────────────────────

export interface AdapterCapabilities {
  /** Show operator pills on target nodes (validation, assertion contexts) */
  operators?: boolean;
  /** Show array assertion rows below array nodes */
  arrayAssertions?: boolean;
  /** Show type-check operator pills */
  typeChecks?: boolean;
  /** Enable code editor tab in bottom dock */
  codeEditor?: boolean;
  /** Enable verify-all toolbar cluster */
  verification?: boolean;
  /** Enable expression editor on mappings */
  expressions?: boolean;
  /** Enable schema drift/repair detection */
  schemaDrift?: boolean;
  /** Enable mapping profiles (save/load presets) */
  profiles?: boolean;
  /** Show unordered array matching option */
  unorderedArrays?: boolean;
  /** Hide advanced toolbar section by default */
  hideAdvanced?: boolean;
  /** Future: enable conditional mapping logic */
  conditionals?: boolean;
  /** Future: enable loop/iterate constructs */
  loopConstructs?: boolean;
  /** Future: enable error handling / fallback paths */
  errorHandling?: boolean;
}

export function defaultCapabilities(): AdapterCapabilities {
  return {
    operators: false,
    arrayAssertions: false,
    typeChecks: false,
    codeEditor: false,
    verification: false,
    expressions: true,
    schemaDrift: false,
    profiles: false,
    unorderedArrays: false,
    hideAdvanced: false,
    conditionals: false,
    loopConstructs: false,
    errorHandling: false,
  };
}

export function resolveCapabilities(caps?: AdapterCapabilities): Required<AdapterCapabilities> {
  const defaults = defaultCapabilities();
  if (!caps) return defaults as Required<AdapterCapabilities>;
  return { ...defaults, ...caps } as Required<AdapterCapabilities>;
}

// ─── Adapter ──────────────────────────────────────────────

export type AdapterCategory =
  | 'http' | 'webhook' | 'data-source' | 'workflow'
  | 'messaging' | 'ai' | 'database' | 'file' | 'custom';

export interface MapperAdapter<TOutput = unknown> {
  contextId: string;
  title: string;
  category?: AdapterCategory;
  sources: MapperSource[];
  target: MapperTarget;
  serialize(mappings: Mapping[]): TOutput;
  deserialize(existing: TOutput): Mapping[];
  fetchSampleData?: () => Promise<unknown>;
  fetchTargetSchema?: () => Promise<TargetSchemaResult>;
  validate?: (mappings: Mapping[]) => ValidationIssue[];
  customFunctions?: ExpressionFunction[];
  capabilities?: AdapterCapabilities;
}

// ─── State ────────────────────────────────────────────────

export interface MapperState {
  mappings: Mapping[];
  selectedMappingId: string | null;
  activeSourceId: string;
  sourceSampleOverrides: Record<string, unknown>;
}

export type MapperAction =
  | { type: 'ADD_MAPPING'; mapping: Mapping }
  | { type: 'REMOVE_MAPPING'; id: string }
  | { type: 'REMOVE_MAPPINGS'; ids: string[] }
  | { type: 'UPDATE_MAPPING'; id: string; changes: Partial<Omit<Mapping, 'id'>> }
  | { type: 'SET_MAPPINGS'; mappings: Mapping[] }
  | { type: 'CLEAR_ALL' }
  | { type: 'SELECT_MAPPING'; id: string | null }
  | { type: 'SET_ACTIVE_SOURCE'; sourceId: string }
  | { type: 'SET_SOURCE_SAMPLE'; sourceId: string; data: unknown }
  | { type: 'ACCEPT_PENDING'; id: string }
  | { type: 'REJECT_PENDING'; id: string }
  | { type: 'ACCEPT_ALL_PENDING' }
  | { type: 'REJECT_ALL_PENDING' };

// ─── Trace Overlay (Phase 9B) ─────────────────────────────

export interface TraceValueOverlay {
  value: string;
  isError: boolean;
}
