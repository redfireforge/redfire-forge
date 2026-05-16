/** @vitest-environment jsdom */
import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BodyBuilderPanel from './BodyBuilderPanel';
import type { BodyBuilderPanelProps } from './BodyBuilderPanel';

// Mock DataMapper to avoid full rendering of the mapper tree
vi.mock('./DataMapper', () => ({
  default: ({ adapter: _adapter, onChange }: { adapter: unknown; onChange?: (m: unknown[]) => void }) => (
    <div data-testid="data-mapper">
      <button onClick={() => onChange?.([])}>mock-mapper</button>
    </div>
  ),
}));

function renderPanel(overrides: Partial<BodyBuilderPanelProps> = {}) {
  const defaultProps: BodyBuilderPanelProps = {
    body: '',
    bodyType: 'json',
    onBodyChange: vi.fn(),
    onMappingsChange: vi.fn(),
    ...overrides,
  };
  return { ...render(<BodyBuilderPanel {...defaultProps} />), props: defaultProps };
}

describe('BodyBuilderPanel', () => {
  describe('mode tabs', () => {
    it('renders three mode tabs', () => {
      renderPanel();
      expect(screen.getByText('JSON Builder')).toBeInTheDocument();
      expect(screen.getByText('Form Fields')).toBeInTheDocument();
      expect(screen.getByText('Raw Template')).toBeInTheDocument();
    });

    it('defaults to JSON mode when bodyType is json', () => {
      renderPanel({ bodyType: 'json' });
      expect(screen.getByText('JSON Builder')).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByTestId('data-mapper')).toBeInTheDocument();
    });

    it('defaults to form mode when bodyType is form-urlencoded', () => {
      renderPanel({ bodyType: 'form-urlencoded' });
      expect(screen.getByText('Form Fields')).toHaveAttribute('aria-selected', 'true');
    });

    it('defaults to form mode when bodyType is form-data', () => {
      renderPanel({ bodyType: 'form-data' });
      expect(screen.getByText('Form Fields')).toHaveAttribute('aria-selected', 'true');
    });

    it('defaults to raw mode when bodyType is text', () => {
      renderPanel({ bodyType: 'text' });
      expect(screen.getByText('Raw Template')).toHaveAttribute('aria-selected', 'true');
    });

    it('defaults to raw mode when bodyType is xml', () => {
      renderPanel({ bodyType: 'xml' });
      expect(screen.getByText('Raw Template')).toHaveAttribute('aria-selected', 'true');
    });

    it('switches mode on tab click', () => {
      const onBodyTypeChange = vi.fn();
      renderPanel({ bodyType: 'json', onBodyTypeChange });
      fireEvent.click(screen.getByText('Raw Template'));
      expect(onBodyTypeChange).toHaveBeenCalledWith('text');
    });

    it('calls onBodyTypeChange with form-urlencoded for form tab', () => {
      const onBodyTypeChange = vi.fn();
      renderPanel({ bodyType: 'json', onBodyTypeChange });
      fireEvent.click(screen.getByText('Form Fields'));
      expect(onBodyTypeChange).toHaveBeenCalledWith('form-urlencoded');
    });

    it('calls onBodyTypeChange with json for JSON tab', () => {
      const onBodyTypeChange = vi.fn();
      renderPanel({ bodyType: 'text', onBodyTypeChange });
      fireEvent.click(screen.getByText('JSON Builder'));
      expect(onBodyTypeChange).toHaveBeenCalledWith('json');
    });
  });

  describe('JSON mode', () => {
    it('renders DataMapper component', () => {
      renderPanel({ bodyType: 'json' });
      expect(screen.getByTestId('data-mapper')).toBeInTheDocument();
    });
  });

  describe('form mode', () => {
    it('renders form fields from bodyForm', () => {
      renderPanel({
        bodyType: 'form-urlencoded',
        bodyForm: [
          { key: 'name', value: 'John' },
          { key: 'email', value: 'john@example.com' },
        ],
      });
      const inputs = screen.getAllByPlaceholderText('Field name');
      expect(inputs).toHaveLength(2);
    });

    it('adds a new form field on + Add Field', () => {
      const onBodyFormChange = vi.fn();
      renderPanel({
        bodyType: 'form-urlencoded',
        bodyForm: [{ key: 'name', value: 'John' }],
        onBodyFormChange,
      });
      fireEvent.click(screen.getByText('+ Add Field'));
      expect(onBodyFormChange).toHaveBeenCalledWith([
        { key: 'name', value: 'John' },
        { key: '', value: '' },
      ]);
    });

    it('removes a form field', () => {
      const onBodyFormChange = vi.fn();
      renderPanel({
        bodyType: 'form-urlencoded',
        bodyForm: [
          { key: 'name', value: 'John' },
          { key: 'email', value: 'test@test.com' },
        ],
        onBodyFormChange,
      });
      const removeButtons = screen.getAllByTitle('Remove field');
      fireEvent.click(removeButtons[0]);
      expect(onBodyFormChange).toHaveBeenCalledWith([
        { key: 'email', value: 'test@test.com' },
      ]);
    });

    it('updates field key on change', () => {
      const onBodyFormChange = vi.fn();
      renderPanel({
        bodyType: 'form-urlencoded',
        bodyForm: [{ key: 'name', value: 'John' }],
        onBodyFormChange,
      });
      const keyInput = screen.getByPlaceholderText('Field name');
      fireEvent.change(keyInput, { target: { value: 'username' } });
      expect(onBodyFormChange).toHaveBeenCalledWith([{ key: 'username', value: 'John' }]);
    });

    it('updates field value on change', () => {
      const onBodyFormChange = vi.fn();
      renderPanel({
        bodyType: 'form-urlencoded',
        bodyForm: [{ key: 'name', value: 'John' }],
        onBodyFormChange,
      });
      const valueInput = screen.getByPlaceholderText('Value or {{variable}}');
      fireEvent.change(valueInput, { target: { value: '{{userName}}' } });
      expect(onBodyFormChange).toHaveBeenCalledWith([{ key: 'name', value: '{{userName}}' }]);
    });
  });

  describe('raw mode', () => {
    it('renders textarea with body content', () => {
      renderPanel({ bodyType: 'text', body: 'hello {{world}}' });
      const textarea = screen.getByPlaceholderText(/Enter raw body content/);
      expect(textarea).toHaveValue('hello {{world}}');
    });

    it('calls onBodyChange on textarea input', () => {
      const onBodyChange = vi.fn();
      renderPanel({ bodyType: 'text', body: '', onBodyChange });
      const textarea = screen.getByPlaceholderText(/Enter raw body content/);
      fireEvent.change(textarea, { target: { value: 'new content' } });
      expect(onBodyChange).toHaveBeenCalledWith('new content');
    });

    it('shows template refs when body has variables', () => {
      renderPanel({ bodyType: 'text', body: 'Hello {{name}} from {{city}}' });
      expect(screen.getByText('Template refs:')).toBeInTheDocument();
      expect(screen.getByText('{{name}}')).toBeInTheDocument();
      expect(screen.getByText('{{city}}')).toBeInTheDocument();
    });

    it('shows available variables when provided', () => {
      renderPanel({
        bodyType: 'text',
        body: '',
        variableHints: [
          { ref: 'userId', label: 'User ID' },
          { ref: 'token', label: 'Token' },
        ],
      });
      expect(screen.getByText(/Available variables/)).toBeInTheDocument();
    });

    it('inserts variable on chip click', () => {
      const onBodyChange = vi.fn();
      renderPanel({
        bodyType: 'text',
        body: 'prefix-',
        onBodyChange,
        variableHints: [{ ref: 'userId', label: 'User ID' }],
      });
      // Expand the details
      fireEvent.click(screen.getByText(/Available variables/));
      fireEvent.click(screen.getByText('User ID'));
      expect(onBodyChange).toHaveBeenCalledWith('prefix-{{userId}}');
    });
  });
});
