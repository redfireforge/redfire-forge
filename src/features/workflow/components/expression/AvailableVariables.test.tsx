/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import AvailableVariables from './AvailableVariables';
import type { WorkflowVariableHint } from '../../utils/workflowVariableHints';

const sampleHints: WorkflowVariableHint[] = [
  { ref: 'token', label: 'token (step1)', type: 'string', description: 'Auth token from step1' },
  { ref: 'status', label: 'status (latest)', type: 'number', description: 'HTTP status code' },
  { ref: 'baseUrl', label: 'baseUrl (workflow)', type: 'string' },
];

describe('AvailableVariables', () => {
  it('returns null when hints is empty', () => {
    const { container } = render(<AvailableVariables hints={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders toggle button with correct count', () => {
    render(<AvailableVariables hints={sampleHints} />);
    const toggle = screen.getByRole('button', { name: /available variables/i });
    expect(toggle).toBeTruthy();
    expect(toggle.textContent).toContain('3');
  });

  it('does not render table when collapsed', () => {
    const { container } = render(<AvailableVariables hints={sampleHints} />);
    expect(container.querySelector('.wf-avail-vars-table')).toBeNull();
  });

  it('renders table with correct rows when expanded', () => {
    const { container } = render(<AvailableVariables hints={sampleHints} />);
    fireEvent.click(screen.getByRole('button', { name: /available variables/i }));
    const table = container.querySelector('.wf-avail-vars-table');
    expect(table).toBeTruthy();
    const rows = table!.querySelectorAll('tbody tr');
    expect(rows.length).toBe(3);
    expect(container.querySelector('.wf-avail-vars-body')).toBeTruthy();
  });

  it('starts expanded when defaultOpen is true', () => {
    const { container } = render(<AvailableVariables hints={sampleHints} defaultOpen />);
    expect(container.querySelector('.wf-avail-vars-table')).toBeTruthy();
    expect(container.querySelector('.wf-avail-vars--open')).toBeTruthy();
    expect(screen.getByRole('button').getAttribute('aria-expanded')).toBe('true');
  });

  it('dock layout stays collapsed by default and expands on click', () => {
    const { container } = render(<AvailableVariables hints={sampleHints} dock />);
    expect(container.querySelector('.wf-avail-vars--dock')).toBeTruthy();
    expect(container.querySelector('.wf-avail-vars-table')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /available variables/i }));
    expect(container.querySelector('.wf-avail-vars-table')).toBeTruthy();
    expect(screen.getByText(/Scroll inside this panel to see all 3 variables/i)).toBeTruthy();
  });

  it('renders variable ref, type, and source columns', () => {
    const { container } = render(<AvailableVariables hints={sampleHints} />);
    fireEvent.click(screen.getByRole('button'));

    const firstRow = container.querySelector('tbody tr')!;
    expect(firstRow.querySelector('.wf-avail-vars-ref')!.textContent).toBe('{{token}}');
    expect(firstRow.querySelector('.wf-avail-vars-type')!.textContent).toBe('string');
    expect(firstRow.querySelector('.wf-avail-vars-source')!.textContent).toBe('token (step1)');
  });

  it('shows description as title attribute', () => {
    const { container } = render(<AvailableVariables hints={sampleHints} />);
    fireEvent.click(screen.getByRole('button'));
    const firstRow = container.querySelector('tbody tr')!;
    expect(firstRow.getAttribute('title')).toBe('Auth token from step1');
  });

  it('shows em-dash when type is missing', () => {
    const hintNoType: WorkflowVariableHint[] = [{ ref: 'x', label: 'x (workflow)' }];
    const { container } = render(<AvailableVariables hints={hintNoType} />);
    fireEvent.click(screen.getByRole('button'));
    const typeCell = container.querySelector('.wf-avail-vars-type')!;
    expect(typeCell.textContent).toBe('—');
  });

  it('collapses when toggle clicked again', () => {
    const { container } = render(<AvailableVariables hints={sampleHints} />);
    const toggle = screen.getByRole('button');
    fireEvent.click(toggle);
    expect(container.querySelector('.wf-avail-vars-table')).toBeTruthy();
    fireEvent.click(toggle);
    expect(container.querySelector('.wf-avail-vars-table')).toBeNull();
  });

  it('sets aria-expanded correctly', () => {
    render(<AvailableVariables hints={sampleHints} />);
    const toggle = screen.getByRole('button');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });

  it('renders header with Variable, Type, Source columns', () => {
    const { container } = render(<AvailableVariables hints={sampleHints} />);
    fireEvent.click(screen.getByRole('button'));
    const ths = container.querySelectorAll('thead th');
    expect(ths.length).toBe(3);
    expect(ths[0].textContent).toBe('Variable');
    expect(ths[1].textContent).toBe('Type');
    expect(ths[2].textContent).toBe('Source');
  });
});
