/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GrpcStudioSubNav } from './GrpcStudioSubNav';

describe('GrpcStudioSubNav (Phase 5H)', () => {
  it('renders tabs and history badge when count > 0', () => {
    render(
      <GrpcStudioSubNav activeView="studio" historyCount={3} onSelect={vi.fn()} />,
    );
    expect(screen.getByTestId('grpc-sub-nav-history-badge').textContent).toBe('3');
    expect(screen.getByTestId('grpc-sub-nav-studio').className).toContain('--active');
  });

  it('calls onSelect when switching views', () => {
    const onSelect = vi.fn();
    render(
      <GrpcStudioSubNav activeView="studio" historyCount={0} onSelect={onSelect} />,
    );
    fireEvent.click(screen.getByTestId('grpc-sub-nav-collections'));
    expect(onSelect).toHaveBeenCalledWith('collections');
    fireEvent.click(screen.getByTestId('grpc-sub-nav-history'));
    expect(onSelect).toHaveBeenCalledWith('history');
    fireEvent.click(screen.getByTestId('grpc-sub-nav-advanced'));
    expect(onSelect).toHaveBeenCalledWith('advanced');
  });

  it('highlights active collections and history tabs', () => {
    const onSelect = vi.fn();
    const { rerender } = render(
      <GrpcStudioSubNav activeView="collections" historyCount={0} onSelect={onSelect} />,
    );
    expect(screen.getByTestId('grpc-sub-nav-collections').className).toContain('--active');
    expect(screen.getByTestId('grpc-sub-nav-collections').getAttribute('aria-selected')).toBe('true');

    fireEvent.click(screen.getByTestId('grpc-sub-nav-studio'));
    expect(onSelect).toHaveBeenCalledWith('studio');

    rerender(
      <GrpcStudioSubNav activeView="history" historyCount={2} onSelect={onSelect} />,
    );
    expect(screen.getByTestId('grpc-sub-nav-history').className).toContain('--active');
    expect(screen.getByTestId('grpc-sub-nav-history-badge').textContent).toBe('2');
  });

  it('highlights active advanced tab (Phase 11G)', () => {
    render(
      <GrpcStudioSubNav activeView="advanced" historyCount={0} onSelect={vi.fn()} />,
    );
    expect(screen.getByTestId('grpc-sub-nav-advanced').className).toContain('--active');
    expect(screen.getByTestId('grpc-sub-nav-advanced').getAttribute('aria-selected')).toBe('true');
  });

  it('hides history badge when count is zero', () => {
    render(
      <GrpcStudioSubNav activeView="history" historyCount={0} onSelect={vi.fn()} />,
    );
    expect(screen.queryByTestId('grpc-sub-nav-history-badge')).toBeNull();
  });
});
