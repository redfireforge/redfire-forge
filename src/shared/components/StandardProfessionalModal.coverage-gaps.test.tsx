/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import StandardProfessionalModal from './StandardProfessionalModal';

vi.mock('./AppModalFrame', () => ({
  default: (props: Record<string, unknown>) => (
    <div
      data-testid="app-modal-frame"
      data-overlay={String(props.overlayClassName)}
      data-dialog={String(props.dialogClassName)}
      data-close-kind={String(props.closeButtonKind)}
      data-overlay-close={String(props.closeOnOverlayClick)}
      data-resize={String(props.showResizeHandles)}
      data-constrain={String(props.constrainDragToViewport)}
      data-padding={String(props.dragViewportPadding)}
      data-expand={String(props.showExpandButton)}
    >
      {props.children as React.ReactNode}
      <span>{String(props.title)}</span>
    </div>
  ),
}));

describe('StandardProfessionalModal coverage gaps', () => {
  it('applies professional defaults and forwards children', () => {
    render(
      <StandardProfessionalModal open title="Coverage Modal" onClose={() => undefined}>
        <p>body</p>
      </StandardProfessionalModal>,
    );

    const frame = screen.getByTestId('app-modal-frame');
    expect(frame).toHaveAttribute('data-overlay', 'professional-modal-overlay');
    expect(frame).toHaveAttribute('data-dialog', 'professional-modal');
    expect(frame).toHaveAttribute('data-close-kind', 'icon');
    expect(frame).toHaveAttribute('data-overlay-close', 'true');
    expect(frame).toHaveAttribute('data-resize', 'true');
    expect(frame).toHaveAttribute('data-constrain', 'true');
    expect(frame).toHaveAttribute('data-padding', '8');
    expect(frame).toHaveAttribute('data-expand', 'false');
    expect(screen.getByText('Coverage Modal')).toBeTruthy();
    expect(screen.getByText('body')).toBeTruthy();
  });

  it('honors explicit prop overrides', () => {
    render(
      <StandardProfessionalModal
        open
        title="Overrides"
        onClose={() => undefined}
        closeButtonKind="text"
        closeOnOverlayClick={false}
        showResizeHandles={false}
        constrainDragToViewport={false}
        dragViewportPadding={16}
        showExpandButton
      >
        null
      </StandardProfessionalModal>,
    );

    const frame = screen.getByTestId('app-modal-frame');
    expect(frame).toHaveAttribute('data-close-kind', 'text');
    expect(frame).toHaveAttribute('data-overlay-close', 'false');
    expect(frame).toHaveAttribute('data-resize', 'false');
    expect(frame).toHaveAttribute('data-constrain', 'false');
    expect(frame).toHaveAttribute('data-padding', '16');
    expect(frame).toHaveAttribute('data-expand', 'true');
  });
});
