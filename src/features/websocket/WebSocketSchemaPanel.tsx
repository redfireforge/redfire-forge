/**
 * Collapsible panel for managing JSON Schema definitions and viewing validation results.
 */
import { memo, useCallback, useState } from 'react';
import type React from 'react';
import type { WsFrame } from '../../shared/websocket/types';
import type { WsSchemaDefinition, WsSchemaDirection } from './wsSchemaTypes';

interface WebSocketSchemaPanelProps {
  schemas: WsSchemaDefinition[];
  validationEnabled: boolean;
  onSetValidationEnabled: (enabled: boolean) => void;
  onAddSchema: (name: string, schema: string, direction: WsSchemaDirection) => { ok: boolean; error?: string };
  onUpdateSchema: (id: string, patch: Partial<Pick<WsSchemaDefinition, 'name' | 'schema' | 'direction' | 'enabled'>>) => { ok: boolean; error?: string };
  onRemoveSchema: (id: string) => void;
  onToggleSchema: (id: string) => void;
  onGenerateSchema: (messages: WsFrame[], direction: WsSchemaDirection) => string | null;
  messages: WsFrame[];
}

type EditorMode = 'closed' | 'add' | 'edit';

interface EditorState {
  mode: EditorMode;
  editId: string | null;
  name: string;
  schemaText: string;
  direction: WsSchemaDirection;
  error: string | null;
}

const INITIAL_EDITOR: EditorState = {
  mode: 'closed',
  editId: null,
  name: '',
  schemaText: '',
  direction: 'received',
  error: null,
};

const SchemaCard = memo(function SchemaCard({
  schema,
  onToggle,
  onEdit,
  onRemove,
  isEditing,
}: {
  schema: WsSchemaDefinition;
  onToggle: (id: string) => void;
  onEdit: (schema: WsSchemaDefinition) => void;
  onRemove: (id: string) => void;
  isEditing: boolean;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // When this card enters edit mode, collapse the JSON preview
  const showJson = expanded && !isEditing;

  return (
    <div className={`ws-schema-card ${schema.enabled ? '' : 'ws-schema-card-disabled'}`} data-testid="ws-schema-card">
      {/* Single row: collapse btn + checkbox + name + direction badge + actions */}
      <div className="ws-schema-card-header">
        <button
          className="ws-schema-collapse-btn"
          onClick={() => setExpanded(v => !v)}
          title={showJson ? 'Collapse' : 'Expand schema JSON'}
          data-testid="ws-schema-collapse-btn"
          aria-expanded={showJson}
          disabled={isEditing}
        >
          {showJson ? '▾' : '▸'}
        </button>
        <label className="ws-schema-toggle-label" title="Enable / disable this schema rule">
          <input
            type="checkbox"
            checked={schema.enabled}
            onChange={() => onToggle(schema.id)}
            data-testid="ws-schema-toggle"
          />
          <span className="ws-schema-card-name">{schema.name}</span>
        </label>
        <span className="ws-schema-direction-badge" data-testid="ws-schema-direction">
          {schema.direction === 'both' ? '↕' : schema.direction === 'sent' ? '↑' : '↓'} {schema.direction}
        </span>
        <div className="ws-schema-card-actions">
          <button className="ws-schema-action-btn" onClick={() => onEdit(schema)} title="Edit schema">Edit</button>
          {confirmDelete ? (
            <>
              <button className="ws-schema-action-btn ws-schema-delete-confirm" onClick={() => { onRemove(schema.id); setConfirmDelete(false); }}>Confirm</button>
              <button className="ws-schema-action-btn" onClick={() => setConfirmDelete(false)}>No</button>
            </>
          ) : (
            <button className="ws-schema-action-btn" onClick={() => setConfirmDelete(true)} title="Delete schema">Delete</button>
          )}
        </div>
      </div>
      {/* Expanded: schema JSON — hidden while edit form is open */}
      {showJson && (
        <pre className="ws-schema-card-json" data-testid="ws-schema-card-json">
          {schema.schema}
        </pre>
      )}
    </div>
  );
});

export function WebSocketSchemaPanel({
  schemas,
  validationEnabled,
  onSetValidationEnabled,
  onAddSchema,
  onUpdateSchema,
  onRemoveSchema,
  onToggleSchema,
  onGenerateSchema,
  messages,
}: WebSocketSchemaPanelProps) {
  const [editor, setEditor] = useState<EditorState>(INITIAL_EDITOR);

  const openAdd = useCallback(() => {
    setEditor({ ...INITIAL_EDITOR, mode: 'add' });
  }, []);

  const openEdit = useCallback((schema: WsSchemaDefinition) => {
    setEditor({
      mode: 'edit',
      editId: schema.id,
      name: schema.name,
      schemaText: schema.schema,
      direction: schema.direction,
      error: null,
    });
  }, []);

  const closeEditor = useCallback(() => {
    setEditor(INITIAL_EDITOR);
  }, []);

  const handleSave = useCallback(() => {
    const name = editor.name.trim();
    if (!name) {
      setEditor((prev) => ({ ...prev, error: 'Name is required' }));
      return;
    }
    if (!editor.schemaText.trim()) {
      setEditor((prev) => ({ ...prev, error: 'Schema is required' }));
      return;
    }

    if (editor.mode === 'add') {
      const result = onAddSchema(name, editor.schemaText, editor.direction);
      if (!result.ok) {
        setEditor((prev) => ({ ...prev, error: result.error ?? 'Failed to add schema' }));
        return;
      }
    } else if (editor.mode === 'edit' && editor.editId) {
      const result = onUpdateSchema(editor.editId, {
        name,
        schema: editor.schemaText,
        direction: editor.direction,
      });
      if (!result.ok) {
        setEditor((prev) => ({ ...prev, error: result.error ?? 'Failed to update schema' }));
        return;
      }
    }
    closeEditor();
  }, [editor, onAddSchema, onUpdateSchema, closeEditor]);

  const handleGenerate = useCallback(() => {
    const generated = onGenerateSchema(messages, editor.direction);
    if (generated) {
      setEditor((prev) => ({ ...prev, schemaText: generated, error: null }));
    } else {
      setEditor((prev) => ({ ...prev, error: 'No JSON messages found matching the selected direction' }));
    }
  }, [editor.direction, messages, onGenerateSchema]);

  return (
    <div className="ws-schema-panel" data-testid="ws-schema-panel">
      <div className="ws-schema-panel-header">
        <span className="ws-schema-panel-title">📐 Schemas</span>
        <label className="ws-schema-validation-toggle">
          <input
            type="checkbox"
            checked={validationEnabled}
            onChange={(e) => onSetValidationEnabled(e.target.checked)}
            data-testid="ws-validation-toggle"
          />
          Validate
        </label>
        <button
          className="ws-schema-add-btn"
          onClick={openAdd}
          disabled={editor.mode !== 'closed'}
          data-testid="ws-schema-add-btn"
        >
          + Add
        </button>
      </div>

      {/* Schema list */}
      {schemas.length === 0 && editor.mode === 'closed' && (
        <div className="ws-schema-empty" data-testid="ws-schema-empty">
          <span className="ws-schema-empty-icon">📋</span>
          <span className="ws-schema-empty-title">No Schemas Defined</span>
          <span className="ws-schema-empty-text">
            Add a JSON Schema to validate incoming and outgoing messages in real time.
          </span>
        </div>
      )}
      {schemas.map((s) => (
        <div key={s.id}>
          <SchemaCard
            schema={s}
            onToggle={onToggleSchema}
            onEdit={openEdit}
            onRemove={onRemoveSchema}
            isEditing={editor.mode === 'edit' && editor.editId === s.id}
          />
          {/* Inline edit form — shown directly below the card being edited */}
          {editor.mode === 'edit' && editor.editId === s.id && (
            <EditorForm
              editor={editor}
              setEditor={setEditor}
              onSave={handleSave}
              onCancel={closeEditor}
              onGenerate={handleGenerate}
            />
          )}
        </div>
      ))}

      {/* Add form — shown after all cards */}
      {editor.mode === 'add' && (
        <EditorForm
          editor={editor}
          setEditor={setEditor}
          onSave={handleSave}
          onCancel={closeEditor}
          onGenerate={handleGenerate}
        />
      )}
    </div>
  );
}

function EditorForm({
  editor,
  setEditor,
  onSave,
  onCancel,
  onGenerate,
}: {
  editor: EditorState;
  setEditor: React.Dispatch<React.SetStateAction<EditorState>>;
  onSave: () => void;
  onCancel: () => void;
  onGenerate: () => void;
}) {
  return (
    <div className="ws-schema-editor" data-testid="ws-schema-editor">
      <div className="ws-schema-editor-title">
        {editor.mode === 'add' ? 'Add Schema' : 'Edit Schema'}
      </div>
      <div className="ws-schema-editor-row">
        <input
          className="ws-schema-name-input"
          type="text"
          placeholder="Schema name"
          value={editor.name}
          onChange={(e) => setEditor((prev) => ({ ...prev, name: e.target.value, error: null }))}
          data-testid="ws-schema-name-input"
        />
        <select
          className="ws-schema-direction-select"
          value={editor.direction}
          onChange={(e) => setEditor((prev) => ({ ...prev, direction: e.target.value as WsSchemaDirection }))}
          data-testid="ws-schema-direction-select"
        >
          <option value="received">Received</option>
          <option value="sent">Sent</option>
          <option value="both">Both</option>
        </select>
      </div>
      <textarea
        className="ws-schema-textarea"
        placeholder="Paste JSON Schema here..."
        value={editor.schemaText}
        onChange={(e) => setEditor((prev) => ({ ...prev, schemaText: e.target.value, error: null }))}
        rows={14}
        spellCheck={false}
        data-testid="ws-schema-textarea"
      />
      {editor.error && (
        <div className="ws-schema-error" data-testid="ws-schema-error">{editor.error}</div>
      )}
      <div className="ws-schema-editor-actions">
        <button
          className="ws-schema-generate-btn"
          onClick={onGenerate}
          title="Generate schema from recent messages"
          data-testid="ws-schema-generate-btn"
        >
          Generate
        </button>
        <div className="ws-schema-editor-spacer" />
        <button className="ws-schema-cancel-btn" onClick={onCancel}>Cancel</button>
        <button className="ws-schema-save-btn" onClick={onSave} data-testid="ws-schema-save-btn">
          {editor.mode === 'add' ? 'Add' : 'Save'}
        </button>
      </div>
    </div>
  );
}
