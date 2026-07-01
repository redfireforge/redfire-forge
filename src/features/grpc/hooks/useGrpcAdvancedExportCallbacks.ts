import { useCallback } from 'react';
import type { GrpcTabAdvancedFeaturesUiState } from '../grpcStudioAdvancedTypes';
import {
  serializeGrpcLoadTestRunSummaryExportSafeCsv,
  serializeGrpcLoadTestRunSummaryExportSafeJson,
  serializeGrpcSchemaDiffReportExportSafeJson,
  serializeGrpcSchemaDiffReportExportSafeMarkdown,
} from '../../../shared/grpc/grpcAdvancedFeatureExport';
import { serializeGrpcMockRuleSetExportSafeJson } from '../../../shared/grpc/grpcMockRuleSetExport';
import { parseGrpcMockRuleSetJson } from '../utils/grpcStudioAdvancedModel';

export function useGrpcAdvancedExportCallbacks(
  activeState: GrpcTabAdvancedFeaturesUiState,
  setAdvancedExportError: (error: string | undefined) => void,
) {
  const exportLoadTestJson = useCallback((): string | undefined => {
    try {
      setAdvancedExportError(undefined);
      const summary = activeState.loadTest.lastSummary;
      const sourceMetadata = activeState.loadTest.lastExportSource;
      if (!summary || !sourceMetadata) {
        return undefined;
      }
      return serializeGrpcLoadTestRunSummaryExportSafeJson(summary, sourceMetadata);
    } catch (error) {
      setAdvancedExportError(error instanceof Error ? error.message : 'Export blocked for safety');
      return undefined;
    }
  }, [activeState.loadTest.lastSummary, activeState.loadTest.lastExportSource, setAdvancedExportError]);

  const exportLoadTestCsv = useCallback((): string | undefined => {
    try {
      setAdvancedExportError(undefined);
      const summary = activeState.loadTest.lastSummary;
      const sourceMetadata = activeState.loadTest.lastExportSource;
      if (!summary || !sourceMetadata) {
        return undefined;
      }
      return serializeGrpcLoadTestRunSummaryExportSafeCsv(summary, sourceMetadata);
    } catch (error) {
      setAdvancedExportError(error instanceof Error ? error.message : 'Export blocked for safety');
      return undefined;
    }
  }, [activeState.loadTest.lastSummary, activeState.loadTest.lastExportSource, setAdvancedExportError]);

  const exportSchemaDiffJson = useCallback((): string | undefined => {
    try {
      setAdvancedExportError(undefined);
      const report = activeState.schemaDiff.lastReport;
      if (!report) {
        return undefined;
      }
      return serializeGrpcSchemaDiffReportExportSafeJson(report, {
        baselineCapturedAt: activeState.schemaDiff.baselineCapturedAt,
      });
    } catch (error) {
      setAdvancedExportError(error instanceof Error ? error.message : 'Export blocked for safety');
      return undefined;
    }
  }, [activeState.schemaDiff.lastReport, activeState.schemaDiff.baselineCapturedAt, setAdvancedExportError]);

  const exportSchemaDiffMarkdown = useCallback((): string | undefined => {
    try {
      setAdvancedExportError(undefined);
      const report = activeState.schemaDiff.lastReport;
      if (!report) {
        return undefined;
      }
      return serializeGrpcSchemaDiffReportExportSafeMarkdown(report, {
        baselineCapturedAt: activeState.schemaDiff.baselineCapturedAt,
      });
    } catch (error) {
      setAdvancedExportError(error instanceof Error ? error.message : 'Export blocked for safety');
      return undefined;
    }
  }, [activeState.schemaDiff.lastReport, activeState.schemaDiff.baselineCapturedAt, setAdvancedExportError]);

  const exportMockRulesJson = useCallback((): string | undefined => {
    try {
      setAdvancedExportError(undefined);
      const parsed = parseGrpcMockRuleSetJson(activeState.mockServer.rulesJson);
      if (!parsed.ok) {
        setAdvancedExportError(parsed.error);
        return undefined;
      }
      return serializeGrpcMockRuleSetExportSafeJson(parsed.ruleSet);
    } catch (error) {
      setAdvancedExportError(error instanceof Error ? error.message : 'Export blocked for safety');
      return undefined;
    }
  }, [activeState.mockServer.rulesJson, setAdvancedExportError]);

  const clearAdvancedExportError = useCallback(() => {
    setAdvancedExportError(undefined);
  }, [setAdvancedExportError]);

  return {
    exportLoadTestJson,
    exportLoadTestCsv,
    exportSchemaDiffJson,
    exportSchemaDiffMarkdown,
    exportMockRulesJson,
    clearAdvancedExportError,
  };
}
