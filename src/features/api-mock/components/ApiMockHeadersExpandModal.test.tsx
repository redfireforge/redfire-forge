/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ApiMockExpandableText } from './ApiMockExpandableText';
import { resetHeaderDraftRowIds } from './apiMockHeadersExpand';

const HEADERS = 'authorization: Bearer tok\nx-tenant: acme-eu';

function renderHeaders(overrides: Partial<Parameters<typeof ApiMockExpandableText>[0]> = {}) {
  const onChange = vi.fn();
  render(
    <ApiMockExpandableText
      label="Request headers"
      value={HEADERS}
      onChange={onChange}
      testId="api-mock-simulate-headers"
      multiline
      variant="headers"
      {...overrides}
    />,
  );
  return onChange;
}

describe('ApiMockHeadersExpandModal', () => {
  beforeEach(() => {
    resetHeaderDraftRowIds();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('opens inside the Rule Simulation request pane when that host exists', () => {
    const host = document.createElement('section');
    host.setAttribute('data-testid', 'api-mock-sim-main');
    document.body.appendChild(host);
    renderHeaders();
    fireEvent.click(screen.getByTestId('api-mock-simulate-headers-expand'));
    expect(host.querySelector('[data-testid="api-mock-headers-expand-modal"]')).toBeTruthy();
    expect(host.querySelector('.am-text-expand-overlay--nested')).toBeTruthy();
    host.remove();
  });

  it('opens on Table, edits a row, and applies Name: value lines', () => {
    const onChange = renderHeaders();
    fireEvent.click(screen.getByTestId('api-mock-simulate-headers-expand'));
    expect(screen.getByTestId('api-mock-headers-expand-modal')).toBeTruthy();
    expect(screen.getByTestId('api-mock-headers-expand-modal').querySelector('.am-text-expand-header-controls'))
      .toContainElement(screen.getByTestId('api-mock-headers-expand-search-cluster'));
    expect(screen.getByTestId('api-mock-headers-expand-table')).toBeTruthy();
    expect(screen.getByTestId('api-mock-headers-expand-badge')).toHaveTextContent('2 headers');
    expect(screen.getByTestId('api-mock-headers-expand-name-hdr-1')).toHaveValue('authorization');
    expect(screen.getByTestId('api-mock-headers-expand-value-hdr-2')).toHaveValue('acme-eu');

    fireEvent.change(screen.getByTestId('api-mock-headers-expand-value-hdr-2'), { target: { value: 'acme-us' } });
    fireEvent.click(screen.getByTestId('api-mock-headers-expand-apply'));
    expect(onChange).toHaveBeenCalledWith('authorization: Bearer tok\nx-tenant: acme-us');
    expect(screen.queryByTestId('api-mock-headers-expand-modal')).toBeNull();
  });

  it('switches Raw and Table without losing edits, then cancels', () => {
    const onChange = renderHeaders();
    fireEvent.click(screen.getByTestId('api-mock-simulate-headers-expand'));
    fireEvent.click(screen.getByTestId('api-mock-headers-expand-view-raw'));
    expect(screen.getByTestId('api-mock-headers-expand-editor')).toHaveValue(HEADERS);
    fireEvent.change(screen.getByTestId('api-mock-headers-expand-editor'), {
      target: { value: 'x-debug: 1\nx-tenant: acme-eu' },
    });
    fireEvent.click(screen.getByTestId('api-mock-headers-expand-view-table'));
    expect(screen.getByTestId('api-mock-headers-expand-name-hdr-3')).toHaveValue('x-debug');
    fireEvent.click(screen.getByTestId('api-mock-headers-expand-view-raw'));
    fireEvent.click(screen.getByTestId('api-mock-headers-expand-view-raw'));
    fireEvent.click(screen.getByTestId('api-mock-headers-expand-close'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('adds and removes table rows, and undoes a value edit', () => {
    renderHeaders();
    fireEvent.click(screen.getByTestId('api-mock-simulate-headers-expand'));
    fireEvent.click(screen.getByTestId('api-mock-headers-expand-add'));
    fireEvent.change(screen.getByTestId('api-mock-headers-expand-name-hdr-3'), { target: { value: 'x-debug' } });
    fireEvent.change(screen.getByTestId('api-mock-headers-expand-value-hdr-3'), { target: { value: '1' } });
    fireEvent.click(screen.getByTestId('api-mock-headers-expand-remove-hdr-1'));
    expect(screen.queryByTestId('api-mock-headers-expand-name-hdr-1')).toBeNull();

    fireEvent.change(screen.getByTestId('api-mock-headers-expand-value-hdr-2'), { target: { value: 'changed' } });
    fireEvent.click(screen.getByTestId('api-mock-headers-expand-undo'));
    expect(screen.getAllByLabelText('Header value').map(el => (el as HTMLInputElement).value)).toContain('acme-eu');
    fireEvent.click(screen.getByTestId('api-mock-headers-expand-redo'));
    expect(screen.getAllByLabelText('Header value').map(el => (el as HTMLInputElement).value)).toContain('changed');
  });

  it('searches table rows and raw text, and focuses search on Cmd+F', () => {
    renderHeaders();
    fireEvent.click(screen.getByTestId('api-mock-simulate-headers-expand'));
    fireEvent.change(screen.getByTestId('api-mock-headers-expand-search'), { target: { value: 'tenant' } });
    expect(screen.getByTestId('api-mock-headers-expand-count')).toHaveTextContent('1/1');
    fireEvent.click(screen.getByTestId('api-mock-headers-expand-next'));
    fireEvent.click(screen.getByTestId('api-mock-headers-expand-prev'));
    fireEvent.keyDown(screen.getByTestId('api-mock-headers-expand-search'), { key: 'Enter' });
    fireEvent.keyDown(screen.getByTestId('api-mock-headers-expand-search'), { key: 'Enter', shiftKey: true });

    fireEvent.click(screen.getByTestId('api-mock-headers-expand-view-raw'));
    fireEvent.change(screen.getByTestId('api-mock-headers-expand-search'), { target: { value: 'Bearer' } });
    expect(screen.getByTestId('api-mock-headers-expand-count')).toHaveTextContent('1/1');
    fireEvent.click(screen.getByTestId('api-mock-headers-expand-next'));
    fireEvent.click(screen.getByTestId('api-mock-headers-expand-next'));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', metaKey: true, bubbles: true, cancelable: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F', ctrlKey: true, bubbles: true, cancelable: true }));
    expect(screen.getByTestId('api-mock-headers-expand-search')).toHaveFocus();
  });

  it('is read-only in the popup when the compact field is locked', () => {
    renderHeaders({ readOnly: true, onChange: undefined });
    fireEvent.click(screen.getByTestId('api-mock-simulate-headers-expand'));
    expect(screen.getByTestId('api-mock-headers-expand-name-hdr-1')).toHaveProperty('readOnly', true);
    expect(screen.queryByTestId('api-mock-headers-expand-apply')).toBeNull();
    expect(screen.queryByTestId('api-mock-headers-expand-add')).toBeNull();
    fireEvent.click(screen.getByTestId('api-mock-headers-expand-view-raw'));
    expect(screen.getByTestId('api-mock-headers-expand-editor')).toHaveProperty('readOnly', true);
    fireEvent.click(screen.getByTestId('api-mock-headers-expand-close'));
    expect(screen.queryByTestId('api-mock-headers-expand-modal')).toBeNull();
  });

  it('clears the last table row instead of leaving the table empty', () => {
    renderHeaders({ value: 'X-Only: 1' });
    fireEvent.click(screen.getByTestId('api-mock-simulate-headers-expand'));
    expect(screen.getByTestId('api-mock-headers-expand-badge')).toHaveTextContent('1 header');
    fireEvent.click(screen.getByTestId('api-mock-headers-expand-remove-hdr-1'));
    expect(screen.getByTestId('api-mock-headers-expand-name-hdr-2')).toHaveValue('');
    expect(screen.getByTestId('api-mock-headers-expand-badge')).toHaveTextContent('Empty');
  });

  it('applies and undoes edits from the Raw view', () => {
    const onChange = renderHeaders();
    fireEvent.click(screen.getByTestId('api-mock-simulate-headers-expand'));
    fireEvent.click(screen.getByTestId('api-mock-headers-expand-view-raw'));
    fireEvent.change(screen.getByTestId('api-mock-headers-expand-editor'), { target: { value: 'x-debug: 1' } });
    fireEvent.click(screen.getByTestId('api-mock-headers-expand-undo'));
    expect(screen.getByTestId('api-mock-headers-expand-editor')).toHaveValue(HEADERS);
    fireEvent.click(screen.getByTestId('api-mock-headers-expand-redo'));
    expect(screen.getByTestId('api-mock-headers-expand-editor')).toHaveValue('x-debug: 1');
    fireEvent.click(screen.getByTestId('api-mock-headers-expand-apply'));
    expect(onChange).toHaveBeenCalledWith('x-debug: 1');
  });

  it('ignores non-search keystrokes and walks two table matches', () => {
    renderHeaders({ value: 'x-tenant: acme\nx-trace: tenant-2' });
    fireEvent.click(screen.getByTestId('api-mock-simulate-headers-expand'));
    expect(screen.getByTestId('api-mock-headers-expand-badge')).toHaveTextContent('2 headers');
    fireEvent.keyDown(screen.getByTestId('api-mock-headers-expand-search'), { key: 'a' });
    fireEvent.change(screen.getByTestId('api-mock-headers-expand-search'), { target: { value: 'tenant' } });
    expect(screen.getByTestId('api-mock-headers-expand-count')).toHaveTextContent('1/2');
    fireEvent.click(screen.getByTestId('api-mock-headers-expand-next'));
    expect(screen.getByTestId('api-mock-headers-expand-count')).toHaveTextContent('2/2');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', bubbles: true, cancelable: true }));
  });

  it('skips undo, redo, and no-op commits when the draft is unchanged', () => {
    renderHeaders({ value: 'X-A: 1' });
    fireEvent.click(screen.getByTestId('api-mock-simulate-headers-expand'));
    fireEvent.click(screen.getByTestId('api-mock-headers-expand-view-raw'));
    const editor = screen.getByTestId('api-mock-headers-expand-editor');
    expect(screen.getByTestId('api-mock-headers-expand-undo')).toBeDisabled();
    fireEvent.change(editor, { target: { value: 'X-A: 1' } });
    fireEvent.click(screen.getByTestId('api-mock-headers-expand-undo'));
    fireEvent.click(screen.getByTestId('api-mock-headers-expand-redo'));
    expect(editor).toHaveValue('X-A: 1');
    fireEvent.click(screen.getByTestId('api-mock-headers-expand-next'));
    fireEvent.click(screen.getByTestId('api-mock-headers-expand-prev'));
    fireEvent.click(screen.getByTestId('api-mock-headers-expand-view-table'));
    fireEvent.click(screen.getByTestId('api-mock-headers-expand-next'));
  });
});
