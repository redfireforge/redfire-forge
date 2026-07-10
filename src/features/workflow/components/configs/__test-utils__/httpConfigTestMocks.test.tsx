// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  createBodyBuilderInteractiveModuleMock,
  createBodyBuilderSimpleModuleMock,
  createDataSourceEditorModuleMock,
  createExpressionInputModuleMock,
  createExpressionTextareaModuleMock,
  createExtractionEditorModuleMock,
  createParamsEditorModuleMock,
  httpConfigMockState,
  resetHttpConfigMockState,
} from './httpConfigTestMocks';

describe('httpConfigTestMocks', () => {
  it('resetHttpConfigMockState clears captured prop bags', () => {
    httpConfigMockState.lastExtractionEditorProps.foo = 'bar';
    httpConfigMockState.lastParamsEditorProps.baz = 1;
    resetHttpConfigMockState();
    expect(httpConfigMockState.lastExtractionEditorProps).toEqual({});
    expect(httpConfigMockState.lastParamsEditorProps).toEqual({});
  });

  it('renders interactive body builder and fires all callbacks', () => {
    const onBodyChange = vi.fn();
    const onMappingsChange = vi.fn();
    const onBodyTypeChange = vi.fn();
    const onBodyFormChange = vi.fn();
    const { default: MockBodyBuilder } = createBodyBuilderInteractiveModuleMock();
    render(
      <MockBodyBuilder
        onBodyChange={onBodyChange}
        onMappingsChange={onMappingsChange}
        onBodyTypeChange={onBodyTypeChange}
        onBodyFormChange={onBodyFormChange}
      />,
    );

    fireEvent.click(screen.getByText('bb-body'));
    fireEvent.click(screen.getByText('bb-mappings'));
    fireEvent.click(screen.getByText('bb-type'));
    fireEvent.click(screen.getByText('bb-form'));

    expect(onBodyChange).toHaveBeenCalledWith('{"mb":1}');
    expect(onMappingsChange).toHaveBeenCalledWith([]);
    expect(onBodyTypeChange).toHaveBeenCalledWith('form-urlencoded');
    expect(onBodyFormChange).toHaveBeenCalledWith([]);
  });

  it('renders simple body builder shell', () => {
    const { default: MockBodyBuilder } = createBodyBuilderSimpleModuleMock();
    render(<MockBodyBuilder />);
    expect(screen.getByTestId('mock-body-builder')).toBeInTheDocument();
  });

  it('captures extraction and params editor props when requested', () => {
    const { default: ExtractionEditor } = createExtractionEditorModuleMock({ captureProps: true });
    const { ParamsEditor } = createParamsEditorModuleMock({ captureProps: true });
    render(<ExtractionEditor foo="ex" />);
    render(<ParamsEditor bar="params" />);
    expect(httpConfigMockState.lastExtractionEditorProps.foo).toBe('ex');
    expect(httpConfigMockState.lastParamsEditorProps.bar).toBe('params');
  });

  it('renders interactive data source editor draft patch button', () => {
    const onDraftChange = vi.fn();
    const { default: DataSourceEditor } = createDataSourceEditorModuleMock({ interactive: true });
    render(<DataSourceEditor onDraftChange={onDraftChange} />);
    fireEvent.click(screen.getByText('ds-patch-draft'));
    expect(onDraftChange).toHaveBeenCalledWith({ url: '/from-ds' });
  });

  it('renders expression input and textarea mocks', () => {
    const onInputChange = vi.fn();
    const onTextareaChange = vi.fn();
    const { default: ExpressionInput } = createExpressionInputModuleMock();
    const { default: ExpressionTextarea } = createExpressionTextareaModuleMock();
    render(<ExpressionInput value="a" onChange={onInputChange} placeholder="in" className="expr-in" />);
    render(
      <ExpressionTextarea
        value="b"
        onChange={onTextareaChange}
        placeholder="area"
        rows={3}
        className="expr-area"
      />,
    );
    fireEvent.change(screen.getByTestId('expression-input'), { target: { value: 'next' } });
    fireEvent.change(screen.getByTestId('expression-textarea'), { target: { value: 'body' } });
    expect(onInputChange).toHaveBeenCalledWith('next');
    expect(onTextareaChange).toHaveBeenCalledWith('body');
  });

  it('renders editors without capture when captureProps is false', () => {
    const { default: ExtractionEditor } = createExtractionEditorModuleMock();
    const { ParamsEditor } = createParamsEditorModuleMock();
    render(<ExtractionEditor />);
    render(<ParamsEditor />);
    expect(screen.getAllByText(/EDITOR|PARAMETERS/i).length).toBeGreaterThan(0);
  });
});
