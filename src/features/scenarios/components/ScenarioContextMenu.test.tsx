/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import ScenarioContextMenu from './ScenarioContextMenu';
import type { TestScenario } from '../../../shared/types';
import { makeTestScenario as _makeTestScenario } from '../../../test-utils/factories';

const makeScenario = (overrides: Partial<TestScenario> = {}): TestScenario =>
  _makeTestScenario({ id: 'sc-1', name: 'Test Scenario', tests: [], ...overrides });

describe('ScenarioContextMenu', () => {
  let onAddTag: ReturnType<typeof vi.fn>;
  let onRemoveTag: ReturnType<typeof vi.fn>;
  let onClearTags: ReturnType<typeof vi.fn>;
  let onClose: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onAddTag = vi.fn();
    onRemoveTag = vi.fn();
    onClearTags = vi.fn();
    onClose = vi.fn();
  });

  afterEach(() => {
    cleanup();
  });

  const getDefaultProps = () => ({
    x: 100,
    y: 200,
    scenario: makeScenario({ tags: ['smoke', 'regression'] }),
    tagSuggestions: ['smoke', 'regression', 'critical', 'e2e'],
    onAddTag,
    onRemoveTag,
    onClearTags,
    onClose,
  });

  it('renders tag checkboxes for suggestions', () => {
    render(<ScenarioContextMenu {...getDefaultProps()} />);
    
    expect(screen.getByLabelText('smoke')).toBeInTheDocument();
    expect(screen.getByLabelText('regression')).toBeInTheDocument();
    expect(screen.getByLabelText('critical')).toBeInTheDocument();
    expect(screen.getByLabelText('e2e')).toBeInTheDocument();
  });

  it('checkboxes are checked for existing tags', () => {
    render(<ScenarioContextMenu {...getDefaultProps()} />);
    
    expect(screen.getByLabelText('smoke')).toBeChecked();
    expect(screen.getByLabelText('regression')).toBeChecked();
    expect(screen.getByLabelText('critical')).not.toBeChecked();
    expect(screen.getByLabelText('e2e')).not.toBeChecked();
  });

  it('checking checkbox calls onAddTag', () => {
    render(<ScenarioContextMenu {...getDefaultProps()} />);
    
    fireEvent.click(screen.getByLabelText('critical'));
    
    expect(onAddTag).toHaveBeenCalledWith('critical');
  });

  it('unchecking checkbox calls onRemoveTag', () => {
    render(<ScenarioContextMenu {...getDefaultProps()} />);
    
    fireEvent.click(screen.getByLabelText('smoke'));
    
    expect(onRemoveTag).toHaveBeenCalledWith('smoke');
  });

  it('"Remove All Tags" button calls onClearTags', () => {
    render(<ScenarioContextMenu {...getDefaultProps()} />);
    
    fireEvent.click(screen.getByText('Remove All Tags'));
    
    expect(onClearTags).toHaveBeenCalled();
  });

  it('"Remove All Tags" button is hidden when no tags', () => {
    render(
      <ScenarioContextMenu
        {...getDefaultProps()}
        scenario={makeScenario({ tags: undefined })}
      />
    );
    
    expect(screen.queryByText('Remove All Tags')).not.toBeInTheDocument();
  });

  it('clicking outside closes menu', () => {
    render(
      <div>
        <div data-testid="outside">Outside</div>
        <ScenarioContextMenu {...getDefaultProps()} />
      </div>
    );
    
    fireEvent.mouseDown(screen.getByTestId('outside'));
    
    expect(onClose).toHaveBeenCalled();
  });

  it('Escape key closes menu', () => {
    render(<ScenarioContextMenu {...getDefaultProps()} />);
    
    fireEvent.keyDown(document, { key: 'Escape' });
    
    expect(onClose).toHaveBeenCalled();
  });

  it('non-Escape keys do not close menu', () => {
    render(<ScenarioContextMenu {...getDefaultProps()} />);
    
    fireEvent.keyDown(document, { key: 'Enter' });
    
    expect(onClose).not.toHaveBeenCalled();
  });

  it('clicking inside menu does not close it', () => {
    render(<ScenarioContextMenu {...getDefaultProps()} />);
    
    fireEvent.mouseDown(screen.getByText('Tags'));
    
    expect(onClose).not.toHaveBeenCalled();
  });

  it('renders at the specified position when within viewport', () => {
    // Mock window dimensions
    Object.defineProperty(window, 'innerWidth', { value: 1920, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 1080, writable: true });
    
    const { container } = render(<ScenarioContextMenu {...getDefaultProps()} x={150} y={250} />);
    
    const menu = container.querySelector('.scenario-context-menu');
    expect(menu).toHaveStyle({ left: '150px', top: '250px' });
  });

  it('renders empty state when no tag suggestions', () => {
    render(
      <ScenarioContextMenu
        {...getDefaultProps()}
        tagSuggestions={[]}
        scenario={makeScenario({ tags: [] })}
      />
    );
    
    expect(screen.getByText('Tags')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('renders with empty tags array same as undefined', () => {
    render(
      <ScenarioContextMenu
        {...getDefaultProps()}
        scenario={makeScenario({ tags: [] })}
      />
    );
    
    expect(screen.queryByText('Remove All Tags')).not.toBeInTheDocument();
  });

  it('adjusts position when menu would overflow right edge', () => {
    Object.defineProperty(window, 'innerWidth', { value: 200, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 1080, writable: true });

    const origGetBCR = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = function () {
      if (this.classList.contains('scenario-context-menu')) {
        return { width: 160, height: 120, x: 0, y: 0, top: 0, left: 0, bottom: 120, right: 160, toJSON: () => ({}) } as DOMRect;
      }
      return origGetBCR.call(this);
    };
    try {
      const { container } = render(<ScenarioContextMenu {...getDefaultProps()} x={180} y={100} />);
      const menu = container.querySelector('.scenario-context-menu') as HTMLElement;
      const left = parseInt(menu.style.left, 10);
      expect(left).toBeLessThan(180);
    } finally {
      HTMLElement.prototype.getBoundingClientRect = origGetBCR;
    }
  });

  it('adjusts position when menu would overflow bottom edge', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1920, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 200, writable: true });

    const origGetBCR = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = function () {
      if (this.classList.contains('scenario-context-menu')) {
        return { width: 160, height: 120, x: 0, y: 0, top: 0, left: 0, bottom: 120, right: 160, toJSON: () => ({}) } as DOMRect;
      }
      return origGetBCR.call(this);
    };
    try {
      const { container } = render(<ScenarioContextMenu {...getDefaultProps()} x={100} y={180} />);
      const menu = container.querySelector('.scenario-context-menu') as HTMLElement;
      const top = parseInt(menu.style.top, 10);
      expect(top).toBeLessThan(180);
    } finally {
      HTMLElement.prototype.getBoundingClientRect = origGetBCR;
    }
  });
});
