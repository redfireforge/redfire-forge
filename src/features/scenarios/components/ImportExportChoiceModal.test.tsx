/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ImportExportChoiceModal from './ImportExportChoiceModal';

describe('ImportExportChoiceModal', () => {
  describe('import mode', () => {
    it('renders import header and choices', () => {
      const onSelect = vi.fn();
      const onClose = vi.fn();
      render(
        <ImportExportChoiceModal mode="import" hasDataSource onSelect={onSelect} onClose={onClose} />,
      );
      expect(screen.getByText('Import')).toBeInTheDocument();
      expect(screen.getByText('Test Definition')).toBeInTheDocument();
      expect(screen.getByText('Data Rows')).toBeInTheDocument();
    });

    it('disables Data Rows when no data source', () => {
      render(
        <ImportExportChoiceModal mode="import" hasDataSource={false} onSelect={vi.fn()} onClose={vi.fn()} />,
      );
      const dataRowsBtn = screen.getByText('Data Rows').closest('button');
      expect(dataRowsBtn).toBeDisabled();
    });

    it('fires onSelect with import choice', () => {
      const onSelect = vi.fn();
      render(
        <ImportExportChoiceModal mode="import" hasDataSource onSelect={onSelect} onClose={vi.fn()} />,
      );
      fireEvent.click(screen.getByText('Test Definition'));
      expect(onSelect).toHaveBeenCalledWith('test-definition');
      fireEvent.click(screen.getByText('Data Rows'));
      expect(onSelect).toHaveBeenCalledWith('data-rows');
    });
  });

  describe('export mode', () => {
    it('renders export header and all choices', () => {
      render(
        <ImportExportChoiceModal mode="export" hasDataSource onSelect={vi.fn()} onClose={vi.fn()} />,
      );
      expect(screen.getByText('Export')).toBeInTheDocument();
      expect(screen.getByText('Excel Template')).toBeInTheDocument();
      expect(screen.getByText('Data as CSV')).toBeInTheDocument();
      expect(screen.getByText('Data as JSON')).toBeInTheDocument();
    });

    it('disables data exports when no data source', () => {
      render(
        <ImportExportChoiceModal mode="export" hasDataSource={false} onSelect={vi.fn()} onClose={vi.fn()} />,
      );
      expect(screen.getByText('Data as CSV').closest('button')).toBeDisabled();
      expect(screen.getByText('Data as JSON').closest('button')).toBeDisabled();
    });

    it('fires onSelect with export choice', () => {
      const onSelect = vi.fn();
      render(
        <ImportExportChoiceModal mode="export" hasDataSource onSelect={onSelect} onClose={vi.fn()} />,
      );
      fireEvent.click(screen.getByText('Excel Template'));
      expect(onSelect).toHaveBeenCalledWith('excel-template');
    });
  });

  describe('closing behaviour', () => {
    it('fires onClose on Cancel', () => {
      const onClose = vi.fn();
      render(
        <ImportExportChoiceModal mode="import" hasDataSource onSelect={vi.fn()} onClose={onClose} />,
      );
      fireEvent.click(screen.getByText('Cancel'));
      expect(onClose).toHaveBeenCalled();
    });

    it('fires onClose on Escape key', () => {
      const onClose = vi.fn();
      render(
        <ImportExportChoiceModal mode="import" hasDataSource onSelect={vi.fn()} onClose={onClose} />,
      );
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).toHaveBeenCalled();
    });

    it('ignores non-Escape keys', () => {
      const onClose = vi.fn();
      render(
        <ImportExportChoiceModal mode="import" hasDataSource onSelect={vi.fn()} onClose={onClose} />,
      );
      fireEvent.keyDown(document, { key: 'Enter' });
      expect(onClose).not.toHaveBeenCalled();
    });

    it('fires onClose on outside mousedown', () => {
      const onClose = vi.fn();
      render(
        <ImportExportChoiceModal mode="import" hasDataSource onSelect={vi.fn()} onClose={onClose} />,
      );
      fireEvent.mouseDown(document.body);
      expect(onClose).toHaveBeenCalled();
    });

    it('does not fire onClose on inside mousedown', () => {
      const onClose = vi.fn();
      render(
        <ImportExportChoiceModal mode="import" hasDataSource onSelect={vi.fn()} onClose={onClose} />,
      );
      fireEvent.mouseDown(screen.getByText('Test Definition'));
      expect(onClose).not.toHaveBeenCalled();
    });

    it('removes listeners on unmount', () => {
      const onClose = vi.fn();
      const { unmount } = render(
        <ImportExportChoiceModal mode="import" hasDataSource onSelect={vi.fn()} onClose={onClose} />,
      );
      unmount();
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).not.toHaveBeenCalled();
    });
  });
});
