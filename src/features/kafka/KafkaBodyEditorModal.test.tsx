/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import KafkaBodyEditorModal from './KafkaBodyEditorModal';

describe('KafkaBodyEditorModal', () => {
  it('renders polished chrome with format pill and footer actions', () => {
    render(
      <KafkaBodyEditorModal
        value='{"key":"value"}'
        onChange={vi.fn()}
        onClose={vi.fn()}
        format="json"
      />,
    );

    expect(screen.getByTestId('kafka-body-editor-modal')).toBeInTheDocument();
    expect(screen.getByText('Message body')).toBeInTheDocument();
    expect(screen.getByText('JSON')).toBeInTheDocument();
    expect(screen.getByText('Valid JSON')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pretty' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Minify' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument();
  });

  it('applies draft edits and closes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onClose = vi.fn();
    render(
      <KafkaBodyEditorModal
        value='{"a":1}'
        onChange={onChange}
        onClose={onClose}
        format="json"
      />,
    );

    const textarea = screen.getByLabelText('Message body content');
    fireEvent.change(textarea, { target: { value: '{"a":2}' } });
    await user.click(screen.getByRole('button', { name: 'Apply' }));

    expect(onChange).toHaveBeenCalledWith('{"a":2}');
    expect(onClose).toHaveBeenCalled();
  });

  it('pretty-prints valid JSON from the toolbar', async () => {
    const user = userEvent.setup();
    render(
      <KafkaBodyEditorModal
        value='{"a":1,"b":2}'
        onChange={vi.fn()}
        onClose={vi.fn()}
        format="json"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Pretty' }));
    expect(screen.getByLabelText('Message body content')).toHaveValue('{\n  "a": 1,\n  "b": 2\n}');
  });

  it('handles invalid json in toolbar actions without mutating draft', async () => {
    const user = userEvent.setup();
    render(
      <KafkaBodyEditorModal
        value="{not-json"
        onChange={vi.fn()}
        onClose={vi.fn()}
        format="json"
      />,
    );

    expect(screen.getByText('Invalid JSON')).toBeInTheDocument();
    const textarea = screen.getByLabelText('Message body content');
    expect(textarea).toHaveValue('{not-json');

    await user.click(screen.getByRole('button', { name: 'Pretty' }));
    await user.click(screen.getByRole('button', { name: 'Minify' }));

    expect(textarea).toHaveValue('{not-json');
  });

  it('renders non-json mode without validation badge or json toolbar', () => {
    render(
      <KafkaBodyEditorModal
        value="plain text body"
        onChange={vi.fn()}
        onClose={vi.fn()}
        format="text"
      />,
    );

    expect(screen.getByText('TEXT')).toBeInTheDocument();
    expect(screen.queryByText('Valid JSON')).not.toBeInTheDocument();
    expect(screen.queryByText('Invalid JSON')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pretty' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Minify' })).not.toBeInTheDocument();
  });

  it('supports keyboard shortcuts for search focus and escape close', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <KafkaBodyEditorModal
        value='{"a":1}'
        onChange={vi.fn()}
        onClose={onClose}
        format="json"
      />,
    );

    const searchInput = screen.getByLabelText('Search body content');
    expect(searchInput).not.toHaveFocus();

    await user.keyboard('{Meta>}f{/Meta}');
    expect(searchInput).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('clears search and resets match state via clear button', async () => {
    const user = userEvent.setup();
    render(
      <KafkaBodyEditorModal
        value={'apple\nbanana\napple'}
        onChange={vi.fn()}
        onClose={vi.fn()}
        format="json"
      />,
    );

    const searchInput = screen.getByLabelText('Search body content');
    await user.type(searchInput, 'apple');
    expect(screen.getByText('0/2')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Clear search'));
    expect(searchInput).toHaveValue('');
    expect(screen.queryByText('1/2')).not.toBeInTheDocument();
  });

  it('closes only when clicking overlay itself', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <KafkaBodyEditorModal
        value='{"a":1}'
        onChange={vi.fn()}
        onClose={onClose}
        format="json"
      />,
    );

    await user.click(screen.getByTestId('kafka-body-editor-modal'));
    expect(onClose).not.toHaveBeenCalled();

    const overlay = document.querySelector('.kbe-overlay') as HTMLDivElement;
    expect(overlay).toBeTruthy();
    await user.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
