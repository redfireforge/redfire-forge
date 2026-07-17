import { GrpcProtoHybridEditorModal } from '../GrpcProtoHybridEditorModal';
import { GrpcCallMobileActionBar } from './GrpcCallMobileActionBar';
import { GrpcCallMobileStageTabs } from './GrpcCallMobileStageTabs';
import { GrpcCallRequestComposer } from './GrpcCallRequestComposer';
import { GrpcCallResponsePane } from './GrpcCallResponsePane';
import { GrpcCallSendBar } from './GrpcCallSendBar';
import type { GrpcCallPanelProps } from './grpcCallPanelTypes';
import { useGrpcCallPanel } from './useGrpcCallPanel';

export type { GrpcCallPanelProps, GrpcComposerTab } from './grpcCallPanelTypes';

export function GrpcCallPanel(props: GrpcCallPanelProps) {
  const panel = useGrpcCallPanel(props);

  return (
    <section className="grpc-call-panel" data-testid="grpc-call-panel">
      <GrpcCallSendBar
        hasMethod={panel.hasMethod}
        descriptorSource={panel.descriptorSource}
        tab={panel.tab}
        disabled={panel.disabled}
        hybridEditorEnabled={panel.hybridEditorEnabled}
        unaryReady={panel.unaryReady}
        streamReady={panel.streamReady}
        streamActive={panel.streamActive}
        primaryLabel={panel.primaryLabel}
        primaryDisabled={panel.primaryDisabled}
        isUnaryInFlight={panel.isUnaryInFlight}
        sendBlockHint={panel.sendBlockHint}
        handleTimeoutChange={panel.handleTimeoutChange}
        handleOpenHybridWorkspace={panel.handleOpenHybridWorkspace}
        handlePrimaryAction={panel.handlePrimaryAction}
        onCancelUnary={panel.onCancelUnary}
      />

      <GrpcCallMobileStageTabs
        mobileStage={panel.mobileStage}
        onSwitchStage={panel.switchMobileStage}
      />

      <div className={`grpc-call-split grpc-call-split--stage-${panel.mobileStage}${panel.isStreamingLayout ? ' grpc-call-split--streaming' : ''}${panel.layoutCallType === 'client_streaming' ? ' grpc-call-split--client-streaming' : ''}`}>
        <GrpcCallRequestComposer
          tab={panel.tab}
          method={panel.method}
          messageTypes={panel.messageTypes}
          disabled={panel.disabled}
          hasMethod={panel.hasMethod}
          composerTab={panel.composerTab}
          jsonDraft={panel.jsonDraft}
          jsonError={panel.jsonError}
          formError={panel.formError}
          metadataSwitchError={panel.metadataSwitchError}
          uploadedFiles={panel.uploadedFiles}
          hybridEditorEnabled={panel.hybridEditorEnabled}
          methodIdentity={panel.methodIdentity}
          layoutCallType={panel.layoutCallType}
          isStreamingLayout={panel.isStreamingLayout}
          validationReady={panel.validationReady}
          pendingSendInFlight={panel.pendingSendInFlight}
          showHealthHint={panel.showHealthHint}
          authPreview={panel.authPreview}
          globalAuthProfiles={panel.globalAuthProfiles}
          defaultAuthProfileId={panel.defaultAuthProfileId}
          switchComposerTab={panel.switchComposerTab}
          handleJsonChange={panel.handleJsonChange}
          handleOpenHybridWorkspace={panel.handleOpenHybridWorkspace}
          handleFilesPicked={panel.handleFilesPicked}
          handleRemoveUploadedFile={panel.handleRemoveUploadedFile}
          handleClearUploadedFiles={panel.handleClearUploadedFiles}
          handleSendStreamMessage={panel.handleSendStreamMessage}
          setFormValid={panel.setFormValid}
          setMetadataEditorValid={panel.setMetadataEditorValid}
          onPatch={panel.onPatch}
          onUnmaskAuthSecretField={panel.onUnmaskAuthSecretField}
          onClearAuthSecretField={panel.onClearAuthSecretField}
          onEndStream={panel.onEndStream}
          dismiss={panel.dismiss}
        />

        <div className="grpc-call-response-shell" data-testid="grpc-response-shell">
          <GrpcCallResponsePane
            isStreamingLayout={panel.isStreamingLayout}
            layoutCallType={panel.layoutCallType}
            tab={panel.tab}
            streamCounts={panel.streamCounts}
            pendingSendInFlight={panel.pendingSendInFlight}
            validationReady={panel.validationReady}
            disabled={panel.disabled}
            hasMethod={panel.hasMethod}
            method={panel.method}
            serviceFullName={panel.serviceFullName}
            descriptorSource={panel.descriptorSource}
            targetAddress={panel.targetAddress}
            effectiveAuth={panel.effectiveAuth}
            showStreamPermissionHint={panel.showStreamPermissionHint}
            streamTlsHint={panel.streamTlsHint}
            streamBrowserTransportHint={panel.streamBrowserTransportHint}
            dismiss={panel.dismiss}
            handleEnqueueStreamMessage={panel.handleEnqueueStreamMessage}
            handleSendAllPendingStreamMessages={panel.handleSendAllPendingStreamMessages}
            handleExportStreamLog={panel.handleExportStreamLog}
            onRemovePendingStreamMessage={panel.onRemovePendingStreamMessage}
            onEndStream={panel.onEndStream}
            onClearStreamLog={panel.onClearStreamLog}
            onRetryStreamWithExpress={panel.onRetryStreamWithExpress}
            onRetryUnaryWithExpress={panel.onRetryUnaryWithExpress}
          />
        </div>
      </div>

      <GrpcCallMobileActionBar
        unaryReady={panel.unaryReady}
        streamReady={panel.streamReady}
        primaryLabel={panel.primaryLabel}
        primaryDisabled={panel.primaryDisabled}
        isUnaryInFlight={panel.isUnaryInFlight}
        handlePrimaryAction={panel.handlePrimaryAction}
        onCancelUnary={panel.onCancelUnary}
      />

      {panel.hybridEditorEnabled && panel.method && (
        <GrpcProtoHybridEditorModal
          open={panel.hybridState.modal.isOpen}
          method={panel.method}
          messageTypes={panel.messageTypes}
          modalState={panel.hybridState.modal}
          closeConfirmVisible={panel.hybridCloseConfirmVisible}
          disabled={panel.disabled}
          selectedPath={panel.hybridState.navigator.selectedPath}
          onSelectPath={panel.handleHybridNavigatorSelectPath}
          onEvent={panel.applyHybridEventWithHooks}
          onClose={panel.requestHybridClose}
          onConfirmCloseDiscard={panel.handleHybridCloseDiscard}
          onCancelCloseDiscard={panel.handleHybridCloseKeepEditing}
        />
      )}
    </section>
  );
}
