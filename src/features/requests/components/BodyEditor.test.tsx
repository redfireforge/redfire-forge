/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BodyEditor } from './BodyEditor';
import type { Scenario } from '../../../shared/types';

vi.mock('./CodeTextarea', () => ({
  CodeTextarea: ({
    value,
    onChange,
    placeholder,
  }: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
  }) => (
    <textarea
      data-testid="code-ta"
      aria-label="body"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

function scenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    id: 's1',
    name: 'S',
    url: '/u',
    method: 'GET',
    headers: [],
    body: '',
    auth: { type: 'none' },
    validation: { mode: 'none' },
    ...overrides,
  };
}

describe('BodyEditor', () => {
  it('defaults body type to json when body present but bodyType unset', () => {
    const draft = scenario({ body: '{"a":1}', bodyType: undefined });
    render(<BodyEditor draft={draft} onDraftChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /JSON.*▼|JSON.*▲/ })).toBeInTheDocument();
  });

  it('shows none message when type is none', () => {
    render(<BodyEditor draft={scenario({ bodyType: 'none', body: '' })} onDraftChange={vi.fn()} />);
    expect(screen.getByText(/does not have a body/)).toBeInTheDocument();
  });

  it('opening type dropdown picks form-urlencoded seeds one row', () => {
    const onDraftChange = vi.fn();
    render(<BodyEditor draft={scenario({ bodyType: 'json', bodyForm: undefined })} onDraftChange={onDraftChange} />);
    fireEvent.click(screen.getByRole('button', { name: /JSON/ }));
    fireEvent.click(screen.getByRole('button', { name: /Form URL Encoded/ }));
    expect(onDraftChange).toHaveBeenCalledWith(
      expect.objectContaining({
        bodyType: 'form-urlencoded',
        bodyForm: [{ key: '', value: '' }],
      }),
    );
  });

  it('counts only non-empty form keys for badge', () => {
    const onDraftChange = vi.fn();
    render(
      <BodyEditor
        draft={scenario({
          bodyType: 'form-urlencoded',
          bodyForm: [
            { key: 'a', value: '1' },
            { key: '   ', value: 'x' },
          ],
        })}
        onDraftChange={onDraftChange}
      />,
    );
    expect(within(screen.getByRole('button', { name: /Form URL Encoded/i })).getByText('1')).toHaveClass('tab-badge');
    fireEvent.click(screen.getByText('Delete all'));
    expect(onDraftChange).toHaveBeenCalledWith(
      expect.objectContaining({ bodyForm: [{ key: '', value: '' }] }),
    );
  });

  it('closes dropdown on outside mousedown', () => {
    render(<BodyEditor draft={scenario({ bodyType: 'json' })} onDraftChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /JSON/ }));
    expect(screen.getByRole('button', { name: /Plain Text/ })).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('button', { name: /Plain Text/ })).toBeNull();
  });

  it('removing last form row leaves placeholder row', () => {
    const onDraftChange = vi.fn();
    render(
      <BodyEditor
        draft={scenario({ bodyType: 'form-data', bodyForm: [{ key: 'k', value: 'v' }] })}
        onDraftChange={onDraftChange}
      />,
    );
    fireEvent.click(screen.getByTitle('Delete'));
    expect(onDraftChange).toHaveBeenCalledWith(
      expect.objectContaining({ bodyForm: [{ key: '', value: '' }] }),
    );
  });

  it('propagates text body edits through CodeTextarea', () => {
    const onDraftChange = vi.fn();
    render(<BodyEditor draft={scenario({ bodyType: 'text', body: 'hi' })} onDraftChange={onDraftChange} />);
    fireEvent.change(screen.getByTestId('code-ta'), { target: { value: 'bye' } });
    expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({ body: 'bye' }));
  });

  it('defaults to no body layout when body payload and type are empty', () => {
    render(<BodyEditor draft={scenario({ bodyType: undefined, body: '' })} onDraftChange={vi.fn()} />);
    expect(screen.getByText(/does not have a body/)).toBeInTheDocument();
  });

  it('does not wipe existing form pairs when activating structured types', () => {
    const onDraftChange = vi.fn();
    render(
      <BodyEditor
        draft={scenario({
          bodyType: 'json',
          bodyForm: [{ key: 'x', value: 'y' }],
        })}
        onDraftChange={onDraftChange}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /JSON/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Form Data$/ }));
    expect(onDraftChange).toHaveBeenCalledWith(
      expect.objectContaining({
        bodyType: 'form-data',
        bodyForm: [{ key: 'x', value: 'y' }],
      }),
    );
  });

  it('shows xml placeholder cues for markup bodies', () => {
    render(<BodyEditor draft={scenario({ bodyType: 'xml', body: '' })} onDraftChange={vi.fn()} />);
    expect(screen.getByPlaceholderText(/<root>/)).toBeInTheDocument();
  });

  it('toggle description exposes extra column', () => {
    render(
      <BodyEditor
        draft={scenario({ bodyType: 'form-urlencoded', bodyForm: [{ key: 'x', value: 'y' }] })}
        onDraftChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('Description'));
    expect(screen.getByPlaceholderText('description')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Description/ })).toHaveClass('active');
  });

  it('edits keyed pairs and expands form rows inline', () => {
    const onDraftChange = vi.fn();
    const draft = scenario({ bodyType: 'form-urlencoded', bodyForm: [{ key: 'k1', value: 'v1' }] });
    const { rerender } = render(<BodyEditor draft={draft} onDraftChange={onDraftChange} />);

    fireEvent.change(screen.getByPlaceholderText('name'), { target: { value: 'zip' } });
    expect(onDraftChange).toHaveBeenCalledWith(
      expect.objectContaining({ bodyForm: [{ key: 'zip', value: 'v1' }] }),
    );

    rerender(<BodyEditor draft={{ ...draft, bodyForm: [{ key: 'zip', value: 'v1' }] }} onDraftChange={onDraftChange} />);

    fireEvent.change(screen.getByPlaceholderText('value'), { target: { value: 'code' } });
    expect(onDraftChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ bodyForm: [{ key: 'zip', value: 'code' }] }),
    );

    rerender(<BodyEditor draft={{ ...draft, bodyForm: [{ key: 'zip', value: 'code' }] }} onDraftChange={onDraftChange} />);

    fireEvent.click(screen.getByText('+ Add'));
    expect(onDraftChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ bodyForm: [{ key: 'zip', value: 'code' }, { key: '', value: '' }] }),
    );
  });

  it('surfaces multipart selection with seeded rows when migrating from structured types', () => {
    const onDraftChange = vi.fn();
    render(
      <BodyEditor draft={scenario({ bodyType: 'json', bodyForm: [{ key: 'f', value: '1' }] })} onDraftChange={onDraftChange} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /JSON/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Form Data$/ }));
    expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({ bodyType: 'form-data' }));
  });

  it('shows file placeholders for streaming payloads', () => {
    render(<BodyEditor draft={scenario({ bodyType: 'file', body: '' })} onDraftChange={vi.fn()} />);
    expect(screen.getByPlaceholderText(/base64/i)).toBeInTheDocument();
  });

  it('pins the active picker entry inside the mime menu', () => {
    render(<BodyEditor draft={scenario({ bodyType: 'text' })} onDraftChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Plain Text/i }));
    const active = document.querySelector('.body-type-dropdown-item.active');
    expect(active?.textContent).toMatch(/Plain Text/);
    expect(within(active as HTMLElement).getByText('✓')).toBeInTheDocument();
  });

  it('opens dropdown upward when the trigger sits near the viewport bottom', () => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 400 });
    const originalRect = HTMLButtonElement.prototype.getBoundingClientRect;
    HTMLButtonElement.prototype.getBoundingClientRect = function () {
      if (this.classList.contains('body-type-trigger')) {
        return { top: 360, bottom: 390, left: 20, right: 120, width: 100, height: 30, x: 20, y: 360, toJSON: () => ({}) } as DOMRect;
      }
      return originalRect.call(this);
    };
    try {
      render(<BodyEditor draft={scenario({ bodyType: 'json' })} onDraftChange={vi.fn()} />);
      fireEvent.click(screen.getByRole('button', { name: /JSON/ }));
      const dropdown = document.querySelector('.body-type-dropdown') as HTMLElement | null;
      expect(dropdown).not.toBeNull();
      expect(dropdown!.style.bottom).not.toBe('');
      expect(dropdown!.style.top === '' || dropdown!.style.top === undefined || dropdown!.style.top === 'auto').toBe(true);
    } finally {
      HTMLButtonElement.prototype.getBoundingClientRect = originalRect;
    }
  });

  it('keeps dropdown open when clicking inside the portal panel', () => {
    render(<BodyEditor draft={scenario({ bodyType: 'json' })} onDraftChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /JSON/ }));
    const dropdown = document.querySelector('.body-type-dropdown') as HTMLElement;
    expect(dropdown).not.toBeNull();
    fireEvent.mouseDown(dropdown);
    expect(document.querySelector('.body-type-dropdown')).not.toBeNull();
  });

  it('recomputes dropdown position on window scroll and resize', () => {
    render(<BodyEditor draft={scenario({ bodyType: 'json' })} onDraftChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /JSON/ }));
    expect(document.querySelector('.body-type-dropdown')).not.toBeNull();
    window.dispatchEvent(new Event('resize'));
    window.dispatchEvent(new Event('scroll'));
    expect(document.querySelector('.body-type-dropdown')).not.toBeNull();
  });
});
