import { toPng, toSvg } from 'html-to-image';
import { getNodesBounds, getViewportForBounds, type Node } from '@xyflow/react';

const IMAGE_WIDTH = 2048;
const IMAGE_HEIGHT = 1536;
const PADDING = 0.1;
const BG_COLOR = '#0f172a';

function resolveViewport(containerEl: HTMLElement) {
  const viewport = containerEl.querySelector<HTMLElement>('.react-flow__viewport');
  if (!viewport) {
    throw new Error('ReactFlow viewport element not found');
  }
  return viewport;
}

function computeDimensions(nodes: Node[]) {
  const nodesBounds = getNodesBounds(nodes);

  const paddedWidth = nodesBounds.width * (1 + PADDING * 2);
  const paddedHeight = nodesBounds.height * (1 + PADDING * 2);
  const imgWidth = Math.max(IMAGE_WIDTH, paddedWidth);
  const imgHeight = Math.max(IMAGE_HEIGHT, paddedHeight);

  const transform = getViewportForBounds(
    nodesBounds,
    imgWidth,
    imgHeight,
    0.1,
    2,
    PADDING,
  );

  return { imgWidth, imgHeight, transform };
}

/**
 * Capture the ReactFlow canvas viewport as a PNG data URL.
 * Requires a `.react-flow__viewport` element inside the given container.
 */
export async function captureCanvasScreenshot(
  containerEl: HTMLElement,
  nodes: Node[],
): Promise<string> {
  const viewport = resolveViewport(containerEl);
  const { imgWidth, imgHeight, transform } = computeDimensions(nodes);

  return toPng(viewport, {
    backgroundColor: BG_COLOR,
    width: imgWidth,
    height: imgHeight,
    pixelRatio: 2,
    style: {
      width: `${imgWidth}px`,
      height: `${imgHeight}px`,
      transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.zoom})`,
    },
  });
}

/**
 * Capture the ReactFlow canvas viewport as an SVG data URL.
 * Returns a `data:image/svg+xml;...` string.
 */
export async function captureCanvasSvg(
  containerEl: HTMLElement,
  nodes: Node[],
): Promise<string> {
  const viewport = resolveViewport(containerEl);
  const { imgWidth, imgHeight, transform } = computeDimensions(nodes);

  return toSvg(viewport, {
    backgroundColor: BG_COLOR,
    width: imgWidth,
    height: imgHeight,
    style: {
      width: `${imgWidth}px`,
      height: `${imgHeight}px`,
      transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.zoom})`,
    },
  });
}
