/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { ComponentProps } from 'react';
import { TestEditorTabs } from './TestEditorTabs';
import type { Scenario } from '../../../shared/types';
import type { TestEditorTab } from './TestEditorModal';

function makeDraft(overrides: Partial<Scenario> = {}): Scenario {
  return {
    id: 's1',
    name: 'Scenario 1',
    url: 'https://api.example.com',
    method: 'GET',
    headers: [],
    body: '',
    bodyForm: [],
    auth: { type: 'none' },
    validation: { mode: 'none' },
    assertions: [],
    extractions: [],
    ...overrides,
  } as Scenario;
}

function renderTabs(props: Partial<ComponentProps<typeof TestEditorTabs>> = {}) {
  const onActiveTabChange = vi.fn();
  render(
    <TestEditorTabs
      isHttp={true}
      isWs={false}
      draft={makeDraft()}
      activeTab={'params' as TestEditorTab}
      onActiveTabChange={onActiveTabChange}
      paramCount={0}
      headerCount={0}
      scenarioKind={'standard'}
      isNew={false}
      defVersionCount={0}
      {...props}
    />,
  );
  return { onActiveTabChange };
}

describe('TestEditorTabs', () => {
  it('renders HTTP tabs and dispatches active tab changes', () => {
    const { onActiveTabChange } = renderTabs({
      draft: makeDraft({ method: 'POST', body: '{"x":1}' }),
      paramCount: 2,
      headerCount: 3,
      defVersionCount: 4,
    });

    fireEvent.click(screen.getByRole('button', { name: /Params/i }));
    fireEvent.click(screen.getByRole('button', { name: /Body/i }));
    fireEvent.click(screen.getByRole('button', { name: /Auth/i }));
    fireEvent.click(screen.getByRole('button', { name: /Headers/i }));
    fireEvent.click(screen.getByRole('button', { name: /Validation/i }));
    fireEvent.click(screen.getByRole('button', { name: /Extract/i }));
    fireEvent.click(screen.getByRole('button', { name: /History/i }));

    expect(onActiveTabChange).toHaveBeenCalledWith('params');
    expect(onActiveTabChange).toHaveBeenCalledWith('body');
    expect(onActiveTabChange).toHaveBeenCalledWith('auth');
    expect(onActiveTabChange).toHaveBeenCalledWith('headers');
    expect(onActiveTabChange).toHaveBeenCalledWith('validation');
    expect(onActiveTabChange).toHaveBeenCalledWith('extract');
    expect(onActiveTabChange).toHaveBeenCalledWith('history');
  });

  it('shows indicator badges for body/auth/validation/extract and hides history for new scenarios', () => {
    renderTabs({
      draft: makeDraft({
        method: 'POST',
        bodyForm: [{ key: 'x', value: '1', enabled: true }],
        auth: { type: 'bearer', token: 'abc' } as Scenario['auth'],
        validation: { mode: 'selective' } as Scenario['validation'],
        assertions: [{ id: 'a1' } as Scenario['assertions'][number]],
        extractions: [{ id: 'e1' } as Scenario['extractions'][number]],
      }),
      isNew: true,
    });

    const dots = document.querySelectorAll('.tab-badge-dot');
    expect(dots.length).toBeGreaterThanOrEqual(3);
    expect(screen.getByRole('button', { name: /Extract/i }).querySelector('.tab-badge')?.textContent).toBe('1');
    expect(screen.queryByRole('button', { name: /History/i })).toBeNull();
  });

  it('hides body tab for GET requests and supports ws-only extract tab', () => {
    const { onActiveTabChange } = renderTabs({
      isHttp: false,
      isWs: true,
      draft: makeDraft({ method: 'GET' }),
    });

    expect(screen.queryByRole('button', { name: /Body/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Params/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Auth/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Headers/i })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Extract/i }));
    expect(onActiveTabChange).toHaveBeenCalledWith('extract');
  });

  it('switches between Parameterize and Data Source tabs based on dataSource presence', () => {
    const { onActiveTabChange } = renderTabs({
      scenarioKind: 'kafka',
      draft: makeDraft({ dataSource: undefined }),
    });

    fireEvent.click(screen.getByRole('button', { name: /Parameterize/i }));
    expect(onActiveTabChange).toHaveBeenCalledWith('data');

    renderTabs({
      scenarioKind: 'kafka',
      draft: makeDraft({
        dataSource: {
          columns: [{ id: 'id', name: 'id', type: 'param', mapping: 'id' }],
          rows: [
            { id: 'r1', enabled: true, values: { id: '1' } },
            { id: 'r2', enabled: false, values: { id: '2' } },
          ],
          source: { type: 'inline' },
        } as Scenario['dataSource'],
      }),
    });

    const dataSourceBtn = screen.getByRole('button', { name: /Data Source/i });
    expect(dataSourceBtn.querySelector('.tab-badge')?.textContent).toBe('1');
    fireEvent.click(dataSourceBtn);
    expect(onActiveTabChange).toHaveBeenCalledWith('data');
  });

  it('hides the Data Source badge for an enabled but empty starter row', () => {
    renderTabs({
      draft: makeDraft({
        dataSource: {
          columns: [{ id: 'c1', name: 'userId', type: 'path', mapping: 'userId' }],
          rows: [{ id: 'r1', enabled: true, values: { c1: '' } }],
          source: { type: 'inline' },
        } as Scenario['dataSource'],
      }),
    });

    const dataSourceBtn = screen.getByRole('button', { name: /Data Source/i });
    expect(dataSourceBtn.querySelector('.tab-badge')).toBeNull();
  });

  it('shows the Data Source tab for a standard scenario when the test has a dataSource (converted copy)', () => {
    const { onActiveTabChange } = renderTabs({
      scenarioKind: 'standard',
      draft: makeDraft({
        dataSource: {
          columns: [{ id: 'userId', name: 'userId', type: 'param', mapping: 'userId' }],
          rows: [{ id: 'r1', enabled: true, values: { userId: '{{userId}}' } }],
          source: { type: 'inline' },
        } as Scenario['dataSource'],
      }),
    });

    // No "Parameterize" empty-state tab, but the Data Source tab is present.
    expect(screen.queryByRole('button', { name: /Parameterize/i })).toBeNull();
    const dataSourceBtn = screen.getByRole('button', { name: /Data Source/i });
    fireEvent.click(dataSourceBtn);
    expect(onActiveTabChange).toHaveBeenCalledWith('data');
  });

  it('hides validation and extract tabs when data source contains validate column', () => {
    renderTabs({
      draft: makeDraft({
        dataSource: {
          columns: [{ key: 'v', type: 'validate' }],
          rows: [],
          source: { type: 'inline' },
        } as Scenario['dataSource'],
      }),
    });

    expect(screen.queryByRole('button', { name: /Validation/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Extract/i })).toBeNull();
  });
});
