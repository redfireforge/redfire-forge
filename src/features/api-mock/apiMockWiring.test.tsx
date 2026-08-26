/**
 * @vitest-environment jsdom
 *
 * API Mock Studio — wiring integration tests for the features filled in from the
 * mockups: Response editor tab, Simulate modal, and Import modal.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ApiMockStudioPage } from './ApiMockStudioPage';
import { resetApiMockWorkspaceSnapshot } from './apiMockPersistence';

vi.mock('./components/ApiMockBodyEditor', () => ({
  ApiMockBodyEditor: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea data-testid="api-mock-variant-body" value={value} onChange={e => onChange(e.target.value)} />
  ),
}));
vi.mock('../../shared/components/data-mapper/DataMapperModal', () => ({ default: () => null }));

/** Creating a server asks the control plane for a free port, so it settles async. */
async function studioWithRoute() {
  render(<ApiMockStudioPage />);
  fireEvent.click(await screen.findByTestId('api-mock-landing-create'));
  await screen.findByTestId('api-mock-server-bar');
  fireEvent.click(screen.getByTestId('api-mock-add-route'));
}

describe('API Mock Studio wiring', () => {
  beforeEach(() => {
    localStorage.clear();
    resetApiMockWorkspaceSnapshot();
  });

  it('renders the full response editor in the Response tab', async () => {
    await studioWithRoute();
    const tablist = screen.getByRole('tablist', { name: 'Route editor sections' });
    fireEvent.click(within(tablist).getAllByRole('tab').find(t => t.textContent?.startsWith('Response'))!);
    expect(screen.getByTestId('api-mock-response-editor')).toBeTruthy();
    expect(screen.getByTestId('api-mock-variant-status')).toBeTruthy();
    expect(screen.getByTestId('api-mock-variant-body')).toBeTruthy();
  });

  it('exposes selection mode in Response and fault in Behavior', async () => {
    await studioWithRoute();
    const tablist = screen.getByRole('tablist', { name: 'Route editor sections' });
    fireEvent.click(within(tablist).getAllByRole('tab').find(t => t.textContent?.startsWith('Response'))!);
    fireEvent.click(screen.getByTestId('api-mock-response-tab-selection'));
    expect(screen.getByTestId('api-mock-response-mode')).toBeTruthy();
    fireEvent.click(within(tablist).getAllByRole('tab').find(t => t.textContent?.trim().startsWith('Behavior'))!);
    expect(screen.getByTestId('api-mock-fault-select')).toBeTruthy();
  });

  it('runs a simulation and shows the candidate trace', async () => {
    await studioWithRoute();
    fireEvent.click(screen.getByTestId('api-mock-simulate'));
    const pathInput = screen.getByTestId('api-mock-simulate-path') as HTMLInputElement;
    fireEvent.change(pathInput, { target: { value: '/' } });
    fireEvent.click(screen.getByTestId('api-mock-simulate-run'));
    const result = screen.getByTestId('api-mock-simulate-result');
    expect(result.textContent).toMatch(/MATCHED/i);
  });

  it('opens the import modal from the title-bar Import menu', async () => {
    render(<ApiMockStudioPage />);
    fireEvent.click(await screen.findByTestId('api-mock-landing-create'));
    await screen.findByTestId('api-mock-server-bar');
    // Import is now a single button; the source is chosen inside the modal.
    fireEvent.click(screen.getByTestId('api-mock-import-menu'));
    expect(screen.getByTestId('api-mock-import-review')).toBeTruthy();
    fireEvent.click(screen.getByTestId('api-mock-import-source-curl'));
    expect(screen.getByTestId('api-mock-curl-input')).toBeTruthy();
  });

  it('applies a path pattern from the pattern toolbox with a live test', async () => {
    await studioWithRoute();
    fireEvent.click(screen.getByTestId('api-mock-path-toolbox'));
    fireEvent.click(screen.getByTestId('api-mock-toolbox-preset-/users/:id'));
    expect(screen.getByTestId('api-mock-toolbox-result').textContent).toMatch(/Matches/i);
    fireEvent.click(screen.getByTestId('api-mock-toolbox-apply'));
    expect((screen.getByTestId('api-mock-path-input') as HTMLInputElement).value).toBe('/users/:id');
  });

  it('opens Runtime from the live strip and shows Variables / State tabs', async () => {
    await studioWithRoute();
    expect(screen.getByTestId('api-mock-live-strip')).toBeTruthy();
    fireEvent.click(screen.getByTestId('api-mock-open-runtime'));
    const dock = screen.getByTestId('api-mock-dock');
    expect(dock.getAttribute('data-variant')).toBe('page');
    const list = within(dock).getByRole('tablist', { name: 'Runtime inspector' });
    fireEvent.click(within(list).getAllByRole('tab').find(t => (t.textContent ?? '').startsWith('Variables'))!);
    expect(screen.getByTestId('api-mock-dock-variables-empty')).toBeTruthy();
    fireEvent.click(within(list).getAllByRole('tab').find(t => t.textContent === 'State')!);
    expect(screen.getByTestId('api-mock-dock-state')).toBeTruthy();
  });
});
