/**
 * Core types for the Data Mapper component.
 *
 * The Data Mapper is a reusable visual mapping surface that connects
 * source fields to target fields. It uses an adapter pattern so every
 * integration point (HTTP extraction, webhook, Slack, email, AI, etc.)
 * only needs to implement MapperAdapter without touching the core.
 */

// ─── Mapping ──────────────────────────────────────────────

export interface Mapping {
  id: string;
  sourcePath: string;
  sourceId: string;
  targetPath: string;
  expression?: string;
  isAutoMapped?: boolean;
  isPending?: boolean;
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

export interface TargetField {
  path: string;
  label: string;
  type?: string;
  required?: boolean;
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
  validate?: (mappings: Mapping[]) => ValidationIssue[];
  customFunctions?: ExpressionFunction[];
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
