import { useState, useCallback, useMemo } from 'react';
import type { RequestCollection } from '@shared/types';
import { findFolderDeep } from '../../features/requests/utils/requestTree';
import type { useRequests } from '../../features/requests/hooks/useRequests';
import type { Tab } from '../utils/appTabUtils';

interface UseWorkbenchActionsOptions {
  wb: ReturnType<typeof useRequests>;
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
}

export function useWorkbenchActions({ wb, activeTab, setActiveTab }: UseWorkbenchActionsOptions) {
  const [showWbCollectionModal, setShowWbCollectionModal] = useState(false);
  const [editingWbCollection, setEditingWbCollection] = useState<RequestCollection | null>(null);
  const [editingSubCol, setEditingSubCol] = useState<{ colId: string; folderId: string } | null>(null);
  const [newColGroupId, setNewColGroupId] = useState<string | undefined>();
  const [newColMode, setNewColMode] = useState<'direct' | 'multi-env' | undefined>();

  const subColForEdit = useMemo(() => {
    if (!editingSubCol) return null;
    const col = wb.collections.find(c => c.id === editingSubCol.colId);
    const folder = col ? findFolderDeep(col.folders ?? [], editingSubCol.folderId) : null;
    return col && folder ? { col, folder } : null;
  }, [editingSubCol, wb.collections]);

  const handleWbNewCollection = useCallback((mode?: 'direct' | 'multi-env', groupId?: string) => {
    setNewColMode(mode); setNewColGroupId(groupId);
    setEditingWbCollection(null); setShowWbCollectionModal(true);
  }, []);

  const handleWbEditCollection = useCallback((col: RequestCollection) => {
    setEditingWbCollection(col); setShowWbCollectionModal(true);
  }, []);

  const handleWbSaveCollection = useCallback((col: Omit<RequestCollection, 'id' | 'requests'> & { id?: string }) => {
    if (col.id) {
      wb.updateCollection(col.id, { name: col.name, mode: col.mode, microserviceId: col.microserviceId, baseUrls: col.baseUrls, auth: col.auth, authPerEnv: col.authPerEnv });
    } else {
      wb.addCollection({ name: col.name, mode: col.mode, groupId: newColGroupId, microserviceId: col.microserviceId, baseUrls: col.baseUrls, auth: col.auth, authPerEnv: col.authPerEnv });
    }
    setShowWbCollectionModal(false); setEditingWbCollection(null); setNewColGroupId(undefined); setNewColMode(undefined);
  }, [wb, newColGroupId]);

  const handleWbNewRequest = useCallback((colId: string, folderId?: string, name?: string) => {
    wb.addRequest(colId, folderId, name);
    if (activeTab !== 'requests') setActiveTab('requests');
  }, [wb, activeTab, setActiveTab]);

  const handleEditSubCollection = useCallback((colId: string, folderId: string) => {
    setEditingSubCol({ colId, folderId });
  }, []);

  return {
    showWbCollectionModal, setShowWbCollectionModal,
    editingWbCollection, setEditingWbCollection,
    editingSubCol, setEditingSubCol,
    newColGroupId, newColMode, setNewColGroupId, setNewColMode,
    subColForEdit,
    handleWbNewCollection, handleWbEditCollection, handleWbSaveCollection,
    handleWbNewRequest, handleEditSubCollection,
  };
}
