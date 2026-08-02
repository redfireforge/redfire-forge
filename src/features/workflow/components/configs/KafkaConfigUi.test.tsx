/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { KafkaCard, KafkaAddButton, KafkaFormRow, KafkaEmptyState } from './KafkaConfigUi';

describe('KafkaConfigUi', () => {
  it('renders KafkaCard with optional hint/action and test id', () => {
    const onAction = vi.fn();
    render(
      <KafkaCard
        title="Section"
        hint="Hint copy"
        action={<button type="button" onClick={onAction}>Action</button>}
        testId="kafka-card"
      >
        <div>Body</div>
      </KafkaCard>,
    );

    expect(screen.getByTestId('kafka-card')).toBeTruthy();
    expect(screen.getByText('Section')).toBeTruthy();
    expect(screen.getByText('Hint copy').tagName).toBe('SPAN');
    expect(screen.getByTestId('kafka-card').querySelector('.wf-kafka-card-header--hint-below')).toBeNull();
    expect(screen.getByText('Body')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Action' }));
    expect(onAction).toHaveBeenCalled();
  });

  it('renders KafkaCard hint on a second line when hintBelow is set', () => {
    render(
      <KafkaCard title="Output bindings" hint="Long hint copy" hintBelow testId="kafka-card-below">
        <div>Body</div>
      </KafkaCard>,
    );
    expect(screen.getByTestId('kafka-card-below').querySelector('.wf-kafka-card-header--hint-below')).toBeTruthy();
    expect(screen.getByText('Long hint copy').tagName).toBe('P');
  });

  it('renders KafkaCard without optional hint/action', () => {
    render(
      <KafkaCard title="Simple" testId="kafka-card-simple">
        <div>Only body</div>
      </KafkaCard>,
    );
    expect(screen.getByTestId('kafka-card-simple')).toBeTruthy();
    expect(screen.getByText('Simple')).toBeTruthy();
    expect(screen.getByText('Only body')).toBeTruthy();
  });

  it('renders KafkaAddButton and forwards click', () => {
    const onClick = vi.fn();
    render(<KafkaAddButton onClick={onClick} testId="kafka-add" label="Add one" />);
    fireEvent.click(screen.getByTestId('kafka-add'));
    expect(onClick).toHaveBeenCalled();
    expect(screen.getByText('Add one')).toBeTruthy();
  });

  it('renders compact KafkaFormRow with hint slot', () => {
    render(
      <KafkaFormRow label="Label" hint="Compact hint" compact>
        <input aria-label="compact-input" />
      </KafkaFormRow>,
    );
    expect(screen.getByText('Label')).toBeTruthy();
    expect(screen.getByText('Compact hint')).toBeTruthy();
    expect(screen.getByLabelText('compact-input')).toBeTruthy();
  });

  it('renders default KafkaFormRow with and without hint', () => {
    const { rerender } = render(
      <KafkaFormRow label="Default" hint="Default hint" tall>
        <input aria-label="default-input" />
      </KafkaFormRow>,
    );
    expect(screen.getByText('Default hint')).toBeTruthy();

    rerender(
      <KafkaFormRow label="Default no hint">
        <input aria-label="default-no-hint-input" />
      </KafkaFormRow>,
    );
    expect(screen.getByText('Default no hint')).toBeTruthy();
    expect(screen.getByLabelText('default-no-hint-input')).toBeTruthy();
  });

  it('renders KafkaEmptyState with optional title/action', () => {
    const onAction = vi.fn();
    const { rerender } = render(
      <KafkaEmptyState
        title="Empty title"
        text="Empty text"
        actionLabel="Create"
        onAction={onAction}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(onAction).toHaveBeenCalled();

    rerender(<KafkaEmptyState text="Compact text" />);
    expect(screen.getByText('Compact text')).toBeTruthy();
    expect(screen.queryByText('Empty title')).toBeNull();
  });
});
