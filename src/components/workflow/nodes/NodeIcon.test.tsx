/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { NodeIcon, getNodeCategory } from './NodeIcon';

const ALL_TYPES = [
  'start', 'end', 'http', 'condition', 'delay',
  'fork', 'join', 'switch', 'loop', 'setVariable',
  'aggregate', 'webhook', 'schedule',
];

describe('NodeIcon', () => {
  it('renders an SVG icon badge for each known type', () => {
    for (const type of ALL_TYPES) {
      const { container } = render(<NodeIcon type={type} />);
      const badge = container.querySelector('.wf-node-icon-badge');
      expect(badge, `Badge missing for type: ${type}`).toBeTruthy();
      const svg = badge?.querySelector('svg');
      expect(svg, `SVG missing for type: ${type}`).toBeTruthy();
    }
  });

  it('returns null for unknown type', () => {
    const { container } = render(<NodeIcon type="nonexistent" />);
    expect(container.innerHTML).toBe('');
  });

  it('applies category-specific CSS class', () => {
    const { container } = render(<NodeIcon type="http" />);
    expect(container.querySelector('.wf-node-icon-badge--action')).toBeTruthy();
  });

  it('applies trigger category for start node', () => {
    const { container } = render(<NodeIcon type="start" />);
    expect(container.querySelector('.wf-node-icon-badge--trigger')).toBeTruthy();
  });

  it('applies logic category for condition node', () => {
    const { container } = render(<NodeIcon type="condition" />);
    expect(container.querySelector('.wf-node-icon-badge--logic')).toBeTruthy();
  });

  it('applies data category for setVariable node', () => {
    const { container } = render(<NodeIcon type="setVariable" />);
    expect(container.querySelector('.wf-node-icon-badge--data')).toBeTruthy();
  });

  it('applies flow category for fork node', () => {
    const { container } = render(<NodeIcon type="fork" />);
    expect(container.querySelector('.wf-node-icon-badge--flow')).toBeTruthy();
  });

  it('applies terminal category for end node', () => {
    const { container } = render(<NodeIcon type="end" />);
    expect(container.querySelector('.wf-node-icon-badge--terminal')).toBeTruthy();
  });

  it('applies trigger category for webhook node', () => {
    const { container } = render(<NodeIcon type="webhook" />);
    expect(container.querySelector('.wf-node-icon-badge--trigger')).toBeTruthy();
  });

  it('applies trigger category for schedule node', () => {
    const { container } = render(<NodeIcon type="schedule" />);
    expect(container.querySelector('.wf-node-icon-badge--trigger')).toBeTruthy();
  });

  it('passes custom className', () => {
    const { container } = render(<NodeIcon type="http" className="my-custom" />);
    const badge = container.querySelector('.wf-node-icon-badge');
    expect(badge?.classList.contains('my-custom')).toBe(true);
  });

  it('each type has unique SVG content', () => {
    const htmls = new Set<string>();
    for (const type of ALL_TYPES) {
      const { container } = render(<NodeIcon type={type} />);
      const svg = container.querySelector('svg');
      htmls.add(svg?.innerHTML ?? '');
    }
    expect(htmls.size).toBe(ALL_TYPES.length);
  });
});

describe('getNodeCategory', () => {
  it('returns correct category labels', () => {
    expect(getNodeCategory('start')).toBe('Trigger');
    expect(getNodeCategory('http')).toBe('Action');
    expect(getNodeCategory('condition')).toBe('Logic');
    expect(getNodeCategory('setVariable')).toBe('Data');
    expect(getNodeCategory('fork')).toBe('Flow');
    expect(getNodeCategory('end')).toBe('Terminal');
  });

  it('returns empty string for unknown type', () => {
    expect(getNodeCategory('nonexistent')).toBe('');
  });

  it('all known types return non-empty category', () => {
    for (const type of ALL_TYPES) {
      expect(getNodeCategory(type), `Empty category for: ${type}`).not.toBe('');
    }
  });
});
