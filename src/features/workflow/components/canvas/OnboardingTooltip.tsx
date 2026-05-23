/**
 * Contextual tooltip for onboarding hints.
 * Positioned relative to a target element with arrow indicator.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import type { OnboardingHint } from '../../data/onboardingHints';

interface Props {
  hint: OnboardingHint;
  onDismiss: () => void;
  onDismissAll: () => void;
  remainingCount: number;
}

interface Position {
  top: number;
  left: number;
  visible: boolean;
}

export default function OnboardingTooltip({ hint, onDismiss, onDismissAll, remainingCount }: Props) {
  const [position, setPosition] = useState<Position>({ top: 0, left: 0, visible: false });
  const tooltipRef = useRef<HTMLDivElement>(null);

  const calculatePosition = useCallback(() => {
    const target = document.querySelector(hint.target);
    if (!target || !tooltipRef.current) {
      setPosition(prev => ({ ...prev, visible: false }));
      return;
    }

    const targetRect = target.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const OFFSET = 12;
    const VIEWPORT_PADDING = 8;

    let top = 0;
    let left = 0;

    switch (hint.placement) {
      case 'top':
        top = targetRect.top - tooltipRect.height - OFFSET;
        left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
        break;
      case 'bottom':
        top = targetRect.bottom + OFFSET;
        left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
        break;
      case 'left':
        top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
        left = targetRect.left - tooltipRect.width - OFFSET;
        break;
      case 'right':
        top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
        left = targetRect.right + OFFSET;
        break;
    }

    top = Math.max(VIEWPORT_PADDING, Math.min(top, window.innerHeight - tooltipRect.height - VIEWPORT_PADDING));
    left = Math.max(VIEWPORT_PADDING, Math.min(left, window.innerWidth - tooltipRect.width - VIEWPORT_PADDING));

    setPosition({ top, left, visible: true });
  }, [hint.target, hint.placement]);

  useEffect(() => {
    calculatePosition();
    const handleResize = () => calculatePosition();
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
    };
  }, [calculatePosition]);

  useEffect(() => {
    const timer = setTimeout(calculatePosition, 100);
    return () => clearTimeout(timer);
  }, [hint.id, calculatePosition]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onDismiss();
    }
  }, [onDismiss]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div
      ref={tooltipRef}
      className={`onboarding-tooltip onboarding-tooltip-${hint.placement}`}
      style={{
        top: position.top,
        left: position.left,
        opacity: position.visible ? 1 : 0,
        pointerEvents: position.visible ? 'auto' : 'none',
      }}
      role="tooltip"
      aria-live="polite"
    >
      <div className="onboarding-tooltip-header">
        <span className="onboarding-tooltip-title">{hint.title}</span>
        <button
          className="onboarding-tooltip-close"
          onClick={onDismiss}
          aria-label="Dismiss hint"
        >
          ×
        </button>
      </div>
      <p className="onboarding-tooltip-message">{hint.message}</p>
      <div className="onboarding-tooltip-footer">
        <button className="onboarding-tooltip-skip" onClick={onDismissAll}>
          Skip all tips
        </button>
        <div className="onboarding-tooltip-actions">
          {remainingCount > 1 && (
            <span className="onboarding-tooltip-counter">
              {remainingCount} tips left
            </span>
          )}
          <button className="onboarding-tooltip-got-it" onClick={onDismiss}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
