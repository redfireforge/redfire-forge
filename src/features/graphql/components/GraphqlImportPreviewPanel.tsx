import type { CSSProperties } from 'react';
import type {
  CollectionImportPreview,
  ImportPreviewCollectionNode,
  ImportPreviewFolderNode,
  ImportPreviewOperation,
} from '../utils/collectionImportPreview';

export interface GraphqlImportPreviewPanelProps {
  preview: CollectionImportPreview;
}

const OP_LABEL: Record<ImportPreviewOperation['operationType'], string> = {
  query: 'Query',
  mutation: 'Mutation',
  subscription: 'Subscription',
};

function formatExportedAt(iso?: string): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}

function PreviewOperationRow({ item }: { item: ImportPreviewOperation }) {
  return (
    <li className="gql-import-preview-item" data-testid="gql-import-preview-item">
      <span className={`gql-import-preview-op-type gql-import-preview-op-type--${item.operationType}`}>
        {OP_LABEL[item.operationType]}
      </span>
      <span className="gql-import-preview-item-name">{item.name}</span>
      <code className="gql-import-preview-query">{item.queryPreview}</code>
    </li>
  );
}

function PreviewFolderBlock({ folder, depth }: { folder: ImportPreviewFolderNode; depth: number }) {
  const hasContent = folder.items.length > 0 || folder.folders.length > 0;
  if (!hasContent) return null;

  return (
    <div
      className="gql-import-preview-folder"
      data-testid="gql-import-preview-folder"
      style={{ '--gql-import-preview-depth': depth } as CSSProperties}
    >
      <div className="gql-import-preview-folder-name">{folder.name}</div>
      {folder.items.length > 0 && (
        <ul className="gql-import-preview-items">
          {folder.items.map((item) => (
            <PreviewOperationRow key={`${folder.id}:${item.name}:${item.queryPreview}`} item={item} />
          ))}
        </ul>
      )}
      {folder.folders.map((child) => (
        <PreviewFolderBlock key={child.id} folder={child} depth={depth + 1} />
      ))}
    </div>
  );
}

function PreviewCollectionBlock({ collection }: { collection: ImportPreviewCollectionNode }) {
  return (
    <section className="gql-import-preview-collection" data-testid="gql-import-preview-collection">
      <header className="gql-import-preview-collection-header">
        <span className="gql-import-preview-collection-name">{collection.name}</span>
        <span className="gql-import-preview-collection-meta">
          {collection.itemCount} operation{collection.itemCount === 1 ? '' : 's'}
          {collection.folderCount > 0 ? ` · ${collection.folderCount} folder${collection.folderCount === 1 ? '' : 's'}` : ''}
          {collection.variableCount > 0 ? ` · ${collection.variableCount} variable${collection.variableCount === 1 ? '' : 's'}` : ''}
        </span>
      </header>
      {collection.rootItems.length > 0 && (
        <ul className="gql-import-preview-items">
          {collection.rootItems.map((item) => (
            <PreviewOperationRow key={`root:${item.name}:${item.queryPreview}`} item={item} />
          ))}
        </ul>
      )}
      {collection.folders.map((folder) => (
        <PreviewFolderBlock key={folder.id} folder={folder} depth={1} />
      ))}
    </section>
  );
}

export function GraphqlImportPreviewPanel({ preview }: GraphqlImportPreviewPanelProps) {
  const exportedLabel = formatExportedAt(preview.meta.exportedAt);

  return (
    <div className="gql-import-preview" data-testid="gql-import-mode-preview">
      {(preview.meta.version || exportedLabel || preview.meta.source) && (
        <div className="gql-import-preview-meta" data-testid="gql-import-preview-meta">
          {preview.meta.version && <span>Export v{preview.meta.version}</span>}
          {exportedLabel && <span>Exported {exportedLabel}</span>}
          {preview.meta.source && <span>{preview.meta.source}</span>}
        </div>
      )}
      {preview.collections.length === 0 ? (
        <p className="gql-import-preview-empty" data-testid="gql-import-preview-empty">
          No collections in this file.
        </p>
      ) : (
        preview.collections.map((collection) => (
          <PreviewCollectionBlock key={collection.id} collection={collection} />
        ))
      )}
    </div>
  );
}
