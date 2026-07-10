import { pruneAuthMaskForConfig } from '../../utils/grpcSecretFieldUi';
import { GrpcSpringHintCard } from '../GrpcSpringHintCard';
import { GrpcAuthPanel } from '../GrpcAuthPanel';
import { GrpcMetadataEditor } from '../GrpcMetadataEditor';
import { GrpcProtoFormBuilder } from '../GrpcProtoFormBuilder';
import { GrpcJsonCodeToolbar } from '../GrpcJsonCodeToolbar';
import { GrpcHighlightedJsonTextarea } from '../GrpcHighlightedJsonTextarea';
import { GrpcStreamRequestActionBar } from '../GrpcStreamRequestActionBar';
import type { UseGrpcCallPanelReturn } from './useGrpcCallPanel';

type GrpcCallRequestComposerProps = Pick<
  UseGrpcCallPanelReturn,
  | 'tab'
  | 'method'
  | 'messageTypes'
  | 'disabled'
  | 'hasMethod'
  | 'composerTab'
  | 'jsonDraft'
  | 'jsonError'
  | 'formError'
  | 'metadataSwitchError'
  | 'uploadedFiles'
  | 'hybridEditorEnabled'
  | 'methodIdentity'
  | 'layoutCallType'
  | 'isStreamingLayout'
  | 'validationReady'
  | 'pendingSendInFlight'
  | 'showHealthHint'
  | 'authPreview'
  | 'globalAuthProfiles'
  | 'defaultAuthProfileId'
  | 'switchComposerTab'
  | 'handleJsonChange'
  | 'handleOpenHybridWorkspace'
  | 'handleFilesPicked'
  | 'handleRemoveUploadedFile'
  | 'handleClearUploadedFiles'
  | 'handleSendStreamMessage'
  | 'setFormValid'
  | 'setMetadataEditorValid'
  | 'onPatch'
  | 'onUnmaskAuthSecretField'
  | 'onClearAuthSecretField'
  | 'onEndStream'
  | 'dismiss'
>;

export function GrpcCallRequestComposer({
  tab,
  method,
  messageTypes,
  disabled,
  hasMethod,
  composerTab,
  jsonDraft,
  jsonError,
  formError,
  metadataSwitchError,
  uploadedFiles,
  hybridEditorEnabled,
  methodIdentity,
  layoutCallType,
  isStreamingLayout,
  validationReady,
  pendingSendInFlight,
  showHealthHint,
  authPreview,
  globalAuthProfiles,
  defaultAuthProfileId,
  switchComposerTab,
  handleJsonChange,
  handleOpenHybridWorkspace,
  handleFilesPicked,
  handleRemoveUploadedFile,
  handleClearUploadedFiles,
  handleSendStreamMessage,
  setFormValid,
  setMetadataEditorValid,
  onPatch,
  onUnmaskAuthSecretField,
  onClearAuthSecretField,
  onEndStream,
  dismiss,
}: GrpcCallRequestComposerProps) {
  return (
    <div className="grpc-call-request-pane" data-testid="grpc-request-pane">
      <div className="grpc-call-panel-tabs" role="group" aria-label="Request composer">
        <button
          type="button"
          aria-pressed={composerTab === 'form'}
          className={`grpc-call-panel-tab${composerTab === 'form' ? ' grpc-call-panel-tab--active' : ''}`}
          data-testid="grpc-request-tab-form"
          onClick={() => switchComposerTab('form')}
        >
          Form Input
        </button>
        <button
          type="button"
          aria-pressed={composerTab === 'metadata'}
          className={`grpc-call-panel-tab${composerTab === 'metadata' ? ' grpc-call-panel-tab--active' : ''}`}
          data-testid="grpc-request-tab-metadata"
          onClick={() => switchComposerTab('metadata')}
        >
          Metadata
        </button>
        <button
          type="button"
          aria-pressed={composerTab === 'auth'}
          className={`grpc-call-panel-tab${composerTab === 'auth' ? ' grpc-call-panel-tab--active' : ''}`}
          data-testid="grpc-request-tab-auth"
          onClick={() => switchComposerTab('auth')}
        >
          Auth
        </button>
        <button
          type="button"
          aria-pressed={composerTab === 'files'}
          className={`grpc-call-panel-tab${composerTab === 'files' ? ' grpc-call-panel-tab--active' : ''}`}
          data-testid="grpc-request-tab-files"
          onClick={() => switchComposerTab('files')}
        >
          Files
        </button>
      </div>

      <div className="grpc-call-panel-body">
        {showHealthHint && (
          <GrpcSpringHintCard
            hintId="spring_health_actuator"
            onDismiss={() => dismiss('spring_health_actuator')}
          />
        )}

        {!hasMethod && composerTab !== 'auth' && (
          <p className="grpc-call-panel-empty" data-testid="grpc-call-panel-empty">
            Reflect services and select a method to edit the request body.
          </p>
        )}

        {composerTab === 'auth' && (
          <GrpcAuthPanel
            auth={tab.auth}
            preview={authPreview}
            maskedSecretFields={tab.maskedSecretFields?.auth}
            disabled={disabled}
            globalAuthProfiles={globalAuthProfiles}
            defaultAuthProfileId={defaultAuthProfileId}
            onChange={(auth) => onPatch({
              auth,
              maskedSecretFields: pruneAuthMaskForConfig(auth, tab.maskedSecretFields),
            })}
            onUnmaskSecretField={onUnmaskAuthSecretField}
            onClearSecretField={onClearAuthSecretField}
          />
        )}

        {hasMethod && composerTab === 'files' && (
          <div className="grpc-call-files-panel" data-testid="grpc-request-files-panel">
            <p className="grpc-call-files-hint">
              Attach payload files for bytes-oriented fields. Uploaded files are staged per tab.
            </p>
            <label className="grpc-call-files-picker">
              <span>Choose files</span>
              <input
                type="file"
                multiple
                data-testid="grpc-request-files-input"
                onChange={handleFilesPicked}
              />
            </label>
            {uploadedFiles.length > 0 ? (
              <>
                <div className="grpc-call-files-toolbar">
                  <span className="grpc-call-files-count" data-testid="grpc-request-files-count">
                    {uploadedFiles.length} selected
                  </span>
                  <button
                    type="button"
                    className="grpc-call-files-clear-btn"
                    data-testid="grpc-request-files-clear"
                    onClick={handleClearUploadedFiles}
                  >
                    Clear all
                  </button>
                </div>
                <ul className="grpc-call-files-list" data-testid="grpc-request-files-list">
                  {uploadedFiles.map((file, index) => (
                    <li key={file.id} className="grpc-call-files-list-item">
                      <span>{file.name} ({file.size} B)</span>
                      <button
                        type="button"
                        className="grpc-call-files-remove-btn"
                        data-testid={`grpc-request-files-remove-${index}`}
                        onClick={() => handleRemoveUploadedFile(file.id)}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="grpc-call-panel-empty" data-testid="grpc-request-files-empty">
                No files selected.
              </p>
            )}
          </div>
        )}

        {hasMethod && composerTab === 'form' && (
          <div className="grpc-call-composer-scroll" data-testid="grpc-request-form-scroll">
            {formError && (
              <p className="grpc-call-form-error" data-testid="grpc-request-form-error" role="alert">
                {formError}
              </p>
            )}
            {hybridEditorEnabled ? (
              <div className="grpc-call-json-editor grpc-hybrid-json-compact" data-testid="grpc-request-json-compact">
                <div className="grpc-call-json-editor-header">
                  <span className="grpc-call-json-editor-hint">
                    JSON-first composer. Open Full Form Editor for guided field editing.
                  </span>
                  <div className="grpc-call-json-editor-actions">
                    <button
                      type="button"
                      className="grpc-call-full-form-btn"
                      data-testid="grpc-open-full-form-editor-btn-inline"
                      disabled={disabled}
                      onClick={handleOpenHybridWorkspace}
                    >
                      Open Full Form Editor
                    </button>
                    <GrpcJsonCodeToolbar
                      copyText={jsonDraft}
                      onPrettyFormat={() => {
                        if (!method) return;
                        try {
                          handleJsonChange(JSON.stringify(JSON.parse(jsonDraft), null, 2));
                        } catch {
                          // Keep draft when invalid JSON.
                        }
                      }}
                      prettyDisabled={!!jsonError}
                      testIdPrefix="grpc-request-json-hybrid"
                    />
                  </div>
                </div>
                <GrpcHighlightedJsonTextarea
                  value={jsonDraft}
                  disabled={disabled}
                  onChange={handleJsonChange}
                  testId="grpc-request-json"
                />
                {jsonError && (
                  <p className="grpc-call-json-error" data-testid="grpc-request-json-error" role="alert">
                    {jsonError}
                  </p>
                )}
              </div>
            ) : (
              <GrpcProtoFormBuilder
                key={methodIdentity}
                schema={method!.requestSchema}
                messageTypes={messageTypes}
                body={tab.body}
                disabled={disabled}
                onValidityChange={setFormValid}
                onChange={(body) => onPatch({ body, requestMode: 'form' })}
              />
            )}
          </div>
        )}

        {hasMethod && composerTab === 'metadata' && (
          <>
            {metadataSwitchError && (
              <p className="grpc-call-form-error" data-testid="grpc-request-metadata-error" role="alert">
                {metadataSwitchError}
              </p>
            )}
            <GrpcMetadataEditor
              metadata={tab.metadata}
              disabled={disabled}
              onValidationChange={setMetadataEditorValid}
              onChange={(metadata) => onPatch({ metadata })}
            />
          </>
        )}
      </div>

      {isStreamingLayout
        && hasMethod
        && (layoutCallType === 'client_streaming' || layoutCallType === 'bidi_streaming') && (
        <GrpcStreamRequestActionBar
          callType={layoutCallType}
          streamActive={tab.streamLifecycle === 'streaming'}
          clientWritesEnded={tab.streamLifecycle === 'ending'}
          disabled={disabled}
          canCompose={validationReady}
          sendAllInFlight={pendingSendInFlight}
          onSendMessage={handleSendStreamMessage}
          onEndStream={() => onEndStream?.()}
        />
      )}
    </div>
  );
}
