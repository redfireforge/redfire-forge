import type { SchemaBrowserNode } from '../utils/grpcSchemaBrowserModel';

function TreeNodeButton({
  node,
  depth,
  selectedNodeId,
  onSelect,
}: {
  node: SchemaBrowserNode;
  depth: number;
  selectedNodeId?: string;
  onSelect: (node: SchemaBrowserNode) => void;
}) {
  const isPackage = node.kind === 'package';
  if (isPackage) {
    return (
      <div
        className="grpc-schema-tree-package"
        style={{ paddingLeft: `${8 + depth * 12}px` }}
      >
        {node.label}
      </div>
    );
  }

  const icon = node.kind === 'service'
    ? '⚡'
    : node.kind === 'method'
      ? 'ƒ'
      : node.kind === 'enum'
        ? 'E'
        : '⬡';

  return (
    <button
      type="button"
      className={`grpc-schema-tree-node grpc-schema-tree-node--${node.kind}${selectedNodeId === node.id ? ' grpc-schema-tree-node--active' : ''}`}
      style={{ paddingLeft: `${12 + depth * 12}px` }}
      data-testid={`grpc-schema-tree-node-${node.id}`}
      onClick={() => onSelect(node)}
    >
      <span className="grpc-schema-tree-node-icon" aria-hidden>{icon}</span>
      <span className="grpc-schema-tree-node-label">{node.label}</span>
    </button>
  );
}

function TreeNodes({
  nodes,
  depth,
  selectedNodeId,
  onSelect,
}: {
  nodes: SchemaBrowserNode[];
  depth: number;
  selectedNodeId?: string;
  onSelect: (node: SchemaBrowserNode) => void;
}) {
  return (
    <>
      {nodes.map((node) => (
        <div key={node.id}>
          <TreeNodeButton
            node={node}
            depth={depth}
            selectedNodeId={selectedNodeId}
            onSelect={onSelect}
          />
          {node.children?.length ? (
            <TreeNodes
              nodes={node.children}
              depth={depth + 1}
              selectedNodeId={selectedNodeId}
              onSelect={onSelect}
            />
          ) : null}
        </div>
      ))}
    </>
  );
}

export function SchemaBrowserTree({
  nodes,
  selectedNodeId,
  onSelect,
}: {
  nodes: SchemaBrowserNode[];
  selectedNodeId?: string;
  onSelect: (node: SchemaBrowserNode) => void;
}) {
  if (nodes.length === 0) {
    return (
      <p className="grpc-schema-tree-empty" data-testid="grpc-schema-tree-empty">
        No schema nodes match your search.
      </p>
    );
  }

  return (
    <TreeNodes
      nodes={nodes}
      depth={0}
      selectedNodeId={selectedNodeId}
      onSelect={onSelect}
    />
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function findSchemaNodeByTypeName(
  nodes: SchemaBrowserNode[],
  typeName: string,
): SchemaBrowserNode | undefined {
  for (const node of nodes) {
    if (node.kind === 'message' && node.messageSchema?.typeName === typeName) {
      return node;
    }
    if (node.kind === 'enum' && node.enumSchema?.typeName === typeName) {
      return node;
    }
    if (node.children?.length) {
      const found = findSchemaNodeByTypeName(node.children, typeName);
      if (found) {
        return found;
      }
    }
  }
  return undefined;
}
