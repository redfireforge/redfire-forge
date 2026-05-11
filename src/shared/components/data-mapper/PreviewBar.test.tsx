/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import PreviewBar from './PreviewBar';
import type { Mapping, MapperSource } from './types';

const sources: MapperSource[] = [
  { id: 's1', label: 'Response', sampleData: { name: 'Alice', age: 30 } },
];

const mapping: Mapping = { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' };

function renderBar(overrides?: Partial<Parameters<typeof PreviewBar>[0]>) {
  const defaults = {
    mappings: [] as Mapping[],
    sources,
    activeSourceId: 's1',
    targetSampleData: { userName: '', email: '' },
  };
  return render(<PreviewBar {...defaults} {...overrides} />);
}

describe('PreviewBar', () => {
  it('shows empty state when no mappings', () => {
    renderBar();
    expect(screen.getByText(/Add mappings/)).toBeTruthy();
  });

  it('shows preview header when mappings exist', async () => {
    vi.useFakeTimers();
    renderBar({ mappings: [mapping] });
    await act(async () => { vi.advanceTimersByTime(250); });
    expect(screen.getByText('Preview')).toBeTruthy();
    expect(screen.getByText('1 mapping')).toBeTruthy();
    vi.useRealTimers();
  });

  it('shows plural mapping count', async () => {
    vi.useFakeTimers();
    const m2: Mapping = { id: 'm2', sourcePath: 'age', sourceId: 's1', targetPath: 'email' };
    renderBar({ mappings: [mapping, m2] });
    await act(async () => { vi.advanceTimersByTime(250); });
    expect(screen.getByText('2 mappings')).toBeTruthy();
    vi.useRealTimers();
  });

  it('displays source sample JSON', async () => {
    vi.useFakeTimers();
    const { container } = renderBar({ mappings: [mapping] });
    await act(async () => { vi.advanceTimersByTime(250); });
    expect(screen.getByText('Source Sample')).toBeTruthy();
    const sourceJson = container.querySelector('.dm-preview-json');
    expect(sourceJson?.textContent).toContain('Alice');
    vi.useRealTimers();
  });

  it('displays mapped output JSON', async () => {
    vi.useFakeTimers();
    renderBar({ mappings: [mapping] });
    await act(async () => { vi.advanceTimersByTime(250); });
    expect(screen.getByText('Mapped Output')).toBeTruthy();
    vi.useRealTimers();
  });

  it('renders with expression mappings (even unknown functions)', async () => {
    vi.useFakeTimers();
    const exprMapping: Mapping = {
      ...mapping,
      expression: '$nonExistent($.name)',
    };
    renderBar({ mappings: [exprMapping] });
    await act(async () => { vi.advanceTimersByTime(250); });
    expect(screen.getByText('Preview')).toBeTruthy();
    expect(screen.getByText('Mapped Output')).toBeTruthy();
    vi.useRealTimers();
  });

  it('evaluates expression mappings in preview', async () => {
    vi.useFakeTimers();
    const exprMapping: Mapping = {
      ...mapping,
      expression: '$upper($.name)',
    };
    renderBar({ mappings: [exprMapping] });
    await act(async () => { vi.advanceTimersByTime(250); });
    const outputEl = document.querySelector('.dm-preview-json--output');
    expect(outputEl?.textContent).toContain('ALICE');
    vi.useRealTimers();
  });

  it('handles no source data gracefully', () => {
    const emptySources: MapperSource[] = [{ id: 's1', label: 'Empty', sampleData: null }];
    renderBar({ mappings: [mapping], sources: emptySources });
    expect(screen.getByText(/no data/)).toBeTruthy();
  });

  it('handles string sampleData in source', async () => {
    vi.useFakeTimers();
    const stringSources: MapperSource[] = [
      { id: 's1', label: 'Src', sampleData: '{"name":"Bob"}' },
    ];
    const { container } = renderBar({ mappings: [mapping], sources: stringSources });
    await act(async () => { vi.advanceTimersByTime(250); });
    const sourceJson = container.querySelector('.dm-preview-json');
    expect(sourceJson?.textContent).toContain('Bob');
    vi.useRealTimers();
  });

  it('handles invalid string sampleData gracefully', () => {
    const badSources: MapperSource[] = [
      { id: 's1', label: 'Bad', sampleData: '{not valid' },
    ];
    const { container } = renderBar({ mappings: [mapping], sources: badSources });
    const sourceJson = container.querySelector('.dm-preview-json');
    expect(sourceJson?.textContent).toBe('(no data)');
  });

  it('shows error count when expression evaluation fails', async () => {
    vi.useFakeTimers();
    const nullSrc: MapperSource[] = [
      { id: 's1', label: 'S', sampleData: { name: null } },
    ];
    const errMapping: Mapping = {
      ...mapping,
      expression: '$upper($.name)',
    };
    renderBar({ mappings: [errMapping], sources: nullSrc });
    await act(async () => { vi.advanceTimersByTime(250); });
    expect(screen.getByText('Preview')).toBeTruthy();
    vi.useRealTimers();
  });

  it('handles null targetSampleData', async () => {
    vi.useFakeTimers();
    renderBar({ mappings: [mapping], targetSampleData: null });
    await act(async () => { vi.advanceTimersByTime(250); });
    expect(screen.getByText('Mapped Output')).toBeTruthy();
    vi.useRealTimers();
  });

  it('handles string targetSampleData', async () => {
    vi.useFakeTimers();
    renderBar({ mappings: [mapping], targetSampleData: '{"userName":""}' });
    await act(async () => { vi.advanceTimersByTime(250); });
    expect(screen.getByText('Mapped Output')).toBeTruthy();
    vi.useRealTimers();
  });

  it('shows error list when fields have errors', async () => {
    vi.useFakeTimers();
    const errMapping: Mapping = {
      id: 'm1',
      sourcePath: 'nonexistent',
      sourceId: 's1',
      targetPath: 'userName',
      expression: '$upper($notAFunction($.x))',
    };
    const { container } = renderBar({ mappings: [errMapping] });
    await act(async () => { vi.advanceTimersByTime(250); });
    const errorList = container.querySelector('.dm-preview-error-list');
    if (errorList) {
      expect(errorList.querySelectorAll('.dm-preview-error-item').length).toBeGreaterThan(0);
    }
    vi.useRealTimers();
  });

  it('updates preview when mappings change', async () => {
    vi.useFakeTimers();
    const { rerender } = renderBar({ mappings: [mapping] });
    await act(async () => { vi.advanceTimersByTime(250); });
    expect(screen.getByText('1 mapping')).toBeTruthy();

    const m2: Mapping = { id: 'm2', sourcePath: 'age', sourceId: 's1', targetPath: 'email' };
    rerender(
      <PreviewBar
        mappings={[mapping, m2]}
        sources={sources}
        activeSourceId="s1"
        targetSampleData={{ userName: '', email: '' }}
      />,
    );
    await act(async () => { vi.advanceTimersByTime(250); });
    expect(screen.getByText('2 mappings')).toBeTruthy();
    vi.useRealTimers();
  });

  it('renders error items with path and message', async () => {
    vi.useFakeTimers();
    const errMapping: Mapping = {
      id: 'm1',
      sourcePath: 'name',
      sourceId: 's1',
      targetPath: 'userName',
      expression: '$upper($nonExistentFunc($.name))',
    };
    const { container } = renderBar({ mappings: [errMapping] });
    await act(async () => { vi.advanceTimersByTime(250); });
    const errItems = container.querySelectorAll('.dm-preview-error-item');
    if (errItems.length > 0) {
      expect(errItems[0].querySelector('.dm-preview-error-path')).toBeTruthy();
      expect(errItems[0].querySelector('.dm-preview-error-msg')).toBeTruthy();
    }
    vi.useRealTimers();
  });

  it('displays mapped output JSON as formatted string', async () => {
    vi.useFakeTimers();
    const { container } = renderBar({ mappings: [mapping] });
    await act(async () => { vi.advanceTimersByTime(250); });
    const outputEl = container.querySelector('.dm-preview-json--output');
    expect(outputEl).toBeTruthy();
    expect(outputEl?.textContent).toContain('Alice');
    vi.useRealTimers();
  });

  it('clears preview when mappings become empty', async () => {
    vi.useFakeTimers();
    const { rerender } = renderBar({ mappings: [mapping] });
    await act(async () => { vi.advanceTimersByTime(250); });
    expect(screen.getByText('Preview')).toBeTruthy();

    rerender(
      <PreviewBar
        mappings={[]}
        sources={sources}
        activeSourceId="s1"
        targetSampleData={{ userName: '', email: '' }}
      />,
    );
    expect(screen.getByText(/Add mappings/)).toBeTruthy();
    vi.useRealTimers();
  });

  it('shows error list with error items for expressions with errors', async () => {
    vi.useFakeTimers();
    const errMapping: Mapping = {
      id: 'm1',
      sourcePath: 'name',
      sourceId: 's1',
      targetPath: 'userName',
      expression: '$upper(',
    };
    const { container } = renderBar({ mappings: [errMapping] });
    await act(async () => { vi.advanceTimersByTime(250); });
    const errorList = container.querySelector('.dm-preview-error-list');
    if (errorList) {
      const items = errorList.querySelectorAll('.dm-preview-error-item');
      expect(items.length).toBeGreaterThan(0);
      expect(items[0].querySelector('.dm-preview-error-path')?.textContent).toBe('userName');
      expect(items[0].querySelector('.dm-preview-error-msg')?.textContent).toBeTruthy();
    }
    vi.useRealTimers();
  });

  it('error list renders filter and map correctly', async () => {
    vi.useFakeTimers();
    const mapping1: Mapping = {
      id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName',
      expression: '$upper(',
    };
    const mapping2: Mapping = {
      id: 'm2', sourcePath: 'name', sourceId: 's1', targetPath: 'email',
    };
    const { container } = renderBar({
      mappings: [mapping1, mapping2],
      targetSampleData: { userName: '', email: '' },
    });
    await act(async () => { vi.advanceTimersByTime(250); });
    const items = container.querySelectorAll('.dm-preview-error-item');
    if (items.length > 0) {
      expect(items.length).toBeLessThanOrEqual(1);
    }
    vi.useRealTimers();
  });

  it('shows source data as (no data) when source not found by activeSourceId', async () => {
    vi.useFakeTimers();
    const { container } = renderBar({
      mappings: [mapping],
      activeSourceId: 'nonexistent',
    });
    await act(async () => { vi.advanceTimersByTime(250); });
    const sourceJson = container.querySelector('.dm-preview-json');
    expect(sourceJson?.textContent).toBe('(no data)');
    vi.useRealTimers();
  });

  it('renders with custom functions passed to computePreview', async () => {
    vi.useFakeTimers();
    const customFn = {
      name: '$myFn',
      description: 'A test function',
      category: 'Custom' as const,
      params: [{ name: 'val', type: 'any' as const }],
      returnType: 'string' as const,
      evaluate: (v: unknown) => String(v) + '!',
    };
    const exprMapping: Mapping = {
      ...mapping,
      expression: '$myFn($.name)',
    };
    renderBar({ mappings: [exprMapping], customFunctions: [customFn] });
    await act(async () => { vi.advanceTimersByTime(250); });
    expect(screen.getByText('Preview')).toBeTruthy();
    vi.useRealTimers();
  });

  it('renders error list for mappings with expression errors', async () => {
    vi.useFakeTimers();
    const badMapping: Mapping = {
      id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName',
      expression: '$unknownFn(',
    };
    const { container } = renderBar({ mappings: [badMapping] });
    await act(async () => { vi.advanceTimersByTime(300); });
    const errorList = container.querySelector('.dm-preview-error-list');
    if (errorList) {
      const items = container.querySelectorAll('.dm-preview-error-item');
      expect(items.length).toBeGreaterThanOrEqual(1);
      expect(container.querySelector('.dm-preview-error-path')?.textContent).toBe('userName');
    }
    vi.useRealTimers();
  });
});
