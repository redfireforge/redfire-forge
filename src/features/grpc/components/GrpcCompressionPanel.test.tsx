/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GrpcCompressionPanel } from './GrpcCompressionPanel';

describe('GrpcCompressionPanel (Phase 4J-D)', () => {
  it('renders disabled preview when compression off', () => {
    render(
      <GrpcCompressionPanel
        compression={{ enabled: false, algorithm: 'gzip' }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('grpc-compression-panel')).toBeTruthy();
    expect(screen.getByTestId('grpc-compression-preview').textContent).toMatch(/disabled/i);
  });

  it('shows effective headers when enabled', () => {
    render(
      <GrpcCompressionPanel
        compression={{ enabled: true, algorithm: 'gzip' }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('grpc-compression-preview').textContent).toContain('grpc-encoding: gzip');
  });

  it('toggles compression enabled', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <GrpcCompressionPanel
        compression={{ enabled: false, algorithm: 'gzip' }}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByTestId('grpc-compression-enabled'));
    expect(onChange).toHaveBeenCalledWith({ enabled: true, algorithm: 'gzip' });
  });

  it('shows disabled preview when identity algorithm is selected', () => {
    render(
      <GrpcCompressionPanel
        compression={{ enabled: true, algorithm: 'identity' }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('grpc-compression-preview').textContent).toMatch(/disabled/i);
  });

  it('changes algorithm when enabled', () => {
    const onChange = vi.fn();
    render(
      <GrpcCompressionPanel
        compression={{ enabled: true, algorithm: 'gzip' }}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByTestId('grpc-compression-algorithm'), {
      target: { value: 'deflate' },
    });
    expect(onChange).toHaveBeenCalledWith({ enabled: true, algorithm: 'deflate' });
  });
});
