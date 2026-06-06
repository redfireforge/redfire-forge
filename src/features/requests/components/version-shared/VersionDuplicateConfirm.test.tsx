/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import VersionDuplicateConfirm from './VersionDuplicateConfirm';

describe('VersionDuplicateConfirm', () => {
  it('renders nothing when show is false', () => {
    const { container } = render(
      <VersionDuplicateConfirm
        show={false}
        duplicateOfLabel="v1.0"
        onSaveAnyway={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders the banner when show is true', () => {
    render(
      <VersionDuplicateConfirm
        show={true}
        duplicateOfLabel="v2.3"
        onSaveAnyway={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText('Save Anyway')).toBeTruthy();
    expect(screen.getByText('Cancel')).toBeTruthy();
  });

  it('displays the duplicateOfLabel in the message', () => {
    render(
      <VersionDuplicateConfirm
        show={true}
        duplicateOfLabel="Release 1.5"
        onSaveAnyway={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText('Release 1.5')).toBeTruthy();
  });

  it('calls onSaveAnyway when Save Anyway is clicked', async () => {
    const user = userEvent.setup();
    const onSaveAnyway = vi.fn();
    render(
      <VersionDuplicateConfirm
        show={true}
        duplicateOfLabel="v3"
        onSaveAnyway={onSaveAnyway}
        onCancel={vi.fn()}
      />,
    );
    await user.click(screen.getByText('Save Anyway'));
    expect(onSaveAnyway).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when Cancel is clicked', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <VersionDuplicateConfirm
        show={true}
        duplicateOfLabel="v3"
        onSaveAnyway={vi.fn()}
        onCancel={onCancel}
      />,
    );
    await user.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('applies the version-duplicate-confirm class', () => {
    const { container } = render(
      <VersionDuplicateConfirm
        show={true}
        duplicateOfLabel="v1"
        onSaveAnyway={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(container.querySelector('.version-duplicate-confirm')).toBeTruthy();
  });
});
