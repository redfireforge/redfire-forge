import { useEffect } from 'react';
import { flushSync } from 'react-dom';
import type { UseGrpcStudioAdvancedFeaturesReturn } from '../hooks/useGrpcStudioAdvancedFeatures';
import type { UseGrpcStudioReturn } from '../hooks/useGrpcStudio';
import { createDefaultProtoIngestState } from '../grpcStudioTypes';
import { syncGrpcTabTransportMode } from '@shared/grpc/grpcTransportTabRouting';

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
      // Abort leftover browser-direct Send (gRPC-Web → :50051 = ERR_INVALID_HTTP_RESPONSE;
      // gRPC-Web → :50055 with wrong content-type = 415) before flipping transport.
      void studio.cancelUnaryCall?.(tabId);
      void studio.cancelStreamCall?.(tabId);
      // flushSync so sessionRef used by Reflect/Send sees plaintext + Express
      // before the next action. Leftover gRPC-Web against :50051 yields
      // net::ERR_INVALID_HTTP_RESPONSE; leftover Envoy target yields HTTP 415.
      // Also reset target off TLS/mTLS demo ports (:50443/:50444) — a reused
      // "demo" tab that still points at those with Plaintext makes Reflect → 503
      // during lesson setup/hygiene (before the intentional plaintext-fail step).
      flushSync(() => {
        studio.updateTab(tabId, {
          connectionId: undefined,
          target: 'localhost:50051',
          tlsMode: 'disabled',
          tlsConfig: undefined,
          auth: { type: 'none' },
          metadata: {},
          transportMode: 'express',
          grpcurlExportContext: undefined,
        });
      });
      syncGrpcTabTransportMode(tabId, 'express');
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
