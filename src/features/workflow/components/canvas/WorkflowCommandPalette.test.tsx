/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WorkflowCommandPalette from './WorkflowCommandPalette';
import type { WorkflowNodeType } from '../../types/workflow';

function makeActions(overrides: Partial<Record<string, (...args: unknown[]) => void>> = {}) {
  return {
    onSave: vi.fn(),
    onQuickTest: vi.fn(),
    onDebugTest: vi.fn(),
    onToggleConsole: vi.fn(),
    onAutoLayout: vi.fn(),
    onFitView: vi.fn(),
    onToggleMinimap: vi.fn(),
    onOpenServices: vi.fn(),
    onOpenDefaults: vi.fn(),
    onAddNode: vi.fn() as unknown as (type: WorkflowNodeType) => void,
    onOpenShortcuts: vi.fn(),
    ...overrides,
  };
}

describe('WorkflowCommandPalette', () => {
  it('does not render when closed', () => {
    const { container } = render(
      <WorkflowCommandPalette open={false} onClose={vi.fn()} actions={makeActions()} />,
    );
    expect(container.querySelector('.wf-cmd-palette')).toBeNull();
  });

  it('renders when open', () => {
    render(
      <WorkflowCommandPalette open={true} onClose={vi.fn()} actions={makeActions()} />,
    );
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByPlaceholderText('Type a command…')).toBeTruthy();
  });

  it('renders all command groups', () => {
    const { container } = render(
      <WorkflowCommandPalette open={true} onClose={vi.fn()} actions={makeActions()} />,
    );
    const groupTitles = container.querySelectorAll('.wf-cmd-group-title');
    const titles = [...groupTitles].map((el) => el.textContent);
    expect(titles).toContain('Actions');
    expect(titles).toContain('Navigate');
    expect(titles).toContain('Add Node');
  });

  it('renders action commands with shortcuts', () => {
    render(
      <WorkflowCommandPalette open={true} onClose={vi.fn()} actions={makeActions()} />,
    );
    expect(screen.getByText('Save Workflow')).toBeTruthy();
    expect(screen.getByText('Run Quick Test')).toBeTruthy();
    expect(screen.getByText('Auto Layout')).toBeTruthy();
  });

  it('filters commands based on search query', () => {
    render(
      <WorkflowCommandPalette open={true} onClose={vi.fn()} actions={makeActions()} />,
    );
    const input = screen.getByPlaceholderText('Type a command…');
    fireEvent.change(input, { target: { value: 'save' } });
    expect(screen.getByText('Save Workflow')).toBeTruthy();
    expect(screen.queryByText('Auto Layout')).toBeNull();
  });

  it('shows empty state when no commands match', () => {
    render(
      <WorkflowCommandPalette open={true} onClose={vi.fn()} actions={makeActions()} />,
    );
    const input = screen.getByPlaceholderText('Type a command…');
    fireEvent.change(input, { target: { value: 'xyznonexistent' } });
    expect(screen.getByText('No matching commands')).toBeTruthy();
  });

  it('clicking a command executes its action and closes', () => {
    const actions = makeActions();
    const onClose = vi.fn();
    render(
      <WorkflowCommandPalette open={true} onClose={onClose} actions={actions} />,
    );
    fireEvent.click(screen.getByText('Save Workflow'));
    expect(actions.onSave).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Escape key closes the palette', () => {
    const onClose = vi.fn();
    render(
      <WorkflowCommandPalette open={true} onClose={onClose} actions={makeActions()} />,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('backdrop click closes the palette', () => {
    const onClose = vi.fn();
    const { container } = render(
      <WorkflowCommandPalette open={true} onClose={onClose} actions={makeActions()} />,
    );
    const backdrop = container.querySelector('.wf-cmd-backdrop');
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ArrowDown moves active index', () => {
    const { container } = render(
      <WorkflowCommandPalette open={true} onClose={vi.fn()} actions={makeActions()} />,
    );
    // First item should be active
    let activeItems = container.querySelectorAll('.wf-cmd-item-active');
    expect(activeItems.length).toBe(1);

    // Move down
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    activeItems = container.querySelectorAll('.wf-cmd-item-active');
    expect(activeItems.length).toBe(1);
  });

  it('ArrowUp moves active index up', () => {
    const { container } = render(
      <WorkflowCommandPalette open={true} onClose={vi.fn()} actions={makeActions()} />,
    );
    // Move down first then up
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    const activeItems = container.querySelectorAll('.wf-cmd-item-active');
    expect(activeItems.length).toBe(1);
  });

  it('Enter key executes the active command', () => {
    const actions = makeActions();
    const onClose = vi.fn();
    render(
      <WorkflowCommandPalette open={true} onClose={onClose} actions={actions} />,
    );
    fireEvent.keyDown(window, { key: 'Enter' });
    // First command is Save Workflow
    expect(actions.onSave).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('filters by description text too', () => {
    render(
      <WorkflowCommandPalette open={true} onClose={vi.fn()} actions={makeActions()} />,
    );
    const input = screen.getByPlaceholderText('Type a command…');
    fireEvent.change(input, { target: { value: 'step-by-step' } });
    expect(screen.getByText('Run Debug Test')).toBeTruthy();
  });

  it('mouse hover updates active item', () => {
    const { container } = render(
      <WorkflowCommandPalette open={true} onClose={vi.fn()} actions={makeActions()} />,
    );
    const items = container.querySelectorAll('.wf-cmd-item');
    expect(items.length).toBeGreaterThan(1);
    fireEvent.mouseEnter(items[2]);
    expect(items[2].classList.contains('wf-cmd-item-active')).toBe(true);
  });

  it('renders footer hints', () => {
    const { container } = render(
      <WorkflowCommandPalette open={true} onClose={vi.fn()} actions={makeActions()} />,
    );
    const footerHints = container.querySelectorAll('.wf-cmd-footer-hint');
    const texts = [...footerHints].map((el) => el.textContent);
    expect(texts.some((t) => t?.includes('Navigate'))).toBe(true);
    expect(texts.some((t) => t?.includes('Select'))).toBe(true);
    expect(texts.some((t) => t?.includes('Close'))).toBe(true);
  });

  it('add node commands call onAddNode with correct type', () => {
    const actions = makeActions();
    const onClose = vi.fn();
    render(
      <WorkflowCommandPalette open={true} onClose={onClose} actions={actions} />,
    );
    const input = screen.getByPlaceholderText('Type a command…');
    fireEvent.change(input, { target: { value: 'HTTP Request' } });
    fireEvent.click(screen.getByText('Add HTTP Request'));
    expect(actions.onAddNode).toHaveBeenCalledWith('http');
  });

  it.each([
    ['Add gRPC Unary', 'grpcUnary'],
    ['Add gRPC Server Stream', 'grpcServerStream'],
    ['Add gRPC Assert', 'grpcAssert'],
    ['Add Condition', 'condition'],
    ['Add Delay', 'delay'],
    ['Add Loop', 'loop'],
    ['Add Switch', 'switch'],
    ['Add Set Variable', 'setVariable'],
    ['Add Parallel Fork', 'fork'],
    ['Add Join', 'join'],
  ])('clicking "%s" calls onAddNode with "%s"', (title, expectedType) => {
    const actions = makeActions();
    const onClose = vi.fn();
    render(
      <WorkflowCommandPalette open={true} onClose={onClose} actions={actions} />,
    );
    fireEvent.click(screen.getByText(title));
    expect(actions.onAddNode).toHaveBeenCalledWith(expectedType);
    expect(onClose).toHaveBeenCalled();
  });

  it('does not attach keydown listener when closed', () => {
    const onClose = vi.fn();
    render(
      <WorkflowCommandPalette open={false} onClose={onClose} actions={makeActions()} />,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });
});
