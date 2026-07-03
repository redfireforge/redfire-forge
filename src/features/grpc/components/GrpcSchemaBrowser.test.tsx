/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FIXTURE_DESCRIPTOR } from '../../../shared/grpc/contractFixtures';
import { GrpcSchemaBrowser } from './GrpcSchemaBrowser';

describe('GrpcSchemaBrowser', () => {
  it('renders tree and method detail with signature', () => {
    render(
      <GrpcSchemaBrowser
        descriptor={FIXTURE_DESCRIPTOR}
        targetAddress="localhost:50051"
        selectedService="echo.EchoService"
        selectedMethod="Echo"
      />,
    );

    expect(screen.getByTestId('grpc-schema-browser')).toBeTruthy();
    expect(screen.getByTestId('grpc-schema-method-signature').textContent).toContain('rpc Echo');
    expect(screen.getAllByTestId('grpc-schema-field-table').length).toBeGreaterThan(0);
  });

  it('copies grpcurl command for selected method', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(
      <GrpcSchemaBrowser
        descriptor={FIXTURE_DESCRIPTOR}
        targetAddress="localhost:50051"
        selectedService="echo.EchoService"
        selectedMethod="Echo"
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-schema-copy-grpcurl-btn'));
    expect(writeText).toHaveBeenCalledWith(
      'grpcurl -plaintext -d \'{"message":"hello"}\' localhost:50051 echo.EchoService/Echo',
    );
  });

  it('calls onOpenInTab when open in tab is clicked', () => {
    const onOpenInTab = vi.fn();
    render(
      <GrpcSchemaBrowser
        descriptor={FIXTURE_DESCRIPTOR}
        targetAddress="localhost:50051"
        selectedService="echo.EchoService"
        selectedMethod="Echo"
        onOpenInTab={onOpenInTab}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-schema-open-tab-btn'));
    expect(onOpenInTab).toHaveBeenCalledWith('echo.EchoService', 'Echo', { message: 'hello' }, 'minimal');
  });

  it('filters nodes via search input', () => {
    render(
      <GrpcSchemaBrowser
        descriptor={FIXTURE_DESCRIPTOR}
        targetAddress="localhost:50051"
      />,
    );

    fireEvent.change(screen.getByTestId('grpc-schema-browser-search'), {
      target: { value: 'BidiStream' },
    });
    expect(screen.getByTestId('grpc-schema-browser-tree').textContent).toContain('BidiStream');
  });

  it('shows catalog fields on method detail when messageTypes is richer than RPC embed', () => {
    const descriptor = {
      ...FIXTURE_DESCRIPTOR,
      messageTypes: [
        {
          typeName: 'echo.EchoRequest',
          fields: [
            { name: 'message', number: 1, type: 'string' as const, label: 'optional' as const },
            { name: 'extra', number: 2, type: 'string' as const, label: 'optional' as const },
          ],
        },
      ],
    };

    render(
      <GrpcSchemaBrowser
        descriptor={descriptor}
        targetAddress="localhost:50051"
        selectedService="echo.EchoService"
        selectedMethod="Echo"
      />,
    );

    const tables = screen.getAllByTestId('grpc-schema-field-table');
    const requestTable = tables.find((table) => table.textContent?.includes('extra'));
    expect(requestTable).toBeTruthy();
  });

  it('shows empty tree message when search has no matches', () => {
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

  it('clears stale selection when descriptor no longer contains the node', () => {
    const { rerender } = render(
      <GrpcSchemaBrowser
        descriptor={FIXTURE_DESCRIPTOR}
        targetAddress="localhost:50051"
        selectedService="echo.EchoService"
        selectedMethod="Echo"
      />,
    );

    expect(screen.getByTestId('grpc-schema-method-detail')).toBeTruthy();

    rerender(
      <GrpcSchemaBrowser
        descriptor={{ ...FIXTURE_DESCRIPTOR, services: [] }}
        targetAddress="localhost:50051"
      />,
    );

    expect(screen.getByTestId('grpc-schema-detail-empty')).toBeTruthy();
  });

  it('preserves message selection when descriptor reloads with same explorer binding', () => {
    const { rerender } = render(
      <GrpcSchemaBrowser
        descriptor={FIXTURE_DESCRIPTOR}
        targetAddress="localhost:50051"
        selectedService="echo.EchoService"
        selectedMethod="Echo"
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-schema-tree-node-message--echo-echorequest'));
    expect(screen.getByTestId('grpc-schema-message-detail')).toBeTruthy();

    rerender(
      <GrpcSchemaBrowser
        descriptor={{ ...FIXTURE_DESCRIPTOR, key: 'reflection:localhost:50051:reload' }}
        targetAddress="localhost:50051"
        selectedService="echo.EchoService"
        selectedMethod="Echo"
      />,
    );

    expect(screen.getByTestId('grpc-schema-message-detail')).toBeTruthy();
    expect(screen.queryByTestId('grpc-schema-method-detail')).toBeNull();
  });

  it('preserves browser method selection when it differs from explorer binding', () => {
    const { rerender } = render(
      <GrpcSchemaBrowser
        descriptor={FIXTURE_DESCRIPTOR}
        targetAddress="localhost:50051"
        selectedService="echo.EchoService"
        selectedMethod="Echo"
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-schema-tree-node-method--echo-echoservice--serverstream'));
    expect(screen.getByTestId('grpc-schema-method-signature').textContent).toContain('ServerStream');

    rerender(
      <GrpcSchemaBrowser
        descriptor={{ ...FIXTURE_DESCRIPTOR, key: 'reflection:localhost:50051:reload' }}
        targetAddress="localhost:50051"
        selectedService="echo.EchoService"
        selectedMethod="Echo"
      />,
    );

    expect(screen.getByTestId('grpc-schema-method-signature').textContent).toContain('ServerStream');
  });

  it('re-syncs to explorer method when binding changes while viewing a message', () => {
    const { rerender } = render(
      <GrpcSchemaBrowser
        descriptor={FIXTURE_DESCRIPTOR}
        targetAddress="localhost:50051"
        selectedService="echo.EchoService"
        selectedMethod="Echo"
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-schema-tree-node-message--echo-echorequest'));
    expect(screen.getByTestId('grpc-schema-message-detail')).toBeTruthy();

    rerender(
      <GrpcSchemaBrowser
        descriptor={FIXTURE_DESCRIPTOR}
        targetAddress="localhost:50051"
        selectedService="echo.EchoService"
        selectedMethod="ServerStream"
      />,
    );

    expect(screen.getByTestId('grpc-schema-method-signature').textContent).toContain('ServerStream');
    expect(screen.queryByTestId('grpc-schema-message-detail')).toBeNull();
  });

  it('clears search filter when descriptor identity changes', () => {
    const { rerender } = render(
      <GrpcSchemaBrowser
        descriptor={FIXTURE_DESCRIPTOR}
        targetAddress="localhost:50051"
      />,
    );

    fireEvent.change(screen.getByTestId('grpc-schema-browser-search'), {
      target: { value: 'zzznomatch' },
    });
    expect(screen.getByTestId('grpc-schema-tree-empty')).toBeTruthy();

    rerender(
      <GrpcSchemaBrowser
        descriptor={{ ...FIXTURE_DESCRIPTOR, key: 'reflection:localhost:50051:reload' }}
        targetAddress="localhost:50051"
      />,
    );

    expect(screen.queryByTestId('grpc-schema-tree-empty')).toBeNull();
    expect(screen.getByTestId('grpc-schema-browser-search')).toHaveProperty('value', '');
  });
});
