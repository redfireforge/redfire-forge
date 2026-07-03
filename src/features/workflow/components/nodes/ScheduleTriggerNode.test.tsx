/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import ScheduleTriggerNode from './ScheduleTriggerNode';

vi.mock('@xyflow/react', () => ({
  Handle: (props: { type: string; id?: string }) => <div data-testid={`handle-${props.type}${props.id ? `-${props.id}` : ''}`} />,
  Position: { Bottom: 'bottom' },
}));

const handleConfigure = vi.fn();
const useNodeBaseMock = vi.hoisted(() => vi.fn(() => ({ rs: { state: 'idle' }, stateClass: '', debugStep: true, handleConfigure })));
vi.mock('./useNodeBase', () => ({ useNodeBase: (id: string) => useNodeBaseMock(id) }));
vi.mock('./NodeIcon', () => ({ NodeIcon: () => <div data-testid="node-icon" />, getNodeCategory: () => 'Trigger' }));
vi.mock('./NodePausedOverlay', () => ({ NodePausedOverlay: (props: { nodeId: string }) => <div data-testid={`paused-${props.nodeId}`} /> }));
vi.mock('./NodeConfigureButton', () => ({ NodeConfigureButton: (props: { title: string; onClick: (e: React.MouseEvent) => void }) => <button data-testid="configure-btn" title={props.title} onClick={(e) => props.onClick(e as never)}>cfg</button> }));

describe('ScheduleTriggerNode', () => {
  const baseProps = {
    id: 'sched-1',
    data: { label: 'My Schedule', inputVariables: { a: '1', b: '2' }, scheduleDescription: 'Every hour', cronExpression: '0 * * * *' } as never,
    selected: false,
    dragging: false,
    zIndex: 1,
    type: 'schedule' as const,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    isConnectable: true,
    xPos: 0,
    yPos: 0,
  };

  it('renders schedule details, variable count, configure button, and source handle', () => {
    render(<ScheduleTriggerNode {...baseProps} />);
    expect(screen.getByText('My Schedule')).toBeTruthy();
    expect(screen.getByText('Trigger')).toBeTruthy();
    expect(screen.getByText('Every hour')).toBeTruthy();
    expect(screen.getByText('0 * * * *')).toBeTruthy();
    expect(screen.getByText('2 variables')).toBeTruthy();
    expect(screen.getByTestId('paused-sched-1')).toBeTruthy();
    expect(screen.getByTestId('handle-source-out')).toBeTruthy();
  });

  it('falls back to default label and singular variable text', () => {
    render(<ScheduleTriggerNode {...baseProps} data={{ inputVariables: { only: '1' } } as never} />);
    expect(screen.getByText('Schedule')).toBeTruthy();
    expect(screen.getByText('1 variable')).toBeTruthy();
  });

  it('hides optional schedule detail sections and applies selected class when empty', () => {
    const { container } = render(
      <ScheduleTriggerNode
        {...baseProps}
        selected={true}
        data={{ inputVariables: {} } as never}
      />,
    );
    expect(container.querySelector('.wf-node-selected')).toBeTruthy();
    expect(container.querySelector('.wf-schedule-desc')).toBeNull();
    expect(container.querySelector('.wf-schedule-cron')).toBeNull();
    expect(container.querySelector('.wf-schedule-vars')).toBeNull();
  });

  it('calls configure handler from the configure button', () => {
    handleConfigure.mockClear();
    render(<ScheduleTriggerNode {...baseProps} />);
    fireEvent.click(screen.getByTestId('configure-btn'));
    expect(handleConfigure).toHaveBeenCalled();
  });
});
