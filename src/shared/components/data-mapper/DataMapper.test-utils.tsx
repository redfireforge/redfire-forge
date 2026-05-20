/** @vitest-environment jsdom */
import { act, fireEvent } from '@testing-library/react';
import type { MapperAdapter, Mapping } from './types';

export const sampleSource = { name: 'Alice', email: 'a@b.com', age: 30 };
export const sampleTarget = { userName: '', userEmail: '', userAge: 0 };

export async function bumpMapperLayout(host: HTMLElement) {
  await act(async () => {
    host.querySelectorAll('.dm-tree-container').forEach((el) => {
      fireEvent.scroll(el);
    });
  });
}

export function createTestAdapter(): MapperAdapter<Mapping[]> {
  return {
    contextId: 'test',
    title: 'Test Adapter',
    sources: [{ id: 's1', label: 'HTTP Response', sampleData: sampleSource }],
    target: { label: 'Variables', sampleData: sampleTarget, allowCustomFields: false },
    serialize: (m) => m,
    deserialize: (m) => m,
  };
}
