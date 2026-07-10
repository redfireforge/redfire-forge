/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import StandardProfessionalModal from './StandardProfessionalModal';

vi.mock('../hooks/useModalFrame', () => ({
  useModalFrame: () => ({
    expanded: false,
    toggleExpand: vi.fn(),
    expandClass: '',
    overlayStyle: undefined,
    dialogStyle: {},
    headerDragStyle: { cursor: 'move' },
    onHeaderMouseDown: vi.fn(),
    onRightEdge: vi.fn(),
    onCorner: vi.fn(),
  }),
}));

describe('StandardProfessionalModal coverage gaps', () => {
  it('renders through AppModalFrame with professional modal classes', () => {
    render(
      <StandardProfessionalModal open title="Professional" onClose={vi.fn()}>
        <p>Body</p>
      </StandardProfessionalModal>,
    );
    expect(screen.getByText('Professional')).toBeTruthy();
    expect(screen.getByText('Body')).toBeTruthy();
    expect(document.querySelector('.professional-modal-overlay')).toBeTruthy();
    expect(document.querySelector('.professional-modal')).toBeTruthy();
  });

  it('supports text close button kind', () => {
    render(
      <StandardProfessionalModal
        open
        title="Close text"
        onClose={vi.fn()}
        closeButtonKind="text"
      >
        X
      </StandardProfessionalModal>,
    );
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
  });
});
