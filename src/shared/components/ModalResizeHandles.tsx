import React from 'react';

interface Props {
  onRightEdge: (e: React.MouseEvent) => void;
  onCorner: (e: React.MouseEvent) => void;
}

/**
 * Invisible resize handles for modals.
 * - Right edge: vertical bar on the right side — drag to resize width.
 * - Corner grip: bottom-right corner — drag to resize width + height.
 *
 * Place inside the modal `<div>` (the one with role="dialog").
 */
export default function ModalResizeHandles({ onRightEdge, onCorner }: Props) {
  return (
    <>
      {/* Right edge handle */}
      <div
        className="modal-resize-edge-right"
        onMouseDown={onRightEdge}
        aria-hidden="true"
      />
      {/* Bottom-right corner grip */}
      <div
        className="modal-resize-corner"
        onMouseDown={onCorner}
        aria-hidden="true"
      />
    </>
  );
}
