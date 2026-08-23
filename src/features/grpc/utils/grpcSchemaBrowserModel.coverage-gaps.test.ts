import { describe, expect, it } from 'vitest';
import { FIXTURE_DESCRIPTOR, FIXTURE_MULTI_SERVICE_DESCRIPTOR } from '@shared/grpc/contractFixtures';
import {
  augmentFilteredTreeWithSelection,
  buildSchemaBrowserTree,
  countSchemaBrowserStats,
  filterSchemaBrowserTree,
  findSchemaBrowserNode,
  flattenSchemaBrowserNodes,
  lookupEnumSchema,
  lookupMessageSchema,
  resolveInitialSchemaBrowserSelection,
} from './grpcSchemaBrowserModel';

describe('grpcSchemaBrowserModel coverage gaps', () => {
  it('lookupMessageSchema and lookupEnumSchema resolve catalog entries', () => {
    expect(lookupMessageSchema(FIXTURE_DESCRIPTOR, 'echo.EchoRequest')?.typeName).toBe('echo.EchoRequest');
    expect(lookupMessageSchema(FIXTURE_DESCRIPTOR, 'missing.Type')).toBeUndefined();
    expect(lookupEnumSchema(FIXTURE_DESCRIPTOR, 'missing.Enum')).toBeUndefined();
  });

  it('countSchemaBrowserStats aggregates descriptor catalog sizes', () => {
    const stats = countSchemaBrowserStats(FIXTURE_MULTI_SERVICE_DESCRIPTOR);
    expect(stats.services).toBeGreaterThan(1);
    expect(stats.methods).toBeGreaterThan(1);
    expect(stats.messages).toBeGreaterThan(0);
    expect(stats.enums).toBeGreaterThanOrEqual(0);
  });

  it('resolveInitialSchemaBrowserSelection returns undefined for incomplete bindings', () => {
    expect(resolveInitialSchemaBrowserSelection(FIXTURE_DESCRIPTOR)).toBeUndefined();
    expect(resolveInitialSchemaBrowserSelection(FIXTURE_DESCRIPTOR, 'echo.EchoService')).toBeUndefined();
    expect(resolveInitialSchemaBrowserSelection(
      FIXTURE_DESCRIPTOR,
      'missing.Service',
      'Echo',
    )).toBeUndefined();
  });

  it('returns filtered tree unchanged when selection is already visible', () => {
    const tree = buildSchemaBrowserTree(FIXTURE_DESCRIPTOR);
    const echoMethod = flattenSchemaBrowserNodes(tree).find(
      (node) => node.kind === 'method' && node.method?.name === 'Echo',
    )!;
    const filtered = filterSchemaBrowserTree(tree, 'Echo');
    expect(augmentFilteredTreeWithSelection(tree, filtered, echoMethod.id)).toBe(filtered);
  });

  it('returns filtered tree unchanged when selected node is missing from full tree', () => {
    const tree = buildSchemaBrowserTree(FIXTURE_DESCRIPTOR);
    const filtered = filterSchemaBrowserTree(tree, 'BidiStream');
    expect(augmentFilteredTreeWithSelection(tree, filtered, 'missing-node-id')).toBe(filtered);
  });

  it('merges ancestor path for hidden selections and filters by metadata fields', () => {
    const tree = buildSchemaBrowserTree(FIXTURE_DESCRIPTOR);
    const echoMethod = flattenSchemaBrowserNodes(tree).find(
      (node) => node.kind === 'method' && node.method?.name === 'Echo',
    )!;
    const filtered = filterSchemaBrowserTree(tree, 'BidiStream');
    const augmented = augmentFilteredTreeWithSelection(tree, filtered, echoMethod.id);
    expect(findSchemaBrowserNode(augmented, echoMethod.id)).toBeTruthy();

    const byPackage = filterSchemaBrowserTree(tree, 'echo');
    expect(byPackage.length).toBeGreaterThan(0);

    const byRequestType = filterSchemaBrowserTree(tree, 'EchoRequest');
    expect(flattenSchemaBrowserNodes(byRequestType).some((node) => node.kind === 'message')).toBe(true);

    const byResponseType = filterSchemaBrowserTree(tree, 'EchoResponse');
    expect(flattenSchemaBrowserNodes(byResponseType).some((node) => node.kind === 'method')).toBe(true);
  });

  it('returns full tree for blank search and handles root package labels', () => {
    const rootDescriptor = {
      ...FIXTURE_DESCRIPTOR,
      services: [{
        ...FIXTURE_DESCRIPTOR.services[0]!,
        fullName: 'RootService',
      }],
    };
    const tree = buildSchemaBrowserTree(rootDescriptor);
    expect(tree[0]?.label).toBe('(root)');
    expect(filterSchemaBrowserTree(tree, '   ')).toEqual(tree);
  });

  it('findSchemaBrowserNode returns undefined for unknown ids', () => {
    const tree = buildSchemaBrowserTree(FIXTURE_DESCRIPTOR);
    expect(findSchemaBrowserNode(tree, 'does-not-exist')).toBeUndefined();
  });

  it('derives enum stubs from message fields when enumTypes catalog is empty', () => {
    const descriptor = {
      ...FIXTURE_DESCRIPTOR,
      enumTypes: [],
      messageTypes: [{
        typeName: 'echo.StatusHolder',
        fields: [{
          name: 'status',
          number: 1,
          type: 'enum' as const,
          label: 'optional' as const,
          enumTypeName: 'echo.StatusEnum',
          enumValues: [{ name: 'OK', number: 0 }],
        }],
      }],
      services: [],
    };
    const tree = buildSchemaBrowserTree(descriptor);
    expect(flattenSchemaBrowserNodes(tree).some((node) => node.kind === 'enum')).toBe(true);
  });

  it('keeps self-matching leaf nodes without child matches when filtering', () => {
    const tree = buildSchemaBrowserTree(FIXTURE_DESCRIPTOR);
    const filtered = filterSchemaBrowserTree(tree, 'EchoRequest');
    const messageNode = flattenSchemaBrowserNodes(filtered).find((node) => node.kind === 'message');
    expect(messageNode?.messageSchema?.typeName).toBe('echo.EchoRequest');
    expect(messageNode?.children).toBeUndefined();
  });

  it('reuses existing filtered package nodes when augmenting selection paths', () => {
    const tree = buildSchemaBrowserTree(FIXTURE_DESCRIPTOR);
    const echoMethod = flattenSchemaBrowserNodes(tree).find(
      (node) => node.kind === 'method' && node.method?.name === 'Echo',
    )!;
    const packageFiltered = filterSchemaBrowserTree(tree, 'echo');
    const narrow = filterSchemaBrowserTree(tree, 'BidiStream');
    const augmented = augmentFilteredTreeWithSelection(
      tree,
      narrow.length > 0 ? narrow : packageFiltered,
      echoMethod.id,
    );
    expect(findSchemaBrowserNode(augmented, echoMethod.id)).toBeTruthy();
  });
});
