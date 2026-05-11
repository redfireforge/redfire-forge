/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import SourceTreeNode from './SourceTreeNode';
import TargetTreeNode from './TargetTreeNode';
import ErrorPopover from './ErrorPopover';
import DriftBanner from './DriftBanner';
import MapperToolbar from './MapperToolbar';
import MappingCompare from './MappingCompare';
import type { JsonTreeNode } from '../../utils/jsonTreeModel';
import type { Mapping } from './types';
import type { ClassifiedDrift } from './utils/schemaDrift';
import type { MappingTrace } from './utils/mappingTrace';

const strLeaf: JsonTreeNode = { key: 'name', path: 'name', type: 'string', value: 'Alice', children: [] };
const numLeaf: JsonTreeNode = { key: 'age', path: 'age', type: 'number', value: 42, children: [] };
const arrLeaf: JsonTreeNode = { key: 'tags', path: 'tags', type: 'array', value: ['a', 'b'], children: [] };
const boolLeaf: JsonTreeNode = { key: 'active', path: 'active', type: 'boolean', value: true, children: [] };
const nullLeaf: JsonTreeNode = { key: 'deleted', path: 'deleted', type: 'null', value: null, children: [] };
const objNode: JsonTreeNode = {
  key: 'user', path: 'user', type: 'object', value: undefined,
  children: [strLeaf, numLeaf],
};

const sourceDefaults = {
  depth: 0,
  search: '',
  onDragStart: vi.fn(),
  sourceId: 's1',
  expandedPaths: new Set(['__root__', '', 'user']),
  onToggle: vi.fn(),
};

const directMapping: Mapping = { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' };
const exprMapping: Mapping = { id: 'm2', sourcePath: 'age', sourceId: 's1', targetPath: 'userAge', expression: '$toString($.age)' };

const targetDefaults = {
  depth: 0,
  search: '',
  mappings: [] as Mapping[],
  onDrop: vi.fn(),
  expandedPaths: new Set(['__root__', '']),
  onToggle: vi.fn(),
  selectedMappingId: null,
  onSelectMapping: vi.fn(),
};

describe('Visual Snapshots — SourceTreeNode', () => {
  it('string leaf with sample value', () => {
    const { container } = render(<SourceTreeNode node={strLeaf} {...sourceDefaults} />);
    expect(container.innerHTML).toMatchSnapshot();
  });

  it('number leaf', () => {
    const { container } = render(<SourceTreeNode node={numLeaf} {...sourceDefaults} />);
    expect(container.innerHTML).toMatchSnapshot();
  });

  it('array leaf', () => {
    const { container } = render(<SourceTreeNode node={arrLeaf} {...sourceDefaults} />);
    expect(container.innerHTML).toMatchSnapshot();
  });

  it('boolean leaf', () => {
    const { container } = render(<SourceTreeNode node={boolLeaf} {...sourceDefaults} />);
    expect(container.innerHTML).toMatchSnapshot();
  });

  it('null leaf', () => {
    const { container } = render(<SourceTreeNode node={nullLeaf} {...sourceDefaults} />);
    expect(container.innerHTML).toMatchSnapshot();
  });

  it('object node expanded with children', () => {
    const { container } = render(<SourceTreeNode node={objNode} {...sourceDefaults} />);
    expect(container.innerHTML).toMatchSnapshot();
  });

  it('mapped source leaf', () => {
    const { container } = render(
      <SourceTreeNode node={strLeaf} {...sourceDefaults} mappedPaths={new Set(['name'])} />,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });

  it('selected source leaf', () => {
    const { container } = render(
      <SourceTreeNode node={strLeaf} {...sourceDefaults} selectedPaths={new Set(['name'])} />,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });

  it('drift indicator on source node', () => {
    const driftMap = new Map([['name', { severity: 'breaking' as const, label: 'Removed' }]]);
    const { container } = render(
      <SourceTreeNode node={strLeaf} {...sourceDefaults} driftMap={driftMap} />,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });

  it('trace overlay on source node', () => {
    const traceOverlay = new Map([['name', { value: '"Alice"', isError: false }]]);
    const { container } = render(
      <SourceTreeNode node={strLeaf} {...sourceDefaults} traceOverlay={traceOverlay} />,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });
});

describe('Visual Snapshots — TargetTreeNode', () => {
  it('unmapped target leaf', () => {
    const { container } = render(
      <TargetTreeNode node={strLeaf} {...targetDefaults} />,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });

  it('direct mapped target leaf', () => {
    const { container } = render(
      <TargetTreeNode node={{ ...strLeaf, key: 'userName', path: 'userName' }} {...targetDefaults} mappings={[directMapping]} />,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });

  it('expression mapped target leaf', () => {
    const { container } = render(
      <TargetTreeNode node={{ ...numLeaf, key: 'userAge', path: 'userAge' }} {...targetDefaults} mappings={[exprMapping]} />,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });

  it('selected mapping highlight', () => {
    const { container } = render(
      <TargetTreeNode
        node={{ ...strLeaf, key: 'userName', path: 'userName' }}
        {...targetDefaults}
        mappings={[directMapping]}
        selectedMappingId="m1"
      />,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });

  it('type mismatch indicator', () => {
    const mismatches = [{
      mappingId: 'm1',
      sourcePath: 'name',
      targetPath: 'userName',
      sourceType: 'number',
      targetType: 'string',
      severity: 'warning' as const,
      message: 'Source is number, target expects string.',
    }];
    const { container } = render(
      <TargetTreeNode
        node={{ ...strLeaf, key: 'userName', path: 'userName' }}
        {...targetDefaults}
        mappings={[directMapping]}
        typeMismatches={mismatches}
      />,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });
});

describe('Visual Snapshots — ErrorPopover', () => {
  it('renders with all fields', () => {
    const { container } = render(
      <ErrorPopover
        data={{
          sourcePath: '$.user.name',
          targetPath: '$.output.name',
          expression: '$toUpper($.user.name)',
          sourceValue: '"alice"',
          targetValue: 'undefined',
          error: 'Function $toUpper is not defined',
        }}
        y={120}
        onClose={vi.fn()}
      />,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });

  it('renders without expression', () => {
    const { container } = render(
      <ErrorPopover
        data={{
          sourcePath: '$.name',
          targetPath: '$.output',
          sourceValue: '"test"',
          targetValue: '"test"',
        }}
        y={50}
        onClose={vi.fn()}
      />,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });
});

describe('Visual Snapshots — DriftBanner', () => {
  it('warning-level drift', () => {
    const drifts: ClassifiedDrift[] = [{
      path: 'email',
      driftType: 'added',
      currentType: 'string',
      affectedMappingIds: [],
      severity: 'info',
      description: 'Field "email" added.',
    }];
    const { container } = render(
      <DriftBanner drifts={drifts} onAcceptAndUpdate={vi.fn()} onDismiss={vi.fn()} />,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });

  it('breaking drift with affected mappings', () => {
    const drifts: ClassifiedDrift[] = [{
      path: 'status',
      driftType: 'removed',
      savedType: 'string',
      affectedMappingIds: ['m1', 'm2'],
      severity: 'breaking',
      description: 'Field "status" was removed — 2 mappings will break.',
    }];
    const { container } = render(
      <DriftBanner drifts={drifts} onAcceptAndUpdate={vi.fn()} onDismiss={vi.fn()} />,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });
});

describe('Visual Snapshots — MapperToolbar', () => {
  it('default state', () => {
    const { container } = render(
      <MapperToolbar
        onAutoMap={vi.fn()}
        onClearAll={vi.fn()}
        onUndo={vi.fn()}
        onRedo={vi.fn()}
        mappingCount={3}
        canUndo={true}
        canRedo={false}
        autoMapCount={5}
      />,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });

  it('with pending mappings and accept/reject', () => {
    const { container } = render(
      <MapperToolbar
        onAutoMap={vi.fn()}
        onClearAll={vi.fn()}
        onUndo={vi.fn()}
        onRedo={vi.fn()}
        mappingCount={3}
        canUndo={false}
        canRedo={true}
        autoMapCount={0}
        hasPending={true}
        onAcceptAllPending={vi.fn()}
        onRejectAllPending={vi.fn()}
      />,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });
});

describe('Visual Snapshots — MappingCompare', () => {
  it('renders comparison results', () => {
    const baseline: MappingTrace[] = [
      { mappingId: 'm1', sourcePath: 'name', targetPath: 'output.name', sourceValue: 'Alice', targetValue: 'Alice', durationMs: 1 },
      { mappingId: 'm2', sourcePath: 'age', targetPath: 'output.age', sourceValue: 25, targetValue: 25, durationMs: 1 },
    ];
    const current: MappingTrace[] = [
      { mappingId: 'm1', sourcePath: 'name', targetPath: 'output.name', sourceValue: 'Bob', targetValue: 'Bob', durationMs: 1 },
      { mappingId: 'm2', sourcePath: 'age', targetPath: 'output.age', sourceValue: 25, targetValue: 25, durationMs: 1 },
    ];
    const { container } = render(
      <MappingCompare baselineTraces={baseline} currentTraces={current} />,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });
});
