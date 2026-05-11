/**
 * Error detail popover shown on debug trace error click.
 * Extracted from DataMapper to reduce component size.
 */

import { forwardRef } from 'react';
import type { ErrorDetailData } from './MappingCanvas';

interface ErrorPopoverProps {
  data: ErrorDetailData;
  y: number;
  onClose: () => void;
}

const ErrorPopover = forwardRef<HTMLDivElement, ErrorPopoverProps>(
  function ErrorPopover({ data, y, onClose }, ref) {
    return (
      <div
        ref={ref}
        className="dm-error-popover"
        style={{ top: y }}
        role="dialog"
        aria-label="Error details"
      >
        <button
          className="dm-error-popover-close"
          onClick={onClose}
          aria-label="Close error details"
        >
          ×
        </button>
        <div className="dm-error-popover-title">Mapping Error</div>
        <div className="dm-error-popover-row">
          <span className="dm-error-popover-label">Source:</span>
          <code className="dm-error-popover-value">{data.sourcePath}</code>
        </div>
        <div className="dm-error-popover-row">
          <span className="dm-error-popover-label">Target:</span>
          <code className="dm-error-popover-value">{data.targetPath}</code>
        </div>
        {data.expression && (
          <div className="dm-error-popover-row">
            <span className="dm-error-popover-label">Expression:</span>
            <code className="dm-error-popover-value">{data.expression}</code>
          </div>
        )}
        <div className="dm-error-popover-row">
          <span className="dm-error-popover-label">Source value:</span>
          <code className="dm-error-popover-value">{data.sourceValue}</code>
        </div>
        <div className="dm-error-popover-row">
          <span className="dm-error-popover-label">Target value:</span>
          <code className={`dm-error-popover-value ${data.targetValue === 'undefined' ? 'dm-error-popover-value--error' : ''}`}>
            {data.targetValue}
          </code>
        </div>
        {data.error && (
          <div className="dm-error-popover-error">
            {data.error}
          </div>
        )}
      </div>
    );
  },
);

export default ErrorPopover;
