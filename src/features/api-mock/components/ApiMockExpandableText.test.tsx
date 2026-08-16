/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ApiMockExpandableText } from './ApiMockExpandableText';

describe('ApiMockExpandableText', () => {
  it('opens the popup, pretty-prints JSON, and applies the draft', () => {
    const onChange = vi.fn();
    render(
      <ApiMockExpandableText
        label="Request body"
        value='{"name":"Alice"}'
        onChange={onChange}
        testId="api-mock-simulate-body"
        multiline
      />,
    );

    fireEvent.click(screen.getByTestId('api-mock-simulate-body-expand'));
    expect(screen.getByTestId('api-mock-text-expand-modal')).toBeTruthy();
    expect(screen.queryByLabelText('Expand modal')).toBeNull();
    expect(screen.queryByTestId('api-mock-simulate-body-expand')).toBeNull();
    expect(screen.getByTestId('api-mock-text-expand-close').parentElement).toHaveClass('am-text-expand-footer');
    expect(screen.getByTestId('api-mock-text-expand-json-badge')).toHaveTextContent('JSON');
    expect(screen.getByTestId('api-mock-text-expand-stats')).toHaveTextContent('1 line');

    fireEvent.click(screen.getByTestId('api-mock-text-expand-pretty'));
    expect(screen.getByTestId('api-mock-text-expand-editor')).toHaveValue('{\n  "name": "Alice"\n}');
    expect(screen.getByTestId('api-mock-text-expand-pretty')).toBeDisabled();
    expect(screen.getByTestId('api-mock-text-expand-stats')).toHaveTextContent('3 lines');

    fireEvent.click(screen.getByTestId('api-mock-text-expand-minify'));
    expect(screen.getByTestId('api-mock-text-expand-editor')).toHaveValue('{"name":"Alice"}');
    expect(screen.getByTestId('api-mock-text-expand-minify')).toBeDisabled();

    fireEvent.click(screen.getByTestId('api-mock-text-expand-undo'));
    expect(screen.getByTestId('api-mock-text-expand-editor')).toHaveValue('{\n  "name": "Alice"\n}');
    fireEvent.click(screen.getByTestId('api-mock-text-expand-redo'));
    expect(screen.getByTestId('api-mock-text-expand-editor')).toHaveValue('{"name":"Alice"}');

    fireEvent.click(screen.getByTestId('api-mock-text-expand-pretty'));
    expect(screen.getByTestId('api-mock-text-expand-editor')).toHaveValue('{\n  "name": "Alice"\n}');

    fireEvent.click(screen.getByTestId('api-mock-text-expand-apply'));
    expect(onChange).toHaveBeenCalledWith('{\n  "name": "Alice"\n}');
    expect(screen.queryByTestId('api-mock-text-expand-modal')).toBeNull();
  });

  it('cancels without applying and searches matches', () => {
    const onChange = vi.fn();
    render(
      <ApiMockExpandableText
        label="Condition body"
        value={'alpha beta alpha'}
        onChange={onChange}
        testId="api-mock-condition-schema-p1"
        multiline
      />,
    );

    fireEvent.click(screen.getByTestId('api-mock-condition-schema-p1-expand'));
    fireEvent.change(screen.getByTestId('api-mock-text-expand-editor'), { target: { value: 'changed' } });
    fireEvent.click(screen.getByTestId('api-mock-text-expand-close'));
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('api-mock-condition-schema-p1-expand'));
    fireEvent.change(screen.getByTestId('api-mock-text-expand-search'), { target: { value: 'alpha' } });
    expect(screen.getByTestId('api-mock-text-expand-count')).toHaveTextContent('1/2');
    const editor = screen.getByTestId('api-mock-text-expand-editor') as HTMLTextAreaElement;
    expect(editor.selectionStart).toBe(0);
    expect(editor.selectionEnd).toBe('alpha'.length);
    fireEvent.click(screen.getByTestId('api-mock-text-expand-next'));
    expect(screen.getByTestId('api-mock-text-expand-count')).toHaveTextContent('2/2');
    fireEvent.keyDown(screen.getByTestId('api-mock-text-expand-search'), { key: 'Enter' });
    expect(screen.getByTestId('api-mock-text-expand-count')).toHaveTextContent('1/2');
    fireEvent.click(screen.getByTestId('api-mock-text-expand-prev'));
    expect(screen.getByTestId('api-mock-text-expand-count')).toHaveTextContent('2/2');
    fireEvent.keyDown(screen.getByTestId('api-mock-text-expand-search'), { key: 'f', metaKey: true });
  });

  it('is read-only in the popup when the compact field is locked', () => {
    render(
      <ApiMockExpandableText
        label="Request body"
        value="locked"
        readOnly
        testId="api-mock-simulate-body"
        multiline
      />,
    );
    fireEvent.click(screen.getByTestId('api-mock-simulate-body-expand'));
    expect(screen.getByTestId('api-mock-text-expand-editor')).toHaveProperty('readOnly', true);
    expect(screen.queryByTestId('api-mock-text-expand-apply')).toBeNull();
    expect(screen.queryByTestId('api-mock-text-expand-pretty')).toBeNull();
    expect(screen.queryByTestId('api-mock-text-expand-minify')).toBeNull();
    fireEvent.click(screen.getByTestId('api-mock-text-expand-close'));
    expect(screen.queryByTestId('api-mock-text-expand-modal')).toBeNull();
  });

  it('hides expand on disabled compact inputs', () => {
    render(
      <ApiMockExpandableText
        label="Condition value"
        value=""
        disabled
        testId="api-mock-condition-value-p1"
      />,
    );
    expect(screen.queryByTestId('api-mock-condition-value-p1-expand')).toBeNull();
  });

  it('edits the compact field, skips pretty-print for non-JSON, and focuses search on Cmd+F', () => {
    const onChange = vi.fn();
    render(
      <ApiMockExpandableText
        label="Condition body"
        value="not-json"
        onChange={onChange}
        testId="api-mock-condition-value-p2"
      />,
    );
    fireEvent.change(screen.getByTestId('api-mock-condition-value-p2'), { target: { value: 'binary-bytes' } });
    expect(onChange).toHaveBeenCalledWith('binary-bytes');

    fireEvent.click(screen.getByTestId('api-mock-condition-value-p2-expand'));
    expect(screen.getByTestId('api-mock-text-expand-pretty')).toBeDisabled();
    expect(screen.getByTestId('api-mock-text-expand-minify')).toBeDisabled();
    expect(screen.getByTestId('api-mock-text-expand-json-badge')).toHaveTextContent('Not JSON');
    fireEvent.click(screen.getByTestId('api-mock-text-expand-next'));
    fireEvent.keyDown(screen.getByTestId('api-mock-text-expand-search'), { key: 'Enter', shiftKey: true });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', metaKey: true, bubbles: true, cancelable: true }));
    expect(screen.getByTestId('api-mock-text-expand-search')).toHaveFocus();
  });

  it('keeps state unchanged when there is nothing to commit, undo, or redo', () => {
    render(
      <ApiMockExpandableText
        label="Condition body"
        value="same"
        testId="api-mock-condition-value-p3"
      />,
    );

    fireEvent.click(screen.getByTestId('api-mock-condition-value-p3-expand'));
    const editor = screen.getByTestId('api-mock-text-expand-editor');
    expect(editor).toHaveValue('same');
    expect(screen.getByTestId('api-mock-text-expand-undo')).toBeDisabled();
    expect(screen.getByTestId('api-mock-text-expand-redo')).toBeDisabled();

    fireEvent.change(editor, { target: { value: 'same' } });
    fireEvent.click(screen.getByTestId('api-mock-text-expand-undo'));
    fireEvent.click(screen.getByTestId('api-mock-text-expand-redo'));

    expect(editor).toHaveValue('same');
  });

  it('renders extra controls between the field and the expand button', () => {
    render(
      <ApiMockExpandableText
        label="Condition value"
        value="ada.lovelace"
        testId="api-mock-condition-value-p4"
        beforeExpand={<span data-testid="before-expand">Equals</span>}
      />,
    );
    const field = screen.getByTestId('api-mock-condition-value-p4');
    const extra = screen.getByTestId('before-expand');
    const expand = screen.getByTestId('api-mock-condition-value-p4-expand');
    expect(field.compareDocumentPosition(extra) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(extra.compareDocumentPosition(expand) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
