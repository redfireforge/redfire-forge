/**
 * Collapsible panel for managing JSON Schema definitions and viewing validation results.
 */
import { memo, useCallback, useMemo, useState } from 'react';
import type React from 'react';
import type { WsFrame } from '@shared/websocket/types';
import type { WsSchemaDefinition, WsSchemaDirection } from './wsSchemaTypes';
import { CustomSelect } from '@shared/components/CustomSelect';

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

function directionLabel(direction: WsSchemaDirection): string {
  if (direction === 'both') return 'Both';
  if (direction === 'sent') return 'Sent';
  return 'Received';
}

function directionIcon(direction: WsSchemaDirection): string {
  if (direction === 'both') return '↕';
  if (direction === 'sent') return '↑';
  return '↓';
}

function prettySchema(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

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
  const preview = useMemo(() => prettySchema(schema.schema), [schema.schema]);

  return (
    <div
      className={`ws-schema-card${schema.enabled ? '' : ' ws-schema-card-disabled'}${isEditing ? ' ws-schema-card-editing' : ''}`}
      data-testid="ws-schema-card"
    >
      <div className="ws-schema-card-header">
        <button
          type="button"
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

        <span
          className={`ws-schema-direction-badge ws-schema-direction-badge--${schema.direction}`}
          data-testid="ws-schema-direction"
        >
          {directionIcon(schema.direction)} {directionLabel(schema.direction)}
        </span>

        <div className="ws-schema-card-actions">
          <button
            type="button"
            className="ws-schema-action-btn"
            onClick={() => onEdit(schema)}
            title="Edit schema"
            disabled={isEditing}
          >
            Edit
          </button>
          {confirmDelete ? (
            <>
              <button
                type="button"
                className="ws-schema-action-btn ws-schema-delete-confirm"
                onClick={() => { onRemove(schema.id); setConfirmDelete(false); }}
              >
                Confirm
              </button>
              <button
                type="button"
                className="ws-schema-action-btn"
                onClick={() => setConfirmDelete(false)}
              >
                No
              </button>
            </>
          ) : (
            <button
              type="button"
              className="ws-schema-action-btn ws-schema-action-btn--danger"
              onClick={() => setConfirmDelete(true)}
              title="Delete schema"
              disabled={isEditing}
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {showJson && (
        <pre className="ws-schema-card-json" data-testid="ws-schema-card-json">
          {preview}
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
      schemaText: prettySchema(schema.schema),
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
      setEditor((prev) => ({ ...prev, schemaText: prettySchema(generated), error: null }));
    } else {
      setEditor((prev) => ({ ...prev, error: 'No JSON messages found matching the selected direction' }));
    }
  }, [editor.direction, messages, onGenerateSchema]);

  const enabledCount = schemas.filter((s) => s.enabled).length;

  return (
    <div className="ws-schema-panel" data-testid="ws-schema-panel">
      <div className="ws-schema-panel-header">
        <div className="ws-schema-panel-heading">
          <span className="ws-schema-panel-title">Schemas</span>
          {schemas.length > 0 && (
            <span className="ws-schema-count-badge" data-testid="ws-schema-count">
              {enabledCount}/{schemas.length} active
            </span>
          )}
        </div>
        <div className="ws-schema-panel-toolbar">
          <label
            className="ws-schema-validation-toggle"
            title="Validate messages against enabled schemas"
            data-testid="ws-validation-toggle"
          >
            <input
              type="checkbox"
              checked={validationEnabled}
              onChange={(e) => onSetValidationEnabled(e.target.checked)}
              aria-label="Validate messages against enabled schemas"
            />
            <span className="ws-schema-validation-track" aria-hidden="true" />
            <span className="ws-schema-validation-text">Validate</span>
          </label>
          <button
            type="button"
            className="ws-schema-add-btn"
            onClick={openAdd}
            disabled={editor.mode !== 'closed'}
            data-testid="ws-schema-add-btn"
          >
            + Add
          </button>
        </div>
      </div>

      <p className="ws-schema-panel-hint">
        Define JSON Schemas to validate sent and received payloads. Enable Validate to show live ✓ / ✗ badges on messages.
      </p>

      {schemas.length === 0 && editor.mode === 'closed' && (
        <div className="ws-schema-empty" data-testid="ws-schema-empty">
          <span className="ws-schema-empty-title">No schemas yet</span>
          <span className="ws-schema-empty-text">
            Add a JSON Schema to validate incoming and outgoing messages in real time.
          </span>
          <button
            type="button"
            className="ws-schema-add-btn"
            onClick={openAdd}
            data-testid="ws-schema-empty-add-btn"
          >
            + Add schema
          </button>
        </div>
      )}

      <div className="ws-schema-list">
        {schemas.map((s) => (
          <div key={s.id} className="ws-schema-list-item">
            <SchemaCard
              schema={s}
              onToggle={onToggleSchema}
              onEdit={openEdit}
              onRemove={onRemoveSchema}
              isEditing={editor.mode === 'edit' && editor.editId === s.id}
            />
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
      </div>

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
        {editor.mode === 'add' ? 'Add schema' : 'Edit schema'}
      </div>

      <div className="ws-schema-editor-fields">
        <div className="ws-schema-field">
          <label className="ws-schema-field-label" htmlFor="ws-schema-name-input">Name</label>
          <input
            id="ws-schema-name-input"
            className="ws-schema-name-input"
            type="text"
            placeholder="e.g. Greeting Schema"
            value={editor.name}
            onChange={(e) => setEditor((prev) => ({ ...prev, name: e.target.value, error: null }))}
            data-testid="ws-schema-name-input"
          />
        </div>
        <div className="ws-schema-field ws-schema-field--direction">
          <span className="ws-schema-field-label">Direction</span>
          <CustomSelect
            className="ws-schema-direction-select"
            value={editor.direction}
            onChange={(v) => setEditor((prev) => ({ ...prev, direction: v as WsSchemaDirection }))}
            options={[
              { value: 'received', label: 'Received' },
              { value: 'sent', label: 'Sent' },
              { value: 'both', label: 'Both' },
            ]}
            data-testid="ws-schema-direction-select"
            aria-label="Validation direction"
          />
        </div>
      </div>

      <div className="ws-schema-field">
        <div className="ws-schema-field-label-row">
          <label className="ws-schema-field-label" htmlFor="ws-schema-textarea">JSON Schema</label>
          <button
            type="button"
            className="ws-schema-generate-btn"
            onClick={onGenerate}
            title="Generate schema from recent messages"
            data-testid="ws-schema-generate-btn"
          >
            Generate from messages
          </button>
        </div>
        <textarea
          id="ws-schema-textarea"
          className="ws-schema-textarea"
          placeholder={'{\n  "type": "object",\n  "properties": { }\n}'}
          value={editor.schemaText}
          onChange={(e) => setEditor((prev) => ({ ...prev, schemaText: e.target.value, error: null }))}
          rows={14}
          spellCheck={false}
          data-testid="ws-schema-textarea"
        />
      </div>

      {editor.error && (
        <div className="ws-schema-error" data-testid="ws-schema-error" role="alert">
          {editor.error}
        </div>
      )}

      <div className="ws-schema-editor-actions">
        <button type="button" className="ws-schema-cancel-btn" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="ws-schema-save-btn"
          onClick={onSave}
          data-testid="ws-schema-save-btn"
        >
          {editor.mode === 'add' ? 'Add schema' : 'Save'}
        </button>
      </div>
    </div>
  );
}
