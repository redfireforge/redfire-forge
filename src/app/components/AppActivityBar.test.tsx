// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import AppActivityBar from './AppActivityBar';
import type { Tab } from '../utils/appTabUtils';

afterEach(() => cleanup());

function renderBar(activeTab: Tab) {
  const setActiveTab = vi.fn();
  render(<AppActivityBar activeTab={activeTab} setActiveTab={setActiveTab} />);
  return { setActiveTab };
}

describe('AppActivityBar', () => {
  it('marks the API domain active and routes other domains on click', () => {
    const { setActiveTab } = renderBar('requests');

    expect(screen.getByTitle('API').className).toContain('active');
    expect(screen.getByTitle('Workflow').className).not.toContain('active');

    // Clicking the already-active API domain is a no-op (isApiTab branch true)
    fireEvent.click(screen.getByTitle('API'));
    expect(setActiveTab).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTitle('Workflow'));
    fireEvent.click(screen.getByTitle('Harness'));
    fireEvent.click(screen.getByTitle('Gallery'));
    fireEvent.click(screen.getByTitle('Protocols'));
    fireEvent.click(screen.getByTitle('Settings'));

    expect(setActiveTab).toHaveBeenCalledWith('workflow');
    expect(setActiveTab).toHaveBeenCalledWith('scenarios');
    expect(setActiveTab).toHaveBeenCalledWith('gallery');
    expect(setActiveTab).toHaveBeenCalledWith('kafka-message-studio');
    expect(setActiveTab).toHaveBeenCalledWith('environments');
  });

  it('marks the Workflow domain active and does not re-route when already in it', () => {
    const { setActiveTab } = renderBar('workflow-executions');
    expect(screen.getByTitle('Workflow').className).toContain('active');
    fireEvent.click(screen.getByTitle('Workflow'));
    expect(setActiveTab).not.toHaveBeenCalled();
  });

  it('marks the Harness domain active and does not re-route when already in it', () => {
    const { setActiveTab } = renderBar('runner');
    expect(screen.getByTitle('Harness').className).toContain('active');
    fireEvent.click(screen.getByTitle('Harness'));
    expect(setActiveTab).not.toHaveBeenCalled();
  });

  it('marks the Gallery domain active and does not re-route when already in it', () => {
    const { setActiveTab } = renderBar('training');
    expect(screen.getByTitle('Gallery').className).toContain('active');
    fireEvent.click(screen.getByTitle('Gallery'));
    expect(setActiveTab).not.toHaveBeenCalled();
  });

  it('marks the Protocols domain active and does not re-route when already in it', () => {
    const { setActiveTab } = renderBar('websocket-studio');
    expect(screen.getByTitle('Protocols').className).toContain('active');
    fireEvent.click(screen.getByTitle('Protocols'));
    expect(setActiveTab).not.toHaveBeenCalled();
  });

  it('marks the Settings domain active and does not re-route when already in it', () => {
    const { setActiveTab } = renderBar('preferences');
    expect(screen.getByTitle('Settings').className).toContain('active');
    fireEvent.click(screen.getByTitle('Settings'));
    expect(setActiveTab).not.toHaveBeenCalled();
  });

  it('renders all five domain labels plus settings', () => {
    renderBar('requests');
    for (const label of ['API', 'Workflow', 'Harness', 'Gallery', 'Protocols', 'Settings']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });
});
