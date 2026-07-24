/**
 * Shared mock implementations for HttpConfig test splits.
 *
 * `vi.mock(...)` must remain at the top of each test file (Vitest hoisting).
 * This module exports mock factory objects and optional prop-capture state.
 */
import React from 'react';
import { vi } from 'vitest';

/** Prop bags captured by interaction tests (reset in beforeEach). */
export const httpConfigMockState = {
  lastExtractionEditorProps: {} as Record<string, unknown>,
  lastParamsEditorProps: {} as Record<string, unknown>,
};

export function resetHttpConfigMockState(): void {
  for (const key of Object.keys(httpConfigMockState.lastExtractionEditorProps)) {
    delete httpConfigMockState.lastExtractionEditorProps[key];
  }
  for (const key of Object.keys(httpConfigMockState.lastParamsEditorProps)) {
    delete httpConfigMockState.lastParamsEditorProps[key];
  }
}

export function createExpressionInputModuleMock() {
  return {
    __esModule: true as const,
    default: React.forwardRef(
      (
        {
          value,
          onChange,
          placeholder,
          className,
        }: {
          value: string;
          onChange: (v: string) => void;
          placeholder?: string;
          className?: string;
        },
        ref: React.Ref<HTMLInputElement>,
      ) => (
        <input
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={className}
          data-testid="expression-input"
        />
      ),
    ),
  };
}

export function createExpressionTextareaModuleMock() {
  return {
    __esModule: true as const,
    default: vi.fn().mockImplementation(
      ({
        value,
        onChange,
        placeholder,
        rows,
        className,
      }: {
        value: string;
        onChange: (v: string) => void;
        placeholder?: string;
        rows?: number;
        className?: string;
      }) => (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className={className}
          data-testid="expression-textarea"
        />
      ),
    ),
  };
}

export function createBodyBuilderSimpleModuleMock() {
  return {
    __esModule: true as const,
    default: function MockBodyBuilder() {
      return <div data-testid="mock-body-builder" />;
    },
  };
}

export function createBodyBuilderInteractiveModuleMock() {
  return {
    __esModule: true as const,
    default: function MockBodyBuilder({
      onBodyChange,
      onMappingsChange,
      onBodyTypeChange,
      onBodyFormChange,
    }: {
      onBodyChange: (v: string) => void;
      onMappingsChange: (m: unknown[]) => void;
      onBodyTypeChange: (
        t: 'json' | 'form-urlencoded' | 'form-data' | 'text' | 'xml' | 'none' | 'file',
      ) => void;
      onBodyFormChange: (f: { key: string; value: string }[]) => void;
    }) {
      return (
        <div data-testid="mock-body-builder">
          <button type="button" onClick={() => onBodyChange('{"mb":1}')}>
            bb-body
          </button>
          <button type="button" onClick={() => onMappingsChange([])}>
            bb-mappings
          </button>
          <button type="button" onClick={() => onBodyTypeChange('form-urlencoded')}>
            bb-type
          </button>
          <button type="button" onClick={() => onBodyFormChange([])}>
            bb-form
          </button>
        </div>
      );
    },
  };
}

export async function createDataMapperModuleMock() {
  const actual = await vi.importActual<
    typeof import('../../../../../shared/components/data-mapper')
  >('../../../../../shared/components/data-mapper');
  return {
    ...actual,
    DataMapperModal: function MockVarMapperModal({
      onSave,
      onCancel,
    }: {
      onSave: () => void;
      onCancel: () => void;
    }) {
      return (
        <div data-testid="mock-var-mapper-modal">
          <button type="button" onClick={() => onSave()}>
            var-mapper-save
          </button>
          <button type="button" onClick={() => onCancel()}>
            var-mapper-cancel
          </button>
        </div>
      );
    },
  };
}

export function createExtractionEditorModuleMock(options?: { captureProps?: boolean }) {
  return {
    __esModule: true as const,
    default: vi.fn().mockImplementation((props: Record<string, unknown>) => {
      if (options?.captureProps) {
        Object.assign(httpConfigMockState.lastExtractionEditorProps, props);
      }
      return <div data-testid="extraction-editor">ExtractionEditor</div>;
    }),
  };
}

export function createParamsEditorModuleMock(options?: { captureProps?: boolean }) {
  return {
    __esModule: true as const,
    ParamsEditor: vi.fn().mockImplementation((props: Record<string, unknown>) => {
      if (options?.captureProps) {
        Object.assign(httpConfigMockState.lastParamsEditorProps, props);
      }
      return <div data-testid="params-editor">Query Parameters</div>;
    }),
  };
}

export function createDataSourceEditorModuleMock(options?: { interactive?: boolean }) {
  return {
    __esModule: true as const,
    default: vi.fn().mockImplementation((props: Record<string, unknown>) => {
      if (options?.interactive) {
        return (
          <div data-testid="data-source-editor">
            <button
              type="button"
              onClick={() =>
                (props.onDraftChange as (p: Record<string, unknown>) => void)({
                  url: '/from-ds',
                })
              }
            >
              ds-patch-draft
            </button>
          </div>
        );
      }
      return <div data-testid="data-source-editor" />;
    }),
  };
}
