import type { ComponentProps } from 'react';
import AppModalFrame from './AppModalFrame';

type AppModalFrameProps = ComponentProps<typeof AppModalFrame>;

/**
 * StandardProfessionalModal
 *
 * A reusable professional modal component applying consistent global standards:
 * - 20px padding on all four sides (edges)
 * - White color edge: 1px border + subtle inset/outer shadows
 * - **Fully movable and resizable** (drag header to move, drag corner/edges to resize)
 * - Drag-constrained to viewport with 8px edge padding (prevents off-screen)
 * - Resizable corner handles visible by default
 * - Draggable header with anchoring support for consistent opening position
 * - Close button support (configurable: 'icon' | 'text' | 'none')
 *
 * **Global Standard Behavior:**
 * All StandardProfessionalModals are by default:
 * - ✅ **Movable** (drag header to reposition)
 * - ✅ **Resizable** (corner/edge handles visible)
 * - ✅ **Viewport-constrained** (stays within 8px of window edges)
 * - ✅ **Overlay-closeable** (click outside to close)
 *
 * Usage:
 * ```
 * <StandardProfessionalModal
 *   open={isOpen}
 *   title="My Modal"
 *   onClose={handleClose}
 *   closeButtonKind="icon"
 *   dragAnchor={{ selector: '#anchor', hAlign: 'center', vAlign: 'top' }}
 *   minWidth={540}
 *   minHeight={420}
 * >
 *   {content}
 * </StandardProfessionalModal>
 * ```
 *
 * **Disable features if needed:**
 * - Disable dragging: `disableDrag={true}`
 * - Disable resizing: `showResizeHandles={false}`
 * - Disable overlay close: `closeOnOverlayClick={false}`
 *
 * **Close button kinds (case-by-case):**
 * - 'icon': Small × button in top-right corner (default)
 * - 'text': "Close" text button in top-right corner
 * - 'none': No close button (use external close mechanism)
 */

interface StandardProfessionalModalProps extends Omit<AppModalFrameProps, 'overlayClassName' | 'dialogClassName'> {
  /**
   * Close button style
   * @default 'icon'
   */
  closeButtonKind?: 'icon' | 'text' | 'none';
  /**
   * Extra class name appended to the `professional-modal` dialog root.
   * Use for per-modal visual overrides (e.g. a stronger white edge).
   */
  dialogClassName?: string;
}

export default function StandardProfessionalModal({
  closeButtonKind = 'icon',
  closeOnOverlayClick = true,
  showResizeHandles = true,
  constrainDragToViewport = true,
  dragViewportPadding = 8,
  showExpandButton = false,
  dialogClassName,
  ...props
}: StandardProfessionalModalProps) {
  return (
    <AppModalFrame
      {...props}
      overlayClassName="professional-modal-overlay"
      dialogClassName={dialogClassName ? `professional-modal ${dialogClassName}` : 'professional-modal'}
      closeButtonKind={closeButtonKind}
      closeOnOverlayClick={closeOnOverlayClick}
      showResizeHandles={showResizeHandles}
      constrainDragToViewport={constrainDragToViewport}
      dragViewportPadding={dragViewportPadding}
      showExpandButton={showExpandButton}
    />
  );
}
