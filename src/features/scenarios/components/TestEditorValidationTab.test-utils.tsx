/** @vitest-environment jsdom */
import { vi } from 'vitest';
import type { TestEditorValidationTabProps } from './TestEditorValidationTab';
import type { Scenario } from '../../../shared/types';
import { createRef } from 'react';

export function makeDraft(overrides: Partial<Scenario> = {}): Scenario {
  return {
    id: 's1',
    name: 'Test Scenario',
    url: 'https://api.example.com/test',
    method: 'GET',
    headers: [],
    body: '',
    auth: { type: 'none' },
    validation: {
      mode: 'none',
      assertions: [],
      ...overrides.validation,
    },
    ...overrides,
  };
}

export function makeProps(overrides: Partial<TestEditorValidationTabProps> = {}): TestEditorValidationTabProps {
  const draft = overrides.draft ?? makeDraft();
  const draftRef = createRef<Scenario>() as React.MutableRefObject<Scenario>;
  draftRef.current = draft;
  return {
    draft,
    onDraftChange: vi.fn(),
    draftRef,
    resolvedBaseUrl: 'https://api.example.com',
    fetchingResponse: false,
    fetchError: null,
    fetchHostOverride: '',
    setFetchHostOverride: vi.fn(),
    fetchHostEnabled: false,
    setFetchHostEnabled: vi.fn(),
    onFetchSampleResponse: vi.fn(),
    validating: false,
    validationResult: null,
    setValidationResult: vi.fn(),
    onValidateResponse: vi.fn(),
    ...overrides,
  };
}
