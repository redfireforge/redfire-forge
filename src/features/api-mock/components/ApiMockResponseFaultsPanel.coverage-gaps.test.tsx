/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ApiMockResponseFaultsPanel } from './ApiMockResponseFaultsPanel';
import { createDefaultResponse } from '../../../shared/api-mock/defaults';
import type { ApiMockResponseVariantV1 } from '../../../shared/api-mock/contracts';

function makeVariant(overrides: Partial<ApiMockResponseVariantV1> = {}): ApiMockResponseVariantV1 {
  return { ...createDefaultResponse('resp-1'), ...overrides };
}

describe('ApiMockResponseFaultsPanel coverage gaps', () => {
  it('seeds dribble schedule from body content when empty schedule', () => {
    const onUpdateVariant = vi.fn();
    render(
      <ApiMockResponseFaultsPanel
        variant={makeVariant({
          body: { kind: 'json', contentType: 'application/json', content: '1234567890-extra' },
          behavior: { delayMs: 0, jitterMs: 0, fault: undefined, chunkSchedule: undefined },
        })}
        onUpdateVariant={onUpdateVariant}
      />,
    );
    fireEvent.click(screen.getByTestId('api-mock-fault-dribble'));
    expect(onUpdateVariant).toHaveBeenCalledWith({
      behavior: expect.objectContaining({
        chunkSchedule: [{ afterMs: 50, body: '12345678' }, { afterMs: 100, body: '' }],
      }),
    });
  });

  it('keeps existing dribble schedule when re-selecting dribble', () => {
    const onUpdateVariant = vi.fn();
    render(
      <ApiMockResponseFaultsPanel
        variant={makeVariant({
          behavior: {
            delayMs: 0,
            jitterMs: 0,
            fault: 'dribble',
            chunkSchedule: [{ afterMs: 5, body: 'keep' }],
          },
        })}
        onUpdateVariant={onUpdateVariant}
      />,
    );
    fireEvent.click(screen.getByTestId('api-mock-fault-dribble'));
    expect(onUpdateVariant).toHaveBeenCalledWith({
      behavior: expect.objectContaining({
        fault: 'dribble',
        chunkSchedule: [{ afterMs: 5, body: 'keep' }],
      }),
    });
  });

  it('selects non-dribble faults and clears chunk schedule', () => {
    const onUpdateVariant = vi.fn();
    render(
      <ApiMockResponseFaultsPanel
        variant={makeVariant({
          behavior: { delayMs: 0, jitterMs: 0, fault: 'dribble', chunkSchedule: [{ afterMs: 1, body: 'x' }] },
        })}
        onUpdateVariant={onUpdateVariant}
      />,
    );
    for (const id of ['timeout', 'close', 'malformed'] as const) {
      fireEvent.click(screen.getByTestId(`api-mock-fault-${id}`));
      expect(onUpdateVariant).toHaveBeenLastCalledWith({
        behavior: expect.objectContaining({ fault: id, chunkSchedule: undefined }),
      });
    }
  });

  it('removes one chunk while keeping others', () => {
    const onUpdateVariant = vi.fn();
    render(
      <ApiMockResponseFaultsPanel
        variant={makeVariant({
          behavior: {
            delayMs: 0,
            jitterMs: 0,
            fault: 'dribble',
            chunkSchedule: [
              { afterMs: 1, body: 'first' },
              { afterMs: 2, body: 'second' },
            ],
          },
        })}
        onUpdateVariant={onUpdateVariant}
      />,
    );
    expect(screen.getByTestId('api-mock-chunk-row-1')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('api-mock-chunk-remove-0'));
    expect(onUpdateVariant).toHaveBeenLastCalledWith({
      behavior: expect.objectContaining({
        chunkSchedule: [{ afterMs: 2, body: 'second' }],
      }),
    });
  });

  it('seeds dribble body slice when content is missing at runtime', () => {
    const onUpdateVariant = vi.fn();
    render(
      <ApiMockResponseFaultsPanel
        variant={makeVariant({
          body: { kind: 'none', content: undefined as unknown as string },
          behavior: { delayMs: 0, jitterMs: 0, fault: undefined, chunkSchedule: undefined },
        })}
        onUpdateVariant={onUpdateVariant}
      />,
    );
    fireEvent.click(screen.getByTestId('api-mock-fault-dribble'));
    expect(onUpdateVariant).toHaveBeenCalledWith({
      behavior: expect.objectContaining({
        chunkSchedule: [{ afterMs: 50, body: '…' }, { afterMs: 100, body: '' }],
      }),
    });
  });

  it('re-seeds dribble when schedule array is empty', () => {
    const onUpdateVariant = vi.fn();
    render(
      <ApiMockResponseFaultsPanel
        variant={makeVariant({
          behavior: { delayMs: 0, jitterMs: 0, fault: 'dribble', chunkSchedule: [] },
        })}
        onUpdateVariant={onUpdateVariant}
      />,
    );
    fireEvent.click(screen.getByTestId('api-mock-fault-dribble'));
    expect(onUpdateVariant).toHaveBeenCalledWith({
      behavior: expect.objectContaining({
        chunkSchedule: expect.arrayContaining([expect.objectContaining({ afterMs: 50 })]),
      }),
    });
  });

  it('clears fault to none and reset', () => {
    const onUpdateVariant = vi.fn();
    const variant = makeVariant({
      body: { kind: 'json', contentType: 'application/json', content: '' },
      behavior: { delayMs: 0, jitterMs: 0, fault: undefined, chunkSchedule: undefined },
    });
    render(<ApiMockResponseFaultsPanel variant={variant} onUpdateVariant={onUpdateVariant} />);

    fireEvent.click(screen.getByTestId('api-mock-fault-dribble'));
    expect(onUpdateVariant).toHaveBeenCalledWith({
      behavior: expect.objectContaining({
        fault: 'dribble',
        chunkSchedule: [{ afterMs: 50, body: '…' }, { afterMs: 100, body: '' }],
      }),
    });

    fireEvent.click(screen.getByTestId('api-mock-fault-reset'));
    expect(onUpdateVariant).toHaveBeenLastCalledWith({
      behavior: expect.objectContaining({ fault: 'reset', chunkSchedule: undefined }),
    });

    fireEvent.click(screen.getByTestId('api-mock-fault-none'));
    expect(onUpdateVariant).toHaveBeenLastCalledWith({
      behavior: expect.objectContaining({ fault: undefined }),
    });
  });

  it('edits chunk delay and body fields', () => {
    const onUpdateVariant = vi.fn();
    render(
      <ApiMockResponseFaultsPanel
        variant={makeVariant({
          behavior: {
            delayMs: 0,
            jitterMs: 0,
            fault: 'dribble',
            chunkSchedule: [{ afterMs: 10, body: 'a' }],
          },
        })}
        onUpdateVariant={onUpdateVariant}
      />,
    );

    fireEvent.change(screen.getByLabelText('Chunk 1 delay ms'), { target: { value: '75' } });
    expect(onUpdateVariant).toHaveBeenCalledWith({
      behavior: expect.objectContaining({ chunkSchedule: [{ afterMs: 75, body: 'a' }] }),
    });

    fireEvent.change(screen.getByLabelText('Chunk 1 delay ms'), { target: { value: 'bad' } });
    expect(onUpdateVariant).toHaveBeenLastCalledWith({
      behavior: expect.objectContaining({ chunkSchedule: [{ afterMs: 0, body: 'a' }] }),
    });

    fireEvent.change(screen.getByLabelText('Chunk 1 delay ms'), { target: { value: '-5' } });
    expect(onUpdateVariant).toHaveBeenLastCalledWith({
      behavior: expect.objectContaining({ chunkSchedule: [{ afterMs: 0, body: 'a' }] }),
    });

    fireEvent.change(screen.getByLabelText('Chunk 1 body'), { target: { value: 'payload' } });
    expect(onUpdateVariant).toHaveBeenLastCalledWith({
      behavior: expect.objectContaining({ chunkSchedule: [{ afterMs: 10, body: 'payload' }] }),
    });
  });

  it('adds chunks and removes the last chunk', () => {
    const onUpdateVariant = vi.fn();
    render(
      <ApiMockResponseFaultsPanel
        variant={makeVariant({
          behavior: {
            delayMs: 0,
            jitterMs: 0,
            fault: 'dribble',
            chunkSchedule: [{ afterMs: 1, body: 'solo' }],
          },
        })}
        onUpdateVariant={onUpdateVariant}
      />,
    );

    fireEvent.click(screen.getByTestId('api-mock-chunk-add'));
    expect(onUpdateVariant).toHaveBeenCalledWith({
      behavior: expect.objectContaining({
        chunkSchedule: [{ afterMs: 1, body: 'solo' }, { afterMs: 50, body: '' }],
      }),
    });

    fireEvent.click(screen.getByTestId('api-mock-chunk-remove-0'));
    expect(onUpdateVariant).toHaveBeenLastCalledWith({
      behavior: expect.objectContaining({ chunkSchedule: undefined }),
    });
  });

  it('marks every fault card selected state', () => {
    for (const id of ['none', 'timeout', 'reset', 'dribble', 'close', 'malformed'] as const) {
      const fault = id === 'none' ? undefined : id;
      render(
        <ApiMockResponseFaultsPanel
          variant={makeVariant({
            behavior: {
              delayMs: 0,
              jitterMs: 0,
              fault,
              chunkSchedule: id === 'dribble' ? [{ afterMs: 1, body: 'x' }] : undefined,
            },
          })}
          onUpdateVariant={vi.fn()}
        />,
      );
      expect(screen.getByTestId(`api-mock-fault-${id}`)).toHaveClass('selected');
      cleanup();
    }
  });

  it('adds first chunk when schedule is undefined and edits second row', () => {
    function Stateful() {
      const [variant, setVariant] = useState(makeVariant({
        behavior: { delayMs: 0, jitterMs: 0, fault: 'dribble', chunkSchedule: undefined },
      }));
      return (
        <ApiMockResponseFaultsPanel
          variant={variant}
          onUpdateVariant={patch => setVariant(v => ({
            ...v,
            behavior: { ...v.behavior, ...patch.behavior },
          }))}
        />
      );
    }
    render(<Stateful />);
    fireEvent.click(screen.getByTestId('api-mock-chunk-add'));
    expect(screen.getByTestId('api-mock-chunk-row-0')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('api-mock-chunk-add'));
    expect(screen.getByTestId('api-mock-chunk-row-1')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Chunk 2 delay ms'), { target: { value: '99' } });
    fireEvent.change(screen.getByLabelText('Chunk 2 body'), { target: { value: 'tail' } });
    fireEvent.click(screen.getByTestId('api-mock-chunk-remove-1'));
    expect(screen.getByTestId('api-mock-chunk-row-0')).toBeInTheDocument();
    expect(screen.queryByTestId('api-mock-chunk-row-1')).toBeNull();
  });

  it('shows empty schedule hint when dribble has no chunks', () => {
    render(
      <ApiMockResponseFaultsPanel
        variant={makeVariant({
          behavior: { delayMs: 0, jitterMs: 0, fault: 'dribble', chunkSchedule: [] },
        })}
        onUpdateVariant={vi.fn()}
      />,
    );
    expect(screen.getByText(/No chunks defined/i)).toBeInTheDocument();
  });

  it('marks the selected fault card', () => {
    render(
      <ApiMockResponseFaultsPanel
        variant={makeVariant({ behavior: { delayMs: 0, jitterMs: 0, fault: 'timeout' } })}
        onUpdateVariant={vi.fn()}
      />,
    );
    expect(screen.getByTestId('api-mock-fault-timeout')).toHaveClass('selected');
  });
});
