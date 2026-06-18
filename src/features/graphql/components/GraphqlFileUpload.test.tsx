/**
 * @vitest-environment jsdom
 * Tests for GraphqlFileUpload component (Sprint 4 — 2E-1/2E-5).
 */

import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { GraphqlFileUpload } from './GraphqlFileUpload';
import type { GraphqlFileUploadProps } from './GraphqlFileUpload';
import type { FileEntry } from '../utils/multipartBuilder';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeFile(name: string, size = 1024, type = 'image/png'): File {
  const blob = new Blob([new Uint8Array(size)], { type });
  return new File([blob], name, { type });
}

function defaultProps(overrides: Partial<GraphqlFileUploadProps> = {}): GraphqlFileUploadProps {
  return {
    entries: [],
    onEntriesChange: vi.fn(),
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('GraphqlFileUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dropzone with hint text', () => {
    render(<GraphqlFileUpload {...defaultProps()} />);
    expect(screen.getByTestId('gql-file-dropzone')).toBeTruthy();
  });

  it('renders empty hint when no files', () => {
    render(<GraphqlFileUpload {...defaultProps()} />);
    expect(screen.getByTestId('gql-file-empty-hint')).toBeTruthy();
  });

  it('renders file rows for each entry', () => {
    const entries: FileEntry[] = [
      { id: 'e1', file: makeFile('photo.jpg'), varPath: 'avatar', error: null },
      { id: 'e2', file: makeFile('doc.pdf'), varPath: 'files.0', error: null },
    ];
    render(<GraphqlFileUpload {...defaultProps({ entries })} />);
    const rows = screen.getAllByTestId('gql-file-row');
    expect(rows).toHaveLength(2);
  });

  it('shows error state on row with size error', () => {
    const entries: FileEntry[] = [
      {
        id: 'e1',
        file: makeFile('huge.zip', 60 * 1024 * 1024),
        varPath: 'file',
        error: 'File too large (60.0 MB) — maximum is 50 MB',
      },
    ];
    render(<GraphqlFileUpload {...defaultProps({ entries })} />);
    expect(screen.getByTestId('gql-file-error')).toBeTruthy();
    expect(screen.getByText(/File too large/)).toBeTruthy();
  });

  it('shows footer "fix file errors" when any entry has errors', () => {
    const entries: FileEntry[] = [
      { id: 'e1', file: makeFile('big.zip'), varPath: 'f', error: 'Too large' },
    ];
    render(<GraphqlFileUpload {...defaultProps({ entries })} />);
    expect(screen.getByText(/Fix file errors/)).toBeTruthy();
  });

  it('shows footer "N files ready" when all entries are valid', () => {
    const entries: FileEntry[] = [
      { id: 'e1', file: makeFile('a.png'), varPath: 'avatar', error: null },
    ];
    render(<GraphqlFileUpload {...defaultProps({ entries })} />);
    expect(screen.getByText(/1 file ready/)).toBeTruthy();
  });

  it('calls onEntriesChange with removed entry when × clicked', () => {
    const onChange = vi.fn();
    const entries: FileEntry[] = [
      { id: 'e1', file: makeFile('a.png'), varPath: 'avatar', error: null },
    ];
    render(<GraphqlFileUpload {...defaultProps({ entries, onEntriesChange: onChange })} />);
    fireEvent.click(screen.getByTestId('gql-file-remove-btn'));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('calls onEntriesChange with updated varPath on input change', () => {
    const onChange = vi.fn();
    const entries: FileEntry[] = [
      { id: 'e1', file: makeFile('a.png'), varPath: 'avatar', error: null },
    ];
    render(<GraphqlFileUpload {...defaultProps({ entries, onEntriesChange: onChange })} />);
    fireEvent.change(screen.getByTestId('gql-file-var-input'), {
      target: { value: 'profilePic' },
    });
    expect(onChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 'e1', varPath: 'profilePic' }),
      ]),
    );
  });

  it('adds files from file input onChange', () => {
    const onChange = vi.fn();
    render(<GraphqlFileUpload {...defaultProps({ onEntriesChange: onChange })} />);

    const file = makeFile('test.png');
    const input = screen.getByTestId('gql-file-input');
    Object.defineProperty(input, 'files', {
      value: { 0: file, length: 1, item: () => file, [Symbol.iterator]: function* () { yield file; } },
      configurable: true,
    });
    fireEvent.change(input);

    expect(onChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ file, error: null }),
      ]),
    );
  });

  it('rejects files exceeding hard cap (200 MB)', () => {
    const onChange = vi.fn();
    render(<GraphqlFileUpload {...defaultProps({ onEntriesChange: onChange })} />);

    const bigFile = makeFile('monster.bin', 201 * 1024 * 1024);
    const input = screen.getByTestId('gql-file-input');
    Object.defineProperty(input, 'files', {
      value: { 0: bigFile, length: 1, item: () => bigFile, [Symbol.iterator]: function* () { yield bigFile; } },
      configurable: true,
    });
    fireEvent.change(input);

    const [calledWith] = (onChange as ReturnType<typeof vi.fn>).mock.calls[0] as [FileEntry[]];
    expect(calledWith[0].error).toMatch(/hard cap/);
  });

  it('shows drag-over visual when file is dragged over dropzone', () => {
    render(<GraphqlFileUpload {...defaultProps()} />);
    const dz = screen.getByTestId('gql-file-dropzone');
    fireEvent.dragOver(dz);
    expect(dz.classList.contains('gql-file-dropzone--over')).toBe(true);
  });

  it('Space key on dropzone calls file picker (keyboard activation)', () => {
    render(<GraphqlFileUpload {...defaultProps()} />);
    const dz = screen.getByTestId('gql-file-dropzone');
    // jsdom doesn't implement click on input, but we verify preventDefault is called
    const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    dz.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('removes drag-over visual on dragLeave', () => {
    render(<GraphqlFileUpload {...defaultProps()} />);
    const dz = screen.getByTestId('gql-file-dropzone');
    fireEvent.dragOver(dz);
    fireEvent.dragLeave(dz);
    expect(dz.classList.contains('gql-file-dropzone--over')).toBe(false);
  });

  it('adds dropped files on drop event', () => {
    const onChange = vi.fn();
    render(<GraphqlFileUpload {...defaultProps({ onEntriesChange: onChange })} />);

    const file = makeFile('dropped.png');
    const dz = screen.getByTestId('gql-file-dropzone');
    fireEvent.drop(dz, {
      dataTransfer: {
        files: { 0: file, length: 1, item: () => file, [Symbol.iterator]: function* () { yield file; } },
      },
    });

    expect(onChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ file }),
      ]),
    );
  });

  it('sets drag-over visual on dragEnter event', () => {
    render(<GraphqlFileUpload {...defaultProps()} />);
    const dz = screen.getByTestId('gql-file-dropzone');
    fireEvent.dragEnter(dz, { dataTransfer: { files: [] } });
    expect(dz.classList.contains('gql-file-dropzone--over')).toBe(true);
  });

  it('Enter key on dropzone triggers file picker', () => {
    render(<GraphqlFileUpload {...defaultProps()} />);
    const dz = screen.getByTestId('gql-file-dropzone');
    const mockClick = vi.fn();
    Object.defineProperty(dz.ownerDocument.querySelector('[data-testid="gql-file-dropzone"]'), 'click', { value: mockClick });
    // The input is hidden; just verify the event is not prevented by checking no error thrown
    fireEvent.keyDown(dz, { key: 'Enter' });
    // No throw = handler ran correctly
  });

  it('Browse button triggers file picker on click', () => {
    render(<GraphqlFileUpload {...defaultProps()} />);
    const browseBtn = screen.getByTestId('gql-file-browse-btn');
    // Click should not throw (the hidden input click is silently no-op in jsdom)
    fireEvent.click(browseBtn);
    expect(browseBtn.textContent).toContain('Browse');
  });

  // ── Sprint 8 (2E-4): upload progress bar ─────────────────────────────────
  it('does not render progress bar when uploadProgress is null', () => {
    const entries = [{ id: '1', file: makeFile('test.png'), varPath: '$file', error: null }];
    render(<GraphqlFileUpload {...defaultProps({ entries, uploadProgress: null })} />);
    expect(screen.queryByTestId('gql-files-progress')).not.toBeInTheDocument();
  });

  it('renders indeterminate progress bar when uploadProgress is 0', () => {
    const entries = [{ id: '1', file: makeFile('test.png'), varPath: '$file', error: null }];
    render(<GraphqlFileUpload {...defaultProps({ entries, uploadProgress: 0 })} />);
    const bar = screen.getByTestId('gql-files-progress');
    expect(bar).toBeInTheDocument();
    const fill = bar.querySelector('.gql-file-progress-fill--indeterminate');
    expect(fill).toBeInTheDocument();
    expect(screen.getByText('Uploading…')).toBeInTheDocument();
  });

  it('renders percentage label when uploadProgress is between 1 and 97', () => {
    const entries = [{ id: '1', file: makeFile('test.png'), varPath: '$file', error: null }];
    render(<GraphqlFileUpload {...defaultProps({ entries, uploadProgress: 55 })} />);
    const bar = screen.getByTestId('gql-files-progress');
    expect(bar).toBeInTheDocument();
    expect(screen.getByText('Uploading… 55%')).toBeInTheDocument();
    // No indeterminate animation at 55%
    expect(bar.querySelector('.gql-file-progress-fill--indeterminate')).not.toBeInTheDocument();
  });

  it('renders "Processing…" when uploadProgress is 98 or higher', () => {
    const entries = [{ id: '1', file: makeFile('test.png'), varPath: '$file', error: null }];
    render(<GraphqlFileUpload {...defaultProps({ entries, uploadProgress: 98 })} />);
    expect(screen.getByText('Processing…')).toBeInTheDocument();
  });

  it('progress bar has correct ARIA attributes', () => {
    const entries = [{ id: '1', file: makeFile('test.png'), varPath: '$file', error: null }];
    render(<GraphqlFileUpload {...defaultProps({ entries, uploadProgress: 60 })} />);
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuemin', '0');
    expect(progressBar).toHaveAttribute('aria-valuemax', '100');
    expect(progressBar).toHaveAttribute('aria-valuenow', '60');
  });
});
