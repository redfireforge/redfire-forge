/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GrpcGrpcurlImportModal } from './GrpcGrpcurlImportModal';

describe('GrpcGrpcurlImportModal (Phase 5H)', () => {
  it('shows parse error for invalid command', () => {
    render(<GrpcGrpcurlImportModal open onClose={vi.fn()} onImport={vi.fn()} />);
    fireEvent.change(screen.getByTestId('grpc-import-grpcurl-textarea'), {
      target: { value: 'not-a-grpcurl-command' },
    });
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByTestId('grpc-import-grpcurl-submit')).toHaveProperty('disabled', true);
  });

  it('previews valid command and imports on submit', () => {
    const onImport = vi.fn();
    const onClose = vi.fn();
    render(<GrpcGrpcurlImportModal open onClose={onClose} onImport={onImport} />);

    fireEvent.change(screen.getByTestId('grpc-import-grpcurl-textarea'), {
      target: { value: 'grpcurl -plaintext localhost:50051 echo.EchoService/Echo' },
    });

    expect(screen.getByTestId('grpc-import-grpcurl-preview').textContent).toContain('echo.EchoService');
    fireEvent.click(screen.getByTestId('grpc-import-grpcurl-submit'));

    expect(onImport).toHaveBeenCalledWith(expect.objectContaining({
      ok: true,
      serviceFullName: 'echo.EchoService',
      methodName: 'Echo',
    }));
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<GrpcGrpcurlImportModal open onClose={onClose} onImport={vi.fn()} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
