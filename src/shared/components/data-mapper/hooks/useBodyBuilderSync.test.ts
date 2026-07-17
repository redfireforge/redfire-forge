/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBodyBuilderSync } from './useBodyBuilderSync';
import type { MapperSource } from '../types';

const sources: MapperSource[] = [
  { id: 'vars', label: 'Variables', sampleData: { userId: 'string', name: 'string' }, format: 'json' },
];

/**
 * Helper that simulates a controlled body prop — when onBodyPush fires,
 * the body variable updates and the hook re-renders.
 */
function renderSyncHook(initialBody = '') {
  let body = initialBody;
  const onPush = vi.fn((newBody: string) => {
    body = newBody;
  });
  const hookResult = renderHook(() =>
    useBodyBuilderSync(body, onPush, { sources }),
  );
  return { ...hookResult, onPush, getBody: () => body };
}

describe('useBodyBuilderSync', () => {
  it('initializes with empty mappings', () => {
    const { result } = renderSyncHook('');
    expect(result.current.mappings).toEqual([]);
  });

  it('syncs template → mappings when body changes', () => {
    const { result, rerender, onPush } = renderSyncHook('');

    act(() => {
      result.current.onBodyChange('{"id": "{{userId}}"}');
    });
    rerender();

    expect(result.current.mappings.length).toBe(1);
    expect(result.current.mappings[0].sourcePath).toBe('userId');
    expect(result.current.mappings[0].targetPath).toBe('id');
    expect(onPush).toHaveBeenCalledWith('{"id": "{{userId}}"}');
  });

  it('syncs mappings → body when mappings change', () => {
    const { result, rerender, onPush } = renderSyncHook('{"id": "initial"}');

    act(() => {
      result.current.onMappingsChange([
        { id: 'rb-0', sourceId: 'vars', sourcePath: 'userId', targetPath: 'id' },
      ]);
    });
    rerender();

    expect(onPush).toHaveBeenCalled();
    const lastCall = onPush.mock.calls[onPush.mock.calls.length - 1][0];
    expect(lastCall).toContain('{{userId}}');
  });

  it('no-ops when mappings are equal', () => {
    const { result, rerender, onPush } = renderSyncHook('');

    // First sync from template to get mappings
    act(() => {
      result.current.onBodyChange('{"id": "{{userId}}"}');
    });
    rerender();
    onPush.mockClear();

    const currentMappings = result.current.mappings;

    act(() => {
      result.current.onMappingsChange([...currentMappings]);
    });
    rerender();

    // Should not push body because mappings are identical
    expect(onPush).not.toHaveBeenCalled();
  });

  it('resetSync clears state when external body also resets', () => {
    let body = '';
    const onPush = vi.fn((b: string) => { body = b; });
    const { result, rerender } = renderHook(() =>
      useBodyBuilderSync(body, onPush, { sources }),
    );

    act(() => {
      result.current.onBodyChange('{"id": "{{userId}}"}');
    });
    rerender();
    expect(result.current.mappings.length).toBe(1);

    // Simulate external + internal reset together
    body = '';
    act(() => {
      result.current.resetSync('', []);
    });
    rerender();

    expect(result.current.mappings).toEqual([]);
  });

  it('handles external body changes via rerender', () => {
    let body = '';
    const onPush = vi.fn();
    const { result, rerender } = renderHook(() =>
      useBodyBuilderSync(body, onPush, { sources }),
    );

    expect(result.current.mappings).toEqual([]);

    body = '{"name": "{{name}}"}';
    rerender();

    expect(result.current.mappings.length).toBe(1);
    expect(result.current.mappings[0].sourcePath).toBe('name');
  });

  it('handles non-JSON body gracefully', () => {
    const { result, rerender, onPush } = renderSyncHook('');

    act(() => {
      result.current.onBodyChange('not json at all');
    });
    rerender();

    expect(result.current.mappings).toEqual([]);
    expect(onPush).toHaveBeenCalledWith('not json at all');
  });

  it('preserves mapping IDs on incremental edits', () => {
    const { result, rerender } = renderSyncHook('');

    act(() => {
      result.current.onBodyChange('{"id": "{{userId}}"}');
    });
    rerender();

    const firstId = result.current.mappings[0]?.id;
    expect(firstId).toBeTruthy();

    // Add another field — existing mapping should keep its id
    act(() => {
      result.current.onBodyChange('{"id": "{{userId}}", "name": "{{name}}"}');
    });
    rerender();

    const idMapping = result.current.mappings.find((m) => m.sourcePath === 'userId');
    expect(idMapping?.id).toBe(firstId);
    expect(result.current.mappings.length).toBe(2);
  });

  it('removes mappings when refs are deleted from body', () => {
    const { result, rerender } = renderSyncHook('');

    act(() => {
      result.current.onBodyChange('{"id": "{{userId}}", "name": "{{name}}"}');
    });
    rerender();
    expect(result.current.mappings.length).toBe(2);

    act(() => {
      result.current.onBodyChange('{"id": "{{userId}}"}');
    });
    rerender();

    expect(result.current.mappings.length).toBe(1);
    expect(result.current.mappings[0].sourcePath).toBe('userId');
  });

  it('handles multiple rapid body changes', () => {
    const { result, rerender } = renderSyncHook('');

    act(() => {
      result.current.onBodyChange('{"a": "{{x}}"}');
    });
    rerender();
    act(() => {
      result.current.onBodyChange('{"a": "{{x}}", "b": "{{y}}"}');
    });
    rerender();
    act(() => {
      result.current.onBodyChange('{"b": "{{y}}"}');
    });
    rerender();

    expect(result.current.mappings.length).toBe(1);
    expect(result.current.mappings[0].sourcePath).toBe('y');
    expect(result.current.mappings[0].targetPath).toBe('b');
  });

  it('clears stale mappings when transitioning from invalid to valid JSON', () => {
    let body = 'not-json';
    const onPush = vi.fn((b: string) => { body = b; });
    const { result, rerender } = renderHook(() =>
      useBodyBuilderSync(body, onPush, { sources }),
    );

    // Simulate adding mappings while body is invalid
    act(() => {
      result.current.onMappingsChange([
        { id: 'stale-1', sourcePath: 'userId', sourceId: 'vars', targetPath: 'old_field' },
      ]);
    });
    rerender();
    expect(result.current.mappings.length).toBe(1);

    // Now body transitions externally to valid JSON with no refs
    body = '{"name": "literal"}';
    rerender();

    // Stale mappings should be cleared (not carried forward)
    expect(result.current.mappings.length).toBe(0);
  });

  it('initializes mappings from parseable initial body', () => {
    const { result } = renderSyncHook('{"id": "{{userId}}"}');
    expect(result.current.mappings).toHaveLength(1);
    expect(result.current.mappings[0]?.sourcePath).toBe('userId');
  });

  it('uses applyTemplateDiff when external body changes from parseable JSON', () => {
    let body = '{"id": "{{userId}}"}';
    const onPush = vi.fn((b: string) => { body = b; });
    const { result, rerender } = renderHook(() =>
      useBodyBuilderSync(body, onPush, { sources }),
    );
    expect(result.current.mappings).toHaveLength(1);

    body = '{"id": "{{userId}}", "name": "{{name}}"}';
    rerender();
    expect(result.current.mappings).toHaveLength(2);
  });
});
