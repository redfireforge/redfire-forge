/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import HttpStepNode from './HttpStepNode';
import type { HttpNodeData } from '../../types/workflow';
import type { Scenario } from '@shared/types';
import { makeScenario as _makeScenario } from '@test-utils/factories';

const openStepDetail = vi.fn();
const handleConfigure = vi.fn();

const rsRef = vi.hoisted(() => ({
  rs: null as { state: string; statusCode?: number; responseTimeMs?: number; error?: string } | null,
}));

vi.mock('@xyflow/react', () => ({
  Handle: ({ type, position, id, className }: { type: string; position: string; id?: string; className?: string }) => (
    <div data-testid={`handle-${type}${id ? `-${id}` : ''}`} data-position={position} className={className} />
  ),
  Position: { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' },
}));

vi.mock('./useNodeBase', () => ({
  useNodeBase: () => ({
    rs: rsRef.rs,
    stateClass: rsRef.rs?.state && rsRef.rs.state !== 'idle' ? `wf-node-${rsRef.rs.state}` : '',
    debugStep: null,
    handleConfigure,
    openStepDetail,
  }),
}));

vi.mock('./NodeIcon', () => ({
  NodeIcon: ({ type }: { type: string }) => <div data-testid={`icon-${type}`} />,
  getNodeCategory: () => 'HTTP',
}));

vi.mock('./NodeConfigureButton', () => ({
  NodeConfigureButton: ({ onClick, title }: { onClick: () => void; title?: string }) => (
    <button type="button" data-testid="configure" title={title} onClick={onClick}>
      cfg
    </button>
  ),
}));

vi.mock('./NodePausedOverlay', () => ({
  NodePausedOverlay: () => <div data-testid="paused" />,
}));

const publishedKeysRef = vi.hoisted(() => ({ keys: new Set<string>() }));
vi.mock('../../contexts/PublishedCatalogContext', () => ({
  usePublishedCatalogKeys: () => publishedKeysRef.keys,
}));

const makeScenario = (overrides: Partial<Scenario> = {}): Scenario =>
  _makeScenario({
    name: 'API',
    url: 'https://api.example.com/path',
    bodyType: 'none',
    ...overrides,
  });

function makeProps(data: HttpNodeData, selected = false) {
  return {
    id: 'http-1',
    data,
    selected,
    type: 'http' as const,
    isConnectable: true,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    zIndex: 0,
    dragging: false,
    dragHandle: undefined,
    parentId: undefined,
    sourcePosition: undefined,
    targetPosition: undefined,
  };
}

describe('HttpStepNode', () => {
  beforeEach(() => {
    rsRef.rs = null;
    resetAllMocks();
  });

  it('truncates long URL in footer', () => {
    const long = `https://api.example.com/${'x'.repeat(60)}`;
    const data: HttpNodeData = { label: 'Step', scenario: makeScenario({ url: long }) };
    render(<HttpStepNode {...makeProps(data)} />);
    const urlEl = document.querySelector('.wf-node-url');
    expect(urlEl?.textContent?.startsWith('...')).toBe(true);
  });

  it('shows catalog and requests source badges', () => {
    const { rerender } = render(
      <HttpStepNode {...makeProps({ label: 'S', scenario: makeScenario(), sourceType: 'catalog' })} />,
    );
    expect(screen.getByText('CAT')).toBeTruthy();
    rerender(
      <HttpStepNode {...makeProps({ label: 'S', scenario: makeScenario(), sourceType: 'requests' })} />,
    );
    expect(screen.getByText('REQ')).toBeTruthy();
  });

  it('shows extract count plural and singular', () => {
    const { rerender } = render(
      <HttpStepNode
        {...makeProps({
          label: 'S',
          scenario: makeScenario({ extractions: [{ name: 'a', source: 'body', expression: '$.x' }] }),
        })}
      />,
    );
    expect(screen.getByText('1 extract')).toBeTruthy();

    rerender(
      <HttpStepNode
        {...makeProps({
          label: 'S',
          scenario: makeScenario({
            extractions: [
              { name: 'a', source: 'body', expression: '$.x' },
              { name: 'b', source: 'body', expression: '$.y' },
            ],
          }),
        })}
      />,
    );
    expect(screen.getByText('2 extracts')).toBeTruthy();
  });

  it('shows data row count badge', () => {
    const data: HttpNodeData = {
      label: 'S',
      scenario: makeScenario({
        dataSource: {
          id: 'ds',
          columns: [],
          rows: [
            { id: '1', values: {}, enabled: true },
            { id: '2', values: {}, enabled: true },
          ],
          source: { type: 'inline' },
        },
      }),
    };
    render(<HttpStepNode {...makeProps(data)} />);
    expect(screen.getByText(/2 rows/)).toBeTruthy();
  });

  it('uses default method GET when scenario.method missing', () => {
    const scenario = { ...makeScenario(), method: undefined as unknown as Scenario['method'] };
    const data: HttpNodeData = { label: 'S', scenario };
    render(<HttpStepNode {...makeProps(data)} />);
    expect(screen.getByText('GET')).toBeTruthy();
  });

  it('shows pass status and opens detail on click', () => {
    rsRef.rs = { state: 'pass', statusCode: 200, responseTimeMs: 12 };
    const data: HttpNodeData = { label: 'S', scenario: makeScenario() };
    render(<HttpStepNode {...makeProps(data)} />);
    fireEvent.click(screen.getByTitle('Click for full response details'));
    expect(openStepDetail).toHaveBeenCalledWith('http-1');
  });

  it('shows fail status with timing and opens detail', () => {
    rsRef.rs = { state: 'fail', statusCode: 500, responseTimeMs: 8, error: 'E' };
    const data: HttpNodeData = { label: 'S', scenario: makeScenario() };
    render(<HttpStepNode {...makeProps(data)} />);
    const btn = screen.getByTitle('Click for full error and response details');
    fireEvent.click(btn);
    expect(openStepDetail).toHaveBeenCalled();
  });

  it('shows fail badge without ms when responseTimeMs is zero', () => {
    rsRef.rs = { state: 'fail', statusCode: 0 };
    render(<HttpStepNode {...makeProps({ label: 'S', scenario: makeScenario() })} />);
    expect(screen.getByText(/ERR/)).toBeTruthy();
    expect(screen.queryByText(/ms/)).toBeNull();
  });

  it('shows running state', () => {
    rsRef.rs = { state: 'running' };
    render(<HttpStepNode {...makeProps({ label: 'S', scenario: makeScenario() })} />);
    expect(screen.getByText(/Running/)).toBeTruthy();
  });

  it('Details button opens step detail when passed', () => {
    rsRef.rs = { state: 'pass', statusCode: 200, responseTimeMs: 1 };
    render(<HttpStepNode {...makeProps({ label: 'S', scenario: makeScenario() })} />);
    fireEvent.click(screen.getByText('Details'));
    expect(openStepDetail).toHaveBeenCalledWith('http-1');
  });

  it('shows full URL when length is within 40 characters', () => {
    const url = `https://${'x'.repeat(10)}`;
    const data: HttpNodeData = { label: 'S', scenario: makeScenario({ url }) };
    render(<HttpStepNode {...makeProps(data)} />);
    const urlEl = document.querySelector('.wf-node-url');
    expect(urlEl?.textContent).toBe(url);
    expect(urlEl?.textContent?.startsWith('...')).toBe(false);
  });

  it('shows SVC badge when serviceId is set', () => {
    const data: HttpNodeData = { label: 'S', scenario: makeScenario(), serviceId: 'svc-1' };
    render(<HttpStepNode {...makeProps(data)} />);
    expect(screen.getByText('SVC')).toBeTruthy();
  });

  it('does not show SVC badge when serviceId is absent', () => {
    const data: HttpNodeData = { label: 'S', scenario: makeScenario() };
    render(<HttpStepNode {...makeProps(data)} />);
    expect(screen.queryByText('SVC')).toBeNull();
  });

  it('uses METHOD_COLORS fallback for unknown HTTP verbs', () => {
    const data: HttpNodeData = {
      label: 'S',
      scenario: makeScenario({ method: 'HEAD' as unknown as Scenario['method'] }),
    };
    render(<HttpStepNode {...makeProps(data)} />);
    const badge = document.querySelector('.wf-method-badge') as HTMLElement;
    expect(badge?.style.background).toBeTruthy();
    expect(screen.getByText('HEAD')).toBeTruthy();
  });

  describe('orphaned node badge (D3)', () => {
    it('shows orphan badge when catalogRef endpoint is not published', () => {
      publishedKeysRef.keys = new Set<string>();
      const data: HttpNodeData = {
        label: 'S',
        scenario: makeScenario(),
        catalogRef: { entryId: 'e1', endpointId: 'ep1', method: 'GET', path: '/test' },
      };
      render(<HttpStepNode {...makeProps(data)} />);
      expect(screen.getByTestId('wf-orphan-badge')).toBeTruthy();
    });

    it('does not show orphan badge when catalogRef endpoint is still published', () => {
      publishedKeysRef.keys = new Set(['e1::ep1']);
      const data: HttpNodeData = {
        label: 'S',
        scenario: makeScenario(),
        catalogRef: { entryId: 'e1', endpointId: 'ep1', method: 'GET', path: '/test' },
      };
      render(<HttpStepNode {...makeProps(data)} />);
      expect(screen.queryByTestId('wf-orphan-badge')).toBeNull();
    });

    it('does not show orphan badge when no catalogRef', () => {
      publishedKeysRef.keys = new Set<string>();
      const data: HttpNodeData = { label: 'S', scenario: makeScenario() };
      render(<HttpStepNode {...makeProps(data)} />);
      expect(screen.queryByTestId('wf-orphan-badge')).toBeNull();
    });
  });
});
