/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FIXTURE_DESCRIPTOR } from '@shared/grpc/contractFixtures';
import type { GrpcDescriptor } from '@shared/grpc/contracts';
import { GrpcSchemaBrowser } from '../GrpcSchemaBrowser';
import { clickByTestIdAsync, DESCRIPTOR_WITH_ENUM } from './grpcSchemaBrowserCoverageGaps.testHelpers';

describe('GrpcSchemaBrowser coverage gaps — navigation and grpcurl', () => {
  it('renders enum detail with doc comments', () => {
    render(
      <GrpcSchemaBrowser
        descriptor={DESCRIPTOR_WITH_ENUM}
        targetAddress="localhost:50051"
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-schema-tree-node-enum--echo-status'));
    expect(screen.getByTestId('grpc-schema-enum-detail')).toBeTruthy();
    expect(screen.getByText('Serving state for echo workers')).toBeTruthy();
    expect(screen.getByText('Ready to accept RPCs')).toBeTruthy();
  });

  it('renders service detail when a service node is selected', () => {
    render(
      <GrpcSchemaBrowser
        descriptor={FIXTURE_DESCRIPTOR}
        targetAddress="localhost:50051"
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-schema-tree-node-service--echo-echoservice'));
    expect(screen.getByTestId('grpc-schema-service-detail')).toBeTruthy();
    expect(screen.getByTestId('grpc-schema-service-methods-table').textContent).toContain('Echo');
  });

  it('navigates to message detail when service request type link is clicked', () => {
    render(
      <GrpcSchemaBrowser
        descriptor={FIXTURE_DESCRIPTOR}
        targetAddress="localhost:50051"
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-schema-tree-node-service--echo-echoservice'));
    fireEvent.click(screen.getAllByTestId('grpc-schema-service-type-link-echo-echorequest')[0]!);

    expect(screen.getByTestId('grpc-schema-message-detail').textContent).toContain('echo.EchoRequest');
  });

  it('calls onSelectMethod and onExportProtoset handlers', () => {
    const onSelectMethod = vi.fn();
    const onExportProtoset = vi.fn(async () => undefined);

    render(
      <GrpcSchemaBrowser
        descriptor={FIXTURE_DESCRIPTOR}
        targetAddress="localhost:50051"
        onSelectMethod={onSelectMethod}
        onExportProtoset={onExportProtoset}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-schema-tree-node-method--echo-echoservice--echo'));
    expect(onSelectMethod).toHaveBeenCalledWith('echo.EchoService', 'Echo');

    fireEvent.click(screen.getByTestId('grpc-schema-export-protoset-btn'));
    expect(onExportProtoset).toHaveBeenCalled();
  });

  it('renders message detail when a message node is selected', () => {
    render(
      <GrpcSchemaBrowser
        descriptor={FIXTURE_DESCRIPTOR}
        targetAddress="localhost:50051"
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-schema-tree-node-message--echo-echorequest'));
    expect(screen.getByTestId('grpc-schema-message-detail')).toBeTruthy();
  });

  it('shows search empty state when filter has no matches', () => {
    render(
      <GrpcSchemaBrowser
        descriptor={FIXTURE_DESCRIPTOR}
        targetAddress="localhost:50051"
      />,
    );

    fireEvent.change(screen.getByTestId('grpc-schema-browser-search'), {
      target: { value: 'zzznomatch' },
    });
    expect(screen.getByTestId('grpc-schema-tree-empty')).toBeTruthy();
  });

  it('copies grpcurl command for selected method', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });

    render(
      <GrpcSchemaBrowser
        descriptor={FIXTURE_DESCRIPTOR}
        targetAddress="localhost:50051"
        tlsMode="tls"
        selectedService="echo.EchoService"
        selectedMethod="Echo"
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-schema-tree-node-method--echo-echoservice--echo'));
    await clickByTestIdAsync('grpc-schema-copy-grpcurl-btn');
    await vi.waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining("-d '"));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('"message":"hello"'));
  });

  it('shows first-time install guidance after copying grpcurl command', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    sessionStorage.removeItem('grpc-schema-copy-grpcurl-hint-seen');

    render(
      <GrpcSchemaBrowser
        descriptor={FIXTURE_DESCRIPTOR}
        targetAddress="localhost:50051"
        selectedService="echo.EchoService"
        selectedMethod="Echo"
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-schema-tree-node-method--echo-echoservice--echo'));
    await clickByTestIdAsync('grpc-schema-copy-grpcurl-btn');

    await vi.waitFor(() => {
      expect(screen.getByTestId('grpc-schema-copy-feedback').textContent)
        .toContain('go install github.com/fullstorydev/grpcurl/cmd/grpcurl@latest');
    });
    expect(screen.getByTestId('grpc-schema-copy-install-options').textContent)
      .toContain('macOS (Homebrew):');
    expect(screen.getByTestId('grpc-schema-copy-install-options').textContent)
      .toContain('Windows (winget):');
  });

  it('switches between minimal and full grpcurl payload modes', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(
      <GrpcSchemaBrowser
        descriptor={FIXTURE_DESCRIPTOR}
        targetAddress="localhost:50051"
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-schema-tree-node-method--echo-echoservice--serverstream'));

    await clickByTestIdAsync('grpc-schema-copy-grpcurl-btn');
    await vi.waitFor(() => {
      expect(writeText).toHaveBeenCalled();
    });
    expect(writeText).toHaveBeenLastCalledWith(expect.stringContaining('"message":"hello"'));
    expect(writeText).not.toHaveBeenLastCalledWith(expect.stringContaining('"repeatCount":1'));

    await clickByTestIdAsync('grpc-schema-copy-mode-full');
    await clickByTestIdAsync('grpc-schema-copy-grpcurl-btn');
    await vi.waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(2);
    });
    expect(writeText).toHaveBeenLastCalledWith(expect.stringContaining('"repeat_count":1'));
    expect(writeText).toHaveBeenLastCalledWith(expect.stringContaining('"interval_ms":1'));
  });

  it('opens method in tab when handler provided', () => {
    const onOpenInTab = vi.fn();
    render(
      <GrpcSchemaBrowser
        descriptor={FIXTURE_DESCRIPTOR}
        targetAddress="localhost:50051"
        onOpenInTab={onOpenInTab}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-schema-tree-node-method--echo-echoservice--echo'));
    fireEvent.click(screen.getByTestId('grpc-schema-open-tab-btn'));
    expect(onOpenInTab).toHaveBeenCalledWith('echo.EchoService', 'Echo', { message: 'hello' }, 'minimal');
  });

  it('uses selected minimal/full mode for open in tab payload', async () => {
    const onOpenInTab = vi.fn();
    render(
      <GrpcSchemaBrowser
        descriptor={FIXTURE_DESCRIPTOR}
        targetAddress="localhost:50051"
        onOpenInTab={onOpenInTab}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-schema-tree-node-method--echo-echoservice--serverstream'));
    fireEvent.click(screen.getByTestId('grpc-schema-open-tab-btn'));
    expect(onOpenInTab).toHaveBeenNthCalledWith(
      1,
      'echo.EchoService',
      'ServerStream',
      { message: 'hello' },
      'minimal',
    );

    await clickByTestIdAsync('grpc-schema-copy-mode-full');
    fireEvent.click(screen.getByTestId('grpc-schema-open-tab-btn'));
    expect(onOpenInTab).toHaveBeenNthCalledWith(
      2,
      'echo.EchoService',
      'ServerStream',
      { interval_ms: 1, message: 'hello', repeat_count: 1 },
      'full',
    );
  });

  it('skips copy grpcurl when target address is missing', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(
      <GrpcSchemaBrowser
        descriptor={FIXTURE_DESCRIPTOR}
        selectedService="echo.EchoService"
        selectedMethod="Echo"
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-schema-tree-node-method--echo-echoservice--echo'));
    await clickByTestIdAsync('grpc-schema-copy-grpcurl-btn');
    expect(writeText).not.toHaveBeenCalled();
  });

  it('renders map field types in message detail tables', () => {
    const descriptorWithMap: GrpcDescriptor = {
      ...FIXTURE_DESCRIPTOR,
      messageTypes: [{
        typeName: 'echo.MapPayload',
        fields: [{
          name: 'counts',
          number: 1,
          type: 'int32',
          label: 'optional',
          isMap: true,
          mapKeyType: 'string',
        }],
      }],
    };

    render(
      <GrpcSchemaBrowser
        descriptor={descriptorWithMap}
        targetAddress="localhost:50051"
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-schema-tree-node-message--echo-mappayload'));
    expect(screen.getByTestId('grpc-schema-field-table').textContent).toMatch(/map<string, int32>/);
  });

  it('navigates to referenced message when field type link is clicked', () => {
    const descriptorWithLinkedType: GrpcDescriptor = {
      ...FIXTURE_DESCRIPTOR,
      messageTypes: [{
        typeName: 'echo.RichPayload',
        fields: [{
          name: 'labels',
          number: 1,
          type: 'message',
          label: 'optional',
          isMap: true,
          mapKeyType: 'string',
          messageTypeName: 'echo.EchoRequest',
        }],
      }],
    };

    render(
      <GrpcSchemaBrowser
        descriptor={descriptorWithLinkedType}
        targetAddress="localhost:50051"
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-schema-tree-node-message--echo-richpayload'));
    fireEvent.click(screen.getByTestId('grpc-schema-field-type-link-echo-echorequest'));

    expect(screen.getByTestId('grpc-schema-message-detail').textContent).toContain('echo.EchoRequest');
  });

  it('shows export busy label on export protoset button', () => {
    render(
      <GrpcSchemaBrowser
        descriptor={FIXTURE_DESCRIPTOR}
        targetAddress="localhost:50051"
        onExportProtoset={vi.fn()}
        exportProtosetBusy
      />,
    );
    expect(screen.getByTestId('grpc-schema-export-protoset-btn').textContent).toMatch(/Exporting/i);
  });

  it('renders map message value types and oneof labels in message detail', () => {
    const descriptorWithRichFields: GrpcDescriptor = {
      ...FIXTURE_DESCRIPTOR,
      messageTypes: [{
        typeName: 'echo.RichPayload',
        fields: [{
          name: 'labels',
          number: 1,
          type: 'message',
          label: 'optional',
          isMap: true,
          mapKeyType: 'string',
          messageTypeName: 'echo.EchoRequest',
        }, {
          name: 'mode',
          number: 2,
          type: 'enum',
          label: 'optional',
          isOneofMember: true,
          oneofName: 'choice',
          enumTypeName: 'echo.Status',
          enumValues: [{ name: 'OK', number: 0 }],
        }],
      }],
    };

    render(
      <GrpcSchemaBrowser
        descriptor={descriptorWithRichFields}
        targetAddress="localhost:50051"
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-schema-tree-node-message--echo-richpayload'));
    const tableText = screen.getByTestId('grpc-schema-field-table').textContent ?? '';
    expect(tableText).toMatch(/map<string, echo\.EchoRequest>/);
    expect(tableText).toMatch(/oneof choice/);
  });

    it('builds minimal and full payload templates for mixed scalar, enum, map, repeated, and nested fields', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText } });
      const onOpenInTab = vi.fn();

      const descriptorWithComplexRequest: GrpcDescriptor = {
        ...FIXTURE_DESCRIPTOR,
        enumTypes: [
          ...(FIXTURE_DESCRIPTOR.enumTypes ?? []),
          {
            typeName: 'echo.Mode',
            values: [
              { name: 'MODE_UNSPECIFIED', number: 0 },
              { name: 'MODE_FAST', number: 1 },
            ],
          },
        ],
        messageTypes: [
          ...(FIXTURE_DESCRIPTOR.messageTypes ?? []),
          {
            typeName: 'echo.NestedMeta',
            fields: [{ name: 'name', number: 1, type: 'string', label: 'optional' }],
          },
          {
            typeName: 'echo.ComplexRequest',
            fields: [
              { name: 'id', number: 1, type: 'string', label: 'optional' },
              { name: 'payload', number: 2, type: 'bytes', label: 'optional' },
              { name: 'enabled', number: 3, type: 'bool', label: 'optional' },
              { name: 'count', number: 4, type: 'int32', label: 'optional' },
              { name: 'total64', number: 5, type: 'int64', label: 'optional' },
              { name: 'tags', number: 6, type: 'string', label: 'repeated' },
              {
                name: 'mode',
                number: 7,
                type: 'enum',
                label: 'optional',
                enumTypeName: 'echo.Mode',
                enumValues: [{ name: 'MODE_UNSPECIFIED', number: 0 }],
              },
              {
                name: 'meta',
                number: 8,
                type: 'message',
                label: 'optional',
                messageTypeName: 'echo.NestedMeta',
              },
              {
                name: 'attrs',
                number: 9,
                type: 'string',
                label: 'optional',
                isMap: true,
                mapKeyType: 'string',
              },
            ],
          },
        ],
        services: [
          ...(FIXTURE_DESCRIPTOR.services ?? []),
          {
            fullName: 'echo.ComplexService',
            methods: [{
              name: 'Complex',
              callType: 'unary',
              requestTypeName: 'echo.ComplexRequest',
              responseTypeName: 'echo.EchoResponse',
              requestSchema: { typeName: 'echo.ComplexRequest', fields: [] },
              responseSchema: { typeName: 'echo.EchoResponse', fields: [] },
            }],
          },
        ],
      };

      render(
        <GrpcSchemaBrowser
          descriptor={descriptorWithComplexRequest}
          targetAddress="localhost:50051"
          onOpenInTab={onOpenInTab}
        />,
      );

      fireEvent.click(screen.getByTestId('grpc-schema-tree-node-method--echo-complexservice--complex'));

      await clickByTestIdAsync('grpc-schema-copy-grpcurl-btn');
      await vi.waitFor(() => {
        expect(writeText).toHaveBeenCalled();
      });
      expect(writeText).toHaveBeenLastCalledWith(expect.stringContaining('"id":"A-100"'));

      await clickByTestIdAsync('grpc-schema-copy-mode-full');
      await clickByTestIdAsync('grpc-schema-copy-grpcurl-btn');
      await vi.waitFor(() => {
        expect(writeText).toHaveBeenCalledTimes(2);
      });
      expect(writeText).toHaveBeenLastCalledWith(expect.stringContaining('"enabled":true'));
      expect(writeText).toHaveBeenLastCalledWith(expect.stringContaining('"count":1'));
      expect(writeText).toHaveBeenLastCalledWith(expect.stringContaining('"total64":"1"'));
      expect(writeText).toHaveBeenLastCalledWith(expect.stringContaining('"tags":[]'));
      expect(writeText).toHaveBeenLastCalledWith(expect.stringContaining('"mode":0'));

      fireEvent.click(screen.getByTestId('grpc-schema-open-tab-btn'));
      expect(onOpenInTab).toHaveBeenCalledWith(
        'echo.ComplexService',
        'Complex',
        expect.objectContaining({
          enabled: true,
          tags: [],
        }),
        'full',
      );
    });

    it('navigates using service response type links', () => {
      render(
        <GrpcSchemaBrowser
          descriptor={FIXTURE_DESCRIPTOR}
          targetAddress="localhost:50051"
        />,
      );

      fireEvent.click(screen.getByTestId('grpc-schema-tree-node-service--echo-echoservice'));
      fireEvent.click(screen.getAllByTestId('grpc-schema-service-type-link-echo-echoresponse')[0]!);
      expect(screen.getByTestId('grpc-schema-message-detail').textContent).toContain('echo.EchoResponse');
    });

    it('handles grpcurl copy failure and auto-clears feedback state', async () => {
      vi.useFakeTimers();
      const writeText = vi.fn().mockRejectedValue(new Error('clipboard denied'));
      Object.assign(navigator, { clipboard: { writeText } });

      render(
        <GrpcSchemaBrowser
          descriptor={FIXTURE_DESCRIPTOR}
          targetAddress="localhost:50051"
        />,
      );

      fireEvent.click(screen.getByTestId('grpc-schema-tree-node-method--echo-echoservice--echo'));
      await clickByTestIdAsync('grpc-schema-copy-grpcurl-btn');

      await vi.waitFor(() => {
        expect(screen.getByTestId('grpc-schema-copy-feedback').textContent).toContain('Copy failed');
      });
      vi.useRealTimers();
    });

    it('shows Windows install hint variant and supports re-selecting minimal mode', async () => {
      const platformDescriptor = Object.getOwnPropertyDescriptor(window.navigator, 'platform');
      Object.defineProperty(window.navigator, 'platform', { value: 'Win32', configurable: true });

      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText } });
      sessionStorage.removeItem('grpc-schema-copy-grpcurl-hint-seen');

      render(
        <GrpcSchemaBrowser
          descriptor={FIXTURE_DESCRIPTOR}
          targetAddress="localhost:50051"
        />,
      );

      fireEvent.click(screen.getByTestId('grpc-schema-tree-node-method--echo-echoservice--echo'));
      await clickByTestIdAsync('grpc-schema-copy-mode-full');
      fireEvent.click(screen.getByTestId('grpc-schema-copy-mode-minimal'));
      await clickByTestIdAsync('grpc-schema-copy-grpcurl-btn');

      await vi.waitFor(() => {
        expect(screen.getByTestId('grpc-schema-copy-feedback').textContent).toContain('Copied');
      });
      expect(screen.getByTestId('grpc-schema-copy-install-options').textContent).toContain('Install grpcurl (Windows)');

      if (platformDescriptor) {
        Object.defineProperty(window.navigator, 'platform', platformDescriptor);
      }
    });

    it('keeps current detail when navigating to a missing linked type', () => {
      const descriptorWithMissingLinkedType: GrpcDescriptor = {
        ...FIXTURE_DESCRIPTOR,
        messageTypes: [{
          typeName: 'echo.BrokenRef',
          fields: [{
            name: 'missing',
            number: 1,
            type: 'message',
            label: 'optional',
            messageTypeName: 'echo.DoesNotExist',
          }],
        }],
      };

      render(
        <GrpcSchemaBrowser
          descriptor={descriptorWithMissingLinkedType}
          targetAddress="localhost:50051"
        />,
      );

      fireEvent.click(screen.getByTestId('grpc-schema-tree-node-message--echo-brokenref'));
      fireEvent.click(screen.getByTestId('grpc-schema-field-type-link-echo-doesnotexist'));
      expect(screen.getByTestId('grpc-schema-message-detail').textContent).toContain('echo.BrokenRef');
    });
});
