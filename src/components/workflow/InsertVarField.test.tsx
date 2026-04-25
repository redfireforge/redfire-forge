/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import InsertVarField from './InsertVarField';

describe('InsertVarField', () => {
  it('renders children without wrapper when onRequestVariableInsert is undefined', () => {
    const { container } = render(
      <InsertVarField onInsert={() => {}}>
        <input data-testid="field" defaultValue="hello" />
      </InsertVarField>,
    );
    expect(screen.getByTestId('field')).toBeTruthy();
    expect(container.querySelector('.wf-config-field-with-insert')).toBeNull();
    expect(screen.queryByText('Insert…')).toBeNull();
  });

  it('renders children with Insert button when onRequestVariableInsert is provided', () => {
    const onRequest = vi.fn();
    const { container } = render(
      <InsertVarField onRequestVariableInsert={onRequest} onInsert={() => {}}>
        <input data-testid="field" defaultValue="hello" />
      </InsertVarField>,
    );
    expect(screen.getByTestId('field')).toBeTruthy();
    expect(container.querySelector('.wf-config-field-with-insert')).toBeTruthy();
    expect(screen.getByText('Insert…')).toBeTruthy();
  });

  it('calls onRequestVariableInsert with onInsert when button is clicked', () => {
    const onRequest = vi.fn();
    const onInsert = vi.fn();
    render(
      <InsertVarField onRequestVariableInsert={onRequest} onInsert={onInsert}>
        <input defaultValue="test" />
      </InsertVarField>,
    );
    fireEvent.click(screen.getByText('Insert…'));
    expect(onRequest).toHaveBeenCalledTimes(1);
    expect(onRequest).toHaveBeenCalledWith(onInsert, false, undefined);
  });

  it('has correct title attribute on the button', () => {
    render(
      <InsertVarField onRequestVariableInsert={vi.fn()} onInsert={() => {}}>
        <input />
      </InsertVarField>,
    );
    expect(screen.getByTitle('Insert variable from workflow or upstream step')).toBeTruthy();
  });

  it('passes initialSearch to onRequestVariableInsert when provided', () => {
    const onRequest = vi.fn();
    const onInsert = vi.fn();
    render(
      <InsertVarField onRequestVariableInsert={onRequest} onInsert={onInsert} initialSearch="status">
        <input defaultValue="test" />
      </InsertVarField>,
    );
    fireEvent.click(screen.getByText('Insert…'));
    expect(onRequest).toHaveBeenCalledWith(onInsert, false, 'status');
  });

  it('renders textarea children correctly', () => {
    render(
      <InsertVarField onRequestVariableInsert={vi.fn()} onInsert={() => {}}>
        <textarea data-testid="ta" defaultValue="msg" />
      </InsertVarField>,
    );
    expect(screen.getByTestId('ta')).toBeTruthy();
    expect(screen.getByText('Insert…')).toBeTruthy();
  });
});
