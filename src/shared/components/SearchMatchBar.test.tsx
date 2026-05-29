/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SearchMatchBar } from './SearchMatchBar';

const baseProps = {
  value: '',
  onChange: vi.fn(),
  currentMatch: 0,
  totalMatches: 0,
  onPrev: vi.fn(),
  onNext: vi.fn(),
  onClear: vi.fn(),
  placeholder: 'Search...',
};

describe('SearchMatchBar', () => {
  it('renders input with placeholder', () => {
    render(<SearchMatchBar {...baseProps} />);
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
  });

  it('calls onChange when typing', () => {
    const onChange = vi.fn();
    render(<SearchMatchBar {...baseProps} onChange={onChange} />);
    fireEvent.change(screen.getByPlaceholderText('Search...'), { target: { value: 'test' } });
    expect(onChange).toHaveBeenCalledWith('test');
  });

  it('shows match count when value is present and matches exist', () => {
    render(<SearchMatchBar {...baseProps} value="foo" currentMatch={2} totalMatches={5} />);
    expect(screen.getByText('2/5')).toBeInTheDocument();
  });

  it('shows "No match" when value is present but totalMatches is 0', () => {
    render(<SearchMatchBar {...baseProps} value="foo" totalMatches={0} />);
    expect(screen.getByText('No match')).toBeInTheDocument();
  });

  it('hides count when value is empty', () => {
    render(<SearchMatchBar {...baseProps} value="" totalMatches={5} />);
    expect(screen.queryByText(/\/5/)).not.toBeInTheDocument();
  });

  it('calls onPrev and onNext', () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();
    render(<SearchMatchBar {...baseProps} value="q" totalMatches={3} onPrev={onPrev} onNext={onNext} />);
    fireEvent.click(screen.getByLabelText('Previous'));
    expect(onPrev).toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText('Next'));
    expect(onNext).toHaveBeenCalled();
  });

  it('disables nav buttons when totalMatches is 0', () => {
    render(<SearchMatchBar {...baseProps} value="q" totalMatches={0} />);
    expect(screen.getByLabelText('Previous')).toBeDisabled();
    expect(screen.getByLabelText('Next')).toBeDisabled();
  });

  it('calls onClear', () => {
    const onClear = vi.fn();
    render(<SearchMatchBar {...baseProps} value="q" onClear={onClear} />);
    fireEvent.click(screen.getByLabelText('Clear search'));
    expect(onClear).toHaveBeenCalled();
  });

  it('hides clear button when hideClear is true', () => {
    render(<SearchMatchBar {...baseProps} value="q" hideClear />);
    expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument();
  });

  it('renders text nav buttons when navStyle is "text"', () => {
    render(<SearchMatchBar {...baseProps} value="q" totalMatches={3} navStyle="text" />);
    expect(screen.getByText('▲')).toBeInTheDocument();
    expect(screen.getByText('▼')).toBeInTheDocument();
  });

  it('wraps in div when className is provided', () => {
    const { container } = render(<SearchMatchBar {...baseProps} className="my-bar" />);
    expect(container.querySelector('.my-bar')).toBeInTheDocument();
  });

  it('renders without extra wrapper div when className is omitted', () => {
    const { container } = render(<SearchMatchBar {...baseProps} />);
    const rootDiv = container.firstElementChild;
    expect(rootDiv?.classList.length ?? 0).toBe(0);
  });

  it('shows nav when showNavWhenEmpty is true even without value', () => {
    render(<SearchMatchBar {...baseProps} showNavWhenEmpty />);
    expect(screen.getByLabelText('Previous')).toBeInTheDocument();
    expect(screen.getByLabelText('Next')).toBeInTheDocument();
  });

  it('respects controlsVisible override', () => {
    render(<SearchMatchBar {...baseProps} value="" controlsVisible totalMatches={3} currentMatch={1} />);
    expect(screen.getByText('1/3')).toBeInTheDocument();
    expect(screen.getByLabelText('Clear search')).toBeInTheDocument();
  });

  it('hides controls when controlsVisible is false despite value', () => {
    render(<SearchMatchBar {...baseProps} value="q" controlsVisible={false} />);
    expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument();
  });

  it('passes onKeyDown to input', () => {
    const onKeyDown = vi.fn();
    render(<SearchMatchBar {...baseProps} onKeyDown={onKeyDown} />);
    fireEvent.keyDown(screen.getByPlaceholderText('Search...'), { key: 'Enter' });
    expect(onKeyDown).toHaveBeenCalled();
  });
});
