export { default as DataMapper } from './DataMapper';
export { default as BodyBuilderPanel } from './BodyBuilderPanel';
export type { BodyBuilderMode, BodyBuilderPanelProps } from './BodyBuilderPanel';
export { default as DataMapperModal } from './DataMapperModal';
export { default as RegexAssertionBuilderModal } from './RegexAssertionBuilderModal';
export { default as SourcePanel } from './SourcePanel';
export { default as TargetPanel } from './TargetPanel';
export { default as SourceTreeNode } from './SourceTreeNode';
export { default as TargetTreeNode } from './TargetTreeNode';
export { default as MappingCanvas } from './MappingCanvas';
export { default as MapperToolbar } from './MapperToolbar';
export { default as ExpressionEditorModal } from './ExpressionEditorModal';
export { default as PreviewBar } from './PreviewBar';
export { default as CodeView } from './CodeView';
export { useKeyboardNavigation } from './hooks/useKeyboardNavigation';
export type { FocusRegion, UseKeyboardNavigationOptions, UseKeyboardNavigationReturn } from './hooks/useKeyboardNavigation';
export { useMapperState } from './hooks/useMapperState';
export { useBodyBuilderSync } from './hooks/useBodyBuilderSync';
export type { UseBodyBuilderSyncOptions, UseBodyBuilderSyncReturn } from './hooks/useBodyBuilderSync';
export { useConnectionLines, useLayoutTick } from './hooks/useConnectionLines';
export { computeAutoMapCandidates, candidatesToMappings, normalizeFieldName } from './utils/autoMapAlgorithm';
export { serializeMappings, deserializeMappings, validateMappings, roundTripMappings } from './utils/mappingSerializer';
export { evaluateMapperExpression, resolveMapperPath, buildMapperResolveVariable, formatExpressionResult } from './utils/mapperExpressionEvaluator';
export { computePreview } from './utils/previewCompute';
export { loadProfiles, saveProfile, deleteProfile, renameProfile, getProfileById } from './utils/mappingProfiles';
export type { MappingProfile } from './utils/mappingProfiles';
export { findSourceForRef, hasUnsafePathSegment } from './utils/bodyMappingShared';
export { createSyncState, syncFromTemplate, syncFromVisual, resolveConflict, diffTemplateRefs, applyTemplateDiff, mappingsEqual } from './utils/bodyTemplateSync';
export type { BodySyncState, SyncResult, SyncOrigin, BodySyncOptions } from './utils/bodyTemplateSync';
export { detectTypeMismatches, getMismatchForMapping, inferType, typesCompatible, looksLikeDate } from './utils/typeMismatch';
export type { TypeMismatch, MismatchSeverity } from './utils/typeMismatch';
export { captureSchemaSnapshot, captureSnapshotPair, collectFieldEntries, loadSnapshot, saveSnapshot, deleteSnapshot } from './utils/schemaSnapshot';
export type { SchemaSnapshot, SchemaSnapshotPair, SchemaFieldEntry } from './utils/schemaSnapshot';
export { diffSchemas, findAffectedMappings, summarizeDrift, formatDriftMessage, classifyDrift, summarizeClassifiedDrift } from './utils/schemaDrift';
export type { SchemaDrift, DriftType, DriftSummary, DriftSeverity, ClassifiedDrift, ClassifiedDriftSummary } from './utils/schemaDrift';
export { default as DriftBanner } from './DriftBanner';
export { default as SchemaDiffModal } from './SchemaDiffModal';
export type { DriftIndicator } from './SourceTreeNode';
export type { TraceValueOverlay } from './types';
export { levenshtein, suggestRepairs, generateRepairResults, applyRepair } from './utils/schemaRepair';
export type { RepairStrategy, RepairSuggestion, RepairResult } from './utils/schemaRepair';
export { captureMappingTraces, shouldCaptureMappingTraces, summarizeMappingTraces, formatTraceValue, isTraceError } from './utils/mappingTrace';
export { debugExpression } from './utils/expressionStepDebugger';
export type { EvalStep, StepDebugResult } from './utils/expressionStepDebugger';
export type { ErrorDetailData } from './MappingCanvas';
export type { MappingTrace, MappingTraceOptions, MappingTraceSummary } from './utils/mappingTrace';
export { compareTraces, formatComparisonValue } from './utils/traceComparison';
export type { TraceComparisonEntry, TraceComparisonResult, TraceComparisonSummary, ComparisonStatus } from './utils/traceComparison';
export { default as MappingCompare } from './MappingCompare';
export type { MappingCompareProps } from './MappingCompare';
export { exportMappingTraces, importMappingTraces, extractAllMappingTraces } from './utils/traceExportImport';
export type { ExportedMappingTraces, ContextualMappingTrace } from './utils/traceExportImport';
export { validateContract, contractViolationsToFailures, loadContractConfig, saveContractConfig } from './utils/schemaContract';
export type { SchemaContractConfig, ContractViolation } from './utils/schemaContract';
export { detectArrayMappings, classifyArrayMapping, inferArrayElementType, isArrayWildcardPath, generateForEachExpression } from './utils/arrayMapping';
export { mapperGallerySamples } from './utils/gallerySamples';
export type { MapperGallerySample } from './utils/gallerySamples';
export type { ArrayMappingKind, ArrayMappingInfo } from './utils/arrayMapping';
export { createDemoAdapter } from './adapters/demoAdapter';
export { createExtractionAdapter, splitExtractions } from './adapters/extractionAdapter';
export type { ExtractionAdapterOptions } from './adapters/extractionAdapter';
// createAssertionAdapter is API-only (not used in production UI — see assertionAdapter.ts JSDoc)
export type { AssertionAdapterOptions, AssertionAdapterResult } from './adapters/assertionAdapter';
export { createValidationAdapter } from './adapters/validationAdapter';
export type { ValidationAdapterOptions, ValidationAdapterOutput } from './adapters/validationAdapter';
export { createPopulateFromApiAdapter } from './adapters/populateFromApiAdapter';
export type { PopulateFromApiAdapterOptions, PopulateOutput } from './adapters/populateFromApiAdapter';
export { createColumnMappingAdapter, parseScenarioTemplate } from './adapters/columnMappingAdapter';
export type { ColumnMappingAdapterOptions, ColumnMappingOutput, TemplatePlaceholder } from './adapters/columnMappingAdapter';
export { createSharedDsFetchAdapter } from './adapters/sharedDsFetchAdapter';
export type { SharedDsFetchAdapterOptions, SharedDsFetchOutput } from './adapters/sharedDsFetchAdapter';
export { createWebhookExtractionAdapter } from './adapters/webhookExtractionAdapter';
export type { WebhookExtractionAdapterOptions, WebhookExtractionOutput } from './adapters/webhookExtractionAdapter';
export { createVariableBindingAdapter, extractTemplateRefs, collectTemplateSlots } from './adapters/variableBindingAdapter';
export type { VariableBindingAdapterOptions, VariableBinding, VariableHintInput, TemplateSlot } from './adapters/variableBindingAdapter';
export { createRequestBodyAdapter, extractBodyTemplateRefs, parseBodyJson, collectBodyLeafPaths, buildBodyFromMappings } from './adapters/requestBodyAdapter';
export type { RequestBodyAdapterOptions, VariableHintForBody, BodySchemaField } from './adapters/requestBodyAdapter';
export type {
  Mapping,
  MapperAdapter,
  MapperSource,
  MapperTarget,
  MapperState,
  MapperAction,
  TargetField,
  FieldConstraint,
  ValidationIssue,
  ExpressionFunction,
  AdapterCategory,
  AdapterCapabilities,
  FieldOperator,
  SourceFormat,
  ValidationSeverity,
  FetchErrorDetail,
} from './types';
export { defaultCapabilities, resolveCapabilities, MapperFetchError } from './types';
export { default as MappingHealthDashboard } from './MappingHealthDashboard';
export { computeHealthStats } from './utils/healthStats';
export type { HealthStats } from './utils/healthStats';
