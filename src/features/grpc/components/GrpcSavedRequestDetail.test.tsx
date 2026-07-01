/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createGrpcSavedRequestFromSnapshot } from '../../../shared/grpc/grpcSavedRequest';
import { FIXTURE_UNARY_CALL_REQUEST } from '../../../shared/grpc/contractFixtures';
import { GrpcSavedRequestDetail } from './GrpcSavedRequestDetail';

const TS = '2026-06-29T12:00:00.000Z';

function makeSaved() {
  return createGrpcSavedRequestFromSnapshot(
    {
      tabId: 'tab-1',
      requestId: 'req-1',
      capturedAt: TS,
      callType: 'unary',
      target: FIXTURE_UNARY_CALL_REQUEST.target,
      service: FIXTURE_UNARY_CALL_REQUEST.service,
      method: FIXTURE_UNARY_CALL_REQUEST.method,
      body: { message: 'hello' },
      metadata: { 'x-test': '1' },
      timeoutMs: 30_000,
      descriptorKey: 'desc-1',
    },
    { id: 'sr-1', revisionId: 'rev-1', updatedAt: TS, name: 'My Echo' },
  );
}

describe('GrpcSavedRequestDetail (Phase 5H)', () => {
  it('shows empty state when no selection', () => {
    render(
      <GrpcSavedRequestDetail
        saved={null}
        grpcurlCommand=""
        onOpenInStudio={vi.fn()}
        onCopyGrpcurl={vi.fn()}
        onDuplicate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText(/Select a saved request/)).toBeTruthy();
  });

  it('renders saved request preview and action buttons', () => {
    const onOpenInStudio = vi.fn();
    render(
      <GrpcSavedRequestDetail
        saved={makeSaved()}
        grpcurlCommand="grpcurl -plaintext localhost:50051 echo.EchoService/Echo"
        onOpenInStudio={onOpenInStudio}
        onCopyGrpcurl={vi.fn()}
        onDuplicate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText('My Echo')).toBeTruthy();
    fireEvent.click(screen.getByTestId('grpc-saved-request-open-studio'));
    expect(onOpenInStudio).toHaveBeenCalled();
  });

  it('renders response snapshot panel for unary saved requests when baseline handlers are provided', () => {
    const saved = makeSaved();
    render(
      <GrpcSavedRequestDetail
        saved={saved}
        grpcurlCommand="grpcurl -plaintext localhost:50051 echo.EchoService/Echo"
        onOpenInStudio={vi.fn()}
        onCopyGrpcurl={vi.fn()}
        onDuplicate={vi.fn()}
        onDelete={vi.fn()}
        onUpdateResponseBaseline={vi.fn()}
        onClearResponseBaseline={vi.fn()}
      />,
    );

    expect(screen.getByTestId('grpc-response-snapshot-panel')).toBeTruthy();
    expect(screen.getByTestId('grpc-snapshot-badge-none')).toBeTruthy();
  });
});
