/**
 * @vitest-environment jsdom
 */
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import WorkflowNodeConfigModal from './WorkflowNodeConfigModal';
import type { Scenario, AuthConfig, ValidationConfig } from '../../../../shared/types';
import type { WorkflowNode } from '../../types/workflow';

const noAuth: AuthConfig = { type: 'none' };
const noValidation: ValidationConfig = { mode: 'none' };

const httpScenario: Scenario = {
  id: 'scenario-1',
  name: 'POST Notification',
  url: 'https://example.com/notify',
  method: 'POST',
  headers: [],
  body: '{"ok":true}',
  auth: noAuth,
  validation: noValidation,
};

const logDebugNode: WorkflowNode = {
  id: 'log-1',
  type: 'logDebug',
  position: { x: 0, y: 0 },
  data: {
    label: 'Error Caught',
    message: 'Workflow error {{error.message}}',
    logLevel: 'error',
    snapshotVariables: true,
  },
};

const httpNode: WorkflowNode = {
  id: 'http-1',
  type: 'http',
  position: { x: 0, y: 0 },
  data: {
    label: 'POST Notification',
    scenario: httpScenario,
    initialVariables: {},
  },
};

function ModalHost() {
  const [node, setNode] = useState<WorkflowNode>(logDebugNode);

  return (
    <>
      <button type="button" onClick={() => setNode(logDebugNode)}>Show LogDebug</button>
      <button type="button" onClick={() => setNode(httpNode)}>Show HTTP</button>
      <WorkflowNodeConfigModal
        key={node.id}
        node={node}
        workflowVariables={{}}
        onUpdateNode={vi.fn()}
        onDeleteNode={vi.fn()}
        onClose={vi.fn()}
        effectiveQuickTestBaseUrl="https://example.com"
        httpVariableHints={[]}
        conditionVariableHints={[]}
        workflowServices={[]}
        workflows={[]}
      />
    </>
  );
}

describe('WorkflowNodeConfigModal node switching', () => {
  it('switches from logDebug to http without rendering a blank screen', () => {
    render(<ModalHost />);

    expect(screen.getByText('Log Debug — Error Caught')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Show HTTP' }));

    expect(screen.getByText('HTTP — POST Notification')).toBeTruthy();
    expect(screen.getByDisplayValue('https://example.com/notify')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Config' })).toBeTruthy();
  });

  it('does not close when the overlay backdrop is clicked', () => {
    const onClose = vi.fn();
    render(
      <WorkflowNodeConfigModal
        key={logDebugNode.id}
        node={logDebugNode}
        workflowVariables={{}}
        onUpdateNode={vi.fn()}
        onDeleteNode={vi.fn()}
        onClose={onClose}
        effectiveQuickTestBaseUrl="https://example.com"
        httpVariableHints={[]}
        conditionVariableHints={[]}
        workflowServices={[]}
        workflows={[]}
      />,
    );

    const overlay = document.body.querySelector('.wf-config-modal-overlay');
    expect(overlay).toBeTruthy();
    fireEvent.click(overlay as Element);

    expect(onClose).not.toHaveBeenCalled();
  });
});