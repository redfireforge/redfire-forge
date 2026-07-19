/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGrpcUploadedFiles } from './useGrpcUploadedFiles';

class MockFileReader {
  onload: ((event: { target: { result: string } }) => void) | null = null;

  readAsDataURL(file: File) {
    const payload = `data:${file.type};base64,QUJD`;
    this.onload?.({ target: { result: payload } });
  }
}

class MockFileReaderNoComma {
  onload: ((event: { target: { result: string } }) => void) | null = null;

  readAsDataURL() {
    this.onload?.({ target: { result: 'NO_COMMA_PAYLOAD' } });
  }
}

describe('useGrpcUploadedFiles', () => {
  it('adds, removes, and clears uploaded files', () => {
    const { result } = renderHook(() => useGrpcUploadedFiles({ bytesPayload: '' }));

    const file = new File(['abc'], 'payload.bin', { type: 'application/octet-stream' });
    act(() => {
      result.current.handleFilesPicked({ target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>);
    });

    expect(result.current.uploadedFiles).toHaveLength(1);
    const id = result.current.uploadedFiles[0]!.id;

    act(() => {
      result.current.handleRemoveUploadedFile(id);
    });
    expect(result.current.uploadedFiles).toHaveLength(0);

    act(() => {
      result.current.handleFilesPicked({ target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>);
      result.current.handleClearUploadedFiles();
    });

    expect(result.current.uploadedFiles).toHaveLength(0);
  });

  it('returns null when no uploaded files or no bytes candidates', async () => {
    const noFiles = renderHook(() => useGrpcUploadedFiles({ bytesPayload: '' }));
    await expect(noFiles.result.current.applyFileDataToBody()).resolves.toBeNull();

    const textFile = new File(['x'], 'readme.txt', { type: 'text/plain' });
    const withText = renderHook(() => useGrpcUploadedFiles({ bytesPayload: '' }));
    act(() => {
      withText.result.current.handleFilesPicked({ target: { files: [textFile] } } as unknown as React.ChangeEvent<HTMLInputElement>);
    });
    await expect(withText.result.current.applyFileDataToBody()).resolves.toBeNull();
  });

  it('handles file-pick events with no files safely', () => {
    const { result } = renderHook(() => useGrpcUploadedFiles({ bytesPayload: '' }));

    act(() => {
      result.current.handleFilesPicked({ target: {} } as unknown as React.ChangeEvent<HTMLInputElement>);
    });

    expect(result.current.uploadedFiles).toHaveLength(0);
  });

  it('maps first bytes-like file into first empty string field', async () => {
    vi.stubGlobal('FileReader', MockFileReader as unknown as typeof FileReader);

    const { result } = renderHook(() => useGrpcUploadedFiles({ bytesPayload: '', untouched: 'value' }));

    const bytesFile = new File(['abc'], 'payload.proto', { type: 'application/octet-stream' });
    act(() => {
      result.current.handleFilesPicked({ target: { files: [bytesFile] } } as unknown as React.ChangeEvent<HTMLInputElement>);
    });

    const body = await result.current.applyFileDataToBody();
    expect(body).toMatchObject({ bytesPayload: 'QUJD', untouched: 'value' });

    vi.unstubAllGlobals();
  });

  it('keeps body unchanged when no empty string field is available', async () => {
    vi.stubGlobal('FileReader', MockFileReaderNoComma as unknown as typeof FileReader);

    const { result } = renderHook(() => useGrpcUploadedFiles({ untouched: 'value' }));
    const bytesFile = new File(['abc'], 'payload.bin', { type: 'application/octet-stream' });

    act(() => {
      result.current.handleFilesPicked({ target: { files: [bytesFile] } } as unknown as React.ChangeEvent<HTMLInputElement>);
    });

    const body = await result.current.applyFileDataToBody();
    expect(body).toEqual({ untouched: 'value' });

    vi.unstubAllGlobals();
  });
});
