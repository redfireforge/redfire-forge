/**
 * useGraphqlEnvironments — unit tests
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../../../shared/utils/storage', () => ({
  readKey: vi.fn().mockResolvedValue(null),
  writeKey: vi.fn().mockResolvedValue(undefined),
}));

import { readKey, writeKey } from '../../../shared/utils/storage';
import { useGraphqlEnvironments, generateVarId } from './useGraphqlEnvironments';

beforeEach(() => {
  vi.mocked(readKey).mockResolvedValue(null);
  vi.mocked(writeKey).mockResolvedValue(undefined);
});

describe('useGraphqlEnvironments — init', () => {
  it('starts with empty environments', async () => {
    const { result } = renderHook(() => useGraphqlEnvironments());
    await waitFor(() => expect(vi.mocked(readKey)).toHaveBeenCalled());
    expect(result.current.environments).toEqual([]);
    expect(result.current.activeEnvironment).toBeNull();
  });

  it('loads environments from storage on mount', async () => {
    const stored = [{ id: 'env-1', name: 'Dev', variables: [], isActive: true, createdAt: 1, updatedAt: 1 }];
    vi.mocked(readKey).mockResolvedValue(JSON.stringify(stored));
    const { result } = renderHook(() => useGraphqlEnvironments());
    await waitFor(() => expect(result.current.environments).toHaveLength(1));
    expect(result.current.environments[0].name).toBe('Dev');
    expect(result.current.activeEnvironment?.name).toBe('Dev');
  });

  it('ignores non-array stored data', async () => {
    vi.mocked(readKey).mockResolvedValue('"invalid"');
    const { result } = renderHook(() => useGraphqlEnvironments());
    await waitFor(() => expect(vi.mocked(readKey)).toHaveBeenCalled());
    expect(result.current.environments).toEqual([]);
  });

  it('ignores malformed JSON in storage', async () => {
    vi.mocked(readKey).mockResolvedValue('{bad json}');
    const { result } = renderHook(() => useGraphqlEnvironments());
    await waitFor(() => expect(vi.mocked(readKey)).toHaveBeenCalled());
    expect(result.current.environments).toEqual([]);
  });

  it('filters invalid env objects from stored array', async () => {
    const stored = [
      { id: 'env-1', name: 'Valid', variables: [], isActive: false, createdAt: 1, updatedAt: 1 },
      { id: 42, name: 'Invalid id' }, // id is not string
      { id: 'env-3', name: 456 }, // name is not string
    ];
    vi.mocked(readKey).mockResolvedValue(JSON.stringify(stored));
    const { result } = renderHook(() => useGraphqlEnvironments());
    await waitFor(() => expect(result.current.environments).toHaveLength(1));
    expect(result.current.environments[0].name).toBe('Valid');
  });

  it('handles storage read error gracefully', async () => {
    vi.mocked(readKey).mockRejectedValue(new Error('unavailable'));
    const { result } = renderHook(() => useGraphqlEnvironments());
    await waitFor(() => expect(vi.mocked(readKey)).toHaveBeenCalled());
    expect(result.current.environments).toEqual([]);
  });
});

describe('useGraphqlEnvironments — createEnvironment', () => {
  it('creates a new environment and returns its id', async () => {
    const { result } = renderHook(() => useGraphqlEnvironments());
    await waitFor(() => expect(vi.mocked(readKey)).toHaveBeenCalled());
    let id: string;
    act(() => { id = result.current.createEnvironment('Staging'); });
    expect(result.current.environments).toHaveLength(1);
    expect(result.current.environments[0].name).toBe('Staging');
    expect(result.current.environments[0].id).toBe(id!);
    expect(result.current.environments[0].isActive).toBe(false);
  });

  it('uses "New Environment" as default name when empty string is given', async () => {
    const { result } = renderHook(() => useGraphqlEnvironments());
    await waitFor(() => expect(vi.mocked(readKey)).toHaveBeenCalled());
    act(() => { result.current.createEnvironment(''); });
    expect(result.current.environments[0].name).toBe('New Environment');
  });
});

describe('useGraphqlEnvironments — deleteEnvironment', () => {
  it('removes an environment', async () => {
    const { result } = renderHook(() => useGraphqlEnvironments());
    await waitFor(() => expect(vi.mocked(readKey)).toHaveBeenCalled());
    let id: string;
    act(() => { id = result.current.createEnvironment('Temp'); });
    expect(result.current.environments).toHaveLength(1);
    act(() => { result.current.deleteEnvironment(id!); });
    expect(result.current.environments).toHaveLength(0);
  });

  it('auto-activates the first remaining env when the active one is deleted', async () => {
    const stored = [
      { id: 'env-1', name: 'Active', variables: [], isActive: true, createdAt: 1, updatedAt: 1 },
      { id: 'env-2', name: 'Second', variables: [], isActive: false, createdAt: 1, updatedAt: 1 },
    ];
    vi.mocked(readKey).mockResolvedValue(JSON.stringify(stored));
    const { result } = renderHook(() => useGraphqlEnvironments());
    await waitFor(() => expect(result.current.environments).toHaveLength(2));
    act(() => { result.current.deleteEnvironment('env-1'); });
    expect(result.current.environments).toHaveLength(1);
    expect(result.current.environments[0].isActive).toBe(true);
    expect(result.current.environments[0].name).toBe('Second');
  });

  it('does not auto-activate when a non-active env is deleted', async () => {
    const stored = [
      { id: 'env-1', name: 'Active', variables: [], isActive: true, createdAt: 1, updatedAt: 1 },
      { id: 'env-2', name: 'Other', variables: [], isActive: false, createdAt: 1, updatedAt: 1 },
    ];
    vi.mocked(readKey).mockResolvedValue(JSON.stringify(stored));
    const { result } = renderHook(() => useGraphqlEnvironments());
    await waitFor(() => expect(result.current.environments).toHaveLength(2));
    act(() => { result.current.deleteEnvironment('env-2'); });
    expect(result.current.environments[0].isActive).toBe(true);
  });
});

describe('useGraphqlEnvironments — setActiveEnvironment', () => {
  it('activates an environment by id', async () => {
    const stored = [
      { id: 'env-1', name: 'Dev', variables: [], isActive: false, createdAt: 1, updatedAt: 1 },
      { id: 'env-2', name: 'Prod', variables: [], isActive: false, createdAt: 1, updatedAt: 1 },
    ];
    vi.mocked(readKey).mockResolvedValue(JSON.stringify(stored));
    const { result } = renderHook(() => useGraphqlEnvironments());
    await waitFor(() => expect(result.current.environments).toHaveLength(2));
    act(() => { result.current.setActiveEnvironment('env-1'); });
    expect(result.current.environments[0].isActive).toBe(true);
    expect(result.current.environments[1].isActive).toBe(false);
  });

  it('deactivates all when null is passed', async () => {
    const stored = [{ id: 'env-1', name: 'Dev', variables: [], isActive: true, createdAt: 1, updatedAt: 1 }];
    vi.mocked(readKey).mockResolvedValue(JSON.stringify(stored));
    const { result } = renderHook(() => useGraphqlEnvironments());
    await waitFor(() => expect(result.current.activeEnvironment).toBeDefined());
    act(() => { result.current.setActiveEnvironment(null); });
    expect(result.current.activeEnvironment).toBeNull();
  });
});

describe('useGraphqlEnvironments — updateEnvironmentName', () => {
  it('renames an environment', async () => {
    const stored = [{ id: 'env-1', name: 'Old', variables: [], isActive: false, createdAt: 1, updatedAt: 1 }];
    vi.mocked(readKey).mockResolvedValue(JSON.stringify(stored));
    const { result } = renderHook(() => useGraphqlEnvironments());
    await waitFor(() => expect(result.current.environments).toHaveLength(1));
    act(() => { result.current.updateEnvironmentName('env-1', 'New Name'); });
    expect(result.current.environments[0].name).toBe('New Name');
  });

  it('ignores whitespace-only names', async () => {
    const stored = [{ id: 'env-1', name: 'Keep', variables: [], isActive: false, createdAt: 1, updatedAt: 1 }];
    vi.mocked(readKey).mockResolvedValue(JSON.stringify(stored));
    const { result } = renderHook(() => useGraphqlEnvironments());
    await waitFor(() => expect(result.current.environments).toHaveLength(1));
    act(() => { result.current.updateEnvironmentName('env-1', '   '); });
    expect(result.current.environments[0].name).toBe('Keep');
  });

  it('leaves non-matching environments unchanged when renaming (covers L148 else branch)', async () => {
    const stored = [
      { id: 'env-1', name: 'Dev', variables: [], isActive: false, createdAt: 1, updatedAt: 1 },
      { id: 'env-2', name: 'Prod', variables: [], isActive: false, createdAt: 1, updatedAt: 1 },
    ];
    vi.mocked(readKey).mockResolvedValue(JSON.stringify(stored));
    const { result } = renderHook(() => useGraphqlEnvironments());
    await waitFor(() => expect(result.current.environments).toHaveLength(2));
    act(() => { result.current.updateEnvironmentName('env-1', 'Development'); });
    expect(result.current.environments[0].name).toBe('Development');
    expect(result.current.environments[1].name).toBe('Prod');
  });
});

describe('useGraphqlEnvironments — updateVariables', () => {
  it('updates the variables for an environment', async () => {
    const stored = [{ id: 'env-1', name: 'Dev', variables: [], isActive: false, createdAt: 1, updatedAt: 1 }];
    vi.mocked(readKey).mockResolvedValue(JSON.stringify(stored));
    const { result } = renderHook(() => useGraphqlEnvironments());
    await waitFor(() => expect(result.current.environments).toHaveLength(1));
    const newVars = [{ key: 'BASE_URL', value: 'http://api.example.com', enabled: true, masked: false }];
    act(() => { result.current.updateVariables('env-1', newVars); });
    expect(result.current.environments[0].variables).toEqual(newVars);
  });

  it('leaves non-matching environments unchanged when updating variables (covers L158 else branch)', async () => {
    const stored = [
      { id: 'env-1', name: 'Dev', variables: [], isActive: false, createdAt: 1, updatedAt: 1 },
      { id: 'env-2', name: 'Prod', variables: [{ key: 'X', value: '1', enabled: true, masked: false }], isActive: false, createdAt: 1, updatedAt: 1 },
    ];
    vi.mocked(readKey).mockResolvedValue(JSON.stringify(stored));
    const { result } = renderHook(() => useGraphqlEnvironments());
    await waitFor(() => expect(result.current.environments).toHaveLength(2));
    const newVars = [{ key: 'BASE_URL', value: 'http://api.example.com', enabled: true, masked: false }];
    act(() => { result.current.updateVariables('env-1', newVars); });
    expect(result.current.environments[0].variables).toEqual(newVars);
    // env-2 should be unchanged
    expect(result.current.environments[1].variables[0].key).toBe('X');
  });
});

describe('useGraphqlEnvironments — importEnvironment', () => {
  it('imports a Postman-format environment', async () => {
    const { result } = renderHook(() => useGraphqlEnvironments());
    await waitFor(() => expect(vi.mocked(readKey)).toHaveBeenCalled());
    const postman = JSON.stringify({
      name: 'Postman Env',
      values: [
        { key: 'URL', value: 'http://api', enabled: true },
        { key: 'SECRET', value: 'tok', enabled: true, type: 'secret' },
        { key: 'DISABLED', value: 'x', enabled: false },
      ],
    });
    let res: { success: boolean };
    act(() => { res = result.current.importEnvironment(postman); });
    expect(res!.success).toBe(true);
    expect(result.current.environments).toHaveLength(1);
    expect(result.current.environments[0].name).toBe('Postman Env');
    expect(result.current.environments[0].variables).toHaveLength(2); // DISABLED filtered out
    expect(result.current.environments[0].variables[1].masked).toBe(true); // secret
  });

  it('imports a native format environment', async () => {
    const { result } = renderHook(() => useGraphqlEnvironments());
    await waitFor(() => expect(vi.mocked(readKey)).toHaveBeenCalled());
    const native = JSON.stringify({
      name: 'Native Env',
      variables: [{ key: 'X', value: '1', enabled: true, masked: false }],
    });
    let res: { success: boolean };
    act(() => { res = result.current.importEnvironment(native); });
    expect(res!.success).toBe(true);
    expect(result.current.environments[0].name).toBe('Native Env');
  });

  it('returns error for invalid JSON', async () => {
    const { result } = renderHook(() => useGraphqlEnvironments());
    await waitFor(() => expect(vi.mocked(readKey)).toHaveBeenCalled());
    let res: { success: boolean; error?: string };
    act(() => { res = result.current.importEnvironment('{bad json}'); });
    expect(res!.success).toBe(false);
    expect(res!.error).toMatch(/Invalid JSON/);
  });

  it('returns error for non-object root', async () => {
    const { result } = renderHook(() => useGraphqlEnvironments());
    await waitFor(() => expect(vi.mocked(readKey)).toHaveBeenCalled());
    let res: { success: boolean; error?: string };
    act(() => { res = result.current.importEnvironment('"just a string"'); });
    expect(res!.success).toBe(false);
  });

  it('returns error for unrecognized format', async () => {
    const { result } = renderHook(() => useGraphqlEnvironments());
    await waitFor(() => expect(vi.mocked(readKey)).toHaveBeenCalled());
    let res: { success: boolean; error?: string };
    act(() => { res = result.current.importEnvironment('{}'); });
    expect(res!.success).toBe(false);
    expect(res!.error).toMatch(/Unrecognized/);
  });

  it('falls back to "Imported Environment" when Postman name is not a string (line 185 else branch)', async () => {
    const { result } = renderHook(() => useGraphqlEnvironments());
    await waitFor(() => expect(vi.mocked(readKey)).toHaveBeenCalled());

    const postman = JSON.stringify({
      // name is a number — should fall back to 'Imported Environment'
      name: 12345,
      values: [{ key: 'API_KEY', value: 'abc', enabled: true, type: 'default' }],
    });
    let res: { success: boolean; error?: string };
    act(() => { res = result.current.importEnvironment(postman); });
    expect(res!.success).toBe(true);
    expect(result.current.environments[0].name).toBe('Imported Environment');
  });

  it('filters out disabled Postman variables (v.enabled === false)', async () => {
    const { result } = renderHook(() => useGraphqlEnvironments());
    await waitFor(() => expect(vi.mocked(readKey)).toHaveBeenCalled());

    const postman = JSON.stringify({
      name: 'Filtered Env',
      values: [
        { key: 'ENABLED', value: 'yes', enabled: true, type: 'default' },
        { key: 'DISABLED', value: 'no', enabled: false, type: 'default' },
      ],
    });
    act(() => { result.current.importEnvironment(postman); });
    expect(result.current.environments[0].variables).toHaveLength(1);
    expect(result.current.environments[0].variables[0].key).toBe('ENABLED');
  });

  it('imports native format with masked=true variable (line 207 true branch)', async () => {
    const { result } = renderHook(() => useGraphqlEnvironments());
    await waitFor(() => expect(vi.mocked(readKey)).toHaveBeenCalled());

    const native = JSON.stringify({
      name: 'Secure Env',
      variables: [{ key: 'TOKEN', value: 'secret123', enabled: true, masked: true }],
    });
    act(() => { result.current.importEnvironment(native); });
    expect(result.current.environments[0].variables[0].masked).toBe(true);
  });

  it('imports native format with enabled=false variable (line 206 false branch)', async () => {
    const { result } = renderHook(() => useGraphqlEnvironments());
    await waitFor(() => expect(vi.mocked(readKey)).toHaveBeenCalled());

    const native = JSON.stringify({
      name: 'Disabled Var Env',
      variables: [{ key: 'INACTIVE', value: 'val', enabled: false, masked: false }],
    });
    act(() => { result.current.importEnvironment(native); });
    expect(result.current.environments[0].variables[0].enabled).toBe(false);
  });

  it('falls back to "" when Postman variable key/value are null (lines 191-192 ?? branch)', async () => {
    const { result } = renderHook(() => useGraphqlEnvironments());
    await waitFor(() => expect(vi.mocked(readKey)).toHaveBeenCalled());

    const postman = JSON.stringify({
      name: 'Postman Null Keys',
      values: [{ key: null, value: null, enabled: true, type: 'default' }],
    });
    act(() => { result.current.importEnvironment(postman); });
    expect(result.current.environments[0].variables[0].key).toBe('');
    expect(result.current.environments[0].variables[0].value).toBe('');
  });

  it('falls back to "" when native variable key/value are null (lines 206-207 ?? branch)', async () => {
    const { result } = renderHook(() => useGraphqlEnvironments());
    await waitFor(() => expect(vi.mocked(readKey)).toHaveBeenCalled());

    const native = JSON.stringify({
      name: 'Native Null Keys',
      variables: [{ key: null, value: null, enabled: true, masked: false }],
    });
    act(() => { result.current.importEnvironment(native); });
    expect(result.current.environments[0].variables[0].key).toBe('');
    expect(result.current.environments[0].variables[0].value).toBe('');
  });

  it('upsertEnvironment marks demo variables as masked secrets by default', async () => {
    const { result } = renderHook(() => useGraphqlEnvironments());
    await waitFor(() => expect(vi.mocked(readKey)).toHaveBeenCalled());

    act(() => {
      result.current.upsertEnvironment('Demo', [
        { key: 'authToken', value: 'lesson6-demo-jwt' },
        { key: 'apiKey', value: 'lesson6-api-key-secret' },
      ]);
    });

    const demo = result.current.environments.find((e) => e.name === 'Demo');
    expect(demo?.isActive).toBe(true);
    expect(demo?.variables).toEqual([
      { key: 'authToken', value: 'lesson6-demo-jwt', enabled: true, masked: true },
      { key: 'apiKey', value: 'lesson6-api-key-secret', enabled: true, masked: true },
    ]);
  });

  it('upsertEnvironment can opt out of masking with masked: false', async () => {
    const { result } = renderHook(() => useGraphqlEnvironments());
    await waitFor(() => expect(vi.mocked(readKey)).toHaveBeenCalled());

    act(() => {
      result.current.upsertEnvironment('Dev', [{ key: 'BASE_URL', value: 'http://localhost', masked: false }]);
    });

    expect(result.current.environments[0].variables[0].masked).toBe(false);
  });
});

describe('useGraphqlEnvironments — exportEnvironment', () => {
  it('exports an environment as JSON', async () => {
    const stored = [{ id: 'env-1', name: 'Dev', variables: [{ key: 'X', value: '1', enabled: true, masked: false }], isActive: false, createdAt: 1, updatedAt: 1 }];
    vi.mocked(readKey).mockResolvedValue(JSON.stringify(stored));
    const { result } = renderHook(() => useGraphqlEnvironments());
    await waitFor(() => expect(result.current.environments).toHaveLength(1));
    let exported: string | null;
    act(() => { exported = result.current.exportEnvironment('env-1'); });
    expect(typeof exported!).toBe('string');
    const parsed = JSON.parse(exported!) as { name: string; variables: unknown[] };
    expect(parsed.name).toBe('Dev');
    expect(parsed.variables).toHaveLength(1);
  });

  it('returns null for unknown id', async () => {
    const { result } = renderHook(() => useGraphqlEnvironments());
    await waitFor(() => expect(vi.mocked(readKey)).toHaveBeenCalled());
    let exported: string | null;
    act(() => { exported = result.current.exportEnvironment('nonexistent'); });
    expect(exported!).toBeNull();
  });
});

describe('generateVarId', () => {
  it('returns a unique string each call', () => {
    const a = generateVarId();
    const b = generateVarId();
    expect(typeof a).toBe('string');
    expect(a).not.toBe(b);
  });
});
