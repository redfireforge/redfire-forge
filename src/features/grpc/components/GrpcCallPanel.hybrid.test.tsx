/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../config/features', () => ({
  DEMO_HUB_ENABLED: true,
  GRPC_PROTO_HYBRID_EDITOR_ENABLED: true,
}));

import { FIXTURE_DESCRIPTOR } from '../../../shared/grpc/contractFixtures';
import { createGrpcStudioTab } from '../grpcStudioTypes';
import { GrpcCallPanel } from './GrpcCallPanel';

const ECHO_METHOD = FIXTURE_DESCRIPTOR.services[0]!.methods.find((m) => m.name === 'Echo')!;
const SERVER_STREAM_METHOD = FIXTURE_DESCRIPTOR.services[0]!.methods.find((m) => m.name === 'ServerStream')!;
const CLIENT_STREAM_METHOD = FIXTURE_DESCRIPTOR.services[0]!.methods.find((m) => m.name === 'ClientStream')!;
const BIDI_STREAM_METHOD = FIXTURE_DESCRIPTOR.services[0]!.methods.find((m) => m.name === 'BidiStream')!;
const ECHO_MULTI_FIELD_METHOD = {
  ...ECHO_METHOD,
  name: 'EchoMultiField',
  requestSchema: {
    ...ECHO_METHOD.requestSchema,
    fields: [
      {
        ...ECHO_METHOD.requestSchema.fields[0]!,
        number: 1,
        name: 'message',
        type: 'string',
      },
      {
        ...ECHO_METHOD.requestSchema.fields[0]!,
        number: 2,
        name: 'note',
        type: 'string',
      },
    ],
  },
} as typeof ECHO_METHOD;

describe('GrpcCallPanel hybrid editor integration', () => {
  it('uses the combined Form Input composer for non-unary methods', () => {
    const methods = [SERVER_STREAM_METHOD, CLIENT_STREAM_METHOD, BIDI_STREAM_METHOD];

    for (const method of methods) {
      const tab = createGrpcStudioTab({
        service: 'echo.EchoService',
        method: method.name,
        body: { message: 'hello' },
        metadata: {},
      });

      const { unmount } = render(
        <GrpcCallPanel
          tab={tab}
          method={method}
          serviceFullName="echo.EchoService"
          targetValid
          onPatch={vi.fn()}
        />,
      );

      expect(screen.getByTestId('grpc-request-tab-form')).toBeTruthy();
      expect(screen.queryByTestId('grpc-request-tab-json')).toBeNull();
      expect(screen.getByTestId('grpc-request-json-compact')).toBeTruthy();
      expect(screen.getByTestId('grpc-open-full-form-editor-btn')).toBeTruthy();

      unmount();
    }
  });

  it('opens hybrid modal and applies valid Option C JSON back into request body', () => {
    const onPatch = vi.fn();
    const tab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hello' },
      metadata: {},
    });

    render(
      <GrpcCallPanel
        tab={tab}
        method={ECHO_METHOD}
        serviceFullName="echo.EchoService"
        targetValid
        onPatch={onPatch}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-open-full-form-editor-btn'));
    expect(screen.getByTestId('grpc-hybrid-tab-option-c')).toBeTruthy();

    fireEvent.click(screen.getByTestId('grpc-hybrid-tab-option-c'));
    fireEvent.change(screen.getByTestId('grpc-hybrid-json-editor'), {
      target: { value: '{"message":"from option c"}' },
    });
    fireEvent.click(screen.getByTestId('grpc-hybrid-apply-btn'));

    expect(onPatch).toHaveBeenCalledWith(expect.objectContaining({
      requestMode: 'json',
      body: { message: 'from option c' },
    }));
  });

  it('prompts before dirty close and emits lifecycle telemetry events', () => {
    const telemetryEvents: string[] = [];
    const onTelemetry = (event: Event) => {
      const detail = (event as CustomEvent<{ name?: string }>).detail;
      if (detail?.name) telemetryEvents.push(detail.name);
    };
    window.addEventListener('grpc-hybrid-editor-telemetry', onTelemetry as EventListener);

    const tab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hello' },
      metadata: {},
    });

    render(
      <GrpcCallPanel
        tab={tab}
        method={ECHO_METHOD}
        serviceFullName="echo.EchoService"
        targetValid
        onPatch={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-open-full-form-editor-btn'));
    fireEvent.click(screen.getByTestId('grpc-hybrid-tab-option-c'));
    fireEvent.change(screen.getByTestId('grpc-hybrid-json-editor'), {
      target: { value: '{"message":"dirty"}' },
    });

    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(screen.getByTestId('grpc-hybrid-close-confirm')).toBeTruthy();

    fireEvent.click(screen.getByTestId('grpc-hybrid-close-cancel-btn'));
    expect(screen.queryByTestId('grpc-hybrid-close-confirm')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    fireEvent.click(screen.getByTestId('grpc-hybrid-close-discard-btn'));
    expect(screen.queryByTestId('grpc-hybrid-tab-option-c')).toBeNull();

    expect(telemetryEvents).toContain('grpc_editor_modal_opened');
    expect(telemetryEvents).toContain('grpc_editor_modal_close_prompted');
    expect(telemetryEvents).toContain('grpc_editor_modal_close_cancelled');
    expect(telemetryEvents).toContain('grpc_editor_modal_discarded');
    expect(telemetryEvents).toContain('grpc_editor_validation_warning_count');

    window.removeEventListener('grpc-hybrid-editor-telemetry', onTelemetry as EventListener);
  });

  it('emits blocked-send telemetry when send prerequisites are not satisfied', () => {
    const telemetryEvents: string[] = [];
    const onTelemetry = (event: Event) => {
      const detail = (event as CustomEvent<{ name?: string }>).detail;
      if (detail?.name) telemetryEvents.push(detail.name);
    };
    window.addEventListener('grpc-hybrid-editor-telemetry', onTelemetry as EventListener);

    const tab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hello' },
      metadata: {},
    });

    render(
      <GrpcCallPanel
        tab={tab}
        method={ECHO_METHOD}
        serviceFullName="echo.EchoService"
        targetValid={false}
        onPatch={vi.fn()}
      />,
    );

    expect(telemetryEvents).toContain('grpc_editor_send_blocked_error');

    window.removeEventListener('grpc-hybrid-editor-telemetry', onTelemetry as EventListener);
  });

  it('renders Option B navigator and applies focused field edits to canonical request draft', () => {
    const onPatch = vi.fn();
    const telemetryEvents: string[] = [];
    const onTelemetry = (event: Event) => {
      const detail = (event as CustomEvent<{ name?: string }>).detail;
      if (detail?.name) telemetryEvents.push(detail.name);
    };
    window.addEventListener('grpc-hybrid-editor-telemetry', onTelemetry as EventListener);

    const tab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hello', note: 'before' },
      metadata: {},
    });

    render(
      <GrpcCallPanel
        tab={tab}
        method={ECHO_MULTI_FIELD_METHOD}
        serviceFullName="echo.EchoService"
        targetValid
        onPatch={onPatch}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-open-full-form-editor-btn'));
    fireEvent.click(screen.getByTestId('grpc-hybrid-tab-option-b'));
    expect(screen.getByTestId('grpc-hybrid-option-b-view')).toBeTruthy();
    fireEvent.click(screen.getByTestId('grpc-hybrid-nav-item-field-note'));
    fireEvent.change(screen.getByTestId('grpc-proto-field-input-note'), {
      target: { value: 'updated note' },
    });
    fireEvent.click(screen.getByTestId('grpc-hybrid-apply-btn'));

    expect(onPatch).toHaveBeenCalledWith(expect.objectContaining({
      requestMode: 'json',
      body: { message: 'hello', note: 'updated note' },
    }));
    expect(telemetryEvents).toContain('grpc_editor_selected_path_changed');

    window.removeEventListener('grpc-hybrid-editor-telemetry', onTelemetry as EventListener);
  });

  it('supports keyboard navigation and filtering in Option B navigator', async () => {
    const tab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hello', note: 'before' },
      metadata: {},
    });

    render(
      <GrpcCallPanel
        tab={tab}
        method={ECHO_MULTI_FIELD_METHOD}
        serviceFullName="echo.EchoService"
        targetValid
        onPatch={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-open-full-form-editor-btn'));
    fireEvent.click(screen.getByTestId('grpc-hybrid-tab-option-b'));

    const messageItem = screen.getByTestId('grpc-hybrid-nav-item-field-message');
    const noteItem = screen.getByTestId('grpc-hybrid-nav-item-field-note');
    messageItem.focus();
    fireEvent.keyDown(messageItem, { key: 'ArrowDown' });

    await waitFor(() => {
      expect(noteItem.getAttribute('aria-selected')).toBe('true');
    });

    fireEvent.change(screen.getByTestId('grpc-hybrid-navigator-search'), {
      target: { value: 'note' },
    });

    expect(screen.queryByTestId('grpc-hybrid-nav-item-field-message')).toBeNull();
    expect(screen.getByTestId('grpc-hybrid-nav-item-field-note')).toBeTruthy();
  });

  it('renders Option B navigator and focus controls inside visual workspace', () => {
    const tab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hello', note: 'before' },
      metadata: {},
    });

    render(
      <GrpcCallPanel
        tab={tab}
        method={ECHO_MULTI_FIELD_METHOD}
        serviceFullName="echo.EchoService"
        targetValid
        onPatch={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-open-full-form-editor-btn'));
    fireEvent.click(screen.getByTestId('grpc-hybrid-tab-option-b'));

    expect(screen.queryByTestId('grpc-hybrid-readonly-hint')).toBeNull();
    expect(screen.queryByTestId('grpc-hybrid-readonly-shell')).toBeNull();
    expect(screen.getByTestId('grpc-hybrid-nav-item-field-message').hasAttribute('disabled')).toBe(false);
    expect(screen.getByTestId('grpc-hybrid-focus-editor')).toBeTruthy();
  });

  it('restores selected Option B path across modal discard and reopen', async () => {
    const tab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hello' },
      metadata: {},
    });

    render(
      <GrpcCallPanel
        tab={tab}
        method={ECHO_METHOD}
        serviceFullName="echo.EchoService"
        targetValid
        onPatch={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-open-full-form-editor-btn'));
    fireEvent.click(screen.getByTestId('grpc-hybrid-tab-option-b'));
    fireEvent.click(screen.getByTestId('grpc-hybrid-nav-item-field-message'));
    fireEvent.click(screen.getByTestId('grpc-hybrid-discard-btn'));

    fireEvent.click(screen.getByTestId('grpc-open-full-form-editor-btn'));
    fireEvent.click(screen.getByTestId('grpc-hybrid-tab-option-b'));

    await waitFor(() => {
      expect(screen.getByTestId('grpc-hybrid-nav-item-field-message').getAttribute('aria-selected')).toBe('true');
    });
  });
});
