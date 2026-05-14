/** @vitest-environment jsdom */
/**
 * Focused tests for the small callback handlers wired by `DataMapperModal`
 * into the inner `<DataMapper>`. The handlers are tiny but were previously
 * unreachable from the broader integration tests because they fire only on
 * specific child interactions.  Here we mock the inner DataMapper, capture
 * the props it receives, and drive the handlers directly.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { MapperAdapter, Mapping } from './types';
import type { Assertion } from '../../types';

interface CapturedDataMapperProps {
  onChange?: (mappings: Mapping[]) => void;
  onSourceSampleChange?: (overrides: Record<string, unknown>) => void;
  onAssertionsChange?: (assertions: Assertion[]) => void;
  onToggleUnorderedArray?: (path: string) => void;
}

const captured: { props: CapturedDataMapperProps | null } = { props: null };

vi.mock('./DataMapper', () => ({
  __esModule: true,
  default: (props: CapturedDataMapperProps) => {
    captured.props = props;
    return <div data-testid="mock-data-mapper" />;
  },
}));

vi.mock('./utils/schemaSnapshot', () => ({
  captureSchemaSnapshot: vi.fn(() => ({
    id: 'snap',
    contextId: 'test',
    side: 'source',
    fields: [],
    capturedAt: new Date().toISOString(),
    topLevelKeyCount: 0,
  })),
  captureSnapshotPair: vi.fn(() => ({ source: [], target: null })),
  loadSnapshot: vi.fn(() => Promise.resolve(null)),
  saveSnapshot: vi.fn(() => Promise.resolve()),
}));

import DataMapperModal from './DataMapperModal';

function makeArrayAdapter(): MapperAdapter<Mapping[]> {
  return {
    contextId: 'test-arr',
    title: 'Array Output Mapper',
    sources: [{ id: 's1', label: 'Source', sampleData: { a: 1 } }],
    target: { label: 'Target', sampleData: { x: 0 }, allowCustomFields: false },
    serialize: (m) => m,
    deserialize: (m) => m,
    capabilities: { unorderedArrays: true },
  };
}

function makeObjectAdapter(): MapperAdapter<Record<string, unknown>> {
  return {
    contextId: 'test-obj',
    title: 'Object Output Mapper',
    sources: [{ id: 's1', label: 'Source', sampleData: { a: 1 } }],
    target: { label: 'Target', sampleData: { x: 0 }, allowCustomFields: false },
    serialize: () => ({ fields: ['a'] }),
    deserialize: () => [],
  };
}

describe('DataMapperModal — child handler wiring', () => {
  beforeEach(() => {
    captured.props = null;
  });

  it('handleAssertionsChange stashes assertions for later use in Save', () => {
    const adapter = makeObjectAdapter();
    const onSave = vi.fn();
    render(<DataMapperModal adapter={adapter} onSave={onSave} onCancel={vi.fn()} />);

    expect(captured.props).toBeTruthy();
    const assertions: Assertion[] = [
      { type: 'status', expected: '200' },
      { type: 'arrayLength', jsonPath: '$.items', operator: '=', value: 3 },
    ];
    act(() => {
      captured.props!.onAssertionsChange?.(assertions);
    });
    act(() => {
      captured.props!.onChange?.([]);
    });

    fireEvent.click(screen.getByText('Save'));
    expect(onSave).toHaveBeenCalledTimes(1);
    const savedOutput = onSave.mock.calls[0][0] as Record<string, unknown>;
    expect(savedOutput.assertions).toEqual(assertions);
  });

  it('Save does NOT inject assertions when the adapter output is an array', () => {
    const adapter = makeArrayAdapter();
    const onSave = vi.fn();
    render(<DataMapperModal adapter={adapter} onSave={onSave} onCancel={vi.fn()} />);

    act(() => { captured.props!.onAssertionsChange?.([{ type: 'status', expected: '200' }]); });
    act(() => { captured.props!.onChange?.([]); });

    fireEvent.click(screen.getByText('Save'));
    const out = onSave.mock.calls[0][0] as unknown[];
    expect(Array.isArray(out)).toBe(true);
    // Arrays don't get the `assertions` property injection.
    expect((out as Mapping[] & { assertions?: Assertion[] }).assertions).toBeUndefined();
  });

  it('Save forwards unorderedArrays state in its second argument', () => {
    const adapter = makeArrayAdapter();
    const onSave = vi.fn();
    render(<DataMapperModal adapter={adapter} onSave={onSave} onCancel={vi.fn()} />);

    // Toggle unordered ON via the handler the child would invoke.
    act(() => { captured.props!.onToggleUnorderedArray?.('$.items'); });
    act(() => { captured.props!.onChange?.([]); });

    fireEvent.click(screen.getByText('Save'));
    expect(onSave).toHaveBeenCalledWith(expect.anything(), { unorderedArrays: true });
  });

  it('handleToggleUnorderedArray inverts the unorderedArrays flag on every call', () => {
    const adapter = makeArrayAdapter();
    const onSave = vi.fn();
    render(<DataMapperModal adapter={adapter} onSave={onSave} onCancel={vi.fn()} />);

    // Toggle on, then off again.
    act(() => { captured.props!.onToggleUnorderedArray?.('$.items'); });
    act(() => { captured.props!.onToggleUnorderedArray?.('$.items'); });
    act(() => { captured.props!.onChange?.([]); });

    fireEvent.click(screen.getByText('Save'));
    expect(onSave).toHaveBeenCalledWith(expect.anything(), { unorderedArrays: false });
  });

  it('handleSourceSampleChange records overrides used in snapshot capture', async () => {
    const { captureSnapshotPair } = await import('./utils/schemaSnapshot');
    const captureSpy = vi.mocked(captureSnapshotPair);
    captureSpy.mockClear();

    const adapter = makeArrayAdapter();
    render(<DataMapperModal adapter={adapter} onSave={vi.fn()} onCancel={vi.fn()} />);

    act(() => {
      captured.props!.onSourceSampleChange?.({ s1: { override: true } });
    });
    act(() => { captured.props!.onChange?.([]); });

    fireEvent.click(screen.getByText('Save'));
    expect(captureSpy).toHaveBeenCalled();
    const sources = captureSpy.mock.calls[0][1] as Array<{ id: string; sampleData: unknown }>;
    expect(sources.find((s) => s.id === 's1')?.sampleData).toEqual({ override: true });
  });

  it('unmounting before drift detection finishes cancels the deadline loop', async () => {
    const adapter = makeArrayAdapter();
    const { unmount } = render(<DataMapperModal adapter={adapter} onSave={vi.fn()} onCancel={vi.fn()} />);
    // Unmount immediately — drift loop is still polling mappingsReadyRef.
    expect(() => unmount()).not.toThrow();
    // Give microtasks a chance to flush; nothing should leak or warn.
    await new Promise((r) => setTimeout(r, 20));
  });
});
