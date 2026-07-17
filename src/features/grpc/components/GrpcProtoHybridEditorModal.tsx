import { useMemo, useRef, useState } from 'react';
import type { GrpcMessageSchema, GrpcMethodInfo } from '../../../shared/grpc/contracts';
import AppModalFrame from '../../../shared/components/AppModalFrame';
import type { GrpcProtoHybridEvent, GrpcProtoHybridModalState } from '../utils/grpcProtoHybridState';
import { groupMessageFields } from '../utils/grpcProtoFormValues';
import { GrpcJsonCodeToolbar } from './GrpcJsonCodeToolbar';
import { GrpcHighlightedJsonTextarea } from './GrpcHighlightedJsonTextarea';
import { GrpcProtoHybridFocusEditor } from './GrpcProtoHybridFocusEditor';
import { GrpcProtoHybridNavigator } from './GrpcProtoHybridNavigator';
import { GrpcProtoFormBuilder } from './GrpcProtoFormBuilder';

interface GrpcProtoHybridEditorModalProps {
  open: boolean;
  method: GrpcMethodInfo;
  messageTypes?: GrpcMessageSchema[];
  modalState: GrpcProtoHybridModalState;
  closeConfirmVisible?: boolean;
  disabled?: boolean;
  selectedPath: string | null;
  onSelectPath: (path: string) => void;
  onEvent: (event: GrpcProtoHybridEvent) => void;
  onClose: () => void;
  onConfirmCloseDiscard?: () => void;
  onCancelCloseDiscard?: () => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function resolveActiveOneofMember(
  body: Record<string, unknown>,
  memberNames: string[],
): string | null {
  for (const memberName of memberNames) {
    if (body[memberName] !== undefined && body[memberName] !== null) {
      return memberName;
    }
  }
  return null;
}

export function GrpcProtoHybridEditorModal({
  open,
  method,
  messageTypes,
  modalState,
  closeConfirmVisible = false,
  disabled = false,
  selectedPath,
  onSelectPath,
  onEvent,
  onClose,
  onConfirmCloseDiscard,
  onCancelCloseDiscard,
}: GrpcProtoHybridEditorModalProps) {
  const [formValid, setFormValid] = useState(true);
  const modalNavigatorListRef = useRef<HTMLDivElement | null>(null);
  const modalFocusBodyRef = useRef<HTMLDivElement | null>(null);

  const workingDraftBody = useMemo<Record<string, unknown>>(() => {
    return isRecord(modalState.workingDraft) ? modalState.workingDraft : {};
  }, [modalState.workingDraft]);

  const schemaInsights = useMemo(() => {
    const mapFields = method.requestSchema.fields.filter((field) => field.isMap);
    const repeatedFields = method.requestSchema.fields.filter((field) => field.label === 'repeated');
    const { oneofGroups } = groupMessageFields(method.requestSchema.fields);
    const oneofAssist = [...oneofGroups.entries()].map(([groupName, members]) => ({
      groupName,
      members,
      activeMember: resolveActiveOneofMember(workingDraftBody, members.map((member) => member.name)),
    }));
    const mapAssist = mapFields.map((field) => {
      const rawValue = workingDraftBody[field.name];
      const entryCount = isRecord(rawValue) ? Object.keys(rawValue).length : 0;
      return { name: field.name, entryCount };
    });
    const repeatedAssist = repeatedFields.map((field) => {
      const rawValue = workingDraftBody[field.name];
      const itemCount = Array.isArray(rawValue) ? rawValue.length : 0;
      return { name: field.name, itemCount };
    });
    return {
      mapCount: mapFields.length,
      repeatedCount: repeatedFields.length,
      oneofCount: oneofGroups.size,
      oneofAssist,
      mapAssist,
      repeatedAssist,
    };
  }, [method.requestSchema.fields, workingDraftBody]);

  const applyDisabled = disabled || !modalState.dirty || !formValid || Boolean(modalState.jsonError);

  const handleJsonChange = (nextJson: string) => {
    onEvent({ type: 'JSON_MODAL_PATCH', jsonText: nextJson });
    try {
      const parsed = JSON.parse(nextJson);
      if (!isRecord(parsed)) {
        onEvent({ type: 'JSON_MODAL_PARSE_ERROR', message: 'Request body must be a JSON object.' });
        return;
      }
      onEvent({ type: 'JSON_MODAL_PARSE_OK', parsedDraft: parsed });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid JSON';
      onEvent({ type: 'JSON_MODAL_PARSE_ERROR', message });
    }
  };

  return (
    <AppModalFrame
      open={open}
      title={(
        <div className="grpc-hybrid-modal__title-row">
          <span className="grpc-hybrid-modal__title-text">Full Form Editor</span>
          <div className="grpc-hybrid-modal__tabs grpc-hybrid-modal__tabs--header" role="tablist" aria-label="Hybrid editor views">
            <button
              type="button"
              role="tab"
              aria-selected={modalState.activeView === 'optionA'}
              className={`grpc-hybrid-modal__tab${modalState.activeView === 'optionA' ? ' grpc-hybrid-modal__tab--active' : ''}`}
              data-testid="grpc-hybrid-tab-option-a"
              onClick={() => onEvent({ type: 'MODAL_VIEW_SWITCH', view: 'optionA' })}
            >
              Form View
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={modalState.activeView === 'optionB'}
              className={`grpc-hybrid-modal__tab${modalState.activeView === 'optionB' ? ' grpc-hybrid-modal__tab--active' : ''}`}
              data-testid="grpc-hybrid-tab-option-b"
              onClick={() => onEvent({ type: 'MODAL_VIEW_SWITCH', view: 'optionB' })}
            >
              Focus View
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={modalState.activeView === 'optionC'}
              className={`grpc-hybrid-modal__tab${modalState.activeView === 'optionC' ? ' grpc-hybrid-modal__tab--active' : ''}`}
              data-testid="grpc-hybrid-tab-option-c"
              onClick={() => onEvent({ type: 'MODAL_VIEW_SWITCH', view: 'optionC' })}
            >
              JSON View
            </button>
          </div>
        </div>
      )}
      onClose={onClose}
      closeButtonKind="none"
      overlayClassName="grpc-hybrid-modal-overlay"
      dialogClassName="grpc-hybrid-modal"
      headerClassName="grpc-hybrid-modal__header"
      bodyClassName="grpc-hybrid-modal__body"
      footerClassName="grpc-hybrid-modal__footer"
      titleClassName="grpc-hybrid-modal__title"
      showExpandButton={false}
      showResizeHandles
      disableDrag={false}
      closeOnOverlayClick={false}
      initialExpanded={false}
      minWidth={900}
      minHeight={560}
      footer={(
        <>
          {closeConfirmVisible && (
            <div className="grpc-hybrid-modal__close-confirm" data-testid="grpc-hybrid-close-confirm">
              <p className="grpc-hybrid-modal__close-confirm-text">
                You have unsaved changes. Discard them and close?
              </p>
              <div className="grpc-hybrid-modal__close-confirm-actions">
                <button
                  type="button"
                  className="btn btn-sm"
                  data-testid="grpc-hybrid-close-cancel-btn"
                  onClick={onCancelCloseDiscard}
                >
                  Keep Editing
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-danger"
                  data-testid="grpc-hybrid-close-discard-btn"
                  onClick={onConfirmCloseDiscard}
                >
                  Discard and Close
                </button>
              </div>
            </div>
          )}
          <button
            type="button"
            className="btn btn-sm"
            data-testid="grpc-hybrid-discard-btn"
            onClick={() => onEvent({ type: 'FULL_FORM_DISCARD' })}
            disabled={disabled}
          >
            Discard
          </button>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            data-testid="grpc-hybrid-apply-btn"
            onClick={() => onEvent({ type: 'FULL_FORM_APPLY' })}
            disabled={applyDisabled}
          >
            Apply to Request
          </button>
          <button
            type="button"
            className="btn btn-sm"
            data-testid="grpc-hybrid-close-btn"
            onClick={onClose}
          >
            Close
          </button>
        </>
      )}
    >
      {modalState.activeView === 'optionA' ? (
        <div className="grpc-hybrid-modal__form-scroll" data-testid="grpc-hybrid-form-view">
          <p className="grpc-hybrid-modal__hint">
            Bulk edit all fields here. Default editor remains schema-focused.
          </p>
          <div className="grpc-hybrid-modal__insights" data-testid="grpc-hybrid-option-a-insights">
            <span className="grpc-hybrid-modal__insight-pill">oneof groups: {schemaInsights.oneofCount}</span>
            <span className="grpc-hybrid-modal__insight-pill">map fields: {schemaInsights.mapCount}</span>
            <span className="grpc-hybrid-modal__insight-pill">repeated fields: {schemaInsights.repeatedCount}</span>
          </div>
          <GrpcProtoFormBuilder
            key={`${method.name}-hybrid`}
            schema={method.requestSchema}
            messageTypes={messageTypes}
            body={workingDraftBody}
            presentation="guided-cards"
            disabled={disabled}
            onValidityChange={setFormValid}
            onChange={(nextBody) => onEvent({ type: 'FULL_FORM_PATCH', nextDraft: nextBody })}
          />
        </div>
      ) : null}

      {modalState.activeView === 'optionB' ? (
        <div className="grpc-hybrid-form-layout grpc-hybrid-modal__option-b" data-testid="grpc-hybrid-option-b-view">
          <GrpcProtoHybridNavigator
            schema={method.requestSchema}
            selectedPath={selectedPath}
            disabled={disabled}
            listRef={modalNavigatorListRef}
            onSelectPath={onSelectPath}
          />
          <div className="grpc-hybrid-focus-shell grpc-hybrid-modal__focus-shell">
            <GrpcProtoHybridFocusEditor
              schema={method.requestSchema}
              body={workingDraftBody}
              selectedPath={selectedPath}
              messageTypes={messageTypes}
              bodyRef={modalFocusBodyRef}
              disabled={disabled}
              onPatchBody={(nextBody) => onEvent({ type: 'FULL_FORM_PATCH', nextDraft: nextBody })}
              onValidityChange={setFormValid}
            />
          </div>
        </div>
      ) : null}

      {modalState.activeView === 'optionC' ? (
        <div className="grpc-hybrid-modal__json-layout" data-testid="grpc-hybrid-json-view">
          <div className="grpc-hybrid-modal__json">
            <div className="grpc-hybrid-modal__json-header">
              <p className="grpc-hybrid-modal__hint">
                Edit raw JSON here; valid JSON updates proto form instantly.
              </p>
              <GrpcJsonCodeToolbar
                copyText={modalState.jsonDraft}
                onPrettyFormat={() => {
                  try {
                    handleJsonChange(JSON.stringify(JSON.parse(modalState.jsonDraft), null, 2));
                  } catch {
                    // Keep the existing draft when parse currently fails.
                  }
                }}
                prettyDisabled={Boolean(modalState.jsonError)}
                testIdPrefix="grpc-hybrid-json"
              />
            </div>
            <GrpcHighlightedJsonTextarea
              value={modalState.jsonDraft}
              disabled={disabled}
              testId="grpc-hybrid-json-editor"
              onChange={handleJsonChange}
            />
            {modalState.jsonError && (
              <p className="grpc-hybrid-modal__error" data-testid="grpc-hybrid-json-error" role="alert">
                {modalState.jsonError}
              </p>
            )}
          </div>
          <aside className="grpc-hybrid-modal__assist" data-testid="grpc-hybrid-json-assist">
            <div className="grpc-hybrid-modal__assist-card" data-testid="grpc-hybrid-assist-oneof">
              <h5 className="grpc-hybrid-modal__assist-title">oneof groups</h5>
              {schemaInsights.oneofAssist.length > 0 ? (
                <ul className="grpc-hybrid-modal__assist-list">
                  {schemaInsights.oneofAssist.map((group) => (
                    <li key={group.groupName}>
                      <strong>{group.groupName}</strong>
                      <span>{group.activeMember ? `active: ${group.activeMember}` : 'no active branch'}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="grpc-hybrid-modal__assist-empty">No oneof fields in this request schema.</p>
              )}
            </div>
            <div className="grpc-hybrid-modal__assist-card" data-testid="grpc-hybrid-assist-map">
              <h5 className="grpc-hybrid-modal__assist-title">map fields</h5>
              {schemaInsights.mapAssist.length > 0 ? (
                <ul className="grpc-hybrid-modal__assist-list">
                  {schemaInsights.mapAssist.map((field) => (
                    <li key={field.name}>
                      <strong>{field.name}</strong>
                      <span>{field.entryCount} entries</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="grpc-hybrid-modal__assist-empty">No map fields in this request schema.</p>
              )}
            </div>
            <div className="grpc-hybrid-modal__assist-card" data-testid="grpc-hybrid-assist-repeated">
              <h5 className="grpc-hybrid-modal__assist-title">repeated fields</h5>
              {schemaInsights.repeatedAssist.length > 0 ? (
                <ul className="grpc-hybrid-modal__assist-list">
                  {schemaInsights.repeatedAssist.map((field) => (
                    <li key={field.name}>
                      <strong>{field.name}</strong>
                      <span>{field.itemCount} items</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="grpc-hybrid-modal__assist-empty">No repeated fields in this request schema.</p>
              )}
            </div>
          </aside>
        </div>
      ) : null}
    </AppModalFrame>
  );
}
