# Quality Sweep Split Report

Generated: Wed Jul  8 19:20:02 EDT 2026

## Counts
- Source files changed (status): 103
- Files with non-whitespace deltas: 86

## Functional/Logic-Impact Files (confirmed)
- src/features/grpc/components/GrpcSchemaDiffPanel.tsx
- src/styles/grpc-studio.css
- src/features/grpc/components/GrpcCallPanel.tsx
- src/features/grpc/GrpcStudioPage.tsx
- src/features/grpc/components/GrpcProtoHybridNavigator.tsx
- src/features/grpc/components/GrpcProtoHybridNavigator.test.tsx
- src/features/grpc/components/grpcProtoHybridNavigatorPaths.ts
- packages/demo-hub/src/lessons/protocols/grpc-grpcurl.ts

## Broad Mechanical Quality Sweep Candidates
- Remaining changed .ts/.tsx/.css files are treated as mechanical quality updates (eslint --fix pass) pending line-by-line review.

## Changed Source Files
e2e/grpc-helpers.ts
e2e/grpc-selector-guard.spec.ts
e2e/grpc-studio-go-mock-servicer.spec.ts
packages/demo-hub/src/adapters/bridgeWindow.ts
packages/demo-hub/src/adapters/grpcStudioAdapter.test.ts
packages/demo-hub/src/adapters/grpcStudioAdapter.ts
packages/demo-hub/src/adapters/workflowDesignerAdapter.test.ts
packages/demo-hub/src/adapters/workflowDesignerAdapter.ts
packages/demo-hub/src/ConceptSlide.tsx
packages/demo-hub/src/demo-components.test.tsx
packages/demo-hub/src/lessons/protocols/grpc-env-collections.ts
packages/demo-hub/src/lessons/protocols/grpc-first-call.ts
packages/demo-hub/src/lessons/protocols/grpc-grpcurl.ts
packages/demo-hub/src/lessons/protocols/grpc-lesson-contract/coverage-gaps.test.ts
packages/demo-hub/src/lessons/protocols/grpc-lesson-contract/roster.ts
packages/demo-hub/src/lessons/protocols/grpc-lesson-contract/runtime/session.test.ts
packages/demo-hub/src/lessons/protocols/grpc-lesson-contract/runtime/snapshots.ts
packages/demo-hub/src/lessons/protocols/grpc-lesson-contract/shell.test.ts
packages/demo-hub/src/lessons/protocols/grpc-lesson-contract/types.ts
packages/demo-hub/src/lessons/protocols/grpc-lesson-contract/validate.test.ts
packages/demo-hub/src/lessons/protocols/grpc-lesson-contract/validate.ts
packages/demo-hub/src/lessons/protocols/grpc-lesson-helpers.ts
packages/demo-hub/src/lessons/protocols/grpc-lessons.ts
packages/demo-hub/src/lessons/protocols/grpc-load-testing.ts
packages/demo-hub/src/lessons/protocols/grpc-metadata-auth.coverage-gaps.test.ts
packages/demo-hub/src/lessons/protocols/grpc-metadata-auth.ts
packages/demo-hub/src/lessons/protocols/grpc-mock-server.ts
packages/demo-hub/src/lessons/protocols/grpc-proto-form.ts
packages/demo-hub/src/lessons/protocols/grpc-schema-diff.ts
packages/demo-hub/src/lessons/protocols/grpc-schema-discovery.coverage-gaps.test.ts
packages/demo-hub/src/lessons/protocols/grpc-spring-boot.ts
packages/demo-hub/src/lessons/protocols/grpc-tauri-desktop.ts
packages/demo-hub/src/lessons/protocols/grpc-tls.ts
packages/demo-hub/src/lessons/protocols/grpc-transport-modes.ts
packages/demo-hub/src/lessons/protocols/grpc-workflow-integration.ts
packages/demo-hub/src/LiveDemo.tsx
packages/demo-hub/src/useDemoHub.test.ts
packages/demo-hub/src/useDemoHub.ts
packages/demo-hub/src/useLiveDemoPanelLayout.test.ts
packages/demo-hub/src/useLiveDemoPanelLayout.ts
packages/demo-hub/src/utils/checkEndpoint.test.ts
packages/demo-hub/src/utils/checkEndpoint.ts
packages/demo-hub/src/utils/endpointLabel.test.ts
packages/demo-hub/src/utils/endpointLabel.ts
src-server/webhook-server.test.ts
src-server/webhook-server.ts
src/app/hooks/demoWorkflowBridges.coverage.test.ts
src/app/hooks/useDemoWorkflowRunBridge.test.ts
src/app/hooks/useDemoWorkflowRunBridge.ts
src/features/grpc/components/GrpcAdvancedPanels.coverage-gaps.test.tsx
src/features/grpc/components/GrpcCallPanel.coverage-gaps.test.tsx
src/features/grpc/components/GrpcCallPanel.hybrid.test.tsx
src/features/grpc/components/GrpcCallPanel.test.tsx
src/features/grpc/components/GrpcCallPanel.tsx
src/features/grpc/components/GrpcCompressionPanel.tsx
src/features/grpc/components/GrpcGrpcurlImportModal.tsx
src/features/grpc/components/GrpcMockRuleBuilderPanel.coverage-gaps.test.tsx
src/features/grpc/components/GrpcMockRuleBuilderPanel.tsx
src/features/grpc/components/GrpcMockServerPanel.coverage-gaps.test.tsx
src/features/grpc/components/GrpcMockServerPanel.tsx
src/features/grpc/components/GrpcProtoHybridEditorModal.test.tsx
src/features/grpc/components/GrpcProtoHybridNavigator.test.tsx
src/features/grpc/components/GrpcProtoHybridNavigator.tsx
src/features/grpc/components/GrpcSchemaDiffPanel.tsx
src/features/grpc/components/protoFormBuilder/GrpcProtoRepeatedMapRows.tsx
src/features/grpc/GrpcStudioPage.coverage-gaps.test.tsx
src/features/grpc/GrpcStudioPage.test.tsx
src/features/grpc/GrpcStudioPage.tsx
src/features/grpc/hooks/useGrpcStudioReplayActions.test.ts
src/features/grpc/hooks/useGrpcStudioReplayActions.ts
src/features/grpc/utils/grpcComposerTabState.ts
src/features/grpc/utils/grpcReplayTabApply.test.ts
src/features/grpc/utils/grpcReplayTabApply.ts
src/features/workflow/components/configs/GrpcAssertConfig.tsx
src/features/workflow/components/configs/GrpcLoadTestConfig.tsx
src/features/workflow/components/configs/GrpcNodeConfigs.coverage-gaps.test.tsx
src/features/workflow/components/configs/GrpcServerStreamConfig.tsx
src/features/workflow/components/configs/GrpcUnaryConfig.tsx
src/features/workflow/components/configs/GrpcWorkflowCallTargetFields.tsx
src/features/workflow/components/modals/WorkflowNodeConfigModal.test.tsx
src/features/workflow/components/nodes/GrpcAssertNode.tsx
src/features/workflow/components/nodes/GrpcServerStreamNode.tsx
src/features/workflow/components/nodes/GrpcUnaryNode.tsx
src/features/workflow/components/WorkflowDesignerFlowCanvas.tsx
src/features/workflow/engine/graphRunnerGrpcLogHelpers.test.ts
src/features/workflow/engine/graphRunnerGrpcLogHelpers.ts
src/features/workflow/engine/graphRunnerGrpcNodeHandlers.test.ts
src/features/workflow/engine/graphRunnerGrpcNodeHandlers.ts
src/features/workflow/hooks/useGrpcWorkflowTargetReflection.test.ts
src/features/workflow/hooks/useGrpcWorkflowTargetReflection.ts
src/features/workflow/hooks/useWorkflowDesignerControllerPartB.ts
src/features/workflow/utils/grpcWorkflowReflection.test.ts
src/features/workflow/utils/grpcWorkflowReflection.ts
src/features/workflow/utils/workflowNodeFactory.ts
src/features/workflow/utils/workflowVariableHints.ts
src/shared/grpc/grpcSpringFixturePorts.ts
src/shared/hooks/useModalDrag.ts
src/shared/selectors/grpc.ts
src/shared/selectors/wf.ts
src/styles/demo-hub.css
src/styles/grpc-studio.css
src/styles/workflow.css
vite.config.ts
