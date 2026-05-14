import { useCallback, useState } from 'react';
import type { BottomUtilityMode } from '../utils/bottomUtilityHelpers';
import { toggleUtilityMode } from '../utils/bottomUtilityHelpers';

export function useBottomUtilityDock() {
  const [bottomUtilityMode, setBottomUtilityMode] = useState<BottomUtilityMode>('none');
  const [rulesFloating, setRulesFloating] = useState(false);

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
    setBottomUtilityMode((mode) => toggleUtilityMode(mode, 'rules'));
  }, []);

  const handleRulesPopOut = useCallback(() => {
    setBottomUtilityMode((mode) => (mode === 'rules' ? 'none' : mode));
    setRulesFloating(true);
  }, []);

  const handleRulesPopIn = useCallback(() => {
    setRulesFloating(false);
    setBottomUtilityMode('rules');
  }, []);

  return {
    bottomUtilityMode,
    rulesFloating,
    handleTogglePreview,
    handleToggleCodeView,
    handleToggleTableView,
    handleToggleRulesView,
    handleRulesPopOut,
    handleRulesPopIn,
  };
}
