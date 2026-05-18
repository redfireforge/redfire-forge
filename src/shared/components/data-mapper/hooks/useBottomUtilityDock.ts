import { useCallback, useState } from 'react';
import type { BottomUtilityMode } from '../utils/bottomUtilityHelpers';
import { toggleUtilityMode } from '../utils/bottomUtilityHelpers';

export function useBottomUtilityDock() {
  const [bottomUtilityMode, setBottomUtilityMode] = useState<BottomUtilityMode>('none');
  const [rulesModalOpen, setRulesModalOpen] = useState(false);

  const handleTogglePreview = useCallback(() => {
    setBottomUtilityMode((mode) => toggleUtilityMode(mode, 'preview'));
  }, []);

  const handleToggleCodeView = useCallback(() => {
    setBottomUtilityMode((mode) => toggleUtilityMode(mode, 'code'));
  }, []);

  const handleToggleTableView = useCallback(() => {
    setBottomUtilityMode((mode) => toggleUtilityMode(mode, 'table'));
  }, []);

  const handleToggleRulesView = useCallback(() => {
    setRulesModalOpen(prev => !prev);
  }, []);

  const handleCloseRulesModal = useCallback(() => {
    setRulesModalOpen(false);
  }, []);

  return {
    bottomUtilityMode,
    rulesModalOpen,
    handleTogglePreview,
    handleToggleCodeView,
    handleToggleTableView,
    handleToggleRulesView,
    handleCloseRulesModal,
  };
}
