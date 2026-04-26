/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import WorkflowBreadcrumb from './WorkflowBreadcrumb';

describe('WorkflowBreadcrumb', () => {
  it('renders nothing when stack is empty', () => {
    const { container } = render(
      <WorkflowBreadcrumb stack={[]} currentName="Root" onNavigate={vi.fn()} />,
    );
    expect(container.querySelector('.wf-breadcrumb')).toBeNull();
  });

  it('renders breadcrumb with parent and current', () => {
    const { container } = render(
      <WorkflowBreadcrumb
        stack={[{ id: 'parent', name: 'Parent' }]}
        currentName="Child"
        onNavigate={vi.fn()}
      />,
    );
    expect(container.querySelector('.wf-breadcrumb')).toBeTruthy();
    expect(container.textContent).toContain('Parent');
    expect(container.textContent).toContain('Child');
  });

  it('renders multi-level breadcrumb', () => {
    const { container } = render(
      <WorkflowBreadcrumb
        stack={[
          { id: 'root', name: 'Root' },
          { id: 'parent', name: 'Parent' },
        ]}
        currentName="GrandChild"
        onNavigate={vi.fn()}
      />,
    );
    const links = container.querySelectorAll('.wf-breadcrumb-link');
    expect(links).toHaveLength(2);
    expect(links[0].textContent).toBe('Root');
    expect(links[1].textContent).toBe('Parent');
    expect(container.querySelector('.wf-breadcrumb-current')?.textContent).toBe('GrandChild');
  });

  it('calls onNavigate with index when link clicked', () => {
    const onNavigate = vi.fn();
    const { container } = render(
      <WorkflowBreadcrumb
        stack={[
          { id: 'root', name: 'Root' },
          { id: 'parent', name: 'Parent' },
        ]}
        currentName="Child"
        onNavigate={onNavigate}
      />,
    );
    const links = container.querySelectorAll('.wf-breadcrumb-link');
    fireEvent.click(links[0]);
    expect(onNavigate).toHaveBeenCalledWith(0);
    fireEvent.click(links[1]);
    expect(onNavigate).toHaveBeenCalledWith(1);
  });

  it('renders separator between items', () => {
    const { container } = render(
      <WorkflowBreadcrumb
        stack={[{ id: 'parent', name: 'Parent' }]}
        currentName="Child"
        onNavigate={vi.fn()}
      />,
    );
    const seps = container.querySelectorAll('.wf-breadcrumb-sep');
    expect(seps).toHaveLength(1);
    expect(seps[0].textContent).toBe('›');
  });

  it('current item is not a link', () => {
    const { container } = render(
      <WorkflowBreadcrumb
        stack={[{ id: 'parent', name: 'Parent' }]}
        currentName="Child"
        onNavigate={vi.fn()}
      />,
    );
    const current = container.querySelector('.wf-breadcrumb-current');
    expect(current?.tagName).toBe('SPAN');
  });
});
