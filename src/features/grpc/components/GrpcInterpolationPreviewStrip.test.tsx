/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GrpcInterpolationPreviewStrip } from './GrpcInterpolationPreviewStrip';

describe('GrpcInterpolationPreviewStrip (Phase 9G)', () => {
  it('renders template and resolved toggle with active state', async () => {
    const user = userEvent.setup();
    const onViewModeChange = vi.fn();
    render(
      <GrpcInterpolationPreviewStrip
        showToggle
        displayValue="{{grpcHost}}"
        viewMode="template"
        status="ready"
        onViewModeChange={onViewModeChange}
      />,
    );
    const templateBtn = screen.getByTestId('grpc-interpolation-preview-template');
    const resolvedBtn = screen.getByTestId('grpc-interpolation-preview-resolved');
    expect(templateBtn.getAttribute('aria-pressed')).toBe('true');
    expect(resolvedBtn.getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByTestId('grpc-interpolation-preview-value').textContent).toBe('{{grpcHost}}');

    await user.click(resolvedBtn);
    expect(onViewModeChange).toHaveBeenCalledWith('resolved');
  });

  it('hides toggle when showToggle is false but still shows value', () => {
    render(
      <GrpcInterpolationPreviewStrip
        showToggle={false}
        displayValue="localhost:50051"
        viewMode="resolved"
        status="ready"
        onViewModeChange={() => {}}
      />,
    );
    expect(screen.queryByTestId('grpc-interpolation-preview-template')).toBeNull();
    expect(screen.getByTestId('grpc-interpolation-preview-value').textContent).toBe('localhost:50051');
  });

  it('returns null when nothing to show', () => {
    const { container } = render(
      <GrpcInterpolationPreviewStrip
        showToggle={false}
        displayValue=""
        viewMode="template"
        status="ready"
        onViewModeChange={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('switches back to template mode from resolved view', async () => {
    const user = userEvent.setup();
    const onViewModeChange = vi.fn();
    render(
      <GrpcInterpolationPreviewStrip
        showToggle
        displayValue="localhost:50051"
        viewMode="resolved"
        status="ready"
        onViewModeChange={onViewModeChange}
      />,
    );
    await user.click(screen.getByTestId('grpc-interpolation-preview-template'));
    expect(onViewModeChange).toHaveBeenCalledWith('template');
  });
});
