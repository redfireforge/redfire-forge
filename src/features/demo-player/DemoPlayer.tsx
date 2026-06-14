/** Demo Player — main orchestrator component */
import { useState, useEffect, useCallback } from 'react';
import { useDemoPlayer } from './useDemoPlayer';
import DemoPlayerPanel from './DemoPlayerPanel';
import DemoSuitePicker from './DemoSuitePicker';
import { allDemoSuites } from './suites';

interface DemoPlayerProps {
  navigateToTab: (tab: string) => void;
}

export default function DemoPlayer({ navigateToTab }: DemoPlayerProps) {
  const [showPicker, setShowPicker] = useState(false);
  const player = useDemoPlayer(navigateToTab);

  // Open the suite picker (called from activity bar or header)
  const openPicker = useCallback(() => setShowPicker(true), []);
  const closePicker = useCallback(() => setShowPicker(false), []);

  // Handle suite selection
  const handleSelectSuite = useCallback((suite: typeof allDemoSuites[number]) => {
    setShowPicker(false);
    player.startSuite(suite);
  }, [player]);

  // Switch suite while player is open
  const handleChangeSuite = useCallback(() => {
    player.close();
    setShowPicker(true);
  }, [player]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!player.state.isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture when typing in inputs
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;
      if (target.isContentEditable) return;

      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          player.next();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          player.prev();
          break;
        case ' ':
          e.preventDefault();
          player.toggleAutoPlay();
          break;
        case 'Escape':
          e.preventDefault();
          player.close();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [player]);

  // Expose openPicker on window for the activity bar button
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__openDemoPlayer = openPicker;
    return () => { delete (window as unknown as Record<string, unknown>).__openDemoPlayer; };
  }, [openPicker]);

  return (
    <>
      {showPicker && (
        <DemoSuitePicker
          suites={allDemoSuites}
          onSelect={handleSelectSuite}
          onClose={closePicker}
        />
      )}

      <DemoPlayerPanel
        state={player.state}
        onNext={player.next}
        onPrev={player.prev}
        onGoToStep={player.goToStep}
        onToggleAutoPlay={player.toggleAutoPlay}
        onSetPlaySpeed={player.setPlaySpeed}
        onClose={player.close}
        onChangeSuite={handleChangeSuite}
      />
    </>
  );
}

export { DemoPlayer };
