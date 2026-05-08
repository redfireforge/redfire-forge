/**
 * @vitest-environment jsdom
 */
import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ScheduleConfig from './ScheduleConfig';
import type { ScheduleTriggerNodeData } from '../../types/workflow';

function makeData(overrides: Partial<ScheduleTriggerNodeData> = {}): ScheduleTriggerNodeData {
  return {
    label: 'Schedule',
    cronExpression: '0 9 * * MON-FRI',
    timezone: 'America/New_York',
    scheduleDescription: 'Weekdays at 9am',
    inputVariables: {},
    notes: '',
    ...overrides,
  };
}

const defaultProps = {
  data: makeData(),
  onChange: vi.fn(),
  newVarKey: '',
  setNewVarKey: vi.fn(),
  newVarValue: '',
  setNewVarValue: vi.fn(),
  workflowVariables: {},
};

function ScheduleConfigWithVarState(
  props: Omit<typeof defaultProps, 'newVarKey' | 'setNewVarKey' | 'newVarValue' | 'setNewVarValue'>,
) {
  const [newVarKey, setNewVarKey] = useState('');
  const [newVarValue, setNewVarValue] = useState('');
  return (
    <ScheduleConfig
      {...defaultProps}
      {...props}
      newVarKey={newVarKey}
      setNewVarKey={setNewVarKey}
      newVarValue={newVarValue}
      setNewVarValue={setNewVarValue}
    />
  );
}

describe('ScheduleConfig', () => {
  it('uses empty object when inputVariables is undefined', () => {
    render(
      <ScheduleConfig
        {...defaultProps}
        data={makeData({ inputVariables: undefined })}
      />,
    );
    expect(screen.getByText('Initial variables')).toBeTruthy();
  });

  it('uses empty notes when notes is undefined', () => {
    render(
      <ScheduleConfig
        {...defaultProps}
        data={makeData({ notes: undefined })}
      />,
    );
    const textarea = screen.getByPlaceholderText(/Documentation or notes about this schedule/) as HTMLTextAreaElement;
    expect(textarea.value).toBe('');
  });

  it('renders cron expression input', () => {
    render(<ScheduleConfig {...defaultProps} />);
    expect(screen.getByDisplayValue('0 9 * * MON-FRI')).toBeTruthy();
  });

  it('calls onChange when cron expression changes', () => {
    const onChange = vi.fn();
    render(<ScheduleConfig {...defaultProps} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('0 9 * * MON-FRI'), { target: { value: '*/5 * * * *' } });
    expect(onChange).toHaveBeenCalledWith({ cronExpression: '*/5 * * * *' });
  });

  it('renders schedule description input', () => {
    render(<ScheduleConfig {...defaultProps} />);
    expect(screen.getByDisplayValue('Weekdays at 9am')).toBeTruthy();
  });

  it('calls onChange when description changes', () => {
    const onChange = vi.fn();
    render(<ScheduleConfig {...defaultProps} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('Weekdays at 9am'), { target: { value: 'Every day' } });
    expect(onChange).toHaveBeenCalledWith({ scheduleDescription: 'Every day' });
  });

  it('renders timezone input', () => {
    render(<ScheduleConfig {...defaultProps} />);
    expect(screen.getByDisplayValue('America/New_York')).toBeTruthy();
  });

  it('calls onChange when timezone changes', () => {
    const onChange = vi.fn();
    render(<ScheduleConfig {...defaultProps} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('America/New_York'), { target: { value: 'UTC' } });
    expect(onChange).toHaveBeenCalledWith({ timezone: 'UTC' });
  });

  it('renders schedule info panel with cron value', () => {
    render(<ScheduleConfig {...defaultProps} />);
    const codeEls = document.querySelectorAll('.wf-schedule-info-code');
    const cronCode = Array.from(codeEls).find(el => el.textContent === '0 9 * * MON-FRI');
    expect(cronCode).toBeTruthy();
  });

  it('shows (not set) when cronExpression is empty', () => {
    render(<ScheduleConfig {...defaultProps} data={makeData({ cronExpression: '' })} />);
    const codeEls = document.querySelectorAll('.wf-schedule-info-code');
    const notSet = Array.from(codeEls).find(el => el.textContent === '(not set)');
    expect(notSet).toBeTruthy();
  });

  it('shows schedule description in info panel when present', () => {
    render(<ScheduleConfig {...defaultProps} />);
    expect(screen.getByText('Weekdays at 9am')).toBeTruthy();
  });

  it('hides schedule description row when absent', () => {
    render(<ScheduleConfig {...defaultProps} data={makeData({ scheduleDescription: undefined })} />);
    // Should not find a Description strong that has content after it
    const rows = document.querySelectorAll('.wf-schedule-info-row');
    const descRow = Array.from(rows).find(r => r.textContent?.includes('Description:'));
    expect(descRow).toBeFalsy();
  });

  it('shows timezone in info panel', () => {
    render(<ScheduleConfig {...defaultProps} />);
    const codeEls = document.querySelectorAll('.wf-schedule-info-code');
    const tz = Array.from(codeEls).find(el => el.textContent === 'America/New_York');
    expect(tz).toBeTruthy();
  });

  it('defaults timezone display to UTC when empty', () => {
    render(<ScheduleConfig {...defaultProps} data={makeData({ timezone: '' })} />);
    const codeEls = document.querySelectorAll('.wf-schedule-info-code');
    const utc = Array.from(codeEls).find(el => el.textContent === 'UTC');
    expect(utc).toBeTruthy();
  });

  it('renders automatic variables info', () => {
    render(<ScheduleConfig {...defaultProps} />);
    expect(screen.getByText(/triggerTime/)).toBeTruthy();
    expect(screen.getByText(/triggerTimestamp/)).toBeTruthy();
  });

  it('renders cron examples in details/summary', () => {
    render(<ScheduleConfig {...defaultProps} />);
    expect(screen.getByText('Common Cron Examples')).toBeTruthy();
  });

  it('renders notes textarea', () => {
    render(<ScheduleConfig {...defaultProps} data={makeData({ notes: 'some notes' })} />);
    expect(screen.getByDisplayValue('some notes')).toBeTruthy();
  });

  it('calls onChange when notes change', () => {
    const onChange = vi.fn();
    render(<ScheduleConfig {...defaultProps} onChange={onChange} data={makeData({ notes: '' })} />);
    const textarea = screen.getByPlaceholderText(/Documentation or notes about this schedule/);
    fireEvent.change(textarea, { target: { value: 'Updated note' } });
    expect(onChange).toHaveBeenCalledWith({ notes: 'Updated note' });
  });

  it('renders VariablesSection for initial variables', () => {
    render(<ScheduleConfig {...defaultProps} />);
    expect(screen.getByText('Initial variables')).toBeTruthy();
  });

  it('calls onChange with inputVariables when a variable is added', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ScheduleConfigWithVarState onChange={onChange} />);

    await user.type(screen.getByPlaceholderText('name'), 'region');
    await user.type(screen.getByPlaceholderText('value'), 'us-east');
    await user.click(screen.getByRole('button', { name: '+' }));

    expect(onChange).toHaveBeenCalledWith({ inputVariables: { region: 'us-east' } });
  });
});
