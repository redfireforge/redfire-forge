import { useEffect } from 'react';

export function useModalEscapeClose(
  onClose: () => void,
  options: { capture?: boolean } = {},
): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (options.capture) e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', handler, { capture: options.capture });
    return () => document.removeEventListener('keydown', handler, { capture: options.capture });
  }, [onClose, options.capture]);
}
