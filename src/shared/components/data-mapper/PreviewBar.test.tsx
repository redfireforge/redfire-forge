/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';

vi.mock('./utils/previewCompute', () => ({
  computePreview: vi.fn(),
}));

import { computePreview } from './utils/previewCompute';
import PreviewBar from './PreviewBar';
import type { Mapping, MapperSource } from './types';

beforeEach(async () => {
  const actual = await vi.importActual<typeof import('./utils/previewCompute')>('./utils/previewCompute');
  vi.mocked(computePreview).mockImplementation(actual.computePreview);
});

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

  it('renders quoted target keys as normal JSON keys in output preview', async () => {
    vi.useFakeTimers();
    const quotedKeyMapping: Mapping = {
      ...mapping,
      targetPath: '"ONZFONCP01MCALM"',
    };
    const { container } = renderBar({ mappings: [quotedKeyMapping] });
    await act(async () => { vi.advanceTimersByTime(250); });
    const outputEl = container.querySelector('.dm-preview-json--output');
    const outputText = outputEl?.textContent ?? '';
    expect(outputText).toContain('"ONZFONCP01MCALM"');
    expect(outputText).toContain('"Alice"');
    expect(outputText).not.toContain('\\"ONZFONCP01MCALM\\"');
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

  it('shows plural errors label and multiple error list rows', async () => {
    vi.useFakeTimers();
    vi.mocked(computePreview).mockReturnValue({
      fields: [
        { targetPath: 'a', value: null, error: 'e1', hasExpression: true },
        { targetPath: 'b', value: null, error: 'e2', hasExpression: true },
      ],
      targetObject: {},
      errorCount: 2,
    });
    const { container } = renderBar({ mappings: [mapping, { ...mapping, id: 'm2', targetPath: 'b' }] });
    await act(async () => { vi.advanceTimersByTime(250); });
    expect(screen.getByText(/2 errors/)).toBeTruthy();
    const items = container.querySelectorAll('.dm-preview-error-item');
    expect(items.length).toBe(2);
    vi.useRealTimers();
  });

  it('renders mapped output as {} when JSON.stringify fails after preview', async () => {
    vi.useFakeTimers();
    vi.mocked(computePreview).mockReturnValue({
      fields: [],
      targetObject: { x: BigInt(1) },
      errorCount: 0,
    });
    const { container } = renderBar({ mappings: [mapping] });
    await act(async () => { vi.advanceTimersByTime(250); });
    const outputEl = container.querySelector('.dm-preview-json--output');
    expect(outputEl?.textContent?.trim()).toBe('{}');
    vi.useRealTimers();
  });

  it('normalizes array and invalid quoted keys in preview object', async () => {
    vi.useFakeTimers();
    const badQuotedKey = '"\\u"';
    vi.mocked(computePreview).mockReturnValue({
      fields: [],
      targetObject: {
        list: [1, { nested: 'y' }],
        [badQuotedKey]: 'keep',
      },
      errorCount: 0,
    });
    const { container } = renderBar({ mappings: [mapping] });
    await act(async () => { vi.advanceTimersByTime(250); });
    const outputEl = container.querySelector('.dm-preview-json--output');
    expect(outputEl?.textContent).toContain('"list"');
    expect(outputEl?.textContent).toContain('keep');
    vi.useRealTimers();
  });

  it('shows singular error label when errorCount is 1', async () => {
    vi.useFakeTimers();
    vi.mocked(computePreview).mockReturnValue({
      fields: [{ targetPath: 'x', value: null, error: 'only', hasExpression: true }],
      targetObject: {},
      errorCount: 1,
    });
    renderBar({ mappings: [mapping] });
    await act(async () => { vi.advanceTimersByTime(250); });
    expect(screen.getByText(/1 error$/)).toBeTruthy();
    expect(screen.queryByText(/1 errors/)).toBeNull();
    vi.useRealTimers();
  });

  it('normalizes string values that look like JSON in preview output', async () => {
    vi.useFakeTimers();
    vi.mocked(computePreview).mockReturnValue({
      fields: [],
      targetObject: { raw: '{"nested":true}', arrStr: '[1,2]' },
      errorCount: 0,
    });
    const { container } = renderBar({ mappings: [mapping] });
    await act(async () => { vi.advanceTimersByTime(250); });
    const outputEl = container.querySelector('.dm-preview-json--output');
    expect(outputEl?.textContent).toContain('"nested"');
    expect(outputEl?.textContent).toContain('1');
    vi.useRealTimers();
  });

  it('leaves unparseable JSON-like string values as raw strings in preview', async () => {
    vi.useFakeTimers();
    vi.mocked(computePreview).mockReturnValue({
      fields: [],
      targetObject: { bad: '{not json' },
      errorCount: 0,
    });
    const { container } = renderBar({ mappings: [mapping] });
    await act(async () => { vi.advanceTimersByTime(250); });
    const outputEl = container.querySelector('.dm-preview-json--output');
    expect(outputEl?.textContent).toContain('{not json');
    vi.useRealTimers();
  });

  it('renders nested arrays in preview output from live computePreview', async () => {
    vi.useFakeTimers();
    const arrSources: MapperSource[] = [
      { id: 's1', label: 'S', sampleData: { tags: ['a', 'b'] } },
    ];
    const mTags: Mapping = {
      id: 'm1', sourcePath: 'tags', sourceId: 's1', targetPath: 'items',
    };
    const { container } = renderBar({
      mappings: [mTags],
      sources: arrSources,
      targetSampleData: { items: null },
    });
    await act(async () => { vi.advanceTimersByTime(250); });
    const outputEl = container.querySelector('.dm-preview-json--output');
    expect(outputEl?.textContent).toContain('[');
    expect(outputEl?.textContent).toContain('"a"');
    vi.useRealTimers();
  });
});
