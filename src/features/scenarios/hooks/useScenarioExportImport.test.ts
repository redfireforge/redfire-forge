/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useScenarioExportImport } from './useScenarioExportImport';
import type { FeatureGroup, Scenario, TestScenario } from '../../../shared/types';

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
  unwrapImport: vi.fn((raw: unknown) => raw),
  wrapExport: vi.fn((data: unknown, level: string) => ({ _exportMeta: { level, exportedAt: 'now' }, data })),
}));

import { saveJsonFile } from '../../../shared/utils/fileSaver';
import { pickJsonFile } from '../utils/scenarioImportExport';

const mockPickJsonFile = vi.mocked(pickJsonFile);

const makeFg = (id: string, name: string, scenarios: TestScenario[] = []): FeatureGroup => ({
  id, name, scenarios,
});

const makeScenario = (overrides: Partial<Scenario> = {}): Scenario => ({
  id: 'test-1', name: 'Test', url: 'http://x', method: 'GET',
  headers: [], body: '', auth: { type: 'none' }, validation: { mode: 'none' },
  ...overrides,
});

const makeTestScenario = (id: string, name: string, tests: Scenario[] = []): TestScenario => ({
  id, name, tests,
});

describe('useScenarioExportImport', () => {
  let setFeatureGroups: ReturnType<typeof vi.fn>;
  let setCsvImportOpen: ReturnType<typeof vi.fn>;
  let fgsState: FeatureGroup[];

  beforeEach(() => {
    vi.clearAllMocks();
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

  // --- importAll ---
  it('importAll alerts if no service selected', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const { result } = renderHook(() => useScenarioExportImport(
      defaultParams({ selectedSvcId: undefined })
    ));
    act(() => result.current.importAll());
    expect(alertSpy).toHaveBeenCalledWith('Select a microservice and environment first.');
    alertSpy.mockRestore();
  });

  it('importAll alerts if no env selected', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const { result } = renderHook(() => useScenarioExportImport(
      defaultParams({ selectedEnvId: undefined })
    ));
    act(() => result.current.importAll());
    expect(alertSpy).toHaveBeenCalledWith('Select a microservice and environment first.');
    alertSpy.mockRestore();
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
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    mockPickJsonFile.mockImplementation((cb) => cb([{ invalid: true }]));

    const { result } = renderHook(() => useScenarioExportImport(defaultParams()));
    act(() => result.current.importAll());

    expect(alertSpy).toHaveBeenCalledWith('Invalid file: expected feature group(s).');
    alertSpy.mockRestore();
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

  // --- handleCsvImport ---
  it('handleCsvImport adds tests to existing scenario', () => {
    fgsState = [makeFg('fg1', 'Feature 1', [makeTestScenario('s1', 'Scenario 1')])];
    const params = defaultParams();
    const { result } = renderHook(() => useScenarioExportImport(params));

    act(() => result.current.handleCsvImport('fg1', 's1', [makeScenario()]));

    expect(setCsvImportOpen).toHaveBeenCalledWith(false);
    expect(fgsState[0].scenarios[0].tests).toHaveLength(1);
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
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    mockPickJsonFile.mockImplementation((cb) => cb([{ invalid: true }]));

    const { result } = renderHook(() => useScenarioExportImport(defaultParams()));
    act(() => result.current.importScenariosInto('fg1'));

    expect(alertSpy).toHaveBeenCalledWith('Invalid file: expected scenario(s) with a name and tests array.');
    alertSpy.mockRestore();
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
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    mockPickJsonFile.mockImplementation((cb) => cb([{ invalid: true }]));

    const { result } = renderHook(() => useScenarioExportImport(defaultParams()));
    act(() => result.current.importTestsInto('fg1', 's1'));

    expect(alertSpy).toHaveBeenCalledWith('Invalid file: expected test(s) with name, url, and method.');
    alertSpy.mockRestore();
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
