// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import StructureChangeLogPanel from './StructureChangeLogPanel';
import type { StructureChangeEntry } from '@shared/types';

function makeEntry(overrides?: Partial<StructureChangeEntry>): StructureChangeEntry {
  return {
    id: 'e1',
    timestamp: Date.now() - 60_000,
    action: 'scenario-added',
    entityName: 'MyScenario',
    ...overrides,
  };
}

describe('StructureChangeLogPanel', () => {
  it('renders empty state when no entries', () => {
    const { container } = render(
      <StructureChangeLogPanel entries={[]} onDelete={() => {}} onClear={() => {}} />
    );
    expect(container.querySelector('.structure-log-empty')).toBeTruthy();
    expect(container.textContent).toContain('No structure changes recorded');
  });

  it('renders entries', () => {
    const entries = [
      makeEntry({ id: 'e1', action: 'scenario-added', entityName: 'Sc1' }),
      makeEntry({ id: 'e2', action: 'test-removed', entityName: 'T1', scenarioName: 'Sc1' }),
    ];
    const { container } = render(
      <StructureChangeLogPanel entries={entries} onDelete={() => {}} onClear={() => {}} />
    );
    const items = container.querySelectorAll('.structure-log-item');
    expect(items.length).toBe(2);
    expect(container.textContent).toContain('Scenario added');
    expect(container.textContent).toContain('Test removed');
    expect(container.textContent).toContain('Sc1');
  });

  it('shows scenario name in detail', () => {
    const entries = [makeEntry({ scenarioName: 'MySc' })];
    const { container } = render(
      <StructureChangeLogPanel entries={entries} onDelete={() => {}} onClear={() => {}} />
    );
    expect(container.textContent).toContain('in MySc');
  });

  it('shows detail text', () => {
    const entries = [makeEntry({ action: 'scenario-renamed', detail: 'Old → New' })];
    const { container } = render(
      <StructureChangeLogPanel entries={entries} onDelete={() => {}} onClear={() => {}} />
    );
    expect(container.textContent).toContain('Old → New');
  });

  it('filters by category', () => {
    const entries = [
      makeEntry({ id: 'e1', action: 'scenario-added', entityName: 'Sc1' }),
      makeEntry({ id: 'e2', action: 'test-added', entityName: 'T1' }),
      makeEntry({ id: 'e3', action: 'fg-renamed', entityName: 'FG1' }),
    ];
    const { container } = render(
      <StructureChangeLogPanel entries={entries} onDelete={() => {}} onClear={() => {}} />
    );
    // Initially all visible
    expect(container.querySelectorAll('.structure-log-item').length).toBe(3);

    // Filter to 'Scenario'
    const scenarioBtn = Array.from(container.querySelectorAll('.structure-log-filter-btn')).find(b => b.textContent === 'Scenario')!;
    fireEvent.click(scenarioBtn);
    expect(container.querySelectorAll('.structure-log-item').length).toBe(1);
    expect(container.textContent).toContain('1 of 3');

    // Filter to 'Test'
    const testBtn = Array.from(container.querySelectorAll('.structure-log-filter-btn')).find(b => b.textContent === 'Test')!;
    fireEvent.click(testBtn);
    expect(container.querySelectorAll('.structure-log-item').length).toBe(1);

    // Filter to 'Group'
    const groupBtn = Array.from(container.querySelectorAll('.structure-log-filter-btn')).find(b => b.textContent === 'Group')!;
    fireEvent.click(groupBtn);
    expect(container.querySelectorAll('.structure-log-item').length).toBe(1);
  });

  it('calls onDelete when delete button clicked', () => {
    const onDelete = vi.fn();
    const entries = [makeEntry({ id: 'e1' })];
    const { container } = render(
      <StructureChangeLogPanel entries={entries} onDelete={onDelete} onClear={() => {}} />
    );
    fireEvent.click(container.querySelector('.structure-log-delete-btn')!);
    expect(onDelete).toHaveBeenCalledWith('e1');
  });

  it('clear requires confirmation', () => {
    const onClear = vi.fn();
    const entries = [makeEntry()];
    const { container } = render(
      <StructureChangeLogPanel entries={entries} onDelete={() => {}} onClear={onClear} />
    );
    // Click Clear button
    const clearBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Clear')!;
    fireEvent.click(clearBtn);
    // Should show confirm
    expect(container.textContent).toContain('Clear all?');
    expect(onClear).not.toHaveBeenCalled();

    // Click Yes
    const yesBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Yes')!;
    fireEvent.click(yesBtn);
    expect(onClear).toHaveBeenCalled();
  });

  it('clear confirmation can be cancelled', () => {
    const onClear = vi.fn();
    const entries = [makeEntry()];
    const { container } = render(
      <StructureChangeLogPanel entries={entries} onDelete={() => {}} onClear={onClear} />
    );
    const clearBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Clear')!;
    fireEvent.click(clearBtn);
    const noBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'No')!;
    fireEvent.click(noBtn);
    expect(onClear).not.toHaveBeenCalled();
    // Confirm UI should be gone
    expect(container.textContent).not.toContain('Clear all?');
  });

  it('shows footer count', () => {
    const entries = [makeEntry({ id: 'e1' }), makeEntry({ id: 'e2' })];
    const { container } = render(
      <StructureChangeLogPanel entries={entries} onDelete={() => {}} onClear={() => {}} />
    );
    expect(container.querySelector('.structure-log-footer-count')!.textContent).toBe('2 entries');
  });

  it('shows singular entry count', () => {
    const entries = [makeEntry()];
    const { container } = render(
      <StructureChangeLogPanel entries={entries} onDelete={() => {}} onClear={() => {}} />
    );
    expect(container.querySelector('.structure-log-footer-count')!.textContent).toBe('1 entry');
  });
});
