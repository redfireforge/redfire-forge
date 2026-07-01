import type {
  GrpcDescriptor,
  GrpcEnumSchema,
  GrpcMessageSchema,
  GrpcMethodInfo,
} from '../../../shared/grpc/contracts';
import { slugifyGrpcExplorerId } from './grpcExplorerUtils';

export type SchemaBrowserNodeKind =
  | 'package'
  | 'service'
  | 'method'
  | 'message'
  | 'enum';

export interface SchemaBrowserNode {
  id: string;
  kind: SchemaBrowserNodeKind;
  label: string;
  packageName?: string;
  serviceFullName?: string;
  method?: GrpcMethodInfo;
  messageSchema?: GrpcMessageSchema;
  enumSchema?: GrpcEnumSchema;
  children?: SchemaBrowserNode[];
}

export interface SchemaBrowserSelection {
  nodeId: string;
  serviceFullName?: string;
  methodName?: string;
}

function packageNameFromFullName(fullName: string): string {
  const lastDot = fullName.lastIndexOf('.');
  return lastDot === -1 ? '' : fullName.slice(0, lastDot);
}

function shortNameFromFullName(fullName: string): string {
  const lastDot = fullName.lastIndexOf('.');
  return lastDot === -1 ? fullName : fullName.slice(lastDot + 1);
}

function nodeId(...parts: string[]): string {
  return parts.map((part) => slugifyGrpcExplorerId(part)).join('--');
}

function collectPackages(descriptor: GrpcDescriptor): string[] {
  const packages = new Set<string>();
  for (const service of descriptor.services) {
    packages.add(packageNameFromFullName(service.fullName));
  }
  for (const message of descriptor.messageTypes ?? []) {
    packages.add(packageNameFromFullName(message.typeName));
  }
  for (const enumType of descriptor.enumTypes ?? []) {
    packages.add(packageNameFromFullName(enumType.typeName));
  }
  return [...packages].sort((a, b) => a.localeCompare(b));
}

function messageCatalog(descriptor: GrpcDescriptor): Map<string, GrpcMessageSchema> {
  const map = new Map<string, GrpcMessageSchema>();
  for (const message of descriptor.messageTypes ?? []) {
    map.set(message.typeName, message);
  }
  for (const service of descriptor.services) {
    for (const method of service.methods) {
      if (!map.has(method.requestSchema.typeName)) {
        map.set(method.requestSchema.typeName, method.requestSchema);
      }
      if (!map.has(method.responseSchema.typeName)) {
        map.set(method.responseSchema.typeName, method.responseSchema);
      }
    }
  }
  return map;
}

function enumCatalog(descriptor: GrpcDescriptor): Map<string, GrpcEnumSchema> {
  const map = new Map<string, GrpcEnumSchema>();
  for (const enumType of descriptor.enumTypes ?? []) {
    map.set(enumType.typeName, enumType);
  }
  for (const message of messageCatalog(descriptor).values()) {
    for (const field of message.fields) {
      if (field.enumTypeName && field.enumValues?.length) {
        if (!map.has(field.enumTypeName)) {
          map.set(field.enumTypeName, {
            typeName: field.enumTypeName,
            values: field.enumValues,
          });
        }
      }
    }
  }
  return map;
}

export function lookupMessageSchema(
  descriptor: GrpcDescriptor,
  typeName: string,
): GrpcMessageSchema | undefined {
  return messageCatalog(descriptor).get(typeName);
}

export function lookupEnumSchema(
  descriptor: GrpcDescriptor,
  typeName: string,
): GrpcEnumSchema | undefined {
  return enumCatalog(descriptor).get(typeName);
}

function findPathToNode(
  nodes: SchemaBrowserNode[],
  targetId: string,
  path: SchemaBrowserNode[] = [],
): SchemaBrowserNode[] | null {
  for (const node of nodes) {
    const next = [...path, node];
    if (node.id === targetId) {
      return next;
    }
    if (node.children?.length) {
      const found = findPathToNode(node.children, targetId, next);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

function mergePathIntoFilteredTree(
  filtered: SchemaBrowserNode[],
  path: SchemaBrowserNode[],
): SchemaBrowserNode[] {
  if (!path.length) {
    return filtered;
  }
  const [head, ...rest] = path;
  const existingIdx = filtered.findIndex((node) => node.id === head.id);
  if (existingIdx === -1) {
    return [
      ...filtered,
      {
        ...head,
        children: rest.length ? mergePathIntoFilteredTree([], rest) : head.children,
      },
    ];
  }
  const existing = filtered[existingIdx]!;
  const mergedChildren = rest.length
    ? mergePathIntoFilteredTree(existing.children ?? [], rest)
    : existing.children;
  return filtered.map((node, index) => (
    index === existingIdx ? { ...node, children: mergedChildren } : node
  ));
}

/** Keep the active selection visible in the tree while a search filter is applied. */
export function augmentFilteredTreeWithSelection(
  fullTree: SchemaBrowserNode[],
  filteredTree: SchemaBrowserNode[],
  selectedNodeId?: string,
): SchemaBrowserNode[] {
  if (!selectedNodeId || findSchemaBrowserNode(filteredTree, selectedNodeId)) {
    return filteredTree;
  }
  const path = findPathToNode(fullTree, selectedNodeId);
  if (!path) {
    return filteredTree;
  }
  return mergePathIntoFilteredTree(filteredTree, path);
}

export function buildSchemaBrowserTree(descriptor: GrpcDescriptor): SchemaBrowserNode[] {
  const messages = messageCatalog(descriptor);
  const enums = enumCatalog(descriptor);
  const packages = collectPackages(descriptor);

  return packages.map((packageName) => {
    const packageLabel = packageName || '(root)';
    const services = descriptor.services
      .filter((service) => packageNameFromFullName(service.fullName) === packageName)
      .sort((a, b) => a.fullName.localeCompare(b.fullName));

    const serviceNodes: SchemaBrowserNode[] = services.map((service) => {
      const methodNodes: SchemaBrowserNode[] = service.methods.map((method) => ({
        id: nodeId('method', service.fullName, method.name),
        kind: 'method',
        label: method.name,
        packageName,
        serviceFullName: service.fullName,
        method,
      }));

      return {
        id: nodeId('service', service.fullName),
        kind: 'service',
        label: shortNameFromFullName(service.fullName),
        packageName,
        serviceFullName: service.fullName,
        children: methodNodes,
      };
    });

    const messageNodes: SchemaBrowserNode[] = [...messages.values()]
      .filter((message) => packageNameFromFullName(message.typeName) === packageName)
      .sort((a, b) => a.typeName.localeCompare(b.typeName))
      .map((message) => ({
        id: nodeId('message', message.typeName),
        kind: 'message',
        label: shortNameFromFullName(message.typeName),
        packageName,
        messageSchema: message,
      }));

    const enumNodes: SchemaBrowserNode[] = [...enums.values()]
      .filter((enumType) => packageNameFromFullName(enumType.typeName) === packageName)
      .sort((a, b) => a.typeName.localeCompare(b.typeName))
      .map((enumType) => ({
        id: nodeId('enum', enumType.typeName),
        kind: 'enum',
        label: shortNameFromFullName(enumType.typeName),
        packageName,
        enumSchema: enumType,
      }));

    return {
      id: nodeId('package', packageName || 'root'),
      kind: 'package',
      label: packageLabel,
      packageName,
      children: [...serviceNodes, ...messageNodes, ...enumNodes],
    };
  });
}

export function flattenSchemaBrowserNodes(nodes: SchemaBrowserNode[]): SchemaBrowserNode[] {
  const flat: SchemaBrowserNode[] = [];
  const walk = (list: SchemaBrowserNode[]) => {
    for (const node of list) {
      flat.push(node);
      if (node.children?.length) {
        walk(node.children);
      }
    }
  };
  walk(nodes);
  return flat;
}

export function findSchemaBrowserNode(
  nodes: SchemaBrowserNode[],
  nodeIdToFind: string,
): SchemaBrowserNode | undefined {
  return flattenSchemaBrowserNodes(nodes).find((node) => node.id === nodeIdToFind);
}

function textIncludes(value: string | undefined, query: string): boolean {
  return value?.toLowerCase().includes(query) ?? false;
}

export function filterSchemaBrowserTree(
  nodes: SchemaBrowserNode[],
  query: string,
): SchemaBrowserNode[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return nodes;
  }

  const filterNode = (node: SchemaBrowserNode): SchemaBrowserNode | null => {
    const childMatches = (node.children ?? [])
      .map(filterNode)
      .filter((entry): entry is SchemaBrowserNode => entry !== null);

    const selfMatch = textIncludes(node.label, trimmed)
      || textIncludes(node.packageName, trimmed)
      || textIncludes(node.serviceFullName, trimmed)
      || textIncludes(node.messageSchema?.typeName, trimmed)
      || textIncludes(node.enumSchema?.typeName, trimmed)
      || textIncludes(node.method?.name, trimmed)
      || textIncludes(node.method?.requestTypeName, trimmed)
      || textIncludes(node.method?.responseTypeName, trimmed)
      || textIncludes(node.method?.docComment, trimmed);

    if (selfMatch || childMatches.length > 0) {
      return {
        ...node,
        children: childMatches.length > 0 ? childMatches : (selfMatch ? node.children : undefined),
      };
    }
    return null;
  };

  return nodes
    .map(filterNode)
    .filter((entry): entry is SchemaBrowserNode => entry !== null);
}

export function resolveInitialSchemaBrowserSelection(
  descriptor: GrpcDescriptor,
  selectedService?: string,
  selectedMethod?: string,
): SchemaBrowserSelection | undefined {
  if (!selectedService || !selectedMethod) {
    return undefined;
  }
  const tree = buildSchemaBrowserTree(descriptor);
  const methodNode = flattenSchemaBrowserNodes(tree).find(
    (node) => node.kind === 'method'
      && node.serviceFullName === selectedService
      && node.method?.name === selectedMethod,
  );
  if (!methodNode) {
    return undefined;
  }
  return {
    nodeId: methodNode.id,
    serviceFullName: selectedService,
    methodName: selectedMethod,
  };
}

export function countSchemaBrowserStats(descriptor: GrpcDescriptor): {
  services: number;
  methods: number;
  messages: number;
  enums: number;
} {
  const messages = messageCatalog(descriptor);
  const enums = enumCatalog(descriptor);
  return {
    services: descriptor.services.length,
    methods: descriptor.services.reduce((sum, service) => sum + service.methods.length, 0),
    messages: messages.size,
    enums: enums.size,
  };
}
