/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ConfigSectionGroup from './ConfigSectionGroup';

describe('ConfigSectionGroup', () => {
  it('renders title and children when defaultOpen', () => {
    render(
      <ConfigSectionGroup title="Settings">
        <p>Content here</p>
      </ConfigSectionGroup>
    );
    expect(screen.getByText('Settings')).toBeTruthy();
    expect(screen.getByText('Content here')).toBeTruthy();
  });

  it('renders count badge when count is provided', () => {
    render(
      <ConfigSectionGroup title="Items" count={5}>
        <p>Body</p>
      </ConfigSectionGroup>
    );
    expect(screen.getByText('5')).toBeTruthy();
  });

  it('does not render count badge when count is undefined', () => {
    const { container } = render(
      <ConfigSectionGroup title="Items">
        <p>Body</p>
      </ConfigSectionGroup>
    );
    expect(container.querySelector('.wf-config-group-count')).toBeNull();
  });

  it('toggles collapsed state on header click', () => {
    const { container } = render(
      <ConfigSectionGroup title="Toggle Me">
        <p>Hidden content</p>
      </ConfigSectionGroup>
    );
    const header = container.querySelector('.wf-config-group-header')!;
    expect(header.classList.contains('collapsed')).toBe(false);

    fireEvent.click(header);
    expect(header.classList.contains('collapsed')).toBe(true);

    fireEvent.click(header);
    expect(header.classList.contains('collapsed')).toBe(false);
  });

  it('starts collapsed when defaultOpen is false', () => {
    const { container } = render(
      <ConfigSectionGroup title="Closed" defaultOpen={false}>
        <p>Body</p>
      </ConfigSectionGroup>
    );
    const header = container.querySelector('.wf-config-group-header')!;
    expect(header.classList.contains('collapsed')).toBe(true);
  });

  it('renders count of 0', () => {
    render(
      <ConfigSectionGroup title="Empty" count={0}>
        <p>Body</p>
      </ConfigSectionGroup>
    );
    expect(screen.getByText('0')).toBeTruthy();
  });
});
