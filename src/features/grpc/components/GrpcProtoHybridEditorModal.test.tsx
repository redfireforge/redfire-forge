/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FIXTURE_DESCRIPTOR } from '../../../shared/grpc/contractFixtures';
import type { GrpcProtoHybridModalState } from '../utils/grpcProtoHybridState';
import { GrpcProtoHybridEditorModal } from './GrpcProtoHybridEditorModal';

const ECHO_METHOD = FIXTURE_DESCRIPTOR.services[0]!.methods.find((m) => m.name === 'Echo')!;
const COMPLEX_METHOD = {
  ...ECHO_METHOD,
  name: 'CreateComplexEcho',
  requestTypeName: 'echo.ComplexEchoRequest',
  requestSchema: {
    typeName: 'echo.ComplexEchoRequest',
    fields: [
      { name: 'message', number: 1, type: 'string', label: 'optional' },
      { name: 'labels', number: 2, type: 'string', label: 'repeated' },
      { name: 'attributes', number: 3, type: 'string', label: 'repeated', isMap: true, mapKeyType: 'string' },
      { name: 'card', number: 4, type: 'message', label: 'optional', messageTypeName: 'echo.Card', isOneofMember: true, oneofName: 'payment_method' },
      { name: 'invoice', number: 5, type: 'message', label: 'optional', messageTypeName: 'echo.Invoice', isOneofMember: true, oneofName: 'payment_method' },
    ],
  },
} as typeof ECHO_METHOD;

function makeModalState(overrides: Partial<GrpcProtoHybridModalState> = {}): GrpcProtoHybridModalState {
  return {
    isOpen: true,
    activeView: 'optionA',
    workingDraft: { message: 'hello' },
    jsonDraft: '{\n  "message": "hello"\n}',
    jsonError: null,
    openedAt: Date.now(),
    openContext: {
      selectedPath: null,
      navigatorScrollTop: 0,
      focusPaneScrollTop: 0,
    },
    dirty: false,
    ...overrides,
  };
}

describe('GrpcProtoHybridEditorModal', () => {
  it('switches between Form and JSON tabs', () => {
    const onEvent = vi.fn();
    render(
      <GrpcProtoHybridEditorModal
        open
        method={ECHO_METHOD}
        modalState={makeModalState()}
        onEvent={onEvent}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-hybrid-tab-option-c'));
    expect(onEvent).toHaveBeenCalledWith({ type: 'MODAL_VIEW_SWITCH', view: 'optionC' });
  });

  it('shows parse error and disables apply when JSON tab has parser error', () => {
    const onEvent = vi.fn();
    render(
      <GrpcProtoHybridEditorModal
        open
        method={ECHO_METHOD}
        modalState={makeModalState({ activeView: 'optionC', jsonError: 'Request body must be a JSON object.' })}
        onEvent={onEvent}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByTestId('grpc-hybrid-json-error').textContent).toContain('Request body must be a JSON object.');
    expect((screen.getByTestId('grpc-hybrid-apply-btn') as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByTestId('grpc-hybrid-json-editor'), { target: { value: '[]' } });
    expect(onEvent).toHaveBeenCalledWith({ type: 'JSON_MODAL_PATCH', jsonText: '[]' });
    expect(onEvent).toHaveBeenCalledWith({ type: 'JSON_MODAL_PARSE_ERROR', message: 'Request body must be a JSON object.' });
  });

  it('disables apply when modal is not dirty', () => {
    render(
      <GrpcProtoHybridEditorModal
        open
        method={ECHO_METHOD}
        modalState={makeModalState({ dirty: false })}
        onEvent={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect((screen.getByTestId('grpc-hybrid-apply-btn') as HTMLButtonElement).disabled).toBe(true);
  });

  it('enables apply when modal has dirty draft and no blockers', () => {
    render(
      <GrpcProtoHybridEditorModal
        open
        method={ECHO_METHOD}
        modalState={makeModalState({ dirty: true, jsonError: null })}
        onEvent={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect((screen.getByTestId('grpc-hybrid-apply-btn') as HTMLButtonElement).disabled).toBe(false);
  });

  it('renders close confirmation controls when requested', () => {
    const onConfirmCloseDiscard = vi.fn();
    const onCancelCloseDiscard = vi.fn();
    render(
      <GrpcProtoHybridEditorModal
        open
        method={ECHO_METHOD}
        modalState={makeModalState()}
        closeConfirmVisible
        onEvent={vi.fn()}
        onClose={vi.fn()}
        onConfirmCloseDiscard={onConfirmCloseDiscard}
        onCancelCloseDiscard={onCancelCloseDiscard}
      />,
    );

    expect(screen.getByTestId('grpc-hybrid-close-confirm')).toBeTruthy();
    fireEvent.click(screen.getByTestId('grpc-hybrid-close-cancel-btn'));
    fireEvent.click(screen.getByTestId('grpc-hybrid-close-discard-btn'));
    expect(onCancelCloseDiscard).toHaveBeenCalledTimes(1);
    expect(onConfirmCloseDiscard).toHaveBeenCalledTimes(1);
  });

  it('renders Option A complexity insight chips for complex schemas', () => {
    render(
      <GrpcProtoHybridEditorModal
        open
        method={COMPLEX_METHOD}
        modalState={makeModalState({ dirty: true })}
        onEvent={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByTestId('grpc-hybrid-option-a-insights').textContent).toContain('oneof groups: 1');
    expect(screen.getByTestId('grpc-hybrid-option-a-insights').textContent).toContain('map fields: 1');
    expect(screen.getByTestId('grpc-hybrid-option-a-insights').textContent).toContain('repeated fields: 2');
  });

  it('renders Option C visual assist cards for oneof/map/repeated fields', () => {
    render(
      <GrpcProtoHybridEditorModal
        open
        method={COMPLEX_METHOD}
        modalState={makeModalState({
          activeView: 'optionC',
          dirty: true,
          workingDraft: {
            message: 'hello',
            labels: ['alpha', 'beta'],
            attributes: { env: 'prod', region: 'us-east' },
            invoice: { invoice_id: 'INV-10029' },
          },
        })}
        onEvent={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByTestId('grpc-hybrid-json-assist')).toBeTruthy();
    expect(screen.getByTestId('grpc-hybrid-assist-oneof').textContent).toContain('active: invoice');
    expect(screen.getByTestId('grpc-hybrid-assist-map').textContent).toContain('attributes');
    expect(screen.getByTestId('grpc-hybrid-assist-map').textContent).toContain('2 entries');
    expect(screen.getByTestId('grpc-hybrid-assist-repeated').textContent).toContain('labels');
    expect(screen.getByTestId('grpc-hybrid-assist-repeated').textContent).toContain('2 items');
  });

  it('renders option B focus layout and forwards selection events', () => {
    const onEvent = vi.fn();
    const onSelectPath = vi.fn();

    render(
      <GrpcProtoHybridEditorModal
        open
        method={COMPLEX_METHOD}
        selectedPath="field:message"
        modalState={makeModalState({ activeView: 'optionB', dirty: true })}
        onEvent={onEvent}
        onSelectPath={onSelectPath}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByTestId('grpc-hybrid-option-b-view')).toBeTruthy();
    fireEvent.click(screen.getByTestId('grpc-hybrid-nav-item-field-message'));
    expect(onSelectPath).toHaveBeenCalledWith('field:message');
  });

  it('wires discard/apply/close footer actions', () => {
    const onEvent = vi.fn();
    const onClose = vi.fn();

    render(
      <GrpcProtoHybridEditorModal
        open
        method={ECHO_METHOD}
        modalState={makeModalState({ dirty: true })}
        onEvent={onEvent}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-hybrid-discard-btn'));
    fireEvent.click(screen.getByTestId('grpc-hybrid-apply-btn'));
    fireEvent.click(screen.getByTestId('grpc-hybrid-close-btn'));

    expect(onEvent).toHaveBeenCalledWith({ type: 'FULL_FORM_DISCARD' });
    expect(onEvent).toHaveBeenCalledWith({ type: 'FULL_FORM_APPLY' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('pretty-formats valid JSON drafts in option C', () => {
    const onEvent = vi.fn();
    render(
      <GrpcProtoHybridEditorModal
        open
        method={ECHO_METHOD}
        modalState={makeModalState({
          activeView: 'optionC',
          dirty: true,
          jsonDraft: '{"message":"hello"}',
          jsonError: null,
        })}
        onEvent={onEvent}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-hybrid-json-pretty-btn'));
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'JSON_MODAL_PATCH' }));
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'JSON_MODAL_PARSE_OK' }));
  });

  it('shows empty assist cards when schema has no oneof/map/repeated fields', () => {
    render(
      <GrpcProtoHybridEditorModal
        open
        method={ECHO_METHOD}
        modalState={makeModalState({ activeView: 'optionC', dirty: true, workingDraft: [] as unknown as Record<string, unknown> })}
        onEvent={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByTestId('grpc-hybrid-assist-oneof').textContent).toContain('No oneof fields');
    expect(screen.getByTestId('grpc-hybrid-assist-map').textContent).toContain('No map fields');
    expect(screen.getByTestId('grpc-hybrid-assist-repeated').textContent).toContain('No repeated fields');
  });
});
