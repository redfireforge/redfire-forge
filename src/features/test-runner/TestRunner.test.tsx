/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import TestRunner from './TestRunner';
import { STANDARD_VARIANT } from './components/runnerVariants';

const captured = vi.hoisted(() => ({ props: null as Record<string, unknown> | null }));

vi.mock('./components/RunnerPage', () => ({
  default: (props: Record<string, unknown>) => {
    captured.props = props;
    return <div data-testid="runner-page">{(props.variant as { title: string }).title}</div>;
  },
}));

describe('TestRunner', () => {
  it('renders RunnerPage with the standard variant', () => {
    render(<TestRunner featureGroups={[]} onComplete={vi.fn()} />);
    expect(screen.getByTestId('runner-page')).toHaveTextContent('Test Runner');
    expect(captured.props?.variant).toBe(STANDARD_VARIANT);
  });

  it('forwards its props through to RunnerPage', () => {
    const onComplete = vi.fn();
    render(<TestRunner featureGroups={[]} onComplete={onComplete} envName="Env" svcName="Svc" />);
    expect(captured.props?.onComplete).toBe(onComplete);
    expect(captured.props?.envName).toBe('Env');
    expect(captured.props?.svcName).toBe('Svc');
  });
});
