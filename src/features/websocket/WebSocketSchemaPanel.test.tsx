/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { selectOption } from '@test-utils/customSelectHelper';
import '@testing-library/jest-dom/vitest';
import { WebSocketSchemaPanel } from './WebSocketSchemaPanel';
import type { WsSchemaDefinition } from './wsSchemaTypes';

function makeSchema(overrides: Partial<WsSchemaDefinition> = {}): WsSchemaDefinition {
  return {
    id: 'schema-1',
    name: 'Test Schema',
    schema: JSON.stringify({ type: 'object' }),
    direction: 'received',
    enabled: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const defaultProps = {
  schemas: [] as WsSchemaDefinition[],
  validationEnabled: false,
  onSetValidationEnabled: vi.fn(),
  onAddSchema: vi.fn(() => ({ ok: true })),
  onUpdateSchema: vi.fn(() => ({ ok: true })),
  onRemoveSchema: vi.fn(),
  onToggleSchema: vi.fn(),
  onGenerateSchema: vi.fn(),
  messages: [],
};

describe('WebSocketSchemaPanel', () => {
  it('renders empty state when no schemas', () => {
    render(<WebSocketSchemaPanel {...defaultProps} />);
    expect(screen.getByTestId('ws-schema-empty')).toBeInTheDocument();
    expect(screen.getByText(/No schemas yet/)).toBeInTheDocument();
  });

  it('renders schema cards', () => {
    const schemas = [makeSchema(), makeSchema({ id: 'schema-2', name: 'Schema 2' })];
    render(<WebSocketSchemaPanel {...defaultProps} schemas={schemas} />);
    const cards = screen.getAllByTestId('ws-schema-card');
    expect(cards).toHaveLength(2);
  });

  it('shows Add button and opens editor', () => {
    render(<WebSocketSchemaPanel {...defaultProps} />);
    const addBtn = screen.getByTestId('ws-schema-add-btn');
    fireEvent.click(addBtn);
    expect(screen.getByTestId('ws-schema-editor')).toBeInTheDocument();
    expect(screen.getByTestId('ws-schema-name-input')).toBeInTheDocument();
    expect(screen.getByTestId('ws-schema-textarea')).toBeInTheDocument();
  });

  it('validates empty name on save', () => {
    render(<WebSocketSchemaPanel {...defaultProps} />);
    fireEvent.click(screen.getByTestId('ws-schema-add-btn'));
    fireEvent.click(screen.getByTestId('ws-schema-save-btn'));
    expect(screen.getByTestId('ws-schema-error')).toHaveTextContent('Name is required');
  });

  it('validates empty schema on save', () => {
    render(<WebSocketSchemaPanel {...defaultProps} />);
    fireEvent.click(screen.getByTestId('ws-schema-add-btn'));
    fireEvent.change(screen.getByTestId('ws-schema-name-input'), { target: { value: 'My Schema' } });
    fireEvent.click(screen.getByTestId('ws-schema-save-btn'));
    expect(screen.getByTestId('ws-schema-error')).toHaveTextContent('Schema is required');
  });

  it('calls onAddSchema with correct values', () => {
    const onAdd = vi.fn(() => ({ ok: true }));
    render(<WebSocketSchemaPanel {...defaultProps} onAddSchema={onAdd} />);
    fireEvent.click(screen.getByTestId('ws-schema-add-btn'));
    fireEvent.change(screen.getByTestId('ws-schema-name-input'), { target: { value: 'My Schema' } });
    fireEvent.change(screen.getByTestId('ws-schema-textarea'), { target: { value: '{"type": "object"}' } });
    fireEvent.click(screen.getByTestId('ws-schema-save-btn'));
    expect(onAdd).toHaveBeenCalledWith('My Schema', '{"type": "object"}', 'received');
  });

  it('shows error when onAddSchema returns an error', () => {
    const onAdd = vi.fn(() => ({ ok: false, error: 'Max schemas reached' }));
    render(<WebSocketSchemaPanel {...defaultProps} onAddSchema={onAdd} />);
    fireEvent.click(screen.getByTestId('ws-schema-add-btn'));
    fireEvent.change(screen.getByTestId('ws-schema-name-input'), { target: { value: 'Fail' } });
    fireEvent.change(screen.getByTestId('ws-schema-textarea'), { target: { value: '{}' } });
    fireEvent.click(screen.getByTestId('ws-schema-save-btn'));
    expect(screen.getByTestId('ws-schema-error')).toHaveTextContent('Max schemas reached');
  });

  it('toggles schema enabled state', () => {
    const onToggle = vi.fn();
    render(<WebSocketSchemaPanel {...defaultProps} schemas={[makeSchema()]} onToggleSchema={onToggle} />);
    fireEvent.click(screen.getByTestId('ws-schema-toggle'));
    expect(onToggle).toHaveBeenCalledWith('schema-1');
  });

  it('toggles validation enabled state', () => {
    const onSetEnabled = vi.fn();
    render(<WebSocketSchemaPanel {...defaultProps} onSetValidationEnabled={onSetEnabled} />);
    fireEvent.click(screen.getByTestId('ws-validation-toggle'));
    expect(onSetEnabled).toHaveBeenCalledWith(true);
  });

  it('opens edit mode for existing schema', () => {
    const schema = makeSchema({ name: 'Edit Me' });
    render(<WebSocketSchemaPanel {...defaultProps} schemas={[schema]} />);
    fireEvent.click(screen.getByText('Edit'));
    expect(screen.getByTestId('ws-schema-editor')).toBeInTheDocument();
    expect(screen.getByTestId('ws-schema-name-input')).toHaveValue('Edit Me');
  });

  it('delete requires confirmation', () => {
    const onRemove = vi.fn();
    render(<WebSocketSchemaPanel {...defaultProps} schemas={[makeSchema()]} onRemoveSchema={onRemove} />);
    fireEvent.click(screen.getByText('Delete'));
    expect(screen.getByText('Confirm')).toBeInTheDocument();
    expect(onRemove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Confirm'));
    expect(onRemove).toHaveBeenCalledWith('schema-1');
  });

  it('generates schema from messages', () => {
    const onGenerate = vi.fn(() => '{"type": "object", "properties": {"x": {"type": "number"}}}');
    render(<WebSocketSchemaPanel {...defaultProps} onGenerateSchema={onGenerate} />);
    fireEvent.click(screen.getByTestId('ws-schema-add-btn'));
    fireEvent.click(screen.getByTestId('ws-schema-generate-btn'));
    expect(onGenerate).toHaveBeenCalled();
    expect(screen.getByTestId('ws-schema-textarea')).toHaveValue(
      '{\n  "type": "object",\n  "properties": {\n    "x": {\n      "type": "number"\n    }\n  }\n}',
    );
  });

  it('shows error when generate finds no JSON messages', () => {
    const onGenerate = vi.fn(() => null);
    render(<WebSocketSchemaPanel {...defaultProps} onGenerateSchema={onGenerate} />);
    fireEvent.click(screen.getByTestId('ws-schema-add-btn'));
    fireEvent.click(screen.getByTestId('ws-schema-generate-btn'));
    expect(screen.getByTestId('ws-schema-error')).toHaveTextContent('No JSON messages found');
  });

  it('shows direction badge on schema cards', () => {
    const schemas = [
      makeSchema({ id: 's1', direction: 'received' }),
      makeSchema({ id: 's2', direction: 'sent', name: 'Sent Only' }),
      makeSchema({ id: 's3', direction: 'both', name: 'Bidirectional' }),
    ];
    render(<WebSocketSchemaPanel {...defaultProps} schemas={schemas} />);
    const badges = screen.getAllByTestId('ws-schema-direction');
    expect(badges[0]).toHaveTextContent('↓ Received');
    expect(badges[1]).toHaveTextContent('↑ Sent');
    expect(badges[2]).toHaveTextContent('↕ Both');
  });

  it('applies disabled style to disabled schemas', () => {
    const schema = makeSchema({ enabled: false });
    render(<WebSocketSchemaPanel {...defaultProps} schemas={[schema]} />);
    const card = screen.getByTestId('ws-schema-card');
    expect(card.classList.contains('ws-schema-card-disabled')).toBe(true);
  });

  it('changes direction in editor', () => {
    const onAdd = vi.fn(() => ({ ok: true }));
    render(<WebSocketSchemaPanel {...defaultProps} onAddSchema={onAdd} />);
    fireEvent.click(screen.getByTestId('ws-schema-add-btn'));
    selectOption(screen.getByTestId('ws-schema-direction-select'), 'Sent');
    fireEvent.change(screen.getByTestId('ws-schema-name-input'), { target: { value: 'Sent Schema' } });
    fireEvent.change(screen.getByTestId('ws-schema-textarea'), { target: { value: '{"type":"object"}' } });
    fireEvent.click(screen.getByTestId('ws-schema-save-btn'));
    expect(onAdd).toHaveBeenCalledWith('Sent Schema', '{"type":"object"}', 'sent');
  });

  it('cancels editor without saving', () => {
    const onAdd = vi.fn();
    render(<WebSocketSchemaPanel {...defaultProps} onAddSchema={onAdd} />);
    fireEvent.click(screen.getByTestId('ws-schema-add-btn'));
    expect(screen.getByTestId('ws-schema-editor')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByTestId('ws-schema-editor')).toBeNull();
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('opens editor in edit mode when clicking edit on existing schema', () => {
    const schema = makeSchema({ id: 's1', name: 'My Schema', schema: '{"type":"string"}' });
    render(<WebSocketSchemaPanel {...defaultProps} schemas={[schema]} />);
    fireEvent.click(screen.getByText('Edit'));
    expect(screen.getByTestId('ws-schema-editor')).toBeTruthy();
    expect((screen.getByTestId('ws-schema-name-input') as HTMLInputElement).value).toBe('My Schema');
  });

  it('calls onUpdateSchema when saving in edit mode', () => {
    const schema = makeSchema({ id: 's1', name: 'My Schema', schema: '{"type":"string"}' });
    const onUpdate = vi.fn(() => ({ ok: true }));
    render(<WebSocketSchemaPanel {...defaultProps} schemas={[schema]} onUpdateSchema={onUpdate} />);
    fireEvent.click(screen.getByText('Edit'));
    fireEvent.change(screen.getByTestId('ws-schema-name-input'), { target: { value: 'Updated Name' } });
    fireEvent.click(screen.getByTestId('ws-schema-save-btn'));
    expect(onUpdate).toHaveBeenCalledWith('s1', expect.objectContaining({ name: 'Updated Name' }));
  });

  it('shows error when onUpdateSchema fails', () => {
    const schema = makeSchema({ id: 's1', name: 'My Schema' });
    const onUpdate = vi.fn(() => ({ ok: false, error: 'Duplicate name' }));
    render(<WebSocketSchemaPanel {...defaultProps} schemas={[schema]} onUpdateSchema={onUpdate} />);
    fireEvent.click(screen.getByText('Edit'));
    fireEvent.click(screen.getByTestId('ws-schema-save-btn'));
    expect(screen.getByTestId('ws-schema-editor').textContent).toContain('Duplicate name');
  });

  it('cancels delete confirmation', () => {
    const schema = makeSchema({ id: 's1' });
    const onRemove = vi.fn();
    render(<WebSocketSchemaPanel {...defaultProps} schemas={[schema]} onRemoveSchema={onRemove} />);
    // Open delete confirm
    fireEvent.click(screen.getByText('Delete'));
    // Cancel with "No"
    fireEvent.click(screen.getByText('No'));
    expect(onRemove).not.toHaveBeenCalled();
  });

  it('shows error when name is empty', () => {
    const onAdd = vi.fn();
    render(<WebSocketSchemaPanel {...defaultProps} onAddSchema={onAdd} />);
    fireEvent.click(screen.getByTestId('ws-schema-add-btn'));
    fireEvent.change(screen.getByTestId('ws-schema-textarea'), { target: { value: '{"type":"object"}' } });
    fireEvent.click(screen.getByTestId('ws-schema-save-btn'));
    expect(screen.getByTestId('ws-schema-editor').textContent).toContain('Name is required');
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('shows error when schema text is empty', () => {
    const onAdd = vi.fn();
    render(<WebSocketSchemaPanel {...defaultProps} onAddSchema={onAdd} />);
    fireEvent.click(screen.getByTestId('ws-schema-add-btn'));
    fireEvent.change(screen.getByTestId('ws-schema-name-input'), { target: { value: 'Test' } });
    fireEvent.change(screen.getByTestId('ws-schema-textarea'), { target: { value: '' } });
    fireEvent.click(screen.getByTestId('ws-schema-save-btn'));
    expect(screen.getByTestId('ws-schema-editor').textContent).toContain('Schema is required');
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('generates schema from messages', () => {
    const onGenerate = vi.fn(() => '{"type":"object","properties":{}}');
    render(<WebSocketSchemaPanel {...defaultProps} onGenerateSchema={onGenerate} messages={[]} />);
    fireEvent.click(screen.getByTestId('ws-schema-add-btn'));
    fireEvent.click(screen.getByTestId('ws-schema-generate-btn'));
    expect(onGenerate).toHaveBeenCalled();
    expect((screen.getByTestId('ws-schema-textarea') as HTMLTextAreaElement).value).toContain('properties');
  });

  it('shows error when generate returns null', () => {
    const onGenerate = vi.fn(() => null);
    render(<WebSocketSchemaPanel {...defaultProps} onGenerateSchema={onGenerate} messages={[]} />);
    fireEvent.click(screen.getByTestId('ws-schema-add-btn'));
    fireEvent.click(screen.getByTestId('ws-schema-generate-btn'));
    expect(screen.getByTestId('ws-schema-editor').textContent).toContain('No JSON messages found');
  });

  it('expands and collapses schema JSON preview', () => {
    const schema = makeSchema({ schema: '{"type":"object","properties":{}}' });
    render(<WebSocketSchemaPanel {...defaultProps} schemas={[schema]} />);
    const collapseBtn = screen.getByTestId('ws-schema-collapse-btn');
    expect(collapseBtn.textContent).toBe('▸');
    fireEvent.click(collapseBtn);
    expect(screen.getByTestId('ws-schema-card-json')).toBeInTheDocument();
    expect(collapseBtn.textContent).toBe('▾');
    fireEvent.click(collapseBtn);
    expect(screen.queryByTestId('ws-schema-card-json')).toBeNull();
  });

  it('disables collapse button while editing', () => {
    const schema = makeSchema();
    render(<WebSocketSchemaPanel {...defaultProps} schemas={[schema]} />);
    fireEvent.click(screen.getByText('Edit'));
    expect(screen.getByTestId('ws-schema-collapse-btn')).toBeDisabled();
  });

  it('uses fallback error when onAddSchema fails without a message', () => {
    const onAdd = vi.fn(() => ({ ok: false }));
    render(<WebSocketSchemaPanel {...defaultProps} onAddSchema={onAdd} />);
    fireEvent.click(screen.getByTestId('ws-schema-add-btn'));
    fireEvent.change(screen.getByTestId('ws-schema-name-input'), { target: { value: 'X' } });
    fireEvent.change(screen.getByTestId('ws-schema-textarea'), { target: { value: '{}' } });
    fireEvent.click(screen.getByTestId('ws-schema-save-btn'));
    expect(screen.getByTestId('ws-schema-error')).toHaveTextContent('Failed to add schema');
  });

  it('uses fallback error when onUpdateSchema fails without a message', () => {
    const schema = makeSchema({ id: 's1', name: 'Schema' });
    const onUpdate = vi.fn(() => ({ ok: false }));
    render(<WebSocketSchemaPanel {...defaultProps} schemas={[schema]} onUpdateSchema={onUpdate} />);
    fireEvent.click(screen.getByText('Edit'));
    fireEvent.click(screen.getByTestId('ws-schema-save-btn'));
    expect(screen.getByTestId('ws-schema-editor').textContent).toContain('Failed to update schema');
  });
});
