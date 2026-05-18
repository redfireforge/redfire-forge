/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ConsoleLog from './ConsoleLog';
import type { ConsoleLine } from '../hooks/useResponseCache';

describe('ConsoleLog', () => {
  it('shows placeholder when no lines', () => {
    render(<ConsoleLog lines={[]} />);
    expect(screen.getByText(/Send a request/)).toBeInTheDocument();
  });

  it('maps prefixes to line classes', () => {
    const lines: ConsoleLine[] = [
      { prefix: '*', text: 'info' },
      { prefix: '>', text: 'out' },
      { prefix: '<', text: 'in' },
      { prefix: '#', text: 'body' },
      { prefix: '', text: 'plain' },
      { prefix: 'unknown', text: 'x' },
    ];
    render(<ConsoleLog lines={lines} />);
    expect(screen.getByText('info').closest('.req-cl-info')).toBeTruthy();
    expect(screen.getByText('out').closest('.req-cl-out')).toBeTruthy();
    expect(screen.getByText('in').closest('.req-cl-in')).toBeTruthy();
    expect(screen.getByText('body').closest('.req-cl-body')).toBeTruthy();
    expect(screen.getByText('plain').closest('.req-cl-plain')).toBeTruthy();
    expect(screen.getByText('x').closest('.req-cl-plain')).toBeTruthy();
  });

  it('renders prefixed span only when prefix non-empty', () => {
    const { container } = render(<ConsoleLog lines={[{ prefix: '!', text: 'mark' }]} />);
    expect(container.querySelector('.req-cl-plain')).toBeTruthy();
    expect(container.querySelector('.req-cl-prefix')).toHaveTextContent('!');
  });
});
