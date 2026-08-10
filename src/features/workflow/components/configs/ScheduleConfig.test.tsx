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
  it('renders schedule-config root and section cards', () => {
    render(<ScheduleConfig {...defaultProps} />);
    expect(screen.getByTestId('schedule-config')).toBeTruthy();
    expect(screen.getByText('Schedule')).toBeTruthy();
    expect(screen.getByText('Common cron examples')).toBeTruthy();
    expect(screen.getByText('Automatic variables')).toBeTruthy();
    expect(screen.getByText('Initial variables')).toBeTruthy();
  });

  it('uses empty object when inputVariables is undefined', () => {
    render(
      <ScheduleConfig
        {...defaultProps}
        data={makeData({ inputVariables: undefined })}
      />,
    );
    expect(screen.getByText('No initial variables')).toBeTruthy();
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
    fireEvent.change(screen.getByLabelText('Cron Expression'), { target: { value: '*/5 * * * *' } });
    expect(onChange).toHaveBeenCalledWith({ cronExpression: '*/5 * * * *' });
  });

  it('applies a cron example when a chip is clicked', () => {
    const onChange = vi.fn();
    render(<ScheduleConfig {...defaultProps} onChange={onChange} />);
    fireEvent.click(screen.getByTitle('Use */15 * * * *'));
    expect(onChange).toHaveBeenCalledWith({ cronExpression: '*/15 * * * *' });
  });

  it('marks the active cron example chip', () => {
    render(<ScheduleConfig {...defaultProps} />);
    expect(screen.getByTitle('Use 0 9 * * MON-FRI').className).toContain('is-active');
  });

  it('renders schedule description input', () => {
    render(<ScheduleConfig {...defaultProps} />);
    expect(screen.getByDisplayValue('Weekdays at 9am')).toBeTruthy();
  });

  it('calls onChange when description changes', () => {
    const onChange = vi.fn();
    render(<ScheduleConfig {...defaultProps} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Schedule Description'), { target: { value: 'Every day' } });
    expect(onChange).toHaveBeenCalledWith({ scheduleDescription: 'Every day' });
  });

  it('renders timezone input', () => {
    render(<ScheduleConfig {...defaultProps} />);
    expect(screen.getByDisplayValue('America/New_York')).toBeTruthy();
  });

  it('calls onChange when timezone changes', () => {
    const onChange = vi.fn();
    render(<ScheduleConfig {...defaultProps} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Timezone'), { target: { value: 'UTC' } });
    expect(onChange).toHaveBeenCalledWith({ timezone: 'UTC' });
  });

  it('renders automatic variables info', () => {
    render(<ScheduleConfig {...defaultProps} />);
    expect(screen.getByText('{{triggerTime}}')).toBeTruthy();
    expect(screen.getByText('{{triggerTimestamp}}')).toBeTruthy();
  });

  it('renders common cron examples', () => {
    render(<ScheduleConfig {...defaultProps} />);
    expect(screen.getByText('Every minute')).toBeTruthy();
    expect(screen.getByText('Weekdays at 9:00')).toBeTruthy();
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

  it('calls onChange with inputVariables when a variable is added', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ScheduleConfigWithVarState onChange={onChange} />);

    await user.type(screen.getByPlaceholderText('name'), 'region');
    await user.type(screen.getByPlaceholderText('value'), 'us-east');
    await user.click(screen.getByRole('button', { name: 'Add variable' }));

    expect(onChange).toHaveBeenCalledWith({ inputVariables: { region: 'us-east' } });
  });

  it('updates the schedule label', () => {
    const onChange = vi.fn();
    render(<ScheduleConfig {...defaultProps} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Schedule label'), { target: { value: 'Nightly' } });
    expect(onChange).toHaveBeenCalledWith({ label: 'Nightly' });
  });

  it('renames an initial variable key after sanitizing braces and whitespace', () => {
    const onChange = vi.fn();
    render(
      <ScheduleConfig
        {...defaultProps}
        onChange={onChange}
        data={makeData({ inputVariables: { oldKey: 'v1', keep: 'v2' } })}
      />,
    );
    fireEvent.change(screen.getByLabelText('Variable name oldKey'), {
      target: { value: '  {{newKey}}  ' },
    });
    expect(onChange).toHaveBeenCalledWith({ inputVariables: { newKey: 'v1', keep: 'v2' } });
  });

  it('does not rename when sanitized key is empty or unchanged', () => {
    const onChange = vi.fn();
    render(
      <ScheduleConfig
        {...defaultProps}
        onChange={onChange}
        data={makeData({ inputVariables: { oldKey: 'v1' } })}
      />,
    );
    fireEvent.change(screen.getByLabelText('Variable name oldKey'), {
      target: { value: '  {{oldKey}}  ' },
    });
    fireEvent.change(screen.getByLabelText('Variable name oldKey'), {
      target: { value: '   {}   ' },
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('updates an existing initial variable value inline', () => {
    const onChange = vi.fn();
    render(
      <ScheduleConfig
        {...defaultProps}
        onChange={onChange}
        data={makeData({ inputVariables: { region: 'us', env: 'prod' } })}
      />,
    );
    fireEvent.change(screen.getByLabelText('Value for region'), { target: { value: 'eu' } });
    expect(onChange).toHaveBeenCalledWith({ inputVariables: { region: 'eu', env: 'prod' } });
  });

  it('focuses name input when row add button is clicked with empty key', () => {
    render(<ScheduleConfigWithVarState onChange={vi.fn()} />);
    const nameInput = screen.getByLabelText('New variable name');
    fireEvent.click(screen.getByRole('button', { name: 'Add variable' }));
    expect(document.activeElement).toBe(nameInput);
  });

  it('adds variable when Enter is pressed in name or value input', () => {
    const onChange = vi.fn();
    const setNewVarKey = vi.fn();
    const setNewVarValue = vi.fn();
    render(
      <ScheduleConfig
        {...defaultProps}
        onChange={onChange}
        newVarKey="{{region}}"
        setNewVarKey={setNewVarKey}
        newVarValue="us-east"
        setNewVarValue={setNewVarValue}
      />,
    );

    fireEvent.keyDown(screen.getByLabelText('New variable name'), { key: 'Enter' });
    fireEvent.keyDown(screen.getByLabelText('New variable value'), { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith({ inputVariables: { region: 'us-east' } });
    expect(setNewVarKey).toHaveBeenCalledWith('');
    expect(setNewVarValue).toHaveBeenCalledWith('');
  });

  it('forwards new variable draft input changes to setters', () => {
    const setNewVarKey = vi.fn();
    const setNewVarValue = vi.fn();
    render(
      <ScheduleConfig
        {...defaultProps}
        setNewVarKey={setNewVarKey}
        setNewVarValue={setNewVarValue}
      />,
    );
    fireEvent.change(screen.getByLabelText('New variable name'), { target: { value: 'team' } });
    fireEvent.change(screen.getByLabelText('New variable value'), { target: { value: 'core' } });
    expect(setNewVarKey).toHaveBeenCalledWith('team');
    expect(setNewVarValue).toHaveBeenCalledWith('core');
  });

  it('header add button adds variable when draft key is present', () => {
    const onChange = vi.fn();
    const setNewVarKey = vi.fn();
    const setNewVarValue = vi.fn();
    render(
      <ScheduleConfig
        {...defaultProps}
        onChange={onChange}
        newVarKey="{{batchId}}"
        setNewVarKey={setNewVarKey}
        newVarValue="b-1"
        setNewVarValue={setNewVarValue}
      />,
    );

    fireEvent.click(screen.getByTestId('schedule-var-add-btn'));
    expect(onChange).toHaveBeenCalledWith({ inputVariables: { batchId: 'b-1' } });
    expect(setNewVarKey).toHaveBeenCalledWith('');
    expect(setNewVarValue).toHaveBeenCalledWith('');
  });

  it('removes an initial variable from the list', () => {
    const onChange = vi.fn();
    render(
      <ScheduleConfig
        {...defaultProps}
        onChange={onChange}
        data={makeData({ inputVariables: { region: 'us', env: 'prod' } })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Remove variable region' }));
    expect(onChange).toHaveBeenCalledWith({ inputVariables: { env: 'prod' } });
  });
});
