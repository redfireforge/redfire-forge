/**
 * @vitest-environment jsdom
 */
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ApiMockImportDestinationFields } from './ApiMockImportDestinationFields';

describe('ApiMockImportDestinationFields', () => {
  it('opens folder menu, selects existing folder, and updates priority', () => {
    const setFolderDropdownOpen = vi.fn();
    const setFolderSelection = vi.fn();
    const setPriority = vi.fn();
    render(
      <ApiMockImportDestinationFields
        folders={[
          { id: 'f1', name: 'Orders', createdAt: '2026-08-12T00:00:00.000Z', updatedAt: '2026-08-12T00:00:00.000Z' } as never,
          { id: 'f2', name: 'Users', createdAt: '2026-08-12T00:00:00.000Z', updatedAt: '2026-08-12T00:00:00.000Z' } as never,
        ]}
        folderRef={createRef<HTMLDivElement>()}
        folderDisplayLabel="Orders"
        folderSelection="f1"
        folderDropdownOpen
        setFolderDropdownOpen={setFolderDropdownOpen}
        setFolderSelection={setFolderSelection}
        isCreatingFolder={false}
        newFolderName=""
        setNewFolderName={vi.fn()}
        priority="10"
        setPriority={setPriority}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Users' }));
    expect(setFolderSelection).toHaveBeenCalledWith('f2');
    expect(setFolderDropdownOpen).toHaveBeenCalledWith(false);
    fireEvent.change(screen.getByTestId('api-mock-import-priority'), { target: { value: '20' } });
    expect(setPriority).toHaveBeenCalledWith('20');
  });

  it('supports create-new-folder mode and name input', () => {
    const setFolderSelection = vi.fn();
    const setNewFolderName = vi.fn();
    const setFolderDropdownOpen = vi.fn((fn) => {
      if (typeof fn === 'function') fn(false);
    });
    render(
      <ApiMockImportDestinationFields
        folders={[]}
        folderRef={createRef<HTMLDivElement>()}
        folderDisplayLabel="+ Create new folder"
        folderSelection="__new__"
        folderDropdownOpen
        setFolderDropdownOpen={setFolderDropdownOpen}
        setFolderSelection={setFolderSelection}
        isCreatingFolder
        newFolderName="Imported"
        setNewFolderName={setNewFolderName}
        priority="5"
        setPriority={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('api-mock-import-folder'));
    expect(setFolderDropdownOpen).toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('api-mock-import-folder-new'));
    expect(setFolderSelection).toHaveBeenCalledWith('__new__');
    fireEvent.change(screen.getByTestId('api-mock-import-new-folder-name'), { target: { value: 'HAR' } });
    expect(setNewFolderName).toHaveBeenCalledWith('HAR');
  });
});
