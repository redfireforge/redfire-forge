import { useEffect } from 'react';
import type { UseGrpcStudioAdvancedFeaturesReturn } from '../hooks/useGrpcStudioAdvancedFeatures';
import type { UseGrpcStudioReturn } from '../hooks/useGrpcStudio';
import { createDefaultProtoIngestState } from '../grpcStudioTypes';

export function useGrpcStudioPageDemoBridges(
  studio: UseGrpcStudioReturn,
  advancedFeatures: UseGrpcStudioAdvancedFeaturesReturn,
) {
  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__demoPatchGrpcActiveTab = (patch: { grpcurlExportContext?: import('../utils/grpcGrpcurlTypes').GrpcGrpcurlExportContext }) => {
      const tabId = studio.activeTab?.id;
      if (!tabId) return false;
      studio.updateTab(tabId, patch);
      return true;
    };
    w.__demoResetGrpcActiveTab = () => {
      const tabId = studio.activeTab?.id;
      if (!tabId) return false;
      studio.updateTab(tabId, {
        connectionId: undefined,
        tlsMode: 'disabled',
        tlsConfig: undefined,
        auth: { type: 'none' },
        metadata: {},
        grpcurlExportContext: undefined,
      });
      return true;
    };
    /**
     * Quietly wipe Manage Schemas draft inputs (proto/protoset/url/bsr) on the
     * active tab without opening the modal — avoids setup-time UI flash.
     */
    w.__demoResetGrpcManageSchemasDrafts = () => {
      const tabId = studio.activeTab?.id;
      if (!tabId) return false;
      studio.patchTabDescriptor(tabId, {
        protoIngest: createDefaultProtoIngestState(),
      });
      return true;
    };
    w.__demoGetGrpcActiveDescriptorKey = () => {
      const key = (studio.activeTabDescriptor.descriptor?.key ?? studio.activeTab?.descriptorKey ?? '').trim();
      return key || null;
    };
    return () => {
      delete w.__demoPatchGrpcActiveTab;
      delete w.__demoResetGrpcActiveTab;
      delete w.__demoResetGrpcManageSchemasDrafts;
      delete w.__demoGetGrpcActiveDescriptorKey;
    };
  }, [studio]);

  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__demoPatchGrpcSchemaDiffReport = (input: {
      report: import('../../../shared/grpc/grpcSchemaDiffContracts').GrpcSchemaDiffReport;
      baselineCapturedAt?: string;
    }) => {
      const descriptor = studio.activeTabDescriptor.descriptor;
      if (!descriptor) return false;
      advancedFeatures.applySchemaDiffComparison({
        baselineDescriptor: descriptor,
        report: input.report,
        baselineCapturedAt: input.baselineCapturedAt,
      });
      return true;
    };
    return () => {
      delete w.__demoPatchGrpcSchemaDiffReport;
    };
  }, [studio, advancedFeatures]);
}
