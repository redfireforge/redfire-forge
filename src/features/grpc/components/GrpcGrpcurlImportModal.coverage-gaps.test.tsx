/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GrpcGrpcurlImportModal } from './GrpcGrpcurlImportModal';

describe('GrpcGrpcurlImportModal coverage gaps', () => {
  it('returns null when closed', () => {
    const { container } = render(
      <GrpcGrpcurlImportModal open={false} onClose={vi.fn()} onImport={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('resets command and errors when reopened', () => {
    const { rerender } = render(
      <GrpcGrpcurlImportModal open onClose={vi.fn()} onImport={vi.fn()} />,
    );
    fireEvent.change(screen.getByTestId('grpc-import-grpcurl-textarea'), {
      target: { value: 'not-a-grpcurl-command' },
    });
    expect(screen.getByRole('alert')).toBeTruthy();

    rerender(<GrpcGrpcurlImportModal open={false} onClose={vi.fn()} onImport={vi.fn()} />);
    rerender(<GrpcGrpcurlImportModal open onClose={vi.fn()} onImport={vi.fn()} />);

    expect((screen.getByTestId('grpc-import-grpcurl-textarea') as HTMLTextAreaElement).value).toBe('');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows parser warnings for descriptor flags', () => {
    render(<GrpcGrpcurlImportModal open onClose={vi.fn()} onImport={vi.fn()} />);
    fireEvent.change(screen.getByTestId('grpc-import-grpcurl-textarea'), {
      target: { value: 'grpcurl -proto echo.proto -plaintext localhost:50051 echo.EchoService/Echo' },
    });
    expect(screen.getByTestId('grpc-import-grpcurl-warnings').textContent).toMatch(/Descriptor flags/i);
  });

  it('closes via Cancel button', () => {
    const onClose = vi.fn();
    render(<GrpcGrpcurlImportModal open onClose={onClose} onImport={vi.fn()} />);
    fireEvent.click(screen.getByTestId('grpc-import-grpcurl-cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('does not import when submit clicked without valid parse', () => {
    const onImport = vi.fn();
    render(<GrpcGrpcurlImportModal open onClose={vi.fn()} onImport={onImport} />);
    fireEvent.click(screen.getByTestId('grpc-import-grpcurl-submit'));
    expect(onImport).not.toHaveBeenCalled();
  });
});
