/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import FromSharedDsPickerModal from './FromSharedDsPickerModal';
import type { SharedDataSource } from '../../../shared/types';

vi.mock('../../../shared/components/PopupModal', () => ({
  __esModule: true,
  default: ({
    title,
    children,
    footer,
  }: {
    title: string;
    onClose: () => void;
    children: React.ReactNode;
    footer: React.ReactNode;
    dialogClassName?: string;
  }) => (
    <div data-testid="popup-modal">
      <div data-testid="popup-title">{title}</div>
      <div data-testid="popup-body">{children}</div>
      <div data-testid="popup-footer">{footer}</div>
    </div>
  ),
}));

function makeSharedDs(id: string, name: string, rows = 3, cols = 2): SharedDataSource {
  return {
    id,
    name,
    updatedAt: 0,
    dataSource: {
      columns: Array.from({ length: cols }, (_, i) => ({ id: `c${i}`, name: `col${i}`, type: 'path', mapping: `m${i}` })),
      rows: Array.from({ length: rows }, (_, i) => ({ id: `r${i}`, values: {}, enabled: true })),
      source: { type: 'inline' },
    },
  };
}

describe('FromSharedDsPickerModal', () => {
  const sharedDataSources = [makeSharedDs('ds1', 'Prod VINs', 5, 3), makeSharedDs('ds2', 'QA VINs', 2, 1)];

  beforeEach(() => resetAllMocks());

  it('renders the list of shared data sources', () => {
    render(<FromSharedDsPickerModal sharedDataSources={sharedDataSources} onConfirm={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText('Prod VINs')).toBeInTheDocument();
    expect(screen.getByText('QA VINs')).toBeInTheDocument();
    expect(screen.getByText('5 rows · 3 columns')).toBeInTheDocument();
  });

  it('disables Create Test initially', () => {
    render(<FromSharedDsPickerModal sharedDataSources={sharedDataSources} onConfirm={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText('Create Test')).toBeDisabled();
  });

  it('auto-fills test name when selecting a source with empty name', () => {
    render(<FromSharedDsPickerModal sharedDataSources={sharedDataSources} onConfirm={vi.fn()} onClose={vi.fn()} />);
    const radios = screen.getAllByRole('radio');
    fireEvent.click(radios[0]);
    expect((screen.getByPlaceholderText('Enter test name') as HTMLInputElement).value).toBe('Test from Prod VINs');
    expect(screen.getByText('Create Test')).toBeEnabled();
  });

  it('keeps user-entered name when selecting a source', () => {
    render(<FromSharedDsPickerModal sharedDataSources={sharedDataSources} onConfirm={vi.fn()} onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('Enter test name'), { target: { value: 'My Test' } });
    fireEvent.click(screen.getAllByRole('radio')[1]);
    expect((screen.getByPlaceholderText('Enter test name') as HTMLInputElement).value).toBe('My Test');
  });

  it('confirms with selected source and trimmed name, then closes', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(<FromSharedDsPickerModal sharedDataSources={sharedDataSources} onConfirm={onConfirm} onClose={onClose} />);
    fireEvent.change(screen.getByPlaceholderText('Enter test name'), { target: { value: '  Trimmed  ' } });
    fireEvent.click(screen.getAllByRole('radio')[0]);
    fireEvent.click(screen.getByText('Create Test'));
    expect(onConfirm).toHaveBeenCalledWith(sharedDataSources[0], 'Trimmed');
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on Cancel', () => {
    const onClose = vi.fn();
    render(<FromSharedDsPickerModal sharedDataSources={sharedDataSources} onConfirm={vi.fn()} onClose={onClose} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('does not confirm when selected data source disappears before create', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    const { rerender } = render(
      <FromSharedDsPickerModal sharedDataSources={sharedDataSources} onConfirm={onConfirm} onClose={onClose} />,
    );
    fireEvent.change(screen.getByPlaceholderText('Enter test name'), { target: { value: 'Ghost Test' } });
    fireEvent.click(screen.getAllByRole('radio')[0]);
    rerender(<FromSharedDsPickerModal sharedDataSources={[]} onConfirm={onConfirm} onClose={onClose} />);
    fireEvent.click(screen.getByText('Create Test'));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
