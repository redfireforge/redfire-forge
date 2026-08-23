/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { selectOptionByIndex } from '@test-utils/customSelectHelper';
import ScenarioBuilderUnassociatedSection from './ScenarioBuilderUnassociatedSection';

const baseFeatureGroups = [
  { id: 'fg-1', name: 'Payments', scenarios: [{ id: 's-1' }, { id: 's-2' }] },
] as never;

const microservices = [
  { id: 'svc-1', name: 'orders', customEnvs: [{ id: 'ce-1', name: 'perf' }] },
] as never;

const environments = [
  { id: 'env-1', name: 'prod' },
] as never;

describe('ScenarioBuilderUnassociatedSection', () => {
  it('renders null when there are no unassociated groups', () => {
    const { container } = render(
      <ScenarioBuilderUnassociatedSection
        unassociatedFeatureGroups={[] as never}
        assignFeatureGroup={vi.fn()}
        removeFeatureGroup={vi.fn()}
        microservices={microservices}
        environments={environments}
        showConfirm={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('assigns directly when selected service and env are provided', () => {
    const assignFeatureGroup = vi.fn();
    render(
      <ScenarioBuilderUnassociatedSection
        unassociatedFeatureGroups={baseFeatureGroups}
        selectedSvcId="svc-1"
        selectedEnvId="env-1"
        assignFeatureGroup={assignFeatureGroup}
        removeFeatureGroup={vi.fn()}
        microservices={microservices}
        environments={environments}
        showConfirm={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Assign here/i }));
    expect(assignFeatureGroup).toHaveBeenCalledWith('fg-1', 'svc-1', 'env-1');
  });

  it('uses dropdown assign path and confirm error when selections are missing', () => {
    const assignFeatureGroup = vi.fn();
    const showConfirm = vi.fn();
    render(
      <ScenarioBuilderUnassociatedSection
        unassociatedFeatureGroups={baseFeatureGroups}
        assignFeatureGroup={assignFeatureGroup}
        removeFeatureGroup={vi.fn()}
        microservices={microservices}
        environments={environments}
        showConfirm={showConfirm}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /^Assign$/i }));
    expect(showConfirm).toHaveBeenCalled();

    selectOptionByIndex(document.body, 0, 'orders');
    selectOptionByIndex(document.body, 1, 'prod');
    fireEvent.click(screen.getByRole('button', { name: /^Assign$/i }));

    expect(assignFeatureGroup).toHaveBeenCalledWith('fg-1', 'svc-1', 'env-1');
  });

  it('deletes a feature group', () => {
    const removeFeatureGroup = vi.fn();
    render(
      <ScenarioBuilderUnassociatedSection
        unassociatedFeatureGroups={baseFeatureGroups}
        assignFeatureGroup={vi.fn()}
        removeFeatureGroup={removeFeatureGroup}
        microservices={microservices}
        environments={environments}
        showConfirm={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Delete/i }));
    expect(removeFeatureGroup).toHaveBeenCalledWith('fg-1');
  });

  it('renders singular scenario label and handles missing custom envs', () => {
    const single = [{ id: 'fg-2', name: 'Billing', scenarios: [{ id: 's-1' }] }] as never;
    const microservicesNoCustom = [{ id: 'svc-1', name: 'orders' }] as never;

    render(
      <ScenarioBuilderUnassociatedSection
        unassociatedFeatureGroups={single}
        assignFeatureGroup={vi.fn()}
        removeFeatureGroup={vi.fn()}
        microservices={microservicesNoCustom}
        environments={environments}
        showConfirm={vi.fn()}
      />,
    );

    expect(screen.getByText(/1 scenario$/i)).toBeInTheDocument();
  });
});
