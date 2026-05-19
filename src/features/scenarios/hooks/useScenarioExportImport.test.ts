/**
 * @vitest-environment jsdom
 */
import type { SetStateAction } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useScenarioExportImport, type VersionImportOptions } from './useScenarioExportImport';
import type { FeatureGroup, Scenario, SharedDataSource, TestScenario } from '../../../shared/types';
import { makeScenario as _makeScenario } from '../../../test-utils/factories';

// Mock external dependencies
vi.mock('../../../shared/utils/fileSaver', () => ({
  saveJsonFile: vi.fn(),
  buildExportFilename: vi.fn(({ level, name }: { level: string; name?: string }) =>
    `${level}${name ? `-${name}` : ''}.json`
  ),
}));

vi.mock('../utils/scenarioImportExport', () => ({
  pickJsonFile: vi.fn(),
  reIdScenarios: vi.fn((scenarios: TestScenario[]) => scenarios.map((sc) => ({ ...sc, id: `new-${sc.id}` }))),
  unwrapImport: vi.fn((raw: unknown) => {
    if (raw && typeof raw === 'object' && '_exportMeta' in raw && 'data' in raw) {
      return (raw as { data: unknown }).data;
    }
    return raw;
  }),
  wrapExport: vi.fn((data: unknown, level: string) => ({ _exportMeta: { level, exportedAt: 'now' }, data })),
  hasVersionData: vi.fn(() => false),
  stripVersions: vi.fn((data: unknown) => data),
}));

import { saveJsonFile } from '../../../shared/utils/fileSaver';
import { pickJsonFile, hasVersionData, stripVersions } from '../utils/scenarioImportExport';

const mockPickJsonFile = vi.mocked(pickJsonFile);
const mockHasVersionData = vi.mocked(hasVersionData);
const mockStripVersions = vi.mocked(stripVersions);

const makeFg = (id: string, name: string, scenarios: TestScenario[] = []): FeatureGroup => ({
  id, name, scenarios,
});

const makeScenario = (overrides: Partial<Scenario> = {}): Scenario =>
  _makeScenario({ id: 'test-1', url: 'http://x', ...overrides });

const makeTestScenario = (id: string, name: string, tests: Scenario[] = []): TestScenario => ({
  id, name, tests,
});

const makeSharedDataSource = (id: string, name: string): SharedDataSource => ({
  id,
  name,
  updatedAt: 0,
  dataSource: {
    id: `${id}-inner`,
    columns: [],
    rows: [],
    source: { type: 'inline' },
  },
});

describe('useScenarioExportImport', () => {
  let setFeatureGroups: ReturnType<typeof vi.fn>;
  let setCsvImportOpen: ReturnType<typeof vi.fn>;
  let fgsState: FeatureGroup[];

  beforeEach(() => {
    vi.clearAllMocks();
    mockHasVersionData.mockReturnValue(false);
    fgsState = [];
    setFeatureGroups = vi.fn((updater) => {
      if (typeof updater === 'function') {
        fgsState = updater(fgsState);
        return fgsState;
      }
      fgsState = updater;
      return updater;
    });
    setCsvImportOpen = vi.fn();
  });

  const defaultParams = (overrides: Partial<Parameters<typeof useScenarioExportImport>[0]> = {}) => ({
    featureGroups: [makeFg('fg1', 'Feature 1')],
    setFeatureGroups,
    selectedSvcId: 'svc1',
    selectedSvcName: 'MyService',
    selectedEnvId: 'env1',
    selectedEnvName: 'Dev',
    setCsvImportOpen,
    confirm: (_title: string, _msg: string, onConfirm: () => void) => onConfirm(),
    ...overrides,
  });

  // --- exportAll ---
  it('exportAll calls saveJsonFile with wrapped data', () => {
    const { result } = renderHook(() => useScenarioExportImport(defaultParams()));
    act(() => result.current.exportAll());
    expect(saveJsonFile).toHaveBeenCalled();
  });

  it('exportAll with no svcName/envName still exports', () => {
    const { result } = renderHook(() => useScenarioExportImport(
      defaultParams({ selectedSvcName: '', selectedEnvName: '' })
    ));
    act(() => result.current.exportAll());
    expect(saveJsonFile).toHaveBeenCalled();
  });

  it('exportAll attaches sharedDataSources to payload when non-empty', () => {
    const shared = [makeSharedDataSource('ds1', 'Shared 1')];
    const { result } = renderHook(() => useScenarioExportImport(
      defaultParams({ sharedDataSources: shared })
    ));
    act(() => result.current.exportAll());
    expect(saveJsonFile).toHaveBeenCalledWith(
      expect.objectContaining({ sharedDataSources: shared }),
      expect.any(String),
    );
  });

  it('cancelPendingImport clears pending import state', () => {
    mockHasVersionData.mockReturnValue(true);
    fgsState = [];
    const importedFg = makeFg('importedFg', 'Imported', [makeTestScenario('s1', 'Scenario 1')]);
    mockPickJsonFile.mockImplementation((cb) => cb([importedFg]));

    const { result } = renderHook(() => useScenarioExportImport(defaultParams()));
    act(() => result.current.importAll());
    expect(result.current.pendingImport).not.toBeNull();

    act(() => result.current.cancelPendingImport());
    expect(result.current.pendingImport).toBeNull();
  });

  // --- importAll ---
  it('importAll alerts if no service selected', () => {
    const confirmSpy = vi.fn();
    const { result } = renderHook(() => useScenarioExportImport(
      defaultParams({ selectedSvcId: undefined, confirm: confirmSpy })
    ));
    act(() => result.current.importAll());
    expect(confirmSpy).toHaveBeenCalledWith('Import Error', 'Select a microservice and environment first.', expect.any(Function));
  });

  it('importAll alerts if no env selected', () => {
    const confirmSpy = vi.fn();
    const { result } = renderHook(() => useScenarioExportImport(
      defaultParams({ selectedEnvId: undefined, confirm: confirmSpy })
    ));
    act(() => result.current.importAll());
    expect(confirmSpy).toHaveBeenCalledWith('Import Error', 'Select a microservice and environment first.', expect.any(Function));
  });

  it('importAll imports valid feature groups', () => {
    fgsState = [];
    const importedFg = makeFg('importedFg', 'Imported', [makeTestScenario('s1', 'Scenario 1')]);
    mockPickJsonFile.mockImplementation((cb) => cb([importedFg]));

    const { result } = renderHook(() => useScenarioExportImport(defaultParams()));
    act(() => result.current.importAll());

    expect(fgsState).toHaveLength(1);
    expect(fgsState[0].microserviceId).toBe('svc1');
    expect(fgsState[0].environmentId).toBe('env1');
  });

  it('importAll imports a single feature group (non-array)', () => {
    fgsState = [];
    const importedFg = makeFg('importedFg', 'Imported', [makeTestScenario('s1', 'Scenario 1')]);
    mockPickJsonFile.mockImplementation((cb) => cb(importedFg));

    const { result } = renderHook(() => useScenarioExportImport(defaultParams()));
    act(() => result.current.importAll());

    expect(fgsState).toHaveLength(1);
  });

  it('importAll alerts on invalid file format', () => {
    const confirmSpy = vi.fn();
    mockPickJsonFile.mockImplementation((cb) => cb([{ invalid: true }]));

    const { result } = renderHook(() => useScenarioExportImport(defaultParams({ confirm: confirmSpy })));
    act(() => result.current.importAll());

    expect(confirmSpy).toHaveBeenCalledWith('Import Error', 'Invalid file: expected feature group(s).', expect.any(Function));
  });

  it('importAll prompts on conflicting names and imports when confirmed', () => {
    const existingFg = makeFg('fg1', 'Feature 1', [makeTestScenario('s1', 'S1')]);
    fgsState = [existingFg];
    const importedFg = makeFg('fg1', 'Feature 1', [makeTestScenario('s2', 'S2')]);
    mockPickJsonFile.mockImplementation((cb) => cb([importedFg]));
    const confirmSpy = vi.fn((_t: string, _m: string, onConfirm: () => void) => onConfirm());

    const { result } = renderHook(() => useScenarioExportImport(
      defaultParams({ featureGroups: [existingFg], confirm: confirmSpy })
    ));
    act(() => result.current.importAll());

    expect(confirmSpy).toHaveBeenCalled();
    expect(fgsState).toHaveLength(2); // original + imported copy
  });

  it('importAll cancels import when user declines conflict', () => {
    const existingFg = makeFg('fg1', 'Feature 1');
    fgsState = [existingFg];
    const importedFg = makeFg('fg1', 'Feature 1', [makeTestScenario('s2', 'S2')]);
    mockPickJsonFile.mockImplementation((cb) => cb([importedFg]));
    const confirmSpy = vi.fn(); // does NOT call onConfirm

    const { result } = renderHook(() => useScenarioExportImport(
      defaultParams({ featureGroups: [existingFg], confirm: confirmSpy })
    ));
    act(() => result.current.importAll());

    expect(confirmSpy).toHaveBeenCalled();
    expect(fgsState).toEqual([existingFg]); // unchanged
  });

  it('importAll with no conflicts imports without confirm', () => {
    const existingFg = makeFg('fg1', 'Feature 1');
    fgsState = [existingFg];
    const importedFg = makeFg('fg99', 'Feature 99', [makeTestScenario('s2', 'S2')]);
    mockPickJsonFile.mockImplementation((cb) => cb([importedFg]));

    const { result } = renderHook(() => useScenarioExportImport(
      defaultParams({ featureGroups: [existingFg] })
    ));
    act(() => result.current.importAll());

    expect(fgsState).toHaveLength(2);
  });

  it('importAll reports pickJsonFile errors via confirm', () => {
    const confirmSpy = vi.fn();
    mockPickJsonFile.mockImplementation((_cb, onErr) => {
      onErr?.('Bad JSON');
    });
    const { result } = renderHook(() => useScenarioExportImport(
      defaultParams({ confirm: confirmSpy })
    ));
    act(() => result.current.importAll());
    expect(confirmSpy).toHaveBeenCalledWith('Import Error', 'Bad JSON', expect.any(Function));
  });

  it('importAll sets pendingImport when file has version data then finalize imports', () => {
    mockHasVersionData.mockReturnValue(true);
    fgsState = [];
    const importedFg = makeFg('fg99', 'Feature 99', [makeTestScenario('s2', 'S2')]);
    mockPickJsonFile.mockImplementation((cb) => cb([importedFg]));

    const { result } = renderHook(() => useScenarioExportImport(defaultParams()));
    act(() => result.current.importAll());

    expect(result.current.pendingImport).not.toBeNull();
    const versionOpts = {
      importResponseVersions: true,
      importRulesVersions: true,
      importDefinitionVersions: true,
      importStructureLog: true,
    };
    act(() => result.current.pendingImport!.finalize(versionOpts));
    expect(mockStripVersions).toHaveBeenCalled();
    expect(fgsState).toHaveLength(1);
    expect(result.current.pendingImport).toBeNull();
  });

  it('importAll finalize with undefined opts skips stripVersions', () => {
    mockHasVersionData.mockReturnValue(true);
    fgsState = [];
    const importedFg = makeFg('fg99', 'Feature 99', [makeTestScenario('s2', 'S2')]);
    mockPickJsonFile.mockImplementation((cb) => cb([importedFg]));

    const { result } = renderHook(() => useScenarioExportImport(defaultParams()));
    act(() => result.current.importAll());
    mockStripVersions.mockClear();
    act(() => result.current.pendingImport!.finalize(undefined as unknown as VersionImportOptions));
    expect(mockStripVersions).not.toHaveBeenCalled();
    expect(fgsState).toHaveLength(1);
  });

  it('importAll merges sharedDataSources from wrapper file', () => {
    const existingFg = makeFg('fg1', 'Feature 1');
    fgsState = [existingFg];
    let sharedState: SharedDataSource[] = [];
    const setSharedDataSources = vi.fn((updater: SetStateAction<SharedDataSource[]>) => {
      sharedState = typeof updater === 'function' ? updater(sharedState) : updater;
      return sharedState;
    });
    const newDs = makeSharedDataSource('ds-new', 'Imported DS');
    const importedFg = makeFg('fg99', 'Feature 99', [makeTestScenario('s2', 'S2')]);
    const raw = {
      _exportMeta: { level: 'feature-groups', exportedAt: 'x' },
      data: [importedFg],
      sharedDataSources: [newDs],
    };
    mockPickJsonFile.mockImplementation((cb) => cb(raw));

    const { result } = renderHook(() => useScenarioExportImport(
      defaultParams({ featureGroups: [existingFg], setSharedDataSources })
    ));
    act(() => result.current.importAll());

    expect(fgsState).toHaveLength(2);
    expect(sharedState).toEqual([newDs]);
  });

  it('importAll does not duplicate sharedDataSources when id already exists', () => {
    const existingFg = makeFg('fg1', 'Feature 1');
    const existingDs = makeSharedDataSource('ds1', 'Existing');
    fgsState = [existingFg];
    let sharedState: SharedDataSource[] = [existingDs];
    const setSharedDataSources = vi.fn((updater: SetStateAction<SharedDataSource[]>) => {
      sharedState = typeof updater === 'function' ? updater(sharedState) : updater;
      return sharedState;
    });
    const importedFg = makeFg('fg99', 'Feature 99', [makeTestScenario('s2', 'S2')]);
    const raw = {
      _exportMeta: { level: 'feature-groups', exportedAt: 'x' },
      data: [importedFg],
      sharedDataSources: [existingDs],
    };
    mockPickJsonFile.mockImplementation((cb) => cb(raw));

    const { result } = renderHook(() => useScenarioExportImport(
      defaultParams({ featureGroups: [existingFg], setSharedDataSources })
    ));
    act(() => result.current.importAll());

    expect(sharedState).toEqual([existingDs]);
    expect(setSharedDataSources).toHaveBeenCalled();
  });

  it('importAll ignores sharedDataSources when key present but empty or invalid', () => {
    const existingFg = makeFg('fg1', 'Feature 1');
    fgsState = [existingFg];
    const setSharedDataSources = vi.fn();
    const importedFg = makeFg('fg99', 'Feature 99', [makeTestScenario('s2', 'S2')]);

    mockPickJsonFile.mockImplementation((cb) => cb({
      _exportMeta: {},
      data: [importedFg],
      sharedDataSources: [],
    }));
    const { result: r1 } = renderHook(() => useScenarioExportImport(
      defaultParams({ featureGroups: [existingFg], setSharedDataSources })
    ));
    act(() => r1.current.importAll());
    expect(setSharedDataSources).not.toHaveBeenCalled();

    mockPickJsonFile.mockImplementation((cb) => cb({
      _exportMeta: {},
      data: [importedFg],
      sharedDataSources: 'nope',
    }));
    const { result: r2 } = renderHook(() => useScenarioExportImport(
      defaultParams({ featureGroups: [existingFg], setSharedDataSources })
    ));
    act(() => r2.current.importAll());
    expect(setSharedDataSources).not.toHaveBeenCalled();
  });

  it('importAll prompts on duplicate id even when feature group name differs', () => {
    const existingFg = makeFg('same-id', 'Feature A');
    fgsState = [existingFg];
    const importedFg = makeFg('same-id', 'Feature B', [makeTestScenario('s2', 'S2')]);
    mockPickJsonFile.mockImplementation((cb) => cb([importedFg]));
    const confirmSpy = vi.fn();

    const { result } = renderHook(() => useScenarioExportImport(
      defaultParams({ featureGroups: [existingFg], confirm: confirmSpy })
    ));
    act(() => result.current.importAll());

    expect(confirmSpy).toHaveBeenCalledWith(
      'Import Conflicts',
      expect.stringContaining('Feature B'),
      expect.any(Function),
    );
  });

  // --- handleCsvImport ---
  it('handleCsvImport adds tests to existing scenario', () => {
    fgsState = [makeFg('fg1', 'Feature 1', [makeTestScenario('s1', 'Scenario 1')])];
    const params = defaultParams();
    const { result } = renderHook(() => useScenarioExportImport(params));

    act(() => result.current.handleCsvImport('fg1', 's1', [makeScenario()]));

    expect(setCsvImportOpen).toHaveBeenCalledWith(false);
    expect(fgsState[0].scenarios[0].tests).toHaveLength(1);
  });

  it('handleCsvImport when appending to existing scenario leaves other scenarios in the group unchanged', () => {
    const s1 = makeTestScenario('s1', 'Keep', []);
    const s2 = makeTestScenario('s2', 'Target', []);
    fgsState = [makeFg('fg1', 'Feature 1', [s1, s2])];
    const { result } = renderHook(() => useScenarioExportImport(defaultParams()));

    act(() => result.current.handleCsvImport('fg1', 's2', [makeScenario({ name: 'Added' })]));

    expect(fgsState[0].scenarios[0]).toBe(s1);
    expect(fgsState[0].scenarios[1].tests).toHaveLength(1);
  });

  it('handleCsvImport skips non-matching fg', () => {
    fgsState = [makeFg('fg1', 'Feature 1', [makeTestScenario('s1', 'Scenario 1')])];
    const { result } = renderHook(() => useScenarioExportImport(defaultParams()));

    act(() => result.current.handleCsvImport('fg-nonexistent', 's1', [makeScenario()]));
    // Should not modify the existing fg
    expect(fgsState[0].scenarios[0].tests).toHaveLength(0);
  });

  it('handleCsvImport creates new scenario when scenarioId starts with __new__:', () => {
    fgsState = [makeFg('fg1', 'Feature 1')];
    const { result } = renderHook(() => useScenarioExportImport(defaultParams()));

    act(() => result.current.handleCsvImport('fg1', '__new__:New Scenario', [makeScenario()]));

    expect(fgsState[0].scenarios).toHaveLength(1);
    expect(fgsState[0].scenarios[0].name).toBe('New Scenario');
  });

  it('handleCsvImport creates new feature group when fgId starts with __new_fg__:', () => {
    fgsState = [];
    const { result } = renderHook(() => useScenarioExportImport(defaultParams()));

    act(() => result.current.handleCsvImport('__new_fg__:New Feature', '__new__:New Scenario', [makeScenario()]));

    expect(fgsState).toHaveLength(1);
    expect(fgsState[0].name).toBe('New Feature');
    expect(fgsState[0].scenarios[0].name).toBe('New Scenario');
  });

  it('handleCsvImport uses default name when scenName is empty for new fg', () => {
    fgsState = [];
    const { result } = renderHook(() => useScenarioExportImport(defaultParams()));

    act(() => result.current.handleCsvImport('__new_fg__:New Feature', 'some-existing-id', [makeScenario()]));

    expect(fgsState[0].scenarios[0].name).toBe('Imported Tests');
    expect(setCsvImportOpen).toHaveBeenCalledWith(false);
  });

  // --- export helpers ---
  it('exportFeatureGroup calls saveJsonFile', () => {
    const { result } = renderHook(() => useScenarioExportImport(defaultParams()));
    act(() => result.current.exportFeatureGroup(makeFg('fg1', 'Feature 1')));
    expect(saveJsonFile).toHaveBeenCalled();
  });

  it('exportScenario calls saveJsonFile', () => {
    const { result } = renderHook(() => useScenarioExportImport(defaultParams()));
    act(() => result.current.exportScenario(makeTestScenario('s1', 'Scenario')));
    expect(saveJsonFile).toHaveBeenCalled();
  });

  it('exportTest calls saveJsonFile', () => {
    const { result } = renderHook(() => useScenarioExportImport(defaultParams()));
    act(() => result.current.exportTest(makeScenario()));
    expect(saveJsonFile).toHaveBeenCalled();
  });

  // --- importScenariosInto ---
  it('importScenariosInto imports valid scenarios', () => {
    const existingFg = makeFg('fg1', 'Feature 1');
    fgsState = [existingFg];
    const imported = makeTestScenario('s1', 'Scenario 1', [makeScenario()]);
    mockPickJsonFile.mockImplementation((cb) => cb([imported]));

    const { result } = renderHook(() => useScenarioExportImport(
      defaultParams({ featureGroups: [existingFg] })
    ));
    act(() => result.current.importScenariosInto('fg1'));

    expect(fgsState[0].scenarios).toHaveLength(1);
  });

  it('importScenariosInto handles single scenario (non-array)', () => {
    const existingFg = makeFg('fg1', 'Feature 1');
    fgsState = [existingFg];
    const imported = makeTestScenario('s1', 'Scenario 1', [makeScenario()]);
    mockPickJsonFile.mockImplementation((cb) => cb(imported));

    const { result } = renderHook(() => useScenarioExportImport(
      defaultParams({ featureGroups: [existingFg] })
    ));
    act(() => result.current.importScenariosInto('fg1'));

    expect(fgsState[0].scenarios).toHaveLength(1);
  });

  it('importScenariosInto alerts on invalid data', () => {
    const confirmSpy = vi.fn();
    mockPickJsonFile.mockImplementation((cb) => cb([{ invalid: true }]));

    const { result } = renderHook(() => useScenarioExportImport(defaultParams({ confirm: confirmSpy })));
    act(() => result.current.importScenariosInto('fg1'));

    expect(confirmSpy).toHaveBeenCalledWith('Import Error', 'Invalid file: expected scenario(s) with a name and tests array.', expect.any(Function));
  });

  it('importScenariosInto prompts on duplicate names and imports when confirmed', () => {
    const existingSc = makeTestScenario('s1', 'Scenario 1', [makeScenario()]);
    const existingFg = makeFg('fg1', 'Feature 1', [existingSc]);
    fgsState = [existingFg];
    const imported = makeTestScenario('s2', 'Scenario 1', [makeScenario()]);
    mockPickJsonFile.mockImplementation((cb) => cb([imported]));
    const confirmSpy = vi.fn((_t: string, _m: string, onConfirm: () => void) => onConfirm());

    const { result } = renderHook(() => useScenarioExportImport(
      defaultParams({ featureGroups: [existingFg], confirm: confirmSpy })
    ));
    act(() => result.current.importScenariosInto('fg1'));

    expect(confirmSpy).toHaveBeenCalled();
    expect(fgsState[0].scenarios).toHaveLength(2);
  });

  it('importScenariosInto reports pickJsonFile errors via confirm', () => {
    const confirmSpy = vi.fn();
    mockPickJsonFile.mockImplementation((_cb, onErr) => {
      onErr?.('Read failed');
    });
    const { result } = renderHook(() => useScenarioExportImport(
      defaultParams({ confirm: confirmSpy })
    ));
    act(() => result.current.importScenariosInto('fg1'));
    expect(confirmSpy).toHaveBeenCalledWith('Import Error', 'Read failed', expect.any(Function));
  });

  it('importScenariosInto sets pendingImport when version data present then finalize imports', () => {
    mockHasVersionData.mockReturnValue(true);
    const existingFg = makeFg('fg1', 'Feature 1');
    fgsState = [existingFg];
    const imported = makeTestScenario('s1', 'Scenario 1', [makeScenario()]);
    mockPickJsonFile.mockImplementation((cb) => cb([imported]));

    const { result } = renderHook(() => useScenarioExportImport(
      defaultParams({ featureGroups: [existingFg] })
    ));
    act(() => result.current.importScenariosInto('fg1'));

    expect(result.current.pendingImport).not.toBeNull();
    const opts: VersionImportOptions = {
      importResponseVersions: false,
      importRulesVersions: true,
      importDefinitionVersions: true,
      importStructureLog: true,
    };
    act(() => result.current.pendingImport!.finalize(opts));
    expect(mockStripVersions).toHaveBeenCalled();
    expect(fgsState[0].scenarios).toHaveLength(1);
    expect(result.current.pendingImport).toBeNull();
  });

  it('importScenariosInto cancels when user declines duplicate', () => {
    const existingSc = makeTestScenario('s1', 'Scenario 1', [makeScenario()]);
    const existingFg = makeFg('fg1', 'Feature 1', [existingSc]);
    fgsState = [existingFg];
    const imported = makeTestScenario('s2', 'Scenario 1', [makeScenario()]);
    mockPickJsonFile.mockImplementation((cb) => cb([imported]));
    const confirmSpy = vi.fn(); // does NOT call onConfirm

    const { result } = renderHook(() => useScenarioExportImport(
      defaultParams({ featureGroups: [existingFg], confirm: confirmSpy })
    ));
    act(() => result.current.importScenariosInto('fg1'));

    expect(confirmSpy).toHaveBeenCalled();
    expect(fgsState[0].scenarios).toHaveLength(1); // unchanged
  });

  it('importScenariosInto with duplicate names updates only the target feature group', () => {
    const fgOther = makeFg('fg-other', 'Other FG');
    const existingSc = makeTestScenario('s1', 'Scenario 1', [makeScenario()]);
    const existingFg = makeFg('fg1', 'Feature 1', [existingSc]);
    fgsState = [fgOther, existingFg];
    const imported = makeTestScenario('s2', 'Scenario 1', [makeScenario()]);
    mockPickJsonFile.mockImplementation((cb) => cb([imported]));
    const confirmSpy = vi.fn((_t: string, _m: string, onConfirm: () => void) => onConfirm());

    const { result } = renderHook(() => useScenarioExportImport(
      defaultParams({ featureGroups: [fgOther, existingFg], confirm: confirmSpy })
    ));
    act(() => result.current.importScenariosInto('fg1'));

    expect(fgsState[0]).toBe(fgOther);
    expect(fgsState[1].scenarios).toHaveLength(2);
  });

  it('importScenariosInto without duplicates updates only the target feature group among several', () => {
    const fgOther = makeFg('fg-other', 'Other');
    const existingFg = makeFg('fg1', 'Feature 1', [makeTestScenario('s1', 'Only', [])]);
    fgsState = [fgOther, existingFg];
    const imported = makeTestScenario('s-new', 'Brand New', [makeScenario()]);
    mockPickJsonFile.mockImplementation((cb) => cb([imported]));

    const { result } = renderHook(() => useScenarioExportImport(
      defaultParams({ featureGroups: [fgOther, existingFg] })
    ));
    act(() => result.current.importScenariosInto('fg1'));

    expect(fgsState[0]).toBe(fgOther);
    expect(fgsState[1].scenarios).toHaveLength(2);
  });

  it('importScenariosInto into non-existing fg skips confirm', () => {
    fgsState = [makeFg('fg1', 'Feature 1')];
    const imported = makeTestScenario('s1', 'Scenario 1', [makeScenario()]);
    mockPickJsonFile.mockImplementation((cb) => cb([imported]));

    const { result } = renderHook(() => useScenarioExportImport(
      defaultParams({ featureGroups: [makeFg('fg2', 'Other')] })
    ));
    act(() => result.current.importScenariosInto('fg1'));

    // fg not found in featureGroups for duplicate check, but still adds
    expect(fgsState[0].scenarios).toHaveLength(1);
  });

  // --- importTestsInto ---
  it('importTestsInto imports valid tests', () => {
    const existingSc = makeTestScenario('s1', 'Scenario 1');
    const existingFg = makeFg('fg1', 'Feature 1', [existingSc]);
    fgsState = [existingFg];
    const importedTest = makeScenario({ id: 't1', name: 'Imported Test' });
    mockPickJsonFile.mockImplementation((cb) => cb([importedTest]));

    const { result } = renderHook(() => useScenarioExportImport(
      defaultParams({ featureGroups: [existingFg] })
    ));
    act(() => result.current.importTestsInto('fg1', 's1'));

    expect(fgsState[0].scenarios[0].tests).toHaveLength(1);
  });

  it('importTestsInto handles single test (non-array)', () => {
    const existingSc = makeTestScenario('s1', 'Scenario 1');
    const existingFg = makeFg('fg1', 'Feature 1', [existingSc]);
    fgsState = [existingFg];
    const importedTest = makeScenario({ id: 't1', name: 'Imported Test' });
    mockPickJsonFile.mockImplementation((cb) => cb(importedTest));

    const { result } = renderHook(() => useScenarioExportImport(
      defaultParams({ featureGroups: [existingFg] })
    ));
    act(() => result.current.importTestsInto('fg1', 's1'));

    expect(fgsState[0].scenarios[0].tests).toHaveLength(1);
  });

  it('importTestsInto alerts on invalid data', () => {
    const confirmSpy = vi.fn();
    mockPickJsonFile.mockImplementation((cb) => cb([{ invalid: true }]));

    const { result } = renderHook(() => useScenarioExportImport(defaultParams({ confirm: confirmSpy })));
    act(() => result.current.importTestsInto('fg1', 's1'));

    expect(confirmSpy).toHaveBeenCalledWith('Import Error', 'Invalid file: expected test(s) with name, url, and method.', expect.any(Function));
  });

  it('importTestsInto prompts on duplicate test names and imports when confirmed', () => {
    const existingTest = makeScenario({ id: 't1', name: 'Test 1' });
    const existingSc = makeTestScenario('s1', 'Scenario 1', [existingTest]);
    const existingFg = makeFg('fg1', 'Feature 1', [existingSc]);
    fgsState = [existingFg];
    const importedTest = makeScenario({ id: 't2', name: 'Test 1' });
    mockPickJsonFile.mockImplementation((cb) => cb([importedTest]));
    const confirmSpy = vi.fn((_t: string, _m: string, onConfirm: () => void) => onConfirm());

    const { result } = renderHook(() => useScenarioExportImport(
      defaultParams({ featureGroups: [existingFg], confirm: confirmSpy })
    ));
    act(() => result.current.importTestsInto('fg1', 's1'));

    expect(confirmSpy).toHaveBeenCalled();
    expect(fgsState[0].scenarios[0].tests).toHaveLength(2);
  });

  it('importTestsInto reports pickJsonFile errors via confirm', () => {
    const confirmSpy = vi.fn();
    mockPickJsonFile.mockImplementation((_cb, onErr) => {
      onErr?.('Disk error');
    });
    const { result } = renderHook(() => useScenarioExportImport(
      defaultParams({ confirm: confirmSpy })
    ));
    act(() => result.current.importTestsInto('fg1', 's1'));
    expect(confirmSpy).toHaveBeenCalledWith('Import Error', 'Disk error', expect.any(Function));
  });

  it('importTestsInto sets pendingImport when version data present then finalize imports', () => {
    mockHasVersionData.mockReturnValue(true);
    const existingSc = makeTestScenario('s1', 'Scenario 1');
    const existingFg = makeFg('fg1', 'Feature 1', [existingSc]);
    fgsState = [existingFg];
    const importedTest = makeScenario({ id: 't1', name: 'Imported Test' });
    mockPickJsonFile.mockImplementation((cb) => cb([importedTest]));

    const { result } = renderHook(() => useScenarioExportImport(
      defaultParams({ featureGroups: [existingFg] })
    ));
    act(() => result.current.importTestsInto('fg1', 's1'));

    expect(result.current.pendingImport).not.toBeNull();
    act(() => result.current.pendingImport!.finalize({
      importResponseVersions: true,
      importRulesVersions: true,
      importDefinitionVersions: true,
      importStructureLog: false,
    }));
    expect(mockStripVersions).toHaveBeenCalled();
    expect(fgsState[0].scenarios[0].tests).toHaveLength(1);
    expect(result.current.pendingImport).toBeNull();
  });

  it('importTestsInto cancels when user declines duplicate', () => {
    const existingTest = makeScenario({ id: 't1', name: 'Test 1' });
    const existingSc = makeTestScenario('s1', 'Scenario 1', [existingTest]);
    const existingFg = makeFg('fg1', 'Feature 1', [existingSc]);
    fgsState = [existingFg];
    const importedTest = makeScenario({ id: 't2', name: 'Test 1' });
    mockPickJsonFile.mockImplementation((cb) => cb([importedTest]));
    const confirmSpy = vi.fn(); // does NOT call onConfirm

    const { result } = renderHook(() => useScenarioExportImport(
      defaultParams({ featureGroups: [existingFg], confirm: confirmSpy })
    ));
    act(() => result.current.importTestsInto('fg1', 's1'));

    expect(confirmSpy).toHaveBeenCalled();
    expect(fgsState[0].scenarios[0].tests).toHaveLength(1); // unchanged
  });

  it('importTestsInto with duplicate test names updates only the target feature group', () => {
    const fgOther = makeFg('fg-other', 'Other');
    const existingTest = makeScenario({ id: 't1', name: 'Test 1' });
    const existingSc = makeTestScenario('s1', 'Scenario 1', [existingTest]);
    const existingFg = makeFg('fg1', 'Feature 1', [existingSc]);
    fgsState = [fgOther, existingFg];
    const importedTest = makeScenario({ id: 't2', name: 'Test 1' });
    mockPickJsonFile.mockImplementation((cb) => cb([importedTest]));
    const confirmSpy = vi.fn((_t: string, _m: string, onConfirm: () => void) => onConfirm());

    const { result } = renderHook(() => useScenarioExportImport(
      defaultParams({ featureGroups: [fgOther, existingFg], confirm: confirmSpy })
    ));
    act(() => result.current.importTestsInto('fg1', 's1'));

    expect(fgsState[0]).toBe(fgOther);
    expect(fgsState[1].scenarios[0].tests).toHaveLength(2);
  });

  it('importTestsInto with duplicate tests maps only the target scenario when feature has multiple scenarios', () => {
    const existingTest = makeScenario({ id: 't1', name: 'Test 1' });
    const scKeep = makeTestScenario('s-keep', 'Keep');
    const scTarget = makeTestScenario('s-target', 'Target', [existingTest]);
    const existingFg = makeFg('fg1', 'Feature 1', [scKeep, scTarget]);
    const fgOther = makeFg('fg-0', 'Z');
    fgsState = [fgOther, existingFg];
    const importedTest = makeScenario({ id: 't2', name: 'Test 1' });
    mockPickJsonFile.mockImplementation((cb) => cb([importedTest]));
    const confirmSpy = vi.fn((_t: string, _m: string, onConfirm: () => void) => onConfirm());

    const { result } = renderHook(() => useScenarioExportImport(
      defaultParams({ featureGroups: [fgOther, existingFg], confirm: confirmSpy })
    ));
    act(() => result.current.importTestsInto('fg1', 's-target'));

    expect(fgsState[1].scenarios[0].tests).toHaveLength(0);
    expect(fgsState[1].scenarios[1].tests).toHaveLength(2);
  });

  it('importTestsInto without duplicates maps only the target scenario', () => {
    const scKeep = makeTestScenario('s-keep', 'Keep');
    const scTarget = makeTestScenario('s-target', 'Target', []);
    const existingFg = makeFg('fg1', 'Feature 1', [scKeep, scTarget]);
    const fgOther = makeFg('fg-0', 'Z');
    fgsState = [fgOther, existingFg];
    const importedTest = makeScenario({ id: 'tx', name: 'Fresh' });
    mockPickJsonFile.mockImplementation((cb) => cb([importedTest]));

    const { result } = renderHook(() => useScenarioExportImport(
      defaultParams({ featureGroups: [fgOther, existingFg] })
    ));
    act(() => result.current.importTestsInto('fg1', 's-target'));

    expect(fgsState[1].scenarios[0].tests).toHaveLength(0);
    expect(fgsState[1].scenarios[1].tests).toHaveLength(1);
  });

  it('importTestsInto into non-existing scenario skips confirm', () => {
    const existingFg = makeFg('fg1', 'Feature 1', [makeTestScenario('s1', 'S1')]);
    fgsState = [existingFg];
    const importedTest = makeScenario({ id: 't1', name: 'Test 1' });
    mockPickJsonFile.mockImplementation((cb) => cb([importedTest]));

    const { result } = renderHook(() => useScenarioExportImport(
      defaultParams({ featureGroups: [existingFg] })
    ));
    act(() => result.current.importTestsInto('fg1', 's-nonexistent'));

    // scenario not found, no duplicate check, still adds to s-nonexistent
    expect(pickJsonFile).toHaveBeenCalled();
  });
});
