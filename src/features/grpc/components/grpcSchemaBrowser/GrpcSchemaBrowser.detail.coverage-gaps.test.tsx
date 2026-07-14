/**
 * @vitest-environment jsdom
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FIXTURE_DESCRIPTOR } from '../../../../shared/grpc/contractFixtures';
import type { GrpcDescriptor } from '../../../../shared/grpc/contracts';
import * as schemaModel from '../../utils/grpcSchemaBrowserModel';
import { GrpcSchemaBrowser } from '../GrpcSchemaBrowser';
import { clickByTestIdAsync } from './grpcSchemaBrowserCoverageGaps.testHelpers';

describe('GrpcSchemaBrowser coverage gaps — detail rendering', () => {
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

    await clickByTestIdAsync('grpc-schema-copy-grpcurl-btn');
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

  it('clears copied feedback after timeout callback runs', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
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
      expect(screen.getByTestId('grpc-schema-copy-feedback').textContent).toContain('Copied');
    });

    await act(async () => {
      vi.advanceTimersByTime(2700);
      await Promise.resolve();
    });

    expect(screen.queryByTestId('grpc-schema-copy-feedback')).toBeNull();
    vi.useRealTimers();
  });

  it('shows generic install hint variant on non-mac and non-windows platforms', async () => {
    const platformDescriptor = Object.getOwnPropertyDescriptor(window.navigator, 'platform');
    Object.defineProperty(window.navigator, 'platform', { value: 'Linux x86_64', configurable: true });

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

    await clickByTestIdAsync('grpc-schema-copy-grpcurl-btn');
    await vi.waitFor(() => {
      expect(screen.getByTestId('grpc-schema-copy-feedback').textContent).toContain('Copied');
    });
    expect(screen.getByTestId('grpc-schema-copy-install-options').textContent)
      .toContain('Install grpcurl: use your distro package or official release');

    if (platformDescriptor) {
      Object.defineProperty(window.navigator, 'platform', platformDescriptor);
    }
  });

  it('builds full payloads for recursive messages, oneof groups, and unresolved message refs', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    const recursiveDescriptor: GrpcDescriptor = {
      ...FIXTURE_DESCRIPTOR,
      messageTypes: [
        ...(FIXTURE_DESCRIPTOR.messageTypes ?? []),
        {
          typeName: 'echo.RecursiveRequest',
          fields: [
            {
              name: 'self',
              number: 1,
              type: 'message',
              label: 'optional',
              messageTypeName: 'echo.RecursiveRequest',
            },
            {
              name: 'ghost',
              number: 2,
              type: 'message',
              label: 'optional',
            },
            {
              name: 'choice_a',
              number: 3,
              type: 'string',
              label: 'optional',
              isOneofMember: true,
              oneofName: 'choice',
            },
            {
              name: 'choice_b',
              number: 4,
              type: 'string',
              label: 'optional',
              isOneofMember: true,
              oneofName: 'choice',
            },
          ],
        },
      ],
      services: [
        ...(FIXTURE_DESCRIPTOR.services ?? []),
        {
          fullName: 'echo.RecursiveService',
          methods: [
            {
              name: 'EchoRecursive',
              callType: 'unary',
              requestTypeName: 'echo.RecursiveRequest',
              responseTypeName: 'echo.EchoResponse',
              requestSchema: { typeName: 'echo.RecursiveRequest', fields: [] },
              responseSchema: { typeName: 'echo.EchoResponse', fields: [] },
            },
          ],
        },
      ],
    };

    render(
      <GrpcSchemaBrowser
        descriptor={recursiveDescriptor}
        targetAddress="localhost:50051"
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-schema-tree-node-method--echo-recursiveservice--echorecursive'));
    await clickByTestIdAsync('grpc-schema-copy-mode-full');
    await clickByTestIdAsync('grpc-schema-copy-grpcurl-btn');

    await vi.waitFor(() => {
      expect(writeText).toHaveBeenCalled();
    });
    const command = String(writeText.mock.calls.at(-1)?.[0] ?? '');
    expect(command).toContain('"self":{}');
    expect(command).toContain('"ghost":null');
    expect(command).toContain('"choice_a":"string"');
    expect(command).not.toContain('"choice_b":"string"');
  });
});
