/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import HostSelector from './HostSelector';

describe('HostSelector', () => {
  it('renders all host mode options', () => {
    render(
      <HostSelector
        hostMode="hardcoded"
        onHostModeChange={vi.fn()}
        customBaseUrl=""
        onCustomBaseUrlChange={vi.fn()}
      />
    );
    
    expect(screen.getByLabelText('Original')).toBeInTheDocument();
    expect(screen.getByLabelText(/Settings/)).toBeInTheDocument();
    expect(screen.getByLabelText('Custom')).toBeInTheDocument();
  });

  it('shows resolved base URL when in settings mode', () => {
    render(
      <HostSelector
        hostMode="settings"
        onHostModeChange={vi.fn()}
        customBaseUrl=""
        onCustomBaseUrlChange={vi.fn()}
        resolvedBaseUrl="https://api.example.com"
      />
    );
    
    expect(screen.getByText('https://api.example.com')).toBeInTheDocument();
  });

  it('shows hint when no resolved base URL', () => {
    render(
      <HostSelector
        hostMode="hardcoded"
        onHostModeChange={vi.fn()}
        customBaseUrl=""
        onCustomBaseUrlChange={vi.fn()}
      />
    );
    
    expect(screen.getByText(/configure base URL in Settings first/)).toBeInTheDocument();
  });

  it('calls onHostModeChange for each mode radio', () => {
    const onHostModeChange = vi.fn();
    const { rerender } = render(
      <HostSelector
        hostMode="settings"
        onHostModeChange={onHostModeChange}
        customBaseUrl=""
        onCustomBaseUrlChange={vi.fn()}
        resolvedBaseUrl="https://api.example.com"
      />
    );

    const radios = screen.getAllByRole('radio');
    fireEvent.click(radios[0]);
    expect(onHostModeChange).toHaveBeenLastCalledWith('hardcoded');

    rerender(
      <HostSelector
        hostMode="hardcoded"
        onHostModeChange={onHostModeChange}
        customBaseUrl=""
        onCustomBaseUrlChange={vi.fn()}
        resolvedBaseUrl="https://api.example.com"
      />
    );
    fireEvent.click(screen.getAllByRole('radio')[1]);
    expect(onHostModeChange).toHaveBeenLastCalledWith('settings');

    rerender(
      <HostSelector
        hostMode="hardcoded"
        onHostModeChange={onHostModeChange}
        customBaseUrl=""
        onCustomBaseUrlChange={vi.fn()}
        resolvedBaseUrl="https://api.example.com"
      />
    );
    fireEvent.click(screen.getAllByRole('radio')[2]);
    expect(onHostModeChange).toHaveBeenLastCalledWith('custom');
  });

  it('enables custom URL input only when custom mode is selected', () => {
    const { rerender } = render(
      <HostSelector
        hostMode="hardcoded"
        onHostModeChange={vi.fn()}
        customBaseUrl=""
        onCustomBaseUrlChange={vi.fn()}
      />
    );
    
    const input = screen.getByPlaceholderText('https://my-host.example.com:8080');
    expect(input).toBeDisabled();
    
    rerender(
      <HostSelector
        hostMode="custom"
        onHostModeChange={vi.fn()}
        customBaseUrl=""
        onCustomBaseUrlChange={vi.fn()}
      />
    );
    
    expect(screen.getByPlaceholderText('https://my-host.example.com:8080')).not.toBeDisabled();
  });

  it('calls onCustomBaseUrlChange when custom URL is entered', () => {
    const onCustomBaseUrlChange = vi.fn();
    render(
      <HostSelector
        hostMode="custom"
        onHostModeChange={vi.fn()}
        customBaseUrl=""
        onCustomBaseUrlChange={onCustomBaseUrlChange}
      />
    );
    
    const input = screen.getByPlaceholderText('https://my-host.example.com:8080');
    fireEvent.change(input, { target: { value: 'https://test.example.com' } });
    
    expect(onCustomBaseUrlChange).toHaveBeenCalledWith('https://test.example.com');
  });

  it('disables all inputs when disabled prop is true', () => {
    render(
      <HostSelector
        hostMode="hardcoded"
        onHostModeChange={vi.fn()}
        customBaseUrl=""
        onCustomBaseUrlChange={vi.fn()}
        disabled={true}
      />
    );
    
    expect(screen.getByLabelText('Original')).toBeDisabled();
    expect(screen.getByLabelText('Custom')).toBeDisabled();
  });

  it('shows gallery hint when isGalleryEnv is true', () => {
    render(
      <HostSelector
        hostMode="hardcoded"
        onHostModeChange={vi.fn()}
        customBaseUrl=""
        onCustomBaseUrlChange={vi.fn()}
        isGalleryEnv={true}
      />
    );
    
    expect(screen.getByText(/Gallery samples use their own hardcoded URLs/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Original')).not.toBeInTheDocument();
  });

  it('uses a unique radio name from namePrefix so parallel runners do not share a group', () => {
    const { container } = render(
      <>
        <HostSelector
          hostMode="hardcoded"
          onHostModeChange={vi.fn()}
          customBaseUrl=""
          onCustomBaseUrlChange={vi.fn()}
          namePrefix="test-runner"
        />
        <HostSelector
          hostMode="settings"
          onHostModeChange={vi.fn()}
          customBaseUrl=""
          onCustomBaseUrlChange={vi.fn()}
          resolvedBaseUrl="https://api.example.com"
          namePrefix="param-runner"
        />
      </>,
    );

    const names = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="radio"]'))
      .map((r) => r.name);
    expect(names.filter((n) => n === 'test-runner-hostMode')).toHaveLength(3);
    expect(names.filter((n) => n === 'param-runner-hostMode')).toHaveLength(3);
    expect(names.includes('hostMode')).toBe(false);
  });
});
