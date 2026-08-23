import { describe, expect, it } from 'vitest';
import { FIXTURE_DESCRIPTOR, FIXTURE_MULTI_SERVICE_DESCRIPTOR } from '@shared/grpc/contractFixtures';
import {
  augmentFilteredTreeWithSelection,
  buildSchemaBrowserTree,
  filterSchemaBrowserTree,
  findSchemaBrowserNode,
  flattenSchemaBrowserNodes,
  resolveInitialSchemaBrowserSelection,
} from './grpcSchemaBrowserModel';

describe('grpcSchemaBrowserModel', () => {
  it('builds package tree with services and messages', () => {
    const tree = buildSchemaBrowserTree(FIXTURE_DESCRIPTOR);
    expect(tree).toHaveLength(1);
    expect(tree[0]?.label).toBe('echo');
    const children = tree[0]?.children ?? [];
    expect(children.some((node) => node.kind === 'service' && node.label === 'EchoService')).toBe(true);
    expect(children.some((node) => node.kind === 'message' && node.label === 'EchoRequest')).toBe(true);
  });

  it('filters tree nodes by search query', () => {
    const tree = buildSchemaBrowserTree(FIXTURE_DESCRIPTOR);
    const filtered = filterSchemaBrowserTree(tree, 'ServerStream');
    const methodNode = flattenSchemaBrowserNodes(filtered).find((node) => node.kind === 'method');
    expect(methodNode?.method?.name).toBe('ServerStream');
  });

  it('filters tree nodes by request type name', () => {
    const tree = buildSchemaBrowserTree(FIXTURE_DESCRIPTOR);
    const filtered = filterSchemaBrowserTree(tree, 'EchoRequest');
    const messageNode = flattenSchemaBrowserNodes(filtered).find((node) => node.kind === 'message');
    expect(messageNode?.messageSchema?.typeName).toBe('echo.EchoRequest');
  });

  it('resolves initial selection from explorer method binding', () => {
    const selection = resolveInitialSchemaBrowserSelection(FIXTURE_DESCRIPTOR, 'echo.EchoService', 'Echo');
    expect(selection?.nodeId).toBeTruthy();
    const node = selection?.nodeId
      ? findSchemaBrowserNode(buildSchemaBrowserTree(FIXTURE_DESCRIPTOR), selection.nodeId)
      : undefined;
    expect(node?.kind).toBe('method');
    expect(node?.method?.name).toBe('Echo');
  });

  it('supports multi-service descriptors', () => {
    const tree = buildSchemaBrowserTree(FIXTURE_MULTI_SERVICE_DESCRIPTOR);
    expect(tree.length).toBeGreaterThanOrEqual(2);
  });

  it('prefers messageTypes catalog over method-embedded schemas', () => {
    const descriptor = {
      ...FIXTURE_DESCRIPTOR,
      messageTypes: [
        {
          typeName: 'echo.EchoRequest',
          fields: [
            { name: 'message', number: 1, type: 'string' as const, label: 'optional' as const },
            { name: 'extra', number: 2, type: 'string' as const, label: 'optional' as const },
          ],
        },
      ],
    };
    const tree = buildSchemaBrowserTree(descriptor);
    const messageNode = flattenSchemaBrowserNodes(tree).find(
      (node) => node.kind === 'message' && node.messageSchema?.typeName === 'echo.EchoRequest',
    );
    expect(messageNode?.messageSchema?.fields).toHaveLength(2);
  });

  it('keeps selected node visible when search filter would hide it', () => {
    const tree = buildSchemaBrowserTree(FIXTURE_DESCRIPTOR);
    const echoMethod = flattenSchemaBrowserNodes(tree).find(
      (node) => node.kind === 'method' && node.method?.name === 'Echo',
    );
    expect(echoMethod?.id).toBeTruthy();
    const filtered = filterSchemaBrowserTree(tree, 'BidiStream');
    const augmented = augmentFilteredTreeWithSelection(tree, filtered, echoMethod!.id);
    expect(findSchemaBrowserNode(augmented, echoMethod!.id)).toBeTruthy();
  });

  it('prefers enumTypes catalog over field-derived enum stubs', () => {
    const descriptor = {
      ...FIXTURE_DESCRIPTOR,
      enumTypes: [
        {
          typeName: 'echo.Status',
          docComment: 'Full enum docs',
          values: [
            { name: 'OK', number: 0, docComment: 'all good' },
            { name: 'ERR', number: 1 },
          ],
        },
      ],
      services: FIXTURE_DESCRIPTOR.services.map((service) => ({
        ...service,
        methods: service.methods.map((method) => ({
          ...method,
          responseSchema: {
            ...method.responseSchema,
            fields: method.responseSchema.fields.map((field) => (
              field.type === 'enum'
                ? { ...field, enumTypeName: 'echo.Status', enumValues: [{ name: 'OK', number: 0 }] }
                : field
            )),
          },
        })),
      })),
    };
    const tree = buildSchemaBrowserTree(descriptor);
    const enumNode = flattenSchemaBrowserNodes(tree).find(
      (node) => node.kind === 'enum' && node.enumSchema?.typeName === 'echo.Status',
    );
    expect(enumNode?.enumSchema?.docComment).toBe('Full enum docs');
    expect(enumNode?.enumSchema?.values).toHaveLength(2);
  });
});
