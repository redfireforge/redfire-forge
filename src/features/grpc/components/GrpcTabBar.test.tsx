/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GrpcTabBar } from './GrpcTabBar';
import type { GrpcStudioTabState } from '../grpcStudioTypes';

function makeTab(id: string, overrides: Partial<GrpcStudioTabState> = {}): GrpcStudioTabState {
  return {
    id,
    title: `Tab ${id}`,
    target: 'localhost:50051',
    tlsMode: 'plaintext',
    lifecycle: 'idle',
    streamLifecycle: 'idle',
    streamMessages: [],
    lastSequence: 0,
    body: {},
    metadata: {},
    requestMode: 'form',
    ...overrides,
  } as GrpcStudioTabState;
}

describe('GrpcTabBar', () => {
  it('renders tabs and selects on click', () => {
    const onSelect = vi.fn();
    render(
      <GrpcTabBar
        tabs={[makeTab('a'), makeTab('b')]}
        activeTabId="a"
        canAddTab
        onSelect={onSelect}
        onAdd={vi.fn()}
        onClose={vi.fn()}
        onDuplicate={vi.fn()}
        onRename={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('b'));
    expect(onSelect).toHaveBeenCalledWith('b');
  });

  it('adds tab and closes with stopPropagation', () => {
    const onAdd = vi.fn();
    const onClose = vi.fn();
    render(
      <GrpcTabBar
        tabs={[makeTab('a'), makeTab('b')]}
        activeTabId="a"
        canAddTab
        onSelect={vi.fn()}
        onAdd={onAdd}
        onClose={onClose}
        onDuplicate={vi.fn()}
        onRename={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-add-tab'));
    expect(onAdd).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByTestId('grpc-tab-close-b'));
    expect(onClose).toHaveBeenCalledWith('b');
  });

  it('duplicates tab and shows call type pill when method bound', () => {
    const onDuplicate = vi.fn();
    render(
      <GrpcTabBar
        tabs={[makeTab('a', { service: 'echo.Echo', method: 'Echo' })]}
        activeTabId="a"
        canAddTab
        tabCallTypes={{ a: 'unary' }}
        onSelect={vi.fn()}
        onAdd={vi.fn()}
        onClose={vi.fn()}
        onDuplicate={onDuplicate}
        onRename={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-tab-duplicate-a'));
    expect(onDuplicate).toHaveBeenCalledWith('a');
    expect(screen.getByTestId('grpc-tab-call-type-pill-a')).toBeTruthy();
  });

  it('shows tab call count badge when calls have been executed', () => {
    render(
      <GrpcTabBar
        tabs={[makeTab('a'), makeTab('b')]}
        activeTabId="a"
        canAddTab
        tabCallCounts={{ a: 3 }}
        onSelect={vi.fn()}
        onAdd={vi.fn()}
        onClose={vi.fn()}
        onDuplicate={vi.fn()}
        onRename={vi.fn()}
      />,
    );
    expect(screen.getByTestId('grpc-tab-call-count-a').textContent).toContain('=3');
    expect(screen.queryByTestId('grpc-tab-call-count-b')).toBeNull();
  });

  it('renders method subtitle and descriptive tab title when method is selected', () => {
    render(
      <GrpcTabBar
        tabs={[makeTab('a', { service: 'echo.v1.EchoService', method: 'Echo' })]}
        activeTabId="a"
        canAddTab
        tabCallCounts={{ a: 2 }}
        onSelect={vi.fn()}
        onAdd={vi.fn()}
        onClose={vi.fn()}
        onDuplicate={vi.fn()}
        onRename={vi.fn()}
      />,
    );
    expect(screen.getByTestId('grpc-tab-method-a').textContent).toBe('EchoService/Echo');
    const tab = screen.getByTestId('a');
    expect(tab.getAttribute('title')).toContain('EchoService/Echo');
    expect(tab.getAttribute('title')).toContain('Calls: 2');
  });

  it('supports inline rename via double-click and Enter', () => {
    const onRename = vi.fn();
    render(
      <GrpcTabBar
        tabs={[makeTab('a')]}
        activeTabId="a"
        canAddTab
        onSelect={vi.fn()}
        onAdd={vi.fn()}
        onClose={vi.fn()}
        onDuplicate={vi.fn()}
        onRename={onRename}
      />,
    );
    fireEvent.doubleClick(screen.getByTestId('a'));
    const input = screen.getByLabelText('Rename tab') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Renamed' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onRename).toHaveBeenCalledWith('a', 'Renamed');
  });

  it('cancels rename on Escape and marks in-flight tabs', () => {
    render(
      <GrpcTabBar
        tabs={[makeTab('a', { streamLifecycle: 'streaming' })]}
        activeTabId="a"
        canAddTab={false}
        onSelect={vi.fn()}
        onAdd={vi.fn()}
        onClose={vi.fn()}
        onDuplicate={vi.fn()}
        onRename={vi.fn()}
      />,
    );
    fireEvent.doubleClick(screen.getByTestId('a'));
    const input = screen.getByLabelText('Rename tab');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByLabelText('Rename tab')).toBeNull();
    expect(screen.getByTestId('a').className).toContain('grpc-tab--in-flight');
    expect(screen.getByTestId('grpc-add-tab')).toHaveProperty('disabled', true);
    expect(screen.getByTestId('grpc-tab-duplicate-a')).toHaveProperty('disabled', true);
    expect(screen.getByTestId('grpc-tab-close-a')).toHaveProperty('disabled', true);
  });
});
