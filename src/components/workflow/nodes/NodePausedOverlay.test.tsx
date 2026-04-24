/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { NodePausedOverlay } from './NodePausedOverlay';

describe('NodePausedOverlay', () => {
  it('renders nothing when state is not paused', () => {
    const { container } = render(
      <NodePausedOverlay nodeId="n1" state="running" debugStep={null} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when state is undefined', () => {
    const { container } = render(
      <NodePausedOverlay nodeId="n1" state={undefined} debugStep={null} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when state is pass', () => {
    const { container } = render(
      <NodePausedOverlay nodeId="n1" state="pass" debugStep={null} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders Step button when paused with debugStep callback', () => {
    const debugStep = vi.fn();
    const { container } = render(
      <NodePausedOverlay nodeId="n1" state="paused" debugStep={debugStep} />,
    );
    const btn = container.querySelector('.wf-debug-step-btn');
    expect(btn).toBeTruthy();
    expect(btn?.textContent).toContain('Step');
  });

  it('calls debugStep with nodeId when Step button is clicked', () => {
    const debugStep = vi.fn();
    const { container } = render(
      <NodePausedOverlay nodeId="node-42" state="paused" debugStep={debugStep} />,
    );
    const btn = container.querySelector('.wf-debug-step-btn')!;
    fireEvent.click(btn);
    expect(debugStep).toHaveBeenCalledWith('node-42');
  });

  it('stops propagation on Step button click', () => {
    const debugStep = vi.fn();
    const parentClick = vi.fn();
    const { container } = render(
      <div onClick={parentClick}>
        <NodePausedOverlay nodeId="n1" state="paused" debugStep={debugStep} />
      </div>,
    );
    const btn = container.querySelector('.wf-debug-step-btn')!;
    fireEvent.click(btn);
    expect(debugStep).toHaveBeenCalledTimes(1);
    expect(parentClick).not.toHaveBeenCalled();
  });

  it('renders Paused badge when paused without debugStep', () => {
    const { container } = render(
      <NodePausedOverlay nodeId="n1" state="paused" debugStep={null} />,
    );
    const badge = container.querySelector('.wf-status-paused');
    expect(badge).toBeTruthy();
    expect(badge?.textContent).toContain('Paused');
  });

  it('does not render Paused badge when debugStep is provided', () => {
    const { container } = render(
      <NodePausedOverlay nodeId="n1" state="paused" debugStep={vi.fn()} />,
    );
    expect(container.querySelector('.wf-status-paused')).toBeNull();
  });
});
