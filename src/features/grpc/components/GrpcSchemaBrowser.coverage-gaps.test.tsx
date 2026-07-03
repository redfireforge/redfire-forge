/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FIXTURE_DESCRIPTOR } from '../../../shared/grpc/contractFixtures';
import type { GrpcDescriptor } from '../../../shared/grpc/contracts';
import * as schemaModel from '../utils/grpcSchemaBrowserModel';
import { GrpcSchemaBrowser } from './GrpcSchemaBrowser';

const DESCRIPTOR_WITH_ENUM: GrpcDescriptor = {
  ...FIXTURE_DESCRIPTOR,
  enumTypes: [
    {
      typeName: 'echo.Status',
      docComment: 'Serving state for echo workers',
      values: [
        { name: 'UNKNOWN', number: 0 },
        { name: 'SERVING', number: 1, docComment: 'Ready to accept RPCs' },
      ],
    },
  ],
};

describe('GrpcSchemaBrowser coverage gaps', () => {
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
    fireEvent.click(screen.getByTestId('grpc-schema-copy-grpcurl-btn'));
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
    fireEvent.click(screen.getByTestId('grpc-schema-copy-grpcurl-btn'));

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

    fireEvent.click(screen.getByTestId('grpc-schema-copy-grpcurl-btn'));
    await vi.waitFor(() => {
      expect(writeText).toHaveBeenCalled();
    });
    expect(writeText).toHaveBeenLastCalledWith(expect.stringContaining('"message":"hello"'));
    expect(writeText).not.toHaveBeenLastCalledWith(expect.stringContaining('"repeatCount":1'));

    fireEvent.click(screen.getByTestId('grpc-schema-copy-mode-full'));
    fireEvent.click(screen.getByTestId('grpc-schema-copy-grpcurl-btn'));
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

  it('uses selected minimal/full mode for open in tab payload', () => {
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

    fireEvent.click(screen.getByTestId('grpc-schema-copy-mode-full'));
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
    fireEvent.click(screen.getByTestId('grpc-schema-copy-grpcurl-btn'));
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

  it('renders method doc comments in method detail', () => {
    const descriptorWithDoc: GrpcDescriptor = {
      ...FIXTURE_DESCRIPTOR,
      services: FIXTURE_DESCRIPTOR.services.map((service) => ({
        ...service,
        methods: service.methods.map((method) => (
          method.name === 'Echo'
            ? { ...method, docComment: 'Unary echo for coverage' }
            : method
        )),
      })),
    };

    render(
      <GrpcSchemaBrowser
        descriptor={descriptorWithDoc}
        targetAddress="localhost:50051"
        selectedService="echo.EchoService"
        selectedMethod="Echo"
      />,
    );

    expect(screen.getByText('Unary echo for coverage')).toBeTruthy();
  });

  it('shows stream response labels in service detail table', () => {
    render(
      <GrpcSchemaBrowser
        descriptor={FIXTURE_DESCRIPTOR}
        targetAddress="localhost:50051"
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-schema-tree-node-service--echo-echoservice'));
    expect(screen.getByTestId('grpc-schema-service-methods-table').textContent).toMatch(/stream echo\.EchoResponse/);
  });

  it('shows fallback detail for orphaned schema nodes', () => {
    const originalFind = schemaModel.findSchemaBrowserNode;
    const findSpy = vi.spyOn(schemaModel, 'findSchemaBrowserNode').mockImplementation((tree, nodeId) => {
      if (nodeId === 'message--echo-echorequest') {
        return { id: 'message--echo-echorequest', kind: 'message', label: 'GhostMessage' };
      }
      return originalFind(tree, nodeId);
    });

    render(
      <GrpcSchemaBrowser
        descriptor={FIXTURE_DESCRIPTOR}
        targetAddress="localhost:50051"
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-schema-tree-node-message--echo-echorequest'));
    expect(screen.getByTestId('grpc-schema-detail-empty').textContent)
      .toMatch(/not available in the loaded descriptor/i);

    findSpy.mockRestore();
  });

  it('renders enum value names in field docs when docComment is absent', () => {
    const descriptorWithEnumField: GrpcDescriptor = {
      ...FIXTURE_DESCRIPTOR,
      messageTypes: [{
        typeName: 'echo.EnumPayload',
        fields: [{
          name: 'status',
          number: 1,
          type: 'enum',
          label: 'optional',
          enumTypeName: 'echo.Status',
          enumValues: [{ name: 'OK', number: 0 }, { name: 'FAIL', number: 1 }],
        }],
      }],
    };

    render(
      <GrpcSchemaBrowser
        descriptor={descriptorWithEnumField}
        targetAddress="localhost:50051"
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-schema-tree-node-message--echo-enumpayload'));
    expect(screen.getByTestId('grpc-schema-field-table').textContent).toMatch(/OK \| FAIL/);
  });

  it('pins browser selection when method differs from explorer binding', () => {
    const onSelectMethod = vi.fn();
    render(
      <GrpcSchemaBrowser
        descriptor={FIXTURE_DESCRIPTOR}
        targetAddress="localhost:50051"
        selectedService="echo.EchoService"
        selectedMethod="Echo"
        onSelectMethod={onSelectMethod}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-schema-tree-node-method--echo-echoservice--serverstream'));
    expect(onSelectMethod).toHaveBeenCalledWith('echo.EchoService', 'ServerStream');
  });

  it('keeps explorer-aligned method selection unpinned when method matches binding', () => {
    const onSelectMethod = vi.fn();
    render(
      <GrpcSchemaBrowser
        descriptor={FIXTURE_DESCRIPTOR}
        targetAddress="localhost:50051"
        selectedService="echo.EchoService"
        selectedMethod="Echo"
        onSelectMethod={onSelectMethod}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-schema-tree-node-method--echo-echoservice--echo'));
    expect(onSelectMethod).toHaveBeenCalledWith('echo.EchoService', 'Echo');
  });

  it('shows client streaming response types without stream prefix', () => {
    render(
      <GrpcSchemaBrowser
        descriptor={FIXTURE_DESCRIPTOR}
        targetAddress="localhost:50051"
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-schema-tree-node-service--echo-echoservice'));
    const rows = screen.getAllByRole('row');
    const clientRow = rows.find((row) => row.textContent?.includes('ClientStream'));
    expect(clientRow?.textContent).toContain('echo.EchoResponse');
    expect(clientRow?.textContent).not.toMatch(/stream echo\.EchoResponse/);
  });

  it('copies grpcurl with tls export context metadata', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(
      <GrpcSchemaBrowser
        descriptor={FIXTURE_DESCRIPTOR}
        targetAddress="localhost:50051"
        tlsMode="mtls"
        selectedService="echo.EchoService"
        selectedMethod="Echo"
        grpcurlExportContext={{
          tlsFilePaths: {
            caCertPath: '/tmp/ca.pem',
            certPath: '/tmp/cert.pem',
            keyPath: '/tmp/key.pem',
          },
          descriptorFlags: {
            protoPaths: [],
            importPaths: [],
            protosetPath: '/tmp/echo.pb',
          },
        }}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-schema-copy-grpcurl-btn'));
    await vi.waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining('-protoset'));
    });
  });

  it('renders plain scalar field types in message tables', () => {
    const descriptorWithScalars: GrpcDescriptor = {
      ...FIXTURE_DESCRIPTOR,
      messageTypes: [{
        typeName: 'echo.ScalarPayload',
        fields: [{ name: 'count', number: 1, type: 'int32', label: 'optional' }],
      }],
    };

    render(
      <GrpcSchemaBrowser
        descriptor={descriptorWithScalars}
        targetAddress="localhost:50051"
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-schema-tree-node-message--echo-scalarpayload'));
    expect(screen.getByTestId('grpc-schema-field-table').textContent).toContain('int32');
  });

  it('shows stale service detail when selected service disappears from descriptor', () => {
    const originalFind = schemaModel.findSchemaBrowserNode;
    const findSpy = vi.spyOn(schemaModel, 'findSchemaBrowserNode').mockImplementation((tree, nodeId) => {
      if (nodeId === 'service--echo-echoservice') {
        return {
          id: 'service--echo-echoservice',
          kind: 'service',
          serviceFullName: 'ghost.MissingService',
          label: 'MissingService',
        };
      }
      return originalFind(tree, nodeId);
    });

    render(
      <GrpcSchemaBrowser
        descriptor={FIXTURE_DESCRIPTOR}
        targetAddress="localhost:50051"
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-schema-tree-node-service--echo-echoservice'));
    expect(screen.getByTestId('grpc-schema-detail-empty').textContent)
      .toMatch(/no longer in the loaded descriptor/i);

    findSpy.mockRestore();
  });

  it('omits field tables for messages without fields', () => {
    const descriptorWithEmptyMessage: GrpcDescriptor = {
      ...FIXTURE_DESCRIPTOR,
      messageTypes: [{ typeName: 'echo.EmptyPayload', fields: [] }],
    };

    render(
      <GrpcSchemaBrowser
        descriptor={descriptorWithEmptyMessage}
        targetAddress="localhost:50051"
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-schema-tree-node-message--echo-emptypayload'));
    expect(screen.getByTestId('grpc-schema-message-detail')).toBeTruthy();
    expect(screen.queryByTestId('grpc-schema-field-table')).toBeNull();
  });

  it('renders field doc comments in message tables', () => {
    const descriptorWithDocs: GrpcDescriptor = {
      ...FIXTURE_DESCRIPTOR,
      messageTypes: [{
        typeName: 'echo.DocumentedPayload',
        fields: [{
          name: 'note',
          number: 1,
          type: 'string',
          label: 'optional',
          docComment: 'Human-readable note',
        }],
      }],
    };

    render(
      <GrpcSchemaBrowser
        descriptor={descriptorWithDocs}
        targetAddress="localhost:50051"
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-schema-tree-node-message--echo-documentedpayload'));
    expect(screen.getByText('Human-readable note')).toBeTruthy();
  });

  it('shows bidi streaming response labels in service detail table', () => {
    render(
      <GrpcSchemaBrowser
        descriptor={FIXTURE_DESCRIPTOR}
        targetAddress="localhost:50051"
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-schema-tree-node-service--echo-echoservice'));
    const tableText = screen.getByTestId('grpc-schema-service-methods-table').textContent ?? '';
    expect(tableText).toMatch(/BidiStream/);
    expect(tableText).toMatch(/stream echo\.EchoResponse/);
  });

  it('renders message and enum doc fallbacks', () => {
    const descriptorWithDocs: GrpcDescriptor = {
      ...FIXTURE_DESCRIPTOR,
      messageTypes: [{
        typeName: 'echo.DocumentedMessage',
        docComment: 'Message-level documentation',
        fields: [],
      }],
      enumTypes: [{
        typeName: 'echo.SimpleStatus',
        values: [{ name: 'OK', number: 0 }],
      }],
    };

    render(
      <GrpcSchemaBrowser
        descriptor={descriptorWithDocs}
        targetAddress="localhost:50051"
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-schema-tree-node-message--echo-documentedmessage'));
    expect(screen.getByText('Message-level documentation')).toBeTruthy();

    fireEvent.click(screen.getByTestId('grpc-schema-tree-node-enum--echo-simplestatus'));
    expect(screen.getByTestId('grpc-schema-enum-detail').textContent).toContain('—');
  });
});
