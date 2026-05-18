/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockToPng = vi.fn();
const mockToSvg = vi.fn();

vi.mock('html-to-image', () => ({
  toPng: (...args: unknown[]) => mockToPng(...args),
  toSvg: (...args: unknown[]) => mockToSvg(...args),
}));

vi.mock('@xyflow/react', () => ({
  getNodesBounds: vi.fn(() => ({ x: 0, y: 0, width: 400, height: 300 })),
  getViewportForBounds: vi.fn(() => ({ x: 10, y: 20, zoom: 1.5 })),
}));

import { captureCanvasScreenshot, captureCanvasSvg } from './canvasScreenshot';
import type { Node } from '@xyflow/react';

describe('captureCanvasScreenshot', () => {
  const mockNodes: Node[] = [
    { id: 'n1', type: 'http', position: { x: 0, y: 0 }, data: { label: 'Node 1' } },
    { id: 'n2', type: 'http', position: { x: 200, y: 100 }, data: { label: 'Node 2' } },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws if viewport element is not found', async () => {
    const container = document.createElement('div');
    await expect(captureCanvasScreenshot(container, mockNodes)).rejects.toThrow(
      'ReactFlow viewport element not found',
    );
  });

  it('calls toPng with the viewport element', async () => {
    const container = document.createElement('div');
    const viewport = document.createElement('div');
    viewport.className = 'react-flow__viewport';
    container.appendChild(viewport);

    mockToPng.mockResolvedValue('data:image/png;base64,abc123');

    const result = await captureCanvasScreenshot(container, mockNodes);
    expect(result).toBe('data:image/png;base64,abc123');
    expect(mockToPng).toHaveBeenCalledTimes(1);
    expect(mockToPng).toHaveBeenCalledWith(viewport, expect.objectContaining({
      backgroundColor: '#0f172a',
      pixelRatio: 2,
    }));
  });

  it('passes computed transform style to toPng', async () => {
    const container = document.createElement('div');
    const viewport = document.createElement('div');
    viewport.className = 'react-flow__viewport';
    container.appendChild(viewport);

    mockToPng.mockResolvedValue('data:image/png;base64,xyz');

    await captureCanvasScreenshot(container, mockNodes);

    const options = mockToPng.mock.calls[0][1];
    expect(options.style.transform).toContain('translate(');
    expect(options.style.transform).toContain('scale(');
  });

  it('sets width and height on the output image', async () => {
    const container = document.createElement('div');
    const viewport = document.createElement('div');
    viewport.className = 'react-flow__viewport';
    container.appendChild(viewport);

    mockToPng.mockResolvedValue('data:image/png;base64,xyz');

    await captureCanvasScreenshot(container, mockNodes);

    const options = mockToPng.mock.calls[0][1];
    expect(options.width).toBeGreaterThanOrEqual(2048);
    expect(options.height).toBeGreaterThanOrEqual(1536);
  });

  it('propagates errors from toPng', async () => {
    const container = document.createElement('div');
    const viewport = document.createElement('div');
    viewport.className = 'react-flow__viewport';
    container.appendChild(viewport);

    mockToPng.mockRejectedValue(new Error('Canvas tainted'));

    await expect(captureCanvasScreenshot(container, mockNodes)).rejects.toThrow('Canvas tainted');
  });
});

describe('captureCanvasSvg', () => {
  const mockNodes: Node[] = [
    { id: 'n1', type: 'http', position: { x: 0, y: 0 }, data: { label: 'Node 1' } },
    { id: 'n2', type: 'http', position: { x: 200, y: 100 }, data: { label: 'Node 2' } },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws if viewport element is not found', async () => {
    const container = document.createElement('div');
    await expect(captureCanvasSvg(container, mockNodes)).rejects.toThrow(
      'ReactFlow viewport element not found',
    );
  });

  it('calls toSvg with the viewport element and correct options', async () => {
    const container = document.createElement('div');
    const viewport = document.createElement('div');
    viewport.className = 'react-flow__viewport';
    container.appendChild(viewport);

    mockToSvg.mockResolvedValue('data:image/svg+xml;charset=utf-8,<svg></svg>');

    const result = await captureCanvasSvg(container, mockNodes);
    expect(result).toBe('data:image/svg+xml;charset=utf-8,<svg></svg>');
    expect(mockToSvg).toHaveBeenCalledTimes(1);
    expect(mockToSvg).toHaveBeenCalledWith(viewport, expect.objectContaining({
      backgroundColor: '#0f172a',
    }));
  });

  it('does not pass pixelRatio to toSvg', async () => {
    const container = document.createElement('div');
    const viewport = document.createElement('div');
    viewport.className = 'react-flow__viewport';
    container.appendChild(viewport);

    mockToSvg.mockResolvedValue('data:image/svg+xml;charset=utf-8,<svg></svg>');

    await captureCanvasSvg(container, mockNodes);

    const options = mockToSvg.mock.calls[0][1];
    expect(options.pixelRatio).toBeUndefined();
  });

  it('passes computed transform style to toSvg', async () => {
    const container = document.createElement('div');
    const viewport = document.createElement('div');
    viewport.className = 'react-flow__viewport';
    container.appendChild(viewport);

    mockToSvg.mockResolvedValue('data:image/svg+xml;charset=utf-8,<svg></svg>');

    await captureCanvasSvg(container, mockNodes);

    const options = mockToSvg.mock.calls[0][1];
    expect(options.style.transform).toContain('translate(');
    expect(options.style.transform).toContain('scale(');
  });

  it('sets width and height on the output', async () => {
    const container = document.createElement('div');
    const viewport = document.createElement('div');
    viewport.className = 'react-flow__viewport';
    container.appendChild(viewport);

    mockToSvg.mockResolvedValue('data:image/svg+xml;charset=utf-8,<svg></svg>');

    await captureCanvasSvg(container, mockNodes);

    const options = mockToSvg.mock.calls[0][1];
    expect(options.width).toBeGreaterThanOrEqual(2048);
    expect(options.height).toBeGreaterThanOrEqual(1536);
  });

  it('propagates errors from toSvg', async () => {
    const container = document.createElement('div');
    const viewport = document.createElement('div');
    viewport.className = 'react-flow__viewport';
    container.appendChild(viewport);

    mockToSvg.mockRejectedValue(new Error('SVG render failed'));

    await expect(captureCanvasSvg(container, mockNodes)).rejects.toThrow('SVG render failed');
  });
});
