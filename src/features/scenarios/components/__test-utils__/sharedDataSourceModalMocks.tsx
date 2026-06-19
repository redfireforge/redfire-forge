import type { ReactNode } from 'react';

/** Minimal frame so `onClose` (dirty gate) can be exercised — production uses closeButtonKind none + closeOnOverlayClick false */
export function MockAppModalFrame({
  title,
  children,
  onClose,
  footerContent,
  footer,
}: {
  title: ReactNode;
  children: ReactNode;
  onClose: () => void;
  footerContent?: (state: unknown) => ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div data-testid="app-modal-frame">
      <div>{title}</div>
      <button type="button" data-testid="app-modal-frame-onclose" onClick={onClose}>
        Outer
      </button>
      {footerContent?.({})}
      {children}
      {footer ? <div data-testid="app-modal-footer-slot">{footer}</div> : null}
    </div>
  );
}
