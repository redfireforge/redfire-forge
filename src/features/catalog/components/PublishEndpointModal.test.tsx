/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import PublishEndpointModal, { type PublishRequest } from './PublishEndpointModal';

function makeRequest(overrides: Partial<PublishRequest> = {}): PublishRequest {
  return {
    method: 'POST',
    path: '/posts',
    summary: 'Create Post',
    entryName: 'JSONPlaceholder API',
    versionLabel: '1.0.0',
    currentVersionId: 'v1',
    includeValues: true,
    values: {
      paramValues: { id: '42' },
      headerValues: { 'X-Token': 'abc' },
      body: '{"title":"test"}',
    },
    ...overrides,
  };
}

describe('PublishEndpointModal', () => {
  it('renders the modal with correct endpoint info', () => {
    render(
      <PublishEndpointModal request={makeRequest()} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );

    expect(screen.getByTestId('publish-method')).toHaveTextContent('POST');
    expect(screen.getByTestId('publish-path')).toHaveTextContent('/posts');
    expect(screen.getByTestId('publish-api-name')).toHaveTextContent('JSONPlaceholder API');
    expect(screen.getByTestId('publish-version')).toHaveTextContent('1.0.0');
  });

  it('renders the notice about permanent publishing', () => {
    render(
      <PublishEndpointModal request={makeRequest()} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );

    expect(screen.getByText(/permanently available/i)).toBeInTheDocument();
  });

  it('calls onCancel when Cancel is clicked', () => {
    const onCancel = vi.fn();
    render(
      <PublishEndpointModal request={makeRequest()} onConfirm={vi.fn()} onCancel={onCancel} />,
    );

    fireEvent.click(screen.getByTestId('publish-cancel-btn'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onConfirm with note and includeValues on confirm', () => {
    const onConfirm = vi.fn();
    render(
      <PublishEndpointModal request={makeRequest()} onConfirm={onConfirm} onCancel={vi.fn()} />,
    );

    fireEvent.change(screen.getByTestId('publish-note-input'), { target: { value: 'Approved for testing' } });
    fireEvent.click(screen.getByTestId('publish-confirm-btn'));

    expect(onConfirm).toHaveBeenCalledWith({
      note: 'Approved for testing',
      includeValues: true,
    });
  });

  it('trims note whitespace', () => {
    const onConfirm = vi.fn();
    render(
      <PublishEndpointModal request={makeRequest()} onConfirm={onConfirm} onCancel={vi.fn()} />,
    );

    fireEvent.change(screen.getByTestId('publish-note-input'), { target: { value: '  spaced  ' } });
    fireEvent.click(screen.getByTestId('publish-confirm-btn'));

    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ note: 'spaced' }));
  });

  it('shows include values checkbox when values have content', () => {
    render(
      <PublishEndpointModal request={makeRequest()} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );

    expect(screen.getByTestId('publish-include-values')).toBeChecked();
  });

  it('hides include values checkbox when values are empty', () => {
    render(
      <PublishEndpointModal
        request={makeRequest({ values: { paramValues: {}, headerValues: {} } })}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('publish-include-values')).not.toBeInTheDocument();
  });

  it('hides include values checkbox when values are undefined', () => {
    render(
      <PublishEndpointModal
        request={makeRequest({ values: undefined })}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('publish-include-values')).not.toBeInTheDocument();
  });

  it('shows include values checkbox when only body has content', () => {
    render(
      <PublishEndpointModal
        request={makeRequest({ values: { paramValues: {}, headerValues: {}, body: '{"x":1}' } })}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByTestId('publish-include-values')).toBeInTheDocument();
  });

  it('allows unchecking include values', () => {
    const onConfirm = vi.fn();
    render(
      <PublishEndpointModal request={makeRequest()} onConfirm={onConfirm} onCancel={vi.fn()} />,
    );

    fireEvent.click(screen.getByTestId('publish-include-values'));
    fireEvent.click(screen.getByTestId('publish-confirm-btn'));

    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ includeValues: false }));
  });

  it('calls onCancel when clicking overlay background', () => {
    const onCancel = vi.fn();
    render(
      <PublishEndpointModal request={makeRequest()} onConfirm={vi.fn()} onCancel={onCancel} />,
    );

    fireEvent.mouseDown(screen.getByTestId('publish-endpoint-modal'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('does not call onCancel when clicking inside the dialog', () => {
    const onCancel = vi.fn();
    render(
      <PublishEndpointModal request={makeRequest()} onConfirm={vi.fn()} onCancel={onCancel} />,
    );

    fireEvent.mouseDown(document.querySelector('.sw-publish-dialog')!);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('defaults to empty note', () => {
    const onConfirm = vi.fn();
    render(
      <PublishEndpointModal request={makeRequest()} onConfirm={onConfirm} onCancel={vi.fn()} />,
    );

    fireEvent.click(screen.getByTestId('publish-confirm-btn'));
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ note: '' }));
  });

  it('calls onCancel when Escape key is pressed', () => {
    const onCancel = vi.fn();
    render(
      <PublishEndpointModal request={makeRequest()} onConfirm={vi.fn()} onCancel={onCancel} />,
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('does not cancel when a non-Escape key is pressed', () => {
    const onCancel = vi.fn();
    render(
      <PublishEndpointModal request={makeRequest()} onConfirm={vi.fn()} onCancel={onCancel} />,
    );

    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onCancel).not.toHaveBeenCalled();
  });
});
