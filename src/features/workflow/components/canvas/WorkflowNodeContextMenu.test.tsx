/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WorkflowNodeContextMenu from './WorkflowNodeContextMenu';

describe('WorkflowNodeContextMenu', () => {
  it('does not render when open is false', () => {
    const { container } = render(
      <WorkflowNodeContextMenu open={false} x={0} y={0} onDelete={vi.fn()} onClose={vi.fn()} />,
    );
    expect(container.querySelector('.wf-node-ctx-menu')).toBeNull();
  });

  it('renders when open is true', () => {
    const { container } = render(
      <WorkflowNodeContextMenu open={true} x={100} y={200} onDelete={vi.fn()} onClose={vi.fn()} />,
    );
    const menu = container.querySelector('.wf-node-ctx-menu') as HTMLElement;
    expect(menu).toBeTruthy();
    expect(menu.style.left).toBe('100px');
    expect(menu.style.top).toBe('200px');
  });

  it('renders Delete button with shortcut', () => {
    render(
      <WorkflowNodeContextMenu open={true} x={0} y={0} onDelete={vi.fn()} onClose={vi.fn()} />,
    );
    expect(screen.getByText('Delete Node')).toBeTruthy();
    expect(screen.getByText('⌫')).toBeTruthy();
  });

  it('calls onDelete and onClose when Delete is clicked', () => {
    const onDelete = vi.fn();
    const onClose = vi.fn();
    render(
      <WorkflowNodeContextMenu open={true} x={0} y={0} onDelete={onDelete} onClose={onClose} />,
    );
    fireEvent.click(screen.getByText('Delete Node'));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders Copy when onCopy is provided', () => {
    render(
      <WorkflowNodeContextMenu
        open={true} x={0} y={0}
        onCopy={vi.fn()} onDelete={vi.fn()} onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('Copy')).toBeTruthy();
    expect(screen.getByText('⌘C')).toBeTruthy();
  });

  it('does not render Copy when onCopy is not provided', () => {
    render(
      <WorkflowNodeContextMenu open={true} x={0} y={0} onDelete={vi.fn()} onClose={vi.fn()} />,
    );
    expect(screen.queryByText('Copy')).toBeNull();
  });

  it('calls onCopy and onClose when Copy is clicked', () => {
    const onCopy = vi.fn();
    const onClose = vi.fn();
    render(
      <WorkflowNodeContextMenu
        open={true} x={0} y={0}
        onCopy={onCopy} onDelete={vi.fn()} onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByText('Copy'));
    expect(onCopy).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders Duplicate when onDuplicate is provided', () => {
    render(
      <WorkflowNodeContextMenu
        open={true} x={0} y={0}
        onDuplicate={vi.fn()} onDelete={vi.fn()} onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('Duplicate')).toBeTruthy();
    expect(screen.getByText('⌘D')).toBeTruthy();
  });

  it('calls onDuplicate and onClose when Duplicate is clicked', () => {
    const onDuplicate = vi.fn();
    const onClose = vi.fn();
    render(
      <WorkflowNodeContextMenu
        open={true} x={0} y={0}
        onDuplicate={onDuplicate} onDelete={vi.fn()} onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByText('Duplicate'));
    expect(onDuplicate).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders separator when copy or duplicate is present', () => {
    const { container } = render(
      <WorkflowNodeContextMenu
        open={true} x={0} y={0}
        onCopy={vi.fn()} onDuplicate={vi.fn()} onDelete={vi.fn()} onClose={vi.fn()}
      />,
    );
    expect(container.querySelector('.wf-node-ctx-sep')).toBeTruthy();
  });

  it('does not render separator when neither copy nor duplicate', () => {
    const { container } = render(
      <WorkflowNodeContextMenu open={true} x={0} y={0} onDelete={vi.fn()} onClose={vi.fn()} />,
    );
    expect(container.querySelector('.wf-node-ctx-sep')).toBeNull();
  });

  it('backdrop click calls onClose', () => {
    const onClose = vi.fn();
    const { container } = render(
      <WorkflowNodeContextMenu open={true} x={0} y={0} onDelete={vi.fn()} onClose={onClose} />,
    );
    const backdrop = container.querySelector('.wf-node-ctx-backdrop');
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('menu has role="menu"', () => {
    render(
      <WorkflowNodeContextMenu open={true} x={0} y={0} onDelete={vi.fn()} onClose={vi.fn()} />,
    );
    expect(screen.getByRole('menu')).toBeTruthy();
  });

  it('buttons have role="menuitem"', () => {
    render(
      <WorkflowNodeContextMenu
        open={true} x={0} y={0}
        onCopy={vi.fn()} onDuplicate={vi.fn()} onDelete={vi.fn()} onClose={vi.fn()}
      />,
    );
    const menuitems = screen.getAllByRole('menuitem');
    expect(menuitems.length).toBe(3); // Copy, Duplicate, Delete
  });

  it('delete button has danger class', () => {
    const { container } = render(
      <WorkflowNodeContextMenu open={true} x={0} y={0} onDelete={vi.fn()} onClose={vi.fn()} />,
    );
    expect(container.querySelector('.wf-node-ctx-item-danger')).toBeTruthy();
  });

  it('renders Extract to Sub-Workflow when onExtract provided', () => {
    render(
      <WorkflowNodeContextMenu
        open={true} x={0} y={0}
        onExtract={vi.fn()} onDelete={vi.fn()} onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('Extract to Sub-Workflow')).toBeTruthy();
  });

  it('calls onExtract and onClose when Extract clicked', () => {
    const onExtract = vi.fn();
    const onClose = vi.fn();
    render(
      <WorkflowNodeContextMenu
        open={true} x={0} y={0}
        onExtract={onExtract} onDelete={vi.fn()} onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByText('Extract to Sub-Workflow'));
    expect(onExtract).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders Open Child Workflow when onOpenChild provided', () => {
    render(
      <WorkflowNodeContextMenu
        open={true} x={0} y={0}
        onOpenChild={vi.fn()} onDelete={vi.fn()} onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('Open Child Workflow')).toBeTruthy();
  });

  it('calls onOpenChild and onClose when Open Child clicked', () => {
    const onOpenChild = vi.fn();
    const onClose = vi.fn();
    render(
      <WorkflowNodeContextMenu
        open={true} x={0} y={0}
        onOpenChild={onOpenChild} onDelete={vi.fn()} onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByText('Open Child Workflow'));
    expect(onOpenChild).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('menu click stopPropagation prevents close', () => {
    const onClose = vi.fn();
    const { container } = render(
      <WorkflowNodeContextMenu open={true} x={0} y={0} onDelete={vi.fn()} onClose={onClose} />,
    );
    const menu = container.querySelector('.wf-node-ctx-menu')!;
    fireEvent.click(menu);
    // onClose should NOT be called when clicking on the menu itself (only backdrop)
    expect(onClose).not.toHaveBeenCalled();
  });

  it('renders separator between extract/openChild and delete', () => {
    const { container } = render(
      <WorkflowNodeContextMenu
        open={true} x={0} y={0}
        onExtract={vi.fn()} onOpenChild={vi.fn()} onDelete={vi.fn()} onClose={vi.fn()}
      />,
    );
    const seps = container.querySelectorAll('.wf-node-ctx-sep');
    expect(seps.length).toBe(1); // Only one separator before Delete
  });

  it('renders two separators when both copy/duplicate and extract/openChild provided', () => {
    const { container } = render(
      <WorkflowNodeContextMenu
        open={true} x={0} y={0}
        onCopy={vi.fn()} onDuplicate={vi.fn()}
        onExtract={vi.fn()} onOpenChild={vi.fn()}
        onDelete={vi.fn()} onClose={vi.fn()}
      />,
    );
    const seps = container.querySelectorAll('.wf-node-ctx-sep');
    expect(seps.length).toBe(2);
  });

  it('renders separator when only Duplicate is provided (not Copy)', () => {
    const { container } = render(
      <WorkflowNodeContextMenu
        open={true} x={0} y={0}
        onDuplicate={vi.fn()} onDelete={vi.fn()} onClose={vi.fn()}
      />,
    );
    expect(screen.queryByText('Copy')).toBeNull();
    expect(screen.getByText('Duplicate')).toBeTruthy();
    expect(container.querySelector('.wf-node-ctx-sep')).toBeTruthy();
  });

  it('renders separator when only onOpenChild is provided (not onExtract)', () => {
    const { container } = render(
      <WorkflowNodeContextMenu
        open={true} x={0} y={0}
        onOpenChild={vi.fn()} onDelete={vi.fn()} onClose={vi.fn()}
      />,
    );
    expect(screen.queryByText('Extract to Sub-Workflow')).toBeNull();
    expect(screen.getByText('Open Child Workflow')).toBeTruthy();
    expect(container.querySelector('.wf-node-ctx-sep')).toBeTruthy();
  });

  it('does not render extract/openChild separator when neither is provided', () => {
    const { container } = render(
      <WorkflowNodeContextMenu
        open={true} x={0} y={0}
        onCopy={vi.fn()} onDelete={vi.fn()} onClose={vi.fn()}
      />,
    );
    expect(container.querySelectorAll('.wf-node-ctx-sep')).toHaveLength(1);
  });
});
