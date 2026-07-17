/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VariableContextBadge from './VariableContextBar';

const openVariableDetail = vi.fn();
vi.mock('./WorkflowInspectContext', () => ({
  useWorkflowInspect: () => ({ openVariableDetail }),
}));

vi.mock('../../../../shared/hooks/useModalDrag', () => ({
  useModalDrag: () => ({ onDragStart: vi.fn(), overlayStyle: {}, modalStyle: {} }),
}));

describe('VariableContextBadge', () => {
  it('returns null when there are no variables', () => {
    const { container } = render(<VariableContextBadge variables={{}} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders badge with count', () => {
    render(<VariableContextBadge variables={{ a: '1', b: '2' }} />);
    expect(screen.getByText('Context')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('opens modal showing variable entries', async () => {
    const user = userEvent.setup();
    render(<VariableContextBadge variables={{ token: 'abc', httpStatus: '200' }} />);
    await user.click(screen.getByRole('button', { name: /workflow context, 2 variables/i }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('{{token}}')).toBeTruthy();
    expect(screen.getByText('abc')).toBeTruthy();
  });

  it('filters entries by search', async () => {
    const user = userEvent.setup();
    render(<VariableContextBadge variables={{ token: 'abc', httpStatus: '200' }} />);
    await user.click(screen.getByRole('button', { name: /workflow context/i }));
    const search = screen.getByLabelText('Search variables');
    await user.type(search, 'token');
    expect(screen.getByText('{{token}}')).toBeTruthy();
    expect(screen.queryByText('{{httpStatus}}')).toBeNull();
  });

  it('shows no-results message when filter matches nothing', async () => {
    const user = userEvent.setup();
    render(<VariableContextBadge variables={{ token: 'abc' }} />);
    await user.click(screen.getByRole('button', { name: /workflow context/i }));
    await user.type(screen.getByLabelText('Search variables'), 'zzz');
    expect(screen.getByText(/No variables match/)).toBeTruthy();
  });

  it('opens variable detail and keeps context modal open', async () => {
    const user = userEvent.setup();
    render(<VariableContextBadge variables={{ token: 'abc' }} />);
    await user.click(screen.getByRole('button', { name: /workflow context/i }));
    await user.click(screen.getByTitle('View or edit in Initial variables'));
    expect(openVariableDetail).toHaveBeenCalledWith('token', 'abc');
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('closes via Close button', async () => {
    const user = userEvent.setup();
    render(<VariableContextBadge variables={{ token: 'abc' }} />);
    await user.click(screen.getByRole('button', { name: /workflow context/i }));
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders modal in workflow designer mount (not inside canvas)', async () => {
    const mount = document.createElement('div');
    mount.className = 'workflow-designer-mount';
    document.body.appendChild(mount);
    const user = userEvent.setup();
    render(<VariableContextBadge variables={{ token: 'abc' }} />);
    await user.click(screen.getByRole('button', { name: /workflow context/i }));
    expect(mount.querySelector('.wf-vars-modal-overlay')).toBeTruthy();
    mount.remove();
  });

  it('closes when clicking the overlay backdrop', async () => {
    const user = userEvent.setup();
    render(<VariableContextBadge variables={{ token: 'abc' }} />);
    await user.click(screen.getByRole('button', { name: /workflow context/i }));
    const overlay = document.body.querySelector('.wf-vars-modal-overlay') as HTMLElement;
    await user.click(overlay);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('does not close when clicking inside the modal', async () => {
    const user = userEvent.setup();
    render(<VariableContextBadge variables={{ token: 'abc' }} />);
    await user.click(screen.getByRole('button', { name: /workflow context/i }));
    await user.click(screen.getByRole('dialog'));
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('closes on Escape key', async () => {
    const user = userEvent.setup();
    render(<VariableContextBadge variables={{ token: 'abc' }} />);
    await user.click(screen.getByRole('button', { name: /workflow context/i }));
    fireEvent.keyDown(screen.getByLabelText('Search variables'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
